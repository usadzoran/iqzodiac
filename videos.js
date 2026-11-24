(() => {
  'use strict';

  const VIDEO_BUCKET = 'iqzodiac-video-library';
  const MAX_BYTES = 50 * 1024 * 1024;
  const PAGE_SIZE = 12;
  const byId = (id) => document.getElementById(id);
  const clientReady = () => window.IQZodiacSupabase?.ready;
  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = {
    en: {
      upload: 'Upload a video', eyebrow: 'LONG-FORM · YOUR ORBIT', title: 'Stories that take their time.', intro: 'Watch and share longer videos with the IQZodiac community. Published videos are visible to everyone.', limit: 'Up to 50 MB per video · no six-minute Reels limit', library: 'COMMUNITY LIBRARY', explore: 'Explore videos', loading: 'Loading videos…', loadFailed: 'Videos are temporarily unavailable. Please try again.', noVideos: 'No videos in this category yet. Be the first to share one.', all: 'All videos', noCategory: 'No category', categoryOptional: 'Category (optional)', publishTitle: 'Publish a video', note: 'Choose an MP4 or WebM video up to 50 MB. There is no six-minute Reels duration limit. Please only upload content you own or have permission to share.', titleLabel: 'Title', description: 'Description', fileHeading: 'Video file', choose: 'Choose MP4 or WebM', fileHint: 'Up to 50 MB per video · longer than Reels is allowed', rights: 'I own this video or have permission to publish it publicly.', cancel: 'Cancel', publish: 'Publish video', uploading: 'Uploading and publishing…', published: 'Your video is now published for everyone.', uploadFailed: 'The video could not be published. Check the file and connection, then try again.', signIn: 'Sign in to publish a video.', fileTooLarge: 'This video exceeds the 50 MB limit.', fileType: 'Choose an MP4 or WebM video.', chooseFile: 'Choose a video file first.', rightsRequired: 'Confirm that you own this video or have permission to publish it.', titleRequired: 'Enter a title for your video.', metadataLoading: 'Reading video details…', duration: (value) => `Video duration: ${value}. No six-minute limit applies.`, durationUnknown: 'Video selected. There is no six-minute duration limit.', fileChosen: (name) => `${name} selected`, categoryLoadFailed: 'Categories could not be loaded; you can still publish without one.', author: 'Community member', uncategorized: 'Uncategorized', size: (value) => `${value} MB`, date: (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : '', more: 'Load more', end: 'You have reached the end of the library.', signInLink: 'Sign in to publish', refresh: 'Refresh videos', durationReadError: 'Could not read this video. Choose another file.',
    },
    ar: {
      upload: 'ارفع فيديو', eyebrow: 'فيديوهات طويلة · مدارك', title: 'حكايات تأخذ وقتها.', intro: 'شاهد وشارك الفيديوهات الطويلة مع مجتمع IQZodiac. الفيديو المنشور متاح للجميع.', limit: 'حتى 50 ميغابايت للفيديو · لا يوجد حد Reels البالغ 6 دقائق', library: 'مكتبة المجتمع', explore: 'اكتشف الفيديوهات', loading: 'جارٍ تحميل الفيديوهات…', loadFailed: 'الفيديوهات غير متاحة مؤقتًا. حاول مرة أخرى.', noVideos: 'لا توجد فيديوهات في هذا التصنيف بعد. كن أول من يشارك.', all: 'كل الفيديوهات', noCategory: 'دون تصنيف', categoryOptional: 'التصنيف (اختياري)', publishTitle: 'انشر فيديو', note: 'اختر فيديو MP4 أو WebM لا يتجاوز 50 ميغابايت. لا يوجد حد الست دقائق الخاص بـReels. لا ترفع إلا محتوى تملكه أو تملك إذنًا بمشاركته.', titleLabel: 'العنوان', description: 'الوصف', fileHeading: 'ملف الفيديو', choose: 'اختر MP4 أو WebM', fileHint: 'حتى 50 ميغابايت للفيديو · مسموح أن يكون أطول من Reels', rights: 'أملك هذا الفيديو أو لدي إذن بنشره للعامة.', cancel: 'إلغاء', publish: 'نشر الفيديو', uploading: 'جارٍ الرفع والنشر…', published: 'تم نشر الفيديو وأصبح متاحًا للجميع.', uploadFailed: 'تعذّر نشر الفيديو. تحقق من الملف والاتصال ثم حاول مجددًا.', signIn: 'سجّل الدخول لنشر فيديو.', fileTooLarge: 'حجم الفيديو يتجاوز الحد الأقصى 50 ميغابايت.', fileType: 'اختر فيديو MP4 أو WebM.', chooseFile: 'اختر ملف فيديو أولًا.', rightsRequired: 'أكد أنك تملك الفيديو أو لديك إذن بنشره.', titleRequired: 'أدخل عنوان الفيديو.', metadataLoading: 'جارٍ قراءة معلومات الفيديو…', duration: (value) => `مدة الفيديو: ${value}. لا يوجد حد للست دقائق.`, durationUnknown: 'تم اختيار الفيديو. لا يوجد حد لمدته بست دقائق.', fileChosen: (name) => `تم اختيار ${name}`, categoryLoadFailed: 'تعذّر تحميل التصنيفات؛ يمكنك النشر من دون تصنيف.', author: 'عضو في المجتمع', uncategorized: 'دون تصنيف', size: (value) => `${value} ميغابايت`, date: (value) => value ? new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(value)) : '', more: 'تحميل المزيد', end: 'وصلت إلى نهاية المكتبة.', signInLink: 'سجّل الدخول للنشر', refresh: 'تحديث الفيديوهات', durationReadError: 'تعذّر قراءة الفيديو. اختر ملفًا آخر.',
    },
  };
  const t = (key, ...args) => {
    const value = copy[language()][key];
    return typeof value === 'function' ? value(...args) : value;
  };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const formatDuration = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
  };
  const setStatus = (message, state = '') => {
    byId('video-upload-status').textContent = message || '';
    byId('video-upload-status').dataset.state = state;
  };
  const setFeedStatus = (message) => { byId('videos-status').textContent = message || ''; };
  const categoryName = (category) => language() === 'ar' ? (category.name_ar || category.name_en) : (category.name_en || category.name_ar);
  const safeFileSize = (bytes) => (Number(bytes || 0) / (1024 * 1024)).toFixed(1);
  let publishNoticeVisible = false;
  let publishNoticeTimer = 0;
  const showPublishedNotice = () => {
    const notice = byId('video-published-notice');
    publishNoticeVisible = true;
    notice.textContent = t('published');
    notice.hidden = false;
    window.clearTimeout(publishNoticeTimer);
    publishNoticeTimer = window.setTimeout(() => { publishNoticeVisible = false; notice.hidden = true; }, 10000);
  };

  let client;
  let currentUser = null;
  let categories = [];
  let categoryById = new Map();
  let activeCategoryId = '';
  let rows = [];
  let offset = 0;
  let hasMore = true;
  let loading = false;
  let selectedFile = null;
  let localPreviewUrl = '';

  const localize = () => {
    byId('open-video-upload-label').textContent = t('upload');
    byId('videos-eyebrow').textContent = t('eyebrow');
    byId('videos-title').textContent = t('title');
    byId('videos-intro').textContent = t('intro');
    byId('videos-limit-note').textContent = t('limit');
    byId('videos-library-label').textContent = t('library');
    byId('videos-section-title').textContent = t('explore');
    byId('videos-refresh').title = t('refresh');
    byId('videos-refresh').setAttribute('aria-label', t('refresh'));
    byId('videos-load-more').textContent = t('more');
    byId('video-dialog-kicker').textContent = t('eyebrow');
    byId('video-dialog-title').textContent = t('publishTitle');
    byId('video-dialog-note').textContent = t('note');
    byId('video-title-label').textContent = t('titleLabel');
    byId('video-description-label').textContent = t('description');
    byId('video-category-label').textContent = t('categoryOptional');
    byId('video-file-heading').textContent = t('fileHeading');
    byId('video-file-hint').textContent = t('fileHint');
    byId('video-rights-label').textContent = t('rights');
    byId('cancel-video-upload').textContent = t('cancel');
    byId('publish-video-label').textContent = t('publish');
    byId('video-upload-login').textContent = t('signInLink');
    if (publishNoticeVisible) byId('video-published-notice').textContent = t('published');
    byId('video-file-name').textContent = selectedFile ? t('fileChosen', selectedFile.name) : t('choose');
    renderCategories();
    renderFeed();
  };

  const renderCategories = () => {
    const filters = byId('video-category-filters');
    const categorySelect = byId('video-category');
    const previousSelection = categorySelect.value;
    const filterItems = [{ id: '', name: t('all') }, ...categories.map((category) => ({ id: category.id, name: categoryName(category) }))];
    filters.innerHTML = filterItems.map((item) => `<button type="button" class="video-category-filter${activeCategoryId === item.id ? ' is-active' : ''}" data-filter-category="${escapeHTML(item.id)}" aria-pressed="${activeCategoryId === item.id}">${escapeHTML(item.name)}</button>`).join('');
    categorySelect.innerHTML = `<option value="">${escapeHTML(t('noCategory'))}</option>${categories.map((category) => `<option value="${escapeHTML(category.id)}">${escapeHTML(categoryName(category))}</option>`).join('')}`;
    if (categories.some((category) => category.id === previousSelection)) categorySelect.value = previousSelection;
    else categorySelect.value = '';
    categoryById = new Map(categories.map((category) => [category.id, category]));
  };

  const videoCard = (row) => {
    const category = row.category_id ? categoryById.get(row.category_id) : null;
    const author = row.author || t('author');
    const date = t('date', row.created_at);
    const size = t('size', safeFileSize(row.media_size_bytes));
    const description = row.description ? `<p class="video-card-description">${escapeHTML(row.description)}</p>` : '';
    return `<article class="video-card" data-video-card="${escapeHTML(row.id)}"><div class="video-player-wrap"><video controls playsinline preload="none" src="${escapeHTML(row.signed_url)}" aria-label="${escapeHTML(row.title)}"></video></div><div class="video-card-copy"><div class="video-card-topline"><span class="video-category-pill">${escapeHTML(category ? categoryName(category) : t('uncategorized'))}</span><span class="video-meta">${escapeHTML(size)}</span></div><h3 class="video-card-title">${escapeHTML(row.title)}</h3>${description}<div class="video-card-footer"><span>${escapeHTML(author)}</span><span>${escapeHTML(date)}</span></div></div></article>`;
  };

  const renderFeed = () => {
    const grid = byId('videos-grid');
    if (!rows.length && !loading && !byId('videos-status').textContent) {
      grid.innerHTML = `<p class="videos-empty">${escapeHTML(t('noVideos'))}</p>`;
    } else {
      grid.innerHTML = rows.map(videoCard).join('');
    }
    grid.querySelectorAll('.video-card video').forEach((video) => {
      video.addEventListener('playing', () => {
        grid.querySelectorAll('.video-card video').forEach((other) => { if (other !== video) other.pause(); });
      });
    });
    byId('videos-load-more').hidden = !hasMore || loading || rows.length === 0;
  };

  const loadCategories = async () => {
    const { data, error } = await client.from('video_categories').select('id,slug,name_en,name_ar,is_active,sort_order').eq('is_active', true).order('sort_order', { ascending: true }).limit(100);
    if (error) throw error;
    categories = data || [];
    renderCategories();
  };

  const loadProfiles = async (items) => {
    const ids = [...new Set(items.map((item) => item.author_id).filter(Boolean))];
    if (!ids.length) return new Map();
    try {
      const { data, error } = await client.from('profiles').select('user_id,display_name,handle').in('user_id', ids).limit(100);
      if (error) return new Map();
      return new Map((data || []).map((profile) => [profile.user_id, profile.display_name || profile.handle || t('author')]));
    } catch { return new Map(); }
  };

  const loadVideos = async ({ reset = false } = {}) => {
    if (loading) return;
    if (reset) { rows = []; offset = 0; hasMore = true; }
    if (!hasMore && !reset) return;
    loading = true;
    setFeedStatus(t('loading'));
    renderFeed();
    const button = byId('videos-load-more');
    button.disabled = true;
    try {
      let query = client.from('videos').select('id,author_id,category_id,title,description,storage_path,media_mime,media_size_bytes,status,created_at').eq('status', 'published').order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
      if (activeCategoryId) query = query.eq('category_id', activeCategoryId);
      const { data, error } = await query;
      if (error) throw error;
      const page = data || [];
      const profiles = await loadProfiles(page);
      const signed = page.length
        ? await client.storage.from(VIDEO_BUCKET).createSignedUrls(page.map((row) => row.storage_path), 3600)
        : { data: [], error: null };
      if (signed.error) throw signed.error;
      const signedByPath = new Map((signed.data || []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
      const readyRows = page.filter((row) => signedByPath.has(row.storage_path)).map((row) => ({ ...row, signed_url: signedByPath.get(row.storage_path), author: profiles.get(row.author_id) || t('author') }));
      rows = reset ? readyRows : rows.concat(readyRows);
      offset += page.length;
      hasMore = page.length === PAGE_SIZE;
      setFeedStatus(rows.length ? (hasMore ? '' : t('end')) : t('noVideos'));
      renderFeed();
    } catch (error) {
      console.warn('Video library could not be loaded.', error?.message || error);
      setFeedStatus(t('loadFailed'));
    } finally {
      loading = false;
      button.disabled = false;
      button.hidden = !hasMore || rows.length === 0;
      renderFeed();
    }
  };

  const updatePreview = (file) => {
    selectedFile = file || null;
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    localPreviewUrl = '';
    byId('video-local-preview-wrap').hidden = !selectedFile;
    byId('video-local-duration').textContent = '';
    byId('video-file-name').textContent = selectedFile ? t('fileChosen', selectedFile.name) : t('choose');
    if (!selectedFile) { byId('video-local-preview').removeAttribute('src'); byId('video-local-preview').load(); return; }
    if (!['video/mp4', 'video/webm'].includes(selectedFile.type)) {
      setStatus(t('fileType'), 'error');
      selectedFile = null;
      byId('video-file').value = '';
      byId('video-local-preview-wrap').hidden = true;
      byId('video-file-name').textContent = t('choose');
      return;
    }
    if (selectedFile.size > MAX_BYTES) {
      setStatus(t('fileTooLarge'), 'error');
      selectedFile = null;
      byId('video-file').value = '';
      byId('video-local-preview-wrap').hidden = true;
      byId('video-file-name').textContent = t('choose');
      return;
    }
    setStatus('');
    localPreviewUrl = URL.createObjectURL(selectedFile);
    const video = byId('video-local-preview');
    video.src = localPreviewUrl;
    byId('video-local-duration').textContent = t('metadataLoading');
    video.onloadedmetadata = () => { byId('video-local-duration').textContent = Number.isFinite(video.duration) ? t('duration', formatDuration(video.duration)) : t('durationUnknown'); };
    video.onerror = () => { byId('video-local-duration').textContent = t('durationReadError'); };
    video.load();
  };

  const resetForm = () => {
    byId('video-upload-form').reset();
    selectedFile = null;
    updatePreview(null);
    byId('video-file-name').textContent = t('choose');
    setStatus('');
    byId('video-upload-login').hidden = true;
  };

  const publishVideo = async (event) => {
    event.preventDefault();
    setStatus('');
    if (!currentUser) {
      setStatus(t('signIn'), 'error');
      byId('video-upload-login').hidden = false;
      return;
    }
    const title = byId('video-title').value.trim();
    const description = byId('video-description').value.trim();
    const categoryId = byId('video-category').value || null;
    const rightsConfirmed = byId('video-rights-confirmed').checked;
    if (!title) { setStatus(t('titleRequired'), 'error'); byId('video-title').focus(); return; }
    if (!selectedFile) { setStatus(t('chooseFile'), 'error'); return; }
    if (selectedFile.size > MAX_BYTES) { setStatus(t('fileTooLarge'), 'error'); return; }
    if (!['video/mp4', 'video/webm'].includes(selectedFile.type)) { setStatus(t('fileType'), 'error'); return; }
    if (!rightsConfirmed) { setStatus(t('rightsRequired'), 'error'); byId('video-rights-confirmed').focus(); return; }

    const submitButton = byId('publish-video');
    const cancelButton = byId('cancel-video-upload');
    submitButton.disabled = true;
    cancelButton.disabled = true;
    byId('video-file').disabled = true;
    setStatus(t('uploading'));
    let uploadedPath = '';
    try {
      const extension = selectedFile.type === 'video/webm' ? 'webm' : 'mp4';
      const randomId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      uploadedPath = `${currentUser.id}/uploads/${randomId}.${extension}`;
      const { error: uploadError } = await client.storage.from(VIDEO_BUCKET).upload(uploadedPath, selectedFile, { contentType: selectedFile.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await client.from('videos').insert({
        author_id: currentUser.id,
        category_id: categoryId,
        title: title.slice(0, 120),
        description: description.slice(0, 2000),
        storage_path: uploadedPath,
        media_mime: selectedFile.type,
        media_size_bytes: selectedFile.size,
        rights_confirmed: true,
        rights_confirmed_at: new Date().toISOString(),
        status: 'published',
      }).select('id').single();
      if (error) throw error;
      if (!data?.id) throw new Error('The published video row was not returned.');
      uploadedPath = '';
      showPublishedNotice();
      byId('video-upload-form').reset();
      selectedFile = null;
      updatePreview(null);
      byId('video-file-name').textContent = t('choose');
      byId('video-rights-confirmed').checked = false;
      byId('video-upload-dialog').close();
      activeCategoryId = '';
      renderCategories();
      await loadVideos({ reset: true });
    } catch (error) {
      if (uploadedPath) {
        try { await client.storage.from(VIDEO_BUCKET).remove([uploadedPath]); } catch (cleanupError) { console.warn('Unpublished video cleanup failed.', cleanupError?.message || cleanupError); }
      }
      console.warn('Video could not be published.', error?.message || error);
      setStatus(t('uploadFailed'), 'error');
    } finally {
      submitButton.disabled = false;
      cancelButton.disabled = false;
      byId('video-file').disabled = false;
    }
  };

  const bind = () => {
    byId('open-video-upload').addEventListener('click', () => {
      resetForm();
      if (!currentUser) byId('video-upload-login').hidden = false;
      byId('video-upload-dialog').showModal();
    });
    byId('close-video-dialog').addEventListener('click', () => byId('video-upload-dialog').close());
    byId('cancel-video-upload').addEventListener('click', () => byId('video-upload-dialog').close());
    byId('video-upload-dialog').addEventListener('close', () => { byId('video-local-preview').pause(); });
    byId('video-file').addEventListener('change', () => { updatePreview(byId('video-file').files?.[0]); });
    byId('video-upload-form').addEventListener('submit', (event) => { void publishVideo(event); });
    byId('videos-refresh').addEventListener('click', () => { void loadVideos({ reset: true }); });
    byId('videos-load-more').addEventListener('click', () => { void loadVideos(); });
    byId('video-category-filters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter-category]');
      if (!button) return;
      activeCategoryId = button.dataset.filterCategory || '';
      renderCategories();
      void loadVideos({ reset: true });
    });
    window.addEventListener('iqzodiac:languagechange', localize);
  };

  const init = async () => {
    try {
      client = await clientReady();
      if (!client) throw new Error('Supabase client is unavailable.');
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) console.warn('Could not read the upload session.', sessionError.message || sessionError);
      currentUser = sessionData?.session?.user || null;
      bind();
      localize();
      try { await loadCategories(); } catch (error) { console.warn('Video categories could not be loaded.', error?.message || error); setFeedStatus(t('categoryLoadFailed')); }
      await loadVideos({ reset: true });
    } catch (error) {
      console.warn('Videos page could not be initialized.', error?.message || error);
      byId('videos-status').textContent = t('loadFailed');
      byId('videos-grid').innerHTML = '';
    }
  };

  void init();
})();
