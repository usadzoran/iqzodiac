(() => {
  'use strict';

  const grid = document.getElementById('profile-reel-grid');
  const status = document.getElementById('profile-status');
  const lazyVideos = 'IntersectionObserver' in window ? new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      void ensureVideoSource(entry.target);
    });
  }, { rootMargin: '300px 0px' }) : null;
  const sourceLoads = new WeakMap();
  let currentRows = [];
  let currentClient = null;
  let language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const text = {
    en: { back: 'Back to Reels', kicker: 'REEL PROFILE', latest: 'Latest Reels', likes: 'Likes on these Reels', feedKicker: 'FROM THIS ORBIT', feedTitle: 'Published Reels', loading: 'Loading…', member: 'Member', copied: 'Link copied.', copyFailed: 'Copy Reel link', share: 'Share', shareOptions: 'Share options', noReels: 'No published Reels yet.', unavailable: 'This profile could not be loaded right now.', loadFailed: 'This Reel could not be loaded.', reels: (n) => `${n} recent ${n === 1 ? 'Reel' : 'Reels'}`, likesCount: (n) => `${n} likes`, seconds: (n) => `${n}s`, footer: 'Look inward. Move forward.' },
    ar: { back: 'العودة إلى Reels', kicker: 'ملف Reel', latest: 'أحدث Reels', likes: 'الإعجابات على هذه Reels', feedKicker: 'من هذا المدار', feedTitle: 'Reels المنشورة', loading: 'جارٍ التحميل…', member: 'عضو', copied: 'تم نسخ الرابط.', copyFailed: 'نسخ رابط Reel', share: 'مشاركة', shareOptions: 'خيارات المشاركة', noReels: 'لا توجد Reels منشورة بعد.', unavailable: 'تعذّر تحميل هذا الملف الشخصي الآن.', loadFailed: 'تعذّر تحميل هذا الـ Reel.', reels: (n) => `${new Intl.NumberFormat('ar').format(n)} Reel حديث`, likesCount: (n) => `${new Intl.NumberFormat('ar').format(n)} إعجاب`, seconds: (n) => `${new Intl.NumberFormat('ar').format(n)} ث`, footer: 'تأمّل ذاتك. وانطلق نحو الأمام.' },
  };
  const t = (key, ...args) => { const value = text[language()][key]; return typeof value === 'function' ? value(...args) : (value || key); };
  const number = (value) => new Intl.NumberFormat(language() === 'ar' ? 'ar' : 'en').format(Number(value) || 0);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = (value) => String(value || '').replace(/^@/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IQ';
  const formatDate = (value) => { try { return new Intl.DateTimeFormat(language() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(value)); } catch { return ''; } };
  const clientReady = () => window.IQZodiacSupabase?.ready;
  const shareUrl = (row) => new URL(`./reel.html?reel=${encodeURIComponent(row.id)}`, document.baseURI).href;

  const applyCopy = () => {
    document.title = language() === 'ar' ? 'ملف Reel — IQZodiac' : 'Reel Profile — IQZodiac';
    document.getElementById('back-to-reels').textContent = t('back');
    document.getElementById('member-kicker').textContent = t('kicker');
    document.getElementById('reel-total-label').textContent = t('latest');
    document.getElementById('reel-likes-total-label').textContent = t('likes');
    document.getElementById('profile-feed-kicker').textContent = t('feedKicker');
    document.getElementById('published-reels-title').textContent = t('feedTitle');
    document.getElementById('profile-footer-tagline').textContent = t('footer');
    document.querySelector('.reel-profile-topbar .back-link').setAttribute('aria-label', t('back'));
    grid.querySelectorAll('.profile-reel-date').forEach((node) => {
      const card = node.closest('.profile-reel-card');
      const row = currentRows.find((item) => item.id === card?.dataset.reelId);
      if (row) node.textContent = `${formatDate(row.created_at)} · ${t('seconds', Math.round(Number(row.duration_seconds) || 0))} · ${t('likesCount', Number(row.like_count) || 0)}`;
    });
    grid.querySelectorAll('.profile-reel-share').forEach((button) => { button.textContent = `↗ ${t('share')}`; button.setAttribute('aria-label', t('share')); });
    grid.querySelectorAll('.profile-share-menu').forEach((menu) => menu.remove());
    grid.querySelectorAll('.profile-reel-share').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    const empty = grid.querySelector('.profile-reel-empty');
    if (empty && grid.dataset.state === 'empty') empty.textContent = t('noReels');
  };
  const setStatus = (value) => { status.textContent = value; };
  const setProfile = (profile) => {
    const name = profile?.display_name || profile?.handle || t('member');
    document.getElementById('member-name').textContent = name;
    document.getElementById('member-avatar').textContent = initials(name);
    const handleNode = document.getElementById('member-handle');
    handleNode.hidden = !profile?.handle;
    handleNode.textContent = profile?.handle ? `@${String(profile.handle).replace(/^@/, '')}` : '';
  };
  const ensureVideoSource = async (video, force = false) => {
    const expiry = Number(video.dataset.expiresAt || 0);
    if (!force && video.getAttribute('src') && expiry > Date.now() + 45_000) return true;
    const pending = sourceLoads.get(video);
    if (pending) return pending;
    const task = (async () => {
      try {
        const { data, error } = await currentClient.storage.from('iqzodiac-media').createSignedUrl(video.dataset.mediaPath, 900);
        if (error || !data?.signedUrl) throw error || new Error('signed-url-unavailable');
        video.src = data.signedUrl;
        video.dataset.expiresAt = String(Date.now() + 900_000);
        video.load();
        video.closest('.profile-reel-card').querySelector('.profile-reel-media-error').hidden = true;
        return true;
      } catch (error) {
        console.warn('Profile Reel media could not be loaded.', error);
        video.closest('.profile-reel-card').querySelector('.profile-reel-media-error').hidden = false;
        return false;
      }
    })();
    sourceLoads.set(video, task);
    try { return await task; }
    finally { if (sourceLoads.get(video) === task) sourceLoads.delete(video); }
  };
  const closeShareMenu = (card) => {
    card.querySelector('.profile-share-menu')?.remove();
    card.querySelector('.profile-reel-share')?.setAttribute('aria-expanded', 'false');
  };
  const openShareMenu = (card, row) => {
    if (card.querySelector('.profile-share-menu')) { closeShareMenu(card); return; }
    grid.querySelectorAll('.profile-reel-card').forEach((other) => { if (other !== card) closeShareMenu(other); });
    const url = shareUrl(row);
    const shareText = language() === 'ar' ? 'شاهد هذا الـ Reel على IQZodiac' : 'Watch this Reel on IQZodiac';
    const menu = document.createElement('div'); menu.className = 'profile-share-menu'; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', t('shareOptions'));
    const options = [
      ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`],
      ['Telegram', `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`],
      ['X', `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`],
      ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ];
    options.forEach(([label, href]) => { const link = document.createElement('a'); link.className = 'profile-share-option'; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = label; menu.append(link); });
    const copy = document.createElement('button'); copy.className = 'profile-share-option'; copy.type = 'button'; copy.textContent = language() === 'ar' ? 'نسخ الرابط' : 'Copy link';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); setStatus(t('copied')); }
      catch { window.prompt(t('copyFailed'), url); }
      closeShareMenu(card);
    });
    menu.append(copy); card.append(menu); card.querySelector('.profile-reel-share').setAttribute('aria-expanded', 'true'); menu.querySelector('a,button')?.focus({ preventScroll: true });
  };
  const shareReel = async (card, row) => {
    const url = shareUrl(row);
    if (navigator.share) {
      try { await navigator.share({ title: t('share'), text: language() === 'ar' ? 'شاهد هذا الـ Reel على IQZodiac' : 'Watch this Reel on IQZodiac', url }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    openShareMenu(card, row);
  };
  const render = (rows) => {
    lazyVideos?.disconnect();
    grid.replaceChildren();
    grid.dataset.state = rows.length ? 'ready' : 'empty';
    grid.setAttribute('aria-busy', 'false');
    document.getElementById('reel-total').textContent = number(rows.length);
    document.getElementById('reel-likes-total').textContent = number(rows.reduce((sum, row) => sum + Number(row.like_count || 0), 0));
    setStatus(t('reels', rows.length));
    if (!rows.length) {
      const empty = document.createElement('p'); empty.className = 'profile-reel-empty'; empty.textContent = t('noReels'); empty.setAttribute('role', 'status'); grid.append(empty); return;
    }
    rows.forEach((row) => {
      const card = document.createElement('article'); card.className = 'profile-reel-card'; card.dataset.reelId = row.id;
      const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.preload = 'none'; video.muted = true; video.dataset.mediaPath = row.media_path; video.setAttribute('aria-label', t('feedTitle'));
      const mediaError = document.createElement('p'); mediaError.className = 'profile-reel-media-error'; mediaError.textContent = t('loadFailed'); mediaError.hidden = true;
      video.addEventListener('error', () => {
        if (!video.hasAttribute('src')) return;
        if (video.dataset.retried !== 'true') { video.dataset.retried = 'true'; video.dataset.expiresAt = '0'; void ensureVideoSource(video, true); }
        else mediaError.hidden = false;
      });
      video.addEventListener('loadeddata', () => { video.dataset.retried = 'false'; mediaError.hidden = true; });
      const copy = document.createElement('div'); copy.className = 'profile-reel-card-copy';
      const date = document.createElement('p'); date.className = 'profile-reel-date'; date.textContent = `${formatDate(row.created_at)} · ${t('seconds', Math.round(Number(row.duration_seconds) || 0))} · ${t('likesCount', Number(row.like_count) || 0)}`;
      const caption = document.createElement('p'); caption.className = 'profile-reel-caption'; caption.textContent = row.caption || '';
      const share = document.createElement('button'); share.className = 'profile-reel-share'; share.type = 'button'; share.textContent = `↗ ${t('share')}`; share.setAttribute('aria-expanded', 'false'); share.setAttribute('aria-label', t('share')); share.addEventListener('click', () => { void shareReel(card, row); });
      copy.append(date);
      if (row.caption) copy.append(caption);
      copy.append(share);
      card.append(video, mediaError, copy); grid.append(card);
      if (lazyVideos) lazyVideos.observe(video); else void ensureVideoSource(video);
    });
  };

  document.addEventListener('pointerdown', (event) => {
    const menu = grid.querySelector('.profile-share-menu');
    if (!menu || menu.contains(event.target) || event.target.closest('.profile-reel-share')) return;
    closeShareMenu(menu.closest('.profile-reel-card'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = grid.querySelector('.profile-share-menu');
    if (!menu) return;
    const card = menu.closest('.profile-reel-card'); closeShareMenu(card); card.querySelector('.profile-reel-share')?.focus({ preventScroll: true });
  });
  document.addEventListener('iqzodiac:languagechange', () => { applyCopy(); if (currentClient) render(currentRows); });
  applyCopy();

  (async () => {
    try {
      const client = await clientReady();
      if (!client) throw new Error('missing-supabase-client');
      currentClient = client;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUserId = sessionData.session?.user?.id;
      const requestedId = new URLSearchParams(window.location.search).get('user');
      const userId = requestedId || currentUserId;
      if (!userId) throw new Error('no-user');
      const reelsPromise = client.from('reels').select('id,author_id,caption,media_path,duration_seconds,created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(24);
      const profilePromise = userId === currentUserId
        ? client.from('profiles').select('user_id,display_name,handle').eq('user_id', userId).maybeSingle()
        : client.rpc('get_public_profile_cards', { p_user_ids: [userId] });
      const [reelsResult, profileResult] = await Promise.all([reelsPromise, profilePromise]);
      if (reelsResult.error) throw reelsResult.error;
      if (profileResult.error) console.warn('Public profile label is unavailable.', profileResult.error);
      const profile = userId === currentUserId ? profileResult.data : (profileResult.data || []).find((item) => item.user_id === userId) || null;
      setProfile(profile);
      const reels = reelsResult.data || [];
      if (reels.length) {
        const { data: metrics, error: metricsError } = await client.rpc('get_reel_feed_metrics', { p_reel_ids: reels.map((row) => row.id) });
        if (metricsError) throw metricsError;
        const metricMap = new Map((metrics || []).map((item) => [item.reel_id, item]));
        currentRows = reels.map((row) => {
          const metric = metricMap.get(row.id);
          if (!metric) throw new Error('reel-metrics-unavailable');
          return { ...row, like_count: Number(metric.like_count), comment_count: Number(metric.comment_count) };
        });
      } else currentRows = [];
      render(currentRows);
    } catch (error) {
      console.warn('Reel profile could not be loaded.', error);
      setStatus(t('unavailable'));
      grid.dataset.state = 'unavailable'; grid.setAttribute('aria-busy', 'false');
      const empty = document.createElement('p'); empty.className = 'profile-reel-empty'; empty.textContent = t('unavailable'); empty.setAttribute('role', 'status'); grid.replaceChildren(empty);
    }
  })();
})();
