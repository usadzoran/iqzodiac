(() => {
  'use strict';

  const root = document.querySelector('#smart-assistant');
  if (!root) return;
  const log = root.querySelector('#smart-chat-log');
  const form = root.querySelector('#smart-chat-form');
  const input = root.querySelector('#smart-chat-input');
  const status = root.querySelector('#smart-chat-status');
  const send = root.querySelector('#smart-chat-send');
  const suggestions = root.querySelector('#smart-chat-suggestions');
  const guestMode = root.dataset.guest === 'true';
  const config = window.IQZodiacAssistantConfig || {};
  const apiBase = String(config.apiBase || '').trim() || (/github\.io$/i.test(window.location.hostname) ? '' : '/api/assistant/chat');
  const state = { history: [], busy: false, conversationId: '' };

  const language = () => {
    const current = String(document.documentElement.lang || navigator.language || 'en').toLowerCase();
    return ['ar', 'en', 'fr', 'es', 'pt', 'de'].find((code) => current.startsWith(code)) || 'en';
  };
  const copy = {
    ar: { kicker: 'ذكاء محدد الصلاحيات · مساعدة الموقع', titleTail: 'اسأل عن IQZodiac.', permissions: 'أشرح أقسام الموقع وخطوات استخدامها. لا أغيّر الحسابات أو المدفوعات ولا أكشف البيانات الخاصة.', placeholder: 'اكتب سؤالك عن IQZodiac…', send: 'إرسال', ready: 'المساعد جاهز.', thinking: 'جارٍ التفكير…', offline: 'المساعد غير متصل. تحقق من إعداد backend.', error: 'تعذر تنفيذ الطلب. حاول مرة أخرى.', empty: 'اكتب سؤالك أولًا.', intro: 'أستطيع شرح أقسام IQZodiac وخطوات استخدامها، مع احترام خصوصية حسابك.', suggestions: ['أين أجد رسائلي؟', 'كيف أخفي صوري؟', 'كيف أصبح VIP؟'] },
    en: { kicker: 'SCOPED AI · SITE HELP', titleTail: 'ask about IQZodiac.', permissions: 'Explains real site sections and navigation. Cannot change accounts or payments or reveal private data.', placeholder: 'Ask about IQZodiac…', send: 'Send', ready: 'Assistant ready.', thinking: 'Thinking…', offline: 'Assistant is not connected. Check the backend configuration.', error: 'The request failed. Please try again.', empty: 'Write your question first.', intro: 'I can explain IQZodiac sections and navigation while respecting your account privacy.', suggestions: ['Where can I find my messages?', 'How do I hide my photos?', 'How can I become VIP?'] },
    fr: { kicker: 'IA CIBLÉE · AIDE DU SITE', titleTail: 'à propos d’IQZodiac.', permissions: 'Explique les sections réelles et la navigation. Ne modifie pas les comptes ni les paiements.', placeholder: 'Posez une question sur IQZodiac…', send: 'Envoyer', ready: 'Assistant prêt.', thinking: 'Réflexion…', offline: 'Assistant non connecté. Vérifiez le backend.', error: 'Échec de la demande. Réessayez.', empty: 'Écrivez d’abord une question.', intro: 'Je peux expliquer les sections et la navigation d’IQZodiac en respectant votre confidentialité.', suggestions: ['Où trouver mes messages ?', 'Comment masquer mes photos ?', 'Comment devenir VIP ?'] },
    es: { kicker: 'IA LIMITADA · AYUDA DEL SITIO', titleTail: 'sobre IQZodiac.', permissions: 'Explica las secciones reales y la navegación. No modifica cuentas ni pagos.', placeholder: 'Pregunta sobre IQZodiac…', send: 'Enviar', ready: 'Asistente listo.', thinking: 'Pensando…', offline: 'Asistente desconectado. Comprueba el backend.', error: 'La solicitud falló. Inténtalo de nuevo.', empty: 'Escribe una pregunta primero.', intro: 'Puedo explicar las secciones y la navegación de IQZodiac respetando tu privacidad.', suggestions: ['¿Dónde están mis mensajes?', '¿Cómo oculto mis fotos?', '¿Cómo puedo ser VIP?'] },
    pt: { kicker: 'IA COM ESCOPO · AJUDA DO SITE', titleTail: 'sobre o IQZodiac.', permissions: 'Explica as seções reais e a navegação. Não altera contas nem pagamentos.', placeholder: 'Pergunte sobre o IQZodiac…', send: 'Enviar', ready: 'Assistente pronto.', thinking: 'Pensando…', offline: 'Assistente desconectado. Verifique o backend.', error: 'Falha na solicitação. Tente novamente.', empty: 'Escreva uma pergunta primeiro.', intro: 'Posso explicar as seções e a navegação do IQZodiac respeitando sua privacidade.', suggestions: ['Onde estão minhas mensagens?', 'Como oculto minhas fotos?', 'Como me torno VIP?'] },
    de: { kicker: 'BEGRENZTE KI · SEITENHILFE', titleTail: 'über IQZodiac.', permissions: 'Erklärt echte Bereiche und Navigation. Ändert keine Konten oder Zahlungen.', placeholder: 'Frage zu IQZodiac…', send: 'Senden', ready: 'Assistent bereit.', thinking: 'Denke nach…', offline: 'Assistent nicht verbunden. Backend prüfen.', error: 'Anfrage fehlgeschlagen. Bitte erneut versuchen.', empty: 'Schreibe zuerst eine Frage.', intro: 'Ich erkläre die Bereiche und Navigation von IQZodiac und respektiere deine Privatsphäre.', suggestions: ['Wo finde ich meine Nachrichten?', 'Wie verstecke ich meine Fotos?', 'Wie werde ich VIP?'] },
  };
  const t = (key) => (copy[language()] || copy.en)[key] || copy.en[key];
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

  function renderSuggestions() {
    if (!suggestions) return;
    suggestions.innerHTML = '';
    t('suggestions').forEach((question) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smart-suggestion';
      button.textContent = question;
      button.addEventListener('click', () => submit(question));
      suggestions.append(button);
    });
  }

  function renderCopy() {
    root.querySelector('#smart-assistant-kicker').textContent = t('kicker');
    root.querySelector('#smart-assistant-title-tail').textContent = t('titleTail');
    root.querySelector('#smart-assistant-permissions').textContent = t('permissions');
    input.placeholder = t('placeholder');
    send.textContent = t('send');
    status.textContent = state.busy ? t('thinking') : t('ready');
    root.classList.toggle('is-thinking', state.busy);
    renderSuggestions();
  }

  async function getAccessToken() {
    if (guestMode) return '';
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
    if (guestMode) {
      addMessage('assistant', language() === 'ar' ? 'سجّل الدخول أولًا لاستخدام مساعد IQZodiac.' : 'Please sign in first to use the IQZodiac assistant.');
      return;
    }
    if (!apiBase) { status.textContent = t('offline'); return; }
    state.busy = true;
    send.disabled = true;
    input.disabled = true;
    if (suggestions) suggestions.hidden = true;
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
    renderCopy();
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('unauthorized');
      const headers = { 'Content-Type': 'application/json' };
      const publishableKey = window.IQZodiacSupabase?.publishableKey;
      if (publishableKey) headers.apikey = publishableKey;
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(apiBase, { method: 'POST', headers, body: JSON.stringify({ message: text, history: guestMode ? [] : state.history.slice(-13, -1), conversationId: state.conversationId, guest: false }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.code || 'request_failed');
      addMessage('assistant', payload.answer || t('error'), payload.results || []);
      if (payload.conversationId) state.conversationId = payload.conversationId;
      state.history.push({ role: 'assistant', content: payload.answer || '' });
    } catch (error) {
      const message = error.message === 'unauthorized' ? (language() === 'ar' ? 'سجّل الدخول أولًا لاستخدام المساعد.' : 'Please sign in before using the assistant.') : t('error');
      addMessage('assistant', message);
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
