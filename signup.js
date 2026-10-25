const form = document.querySelector('#signup-form');
const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;

const showToast = (message) => {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
};

const createPseudonym = () => {
  const roots = ['Nova', 'Luna', 'Orion', 'Astra', 'Echo', 'Comet', 'Sage', 'River', 'Sol', 'Lyra'];
  const bytes = new Uint8Array(3);
  try { window.crypto.getRandomValues(bytes); } catch { bytes.set([Math.random() * 256, Math.random() * 256, Math.random() * 256]); }
  const root = roots[bytes[0] % roots.length];
  const code = ((bytes[1] << 8) | bytes[2]).toString(16).padStart(4, '0').toUpperCase();
  const displayName = `${root}-${code}`;
  const handle = `@${root.toLowerCase()}${code.toLowerCase()}`;
  return { displayName, handle, initials: root.slice(0, 1).toUpperCase() };
};

const bindPreview = (inputId, previewId, label) => {
  const input = document.querySelector(`#${inputId}`);
  const preview = document.querySelector(`#${previewId}`);
  input.addEventListener('change', () => {
    const [file] = input.files;
    if (!file) return;
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.alt = `${label} preview`;
    preview.replaceChildren(image);
    preview.classList.add('has-preview');
    input.closest('.upload-card').classList.add('is-ready');
    showToast(`${label} photo preview is local to this device.`);
  });
};

bindPreview('id-photo', 'id-preview', 'ID');
bindPreview('face-photo', 'face-preview', 'Face');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const pseudonym = createPseudonym();
  const profile = {
    id: `user-${Date.now()}-${pseudonym.handle.slice(-4)}`,
    name: pseudonym.displayName,
    displayName: pseudonym.displayName,
    pseudonym: pseudonym.displayName,
    handle: pseudonym.handle,
    initials: pseudonym.initials,
    role: 'user',
    privacyProfileVersion: 2,
    privacy: {
      publicIdentity: 'pseudonym',
      realNameVisibility: 'private',
      personalInfoVisibility: 'private',
      ageVisibility: false,
      phoneVisibility: false,
      photosPublic: false,
      revealRequiresMutualConsent: true,
    },
    facePhoto: { originalAssetRef: null, protectedPreviewRef: null, faceHidden: true, visibility: 'private' },
    onboarding: { status: 'pending', assistant: 'iqzodiac-discovery', startedAt: null, completedAt: null },
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem('iqzodiac-current-profile', JSON.stringify(profile));
    localStorage.setItem('iqzodiac:gallery-visible', 'false');
    localStorage.removeItem('iqzodiac:phone-visible');
  } catch { /* Keep the form usable when storage is unavailable. */ }
  window.location.assign('./assistant.html?welcome=1');
});
