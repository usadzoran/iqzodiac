export type CladMeasurementMap = Record<string, number>;

export type CladResult = {
  glb: Uint8Array;
  measurements: CladMeasurementMap;
  params: string;
  providerModelRef?: string;
};

const cladOrigin = "https://api.clad.you";
const maxGlbBytes = 50 * 1024 * 1024;

function safeProviderError(status: number, payload: any) {
  const code = typeof payload?.error?.code === "string" ? payload.error.code : `http_${status}`;
  const error = new Error("clad_provider_failed");
  (error as any).providerCode = code.slice(0, 80);
  return error;
}

function decodeGlb(encoded: string) {
  if (!encoded || encoded.length > 70_000_000) throw new Error("clad_invalid_glb");
  let binary: string;
  try { binary = atob(encoded); } catch { throw new Error("clad_invalid_glb"); }
  if (binary.length < 20 || binary.length > maxGlbBytes || binary.slice(0, 4) !== "glTF") throw new Error("clad_invalid_glb");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const declaredLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
  if (declaredLength !== bytes.byteLength) throw new Error("clad_invalid_glb");
  return bytes;
}

function validatePollUrl(value: unknown) {
  let url: URL;
  try { url = new URL(String(value || "")); } catch { throw new Error("clad_invalid_poll_url"); }
  if (url.origin !== cladOrigin || url.protocol !== "https:") throw new Error("clad_invalid_poll_url");
  return url.toString();
}

async function requestJson(url: string, init: RequestInit, apiKey: string) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", ...(init.headers || {}) },
    redirect: "error",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw safeProviderError(response.status, payload);
  return payload;
}

export async function reconstructFromPhoto(input: { apiKey: string; photo: Blob; heightCm: number; signal?: AbortSignal }): Promise<CladResult> {
  const form = new FormData();
  form.set("photo", input.photo, "front.jpg");
  form.set("height_cm", String(input.heightCm));
  const created = await requestJson(`${cladOrigin}/v1/body/from-photo`, { method: "POST", body: form, signal: input.signal }, input.apiKey);
  const jobId = typeof created?.job_id === "string" ? created.job_id : "";
  const pollUrl = validatePollUrl(created?.poll_url || `${cladOrigin}/v1/jobs/${encodeURIComponent(jobId)}`);
  if (!jobId) throw new Error("clad_invalid_job");

  const started = Date.now();
  while (Date.now() - started < 55_000) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const status = await requestJson(pollUrl, { method: "GET", signal: input.signal }, input.apiKey);
    if (status?.status === "failed") throw new Error("clad_job_failed");
    if (status?.status !== "completed") continue;
    const result = status.result;
    if (!result || typeof result.params !== "string" || !result.mesh?.data_b64 || typeof result.measurements !== "object") throw new Error("clad_incomplete_result");
    const measurements: CladMeasurementMap = {};
    for (const [key, value] of Object.entries(result.measurements)) {
      if (/^[a-z0-9_]{1,80}$/i.test(key) && typeof value === "number" && Number.isFinite(value)) measurements[key] = value;
    }
    return { glb: decodeGlb(result.mesh.data_b64), measurements, params: result.params.slice(0, 200_000), providerModelRef: jobId };
  }
  throw new Error("clad_timeout");
}
