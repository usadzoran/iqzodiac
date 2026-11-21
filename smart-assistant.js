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
  const config = window.IQZodiacAssistantConfig || {};
  const apiBase = String(config.apiBase || '').trim() || (/github\.io$/i.test(window.location.hostname) ? '' : '/api/assistant/chat');
  const state = { history: [], busy: false, conversationId: '', notice: '' };
  let currentSession = null;
  let currentUserId = '';
  let authRevision = 0;

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

  const errorCopy = {
    ar: { signIn: 'سجّل الدخول أولًا لاستخدام المساعد.', expired: 'انتهت الجلسة أو لم تعد صالحة. سجّل الدخول مجددًا.', forbidden: 'لا تملك صلاحية استخدام المساعد.', notFound: 'تعذر العثور على خدمة المساعد.', rateLimited: 'أرسلت طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.', server: 'حدث خطأ في خادم المساعد. حاول لاحقًا.', service: 'خدمة المساعد غير متاحة مؤقتًا. حاول لاحقًا.', setup: 'المساعد غير مهيأ حاليًا. يرجى التواصل مع الدعم.', network: 'تعذر الاتصال بالمساعد. تحقق من اتصالك وحاول مجددًا.', generic: 'تعذر تنفيذ الطلب. حاول مرة أخرى.' },
    en: { signIn: 'Please sign in to use the assistant.', expired: 'Your session expired or is no longer valid. Please sign in again.', forbidden: 'Your account is not allowed to use the assistant.', notFound: 'The assistant service could not be found.', rateLimited: 'Too many requests. Wait a moment and try again.', server: 'The assistant server encountered an error. Please try again later.', service: 'The assistant service is temporarily unavailable. Please try again later.', setup: 'The assistant is not configured. Please contact support.', network: 'Could not connect to the assistant. Check your connection and try again.', generic: 'The request failed. Please try again.' },
    fr: { signIn: 'Connectez-vous pour utiliser l’assistant.', expired: 'Votre session a expiré ou n’est plus valide. Reconnectez-vous.', forbidden: 'Votre compte n’est pas autorisé à utiliser l’assistant.', notFound: 'Le service de l’assistant est introuvable.', rateLimited: 'Trop de demandes. Attendez un instant puis réessayez.', server: 'Le serveur de l’assistant a rencontré une erreur. Réessayez plus tard.', service: 'Le service de l’assistant est temporairement indisponible.', setup: 'L’assistant n’est pas configuré. Contactez le support.', network: 'Impossible de joindre l’assistant. Vérifiez votre connexion.', generic: 'La demande a échoué. Veuillez réessayer.' },
    es: { signIn: 'Inicia sesión para usar el asistente.', expired: 'Tu sesión expiró o ya no es válida. Inicia sesión otra vez.', forbidden: 'Tu cuenta no tiene permiso para usar el asistente.', notFound: 'No se encontró el servicio del asistente.', rateLimited: 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.', server: 'El servidor del asistente tuvo un error. Inténtalo más tarde.', service: 'El servicio del asistente no está disponible temporalmente.', setup: 'El asistente no está configurado. Contacta con soporte.', network: 'No se pudo conectar con el asistente. Comprueba tu conexión.', generic: 'La solicitud falló. Inténtalo de nuevo.' },
    pt: { signIn: 'Inicie sessão para usar o assistente.', expired: 'Sua sessão expirou ou não é mais válida. Entre novamente.', forbidden: 'Sua conta não tem permissão para usar o assistente.', notFound: 'O serviço do assistente não foi encontrado.', rateLimited: 'Muitas solicitações. Aguarde um momento e tente novamente.', server: 'O servidor do assistente encontrou um erro. Tente mais tarde.', service: 'O serviço do assistente está temporariamente indisponível.', setup: 'O assistente não está configurado. Fale com o suporte.', network: 'Não foi possível conectar ao assistente. Verifique sua conexão.', generic: 'A solicitação falhou. Tente novamente.' },
    de: { signIn: 'Bitte melde dich an, um den Assistenten zu verwenden.', expired: 'Deine Sitzung ist abgelaufen oder ungültig. Bitte melde dich erneut an.', forbidden: 'Dein Konto darf den Assistenten nicht verwenden.', notFound: 'Der Assistentendienst wurde nicht gefunden.', rateLimited: 'Zu viele Anfragen. Warte kurz und versuche es erneut.', server: 'Der Assistentenserver ist auf einen Fehler gestoßen. Versuche es später erneut.', service: 'Der Assistentendienst ist vorübergehend nicht verfügbar.', setup: 'Der Assistent ist nicht eingerichtet. Bitte wende dich an den Support.', network: 'Verbindung zum Assistenten fehlgeschlagen. Prüfe deine Verbindung.', generic: 'Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.' },
  };
  const errorText = (key) => (errorCopy[language()] || errorCopy.en)[key] || errorCopy.en.generic;
  const safeErrorCode = (value) => /^[a-z0-9_-]{1,64}$/i.test(String(value || '')) ? String(value) : 'request_failed';
  const makeError = (code, statusCode = 0) => Object.assign(new Error('assistant_request_failed'), { code: safeErrorCode(code), status: Number(statusCode) || 0 });
  const sessionFailure = (error) => {
    const statusCode = Number(error?.status) || 0;
    const code = String(error?.code || '').toLowerCase();
    return statusCode === 400 || statusCode === 401 || /refresh.*(invalid|not_found|expired|already_used)|session.*expired/.test(code)
      ? makeError('session_expired', statusCode || 401)
      : makeError('session_unavailable', statusCode);
  };
  const authClientPromise = (async () => {
    const client = await window.IQZodiacSupabase?.ready;
    if (!client?.auth?.getSession) throw makeError('supabase_unavailable');
    const { data, error } = await client.auth.getSession();
    if (error) throw sessionFailure(error);
    currentSession = data?.session || null;
    currentUserId = currentSession?.user?.id || '';
    client.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id || '';
      if (event === 'SIGNED_OUT' || (currentUserId && currentUserId !== nextUserId)) {
        authRevision += 1;
        state.history = [];
        state.conversationId = '';
      }
      currentSession = session || null;
      currentUserId = nextUserId;
    });
    return client;
  })().catch((error) => {
    console.error('Assistant auth initialization failed', { code: safeErrorCode(error?.code || error?.name) });
    return null;
  });

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
    status.textContent = state.busy ? t('thinking') : (state.notice || t('ready'));
    root.classList.toggle('is-thinking', state.busy);
    renderSuggestions();
  }

  async function getAuthenticatedSession() {
    const client = await authClientPromise;
    if (!client) throw makeError('supabase_unavailable');
    const { data, error } = await client.auth.getSession();
    if (error) throw sessionFailure(error);
    let session = data?.session || null;
    const expiresAt = Number(session?.expires_at || 0);
    if (session?.access_token && expiresAt && expiresAt <= (Date.now() / 1000) + 30) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error) throw sessionFailure(refreshed.error);
      session = refreshed.data?.session || null;
    }
    if (!session?.access_token) throw makeError('no_active_session', 401);
    currentSession = session;
    currentUserId = session.user?.id || '';
    return { client, session, revision: authRevision };
  }

  async function submit(message) {
    if (state.busy) return;
    const text = String(message || '').trim();
    if (!text) { status.textContent = t('empty'); return; }
    if (!apiBase) { state.notice = t('offline'); renderCopy(); return; }
    state.busy = true;
    state.notice = '';
    send.disabled = true;
    input.disabled = true;
    if (suggestions) suggestions.hidden = true;
    renderCopy();
    try {
      const auth = await getAuthenticatedSession();
      const token = auth.session.access_token;
      const publishableKey = window.IQZodiacSupabase?.publishableKey;
      if (!publishableKey) throw makeError('auth_not_configured', 503);
      addMessage('user', text);
      state.history.push({ role: 'user', content: text });
      const headers = { 'Content-Type': 'application/json', apikey: publishableKey, Authorization: `Bearer ${token}` };
      const response = await fetch(apiBase, { method: 'POST', headers, body: JSON.stringify({ message: text, history: state.history.slice(-13, -1), conversationId: state.conversationId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw makeError(payload.error?.code || payload.code || 'request_failed', response.status);
      if (auth.revision !== authRevision || currentUserId !== (auth.session.user?.id || '')) throw makeError('session_expired', 401);
      addMessage('assistant', payload.answer || t('error'), payload.results || []);
      if (payload.conversationId) state.conversationId = payload.conversationId;
      state.history.push({ role: 'assistant', content: payload.answer || '' });
    } catch (error) {
      const statusCode = Number(error?.status) || 0;
      const code = safeErrorCode(error?.code || (error instanceof TypeError ? 'network_error' : 'request_failed'));
      let messageKey = 'generic';
      if (code === 'no_active_session') messageKey = 'signIn';
      else if (statusCode === 401 || code === 'session_expired') messageKey = 'expired';
      else if (statusCode === 403) messageKey = 'forbidden';
      else if (statusCode === 404) messageKey = 'notFound';
      else if (statusCode === 429) messageKey = 'rateLimited';
      else if (statusCode === 500) messageKey = 'server';
      else if (statusCode === 503) messageKey = ['ai_not_configured', 'auth_not_configured'].includes(code) ? 'setup' : 'service';
      else if (['network_error', 'supabase_unavailable', 'session_unavailable'].includes(code)) messageKey = 'network';
      state.notice = errorText(messageKey);
      console.error('Assistant request failed', { httpStatus: statusCode || null, errorCode: code });
      if (statusCode === 401 || code === 'session_expired' || code === 'no_active_session') {
        state.history = [];
        state.conversationId = '';
      }
      addMessage('assistant', state.notice);
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
