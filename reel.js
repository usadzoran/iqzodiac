(() => {
  'use strict';
  const MAX_DURATION = 6 * 60;
  const MAX_BYTES = 50 * 1024 * 1024;
  const database = () => window.IQZodiacSupabase?.ready;
  const byId = (id) => document.getElementById(id);
  const form = byId('reel-form');
  const fileInput = byId('reel-file');
  const preview = byId('reel-preview');
  const status = byId('reel-form-status');
  const feed = byId('reel-feed');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');
  let toastTimer;
  let selectedFile = null;
  let selectedDuration = null;
  let previewUrl = '';
  let authenticatedUserId = null;

  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = {
    en: {
      choose: 'Choose a video', selected: 'Video selected', invalidType: 'Choose a video file.', tooLarge: 'Video must be 50 MB or smaller.', tooLong: 'Reels can be no longer than 6 minutes.', checking: 'Checking video duration…', ready: 'Ready to publish.', publishing: 'Publishing your Reel…', saved: 'Your Reel is now in your orbit.', failed: 'Your Reel could not be published. Try again.', empty: 'No Reels have been published yet. Be the first to share one.', unavailable: 'Reels are temporarily unavailable.', count: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, duration: (n) => `${Math.round(n)}s`, like: 'Like', liked: 'Liked', comments: (n) => `${n} ${n === 1 ? 'comment' : 'comments'}`, writeComment: 'Write a comment…', postComment: 'Post comment', commentSaved: 'Comment added.', commentFailed: 'Comment could not be saved.', likeFailed: 'Like could not be saved.', signInToInteract: 'Sign in to interact with Reels.', noComments: 'No comments yet. Start the conversation.', commentBy: (name) => `Comment by ${name}`,
    },
    ar: {
      choose: 'اختر فيديو', selected: 'تم اختيار الفيديو', invalidType: 'اختر ملف فيديو.', tooLarge: 'يجب ألا يتجاوز الفيديو ٥٠ ميغابايت.', tooLong: 'يجب ألا تتجاوز مدة الـ Reel ست دقائق.', checking: 'جارٍ التحقق من مدة الفيديو (حتى 6 دقائق)…', ready: 'الفيديو جاهز للنشر.', publishing: 'جارٍ نشر الـ Reel…', saved: 'تم نشر الـ Reel في مدارك.', failed: 'تعذّر نشر الـ Reel. حاول مجددًا.', empty: 'لا توجد Reels منشورة بعد. كن أول من يشارك واحدة.', unavailable: 'Reels غير متاحة مؤقتًا.', count: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, duration: (n) => `${Math.round(n)} ث`, like: 'إعجاب', liked: 'أعجبني', comments: (n) => `${n} ${n === 1 ? 'تعليق' : 'تعليقات'}`, writeComment: 'اكتب تعليقًا…', postComment: 'نشر التعليق', commentSaved: 'تمت إضافة التعليق.', commentFailed: 'تعذّر حفظ التعليق.', likeFailed: 'تعذّر حفظ الإعجاب.', signInToInteract: 'سجّل الدخول للتفاعل مع Reels.', noComments: 'لا توجد تعليقات بعد. ابدأ الحوار.', commentBy: (name) => `تعليق من ${name}`,
    },
  };
  const t = (key, ...args) => typeof copy[language()][key] === 'function' ? copy[language()][key](...args) : copy[language()][key];
  const setStatus = (message, state = '') => { status.textContent = message; status.dataset.state = state; };
  const showToast = (message) => { if (!toast || !toastMessage) return; toastMessage.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800); };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatDate = (value) => { try { return new Intl.DateTimeFormat(language() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(value)); } catch { return ''; } };
  const initials = (value) => String(value || 'OM').replace(/^@/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
  const toCount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  const updateCaptionCount = () => { const value = byId('reel-caption').value.length; byId('reel-caption-count').textContent = `${value} / 280`; };
  byId('reel-caption').addEventListener('input', updateCaptionCount);

  const readDuration = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const video = document.createElement('video'); video.preload = 'metadata';
    const cleanup = () => { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); };
    video.onloadedmetadata = () => { const duration = Number(video.duration); cleanup(); Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error('invalid-duration')); };
    video.onerror = () => { cleanup(); reject(new Error('invalid-video')); }; video.src = url;
  });

  const clearSelection = () => { selectedFile = null; selectedDuration = null; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; preview.replaceChildren(); preview.hidden = true; fileInput.value = ''; byId('reel-file-label').textContent = t('choose'); setStatus(''); };
  const setSelection = async (file) => {
    clearSelection();
    if (!file) return;
    if (!file.type.startsWith('video/')) { setStatus(t('invalidType'), 'error'); return; }
    if (file.size > MAX_BYTES) { setStatus(t('tooLarge'), 'error'); return; }
    setStatus(t('checking'));
    try {
      const duration = await readDuration(file);
      if (duration > MAX_DURATION + 0.01) { setStatus(t('tooLong'), 'error'); return; }
      selectedFile = file; selectedDuration = duration; previewUrl = URL.createObjectURL(file);
      const video = document.createElement('video'); video.src = previewUrl; video.controls = true; video.muted = true; video.playsInline = true; video.preload = 'metadata'; preview.append(video); preview.hidden = false;
      byId('reel-file-label').textContent = t('selected'); setStatus(`${t('ready')} ${t('duration', duration)}`);
    } catch { setStatus(t('invalidType'), 'error'); }
  };
  fileInput.addEventListener('change', () => void setSelection(fileInput.files?.[0]));

  const makeComment = (comment, client, card) => {
    const item = document.createElement('li'); item.className = 'reel-comment';
    const avatar = document.createElement('span'); avatar.className = 'reel-comment-avatar'; avatar.textContent = initials(comment.display_name || comment.handle);
    const body = document.createElement('div'); body.className = 'reel-comment-body';
    const author = document.createElement('strong'); author.textContent = comment.display_name || comment.handle || 'Orbit Member';
    const text = document.createElement('p'); text.textContent = comment.body;
    const meta = document.createElement('small'); meta.textContent = formatDate(comment.created_at); body.append(author, text, meta); item.append(avatar, body);
    item.setAttribute('aria-label', t('commentBy', author.textContent));
    if (comment.author_id === authenticatedUserId) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'reel-comment-delete'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Delete comment'); remove.addEventListener('click', async () => { remove.disabled = true; const { error } = await client.from('reel_comments').delete().eq('id', comment.id).eq('author_id', authenticatedUserId); if (error) { remove.disabled = false; showToast(t('commentFailed')); return; } item.remove(); updateCommentCount(card, -1); }); item.append(remove); }
    return item;
  };
  const updateCommentCount = (card, delta = 0) => { const node = card.querySelector('.reel-comment-count'); const next = Math.max(0, toCount(node.dataset.count) + delta); node.dataset.count = String(next); node.textContent = t('comments', next); };
  const updateLikeButton = (card, liked, count) => { const button = card.querySelector('.reel-like-button'); button.classList.toggle('is-liked', liked); button.dataset.liked = String(liked); button.querySelector('.reel-like-icon').textContent = liked ? '♥' : '♡'; button.querySelector('.reel-like-label').textContent = liked ? t('liked') : t('like'); const countNode = card.querySelector('.reel-like-count'); countNode.dataset.count = String(Math.max(0, count)); countNode.textContent = String(Math.max(0, count)); };
  const bindInteractions = (card, row, client, comments) => {
    const likeButton = card.querySelector('.reel-like-button');
    likeButton.addEventListener('click', async () => {
      if (!authenticatedUserId) { showToast(t('signInToInteract')); return; }
      const currentlyLiked = likeButton.dataset.liked === 'true'; likeButton.disabled = true;
      try {
        if (currentlyLiked) {
          const { error } = await client.from('reel_likes').delete().eq('reel_id', row.id).eq('user_id', authenticatedUserId); if (error) throw error;
          updateLikeButton(card, false, toCount(card.querySelector('.reel-like-count').dataset.count) - 1);
        } else {
          const { error } = await client.from('reel_likes').insert({ reel_id: row.id, user_id: authenticatedUserId }); if (error && error.code !== '23505') throw error;
          updateLikeButton(card, true, toCount(card.querySelector('.reel-like-count').dataset.count) + (error ? 0 : 1));
        }
      } catch { showToast(t('likeFailed')); } finally { likeButton.disabled = false; }
    });
    const commentForm = card.querySelector('.reel-comment-form'); const input = commentForm.querySelector('input');
    commentForm.addEventListener('submit', async (event) => { event.preventDefault(); const body = input.value.trim().slice(0, 180); if (!body) return; if (!authenticatedUserId) { showToast(t('signInToInteract')); return; } const button = commentForm.querySelector('button'); button.disabled = true; try { const { data, error } = await client.from('reel_comments').insert({ reel_id: row.id, author_id: authenticatedUserId, body }).select('id,reel_id,author_id,body,created_at').single(); if (error) throw error; const comment = { ...data, display_name: 'You' }; const list = card.querySelector('.reel-comments-list'); list.querySelector('.reel-comments-empty')?.remove(); list.append(makeComment(comment, client, card)); input.value = ''; updateCommentCount(card, 1); showToast(t('commentSaved')); } catch { showToast(t('commentFailed')); } finally { button.disabled = false; } });
    const list = card.querySelector('.reel-comments-list'); if (!comments.length) { const empty = document.createElement('li'); empty.className = 'reel-comments-empty'; empty.textContent = t('noComments'); list.append(empty); } else comments.forEach((comment) => list.append(makeComment(comment, client, card)));
  };

  const renderReels = (rows, client) => {
    feed.replaceChildren(); byId('reel-count').textContent = t('count', rows.length);
    if (!rows.length) { feed.innerHTML = `<p class="reel-empty">${escapeHTML(t('empty'))}</p>`; return; }
    rows.forEach(async (row) => {
      let url = '';
      try { const { data } = await client.storage.from('iqzodiac-media').createSignedUrl(row.media_path, 3600); url = data?.signedUrl || ''; } catch { /* Keep the card visible without a broken player. */ }
      const card = document.createElement('article'); card.className = 'reel-card';
      const video = document.createElement('video'); video.className = 'reel-card-video'; video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.muted = true; video.src = url; video.setAttribute('aria-label', 'Reel video');
      const copyNode = document.createElement('div'); copyNode.className = 'reel-card-copy'; copyNode.innerHTML = `<div class="reel-card-author"><span class="reel-card-avatar">${escapeHTML(initials(row.display_name || row.handle))}</span><strong>${escapeHTML(row.display_name || row.handle || 'Orbit Member')}</strong></div><p class="reel-card-meta">${escapeHTML(formatDate(row.created_at))} · ${escapeHTML(t('duration', Number(row.duration_seconds || 0)))}</p>${row.caption ? `<p class="reel-card-caption">${escapeHTML(row.caption)}</p>` : ''}`;
      const actions = document.createElement('div'); actions.className = 'reel-actions'; actions.innerHTML = `<button type="button" class="reel-action reel-like-button" data-liked="${Boolean(row.liked_by_me)}"><span class="reel-like-icon">${row.liked_by_me ? '♥' : '♡'}</span><span class="reel-like-label">${escapeHTML(row.liked_by_me ? t('liked') : t('like'))}</span><b class="reel-like-count" data-count="${toCount(row.like_count)}">${toCount(row.like_count)}</b></button><span class="reel-comment-count" data-count="${toCount(row.comment_count)}">${escapeHTML(t('comments', toCount(row.comment_count)))}</span>`;
      const commentsPanel = document.createElement('div'); commentsPanel.className = 'reel-comments-panel'; commentsPanel.innerHTML = `<ul class="reel-comments-list"></ul><form class="reel-comment-form"><input type="text" maxlength="180" placeholder="${escapeHTML(t('writeComment'))}" aria-label="${escapeHTML(t('writeComment'))}" /><button type="submit" aria-label="${escapeHTML(t('postComment'))}">↗</button></form>`;
      card.append(video, copyNode, actions, commentsPanel); feed.append(card); bindInteractions(card, row, client, row.comments || []);
    });
  };

  const loadReels = async (client) => {
    const { data, error } = await client.from('reels').select('id,author_id,caption,media_path,duration_seconds,created_at').order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    let rows = data || [];
    const reelIds = rows.map((row) => row.id).filter(Boolean);
    if (reelIds.length) {
      const [{ data: likes }, { data: comments }] = await Promise.all([
        client.from('reel_likes').select('reel_id,user_id').in('reel_id', reelIds).limit(1000),
        client.from('reel_comments').select('id,reel_id,author_id,body,created_at').in('reel_id', reelIds).order('created_at', { ascending: true }).limit(1000),
      ]);
      const commentRows = comments || []; const authorIds = [...new Set([...rows.map((row) => row.author_id), ...commentRows.map((comment) => comment.author_id)].filter(Boolean))];
      let profiles = [];
      if (authorIds.length) { try { const result = await client.from('profiles').select('user_id,display_name,handle').in('user_id', authorIds).limit(1000); profiles = result.data || []; } catch { /* Profile names are optional. */ } }
      const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile])); const likesByReel = new Map();
      (likes || []).forEach((like) => { const current = likesByReel.get(like.reel_id) || []; current.push(like); likesByReel.set(like.reel_id, current); });
      const commentsByReel = new Map();
      commentRows.forEach((comment) => { const enriched = { ...comment, ...(profileMap.get(comment.author_id) || {}) }; const current = commentsByReel.get(comment.reel_id) || []; current.push(enriched); commentsByReel.set(comment.reel_id, current); });
      rows = rows.map((row) => { const reelLikes = likesByReel.get(row.id) || []; return { ...row, ...(profileMap.get(row.author_id) || {}), like_count: reelLikes.length, liked_by_me: reelLikes.some((like) => like.user_id === authenticatedUserId), comment_count: (commentsByReel.get(row.id) || []).length, comments: commentsByReel.get(row.id) || [] }; });
    }
    renderReels(rows, client);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedFile || !Number.isFinite(selectedDuration)) { setStatus(t('invalidType'), 'error'); return; }
    if (selectedDuration > MAX_DURATION + 0.01) { setStatus(t('tooLong'), 'error'); return; }
    const client = await database(); if (!client) { setStatus(t('failed'), 'error'); return; }
    const { data: sessionData } = await client.auth.getSession(); const userId = sessionData.session?.user?.id; if (!userId) { setStatus(t('failed'), 'error'); return; }
    const publishButton = byId('publish-reel'); publishButton.disabled = true; setStatus(t('publishing')); let mediaPath = null;
    try {
      const extension = (selectedFile.name.match(/\.([a-z0-9]+)$/i)?.[1] || (selectedFile.type === 'video/webm' ? 'webm' : 'mp4')).toLowerCase(); mediaPath = `${userId}/reels/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from('iqzodiac-media').upload(mediaPath, selectedFile, { contentType: selectedFile.type, cacheControl: '3600', upsert: false }); if (uploadError) throw uploadError;
      const { error: insertError } = await client.from('reels').insert({ author_id: userId, caption: byId('reel-caption').value.trim().slice(0, 280), media_path: mediaPath, media_mime: selectedFile.type, media_size_bytes: selectedFile.size, duration_seconds: Number(selectedDuration.toFixed(3)) }); if (insertError) throw insertError;
      byId('reel-caption').value = ''; updateCaptionCount(); clearSelection(); showToast(t('saved')); await loadReels(client);
    } catch (error) { if (mediaPath) await client.storage.from('iqzodiac-media').remove([mediaPath]); console.warn('Reel could not be published.', error); setStatus(t('failed'), 'error'); } finally { publishButton.disabled = false; }
  });

  document.addEventListener('iqzodiac:languagechange', () => { if (!selectedFile) byId('reel-file-label').textContent = t('choose'); updateCaptionCount(); });
  (async () => { try { const client = await database(); if (!client) throw new Error('missing-client'); const { data } = await client.auth.getSession(); authenticatedUserId = data.session?.user?.id || null; await loadReels(client); } catch (error) { console.warn('Reels could not be loaded.', error); feed.innerHTML = `<p class="reel-empty">${escapeHTML(t('unavailable'))}</p>`; } })();
})();
