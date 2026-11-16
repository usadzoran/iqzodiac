(() => {
  'use strict';
  const config = window.IQZodiacLiveKitConfig || {};
  const apiBase = String(config.tokenApiBase || '').replace(/\/$/, '');
  let room = null;
  let activeType = '';
  let activeRoomId = '';
  let canPublish = false;
  let modal;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const setStatus = (message, state = '') => { const node = modal?.querySelector('[data-livekit-status]'); if (node) { node.textContent = message; node.dataset.state = state; } };
  const makeModal = () => {
    if (modal) return modal;
    modal = document.createElement('section'); modal.className = 'livekit-modal'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'livekit-modal-title');
    modal.innerHTML = `<div class="livekit-panel"><header><div><p class="rooms-kicker">LIVEKIT SECURE ROOM</p><h2 id="livekit-modal-title">Live room</h2></div><button type="button" class="livekit-close" data-livekit-close aria-label="إغلاق">×</button></header><div class="livekit-stage" data-livekit-stage><p data-livekit-placeholder>جاري الاتصال...</p></div><p class="livekit-status" data-livekit-status role="status"></p><div class="livekit-controls"><button type="button" data-livekit-mic>الميكروفون</button><button type="button" data-livekit-camera hidden>الكاميرا</button><button type="button" class="danger" data-livekit-leave>مغادرة</button></div></div>`;
    document.body.append(modal);
    modal.querySelector('[data-livekit-close]').addEventListener('click', close);
    modal.querySelector('[data-livekit-leave]').addEventListener('click', close);
    modal.querySelector('[data-livekit-mic]').addEventListener('click', async () => { if (!room) return; const enabled = !room.localParticipant.isMicrophoneEnabled; await room.localParticipant.setMicrophoneEnabled(enabled); modal.querySelector('[data-livekit-mic]').textContent = enabled ? 'إيقاف الميكروفون' : 'تشغيل الميكروفون'; });
    modal.querySelector('[data-livekit-camera]').addEventListener('click', async () => { if (!room) return; const enabled = !room.localParticipant.isCameraEnabled; await room.localParticipant.setCameraEnabled(enabled); modal.querySelector('[data-livekit-camera]').textContent = enabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'; });
    return modal;
  };
  const close = async () => { if (room) { room.disconnect(); room = null; } activeType = ''; activeRoomId = ''; if (modal) { modal.hidden = true; modal.querySelector('[data-livekit-stage]').replaceChildren(); } };
  const tokenRequest = async (type, roomId) => {
    if (!apiBase) throw new Error('livekit_endpoint_missing');
    const client = await window.IQZodiacSupabase.ready;
    const { data } = await client.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (!accessToken) throw new Error('auth_required');
    const response = await fetch(`${apiBase}/api/livekit/token?type=${encodeURIComponent(type)}&roomId=${encodeURIComponent(roomId)}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.code || 'livekit_token_failed');
    return payload;
  };
  const attachTrack = (track, publication) => { const stage = modal?.querySelector('[data-livekit-stage]'); if (!stage) return; const element = track.attach(); element.dataset.participant = publication?.participant?.identity || ''; element.className = track.kind === 'video' ? 'livekit-video' : 'livekit-audio'; stage.append(element); modal.querySelector('[data-livekit-placeholder]')?.remove(); };
  const open = async (type, roomId, title, joinAudio = false) => {
    makeModal(); modal.hidden = false; modal.querySelector('#livekit-modal-title').textContent = title || (type === 'live' ? 'البث المباشر' : 'الغرفة الصوتية'); setStatus('جاري الاتصال بالغرفة…');
    try {
      if (joinAudio) { const client = await window.IQZodiacSupabase.ready; const { error } = await client.rpc('iqzodiac_join_audio_room', { p_room_id: roomId }); if (error) throw error; }
      if (!window.LivekitClient) throw new Error('livekit_client_missing');
      const token = await tokenRequest(type, roomId); activeType = type; activeRoomId = roomId; canPublish = Boolean(token.canPublish);
      room = new window.LivekitClient.Room({ adaptiveStream: true, dynacast: true });
      room.on(window.LivekitClient.RoomEvent.TrackSubscribed, attachTrack);
      room.on(window.LivekitClient.RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
      room.on(window.LivekitClient.RoomEvent.Disconnected, () => { if (modal && !modal.hidden) setStatus('تم قطع الاتصال بالغرفة.', 'error'); });
      await room.connect(token.url, token.token);
      modal.querySelector('[data-livekit-camera]').hidden = !(type === 'live' && canPublish);
      if (canPublish) { await room.localParticipant.setMicrophoneEnabled(true); if (type === 'live') await room.localParticipant.setCameraEnabled(true); }
      setStatus(canPublish ? 'أنت متصل كمضيف/متحدث.' : 'أنت متصل كمشاهد.', 'ok');
    } catch (error) { setStatus(error.message === 'livekit_endpoint_missing' ? 'لم يتم ضبط رابط خدمة LiveKit بعد.' : error.message === 'room_access_denied' ? 'ليست لديك صلاحية دخول هذه الغرفة.' : 'تعذر الاتصال بالغرفة.', 'error'); }
  };
  window.IQZodiacLiveKit = { joinAudio: (roomId, title) => open('audio', roomId, title, true), joinLive: (roomId, title) => open('live', roomId, title, false) };
  document.addEventListener('click', (event) => { const audio = event.target.closest('[data-livekit-audio-room-id]'); const live = event.target.closest('[data-livekit-live-room-id]'); if (audio) void open('audio', audio.dataset.livekitAudioRoomId, audio.dataset.title, true); else if (live) void open('live', live.dataset.livekitLiveRoomId, live.dataset.title, false); });
})();
