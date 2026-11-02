(() => {
  'use strict';

  const newsList = document.querySelector('#discover-news-list');
  const status = document.querySelector('#discover-news-status');
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';

  const loadNews = async () => {
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session?.user?.id) throw new Error('auth_required');
      status.textContent = 'Updating';
      const response = await fetch('/api/discover-news', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('rss_unavailable');
      const payload = await response.json();
      const [{ data: sourceRows, error: sourceError }] = await Promise.all([
        client.from('discover_news_sources').select('id,source_key,name,category').eq('is_active', true).eq('language', 'en').limit(20),
      ]);
      if (sourceError) throw sourceError;
      const sourcesByKey = new Map((sourceRows || []).map((source) => [source.source_key, source]));
      const articleRows = payload.sources.flatMap((source) => {
        const dbSource = sourcesByKey.get(source.key);
        if (!dbSource) return [];
        return source.items.map((item) => ({
          source_id: dbSource.id,
          external_id: item.externalId,
          title: item.title,
          description: item.description || '',
          article_url: item.articleUrl,
          published_at: item.publishedAt,
          fetched_at: payload.fetchedAt,
          language: 'en',
        }));
      });
      if (articleRows.length) {
        const { error } = await client.from('discover_news_articles').upsert(articleRows, { onConflict: 'source_id,external_id' });
        if (error) throw error;
      }
      const { data: storedArticles, error: articleError } = await client.from('discover_news_articles')
        .select('title,description,article_url,published_at,fetched_at,source_id')
        .eq('language', 'en')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(36);
      if (articleError) throw articleError;
      const sourceById = new Map((sourceRows || []).map((source) => [source.id, source]));
      const items = (storedArticles || []).map((article) => ({ ...article, source: sourceById.get(article.source_id) })).filter((article) => article.source);
      newsList.replaceChildren();
      if (!items.length) {
        newsList.innerHTML = '<p class="discover-news-empty">No English stories are available yet.</p>';
      } else {
        items.forEach((item) => {
          const article = document.createElement('a');
          article.className = 'discover-news-item';
          article.href = item.article_url;
          article.target = '_blank';
          article.rel = 'noopener noreferrer';
          article.innerHTML = `<div><small>${escapeHTML(item.source.name)} · ${escapeHTML(item.source.category)}</small><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p></div><time>${escapeHTML(dateLabel(item.published_at))}</time>`;
          newsList.append(article);
        });
      }
      status.textContent = `${items.length} stories`;
    } catch (error) {
      status.textContent = 'Unavailable';
      newsList.innerHTML = `<p class="discover-news-error">News could not be synchronized right now. ${escapeHTML(error?.message || '')}</p>`;
    }
  };

  loadNews();
})();
