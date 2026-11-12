const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');

const setupProfileTabs = () => {
  const heading = document.querySelector('.profile-heading');
  const shell = document.querySelector('.profile-shell');
  const profileGrid = document.querySelector('.profile-grid');
  const identityCard = document.querySelector('.identity-card');
  const galleryCard = document.querySelector('.gallery-card');
  const compatibilityCard = document.querySelector('.compatibility-card');
  const reelLinkCard = document.querySelector('.reel-profile-link-card');
  const reelCollectionsCard = document.querySelector('.reel-collections-card');
  const walletCard = document.querySelector('.profile-wallet-card');
  const giftCatalog = document.querySelector('.profile-gift-catalog');
  const socialGrid = document.querySelector('.social-grid');
  const communityCard = document.querySelector('.community-card');
  const notificationsCard = document.querySelector('.notifications-card');
  const actions = document.querySelector('.profile-actions');
  const shortcuts = document.querySelector('.profile-private-shortcuts');
  if (!heading || !shell || !profileGrid || !identityCard || shell.querySelector('#profile-tab-nav')) return;

  const tabs = [
    ['overview', '◉', 'Overview'], ['gallery', '▧', 'Photos'], ['reels', '▶', 'Reels'],
    ['community', '◎', 'Community'], ['notifications', '◌', 'Notifications'], ['privacy', '◇', 'Privacy'], ['gifts', '🎁', 'Gifts'], ['account', '◈', 'Account'],
  ];
  const nav = document.createElement('nav');
  nav.id = 'profile-tab-nav'; nav.className = 'profile-tab-nav'; nav.setAttribute('aria-label', 'Profile sections'); nav.setAttribute('role', 'tablist');
  tabs.forEach(([id, icon, label], index) => { const button = document.createElement('button'); button.type = 'button'; button.className = `profile-tab${index === 0 ? ' is-active' : ''}`; button.dataset.profileTab = id; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(index === 0)); button.id = `profile-tab-${id}`; button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`; nav.append(button); });
  heading.after(nav);

  const panels = document.createElement('div'); panels.id = 'profile-tab-panels'; panels.className = 'profile-tab-panels'; nav.after(panels);
  const panelFor = (id) => { const panel = document.createElement('section'); panel.id = `profile-panel-${id}`; panel.className = `profile-tab-panel${id === 'overview' ? ' is-active' : ''}`; panel.dataset.profilePanel = id; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `profile-tab-${id}`); panel.hidden = id !== 'overview'; panels.append(panel); return panel; };
  const panel = Object.fromEntries(tabs.map(([id]) => [id, panelFor(id)]));

  panel.overview.append(shortcuts, profileGrid);
  panel.gallery.append(galleryCard);
  panel.reels.append(reelLinkCard, reelCollectionsCard);
  panel.community.append(communityCard);
  panel.notifications.append(notificationsCard);
  panel.privacy.append(document.querySelector('#private-info'), document.querySelector('#gallery-privacy-settings'));
  panel.gifts.append(giftCatalog);
  panel.account.append(compatibilityCard, walletCard, actions);
  if (socialGrid) socialGrid.remove();

  const activate = (id, updateHash = true) => {
    const valid = panel[id] ? id : 'overview';
    nav.querySelectorAll('.profile-tab').forEach((button) => { const active = button.dataset.profileTab === valid; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); });
    Object.entries(panel).forEach(([key, element]) => { const active = key === valid; element.hidden = !active; element.classList.toggle('is-active', active); });
    if (updateHash && window.history.replaceState) window.history.replaceState(null, '', `#${valid}`);
  };
  nav.addEventListener('click', (event) => { const button = event.target.closest('[data-profile-tab]'); if (button) activate(button.dataset.profileTab); });
  shortcuts?.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => { const target = link.getAttribute('href'); const tab = target === '#gallery-title' || target === '#gallery-privacy-settings' ? 'gallery' : target === '#private-info' ? 'privacy' : 'overview'; event.preventDefault(); activate(tab); document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
  activate(window.location.hash.slice(1), false);
};
setupProfileTabs();


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
const markNotificationRead = async (item) => {
  const id = item?.dataset?.notificationId || item?.id;
  if (!id || !window.IQZodiacSupabase?.ready) return;
  try { const client = await window.IQZodiacSupabase.ready; await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); } catch { /* Navigation remains available if marking read fails. */ }
};
const deleteCompactNotification = async (id) => {
  const previousRows = [...notificationItems];
  notificationItems = notificationItems.filter((item) => item.dataset.notificationId !== id);
  updateNotificationCount(); updateNotificationBadge();
  renderCompactNotifications(notificationItems.map((item) => ({ id: item.dataset.notificationId, message: item.dataset.notification, read_at: item.classList.contains('is-unread') ? null : new Date().toISOString(), created_at: new Date().toISOString() })));
  try { const client = await window.IQZodiacSupabase.ready; const { error } = await client.from('notifications').delete().eq('id', id); if (error) throw error; } catch { notificationItems = previousRows; updateNotificationCount(); updateNotificationBadge(); renderCompactNotifications([]); }
};
document.querySelector('#mark-all-read').addEventListener('click', async () => {
  notificationItems.forEach((item) => item.classList.remove('is-unread'));
  try { const client = await window.IQZodiacSupabase.ready; const { data } = await client.auth.getUser(); if (data?.user?.id) await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', data.user.id).is('read_at', null); } catch { /* Keep the page usable if the network is unavailable. */ }
  updateNotificationCount(); updateNotificationBadge(); renderCompactNotifications([]); showToast('All notifications marked as read.');
});
const renderCompactNotifications = (rows) => {
  notificationPopoverList.replaceChildren();
  const visibleRows = rows.slice(0, 8);
  if (!visibleRows.length) { notificationPopoverList.innerHTML = '<p class="sidebar-note">No notifications.</p>'; return; }
  visibleRows.forEach((row) => {
    const entry = document.createElement('div'); entry.className = 'notification-popover-entry';
    const item = document.createElement('button'); item.type = 'button'; item.className = `notification-popover-item${row.read_at ? '' : ' is-unread'}`; item.dataset.notificationId = row.id;
    const icon = document.createElement('span'); icon.textContent = row.read_at ? '·' : '•'; const copy = document.createElement('span'); copy.textContent = row.message || 'New notification'; const time = document.createElement('small'); time.textContent = row.created_at ? new Date(row.created_at).toLocaleString() : ''; copy.append(time); item.append(icon, copy);
    item.addEventListener('click', async () => { await markNotificationRead(row); window.IQZodiacNotifications?.navigate(row); });
    const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'notification-delete'; deleteButton.setAttribute('aria-label', 'Delete notification'); deleteButton.title = 'Delete notification'; deleteButton.textContent = '×'; deleteButton.addEventListener('click', (event) => { event.stopPropagation(); void deleteCompactNotification(row.id); });
    entry.append(item, deleteButton); notificationPopoverList.append(entry);
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
    item.addEventListener('click', async () => { item.classList.remove('is-unread'); updateNotificationCount(); await markNotificationRead(row); window.IQZodiacNotifications?.navigate(row); });
  });
  updateNotificationCount(); updateNotificationBadge(); renderCompactNotifications(rows);
};
const loadNotifications = async () => {
  try { const client = await window.IQZodiacSupabase.ready; const { data: userData } = await client.auth.getUser(); if (!userData?.user?.id) return; const { data, error } = await client.from('notifications').select('id,notification_type,actor_id,message_id,post_id,comment_id,reel_id,reel_comment_id,message,read_at,created_at').eq('recipient_id', userData.user.id).order('created_at', { ascending: false }).limit(30); if (error) throw error; renderNotifications(data || []);
    client.channel(`notifications:${userData.user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userData.user.id}` }, (payload) => { void loadNotifications(); showToast(payload.new.message); }).subscribe();
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

const saveProfileButton = document.querySelector('#save-profile');
const saveStatus = document.querySelector('#save-status');
const setSaveStatus = (message, state = 'success') => {
  if (!saveStatus) return;
  saveStatus.hidden = !message;
  saveStatus.textContent = message || '';
  saveStatus.dataset.state = state;
};
saveProfileButton.addEventListener('click', async () => {
  if (saveProfileButton.disabled) return;
  const label = saveProfileButton.querySelector('span');
  const originalLabel = label?.textContent || 'Save changes';
  saveProfileButton.disabled = true;
  setSaveStatus('Saving your changes…', 'saving');
  if (label) label.textContent = 'Saving…';
  try {
    saveChoice('gallery-visible', galleryVisibility.checked);
    if (adapter) {
      await adapter.updatePublicIdentity({ displayName: displayNameInput.value.trim(), handle: `@${usernameInput.value.trim().replace(/^@/, '')}` });
      await adapter.updatePersonalDetails({ firstName: firstNameInput.value, lastName: lastNameInput.value, country: countryInput.options[countryInput.selectedIndex]?.textContent || '', city: cityInput.value, residenceCountry: countryInput.options[countryInput.selectedIndex]?.textContent || '', residenceCity: cityInput.value, birthCountry: birthCountryInput.options[birthCountryInput.selectedIndex]?.textContent || '', birthCity: birthCityInput.value, preferredLanguage: preferredLanguageInput.value });
      try { window.localStorage.setItem('iqzodiac-language', preferredLanguageInput.value); } catch { /* Keep profile saving working if storage is unavailable. */ }
      await adapter.updatePrivacyPreferences({ photosPublic: galleryVisibility.checked });
      await adapter.updateCompatibilityProfile({ zodiac: zodiac.value, element: element.value, interests: interestsInput.value.split(',').map((item) => item.trim()).filter(Boolean) });
    }
    setSaveStatus('✓ Your changes were saved successfully.', 'success');
    showToast('Your changes were saved successfully.');
  } catch (error) {
    console.error('Profile could not be saved.', error);
    setSaveStatus('Could not save your changes. Please try again.', 'error');
    showToast(error?.message || 'Profile could not be saved. Please try again.');
  } finally {
    saveProfileButton.disabled = false;
    if (label) label.textContent = originalLabel;
  }
});

const mediaGrid = document.querySelector('#media-grid');
const mediaCount = document.querySelector('#media-count');
const addMediaButton = document.querySelector('#add-media');
const mediaInput = document.querySelector('#media-input');
const galleryDialog = document.querySelector('#gallery-upload-dialog');
const galleryDropzone = document.querySelector('#gallery-dropzone');
const galleryPreviews = document.querySelector('#gallery-upload-previews');
const gallerySectionInput = document.querySelector('#gallery-upload-section');
const gallerySaleFields = document.querySelector('#gallery-sale-fields');
const gallerySalePrice = document.querySelector('#gallery-sale-price');
const gallerySaleCurrency = document.querySelector('#gallery-sale-currency');
const gallerySaleDescription = document.querySelector('#gallery-sale-description');
const galleryConfirm = document.querySelector('#gallery-confirm-upload');
const galleryUploadStatus = document.querySelector('#gallery-upload-status');
let galleryItems = [];
let pendingGalleryFiles = [];
let activeGallerySection = 'public';
const galleryLabels = { public: 'Public Media', private: 'Private Media', sale: 'Media for Sale' };
const galleryMimeByExtension = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/x-m4v', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg', '3gp': 'video/3gpp',
};
const supportedGalleryTypes = new Set(Object.values(galleryMimeByExtension));
const galleryFileInfo = (file) => {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  const declaredType = String(file.type || '').toLowerCase();
  const mimeType = supportedGalleryTypes.has(declaredType)
    ? declaredType
    : (!declaredType || declaredType === 'application/octet-stream' ? galleryMimeByExtension[extension] : '');
  if (!mimeType) throw new Error(`${file.name}: choose a supported image or video file.`);
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: files must be under 50 MB.`);
  return { mediaType: mimeType.startsWith('video/') ? 'video' : 'photo', mimeType };
};
const formatFileSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const updateGalleryCounts = () => ['public', 'private', 'sale'].forEach((section) => { const node = document.querySelector(`#gallery-count-${section}`); if (node) node.textContent = String(galleryItems.filter((item) => item.gallery_section === section).length); });
const renderGallery = () => {
  mediaGrid.querySelectorAll('.uploaded-media').forEach((tile) => tile.remove());
  const items = galleryItems.filter((item) => item.gallery_section === activeGallerySection);
  document.querySelector('#media-empty').hidden = items.length > 0;
  document.querySelector('#media-empty').textContent = activeGallerySection === 'sale' ? 'No media is listed for sale yet.' : `No ${activeGallerySection} media yet.`;
  mediaCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  items.forEach((item) => {
    const tile = document.createElement('article'); tile.className = 'media-tile uploaded-media';
    const isVideo = item.media_type === 'video';
    const preview = document.createElement(isVideo ? 'video' : 'img'); preview.className = 'uploaded-preview'; preview.src = item.url;
    if (isVideo) { preview.controls = true; preview.playsInline = true; preview.preload = 'metadata'; preview.setAttribute('aria-label', `${galleryLabels[item.gallery_section]} video`); }
    else preview.alt = `${galleryLabels[item.gallery_section]} photo`;
    const type = document.createElement('span'); type.className = 'media-type'; type.textContent = item.gallery_section === 'sale' ? `${item.sale_price || '—'} ${item.currency_code || 'USD'}` : `${galleryLabels[item.gallery_section]} · ${isVideo ? 'Video' : 'Photo'}`;
    const caption = document.createElement('span'); caption.className = 'media-caption'; caption.textContent = item.description || (isVideo ? 'Video' : 'Photo');
    const actions = document.createElement('div'); actions.className = 'media-actions';
    const move = document.createElement('button'); move.type = 'button'; move.className = 'media-action'; move.textContent = 'Move'; move.addEventListener('click', async () => { const next = window.prompt('Move to: public, private, or sale', item.gallery_section); if (!['public','private','sale'].includes(next) || next === item.gallery_section) return; try { await adapter.updateMedia(item, { gallery_section: next }); await loadMedia(); showToast(`Photo moved to ${galleryLabels[next]}.`); } catch (error) { showToast(error.message || 'Photo could not be moved.'); } });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'media-action media-remove'; remove.textContent = 'Delete'; remove.addEventListener('click', async () => { if (!window.confirm('Delete this photo permanently?')) return; remove.disabled = true; try { await adapter.deleteMedia(item); await loadMedia(); showToast('Photo deleted.'); } catch (error) { remove.disabled = false; showToast(error.message || 'Photo could not be deleted.'); } });
    actions.append(move, remove); tile.append(preview, type, caption, actions); mediaGrid.append(tile);
  });
};
const loadMedia = async () => { if (!adapter) return; const items = await adapter.listMyMedia(); galleryItems = items.filter((item) => item.media_type !== 'avatar').map((item) => ({ ...item, gallery_section: item.gallery_section || (item.is_public ? 'public' : 'private') })); updateGalleryCounts(); renderGallery(); const avatar = items.find((item) => item.media_type === 'avatar'); if (avatar?.url) { const preview = document.querySelector('#avatar-preview'); preview.style.backgroundImage = `url(${avatar.url})`; preview.classList.add('has-photo'); preview.querySelector('.avatar-initials').hidden = true; } };
const renderPendingFiles = () => {
  galleryPreviews.querySelectorAll('[data-preview-url]').forEach((node) => URL.revokeObjectURL(node.dataset.previewUrl));
  galleryPreviews.replaceChildren();
  pendingGalleryFiles.forEach((file, index) => {
    const info = galleryFileInfo(file); const card = document.createElement('div'); card.className = 'gallery-pending-file';
    const preview = document.createElement(info.mediaType === 'video' ? 'video' : 'img'); const previewUrl = URL.createObjectURL(file); preview.src = previewUrl; preview.dataset.previewUrl = previewUrl;
    if (info.mediaType === 'video') { preview.controls = true; preview.muted = true; preview.playsInline = true; preview.preload = 'metadata'; } else preview.alt = file.name;
    const name = document.createElement('span'); name.textContent = file.name;
    const details = document.createElement('span'); details.className = 'gallery-file-meta'; details.textContent = `${info.mediaType === 'video' ? 'Video' : 'Photo'} · ${formatFileSize(file.size)}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${file.name}`); remove.addEventListener('click', () => { pendingGalleryFiles.splice(index, 1); renderPendingFiles(); updateGalleryUploadState(); });
    card.append(preview, name, details, remove); galleryPreviews.append(card);
  });
};
const updateGalleryUploadState = () => { galleryConfirm.disabled = pendingGalleryFiles.length === 0; galleryUploadStatus.textContent = pendingGalleryFiles.length ? `${pendingGalleryFiles.length} media item${pendingGalleryFiles.length === 1 ? '' : 's'} ready to upload.` : ''; if (pendingGalleryFiles.length) galleryUploadStatus.dataset.state = ''; };
const addPendingFiles = (files) => { const valid = []; try { Array.from(files).forEach((file) => { galleryFileInfo(file); if (!pendingGalleryFiles.some((existing) => existing.name === file.name && existing.size === file.size)) valid.push(file); }); pendingGalleryFiles.push(...valid); renderPendingFiles(); updateGalleryUploadState(); } catch (error) { galleryUploadStatus.textContent = error.message; galleryUploadStatus.dataset.state = 'error'; } };
const openGalleryDialog = () => { pendingGalleryFiles = []; galleryUploadStatus.textContent = ''; gallerySectionInput.value = activeGallerySection; gallerySaleFields.hidden = activeGallerySection !== 'sale'; renderPendingFiles(); updateGalleryUploadState(); if (galleryDialog.showModal) galleryDialog.showModal(); else galleryDialog.setAttribute('open', ''); };
addMediaButton.addEventListener('click', openGalleryDialog);
document.querySelectorAll('[data-gallery-tab]').forEach((button) => button.addEventListener('click', () => { activeGallerySection = button.dataset.galleryTab; document.querySelectorAll('[data-gallery-tab]').forEach((tab) => { const active = tab.dataset.galleryTab === activeGallerySection; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); }); renderGallery(); }));
gallerySectionInput.addEventListener('change', () => { gallerySaleFields.hidden = gallerySectionInput.value !== 'sale'; });
mediaInput.addEventListener('change', (event) => { addPendingFiles(event.target.files || []); event.target.value = ''; });
['dragenter','dragover'].forEach((eventName) => galleryDropzone.addEventListener(eventName, (event) => { event.preventDefault(); galleryDropzone.classList.add('is-dragging'); }));
['dragleave','drop'].forEach((eventName) => galleryDropzone.addEventListener(eventName, (event) => { event.preventDefault(); galleryDropzone.classList.remove('is-dragging'); if (eventName === 'drop') addPendingFiles(event.dataTransfer.files || []); }));
galleryConfirm.addEventListener('click', async () => {
  if (!pendingGalleryFiles.length || galleryConfirm.disabled) return;
  galleryConfirm.disabled = true;
  const queue = [...pendingGalleryFiles]; const total = queue.length; let completed = 0;
  galleryUploadStatus.textContent = 'Uploading media… 0%'; galleryUploadStatus.dataset.state = 'saving';
  const options = { section: gallerySectionInput.value, salePrice: gallerySalePrice.value, currency: gallerySaleCurrency.value, description: gallerySaleDescription.value };
  try {
    for (const file of queue) {
      const info = galleryFileInfo(file);
      await adapter.uploadMedia(file, info.mediaType, {
        ...options,
        mimeType: info.mimeType,
        onProgress: (uploadedBytes, totalBytes) => {
          const filePercent = Math.round((uploadedBytes / totalBytes) * 100);
          const overallPercent = Math.round(((completed + filePercent / 100) / total) * 100);
          galleryUploadStatus.textContent = `Uploading ${file.name}… ${overallPercent}% (${completed + 1}/${total})`;
        },
      });
      completed += 1; pendingGalleryFiles = pendingGalleryFiles.filter((candidate) => candidate !== file);
      const percent = Math.round((completed / total) * 100);
      galleryUploadStatus.textContent = `Uploading media… ${percent}% (${completed}/${total})`; renderPendingFiles();
    }
    galleryUploadStatus.textContent = `${completed} media item${completed === 1 ? '' : 's'} uploaded successfully.`; galleryUploadStatus.dataset.state = 'success';
    await loadMedia(); setTimeout(() => galleryDialog.close(), 450); showToast(`${completed} media item${completed === 1 ? '' : 's'} uploaded successfully.`);
  } catch (error) {
    galleryConfirm.disabled = false; galleryUploadStatus.textContent = `${completed ? `${completed} uploaded. ` : ''}${error.message || 'Upload failed. Press Upload media to retry.'}`; galleryUploadStatus.dataset.state = 'error';
  }
});
(async () => { await loadMedia(); })();
document.querySelector('#avatar-input').addEventListener('change', async (event) => { const [file] = event.target.files; if (!file || !adapter) return; try { const item = await adapter.uploadMedia(file, 'avatar'); const avatar = document.querySelector('#avatar-preview'); avatar.style.backgroundImage = `url(${item.url})`; avatar.classList.add('has-photo'); avatar.querySelector('.avatar-initials').hidden = true; showToast('Profile photo saved securely.'); } catch (error) { showToast(error?.message || 'Profile photo could not be uploaded.'); } finally { event.target.value = ''; } });
(async () => { await loadMedia(); })();
