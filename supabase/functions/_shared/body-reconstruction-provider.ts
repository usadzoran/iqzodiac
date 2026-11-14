export type BodyView = {
  angle: "front" | "back" | "left" | "right" | "front_left_45" | "front_right_45" | "back_left_45" | "back_right_45";
  jpeg: Uint8Array;
};

export type ReconstructionResult = {
  glb: Uint8Array;
  faceAnonymized: true;
  providerModelRef?: string;
};

export interface BodyReconstructionProvider {
  reconstruct(input: { modelId: string; images: BodyView[]; signal?: AbortSignal }): Promise<ReconstructionResult>;
}

/**
 * Provider boundary for a future AI vendor. This module intentionally has no
 * default vendor and is not called by the current upload flow. Body images must
 * not leave Supabase until the member separately consents to the selected
 * provider and its retention/data-processing terms.
 *
 * Expected server-side contract (to agree with the chosen vendor before use):
 * POST multipart/form-data with model_id and six angle-named JPEG parts;
 * JSON response { model_glb_base64, face_anonymized: true, model_ref?: string }.
 */
export function createBodyReconstructionProvider(env: (name: string) => string | undefined): BodyReconstructionProvider | null {
  const endpoint = env("BODY3D_RECONSTRUCTION_URL")?.trim();
  const apiKey = env("BODY3D_RECONSTRUCTION_KEY")?.trim();
  if (!endpoint && !apiKey) return null;
  if (!endpoint || !apiKey) throw new Error("Both BODY3D_RECONSTRUCTION_URL and BODY3D_RECONSTRUCTION_KEY are required.");

  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error("BODY3D_RECONSTRUCTION_URL must be a valid HTTPS URL."); }
  if (url.protocol !== "https:") throw new Error("The reconstruction provider must use HTTPS.");

  return {
    async reconstruct({ modelId, images, signal }) {
      const angles = new Set(images.map((image) => image.angle));
      const expected: BodyView["angle"][] = ["front", "back", "left", "right", "front_left_45", "back_left_45"];
      if (images.length !== expected.length || expected.some((angle) => !angles.has(angle))) {
        throw new Error("Exactly one JPEG for each of the six required angles is needed.");
      }
      const form = new FormData();
      form.set("model_id", modelId);
      for (const image of images) {
        const imageBuffer = image.jpeg.buffer.slice(image.jpeg.byteOffset, image.jpeg.byteOffset + image.jpeg.byteLength) as ArrayBuffer;
        form.append("images", new Blob([imageBuffer], { type: "image/jpeg" }), `${image.angle}.jpg`);
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        body: form,
        signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error(`Reconstruction provider returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload?.face_anonymized !== true || typeof payload.model_glb_base64 !== "string") {
        throw new Error("The provider did not return a verified anonymous GLB result.");
      }
      if (payload.model_glb_base64.length > 70_000_000) throw new Error("The provider returned an oversized GLB file.");
      const binary = atob(payload.model_glb_base64);
      if (binary.length < 20 || binary.length > 50 * 1024 * 1024 || binary.slice(0, 4) !== "glTF") {
        throw new Error("The provider returned an invalid or oversized GLB file.");
      }
      const declaredLength = new DataView(Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer).getUint32(8, true);
      if (declaredLength !== binary.length) throw new Error("The provider returned a malformed GLB file.");
      const glb = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) glb[index] = binary.charCodeAt(index);
      return { glb, faceAnonymized: true, providerModelRef: typeof payload.model_ref === "string" ? payload.model_ref.slice(0, 180) : undefined };
    },
  };
}
