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
    showToast(`${label} photo is ready for review.`);
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
  const profile = {
    id: `user-${Date.now()}`,
    name: `${document.querySelector('#first-name').value.trim()} ${document.querySelector('#last-name').value.trim()}`,
    age: Number(document.querySelector('#age').value),
    email: document.querySelector('#email').value.trim(),
    phone: document.querySelector('#phone-number').value.trim(),
    handle: `@${document.querySelector('#first-name').value.trim().toLowerCase()}`,
    facePhoto: { originalAssetRef: null, protectedPreviewRef: null, faceHidden: true },
    privacy: { revealRequiresMutualConsent: true },
    onboarding: { status: 'pending', assistant: 'iqzodiac-discovery', startedAt: null, completedAt: null },
    createdAt: new Date().toISOString(),
  };
  try { localStorage.setItem('iqzodiac-current-profile', JSON.stringify(profile)); } catch { /* Keep the form usable when storage is unavailable. */ }
  window.location.assign('./assistant.html?welcome=1');
});
