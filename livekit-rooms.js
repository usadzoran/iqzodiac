(() => {
  'use strict';

  const config = window.IQZodiacLiveKitConfig || {};
  const apiBase = String(config.tokenApiBase || '').replace(/\/$/, '');
  const MAX_SEATS = 8;
  let room = null;
  let activeType = '';
  let activeRoomId = '';
  let activeClient = null;
  let activeAccessToken = '';
  let audioMembershipJoined = false;
  let admittedMembership = null;
  let membershipChannel = null;
  let tokenAllowsPublish = false;
  let moderationMuted = false;
  let handRaised = false;
  let requestVersion = 0;
  const overflowParticipants = new Set();
  let modal;
  let previousFocus = null;
  let previousBodyOverflow = '';
  let previousRootOverflow = '';

  const setStatus = (message, state = '') => {
    const node = modal?.querySelector('[data-livekit-status]');
    if (node) { node.textContent = message; node.dataset.state = state; }
  };
  const leaveMembership = async (client, roomId) => {
    if (!client || !roomId) return false;
    const { error } = await client.rpc('iqzodiac_leave_audio_room', { p_room_id: roomId });
    if (error) throw error;
    if (admittedMembership?.roomId === roomId) admittedMembership = null;
    return true;
  };
  const setSeatCount = () => {
    if (!modal) return;
    const occupied = modal.querySelectorAll('[data-livekit-seat][data-identity]').length;
    const node = modal.querySelector('[data-livekit-seat-count]');
    if (node) node.textContent = `${occupied}/${MAX_SEATS} مقاعد`;
    const overflow = modal.querySelector('[data-livekit-overflow]');
    if (overflow) { overflow.hidden = overflowParticipants.size === 0; overflow.textContent = overflowParticipants.size ? `${overflowParticipants.size} مشاركًا إضافيًا متصلون بالصوت.` : ''; }
  };
  const makeModal = () => {
    if (modal) return modal;
    modal = document.createElement('section');
    modal.className = 'livekit-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'livekit-modal-title');
    const seats = Array.from({ length: MAX_SEATS }, (_, index) => `<article class="livekit-seat is-empty" data-livekit-seat data-seat-index="${index}" role="listitem" aria-label="مقعد فارغ"><div class="livekit-seat-avatar" aria-hidden="true">＋</div><div class="livekit-seat-copy"><strong data-seat-name>مقعد متاح</strong><small data-seat-role>بانتظار مشارك</small></div><div class="livekit-seat-media" data-seat-media></div></article>`).join('');
    modal.innerHTML = `<div class="livekit-panel"><header class="livekit-header"><div><p class="rooms-kicker">غرفة صوتية مباشرة</p><h2 id="livekit-modal-title">الغرفة الصوتية</h2><p class="livekit-seat-count" data-livekit-seat-count>0/${MAX_SEATS} مشاركين</p></div><button type="button" class="livekit-close" data-livekit-close aria-label="إغلاق">×</button></header><div class="livekit-stage" data-livekit-stage role="list" aria-label="مقاعد المشاركين">${seats}</div><p class="livekit-overflow" data-livekit-overflow hidden></p><div class="livekit-audio-sink" data-livekit-audio-sink aria-label="مسارات صوت المشاركين الإضافيين"></div><p class="livekit-status" data-livekit-status role="status" aria-live="polite"></p><div class="livekit-controls" role="group" aria-label="عناصر التحكم بالغرفة"><button type="button" data-livekit-mic>تشغيل الميكروفون</button><button type="button" data-livekit-hand aria-pressed="false">رفع اليد</button><button type="button" data-livekit-camera hidden>تشغيل الكاميرا</button><button type="button" class="danger" data-livekit-leave>مغادرة الغرفة</button></div></div>`;
    document.body.append(modal);
    modal.querySelector('[data-livekit-close]').addEventListener('click', () => { void close(false); });
    modal.querySelector('[data-livekit-leave]').addEventListener('click', () => { void close(true); });
    modal.addEventListener('click', (event) => { if (event.target === modal) void close(false); });
    modal.querySelector('[data-livekit-mic]').addEventListener('click', async () => {
      if (!room || !room.localParticipant || moderationMuted) return;
      const button = modal.querySelector('[data-livekit-mic]');
      button.disabled = true;
      try {
        const enabled = !room.localParticipant.isMicrophoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(enabled);
        button.textContent = enabled ? 'إيقاف الميكروفون' : 'تشغيل الميكروفون';
      } catch (error) { setStatus(`تعذر تغيير الميكروفون: ${String(error?.message || 'خطأ في الجهاز')}`, 'error'); }
      finally {
        if (moderationMuted) {
          try { await room?.localParticipant?.setMicrophoneEnabled(false); } catch (error) { console.warn('[IQZodiac realtime] microphone mute reassertion failed', error); }
          button.textContent = 'الميكروفون مكتوم';
        }
        button.disabled = moderationMuted || (activeType === 'audio' && !tokenAllowsPublish);
      }
    });
    modal.querySelector('[data-livekit-hand]').addEventListener('click', async () => {
      handRaised = !handRaised;
      const button = modal.querySelector('[data-livekit-hand]');
      button.setAttribute('aria-pressed', String(handRaised));
      button.textContent = handRaised ? 'خفض اليد' : 'رفع اليد';
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'raise_hand', raised: handRaised }));
      try { await room?.localParticipant?.publishData(payload, { reliable: true, topic: 'iqzodiac-room-controls' }); }
      catch (error) { setStatus('تعذر إرسال حالة رفع اليد، لكن تم تحديثها محليًا.', 'error'); }
    });
    modal.querySelector('[data-livekit-camera]').addEventListener('click', async () => {
      if (!room || !room.localParticipant) return;
      const button = modal.querySelector('[data-livekit-camera]');
      button.disabled = true;
      try {
        const enabled = !room.localParticipant.isCameraEnabled;
        await room.localParticipant.setCameraEnabled(enabled);
        button.textContent = enabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا';
      } catch (error) { setStatus(`تعذر تغيير الكاميرا: ${String(error?.message || 'تحقق من إذن الكاميرا')}`, 'error'); }
      finally { button.disabled = false; }
    });
    return modal;
  };
  const lockPageScroll = () => {
    previousBodyOverflow = document.body.style.overflow;
    previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  };
  const unlockPageScroll = () => {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousRootOverflow;
  };
  const clearSeats = () => {
    if (!modal) return;
    overflowParticipants.clear();
    modal.querySelector('[data-livekit-audio-sink]')?.replaceChildren();
    modal.querySelectorAll('[data-livekit-seat]').forEach((seat) => {
      seat.removeAttribute('data-identity');
      seat.classList.remove('is-local', 'is-speaking');
      seat.classList.add('is-empty');
      seat.setAttribute('aria-label', 'مقعد فارغ');
      seat.querySelector('[data-seat-name]').textContent = 'مقعد متاح';
      seat.querySelector('[data-seat-role]').textContent = 'بانتظار مشارك';
      seat.querySelector('[data-seat-media]').replaceChildren();
    });
    setSeatCount();
  };
  const teardown = async (hideModal, restoreFocus, leaveMembership = false) => {
    const roomId = activeRoomId;
    const endedType = activeType;
    const shouldLeave = leaveMembership && audioMembershipJoined && activeType === 'audio' && roomId && activeClient;
    audioMembershipJoined = false;
    tokenAllowsPublish = false;
    moderationMuted = false;
    handRaised = false;
    if (membershipChannel && activeClient) {
      const channel = membershipChannel; membershipChannel = null;
      try { void activeClient.removeChannel(channel).catch((error) => console.warn('[IQZodiac realtime] membership channel cleanup failed', error)); }
      catch (error) { console.warn('[IQZodiac realtime] membership channel cleanup failed', error); }
    }
    const currentRoom = room;
    room = null;
    if (currentRoom) {
      try {
        currentRoom.remoteParticipants?.forEach((participant) => participant.trackPublications?.forEach((publication) => publication.track?.detach().forEach((element) => element.remove())));
        currentRoom.localParticipant?.trackPublications?.forEach((publication) => publication.track?.detach().forEach((element) => element.remove()));
        await currentRoom.disconnect();
      } catch (error) { console.warn('[IQZodiac realtime] disconnect failed', error); }
    }
    if (shouldLeave) {
      try { await leaveMembership(activeClient, roomId); }
      catch (error) { console.warn('[IQZodiac realtime] membership cleanup failed', error); }
    }
    activeType = '';
    activeRoomId = '';
    activeClient = null;
    activeAccessToken = '';
    if (modal) {
      clearSeats();
      modal.querySelector('[data-livekit-camera]').hidden = true;
      modal.querySelector('[data-livekit-mic]').hidden = false;
      modal.querySelector('[data-livekit-mic]').disabled = false;
      modal.querySelector('[data-livekit-mic]').textContent = 'تشغيل الميكروفون';
      modal.querySelector('[data-livekit-hand]').textContent = 'رفع اليد';
      modal.querySelector('[data-livekit-hand]').setAttribute('aria-pressed', 'false');
      modal.querySelector('[data-livekit-camera]').textContent = 'تشغيل الكاميرا';
      if (hideModal) modal.hidden = true;
    }
    if (hideModal) { unlockPageScroll(); document.body.classList.remove('livekit-room-open'); }
    if (roomId) window.dispatchEvent(new CustomEvent('iqzodiac-livekit-closed', { detail: { type: endedType, roomId } }));
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
    if (restoreFocus) previousFocus = null;
  };
  const close = async (leaveMembership = false) => {
    requestVersion += 1;
    await teardown(true, true, leaveMembership);
  };
  const tokenRequest = async (type, roomId, accessToken) => {
    if (!apiBase) throw new Error('livekit_endpoint_missing');
    const response = await fetch(`${apiBase}/api/livekit/token?type=${encodeURIComponent(type)}&roomId=${encodeURIComponent(roomId)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.code || 'livekit_token_failed');
    if (!payload.token || !payload.url) throw new Error('livekit_token_invalid');
    return payload;
  };
  const findSeat = (participant, create = false) => {
    if (!modal || !participant?.identity) return null;
    const existing = [...modal.querySelectorAll('[data-livekit-seat]')].find((seat) => seat.dataset.identity === participant.identity);
    if (existing) return existing;
    if (!create) return null;
    const seat = [...modal.querySelectorAll('[data-livekit-seat]')].find((item) => !item.dataset.identity);
    if (!seat) return null;
    const isLocal = Boolean(room?.localParticipant && participant.identity === room.localParticipant.identity);
    const name = participant.name || (isLocal ? 'أنت' : participant.identity);
    seat.dataset.identity = participant.identity;
    seat.classList.remove('is-empty');
    seat.classList.toggle('is-local', isLocal);
    seat.setAttribute('aria-label', `${name}${isLocal ? '، أنت' : ''}`);
    seat.querySelector('[data-seat-name]').textContent = name;
    seat.querySelector('[data-seat-role]').textContent = isLocal ? 'أنت · متصل' : 'مشارك متصل';
    seat.querySelector('.livekit-seat-avatar').textContent = String(name).trim().slice(0, 1).toUpperCase() || '•';
    setSeatCount();
    return seat;
  };
  const addParticipant = (participant) => {
    if (!participant?.identity) return;
    if (findSeat(participant, true)) overflowParticipants.delete(participant.identity);
    else overflowParticipants.add(participant.identity);
    setSeatCount();
  };
  const attachTrack = (track, publication, participant) => {
    if (!track || !participant || !room) return;
    const seat = findSeat(participant, true);
    if (!seat && track.kind !== 'audio') return;
    if (track.kind === 'audio' && participant.identity === room.localParticipant.identity) return;
    const element = track.attach();
    element.className = track.kind === 'video' ? 'livekit-video' : 'livekit-audio';
    element.dataset.trackSid = publication?.trackSid || track.sid || '';
    if (track.kind === 'video') { element.autoplay = true; element.playsInline = true; element.setAttribute('aria-label', `فيديو ${participant.name || participant.identity}`); }
    else { element.autoplay = true; element.setAttribute('aria-label', `صوت ${participant.name || participant.identity}`); }
    if (seat) {
      seat.querySelector('[data-seat-media]').append(element);
      seat.classList.toggle('has-video', track.kind === 'video');
      seat.querySelector('[data-seat-role]').textContent = participant.identity === room.localParticipant.identity ? 'أنت · متصل' : (track.kind === 'video' ? 'مشارك · فيديو مباشر' : 'مشارك · صوت مباشر');
    } else {
      modal.querySelector('[data-livekit-audio-sink]').append(element);
    }
  };
  const detachTrack = (track, participant) => {
    track?.detach().forEach((element) => element.remove());
    if (!participant) return;
    const seat = findSeat(participant);
    if (seat && !seat.querySelector('[data-seat-media] video')) {
      seat.classList.remove('has-video');
      seat.querySelector('[data-seat-role]').textContent = participant.identity === room?.localParticipant?.identity ? 'أنت · متصل' : 'مشارك متصل';
    }
  };
  const removeParticipant = (participant) => {
    if (participant?.identity) overflowParticipants.delete(participant.identity);
    participant?.trackPublications?.forEach((publication) => publication.track?.detach().forEach((element) => element.remove()));
    const seat = findSeat(participant);
    if (!seat) { setSeatCount(); return; }
    seat.removeAttribute('data-identity');
    seat.classList.remove('is-local', 'is-speaking', 'has-video');
    seat.classList.add('is-empty');
    seat.setAttribute('aria-label', 'مقعد فارغ');
    seat.querySelector('[data-seat-name]').textContent = 'مقعد متاح';
    seat.querySelector('[data-seat-role]').textContent = 'بانتظار مشارك';
    seat.querySelector('[data-seat-media]').replaceChildren();
    setSeatCount();
  };
  let liveModal = null;
  let liveRoom = null;
  let liveRoomId = '';
  let liveRequestVersion = 0;
  let liveChatChannel = null;
  let liveEffect = 'original';
  let liveOverlay = 'none';
  let liveLikeCount = 0;
  let liveLikeIds = new Set();
  let liveCommentIds = new Set();
  let liveParticipantLabels = new Map();
  let liveHostUserId = '';
  let liveCurrentUserId = '';
  let liveAllowChat = true;
  let liveSelectedGift = null;
  let liveLikeLastSentAt = 0;
  let liveHeartbeatTimer = null;
  let liveAccessToken = '';
  let liveViewerChannel = null;
  let liveGiftChannel = null;
  let liveGiftSeenIds = new Set();
  let liveGiftCatalog = new Map();
  let liveGiftCount = 0;
  let liveGiftCoins = 0;
  let liveAudioMuted = false;
  let liveIsHost = false;
  const showLiveStatus = (message, state = '') => {
    const node = liveModal?.querySelector('[data-live-status]');
    if (!node) return;
    node.textContent = message;
    node.dataset.state = state;
    node.hidden = false;
    window.clearTimeout(showLiveStatus.timer);
    showLiveStatus.timer = window.setTimeout(() => { if (node.isConnected) node.hidden = true; }, 4200);
  };
  const updateLiveLikeDisplay = () => {
    const node = liveModal?.querySelector('[data-live-like-count]');
    if (node) node.textContent = `Like · ${liveLikeCount.toLocaleString()}`;
  };
  const refreshLiveLikeCount = async () => {
    if (!activeClient || !liveRoomId || !liveModal) return;
    const { count, error } = await activeClient.from('vip_live_likes').select('id', { count: 'exact', head: true }).eq('live_session_id', liveRoomId);
    if (!error && Number.isFinite(count)) { liveLikeCount = count; updateLiveLikeDisplay(); }
  };
  const setLiveFollowState = (following) => {
    const button = liveModal?.querySelector('[data-live-follow]');
    if (!button) return;
    button.textContent = following ? 'Following' : 'Follow';
    button.classList.toggle('is-following', following);
    button.setAttribute('aria-pressed', String(following));
  };
  const resolveLiveLabels = async (client, userIds) => {
    const ids = [...new Set((userIds || []).filter((id) => typeof id === 'string' && id))];
    const missing = ids.filter((id) => !liveParticipantLabels.has(id));
    if (missing.length && client && liveRoomId) {
      const { data, error } = await client.rpc('iqzodiac_live_participant_labels', { p_live_session_id: liveRoomId, p_user_ids: missing });
      if (!error && Array.isArray(data)) data.forEach((row) => { if (row.user_id && row.display_name) liveParticipantLabels.set(row.user_id, row.display_name); });
    }
    return new Map(ids.map((id) => [id, liveParticipantLabels.get(id) || `مستخدم-${id.slice(0, 4).toUpperCase()}`]));
  };
  const renderLiveGiftDashboard = () => {
    liveModal?.querySelector('[data-live-gift-count]')?.replaceChildren(document.createTextNode(liveGiftCount.toLocaleString()));
    liveModal?.querySelector('[data-live-gift-coins]')?.replaceChildren(document.createTextNode(liveGiftCoins.toLocaleString()));
  };
  const makeLiveModal = () => {
    if (liveModal) return liveModal;
    liveModal = document.createElement('section');
    liveModal.className = 'live-broadcast-modal';
    liveModal.hidden = true;
    liveModal.setAttribute('role', 'dialog');
    liveModal.setAttribute('aria-modal', 'true');
    liveModal.innerHTML = `<div class="live-broadcast-shell"><div class="live-effect-overlay" data-live-effect-overlay aria-hidden="true"></div><video class="live-broadcast-video" data-live-video autoplay playsinline></video><div class="live-broadcast-shade" aria-hidden="true"></div><header class="live-broadcast-top"><div class="live-broadcast-host"><span class="live-broadcast-avatar" data-live-avatar aria-hidden="true">•</span><span class="live-broadcast-host-copy"><strong data-live-host>Live broadcast</strong><small><b class="live-badge">LIVE</b><span data-live-viewers>0</span></small></span></div><div class="live-broadcast-top-actions"><button type="button" class="live-follow-button" data-live-follow hidden>Follow</button><button type="button" class="live-broadcast-close" data-live-close aria-label="Close broadcast">×</button></div><div class="live-host-gift-dashboard" data-live-earnings hidden aria-live="polite"><span aria-hidden="true">🎁</span><strong data-live-gift-count>0</strong><span>gifts</span><span class="live-dashboard-separator">·</span><strong data-live-gift-coins>0</strong><span>coins</span></div></header><div class="live-broadcast-comments" data-live-comments aria-live="polite" aria-relevant="additions"></div><div class="live-broadcast-toast-stack" data-live-toast-stack aria-live="polite"></div><footer class="live-broadcast-bottom"><div class="live-broadcast-actions" data-live-actions aria-label="Live controls"><button type="button" class="live-control" data-live-mic hidden aria-pressed="false"><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"></path></svg></span><span data-live-control-label>Microphone</span></button><button type="button" class="live-control" data-live-camera hidden aria-pressed="false"><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"></rect><path d="m16 10 5-3v10l-5-3"></path></svg></span><span data-live-control-label>Camera</span></button><button type="button" class="live-control" data-live-gift><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"></path><path d="M12 7H7.5a2.5 2.5 0 1 1 2.45-3c.52 1.49 2.05 3 2.05 3ZM12 7h4.5a2.5 2.5 0 1 0-2.45-3C13.53 5.49 12 7 12 7Z"></path></svg></span><span data-live-control-label>Gift</span></button><button type="button" class="live-control" data-live-share><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"></path></svg></span><span data-live-control-label>Share</span></button><button type="button" class="live-control" data-live-mute aria-pressed="false"><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path></svg></span><span data-live-control-label>Sound</span></button><button type="button" class="live-control live-like-button" data-live-like aria-label="Like live broadcast"><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"></path></svg></span><span data-live-like-count>Like · 0</span></button><button type="button" class="live-control live-effects-toggle" data-live-effects-toggle aria-expanded="false"><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM19 14l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14ZM5 2l.8 2.2L8 5l-2.2.8L5 8l-.8-2.2L2 5l2.2-.8L5 2Z"></path></svg></span><span data-live-control-label>Effects</span></button><button type="button" class="live-control" data-live-comments-toggle><span class="live-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"></path></svg></span><span data-live-control-label>Comments</span></button></div><div class="live-gift-panel" data-live-gift-panel hidden><div class="live-panel-heading"><strong>Live gifts</strong><button type="button" data-live-gift-close aria-label="Close gifts">×</button></div><div data-live-gift-list><small>Loading gifts…</small></div><small data-live-gift-note></small><button type="button" class="live-gift-send" data-live-send-gift disabled>Send selected gift</button></div><div class="live-effects-panel" data-live-effects-panel hidden><span>Effects</span><button type="button" data-live-effect="original" class="is-selected">Original</button><button type="button" data-live-effect="vivid">Vivid</button><button type="button" data-live-effect="warm">Warm</button><button type="button" data-live-effect="cool">Cool</button><button type="button" data-live-effect="mono">Mono</button><button type="button" data-live-effect="dreamy">Dreamy</button><button type="button" data-live-overlay="glow">Glow</button><button type="button" data-live-overlay="sparkle">Sparkle</button></div><form class="live-comment-form" data-live-comment-form><input data-live-comment-input maxlength="300" autocomplete="off" placeholder="Say something…" aria-label="Live comment" /><button type="submit">Send</button></form><p class="live-broadcast-status" data-live-status role="status" aria-live="polite" hidden></p><button type="button" class="live-end-button" data-live-end hidden>End live</button></footer></div>`;
    document.body.append(liveModal);
    liveModal.querySelector('[data-live-close]').addEventListener('click', () => { if (liveIsHost) { if (window.confirm('End this live broadcast?')) void closeLive(true); } else void closeLive(false); });
    liveModal.querySelector('[data-live-end]').addEventListener('click', () => { if (window.confirm('End this live broadcast for everyone?')) void closeLive(true); });
    liveModal.querySelector('[data-live-mic]').addEventListener('click', async () => { if (!liveIsHost || !liveRoom?.localParticipant) return; const button = liveModal.querySelector('[data-live-mic]'); button.disabled = true; try { const enabled = !liveRoom.localParticipant.isMicrophoneEnabled; await liveRoom.localParticipant.setMicrophoneEnabled(enabled); button.setAttribute('aria-pressed', String(!enabled)); button.querySelector('[data-live-control-label]').textContent = enabled ? 'Mute' : 'Unmute'; } catch (error) { showLiveStatus(`Microphone could not be changed: ${error?.message || 'device error'}`, 'error'); } finally { button.disabled = false; } });
    liveModal.querySelector('[data-live-camera]').addEventListener('click', async () => { if (!liveIsHost || !liveRoom?.localParticipant) return; const button = liveModal.querySelector('[data-live-camera]'); button.disabled = true; try { const enabled = !liveRoom.localParticipant.isCameraEnabled; await liveRoom.localParticipant.setCameraEnabled(enabled); button.setAttribute('aria-pressed', String(!enabled)); button.querySelector('[data-live-control-label]').textContent = enabled ? 'Camera off' : 'Camera on'; } catch (error) { showLiveStatus(`Camera could not be changed: ${error?.message || 'check camera permission'}`, 'error'); } finally { button.disabled = false; } });
    liveModal.querySelector('[data-live-share]').addEventListener('click', async () => { const url = new URL(`./live.html?live=${encodeURIComponent(liveRoomId)}`, document.baseURI).href; try { if (navigator.share) await navigator.share({ title: 'Live broadcast', url }); else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); showLiveStatus('Broadcast link copied.', 'ok'); } else { window.prompt('Copy this broadcast link:', url); } } catch (error) { if (error?.name !== 'AbortError') showLiveStatus('Could not share the broadcast link.', 'error'); } });
    liveModal.querySelector('[data-live-mute]').addEventListener('click', (event) => {
      liveAudioMuted = !liveAudioMuted;
      liveModal.querySelectorAll('.live-broadcast-audio').forEach((audio) => { audio.muted = liveAudioMuted; });
      event.currentTarget.setAttribute('aria-pressed', String(liveAudioMuted));
      event.currentTarget.querySelector('.live-control-icon').innerHTML = liveAudioMuted ? '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6"></path></svg>' : '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';
      event.currentTarget.querySelector('[data-live-control-label]').textContent = liveAudioMuted ? 'Unmute' : 'Sound';
    });
    liveModal.querySelector('[data-live-comments-toggle]').addEventListener('click', () => {
      liveModal.querySelector('[data-live-comment-input]')?.focus({ preventScroll: true });
    });
    liveModal.querySelector('[data-live-gift-close]').addEventListener('click', () => { liveModal.querySelector('[data-live-gift-panel]').hidden = true; });
    liveModal.querySelector('[data-live-effects-toggle]').addEventListener('click', (event) => { const panel = liveModal.querySelector('[data-live-effects-panel]'); const open = panel.hidden; panel.hidden = !open; event.currentTarget.setAttribute('aria-expanded', String(open)); });
    liveModal.querySelectorAll('[data-live-effect]').forEach((button) => button.addEventListener('click', () => setLiveEffect(button.dataset.liveEffect)));
    liveModal.querySelectorAll('[data-live-overlay]').forEach((button) => button.addEventListener('click', () => setLiveOverlay(button.dataset.liveOverlay)));
    liveModal.querySelector('[data-live-like]').addEventListener('click', async () => { const now = Date.now(); if (!liveRoomId || now - liveLikeLastSentAt < 700 || !activeClient) return; liveLikeLastSentAt = now; const button = liveModal.querySelector('[data-live-like]'); button.classList.add('is-pressed'); window.setTimeout(() => button.classList.remove('is-pressed'), 220); try { const { data, error } = await activeClient.rpc('iqzodiac_live_like', { p_live_session_id: liveRoomId }); if (error) throw error; liveLikeCount = Number(data ?? liveLikeCount); updateLiveLikeDisplay(); void refreshLiveLikeCount(); } catch (error) { if (error?.message === 'live_like_rate_limited') return; showLiveStatus('Your like could not be sent.', 'error'); console.warn('[IQZodiac realtime] live like failed', error); } });
    liveModal.querySelector('[data-live-gift]').addEventListener('click', () => { const panel = liveModal.querySelector('[data-live-gift-panel]'); panel.hidden = !panel.hidden; liveModal.querySelector('[data-live-effects-panel]').hidden = true; liveModal.querySelector('[data-live-effects-toggle]').setAttribute('aria-expanded', 'false'); });
    liveModal.querySelector('[data-live-send-gift]').addEventListener('click', async (event) => { if (!liveSelectedGift || !liveRoomId || !window.IQZodiacData?.adapter) return; const button = event.currentTarget; button.disabled = true; const note = liveModal.querySelector('[data-live-gift-note]'); try { const transaction = await window.IQZodiacData.adapter.sendGift({ liveSessionId: liveRoomId, giftId: liveSelectedGift.id, quantity: 1, idempotencyKey: crypto.randomUUID() }); showLiveGift(transaction, false); if (note) note.textContent = 'Gift sent successfully.'; } catch (error) { if (note) note.textContent = error?.message === 'insufficient_coins' ? 'Insufficient coins.' : 'Gift was not sent; no balance was deducted.'; } finally { button.disabled = !liveSelectedGift; } });
    liveModal.querySelector('[data-live-follow]').addEventListener('click', async (event) => { const button = event.currentTarget; if (!liveHostUserId || liveHostUserId === liveCurrentUserId || !activeClient) return; button.disabled = true; try { const { data, error } = await activeClient.rpc('toggle_follow', { p_followed_id: liveHostUserId }); if (error) throw error; setLiveFollowState(Boolean(data)); } catch (error) { showLiveStatus('Could not update follow status.', 'error'); console.warn('[IQZodiac realtime] follow update failed', error); } finally { button.disabled = false; } });
    liveModal.querySelector('[data-live-comment-form]').addEventListener('submit', async (event) => { event.preventDefault(); const input = liveModal.querySelector('[data-live-comment-input]'); const value = input.value.trim(); if (!liveAllowChat || !value || !liveRoomId || !activeClient || !liveCurrentUserId) return; const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true; try { const { error } = await activeClient.from('vip_live_chat_messages').insert({ live_session_id: liveRoomId, sender_user_id: liveCurrentUserId, body: value }); if (error) throw error; input.value = ''; } catch (error) { showLiveStatus(error?.message === 'live_user_banned' ? 'You cannot comment in this broadcast.' : 'Comment could not be sent.', 'error'); } finally { button.disabled = false; } });
    return liveModal;
  };
  const applyLiveVideoEffect = (video) => { if (!video) return; const filters = { original: 'none', vivid: 'saturate(1.55) contrast(1.08)', warm: 'sepia(.24) saturate(1.3) hue-rotate(-10deg) brightness(1.06)', cool: 'saturate(1.15) hue-rotate(18deg) contrast(1.05)', mono: 'grayscale(1) contrast(1.12)', dreamy: 'saturate(1.18) brightness(1.1) contrast(.92)' }; video.style.filter = filters[liveEffect] || filters.original; };
  const setLiveEffect = (effect) => { liveEffect = effect || 'original'; liveModal?.querySelectorAll('[data-live-effect]').forEach((button) => button.classList.toggle('is-selected', button.dataset.liveEffect === liveEffect)); liveModal?.querySelectorAll('.live-broadcast-video').forEach(applyLiveVideoEffect); };
  const setLiveOverlay = (overlay) => { liveOverlay = liveOverlay === overlay ? 'none' : overlay; const node = liveModal?.querySelector('[data-live-effect-overlay]'); if (node) { node.className = `live-effect-overlay ${liveOverlay === 'none' ? '' : `is-${liveOverlay}`}`; } liveModal?.querySelectorAll('[data-live-overlay]').forEach((button) => button.classList.toggle('is-selected', button.dataset.liveOverlay === liveOverlay)); };
  const updateLiveViewers = (count = null) => { if (!liveModal) return; const visibleCount = count !== null && count !== undefined && Number.isFinite(Number(count)) ? Number(count) : Math.max(0, liveRoom?.remoteParticipants?.size || 0); liveModal.querySelector('[data-live-viewers]').textContent = `${visibleCount} viewers`; };
  const syncLiveViewerPresence = async (present = true) => { if (!activeClient || !liveRoomId) return; try { const { data, error } = await activeClient.rpc('iqzodiac_live_heartbeat', { p_live_session_id: liveRoomId, p_present: present }); if (error) throw error; if (present) updateLiveViewers(data); } catch (error) { console.warn('[IQZodiac realtime] viewer heartbeat failed', error); } };
  const escapeLiveHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[character]));
  const loadLiveGifts = async (client) => { const list = liveModal?.querySelector('[data-live-gift-list]'); const note = liveModal?.querySelector('[data-live-gift-note]'); const send = liveModal?.querySelector('[data-live-send-gift]'); if (!list) return; const { data, error } = await client.from('vip_gifts').select('id,name,gift_code,price_coins,icon_asset_ref').eq('is_active', true).order('sort_order', { ascending: true }).limit(24); if (error || !data?.length) { list.innerHTML = '<small>No active gifts are available yet.</small>'; if (note) note.textContent = 'The gift catalog is unavailable.'; return; } liveGiftCatalog = new Map(data.map((gift) => [gift.id, gift])); list.innerHTML = data.map((gift) => `<button type="button" data-gift-id="${escapeLiveHtml(gift.id)}" title="${escapeLiveHtml(gift.name)}">${escapeLiveHtml(gift.icon_asset_ref || '🎁')} ${escapeLiveHtml(gift.name)}<small>${escapeLiveHtml(gift.price_coins)} coins</small></button>`).join(''); list.querySelectorAll('[data-gift-id]').forEach((button) => button.addEventListener('click', () => { liveSelectedGift = data.find((gift) => gift.id === button.dataset.giftId) || null; list.querySelectorAll('[data-gift-id]').forEach((item) => item.classList.remove('is-selected')); button.classList.add('is-selected'); if (send) send.disabled = !liveSelectedGift; if (note) note.textContent = liveSelectedGift ? `${liveSelectedGift.name} selected · ${liveSelectedGift.price_coins} coins.` : ''; })); if (note) note.textContent = 'Select a gift, then confirm sending.'; };
  const updateLiveGiftSummary = () => renderLiveGiftDashboard();
  const showLiveGift = (transaction, broadcast = false, render = true) => {
    if (!transaction || transaction.status !== 'settled' || !transaction.id || liveGiftSeenIds.has(transaction.id)) return;
    liveGiftSeenIds.add(transaction.id);
    const quantity = Math.max(1, Number(transaction.quantity || 1));
    const coins = Number(transaction.total_price_coins || (transaction.price_coins_snapshot || 0) * quantity);
    if (liveIsHost) {
      liveGiftCount += quantity;
      liveGiftCoins += Number.isFinite(coins) ? coins : 0;
      updateLiveGiftSummary();
    }
    const gift = liveGiftCatalog.get(transaction.gift_id) || {};
    const icon = gift.icon_asset_ref || transaction.icon_asset_ref || '🎁';
    const sender = transaction.sender_label || 'Viewer';
    const name = transaction.gift_name_snapshot || transaction.gift_name || gift.name || 'Gift';
    if (render) {
      const bubble = document.createElement('div');
      bubble.className = 'live-gift-float';
      const iconNode = document.createElement('span'); iconNode.setAttribute('aria-hidden', 'true'); iconNode.textContent = icon;
      const senderNode = document.createElement('strong'); senderNode.textContent = sender;
      const giftNode = document.createElement('span'); giftNode.textContent = `${name} · ${coins.toLocaleString()} coins`;
      bubble.append(iconNode, senderNode, giftNode);
      liveModal?.querySelector('.live-broadcast-shell')?.append(bubble);
      window.setTimeout(() => bubble.remove(), 4800);
    }
    if (broadcast && liveIsHost && liveRoom?.localParticipant) {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'gift_notification', live_session_id: liveRoomId, transaction_id: transaction.id }));
      void liveRoom.localParticipant.publishData(payload, { reliable: true, topic: 'iqzodiac-live-gifts' }).catch((error) => console.warn('[IQZodiac realtime] gift broadcast failed', error));
    }
  };
  const loadLiveGiftTotals = async () => {
    if (!activeClient || !liveRoomId || !liveIsHost) return;
    const seen = new Set();
    let count = 0;
    let coins = 0;
    let offset = 0;
    const pageSize = 500;
    try {
      while (true) {
        const { data, error } = await activeClient.from('vip_gift_transactions')
          .select('id,quantity,total_price_coins,price_coins_snapshot,status')
          .eq('live_session_id', liveRoomId).eq('status', 'settled')
          .order('created_at', { ascending: true }).range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = data || [];
        rows.forEach((row) => {
          if (seen.has(row.id)) return;
          seen.add(row.id);
          count += Math.max(1, Number(row.quantity || 1));
          coins += Number(row.total_price_coins || row.price_coins_snapshot || 0);
          liveGiftSeenIds.add(row.id);
        });
        if (rows.length < pageSize) break;
        offset += rows.length;
      }
      liveGiftCount = count;
      liveGiftCoins = coins;
      updateLiveGiftSummary();
    } catch (error) { console.warn('[IQZodiac realtime] gift totals could not be loaded', error); }
  };
  const refreshLiveViewerCount = async () => {
    if (!activeClient || !liveRoomId || !liveModal) return;
    const { data } = await activeClient.from('vip_live_sessions').select('viewer_count').eq('id', liveRoomId).limit(1).maybeSingle();
    if (data && data.viewer_count !== null && data.viewer_count !== undefined && Number.isFinite(Number(data.viewer_count))) updateLiveViewers(Number(data.viewer_count));
  };
  const addLiveComment = (text, sender = '', id = '') => {
    const list = liveModal?.querySelector('[data-live-comments]');
    if (!list) return;
    if (id && liveCommentIds.has(id)) return;
    if (id) { liveCommentIds.add(id); if (liveCommentIds.size > 2000) liveCommentIds.delete(liveCommentIds.values().next().value); }
    const item = document.createElement('p');
    item.className = 'live-comment-item';
    if (id) item.dataset.commentId = id;
    const name = document.createElement('strong');
    name.textContent = sender || 'Viewer';
    const body = document.createElement('span');
    body.textContent = String(text || '');
    item.append(name, body);
    list.append(item);
    while (list.children.length > 6) list.firstElementChild.remove();
    window.setTimeout(() => item.remove(), 6500);
  };
  const attachLiveTrack = (track, publication, participant) => {
    if (!track || !liveModal) return;
    if (track.kind === 'video') {
      const video = track.attach(); video.className = 'live-broadcast-video'; applyLiveVideoEffect(video); video.autoplay = true; video.playsInline = true; video.dataset.trackSid = publication?.trackSid || track.sid || '';
      liveModal.querySelector('[data-live-video]')?.remove(); liveModal.querySelector('.live-broadcast-shell').prepend(video);
    } else if (track.kind === 'audio' && participant?.identity !== liveRoom?.localParticipant?.identity) {
      const audio = track.attach(); audio.autoplay = true; audio.muted = liveAudioMuted; audio.className = 'live-broadcast-audio'; liveModal.querySelector('.live-broadcast-shell').append(audio);
    }
  };
  const closeLive = async (endBroadcast = false) => {
    liveRequestVersion += 1;
    const id = liveRoomId;
    if (endBroadcast && id && activeClient) await syncLiveViewerPresence(false);
    if (endBroadcast && id && activeClient) {
      try { const { data, error } = await activeClient.rpc('iqzodiac_end_live_session', { p_live_session_id: id }); if (error || data !== true) throw error || new Error('live_end_not_authorized'); }
      catch (error) { showLiveStatus('The broadcast could not be ended. It remains live until the server confirms the end.', 'error'); console.warn('[IQZodiac realtime] live end failed', error); return false; }
    }
    if (liveHeartbeatTimer) { window.clearInterval(liveHeartbeatTimer); liveHeartbeatTimer = null; }
    if (liveViewerChannel && activeClient) { try { await activeClient.removeChannel(liveViewerChannel); } catch (error) { console.warn('[IQZodiac realtime] viewer channel cleanup failed', error); } liveViewerChannel = null; }
    if (liveGiftChannel && activeClient) { try { await activeClient.removeChannel(liveGiftChannel); } catch (error) { console.warn('[IQZodiac realtime] gift channel cleanup failed', error); } liveGiftChannel = null; }
    if (id && activeClient && !endBroadcast) await syncLiveViewerPresence(false);
    if (liveChatChannel && activeClient) { try { await activeClient.removeChannel(liveChatChannel); } catch (error) { console.warn('[IQZodiac realtime] chat channel cleanup failed', error); } liveChatChannel = null; }
    try { await liveRoom?.disconnect(); } catch (error) { console.warn('[IQZodiac realtime] live disconnect failed', error); }
    liveRoom = null; liveRoomId = ''; liveAccessToken = ''; liveHostUserId = ''; liveCurrentUserId = ''; liveIsHost = false;
    if (liveModal) { liveModal.hidden = true; liveModal.querySelector('.live-broadcast-shell').querySelectorAll('video,audio').forEach((node) => node.remove()); }
    document.body.classList.remove('live-broadcast-open');
    if (id) window.dispatchEvent(new CustomEvent('iqzodiac-live-broadcast-closed', { detail: { roomId: id, ended: endBroadcast } }));
  };
  const openLive = async (roomId, title) => {
    makeLiveModal();
    if (liveRoom || liveRoomId) await closeLive(false);
    const sequence = ++liveRequestVersion;
    liveRoomId = roomId;
    liveModal.hidden = false;
    document.body.classList.add('live-broadcast-open');
    liveModal.querySelector('[data-live-host]').textContent = title || 'Live broadcast';
    liveModal.querySelector('[data-live-avatar]').textContent = '•';
    liveModal.querySelector('[data-live-end]').hidden = true;
    liveModal.querySelector('[data-live-earnings]').hidden = true;
    liveModal.querySelector('[data-live-follow]').hidden = true;
    liveModal.querySelector('[data-live-mic]').hidden = true;
    liveModal.querySelector('[data-live-camera]').hidden = true;
    liveModal.querySelector('[data-live-actions]').dataset.role = 'viewer';
    liveModal.querySelector('.live-broadcast-shell').dataset.role = 'viewer';
    liveModal.querySelector('[data-live-comments]').replaceChildren();
    liveLikeCount = 0; liveLikeIds = new Set(); liveSelectedGift = null; liveLikeLastSentAt = 0;
    liveGiftCount = 0; liveGiftCoins = 0; liveGiftSeenIds = new Set(); liveCommentIds = new Set(); liveParticipantLabels = new Map();
    liveAudioMuted = false; liveIsHost = false; liveHostUserId = ''; liveCurrentUserId = ''; liveAllowChat = true;
    updateLiveGiftSummary(); updateLiveLikeDisplay();
    liveModal.querySelector('[data-live-viewers]').textContent = '0 viewers';
    liveModal.querySelector('[data-live-send-gift]').disabled = true;
    liveModal.querySelector('[data-live-mute]').setAttribute('aria-pressed', 'false');
    liveModal.querySelector('[data-live-mute] .live-control-icon').innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';
    liveModal.querySelector('[data-live-mute] [data-live-control-label]').textContent = 'Sound';
    liveModal.querySelector('[data-live-gift-panel]').hidden = true;
    liveModal.querySelector('[data-live-effects-panel]').hidden = true;
    showLiveStatus('Connecting to the live broadcast…', 'pending');

    try {
      const client = await window.IQZodiacSupabase.ready;
      activeClient = client;
      const { data: sessionData, error: authError } = await client.auth.getSession();
      if (authError) throw authError;
      liveCurrentUserId = sessionData?.session?.user?.id || '';
      if (!liveCurrentUserId || !sessionData?.session?.access_token) throw new Error('auth_required');
      const accessToken = sessionData.session.access_token;
      liveAccessToken = accessToken;
      const { data: liveSession, error: liveSessionError } = await client.from('vip_live_sessions')
        .select('host_user_id,title,room_settings,visibility,status').eq('id', roomId).limit(1).maybeSingle();
      if (liveSessionError) throw liveSessionError;
      if (!liveSession?.host_user_id) throw new Error('live_session_not_found');
      liveHostUserId = liveSession.host_user_id;
      liveAllowChat = liveSession.room_settings?.allow_chat !== false;
      liveModal.querySelector('[data-live-comment-form]').hidden = !liveAllowChat;
      liveModal.querySelector('[data-live-host]').textContent = liveSession.title || title || 'Live broadcast';
      const hostLabels = await resolveLiveLabels(client, [liveHostUserId]);
      const hostName = hostLabels.get(liveHostUserId) || 'Live host';
      liveModal.querySelector('[data-live-host]').textContent = hostName;
      liveModal.querySelector('[data-live-avatar]').textContent = Array.from(hostName.trim())[0]?.toLocaleUpperCase() || '•';
      const followButton = liveModal.querySelector('[data-live-follow]');
      if (liveHostUserId !== liveCurrentUserId) {
        followButton.hidden = false;
        const { data: followRow, error: followError } = await client.from('follows').select('followed_id')
          .eq('follower_id', liveCurrentUserId).eq('followed_id', liveHostUserId).maybeSingle();
        if (!followError) setLiveFollowState(Boolean(followRow));
      }
      if (sequence !== liveRequestVersion) return false;
      void loadLiveGifts(client);
      const { data: sessionResponse } = await client.auth.getSession();
      const access = sessionResponse?.session?.access_token;
      if (!access) throw new Error('auth_required');
      const { data: chatRows, error: chatError } = await client.from('vip_live_chat_messages')
        .select('id,body,sender_user_id,created_at').eq('live_session_id', roomId)
        .eq('moderation_status', 'visible').order('created_at', { ascending: true }).limit(30);
      if (chatError) throw chatError;
      const chatLabels = await resolveLiveLabels(client, (chatRows || []).map((row) => row.sender_user_id).filter(Boolean));
      (chatRows || []).forEach((row) => addLiveComment(row.body, chatLabels.get(row.sender_user_id) || 'Viewer', row.id));
      liveChatChannel = client.channel(`live-chat-${roomId}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vip_live_chat_messages', filter: `live_session_id=eq.${roomId}` }, async (payload) => {
          const row = payload.new;
          if (!row?.body || row.moderation_status && row.moderation_status !== 'visible') return;
          const labels = await resolveLiveLabels(client, row.sender_user_id ? [row.sender_user_id] : []);
          addLiveComment(row.body, labels.get(row.sender_user_id) || 'Viewer', row.id);
        }).subscribe();
      liveViewerChannel = client.channel(`live-viewers-${roomId}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_live_viewers', filter: `live_session_id=eq.${roomId}` }, () => { void refreshLiveViewerCount(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vip_live_likes', filter: `live_session_id=eq.${roomId}` }, (payload) => { const id = payload.new?.id; if (!id || liveLikeIds.has(id)) return; liveLikeIds.add(id); if (liveLikeIds.size > 500) liveLikeIds.delete(liveLikeIds.values().next().value); void refreshLiveLikeCount(); const bubble = document.createElement('span'); bubble.className = 'live-reaction-bubble'; bubble.textContent = '♥'; liveModal.querySelector('.live-broadcast-shell').append(bubble); window.setTimeout(() => bubble.remove(), 1500); }).subscribe();
      liveGiftChannel = client.channel(`live-gifts-${roomId}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vip_gift_transactions', filter: `live_session_id=eq.${roomId}` }, async (payload) => {
          if (payload.new?.status !== 'settled') return;
          const labels = await resolveLiveLabels(client, payload.new.sender_user_id ? [payload.new.sender_user_id] : []);
          showLiveGift({ ...payload.new, sender_label: labels.get(payload.new.sender_user_id) || 'Viewer' }, liveIsHost);
        }).subscribe();
      const token = await tokenRequest('live', roomId, access);
      if (sequence !== liveRequestVersion) return false;
      if (!window.LivekitClient?.Room || !window.LivekitClient?.RoomEvent) throw new Error('livekit_client_missing');
      liveRoom = new window.LivekitClient.Room({ adaptiveStream: true, dynacast: true });
      liveRoom.on(window.LivekitClient.RoomEvent.TrackSubscribed, attachLiveTrack);
      liveRoom.on(window.LivekitClient.RoomEvent.LocalTrackPublished, (publication, participant) => { if (publication.track) attachLiveTrack(publication.track, publication, participant || liveRoom?.localParticipant); });
      liveRoom.on(window.LivekitClient.RoomEvent.LocalTrackUnpublished, (publication) => { publication.track?.detach().forEach((node) => node.remove()); });
      liveRoom.on(window.LivekitClient.RoomEvent.TrackUnsubscribed, (track) => track?.detach().forEach((node) => node.remove()));
      liveRoom.on(window.LivekitClient.RoomEvent.ParticipantConnected, () => { void refreshLiveViewerCount(); });
      liveRoom.on(window.LivekitClient.RoomEvent.ParticipantDisconnected, () => { void refreshLiveViewerCount(); });
      liveRoom.on(window.LivekitClient.RoomEvent.Disconnected, () => showLiveStatus('The live connection ended.', 'error'));
      if (window.LivekitClient.RoomEvent.DataReceived) liveRoom.on(window.LivekitClient.RoomEvent.DataReceived, async (payload, participant) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload));
          if (message?.type !== 'gift_notification' || message.live_session_id !== liveRoomId || participant?.identity !== liveHostUserId || !message.transaction_id) return;
          const { data, error } = await activeClient.rpc('iqzodiac_live_gift_event', { p_live_session_id: liveRoomId, p_transaction_id: message.transaction_id });
          if (error) throw error;
          const transaction = Array.isArray(data) ? data[0] : data;
          if (transaction?.status === 'settled') showLiveGift(transaction, false);
        } catch (error) { console.warn('[IQZodiac realtime] live gift notification ignored', error); }
      });
      await liveRoom.connect(token.url, token.token);
      await syncLiveViewerPresence(true);
      liveHeartbeatTimer = window.setInterval(() => { void syncLiveViewerPresence(true); }, 20000);
      liveRoom.remoteParticipants.forEach((participant) => participant.trackPublications.forEach((publication) => { if (publication.track && publication.isSubscribed) attachLiveTrack(publication.track, publication, participant); }));
      liveIsHost = Boolean(token.canPublish);
      liveModal.querySelector('[data-live-actions]').dataset.role = liveIsHost ? 'host' : 'viewer';
      liveModal.querySelector('.live-broadcast-shell').dataset.role = liveIsHost ? 'host' : 'viewer';
      liveModal.querySelector('[data-live-end]').hidden = !liveIsHost;
      liveModal.querySelector('[data-live-mic]').hidden = !liveIsHost;
      liveModal.querySelector('[data-live-camera]').hidden = !liveIsHost;
      liveModal.querySelector('[data-live-earnings]').hidden = !liveIsHost;
      liveModal.querySelector('[data-live-follow]').hidden = liveIsHost || liveHostUserId === liveCurrentUserId;
      if (liveIsHost) {
        const { data: started, error: startError } = await activeClient.rpc('iqzodiac_start_live_session', { p_live_session_id: roomId });
        if (startError || started !== true) throw startError || new Error('live_session_start_denied');
        await liveRoom.localParticipant.setMicrophoneEnabled(true);
        await liveRoom.localParticipant.setCameraEnabled(true);
        liveModal.querySelector('[data-live-mic]').setAttribute('aria-pressed', 'true');
        liveModal.querySelector('[data-live-mic] [data-live-control-label]').textContent = 'Mute';
        liveModal.querySelector('[data-live-camera]').setAttribute('aria-pressed', 'true');
        liveModal.querySelector('[data-live-camera] [data-live-control-label]').textContent = 'Camera off';
        await loadLiveGiftTotals();
      }
      await refreshLiveLikeCount();
      await refreshLiveViewerCount();
      if (!liveAllowChat) showLiveStatus('Comments are disabled for this broadcast.', 'pending');
      else showLiveStatus(liveIsHost ? 'You are live.' : 'Connected to the live broadcast.', 'ok');
      return true;
    } catch (error) {
      if (sequence !== liveRequestVersion) return false;
      const code = String(error?.message || 'unknown_error');
      showLiveStatus(code === 'auth_required' ? 'Please sign in to join this live broadcast.' : `Could not join the live broadcast (${code}).`, 'error');
      console.error('[IQZodiac realtime] live connection failed', error);
      return false;
    }
  };

  const open = async (type, roomId, title, joinAudio = false) => {
    if (type === 'live') return openLive(roomId, title);
    makeModal();
    const sequence = ++requestVersion;
    if (room || activeRoomId) await teardown(false, false, true);
    if (sequence !== requestVersion) return false;
    if (admittedMembership && admittedMembership.roomId !== roomId) {
      const previous = admittedMembership;
      try { await leaveMembership(previous.client, previous.roomId); }
      catch (error) { console.warn('[IQZodiac realtime] previous room membership cleanup failed', error); }
    }
    const wasHidden = modal.hidden;
    if (wasHidden) previousFocus = document.activeElement;
    modal.hidden = false;
    if (wasHidden) { lockPageScroll(); document.body.classList.add('livekit-room-open'); }
    modal.querySelector('#livekit-modal-title').textContent = title || (type === 'live' ? 'البث المباشر' : 'الغرفة الصوتية');
    setStatus('جارٍ التحقق من الجلسة والاتصال…');
    clearSeats();
    activeType = type;
    activeRoomId = roomId;
    try {
      const client = await window.IQZodiacSupabase.ready;
      activeClient = client;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!sessionData?.session?.user?.id || !accessToken) throw new Error('auth_required');
      activeAccessToken = accessToken;
      if (sequence !== requestVersion) return false;
      if (joinAudio) {
        const { error } = await client.rpc('iqzodiac_join_audio_room', { p_room_id: roomId });
        if (error) throw error;
        if (sequence !== requestVersion) {
          try { await leaveMembership(client, roomId); }
          catch (leaveError) { console.warn('[IQZodiac realtime] stale join cleanup failed', leaveError); }
          return false;
        }
        audioMembershipJoined = true;
        admittedMembership = { roomId, client, accessToken };
      }
      if (joinAudio && typeof client.channel === 'function') {
        const userId = sessionData.session.user.id;
        membershipChannel = client.channel(`iqz-audio-member-${roomId}-${userId}-${sequence}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'audio_room_members', filter: `room_id=eq.${roomId}` }, async (payload) => {
            if (sequence !== requestVersion || payload?.new?.room_id !== roomId || payload?.new?.user_id !== userId) return;
            const row = payload.new;
            if (row.removed_at) {
              setStatus('تمت إزالتك من الغرفة بواسطة المشرف.', 'error');
              void close(false);
              return;
            }
            const micButton = modal?.querySelector('[data-livekit-mic]');
            if (row.is_muted) {
              moderationMuted = true;
              micButton.disabled = true;
              micButton.textContent = 'الميكروفون مكتوم';
              try { await room?.localParticipant?.setMicrophoneEnabled(false); }
              catch (error) { console.warn('[IQZodiac realtime] forced microphone mute failed', error); }
              setStatus('كتم المشرف الميكروفون. سيبقى الاستماع متاحًا.', 'error');
            } else if (micButton?.disabled && type === 'audio') {
              moderationMuted = false;
              if (!tokenAllowsPublish) {
                setStatus('رفع المشرف الكتم؛ جارٍ إعادة الاتصال لتحديث الصلاحية.', 'ok');
                window.setTimeout(() => { if (sequence === requestVersion) void close(false); }, 900);
              } else {
                micButton.disabled = false;
                micButton.textContent = 'تشغيل الميكروفون';
                setStatus('رفع المشرف الكتم. يمكنك تشغيل الميكروفون.', 'ok');
              }
            }
          });
        membershipChannel.subscribe((state) => {
          if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') console.warn('[IQZodiac realtime] membership updates unavailable', state);
        });
      }
      const token = await tokenRequest(type, roomId, accessToken);
      if (sequence !== requestVersion) { await teardown(false, false); return false; }
      if (!window.LivekitClient?.Room || !window.LivekitClient?.RoomEvent) throw new Error('livekit_client_missing');
      room = new window.LivekitClient.Room({ adaptiveStream: true, dynacast: true });
      room.on(window.LivekitClient.RoomEvent.TrackSubscribed, attachTrack);
      room.on(window.LivekitClient.RoomEvent.TrackUnsubscribed, detachTrack);
      room.on(window.LivekitClient.RoomEvent.ParticipantConnected, addParticipant);
      room.on(window.LivekitClient.RoomEvent.ParticipantDisconnected, removeParticipant);
      room.on(window.LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        modal.querySelectorAll('[data-livekit-seat]').forEach((seat) => seat.classList.toggle('is-speaking', speakers.some((speaker) => speaker.identity === seat.dataset.identity)));
      });
      if (window.LivekitClient.RoomEvent.DataReceived) {
        room.on(window.LivekitClient.RoomEvent.DataReceived, (payload, participant) => {
          try {
            const message = JSON.parse(new TextDecoder().decode(payload));
            if (message?.type !== 'raise_hand' || !participant) return;
            const seat = findSeat(participant, true);
            if (seat) seat.querySelector('[data-seat-role]').textContent = message.raised ? '✋ رفع اليد' : 'مشارك متصل';
          } catch (error) { console.warn('[IQZodiac realtime] room control message ignored', error); }
        });
      }
      room.on(window.LivekitClient.RoomEvent.LocalTrackPublished, (publication, participant) => {
        if (publication.track) attachTrack(publication.track, publication, participant || room?.localParticipant);
      });
      room.on(window.LivekitClient.RoomEvent.LocalTrackUnpublished, (publication, participant) => {
        if (publication.track) detachTrack(publication.track, participant || room?.localParticipant);
      });
      room.on(window.LivekitClient.RoomEvent.Disconnected, () => { if (modal && !modal.hidden) setStatus('انقطع الاتصال المباشر. يمكنك المغادرة ثم إعادة المحاولة.', 'error'); });
      await room.connect(token.url, token.token);
      if (sequence !== requestVersion) { await teardown(false, false); return false; }
      addParticipant(room.localParticipant);
      room.remoteParticipants.forEach(addParticipant);
      room.remoteParticipants.forEach((participant) => participant.trackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed) attachTrack(publication.track, publication, participant);
      }));
      const publishAllowed = Boolean(token.canPublish);
      tokenAllowsPublish = publishAllowed;
      const micButton = modal.querySelector('[data-livekit-mic]');
      micButton.hidden = type === 'live' && !publishAllowed;
      const cameraButton = modal.querySelector('[data-livekit-camera]');
      cameraButton.hidden = !(type === 'live' && publishAllowed);
      if (publishAllowed) {
        await room.localParticipant.setMicrophoneEnabled(true);
        micButton.textContent = 'إيقاف الميكروفون';
        if (type === 'live') {
          await room.localParticipant.setCameraEnabled(true);
          cameraButton.textContent = 'إيقاف الكاميرا';
        }
      } else if (type === 'audio') {
        moderationMuted = true;
        micButton.hidden = false;
        micButton.disabled = true;
        micButton.textContent = 'الميكروفون مكتوم';
      }
      if (sequence !== requestVersion) { await teardown(false, false); return false; }
      setStatus(publishAllowed ? 'أنت متصل كمضيف أو متحدث.' : (type === 'audio' ? 'أنت متصل كمشارك؛ الميكروفون مكتوم من المشرف.' : 'أنت متصل كمشاهد.'), 'ok');
      modal.querySelector('[data-livekit-close]').focus();
      return true;
    } catch (error) {
      if (sequence !== requestVersion) return false;
      const failedRoom = room;
      room = null;
      if (failedRoom) {
        try { await failedRoom.disconnect(); }
        catch (disconnectError) { console.warn('[IQZodiac realtime] failed connection cleanup failed', disconnectError); }
      }
      const code = String(error?.message || 'unknown_error');
      console.error('[IQZodiac realtime]', error);
      const message = code === 'livekit_endpoint_missing' ? 'لم يتم ضبط خدمة الاتصال المباشر بعد.'
        : code === 'livekit_client_missing' ? 'تعذر تحميل خدمة الاتصال المباشر. أعد تحميل الصفحة.'
          : code === 'auth_required' ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا.'
            : code === 'room_access_denied' || code === 'member_removed' || code === 'private_room_access_required' ? 'ليست لديك صلاحية نشطة لدخول هذه الغرفة.'
              : code === 'livekit_not_configured' ? 'إعدادات خدمة الاتصال المباشر ناقصة في الخادم.'
                : code === 'supabase_not_configured' ? 'متغيرات Supabase ناقصة في Vercel.'
                  : code === 'livekit_token_invalid' ? 'استلمنا استجابة اتصال غير مكتملة. حاول مجددًا.'
                    : `تعذر الاتصال بالغرفة (${code}).`;
      setStatus(message, 'error');
      if (audioMembershipJoined && activeClient) {
        try { await leaveMembership(activeClient, roomId); } catch (leaveError) { console.warn('[IQZodiac realtime] cleanup after join failure failed', leaveError); }
        audioMembershipJoined = false;
      }
      return false;
    }
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) { event.preventDefault(); void close(false); }
  });
  window.addEventListener('pagehide', () => {
    if (admittedMembership) {
      const { client, roomId, accessToken } = admittedMembership;
      admittedMembership = null;
      audioMembershipJoined = false;
      const restUrl = String(client?.rest?.url || '').replace(/\/$/, '');
      const apiKey = String(client?.supabaseKey || '');
      if (restUrl && apiKey && accessToken) {
        void fetch(`${restUrl}/rpc/iqzodiac_leave_audio_room`, { method: 'POST', keepalive: true, headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_room_id: roomId }) }).catch((error) => console.warn('[IQZodiac realtime] page-exit membership cleanup failed', error));
      } else {
        try { void client.rpc('iqzodiac_leave_audio_room', { p_room_id: roomId }).catch((error) => console.warn('[IQZodiac realtime] page-exit membership cleanup failed', error)); }
        catch (error) { console.warn('[IQZodiac realtime] page-exit membership cleanup failed', error); }
      }
    }
    if (liveRoomId && activeClient && liveAccessToken) {
      const restUrl = String(activeClient?.rest?.url || '').replace(/\/$/, '');
      const apiKey = String(activeClient?.supabaseKey || '');
      if (restUrl && apiKey) {
        void fetch(`${restUrl}/rpc/iqzodiac_live_heartbeat`, { method: 'POST', keepalive: true, headers: { apikey: apiKey, Authorization: `Bearer ${liveAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_live_session_id: liveRoomId, p_present: false }) }).catch((error) => console.warn('[IQZodiac realtime] page-exit live presence cleanup failed', error));
      } else {
        try { void activeClient.rpc('iqzodiac_live_heartbeat', { p_live_session_id: liveRoomId, p_present: false }).catch((error) => console.warn('[IQZodiac realtime] page-exit live presence cleanup failed', error)); }
        catch (error) { console.warn('[IQZodiac realtime] page-exit live presence cleanup failed', error); }
      }
    }
    try { liveRoom?.disconnect(); } catch {}
    try { room?.disconnect(); } catch {}
  });
  window.IQZodiacLiveKit = {
    joinAudio: (roomId, title) => open('audio', roomId, title, true),
    joinLive: (roomId, title) => open('live', roomId, title, false),
    close: () => close(false),
    leave: () => close(true),
  };
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const audio = target?.closest('[data-livekit-audio-room-id]');
    const live = target?.closest('[data-livekit-live-room-id]');
    if (audio) void open('audio', audio.dataset.livekitAudioRoomId, audio.dataset.title, true);
    else if (live) void open('live', live.dataset.livekitLiveRoomId, live.dataset.title, false);
  });
})();
