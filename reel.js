(() => {
  'use strict';

  const MAX_DURATION = 6 * 60;
  const MAX_BYTES = 50 * 1024 * 1024;
  const PAGE_SIZE = 12;
  const MEDIA_BUCKET = 'iqzodiac-media';
  const database = () => window.IQZodiacSupabase?.ready;
  const byId = (id) => document.getElementById(id);
  const feed = byId('reel-feed');
  const feedStatus = byId('reel-feed-status');
  const loadSentinel = byId('reel-load-sentinel');
  const form = byId('reel-form');
  const fileInput = byId('reel-file');
  const musicInput = byId('reel-music');
  const preview = byId('reel-preview');
  const previewVideo = byId('reel-preview-video');
  const previewOverlay = byId('reel-preview-overlay');
  const status = byId('reel-form-status');
  const progress = byId('reel-edit-progress');
  const createDialog = byId('reel-create-dialog');
  const commentsDialog = byId('reel-comments-dialog');
  const commentsList = byId('reel-comments-list');
  const commentForm = byId('reel-comment-form');
  const commentInput = byId('reel-comment-input');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');

  let toastTimer = 0;
  let selectedFile = null;
  let selectedDuration = null;
  let previewUrl = '';
  let selectedMusicFile = null;
  let musicPreviewUrl = '';
  let authenticatedUserId = null;
  let client = null;
  let activeVideo = null;
  let wideViewCard = null;
  let wideViewVideo = null;
  let wideViewExitRequested = false;
  let selectedCommentReel = null;
  let pageIndex = 0;
  let hasMore = true;
  let loadingMore = false;
  let feedObserver = null;
  let reelObserver = null;
  const reelById = new Map();
  const viewedReelIds = new Set();
  const routeParams = new URLSearchParams(window.location.search);
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  const targetReelId = isUuid(routeParams.get('reel')) ? routeParams.get('reel') : '';
  const targetReelCommentId = isUuid(routeParams.get('comment')) ? routeParams.get('comment') : '';

  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = {
    en: {
      loading: 'Loading Reels…', empty: 'No Reels have been published yet. Be the first to share one.', unavailable: 'Reels are temporarily unavailable. Please try again later.',
      create: 'Create a Reel', chooseVideo: 'Choose a video', videoSelected: 'Video selected', chooseAudio: 'Choose an audio track', audioSelected: 'Soundtrack selected',
      invalidVideo: 'Choose a supported video file.', invalidAudio: 'Choose an audio file for the soundtrack.', tooLarge: 'The video must be 50 MB or smaller.', audioTooLarge: 'The soundtrack must be 50 MB or smaller.', tooLong: 'Reels can be no longer than 6 minutes.', checking: 'Checking video duration…', ready: 'Ready to publish.',
      editing: 'Preparing edited video', editUnsupported: 'This browser cannot export video edits. Try a recent browser or remove the text and soundtrack edits.', editFailed: 'The edited video could not be prepared. Try again or publish without edits.', editedTooLarge: 'The edited video exceeds 50 MB. Use a shorter clip or a smaller soundtrack.',
      publishing: 'Publishing your Reel…', saved: 'Your Reel is now in your orbit.', failed: 'Your Reel could not be published. Try again.',
      like: 'Like', liked: 'Liked', save: 'Save', savedReel: 'Saved', comments: 'Comments', comment: 'comment', commentsPlural: 'comments', replies: 'Replies', share: 'Share', download: 'Download', downloaded: 'Download started.', downloadFailed: 'The Reel could not be downloaded.', mute: 'Mute', unmute: 'Turn sound on', wideView: 'Wide View', exitWideView: 'Exit Wide View', editComment: 'Edit comment', deleteComment: 'Delete comment', reply: 'Reply', replyPlaceholder: 'Write a reply…', postReply: 'Send reply', replySaved: 'Reply added.', replyFailed: 'Reply could not be added.', saveComment: 'Save', cancelEdit: 'Cancel', commentUpdated: 'Comment updated.', commentUpdateFailed: 'Comment could not be updated.', deleteReel: 'Delete Reel', confirmDeleteComment: 'Delete this comment?', confirmDeleteCommentWithReplies: 'Delete this comment? Replies will remain in the conversation.', confirmDeleteReel: 'Delete this Reel permanently?', deleteFailed: 'Could not delete this item.', deleted: 'Deleted successfully.',
      writeComment: 'Write a comment…', postComment: 'Post comment', commentSaved: 'Comment added.', commentFailed: 'Comment could not be saved.', likeFailed: 'Like could not be saved.', signIn: 'Sign in to interact with Reels.',
      noComments: 'No comments yet. Start the conversation.', commentsFailed: 'Comments could not be loaded.', commentBy: (name) => `Comment by ${name}`,
      copied: 'Link copied.', shareTitle: 'Share this Reel', shareText: 'Watch this Reel on IQZodiac',
      duration: (seconds) => `${Math.round(seconds)}s`, count: (number) => new Intl.NumberFormat(language() === 'ar' ? 'ar' : 'en').format(number),
      processing: (percent) => `Preparing edited video… ${percent}%`,
    },
    ar: {
      loading: 'جارٍ تحميل Reels…', empty: 'لا توجد Reels منشورة بعد. كن أول من يشارك واحدة.', unavailable: 'تعذّر تحميل Reels مؤقتًا. حاول مجددًا لاحقًا.',
      create: 'إنشاء Reel', chooseVideo: 'اختر فيديو', videoSelected: 'تم اختيار الفيديو', chooseAudio: 'اختر مقطعًا صوتيًا', audioSelected: 'تم اختيار الموسيقى',
      invalidVideo: 'اختر ملف فيديو مدعومًا.', invalidAudio: 'اختر ملفًا صوتيًا للموسيقى.', tooLarge: 'يجب ألا يتجاوز حجم الفيديو 50 ميغابايت.', audioTooLarge: 'يجب ألا يتجاوز حجم المقطع الصوتي 50 ميغابايت.', tooLong: 'يجب ألا تتجاوز مدة الـ Reel ست دقائق.', checking: 'جارٍ التحقق من مدة الفيديو…', ready: 'الفيديو جاهز للنشر.',
      editing: 'جارٍ تجهيز الفيديو المعدّل', editUnsupported: 'هذا المتصفح لا يدعم تصدير تعديلات الفيديو. استخدم متصفحًا حديثًا أو احذف النص والموسيقى.', editFailed: 'تعذّر تجهيز الفيديو المعدّل. حاول مجددًا أو انشر دون تعديلات.', editedTooLarge: 'تجاوز حجم الفيديو المعدّل 50 ميغابايت. اختر مقطعًا أقصر أو موسيقى أصغر.',
      publishing: 'جارٍ نشر الـ Reel…', saved: 'تم نشر الـ Reel.', failed: 'تعذّر نشر الـ Reel. حاول مجددًا.',
      like: 'إعجاب', liked: 'أعجبني', save: 'حفظ', savedReel: 'محفوظ', comments: 'التعليقات', comment: 'تعليق', commentsPlural: 'تعليقات', replies: 'الردود', share: 'مشاركة', download: 'تنزيل', downloaded: 'بدأ التنزيل.', downloadFailed: 'تعذّر تنزيل الـ Reel.', mute: 'كتم الصوت', unmute: 'تشغيل الصوت', wideView: 'عرض واسع', exitWideView: 'الخروج من العرض الواسع', editComment: 'تعديل التعليق', deleteComment: 'حذف التعليق', reply: 'رد', replyPlaceholder: 'اكتب ردًا…', postReply: 'إرسال الرد', replySaved: 'تمت إضافة الرد.', replyFailed: 'تعذّر إضافة الرد.', saveComment: 'حفظ', cancelEdit: 'إلغاء', commentUpdated: 'تم تعديل التعليق.', commentUpdateFailed: 'تعذّر تعديل التعليق.', deleteReel: 'حذف الـ Reel', confirmDeleteComment: 'هل تريد حذف هذا التعليق؟', confirmDeleteCommentWithReplies: 'هل تريد حذف التعليق؟ ستبقى الردود في المحادثة كتعليقات مستقلة.', confirmDeleteReel: 'هل تريد حذف هذا الـ Reel نهائيًا؟', deleteFailed: 'تعذّر حذف العنصر.', deleted: 'تم الحذف بنجاح.',
      writeComment: 'اكتب تعليقًا…', postComment: 'نشر التعليق', commentSaved: 'تمت إضافة التعليق.', commentFailed: 'تعذّر حفظ التعليق.', likeFailed: 'تعذّر حفظ الإعجاب.', signIn: 'سجّل الدخول للتفاعل مع Reels.',
      noComments: 'لا توجد تعليقات بعد. ابدأ الحوار.', commentsFailed: 'تعذّر تحميل التعليقات.', commentBy: (name) => `تعليق من ${name}`,
      copied: 'تم نسخ الرابط.', shareTitle: 'مشاركة هذا الـ Reel', shareText: 'شاهد هذا الـ Reel على IQZodiac',
      duration: (seconds) => `${Math.round(seconds)} ث`, count: (number) => new Intl.NumberFormat('ar').format(number),
      processing: (percent) => `جارٍ تجهيز الفيديو المعدّل… ${percent}٪`,
    },
  };
  const t = (key, ...args) => {
    const value = copy[language()][key];
    return typeof value === 'function' ? value(...args) : value;
  };
  const pinnedCommentText = (kind) => {
    const labels = language() === 'ar'
      ? { badge: 'تعليق مثبّت', pin: 'تثبيت التعليق', unpin: 'إلغاء تثبيت التعليق', failed: 'تعذّر تحديث التعليق المثبّت.', pinned: 'تم تثبيت التعليق.', unpinned: 'تم إلغاء تثبيت التعليق.' }
      : { badge: 'Pinned comment', pin: 'Pin comment', unpin: 'Unpin comment', failed: 'Pinned comment could not be updated.', pinned: 'Comment pinned.', unpinned: 'Comment unpinned.' };
    return labels[kind];
  };

  const setStatus = (message, state = '') => {
    status.textContent = message || '';
    status.dataset.state = state;
  };
  const showToast = (message) => {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = (value) => String(value || 'OM').replace(/^@/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
  const commentMediaLimits = { image: 15 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 20 * 1024 * 1024 };
  const commentMediaType = (file) => file?.type?.startsWith('image/') ? 'image' : file?.type?.startsWith('video/') ? 'video' : file?.type?.startsWith('audio/') ? 'audio' : '';
  const validateCommentFile = (file) => { const type = commentMediaType(file); if (!type || !file.size || file.size > commentMediaLimits[type]) throw new Error('comment-media-invalid'); return type; };
  const uploadReelCommentMedia = async (file) => { const type = validateCommentFile(file); const extension = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || type).toLowerCase(); const path = `${authenticatedUserId}/comment-replies/${crypto.randomUUID()}.${extension}`; const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false }); if (error) throw error; const { data, error: signedError } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600); if (signedError) throw signedError; return { media_type: type, media_path: path, media_mime: file.type, media_size_bytes: file.size, media_url: data?.signedUrl || '' }; };
  const attachReelCommentMedia = (body, comment) => { if (!comment?.media_path || !comment.media_url) return; const media = comment.media_type === 'image' ? document.createElement('img') : comment.media_type === 'video' ? document.createElement('video') : document.createElement('audio'); media.className = 'reel-comment-media'; media.src = comment.media_url; media.controls = true; if (comment.media_type === 'image') media.alt = t('comment'); body.append(media); };
  const setupReelCommentMediaControls = (form) => { const input = form.querySelector('[data-comment-media-input]'); const pick = form.querySelector('[data-comment-media-pick]'); const record = form.querySelector('[data-comment-media-record]'); const status = form.querySelector('[data-comment-media-status]'); if (!input) return; pick?.addEventListener('click', () => input.click()); input.addEventListener('change', () => { const file = input.files?.[0]; if (!file) return; try { validateCommentFile(file); form._mediaFile = file; if (status) status.textContent = file.name; } catch { input.value = ''; form._mediaFile = null; showToast(language() === 'ar' ? 'اختر ملف صورة أو فيديو أو صوت ضمن الحد المسموح.' : 'Choose an image, video or audio file within the limit.'); } }); record?.addEventListener('click', async () => { if (form._recorder) { form._recorder.stop(); return; } if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { showToast(language() === 'ar' ? 'تسجيل الصوت غير مدعوم.' : 'Audio recording is not supported.'); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const chunks = []; form._recorder = recorder; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); form._recorder = null; form._mediaFile = new File(chunks, `reel-comment-${Date.now()}.webm`, { type: recorder.mimeType || 'audio/webm' }); if (status) status.textContent = language() === 'ar' ? 'تم تجهيز التسجيل' : 'Audio ready'; if (record) record.textContent = '●'; }; recorder.start(); if (status) status.textContent = language() === 'ar' ? 'جارٍ التسجيل… اضغط للإيقاف' : 'Recording… click to stop'; if (record) record.textContent = '■'; } catch { showToast(language() === 'ar' ? 'تم رفض الوصول للميكروفون.' : 'Microphone access was denied.'); } }); };
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatDate = (value) => {
    try { return new Intl.DateTimeFormat(language() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(value)); }
    catch { return ''; }
  };
  const commentCountLabel = (number) => `${t('count', number)} ${language() === 'ar' ? (number === 1 ? t('comment') : t('commentsPlural')) : (number === 1 ? t('comment') : t('commentsPlural'))}`;
  const shareUrl = (row) => new URL(`./reel.html?reel=${encodeURIComponent(row.id)}`, document.baseURI).href;
  const copyShareLink = async (row) => {
    try { await navigator.clipboard.writeText(shareUrl(row)); showToast(t('copied')); }
    catch { window.prompt(t('shareTitle'), shareUrl(row)); }
  };

  const downloadReel = async (row) => {
    if (!client || !row?.media_path) return;
    try {
      const { data, error } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(row.media_path, 600);
      if (error || !data?.signedUrl) throw error || new Error('missing-download-url');
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('download-failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = objectUrl; link.download = `iqzodiac-reel-${row.id}.mp4`; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); showToast(t('downloaded'));
    } catch { showToast(t('downloadFailed')); }
  };

  const localizeEditor = () => {
    const ar = language() === 'ar';
    byId('reel-brand-label').textContent = ar ? 'Reels' : 'Reels';
    byId('open-reel-create').setAttribute('aria-label', t('create'));
    byId('open-reel-create').title = t('create');
    byId('reel-create-kicker').textContent = ar ? 'إنشاء' : 'CREATE';
    byId('reel-create-title').textContent = t('create');
    byId('reel-editor-note').textContent = ar
      ? 'اختر فيديو لا تتجاوز مدته 6 دقائق وحجمه 50 ميغابايت. أضف وصفًا ونصًا اختياريًا على الفيديو وموسيقى اختيارية.'
      : 'Choose a video up to 6 minutes and 50 MB. Add a caption, optional on-video text, and an optional soundtrack.';
    byId('reel-preview-empty').textContent = ar ? 'ستظهر معاينة الفيديو هنا.' : 'Your video preview will appear here.';
    byId('reel-file-field-label').textContent = ar ? 'الفيديو' : 'Video';
    byId('reel-file-meta').textContent = ar ? 'MP4 أو WebM أو MOV · 6:00 كحد أقصى · 50 MB' : 'MP4, WebM or MOV · max 6:00 · 50 MB';
    byId('reel-caption-label').textContent = ar ? 'الوصف' : 'Caption';
    byId('reel-caption').placeholder = ar ? 'اكتب وصفًا…' : 'Write a caption…';
    byId('reel-caption-helper').textContent = ar ? 'حتى 280 حرفًا' : 'Up to 280 characters';
    byId('reel-overlay-label').innerHTML = ar ? 'نص على الفيديو <span>(اختياري)</span>' : 'Text on video <span>(optional)</span>';
    byId('reel-overlay-text').placeholder = ar ? 'أضف نصًا قصيرًا يظهر على الفيديو' : 'Add a short text overlay';
    byId('reel-overlay-hint').textContent = ar ? 'سيُضاف هذا النص إلى الفيديو المُصدّر.' : 'This text will be added to the exported video.';
    byId('reel-music-label').innerHTML = ar ? 'الموسيقى <span>(اختياري)</span>' : 'Soundtrack <span>(optional)</span>';
    byId('reel-music-file-meta').textContent = ar ? 'MP3 أو M4A أو WAV أو OGG' : 'MP3, M4A, WAV or OGG';
    byId('cancel-reel-create').textContent = ar ? 'إلغاء' : 'Cancel';
    byId('publish-reel-label').textContent = ar ? 'نشر Reel' : 'Publish Reel';
    byId('reel-comments-kicker').textContent = ar ? 'الحوار' : 'THE CONVERSATION';
    byId('reel-comments-title').textContent = ar ? 'التعليقات' : 'Comments';
    byId('reel-comment-input').placeholder = t('writeComment');
    byId('reel-comment-input').setAttribute('aria-label', t('writeComment'));
    byId('reel-comment-submit').setAttribute('aria-label', t('postComment'));
    updateCaptionCount();
    document.querySelectorAll('.reel-like-button').forEach((button) => updateLikeButton(button.closest('.reel-card'), button.dataset.liked === 'true', numeric(button.querySelector('.reel-action-count')?.dataset.count)));
    document.querySelectorAll('.reel-comment-button').forEach((button) => {
      const row = reelById.get(button.dataset.reelId);
      if (row) button.querySelector('.reel-action-count').textContent = t('count', numeric(row.comment_count));
    });
    document.querySelectorAll('.reel-share-button').forEach((button) => button.querySelector('.reel-action-label').textContent = t('share'));
    document.querySelectorAll('.reel-download-button').forEach((button) => button.querySelector('.reel-action-label').textContent = t('download'));
    document.querySelectorAll('.reel-sound-button').forEach((button) => updateSoundButton(button.closest('.reel-card')));
    document.querySelectorAll('.reel-wide-button').forEach((button) => updateWideViewButton(button.closest('.reel-card')));
    document.querySelectorAll('.reel-save-button').forEach((button) => updateSaveButton(button.closest('.reel-card'), button.dataset.saved === 'true'));
    document.querySelectorAll('.reel-feed-status').forEach((node) => {
      if (node.dataset.kind === 'loading') node.textContent = t('loading');
      if (node.dataset.kind === 'empty') node.textContent = t('empty');
      if (node.dataset.kind === 'error') node.textContent = t('unavailable');
    });
  };

  const updateCaptionCount = () => {
    const caption = byId('reel-caption');
    if (caption) byId('reel-caption-count').textContent = `${caption.value.length} / 280`;
  };
  const setFeedMessage = (kind, message, isError = false) => {
    feedStatus.dataset.kind = kind;
    feedStatus.textContent = message;
    feedStatus.classList.toggle('is-error', isError);
  };

  const readDuration = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const cleanup = () => { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); };
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      cleanup();
      Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error('invalid-duration'));
    };
    video.onerror = () => { cleanup(); reject(new Error('invalid-video')); };
    video.src = url;
  });

  const updatePreviewOverlay = () => {
    const overlayText = byId('reel-overlay-text').value.trim();
    previewOverlay.textContent = overlayText;
    previewOverlay.hidden = !overlayText;
  };

  const clearVideoSelection = () => {
    selectedFile = null;
    selectedDuration = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    previewVideo.pause();
    previewVideo.removeAttribute('src');
    previewVideo.load();
    preview.classList.remove('has-video');
    preview.hidden = true;
    fileInput.value = '';
    byId('reel-file-label').textContent = t('chooseVideo');
    setStatus('');
  };

  const clearMusicSelection = () => {
    selectedMusicFile = null;
    if (musicPreviewUrl) URL.revokeObjectURL(musicPreviewUrl);
    musicPreviewUrl = '';
    musicInput.value = '';
    byId('reel-music-file-label').textContent = t('chooseAudio');
    byId('reel-music-preview').pause();
    byId('reel-music-preview').removeAttribute('src');
    byId('reel-music-preview').hidden = true;
  };

  const clearSelection = () => {
    clearVideoSelection();
    clearMusicSelection();
    byId('reel-overlay-text').value = '';
    previewOverlay.textContent = '';
    previewOverlay.hidden = true;
    updateCaptionCount();
    progress.hidden = true;
    progress.value = 0;
    setStatus('');
  };

  const setSelection = async (file) => {
    clearVideoSelection();
    if (!file) return;
    if (!file.type.startsWith('video/')) { setStatus(t('invalidVideo'), 'error'); return; }
    if (file.size > MAX_BYTES) { setStatus(t('tooLarge'), 'error'); return; }
    setStatus(t('checking'));
    try {
      const duration = await readDuration(file);
      if (duration > MAX_DURATION + 0.01) { setStatus(t('tooLong'), 'error'); return; }
      selectedFile = file;
      selectedDuration = duration;
      previewUrl = URL.createObjectURL(file);
      previewVideo.src = previewUrl;
      previewVideo.muted = true;
      previewVideo.playsInline = true;
      preview.classList.add('has-video');
      preview.hidden = false;
      byId('reel-file-label').textContent = t('videoSelected');
      setStatus(`${t('ready')} ${t('duration', duration)}`);
      updatePreviewOverlay();
    } catch {
      setStatus(t('invalidVideo'), 'error');
    }
  };

  const setMusicSelection = (file) => {
    selectedMusicFile = null;
    if (musicPreviewUrl) URL.revokeObjectURL(musicPreviewUrl);
    musicPreviewUrl = '';
    byId('reel-music-file-label').textContent = t('chooseAudio');
    const audioPreview = byId('reel-music-preview');
    audioPreview.pause();
    audioPreview.removeAttribute('src');
    audioPreview.hidden = true;
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setStatus(t('invalidAudio'), 'error'); return; }
    if (file.size > MAX_BYTES) { setStatus(t('audioTooLarge'), 'error'); return; }
    selectedMusicFile = file;
    musicPreviewUrl = URL.createObjectURL(file);
    audioPreview.src = musicPreviewUrl;
    audioPreview.hidden = false;
    byId('reel-music-file-label').textContent = t('audioSelected');
    if (selectedFile) setStatus(t('ready'));
  };

  const wrapCanvasText = (context, text, maxWidth) => {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  };

  const renderEditedVideo = async (sourceFile, overlayText, soundtrackFile, onProgress) => {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('edit-unsupported');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('edit-unsupported');

    const objectUrl = URL.createObjectURL(sourceFile);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = false;
    let audioContext = null;
    let audioSource = null;
    let musicSource = null;
    let audioDestination = null;
    let canvasStream = null;
    let outputStream = null;
    let animationFrame = 0;
    let maxTimer = 0;

    try {
      const metadataReady = new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('edit-failed'));
      });
      video.src = objectUrl;
      await metadataReady;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) throw new Error('edit-failed');
      const scale = Math.min(1, 1280 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(width * scale / 2) * 2);
      canvas.height = Math.max(2, Math.round(height * scale / 2) * 2);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('edit-unsupported');
      canvasStream = canvas.captureStream(30);
      outputStream = new MediaStream(canvasStream.getVideoTracks());

      audioContext = new AudioContextClass();
      audioDestination = audioContext.createMediaStreamDestination();
      audioSource = audioContext.createMediaElementSource(video);
      audioSource.connect(audioDestination);
      if (soundtrackFile) {
        const buffer = await audioContext.decodeAudioData(await soundtrackFile.arrayBuffer());
        musicSource = audioContext.createBufferSource();
        musicSource.buffer = buffer;
        musicSource.loop = buffer.duration < Number(video.duration);
        const gain = audioContext.createGain();
        gain.gain.value = 0.32;
        musicSource.connect(gain);
        gain.connect(audioDestination);
      }
      const audioTrack = audioDestination.stream.getAudioTracks()[0];
      if (audioTrack) outputStream.addTrack(audioTrack);

      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('edit-unsupported');
      const audioBitsPerSecond = 128000;
      const videoBitsPerSecond = Math.max(350000, Math.min(5000000, Math.floor((45 * 1024 * 1024 * 8 / video.duration) - audioBitsPerSecond)));
      const recorder = new MediaRecorder(outputStream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });
      const chunks = [];
      const fontSize = Math.max(22, Math.round(canvas.width * 0.045));
      const label = String(overlayText || '').trim();
      const draw = () => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (label) {
            context.save();
            context.direction = language() === 'ar' ? 'rtl' : 'ltr';
            context.font = `800 ${fontSize}px Manrope, sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const lines = wrapCanvasText(context, label, canvas.width * 0.82);
            const lineHeight = Math.round(fontSize * 1.3);
            const padX = Math.round(fontSize * 0.45);
            const padY = Math.round(fontSize * 0.3);
            const blockHeight = lines.length * lineHeight + padY * 2;
            const blockWidth = Math.min(canvas.width * 0.92, Math.max(...lines.map((line) => context.measureText(line).width)) + padX * 2);
            const x = canvas.width / 2;
            const y = canvas.height * 0.79;
            context.fillStyle = 'rgba(0,0,0,.38)';
            context.fillRect(x - blockWidth / 2, y - blockHeight / 2, blockWidth, blockHeight);
            context.fillStyle = '#ffffff';
            context.shadowColor = 'rgba(0,0,0,.8)';
            context.shadowBlur = 6;
            lines.forEach((line, index) => context.fillText(line, x, y - ((lines.length - 1) * lineHeight) / 2 + index * lineHeight, canvas.width * 0.84));
            context.restore();
          }
        }
        if (!video.ended && !video.paused) animationFrame = requestAnimationFrame(draw);
        if (video.duration > 0) onProgress?.(Math.min(99, Math.floor((video.currentTime / video.duration) * 100)));
      };

      const rendered = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('edit-failed'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
        maxTimer = window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, Math.ceil(Number(video.duration) * 1000) + 15000);
        video.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
      });

      await audioContext.resume();
      video.currentTime = 0;
      await video.play();
      if (musicSource) musicSource.start(0);
      recorder.start(1000);
      draw();
      const blob = await rendered;
      if (!blob.size) throw new Error('edit-failed');
      if (blob.size > MAX_BYTES) throw new Error('edit-too-large');
      onProgress?.(100);
      const exportedType = blob.type.startsWith('video/') ? blob.type : mimeType;
      const extension = exportedType.includes('mp4') ? 'mp4' : 'webm';
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '') || 'reel';
      return new File([blob], `${baseName}-edited.${extension}`, { type: exportedType, lastModified: Date.now() });
    } catch (error) {
      if (error?.name === 'NotSupportedError') throw new Error('edit-unsupported');
      throw error;
    } finally {
      window.clearTimeout(maxTimer);
      cancelAnimationFrame(animationFrame);
      try { video.pause(); } catch { /* no-op */ }
      [audioSource, musicSource].forEach((source) => { try { source?.disconnect(); } catch { /* no-op */ } });
      [canvasStream, outputStream, audioDestination?.stream].filter(Boolean).forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => {});
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    }
  };

  const getPublicProfiles = async (userIds) => {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
    if (!uniqueIds.length) return new Map();
    try {
      const { data, error } = await client.rpc('get_public_profile_cards', { p_user_ids: uniqueIds });
      if (!error && Array.isArray(data)) {
        const profiles = await Promise.all(data.map(async (profile) => {
          let avatarUrl = '';
          if (profile.avatar_storage_path) {
            try {
              const { data: signed } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(profile.avatar_storage_path, 3600);
              avatarUrl = signed?.signedUrl || '';
            } catch { /* The initials avatar remains available. */ }
          }
          return [profile.user_id, { ...profile, avatar_url: avatarUrl }];
        }));
        return new Map(profiles);
      }
    } catch { /* Older deployments may not have the public profile card RPC. */ }
    try {
      const { data } = await client.from('profiles').select('user_id,display_name,handle').in('user_id', uniqueIds).limit(200);
      return new Map((data || []).map((profile) => [profile.user_id, profile]));
    } catch { return new Map(); }
  };

  const getMetrics = async (rows) => {
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return new Map();
    let metrics = new Map();
    try {
      const { data, error } = await client.rpc('get_reel_feed_metrics', { p_reel_ids: ids });
      if (!error && Array.isArray(data)) metrics = new Map(data.map((metric) => [metric.reel_id, metric]));
    } catch { /* Use table reads as a compatible fallback. */ }
    if (!metrics.size) {
      try {
        const [{ data: likes }, { data: comments }] = await Promise.all([
          client.from('reel_likes').select('reel_id,user_id').in('reel_id', ids).limit(1000),
          client.from('reel_comments').select('reel_id').in('reel_id', ids).limit(1000),
        ]);
        rows.forEach((row) => {
          const reelLikes = (likes || []).filter((like) => like.reel_id === row.id);
          metrics.set(row.id, {
            like_count: reelLikes.length,
            comment_count: (comments || []).filter((comment) => comment.reel_id === row.id).length,
            liked_by_viewer: reelLikes.some((like) => like.user_id === authenticatedUserId),
          });
        });
      } catch { /* Keep an empty metrics map when the optional metrics query is unavailable. */ }
    }
    try {
      const { data: saves } = await client.from('reel_saves').select('reel_id').eq('user_id', authenticatedUserId).in('reel_id', ids).limit(1000);
      const savedIds = new Set((saves || []).map((save) => save.reel_id));
      rows.forEach((row) => { const metric = metrics.get(row.id) || {}; metric.saved_by_viewer = savedIds.has(row.id); metrics.set(row.id, metric); });
    } catch { /* Saved state is optional until the migration is available everywhere. */ }
    return metrics;
  };

  const signReelMedia = async (rows) => Promise.all(rows.map(async (row) => {
    try {
      const { data, error } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(row.media_path, 3600);
      if (error) throw error;
      return data?.signedUrl || '';
    } catch { return ''; }
  }));

  const makeAvatar = (profile, name, className = 'reel-card-avatar') => {
    const avatar = document.createElement('span');
    avatar.className = className;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initials(name);
    if (profile?.avatar_url) {
      const image = document.createElement('img');
      image.src = profile.avatar_url;
      image.alt = '';
      image.loading = 'lazy';
      image.onerror = () => image.remove();
      avatar.append(image);
    }
    return avatar;
  };

  const updateLikeButton = (card, liked, count) => {
    if (!card) return;
    const button = card.querySelector('.reel-like-button');
    const row = reelById.get(button?.dataset.reelId);
    const likeCount = Math.max(0, numeric(count));
    if (row) { row.like_count = likeCount; row.liked_by_me = liked; }
    if (!button) return;
    button.classList.toggle('is-liked', liked);
    button.dataset.liked = String(liked);
    const icon = button.querySelector('.reel-action-icon');
    icon.textContent = liked ? '♥' : '♡';
    icon.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-label', `${t(liked ? 'liked' : 'like')}, ${t('count', likeCount)}`);
    button.querySelector('.reel-action-label').textContent = t(liked ? 'liked' : 'like');
    const countNode = button.querySelector('.reel-action-count');
    countNode.dataset.count = String(likeCount);
    countNode.textContent = t('count', likeCount);
  };

  const updateSaveButton = (card, saved) => {
    if (!card) return;
    const button = card.querySelector('.reel-save-button');
    const row = reelById.get(button?.dataset.reelId);
    if (row) row.saved_by_viewer = saved;
    if (!button) return;
    button.classList.toggle('is-saved', saved);
    button.dataset.saved = String(saved);
    button.querySelector('.reel-action-icon').textContent = saved ? '🔖' : '▱';
    button.querySelector('.reel-action-label').textContent = t(saved ? 'savedReel' : 'save');
    button.setAttribute('aria-label', t(saved ? 'savedReel' : 'save'));
  };
  const updateCommentButton = (card, count) => {
    const button = card?.querySelector('.reel-comment-button');
    const row = reelById.get(button?.dataset.reelId);
    const commentCount = Math.max(0, numeric(count));
    if (row) row.comment_count = commentCount;
    if (!button) return;
    button.setAttribute('aria-label', `${t('comments')}, ${t('count', commentCount)}`);
    button.querySelector('.reel-action-count').textContent = t('count', commentCount);
  };

  const updateSoundButton = (card) => {
    if (!card) return;
    const video = card.querySelector('.reel-card-video');
    const button = card.querySelector('.reel-sound-button');
    if (!video || !button) return;
    const muted = video.muted;
    button.dataset.muted = String(muted);
    button.setAttribute('aria-label', t(muted ? 'unmute' : 'mute'));
    button.title = t(muted ? 'unmute' : 'mute');
    button.querySelector('.reel-action-icon').textContent = muted ? '♫' : '🔊';
    button.querySelector('.reel-action-label').textContent = muted ? t('unmute') : t('mute');
  };

  const updateWideViewButton = (card) => {
    const button = card?.querySelector('.reel-wide-button');
    if (!button) return;
    const active = card === wideViewCard;
    button.dataset.active = String(active);
    button.setAttribute('aria-label', t(active ? 'exitWideView' : 'wideView'));
    button.title = t(active ? 'exitWideView' : 'wideView');
    button.querySelector('.reel-action-label').textContent = t(active ? 'exitWideView' : 'wideView');
  };

  const clearWideView = () => {
    const card = wideViewCard;
    const video = wideViewVideo;
    if (video) video.dataset.wideViewUserPaused = 'false';
    wideViewCard = null;
    wideViewVideo = null;
    document.body.classList.remove('reel-wide-view');
    card?.classList.remove('is-wide-view');
    updateWideViewButton(card);
  };

  const exitWideView = async () => {
    if (!wideViewCard) return;
    wideViewExitRequested = true;
    const fullscreenActive = document.fullscreenElement || document.webkitFullscreenElement;
    clearWideView();
    const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
    if (fullscreenActive && exitFullscreen) {
      try { await exitFullscreen.call(document); } catch { /* CSS fallback already restored the feed. */ }
    }
    wideViewExitRequested = false;
  };

  const resumeWideViewVideo = () => {
    const video = wideViewVideo;
    if (!video || !wideViewCard || video.dataset.wideViewResume !== 'true' || video.dataset.wideViewUserPaused === 'true') return;
    const resume = () => {
      if (wideViewCard && video.isConnected && video.paused && !video.ended) video.play().catch(() => {});
    };
    requestAnimationFrame(() => { resume(); requestAnimationFrame(resume); });
    window.setTimeout(resume, 120);
  };

  const enterWideView = async (card) => {
    if (wideViewCard && wideViewCard !== card) await exitWideView();
    if (wideViewCard === card) { await exitWideView(); return; }
    wideViewCard = card;
    wideViewVideo = card.querySelector('.reel-card-video');
    card.classList.add('is-wide-view');
    document.body.classList.add('reel-wide-view');
    updateWideViewButton(card);
    const playbackPosition = wideViewVideo?.currentTime || 0;
    if (wideViewVideo) {
      wideViewVideo.dataset.wideViewResume = 'true';
      wideViewVideo.dataset.wideViewUserPaused = 'false';
    }
    if (wideViewVideo?.paused) wideViewVideo.play().catch(() => {});
    const requestFullscreen = card.requestFullscreen || card.webkitRequestFullscreen;
    if (requestFullscreen) {
      try { await requestFullscreen.call(card, { navigationUI: 'hide' }); } catch { /* CSS wide view remains available when denied. */ }
    }
    if (wideViewVideo && Math.abs(wideViewVideo.currentTime - playbackPosition) > 0.05) wideViewVideo.currentTime = playbackPosition;
    resumeWideViewVideo();
  };

  const handleFullscreenChange = () => {
    if (!(document.fullscreenElement || document.webkitFullscreenElement) && wideViewCard && !wideViewExitRequested) clearWideView();
    else if (wideViewCard) resumeWideViewVideo();
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wideViewCard && !(document.fullscreenElement || document.webkitFullscreenElement)) void exitWideView();
  });

  const makeShareMenu = (card, row) => {
    const existing = card.querySelector('.reel-share-menu');
    if (existing) { existing.remove(); return; }
    const url = shareUrl(row);
    const text = t('shareText');
    const menu = document.createElement('div');
    menu.className = 'reel-share-menu';
    menu.setAttribute('role', 'menu');
    const options = [
      { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
      { label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
      { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
      { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    ];
    options.forEach(({ label, href }) => {
      const link = document.createElement('a');
      link.className = 'reel-share-option';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label;
      link.setAttribute('role', 'menuitem');
      menu.append(link);
    });
    const copyButton = document.createElement('button');
    copyButton.className = 'reel-share-option';
    copyButton.type = 'button';
    copyButton.textContent = language() === 'ar' ? 'نسخ الرابط' : 'Copy link';
    copyButton.addEventListener('click', () => { void copyShareLink(row); menu.remove(); });
    menu.append(copyButton);
    card.append(menu);
  };

  const createCommentItem = (comment, profile, replies = [], profileMap = new Map()) => {
    const item = document.createElement('li');
    item.className = `reel-comment${comment.parent_comment_id ? ' is-reply' : ''}`;
    item.dataset.commentId = comment.id;
    item.id = `reel-comment-${comment.id}`;
    const displayName = profile?.display_name || profile?.handle || (comment.author_id === authenticatedUserId ? (language() === 'ar' ? 'أنت' : 'You') : 'Orbit Member');
    const avatar = makeAvatar(profile, displayName, 'reel-comment-avatar');
    const body = document.createElement('div'); body.className = 'reel-comment-body';
    const author = document.createElement('strong'); author.textContent = displayName;
    const text = document.createElement('p'); text.textContent = comment.body;
    const date = document.createElement('small'); date.textContent = formatDate(comment.created_at); attachReelCommentMedia(body, comment);
    if (comment.is_pinned) { const badge = document.createElement('span'); badge.className = 'reel-comment-pinned'; badge.textContent = pinnedCommentText('badge'); body.append(badge); }
    const controls = document.createElement('div'); controls.className = 'reel-comment-controls';
    const repliesList = document.createElement('ul'); repliesList.className = 'reel-comment-replies'; repliesList.setAttribute('aria-label', t('replies'));
    replies.forEach((reply) => repliesList.append(createCommentItem(reply, profileMap.get(reply.author_id), [], profileMap)));

    const replyButton = document.createElement('button');
    if (!comment.parent_comment_id) {
      replyButton.type = 'button'; replyButton.className = 'reel-comment-action'; replyButton.textContent = t('reply');
      replyButton.addEventListener('click', () => {
        const existing = body.querySelector('.reel-comment-reply-form');
        if (existing) { existing.remove(); return; }
        const editor = document.createElement('form'); editor.className = 'reel-comment-reply-form';
        const input = document.createElement('input'); input.type = 'text'; input.maxLength = 180; input.placeholder = t('replyPlaceholder'); input.setAttribute('aria-label', t('replyPlaceholder'));
        editor.innerHTML = '<input type="file" data-comment-media-input accept="image/*,video/*,audio/*" hidden /><button type="button" data-comment-media-pick>＋</button><button type="button" data-comment-media-record>●</button><span data-comment-media-status></span>';
        setupReelCommentMediaControls(editor);
        const actions = document.createElement('div'); actions.className = 'reel-comment-editor-actions';
        const send = document.createElement('button'); send.type = 'submit'; send.textContent = t('postReply');
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'is-secondary'; cancel.textContent = t('cancelEdit');
        cancel.addEventListener('click', () => editor.remove());
        editor.addEventListener('submit', async (event) => {
          event.preventDefault();
          const replyBody = input.value.trim().slice(0, 180); const mediaFile = editor._mediaFile;
          if ((!replyBody && !mediaFile) || !authenticatedUserId) { if (!authenticatedUserId) showToast(t('signIn')); input.focus(); return; }
          send.disabled = true; cancel.disabled = true;
          let media = {}; let mediaPath = '';
          try {
            if (mediaFile) { media = await uploadReelCommentMedia(mediaFile); mediaPath = media.media_path; }
            const { media_url: mediaUrl, ...mediaFields } = media;
            const { data, error } = await client.from('reel_comments').insert({ reel_id: comment.reel_id, author_id: authenticatedUserId, parent_comment_id: comment.id, body: replyBody, ...mediaFields }).select('id,reel_id,author_id,body,created_at,parent_comment_id,media_type,media_path,media_mime,media_size_bytes').single();
            if (error) throw error; const replyData = { ...data, media_url: mediaUrl || '' };
            const profileMap = await getPublicProfiles([authenticatedUserId]);
            if (!repliesList.isConnected) body.append(repliesList);
            repliesList.append(createCommentItem(replyData, profileMap.get(authenticatedUserId), [], profileMap));
            editor.remove();
            const reel = reelById.get(comment.reel_id);
            if (reel) { reel.comment_count = numeric(reel.comment_count) + 1; updateCommentButton(document.querySelector(`.reel-card[data-reel-id="${CSS.escape(comment.reel_id)}"]`), reel.comment_count); }
            showToast(t('replySaved'));
          } catch (error) { if (mediaPath) await client.storage.from(MEDIA_BUCKET).remove([mediaPath]); console.warn('Reel reply could not be saved.', error); send.disabled = false; cancel.disabled = false; showToast(t('replyFailed')); }
        });
        actions.append(send, cancel); editor.append(input, actions); body.insertBefore(editor, controls); input.focus();
      });
      controls.append(replyButton);
    }

    const reelForPin = reelById.get(comment.reel_id);
    if (!comment.parent_comment_id && reelForPin?.author_id === authenticatedUserId) {
      const pinButton = document.createElement('button'); pinButton.type = 'button'; pinButton.className = 'reel-comment-action'; pinButton.textContent = pinnedCommentText(comment.is_pinned ? 'unpin' : 'pin');
      pinButton.addEventListener('click', async () => {
        pinButton.disabled = true;
        try {
          const { data, error } = await client.rpc('set_reel_pinned_comment', { p_reel_id: comment.reel_id, p_comment_id: comment.is_pinned ? null : comment.id });
          if (error || data !== true) throw error || new Error('comment_pin_failed');
          await loadComments(reelForPin);
          showToast(pinnedCommentText(comment.is_pinned ? 'unpinned' : 'pinned'));
        } catch (error) {
          console.warn('Reel comment pin could not be updated.', error); pinButton.disabled = false; showToast(pinnedCommentText('failed'));
        }
      });
      controls.append(pinButton);
    }

    if (comment.author_id === authenticatedUserId) {
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'reel-comment-action'; edit.textContent = t('editComment');
      edit.addEventListener('click', () => {
        if (body.querySelector('.reel-comment-editor')) return;
        text.hidden = true;
        const editor = document.createElement('form'); editor.className = 'reel-comment-editor';
        const input = document.createElement('textarea'); input.maxLength = 180; input.rows = 2; input.value = comment.body; input.setAttribute('aria-label', t('editComment'));
        const actions = document.createElement('div'); actions.className = 'reel-comment-editor-actions';
        const save = document.createElement('button'); save.type = 'submit'; save.textContent = t('saveComment');
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'is-secondary'; cancel.textContent = t('cancelEdit');
        cancel.addEventListener('click', () => { editor.remove(); text.hidden = false; });
        editor.addEventListener('submit', async (event) => {
          event.preventDefault(); const nextBody = input.value.trim().slice(0, 180); if (!nextBody && !comment.media_path) { input.focus(); return; }
          save.disabled = true; cancel.disabled = true;
          try {
            const { data, error } = await client.from('reel_comments').update({ body: nextBody }).eq('id', comment.id).eq('author_id', authenticatedUserId).select('id').maybeSingle();
            if (error || !data) throw error || new Error('comment_not_updated');
            comment.body = nextBody; text.textContent = nextBody; text.hidden = false; editor.remove(); showToast(t('commentUpdated'));
          } catch (error) { console.warn('Reel comment could not be updated.', error); save.disabled = false; cancel.disabled = false; showToast(t('commentUpdateFailed')); }
        });
        actions.append(save, cancel); editor.append(input, actions); body.insertBefore(editor, controls); input.focus();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'reel-comment-action is-danger'; remove.textContent = t('deleteComment');
      remove.addEventListener('click', async () => {
        const confirmText = comment.parent_comment_id ? t('confirmDeleteComment') : t('confirmDeleteCommentWithReplies');
        if (!window.confirm(confirmText)) return;
        remove.disabled = true;
        try {
          const { data, error } = await client.from('reel_comments').delete().eq('id', comment.id).eq('author_id', authenticatedUserId).select('id').maybeSingle();
          if (error || !data) throw error || new Error('comment_not_deleted');
          const reel = reelById.get(comment.reel_id);
          if (reel) { reel.comment_count = Math.max(0, numeric(reel.comment_count) - 1); updateCommentButton(document.querySelector(`.reel-card[data-reel-id="${CSS.escape(comment.reel_id)}"]`), reel.comment_count); }
          showToast(t('deleted'));
          if (selectedCommentReel?.id === comment.reel_id) await loadComments(selectedCommentReel);
          else item.remove();
        } catch (error) { console.warn('Reel comment could not be deleted.', error); remove.disabled = false; showToast(t('deleteFailed')); }
      });
      controls.append(edit, remove);
    }
    body.append(author, text, date, controls);
    if (replies.length) body.append(repliesList);
    item.append(avatar, body);
    item.setAttribute('aria-label', t('commentBy', displayName));
    return item;
  };

  const loadComments = async (row, focusCommentId = '') => {
    commentsList.replaceChildren();
    const loading = document.createElement('li');
    loading.className = 'reel-comments-empty';
    loading.textContent = t('loading');
    commentsList.append(loading);
    const commentColumns = 'id,reel_id,author_id,body,created_at,parent_comment_id,media_type,media_path,media_mime,media_size_bytes,is_pinned';
    const { data, error } = await client.from('reel_comments').select(commentColumns).eq('reel_id', row.id).order('created_at', { ascending: false }).limit(50);
    if (error) {
      commentsList.replaceChildren();
      const message = document.createElement('li');
      message.className = 'reel-comments-empty';
      message.textContent = t('commentsFailed');
      commentsList.append(message);
      return;
    }
    const comments = data || [];
    if (focusCommentId && !comments.some((comment) => comment.id === focusCommentId)) {
      const { data: targetComment } = await client.from('reel_comments').select(commentColumns).eq('id', focusCommentId).eq('reel_id', row.id).maybeSingle();
      if (targetComment) comments.push(targetComment);
    }
    const { data: pinnedComment } = await client.from('reel_comments').select(commentColumns).eq('reel_id', row.id).eq('is_pinned', true).maybeSingle();
    if (pinnedComment && !comments.some((comment) => comment.id === pinnedComment.id)) comments.push(pinnedComment);
    const replyParentIds = [...new Set(comments.filter((comment) => !comment.parent_comment_id).map((comment) => comment.id))];
    const loadedCommentIds = new Set(comments.map((comment) => comment.id));
    for (let offset = 0; replyParentIds.length; offset += 1000) {
      const { data: replies, error: repliesError } = await client.from('reel_comments').select(commentColumns).eq('reel_id', row.id).in('parent_comment_id', replyParentIds).order('created_at', { ascending: true }).range(offset, offset + 999);
      if (repliesError) { console.warn('Reel replies could not be loaded.', repliesError); break; }
      (replies || []).forEach((reply) => { if (!loadedCommentIds.has(reply.id)) { comments.push(reply); loadedCommentIds.add(reply.id); } });
      if (!replies || replies.length < 1000) break;
    }
    const commentIds = new Set(comments.map((comment) => comment.id));
    const missingParentIds = [...new Set(comments.map((comment) => comment.parent_comment_id).filter((id) => id && !commentIds.has(id)))];
    if (missingParentIds.length) {
      const { data: parents } = await client.from('reel_comments').select(commentColumns).in('id', missingParentIds).eq('reel_id', row.id).limit(50);
      (parents || []).forEach((parent) => { if (!commentIds.has(parent.id)) { comments.push(parent); commentIds.add(parent.id); } });
    }
    if (!comments.length) {
      const empty = document.createElement('li');
      empty.className = 'reel-comments-empty';
      empty.textContent = t('noComments');
      commentsList.replaceChildren(empty);
      return;
    }
    for (const comment of comments) { if (comment.media_path) { const { data: signed } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(comment.media_path, 3600); comment.media_url = signed?.signedUrl || ''; } }
    const profileMap = await getPublicProfiles(comments.map((comment) => comment.author_id));
    const repliesByParent = new Map();
    const topLevelComments = [];
    comments.forEach((comment) => {
      if (comment.parent_comment_id && commentIds.has(comment.parent_comment_id)) {
        if (!repliesByParent.has(comment.parent_comment_id)) repliesByParent.set(comment.parent_comment_id, []);
        repliesByParent.get(comment.parent_comment_id).push(comment);
      } else topLevelComments.push(comment);
    });
    topLevelComments.sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || new Date(b.created_at) - new Date(a.created_at));
    commentsList.replaceChildren(...topLevelComments.map((comment) => createCommentItem(comment, profileMap.get(comment.author_id), repliesByParent.get(comment.id) || [], profileMap)));
    if (focusCommentId) {
      const target = commentsList.querySelector(`[data-comment-id="${CSS.escape(focusCommentId)}"]`);
      if (target) { target.classList.add('notification-target-highlight'); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  };

  const openComments = async (row, focusCommentId = '') => {
    selectedCommentReel = row;
    byId('reel-comments-title').textContent = language() === 'ar' ? 'التعليقات' : 'Comments';
    if (!commentsDialog.open) commentsDialog.showModal();
    await loadComments(row, focusCommentId);
  };

  const deleteReel = async (card, row, button) => {
    if (!authenticatedUserId || row.author_id !== authenticatedUserId) return;
    if (!window.confirm(t('confirmDeleteReel'))) return;
    button.disabled = true;
    try {
      const { error } = await client.from('reels').delete().eq('id', row.id).eq('author_id', authenticatedUserId);
      if (error) throw error;
      try { await client.storage.from(MEDIA_BUCKET).remove([row.media_path]); } catch { /* The database row is already removed; storage cleanup can be retried administratively. */ }
      if (wideViewCard === card) await exitWideView();
      card.remove();
      reelById.delete(row.id);
      showToast(t('deleted'));
    } catch (error) {
      console.warn('Reel could not be deleted.', error);
      button.disabled = false;
      showToast(t('deleteFailed'));
    }
  };

  const bindCardActions = (card, row) => {
    const likeButton = card.querySelector('.reel-like-button');
    const commentButton = card.querySelector('.reel-comment-button');
    const saveButton = card.querySelector('.reel-save-button');
    const shareButton = card.querySelector('.reel-share-button');
    const downloadButton = card.querySelector('.reel-download-button');
    const soundButton = card.querySelector('.reel-sound-button');
    const wideButton = card.querySelector('.reel-wide-button');
    const deleteButton = card.querySelector('.reel-delete-button');

    likeButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!authenticatedUserId) { showToast(t('signIn')); return; }
      const wasLiked = likeButton.dataset.liked === 'true';
      const currentCount = numeric(likeButton.querySelector('.reel-action-count').dataset.count);
      likeButton.disabled = true;
      updateLikeButton(card, !wasLiked, currentCount + (wasLiked ? -1 : 1));
      try {
        if (wasLiked) {
          const { error } = await client.from('reel_likes').delete().eq('reel_id', row.id).eq('user_id', authenticatedUserId);
          if (error) throw error;
        } else {
          const { error } = await client.from('reel_likes').insert({ reel_id: row.id, user_id: authenticatedUserId });
          if (error && error.code !== '23505') throw error;
        }
      } catch {
        updateLikeButton(card, wasLiked, currentCount);
        showToast(t('likeFailed'));
      } finally { likeButton.disabled = false; }
    });

    saveButton?.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!authenticatedUserId) { showToast(t('signIn')); return; }
      const wasSaved = saveButton.dataset.saved === 'true';
      saveButton.disabled = true;
      updateSaveButton(card, !wasSaved);
      try {
        const result = wasSaved
          ? await client.from('reel_saves').delete().eq('reel_id', row.id).eq('user_id', authenticatedUserId)
          : await client.from('reel_saves').insert({ reel_id: row.id, user_id: authenticatedUserId });
        if (result.error && result.error.code !== '23505') throw result.error;
        showToast(t(wasSaved ? 'save' : 'savedReel'));
      } catch { updateSaveButton(card, wasSaved); showToast(t('likeFailed')); }
      finally { saveButton.disabled = false; }
    });
    commentButton.addEventListener('click', (event) => { event.stopPropagation(); void openComments(row); });
    shareButton.addEventListener('click', async (event) => { event.stopPropagation();
      if (navigator.share) {
        try { await navigator.share({ title: t('shareTitle'), text: t('shareText'), url: shareUrl(row) }); return; }
        catch (error) { if (error?.name === 'AbortError') return; }
      }
      makeShareMenu(card, row);
    });
    downloadButton?.addEventListener('click', (event) => { event.stopPropagation(); void downloadReel(row); });
    soundButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const video = card.querySelector('.reel-card-video');
      updateUserMutePreference(card, !video.muted);
      if (!video.muted) video.play().catch(() => {});
    });
    wideButton.addEventListener('click', (event) => { event.stopPropagation(); void enterWideView(card); });
    deleteButton?.addEventListener('click', () => { void deleteReel(card, row, deleteButton); });
    const video = card.querySelector('.reel-card-video');
    video.addEventListener('click', (event) => {
      event.stopPropagation();
      if (card === wideViewCard) {
        if (video.paused) {
          video.dataset.wideViewUserPaused = 'false';
          video.play().catch(() => {});
        } else {
          video.dataset.wideViewUserPaused = 'true';
          video.pause();
        }
        return;
      }
      card.classList.toggle('is-controls-hidden');
    });
    const pauseButton = document.createElement('button');
    pauseButton.className = 'reel-wide-pause-button';
    pauseButton.type = 'button';
    pauseButton.dataset.state = 'playing';
    pauseButton.setAttribute('aria-label', t('Pause Reel'));
    pauseButton.textContent = 'Ⅱ';
    pauseButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (video.paused) {
        video.dataset.wideViewUserPaused = 'false';
        video.play().catch(() => {});
      } else {
        video.dataset.wideViewUserPaused = 'true';
        video.pause();
      }
    });
    const syncPauseButton = () => {
      const paused = video.paused;
      pauseButton.dataset.state = paused ? 'paused' : 'playing';
      pauseButton.textContent = paused ? '▶' : 'Ⅱ';
      const label = t(paused ? 'Play Reel' : 'Pause Reel');
      pauseButton.setAttribute('aria-label', label);
      pauseButton.title = label;
    };
    video.addEventListener('play', syncPauseButton);
    video.addEventListener('pause', syncPauseButton);
    video.addEventListener('ended', syncPauseButton);
    document.addEventListener('iqzodiac:languagechange', syncPauseButton);
    syncPauseButton();
    video.addEventListener('play', () => card.classList.remove('is-paused'));
    video.addEventListener('pause', () => card.classList.add('is-paused'));
    video.addEventListener('error', () => card.classList.add('has-video-error'));
    updateLikeButton(card, Boolean(row.liked_by_me), numeric(row.like_count));
    updateSaveButton(card, Boolean(row.saved_by_viewer));
    updateCommentButton(card, numeric(row.comment_count));
    updateSoundButton(card);
    updateWideViewButton(card);
  };

  const renderCard = (row, signedUrl) => {
    const card = document.createElement('article');
    card.className = 'reel-card';
    card.dataset.reelId = row.id;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Reel by ${row.display_name || row.handle || 'Orbit Member'}`);

    const video = document.createElement('video');
    video.className = 'reel-card-video';
    video.playsInline = true;
    video.loop = true;
    video.muted = true;
    video.dataset.userMuted = 'true';
    video.preload = 'none';
    video.dataset.src = signedUrl;
    video.setAttribute('aria-label', language() === 'ar' ? 'فيديو Reel' : 'Reel video');
    video.setAttribute('tabindex', '0');

    const playHint = document.createElement('span');
    playHint.className = 'reel-video-tap-hint';
    playHint.setAttribute('aria-hidden', 'true');
    playHint.textContent = '▶';

    const authorName = row.display_name || row.handle || (language() === 'ar' ? 'عضو في المدار' : 'Orbit Member');
    const copyNode = document.createElement('div');
    copyNode.className = 'reel-card-copy';
    const author = document.createElement('div');
    author.className = 'reel-card-author';
    const profile = row.profile || null;
    author.append(makeAvatar(profile, authorName));
    const authorLink = document.createElement('a');
    authorLink.className = 'reel-card-author-link';
    authorLink.href = `./reel-profile.html?user=${encodeURIComponent(row.author_id)}`;
    authorLink.textContent = authorName;
    author.append(authorLink);
    copyNode.append(author);
    if (row.caption) {
      const caption = document.createElement('p');
      caption.className = 'reel-card-caption';
      caption.textContent = row.caption;
      copyNode.append(caption);
    }
    const meta = document.createElement('div');
    meta.className = 'reel-card-meta';
    meta.textContent = `${formatDate(row.created_at)} · ${t('duration', Number(row.duration_seconds || 0))}`;
    copyNode.append(meta);

    const actions = document.createElement('div');
    actions.className = 'reel-actions';
    const deleteAction = row.author_id === authenticatedUserId ? `<button type="button" class="reel-action reel-delete-button" aria-label="${escapeHTML(t('deleteReel'))}" title="${escapeHTML(t('deleteReel'))}"><span class="reel-action-icon" aria-hidden="true">×</span><span class="reel-action-label">${escapeHTML(t('deleteReel'))}</span></button>` : '';
    actions.innerHTML = `<button type="button" class="reel-action reel-like-button" data-reel-id="${escapeHTML(row.id)}" data-liked="${Boolean(row.liked_by_me)}"><span class="reel-action-icon" aria-hidden="true">${row.liked_by_me ? '♥' : '♡'}</span><span class="reel-action-label">${escapeHTML(t(row.liked_by_me ? 'liked' : 'like'))}</span><span class="reel-action-count" data-count="${numeric(row.like_count)}">${escapeHTML(t('count', numeric(row.like_count)))}</span></button><button type="button" class="reel-action reel-save-button" data-reel-id="${escapeHTML(row.id)}" data-saved="${Boolean(row.saved_by_viewer)}"><span class="reel-action-icon" aria-hidden="true">${row.saved_by_viewer ? '🔖' : '▱'}</span><span class="reel-action-label">${escapeHTML(t(row.saved_by_viewer ? 'savedReel' : 'save'))}</span></button><button type="button" class="reel-action reel-comment-button" data-reel-id="${escapeHTML(row.id)}" aria-label="${escapeHTML(t('comments'))}"><span class="reel-action-icon" aria-hidden="true">▱</span><span class="reel-action-label">${escapeHTML(t('comments'))}</span><span class="reel-action-count" data-count="${numeric(row.comment_count)}">${escapeHTML(t('count', numeric(row.comment_count)))}</span></button><button type="button" class="reel-action reel-share-button"><span class="reel-action-icon" aria-hidden="true">↗</span><span class="reel-action-label">${escapeHTML(t('share'))}</span></button><button type="button" class="reel-action reel-download-button"><span class="reel-action-icon" aria-hidden="true">↓</span><span class="reel-action-label">${escapeHTML(t('download'))}</span></button><button type="button" class="reel-action reel-sound-button"><span class="reel-action-icon reel-sound-icon" aria-hidden="true">♫</span><span class="reel-action-label">${escapeHTML(t('unmute'))}</span></button><button type="button" class="reel-action reel-wide-button"><span class="reel-action-icon reel-wide-icon" aria-hidden="true">⛶</span><span class="reel-action-label">${escapeHTML(t('wideView'))}</span></button>${deleteAction}`;
    card.append(video, playHint, pauseButton, copyNode, actions);
    bindCardActions(card, row);
    if (reelObserver) reelObserver.observe(video);
    return card;
  };

  const enrichRows = async (rows) => {
    const [profileMap, metricMap, signedUrls] = await Promise.all([
      getPublicProfiles(rows.map((row) => row.author_id)),
      getMetrics(rows),
      signReelMedia(rows),
    ]);
    return rows.map((row, index) => {
      const profile = profileMap.get(row.author_id) || {};
      const metric = metricMap.get(row.id) || {};
      return {
        ...row,
        ...profile,
        profile,
        display_name: profile.display_name || row.display_name,
        handle: profile.handle || row.handle,
        like_count: numeric(metric.like_count),
        comment_count: numeric(metric.comment_count),
        liked_by_me: Boolean(metric.liked_by_viewer),
        saved_by_viewer: Boolean(metric.saved_by_viewer),
        signed_url: signedUrls[index],
      };
    });
  };

  const setupObservers = () => {
    reelObserver?.disconnect();
    feedObserver?.disconnect();
    reelObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const card = video.closest('.reel-card');
        if (entry.isIntersecting && entry.intersectionRatio >= 0.66) {
          if (video.dataset.src && !video.src) {
            video.src = video.dataset.src;
            video.removeAttribute('data-src');
            video.load();
          }
          if (activeVideo && activeVideo !== video) activeVideo.pause();
          activeVideo = video;
          video.muted = video.dataset.userMuted !== 'false';
          const mayAutoResume = card !== wideViewCard || video.dataset.wideViewUserPaused !== 'true';
          if (mayAutoResume && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) video.play().catch(() => {});
          else if (mayAutoResume) video.addEventListener('canplay', () => { if (activeVideo === video && (card !== wideViewCard || video.dataset.wideViewUserPaused !== 'true')) video.play().catch(() => {}); }, { once: true });
          updateSoundButton(card);
          const reelId = card?.dataset.reelId;
          if (reelId && !viewedReelIds.has(reelId)) {
            viewedReelIds.add(reelId);
            void client.rpc('record_reel_view', { p_reel_id: reelId });
          }
        } else if (card === wideViewCard) {
          // Fullscreen can move the card outside the feed's intersection root
          // (notably on mobile browsers). Keep the selected Reel playing.
          if (video.paused && video.dataset.wideViewUserPaused !== 'true') video.play().catch(() => {});
        } else {
          video.pause();
          if (activeVideo === video) activeVideo = null;
        }
      });
    }, { root: feed, threshold: [0, 0.45, 0.66, 0.85] });

    feedObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreReels();
    }, { root: feed, rootMargin: '1200px 0px', threshold: 0 });
  };

  const loadMoreReels = async () => {
    if (loadingMore || !hasMore || !client) return;
    loadingMore = true;
    if (pageIndex === 0 && feed.querySelectorAll('.reel-card').length === 0) setFeedMessage('loading', t('loading'));
    try {
      const start = pageIndex * PAGE_SIZE;
      const { data, error } = await client.from('reels')
        .select('id,author_id,caption,media_path,duration_seconds,created_at')
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = data || [];
      if (pageIndex === 0 && rows.length === 0) {
        feed.replaceChildren(feedStatus, loadSentinel);
        setFeedMessage('empty', t('empty'));
        hasMore = false;
        return;
      }
      const enriched = await enrichRows(rows);
      if (pageIndex === 0) feed.replaceChildren(feedStatus, loadSentinel);
      setFeedMessage('', '');
      enriched.forEach((row) => {
        reelById.set(row.id, row);
        if (!row.signed_url) return;
        feed.insertBefore(renderCard(row, row.signed_url), loadSentinel);
      });
      pageIndex += 1;
      hasMore = rows.length === PAGE_SIZE;
      if (feed.querySelectorAll('.reel-card').length === 0 && !hasMore) setFeedMessage('error', t('unavailable'), true);
      if (hasMore) {
        feedObserver?.observe(loadSentinel);
      }
    } catch (error) {
      console.warn('Reels could not be loaded.', error);
      if (pageIndex === 0) {
        feed.replaceChildren(feedStatus, loadSentinel);
        setFeedMessage('error', t('unavailable'), true);
      } else showToast(t('unavailable'));
      hasMore = false;
    } finally {
      loadingMore = false;
    }
  };

  const openNotificationTarget = async () => {
    if (!targetReelId) return;
    let row = reelById.get(targetReelId);
    if (!row) {
      const { data, error } = await client.from('reels').select('id,author_id,caption,media_path,duration_seconds,created_at').eq('id', targetReelId).maybeSingle();
      if (error) throw error;
      if (!data) return;
      [row] = await enrichRows([data]);
      reelById.set(row.id, row);
      if (row.signed_url) {
        const firstCard = feed.querySelector('.reel-card');
        feed.insertBefore(renderCard(row, row.signed_url), firstCard || loadSentinel);
      }
    }
    if (!row?.signed_url) return;
    const card = feed.querySelector(`.reel-card[data-reel-id="${CSS.escape(targetReelId)}"]`);
    if (!card) return;
    setFeedMessage('', '');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    feed.scrollTop = card.offsetTop;
    if (targetReelCommentId) await openComments(row, targetReelCommentId);
  };

  const resetFeed = async () => {
    pageIndex = 0;
    hasMore = true;
    loadingMore = false;
    activeVideo?.pause();
    activeVideo = null;
    reelById.clear();
    setupObservers();
    feed.replaceChildren(feedStatus, loadSentinel);
    setFeedMessage('loading', t('loading'));
    await loadMoreReels();
  };

  const updateUserMutePreference = (card, muted) => {
    const video = card.querySelector('.reel-card-video');
    video.dataset.userMuted = String(muted);
    video.muted = muted;
    updateSoundButton(card);
  };

  const bindEditor = () => {
    byId('open-reel-create').addEventListener('click', () => {
      setStatus('');
      if (!createDialog.open) createDialog.showModal();
    });
    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
    byId('cancel-reel-create').addEventListener('click', () => createDialog.close());
    createDialog.addEventListener('close', () => {
      byId('reel-music-preview').pause();
      previewVideo.pause();
    });
    fileInput.addEventListener('change', () => void setSelection(fileInput.files?.[0]));
    musicInput.addEventListener('change', () => setMusicSelection(musicInput.files?.[0]));
    byId('reel-caption').addEventListener('input', updateCaptionCount);
    byId('reel-overlay-text').addEventListener('input', updatePreviewOverlay);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedFile || !Number.isFinite(selectedDuration)) { setStatus(t('invalidVideo'), 'error'); return; }
      if (selectedFile.size > MAX_BYTES) { setStatus(t('tooLarge'), 'error'); return; }
      if (selectedDuration > MAX_DURATION + 0.01) { setStatus(t('tooLong'), 'error'); return; }
      if (!client || !authenticatedUserId) { setStatus(t('failed'), 'error'); return; }

      const publishButton = byId('publish-reel');
      const cancelButton = byId('cancel-reel-create');
      publishButton.disabled = true;
      cancelButton.disabled = true;
      fileInput.disabled = true;
      musicInput.disabled = true;
      const overlayText = byId('reel-overlay-text').value.trim().slice(0, 120);
      let uploadFile = selectedFile;
      let mediaPath = '';
      try {
        if (overlayText || selectedMusicFile) {
          progress.hidden = false;
          progress.value = 0;
          setStatus(`${t('editing')} 0%`);
          uploadFile = await renderEditedVideo(selectedFile, overlayText, selectedMusicFile, (percent) => {
            progress.value = percent;
            setStatus(t('processing', percent));
          });
        }
        if (uploadFile.size > MAX_BYTES) throw new Error('edited-too-large');
        setStatus(t('publishing'));
        const extension = (uploadFile.name.match(/\.([a-z0-9]+)$/i)?.[1] || (uploadFile.type === 'video/webm' ? 'webm' : 'mp4')).toLowerCase();
        mediaPath = `${authenticatedUserId}/reels/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(mediaPath, uploadFile, { contentType: uploadFile.type, cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await client.from('reels').insert({
          author_id: authenticatedUserId,
          caption: byId('reel-caption').value.trim().slice(0, 280),
          media_path: mediaPath,
          media_mime: uploadFile.type,
          media_size_bytes: uploadFile.size,
          duration_seconds: Number(selectedDuration.toFixed(3)),
        });
        if (insertError) throw insertError;
        mediaPath = '';
        byId('reel-caption').value = '';
        clearSelection();
        createDialog.close();
        showToast(t('saved'));
        feed.scrollTop = 0;
        await resetFeed();
      } catch (error) {
        if (mediaPath) await client.storage.from(MEDIA_BUCKET).remove([mediaPath]);
        console.warn('Reel could not be published.', error);
        if (error?.message === 'edit-unsupported') setStatus(t('editUnsupported'), 'error');
        else if (error?.message === 'edit-too-large') setStatus(t('editedTooLarge'), 'error');
        else if (overlayText || selectedMusicFile) setStatus(t('editFailed'), 'error');
        else setStatus(t('failed'), 'error');
      } finally {
        progress.hidden = true;
        publishButton.disabled = false;
        cancelButton.disabled = false;
        fileInput.disabled = false;
        musicInput.disabled = false;
      }
    });
  };

  const bindCommentsForm = () => {
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedCommentReel) return;
      const body = commentInput.value.trim().slice(0, 180);
      if (!authenticatedUserId) { showToast(t('signIn')); return; }
      const button = byId('reel-comment-submit'); const mediaFile = commentForm._mediaFile;
      if (!body && !mediaFile) return;
      button.disabled = true; let media = {}; let mediaPath = '';
      try {
        if (mediaFile) { media = await uploadReelCommentMedia(mediaFile); mediaPath = media.media_path; }
        const { media_url: mediaUrl, ...mediaFields } = media;
        const { data, error } = await client.from('reel_comments')
          .insert({ reel_id: selectedCommentReel.id, author_id: authenticatedUserId, body, ...mediaFields })
          .select('id,reel_id,author_id,body,created_at,parent_comment_id,media_type,media_path,media_mime,media_size_bytes').single();
        if (error) throw error; const commentData = { ...data, media_url: mediaUrl || '' };
        const profileMap = await getPublicProfiles([authenticatedUserId]);
        const empty = commentsList.querySelector('.reel-comments-empty');
        empty?.remove();
        commentsList.prepend(createCommentItem(commentData, profileMap.get(authenticatedUserId)));
        commentInput.value = ''; commentForm._mediaFile = null; commentForm.querySelector('[data-comment-media-input]').value = '';
        const mediaStatus = commentForm.querySelector('[data-comment-media-status]'); if (mediaStatus) mediaStatus.textContent = '';
        selectedCommentReel.comment_count = numeric(selectedCommentReel.comment_count) + 1;
        const card = document.querySelector(`.reel-card[data-reel-id="${CSS.escape(selectedCommentReel.id)}"]`);
        updateCommentButton(card, selectedCommentReel.comment_count);
        showToast(t('commentSaved'));
      } catch { if (mediaPath) await client.storage.from(MEDIA_BUCKET).remove([mediaPath]); showToast(t('commentFailed')); }
      finally { button.disabled = false; }
    });
  };

  document.addEventListener('iqzodiac:languagechange', localizeEditor);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) activeVideo?.pause();
    else if (activeVideo && activeVideo.isConnected && !(activeVideo === wideViewVideo && activeVideo.dataset.wideViewUserPaused === 'true')) activeVideo.play().catch(() => {});
  });

  (async () => {
    try {
      client = await database();
      if (!client) throw new Error('missing-client');
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      authenticatedUserId = data.session?.user?.id || null;
      bindEditor();
      setupReelCommentMediaControls(commentForm);
      bindCommentsForm();
      setupObservers();
      localizeEditor();
      await loadMoreReels();
      await openNotificationTarget();
    } catch (error) {
      console.warn('Reels could not be initialized.', error);
      feed.replaceChildren();
      setFeedMessage('error', t('unavailable'), true);
    }
  })();
})();
