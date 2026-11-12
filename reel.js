(() => {
  'use strict';

  const MAX_DURATION = 6 * 60;
  const MAX_BYTES = 50 * 1024 * 1024;
  const SIGNED_URL_TTL_SECONDS = 900;
  const COMMENT_PAGE_SIZE = 20;
  const FEED_PAGE_SIZE = 12;
  const database = () => window.IQZodiacSupabase?.ready;
  const byId = (id) => document.getElementById(id);
  const form = byId('reel-form');
  const fileInput = byId('reel-file');
  const preview = byId('reel-preview');
  const status = byId('reel-form-status');
  const feed = byId('reel-feed');
  const createDialog = byId('reel-create-dialog');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');
  const sharedWarning = byId('reel-shared-warning');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection?.saveData);
  let toastTimer;
  let selectedFile = null;
  let selectedDuration = null;
  let previewUrl = '';
  let selectionGeneration = 0;
  let authenticatedUserId = null;
  let currentUserName = '';
  let currentUserHandle = '';
  let activeVideo = null;
  let soundEnabled = false;
  let resumeOnDialogClose = false;
  let publishing = false;
  let statusKey = '';
  let statusArgs = [];
  let fallbackPlaybackFrame = 0;
  let feedCursor = null;
  let feedHasMore = true;
  let feedLoading = false;
  let feedReloadQueued = false;
  let feedClient = null;
  let feedRows = [];
  const feedVideos = new Set();
  const sourceLoads = new WeakMap();

  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = {
    en: {
      mobileSubtitle: 'Your orbit', back: 'Back to IQZodiac', addComment: 'Add a comment…', creatorsLabel: 'People who posted Reels', loadMoreFailed: 'Could not load more Reels. Scroll to retry.',
      create: 'Create Reel', stats: 'My Reel statistics', kicker: 'SHORT FORM · YOUR ORBIT', title: 'Reels', titleAccent: 'in motion.', intro: 'Swipe vertically to move between recent videos from your orbit.', feedKicker: 'FROM YOUR ORBIT', feedTitle: 'Recent Reels', loading: 'Loading Reels…', footer: 'Look inward. Move forward.',
      createKicker: 'CREATE A REEL', createTitle: 'Share a moment', createNote: 'Choose a video up to six minutes and 50 MB. Add a caption, preview it, then publish.', caption: 'Caption', optional: '(optional)', captionPlaceholder: 'What are you sharing?', fileMeta: 'MP4, WebM or MOV · up to 50 MB', publish: 'Publish Reel', close: 'Close',
      choose: 'Choose a video', selected: 'Video selected', invalidType: 'Choose a supported video file.', invalidMetadata: 'The video could not be read. Try another MP4, WebM or MOV file.', tooLarge: 'Video must be 50 MB or smaller.', tooLong: 'Reels can be no longer than 6 minutes.', checking: 'Checking video duration…', ready: (duration) => `Ready to publish · ${duration}`, publishing: 'Uploading and publishing your Reel…', saved: 'Your Reel is now in your orbit.', savedRefreshFailed: 'Published successfully, but the feed could not refresh. Reload to see it.', failed: 'Your Reel could not be published. Check your connection and try again.', signInToPublish: 'Sign in again to publish a Reel.',
      empty: 'No Reels have been published yet. Be the first to share one.', unavailable: 'Reels are temporarily unavailable. Please try again.', count: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, duration: (n) => `${formatNumber(Math.round(n))}s`,
      like: 'Like', liked: 'Liked', comments: 'Comments', commentCount: (n) => formatNumber(n), writeComment: 'Write a comment…', postComment: 'Post comment', commentSaved: 'Comment added.', commentFailed: 'Comment could not be saved. Try again.', commentsLoadFailed: 'Comments could not be loaded. Close and reopen to retry.', commentsLoading: 'Loading comments…', loadMore: 'Load older comments', likeFailed: 'Like could not be saved. Try again.', signInToInteract: 'Sign in to interact with Reels.', noComments: 'No comments yet. Start the conversation.', commentBy: (name) => `Comment by ${name}`, deleteComment: 'Delete comment', member: 'Member', you: 'You',
      share: 'Share', saveItem: 'Save', itemSaved: 'Saved', saveFailed: 'Could not update Saved. Try again.', copyLink: 'Copy link', copied: 'Link copied.', shareTitle: 'Share this Reel', shareText: 'Watch this Reel on IQZodiac', shareOptions: 'Share options', sharedUnavailable: 'That shared Reel is unavailable or may have been removed. Showing recent Reels instead.',
      play: 'Play video', pause: 'Pause video', soundOn: 'Turn sound on', soundOff: 'Mute video', mediaError: 'This video could not be loaded. Check your connection and try again.', autoplayBlocked: 'Tap play to start this video.',
    },
    ar: {
      mobileSubtitle: 'من مدارك', back: 'العودة إلى IQZodiac', addComment: 'أضف تعليقًا…', creatorsLabel: 'أعضاء نشروا Reels', loadMoreFailed: 'تعذّر تحميل المزيد من Reels. مرّر مجددًا للمحاولة.',
      create: 'إنشاء Reel', stats: 'إحصاءات Reels الخاصة بي', kicker: 'فيديو قصير · مدارك', title: 'Reels', titleAccent: 'تتحرك.', intro: 'اسحب عموديًا للتنقل بين أحدث مقاطع الفيديو من دائرتك.', feedKicker: 'من مدارك', feedTitle: 'أحدث Reels', loading: 'جارٍ تحميل Reels…', footer: 'تأمّل ذاتك. وانطلق نحو الأمام.',
      createKicker: 'إنشاء Reel', createTitle: 'شارك لحظة', createNote: 'اختر فيديو لا تتجاوز مدته ست دقائق وحجمه ٥٠ ميغابايت. أضف وصفًا، عاينه، ثم انشره.', caption: 'الوصف', optional: '(اختياري)', captionPlaceholder: 'ما الذي تود مشاركته؟', fileMeta: 'MP4 أو WebM أو MOV · حتى ٥٠ ميغابايت', publish: 'نشر Reel', close: 'إغلاق',
      choose: 'اختر فيديو', selected: 'تم اختيار الفيديو', invalidType: 'اختر ملف فيديو مدعومًا.', invalidMetadata: 'تعذّرت قراءة الفيديو. جرّب ملف MP4 أو WebM أو MOV آخر.', tooLarge: 'يجب ألا يتجاوز الفيديو ٥٠ ميغابايت.', tooLong: 'يجب ألا تتجاوز مدة الـ Reel ست دقائق.', checking: 'جارٍ التحقق من مدة الفيديو…', ready: (duration) => `جاهز للنشر · ${duration}`, publishing: 'جارٍ رفع الـ Reel ونشره…', saved: 'تم نشر الـ Reel في مدارك.', savedRefreshFailed: 'تم النشر، لكن تعذّر تحديث الموجز. أعد تحميل الصفحة لرؤيته.', failed: 'تعذّر نشر الـ Reel. تحقّق من الاتصال وحاول مجددًا.', signInToPublish: 'سجّل الدخول مجددًا لنشر Reel.',
      empty: 'لا توجد Reels منشورة بعد. كن أول من يشارك واحدة.', unavailable: 'Reels غير متاحة مؤقتًا. حاول مجددًا.', count: (n) => `${formatNumber(n)} Reel`, duration: (n) => `${formatNumber(Math.round(n))} ث`,
      like: 'إعجاب', liked: 'أعجبني', comments: 'التعليقات', commentCount: (n) => formatNumber(n), writeComment: 'اكتب تعليقًا…', postComment: 'نشر التعليق', commentSaved: 'تمت إضافة التعليق.', commentFailed: 'تعذّر حفظ التعليق. حاول مجددًا.', commentsLoadFailed: 'تعذّر تحميل التعليقات. أغلق اللوحة وافتحها للمحاولة مجددًا.', commentsLoading: 'جارٍ تحميل التعليقات…', loadMore: 'تحميل تعليقات أقدم', likeFailed: 'تعذّر حفظ الإعجاب. حاول مجددًا.', signInToInteract: 'سجّل الدخول للتفاعل مع Reels.', noComments: 'لا توجد تعليقات بعد. ابدأ الحوار.', commentBy: (name) => `تعليق من ${name}`, deleteComment: 'حذف التعليق', member: 'عضو', you: 'أنت',
      share: 'مشاركة', saveItem: 'حفظ', itemSaved: 'تم الحفظ', saveFailed: 'تعذّر تحديث المحفوظات. حاول مجددًا.', copyLink: 'نسخ الرابط', copied: 'تم نسخ الرابط.', shareTitle: 'مشاركة هذا الـ Reel', shareText: 'شاهد هذا الـ Reel على IQZodiac', shareOptions: 'خيارات المشاركة', sharedUnavailable: 'هذا الـ Reel غير متاح أو ربما حُذف. نعرض أحدث Reels بدلًا منه.',
      play: 'تشغيل الفيديو', pause: 'إيقاف الفيديو مؤقتًا', soundOn: 'تشغيل الصوت', soundOff: 'كتم الفيديو', mediaError: 'تعذّر تحميل الفيديو. تحقّق من الاتصال وحاول مجددًا.', autoplayBlocked: 'اضغط تشغيل لبدء الفيديو.',
    },
  };
  const t = (key, ...args) => {
    const value = copy[language()][key];
    return typeof value === 'function' ? value(...args) : (value ?? key);
  };
  const formatNumber = (value) => new Intl.NumberFormat(language() === 'ar' ? 'ar' : 'en').format(Number(value) || 0);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatDate = (value) => {
    try { return new Intl.DateTimeFormat(language() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(value)); } catch { return ''; }
  };
  const initials = (value) => String(value || '').replace(/^@/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IQ';
  const shareUrl = (row) => new URL(`./reel.html?reel=${encodeURIComponent(row.id)}`, document.baseURI).href;
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

  const setStatus = (key = '', state = '', ...args) => {
    statusKey = key;
    statusArgs = args;
    status.textContent = key ? t(key, ...args) : '';
    status.dataset.state = state;
  };
  const showToast = (message) => {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  };
  const updateCaptionPreview = () => {
    const overlay = preview.querySelector('.reel-preview-caption');
    if (!overlay) return;
    overlay.textContent = byId('reel-caption').value.trim();
    overlay.hidden = !overlay.textContent;
  };
  const updateCaptionCount = () => {
    const value = byId('reel-caption').value.length;
    byId('reel-caption-count').textContent = `${formatNumber(value)} / 280`;
    updateCaptionPreview();
  };
  const updateStatsShortcutLabel = () => { byId('reel-stats-shortcut-label').textContent = t('stats'); };
  const applyStaticCopy = () => {
    const textMap = {
      'reel-create-open-label': 'create',
      'reel-create-kicker': 'createKicker',
      'reel-create-title': 'createTitle',
      'reel-create-note': 'createNote',
      'reel-file-meta': 'fileMeta',
      'publish-reel-label': 'publish',
    };
    Object.entries(textMap).forEach(([id, key]) => { const node = byId(id); if (node) node.textContent = t(key); });
    byId('reel-page-title').textContent = t('title');
    const captionLabel = byId('reel-caption-label');
    captionLabel.replaceChildren(document.createTextNode(`${t('caption')} `));
    const optional = document.createElement('span'); optional.textContent = t('optional'); captionLabel.append(optional);
    byId('reel-caption').placeholder = t('captionPlaceholder');
    document.querySelectorAll('.reel-create-trigger').forEach((button) => button.setAttribute('aria-label', t('create')));
    byId('reel-create-close').setAttribute('aria-label', t('close'));
    feed.setAttribute('aria-label', t('title'));
    const homeLink = document.querySelector('.reel-home-link');
    if (homeLink) {
      homeLink.setAttribute('aria-label', t('back'));
      homeLink.querySelector('span').textContent = language() === 'ar' ? '→' : '←';
    }
    document.querySelector('.reel-stats-shortcut')?.setAttribute('aria-label', t('stats'));
    updateStatsShortcutLabel();
    updateCaptionCount();
    if (!selectedFile) byId('reel-file-label').textContent = t('choose');
    if (statusKey) setStatus(statusKey, status.dataset.state || '', ...statusArgs);
    feed.querySelectorAll('.reel-card').forEach((card) => {
      const likeButton = card.querySelector('.reel-like-button');
      const liked = likeButton?.dataset.liked === 'true';
      if (likeButton) {
        likeButton.querySelector('.reel-like-label').textContent = t(liked ? 'liked' : 'like');
        likeButton.setAttribute('aria-label', `${t(liked ? 'liked' : 'like')} · ${likeButton.querySelector('.reel-like-count').textContent}`);
      }
      const commentButton = card.querySelector('.reel-comment-toggle');
      if (commentButton) {
        commentButton.querySelector('.reel-comment-label').textContent = t('comments');
        commentButton.setAttribute('aria-label', `${t('comments')} · ${commentButton.querySelector('.reel-comment-count').textContent}`);
      }
      const shareButton = card.querySelector('.reel-share-button');
      if (shareButton) { shareButton.querySelector('.reel-action-label').textContent = t('share'); shareButton.setAttribute('aria-label', t('share')); }
      const saveButton = card.querySelector('.reel-save-button');
      if (saveButton) {
        const saved = saveButton.dataset.saved === 'true';
        saveButton.querySelector('.reel-action-label').textContent = t(saved ? 'itemSaved' : 'saveItem');
        saveButton.setAttribute('aria-label', t(saved ? 'itemSaved' : 'saveItem'));
      }
      const input = card.querySelector('.reel-comment-form input');
      if (input) { input.placeholder = t('addComment'); input.setAttribute('aria-label', t('addComment')); }
      const postButton = card.querySelector('.reel-comment-form button');
      if (postButton) postButton.setAttribute('aria-label', t('postComment'));
      const more = card.querySelector('.reel-comments-more');
      if (more) more.textContent = t('loadMore');
      const empty = card.querySelector('.reel-comments-empty');
      if (empty) empty.textContent = t('noComments');
      const error = card.querySelector('.reel-comments-error');
      if (error) error.textContent = t('commentsLoadFailed');
      const deleteButtons = card.querySelectorAll('.reel-comment-delete');
      deleteButtons.forEach((button) => button.setAttribute('aria-label', t('deleteComment')));
      card.querySelectorAll('.reel-comment-body small[data-created-at]').forEach((date) => { date.textContent = formatDate(date.dataset.createdAt); });
      const video = card.querySelector('.reel-card-video');
      if (video) {
        video.setAttribute('aria-label', t('feedTitle'));
        updatePlayerControls(video);
      }
    });
    if (feed.querySelector('.reel-empty')) feed.querySelector('.reel-empty').textContent = t(feed.dataset.state === 'unavailable' ? 'unavailable' : 'empty');
    if (!sharedWarning.hidden) sharedWarning.textContent = t('sharedUnavailable');
    feed.querySelectorAll('.reel-share-menu').forEach((menu) => menu.remove());
    feed.querySelectorAll('.reel-share-button').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  };

  const updatePlayerControls = (video) => {
    const player = video.closest('.reel-player');
    if (!player) return;
    const playButton = player.querySelector('.reel-play-toggle');
    const soundButton = player.querySelector('.reel-sound-toggle');
    if (playButton) {
      const paused = video.paused;
      playButton.textContent = paused ? '▶' : 'Ⅱ';
      playButton.setAttribute('aria-label', t(paused ? 'play' : 'pause'));
      playButton.title = t(paused ? 'play' : 'pause');
      playButton.classList.toggle('is-playing', !paused);
    }
    if (soundButton) {
      soundButton.textContent = video.muted ? '◖' : '◖))';
      soundButton.classList.toggle('is-muted', video.muted);
      soundButton.setAttribute('aria-label', t(video.muted ? 'soundOn' : 'soundOff'));
      soundButton.title = t(video.muted ? 'soundOn' : 'soundOff');
    }
  };

  const safeCloseShareMenu = (card) => {
    card.querySelector('.reel-share-menu')?.remove();
    card.querySelector('.reel-share-button')?.setAttribute('aria-expanded', 'false');
  };
  const copyShareLink = async (row) => {
    try { await navigator.clipboard.writeText(shareUrl(row)); showToast(t('copied')); }
    catch { window.prompt(t('shareTitle'), shareUrl(row)); }
  };
  const openShareMenu = (card, row) => {
    const existing = card.querySelector('.reel-share-menu');
    if (existing) { safeCloseShareMenu(card); return; }
    feed.querySelectorAll('.reel-card').forEach((other) => { if (other !== card) safeCloseShareMenu(other); });
    const url = shareUrl(row);
    const text = t('shareText');
    const menu = document.createElement('div');
    menu.className = 'reel-share-menu';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', t('shareOptions'));
    const options = [
      { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
      { label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
      { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
      { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    ];
    options.forEach(({ label, href }) => {
      const link = document.createElement('a');
      link.className = 'reel-share-option'; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = label;
      menu.append(link);
    });
    const copyButton = document.createElement('button');
    copyButton.className = 'reel-share-option'; copyButton.type = 'button'; copyButton.textContent = t('copyLink');
    copyButton.addEventListener('click', () => { void copyShareLink(row); safeCloseShareMenu(card); });
    menu.append(copyButton);
    card.querySelector('.reel-player').append(menu);
    card.querySelector('.reel-share-button')?.setAttribute('aria-expanded', 'true');
    menu.querySelector('a,button')?.focus({ preventScroll: true });
  };
  const shareReel = async (card, row) => {
    if (navigator.share) {
      try { await navigator.share({ title: t('shareTitle'), text: t('shareText'), url: shareUrl(row) }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    openShareMenu(card, row);
  };

  const showMediaError = (video, show = true) => {
    const notice = video.closest('.reel-player')?.querySelector('.reel-media-error');
    if (notice) { notice.hidden = !show; notice.textContent = t('mediaError'); }
  };
  const ensureVideoSource = async (video, force = false) => {
    const expiry = Number(video.dataset.signedExpiresAt || 0);
    if (!force && video.getAttribute('src') && expiry > Date.now() + 45_000) return true;
    const currentLoad = sourceLoads.get(video);
    if (currentLoad) return currentLoad;
    const load = (async () => {
      try {
        const client = await database();
        if (!client || !video.dataset.mediaPath) throw new Error('media-path-unavailable');
        const { data, error } = await client.storage.from('iqzodiac-media').createSignedUrl(video.dataset.mediaPath, SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) throw error || new Error('signed-url-unavailable');
        video.src = data.signedUrl;
        video.dataset.signedExpiresAt = String(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
        video.preload = 'metadata';
        video.load();
        showMediaError(video, false);
        return true;
      } catch (error) {
        console.warn('Reel media URL could not be refreshed.', error);
        showMediaError(video, true);
        return false;
      }
    })();
    sourceLoads.set(video, load);
    try { return await load; }
    finally { if (sourceLoads.get(video) === load) sourceLoads.delete(video); }
  };
  const releaseVideo = (video) => {
    if (!video || video === activeVideo || !video.hasAttribute('src')) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    delete video.dataset.signedExpiresAt;
    delete video.dataset.retryCount;
    if (lazyObserver) lazyObserver.observe(video);
  };
  const releaseFarVideos = () => {
    if (!feed.clientHeight) return;
    const root = feed.getBoundingClientRect();
    feedVideos.forEach((video) => {
      if (video === activeVideo) return;
      const card = video.closest('.reel-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const distance = rect.bottom < root.top ? root.top - rect.bottom : rect.top > root.bottom ? rect.top - root.bottom : 0;
      if (distance > feed.clientHeight * 1.3) releaseVideo(video);
    });
  };
  const canAutoplay = () => !saveData && !reducedMotion?.matches;
  const playActiveVideo = async (video, userGesture = false) => {
    if (!video || createDialog.open || document.hidden) return;
    if (activeVideo && activeVideo !== video) activeVideo.pause();
    activeVideo = video;
    if (!userGesture && !canAutoplay()) { updatePlayerControls(video); return; }
    const sourceReady = await ensureVideoSource(video);
    if (!sourceReady || activeVideo !== video || createDialog.open || document.hidden) return;
    video.muted = !soundEnabled;
    try { await video.play(); }
    catch { showToast(t('autoplayBlocked')); }
    updatePlayerControls(video);
    releaseFarVideos();
  };
  const pauseActiveVideo = () => {
    if (activeVideo) { activeVideo.pause(); updatePlayerControls(activeVideo); }
  };
  const toggleVideoPlayback = (video) => {
    if (video.paused) void playActiveVideo(video, true);
    else { video.pause(); updatePlayerControls(video); }
  };

  const hasIntersectionObserver = typeof window.IntersectionObserver === 'function';
  const lazyObserver = hasIntersectionObserver ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      lazyObserver.unobserve(entry.target);
      if (canAutoplay()) void ensureVideoSource(entry.target);
    });
  }, { root: feed, rootMargin: '100% 0px', threshold: 0 }) : null;
  const playbackObserver = hasIntersectionObserver ? new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.58).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible.length) {
      const video = visible[0].target.querySelector('.reel-card-video');
      if (video) void playActiveVideo(video);
    } else {
      const activeCard = activeVideo?.closest('.reel-card');
      const activeEntry = entries.find((entry) => entry.target === activeCard);
      if (activeEntry && activeEntry.intersectionRatio < 0.58) pauseActiveVideo();
    }
  }, { root: feed, threshold: [0, 0.25, 0.58, 0.8, 1] }) : null;
  const resourceObserver = hasIntersectionObserver ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) releaseVideo(entry.target.querySelector('.reel-card-video'));
    });
  }, { root: feed, rootMargin: '150% 0px', threshold: 0 }) : null;

  const clearSelection = () => {
    selectionGeneration += 1;
    selectedFile = null;
    selectedDuration = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    preview.replaceChildren();
    preview.hidden = true;
    fileInput.value = '';
    byId('reel-file-label').textContent = t('choose');
    setStatus('');
  };
  const readDuration = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    let completed = false;
    const finish = (error, duration) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(duration);
    };
    const timeout = setTimeout(() => finish(new Error('metadata-timeout')), 20_000);
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      Number.isFinite(duration) && duration > 0 ? finish(null, duration) : finish(new Error('invalid-duration'));
    };
    video.onerror = () => finish(new Error('invalid-video'));
    video.src = url;
    video.load();
  });
  const fileExtension = (file) => (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  const isSupportedVideo = (file) => Boolean(file && (file.type?.toLowerCase().startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv|ogg|3gp|avi|mkv)$/i.test(file.name)));
  const inferredMime = (file) => {
    if (file.type?.toLowerCase().startsWith('video/')) return file.type;
    const extension = fileExtension(file);
    return ({ mp4: 'video/mp4', m4v: 'video/x-m4v', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg', ogg: 'video/ogg', '3gp': 'video/3gpp', avi: 'video/x-msvideo', mkv: 'video/x-matroska' })[extension] || 'video/mp4';
  };
  const setSelection = async (file) => {
    clearSelection();
    const generation = selectionGeneration;
    if (!file) return;
    if (!isSupportedVideo(file)) { setStatus('invalidType', 'error'); return; }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) { setStatus('tooLarge', 'error'); return; }
    setStatus('checking');
    try {
      const duration = await readDuration(file);
      if (generation !== selectionGeneration) return;
      if (duration > MAX_DURATION) { setStatus('tooLong', 'error'); return; }
      selectedFile = file;
      selectedDuration = duration;
      previewUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = previewUrl; video.controls = true; video.muted = true; video.playsInline = true; video.preload = 'metadata';
      video.setAttribute('aria-label', language() === 'ar' ? 'معاينة الفيديو' : 'Video preview');
      const captionOverlay = document.createElement('p');
      captionOverlay.className = 'reel-preview-caption';
      captionOverlay.setAttribute('aria-hidden', 'true');
      preview.append(video, captionOverlay);
      preview.hidden = false;
      updateCaptionPreview();
      byId('reel-file-label').textContent = t('selected');
      setStatus('ready', 'success', t('duration', duration));
    } catch (error) {
      if (generation !== selectionGeneration) return;
      console.warn('Reel video metadata could not be read.', error);
      setStatus('invalidMetadata', 'error');
    }
  };

  const updateLikeButton = (card, row, liked) => {
    const button = card.querySelector('.reel-like-button');
    const countNode = card.querySelector('.reel-like-count');
    const count = Math.max(0, Number(countNode.dataset.count) || 0);
    button.classList.toggle('is-liked', liked);
    button.dataset.liked = String(liked);
    button.setAttribute('aria-pressed', String(liked));
    button.querySelector('.reel-action-icon').textContent = liked ? '♥' : '♡';
    button.querySelector('.reel-like-label').textContent = t(liked ? 'liked' : 'like');
    button.setAttribute('aria-label', `${t(liked ? 'liked' : 'like')} · ${countNode.textContent}`);
    countNode.dataset.count = String(count);
    countNode.textContent = formatNumber(count);
    row.liked_by_me = liked;
  };
  const updateSaveButton = (card, row, saved) => {
    const button = card.querySelector('.reel-save-button');
    if (!button) return;
    button.dataset.saved = String(saved);
    button.setAttribute('aria-pressed', String(saved));
    button.classList.toggle('is-saved', saved);
    button.querySelector('.reel-action-label').textContent = t(saved ? 'itemSaved' : 'saveItem');
    button.setAttribute('aria-label', t(saved ? 'itemSaved' : 'saveItem'));
    row.saved_by_me = saved;
  };
  const updateCommentCount = (card, row, delta = 0) => {
    row.comment_count = Math.max(0, (Number(row.comment_count) || 0) + delta);
    const node = card.querySelector('.reel-comment-count');
    node.dataset.count = String(row.comment_count);
    node.textContent = t('commentCount', row.comment_count);
    const button = card.querySelector('.reel-comment-toggle');
    button.setAttribute('aria-label', `${t('comments')} · ${node.textContent}`);
    const more = card.querySelector('.reel-comments-more');
    if (more) more.hidden = Number(card.dataset.commentsLoaded || 0) >= row.comment_count;
  };
  const addEmptyComments = (list) => {
    list.replaceChildren();
    const empty = document.createElement('li'); empty.className = 'reel-comments-empty'; empty.textContent = t('noComments'); list.append(empty);
  };
  const enrichCommentAuthors = async (comments, client) => {
    const ids = [...new Set(comments.map((comment) => comment.author_id).filter(Boolean))];
    if (!ids.length) return comments;
    try {
      const { data, error } = await client.rpc('get_public_profile_cards', { p_user_ids: ids });
      if (error) throw error;
      const profiles = new Map((data || []).map((profile) => [profile.user_id, profile]));
      return comments.map((comment) => ({ ...comment, ...(profiles.get(comment.author_id) || {}) }));
    } catch (error) {
      console.warn('Public comment author labels could not be loaded.', error);
      return comments;
    }
  };
  const makeComment = (comment, client, card, row) => {
    const item = document.createElement('li'); item.className = 'reel-comment'; item.dataset.commentId = comment.id;
    const name = comment.author_id === authenticatedUserId ? (currentUserName || t('you')) : (comment.display_name || comment.handle || t('member'));
    const avatar = document.createElement('span'); avatar.className = 'reel-comment-avatar'; avatar.textContent = initials(name);
    const body = document.createElement('div'); body.className = 'reel-comment-body';
    const author = document.createElement('strong'); author.textContent = name;
    const text = document.createElement('p'); text.textContent = comment.body;
    const meta = document.createElement('small'); meta.dataset.createdAt = comment.created_at; meta.textContent = formatDate(comment.created_at);
    body.append(author, text, meta); item.append(avatar, body);
    item.setAttribute('aria-label', t('commentBy', name));
    if (comment.author_id === authenticatedUserId) {
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'reel-comment-delete'; remove.textContent = '×'; remove.setAttribute('aria-label', t('deleteComment'));
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          const { error } = await client.from('reel_comments').delete().eq('id', comment.id).eq('author_id', authenticatedUserId);
          if (error) throw error;
          item.remove();
          updateCommentCount(card, row, -1);
          if (!card.querySelector('.reel-comments-list').querySelector('.reel-comment')) addEmptyComments(card.querySelector('.reel-comments-list'));
        } catch (error) { console.warn('Reel comment could not be deleted.', error); remove.disabled = false; showToast(t('commentFailed')); }
      });
      item.append(remove);
    }
    return item;
  };
  const loadComments = async (card, row, client, appendOlder = false) => {
    if (card.dataset.commentsLoading === 'true') return;
    const loaded = Number(card.dataset.commentsLoaded || 0);
    if (!appendOlder && card.dataset.commentsLoaded !== undefined) return;
    if (appendOlder && loaded >= Number(row.comment_count || 0)) return;
    const list = card.querySelector('.reel-comments-list');
    const more = card.querySelector('.reel-comments-more');
    const start = appendOlder ? loaded : 0;
    card.dataset.commentsLoading = 'true';
    more.disabled = true;
    more.textContent = t('commentsLoading');
    if (!appendOlder) list.replaceChildren();
    try {
      if (Number(row.comment_count || 0) === 0) {
        addEmptyComments(list);
        card.dataset.commentsLoaded = '0';
        more.hidden = true;
        return;
      }
      const { data, error } = await client.from('reel_comments')
        .select('id,reel_id,author_id,body,created_at')
        .eq('reel_id', row.id)
        .order('created_at', { ascending: false })
        .range(start, start + COMMENT_PAGE_SIZE - 1);
      if (error) throw error;
      const ordered = (data || []).reverse();
      const comments = await enrichCommentAuthors(ordered, client);
      const nodes = comments.map((comment) => makeComment(comment, client, card, row));
      if (appendOlder) {
        const firstComment = list.querySelector('.reel-comment');
        nodes.forEach((node) => firstComment ? list.insertBefore(node, firstComment) : list.append(node));
      } else {
        list.replaceChildren(...nodes);
      }
      const nextLoaded = loaded + comments.length;
      card.dataset.commentsLoaded = String(nextLoaded);
      more.hidden = nextLoaded >= Number(row.comment_count || 0) || comments.length < COMMENT_PAGE_SIZE;
    } catch (error) {
      console.warn('Reel comments could not be loaded.', error);
      if (!appendOlder) {
        list.replaceChildren();
        const errorNode = document.createElement('li'); errorNode.className = 'reel-comments-empty reel-comments-error'; errorNode.textContent = t('commentsLoadFailed'); list.append(errorNode);
      }
      more.hidden = true;
      delete card.dataset.commentsLoaded;
    } finally {
      card.dataset.commentsLoading = 'false';
      more.disabled = false;
      more.textContent = t('loadMore');
    }
  };
  const bindInteractions = (card, row, client) => {
    const likeButton = card.querySelector('.reel-like-button');
    const saveButton = card.querySelector('.reel-save-button');
    const shareButton = card.querySelector('.reel-share-button');
    const commentButton = card.querySelector('.reel-comment-toggle');
    const commentsPanel = card.querySelector('.reel-comments-panel');
    const video = card.querySelector('.reel-card-video');

    shareButton.addEventListener('click', () => { void shareReel(card, row); });
    saveButton.addEventListener('click', async () => {
      if (!authenticatedUserId || !window.IQZodiacSavedItems) { showToast(t('signInToInteract')); return; }
      const currentlySaved = saveButton.dataset.saved === 'true';
      saveButton.disabled = true;
      try {
        const saved = await window.IQZodiacSavedItems.toggle(client, authenticatedUserId, 'reel', row.id, currentlySaved);
        updateSaveButton(card, row, saved);
      } catch (error) { console.warn('Reel save could not be updated.', error); showToast(t('saveFailed')); }
      finally { saveButton.disabled = false; }
    });
    commentButton.addEventListener('click', () => {
      const open = commentButton.getAttribute('aria-expanded') !== 'true';
      commentButton.setAttribute('aria-expanded', String(open));
      commentsPanel.hidden = !open;
      if (open) {
        if (card.dataset.commentsLoaded === undefined) void loadComments(card, row, client);
        if (Number(row.comment_count || 0) === 0 && card.dataset.commentsLoaded === undefined) card.dataset.commentsLoaded = '0';
      }
    });
    card.querySelector('.reel-comments-more').addEventListener('click', () => { void loadComments(card, row, client, true); });
    card.querySelector('.reel-play-toggle').addEventListener('click', () => toggleVideoPlayback(video));
    card.querySelector('.reel-sound-toggle').addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      video.muted = !soundEnabled;
      if (video.paused && soundEnabled) void playActiveVideo(video, true);
      updatePlayerControls(video);
    });

    let viewRequestPending = false;
    const recordReelView = async () => {
      if (!authenticatedUserId || viewRequestPending || card.dataset.viewRecorded === 'true' || video.paused) return;
      const duration = Number(video.duration);
      const threshold = Number.isFinite(duration) && duration > 0 ? Math.min(3, duration) : 3;
      if (video.currentTime < threshold) return;
      viewRequestPending = true;
      card.dataset.viewRecorded = 'pending';
      try {
        const { error } = await client.rpc('record_reel_view', { p_reel_id: row.id });
        if (error) throw error;
        card.dataset.viewRecorded = 'true';
      } catch (error) {
        delete card.dataset.viewRecorded;
        console.warn('Reel view could not be recorded.', error);
      } finally { viewRequestPending = false; }
    };
    video.addEventListener('timeupdate', () => { void recordReelView(); });
    video.addEventListener('ended', () => { void recordReelView(); });
    video.addEventListener('playing', () => { video.dataset.retryCount = '0'; updatePlayerControls(video); });
    video.addEventListener('pause', () => updatePlayerControls(video));
    video.addEventListener('play', () => updatePlayerControls(video));
    video.addEventListener('error', () => {
      if (!video.hasAttribute('src')) return;
      const retryCount = Number(video.dataset.retryCount || 0);
      if (retryCount < 1 && video.dataset.mediaPath) {
        video.dataset.retryCount = '1';
        video.dataset.signedExpiresAt = '0';
        void ensureVideoSource(video, true).then((refreshed) => {
          if (refreshed && activeVideo === video && !createDialog.open) void playActiveVideo(video);
          else if (!refreshed) showMediaError(video, true);
        });
      } else showMediaError(video, true);
    });
    video.addEventListener('click', () => toggleVideoPlayback(video));
    video.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      toggleVideoPlayback(video);
    });

    likeButton.addEventListener('click', async () => {
      if (!authenticatedUserId) { showToast(t('signInToInteract')); return; }
      const currentlyLiked = likeButton.dataset.liked === 'true';
      likeButton.disabled = true;
      try {
        if (currentlyLiked) {
          const { error } = await client.from('reel_likes').delete().eq('reel_id', row.id).eq('user_id', authenticatedUserId);
          if (error) throw error;
          updateLikeButton(card, row, false);
          const countNode = card.querySelector('.reel-like-count');
          const count = Math.max(0, Number(countNode.dataset.count) - 1); countNode.dataset.count = String(count); countNode.textContent = formatNumber(count); row.like_count = count;
          likeButton.setAttribute('aria-label', `${t('like')} · ${countNode.textContent}`);
        } else {
          const { error } = await client.from('reel_likes').insert({ reel_id: row.id, user_id: authenticatedUserId });
          if (error && error.code !== '23505') throw error;
          if (!error) { const countNode = card.querySelector('.reel-like-count'); const count = Number(countNode.dataset.count) + 1; countNode.dataset.count = String(count); countNode.textContent = formatNumber(count); row.like_count = count; }
          updateLikeButton(card, row, true);
        }
      } catch (error) { console.warn('Reel like could not be saved.', error); showToast(t('likeFailed')); }
      finally { likeButton.disabled = false; }
    });

    const commentForm = card.querySelector('.reel-comment-form');
    const input = commentForm.querySelector('input');
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = input.value.trim().slice(0, 180);
      if (!body) return;
      if (!authenticatedUserId) { showToast(t('signInToInteract')); return; }
      const button = commentForm.querySelector('button'); button.disabled = true;
      try {
        const { data, error } = await client.from('reel_comments')
          .insert({ reel_id: row.id, author_id: authenticatedUserId, body })
          .select('id,reel_id,author_id,body,created_at').single();
        if (error) throw error;
        const list = card.querySelector('.reel-comments-list');
        list.querySelector('.reel-comments-empty')?.remove();
        const comment = { ...data, display_name: currentUserName || t('you'), handle: currentUserHandle };
        list.append(makeComment(comment, client, card, row));
        input.value = '';
        updateCommentCount(card, row, 1);
        card.dataset.commentsLoaded = String((Number(card.dataset.commentsLoaded) || 0) + 1);
        const more = card.querySelector('.reel-comments-more');
        more.hidden = Number(card.dataset.commentsLoaded) >= Number(row.comment_count);
        showToast(t('commentSaved'));
      } catch (error) { console.warn('Reel comment could not be saved.', error); showToast(t('commentFailed')); }
      finally { button.disabled = false; }
    });
    updatePlayerControls(video);
  };

  const renderReels = (rows, client, append = false) => {
    if (!append) {
      feed.querySelectorAll('.reel-card').forEach((card) => {
        const video = card.querySelector('.reel-card-video');
        if (video) { lazyObserver?.unobserve(video); feedVideos.delete(video); }
        playbackObserver?.unobserve(card);
        resourceObserver?.unobserve(card);
      });
      pauseActiveVideo();
      activeVideo = null;
      feedVideos.clear();
      feedRows = [];
      feed.replaceChildren();
    } else {
      const knownIds = new Set(feedRows.map((row) => row.id));
      const pageIds = new Set();
      rows = rows.filter((row) => !knownIds.has(row.id) && !pageIds.has(row.id) && pageIds.add(row.id));
    }
    feedRows.push(...rows);
    feed.dataset.state = feedRows.length ? 'ready' : 'empty';
    feed.setAttribute('aria-busy', 'false');
    if (!feedRows.length) {
      const empty = document.createElement('p'); empty.className = 'reel-empty'; empty.textContent = t('empty'); empty.setAttribute('role', 'status'); feed.append(empty); return;
    }

    rows.forEach((row) => {
      const card = document.createElement('article'); card.className = 'reel-card'; card.dataset.reelId = row.id;
      const player = document.createElement('div'); player.className = 'reel-player';
      const video = document.createElement('video');
      video.className = 'reel-card-video'; video.playsInline = true; video.preload = 'none'; video.muted = true; video.loop = true;
      video.dataset.mediaPath = row.media_path;
      video.setAttribute('aria-label', t('title'));
      video.setAttribute('tabindex', '0');

      const controls = document.createElement('div'); controls.className = 'reel-player-controls';
      const play = document.createElement('button'); play.className = 'reel-player-control reel-play-toggle'; play.type = 'button'; play.textContent = '▶'; play.setAttribute('aria-label', t('play'));
      const sound = document.createElement('button'); sound.className = 'reel-player-control reel-sound-toggle is-muted'; sound.type = 'button'; sound.textContent = '◖'; sound.setAttribute('aria-label', t('soundOn'));
      controls.append(play, sound);
      const error = document.createElement('p'); error.className = 'reel-media-error'; error.textContent = t('mediaError'); error.hidden = true;

      const actions = document.createElement('div'); actions.className = 'reel-actions';
      actions.innerHTML = `<button type="button" class="reel-action reel-like-button" data-liked="${Boolean(row.liked_by_me)}" aria-pressed="${Boolean(row.liked_by_me)}"><span class="reel-action-icon">${row.liked_by_me ? '♥' : '♡'}</span><span class="reel-action-label reel-like-label">${escapeHTML(row.liked_by_me ? t('liked') : t('like'))}</span><b class="reel-action-count reel-like-count" data-count="${Number(row.like_count) || 0}">${formatNumber(row.like_count)}</b></button><button type="button" class="reel-action reel-comment-toggle" aria-expanded="false"><span class="reel-action-icon" aria-hidden="true">◌</span><span class="reel-action-label reel-comment-label">${escapeHTML(t('comments'))}</span><b class="reel-action-count reel-comment-count" data-count="${Number(row.comment_count) || 0}">${formatNumber(row.comment_count)}</b></button><button type="button" class="reel-action reel-save-button ${row.saved_by_me ? 'is-saved' : ''}" data-saved="${Boolean(row.saved_by_me)}" aria-pressed="${Boolean(row.saved_by_me)}" aria-label="${escapeHTML(t(row.saved_by_me ? 'itemSaved' : 'saveItem'))}"><span class="reel-action-icon reel-bookmark-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.75 3.75h10.5c.83 0 1.5.67 1.5 1.5v15l-6.75-4.5-6.75 4.5v-15c0-.83.67-1.5 1.5-1.5Z" /></svg></span><span class="reel-action-label">${escapeHTML(t(row.saved_by_me ? 'itemSaved' : 'saveItem'))}</span></button><button type="button" class="reel-action reel-share-button" aria-expanded="false" aria-label="${escapeHTML(t('share'))}"><span class="reel-action-icon" aria-hidden="true">↗</span><span class="reel-action-label">${escapeHTML(t('share'))}</span></button>`;

      const displayName = row.display_name || row.handle || t('member');
      const copyNode = document.createElement('div'); copyNode.className = 'reel-card-copy';
      copyNode.innerHTML = `<div class="reel-card-author"><span class="reel-card-avatar" aria-hidden="true">${escapeHTML(initials(displayName))}</span><a class="reel-card-author-link" href="./reel-profile.html?user=${encodeURIComponent(row.author_id)}">${escapeHTML(displayName)}</a></div><p class="reel-card-meta">${escapeHTML(formatDate(row.created_at))} · ${escapeHTML(t('duration', Number(row.duration_seconds || 0)))}</p>${row.caption ? `<p class="reel-card-caption">${escapeHTML(row.caption)}</p>` : ''}`;

      const commentsPanel = document.createElement('section'); commentsPanel.className = 'reel-comments-panel'; commentsPanel.hidden = true; commentsPanel.setAttribute('aria-label', t('comments'));
      const commentsList = document.createElement('ul'); commentsList.className = 'reel-comments-list';
      const more = document.createElement('button'); more.type = 'button'; more.className = 'reel-comments-more'; more.hidden = true; more.textContent = t('loadMore');
      const commentForm = document.createElement('form'); commentForm.className = 'reel-comment-form';
      const commentInput = document.createElement('input'); commentInput.type = 'text'; commentInput.maxLength = 180; commentInput.placeholder = t('addComment'); commentInput.setAttribute('aria-label', t('addComment'));
      const commentSubmit = document.createElement('button'); commentSubmit.type = 'submit'; commentSubmit.textContent = '↗'; commentSubmit.setAttribute('aria-label', t('postComment'));
      commentForm.append(commentInput, commentSubmit);
      commentsPanel.append(commentsList, more);
      player.append(video, controls, error, actions, copyNode, commentsPanel, commentForm);
      card.append(player);
      feed.append(card);
      feedVideos.add(video);
      bindInteractions(card, row, client);
      lazyObserver?.observe(video);
      playbackObserver?.observe(card);
      resourceObserver?.observe(card);
    });

    if (!hasIntersectionObserver) {
      feedVideos.forEach((video) => { if (canAutoplay()) void ensureVideoSource(video); });
      updateFallbackPlayback();
    }
    const sharedId = feed.dataset.sharedReelId;
    if (!append && sharedId) {
      requestAnimationFrame(() => {
        const card = [...feed.querySelectorAll('.reel-card')].find((item) => item.dataset.reelId === sharedId);
        if (!card) return;
        const top = card.getBoundingClientRect().top - feed.getBoundingClientRect().top + feed.scrollTop;
        feed.scrollTo({ top, behavior: 'auto' });
        card.setAttribute('tabindex', '-1');
        card.focus({ preventScroll: true });
      });
    }
  };

  const updateFallbackPlayback = () => {
    if (hasIntersectionObserver || !feed.clientHeight) return;
    cancelAnimationFrame(fallbackPlaybackFrame);
    fallbackPlaybackFrame = requestAnimationFrame(() => {
      const root = feed.getBoundingClientRect();
      const center = (root.top + root.bottom) / 2;
      let nearest = null; let shortestDistance = Infinity;
      feed.querySelectorAll('.reel-card').forEach((card) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.bottom) / 2 - center);
        if (distance < shortestDistance) { shortestDistance = distance; nearest = card; }
      });
      const video = nearest?.querySelector('.reel-card-video');
      if (video && shortestDistance < feed.clientHeight * 0.48) void playActiveVideo(video);
      releaseFarVideos();
    });
  };
  const handleFeedScroll = () => {
    updateFallbackPlayback();
    if (!feedClient || !feedHasMore || feedLoading) return;
    const threshold = Math.max(180, feed.clientHeight * 0.12);
    if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - threshold) void loadReels(feedClient, { reset: false });
  };
  feed.addEventListener('scroll', handleFeedScroll, { passive: true });

  const loadReels = async (client, { reset = true } = {}) => {
    if (feedLoading) { if (reset) feedReloadQueued = true; return; }
    if (!reset && !feedHasMore) return;
    feedLoading = true;
    if (reset) { feedCursor = null; feedHasMore = true; feedRows = []; }
    feed.setAttribute('aria-busy', 'true');
    try {
      let request = client.from('reels')
        .select('id,author_id,caption,media_path,duration_seconds,created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(FEED_PAGE_SIZE);
      if (!reset && feedCursor) {
        request = request.or(`created_at.lt.${feedCursor.created_at},and(created_at.eq.${feedCursor.created_at},id.lt.${feedCursor.id})`);
      }
      const { data, error } = await request;
      if (error) throw error;
      const pageRows = data || [];
      const nextCursor = pageRows.length ? pageRows[pageRows.length - 1] : feedCursor;
      let rows = pageRows;
      let rawSharedId = null;
      let sharedFound = true;
      if (reset) {
        const query = new URLSearchParams(window.location.search);
        rawSharedId = query.get('reel');
        const sharedReelId = isUuid(rawSharedId) ? rawSharedId : null;
        sharedFound = !rawSharedId;
        if (sharedReelId) {
          const present = rows.some((row) => row.id === sharedReelId);
          if (!present) {
            const shared = await client.from('reels')
              .select('id,author_id,caption,media_path,duration_seconds,created_at')
              .eq('id', sharedReelId).maybeSingle();
            if (shared.error) throw shared.error;
            if (shared.data) { rows = [shared.data, ...rows]; sharedFound = true; }
          } else sharedFound = true;
        }
        if (rawSharedId && !sharedReelId) sharedFound = false;
        sharedWarning.hidden = sharedFound;
        if (!sharedFound) sharedWarning.textContent = t('sharedUnavailable');
        feed.dataset.sharedReelId = sharedFound ? (sharedReelId || '') : '';
      }
      const reelIds = rows.map((row) => row.id).filter(Boolean);
      if (reelIds.length) {
        const savedPromise = authenticatedUserId && window.IQZodiacSavedItems
          ? window.IQZodiacSavedItems.getSavedIds(client, authenticatedUserId, 'reel', reelIds).catch((savedError) => { console.warn('Saved Reel states could not be loaded.', savedError); return new Set(); })
          : Promise.resolve(new Set());
        const [metricsResult, profilesResult, savedIds] = await Promise.all([
          client.rpc('get_reel_feed_metrics', { p_reel_ids: reelIds }),
          client.rpc('get_public_profile_cards', { p_user_ids: [...new Set(rows.map((row) => row.author_id).filter(Boolean))] }),
          savedPromise,
        ]);
        if (metricsResult.error) throw metricsResult.error;
        const metricMap = new Map((metricsResult.data || []).map((metric) => [metric.reel_id, metric]));
        const profileMap = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
        if (profilesResult.error) console.warn('Public Reel author labels could not be loaded.', profilesResult.error);
        rows = rows.map((row) => {
          const metric = metricMap.get(row.id);
          if (!metric) throw new Error('reel-metrics-unavailable');
          return { ...row, ...(profileMap.get(row.author_id) || {}), like_count: Number(metric.like_count), comment_count: Number(metric.comment_count), liked_by_me: Boolean(metric.liked_by_viewer), saved_by_me: savedIds.has(row.id) };
        });
      }
      renderReels(rows, client, !reset);
      feedCursor = nextCursor;
      feedHasMore = pageRows.length === FEED_PAGE_SIZE;
      if (reset && !sharedFound && rawSharedId) showToast(t('sharedUnavailable'));
    } catch (error) {
      if (reset) throw error;
      console.warn('More Reels could not be loaded.', error);
      feed.setAttribute('aria-busy', 'false');
      showToast(t('loadMoreFailed'));
    } finally {
      feedLoading = false;
      if (feedReloadQueued) { feedReloadQueued = false; void loadReels(client); }
    }
  };
  const openCreateDialog = () => {
    resumeOnDialogClose = Boolean(activeVideo && !activeVideo.paused);
    pauseActiveVideo();
    if (typeof createDialog.showModal === 'function') createDialog.showModal();
    else createDialog.setAttribute('open', '');
    byId('reel-caption').focus({ preventScroll: true });
  };
  const closeCreateDialog = () => {
    if (publishing) return;
    if (typeof createDialog.close === 'function' && createDialog.open) createDialog.close();
    else { createDialog.removeAttribute('open'); if (resumeOnDialogClose) void playActiveVideo(activeVideo); }
  };
  document.querySelectorAll('.reel-create-trigger').forEach((button) => button.addEventListener('click', openCreateDialog));
  byId('reel-create-close').addEventListener('click', closeCreateDialog);
  createDialog.addEventListener('close', () => {
    if (resumeOnDialogClose && activeVideo) void playActiveVideo(activeVideo);
    resumeOnDialogClose = false;
  });
  createDialog.addEventListener('cancel', (event) => { if (publishing) event.preventDefault(); });
  createDialog.addEventListener('click', (event) => { if (event.target === createDialog) closeCreateDialog(); });
  byId('reel-caption').addEventListener('input', updateCaptionCount);
  fileInput.addEventListener('change', () => { void setSelection(fileInput.files?.[0]); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (publishing) return;
    if (!selectedFile || !Number.isFinite(selectedDuration)) { setStatus('invalidType', 'error'); return; }
    if (selectedDuration > MAX_DURATION) { setStatus('tooLong', 'error'); return; }
    const client = await database();
    if (!client) { setStatus('failed', 'error'); return; }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (sessionError || !userId) { setStatus('signInToPublish', 'error'); return; }

    publishing = true;
    byId('publish-reel').disabled = true;
    byId('reel-create-close').disabled = true;
    document.querySelectorAll('.reel-create-trigger').forEach((button) => { button.disabled = true; });
    setStatus('publishing');
    let mediaPath = null;
    let reelInserted = false;
    try {
      const extension = fileExtension(selectedFile) || (inferredMime(selectedFile) === 'video/webm' ? 'webm' : 'mp4');
      const objectId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      mediaPath = `${userId}/reels/${objectId}.${extension}`;
      const { error: uploadError } = await client.storage.from('iqzodiac-media').upload(mediaPath, selectedFile, {
        contentType: inferredMime(selectedFile), cacheControl: '3600', upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await client.from('reels').insert({
        author_id: userId,
        caption: byId('reel-caption').value.trim().slice(0, 280),
        media_path: mediaPath,
        media_mime: inferredMime(selectedFile),
        media_size_bytes: selectedFile.size,
        duration_seconds: Number(selectedDuration.toFixed(3)),
      });
      if (insertError) throw insertError;
      reelInserted = true;
      byId('reel-caption').value = '';
      updateCaptionCount();
      clearSelection();
      showToast(t('saved'));
      createDialog.close?.();
      if (!createDialog.close) createDialog.removeAttribute('open');
      try { await loadReels(client); }
      catch (refreshError) { console.warn('Reel was published but the feed could not refresh.', refreshError); showToast(t('savedRefreshFailed')); }
    } catch (error) {
      console.warn('Reel could not be published.', error);
      if (mediaPath && !reelInserted) {
        try {
          const { error: removeError } = await client.storage.from('iqzodiac-media').remove([mediaPath]);
          if (removeError) console.warn('The failed Reel upload could not be cleaned up.', removeError);
        } catch (removeError) { console.warn('The failed Reel upload could not be cleaned up.', removeError); }
      }
      setStatus('failed', 'error');
    } finally {
      publishing = false;
      byId('publish-reel').disabled = false;
      byId('reel-create-close').disabled = false;
      document.querySelectorAll('.reel-create-trigger').forEach((button) => { button.disabled = false; });
    }
  });

  document.addEventListener('pointerdown', (event) => {
    const menu = feed.querySelector('.reel-share-menu');
    if (!menu || menu.contains(event.target) || event.target.closest('.reel-share-button')) return;
    const card = menu.closest('.reel-card');
    if (card) safeCloseShareMenu(card);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = feed.querySelector('.reel-share-menu');
    if (!menu) return;
    const card = menu.closest('.reel-card');
    if (card) { safeCloseShareMenu(card); card.querySelector('.reel-share-button')?.focus({ preventScroll: true }); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseActiveVideo();
    else if (activeVideo && canAutoplay()) void playActiveVideo(activeVideo);
  });
  window.addEventListener('pagehide', pauseActiveVideo);
  document.addEventListener('iqzodiac:languagechange', () => {
    applyStaticCopy();
  });
  applyStaticCopy();

  (async () => {
    try {
      const client = await database();
      if (!client) throw new Error('missing-supabase-client');
      feedClient = client;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      authenticatedUserId = data.session?.user?.id || null;
      if (authenticatedUserId) {
        try {
          const { data: profile } = await client.from('profiles').select('display_name,handle').eq('user_id', authenticatedUserId).maybeSingle();
          currentUserName = profile?.display_name || '';
          currentUserHandle = profile?.handle || '';
        } catch (profileError) { console.warn('Current member label could not be loaded.', profileError); }
      }
      await loadReels(client);
    } catch (error) {
      console.warn('Reels could not be loaded.', error);
      feed.replaceChildren();
      feed.dataset.state = 'unavailable';
      feed.setAttribute('aria-busy', 'false');
      const message = document.createElement('p'); message.className = 'reel-empty'; message.setAttribute('role', 'status'); message.textContent = t('unavailable'); feed.append(message);
    }
  })();
})();
