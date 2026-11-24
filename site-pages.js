(() => {
  'use strict';
  const query = new URLSearchParams(window.location.search);
  const slug = query.get('slug');
  const status = document.querySelector('#site-pages-status');
  const list = document.querySelector('#site-pages-list');
  const article = document.querySelector('#site-page-article');
  const title = document.querySelector('#site-page-title');
  const body = document.querySelector('#site-page-content');
  const pageRows = [];
  let currentPage = null;
  const copy = (english, arabic) => (window.IQZodiacLanguage?.language === 'ar' ? arabic : english);
  const localizeStaticCopy = () => {
    document.querySelectorAll('[data-copy-en][data-copy-ar]').forEach((node) => {
      node.textContent = copy(node.dataset.copyEn, node.dataset.copyAr);
    });
    document.documentElement.dir = window.IQZodiacLanguage?.language === 'ar' ? 'rtl' : 'ltr';
    if (currentPage) renderCurrentPage();
    else renderDirectory();
  };
  const bestText = (row, field) => {
    const en = row[`${field}_en`] || '';
    const ar = row[`${field}_ar`] || '';
    return window.IQZodiacLanguage?.language === 'ar' ? (ar || en) : (en || ar);
  };
  const renderDirectory = () => {
    if (slug) return;
    article.hidden = true;
    list.hidden = false;
    list.replaceChildren();
    status.textContent = pageRows.length ? '' : copy('No public pages have been published yet.', 'لم يتم نشر صفحات عامة بعد.');
    for (const page of pageRows) {
      const card = document.createElement('article');
      card.className = 'site-page-card';
      const heading = document.createElement('h2');
      heading.textContent = bestText(page, 'title');
      const excerpt = document.createElement('p');
      const selectedBody = bestText(page, 'body').trim();
      excerpt.textContent = selectedBody.slice(0, 240) + (selectedBody.length > 240 ? '…' : '');
      const link = document.createElement('a');
      link.href = `./site-pages.html?slug=${encodeURIComponent(page.slug)}`;
      link.textContent = copy('Read page', 'اقرأ الصفحة');
      card.append(heading, excerpt, link);
      list.append(card);
    }
  };
  const renderCurrentPage = () => {
    if (!currentPage) return;
    list.hidden = true;
    article.hidden = false;
    status.textContent = '';
    title.textContent = bestText(currentPage, 'title');
    body.textContent = bestText(currentPage, 'body');
    body.dir = window.IQZodiacLanguage?.language === 'ar' ? 'rtl' : 'ltr';
    document.title = `${title.textContent} · IQZodiac`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = bestText(currentPage, 'body').slice(0, 155);
  };
  const showNotFound = () => {
    list.hidden = true;
    article.hidden = true;
    status.textContent = copy('This page is unavailable or has not been published.', 'هذه الصفحة غير متاحة أو لم يتم نشرها.');
  };

  document.addEventListener('iqzodiac:languagechange', localizeStaticCopy);
  (async () => {
    try {
      const client = await window.IQZodiacSupabase.ready;
      if (slug) {
        const { data, error } = await client.from('site_pages').select('slug,title_en,title_ar,body_en,body_ar,content_type').eq('content_type','page').eq('slug', slug).eq('is_published', true).maybeSingle();
        if (error) throw error;
        if (!data) { showNotFound(); return; }
        currentPage = data;
        renderCurrentPage();
        return;
      }
      const { data, error } = await client.from('site_pages').select('slug,title_en,title_ar,body_en,body_ar,sort_order').eq('content_type','page').eq('is_published', true).order('sort_order').order('title_en').limit(200);
      if (error) throw error;
      pageRows.push(...(data || []));
      localizeStaticCopy();
    } catch (error) {
      console.warn('Public site pages could not be loaded.', error);
      status.textContent = copy('Pages could not be loaded right now. Please try again later.', 'تعذر تحميل الصفحات حاليًا. حاول مرة أخرى لاحقًا.');
    }
  })();
})();
