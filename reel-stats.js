(() => {
  'use strict';

  const list = document.querySelector('#reel-stats-list');
  const t = {
      en: {
      back: '← Back to Reels', kicker: 'YOUR CREATOR DASHBOARD', title: 'Your Reels,', titleAccent: 'in numbers.', intro: 'See how your videos are reaching your orbit. A view is counted once per signed-in viewer after at least three seconds of playback.', profile: 'Back to profile', views: 'Unique views', viewsNote: 'Across all your Reels', likes: 'Likes', likesNote: 'People who liked your videos', comments: 'Comments', commentsNote: 'Conversations started', interactions: 'Total interactions', interactionsNote: 'Likes and comments combined', listKicker: 'PERFORMANCE BY VIDEO', listTitle: 'Your published Reels', reelCount: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, loading: 'Loading your Reel analytics…', empty: 'You have not published any Reels yet. Publish your first video to see its performance here.', error: 'Your Reel analytics could not be loaded right now. Please try again later.', untitled: 'Untitled Reel', metricViews: 'Unique views', metricLikes: 'Likes', metricComments: 'Comments', openReel: 'Open Reel', tagline: 'Look inward. Move forward.',
    },
    ar: {
      back: '← العودة إلى Reels', kicker: 'لوحة إحصاءات صانع المحتوى', title: 'Reels الخاصة بك،', titleAccent: 'بالأرقام.', intro: 'تابع وصول فيديوهاتك إلى دائرتك. تُحتسب مشاهدة فريدة واحدة لكل مستخدم مسجّل بعد تشغيل الفيديو ثلاث ثوانٍ على الأقل.', profile: 'العودة إلى الملف الشخصي', views: 'مشاهدات فريدة', viewsNote: 'على جميع فيديوهات Reels', likes: 'الإعجابات', likesNote: 'من أعجبوا بفيديوهاتك', comments: 'التعليقات', commentsNote: 'المحادثات التي بدأت', interactions: 'إجمالي التفاعلات', interactionsNote: 'الإعجابات والتعليقات معًا', listKicker: 'الأداء حسب الفيديو', listTitle: 'فيديوهات Reels المنشورة', reelCount: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, loading: 'جارٍ تحميل إحصاءات Reels…', empty: 'لم تنشر أي Reel بعد. انشر أول فيديو لعرض أدائه هنا.', error: 'تعذّر تحميل إحصاءات Reels الآن. حاول مرة أخرى لاحقًا.', untitled: 'Reel بلا عنوان', metricViews: 'مشاهدات فريدة', metricLikes: 'إعجابات', metricComments: 'تعليقات', openReel: 'فتح الـ Reel', tagline: 'تأمل في ذاتك. انطلق إلى الأمام.',
    },
  };
  let rows = [];
  let state = 'loading';
  let loading = false;

  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = () => t[language()];
  const asBigInt = (value) => {
    try { return BigInt(value || 0); } catch { return 0n; }
  };
  const formatCount = (value) => new Intl.NumberFormat(language() === 'ar' ? 'ar' : 'en').format(asBigInt(value));
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(language() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(date);
  };
  const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };

  const applyCopy = () => {
    const text = copy();
    setText('stats-back-link', text.back);
    setText('stats-kicker', text.kicker);
    const title = document.querySelector('#stats-title');
    if (title) { title.replaceChildren(document.createTextNode(`${text.title} `)); const accent = document.createElement('span'); accent.textContent = text.titleAccent; title.append(accent); }
    const shortVideoNote = language() === 'ar' ? 'وتُحتسب مشاهدة الفيديو الأقصر عند اكتمال تشغيله.' : 'Shorter videos count after full playback.';
    setText('stats-intro', `${text.intro} ${shortVideoNote}`);
    const profileLink = document.querySelector('#stats-profile-link');
    if (profileLink) { profileLink.replaceChildren(document.createTextNode(`${text.profile} `)); const arrow = document.createElement('span'); arrow.className = 'button-arrow'; arrow.textContent = '↗'; profileLink.append(arrow); }
    setText('stats-total-views-label', text.views); setText('stats-total-views-note', text.viewsNote);
    setText('stats-total-likes-label', text.likes); setText('stats-total-likes-note', text.likesNote);
    setText('stats-total-comments-label', text.comments); setText('stats-total-comments-note', text.commentsNote);
    setText('stats-total-interactions-label', text.interactions); setText('stats-total-interactions-note', text.interactionsNote);
    setText('stats-list-kicker', text.listKicker); setText('stats-list-title', text.listTitle); setText('stats-footer-tagline', text.tagline);
    if (state === 'loading') renderMessage(text.loading);
    else if (state === 'error') renderMessage(text.error);
    else if (state === 'ready') renderRows();
  };

  const renderMessage = (message) => {
    list.replaceChildren();
    const notice = document.createElement('p'); notice.className = 'reel-stats-message'; notice.textContent = message; list.append(notice);
  };

  const metric = (value, label) => {
    const wrapper = document.createElement('div'); wrapper.className = 'reel-performance-metric';
    const count = document.createElement('strong'); count.textContent = formatCount(value);
    const caption = document.createElement('span'); caption.textContent = label;
    wrapper.append(count, caption);
    return wrapper;
  };

  const renderRows = () => {
    const text = copy();
    const views = rows.reduce((sum, row) => sum + asBigInt(row.view_count), 0n);
    const likes = rows.reduce((sum, row) => sum + asBigInt(row.like_count), 0n);
    const comments = rows.reduce((sum, row) => sum + asBigInt(row.comment_count), 0n);
    setText('stats-total-views', formatCount(views));
    setText('stats-total-likes', formatCount(likes));
    setText('stats-total-comments', formatCount(comments));
    setText('stats-total-interactions', formatCount(likes + comments));
    setText('stats-reel-count', text.reelCount(rows.length));
    list.replaceChildren();

    if (!rows.length) { renderMessage(text.empty); return; }
    rows.forEach((row) => {
      const card = document.createElement('article'); card.className = 'reel-performance-card';
      const heading = document.createElement('div'); heading.className = 'reel-performance-heading';
      const title = document.createElement('h3'); title.textContent = String(row.caption || '').trim() || text.untitled;
      const date = document.createElement('p'); date.textContent = formatDate(row.created_at);
      heading.append(title, date);
      const open = document.createElement('a'); open.className = 'reel-performance-link'; open.href = `./reel.html?reel=${encodeURIComponent(row.reel_id)}`; open.textContent = text.openReel;
      const metrics = document.createElement('div'); metrics.className = 'reel-performance-metrics';
      metrics.append(metric(row.view_count, text.metricViews), metric(row.like_count, text.metricLikes), metric(row.comment_count, text.metricComments));
      card.append(heading, open, metrics); list.append(card);
    });
  };

  const load = async () => {
    if (loading) return;
    loading = true; state = 'loading'; applyCopy();
    try {
      const client = await window.IQZodiacSupabase?.ready;
      if (!client) throw new Error('supabase_unavailable');
      const { data: userData, error: authError } = await client.auth.getUser();
      if (authError || !userData?.user?.id) throw new Error('authentication_required');
      const { data, error } = await client.rpc('get_my_reel_stats');
      if (error) throw error;
      rows = Array.isArray(data) ? data : [];
      state = 'ready'; renderRows();
    } catch (error) {
      console.warn('Private Reel analytics could not be loaded.', error);
      state = 'error'; renderMessage(copy().error);
    } finally {
      loading = false;
    }
  };

  document.addEventListener('iqzodiac:languagechange', applyCopy);
  applyCopy();
  void load();
})();
