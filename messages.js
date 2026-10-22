(() => {
  const contacts = [
    { id: 'maya', name: 'Maya Chen', handle: '@mayachen', initials: 'M', avatar: 'avatar-maya', preview: 'That sounds like a lovely plan.', time: '12m' },
    { id: 'noah', name: 'Noah Williams', handle: '@noahw', initials: 'N', avatar: 'avatar-noah', preview: 'Found a little more light today.', time: '1h' },
    { id: 'lina', name: 'Lina Ortiz', handle: '@linaortiz', initials: 'L', avatar: 'avatar-lina', preview: 'Sending a little sunshine your way ☀', time: '3h' },
  ];
  const storageKey = 'iqzodiac-demo-messages';
  const starter = {
    maya: [{ from: 'them', text: 'Hey Alex! How has your week been treating you?', time: '10:42' }, { from: 'me', text: 'A little busy, but I found a quiet moment this morning.', time: '10:45' }, { from: 'them', text: 'That sounds like a lovely plan. We all need those little pauses ✨', time: '10:47' }],
    noah: [{ from: 'them', text: 'Found a little more light on the way home.', time: 'Yesterday' }],
    lina: [{ from: 'them', text: 'Sending a little sunshine your way ☀', time: 'Monday' }],
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { saved = {}; }
  const conversations = Object.fromEntries(contacts.map((person) => [person.id, Array.isArray(saved[person.id]) ? saved[person.id] : starter[person.id]]));
  let activeId = 'maya';
  let timerInterval = null;
  let elapsedSeconds = 0;

  const contactList = document.querySelector('#contact-list');
  const messageList = document.querySelector('#message-list');
  const messageInput = document.querySelector('#message-input');
  const callModal = document.querySelector('#call-modal');
  const callButton = document.querySelector('#call-button');
  const callStatus = document.querySelector('#call-status');
  const callTimer = document.querySelector('#call-timer');
  const escapeHTML = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const renderContacts = (filter = '') => {
    contactList.replaceChildren();
    const matched = contacts.filter((person) => `${person.name} ${person.handle}`.toLowerCase().includes(filter.toLowerCase()));
    matched.forEach((person) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `contact-item${person.id === activeId ? ' is-active' : ''}`;
      button.dataset.contact = person.id;
      button.innerHTML = `<span class="contact-avatar ${person.avatar}">${person.initials}</span><span class="contact-copy"><strong>${escapeHTML(person.name)}</strong><small>${escapeHTML(person.preview)}</small></span><span class="contact-time">${person.time}</span>`;
      button.addEventListener('click', () => selectContact(person.id));
      contactList.append(button);
    });
    if (!matched.length) contactList.innerHTML = '<p class="sidebar-note">No sample profiles match that search.</p>';
  };

  const renderMessages = () => {
    const person = contacts.find((item) => item.id === activeId);
    document.querySelector('#active-name').textContent = person.name;
    document.querySelector('#active-handle').textContent = `${person.handle} · Sample profile`;
    const avatar = document.querySelector('#active-avatar');
    avatar.className = `contact-avatar ${person.avatar}`;
    avatar.textContent = person.initials;
    document.querySelector('#call-title').textContent = person.name;
    const callAvatar = document.querySelector('#call-avatar');
    callAvatar.className = `call-avatar ${person.avatar}`;
    callAvatar.textContent = person.initials;
    messageList.replaceChildren();
    const divider = document.createElement('div');
    divider.className = 'message-day-divider';
    divider.textContent = 'SAMPLE CONVERSATION · LOCAL DEMO';
    messageList.append(divider);
    conversations[activeId].forEach((message) => {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble${message.from === 'me' ? ' is-mine' : ''}`;
      const body = document.createElement('span');
      body.textContent = message.text;
      const meta = document.createElement('small');
      meta.className = 'message-meta';
      meta.textContent = `${message.from === 'me' ? 'You' : person.name.split(' ')[0]} · ${message.time}`;
      bubble.append(body, meta);
      messageList.append(bubble);
    });
    messageList.scrollTop = messageList.scrollHeight;
    renderContacts(document.querySelector('#contact-search').value);
  };

  const selectContact = (id) => {
    activeId = id;
    renderMessages();
  };

  document.querySelector('#contact-search').addEventListener('input', (event) => renderContacts(event.target.value));
  messageInput.addEventListener('input', () => {
    document.querySelector('#message-counter').textContent = `${messageInput.value.length} / 600`;
  });
  document.querySelector('#message-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
    conversations[activeId].push({ from: 'me', text, time });
    localStorage.setItem(storageKey, JSON.stringify(conversations));
    messageInput.value = '';
    document.querySelector('#message-counter').textContent = '0 / 600';
    renderMessages();
    messageInput.focus();
  });

  const stopDemoCall = () => {
    window.clearInterval(timerInterval);
    timerInterval = null;
    elapsedSeconds = 0;
    callModal.hidden = true;
    document.querySelector('#mute-call').classList.remove('is-muted');
    document.querySelector('#mute-call small').textContent = 'Mute demo';
    document.querySelector('#call-button').focus();
  };
  callButton.addEventListener('click', () => {
    const person = contacts.find((item) => item.id === activeId);
    document.querySelector('#call-title').textContent = person.name;
    const avatar = document.querySelector('#call-avatar');
    avatar.className = `call-avatar ${person.avatar}`;
    avatar.textContent = person.initials;
    callStatus.textContent = 'Demo call · no one is being contacted';
    callTimer.textContent = '00:00';
    callModal.hidden = false;
    document.querySelector('#close-call').focus();
    timerInterval = window.setInterval(() => {
      elapsedSeconds += 1;
      callTimer.textContent = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
    }, 1000);
  });
  document.querySelector('#close-call').addEventListener('click', stopDemoCall);
  document.querySelector('#end-call').addEventListener('click', stopDemoCall);
  document.querySelector('#mute-call').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const muted = button.classList.toggle('is-muted');
    button.querySelector('small').textContent = muted ? 'Muted (demo)' : 'Mute demo';
  });
  callModal.addEventListener('click', (event) => { if (event.target === callModal) stopDemoCall(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !callModal.hidden) stopDemoCall(); });

  renderMessages();
})();
