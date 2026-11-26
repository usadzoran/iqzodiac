(() => {
  'use strict';

  const t = (en, ar) => window.IQZodiacLanguage?.t(en, ar) || en;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUuid = (value) => uuidPattern.test(String(value || ''));
  const clientReady = () => window.IQZodiacSupabase?.ready;
  const notify = (message) => {
    const toast = document.querySelector('.toast');
    const copy = document.querySelector('.toast-message');
    if (!toast || !copy) { console.info(message); return; }
    copy.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
  };

  const feed = document.querySelector('#feed-list');
  let activeProfileId = '';
  let cardRequestToken = 0;
  let cardState = null;
  let profileDialog = null;

  const buildDialog = () => {
    if (profileDialog) return profileDialog;
    profileDialog = document.createElement('dialog');
    profileDialog.className = 'feed-profile-dialog';
    profileDialog.setAttribute('aria-labelledby', 'feed-profile-name');
    profileDialog.innerHTML = `
      <section class="feed-profile-card">
        <button class="feed-profile-close" type="button" data-profile-close aria-label="${t('Close profile card', 'إغلاق بطاقة الملف')}">×</button>
        <p class="card-kicker" data-profile-kicker>${t('PUBLIC MEMBER PROFILE', 'الملف العام للعضو')}</p>
        <div class="feed-profile-identity">
          <span class="feed-profile-avatar" data-profile-avatar aria-hidden="true">IQ</span>
          <div><h2 id="feed-profile-name" data-profile-name></h2><p data-profile-handle></p></div>
        </div>
        <section class="feed-profile-interests" aria-labelledby="feed-profile-interests-title">
          <h3 id="feed-profile-interests-title" data-profile-interests-title>${t('Hobbies & things I like', 'الهوايات والأشياء التي أحبها')}</h3>
          <div class="feed-profile-interest-list" data-profile-interests></div>
          <p class="feed-profile-empty" data-profile-empty hidden>${t('No interests are shared on this profile yet.', 'لم يشارك هذا الملف اهتمامات بعد.')}</p>
        </section>
        <p class="feed-profile-presence" data-profile-presence aria-live="polite"></p>
        <p class="feed-profile-state" data-profile-state role="status" aria-live="polite"></p>
        <div class="feed-profile-actions">
          <button class="feed-profile-like" type="button" data-profile-like aria-pressed="false">♡ <span data-profile-like-label>${t('Like', 'إعجاب')}</span></button>
          <button class="button button-primary feed-profile-friend" type="button" data-profile-friend>${t('Add friend', 'إضافة صديق')}</button>
          <button class="button button-primary feed-profile-accept" type="button" data-profile-accept hidden>${t('Accept request', 'قبول الطلب')}</button>
          <button class="button button-secondary feed-profile-decline" type="button" data-profile-decline hidden>${t('Decline', 'رفض')}</button>
        </div>
      </section>`;
    document.body.append(profileDialog);
    profileDialog.querySelector('[data-profile-close]').addEventListener('click', () => profileDialog.close());
    profileDialog.addEventListener('click', (event) => { if (event.target === profileDialog) profileDialog.close(); });
    profileDialog.querySelector('[data-profile-like]').addEventListener('click', () => void toggleLike());
    profileDialog.querySelector('[data-profile-friend]').addEventListener('click', () => void requestFriend());
    profileDialog.querySelector('[data-profile-accept]').addEventListener('click', () => void respondToRequest(true));
    profileDialog.querySelector('[data-profile-decline]').addEventListener('click', () => void respondToRequest(false));
    return profileDialog;
  };

  const openDialog = (dialog) => {
    try { if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
    catch { dialog.setAttribute('open', ''); }
    dialog.querySelector('[data-profile-close]')?.focus();
  };

  const setBusy = (busy) => {
    if (!profileDialog) return;
    profileDialog.querySelectorAll('.feed-profile-actions button').forEach((button) => {
      if (!button.hidden) button.disabled = busy;
    });
  };

  const renderCard = (profile) => {
    const dialog = buildDialog();
    const name = String(profile.display_name || 'IQZodiac member');
    const handle = String(profile.handle || '');
    dialog.querySelector('[data-profile-name]').textContent = name;
    dialog.querySelector('[data-profile-handle]').textContent = handle;
    dialog.querySelector('[data-profile-avatar]').textContent = name.trim().split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IQ';

    const interests = Array.isArray(profile.interests) ? profile.interests.filter((item) => typeof item === 'string' && item.trim()).slice(0, 30) : [];
    const interestList = dialog.querySelector('[data-profile-interests]');
    interestList.replaceChildren();
    interests.forEach((interest) => {
      const chip = document.createElement('span');
      chip.className = 'feed-profile-interest-chip';
      chip.textContent = interest;
      interestList.append(chip);
    });
    dialog.querySelector('[data-profile-empty]').hidden = interests.length > 0;

    const isFriend = profile.friendship_status === 'friends';
    const presence = dialog.querySelector('[data-profile-presence]');
    presence.replaceChildren();
    if (isFriend) {
      const online = profile.is_online === true;
      const dot = document.createElement('i');
      dot.className = `friend-presence-dot${online ? ' is-online' : ''}`;
      dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = online ? t('Online', 'متصل') : t('Offline', 'غير متصل');
      presence.append(dot, label);
    } else {
      presence.textContent = t('Online status is visible after you become friends.', 'تظهر حالة الاتصال بعد أن تصبحا صديقين.');
    }

    const status = dialog.querySelector('[data-profile-state]');
    const relationship = profile.friendship_status || 'none';
    const likeButton = dialog.querySelector('[data-profile-like]');
    const likeLabel = dialog.querySelector('[data-profile-like-label]');
    likeButton.setAttribute('aria-pressed', String(Boolean(profile.liked_by_me)));
    likeButton.classList.toggle('is-liked', Boolean(profile.liked_by_me));
    likeLabel.textContent = profile.liked_by_me ? t('Liked', 'تم الإعجاب') : t('Like', 'إعجاب');
    dialog.querySelector('[data-profile-friend]').hidden = relationship === 'friends' || relationship === 'outgoing_pending' || relationship === 'incoming_pending';
    dialog.querySelector('[data-profile-friend]').textContent = relationship === 'declined' ? t('Send friend request again', 'إعادة إرسال طلب الصداقة') : t('Add friend', 'إضافة صديق');
    dialog.querySelector('[data-profile-friend]').disabled = relationship === 'friends' || relationship === 'outgoing_pending' || relationship === 'incoming_pending';
    dialog.querySelector('[data-profile-accept]').hidden = relationship !== 'incoming_pending';
    dialog.querySelector('[data-profile-decline]').hidden = relationship !== 'incoming_pending';
    if (relationship === 'friends') status.textContent = t('You are friends.', 'أنتما صديقان.');
    else if (relationship === 'outgoing_pending') status.textContent = t('Friend request sent. Waiting for their response.', 'تم إرسال طلب الصداقة. بانتظار الرد.');
    else if (relationship === 'incoming_pending') status.textContent = t('This member sent you a friend request.', 'أرسل إليك هذا العضو طلب صداقة.');
    else status.textContent = '';
    cardState = { liked: Boolean(profile.liked_by_me), relationship };
    status.dataset.state = relationship;
  };

  const loadCard = async (userId, token) => {
    const client = await clientReady();
    if (!client) throw new Error('database_unavailable');
    const { data, error } = await client.rpc('get_feed_profile_card', { p_user_id: userId });
    if (error) throw error;
    if (token !== cardRequestToken) return;
    const profile = Array.isArray(data) ? data[0] : data;
    if (!profile) throw new Error('profile_unavailable');
    renderCard(profile);
    profileDialog.querySelector('[data-profile-state]').textContent = profileDialog.querySelector('[data-profile-state]').textContent || '';
    setBusy(false);
  };

  const openProfile = async (userId) => {
    if (!isUuid(userId)) return;
    if (userId === window.IQZodiacAuth?.session?.user?.id) { window.location.assign('./profile.html'); return; }
    activeProfileId = userId;
    const token = ++cardRequestToken;
    const dialog = buildDialog();
    dialog.querySelector('[data-profile-name]').textContent = t('Loading profile…', 'جارٍ تحميل الملف…');
    dialog.querySelector('[data-profile-handle]').textContent = '';
    dialog.querySelector('[data-profile-interests]').replaceChildren();
    dialog.querySelector('[data-profile-presence]').textContent = '';
    dialog.querySelector('[data-profile-state]').textContent = '';
    setBusy(true);
    openDialog(dialog);
    try { await loadCard(userId, token); }
    catch (error) {
      if (token !== cardRequestToken) return;
      console.warn('Feed profile card could not be loaded.', error);
      dialog.querySelector('[data-profile-name]').textContent = t('Profile unavailable', 'الملف غير متاح');
      dialog.querySelector('[data-profile-state]').textContent = t('This public profile could not be loaded.', 'تعذر تحميل الملف العام.');
      setBusy(false);
    }
  };

  const reloadCurrentCard = async () => {
    const token = ++cardRequestToken;
    setBusy(true);
    try { await loadCard(activeProfileId, token); }
    catch (error) { console.warn('Profile relationship could not be refreshed.', error); setBusy(false); }
  };

  const toggleLike = async () => {
    if (!activeProfileId || !cardState) return;
    setBusy(true);
    try {
      const client = await clientReady();
      const { data, error } = await client.rpc('toggle_feed_profile_like', { p_target_user_id: activeProfileId });
      if (error) throw error;
      cardState.liked = data === true;
      const button = profileDialog.querySelector('[data-profile-like]');
      button.setAttribute('aria-pressed', String(cardState.liked));
      button.classList.toggle('is-liked', cardState.liked);
      profileDialog.querySelector('[data-profile-like-label]').textContent = cardState.liked ? t('Liked', 'تم الإعجاب') : t('Like', 'إعجاب');
    } catch (error) {
      console.warn('Feed profile like could not be saved.', error);
      notify(t('Like could not be saved. Please try again.', 'تعذر حفظ الإعجاب. حاول مجددًا.'));
    } finally { setBusy(false); }
  };

  const requestFriend = async () => {
    if (!activeProfileId) return;
    setBusy(true);
    try {
      const client = await clientReady();
      const { error } = await client.rpc('request_friend', { p_target_user_id: activeProfileId });
      if (error) throw error;
      await reloadCurrentCard();
    } catch (error) {
      console.warn('Friend request could not be saved.', error);
      setBusy(false);
      notify(t('Friend request could not be sent. Please try again.', 'تعذر إرسال طلب الصداقة. حاول مجددًا.'));
    }
  };

  const respondToRequest = async (accept) => {
    if (!activeProfileId) return;
    setBusy(true);
    try {
      const client = await clientReady();
      const { error } = await client.rpc('respond_friend_request', { p_target_user_id: activeProfileId, p_accept: accept });
      if (error) throw error;
      await reloadCurrentCard();
      if (accept) void loadCommunity();
      notify(accept ? t('Friend request accepted.', 'تم قبول طلب الصداقة.') : t('Friend request declined.', 'تم رفض طلب الصداقة.'));
    } catch (error) {
      console.warn('Friend request response could not be saved.', error);
      setBusy(false);
      notify(t('Your response could not be saved. Please try again.', 'تعذر حفظ ردك. حاول مجددًا.'));
    }
  };

  const appendEmpty = (container, message) => {
    const empty = document.createElement('p');
    empty.className = 'friend-list-empty';
    empty.textContent = message;
    container.replaceChildren(empty);
  };

  const renderFriendRequests = (container, rows) => {
    container.replaceChildren();
    if (!rows.length) { appendEmpty(container, t('No pending friend requests.', 'لا توجد طلبات صداقة معلقة.')); return; }
    rows.forEach((row) => {
      const item = document.createElement('article');
      item.className = 'friend-list-item friend-request-item';
      const identity = document.createElement('div');
      identity.className = 'friend-list-identity';
      const avatar = document.createElement('span');
      avatar.className = 'friend-list-avatar';
      avatar.textContent = String(row.display_name || 'IQ').trim().slice(0, 1).toUpperCase();
      const details = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = row.display_name || t('IQZodiac member', 'عضو IQZodiac');
      const handle = document.createElement('small'); handle.textContent = row.handle || '';
      details.append(name, handle); identity.append(avatar, details);
      const actions = document.createElement('div'); actions.className = 'friend-list-actions';
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'button button-primary'; accept.textContent = t('Accept', 'قبول');
      const decline = document.createElement('button'); decline.type = 'button'; decline.className = 'button button-secondary'; decline.textContent = t('Decline', 'رفض');
      accept.addEventListener('click', () => void respondFromCommunity(row.user_id, true, actions));
      decline.addEventListener('click', () => void respondFromCommunity(row.user_id, false, actions));
      actions.append(accept, decline); item.append(identity, actions); container.append(item);
    });
  };

  const respondFromCommunity = async (userId, accept, actions) => {
    if (!isUuid(userId)) return;
    actions.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    try {
      const client = await clientReady();
      const { error } = await client.rpc('respond_friend_request', { p_target_user_id: userId, p_accept: accept });
      if (error) throw error;
      await loadCommunity();
      notify(accept ? t('Friend request accepted.', 'تم قبول طلب الصداقة.') : t('Friend request declined.', 'تم رفض طلب الصداقة.'));
    } catch (error) {
      console.warn('Friend request response failed.', error);
      actions.querySelectorAll('button').forEach((button) => { button.disabled = false; });
      notify(t('Your response could not be saved. Please try again.', 'تعذر حفظ ردك. حاول مجددًا.'));
    }
  };

  const renderFriends = (container, rows) => {
    container.replaceChildren();
    const count = document.querySelector('#friend-count');
    if (count) count.textContent = String(rows.length);
    if (!rows.length) { appendEmpty(container, t('Your accepted friends will appear here.', 'سيظهر أصدقاؤك المقبولون هنا.')); return; }
    rows.forEach((row) => {
      const item = document.createElement('article'); item.className = 'friend-list-item';
      const identity = document.createElement('div'); identity.className = 'friend-list-identity';
      const avatar = document.createElement('span'); avatar.className = 'friend-list-avatar'; avatar.textContent = String(row.display_name || 'IQ').trim().slice(0, 1).toUpperCase();
      const details = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = row.display_name || t('IQZodiac member', 'عضو IQZodiac');
      const handle = document.createElement('small'); handle.textContent = row.handle || '';
      details.append(name, handle); identity.append(avatar, details);
      const online = row.is_online === true;
      const status = document.createElement('span'); status.className = `friend-list-status${online ? ' is-online' : ''}`;
      status.setAttribute('aria-label', online ? t('Online', 'متصل') : t('Offline', 'غير متصل'));
      const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = online ? t('Online', 'متصل') : t('Offline', 'غير متصل');
      status.append(dot, label); item.append(identity, status); container.append(item);
    });
  };

  let communityLoading = false;
  const loadCommunity = async () => {
    const requestsRoot = document.querySelector('#friend-requests-list');
    const friendsRoot = document.querySelector('#friends-list');
    if (!requestsRoot || !friendsRoot || communityLoading) return;
    communityLoading = true;
    try {
      const client = await clientReady();
      if (!client) throw new Error('database_unavailable');
      const [requestsResult, friendsResult] = await Promise.all([
        client.rpc('get_my_friend_requests'),
        client.rpc('get_my_friends'),
      ]);
      if (requestsResult.error) throw requestsResult.error;
      if (friendsResult.error) throw friendsResult.error;
      renderFriendRequests(requestsRoot, requestsResult.data || []);
      renderFriends(friendsRoot, friendsResult.data || []);
    } catch (error) {
      console.warn('Profile community could not be loaded.', error);
      appendEmpty(requestsRoot, t('Friend requests could not be loaded.', 'تعذر تحميل طلبات الصداقة.'));
      appendEmpty(friendsRoot, t('Friends could not be loaded. Try again later.', 'تعذر تحميل الأصدقاء. حاول لاحقًا.'));
    } finally { communityLoading = false; }
  };

  if (feed) {
    feed.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-profile-user-id]');
      if (!trigger || !feed.contains(trigger)) return;
      event.preventDefault();
      void openProfile(trigger.dataset.profileUserId);
    });
    feed.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const trigger = event.target.closest('[data-profile-user-id][role="button"]');
      if (!trigger || !feed.contains(trigger)) return;
      event.preventDefault();
      void openProfile(trigger.dataset.profileUserId);
    });
  }

  if (document.querySelector('#friend-requests-list')) {
    void loadCommunity();
    window.setInterval(() => { if (document.visibilityState === 'visible') void loadCommunity(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void loadCommunity(); });
  }

  window.IQZodiacSocial = Object.freeze({ openProfile, reloadCommunity: loadCommunity });
})();
