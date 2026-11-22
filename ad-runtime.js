(() => {
  'use strict';

  const pageSection = () => document.body?.dataset.adSection || 'all';
  const placementsFor = (ad) => Array.isArray(ad.placements) && ad.placements.length ? ad.placements : [ad.placement];
  const sectionsFor = (ad) => Array.isArray(ad.sections) && ad.sections.length ? ad.sections : [ad.placement === 'reels_between' ? 'reels' : 'home'];
  const eligible = (ad, slot) => placementsFor(ad).includes(slot.dataset.adSlot) && (sectionsFor(ad).includes('all') || sectionsFor(ad).includes(pageSection()));
  const currentlyActive = (ad, now) => {
    if (ad.is_active !== true) return false;
    const startsAt = ad.starts_at ? Date.parse(ad.starts_at) : null;
    const endsAt = ad.ends_at ? Date.parse(ad.ends_at) : null;
    if (ad.starts_at && (!Number.isFinite(startsAt) || startsAt > now)) return false;
    if (ad.ends_at && (!Number.isFinite(endsAt) || endsAt <= now)) return false;
    return true;
  };
  const sessionKey = (() => {
    try {
      const key = 'iqzodiac-ad-session';
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const value = `${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}-${Date.now()}`;
      localStorage.setItem(key, value);
      return value;
    } catch {
      return `${Date.now()}-${Math.random()}-iqzodiac`;
    }
  })();
  const contentSlotAnchors = {
    assistant: '.smart-assistant',
    audio_rooms: '.rooms-category-cards',
    daily: '.daily-grid',
    discover: '.discover-grid',
    home: '.home-layout',
    landing: '.actions',
    live: '.rooms-category-cards',
    marketplace: '.marketplace-toolbar',
    match: '.match-filters',
    messages: '.messages-panel',
    movies: '[aria-label="Movie collection"]',
    profile: '.profile-activity-shell',
    reel_profile: '.body3d-visitor-card, .reel-profile-collections',
    reels: '#reel-feed',
    rooms: '.spaces-grid',
    vip: '.vip-card',
    vip_live: '.vip-card',
    wallet: '.balance-grid',
    youtube: '#youtube-search-card'
  };
  let clientPromise;
  let client;
  let ads = [];
  let refreshPromise;

  const createSlot = (name) => {
    const slot = document.createElement('div');
    slot.className = 'site-ad-slot global-site-ad-slot';
    slot.dataset.adSlot = name;
    slot.hidden = true;
    return slot;
  };
  const addAfter = (anchor, slot) => {
    if (anchor?.parentNode) anchor.after(slot);
    return slot;
  };
  const ensurePageSlots = () => {
    const section = pageSection();
    if (section === 'all') return;
    const main = document.querySelector('main') || document.body;
    const existing = (name) => document.querySelector(`[data-ad-slot="${name}"]`);

    if (!existing('header')) {
      const slot = createSlot('header');
      const pageHeader = main.querySelector(':scope > header, :scope > nav');
      if (pageHeader) addAfter(pageHeader, slot);
      else main.prepend(slot);
    }

    if (!existing('hero')) {
      const slot = createSlot('hero');
      const selector = contentSlotAnchors[section];
      const contentAnchor = selector ? main.querySelector(selector) : null;
      if (contentAnchor) contentAnchor.before(slot);
      else {
        const firstSection = main.querySelector(':scope > section, :scope > article');
        if (firstSection) firstSection.before(slot);
        else main.append(slot);
      }
    }

    if (!existing('footer')) {
      const slot = createSlot('footer');
      const footer = document.querySelector('footer.footer, main > footer');
      if (footer?.parentNode) footer.before(slot);
      else main.append(slot);
    }
  };

  const record = async (adId, eventType) => {
    try {
      clientPromise ||= window.IQZodiacSupabase?.ready;
      const resolvedClient = await clientPromise;
      if (resolvedClient) await resolvedClient.rpc('record_site_ad_event', { p_ad_id: adId, p_event_type: eventType, p_session_key: sessionKey });
    } catch (error) {
      console.debug('Ad analytics event skipped.', error?.message || error);
    }
  };

  const adDocument = (html, adId) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{font-family:system-ui,sans-serif}</style></head><body>${html}<script>document.addEventListener('click',function(event){var link=event.target&&event.target.closest?event.target.closest('a[href]'):null;if(event.isTrusted&&link&&(!link.target||link.target==='_self')){try{var destination=new URL(link.href,document.baseURI);if(destination.protocol==='http:'||destination.protocol==='https:')link.target='_top'}catch(_){}}parent.postMessage({type:'iqzodiac-ad-click',adId:${JSON.stringify(adId)}},'*')},true);<\/script></body></html>`;

  const versionFor = (ad) => {
    const source = `${ad.id}|${ad.updated_at || ''}|${ad.name || ''}|${ad.height_px || ''}|${ad.html_code || ''}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    return (hash >>> 0).toString(36);
  };

  const frameFor = (ad) => {
    const frame = document.createElement('iframe');
    frame.className = 'site-ad-frame';
    frame.title = ad.name || 'Advertisement';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox', 'allow-top-navigation-by-user-activation');
    frame.style.height = `${Math.max(40, Math.min(600, Number(ad.height_px) || 100))}px`;
    frame.srcdoc = adDocument(ad.html_code, ad.id);
    frame.dataset.adId = String(ad.id);
    frame.dataset.adVersion = versionFor(ad);
    return frame;
  };

  const render = (slot) => {
    const ad = ads.find((item) => eligible(item, slot));
    if (!ad) {
      if (!slot.hidden) slot.hidden = true;
      if (slot.childNodes.length) slot.replaceChildren();
      delete slot.dataset.adName;
      return;
    }
    slot.hidden = false;
    const currentFrame = slot.querySelector('.site-ad-frame');
    if (currentFrame && currentFrame.dataset.adId === String(ad.id) && currentFrame.dataset.adVersion === versionFor(ad)) return;
    const frame = frameFor(ad);
    slot.replaceChildren(frame);
    slot.dataset.adName = ad.name || '';
    if (typeof IntersectionObserver === 'function') {
      const viewObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void record(ad.id, 'view');
          viewObserver.disconnect();
        }
      }, { threshold: 0.5 });
      viewObserver.observe(frame);
    }
  };

  const placeDynamicSlot = (root, selector, slotName, afterIndex) => {
    if (!root) return;
    const slot = document.querySelector(`[data-ad-slot="${slotName}"]`);
    if (!slot || slot.dataset.placed === 'true') return;
    const items = [...root.querySelectorAll(selector)];
    if (items.length < afterIndex) return;
    items[afterIndex - 1].after(slot);
    slot.dataset.placed = 'true';
  };

  const renderAll = () => {
    ensurePageSlots();
    const slots = [...document.querySelectorAll('[data-ad-slot]')];
    slots.filter((slot) => !['feed_between', 'reels_between'].includes(slot.dataset.adSlot)).forEach(render);
    const homeRoot = document.querySelector('#feed-list');
    const reelsRoot = document.querySelector('#reel-feed');
    placeDynamicSlot(homeRoot?.parentElement || document, '#feed-list .post-card', 'feed_between', 3);
    placeDynamicSlot(reelsRoot, '.reel-card', 'reels_between', 3);
    slots.filter((slot) => ['feed_between', 'reels_between'].includes(slot.dataset.adSlot)).forEach(render);
  };

  const loadAds = async () => {
    if (!client) return;
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const { data, error } = await client.from('site_ads').select('id,name,placement,placements,sections,html_code,height_px,priority,is_active,starts_at,ends_at,created_at,updated_at').order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const now = Date.now();
      ads = (data || []).filter((ad) => currentlyActive(ad, now));
      renderAll();
    })();
    try {
      await refreshPromise;
    } catch (error) {
      console.warn('Site ads could not be refreshed.', error?.message || error);
    } finally {
      refreshPromise = null;
    }
  };

  window.addEventListener('message', (event) => {
    if (event.data?.type !== 'iqzodiac-ad-click' || !event.data.adId) return;
    const iframe = [...document.querySelectorAll('.site-ad-frame')].find((item) => item.contentWindow === event.source && item.dataset.adId === String(event.data.adId));
    if (iframe) void record(event.data.adId, 'click');
  });

  const init = async () => {
    if (!document.body?.dataset.adSection || !window.IQZodiacSupabase?.ready) return;
    try {
      ensurePageSlots();
      client = await window.IQZodiacSupabase.ready;
      clientPromise = Promise.resolve(client);
      const observedRoot = document.querySelector('main') || document.body;
      if (observedRoot && typeof MutationObserver === 'function') {
        const observer = new MutationObserver(renderAll);
        observer.observe(observedRoot, { childList: true, subtree: true });
      }
      await loadAds();
      window.addEventListener('focus', () => { void loadAds(); });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void loadAds();
      });
      window.setInterval(() => {
        if (document.visibilityState === 'visible') void loadAds();
      }, 60_000);
    } catch (error) {
      console.warn('Site ads could not be initialized.', error?.message || error);
    }
  };

  void init();
})();
