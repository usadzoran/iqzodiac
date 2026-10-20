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
  showToast('Your details are ready. Secure account setup will be connected soon.');
});
