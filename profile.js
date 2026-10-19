const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;

const showToast = (message) => {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
};

const saveChoice = (key, value) => window.localStorage.setItem(`iqzodiac:${key}`, String(value));
const readChoice = (key) => window.localStorage.getItem(`iqzodiac:${key}`) === 'true';

const phoneVisibility = document.querySelector('#phone-visibility');
const galleryVisibility = document.querySelector('#gallery-visibility');
phoneVisibility.checked = readChoice('phone-visible');
galleryVisibility.checked = readChoice('gallery-visible');

phoneVisibility.addEventListener('change', () => saveChoice('phone-visible', phoneVisibility.checked));
galleryVisibility.addEventListener('change', () => saveChoice('gallery-visible', galleryVisibility.checked));

document.querySelector('#save-profile').addEventListener('click', () => {
  saveChoice('phone-visible', phoneVisibility.checked);
  saveChoice('gallery-visible', galleryVisibility.checked);
  showToast('Your profile choices are saved.');
});

document.querySelector('[data-flow]').addEventListener('click', () => showToast('Media upload will open here soon.'));

document.querySelector('#avatar-input').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const avatar = document.querySelector('#avatar-preview');
    avatar.style.backgroundImage = `url(${reader.result})`;
    avatar.classList.add('has-photo');
    avatar.querySelector('.avatar-initials').hidden = true;
  });
  reader.readAsDataURL(file);
  showToast('Profile photo preview updated.');
});

document.querySelectorAll('.media-tile:not(.add-media)').forEach((tile) => {
  tile.addEventListener('click', () => showToast(`${tile.querySelector('.media-caption').textContent} is ready to preview.`));
});
