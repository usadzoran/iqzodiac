(() => {
  const weatherContent = document.querySelector('#weather-content');
  const newsList = document.querySelector('#news-list');
  const sourceNote = document.querySelector('#daily-source-note');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');
  const cityInput = document.querySelector('#weather-city');
  const categorySelect = document.querySelector('#news-category');
  let latestNews = [];
  if (cityInput) cityInput.value = localStorage.getItem('iqzodiac-daily-city') || '';
  const weatherCodes = { 0:['☀️','Clear sky'],1:['🌤️','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],45:['🌫️','Foggy'],48:['🌫️','Rime fog'],51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],61:['🌧️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],80:['🌦️','Rain showers'],81:['🌦️','Rain showers'],82:['⛈️','Heavy showers'],95:['⛈️','Thunderstorm'],99:['⛈️','Storm'] };
  const showToast = (message) => { toastMessage.textContent = message; toast.classList.add('is-visible'); setTimeout(() => toast.classList.remove('is-visible'), 2600); };
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
  const renderNews = (items = latestNews) => {
    latestNews = items;
    const category = categorySelect?.value || 'all';
    items = category === 'all' ? items : items.filter((item) => item.category === category);
    document.querySelector('#news-count').textContent = `${items.length} fresh`; newsList.replaceChildren();
    if (!items.length) { newsList.innerHTML = '<p class="error-copy">No fresh stories are available right now. Try refreshing later.</p>'; return; }
    items.forEach((item) => { const article = document.createElement('a'); article.className = 'news-item'; article.href = item.link; article.target = '_blank'; article.rel = 'noopener noreferrer'; article.innerHTML = `<h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p><small>${escapeHTML(item.source)} · ${escapeHTML(item.publishedLabel)}</small>`; newsList.append(article); });
  };
  const loadStoredNews = async () => {
    const client = await window.IQZodiacSupabase.ready;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session?.user?.id) throw new Error('auth_required');
    const [{ data: sources, error: sourceError }, { data: articles, error: articleError }] = await Promise.all([
      client.from('discover_news_sources').select('id,source_key,name,category').eq('is_active', true).eq('language', 'en').limit(20),
      client.from('discover_news_articles').select('title,description,article_url,published_at,source_id').eq('language', 'en').order('published_at', { ascending: false, nullsFirst: false }).limit(36),
    ]);
    if (sourceError) throw sourceError;
    if (articleError) throw articleError;
    const sourceById = new Map((sources || []).map((source) => [source.id, source]));
    return (articles || []).map((item) => {
      const source = sourceById.get(item.source_id);
      const category = ['technology', 'business'].includes(source?.source_key) ? source.source_key : 'world';
      return { title: item.title, description: item.description, link: item.article_url, source: source?.name || 'News', category, publishedLabel: item.published_at ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.published_at)) : 'Stored' };
    });
  };
  const loadDaily = async (quiet = false) => {
    if (!quiet) { weatherContent.innerHTML = '<div class="loading-pulse">Reading the sky…</div>'; newsList.innerHTML = '<div class="loading-pulse">Gathering today’s stories…</div>'; }
    try {
      const location = await getLocation();
      const response = await fetch(`/api/daily-feed?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}&location=${encodeURIComponent(location.label)}&city=${encodeURIComponent(location.city || '')}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Feed unavailable');
      const payload = await response.json();
      renderWeather(payload.weather); renderNews(payload.news);
      document.querySelector('#daily-date').textContent = new Intl.DateTimeFormat(window.IQZodiacLanguage?.locale || undefined, { weekday:'long', month:'long', day:'numeric' }).format(new Date(payload.day));
      sourceNote.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit' }).format(new Date())} · live sources · not stored`;
      if (!quiet) showToast('Today’s orbit is fresh.');
    } catch {
      weatherContent.innerHTML = '<p class="error-copy">Weather is temporarily unavailable. Check your connection and refresh.</p>';
      try { const storedNews = await loadStoredNews(); renderNews(storedNews); sourceNote.textContent = 'Showing the latest news stored in your account database.'; }
      catch { newsList.innerHTML = '<p class="error-copy">News is temporarily unavailable. Try refreshing in a moment.</p>'; sourceNote.textContent = 'Live sources could not be reached right now.'; }
    }
  };
  document.querySelector('#refresh-daily').addEventListener('click', () => loadDaily());
  document.querySelector('#weather-location-form')?.addEventListener('submit', (event) => { event.preventDefault(); const city = cityInput.value.trim().slice(0, 80); if (!city) return; localStorage.setItem('iqzodiac-daily-city', city); loadDaily(); });
  categorySelect?.addEventListener('change', () => renderNews());
  document.addEventListener('iqzodiac:languagechange', () => { if (document.querySelector('#daily-date').dataset.loaded) loadDaily(true); });
  loadDaily().then(() => { document.querySelector('#daily-date').dataset.loaded = 'true'; });
  const today = new Date().toDateString(); setInterval(() => { if (new Date().toDateString() !== today) window.location.reload(); }, 60000);
})();
