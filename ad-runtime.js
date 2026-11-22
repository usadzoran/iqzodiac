(() => {
  'use strict';

  const slotNames = ['header', 'hero', 'feed_between', 'reels_between', 'footer'];
  const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const adDocument = (html) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{font-family:system-ui,sans-serif}</style></head><body>${html}</body></html>`;

  const frameFor = (ad) => {
    const frame = document.createElement('iframe');
    frame.className = 'site-ad-frame';
    frame.title = ad.name || 'Advertisement';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox');
    frame.style.height = `${Math.max(40, Math.min(600, Number(ad.height_px) || 100))}px`;
    frame.srcdoc = adDocument(ad.html_code);
    return frame;
  };

  const render = (slot, ads) => {
    const ad = ads.find((item) => item.placement === slot.dataset.adSlot);
    if (!ad) { slot.hidden = true; return; }
    slot.hidden = false;
    slot.replaceChildren(frameFor(ad));
    slot.dataset.adName = ad.name || '';
  };

  const placeDynamicSlot = (root, selector, slotName, afterIndex) => {
    const slot = root.querySelector(`[data-ad-slot="${slotName}"]`);
    if (!slot || slot.dataset.placed === 'true') return;
    const items = [...root.querySelectorAll(selector)];
    if (items.length <= afterIndex) return;
    items[afterIndex - 1].after(slot);
    slot.dataset.placed = 'true';
  };

  const init = async () => {
    const slots = [...document.querySelectorAll('[data-ad-slot]')];
    if (!slots.length || !window.IQZodiacSupabase?.ready) return;
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data, error } = await client.from('site_ads').select('id,name,placement,html_code,height_px,priority,starts_at,ends_at').in('placement', slotNames).order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(100);
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
    } catch (error) {
      // Ads are optional content. Never make the underlying feed unavailable.
      console.warn('Site ads could not be loaded.', error?.message || error);
    }
  };

  void init();
})();
