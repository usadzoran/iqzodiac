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
const displayNameInput = document.querySelector('#display-name');
const usernameInput = document.querySelector('#username');
const firstNameInput = document.querySelector('#first-name');
const lastNameInput = document.querySelector('#last-name');
const countryInput = document.querySelector('#country');
const cityInput = document.querySelector('#city');
const preferredLanguageInput = document.querySelector('#preferred-language');
const galleryVisibility = document.querySelector('#gallery-visibility');
const galleryPrivacyStatus = document.querySelector('#gallery-privacy-status');
let profilePhotoPreference;
try { profilePhotoPreference = JSON.parse(window.localStorage.getItem('iqzodiac-current-profile') || '{}')?.privacy?.photosPublic; } catch { profilePhotoPreference = undefined; }
galleryVisibility.checked = typeof profilePhotoPreference === 'boolean' ? profilePhotoPreference : readChoice('gallery-visible');
const updatePrivacyPreview = () => { galleryPrivacyStatus.textContent = galleryVisibility.checked ? 'Public — approved profile media can be viewed by compatible members.' : 'Private — profile photos stay hidden from other members.'; document.querySelector('.gallery-card').classList.toggle('gallery-is-public', galleryVisibility.checked); };
galleryVisibility.addEventListener('change', async () => { saveChoice('gallery-visible', galleryVisibility.checked); updatePrivacyPreview(); const dataAdapter = window.IQZodiacData?.adapter; if (dataAdapter) await dataAdapter.updatePrivacyPreferences({ photosPublic: galleryVisibility.checked }); });
updatePrivacyPreview();
const followersCount = document.querySelector('#followers-count'); const likesCount = document.querySelector('#likes-count'); const followButton = document.querySelector('#follow-button'); const followLabel = document.querySelector('#follow-label'); const likeProfile = document.querySelector('#like-profile'); const likeLabel = document.querySelector('#like-label'); const heartIcon = document.querySelector('.heart-icon'); const notificationItems = [...document.querySelectorAll('.notification-item')]; const notificationCount = document.querySelector('#notification-count');
let isFollowing = false; let hasLiked = false; let followers = readNumber('followers-count', 0); let likes = readNumber('likes-count', 0);
const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
const updateSocialPreview = () => { followersCount.textContent = formatCount(followers); likesCount.textContent = formatCount(likes); followLabel.textContent = isFollowing ? 'Following' : 'Follow back'; followButton.classList.toggle('is-following', isFollowing); likeProfile.setAttribute('aria-pressed', String(hasLiked)); likeProfile.classList.toggle('is-liked', hasLiked); heartIcon.textContent = hasLiked ? '♥' : '♡'; likeLabel.textContent = hasLiked ? 'Liked' : 'Like profile'; };
const updateNotificationCount = () => { const unread = notificationItems.filter((item) => item.classList.contains('is-unread')).length; notificationCount.textContent = unread ? `${unread} new` : 'All caught up'; notificationCount.classList.toggle('is-clear', unread === 0); };
followButton.addEventListener('click', () => { isFollowing = !isFollowing; followers += isFollowing ? 1 : -1; saveChoice('following', isFollowing); window.localStorage.setItem('iqzodiac:followers-count', String(followers)); updateSocialPreview(); showToast(isFollowing ? 'You are now following Alex.' : 'You unfollowed Alex.'); });
likeProfile.addEventListener('click', () => { hasLiked = !hasLiked; likes += hasLiked ? 1 : -1; saveChoice('profile-liked', hasLiked); window.localStorage.setItem('iqzodiac:likes-count', String(likes)); updateSocialPreview(); showToast(hasLiked ? 'Profile liked.' : 'Like removed.'); });
notificationItems.forEach((item) => item.addEventListener('click', () => { item.classList.remove('is-unread'); updateNotificationCount(); showToast(item.dataset.notification); }));
document.querySelector('#mark-all-read').addEventListener('click', () => { notificationItems.forEach((item) => item.classList.remove('is-unread')); updateNotificationCount(); showToast('All notifications marked as read.'); });
updateSocialPreview(); updateNotificationCount();
followButton.disabled = true;
likeProfile.disabled = true;
followLabel.textContent = 'Use Match to connect';
likeLabel.textContent = 'Member interactions appear in Match';

const adapter = window.IQZodiacData?.adapter;
const zodiac = document.querySelector('#zodiac-sign'); const element = document.querySelector('#personality-element'); const interestsInput = document.querySelector('#match-interests');
(async () => {
  if (!adapter) return;
  const profile = await adapter.getCurrentProfile();
  displayNameInput.value = profile.displayName || profile.pseudonym || profile.name || 'Orbit Member';
  usernameInput.value = String(profile.handle || '@orbit-member').replace(/^@/, '');
  firstNameInput.value = profile.firstName || '';
  lastNameInput.value = profile.lastName || '';
  countryInput.value = profile.country || '';
  cityInput.value = profile.city || '';
  preferredLanguageInput.value = profile.preferredLanguage === 'ar' ? 'ar' : 'en';
  document.querySelector('#avatar-preview .avatar-initials').textContent = profile.initials || 'OM';
  zodiac.value = profile.zodiac || ''; element.value = profile.element || ''; interestsInput.value = (profile.interests || []).join(', ');
  const access = await adapter.getAccountAccess();
  document.querySelector('#account-role-badge').textContent = access.role.toUpperCase();
  document.querySelector('#vip-access-copy').textContent = access.role === 'vip' ? 'VIP access is active. Priority matching and future private sections are enabled.' : 'VIP will unlock special sections and priority matching after checkout is connected.';
})();

document.querySelector('#save-profile').addEventListener('click', async () => {
  saveChoice('gallery-visible', galleryVisibility.checked);
  if (adapter) {
    await adapter.updatePublicIdentity({ displayName: displayNameInput.value.trim(), handle: `@${usernameInput.value.trim().replace(/^@/, '')}` });
    await adapter.updatePersonalDetails({ firstName: firstNameInput.value, lastName: lastNameInput.value, country: countryInput.value, city: cityInput.value, preferredLanguage: preferredLanguageInput.value });
    try { window.localStorage.setItem('iqzodiac-language', preferredLanguageInput.value); } catch { /* Keep profile saving working if storage is unavailable. */ }
    await adapter.updatePrivacyPreferences({ photosPublic: galleryVisibility.checked });
    await adapter.updateCompatibilityProfile({ zodiac: zodiac.value, element: element.value, interests: interestsInput.value.split(',').map((item) => item.trim()).filter(Boolean) });
  }
  showToast('Your privacy and Match preferences are saved.');
});

const renderMedia = (items) => {
  mediaGrid.querySelectorAll('.uploaded-media').forEach((tile) => tile.remove());
  const empty = document.querySelector('#media-empty');
  empty.hidden = items.length > 0;
  mediaCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  items.forEach((item) => {
    const isVideo = item.media_type === 'video';
    const tile = document.createElement('article'); tile.className = 'media-tile uploaded-media';
    const preview = isVideo ? document.createElement('video') : document.createElement('img');
    preview.className = 'uploaded-preview'; preview.src = item.url; preview.alt = `${isVideo ? 'Video' : 'Photo'} from your private gallery`;
    if (isVideo) { preview.muted = true; preview.loop = true; preview.autoplay = true; preview.playsInline = true; }
    const type = document.createElement('span'); type.className = 'media-type'; type.textContent = isVideo ? 'Video' : (item.media_type === 'avatar' ? 'Avatar' : 'Photo');
    const caption = document.createElement('span'); caption.className = 'media-caption'; caption.textContent = item.media_type === 'avatar' ? 'Profile photo' : 'Private gallery item';
    const remove = document.createElement('button'); remove.className = 'media-remove'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove media');
    remove.addEventListener('click', async (event) => { event.stopPropagation(); remove.disabled = true; try { await adapter.deleteMedia(item); await loadMedia(); showToast('Media removed from your private gallery.'); } catch (error) { remove.disabled = false; showToast(error?.message || 'Media could not be removed.'); } });
    tile.append(preview, type, caption, remove); mediaGrid.insertBefore(tile, addMediaButton);
  });
};
const loadMedia = async () => { if (!adapter) return; const items = await adapter.listMyMedia(); const avatar = items.find((item) => item.media_type === 'avatar'); if (avatar?.url) { const preview = document.querySelector('#avatar-preview'); preview.style.backgroundImage = `url(${avatar.url})`; preview.classList.add('has-photo'); preview.querySelector('.avatar-initials').hidden = true; } renderMedia(items.filter((item) => item.media_type !== 'avatar')); };
addMediaButton.addEventListener('click', () => mediaInput.click());
mediaInput.addEventListener('change', async (event) => { const files = Array.from(event.target.files || []); if (!files.length || !adapter) return; try { for (const file of files) await adapter.uploadMedia(file, file.type.startsWith('video/') ? 'video' : 'photo'); await loadMedia(); showToast(`${files.length} ${files.length === 1 ? 'file' : 'files'} saved to your private gallery.`); } catch (error) { showToast(error?.message || 'Media could not be uploaded.'); } finally { mediaInput.value = ''; } });
document.querySelector('#avatar-input').addEventListener('change', async (event) => { const [file] = event.target.files; if (!file || !adapter) return; try { const item = await adapter.uploadMedia(file, 'avatar'); const avatar = document.querySelector('#avatar-preview'); avatar.style.backgroundImage = `url(${item.url})`; avatar.classList.add('has-photo'); avatar.querySelector('.avatar-initials').hidden = true; showToast('Profile photo saved securely.'); } catch (error) { showToast(error?.message || 'Profile photo could not be uploaded.'); } finally { event.target.value = ''; } });
(async () => { await loadMedia(); })();
