const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
const mediaGrid = document.querySelector('.media-grid');
const mediaInput = document.querySelector('#media-input');
const addMediaButton = document.querySelector('#add-media');
const mediaCount = document.querySelector('#media-count');
let toastTimer;
let uploadedMediaCount = 0;

const showToast = (message) => { toastMessage.textContent = message; toast.classList.add('is-visible'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800); };
const saveChoice = (key, value) => window.localStorage.setItem(`iqzodiac:${key}`, String(value));
const readChoice = (key) => window.localStorage.getItem(`iqzodiac:${key}`) === 'true';
const readNumber = (key, fallback) => Number(window.localStorage.getItem(`iqzodiac:${key}`) || fallback);
const formatFileSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const phoneVisibility = document.querySelector('#phone-visibility');
const galleryVisibility = document.querySelector('#gallery-visibility');
const phonePrivacyStatus = document.querySelector('#phone-privacy-status');
const galleryPrivacyStatus = document.querySelector('#gallery-privacy-status');
phoneVisibility.checked = readChoice('phone-visible'); galleryVisibility.checked = readChoice('gallery-visible');
const updatePrivacyPreview = () => { phonePrivacyStatus.textContent = phoneVisibility.checked ? 'Visible to other people on your profile.' : 'Hidden from other people.'; galleryPrivacyStatus.textContent = galleryVisibility.checked ? 'Public — people can view your photos and videos.' : 'Hidden — only you can view your gallery.'; document.querySelector('.gallery-card').classList.toggle('gallery-is-public', galleryVisibility.checked); };
phoneVisibility.addEventListener('change', () => { saveChoice('phone-visible', phoneVisibility.checked); updatePrivacyPreview(); });
galleryVisibility.addEventListener('change', () => { saveChoice('gallery-visible', galleryVisibility.checked); updatePrivacyPreview(); });
updatePrivacyPreview();
const followersCount = document.querySelector('#followers-count'); const likesCount = document.querySelector('#likes-count'); const followButton = document.querySelector('#follow-button'); const followLabel = document.querySelector('#follow-label'); const likeProfile = document.querySelector('#like-profile'); const likeLabel = document.querySelector('#like-label'); const heartIcon = document.querySelector('.heart-icon'); const notificationItems = [...document.querySelectorAll('.notification-item')]; const notificationCount = document.querySelector('#notification-count');
let isFollowing = readChoice('following'); let hasLiked = readChoice('profile-liked'); let followers = readNumber('followers-count', 1284); let likes = readNumber('likes-count', 8642);
const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
const updateSocialPreview = () => { followersCount.textContent = formatCount(followers); likesCount.textContent = formatCount(likes); followLabel.textContent = isFollowing ? 'Following' : 'Follow back'; followButton.classList.toggle('is-following', isFollowing); likeProfile.setAttribute('aria-pressed', String(hasLiked)); likeProfile.classList.toggle('is-liked', hasLiked); heartIcon.textContent = hasLiked ? '♥' : '♡'; likeLabel.textContent = hasLiked ? 'Liked' : 'Like profile'; };
const updateNotificationCount = () => { const unread = notificationItems.filter((item) => item.classList.contains('is-unread')).length; notificationCount.textContent = unread ? `${unread} new` : 'All caught up'; notificationCount.classList.toggle('is-clear', unread === 0); };
followButton.addEventListener('click', () => { isFollowing = !isFollowing; followers += isFollowing ? 1 : -1; saveChoice('following', isFollowing); window.localStorage.setItem('iqzodiac:followers-count', String(followers)); updateSocialPreview(); showToast(isFollowing ? 'You are now following Alex.' : 'You unfollowed Alex.'); });
likeProfile.addEventListener('click', () => { hasLiked = !hasLiked; likes += hasLiked ? 1 : -1; saveChoice('profile-liked', hasLiked); window.localStorage.setItem('iqzodiac:likes-count', String(likes)); updateSocialPreview(); showToast(hasLiked ? 'Profile liked.' : 'Like removed.'); });
notificationItems.forEach((item) => item.addEventListener('click', () => { item.classList.remove('is-unread'); updateNotificationCount(); showToast(item.dataset.notification); }));
document.querySelector('#mark-all-read').addEventListener('click', () => { notificationItems.forEach((item) => item.classList.remove('is-unread')); updateNotificationCount(); showToast('All notifications marked as read.'); });
updateSocialPreview(); updateNotificationCount();

const adapter = window.IQZodiacData?.adapter;
const zodiac = document.querySelector('#zodiac-sign'); const element = document.querySelector('#personality-element'); const interestsInput = document.querySelector('#match-interests');
(async () => {
  if (!adapter) return;
  const profile = await adapter.getCurrentProfile();
  zodiac.value = profile.zodiac || 'Taurus'; element.value = profile.element || 'Water'; interestsInput.value = (profile.interests || []).join(', ');
  const access = await adapter.getAccountAccess();
  document.querySelector('#account-role-badge').textContent = access.role.toUpperCase();
  document.querySelector('#vip-access-copy').textContent = access.role === 'vip' ? 'VIP access is active. Priority matching and future private sections are enabled.' : 'VIP will unlock special sections and priority matching after checkout is connected.';
})();

document.querySelector('#save-profile').addEventListener('click', async () => {
  saveChoice('phone-visible', phoneVisibility.checked); saveChoice('gallery-visible', galleryVisibility.checked);
  if (adapter) await adapter.updateCompatibilityProfile({ zodiac: zodiac.value, element: element.value, interests: interestsInput.value.split(',').map((item) => item.trim()).filter(Boolean) });
  showToast('Your privacy and Match preferences are saved.');
});

const addUploadedMedia = (file) => { const isVideo = file.type.startsWith('video/'); const tile = document.createElement('button'); const preview = isVideo ? document.createElement('video') : document.createElement('img'); const shade = document.createElement('span'); const type = document.createElement('span'); const caption = document.createElement('span'); const meta = document.createElement('span'); tile.className = 'media-tile uploaded-media'; tile.type = 'button'; tile.setAttribute('aria-label', `Preview uploaded ${isVideo ? 'video' : 'photo'} ${file.name}`); preview.className = 'uploaded-preview'; preview.src = URL.createObjectURL(file); if (isVideo) { preview.muted = true; preview.loop = true; preview.autoplay = true; preview.playsInline = true; } shade.className = 'uploaded-shade'; type.className = 'media-type'; type.textContent = isVideo ? 'Video' : 'Photo'; caption.className = 'media-caption'; caption.textContent = file.name; meta.className = 'media-meta'; meta.textContent = formatFileSize(file.size); tile.append(preview, shade, type, caption, meta); tile.addEventListener('click', () => showToast(`${file.name} is ready to preview.`)); mediaGrid.insertBefore(tile, addMediaButton); uploadedMediaCount += 1; mediaCount.textContent = `${5 + uploadedMediaCount} items`; };
addMediaButton.addEventListener('click', () => mediaInput.click());
mediaInput.addEventListener('change', (event) => { const files = Array.from(event.target.files || []); if (!files.length) return; files.forEach(addUploadedMedia); showToast(`${files.length} ${files.length === 1 ? 'file' : 'files'} added to your gallery preview.`); mediaInput.value = ''; });
document.querySelector('#avatar-input').addEventListener('change', (event) => { const [file] = event.target.files; if (!file) return; const reader = new FileReader(); reader.addEventListener('load', () => { const avatar = document.querySelector('#avatar-preview'); avatar.style.backgroundImage = `url(${reader.result})`; avatar.classList.add('has-photo'); avatar.querySelector('.avatar-initials').hidden = true; }); reader.readAsDataURL(file); showToast('Profile photo preview updated.'); });
document.querySelectorAll('.media-tile:not(.add-media)').forEach((tile) => tile.addEventListener('click', () => showToast(`${tile.querySelector('.media-caption').textContent} is ready to preview.`)));
