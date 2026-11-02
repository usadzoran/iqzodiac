(() => {
  const weatherContent = document.querySelector('#weather-content');
  const newsList = document.querySelector('#news-list');
  const sourceNote = document.querySelector('#daily-source-note');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');
  const cityInput = document.querySelector('#weather-city');
  const categorySelect = document.querySelector('#news-category');
  const reader = document.querySelector('#news-reader');
  const readerImage = document.querySelector('#news-reader-image');
  const readerTitle = document.querySelector('#news-reader-title');
  const readerSource = document.querySelector('#news-reader-source');
  const readerDescription = document.querySelector('#news-reader-description');
  const readerBody = document.querySelector('#news-reader-body');
  let latestNews = [];
  let readerRequestId = 0;
  let readerTrigger = null;
  if (cityInput) cityInput.value = localStorage.getItem('iqzodiac-daily-city') || '';
  const weatherCodes = { 0:['☀️','Clear sky'],1:['🌤️','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],45:['🌫️','Foggy'],48:['🌫️','Rime fog'],51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],61:['🌧️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],80:['🌦️','Rain showers'],81:['🌦️','Rain showers'],82:['⛈️','Heavy showers'],95:['⛈️','Thunderstorm'],99:['⛈️','Storm'] };
  const showToast = (message) => { if (!toast || !toastMessage) return; toastMessage.textContent = message; toast.classList.add('is-visible'); setTimeout(() => toast.classList.remove('is-visible'), 2600); };
  const escapeHTML = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const getLocation = () => new Promise((resolve) => {
    const savedCity = localStorage.getItem('iqzodiac-daily-city') || '';
    if (savedCity) return resolve({ lat: 40.7128, lon: -74.006, label: savedCity, city: savedCity });
    if (!navigator.geolocation) return resolve({ lat: 40.7128, lon: -74.006, label: 'New York' });
    navigator.geolocation.getCurrentPosition((position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude, label: 'Your location' }), () => resolve({ lat: 40.7128, lon: -74.006, label: 'New York · default' }), { timeout: 5000 });
  });
  const renderWeather = (weather) => {
    const code = weatherCodes[weather.current.code] || ['🌌','Current conditions'];
    document.querySelector('#weather-location').textContent = weather.location;
    weatherContent.innerHTML = `<div class="weather-main"><span class="weather-symbol" aria-hidden="true">${code[0]}</span><div><div class="weather-temp">${Math.round(weather.current.temperature)}<small>°C</small></div><div class="weather-summary">${code[1]} · feels like ${Math.round(weather.current.apparent)}°</div></div></div><div class="weather-stats"><div class="weather-stat"><small>Humidity</small><strong>${weather.current.humidity}%</strong></div><div class="weather-stat"><small>Wind</small><strong>${Math.round(weather.current.wind)} km/h</strong></div><div class="weather-stat"><small>High / low</small><strong>${Math.round(weather.today.high)}° / ${Math.round(weather.today.low)}°</strong></div></div>`;
  };
  const setReaderMessage = (message, state = 'loading') => {
    if (!readerBody) return;
    const paragraph = document.createElement('p');
    paragraph.className = `news-reader-message is-${state}`;
    paragraph.setAttribute('role', state === 'loading' ? 'status' : 'note');
    paragraph.textContent = message;
    readerBody.replaceChildren(paragraph);
  };
  const loadFullArticle = async (item, requestId) => {
    setReaderMessage('Loading the full story from the publisher…');
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data, error } = await client.functions.invoke('daily-news-article', {
        body: { articleUrl: item.link, expectedTitle: item.title },
      });
      if (error) throw error;
      if (requestId !== readerRequestId || reader.hidden) return;
      if (!Array.isArray(data?.blocks) || !data.blocks.length) throw new Error('article_text_unavailable');
      const fragment = document.createDocumentFragment();
      data.blocks.forEach((block) => {
        const tag = block.type === 'heading' ? 'h3' : block.type === 'quote' ? 'blockquote' : block.type === 'list' ? 'p' : 'p';
        const element = document.createElement(tag);
        element.className = `news-reader-block is-${tag === 'p' ? block.type : tag}`;
        element.textContent = String(block.text || '');
        if (element.textContent.trim()) fragment.append(element);
      });
      if (!fragment.childNodes.length) throw new Error('article_text_unavailable');
      readerBody.replaceChildren(fragment);
      if (data.byline) {
        readerSource.textContent = `${item.source} · ${item.publishedLabel} · ${data.byline}`;
      }
    } catch (error) {
      if (requestId !== readerRequestId || reader.hidden) return;
      console.warn('The full article is unavailable in the Daily reader.', error);
      setReaderMessage('The publisher did not make the full article available here. The summary above is the text currently provided for this story.', 'unavailable');
    }
  };
  const openReader = (item, trigger = null) => {
    readerRequestId += 1;
    const requestId = readerRequestId;
    readerTrigger = trigger;
    readerTitle.textContent = item.title;
    readerSource.textContent = `${item.source} · ${item.publishedLabel}`;
    readerDescription.textContent = item.description || 'No summary is available for this story.';
    if (item.imageUrl) { readerImage.src = item.imageUrl; readerImage.alt = item.title; readerImage.hidden = false; } else readerImage.hidden = true;
    reader.hidden = false;
    document.body.classList.add('news-reader-open');
    document.querySelector('#news-reader-close')?.focus();
    loadFullArticle(item, requestId);
  };
  const closeReader = () => { readerRequestId += 1; reader.hidden = true; document.body.classList.remove('news-reader-open'); readerTrigger?.focus?.(); readerTrigger = null; };
  const renderNews = (items = latestNews) => {
    latestNews = items;
    const category = categorySelect?.value || 'all';
    const visibleItems = category === 'all' ? items : items.filter((item) => item.category === category);
    document.querySelector('#news-count').textContent = `${visibleItems.length} fresh`;
    newsList.replaceChildren();
    if (!visibleItems.length) { newsList.innerHTML = '<p class="error-copy">No fresh stories are available right now. Try refreshing later.</p>'; return; }
    visibleItems.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'news-item daily-news-item';
      article.tabIndex = 0;
      article.setAttribute('role', 'button');
      article.setAttribute('aria-label', `${item.title}. ${item.description || ''}`);
      const image = item.imageUrl ? `<img src="${escapeHTML(item.imageUrl)}" alt="" loading="lazy" />` : '<span class="news-image-fallback" aria-hidden="true">✦</span>';
      article.innerHTML = `<div class="daily-news-image">${image}</div><div class="daily-news-copy"><small>${escapeHTML(item.source)} · ${escapeHTML(item.publishedLabel)}</small><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p><span class="daily-news-read">Read inside IQZodiac ↗</span></div>`;
      article.querySelector('.daily-news-image img')?.addEventListener('error', (event) => {
        const fallback = document.createElement('span');
        fallback.className = 'news-image-fallback';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = '✦';
        event.currentTarget.replaceWith(fallback);
      }, { once: true });
      article.addEventListener('click', () => openReader(item, article));
      article.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReader(item, article); } });
      newsList.append(article);
    });
  };
  const loadStoredNews = async () => {
    const client = await window.IQZodiacSupabase.ready;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session?.user?.id) throw new Error('auth_required');
    const [{ data: sources, error: sourceError }, { data: articles, error: articleError }] = await Promise.all([
      client.from('discover_news_sources').select('id,source_key,name,category').eq('is_active', true).eq('language', 'en').limit(20),
      client.from('discover_news_articles').select('title,description,article_url,image_url,published_at,source_id').eq('language', 'en').order('published_at', { ascending: false, nullsFirst: false }).limit(36),
    ]);
    if (sourceError) throw sourceError;
    if (articleError) throw articleError;
    const sourceById = new Map((sources || []).map((source) => [source.id, source]));
    return (articles || []).map((item) => {
      const source = sourceById.get(item.source_id);
      const category = ['technology', 'business'].includes(source?.source_key) ? source.source_key : 'world';
      return { title: item.title, description: item.description, link: item.article_url, imageUrl: item.image_url, source: source?.name || 'News', category, publishedLabel: item.published_at ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.published_at)) : 'Stored' };
    });
  };
  const cacheFreshNews = async (client, items, fetchedAt) => {
    const { data: sources, error: sourceError } = await client.from('discover_news_sources').select('id,source_key').eq('is_active', true).eq('language', 'en').limit(20);
    if (sourceError) { console.warn('Daily news source cache unavailable.', sourceError); return; }
    const sourceByKey = new Map((sources || []).map((source) => [source.source_key, source.id]));
    const rows = items.map((item) => ({
      source_id: sourceByKey.get(item.sourceKey),
      external_id: String(item.externalId || item.articleUrl).slice(0, 1000),
      title: String(item.title || '').slice(0, 500),
      description: String(item.description || '').slice(0, 4000),
      article_url: item.articleUrl,
      image_url: item.imageUrl || null,
      published_at: item.publishedAt || null,
      fetched_at: fetchedAt || new Date().toISOString(),
      language: 'en',
    })).filter((item) => item.source_id && item.external_id && item.title && item.article_url);
    if (!rows.length) return;
    const { error } = await client.from('discover_news_articles').upsert(rows, { onConflict: 'source_id,external_id' });
    if (error) console.warn('Daily news article cache update failed.', error);
  };
  const loadFreshNews = async () => {
    const client = await window.IQZodiacSupabase.ready;
    const { data, error } = await client.functions.invoke('daily-news-feed', { body: {} });
    if (error) throw error;
    if (!Array.isArray(data?.items) || !data.items.length) throw new Error('news_feed_empty');
    const items = data.items.filter((item) => item.title && item.articleUrl).map((item) => ({
      title: item.title,
      description: item.description || '',
      link: item.articleUrl,
      imageUrl: /^https:\/\//i.test(item.imageUrl || '') ? item.imageUrl : null,
      source: item.sourceName || 'News',
      sourceKey: item.sourceKey,
      category: item.category || 'world',
      publishedLabel: item.publishedAt ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.publishedAt)) : 'Recent',
      publishedAt: item.publishedAt || null,
    }));
    try { await cacheFreshNews(client, data.items, data.fetchedAt); } catch (cacheError) { console.warn('Daily news loaded but could not be cached.', cacheError); }
    return items;
  };
  const loadFallbackNews = () => {
    if (window.location.hostname === 'usadzoran.github.io') return loadStoredNews();
    return syncDiscoverNews().catch(() => null).then(() => loadStoredNews());
  };
  const syncDiscoverNews = async () => {
    const response = await fetch('/api/discover-news', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('rss_unavailable');
    const payload = await response.json();
    const client = await window.IQZodiacSupabase.ready;
    const { data: sources, error: sourceError } = await client.from('discover_news_sources').select('id,source_key').eq('is_active', true).eq('language', 'en').limit(20);
    if (sourceError) throw sourceError;
    const sourceByKey = new Map((sources || []).map((source) => [source.source_key, source.id]));
    const rows = payload.sources.flatMap((source) => (source.items || []).map((item) => ({ source_id: sourceByKey.get(source.key), external_id: item.externalId, title: item.title, description: item.description || '', article_url: item.articleUrl, image_url: item.imageUrl || null, published_at: item.publishedAt, fetched_at: payload.fetchedAt, language: 'en' })).filter((item) => item.source_id));
    if (rows.length) { const { error } = await client.from('discover_news_articles').upsert(rows, { onConflict: 'source_id,external_id' }); if (error) throw error; }
  };
  const loadDaily = async (quiet = false) => {
    if (!quiet) { weatherContent.innerHTML = '<div class="loading-pulse">Reading the sky…</div>'; newsList.innerHTML = '<div class="loading-pulse">Gathering today’s stories…</div>'; }
    const location = await getLocation();
    const weatherPromise = fetch(`/api/daily-feed?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}&location=${encodeURIComponent(location.label)}&city=${encodeURIComponent(location.city || '')}`, { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('weather_unavailable'); return response.json(); });
    const newsPromise = loadFreshNews().catch((error) => { console.warn('Fresh Daily news is unavailable; using saved stories.', error); return loadFallbackNews(); });
    try { const payload = await weatherPromise; renderWeather(payload.weather); document.querySelector('#daily-date').textContent = new Intl.DateTimeFormat(window.IQZodiacLanguage?.locale || undefined, { weekday:'long', month:'long', day:'numeric' }).format(new Date(payload.day)); } catch { weatherContent.innerHTML = '<p class="error-copy">Weather is temporarily unavailable. Check your connection and refresh.</p>'; }
    try { const storedNews = await newsPromise; renderNews(storedNews); sourceNote.textContent = 'News is synchronized with the IQZodiac database.'; if (!quiet) showToast('Today’s news is ready.'); } catch { newsList.innerHTML = '<p class="error-copy">News is temporarily unavailable. Try refreshing in a moment.</p>'; sourceNote.textContent = 'News could not be synchronized right now.'; }
  };
  document.querySelector('#refresh-daily').addEventListener('click', () => loadDaily());
  document.querySelector('#weather-location-form')?.addEventListener('submit', (event) => { event.preventDefault(); const city = cityInput.value.trim().slice(0, 80); if (!city) return; localStorage.setItem('iqzodiac-daily-city', city); loadDaily(); });
  categorySelect?.addEventListener('change', () => renderNews());
  document.querySelector('#news-reader-close')?.addEventListener('click', closeReader);
  reader?.addEventListener('click', (event) => { if (event.target === reader) closeReader(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && reader && !reader.hidden) closeReader(); });
  document.addEventListener('iqzodiac:languagechange', () => loadDaily(true));
  loadDaily();
  const today = new Date().toDateString(); setInterval(() => { if (new Date().toDateString() !== today) window.location.reload(); }, 60000);
})();
