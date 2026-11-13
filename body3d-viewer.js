(() => {
  'use strict';
  const clientReady = () => window.IQZodiacSupabase?.ready;
  const stateByContainer = new WeakMap();

  const fetchModel = async (modelId, owner, download = false) => {
    const client = await clientReady();
    if (!client) throw new Error('The secure model service is unavailable.');
    const query = new URLSearchParams({ model_id: modelId });
    if (download) query.set('download', '1');
    const headers = { apikey: client.supabaseKey };
    if (owner) {
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Sign in again to view your private 3D model.');
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${client.supabaseUrl}/functions/v1/body-model-access?${query}`, { method: 'GET', headers, cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'This model is not currently available.');
    }
    return response;
  };

  const mount = async (container, modelId, { owner = false } = {}) => {
    if (!container || !modelId) return;
    const prior = stateByContainer.get(container);
    if (prior) prior.dispose();
    container.replaceChildren();
    const label = document.createElement('span'); label.className = 'body3d-viewer-label'; label.textContent = owner ? 'PRIVATE · OWNER VIEW' : 'MEMBER 3D BODY';
    const prompt = document.createElement('div'); prompt.className = 'body3d-viewer-prompt';
    prompt.innerHTML = '<span aria-hidden="true">◉</span><strong>3D body model</strong><small>The model is loaded only when you choose to open it.</small><button type="button">Load 3D model</button>';
    container.append(label, prompt);
    let destroyed = false;
    let renderer = null;
    let animation = 0;
    let resizeObserver = null;
    let scene = null;
    let modelRoot = null;
    const dispose = () => {
      destroyed = true;
      cancelAnimationFrame(animation);
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.renderLists?.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      }
      if (scene) scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => { for (const value of Object.values(material)) if (value?.isTexture) value.dispose(); material.dispose?.(); });
      });
      container.replaceChildren();
      stateByContainer.delete(container);
    };
    stateByContainer.set(container, { dispose });

    const makeControls = () => {
      const actions = document.createElement('div'); actions.className = 'body3d-viewer-actions';
      const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset view';
      reset.addEventListener('click', () => { if (modelRoot) { modelRoot.rotation.set(0, 0, 0); if (renderer?.camera) renderer.camera.position.set(0, 0, 4.2); } });
      const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Download GLB';
      download.addEventListener('click', async () => {
        download.disabled = true;
        try { const response = await fetchModel(modelId, owner, true); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'iqzodiac-body-model.glb'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
        catch (error) { window.alert(error.message || 'Download is not available.'); }
        finally { download.disabled = false; }
      });
      actions.append(reset, download);
      return { actions, reset };
    };
    const controls = makeControls();
    prompt.querySelector('button').addEventListener('click', async () => {
      if (destroyed || prompt.dataset.loading === 'true') return;
      prompt.dataset.loading = 'true';
      const loadButton = prompt.querySelector('button'); loadButton.disabled = true; loadButton.textContent = 'Loading…';
      try {
        const [THREE, loaderModule, response] = await Promise.all([
          import('https://esm.sh/three@0.180.0'),
          import('https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js'),
          fetchModel(modelId, owner, false),
        ]);
        if (destroyed) return;
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 52_428_800) throw new Error('This model exceeds the 50 MB viewing limit.');
        const gltf = await new Promise((resolve, reject) => new loaderModule.GLTFLoader().parse(bytes, '', resolve, reject));
        if (destroyed) return;
        scene = new THREE.Scene();
        scene.background = new THREE.Color('#080d18');
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        const camera = new THREE.PerspectiveCamera(34, width / height, .01, 100);
        camera.position.set(0, .05, 4.2);
        const webgl = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        webgl.setSize(width, height);
        webgl.outputColorSpace = THREE.SRGBColorSpace;
        webgl.toneMapping = THREE.ACESFilmicToneMapping;
        webgl.toneMappingExposure = 1.12;
        webgl.camera = camera;
        renderer = webgl;
        container.insertBefore(webgl.domElement, controls.actions);
        scene.add(new THREE.HemisphereLight(0xd4efff, 0x151322, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4); keyLight.position.set(3, 4, 5); scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x83e5e8, 2.1); rimLight.position.set(-3, 2, -4); scene.add(rimLight);
        modelRoot = new THREE.Group();
        modelRoot.add(gltf.scene);
        scene.add(modelRoot);
        const bounds = new THREE.Box3().setFromObject(modelRoot);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        modelRoot.position.set(-center.x, -bounds.min.y, -center.z);
        const scale = 2.6 / maxDimension;
        modelRoot.scale.setScalar(scale);
        modelRoot.position.multiplyScalar(scale);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x121c2d, roughness: .8, metalness: .08 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; floor.scale.setScalar(1.4); scene.add(floor);
        let dragging = false, lastX = 0, lastY = 0;
        webgl.domElement.addEventListener('pointerdown', (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; webgl.domElement.setPointerCapture(event.pointerId); });
        webgl.domElement.addEventListener('pointerup', () => { dragging = false; });
        webgl.domElement.addEventListener('pointercancel', () => { dragging = false; });
        webgl.domElement.addEventListener('pointermove', (event) => { if (!dragging || !modelRoot) return; modelRoot.rotation.y += (event.clientX - lastX) * .008; modelRoot.rotation.x = Math.max(-.35, Math.min(.35, modelRoot.rotation.x + (event.clientY - lastY) * .004)); lastX = event.clientX; lastY = event.clientY; });
        webgl.domElement.addEventListener('wheel', (event) => { event.preventDefault(); camera.position.z = Math.max(2.3, Math.min(7, camera.position.z + Math.sign(event.deltaY) * .22)); }, { passive: false });
        controls.reset.addEventListener('click', () => { camera.position.set(0, .05, 4.2); });
        prompt.remove();
        const resize = () => { if (!renderer || !container.isConnected) return; const nextWidth = Math.max(1, container.clientWidth), nextHeight = Math.max(1, container.clientHeight); camera.aspect = nextWidth / nextHeight; camera.updateProjectionMatrix(); renderer.setSize(nextWidth, nextHeight); };
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
        const draw = () => { if (destroyed) return; animation = requestAnimationFrame(draw); webgl.render(scene, camera); };
        draw();
      } catch (error) {
        if (!destroyed) { prompt.dataset.loading = 'false'; loadButton.disabled = false; loadButton.textContent = 'Try loading again'; const detail = document.createElement('small'); detail.textContent = error.message || 'The 3D viewer could not start.'; prompt.append(detail); }
      }
    });
    container.append(controls.actions);
  };

  window.IQZodiacBody3DViewer = { mount, unmount: (container) => stateByContainer.get(container)?.dispose() };
})();
