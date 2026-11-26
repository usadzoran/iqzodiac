(() => {
  'use strict';
  const location = document.body.dataset.siteLocation;
  if (!location) return;

  let rows = [];
  let wrapper = null;
  let pending = false;
  let loading = false;
  const isArabic = () => window.IQZodiacLanguage?.language === 'ar' || document.documentElement.lang.toLowerCase().startsWith('ar');

  const render = () => {
    const main = document.querySelector('main');
    if (!main) return;
    if (!rows.length) {
      wrapper?.remove();
      wrapper = null;
      return;
    }
    if (!wrapper || !wrapper.isConnected) {
      wrapper = document.createElement('section');
      wrapper.className = 'managed-site-sections';
      wrapper.dataset.managedSiteLocation = location;
      const heading = main.querySelector(':scope > header');
      if (heading) heading.after(wrapper);
      else main.prepend(wrapper);
    }
    const ar = isArabic();
    wrapper.setAttribute('aria-label', ar ? 'أقسام الموقع' : 'Website sections');
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const card = document.createElement('article');
      card.className = 'managed-site-section';
      const heading = document.createElement('h2');
      heading.textContent = ar ? (row.title_ar || row.title_en) : (row.title_en || row.title_ar);
      const body = document.createElement('p');
      body.textContent = ar ? (row.body_ar || row.body_en) : (row.body_en || row.body_ar);
      body.dir = ar ? 'rtl' : 'ltr';
      card.append(heading, body);
      fragment.append(card);
    }
    wrapper.replaceChildren(fragment);
  };

  const refresh = async () => {
    if (loading) { pending = true; return; }
    loading = true;
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data, error } = await client.from('site_pages')
        .select('slug,title_en,title_ar,body_en,body_ar,sort_order')
        .eq('content_type', 'section').eq('display_location', location).eq('is_published', true)
        .order('sort_order').order('title_en').limit(100);
      if (error) throw error;
      rows = data || [];
      render();
    } catch (error) {
      rows = [];
      render();
      console.warn('Site sections unavailable.', error);
    } finally {
      loading = false;
      if (pending) { pending = false; void refresh(); }
    }
  };

  document.addEventListener('iqzodiac:languagechange', render);
  window.addEventListener('focus', () => void refresh());
  window.addEventListener('pageshow', () => void refresh());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void refresh(), { once: true });
  else void refresh();
})();
