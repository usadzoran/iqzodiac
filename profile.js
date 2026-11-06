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
const birthCountryInput = document.querySelector('#birth-country');
const birthCityInput = document.querySelector('#birth-city');
const preferredLanguageInput = document.querySelector('#preferred-language');
const galleryVisibility = document.querySelector('#gallery-visibility');
const galleryPrivacyStatus = document.querySelector('#gallery-privacy-status');
let profilePhotoPreference;
const locationData = window.IQZodiacLocations || { countries: [], citiesByCountry: {} };
const locationNames = new Intl.DisplayNames(['en'], { type: 'region' });
const addLocationOption = (select, value, label, selected = false) => {
  const option = new Option(label, value, false, selected);
  select.add(option);
};
const populateCountries = (select) => {
  select.replaceChildren();
  addLocationOption(select, '', 'Select country', true);
  locationData.countries.map((code) => ({ code, name: locationNames.of(code) || code })).sort((a, b) => a.name.localeCompare(b.name)).forEach(({ code, name }) => addLocationOption(select, code, name));
};
const countryCodeFor = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return locationData.countries.find((code) => code.toLowerCase() === normalized || String(locationNames.of(code) || '').trim().toLowerCase() === normalized) || '';
};
const populateCities = (countrySelect, citySelect, selected = '') => {
  citySelect.replaceChildren();
  addLocationOption(citySelect, '', countrySelect.value ? 'Select state / city' : 'Select a country first', !selected);
  const cities = [...new Set(locationData.citiesByCountry[countrySelect.value] || [])].sort((a, b) => a.localeCompare(b));
  cities.forEach((city) => addLocationOption(citySelect, city, city, city === selected));
  addLocationOption(citySelect, 'Other', 'Other / not listed', selected === 'Other');
  citySelect.disabled = !countrySelect.value;
};
populateCountries(countryInput); populateCountries(birthCountryInput);
countryInput.addEventListener('change', () => populateCities(countryInput, cityInput));
birthCountryInput.addEventListener('change', () => populateCities(birthCountryInput, birthCityInput));
try { profilePhotoPreference = JSON.parse(window.localStorage.getItem('iqzodiac-current-profile') || '{}')?.privacy?.photosPublic; } catch { profilePhotoPreference = undefined; }
galleryVisibility.checked = typeof profilePhotoPreference === 'boolean' ? profilePhotoPreference : readChoice('gallery-visible');
const updatePrivacyPreview = () => { galleryPrivacyStatus.textContent = galleryVisibility.checked ? 'Public — approved profile media can be viewed by compatible members.' : 'Private — profile photos stay hidden from other members.'; document.querySelector('.gallery-card').classList.toggle('gallery-is-public', galleryVisibility.checked); };
galleryVisibility.addEventListener('change', async () => { saveChoice('gallery-visible', galleryVisibility.checked); updatePrivacyPreview(); const dataAdapter = window.IQZodiacData?.adapter; if (dataAdapter) await dataAdapter.updatePrivacyPreferences({ photosPublic: galleryVisibility.checked }); });
updatePrivacyPreview();
const followersCount = document.querySelector('#followers-count'); const likesCount = document.querySelector('#likes-count'); const followButton = document.querySelector('#follow-button'); const followLabel = document.querySelector('#follow-label'); const likeProfile = document.querySelector('#like-profile'); const likeLabel = document.querySelector('#like-label'); const heartIcon = document.querySelector('.heart-icon'); const notificationList = document.querySelector('#notification-list'); const notificationBadge = document.querySelector('#notification-badge'); const notificationTrigger = document.querySelector('#notification-trigger'); const notificationPopover = document.querySelector('#notification-popover'); const notificationPopoverList = document.querySelector('#notification-popover-list'); let notificationItems = [...document.querySelectorAll('.notification-item')]; const notificationCount = document.querySelector('#notification-count');
let isFollowing = false; let hasLiked = false; let followers = readNumber('followers-count', 0); let likes = readNumber('likes-count', 0);
const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
const updateSocialPreview = () => { followersCount.textContent = formatCount(followers); likesCount.textContent = formatCount(likes); followLabel.textContent = isFollowing ? 'Following' : 'Follow back'; followButton.classList.toggle('is-following', isFollowing); likeProfile.setAttribute('aria-pressed', String(hasLiked)); likeProfile.classList.toggle('is-liked', hasLiked); heartIcon.textContent = hasLiked ? '♥' : '♡'; likeLabel.textContent = hasLiked ? 'Liked' : 'Like profile'; };
const updateNotificationCount = () => { const unread = notificationItems.filter((item) => item.classList.contains('is-unread')).length; notificationCount.textContent = unread ? `${unread} new` : 'All caught up'; notificationCount.classList.toggle('is-clear', unread === 0); };
const updateNotificationBadge = () => { const unread = notificationItems.filter((item) => item.classList.contains('is-unread')).length; notificationBadge.hidden = unread === 0; notificationBadge.textContent = unread > 99 ? '99+' : String(unread); };
followButton.addEventListener('click', () => { isFollowing = !isFollowing; followers += isFollowing ? 1 : -1; saveChoice('following', isFollowing); window.localStorage.setItem('iqzodiac:followers-count', String(followers)); updateSocialPreview(); showToast(isFollowing ? 'You are now following Alex.' : 'You unfollowed Alex.'); });
likeProfile.addEventListener('click', () => { hasLiked = !hasLiked; likes += hasLiked ? 1 : -1; saveChoice('profile-liked', hasLiked); window.localStorage.setItem('iqzodiac:likes-count', String(likes)); updateSocialPreview(); showToast(hasLiked ? 'Profile liked.' : 'Like removed.'); });
notificationItems.forEach((item) => item.addEventListener('click', () => { item.classList.remove('is-unread'); updateNotificationCount(); showToast(item.dataset.notification); }));
const markNotificationRead = async (item) => {
  if (!item.dataset.notificationId || !window.IQZodiacSupabase?.ready) return;
  try { const client = await window.IQZodiacSupabase.ready; await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.dataset.notificationId); } catch { /* The local visual state still updates. */ }
};
notificationItems.forEach((item) => item.addEventListener('click', () => { item.classList.remove('is-unread'); void markNotificationRead(item); updateNotificationCount(); showToast(item.dataset.notification); }));
document.querySelector('#mark-all-read').addEventListener('click', async () => {
  notificationItems.forEach((item) => item.classList.remove('is-unread'));
  try { const client = await window.IQZodiacSupabase.ready; const { data } = await client.auth.getUser(); if (data?.user?.id) await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', data.user.id).is('read_at', null); } catch { /* Keep the page usable if the network is unavailable. */ }
  updateNotificationCount(); updateNotificationBadge(); renderCompactNotifications([]); showToast('All notifications marked as read.');
});
const renderCompactNotifications = (rows) => {
  notificationPopoverList.replaceChildren();
  const unreadRows = rows.filter((row) => !row.read_at).slice(0, 8);
  if (!unreadRows.length) { notificationPopoverList.innerHTML = '<p class="sidebar-note">No new notifications.</p>'; return; }
  unreadRows.forEach((row) => {
    const item = document.createElement('button'); item.type = 'button'; item.className = 'notification-popover-item is-unread'; item.dataset.notificationId = row.id;
    const icon = document.createElement('span'); icon.textContent = '•'; const copy = document.createElement('span'); copy.textContent = row.message; const time = document.createElement('small'); time.textContent = new Date(row.created_at).toLocaleString(); copy.append(time); item.append(icon, copy);
    item.addEventListener('click', async () => { await markNotificationRead({ dataset: { notificationId: row.id } }); item.remove(); showToast(row.message); }); notificationPopoverList.append(item);
  });
};
notificationTrigger?.addEventListener('click', () => { const open = notificationPopover.hidden; notificationPopover.hidden = !open; notificationTrigger.setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', (event) => { if (!event.target.closest('#notification-menu')) { notificationPopover.hidden = true; notificationTrigger?.setAttribute('aria-expanded', 'false'); } });
document.querySelector('#popover-mark-read')?.addEventListener('click', () => document.querySelector('#mark-all-read').click());
updateSocialPreview(); updateNotificationCount(); updateNotificationBadge();

const renderNotifications = (rows) => {
  notificationList.replaceChildren();
  notificationItems = [];
  if (!rows.length) { notificationList.innerHTML = '<p class="sidebar-note">No activity notifications yet.</p>'; renderCompactNotifications([]); updateNotificationCount(); updateNotificationBadge(); return; }
  rows.forEach((row) => {
    const item = document.createElement('button'); item.type = 'button'; item.className = `notification-item${row.read_at ? '' : ' is-unread'}`; item.dataset.notificationId = row.id; item.dataset.notification = row.message;
    const avatar = document.createElement('span'); avatar.className = 'notification-avatar'; avatar.textContent = String(row.message || 'S').trim().slice(0, 1).toUpperCase();
    const copy = document.createElement('span'); copy.className = 'notification-copy'; const strong = document.createElement('strong'); strong.textContent = row.message; const small = document.createElement('small'); small.textContent = new Date(row.created_at).toLocaleString(); copy.append(strong, small);
    const dot = document.createElement('span'); dot.className = 'notification-dot'; item.append(avatar, copy, dot); notificationList.append(item); notificationItems.push(item);
    item.addEventListener('click', () => { item.classList.remove('is-unread'); void markNotificationRead(item); updateNotificationCount(); });
  });
  updateNotificationCount(); updateNotificationBadge(); renderCompactNotifications(rows);
};
const loadNotifications = async () => {
  try { const client = await window.IQZodiacSupabase.ready; const { data: userData } = await client.auth.getUser(); if (!userData?.user?.id) return; const { data, error } = await client.from('notifications').select('id,notification_type,post_id,comment_id,message,read_at,created_at').eq('recipient_id', userData.user.id).order('created_at', { ascending: false }).limit(30); if (error) throw error; renderNotifications(data || []);
    client.channel(`notifications:${userData.user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userData.user.id}` }, (payload) => { renderNotifications([payload.new, ...[...notificationItems].map((item) => ({ id: item.dataset.notificationId, message: item.dataset.notification, read_at: item.classList.contains('is-unread') ? null : new Date().toISOString(), created_at: new Date().toISOString() }))]); showToast(payload.new.message); }).subscribe();
  } catch { /* Notifications remain empty if the account service is unavailable. */ }
};
void loadNotifications();
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
  countryInput.value = countryCodeFor(profile.residenceCountry || profile.country);
  populateCities(countryInput, cityInput, profile.residenceCity || profile.city || '');
  birthCountryInput.value = countryCodeFor(profile.birthCountry);
  populateCities(birthCountryInput, birthCityInput, profile.birthCity || '');
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
    await adapter.updatePersonalDetails({ firstName: firstNameInput.value, lastName: lastNameInput.value, country: countryInput.options[countryInput.selectedIndex]?.textContent || '', city: cityInput.value, residenceCountry: countryInput.options[countryInput.selectedIndex]?.textContent || '', residenceCity: cityInput.value, birthCountry: birthCountryInput.options[birthCountryInput.selectedIndex]?.textContent || '', birthCity: birthCityInput.value, preferredLanguage: preferredLanguageInput.value });
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
