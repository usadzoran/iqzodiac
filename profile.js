const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
const mediaGrid = document.querySelector('.media-grid');
const mediaInput = document.querySelector('#media-input');
const addMediaButton = document.querySelector('#add-media');
const mediaCount = document.querySelector('#media-count');
let toastTimer;
let uploadedMediaCount = 0;

const showToast = (message) => {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
};

const saveChoice = (key, value) => window.localStorage.setItem(`iqzodiac:${key}`, String(value));
const readChoice = (key) => window.localStorage.getItem(`iqzodiac:${key}`) === 'true';
const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const phoneVisibility = document.querySelector('#phone-visibility');
const galleryVisibility = document.querySelector('#gallery-visibility');
const phonePrivacyStatus = document.querySelector('#phone-privacy-status');
const galleryPrivacyStatus = document.querySelector('#gallery-privacy-status');
phoneVisibility.checked = readChoice('phone-visible');
galleryVisibility.checked = readChoice('gallery-visible');

const updatePrivacyPreview = () => {
  phonePrivacyStatus.textContent = phoneVisibility.checked
    ? 'Visible to other people on your profile.'
    : 'Hidden from other people.';
  galleryPrivacyStatus.textContent = galleryVisibility.checked
    ? 'Public — people can view your photos and videos.'
    : 'Hidden — only you can view your gallery.';
  document.querySelector('.gallery-card').classList.toggle('gallery-is-public', galleryVisibility.checked);
};

phoneVisibility.addEventListener('change', () => {
  saveChoice('phone-visible', phoneVisibility.checked);
  updatePrivacyPreview();
});
galleryVisibility.addEventListener('change', () => {
  saveChoice('gallery-visible', galleryVisibility.checked);
  updatePrivacyPreview();
});
updatePrivacyPreview();

document.querySelector('#save-profile').addEventListener('click', () => {
  saveChoice('phone-visible', phoneVisibility.checked);
  saveChoice('gallery-visible', galleryVisibility.checked);
  showToast('Your profile choices are saved.');
});

addMediaButton.addEventListener('click', () => mediaInput.click());
mediaInput.addEventListener('change', (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  files.forEach((file) => addUploadedMedia(file));
  showToast(`${files.length} ${files.length === 1 ? 'file' : 'files'} added to your gallery preview.`);
  mediaInput.value = '';
});

const addUploadedMedia = (file) => {
  const isVideo = file.type.startsWith('video/');
  const tile = document.createElement('button');
  const preview = isVideo ? document.createElement('video') : document.createElement('img');
  const shade = document.createElement('span');
  const type = document.createElement('span');
  const caption = document.createElement('span');
  const meta = document.createElement('span');

  tile.className = 'media-tile uploaded-media';
  tile.type = 'button';
  tile.setAttribute('aria-label', `Preview uploaded ${isVideo ? 'video' : 'photo'} ${file.name}`);
  preview.className = 'uploaded-preview';
  preview.src = URL.createObjectURL(file);
  if (isVideo) {
    preview.muted = true;
    preview.loop = true;
    preview.autoplay = true;
    preview.playsInline = true;
  }
  shade.className = 'uploaded-shade';
  type.className = 'media-type';
  type.textContent = isVideo ? 'Video' : 'Photo';
  caption.className = 'media-caption';
  caption.textContent = file.name;
  meta.className = 'media-meta';
  meta.textContent = formatFileSize(file.size);

  tile.append(preview, shade, type, caption, meta);
  tile.addEventListener('click', () => showToast(`${file.name} is ready to preview.`));
  mediaGrid.insertBefore(tile, addMediaButton);
  uploadedMediaCount += 1;
  mediaCount.textContent = `${5 + uploadedMediaCount} items`;
};

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
