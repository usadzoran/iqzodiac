(() => {
  'use strict';

  const slotNames = ['header', 'hero', 'feed_between', 'reels_between', 'footer'];
  const pageSection = () => document.body?.dataset.adSection || 'all';
  const placementsFor = (ad) => Array.isArray(ad.placements) && ad.placements.length ? ad.placements : [ad.placement];
  const sectionsFor = (ad) => Array.isArray(ad.sections) && ad.sections.length ? ad.sections : [ad.placement === 'reels_between' ? 'reels' : 'home'];
  const eligible = (ad, slot) => placementsFor(ad).includes(slot.dataset.adSlot) && (sectionsFor(ad).includes('all') || sectionsFor(ad).includes(pageSection()));
  const sessionKey = (() => { try { const key = 'iqzodiac-ad-session'; const existing = localStorage.getItem(key); if (existing) return existing; const value = `${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}-${Date.now()}`; localStorage.setItem(key, value); return value; } catch { return `${Date.now()}-${Math.random()}-iqzodiac`; } })();
  let clientPromise;

  const record = async (adId, eventType) => {
    try {
      clientPromise ||= window.IQZodiacSupabase?.ready;
      const client = await clientPromise;
      if (client) await client.rpc('record_site_ad_event', { p_ad_id: adId, p_event_type: eventType, p_session_key: sessionKey });
    } catch (error) { console.debug('Ad analytics event skipped.', error?.message || error); }
  };

  const adDocument = (html, adId) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{font-family:system-ui,sans-serif}</style></head><body>${html}<script>document.addEventListener('click',function(){parent.postMessage({type:'iqzodiac-ad-click',adId:${JSON.stringify(adId)}},'*')},true);<\/script></body></html>`;

  const frameFor = (ad) => {
    const frame = document.createElement('iframe');
    frame.className = 'site-ad-frame';
    frame.title = ad.name || 'Advertisement';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox');
    frame.style.height = `${Math.max(40, Math.min(600, Number(ad.height_px) || 100))}px`;
    frame.srcdoc = adDocument(ad.html_code, ad.id);
    frame.dataset.adId = ad.id;
    return frame;
  };

  const render = (slot, ads) => {
    const ad = ads.find((item) => eligible(item, slot));
    if (!ad) { slot.hidden = true; return; }
    slot.hidden = false;
    const frame = frameFor(ad);
    slot.replaceChildren(frame);
    slot.dataset.adName = ad.name || '';
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { void record(ad.id, 'view'); observer.disconnect(); } }, { threshold: 0.5 });
    observer.observe(frame);
  };

  const placeDynamicSlot = (root, selector, slotName, afterIndex) => {
    const slot = root.querySelector(`[data-ad-slot="${slotName}"]`);
    if (!slot || slot.dataset.placed === 'true') return;
    const items = [...root.querySelectorAll(selector)];
    if (items.length <= afterIndex) return;
    items[afterIndex - 1].after(slot);
    slot.dataset.placed = 'true';
  };

  window.addEventListener('message', (event) => {
    if (event.data?.type !== 'iqzodiac-ad-click' || !event.data.adId) return;
    const iframe = [...document.querySelectorAll('.site-ad-frame')].find((item) => item.contentWindow === event.source && item.dataset.adId === event.data.adId);
    if (iframe) void record(event.data.adId, 'click');
  });

  const init = async () => {
    const slots = [...document.querySelectorAll('[data-ad-slot]')];
    if (!slots.length || !window.IQZodiacSupabase?.ready) return;
    try {
      const client = await window.IQZodiacSupabase.ready;
      clientPromise = Promise.resolve(client);
      const { data, error } = await client.from('site_ads').select('id,name,placement,placements,sections,html_code,height_px,priority,starts_at,ends_at').order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const ads = data || [];
      slots.filter((slot) => !['feed_between', 'reels_between'].includes(slot.dataset.adSlot)).forEach((slot) => render(slot, ads));
      const homeRoot = document.querySelector('#feed-list');
      const reelsRoot = document.querySelector('#reel-feed');
      const place = () => {
        if (homeRoot) { placeDynamicSlot(homeRoot.parentElement || document, '#feed-list .post-card', 'feed_between', 3); const slot = document.querySelector('[data-ad-slot="feed_between"]'); if (slot && slot.dataset.placed === 'true') render(slot, ads); }
        if (reelsRoot) { placeDynamicSlot(reelsRoot, '.reel-card', 'reels_between', 3); const slot = document.querySelector('[data-ad-slot="reels_between"]'); if (slot && slot.dataset.placed === 'true') render(slot, ads); }
      };
      place();
      if (homeRoot || reelsRoot) new MutationObserver(place).observe(homeRoot || reelsRoot, { childList: true, subtree: true });
    } catch (error) { console.warn('Site ads could not be loaded.', error?.message || error); }
  };

  void init();
})();
