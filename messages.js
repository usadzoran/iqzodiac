(() => {
  'use strict';
  const database = () => window.IQZodiacSupabase?.ready;
  const contactList = document.querySelector('#contact-list');
  const messageList = document.querySelector('#message-list');
  const messageInput = document.querySelector('#message-input');
  const callModal = document.querySelector('#call-modal');
  const callButton = document.querySelector('#call-button');
  const callStatus = document.querySelector('#call-status');
  const callTimer = document.querySelector('#call-timer');
  const selectionToolbar = document.querySelector('#message-selection-toolbar');
  const expirySelect = document.querySelector('#disappearing-select');
  const t = (en, ar) => window.IQZodiacLanguage?.t(en, ar) || en;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeParams = new URLSearchParams(window.location.search);
  const targetMessageId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeParams.get('message') || '') ? routeParams.get('message') : '';
  let client; let user; let contacts = []; let activeId = routeParams.get('match'); let activeConversation = null; let timerInterval; let elapsedSeconds = 0;
  let realtimeChannel = null; let renderTimer = null; let expiryRenderTimer = null; let renderRevision = 0; let longPressTimer = null; let suppressNextClick = false; let selectionMode = false; let selectedMessageIds = new Set(); let visibleMessageIds = [];
  const expiryValues = ['off', '1h', '24h', '7d'];
  const toast = (message) => { const node = document.querySelector('.toast-message'); if (node) { node.textContent = message; document.querySelector('.toast')?.classList.add('is-visible'); } };
  const expiryLabel = (value) => ({ off: t('Off', 'إيقاف'), '1h': t('1 hour', 'ساعة واحدة'), '24h': t('24 hours', '24 ساعة'), '7d': t('7 days', '7 أيام') }[value] || t('Off', 'إيقاف'));
  const localizeControls = () => {
    document.querySelector('.disappearing-label').textContent = t('Disappearing messages', 'الرسائل ذاتية الاختفاء');
    const options = [['off', 'Off', 'إيقاف'], ['1h', '1 hour', 'ساعة واحدة'], ['24h', '24 hours', '24 ساعة'], ['7d', '7 days', '7 أيام']];
    options.forEach(([value, en, ar]) => { const option = expirySelect.querySelector(`option[value=\"${value}\"]`); if (option) option.textContent = t(en, ar); });
    document.querySelector('#select-all-messages').textContent = t('Select all', 'تحديد الكل');
    document.querySelector('#clear-message-selection').textContent = t('Cancel', 'إلغاء التحديد');
    document.querySelector('#delete-for-me-selected').textContent = t('Delete for me', 'حذف لديّ');
    document.querySelector('#delete-everyone-selected').textContent = t('Delete for everyone', 'حذف لدى الجميع');
  };
  const renderContacts = (filter = '') => {
    contactList.replaceChildren();
    const matched = contacts.filter((person) => `${person.name} ${person.handle}`.toLowerCase().includes(filter.toLowerCase()));
    matched.forEach((person) => { const button = document.createElement('button'); button.type = 'button'; button.className = `contact-item${person.id === activeId ? ' is-active' : ''}`; button.innerHTML = `<span class="contact-avatar">${escapeHTML((person.name || 'M').slice(0, 1))}</span><span class="contact-copy"><strong>${escapeHTML(person.name)}</strong><small>${escapeHTML(person.preview || t('Start a private conversation', 'ابدأ محادثة خاصة'))}</small></span><span class="contact-time">${escapeHTML(person.time || '')}</span>`; button.addEventListener('click', () => { activeId = person.id; void loadConversation(); }); contactList.append(button); });
    if (!matched.length) contactList.innerHTML = `<p class="sidebar-note">${escapeHTML(t('No real conversations are available yet.', 'لا توجد محادثات حقيقية بعد.'))}</p>`;
  };
  const updateSelectionToolbar = () => {
    selectionToolbar.hidden = !selectionMode;
    document.querySelector('#selected-message-count').textContent = t(`${selectedMessageIds.size} selected`, `تم تحديد ${selectedMessageIds.size}`);
    const ownIds = visibleMessageIds.filter((message) => selectedMessageIds.has(message.id) && message.sender_id === user?.id).map((message) => message.id);
    const deleteEveryone = document.querySelector('#delete-everyone-selected');
    deleteEveryone.hidden = ownIds.length === 0;
    deleteEveryone.dataset.ownIds = JSON.stringify(ownIds);
    document.querySelector('#select-all-messages').disabled = !visibleMessageIds.length || selectedMessageIds.size === visibleMessageIds.length;
  };
  const setSelectionMode = (enabled) => {
    selectionMode = enabled;
    if (!enabled) selectedMessageIds.clear();
    messageList.classList.toggle('is-selecting', enabled);
    updateSelectionToolbar();
    renderMessageBubbles();
  };
  const toggleMessageSelection = (messageId) => {
    if (selectedMessageIds.has(messageId)) selectedMessageIds.delete(messageId); else selectedMessageIds.add(messageId);
    if (!selectedMessageIds.size) selectionMode = false;
    messageList.classList.toggle('is-selecting', selectionMode);
    updateSelectionToolbar();
    renderMessageBubbles();
  };
  const systemEventText = (message) => {
    if (message.body === 'off') return t('Disappearing messages were turned off.', 'تم إيقاف الرسائل ذاتية الاختفاء.');
    return t(`Disappearing messages set to ${expiryLabel(message.body)}.`, `تم ضبط الرسائل ذاتية الاختفاء لمدة ${expiryLabel(message.body)}.`);
  };
  const renderMessageBubbles = () => {
    messageList.querySelectorAll('.message-bubble').forEach((bubble) => {
      const id = bubble.dataset.messageId;
      const selected = selectedMessageIds.has(id);
      bubble.classList.toggle('is-selected', selected);
      const check = bubble.querySelector('.message-select-check');
      if (check) { check.hidden = !selectionMode; check.setAttribute('aria-pressed', String(selected)); }
    });
  };
  const appendMessage = (fragment, message) => {
    if (message.message_kind === 'system') {
      const notice = document.createElement('div'); notice.className = 'message-system-notice'; notice.textContent = systemEventText(message); fragment.append(notice); return;
    }
    const bubble = document.createElement('article');
    bubble.className = `message-bubble${message.sender_id === user.id ? ' is-mine' : ''}`;
    bubble.id = `message-${message.id}`; bubble.dataset.messageId = message.id;
    const check = document.createElement('button'); check.type = 'button'; check.className = 'message-select-check'; check.hidden = !selectionMode; check.setAttribute('aria-label', t('Select message', 'تحديد الرسالة')); check.setAttribute('aria-pressed', String(selectedMessageIds.has(message.id)));
    check.addEventListener('click', (event) => { event.stopPropagation(); if (!selectionMode) setSelectionMode(true); toggleMessageSelection(message.id); });
    const body = document.createElement('span'); body.className = 'message-body'; body.textContent = message.body; body.dir = 'auto';
    const meta = document.createElement('small'); meta.className = 'message-meta';
    meta.textContent = new Intl.DateTimeFormat(window.IQZodiacLanguage?.locale || undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at));
    bubble.append(check, body, meta);
    bubble.addEventListener('contextmenu', (event) => { event.preventDefault(); if (!selectionMode) setSelectionMode(true); if (!selectedMessageIds.has(message.id)) toggleMessageSelection(message.id); });
    bubble.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'touch') return; window.clearTimeout(longPressTimer); longPressTimer = window.setTimeout(() => { suppressNextClick = true; if (!selectionMode) setSelectionMode(true); if (!selectedMessageIds.has(message.id)) toggleMessageSelection(message.id); }, 520); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => bubble.addEventListener(name, () => window.clearTimeout(longPressTimer)));
    bubble.addEventListener('click', () => { if (suppressNextClick) { suppressNextClick = false; return; } if (selectionMode) toggleMessageSelection(message.id); });
    fragment.append(bubble);
  };
  const renderMessages = async () => {
    const revision = ++renderRevision;
    const renderingConversation = activeConversation;
    const renderingMember = activeId;
    const person = contacts.find((item) => item.id === renderingMember);
    if (!person || !renderingConversation) { messageList.innerHTML = `<div class="message-day-divider">${escapeHTML(t('PRIVATE CONVERSATION', 'محادثة خاصة'))}</div><p class="sidebar-note">${escapeHTML(t('Open a real match to start a private conversation.', 'افتح تطابقًا حقيقيًا لبدء محادثة خاصة.'))}</p>`; return; }
    document.querySelector('#active-name').textContent = person.name; document.querySelector('#active-handle').textContent = `${person.handle} · ${t('Private member conversation', 'محادثة خاصة')}`; document.querySelector('#call-title').textContent = person.name;
    const [{ data: rows, error }, { data: hiddenRows, error: hiddenError }, { data: settings, error: settingsError }] = await Promise.all([
      client.from('messages').select('id,sender_id,body,created_at,expires_at,message_kind').eq('conversation_id', renderingConversation).order('created_at', { ascending: true }).limit(200),
      client.from('message_user_hides').select('message_id').eq('conversation_id', renderingConversation).eq('user_id', user.id),
      client.from('conversation_message_settings').select('expiry_duration').eq('conversation_id', renderingConversation).maybeSingle(),
    ]);
    if (revision !== renderRevision || activeConversation !== renderingConversation || activeId !== renderingMember) return;
    if (error || hiddenError || settingsError) { toast(t('Messages could not be loaded. Apply the messaging database migration first.', 'تعذر تحميل الرسائل. يجب تطبيق تحديث قاعدة بيانات الرسائل أولًا.')); return; }
    const hiddenIds = new Set((hiddenRows || []).map((item) => item.message_id));
    let messages = (rows || []).filter((message) => !hiddenIds.has(message.id) && (!message.expires_at || new Date(message.expires_at).getTime() > Date.now()));
    if (targetMessageId && !messages.some((message) => message.id === targetMessageId)) {
      const { data: targetMessage } = await client.from('messages').select('id,sender_id,body,created_at,expires_at,message_kind').eq('id', targetMessageId).eq('conversation_id', renderingConversation).maybeSingle();
      if (revision !== renderRevision || activeConversation !== renderingConversation || activeId !== renderingMember) return;
      if (targetMessage && !hiddenIds.has(targetMessage.id) && (!targetMessage.expires_at || new Date(targetMessage.expires_at).getTime() > Date.now())) messages = [...messages, targetMessage].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    visibleMessageIds = messages.filter((message) => message.message_kind === 'user');
    if (selectedMessageIds.size) {
      const currentIds = new Set(visibleMessageIds.map((message) => message.id));
      selectedMessageIds = new Set([...selectedMessageIds].filter((id) => currentIds.has(id)));
    }
    window.clearTimeout(expiryRenderTimer);
    const nextExpiry = messages.reduce((nearest, message) => { const expiry = message.expires_at ? new Date(message.expires_at).getTime() : Infinity; return expiry < nearest ? expiry : nearest; }, Infinity);
    if (Number.isFinite(nextExpiry)) expiryRenderTimer = window.setTimeout(scheduleRenderMessages, Math.max(0, nextExpiry - Date.now() + 25));
    expirySelect.value = expiryValues.includes(settings?.expiry_duration) ? settings.expiry_duration : 'off';
    const fragment = document.createDocumentFragment(); const divider = document.createElement('div'); divider.className = 'message-day-divider'; divider.textContent = t('PRIVATE CONVERSATION', 'محادثة خاصة'); fragment.append(divider);
    messages.forEach((message) => appendMessage(fragment, message));
    messageList.replaceChildren(fragment); messageList.classList.toggle('is-selecting', selectionMode); updateSelectionToolbar();
    messageList.scrollTop = messageList.scrollHeight;
    if (targetMessageId) { const target = document.getElementById(`message-${targetMessageId}`); if (target) { target.classList.add('notification-target-highlight'); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    renderContacts(document.querySelector('#contact-search').value); await renderRevealState();
  };
  const scheduleRenderMessages = () => { window.clearTimeout(renderTimer); renderTimer = window.setTimeout(() => { void renderMessages(); }, 120); };
  const subscribeConversation = async () => {
    if (realtimeChannel) { await client.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (!activeConversation) return;
    realtimeChannel = client.channel(`messages:${activeConversation}:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation}` }, scheduleRenderMessages)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_user_hides', filter: `user_id=eq.${user.id}` }, (payload) => { if (payload.new?.conversation_id === activeConversation) scheduleRenderMessages(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_message_settings', filter: `conversation_id=eq.${activeConversation}` }, scheduleRenderMessages)
      .subscribe();
  };
  const renderRevealState = async () => {
    const status = document.querySelector('#face-consent-status'); const request = document.querySelector('#request-reveal'); const partnerButton = document.querySelector('#partner-consent');
    if (!activeConversation) { status.textContent = t('A reveal is available only inside a real conversation.', 'لا يمكن طلب الكشف إلا داخل محادثة حقيقية.'); request.disabled = true; partnerButton.hidden = true; return; }
    partnerButton.hidden = true;
    const renderingConversation = activeConversation;
    const { data } = await client.from('face_reveal_consents').select('user_id').eq('conversation_id', renderingConversation);
    if (activeConversation !== renderingConversation) return;
    const mine = (data || []).some((row) => row.user_id === user.id); const both = (data || []).length >= 2;
    status.textContent = both ? t('Both people agreed. The face may now be revealed inside this private match.', 'وافق الطرفان، ويمكن الآن كشف الوجه ضمن هذا التطابق الخاص.') : mine ? t('Your request is recorded. The face stays hidden until the other person agrees too.', 'تم تسجيل طلبك. سيبقى الوجه مخفيًا حتى يوافق الطرف الآخر.') : t('A reveal requires two explicit yeses.', 'يتطلب الكشف موافقة صريحة من الطرفين.');
    request.disabled = both || mine; request.textContent = both ? t('Face reveal approved', 'تمت الموافقة على الكشف') : mine ? t('Request sent', 'تم إرسال الطلب') : t('Request reveal', 'طلب الكشف');
  };
  const loadConversation = async () => {
    renderRevision += 1;
    const requestedMemberId = activeId;
    selectedMessageIds.clear(); selectionMode = false; updateSelectionToolbar();
    window.clearTimeout(expiryRenderTimer);
    activeConversation = null;
    if (realtimeChannel) { await client.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (!activeId) { renderContacts(); await renderMessages(); return; }
    const { data: conversationId, error } = await client.rpc('get_or_create_conversation', { p_other_user: requestedMemberId });
    if (activeId !== requestedMemberId) return;
    if (error) { toast(t('This member cannot receive messages yet.', 'لا يمكن لهذا العضو استقبال الرسائل حاليًا.')); await renderMessages(); return; }
    activeConversation = conversationId; await subscribeConversation(); await renderMessages();
  };
  document.querySelector('#contact-search').addEventListener('input', (event) => renderContacts(event.target.value));
  messageInput.addEventListener('input', () => { document.querySelector('#message-counter').textContent = `${messageInput.value.length} / 600`; });
  document.querySelector('#message-form').addEventListener('submit', async (event) => { event.preventDefault(); const body = messageInput.value.trim(); if (!body || !activeConversation) return; const { error } = await client.from('messages').insert({ conversation_id: activeConversation, sender_id: user.id, body }); if (error) { toast(t('Message could not be sent.', 'تعذر إرسال الرسالة.')); return; } messageInput.value = ''; document.querySelector('#message-counter').textContent = '0 / 600'; await renderMessages(); messageInput.focus(); });
  expirySelect.addEventListener('change', async () => {
    if (!activeConversation) return;
    expirySelect.disabled = true;
    const { error } = await client.rpc('iqzodiac_set_message_expiry', { p_conversation_id: activeConversation, p_duration: expirySelect.value });
    expirySelect.disabled = false;
    if (error) { toast(t('The disappearing-message setting could not be saved.', 'تعذر حفظ إعداد الرسائل ذاتية الاختفاء.')); await renderMessages(); return; }
    toast(t('Disappearing-message setting updated.', 'تم تحديث إعداد الرسائل ذاتية الاختفاء.'));
    await renderMessages();
  });
  document.querySelector('#select-all-messages').addEventListener('click', () => { selectionMode = true; selectedMessageIds = new Set(visibleMessageIds.map((message) => message.id)); messageList.classList.add('is-selecting'); updateSelectionToolbar(); renderMessageBubbles(); });
  document.querySelector('#clear-message-selection').addEventListener('click', () => setSelectionMode(false));
  document.querySelector('#delete-for-me-selected').addEventListener('click', async () => {
    if (!selectedMessageIds.size || !activeConversation) return;
    const ids = [...selectedMessageIds];
    const { data, error } = await client.rpc('iqzodiac_hide_messages_for_me', { p_conversation_id: activeConversation, p_message_ids: ids });
    if (error || data === null) { toast(t('Messages could not be deleted for you.', 'تعذر حذف الرسائل من سجلّك.')); return; }
    selectedMessageIds.clear(); selectionMode = false; toast(t('Messages deleted for you.', 'تم حذف الرسائل من سجلّك.')); await renderMessages();
  });
  document.querySelector('#delete-everyone-selected').addEventListener('click', async (event) => {
    const ids = JSON.parse(event.currentTarget.dataset.ownIds || '[]');
    if (!ids.length || !activeConversation) return;
    if (!window.confirm(t(`Delete ${ids.length} of your selected message(s) for everyone? This cannot be undone.`, `هل تريد حذف ${ids.length} من رسائلك المحددة لدى الجميع؟ لا يمكن التراجع عن ذلك.`))) return;
    const { data, error } = await client.rpc('iqzodiac_delete_messages_for_everyone', { p_conversation_id: activeConversation, p_message_ids: ids });
    if (error || Number(data) !== ids.length) { toast(t('Some messages could not be deleted for everyone.', 'تعذر حذف بعض الرسائل لدى الجميع.')); return; }
    ids.forEach((id) => selectedMessageIds.delete(id));
    if (!selectedMessageIds.size) selectionMode = false;
    toast(t('Messages deleted for everyone.', 'تم حذف الرسائل لدى الجميع.')); await renderMessages();
  });
  document.querySelector('#request-reveal')?.addEventListener('click', async () => { if (!activeConversation) return; const { error } = await client.from('face_reveal_consents').upsert({ conversation_id: activeConversation, user_id: user.id }); if (error) toast(t('Consent could not be saved.', 'تعذر حفظ الموافقة.')); else await renderRevealState(); });
  const stopCall = () => { clearInterval(timerInterval); timerInterval = null; elapsedSeconds = 0; callModal.hidden = true; };
  callButton.addEventListener('click', () => { if (!activeConversation) { toast(t('Open a real conversation before starting a call.', 'افتح محادثة حقيقية قبل بدء الاتصال.')); return; } callStatus.textContent = t('Audio calling is not connected yet.', 'الاتصال الصوتي غير متصل بعد.'); callTimer.textContent = '00:00'; callModal.hidden = false; timerInterval = setInterval(() => { elapsedSeconds += 1; callTimer.textContent = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`; }, 1000); });
  document.querySelector('#close-call').addEventListener('click', stopCall); document.querySelector('#end-call').addEventListener('click', stopCall); callModal.addEventListener('click', (event) => { if (event.target === callModal) stopCall(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && selectionMode) setSelectionMode(false); });
  document.addEventListener('iqzodiac:languagechange', () => { localizeControls(); if (activeConversation) void renderMessages(); });
  localizeControls();
  (async () => {
    try {
      client = await database();
      const { data: session } = await client.auth.getSession(); user = session.session?.user;
      if (!user) return;
      const { data, error } = await client.rpc('list_my_conversations'); if (error) throw error;
      contacts = (data || []).map((row) => ({ id: row.other_user_id, name: row.display_name || 'Orbit Member', handle: row.handle || '@member', preview: row.last_message || t('Start a private conversation', 'ابدأ محادثة خاصة'), time: row.last_message_at ? new Intl.DateTimeFormat(window.IQZodiacLanguage?.locale || undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(row.last_message_at)) : '' }));
      if (activeId && !contacts.some((person) => person.id === activeId)) { const { data: matches } = await client.rpc('list_compatible_profiles'); const match = (matches || []).find((row) => row.user_id === activeId); if (match) contacts.unshift({ id: match.user_id, name: match.display_name, handle: match.handle, preview: t('Matched member', 'عضو متطابق') }); }
      if (!activeId) activeId = contacts[0]?.id || null;
      renderContacts(); await loadConversation();
    } catch (error) { console.warn('Conversation data could not be loaded.', error); contactList.innerHTML = `<p class="sidebar-note">${escapeHTML(t('The shared messaging service is temporarily unavailable. No sample conversations are shown.', 'خدمة الرسائل غير متاحة مؤقتًا. لا نعرض محادثات تجريبية.'))}</p>`; }
  })();
})();
