(() => {
  'use strict';

  const messages = {
    en: {
      pageTitle: 'YouTube — IQZodiac', kicker: 'YOUTUBE · WATCH WITHIN IQZODIAC', titleTail: 'in your orbit.',
      discover: 'Discover', introKicker: 'YOUR NEXT WATCH, WITHOUT LEAVING', introTitle: 'Find something worth a pause.',
      introCopy: 'Search real YouTube videos, songs, or channel names. Choose a result to watch in the official player right here.',
      searchKicker: 'REAL-TIME VIDEO SEARCH', searchHeading: 'Search videos, songs, or channels', liveBadge: 'YOUTUBE DATA API',
      queryLabel: 'What would you like to watch?', placeholder: 'Enter a video, song, or channel name…', search: 'Search',
      searchNote: 'Search uses YouTube Data API v3. Playback uses the official YouTube player; some videos do not allow embedding.',
      initial: 'Search YouTube for a video, song, or channel name to get started.', resultsKicker: 'FROM YOUTUBE', resultsTitle: 'Search results',
      loadMore: 'Load more', loadingMore: 'Loading…', back: 'Back to results', playerKicker: 'OFFICIAL YOUTUBE PLAYER',
      nowPlaying: 'NOW PLAYING', playerNote: 'Playback stays on this page when the video owner allows embedding. YouTube’s own controls provide play, pause, volume, and fullscreen.',
      queryRequired: 'Enter a video, song, or channel name to search.', tooLong: 'Please keep the search to 160 characters or fewer.',
      searching: 'Searching YouTube…', loadingNext: 'Loading more YouTube results…', empty: 'No videos matched that search. Try another title, song, or channel name.',
      backendMissing: 'Search is not connected yet. Configure the public backend URL in youtube-config.js and set YOUTUBE_API_KEY on the server. The key must never be placed in this page.',
      apiKeyMissing: 'The YouTube search service is not configured. Set the server-side YOUTUBE_API_KEY and enable YouTube Data API v3.',
      quota: 'The YouTube API quota has been reached. Please try again later.',
      rateLimited: 'Too many searches in a short time. Please wait a minute and try again.',
      network: 'Could not connect to YouTube search. Check your connection and try again.',
      apiError: 'YouTube search is temporarily unavailable. Please try again later.',
      invalidRequest: 'The search request could not be accepted. Try a shorter search phrase.',
      noItems: 'No additional videos are available.',
      channel: 'Channel', published: 'Published',
      embedBlocked: 'The video owner has disabled playback on other websites. You can choose to open it on YouTube instead.',
      unavailable: 'This video may be private, removed, or unavailable. YouTube could not play it here.',
      playerError: 'The official YouTube player could not play this video. This does not necessarily mean embedding is disabled.',
      playerLoadError: 'The official YouTube player could not be loaded. Check your connection and try again.',
      openYoutube: 'Open this video on YouTube', language: 'Switch language',
    },
    ar: {
      pageTitle: 'يوتيوب — IQZodiac', kicker: 'يوتيوب · شاهد داخل IQZODIAC', titleTail: 'في مدارك.',
      discover: 'اكتشاف', introKicker: 'مشاهدة جديدة دون مغادرة الموقع', introTitle: 'اعثر على ما يستحق المشاهدة.',
      introCopy: 'ابحث عن فيديوهات أو أغانٍ أو أسماء قنوات حقيقية على YouTube، واختر نتيجة لمشاهدتها هنا عبر المشغّل الرسمي.',
      searchKicker: 'بحث مباشر عن الفيديوهات', searchHeading: 'ابحث عن فيديو أو أغنية أو قناة', liveBadge: 'واجهة YouTube API',
      queryLabel: 'ما الذي تود مشاهدته؟', placeholder: 'اكتب اسم فيديو أو أغنية أو قناة…', search: 'بحث',
      searchNote: 'يستخدم البحث YouTube Data API v3. يعمل التشغيل عبر مشغّل YouTube الرسمي، وقد تمنع بعض الفيديوهات التضمين.',
      initial: 'ابدأ بالبحث في YouTube عن فيديو أو أغنية أو اسم قناة.', resultsKicker: 'نتائج YouTube', resultsTitle: 'نتائج البحث',
      loadMore: 'تحميل المزيد', loadingMore: 'جارٍ التحميل…', back: 'العودة إلى النتائج', playerKicker: 'مشغّل YouTube الرسمي',
      nowPlaying: 'يُعرض الآن', playerNote: 'يبقى التشغيل داخل هذه الصفحة إذا سمح مالك الفيديو بالتضمين. يوفر مشغّل YouTube أزرار التشغيل والإيقاف والصوت وملء الشاشة.',
      queryRequired: 'اكتب اسم فيديو أو أغنية أو قناة للبحث.', tooLong: 'يرجى ألا يتجاوز البحث ١٦٠ حرفًا.',
      searching: 'جارٍ البحث في YouTube…', loadingNext: 'جارٍ تحميل مزيد من نتائج YouTube…', empty: 'لم نعثر على فيديوهات مطابقة. جرّب عنوانًا أو أغنية أو اسم قناة آخر.',
      backendMissing: 'البحث غير متصل بعد. اضبط عنوان الواجهة الخلفية العام في youtube-config.js وأضف YOUTUBE_API_KEY إلى الخادم. لا تضع المفتاح في هذه الصفحة.',
      apiKeyMissing: 'خدمة البحث غير مهيأة. أضف YOUTUBE_API_KEY إلى إعدادات الخادم وفعّل YouTube Data API v3.',
      quota: 'تم بلوغ حصة YouTube API. يرجى المحاولة لاحقًا.',
      rateLimited: 'عدد عمليات البحث كبير خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.',
      network: 'تعذّر الاتصال بخدمة البحث. تحقّق من الاتصال ثم أعد المحاولة.',
      apiError: 'البحث في YouTube غير متاح مؤقتًا. يرجى المحاولة لاحقًا.',
      invalidRequest: 'تعذّر قبول طلب البحث. جرّب عبارة أقصر.',
      noItems: 'لا تتوفر فيديوهات إضافية.',
      channel: 'القناة', published: 'تاريخ النشر',
      embedBlocked: 'منع مالك الفيديو تشغيله على مواقع أخرى. يمكنك اختياريًا فتحه على YouTube.',
      unavailable: 'قد يكون الفيديو خاصًا أو محذوفًا أو غير متاح. تعذّر على YouTube تشغيله هنا.',
      playerError: 'تعذّر على مشغّل YouTube الرسمي تشغيل هذا الفيديو. لا يعني ذلك بالضرورة أن التضمين ممنوع.',
      playerLoadError: 'تعذّر تحميل مشغّل YouTube الرسمي. تحقّق من الاتصال ثم أعد المحاولة.',
      openYoutube: 'افتح هذا الفيديو على YouTube', language: 'تغيير اللغة',
    },
  };

  const state = {
    query: '', items: [], nextPageToken: '', loading: false, loadingMore: false,
    errorCode: '', moreErrorCode: '', selectedVideo: null, playerErrorCode: '', requestId: 0,
  };
  const byId = (id) => document.getElementById(id);
  const getLanguage = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const t = (key) => messages[getLanguage()][key] || messages.en[key] || key;
  const youtubeConfig = window.IQZodiacYoutubeConfig || {};
  const configuredBase = typeof youtubeConfig.apiBase === 'string' ? youtubeConfig.apiBase.trim() : '';
  const isGitHubPages = /(^|\.)github\.io$/i.test(window.location.hostname);
  const apiBase = configuredBase || (isGitHubPages ? '' : '/api/youtube/search');
  let player = null;
  let playerApiPromise = null;

  function setText(id, key) {
    const element = byId(id);
    const value = t(key);
    if (element && element.textContent !== value) element.textContent = value;
  }

  function applyLanguage() {
    if (document.title !== t('pageTitle')) document.title = t('pageTitle');
    setText('youtube-kicker', 'kicker');
    setText('youtube-title-tail', 'titleTail');
    setText('youtube-discover-link', 'discover');
    setText('youtube-intro-kicker', 'introKicker');
    setText('youtube-intro-title', 'introTitle');
    setText('youtube-intro-copy', 'introCopy');
    setText('youtube-search-kicker', 'searchKicker');
    setText('youtube-search-heading', 'searchHeading');
    setText('youtube-live-label', 'liveBadge');
    setText('youtube-query-label', 'queryLabel');
    setText('youtube-search-label', 'search');
    setText('youtube-search-note', 'searchNote');
    setText('youtube-results-kicker', 'resultsKicker');
    setText('youtube-results-heading', 'resultsTitle');
    setText('youtube-player-kicker', 'playerKicker');
    setText('youtube-now-playing', 'nowPlaying');
    setText('youtube-back-label', 'back');
    setText('youtube-player-note', 'playerNote');
    setText('youtube-load-more', state.loadingMore ? 'loadingMore' : 'loadMore');
    const input = byId('youtube-query');
    if (input && input.placeholder !== t('placeholder')) input.placeholder = t('placeholder');
    const languageButton = document.querySelector('[data-language-toggle]');
    if (languageButton && languageButton.getAttribute('aria-label') !== t('language')) languageButton.setAttribute('aria-label', t('language'));
    renderStatus();
    renderMoreStatus();
    updateResultLabels();
    renderPlayerError();
    if (state.selectedVideo) {
      const title = byId('youtube-player-heading');
      const channel = byId('youtube-player-channel');
      const channelText = state.selectedVideo.channelTitle ? `${t('channel')}: ${state.selectedVideo.channelTitle}` : '';
      if (title.textContent !== state.selectedVideo.title) title.textContent = state.selectedVideo.title;
      if (channel.textContent !== channelText) channel.textContent = channelText;
    }
  }

  function getApiUrl() {
    if (!apiBase) return null;
    try {
      const url = new URL(apiBase, window.location.href);
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      return url;
    } catch {
      return null;
    }
  }

  function renderStatus() {
    const status = byId('youtube-status');
    if (!status) return;
    let key = 'initial';
    let kind = 'info';
    if (state.loading) key = 'searching';
    else if (state.errorCode) { key = state.errorCode; kind = 'error'; }
    else if (!state.loading && state.query && state.items.length === 0) key = 'empty';
    else if (state.items.length > 0) key = 'resultsTitle';
    if (state.items.length > 0 && !state.loading && !state.errorCode) {
      if (!status.hidden) status.hidden = true;
      return;
    }
    if (status.hidden) status.hidden = false;
    if (status.dataset.kind !== kind) status.dataset.kind = kind;
    if (status.textContent !== t(key)) status.textContent = t(key);
  }

  function renderMoreStatus() {
    const status = byId('youtube-more-status');
    if (!status) return;
    const text = state.loadingMore ? t('loadingNext') : (state.moreErrorCode ? t(state.moreErrorCode) : '');
    const kind = state.moreErrorCode ? 'error' : 'info';
    if (status.textContent !== text) status.textContent = text;
    if (status.dataset.kind !== kind) status.dataset.kind = kind;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(getLanguage() === 'ar' ? 'ar' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    } catch { return ''; }
  }

  function makeResultCard(item) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'youtube-result-card';
    card.dataset.videoId = item.videoId;
    card.dataset.i18nSkip = 'true';
    card.setAttribute('translate', 'no');
    card.setAttribute('aria-label', item.title);

    const thumb = document.createElement('div');
    thumb.className = 'youtube-result-thumb';
    if (item.thumbnailUrl) {
      const image = document.createElement('img');
      image.src = item.thumbnailUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'strict-origin-when-cross-origin';
      image.addEventListener('error', () => { image.remove(); }, { once: true });
      thumb.append(image);
    }
    const play = document.createElement('span');
    play.className = 'youtube-play-mark';
    play.setAttribute('aria-hidden', 'true');
    play.textContent = '▶';
    thumb.append(play);

    const copy = document.createElement('div');
    copy.className = 'youtube-result-copy';
    const title = document.createElement('p');
    title.className = 'youtube-result-title';
    title.textContent = item.title;
    const meta = document.createElement('div');
    meta.className = 'youtube-result-meta';
    const channel = document.createElement('span');
    channel.className = 'youtube-result-channel';
    channel.textContent = `${t('channel')}: ${item.channelTitle}`;
    meta.append(channel);
    const dateLabel = formatDate(item.publishedAt);
    if (dateLabel) {
      const date = document.createElement('time');
      date.className = 'youtube-result-date';
      date.dateTime = item.publishedAt;
      date.textContent = dateLabel;
      meta.append(date);
    }
    copy.append(title, meta);
    card.append(thumb, copy);
    return card;
  }

  function updateResultLabels() {
    for (const card of document.querySelectorAll('.youtube-result-card')) {
      const item = state.items.find((entry) => entry.videoId === card.dataset.videoId);
      if (!item) continue;
      const channel = card.querySelector('.youtube-result-channel');
      const channelText = `${t('channel')}: ${item.channelTitle}`;
      if (channel && channel.textContent !== channelText) channel.textContent = channelText;
      const date = card.querySelector('.youtube-result-date');
      const dateText = formatDate(item.publishedAt);
      if (date && date.textContent !== dateText) date.textContent = dateText;
    }
  }

  function renderResults() {
    const section = byId('youtube-results-section');
    const grid = byId('youtube-results');
    const skeletons = byId('youtube-skeletons');
    const loadMore = byId('youtube-load-more');
    if (!section || !grid || !skeletons || !loadMore) return;
    section.hidden = !state.query || Boolean(state.selectedVideo);
    skeletons.hidden = !state.loading || state.items.length > 0;
    grid.replaceChildren();
    for (const item of state.items) grid.append(makeResultCard(item));
    const count = byId('youtube-result-count');
    const countText = state.items.length ? String(state.items.length) : '';
    if (count.textContent !== countText) count.textContent = countText;
    loadMore.hidden = !state.nextPageToken || state.loading;
    loadMore.disabled = state.loadingMore;
    setText('youtube-load-more', state.loadingMore ? 'loadingMore' : 'loadMore');
  }

  function clearPlayer() {
    if (player && typeof player.destroy === 'function') {
      try { player.destroy(); } catch { /* A player can already be torn down by YouTube. */ }
    }
    player = null;
    byId('youtube-player').replaceChildren();
  }

  function renderPlayerError() {
    const panel = byId('youtube-player-error');
    if (!panel) return;
    const text = byId('youtube-player-error-text');
    const link = byId('youtube-open-link');
    const code = state.playerErrorCode;
    if (panel.hidden !== !code) panel.hidden = !code;
    if (!code) {
      if (!link.hidden) link.hidden = true;
      return;
    }
    if (text.textContent !== t(code)) text.textContent = t(code);
    const showExternal = ['embedBlocked', 'unavailable'].includes(code) && state.selectedVideo?.videoId;
    if (link.hidden !== !showExternal) link.hidden = !showExternal;
    if (showExternal) {
      const href = `https://www.youtube.com/watch?v=${encodeURIComponent(state.selectedVideo.videoId)}`;
      const label = `${t('openYoutube')} ↗`;
      if (link.href !== href) link.href = href;
      if (link.textContent !== label) link.textContent = label;
    }
  }

  function playerErrorKey(code) {
    if (code === 101 || code === 150) return 'embedBlocked';
    if (code === 100) return 'unavailable';
    return 'playerError';
  }

  function loadYouTubePlayerAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (playerApiPromise) return playerApiPromise;
    playerApiPromise = new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('YouTube player API timed out')); }
      }, 15000);
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === 'function') previousReady();
        if (!settled && window.YT?.Player) {
          settled = true;
          window.clearTimeout(timeout);
          resolve(window.YT);
        }
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        if (!settled) { settled = true; window.clearTimeout(timeout); reject(new Error('YouTube player API failed to load')); }
      };
      document.head.append(script);
    });
    return playerApiPromise;
  }

  async function openVideo(item) {
    if (!item?.videoId) return;
    clearPlayer();
    state.selectedVideo = item;
    state.playerErrorCode = '';
    byId('youtube-player-heading').textContent = item.title;
    byId('youtube-player-channel').textContent = item.channelTitle ? `${t('channel')}: ${item.channelTitle}` : '';
    byId('youtube-player-panel').hidden = false;
    byId('youtube-status').hidden = true;
    renderResults();
    renderPlayerError();
    byId('youtube-player-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      await loadYouTubePlayerAPI();
      if (!state.selectedVideo || state.selectedVideo.videoId !== item.videoId) return;
      player = new window.YT.Player('youtube-player', {
        width: '100%', height: '100%', videoId: item.videoId,
        playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onError: (event) => {
            state.playerErrorCode = playerErrorKey(Number(event.data));
            renderPlayerError();
          },
        },
      });
    } catch {
      playerApiPromise = null;
      state.playerErrorCode = 'playerLoadError';
      renderPlayerError();
    }
  }

  async function fetchResults(pageToken = '', requestId = state.requestId) {
    if (requestId !== state.requestId) return;
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      if (isGitHubPages && !configuredBase) state.errorCode = 'backendMissing';
      else state.errorCode = 'apiError';
      state.loading = false;
      renderStatus();
      renderResults();
      return;
    }
    apiUrl.searchParams.set('q', state.query);
    if (pageToken) apiUrl.searchParams.set('pageToken', pageToken);
    else apiUrl.searchParams.delete('pageToken');

    try {
      const response = await fetch(apiUrl.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== state.requestId) return;
      if (!response.ok) {
        const code = payload?.error?.code;
        const mapped = code === 'quota_exceeded' ? 'quota'
          : code === 'rate_limited' ? 'rateLimited'
          : code === 'api_not_configured' || code === 'api_configuration' ? 'apiKeyMissing'
            : code === 'invalid_query' || code === 'invalid_page_token' ? 'invalidRequest'
              : code === 'origin_not_allowed' ? 'apiError'
                : 'apiError';
        const error = new Error(mapped);
        error.userMessage = mapped;
        throw error;
      }
      if (!Array.isArray(payload.items)) throw new Error('Invalid YouTube search response');
      const normalized = payload.items.filter((item) => item && typeof item.videoId === 'string' && typeof item.title === 'string');
      state.items = pageToken ? state.items.concat(normalized) : normalized;
      state.nextPageToken = typeof payload.nextPageToken === 'string' ? payload.nextPageToken : '';
      state.errorCode = '';
      state.moreErrorCode = '';
    } catch (error) {
      if (requestId !== state.requestId) return;
      const code = error.userMessage || (error instanceof TypeError ? 'network' : 'apiError');
      if (pageToken) state.moreErrorCode = code;
      else state.errorCode = code;
    } finally {
      if (requestId !== state.requestId) return;
      state.loading = false;
      state.loadingMore = false;
      renderStatus();
      renderMoreStatus();
      renderResults();
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    state.requestId += 1;
    const requestId = state.requestId;
    state.loading = false;
    state.loadingMore = false;
    const query = byId('youtube-query').value.trim();
    if (!query) {
      state.query = '';
      state.errorCode = 'queryRequired';
      state.moreErrorCode = '';
      state.items = [];
      state.nextPageToken = '';
      state.selectedVideo = null;
      state.playerErrorCode = '';
      clearPlayer();
      byId('youtube-player-panel').hidden = true;
      byId('youtube-results-section').hidden = true;
      byId('youtube-search-button').disabled = false;
      renderStatus();
      renderResults();
      return;
    }
    if (query.length > 160) {
      state.query = query.slice(0, 160);
      state.errorCode = 'tooLong';
      state.moreErrorCode = '';
      state.items = [];
      state.nextPageToken = '';
      state.selectedVideo = null;
      state.playerErrorCode = '';
      clearPlayer();
      byId('youtube-player-panel').hidden = true;
      byId('youtube-search-button').disabled = false;
      renderStatus();
      renderResults();
      return;
    }
    clearPlayer();
    state.selectedVideo = null;
    state.playerErrorCode = '';
    state.query = query;
    state.items = [];
    state.nextPageToken = '';
    state.errorCode = '';
    state.moreErrorCode = '';
    state.loading = true;
    state.loadingMore = false;
    byId('youtube-player-panel').hidden = true;
    byId('youtube-results-section').hidden = false;
    byId('youtube-search-button').disabled = true;
    renderStatus();
    renderResults();
    fetchResults('', requestId).finally(() => {
      if (requestId === state.requestId) byId('youtube-search-button').disabled = false;
    });
  }

  async function loadMore() {
    if (!state.nextPageToken || state.loading || state.loadingMore) return;
    state.loadingMore = true;
    state.moreErrorCode = '';
    renderMoreStatus();
    renderResults();
    const token = state.nextPageToken;
    await fetchResults(token, state.requestId);
  }

  function returnToResults() {
    clearPlayer();
    state.selectedVideo = null;
    state.playerErrorCode = '';
    byId('youtube-player-panel').hidden = true;
    byId('youtube-results-section').hidden = !state.query;
    renderStatus();
    renderResults();
    byId('youtube-search-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  byId('youtube-search-form').addEventListener('submit', submitSearch);
  byId('youtube-load-more').addEventListener('click', loadMore);
  byId('youtube-back-button').addEventListener('click', returnToResults);
  byId('youtube-results').addEventListener('click', (event) => {
    const card = event.target.closest('.youtube-result-card');
    if (!card) return;
    const item = state.items.find((entry) => entry.videoId === card.dataset.videoId);
    if (item) openVideo(item);
  });
  document.addEventListener('iqzodiac:languagechange', applyLanguage);
  applyLanguage();
})();
