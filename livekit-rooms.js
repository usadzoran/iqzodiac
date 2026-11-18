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
  const open = async (type, roomId, title, joinAudio = false) => {
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
