(() => {
  'use strict';

  const root = document.querySelector('#smart-assistant');
  if (!root) return;
  const log = root.querySelector('#smart-chat-log');
  const form = root.querySelector('#smart-chat-form');
  const input = root.querySelector('#smart-chat-input');
  const status = root.querySelector('#smart-chat-status');
  const send = root.querySelector('#smart-chat-send');
  const config = window.IQZodiacAssistantConfig || {};
  const apiBase = String(config.apiBase || '').trim() || (/github\.io$/i.test(window.location.hostname) ? '' : '/api/assistant/chat');
  const state = { history: [], busy: false, conversationId: '' };

  const language = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const copy = {
    ar: { kicker: 'ذكاء محدد الصلاحيات · مساعدة الموقع · بحث', titleTail: 'اسأل سؤالًا مفيدًا.', permissions: 'أشرح الموقع وأبحث في YouTube والأفلام والشخصيات. لا أملك صلاحية إدارة الحسابات أو تغيير المدفوعات أو كشف البيانات الخاصة.', placeholder: 'اكتب سؤالك عن IQZodiac أو ابحث عن فيديو أو فيلم أو شخصية…', send: 'إرسال', ready: 'المساعد جاهز ضمن صلاحيات الموقع.', thinking: 'جارٍ التفكير والبحث…', offline: 'المساعد غير متصل. اضبط رابط backend في assistant-config.js.', error: 'تعذر تنفيذ الطلب. حاول مرة أخرى.', empty: 'اكتب سؤالًا أو عبارة بحث أولًا.', intro: 'أستطيع شرح صفحات الموقع والبحث في YouTube والأفلام والشخصيات. لا أملك صلاحيات الإدارة أو تغيير حسابك.' },
    en: { kicker: 'SCOPED AI · SITE HELP · SEARCH', titleTail: 'anything useful.', permissions: 'Can explain the site, search YouTube, films, and characters. Cannot administer accounts, change payments, or reveal private data.', placeholder: 'Ask about IQZodiac, or search for a video, film, or character…', send: 'Send', ready: 'Assistant ready with website-scoped permissions.', thinking: 'Thinking and searching…', offline: 'Assistant is not connected. Configure the backend URL in assistant-config.js.', error: 'The request failed. Please try again.', empty: 'Write a question or search phrase first.', intro: 'I can explain IQZodiac, search YouTube, and search films or characters. I cannot administer accounts or change private data.' },
  };
  const t = (key) => copy[language()][key] || copy.en[key];
  const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function addMessage(role, text, results = []) {
    const item = document.createElement('article');
    item.className = `smart-message smart-message-${role}`;
    item.innerHTML = `<div class="smart-message-label">${role === 'user' ? (language() === 'ar' ? 'أنت' : 'You') : 'IQZodiac'}</div><p>${escape(text)}</p>`;
    if (Array.isArray(results) && results.length) {
      const list = document.createElement('div');
      list.className = 'smart-search-results';
      results.slice(0, 8).forEach((result) => {
        const link = document.createElement('a');
        link.className = 'smart-search-result';
        link.target = result.type === 'video' ? '_blank' : '_self';
        link.rel = result.type === 'video' ? 'noopener noreferrer' : '';
        link.href = result.url || `./youtube.html?q=${encodeURIComponent(result.title || '')}`;
        link.innerHTML = `<strong>${escape(result.title)}</strong><small>${escape(result.channel || result.date || result.type || '')}</small>`;
        list.append(link);
      });
      item.append(list);
    }
    log.append(item);
    log.scrollTop = log.scrollHeight;
  }

  function renderCopy() {
    root.querySelector('#smart-assistant-kicker').textContent = t('kicker');
    root.querySelector('#smart-assistant-title-tail').textContent = t('titleTail');
    root.querySelector('#smart-assistant-permissions').textContent = t('permissions');
    input.placeholder = t('placeholder');
    send.textContent = t('send');
    status.textContent = state.busy ? t('thinking') : t('ready');
  }

  async function getAccessToken() {
    try {
      const client = await window.IQZodiacSupabase?.ready;
      const { data } = await client.auth.getSession();
      return data.session?.access_token || '';
    } catch { return ''; }
  }

  async function submit(message) {
    if (state.busy) return;
    const text = message.trim();
    if (!text) { status.textContent = t('empty'); return; }
    if (!apiBase) { status.textContent = t('offline'); return; }
    state.busy = true;
    send.disabled = true;
    input.disabled = true;
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
    renderCopy();
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('unauthorized');
      const response = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: text, history: state.history.slice(-13, -1), conversationId: state.conversationId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.code || 'request_failed');
      addMessage('assistant', payload.answer || t('error'), payload.results || []);
      if (payload.conversationId) state.conversationId = payload.conversationId;
      state.history.push({ role: 'assistant', content: payload.answer || '' });
    } catch (error) {
      addMessage('assistant', error.message === 'unauthorized' ? (language() === 'ar' ? 'سجّل الدخول أولًا لاستخدام المساعد.' : 'Please sign in before using the assistant.') : t('error'));
    } finally {
      state.busy = false;
      send.disabled = false;
      input.disabled = false;
      input.value = '';
      renderCopy();
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); submit(input.value); });
  document.addEventListener('iqzodiac:languagechange', () => { renderCopy(); });
  addMessage('assistant', t('intro'));
  renderCopy();
})();
