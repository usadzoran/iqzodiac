(() => {
  'use strict';

  const liveList = document.querySelector('#rooms-list');
  const audioList = document.querySelector('#audio-rooms-list');
  const status = document.querySelector('#rooms-status');
  const audioStatus = document.querySelector('#audio-rooms-status');
  const categoryFilter = document.querySelector('#rooms-category-filter');
  const form = document.querySelector('#audio-room-form');
  const formStatus = document.querySelector('#audio-room-form-status');
  const refreshButton = document.querySelector('#rooms-refresh');
  const dialog = document.querySelector('#audio-room-dialog');
  const dialogTitle = document.querySelector('#audio-room-dialog-title');
  const stage = document.querySelector('#room-stage');
  const stageMessage = document.querySelector('#room-stage-message');
  const connectionLabel = document.querySelector('#room-connection-label');
  const participantCount = document.querySelector('#room-participant-count');
  const participantList = document.querySelector('#room-participants');
  const emptyRoomState = document.querySelector('#room-empty-state');
  const audioAttachments = document.querySelector('#room-audio-attachments');
  const helpText = document.querySelector('#room-help');
  const micButton = document.querySelector('#room-mic');
  const audioButton = document.querySelector('#room-audio');
  const retryButton = document.querySelector('#room-retry');
  const leaveButton = document.querySelector('#room-leave');
  const closeButton = document.querySelector('#room-close');

  const LIVEKIT_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2.24.1/dist/livekit-client.esm.mjs';
  const ROOM_SEAT_COUNT = 8;
  const state = {
    liveRooms: [],
    audioRooms: [],
    client: null,
    userId: null,
    livekitRoom: null,
    activeRecord: null,
    livekitModulePromise: null,
    publicConfigPromise: null,
    realtimeChannel: null,
    roomsLoading: false,
    reloadQueued: false,
    loadTimer: null,
    attempt: 0,
    remoteAudioEnabled: false,
    microphoneEnabled: false,
    activeParticipantName: '',
    participantAvatars: new Map(),
    participantAvatarLookups: new Set(),
    livekitModule: null,
  };

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const groupByCategory = (rows) => rows.reduce((groups, row) => {
    const category = row.category || 'General';
    (groups[category] ||= []).push(row);
    return groups;
  }, {});

  function getErrorCode(error) {
    return String(error?.code || error?.message || '').toLowerCase();
  }

  function errorCopy(error) {
    const code = getErrorCode(error);
    if (code.includes('backend_not_configured')) return 'خادم الغرف غير مربوط بهذا الموقع بعد. يلزم ضبط عنوان API المنشور.';
    if (code.includes('livekit_not_configured')) return 'خدمة الصوت غير مهيأة على الخادم. لم يبدأ اتصال الميكروفون.';
    if (code.includes('authentication_required') || code.includes('invalid_auth_session')) return 'انتهت جلسة الدخول. سجّل الدخول ثم حاول الانضمام مرة أخرى.';
    if (code.includes('room_not_open')) return 'أُغلقت هذه الغرفة أو لم تعد متاحة.';
    if (code.includes('invalid_room_id')) return 'تعذّر التحقق من الغرفة المطلوبة.';
    if (code.includes('room_service_unavailable')) return 'تعذّر التحقق من صلاحية الغرفة الآن. حاول مجددًا.';
    if (code.includes('origin_not_allowed')) return 'هذا الموقع غير مخوّل للوصول إلى خدمة الغرف.';
    if (code.includes('timeout') || code.includes('timed out') || code.includes('abort')) return 'انتهت مهلة الاتصال. تحقّق من الشبكة وحاول مرة أخرى.';
    if (code.includes('permission') || code.includes('notallowed')) return 'لم يُسمح باستخدام الميكروفون. راجع إذن الميكروفون في المتصفح.';
    if (code.includes('notfound') || code.includes('devices')) return 'لم يُعثر على ميكروفون متاح على هذا الجهاز.';
    if (code.includes('failed to fetch') || code.includes('network')) return 'تعذّر الوصول إلى خادم الغرفة. تحقق من الاتصال ثم أعد المحاولة.';
    if (code.includes('invalid_request_body') || code.includes('invalid_request')) return 'تعذّر فهم طلب الانضمام إلى الغرفة.';
    return 'تعذّر الاتصال بالغرفة الصوتية. أعد المحاولة أو غادر الغرفة.';
  }

  function setRoomState(next, message, detail = '') {
    stage.dataset.state = next;
    dialog.dataset.connection = next;
    stageMessage.textContent = message;
    connectionLabel.textContent = message;
    helpText.textContent = detail;
    retryButton.hidden = next !== 'error';
    micButton.disabled = next !== 'connected';
    audioButton.disabled = next !== 'connected';
    if (next === 'connected') {
      participantList.hidden = false;
      leaveButton.disabled = false;
    } else if (next === 'connecting' || next === 'error') {
      participantList.hidden = !(next === 'connecting' && state.livekitRoom);
      emptyRoomState.hidden = true;
      if (!state.livekitRoom) participantCount.textContent = '';
      micButton.setAttribute('aria-pressed', 'false');
      micButton.textContent = 'تشغيل الميكروفون';
      leaveButton.disabled = false;
    }
  }

  function updateCategoryOptions() {
    const categories = [...new Set([...state.liveRooms, ...state.audioRooms]
      .map((room) => String(room.category || 'General').trim() || 'General'))]
      .sort((a, b) => a.localeCompare(b));
    const selected = categoryFilter.value;
    categoryFilter.replaceChildren(new Option('كل الفئات', 'all'));
    categories.forEach((category) => categoryFilter.add(new Option(category, category)));
    categoryFilter.value = categories.includes(selected) ? selected : 'all';
  }

  function renderLive() {
    const selected = categoryFilter.value;
    const visible = selected === 'all' ? state.liveRooms : state.liveRooms.filter((room) => room.category === selected);
    liveList.replaceChildren();
    if (!visible.length) {
      liveList.innerHTML = '<p class="rooms-empty">لا توجد جلسات بث مباشر في هذه الفئة حاليًا.</p>';
      return;
    }
    Object.entries(groupByCategory(visible)).forEach(([category, items]) => {
      const section = document.createElement('section');
      section.className = 'rooms-category';
      section.innerHTML = `<div class="rooms-category-heading"><h2>${escapeHTML(category)}</h2><span>${items.length} بث مباشر</span></div><div class="rooms-grid">${items.map((room) => `<article class="room-card"><div><div class="room-state">${room.status === 'live' ? 'مباشر الآن' : 'مجدولة'}</div><h2>${escapeHTML(room.title)}</h2><p>${escapeHTML(room.description || 'لم يضف المضيف وصفًا.')}</p></div><div class="room-meta"><span>${Number.isFinite(room.viewer_count) ? `${room.viewer_count} مشاهد` : 'العدد غير متاح'}</span><span>${escapeHTML(dateLabel(room.started_at || room.created_at))}</span></div></article>`).join('')}</div>`;
      liveList.append(section);
    });
  }

  function renderAudio() {
    const selected = categoryFilter.value;
    const visible = selected === 'all' ? state.audioRooms : state.audioRooms.filter((room) => room.category === selected);
    audioList.replaceChildren();
    if (!visible.length) {
      audioList.innerHTML = '<p class="rooms-empty">لا توجد غرف صوتية مفتوحة في هذه الفئة حاليًا. يمكنك فتح غرفة جديدة.</p>';
      return;
    }
    Object.entries(groupByCategory(visible)).forEach(([category, items]) => {
      const section = document.createElement('section');
      section.className = 'rooms-category';
      section.innerHTML = `<div class="rooms-category-heading"><h2>${escapeHTML(category)}</h2><span>${items.length} غرفة مفتوحة</span></div><div class="rooms-grid">${items.map((room) => `<article class="room-card audio-room-card" data-audio-room-card="${escapeHTML(room.id)}"><div><div class="room-state">غرفة صوتية مفتوحة</div><h2>${escapeHTML(room.title)}</h2><p>${escapeHTML(room.description || 'غرفة صوتية مفتوحة للنقاش.')}</p><div class="room-meta"><span class="room-host">${escapeHTML(room.host_label || 'مضيف')}</span><span>${escapeHTML(dateLabel(room.created_at))}</span></div></div><button class="room-join-button" type="button" data-join-room="${escapeHTML(room.id)}">انضم إلى الغرفة</button></article>`).join('')}</div>`;
      audioList.append(section);
    });
  }

  async function loadDirectory() {
    if (state.roomsLoading) {
      state.reloadQueued = true;
      return;
    }
    state.roomsLoading = true;
    status.textContent = 'جارٍ تحميل الغرف…';
    audioList.setAttribute('aria-busy', 'true');
    liveList.setAttribute('aria-busy', 'true');
    refreshButton.disabled = true;
    try {
      const client = state.client || await window.IQZodiacSupabase.ready;
      state.client = client;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData?.session?.user;
      if (!user?.id) throw new Error('authentication_required');
      state.userId = user.id;

      const [liveResult, audioResult] = await Promise.all([
        client.from('vip_live_sessions').select('id,title,description,status,category,viewer_count,started_at,created_at').in('status', ['scheduled', 'live']).order('created_at', { ascending: false }).limit(100),
        client.from('audio_rooms').select('id,title,description,category,status,listener_count,host_user_id,created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(100),
      ]);
      if (audioResult.error) throw audioResult.error;

      const audio = audioResult.data || [];
      const hosts = [...new Set(audio.map((room) => room.host_user_id).filter(Boolean))];
      let profileMap = new Map();
      if (hosts.length) {
        const { data: profiles } = await client.from('profiles').select('user_id,handle,display_name').in('user_id', hosts).limit(100);
        profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile.handle || profile.display_name || 'مضيف']));
      }
      state.audioRooms = audio.map((room) => ({
        ...room,
        category: String(room.category || 'General').trim() || 'General',
        host_label: profileMap.get(room.host_user_id) || 'مضيف',
      }));
      state.liveRooms = liveResult.error ? [] : (liveResult.data || []).map((room) => ({
        ...room,
        category: String(room.category || 'General').trim() || 'General',
      }));

      updateCategoryOptions();
      renderAudio();
      renderLive();
      audioStatus.textContent = `${state.audioRooms.length} غرفة مفتوحة`;
      status.textContent = liveResult.error
        ? `الغرف الصوتية متاحة · ${state.audioRooms.length}`
        : `${state.audioRooms.length} غرفة · ${state.liveRooms.length} بث`;
      if (liveResult.error) {
        liveList.innerHTML = '<p class="rooms-empty">تعذّر تحميل جلسات البث الآن؛ ما زالت الغرف الصوتية متاحة.</p>';
      }
      subscribeToRoomChanges(client, user.id);
    } catch (error) {
      const message = getErrorCode(error).includes('authentication_required')
        ? 'يلزم تسجيل الدخول لعرض الغرف.'
        : 'تعذّر تحميل الغرف. تحقق من الاتصال ثم حدّث القائمة.';
      status.textContent = 'تعذّر الاتصال';
      audioStatus.textContent = 'تعذّر التحميل';
      audioList.innerHTML = `<p class="rooms-error">${message}</p>`;
      liveList.innerHTML = '<p class="rooms-error">تعذّر تحميل جلسات البث الآن.</p>';
    } finally {
      state.roomsLoading = false;
      audioList.setAttribute('aria-busy', 'false');
      liveList.setAttribute('aria-busy', 'false');
      refreshButton.disabled = false;
      if (state.reloadQueued) {
        state.reloadQueued = false;
        void loadDirectory();
      }
    }
  }

  function subscribeToRoomChanges(client, userId) {
    if (state.realtimeChannel) return;
    state.realtimeChannel = client.channel(`audio-rooms-directory:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_rooms' }, () => {
        clearTimeout(state.loadTimer);
        state.loadTimer = setTimeout(() => void loadDirectory(), 250);
      })
      .subscribe();
  }

  async function getPublicConfig() {
    if (!state.publicConfigPromise) {
      state.publicConfigPromise = (async () => {
        const response = await fetch(new URL('./public/supabase-public-config.json', document.baseURI), {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('backend_not_configured');
        return response.json();
      })().catch((error) => {
        state.publicConfigPromise = null;
        throw error;
      });
    }
    return state.publicConfigPromise;
  }

  async function getAudioToken(roomId) {
    const client = state.client || await window.IQZodiacSupabase.ready;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error('authentication_required');

    const config = await getPublicConfig();
    const configuredBase = String(config.apiBaseUrl || '').trim().replace(/\/+$/, '');
    const host = window.location.hostname.toLowerCase();
    const isGithubPages = host === 'github.io' || host.endsWith('.github.io');
    const apiBase = configuredBase || (isGithubPages ? '' : window.location.origin);
    if (!apiBase) throw new Error('backend_not_configured');
    let endpoint;
    try {
      endpoint = new URL('/api/audio-rooms/token', apiBase);
    } catch {
      throw new Error('backend_not_configured');
    }
    const isLocalEndpoint = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if (endpoint.protocol !== 'https:' && !isLocalEndpoint) throw new Error('backend_not_configured');
    if (endpoint.username || endpoint.password) throw new Error('backend_not_configured');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ roomId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.code || 'audio_room_service_unavailable');
    if (!result.token || !/^wss:\/\//i.test(String(result.serverUrl || ''))) throw new Error('livekit_not_configured');
    return result;
  }

  async function loadLiveKitClient() {
    if (!state.livekitModulePromise) {
      state.livekitModulePromise = import(LIVEKIT_CLIENT_URL).catch((error) => {
        state.livekitModulePromise = null;
        throw error;
      });
    }
    state.livekitModule = await state.livekitModulePromise;
    return state.livekitModule;
  }

  function setMicrophoneControl(enabled) {
    state.microphoneEnabled = Boolean(enabled);
    micButton.setAttribute('aria-pressed', String(state.microphoneEnabled));
    micButton.textContent = state.microphoneEnabled ? 'إيقاف الميكروفون' : 'تشغيل الميكروفون';
  }

  function participantIdentity(participant, local = false) {
    return String(participant?.identity || (local ? state.userId : '') || '');
  }

  function loadParticipantAvatars(participants, room, attempt) {
    const userIds = [...new Set(participants.map((item) => participantIdentity(item.participant, item.local)).filter(Boolean))]
      .filter((userId) => !state.participantAvatarLookups.has(userId));
    if (!userIds.length) return;
    userIds.forEach((userId) => state.participantAvatarLookups.add(userId));
    (async () => {
      try {
        const client = state.client || await window.IQZodiacSupabase.ready;
        state.client = client;
        // RLS only returns this user's private avatar and other members' explicitly public avatars.
        const { data, error } = await client.from('profile_media')
          .select('user_id,storage_path,created_at')
          .in('user_id', userIds)
          .eq('media_type', 'avatar')
          .order('created_at', { ascending: false })
          .limit(userIds.length);
        if (error) throw error;
        const latest = new Map();
        (data || []).forEach((item) => { if (item.storage_path && !latest.has(item.user_id)) latest.set(item.user_id, item.storage_path); });
        const entries = [...latest.entries()];
        if (entries.length) {
          const { data: signed, error: signError } = await client.storage.from('iqzodiac-media')
            .createSignedUrls(entries.map(([, path]) => path), 900);
          if (signError) throw signError;
          entries.forEach(([userId], index) => state.participantAvatars.set(userId, signed?.[index]?.signedUrl || ''));
        }
      } catch {
        // Name initials remain available when avatars are private or storage is unavailable.
      } finally {
        userIds.forEach((userId) => state.participantAvatarLookups.add(userId));
        if (state.livekitRoom === room && state.attempt === attempt && state.activeRecord) {
          renderParticipants(room, state.activeRecord.host_user_id === state.userId, state.activeRecord, attempt, true);
        }
      }
    })();
  }

  function renderParticipants(room, isHost, record = state.activeRecord, attempt = state.attempt, skipAvatarLookup = false) {
    if (!room || !record) return;
    const all = [
      { participant: room.localParticipant, local: true },
      ...[...room.remoteParticipants.values()].map((participant) => ({ participant, local: false })),
    ];
    all.sort((a, b) => {
      const aHost = participantIdentity(a.participant, a.local) === record.host_user_id;
      const bHost = participantIdentity(b.participant, b.local) === record.host_user_id;
      return Number(bHost) - Number(aHost);
    });
    if (!skipAvatarLookup) loadParticipantAvatars(all, room, attempt);

    const fragment = document.createDocumentFragment();
    all.forEach(({ participant, local }) => {
      const identity = participantIdentity(participant, local);
      const host = identity === record.host_user_id;
      const name = String(participant.name || (local ? state.activeParticipantName : '') || (host ? record.host_label : '') || (local ? 'أنت' : 'عضو')).trim();
      const micPublication = participant.getTrackPublication?.(state.livekitModule?.Track.Source.Microphone || 'microphone');
      const micOn = Boolean(participant.isMicrophoneEnabled && micPublication && !micPublication.isMuted);
      const card = document.createElement('div');
      card.className = 'room-participant room-seat';
      card.dataset.speaking = String(Boolean(participant.isSpeaking));
      card.dataset.host = String(host);
      card.dataset.mic = micOn ? 'on' : 'off';

      const avatar = document.createElement('span');
      avatar.className = 'room-participant-avatar';
      const avatarUrl = state.participantAvatars.get(identity);
      if (avatarUrl) {
        const image = document.createElement('img');
        image.src = avatarUrl;
        image.alt = '';
        image.loading = 'lazy';
        avatar.append(image);
      } else {
        avatar.textContent = name.slice(0, 1) || 'م';
      }

      const mic = document.createElement('span');
      mic.className = 'room-seat-mic';
      mic.setAttribute('aria-label', micOn ? 'الميكروفون مفتوح' : 'الميكروفون مغلق');
      mic.textContent = micOn ? '🎙' : '🔇';

      const label = document.createElement('span');
      label.className = 'room-participant-label';
      label.textContent = local ? `أنت · ${name}` : name;
      const details = document.createElement('span');
      details.className = 'room-seat-role';
      details.textContent = host ? 'HOST' : (participant.isSpeaking ? 'يتحدث الآن' : 'متصل');
      card.append(avatar, mic, label, details);
      fragment.append(card);
    });

    const occupied = all.length;
    const seatCount = Math.max(ROOM_SEAT_COUNT, occupied);
    for (let index = occupied; index < seatCount; index += 1) {
      const seat = document.createElement('div');
      seat.className = 'room-participant room-seat room-seat-empty';
      seat.setAttribute('aria-label', 'مقعد فارغ، في انتظار الانضمام');
      const avatar = document.createElement('span');
      avatar.className = 'room-participant-avatar';
      avatar.textContent = '＋';
      const label = document.createElement('span');
      label.className = 'room-participant-label';
      label.textContent = 'في انتظار الانضمام';
      const details = document.createElement('span');
      details.className = 'room-seat-role';
      details.textContent = `مقعد ${index + 1}`;
      seat.append(avatar, label, details);
      fragment.append(seat);
    }

    participantList.replaceChildren(fragment);
    participantList.hidden = false;
    participantCount.textContent = `${occupied} مشارك`;
    emptyRoomState.hidden = !(room.state === 'connected' && all.length <= 1);
  }

  function attachRemoteAudio(track, sdk) {
    if (!track || track.kind !== sdk.Track.Kind.Audio) return;
    for (const element of track.attach()) {
      element.autoplay = true;
      element.playsInline = true;
      element.muted = !state.remoteAudioEnabled;
      audioAttachments.append(element);
      const playResult = element.play?.();
      if (playResult?.catch) playResult.catch(() => {
        helpText.textContent = 'إذا لم تسمع المشاركين، اضغط «تشغيل صوت الغرفة» للسماح بالصوت على هاتفك.';
      });
    }
  }

  function detachRemoteAudio(track) {
    if (!track) return;
    for (const element of track.detach()) element.remove();
  }

  async function connectToRoom(record) {
    if (!record || !dialog.open) return;
    const attempt = ++state.attempt;
    state.activeRecord = record;
    state.remoteAudioEnabled = false;
    state.microphoneEnabled = false;
    audioAttachments.replaceChildren();
    participantList.replaceChildren();
    setMicrophoneControl(false);
    audioButton.textContent = 'تشغيل صوت الغرفة';
    audioButton.dataset.enabled = 'false';
    dialogTitle.textContent = record.title || 'غرفة صوتية';
    setRoomState('connecting', 'جارٍ الاتصال بالغرفة الصوتية…', 'لن يعمل الميكروفون قبل الضغط على زر تشغيله.');

    let room;
    try {
      const payload = await getAudioToken(record.id);
      if (attempt !== state.attempt || !dialog.open) return;
      state.activeParticipantName = String(payload.participant?.name || '');
      const sdk = await loadLiveKitClient();
      if (attempt !== state.attempt || !dialog.open) return;
      room = new sdk.Room({ adaptiveStream: true, dynacast: true });
      state.livekitRoom = room;
      const isHost = Boolean(payload.participant?.isHost || record.host_user_id === state.userId);

      room.on(sdk.RoomEvent.TrackSubscribed, (track) => attachRemoteAudio(track, sdk));
      room.on(sdk.RoomEvent.TrackUnsubscribed, (track) => detachRemoteAudio(track));
      const refreshSeats = () => renderParticipants(room, isHost, record, attempt);
      room.on(sdk.RoomEvent.ParticipantConnected, refreshSeats);
      room.on(sdk.RoomEvent.ParticipantDisconnected, refreshSeats);
      room.on(sdk.RoomEvent.ActiveSpeakersChanged, refreshSeats);
      room.on(sdk.RoomEvent.TrackMuted, refreshSeats);
      room.on(sdk.RoomEvent.TrackUnmuted, refreshSeats);
      room.on(sdk.RoomEvent.LocalTrackPublished, refreshSeats);
      room.on(sdk.RoomEvent.LocalTrackUnpublished, refreshSeats);
      room.on(sdk.RoomEvent.Disconnected, () => {
        if (state.livekitRoom !== room || attempt !== state.attempt || !state.activeRecord) return;
        setMicrophoneControl(false);
        setRoomState('error', 'انقطع اتصال الغرفة.', 'تحقّق من الشبكة ثم أعد المحاولة، أو غادر الغرفة.');
      });

      // Render the local host seat before waiting for any remote audio track.
      renderParticipants(room, isHost, record, attempt);
      const connectPromise = room.connect(payload.serverUrl, payload.token);
      let timeoutId;
      try {
        await Promise.race([
          connectPromise,
          new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('connection_timeout')), 15000); }),
        ]);
      } finally {
        clearTimeout(timeoutId);
      }
      if (attempt !== state.attempt || !dialog.open) {
        await room.disconnect();
        return;
      }
      renderParticipants(room, isHost, record, attempt);
      setRoomState('connected', 'تم الاتصال بالغرفة.', 'الميكروفون مغلق افتراضيًا. فعّله فقط عندما ترغب في التحدث.');
      renderParticipants(room, isHost, record, attempt);
      audioButton.disabled = false;
      micButton.disabled = false;
    } catch (error) {
      if (room && state.livekitRoom === room) {
        state.livekitRoom = null;
        try { await room.disconnect(); } catch { /* The client may not have completed joining. */ }
      }
      if (attempt !== state.attempt || !dialog.open) return;
      setMicrophoneControl(false);
      const message = errorCopy(error);
      setRoomState('error', message, 'لم يتم تفعيل الميكروفون. يمكنك المحاولة مرة أخرى أو مغادرة الغرفة.');
    }
  }

  function openRoom(record) {
    if (!record) return;
    state.activeRecord = record;
    dialogTitle.textContent = record.title || 'غرفة صوتية';
    if (!dialog.open) dialog.showModal();
    void connectToRoom(record);
  }

  async function retryRoom() {
    const record = state.activeRecord;
    if (!record) return;
    const current = state.livekitRoom;
    state.livekitRoom = null;
    if (current) {
      try { await current.disconnect(); } catch { /* Continue with a fresh join attempt. */ }
    }
    if (state.activeRecord === record && dialog.open) void connectToRoom(record);
  }

  async function leaveRoom() {
    const record = state.activeRecord;
    state.attempt += 1;
    state.activeRecord = null;
    const current = state.livekitRoom;
    state.livekitRoom = null;
    state.remoteAudioEnabled = false;
    state.activeParticipantName = '';
    setMicrophoneControl(false);
    micButton.disabled = true;
    audioButton.disabled = true;
    if (current) {
      try { await current.disconnect(); } catch { /* Always allow the user to leave the dialog. */ }
    }
    audioAttachments.replaceChildren();
    participantList.replaceChildren();
    let closeFailed = false;
    if (record && state.userId && record.host_user_id === state.userId) {
      try {
        const client = state.client || await window.IQZodiacSupabase.ready;
        const { data, error } = await client.from('audio_rooms')
          .update({ status: 'closed' })
          .eq('id', record.id)
          .eq('host_user_id', state.userId)
          .select('id')
          .maybeSingle();
        closeFailed = Boolean(error || !data);
      } catch { closeFailed = true; }
    }
    if (dialog.open) dialog.close();
    if (formStatus) formStatus.textContent = closeFailed
      ? 'غادرت الغرفة، لكن تعذّر إغلاقها على الخادم. حدّث القائمة وحاول إغلاقها مجددًا.'
      : '';
    void loadDirectory();
  }

  async function toggleMicrophone() {
    const room = state.livekitRoom;
    if (!room || !state.activeRecord) return;
    micButton.disabled = true;
    try {
      const enabled = !state.microphoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setMicrophoneControl(enabled);
      renderParticipants(room, state.activeRecord.host_user_id === state.userId);
    } catch (error) {
      setMicrophoneControl(false);
      helpText.textContent = errorCopy(error);
    } finally {
      micButton.disabled = false;
    }
  }

  async function toggleRoomAudio() {
    const room = state.livekitRoom;
    if (!room) return;
    audioButton.disabled = true;
    try {
      if (!state.remoteAudioEnabled) await room.startAudio();
      state.remoteAudioEnabled = !state.remoteAudioEnabled;
      audioAttachments.querySelectorAll('audio').forEach((element) => { element.muted = !state.remoteAudioEnabled; });
      audioButton.dataset.enabled = String(state.remoteAudioEnabled);
      audioButton.textContent = state.remoteAudioEnabled ? 'كتم صوت الغرفة' : 'تشغيل صوت الغرفة';
      helpText.textContent = state.remoteAudioEnabled ? 'الصوت الوارد مفعّل.' : 'الصوت الوارد مكتوم على هذا الجهاز.';
    } catch {
      helpText.textContent = 'لم يبدأ الصوت. اضغط مرة أخرى واسمح بتشغيل الصوت في المتصفح.';
    } finally {
      audioButton.disabled = false;
    }
  }

  categoryFilter.addEventListener('change', () => { renderLive(); renderAudio(); });
  refreshButton.addEventListener('click', () => void loadDirectory());
  audioList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-join-room]');
    if (!button) return;
    const record = state.audioRooms.find((room) => room.id === button.dataset.joinRoom);
    openRoom(record);
  });
  closeButton.addEventListener('click', () => void leaveRoom());
  leaveButton.addEventListener('click', () => void leaveRoom());
  retryButton.addEventListener('click', () => void retryRoom());
  micButton.addEventListener('click', () => void toggleMicrophone());
  audioButton.addEventListener('click', () => void toggleRoomAudio());
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); void leaveRoom(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) void leaveRoom(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    formStatus.textContent = 'جارٍ إنشاء الغرفة…';
    const title = document.querySelector('#audio-room-title').value.trim();
    const description = document.querySelector('#audio-room-description').value.trim();
    const category = document.querySelector('#audio-room-category').value;
    try {
      const client = state.client || await window.IQZodiacSupabase.ready;
      state.client = client;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData?.session?.user;
      if (!user?.id) throw new Error('authentication_required');
      state.userId = user.id;
      const { data: roomId, error } = await client.rpc('iqzodiac_create_audio_room', {
        p_title: title,
        p_description: description,
        p_category: category,
      });
      if (error) throw error;
      if (!roomId) throw new Error('room_create_failed');
      const record = {
        id: roomId,
        host_user_id: user.id,
        title,
        description,
        category,
        status: 'open',
        created_at: new Date().toISOString(),
        host_label: 'أنت · المضيف',
      };
      state.audioRooms = [record, ...state.audioRooms.filter((room) => room.id !== roomId)];
      updateCategoryOptions();
      renderAudio();
      form.reset();
      formStatus.textContent = 'تم إنشاء الغرفة. جارٍ بدء الاتصال…';
      openRoom(record);
      void loadDirectory();
    } catch (error) {
      formStatus.textContent = errorCopy(error);
    } finally {
      submitButton.disabled = false;
    }
  });

  void loadDirectory();
})();
