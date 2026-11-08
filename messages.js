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
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeParams = new URLSearchParams(window.location.search);
  const targetMessageId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeParams.get('message') || '') ? routeParams.get('message') : '';
  let client; let user; let contacts = []; let activeId = routeParams.get('match'); let activeConversation = null; let timerInterval; let elapsedSeconds = 0;
  const toast = (message) => { const node = document.querySelector('.toast-message'); if (node) { node.textContent = message; document.querySelector('.toast')?.classList.add('is-visible'); } };
  const renderContacts = (filter = '') => {
    contactList.replaceChildren();
    const matched = contacts.filter((person) => `${person.name} ${person.handle}`.toLowerCase().includes(filter.toLowerCase()));
    matched.forEach((person) => { const button = document.createElement('button'); button.type = 'button'; button.className = `contact-item${person.id === activeId ? ' is-active' : ''}`; button.innerHTML = `<span class="contact-avatar">${escapeHTML((person.name || 'M').slice(0, 1))}</span><span class="contact-copy"><strong>${escapeHTML(person.name)}</strong><small>${escapeHTML(person.preview || 'Start a private conversation')}</small></span><span class="contact-time">${escapeHTML(person.time || '')}</span>`; button.addEventListener('click', () => { activeId = person.id; loadConversation(); }); contactList.append(button); });
    if (!matched.length) contactList.innerHTML = '<p class="sidebar-note">No real conversations are available yet.</p>';
  };
  const renderMessages = async () => {
    const person = contacts.find((item) => item.id === activeId);
    if (!person || !activeConversation) { messageList.innerHTML = '<div class="message-day-divider">REAL MEMBER CONVERSATIONS ONLY</div><p class="sidebar-note">Open a real match to start a private conversation.</p>'; return; }
    document.querySelector('#active-name').textContent = person.name; document.querySelector('#active-handle').textContent = `${person.handle} · Private member conversation`; document.querySelector('#call-title').textContent = person.name;
    const { data: rows, error } = await client.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', activeConversation).order('created_at', { ascending: true }).limit(200);
    if (error) { toast('Messages could not be loaded.'); return; }
    let messages = rows || [];
    if (targetMessageId && !messages.some((message) => message.id === targetMessageId)) {
      const { data: targetMessage } = await client.from('messages').select('id,sender_id,body,created_at').eq('id', targetMessageId).eq('conversation_id', activeConversation).maybeSingle();
      if (targetMessage) messages = [...messages, targetMessage].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    messageList.replaceChildren(); const divider = document.createElement('div'); divider.className = 'message-day-divider'; divider.textContent = 'PRIVATE CONVERSATION'; messageList.append(divider);
    messages.forEach((message) => { const bubble = document.createElement('div'); bubble.className = `message-bubble${message.sender_id === user.id ? ' is-mine' : ''}`; if (message.id) bubble.id = `message-${message.id}`; const body = document.createElement('span'); body.textContent = message.body; const meta = document.createElement('small'); meta.className = 'message-meta'; meta.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at)); bubble.append(body, meta); messageList.append(bubble); });
    messageList.scrollTop = messageList.scrollHeight;
    if (targetMessageId) { const target = document.getElementById(`message-${targetMessageId}`); if (target) { target.classList.add('notification-target-highlight'); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    renderContacts(document.querySelector('#contact-search').value); await renderRevealState();
  };
  const renderRevealState = async () => {
    const status = document.querySelector('#face-consent-status'); const request = document.querySelector('#request-reveal'); const partnerButton = document.querySelector('#partner-consent');
    if (!activeConversation) { status.textContent = 'A reveal is available only inside a real conversation.'; request.disabled = true; partnerButton.hidden = true; return; }
    partnerButton.hidden = true;
    const { data } = await client.from('face_reveal_consents').select('user_id').eq('conversation_id', activeConversation);
    const mine = (data || []).some((row) => row.user_id === user.id); const both = (data || []).length >= 2;
    status.textContent = both ? 'Both people agreed. The face may now be revealed inside this private match.' : mine ? 'Your request is recorded. The face stays hidden until the other person agrees too.' : 'A reveal requires two explicit yeses.';
    request.disabled = both || mine; request.textContent = both ? 'Face reveal approved' : mine ? 'Request sent' : 'Request reveal';
  };
  const loadConversation = async () => {
    if (!activeId) { renderContacts(); await renderMessages(); return; }
    const { data: conversationId, error } = await client.rpc('get_or_create_conversation', { p_other_user: activeId });
    if (error) { toast('This member cannot receive messages yet.'); await renderMessages(); return; }
    activeConversation = conversationId; await renderMessages();
  };
  document.querySelector('#contact-search').addEventListener('input', (event) => renderContacts(event.target.value));
  messageInput.addEventListener('input', () => { document.querySelector('#message-counter').textContent = `${messageInput.value.length} / 600`; });
  document.querySelector('#message-form').addEventListener('submit', async (event) => { event.preventDefault(); const body = messageInput.value.trim(); if (!body || !activeConversation) return; const { error } = await client.from('messages').insert({ conversation_id: activeConversation, sender_id: user.id, body }); if (error) { toast('Message could not be sent.'); return; } messageInput.value = ''; document.querySelector('#message-counter').textContent = '0 / 600'; await renderMessages(); messageInput.focus(); });
  document.querySelector('#request-reveal')?.addEventListener('click', async () => { if (!activeConversation) return; const { error } = await client.from('face_reveal_consents').upsert({ conversation_id: activeConversation, user_id: user.id }); if (error) toast('Consent could not be saved.'); else await renderRevealState(); });
  const stopCall = () => { clearInterval(timerInterval); timerInterval = null; elapsedSeconds = 0; callModal.hidden = true; };
  callButton.addEventListener('click', () => { if (!activeConversation) { toast('Open a real conversation before starting a call.'); return; } callStatus.textContent = 'Audio calling is not connected yet.'; callTimer.textContent = '00:00'; callModal.hidden = false; timerInterval = setInterval(() => { elapsedSeconds += 1; callTimer.textContent = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`; }, 1000); });
  document.querySelector('#close-call').addEventListener('click', stopCall); document.querySelector('#end-call').addEventListener('click', stopCall); callModal.addEventListener('click', (event) => { if (event.target === callModal) stopCall(); });
  (async () => { try { client = await database(); const { data: session } = await client.auth.getSession(); user = session.session?.user; if (!user) return; const { data, error } = await client.rpc('list_my_conversations'); if (error) throw error; contacts = (data || []).map((row) => ({ id: row.other_user_id, name: row.display_name || 'Orbit Member', handle: row.handle || '@member', preview: row.last_message || 'Start a private conversation', time: row.last_message_at ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(row.last_message_at)) : '' })); if (activeId && !contacts.some((person) => person.id === activeId)) { const { data: matches } = await client.rpc('list_compatible_profiles'); const match = (matches || []).find((row) => row.user_id === activeId); if (match) contacts.unshift({ id: match.user_id, name: match.display_name, handle: match.handle, preview: 'Matched member' }); } if (!activeId) activeId = contacts[0]?.id || null; renderContacts(); await loadConversation(); } catch (error) { console.warn('Conversation data could not be loaded.', error); contactList.innerHTML = '<p class="sidebar-note">The shared messaging service is temporarily unavailable. No sample conversations are shown.</p>'; } })();
})();
