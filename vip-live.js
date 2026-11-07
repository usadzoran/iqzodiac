(() => {
  'use strict';

  const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const messages = {
    en: {
      dbChecking: 'Checking account services…',
      dbConnected: (version) => `Account services connected · release ${version}.`,
      dbUnavailable: 'Could not verify account services.',
      authRequired: 'Verified account access is required. Local browser roles never grant VIP access.',
      streamDisabled: 'Live streaming is disabled until a real WebRTC/HLS provider and signed playback flow are integrated.',
      backendMissing: 'The secure VIP API is not configured for this site origin. Set apiBaseUrl to the deployed backend before enabling access.',
      accessDenied: 'This account does not have a server-verified VIP role.',
      providerMissing: 'Your VIP role was verified, but the live video provider is not connected.',
      serviceUnavailable: 'The VIP access service is temporarily unavailable.',
      sessionsEmpty: 'No verified live sessions are available.',
    },
    ar: {
      dbChecking: 'جارٍ التحقق من خدمات الحساب…',
      dbConnected: (version) => `خدمات الحساب متصلة · الإصدار ${version}.`,
      dbUnavailable: 'تعذّر التحقق من خدمات الحساب.',
      authRequired: 'يلزم وصول موثّق إلى الحساب. لا تمنح أدوار المتصفح المحلية صلاحية VIP.',
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
  let selectedSessionId = null;
  let selectedGift = null;
  let availableCoins = null;
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
      const category = document.createElement('span');
      category.className = 'vip-live-session-category';
      category.textContent = String(session.category || 'General');
      const description = document.createElement('p');
      description.textContent = String(session.description || '');
      const choose = document.createElement('button');
      choose.type = 'button'; choose.className = 'vip-gift-session-button'; choose.textContent = 'Open gift picker';
      choose.addEventListener('click', () => { selectedSessionId = session.id; loadGiftPicker(); });
      card.append(category, title, description, choose);
      container.append(card);
    });
  }

  function renderGifts(gifts) {
    const levels = byId('vip-gift-levels');
    if (!levels) return;
    levels.replaceChildren();
    const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
    gifts.forEach((gift) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'vip-gift-choice'; button.setAttribute('role', 'listitem');
      const image = document.createElement('img'); image.src = gift.asset_path || `./assets/gifts/${gift.icon_asset_ref}.svg`; image.alt = gift[language === 'ar' ? 'name_ar' : 'name_en'] || gift.name;
      const name = document.createElement('strong'); name.textContent = image.alt;
      const price = document.createElement('small'); price.textContent = `${gift.price_coins} coins · $${Number(gift.usd_value || 0).toFixed(2)}`;
      button.append(image, name, price); button.addEventListener('click', () => { selectedGift = gift; levels.querySelectorAll('.vip-gift-choice').forEach((item) => item.classList.remove('is-selected')); button.classList.add('is-selected'); updateGiftTotal(); }); levels.append(button);
    });
  }
  function updateGiftTotal() {
    const quantity = Number(byId('vip-gift-quantity')?.value || 1); const total = selectedGift ? Number(selectedGift.price_coins) * quantity : 0;
    setStatus('vip-gift-status', selectedGift ? `You are about to send ${quantity} × ${selectedGift.name_en || selectedGift.name} for ${total} coins.` : 'Select a gift to preview the exact coin amount.', selectedGift && (availableCoins === null || availableCoins >= total) ? 'ok' : 'pending');
    const send = byId('vip-send-gift'); if (send) send.disabled = !selectedGift || !selectedSessionId || availableCoins !== null && availableCoins < total;
  }
  async function loadGiftPicker() {
    const panel = byId('vip-gift-panel'); if (!panel) return; panel.hidden = false;
    try {
      const [gifts, client] = await Promise.all([window.IQZodiacData.adapter.listGifts(), window.IQZodiacSupabase.ready]);
      const { data } = await client.from('vip_wallets').select('spendable_coins').maybeSingle(); availableCoins = data ? Number(data.spendable_coins) : 0;
      byId('vip-gift-balance').textContent = `${availableCoins.toLocaleString()} coins`; renderGifts(gifts); updateGiftTotal();
    } catch { setStatus('vip-gift-status', 'Gift catalog is unavailable. No coins were deducted.', 'error'); }
  }
  byId('vip-gift-quantity')?.addEventListener('change', updateGiftTotal);
  byId('vip-broadcast-category')?.addEventListener('change', (event) => { try { window.localStorage.setItem('iqzodiac-live-category', event.target.value); } catch { /* Keep category selection usable without storage. */ } });
  byId('vip-send-gift')?.addEventListener('click', async () => {
    if (!selectedGift || !selectedSessionId) return;
    const send = byId('vip-send-gift'); send.disabled = true;
    try { await window.IQZodiacData.adapter.sendGift({ liveSessionId: selectedSessionId, giftId: selectedGift.id, quantity: Number(byId('vip-gift-quantity').value), idempotencyKey: crypto.randomUUID() }); setStatus('vip-gift-status', 'Gift sent successfully. The live notification will appear for viewers.', 'ok'); await loadGiftPicker(); }
    catch (error) { setStatus('vip-gift-status', error?.message === 'insufficient_coins' ? 'Insufficient coins. Visit My Wallet to buy coins when purchasing is enabled.' : 'Gift was not sent. No balance was deducted.', 'error'); updateGiftTotal(); }
  });

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
