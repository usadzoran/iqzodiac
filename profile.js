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
  const socialGrid = document.querySelector('.social-grid');
  const communityCard = document.querySelector('.community-card');
  const notificationsCard = document.querySelector('.notifications-card');
  const actions = document.querySelector('.profile-actions');
  const shortcuts = document.querySelector('.profile-private-shortcuts');
  if (!heading || !shell || !profileGrid || !identityCard || shell.querySelector('#profile-tab-nav')) return;

  const tabs = [
    ['overview', '◉', 'Overview'], ['gallery', '▧', 'Photos'], ['reels', '▶', 'Reels'],
    ['community', '◎', 'Community'], ['notifications', '◌', 'Notifications'], ['privacy', '◇', 'Privacy'], ['account', '◈', 'Account'],
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
saveProfileButton.addEventListener('click', async () => {
  if (saveProfileButton.disabled) return;
  const label = saveProfileButton.querySelector('span');
  const originalLabel = label?.textContent || 'Save changes';
  saveProfileButton.disabled = true;
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
    showToast('Your information was saved successfully.');
  } catch (error) {
    console.error('Profile could not be saved.', error);
    showToast(error?.message || 'Profile could not be saved. Please try again.');
  } finally {
    saveProfileButton.disabled = false;
    if (label) label.textContent = originalLabel;
  }
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


/* Profile activity tabs: the existing settings sections remain the About tab. */
(() => {
  const tabs = [...document.querySelectorAll('[data-profile-tab]')];
  const panels = [...document.querySelectorAll('[data-profile-panel]')];
  if (!tabs.length || !window.IQZodiacSupabase?.ready) return;
  const postsList = document.querySelector('#profile-posts-list');
  const commentsList = document.querySelector('#profile-comments-list');
  const savedPostsList = document.querySelector('#profile-saved-posts-list');
  const savedReelsList = document.querySelector('#profile-saved-reels-list');
  const optionsRow = document.querySelector('.profile-feed-options-row');
  const menu = document.querySelector('#profile-feed-menu');
  const optionsButton = document.querySelector('#profile-feed-options');
  const legacyReelCollections = document.querySelector('.reel-collections-card');
  if (legacyReelCollections) legacyReelCollections.hidden = true;
  const aboutNodes = [...document.querySelectorAll('.profile-private-shortcuts, .profile-grid, .compatibility-card, .reel-profile-link-card, .profile-wallet-card, .social-grid, .profile-actions')];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const date = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  const status = (element, text) => { if (element) element.innerHTML = `<p class="profile-tab-status">${escape(text)}</p>`; };
  let client;
  let userId;
  let posts = [];
  let comments = [];
  let loaded = { posts:false, comments:false, saved:false };
  let sort = window.localStorage.getItem('iqzodiac:profile-feed-sort') || 'latest';
  const signed = async (path) => { if (!path) return ''; const { data } = await client.storage.from('iqzodiac-media').createSignedUrl(path, 3600); return data?.signedUrl || ''; };
  const mediaMarkup = async (row) => { if (!row.media_path) return ''; const url = await signed(row.media_path); if (!url) return ''; return row.media_type === 'video' ? `<video class="profile-activity-media" src="${escape(url)}" controls muted playsinline preload="metadata"></video>` : `<img class="profile-activity-media" src="${escape(url)}" alt="Post media" loading="lazy" />`; };
  const postCard = async (row, removable = false) => `<article class="profile-activity-card"><div class="profile-activity-card-head"><div class="profile-activity-avatar">${escape(String(row.display_name || 'OM').slice(0, 1).toUpperCase())}</div><div><strong>${escape(row.display_name || 'Orbit Member')}</strong><small>${escape(row.handle || '@member')} · ${escape(date(row.created_at))}</small></div>${removable ? `<button type="button" class="profile-remove-save" data-remove-post-save="${escape(row.id)}" aria-label="Remove saved post">Remove save</button>` : ''}</div>${row.body ? `<p class="profile-activity-body">${escape(row.body)}</p>` : ''}${await mediaMarkup(row)}${row.like_count != null ? `<small class="profile-activity-meta">${Number(row.like_count)} likes</small>` : ''}</article>`;
  const renderPosts = async (rows, target = postsList, removable = false) => { if (!rows.length) { status(target, removable ? 'You have not saved any posts yet.' : 'No posts to show.'); return; } target.innerHTML = (await Promise.all(rows.map((row) => postCard(row, removable)))).join(''); };
  const sortPosts = (rows) => { const copy = [...rows]; if (sort === 'oldest') return copy.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)); if (sort === 'liked') return copy.sort((a,b) => Number(b.like_count || 0) - Number(a.like_count || 0)); if (sort === 'media') return copy.filter((row) => row.media_path); return copy.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); };
  const loadPosts = async () => { if (loaded.posts) return; status(postsList, 'Loading posts…'); const { data, error } = await client.from('posts').select('id,author_id,body,media_type,media_path,created_at').eq('author_id', userId).order('created_at', { ascending:false }).limit(100); if (error) throw error; posts = await Promise.all((data || []).map(async (row) => { const { count } = await client.from('post_likes').select('post_id', { count:'exact', head:true }).eq('post_id', row.id); return { ...row, display_name: 'You', handle: 'Your post', like_count: count || 0 }; })); loaded.posts = true; await renderPosts(sortPosts(posts)); };
  const loadComments = async () => { if (loaded.comments) return; status(commentsList, 'Loading comments…'); const { data, error } = await client.from('comments').select('id,post_id,body,created_at,posts(body)').eq('author_id', userId).order('created_at', { ascending:false }).limit(100); if (error) throw error; comments = data || []; loaded.comments = true; commentsList.innerHTML = comments.length ? comments.map((row) => `<article class="profile-activity-card profile-comment-card"><small>${escape(date(row.created_at))}</small><p>${escape(row.body)}</p><span>On: ${escape(row.posts?.body || 'a post')}</span></article>`).join('') : '<p class="profile-tab-status">You have not written any comments yet.</p>'; };
  const loadSaved = async () => { if (loaded.saved) return; status(savedPostsList, 'Loading saved items…'); const { data: links, error } = await client.from('post_saves').select('post_id,created_at').eq('user_id', userId).order('created_at', { ascending:false }).limit(100); if (error) throw error; const ids = (links || []).map((row) => row.post_id); let savedPosts = []; if (ids.length) { const result = await client.from('posts').select('id,author_id,body,media_type,media_path,created_at').in('id', ids); if (result.error) throw result.error; savedPosts = ids.map((id) => (result.data || []).find((row) => row.id === id)).filter(Boolean).map((row) => ({ ...row, display_name:'Saved post', handle:'', like_count:null })); } document.querySelector('#profile-saved-posts-count').textContent = String(savedPosts.length); await renderPosts(savedPosts, savedPostsList, true); const { data: reelLinks, error: reelError } = await client.from('reel_saves').select('reel_id,created_at').eq('user_id', userId).order('created_at', { ascending:false }).limit(100); if (reelError) throw reelError; const reelIds = (reelLinks || []).map((row) => row.reel_id); let reels = []; if (reelIds.length) { const result = await client.from('reels').select('id,caption,media_path,created_at').in('id', reelIds); if (result.error) throw result.error; reels = await Promise.all((result.data || []).map(async (row) => ({ ...row, signed_url: await signed(row.media_path) }))); } document.querySelector('#profile-saved-reels-count').textContent = String(reels.length); savedReelsList.innerHTML = reels.length ? reels.map((row) => `<article class="profile-saved-reel"><a href="./reel.html?reel=${encodeURIComponent(row.id)}">${row.signed_url ? `<video src="${escape(row.signed_url)}" muted playsinline preload="metadata"></video>` : '<span>Unavailable</span>'}</a><div><span>${escape(row.caption || 'Reel')}</span><button type="button" data-remove-reel-save="${escape(row.id)}" aria-label="Remove saved Reel">Remove</button></div></article>`).join('') : '<p class="profile-tab-status">You have not saved any Reels yet.</p>'; loaded.saved = true; };
  const showTab = async (name, persist = true) => { tabs.forEach((tab) => { const active = tab.dataset.profileTab === name; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); }); panels.forEach((panel) => { const active = panel.dataset.profilePanel === name; panel.hidden = !active; panel.classList.toggle('is-active', active); }); aboutNodes.forEach((node) => { node.hidden = name !== 'about'; }); optionsRow.hidden = name !== 'posts'; if (persist) window.localStorage.setItem('iqzodiac:profile-tab', name); try { if (name === 'posts') await loadPosts(); if (name === 'comments') await loadComments(); if (name === 'saved') await loadSaved(); } catch (error) { console.warn('Profile tab could not load.', error); status(name === 'posts' ? postsList : name === 'comments' ? commentsList : savedPostsList, 'This section is temporarily unavailable.'); } };
  const refreshSort = async (next) => { sort = next; window.localStorage.setItem('iqzodiac:profile-feed-sort', sort); menu.hidden = true; optionsButton.setAttribute('aria-expanded', 'false'); if (loaded.posts) await renderPosts(sortPosts(posts)); };
  (async () => { client = await window.IQZodiacSupabase.ready; const { data, error } = await client.auth.getUser(); userId = data?.user?.id; if (error || !userId) return; tabs.forEach((tab) => tab.addEventListener('click', () => void showTab(tab.dataset.profileTab))); optionsButton.addEventListener('click', () => { menu.hidden = !menu.hidden; optionsButton.setAttribute('aria-expanded', String(!menu.hidden)); }); menu.querySelectorAll('[data-profile-sort]').forEach((button) => button.addEventListener('click', () => void refreshSort(button.dataset.profileSort))); document.addEventListener('click', (event) => { if (!event.target.closest('.profile-feed-options-row')) { menu.hidden = true; optionsButton.setAttribute('aria-expanded', 'false'); } }); document.addEventListener('click', async (event) => { const postId = event.target.closest('[data-remove-post-save]')?.dataset.removePostSave; const reelId = event.target.closest('[data-remove-reel-save]')?.dataset.removeReelSave; if (!postId && !reelId) return; const table = postId ? 'post_saves' : 'reel_saves'; const key = postId ? 'post_id' : 'reel_id'; const id = postId || reelId; const { error: removeError } = await client.from(table).delete().eq(key, id).eq('user_id', userId); if (removeError) { showToast('The saved item could not be removed.'); return; } loaded.saved = false; await loadSaved(); showToast('Removed from saved.'); }); const savedTab = window.localStorage.getItem('iqzodiac:profile-tab') || 'posts'; await showTab(['posts','comments','saved','about'].includes(savedTab) ? savedTab : 'posts', false); })();
})();
