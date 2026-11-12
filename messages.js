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
  const attachmentInput = document.querySelector('#attachment-input');
  const pendingAttachmentsNode = document.querySelector('#pending-attachments');
  const attachmentButton = document.querySelector('#attach-file-button');
  const recordAudioButton = document.querySelector('#record-audio-button');
  const sendMessageButton = document.querySelector('#send-message-button');
  const pushButton = document.querySelector('#push-notifications-button');
  const attachmentBucket = 'iqzodiac-chat-media';
  const t = (en, ar) => window.IQZodiacLanguage?.t(en, ar) || en;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeParams = new URLSearchParams(window.location.search);
  const rawMarketplaceListingId = routeParams.get('listing') || '';
  const marketplaceListingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawMarketplaceListingId) ? rawMarketplaceListingId : '';
  const marketplaceContextNode = document.querySelector('#marketplace-chat-context');
  const targetMessageId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeParams.get('message') || '') ? routeParams.get('message') : '';
  let client; let user; let contacts = []; let activeId = rawMarketplaceListingId ? null : routeParams.get('match'); let activeConversation = null; let activeConversationHint = null; let marketplaceContext = null; let pendingMarketplaceListingId = marketplaceListingId; let timerInterval; let elapsedSeconds = 0; let currentExpiryDuration = 'off'; let expiryChangeInFlight = false; let expiryRequestId = 0; let targetMessageFocused = false;
  let realtimeChannel = null; let renderTimer = null; let expiryRenderTimer = null; let renderRevision = 0; let cachedConversationId = null; let cachedMessageNodes = new Map(); let longPressTimer = null; let suppressNextClick = false; let selectionMode = false; let selectedMessageIds = new Set(); let visibleMessageIds = [];
  let pendingAttachments = []; const refreshedAttachmentPaths = new Set(); const signedUrlExpiries = new Map(); const signedUrlCache = new Map(); let mediaRecorder = null; let recordingStream = null; let recordedChunks = []; let recordingConversationId = null; let sendingMessages = false; let vapidPublicKey = ''; let serviceWorkerRegistration = null;
  const expiryValues = ['off', '1h', '24h', '7d'];
  const allowedAttachmentMimes = new Set(['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','audio/aac','audio/flac','audio/x-m4a','application/octet-stream','application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
  const mimeByExtension = { jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',ogg:'audio/ogg',oga:'audio/ogg',wav:'audio/wav',webm:'audio/webm',aac:'audio/aac',flac:'audio/flac',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  const attachmentType = (mime) => mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'file';
  const attachmentMetadata = (file) => { const ext = String(file.name.split('.').pop() || '').toLowerCase(); const mime = allowedAttachmentMimes.has(file.type) ? file.type : (mimeByExtension[ext] || 'application/octet-stream'); if (!mime || !allowedAttachmentMimes.has(mime)) return null; const kind = attachmentType(mime); const maxBytes = kind === 'image' ? 12 * 1024 * 1024 : 25 * 1024 * 1024; if (!file.size || file.size > maxBytes) return null; return { mime, kind, size: file.size }; };
  const safeAttachmentName = (value) => String(value || 'attachment').normalize('NFC').replace(/[\/\\\u0000-\u001f\u007f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || 'attachment';
  const toast = (message) => { const node = document.querySelector('.toast-message'); if (node) { node.textContent = message; document.querySelector('.toast')?.classList.add('is-visible'); } };
  const expiryLabel = (value) => ({ off: t('Off', 'إيقاف'), '1h': t('1 hour', 'ساعة واحدة'), '24h': t('24 hours', '24 ساعة'), '7d': t('7 days', '7 أيام') }[value] || t('Off', 'إيقاف'));
  const updatePushButton = () => {
    const active = Boolean(serviceWorkerRegistration?.pushManager);
    const subscribed = Boolean(window.__iqPushSubscribed);
    pushButton.textContent = `${subscribed ? t('Notifications enabled', 'الإشعارات مفعّلة') : t('Enable notifications', 'تفعيل الإشعارات')}`;
    pushButton.setAttribute('aria-pressed', String(subscribed));
    pushButton.title = subscribed ? t('Turn off message notifications', 'إيقاف إشعارات الرسائل') : t('Get notified about new messages', 'تلقي إشعار عند وصول رسالة جديدة');
    pushButton.disabled = !active || !user;
  };
  const localizeControls = () => {
    document.querySelector('.disappearing-label').textContent = t('Disappearing messages', 'الرسائل ذاتية الاختفاء');
    const options = [['off', 'Off', 'إيقاف'], ['1h', '1 hour', 'ساعة واحدة'], ['24h', '24 hours', '24 ساعة'], ['7d', '7 days', '7 أيام']];
    options.forEach(([value, en, ar]) => { const option = expirySelect.querySelector(`option[value=\"${value}\"]`); if (option) option.textContent = t(en, ar); });
    document.querySelector('#select-all-messages').textContent = t('Select all', 'تحديد الكل');
    document.querySelector('#clear-message-selection').textContent = t('Cancel', 'إلغاء التحديد');
    document.querySelector('#delete-for-me-selected').textContent = t('Delete for me', 'حذف لديّ');
    document.querySelector('#delete-everyone-selected').textContent = t('Delete for everyone', 'حذف لدى الجميع');
    attachmentButton.setAttribute('aria-label', t('Attach image, file or audio', 'إرفاق صورة أو ملف أو صوت')); attachmentButton.title = t('Attach image, file or audio', 'إرفاق صورة أو ملف أو صوت');
    recordAudioButton.setAttribute('aria-label', mediaRecorder?.state === 'recording' ? t('Stop recording', 'إيقاف التسجيل') : t('Record voice message', 'تسجيل رسالة صوتية')); recordAudioButton.title = recordAudioButton.getAttribute('aria-label');
    sendMessageButton.setAttribute('aria-label', t('Send message', 'إرسال الرسالة')); sendMessageButton.firstChild.textContent = `${t('Send', 'إرسال')} `;
    updatePushButton();
    renderPendingAttachments();
  };
  const renderContacts = (filter = '') => {
    contactList.replaceChildren();
    const matched = contacts.filter((person) => `${person.name} ${person.handle}`.toLowerCase().includes(filter.toLowerCase()));
    matched.forEach((person) => { const button = document.createElement('button'); button.type = 'button'; button.className = `contact-item${person.id === activeId && (!person.conversation_id || !activeConversation || person.conversation_id === activeConversation) ? ' is-active' : ''}`; button.innerHTML = `<span class="contact-avatar">${escapeHTML((person.name || 'M').slice(0, 1))}</span><span class="contact-copy"><strong>${escapeHTML(person.name)}</strong><small>${escapeHTML(person.preview || t('Start a private conversation', 'ابدأ محادثة خاصة'))}</small></span><span class="contact-time">${escapeHTML(person.time || '')}</span>`; button.addEventListener('click', () => { if (sendingMessages) { toast(t('Please wait for the current upload to finish.', 'انتظر حتى يكتمل رفع الملف الحالي.')); return; } if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); pendingMarketplaceListingId = ''; activeId = person.id; activeConversationHint = person.conversation_id || null; void loadConversation(); }); contactList.append(button); });
    if (!matched.length) contactList.innerHTML = `<p class="sidebar-note">${escapeHTML(t('No real conversations are available yet.', 'لا توجد محادثات حقيقية بعد.'))}</p>`;
  };
  const renderMarketplaceContext = (context, error = '') => {
    if (!marketplaceContextNode) return;
    if (error) {
      marketplaceContextNode.hidden = false;
      marketplaceContextNode.classList.add('is-error');
      marketplaceContextNode.innerHTML = `<strong>${escapeHTML(t('Marketplace chat unavailable', 'محادثة السوق غير متاحة'))}</strong><p>${escapeHTML(error)}</p>`;
      messageInput.placeholder = t('Write a message…', 'اكتب رسالة…');
      return;
    }
    if (!context) {
      marketplaceContextNode.hidden = true;
      marketplaceContextNode.classList.remove('is-error');
      marketplaceContextNode.replaceChildren();
      messageInput.placeholder = t('Write a message…', 'اكتب رسالة…');
      return;
    }
    const href = `./marketplace.html?listing=${encodeURIComponent(context.listing_id)}`;
    const price = `${Number(context.price || 0).toFixed(2)} ${context.currency_code || 'USD'}`;
    const status = context.listing_status === 'active' ? '' : `<span class="marketplace-context-status">${escapeHTML(t('This listing is no longer active.', 'هذا الإعلان لم يعد نشطًا.'))}</span>`;
    marketplaceContextNode.classList.remove('is-error');
    marketplaceContextNode.hidden = false;
    marketplaceContextNode.innerHTML = `<div class="marketplace-context-copy"><p class="card-kicker">${escapeHTML(t('MARKETPLACE INQUIRY', 'استفسار من السوق'))}</p><strong>${escapeHTML(context.listing_title || t('Marketplace listing', 'إعلان من السوق'))}</strong><span>${escapeHTML(price)}${context.listing_kind ? ` · ${escapeHTML(context.listing_kind)}` : ''}</span>${status}</div>${context.listing_status === 'active' ? `<a class="marketplace-context-link" href="${href}">${escapeHTML(t('View listing', 'عرض الإعلان'))} ↗</a>` : ''}`;
    messageInput.placeholder = t('Write a private message about this listing…', 'اكتب رسالة خاصة حول هذا الإعلان…');
  };
  const rememberMarketplaceCounterpart = (context) => {
    if (!context?.other_user_id) return;
    const rawHandle = context.other_handle || 'member';
    const person = { id: context.other_user_id, conversation_id: context.conversation_id, name: context.other_display_name || 'IQZodiac member', handle: rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`, preview: `${t('Marketplace inquiry', 'استفسار من السوق')} · ${context.listing_title || ''}` };
    const index = contacts.findIndex((item) => item.id === person.id);
    if (index === -1) contacts.unshift(person); else contacts[index] = { ...contacts[index], ...person };
    activeId = context.other_user_id;
  };
  const getMarketplaceThreadContext = async (conversationId, listingId = null) => {
    const { data, error } = await client.rpc('marketplace_get_thread_context', { p_conversation_id: conversationId, p_listing_id: listingId || null });
    return { context: Array.isArray(data) ? data[0] || null : data || null, error };
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
  const appendMessage = async (message, signedUrl) => {
    if (message.message_kind === 'system') { const notice = document.createElement('div'); notice.className = 'message-system-notice'; notice.dataset.messageId = message.id; notice.textContent = systemEventText(message); return notice; }
    const bubble = document.createElement('article');
    bubble.className = `message-bubble${message.sender_id === user.id ? ' is-mine' : ''}`;
    bubble.id = `message-${message.id}`; bubble.dataset.messageId = message.id;
    const check = document.createElement('button'); check.type = 'button'; check.className = 'message-select-check'; check.hidden = !selectionMode; check.setAttribute('aria-label', t('Select message', 'تحديد الرسالة')); check.setAttribute('aria-pressed', String(selectedMessageIds.has(message.id)));
    check.addEventListener('click', (event) => { event.stopPropagation(); if (!selectionMode) setSelectionMode(true); toggleMessageSelection(message.id); });
    const content = document.createElement('div'); content.className = 'message-content'; content.dir = 'auto';
    if (message.body) { const body = document.createElement('span'); body.className = 'message-body'; body.textContent = message.body; body.dir = 'auto'; content.append(body); }
    if (message.attachment_path) {
      const attachment = document.createElement('div'); attachment.className = `message-attachment message-attachment-${message.attachment_kind || 'file'}`;
      if (signedUrl) {
        const url = signedUrl;
        if (message.attachment_kind === 'image') {
          const image = document.createElement('img'); image.className = 'message-attachment-image'; image.src = url; image.alt = message.attachment_name || t('Shared image', 'صورة مرفقة'); image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('load', () => refreshedAttachmentPaths.delete(message.attachment_path)); image.addEventListener('error', () => { if (!refreshedAttachmentPaths.has(message.attachment_path)) { refreshedAttachmentPaths.add(message.attachment_path); scheduleRenderMessages(); } }, { once: true }); attachment.append(image);
        } else if (message.attachment_kind === 'audio') {
          const audio = document.createElement('audio'); audio.className = 'message-attachment-audio'; audio.controls = true; audio.preload = 'none'; audio.src = url; audio.setAttribute('aria-label', t(`Audio message: ${message.attachment_name || 'audio'}`, `رسالة صوتية: ${message.attachment_name || 'صوت'}`)); audio.addEventListener('loadedmetadata', () => refreshedAttachmentPaths.delete(message.attachment_path)); audio.addEventListener('error', () => { if (!refreshedAttachmentPaths.has(message.attachment_path)) { refreshedAttachmentPaths.add(message.attachment_path); scheduleRenderMessages(); } }, { once: true }); attachment.append(audio);
        } else {
          const link = document.createElement('a'); link.className = 'message-attachment-file'; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; link.download = message.attachment_name || 'attachment';
          link.addEventListener('click', async (event) => {
            if ((signedUrlExpiries.get(message.attachment_path) || 0) > Date.now() + 15000) return;
            event.preventDefault();
            const popup = window.open('about:blank', '_blank');
            if (!popup) { toast(t('Allow pop-ups to download this file.', 'اسمح بالنوافذ المنبثقة لتنزيل هذا الملف.')); return; }
            popup.opener = null;
            const remaining = message.expires_at ? Math.ceil((new Date(message.expires_at).getTime() - Date.now()) / 1000) : 300;
            if (remaining <= 0) { popup.close(); toast(t('This attachment has expired.', 'انتهت صلاحية هذا المرفق.')); return; }
            const { data: fresh, error: refreshError } = await client.storage.from(attachmentBucket).createSignedUrl(message.attachment_path, Math.max(1, Math.min(300, remaining)), { download: message.attachment_name || true });
            if (refreshError || !fresh?.signedUrl) { popup.close(); toast(t('This attachment is no longer available.', 'لم يعد هذا المرفق متاحًا.')); return; }
            link.href = fresh.signedUrl; signedUrlExpiries.set(message.attachment_path, Date.now() + Math.min(300, remaining) * 1000); popup.location.replace(fresh.signedUrl);
          });
          const icon = document.createElement('span'); icon.className = 'message-attachment-file-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '↧';
          const name = document.createElement('span'); name.className = 'message-attachment-file-name'; name.textContent = message.attachment_name || t('Download file', 'تنزيل الملف'); link.append(icon, name); attachment.append(link);
        }
      } else { const unavailable = document.createElement('span'); unavailable.className = 'attachment-unavailable'; unavailable.textContent = t('Attachment unavailable or expired.', 'المرفق غير متاح أو انتهت صلاحيته.'); attachment.append(unavailable); }
      content.append(attachment);
    }
    const meta = document.createElement('small'); meta.className = 'message-meta';
    meta.textContent = new Intl.DateTimeFormat(window.IQZodiacLanguage?.locale || undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at));
    bubble.append(check, content, meta);
    bubble.addEventListener('contextmenu', (event) => { event.preventDefault(); if (!selectionMode) setSelectionMode(true); if (!selectedMessageIds.has(message.id)) toggleMessageSelection(message.id); });
    bubble.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'touch') return; window.clearTimeout(longPressTimer); longPressTimer = window.setTimeout(() => { suppressNextClick = true; if (!selectionMode) setSelectionMode(true); if (!selectedMessageIds.has(message.id)) toggleMessageSelection(message.id); }, 520); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => bubble.addEventListener(name, () => window.clearTimeout(longPressTimer)));
    bubble.addEventListener('click', () => { if (suppressNextClick) { suppressNextClick = false; return; } if (selectionMode) toggleMessageSelection(message.id); });
    return bubble;
  };
  const renderPendingAttachments = () => {
    pendingAttachmentsNode.replaceChildren(); pendingAttachmentsNode.hidden = !pendingAttachments.length;
    pendingAttachments.forEach((item, index) => {
      const chip = document.createElement('div'); chip.className = 'pending-attachment';
      const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = item.meta.kind === 'image' ? '▧' : item.meta.kind === 'audio' ? '♫' : '↧';
      const name = document.createElement('span'); name.className = 'pending-attachment-name'; name.textContent = item.file.name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pending-attachment-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', t(`Remove ${item.file.name}`, `إزالة ${item.file.name}`)); remove.disabled = sendingMessages; remove.addEventListener('click', () => { pendingAttachments.splice(index, 1); renderPendingAttachments(); });
      chip.append(icon, name, remove); pendingAttachmentsNode.append(chip);
    });
  };
  const addPendingFiles = (files) => {
    const remaining = Math.max(0, 5 - pendingAttachments.length);
    if (files.length > remaining) toast(t('You can attach up to 5 files to one send.', 'يمكنك إرفاق 5 ملفات كحد أقصى في عملية إرسال واحدة.'));
    files.slice(0, remaining).forEach((file) => { const meta = attachmentMetadata(file); if (!meta) { toast(t(`Unsupported file type or size: ${file.name}`, `نوع الملف أو حجمه غير مدعوم: ${file.name}`)); return; } pendingAttachments.push({ file, meta }); });
    renderPendingAttachments();
  };
  const setComposerBusy = (busy) => { sendingMessages = busy; messageInput.disabled = busy; attachmentInput.disabled = busy; attachmentButton.disabled = busy; recordAudioButton.disabled = busy || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined'; sendMessageButton.disabled = busy; renderPendingAttachments(); };
  const sendPushForMessage = async (conversationId, messageId) => {
    if (!messageId) return;
    try {
      const { error } = await client.functions.invoke('send-chat-push', { body: { conversation_id: conversationId, message_id: messageId } });
      if (error) console.warn('Message push notification could not be sent.', error);
    } catch (error) { console.warn('Message push notification could not be sent.', error); }
  };
  const sendPendingMessages = async (body, conversationId) => {
    const files = [...pendingAttachments];
    for (let index = 0; index < files.length; index += 1) {
      const { file, meta } = files[index];
      const displayName = safeAttachmentName(file.name);
      const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${conversationId}/${user.id}/${uniqueId}-${displayName}`;
      const { error: uploadError } = await client.storage.from(attachmentBucket).upload(path, file, { cacheControl: '3600', contentType: meta.mime, upsert: false });
      if (uploadError) { toast(t(`Upload failed: ${file.name}`, `فشل رفع الملف: ${file.name}`)); return false; }
      const { data: mediaResult, error: insertError } = await client.functions.invoke('chat-media-verify', { body: { conversation_id: conversationId, attachment_path: path, attachment_name: displayName, attachment_mime: meta.mime, attachment_kind: meta.kind, body: index === 0 ? body : '' } });
      if (insertError) { await client.storage.from(attachmentBucket).remove([path]); toast(t(`Could not send: ${file.name}`, `تعذر إرسال: ${file.name}`)); return false; }
      await sendPushForMessage(conversationId, mediaResult?.message_id);
      pendingAttachments.shift(); renderPendingAttachments();
      if (index === 0) { body = ''; messageInput.value = ''; document.querySelector('#message-counter').textContent = '0 / 600'; }
    }
    if (body && !files.length) {
      const { data: insertedMessage, error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body }).select('id').single();
      if (error) { toast(t('Message could not be sent.', 'تعذر إرسال الرسالة.')); return false; }
      messageInput.value = ''; document.querySelector('#message-counter').textContent = '0 / 600';
      await sendPushForMessage(conversationId, insertedMessage?.id);
    }
    return true;
  };
  const setRecordingUi = (recording) => { recordAudioButton.classList.toggle('is-recording', recording); recordAudioButton.setAttribute('aria-pressed', String(recording)); localizeControls(); };
  const startAudioRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast(t('Audio recording is not supported by this browser.', 'تسجيل الصوت غير مدعوم في هذا المتصفح.')); return; }
    if (!activeConversation) { toast(t('Open a conversation before recording.', 'افتح محادثة قبل بدء التسجيل.')); return; }
    const requestedConversationId = activeConversation;
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeConversation !== requestedConversationId) { recordingStream.getTracks().forEach((track) => track.stop()); recordingStream = null; toast(t('Recording cancelled because the conversation changed.', 'تم إلغاء التسجيل لأن المحادثة تغيّرت.')); return; }
      recordingConversationId = requestedConversationId; recordedChunks = [];
      const mimeType = ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find((candidate) => MediaRecorder.isTypeSupported?.(candidate));
      mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.push(event.data); };
      mediaRecorder.onerror = () => { toast(t('Audio recording failed.', 'فشل تسجيل الصوت.')); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || recordedChunks[0]?.type || 'audio/webm' });
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-message-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`, { type: blob.type });
        if (activeConversation === recordingConversationId && blob.size) addPendingFiles([file]);
        else toast(t('Recording discarded because the conversation changed.', 'تم تجاهل التسجيل لأن المحادثة تغيّرت.'));
        recordingStream?.getTracks().forEach((track) => track.stop()); recordingStream = null; mediaRecorder = null; recordingConversationId = null; recordedChunks = []; setRecordingUi(false);
      };
      mediaRecorder.start(); setRecordingUi(true);
    } catch (error) { recordingStream?.getTracks().forEach((track) => track.stop()); recordingStream = null; setRecordingUi(false); toast(t('Microphone permission was not granted.', 'لم يتم منح إذن استخدام الميكروفون.')); }
  };
  const renderMessages = async () => {
    const revision = ++renderRevision;
    const renderingConversation = activeConversation;
    const renderingMember = activeId;
    const person = contacts.find((item) => item.id === renderingMember);
    if (!person || !renderingConversation) { messageList.innerHTML = `<div class="message-day-divider">${escapeHTML(t('PRIVATE CONVERSATION', 'محادثة خاصة'))}</div><p class="sidebar-note">${escapeHTML(t('Select a private conversation or open a Marketplace listing to message its seller.', 'اختر محادثة خاصة أو افتح إعلانًا في السوق لمراسلة بائعه.'))}</p>`; return; }
    document.querySelector('#active-name').textContent = person.name; document.querySelector('#active-handle').textContent = `${person.handle} · ${t('Private member conversation', 'محادثة خاصة')}`; document.querySelector('#call-title').textContent = person.name;
    const [{ data: rows, error }, { data: hiddenRows, error: hiddenError }, { data: settings, error: settingsError }] = await Promise.all([
      client.from('messages').select('id,sender_id,body,created_at,expires_at,message_kind,attachment_path,attachment_name,attachment_mime,attachment_size_bytes,attachment_kind').eq('conversation_id', renderingConversation).order('created_at', { ascending: true }).limit(200),
      client.from('message_user_hides').select('message_id').eq('conversation_id', renderingConversation).eq('user_id', user.id),
      client.from('conversation_message_settings').select('expiry_duration').eq('conversation_id', renderingConversation).maybeSingle(),
    ]);
    if (revision !== renderRevision || activeConversation !== renderingConversation || activeId !== renderingMember) return;
    if (error || hiddenError || settingsError) { toast(t('Messages could not be loaded. Apply the messaging database migration first.', 'تعذر تحميل الرسائل. يجب تطبيق تحديث قاعدة بيانات الرسائل أولًا.')); return; }
    const hiddenIds = new Set((hiddenRows || []).map((item) => item.message_id));
    let messages = (rows || []).filter((message) => !hiddenIds.has(message.id) && (!message.expires_at || new Date(message.expires_at).getTime() > Date.now()));
    if (targetMessageId && !messages.some((message) => message.id === targetMessageId)) {
      const { data: targetMessage } = await client.from('messages').select('id,sender_id,body,created_at,expires_at,message_kind,attachment_path,attachment_name,attachment_mime,attachment_size_bytes,attachment_kind').eq('id', targetMessageId).eq('conversation_id', renderingConversation).maybeSingle();
      if (revision !== renderRevision || activeConversation !== renderingConversation || activeId !== renderingMember) return;
      if (targetMessage && !hiddenIds.has(targetMessage.id) && (!targetMessage.expires_at || new Date(targetMessage.expires_at).getTime() > Date.now())) messages = [...messages, targetMessage].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    const visibleAttachmentPaths = new Set(messages.map((message) => message.attachment_path).filter(Boolean));
    signedUrlCache.forEach((_, path) => {
      if (!visibleAttachmentPaths.has(path)) { signedUrlCache.delete(path); signedUrlExpiries.delete(path); }
    });
    const sameConversation = cachedConversationId === renderingConversation;
    const previousNodes = sameConversation ? cachedMessageNodes : new Map();
    const now = Date.now();
    const attachmentMessages = messages.filter((message) => message.attachment_path && (
      !signedUrlCache.has(message.attachment_path)
      || (signedUrlExpiries.get(message.attachment_path) || 0) <= now + 15000
      || refreshedAttachmentPaths.has(message.attachment_path)
    ));
    const refreshedPaths = new Set(attachmentMessages.map((message) => message.attachment_path));
    const signedUrls = new Map();
    messages.forEach((message) => {
      if (!message.attachment_path || refreshedPaths.has(message.attachment_path)) return;
      const cachedUrl = signedUrlCache.get(message.attachment_path);
      if (cachedUrl && (signedUrlExpiries.get(message.attachment_path) || 0) > now + 15000) signedUrls.set(message.attachment_path, cachedUrl);
    });
    if (attachmentMessages.length) {
      const ttl = attachmentMessages.reduce((shortest, message) => message.expires_at ? Math.min(shortest, Math.max(1, Math.ceil((new Date(message.expires_at).getTime() - Date.now()) / 1000))) : shortest, 300);
      const groups = [
        { rows: attachmentMessages.filter((message) => message.attachment_kind === 'file'), download: true },
        { rows: attachmentMessages.filter((message) => message.attachment_kind !== 'file'), download: false },
      ].filter((group) => group.rows.length);
      const signedResults = await Promise.all(groups.map((group) => client.storage.from(attachmentBucket).createSignedUrls(group.rows.map((message) => message.attachment_path), ttl, group.download ? { download: true } : undefined)));
      if (revision !== renderRevision || activeConversation !== renderingConversation || activeId !== renderingMember) return;
      signedResults.forEach(({ data: signedRows, error: signedError }) => {
        if (signedError) return;
        (signedRows || []).forEach((row) => {
          if (!row.signedUrl) return;
          signedUrls.set(row.path, row.signedUrl);
          signedUrlCache.set(row.path, row.signedUrl);
          signedUrlExpiries.set(row.path, Date.now() + ttl * 1000);
        });
      });
    }
    visibleMessageIds = messages.filter((message) => message.message_kind === 'user');
    if (selectedMessageIds.size) {
      const currentIds = new Set(visibleMessageIds.map((message) => message.id));
      selectedMessageIds = new Set([...selectedMessageIds].filter((id) => currentIds.has(id)));
    }
    window.clearTimeout(expiryRenderTimer);
    const nextExpiry = messages.reduce((nearest, message) => { const expiry = message.expires_at ? new Date(message.expires_at).getTime() : Infinity; return expiry < nearest ? expiry : nearest; }, Infinity);
    if (Number.isFinite(nextExpiry)) expiryRenderTimer = window.setTimeout(scheduleRenderMessages, Math.max(0, nextExpiry - Date.now() + 25));
    currentExpiryDuration = expiryValues.includes(settings?.expiry_duration) ? settings.expiry_duration : 'off';
    expirySelect.value = currentExpiryDuration;
    expirySelect.disabled = expiryChangeInFlight;
    const oldScrollTop = messageList.scrollTop;
    const wasNearBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 100;
    const nodeById = new Map();
    const needsRender = [];
    messages.forEach((message) => {
      const existing = previousNodes.get(message.id);
      const mustRefresh = Boolean(message.attachment_path && (
        refreshedPaths.has(message.attachment_path)
        || refreshedAttachmentPaths.has(message.attachment_path)
        || existing?.querySelector('.attachment-unavailable')
      ));
      if (existing && !mustRefresh) nodeById.set(message.id, existing);
      else needsRender.push(message);
    });
    const renderedNodes = await Promise.all(needsRender.map((message) => appendMessage(message, signedUrls.get(message.attachment_path))));
    if (revision !== renderRevision || activeConversation !== renderingConversation || activeId !== renderingMember) return;
    needsRender.forEach((message, index) => nodeById.set(message.id, renderedNodes[index]));

    let divider = sameConversation ? messageList.querySelector('.message-day-divider') : null;
    if (!divider) { divider = document.createElement('div'); divider.className = 'message-day-divider'; }
    divider.textContent = t('PRIVATE CONVERSATION', 'محادثة خاصة');
    const orderedNodes = [divider, ...messages.map((message) => nodeById.get(message.id))];
    const desiredNodes = new Set(orderedNodes);
    [...messageList.children].forEach((node) => { if (!desiredNodes.has(node)) node.remove(); });
    let cursor = messageList.firstElementChild;
    orderedNodes.forEach((node) => {
      if (cursor === node) cursor = cursor.nextElementSibling;
      else messageList.insertBefore(node, cursor);
    });
    while (cursor) { const next = cursor.nextElementSibling; cursor.remove(); cursor = next; }

    cachedConversationId = renderingConversation;
    cachedMessageNodes = nodeById;
    messageList.classList.toggle('is-selecting', selectionMode); updateSelectionToolbar();
    const hasNewMessages = messages.some((message) => !previousNodes.has(message.id));
    if (!sameConversation || (wasNearBottom && hasNewMessages)) messageList.scrollTop = messageList.scrollHeight;
    else messageList.scrollTop = Math.min(oldScrollTop, Math.max(0, messageList.scrollHeight - messageList.clientHeight));
    if (targetMessageId && !targetMessageFocused) {
      const target = document.getElementById(`message-${targetMessageId}`);
      if (target) { target.classList.add('notification-target-highlight'); target.scrollIntoView({ behavior: 'auto', block: 'center' }); targetMessageFocused = true; }
    }
    if (!sameConversation) await renderRevealState();
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
    const revision = ++renderRevision;
    expiryRequestId += 1; expiryChangeInFlight = false; expirySelect.disabled = true; expirySelect.removeAttribute('aria-busy');
    document.querySelector('.disappearing-setting')?.classList.remove('is-saving');
    const requestedMemberId = activeId;
    selectedMessageIds.clear(); selectionMode = false; updateSelectionToolbar();
    window.clearTimeout(expiryRenderTimer);
    activeConversation = null;
    marketplaceContext = null;
    renderMarketplaceContext(null);
    if (realtimeChannel) { await client.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (revision !== renderRevision) return;

    if (pendingMarketplaceListingId) {
      const listingId = pendingMarketplaceListingId;
      pendingMarketplaceListingId = '';
      const { data: conversationId, error } = await client.rpc('marketplace_start_thread', { p_listing_id: listingId });
      if (revision !== renderRevision) return;
      if (error || !conversationId) {
        activeId = null;
        renderMarketplaceContext(null, t('This listing is unavailable for messaging. It may be inactive, or you may be its seller.', 'لا يمكن بدء محادثة لهذا الإعلان؛ ربما لم يعد نشطًا أو أنك صاحبه.'));
        renderContacts(); await renderMessages(); return;
      }
      activeConversation = conversationId;
      const result = await getMarketplaceThreadContext(conversationId, listingId);
      if (revision !== renderRevision) return;
      if (result.error || !result.context || result.context.listing_id !== listingId) {
        activeConversation = null; activeId = null;
        renderMarketplaceContext(null, t('The private Marketplace thread could not be verified. Please try again.', 'تعذر التحقق من محادثة السوق الخاصة. حاول مرة أخرى.'));
        renderContacts(); await renderMessages(); return;
      }
      marketplaceContext = result.context;
      rememberMarketplaceCounterpart(marketplaceContext);
      renderMarketplaceContext(marketplaceContext);
    } else {
      if (!requestedMemberId) { activeId = null; renderContacts(); await renderMessages(); return; }
      const hintedConversationId = activeConversationHint && contacts.some((person) => person.id === requestedMemberId && person.conversation_id === activeConversationHint) ? activeConversationHint : null;
      activeConversationHint = null;
      let conversationId = hintedConversationId; let error = null;
      if (!conversationId) { const result = await client.rpc('get_or_create_conversation', { p_other_user: requestedMemberId }); conversationId = result.data; error = result.error; }
      if (revision !== renderRevision || activeId !== requestedMemberId) return;
      if (error || !conversationId) { toast(t('This member cannot receive messages yet.', 'لا يمكن لهذا العضو استقبال الرسائل حاليًا.')); await renderMessages(); return; }
      activeConversation = conversationId;
      const result = await getMarketplaceThreadContext(conversationId);
      if (revision !== renderRevision || activeId !== requestedMemberId) return;
      marketplaceContext = result.error ? null : result.context;
      if (marketplaceContext) { rememberMarketplaceCounterpart(marketplaceContext); renderMarketplaceContext(marketplaceContext); }
      else renderMarketplaceContext(null);
    }
    renderContacts();
    await subscribeConversation();
    await renderMessages();
  };
  const decodeBase64Url = (value) => { const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); };
  const syncPushSubscription = async () => {
    if (!serviceWorkerRegistration || !user) return;
    try {
      const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
      window.__iqPushSubscribed = Boolean(subscription);
      if (subscription) {
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Incomplete push subscription');
        const { error } = await client.from('push_subscriptions').upsert({ user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
        if (error) throw error;
      }
    } catch (error) { console.warn('Push subscription could not be synchronized.', error); }
    updatePushButton();
  };
  pushButton.addEventListener('click', async () => {
    if (!serviceWorkerRegistration || !user) return;
    pushButton.disabled = true;
    try {
      const current = await serviceWorkerRegistration.pushManager.getSubscription();
      if (current) {
        await client.from('push_subscriptions').delete().eq('endpoint', current.endpoint);
        await current.unsubscribe(); window.__iqPushSubscribed = false;
        toast(t('Message notifications turned off.', 'تم إيقاف إشعارات الرسائل.'));
      } else {
        const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
        if (permission !== 'granted') throw new Error('Notification permission denied');
        const subscription = await serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(vapidPublicKey) });
        const json = subscription.toJSON();
        const { error } = await client.from('push_subscriptions').upsert({ user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
        if (error) { await subscription.unsubscribe(); throw error; }
        window.__iqPushSubscribed = true; toast(t('Message notifications enabled on this device.', 'تم تفعيل إشعارات الرسائل على هذا الجهاز.'));
      }
    } catch (error) { console.warn('Push notifications could not be enabled.', error); toast(t('Notifications could not be enabled. Check browser permission and secure connection.', 'تعذر تفعيل الإشعارات. تحقق من إذن المتصفح والاتصال الآمن.')); }
    updatePushButton();
  });
  document.querySelector('#contact-search').addEventListener('input', (event) => renderContacts(event.target.value));
  messageInput.addEventListener('input', () => { document.querySelector('#message-counter').textContent = `${messageInput.value.length} / 600`; });
  attachmentButton.addEventListener('click', () => attachmentInput.click());
  attachmentInput.addEventListener('change', () => { addPendingFiles([...attachmentInput.files]); attachmentInput.value = ''; });
  recordAudioButton.addEventListener('click', () => { if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); else void startAudioRecording(); });
  document.querySelector('#message-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const body = messageInput.value.trim(); if (mediaRecorder?.state === 'recording') { toast(t('Stop the voice recording before sending.', 'أوقف التسجيل الصوتي قبل الإرسال.')); return; } if ((!body && !pendingAttachments.length) || !activeConversation || sendingMessages) return;
    setComposerBusy(true);
    try { const ok = await sendPendingMessages(body, activeConversation); if (ok) { await renderMessages(); messageInput.focus(); } }
    catch (error) { console.warn('Message attachment send failed.', error); toast(t('The attachment could not be sent.', 'تعذر إرسال المرفق.')); }
    finally { setComposerBusy(false); }
  });
  expirySelect.addEventListener('change', async () => {
    const conversationId = activeConversation;
    const duration = expirySelect.value;
    if (!conversationId || expiryChangeInFlight) { expirySelect.value = currentExpiryDuration; return; }
    const requestId = ++expiryRequestId;
    expiryChangeInFlight = true;
    expirySelect.disabled = true;
    expirySelect.setAttribute('aria-busy', 'true');
    document.querySelector('.disappearing-setting')?.classList.add('is-saving');
    let timeoutId;
    let settled = false;
    let rpcPromise;
    try {
      rpcPromise = Promise.resolve(client.rpc('iqzodiac_set_message_expiry', { p_conversation_id: conversationId, p_duration: duration }));
      const result = await Promise.race([
        rpcPromise,
        new Promise((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error('expiry-setting-timeout')), 10000); }),
      ]);
      settled = true;
      if (result.error) throw result.error;
      if (requestId !== expiryRequestId || activeConversation !== conversationId) return;
      currentExpiryDuration = duration;
      expirySelect.value = duration;
      toast(t('Disappearing-message setting updated.', 'تم تحديث إعداد الرسائل ذاتية الاختفاء.'));
      // Realtime normally refreshes this conversation. Schedule one debounced
      // fallback only after the RPC succeeds, avoiding a render storm while the
      // setting request is still pending.
      scheduleRenderMessages();
    } catch (error) {
      console.warn('Disappearing-message setting could not be saved.', error);
      if (requestId === expiryRequestId && activeConversation === conversationId) {
        expirySelect.value = currentExpiryDuration;
        const timedOut = error?.message === 'expiry-setting-timeout';
        toast(t(timedOut ? 'The server took too long to save this setting. Please try again.' : 'The disappearing-message setting could not be saved.', timedOut ? 'استغرق الخادم وقتًا طويلًا لحفظ الإعداد. حاول مرة أخرى.' : 'تعذر حفظ إعداد الرسائل ذاتية الاختفاء.'));
      }
      // A timed-out request may still complete on the server. Refresh later
      // without blocking the UI, so the control cannot remain visually stale.
      if (requestId === expiryRequestId && error?.message === 'expiry-setting-timeout') scheduleRenderMessages();
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === expiryRequestId) {
        expiryChangeInFlight = false;
        expirySelect.disabled = !activeConversation;
        expirySelect.removeAttribute('aria-busy');
        document.querySelector('.disappearing-setting')?.classList.remove('is-saving');
      }
      // Avoid an unhandled rejection if the timeout won the race and the
      // Supabase promise rejects after the control has already recovered.
      if (!settled) void rpcPromise?.catch(() => {});
    }
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
    const conversationId = activeConversation;
    const { data: selectedRows } = await client.from('messages').select('id,attachment_path').eq('conversation_id', conversationId).in('id', ids);
    const { data, error } = await client.rpc('iqzodiac_delete_messages_for_everyone', { p_conversation_id: conversationId, p_message_ids: ids });
    if (error || Number(data) !== ids.length) { toast(t('Some messages could not be deleted for everyone.', 'تعذر حذف بعض الرسائل لدى الجميع.')); return; }
    const attachmentPaths = (selectedRows || []).map((row) => row.attachment_path).filter(Boolean);
    if (attachmentPaths.length) await client.storage.from(attachmentBucket).remove(attachmentPaths);
    ids.forEach((id) => selectedMessageIds.delete(id));
    if (!selectedMessageIds.size) selectionMode = false;
    toast(t('Messages deleted for everyone.', 'تم حذف الرسائل لدى الجميع.')); await renderMessages();
  });
  document.querySelector('#request-reveal')?.addEventListener('click', async () => { if (!activeConversation) return; const { error } = await client.from('face_reveal_consents').upsert({ conversation_id: activeConversation, user_id: user.id }); if (error) toast(t('Consent could not be saved.', 'تعذر حفظ الموافقة.')); else await renderRevealState(); });
  const stopCall = () => { clearInterval(timerInterval); timerInterval = null; elapsedSeconds = 0; callModal.hidden = true; };
  callButton.addEventListener('click', () => { if (!activeConversation) { toast(t('Open a real conversation before starting a call.', 'افتح محادثة حقيقية قبل بدء الاتصال.')); return; } callStatus.textContent = t('Audio calling is not connected yet.', 'الاتصال الصوتي غير متصل بعد.'); callTimer.textContent = '00:00'; callModal.hidden = false; timerInterval = setInterval(() => { elapsedSeconds += 1; callTimer.textContent = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`; }, 1000); });
  document.querySelector('#close-call').addEventListener('click', stopCall); document.querySelector('#end-call').addEventListener('click', stopCall); callModal.addEventListener('click', (event) => { if (event.target === callModal) stopCall(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && selectionMode) setSelectionMode(false); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && activeConversation) scheduleRenderMessages(); });
  document.addEventListener('iqzodiac:languagechange', () => { localizeControls(); cachedConversationId = null; cachedMessageNodes.clear(); if (activeConversation) void renderMessages(); });
  localizeControls();
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { recordAudioButton.disabled = true; recordAudioButton.title = t('Audio recording is not supported by this browser.', 'تسجيل الصوت غير مدعوم في هذا المتصفح.'); }
  (async () => {
    try {
      client = await database();
      const { data: session } = await client.auth.getSession(); user = session.session?.user;
      if (!user) { updatePushButton(); return; }
      if (rawMarketplaceListingId && !marketplaceListingId) { renderMarketplaceContext(null, t('This Marketplace link is invalid.', 'رابط السوق هذا غير صالح.')); return; }
      const configResponse = await fetch('./public/supabase-public-config.json', { cache: 'no-store' });
      if (configResponse.ok) vapidPublicKey = (await configResponse.json()).vapidPublicKey || '';
      if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && vapidPublicKey) { try { serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js'); await navigator.serviceWorker.ready; await syncPushSubscription(); } catch (pushError) { console.warn('Push service worker is unavailable.', pushError); } }
      updatePushButton();
      const { data, error } = await client.rpc('list_my_conversations'); if (error) throw error;
      contacts = (data || []).map((row) => ({ id: row.other_user_id, conversation_id: row.conversation_id, name: row.display_name || 'Orbit Member', handle: row.handle || '@member', preview: row.last_message === '[Image]' ? t('Image', 'صورة') : row.last_message === '[Audio]' ? t('Audio', 'صوت') : row.last_message || t('Start a private conversation', 'ابدأ محادثة خاصة'), time: row.last_message_at ? new Intl.DateTimeFormat(window.IQZodiacLanguage?.locale || undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(row.last_message_at)) : '' }));
      if (activeId && !contacts.some((person) => person.id === activeId)) { const { data: matches } = await client.rpc('list_compatible_profiles'); const match = (matches || []).find((row) => row.user_id === activeId); if (match) contacts.unshift({ id: match.user_id, name: match.display_name, handle: match.handle, preview: t('Matched member', 'عضو متطابق') }); }
      if (activeId) activeConversationHint = contacts.find((person) => person.id === activeId)?.conversation_id || null;
      if (!activeId && !pendingMarketplaceListingId) activeId = contacts[0]?.id || null;
      renderContacts(); await loadConversation();
    } catch (error) { console.warn('Conversation data could not be loaded.', error); contactList.innerHTML = `<p class="sidebar-note">${escapeHTML(t('The shared messaging service is temporarily unavailable. No sample conversations are shown.', 'خدمة الرسائل غير متاحة مؤقتًا. لا نعرض محادثات تجريبية.'))}</p>`; }
  })();
})();
