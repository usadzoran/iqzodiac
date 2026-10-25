(() => {
  'use strict';

  const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const messages = {
    en: {
      dbChecking: 'Checking the Supabase database…',
      dbConnected: (version) => `Supabase database connected · schema ${version}.`,
      dbUnavailable: 'Could not verify the Supabase database connection.',
      authRequired: 'Verified Supabase Auth is required. The current signup is local-only; localStorage roles never grant VIP access.',
      streamDisabled: 'Live streaming is disabled until a real WebRTC/HLS provider and signed playback flow are integrated.',
      backendMissing: 'The secure VIP API is not configured for this site origin. Set apiBaseUrl to the deployed backend before enabling access.',
      accessDenied: 'This account does not have a server-verified VIP role.',
      providerMissing: 'Your VIP role was verified, but the live video provider is not connected.',
      serviceUnavailable: 'The VIP access service is temporarily unavailable.',
      sessionsEmpty: 'No verified live sessions are available.',
    },
    ar: {
      dbChecking: 'جارٍ التحقق من قاعدة بيانات Supabase…',
      dbConnected: (version) => `قاعدة بيانات Supabase متصلة · إصدار المخطط ${version}.`,
      dbUnavailable: 'تعذّر التحقق من اتصال قاعدة بيانات Supabase.',
      authRequired: 'يلزم تسجيل دخول موثّق عبر Supabase Auth. التسجيل الحالي محلي فقط؛ ولا تمنح أدوار localStorage صلاحية VIP.',
      streamDisabled: 'البث معطّل حتى ربط مزوّد WebRTC/HLS حقيقي ومسار تشغيل موقّع وآمن.',
      backendMissing: 'واجهة VIP الخلفية الآمنة غير مضبوطة لهذا الموقع. عيّن apiBaseUrl إلى الخادم المنشور قبل تفعيل الوصول.',
      accessDenied: 'هذا الحساب لا يملك دور VIP موثّقًا من الخادم.',
      providerMissing: 'تم التحقق من دور VIP، لكن مزوّد الفيديو المباشر غير مربوط.',
      serviceUnavailable: 'خدمة التحقق من VIP غير متاحة مؤقتًا.',
      sessionsEmpty: 'لا توجد جلسات بث موثّقة متاحة الآن.',
    },
  };
  const t = messages[language];
  const byId = (id) => document.getElementById(id);
  const setStatus = (id, message, state) => {
    const element = byId(id);
    if (!element) return;
    element.textContent = message;
    if (state) element.dataset.state = state;
  };

  function showSessions(sessions) {
    const container = byId('vip-live-sessions');
    container.replaceChildren();
    if (!Array.isArray(sessions) || sessions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'vip-status';
      empty.textContent = t.sessionsEmpty;
      container.append(empty);
      return;
    }
    sessions.forEach((session) => {
      const card = document.createElement('article');
      card.className = 'vip-live-session';
      const title = document.createElement('h3');
      title.textContent = String(session.title || 'VIP live session');
      const description = document.createElement('p');
      description.textContent = String(session.description || '');
      card.append(title, description);
      container.append(card);
    });
  }

  async function initialize() {
    setStatus('vip-db-status', t.dbChecking, 'pending');
    try {
      const featureStatus = await window.IQZodiacVipData.getFeatureStatus();
      setStatus('vip-db-status', t.dbConnected(featureStatus.schema_version), 'ok');
      setStatus('vip-stream-status', t.streamDisabled, 'pending');
      setStatus('vip-access-status', t.authRequired, 'pending');

      if (!featureStatus.live_streaming_enabled) return;
      const config = await window.IQZodiacVipData.getConfig();
      const isGitHubPages = /(^|\.)github\.io$/i.test(window.location.hostname);
      if (isGitHubPages && !config.apiBaseUrl) {
        setStatus('vip-access-status', t.backendMissing, 'error');
        return;
      }

      const response = await fetch(await window.IQZodiacVipData.getLiveApiUrl(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) setStatus('vip-access-status', t.authRequired, 'error');
      else if (response.status === 403) setStatus('vip-access-status', t.accessDenied, 'error');
      else if (response.status === 503 && result.error?.code === 'stream_provider_not_connected') {
        setStatus('vip-access-status', t.providerMissing, 'pending');
        showSessions(result.sessions);
      } else if (!response.ok) setStatus('vip-access-status', t.serviceUnavailable, 'error');
      else {
        setStatus('vip-access-status', 'Verified VIP access.', 'ok');
        setStatus('vip-stream-status', 'Live provider connected.', 'ok');
        showSessions(result.sessions);
      }
    } catch {
      setStatus('vip-db-status', t.dbUnavailable, 'error');
      setStatus('vip-access-status', t.authRequired, 'error');
      setStatus('vip-stream-status', t.streamDisabled, 'pending');
    }
  }

  initialize();
})();
