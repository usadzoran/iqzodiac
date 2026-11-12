const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;
let composerMedia = null;
const maxImageBytes = 15 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;
const maxAudioBytes = 25 * 1024 * 1024;
const commentMediaBucket = 'iqzodiac-media';
const commentMediaTypes = new Set(['image', 'video', 'audio']);

const showToast = (message) => {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
};

const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
const escapeText = (value) => value.trim().slice(0, 500);
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatDateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
const database = () => window.IQZodiacSupabase?.ready;
let authenticatedUserId = null;
let savedPostIds = new Set();
let savedProfile = {};
try { savedProfile = JSON.parse(window.localStorage.getItem('iqzodiac-current-profile') || '{}'); } catch { savedProfile = {}; }
const hasPseudonymousProfile = savedProfile.privacyProfileVersion === 2;
const currentPublicIdentity = {
  displayName: String(hasPseudonymousProfile ? (savedProfile.displayName || savedProfile.pseudonym || 'Orbit Member') : 'Orbit Member').slice(0, 32),
  handle: hasPseudonymousProfile && /^@[a-z0-9._-]{1,24}$/i.test(savedProfile.handle || '') ? savedProfile.handle : '@orbit-member',
  initials: String(hasPseudonymousProfile ? (savedProfile.initials || 'OM') : 'OM').slice(0, 2).toUpperCase(),
};
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const notificationParams = new URLSearchParams(window.location.search);
const notificationPostId = isUuid(notificationParams.get('post')) ? notificationParams.get('post') : '';
const notificationCommentId = isUuid(notificationParams.get('comment')) ? notificationParams.get('comment') : '';
const feedText = (english, arabic) => window.IQZodiacLanguage?.t(english, arabic) || english;

const deleteFeedComment = async (post, comment, wrapper, button) => {
  const commentAuthorId = String(comment.author_id || '').toLowerCase();
  const currentUserId = String(authenticatedUserId || '').toLowerCase();
  if (!currentUserId || commentAuthorId !== currentUserId) return;
  if (!window.confirm(feedText('Delete this comment?', 'هل تريد حذف هذا التعليق؟'))) return;
  button.disabled = true;
  const client = await database();
  const { error } = client ? await client.from('comments').delete().eq('id', comment.comment_id || comment.id).eq('author_id', authenticatedUserId) : { error: new Error('not-authenticated') };
  if (error) { button.disabled = false; showToast(feedText('Comment could not be deleted.', 'تعذّر حذف التعليق.')); return; }
  const deletedIds = new Set([comment.comment_id || comment.id]);
  let changed = true;
  while (changed) {
    changed = false;
    (post._commentRows || []).forEach((row) => {
      if (deletedIds.has(row.parent_comment_id) && !deletedIds.has(row.comment_id || row.id)) { deletedIds.add(row.comment_id || row.id); changed = true; }
    });
  }
  post._commentRows = (post._commentRows || []).filter((row) => !deletedIds.has(row.comment_id || row.id));
  renderComments(post, post._commentRows);
  const count = post.querySelector('.comment-count');
  if (count) count.textContent = `${formatCount(Math.max(0, Number(count.textContent.replace(/[^0-9]/g, '')) - deletedIds.size))} comments`;
  showToast(feedText('Comment deleted.', 'تم حذف التعليق.'));
};

const editFeedComment = async (post, comment, button) => {
  if (String(comment.author_id || '').toLowerCase() !== String(authenticatedUserId || '').toLowerCase()) return;
  const edited = window.prompt(feedText('Edit your comment:', 'عدّل تعليقك:'), comment.body || '');
  if (edited === null) return;
  const body = edited.trim().slice(0, 180);
  if (!body) { showToast(feedText('Comment cannot be empty.', 'لا يمكن أن يكون التعليق فارغًا.')); return; }
  button.disabled = true;
  const client = await database();
  const { error } = client ? await client.from('comments').update({ body }).eq('id', comment.comment_id || comment.id).eq('author_id', authenticatedUserId) : { error: new Error('not-authenticated') };
  if (error) { button.disabled = false; showToast(feedText('Comment could not be edited.', 'تعذّر تعديل التعليق.')); return; }
  post._commentRows = (post._commentRows || []).map((row) => (row.comment_id || row.id) === (comment.comment_id || comment.id) ? { ...row, body } : row);
  renderComments(post, post._commentRows);
  showToast(feedText('Comment updated.', 'تم تعديل التعليق.'));
};

const commentMediaType = (file) => file?.type?.startsWith('image/') ? 'image' : file?.type?.startsWith('video/') ? 'video' : file?.type?.startsWith('audio/') ? 'audio' : null;
const commentMediaSizeLimit = (type) => type === 'image' ? maxImageBytes : type === 'video' ? maxVideoBytes : maxAudioBytes;
const commentMediaExtension = (file, type) => (file.name?.match(/\.([a-z0-9]+)$/i)?.[1] || (type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'webm')).toLowerCase();

const appendCommentBody = (container, value) => {
  const text = String(value || '');
  const mentionPattern = /(^|\s)(@[a-z0-9._-]{1,24})\b/gi;
  let cursor = 0; let match;
  while ((match = mentionPattern.exec(text))) {
    const mentionStart = match.index + match[1].length;
    container.append(document.createTextNode(text.slice(cursor, mentionStart)));
    const mention = document.createElement('span'); mention.className = 'comment-mention'; mention.textContent = match[2]; mention.title = feedText('Mentioned user', 'مستخدم تمت الإشارة إليه'); container.append(mention);
    cursor = mentionStart + match[2].length;
  }
  container.append(document.createTextNode(text.slice(cursor)));
};

const setupMentionAutocomplete = (input, menu) => {
  let timer = 0;
  const close = () => { menu.hidden = true; menu.replaceChildren(); };
  input.addEventListener('input', () => {
    const beforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length);
    const match = beforeCaret.match(/(^|\s)@([a-z0-9._-]{0,24})$/i);
    if (!match || !match[2]) { close(); return; }
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const client = await database(); if (!client) return;
      const { data } = await client.rpc('search_mention_profiles', { p_query: match[2], p_limit: 6 });
      menu.replaceChildren();
      (data || []).forEach((profile) => {
        const option = document.createElement('button'); option.type = 'button'; option.className = 'mention-suggestion'; option.setAttribute('role', 'option');
        const handle = profile.handle || '@member'; option.innerHTML = `<strong>${escapeHTML(handle)}</strong><span>${escapeHTML(profile.display_name || '')}</span>`;
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => {
          const start = (input.selectionStart ?? input.value.length) - match[2].length - 1;
          const end = input.selectionStart ?? input.value.length;
          input.value = `${input.value.slice(0, start)}${handle} ${input.value.slice(end)}`;
          input.setSelectionRange(start + handle.length + 1, start + handle.length + 1); input.focus(); close();
        });
        menu.append(option);
      });
      menu.hidden = !menu.children.length;
    }, 140);
  });
  input.addEventListener('blur', () => window.setTimeout(close, 160));
};

const uploadCommentMedia = async (client, file) => {
  const type = commentMediaType(file);
  if (!type || !commentMediaTypes.has(type)) throw new Error('unsupported_media_type');
  if (!file.size || file.size > commentMediaSizeLimit(type)) throw new Error('media_too_large');
  const path = `${authenticatedUserId}/comment-replies/${crypto.randomUUID()}.${commentMediaExtension(file, type)}`;
  const { error } = await client.storage.from(commentMediaBucket).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  return { media_type: type, media_path: path, media_mime: file.type, media_size_bytes: file.size };
};

const commentAttachmentNode = (comment) => {
  if (!comment.media_url || !comment.media_type) return null;
  if (comment.media_type === 'image') {
    const image = document.createElement('img'); image.className = 'comment-attachment comment-attachment-image'; image.src = comment.media_url; image.alt = feedText('Attached image', 'صورة مرفقة'); image.loading = 'lazy'; return image;
  }
  if (comment.media_type === 'video') {
    const video = document.createElement('video'); video.className = 'comment-attachment comment-attachment-video'; video.src = comment.media_url; video.controls = true; video.preload = 'metadata'; video.playsInline = true; return video;
  }
  const audio = document.createElement('audio'); audio.className = 'comment-attachment comment-attachment-audio'; audio.src = comment.media_url; audio.controls = true; return audio;
};

const createCommentElement = (comment, post, childrenByParent = {}, submitReply = null) => {
  const wrapper = document.createElement('div'); wrapper.className = 'comment-thread';
  const element = document.createElement('div'); element.className = 'comment'; element.dataset.commentId = comment.comment_id || comment.id || '';
  const isArabicComment = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(comment.body || '');
  element.classList.add(isArabicComment ? 'comment-rtl' : 'comment-ltr');
  if (element.dataset.commentId) element.id = `comment-${element.dataset.commentId}`;
  const avatar = document.createElement('span'); avatar.className = 'comment-avatar home-avatar-small'; avatar.textContent = String(comment.display_name || comment.handle || 'OM').replace(/^@/, '').slice(0, 2).toUpperCase();
  const content = document.createElement('div'); content.className = 'comment-content';
  const copy = document.createElement('p'); const author = document.createElement('strong'); author.textContent = comment.handle || comment.display_name || '@member'; copy.append(author);
  if (comment.body) { const body = document.createElement('span'); body.append(document.createTextNode(' ')); appendCommentBody(body, comment.body); body.dir = isArabicComment ? 'rtl' : 'ltr'; copy.append(body); }
  const time = document.createElement('small'); time.className = 'comment-time'; time.textContent = formatDateTime(comment.created_at); copy.append(time);
  content.append(copy);
  const attachment = commentAttachmentNode(comment); if (attachment) content.append(attachment);
  const replyButton = document.createElement('button'); replyButton.type = 'button'; replyButton.className = 'comment-reply-button'; replyButton.textContent = feedText('Reply', 'رد');
  const replyForm = document.createElement('form'); replyForm.className = 'comment-form comment-reply-form'; replyForm.hidden = true;
  replyForm.innerHTML = `<input type="text" maxlength="180" placeholder="${feedText('Write a reply...', 'اكتب ردًا...')}" aria-label="${feedText('Write a reply', 'اكتب ردًا')}" /><div class="mention-suggestions" role="listbox" hidden></div><input class="comment-media-input" type="file" accept="image/*,video/*" hidden /><button class="comment-media-button" type="button" aria-label="${feedText('Attach image or video', 'إرفاق صورة أو فيديو')}">＋</button><button class="comment-record-button" type="button" aria-label="${feedText('Record voice reply', 'تسجيل رد صوتي')}">●</button><button type="submit" aria-label="${feedText('Post reply', 'نشر الرد')}">↗</button><div class="comment-media-preview" hidden></div>`;
  const input = replyForm.querySelector('input[type="text"]'); const mentionMenu = replyForm.querySelector('.mention-suggestions'); setupMentionAutocomplete(input, mentionMenu); const mediaInput = replyForm.querySelector('.comment-media-input'); const preview = replyForm.querySelector('.comment-media-preview'); const mediaButton = replyForm.querySelector('.comment-media-button'); const recordButton = replyForm.querySelector('.comment-record-button');
  replyForm._replyMedia = null;
  const showReplyMedia = (file) => { replyForm._replyMedia = file; const node = file.type.startsWith('video/') ? document.createElement('video') : file.type.startsWith('audio/') ? document.createElement('audio') : document.createElement('img'); node.src = URL.createObjectURL(file); node.controls = file.type.startsWith('video/') || file.type.startsWith('audio/'); node.className = 'comment-preview-media'; preview.replaceChildren(node); preview.hidden = false; };
  mediaButton.addEventListener('click', () => mediaInput.click());
  mediaInput.addEventListener('change', () => { const [file] = mediaInput.files || []; if (file) showReplyMedia(file); });
  recordButton.addEventListener('click', async () => {
    if (replyForm._recording) { replyForm._recorder?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { showToast(feedText('Voice recording is not supported in this browser.', 'تسجيل الصوت غير مدعوم في هذا المتصفح.')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = []; const recorder = new MediaRecorder(stream); replyForm._recording = true; replyForm._recorder = recorder; recordButton.textContent = '■'; recordButton.classList.add('is-recording');
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); replyForm._recording = false; replyForm._recorder = null; recordButton.textContent = '●'; recordButton.classList.remove('is-recording'); const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); showReplyMedia(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })); };
      recorder.start();
    } catch { showToast(feedText('Microphone access was denied.', 'تم رفض الوصول إلى الميكروفون.')); }
  });
  replyButton.addEventListener('click', () => { replyForm.hidden = !replyForm.hidden; if (!replyForm.hidden) input.focus(); });
  replyForm.addEventListener('submit', async (event) => { event.preventDefault(); const value = escapeText(input.value); if ((!value && !replyForm._replyMedia) || !submitReply) return; if (await submitReply(comment.comment_id || comment.id, value, replyForm._replyMedia)) { input.value = ''; mediaInput.value = ''; replyForm._replyMedia = null; preview.replaceChildren(); preview.hidden = true; replyForm.hidden = true; } });
  content.append(replyButton, replyForm);
  if (String(comment.author_id || '').toLowerCase() === String(authenticatedUserId || '').toLowerCase()) {
    const actions = document.createElement('div'); actions.className = 'comment-owner-actions';
    const menuButton = document.createElement('button'); menuButton.type = 'button'; menuButton.className = 'comment-more-button'; menuButton.textContent = '⋯'; menuButton.setAttribute('aria-label', feedText('Comment options', 'خيارات التعليق')); menuButton.setAttribute('aria-haspopup', 'true'); menuButton.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div'); menu.className = 'comment-actions-menu'; menu.hidden = true;
    const editButton = document.createElement('button'); editButton.type = 'button'; editButton.className = 'comment-edit-button'; editButton.textContent = feedText('Edit', 'تعديل'); editButton.addEventListener('click', () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); void editFeedComment(post, comment, editButton); });
    const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'comment-delete-button'; deleteButton.textContent = feedText('Delete', 'مسح'); deleteButton.addEventListener('click', () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); void deleteFeedComment(post, comment, wrapper, deleteButton); });
    menu.append(editButton, deleteButton); menuButton.addEventListener('click', () => { menu.hidden = !menu.hidden; menuButton.setAttribute('aria-expanded', String(!menu.hidden)); }); menuButton.addEventListener('keydown', (event) => { if (event.key === 'Escape') { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.focus(); } }); actions.append(menuButton, menu);
    if (isArabicComment) element.append(avatar, content, actions); else element.append(actions, avatar, content);
  } else element.append(avatar, content);
  const children = document.createElement('div'); children.className = 'comment-replies'; (childrenByParent[comment.comment_id || comment.id] || []).forEach((child) => children.append(createCommentElement(child, post, childrenByParent, submitReply))); wrapper.append(element, children); return wrapper;
};
const renderComments = (post, rows) => {
  const list = post.querySelector('.comment-list'); list.replaceChildren(); post._commentRows = rows; const byParent = {}; rows.forEach((row) => { (byParent[row.parent_comment_id || 'root'] ||= []).push(row); });
  const submitReply = async (parentCommentId, body, mediaFile) => {
    const client = await database(); if (!client || !authenticatedUserId) { showToast(feedText('Sign in to reply to comments.', 'سجّل الدخول للرد على التعليقات.')); return false; }
    let media = null;
    try { if (mediaFile) media = await uploadCommentMedia(client, mediaFile); } catch (error) { showToast(error.message === 'media_too_large' ? feedText('The selected file is too large.', 'الملف المحدد كبير جدًا.') : feedText('Media could not be uploaded.', 'تعذّر رفع الوسائط.')); return false; }
    const payload = { post_id: post.dataset.postId, author_id: authenticatedUserId, parent_comment_id: parentCommentId, body, ...(media || {}) };
    const { data, error } = await client.from('comments').insert(payload).select('id,post_id,author_id,parent_comment_id,body,created_at,media_type,media_path,media_mime,media_size_bytes').single();
    if (error) { if (media?.media_path) await client.storage.from(commentMediaBucket).remove([media.media_path]); showToast(feedText('Reply could not be saved.', 'تعذّر حفظ الرد.')); return false; }
    if (data.media_path) { const { data: signed } = await client.storage.from(commentMediaBucket).createSignedUrl(data.media_path, 3600); data.media_url = signed?.signedUrl || ''; }
    const reply = { ...data, display_name: currentPublicIdentity.displayName, handle: currentPublicIdentity.handle, comment_id: data.id }; post._commentRows = [...(post._commentRows || []), reply];
    const target = list.querySelector(`[data-comment-id="${CSS.escape(parentCommentId)}"]`)?.closest('.comment-thread')?.querySelector('.comment-replies'); if (target) target.append(createCommentElement(reply, post, {}, submitReply));
    const count = post.querySelector('.comment-count'); count.textContent = `${formatCount(Number(count.textContent.replace(/[^0-9]/g, '')) + 1)} comments`; showToast(feedText('Reply added.', 'تمت إضافة الرد.')); return true;
  };
  (byParent.root || []).forEach((comment) => list.append(createCommentElement(comment, post, byParent, submitReply)));
};
const focusNotificationTarget = () => {
  if (!notificationPostId) return;
  const post = document.getElementById(`post-${notificationPostId}`);
  if (!post) return;
  const comment = notificationCommentId ? document.getElementById(`comment-${notificationCommentId}`) : null;
  const target = comment?.closest('.comment-thread') || post;
  target.classList.add('notification-target-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
const applyCurrentIdentity = () => {
  document.querySelectorAll('[data-current-user-name]').forEach((node) => { node.textContent = currentPublicIdentity.displayName; });
  document.querySelectorAll('[data-current-user-handle]').forEach((node) => { node.textContent = currentPublicIdentity.handle; });
  document.querySelectorAll('[data-current-user-short]').forEach((node) => { node.textContent = currentPublicIdentity.displayName.split(/[\s-]+/)[0] || 'Orbit'; });
  document.querySelectorAll('[data-current-user-initials]').forEach((node) => { node.textContent = currentPublicIdentity.initials; });
  document.querySelectorAll('.nav-avatar[data-current-user-initials]').forEach((node) => { node.setAttribute('aria-label', `Signed in as ${currentPublicIdentity.displayName}`); });
};
applyCurrentIdentity();

const createMediaPreview = (file, target, className = 'composer-preview-media') => {
  const isVideo = file.type.startsWith('video/');
  const media = isVideo ? document.createElement('video') : document.createElement('img');
  media.className = className;
  media.src = URL.createObjectURL(file);
  if (isVideo) {
    media.controls = true;
    media.muted = true;
    media.playsInline = true;
  }
  target.replaceChildren(media);
  target.hidden = false;
};

const clearComposerMedia = () => {
  const preview = document.querySelector('#composer-media-preview');
  const input = document.querySelector('#post-media-input');
  composerMedia = null;
  if (preview) { preview.replaceChildren(); preview.hidden = true; }
  if (input) input.value = '';
};

const setComposerMedia = (file) => {
  composerMedia = file;
  const preview = document.querySelector('#composer-media-preview');
  createMediaPreview(file, preview);
  const remove = document.createElement('button');
  remove.className = 'composer-media-remove';
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove selected media');
  remove.textContent = '×';
  remove.addEventListener('click', clearComposerMedia);
  preview.append(remove);
};

const createPostMedia = (item, url) => {
  if (!url || !item.media_type) return '';
  const safeUrl = escapeHTML(url);
  return item.media_type === 'video'
    ? `<div class="post-media-slot"><video class="post-uploaded-media" src="${safeUrl}" controls preload="metadata"></video></div>`
    : `<div class="post-media-slot"><img class="post-uploaded-media" src="${safeUrl}" alt="Shared photo" loading="lazy" /></div>`;
};

const deleteFeedPost = async (post, button) => {
  if (!authenticatedUserId || post.dataset.authorId !== authenticatedUserId) return;
  if (!window.confirm(feedText('Delete this post permanently?', 'هل تريد حذف هذا المنشور نهائيًا؟'))) return;
  button.disabled = true;
  const client = await database();
  const { error } = client ? await client.from('posts').delete().eq('id', post.dataset.postId).eq('author_id', authenticatedUserId) : { error: new Error('not-authenticated') };
  if (error) { button.disabled = false; showToast(feedText('Post could not be deleted.', 'تعذّر حذف المنشور.')); return; }
  if (post.dataset.mediaPath) {
    const { error: mediaError } = await client.storage.from('iqzodiac-media').remove([post.dataset.mediaPath]);
    if (mediaError) console.warn('Post media cleanup failed.', mediaError);
  }
  post.remove();
  showToast(feedText('Post deleted.', 'تم حذف المنشور.'));
};

const editFeedPost = async (post, button) => {
  if (String(post.dataset.authorId || '').toLowerCase() !== String(authenticatedUserId || '').toLowerCase()) return;
  const current = post.querySelector('.post-body')?.textContent || '';
  const edited = window.prompt(feedText('Edit your post:', 'عدّل منشورك:'), current);
  if (edited === null) return;
  const body = edited.trim().slice(0, 500);
  if (!body && !post.dataset.mediaPath) { showToast(feedText('Post cannot be empty.', 'لا يمكن أن يكون المنشور فارغًا.')); return; }
  button.disabled = true;
  const client = await database();
  const { error } = client ? await client.from('posts').update({ body, updated_at: new Date().toISOString() }).eq('id', post.dataset.postId).eq('author_id', authenticatedUserId) : { error: new Error('not-authenticated') };
  if (error) { button.disabled = false; showToast(feedText('Post could not be edited.', 'تعذّر تعديل المنشور.')); return; }
  let bodyNode = post.querySelector('.post-body');
  if (body) {
    if (!bodyNode) { bodyNode = document.createElement('p'); bodyNode.className = 'post-body'; post.querySelector('.post-header').after(bodyNode); }
    bodyNode.textContent = body;
  } else bodyNode?.remove();
  showToast(feedText('Post updated.', 'تم تعديل المنشور.'));
};

const bindPost = (post) => {
  const likeButton = post.querySelector('.like-button');
  const commentButton = post.querySelector('.comment-focus');
  const shareButton = post.querySelector('.share-action');
  const saveButton = post.querySelector('.save-post-action');
  const likeCount = post.querySelector('.like-count');
  const commentCount = post.querySelector('.comment-count');
  const commentForm = post.querySelector('.comment-form');
  const commentInput = commentForm.querySelector('input');
  const commentList = post.querySelector('.comment-list');
  const deleteButton = post.querySelector('.post-delete-button');
  const editButton = post.querySelector('.post-edit-button');
  const ownerMenu = post.querySelector('.post-owner-menu');

  deleteButton?.addEventListener('click', () => { ownerMenu.open = false; void deleteFeedPost(post, deleteButton); });
  editButton?.addEventListener('click', () => { ownerMenu.open = false; void editFeedPost(post, editButton); });

  likeButton.addEventListener('click', async () => {
    const liked = likeButton.dataset.like === 'true';
    const client = await database();
    if (client && /^[0-9a-f-]{36}$/i.test(post.dataset.postId || '')) {
      const { data, error } = await client.rpc('toggle_post_like', { p_post_id: post.dataset.postId });
      if (error) { showToast('Like could not be saved.'); return; }
      likeButton.dataset.like = String(Boolean(data)); likeButton.classList.toggle('is-liked', Boolean(data));
      likeButton.querySelector('.action-icon').textContent = data ? '♥' : '♡'; likeButton.querySelector('span:last-child').textContent = data ? 'Liked' : 'Like';
      likeCount.textContent = `${formatCount(Math.max(0, Number(likeCount.textContent.replace(/[^0-9]/g, '')) + (data ? 1 : -1)))} likes`;
      return;
    }
    showToast('Sign in to interact with the shared feed.');
  });

  commentButton.addEventListener('click', () => {
    commentInput.focus();
    commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  saveButton?.addEventListener('click', async () => {
    const client = await database();
    if (!client || !authenticatedUserId) { showToast('Sign in to save posts.'); return; }
    const saved = saveButton.dataset.saved === 'true';
    saveButton.disabled = true;
    const result = saved
      ? await client.from('post_saves').delete().eq('post_id', post.dataset.postId).eq('user_id', authenticatedUserId)
      : await client.from('post_saves').insert({ post_id: post.dataset.postId, user_id: authenticatedUserId });
    if (result.error) { saveButton.disabled = false; showToast('The saved state could not be changed.'); return; }
    saveButton.dataset.saved = String(!saved);
    saveButton.querySelector('span:last-child').textContent = saved ? 'Save' : 'Saved';
    saveButton.querySelector('.action-icon').textContent = saved ? '🔖' : '✓';
    saveButton.setAttribute('aria-pressed', String(!saved));
    saveButton.disabled = false;
    showToast(saved ? 'Removed from saved.' : 'Post saved.');
  });

  shareButton.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#post-${post.dataset.postId}`); showToast('Post link copied to your orbit.'); } catch { showToast('Copy is unavailable in this browser.'); }
  });

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = escapeText(commentInput.value);
    if (!value) return;
    const client = await database();
    if (!client || !authenticatedUserId || !/^[0-9a-f-]{36}$/i.test(post.dataset.postId || '')) { showToast('Sign in to comment on shared posts.'); return; }
    const { data, error } = await client.from('comments').insert({ post_id: post.dataset.postId, author_id: authenticatedUserId, body: value }).select('id,post_id,author_id,parent_comment_id,body,created_at,media_type,media_path,media_mime,media_size_bytes').single();
    if (error) { showToast('Comment could not be saved.'); return; }
    const comment = { ...data, comment_id: data.id, display_name: currentPublicIdentity.displayName, handle: currentPublicIdentity.handle };
    renderComments(post, [...(post._commentRows || []), comment]);
    const count = Number(commentCount.textContent.replace(/[^0-9]/g, '')) + 1;
    commentCount.textContent = `${formatCount(count)} comments`;
    commentInput.value = '';
    showToast('Comment added.');
  });
};

document.querySelector('#feed-list').innerHTML = '<p class="match-empty">Loading the shared feed…</p>';

document.querySelectorAll('[data-flow]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.flow} is coming soon.`));
});

const followedPeople = new Set();
const updateFollowState = (button) => {
  const following = followedPeople.has(button.dataset.follow);
  button.classList.toggle('is-following', following);
  button.textContent = following ? '✓' : '+';
  button.setAttribute('aria-label', `${following ? 'Unfollow' : 'Follow'} ${button.dataset.follow === 'linaortiz' ? 'Lina Ortiz' : 'Noah Williams'}`);
};
document.querySelectorAll('[data-follow]').forEach((button) => {
  updateFollowState(button);
  button.addEventListener('click', async () => {
    const client = await database();
    if (!client || !authenticatedUserId) { showToast('Sign in to follow members.'); return; }
    const handle = button.dataset.follow;
    const target = document.querySelector(`#feed-list .post-card[data-author="${CSS.escape(handle)}"]`)?.dataset.authorId;
    if (!target) { showToast('This member is not available in the shared feed.'); return; }
    const { data, error } = await client.rpc('toggle_follow', { p_followed_id: target });
    if (error) { showToast('Follow status could not be saved.'); return; }
    if (data) followedPeople.add(handle); else followedPeople.delete(handle);
    showToast(data ? 'You’re following this member.' : 'You unfollowed this member.');
    updateFollowState(button);
    applyFeedFilter();
  });
});
const filters = [...document.querySelectorAll('.feed-filter-button')];
const applyFeedFilter = () => {
  const followingOnly = filters.find((item) => item.classList.contains('is-active'))?.dataset.filter === 'following';
  document.querySelectorAll('#feed-list .post-card').forEach((post) => {
    post.hidden = Boolean(followingOnly && !followedPeople.has(post.dataset.author));
  });
};
filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    applyFeedFilter();
    if (button.dataset.filter === 'following' && followedPeople.size === 0) showToast('Follow someone to build your own feed.');
  });
});
document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    const textarea = document.querySelector('#post-text');
    textarea.value = button.dataset.prompt;
    textarea.focus();
    document.querySelector('.composer-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});
const dateNode = document.querySelector('#today-date');
if (dateNode) dateNode.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

const moodButtons = [...document.querySelectorAll('[data-mood]')];
const moodReflection = document.querySelector('#mood-reflection');
const moodMessage = document.querySelector('#mood-message');
const moodCopy = {
  bright: 'Let yourself enjoy the light. What is one thing you want to carry into the rest of your day?',
  steady: 'Steady is its own kind of strength. You can take today one moment at a time.',
  tender: 'There is room for softness here. What would feel kind to you right now?',
  low: 'You don’t have to turn the day around all at once. One small, gentle thing is enough.',
};
const todayKey = new Date().toLocaleDateString('en-CA');
let selectedMood = null;
const selectMood = (mood) => {
  selectedMood = mood;
  moodButtons.forEach((button) => {
    const selected = button.dataset.mood === mood;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  moodMessage.textContent = moodCopy[mood];
  moodReflection.hidden = false;
  void (async () => {
    const client = await database();
    if (!client || !authenticatedUserId) return;
    const { error } = await client.from('daily_moods').upsert({ user_id: authenticatedUserId, mood_date: todayKey, mood, updated_at: new Date().toISOString() }, { onConflict: 'user_id,mood_date' });
    if (error) showToast('Mood check-in could not be saved.');
  })();
};
moodButtons.forEach((button) => button.addEventListener('click', () => selectMood(button.dataset.mood)));
if (moodCopy[selectedMood]) selectMood(selectedMood);
document.querySelector('#mood-write').addEventListener('click', () => {
  if (!selectedMood) return;
  const textarea = document.querySelector('#post-text');
  textarea.value = `Today I’m feeling ${selectedMood === 'low' ? 'a little low' : selectedMood}, and I’m giving myself permission to take it one moment at a time.`;
  textarea.focus();
  document.querySelector('.composer-card').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

// Reveal home sections as they enter view; keep the page fully visible if motion is reduced.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('IntersectionObserver' in window && !reduceMotion) {
  document.documentElement.classList.add('has-scroll-reveal');
  const revealTargets = [
    document.querySelector('.home-welcome-bar'),
    document.querySelector('.daily-spark'),
    document.querySelector('.mood-checkin'),
    document.querySelector('.feed-heading'),
    document.querySelector('.composer-card'),
    document.querySelector('.feed-filter'),
    ...document.querySelectorAll('.post-card'),
    ...document.querySelectorAll('.home-trends .trend-card'),
    document.querySelector('.home-footer'),
  ].filter(Boolean);
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
  revealTargets.forEach((target, index) => {
    target.dataset.scrollReveal = 'true';
    target.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 70}ms`);
    revealObserver.observe(target);
  });
}


// The feed is sourced from Supabase; the static HTML cards are never treated as real members.
(async () => {
  try {
    const client = await database();
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session?.user?.id) return;
    authenticatedUserId = sessionData.session.user.id;
    const { data: accountProfile } = await client.from('profiles').select('display_name,handle').eq('user_id', authenticatedUserId).maybeSingle();
    const { data: savedRows } = await client.from('post_saves').select('post_id').eq('user_id', authenticatedUserId).limit(500);
    savedPostIds = new Set((savedRows || []).map((row) => row.post_id));
    if (accountProfile) {
      currentPublicIdentity.displayName = String(accountProfile.display_name || currentPublicIdentity.displayName).slice(0, 32);
      currentPublicIdentity.handle = /^@[a-z0-9._-]{1,24}$/i.test(accountProfile.handle || '') ? accountProfile.handle : currentPublicIdentity.handle;
      currentPublicIdentity.initials = currentPublicIdentity.displayName.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
      applyCurrentIdentity();
    }
    const { data: feed, error } = await client.rpc('get_home_feed', { p_limit: 30 });
    if (error) throw error;
    const feedRows = Array.isArray(feed) ? [...feed] : [];
    if (notificationPostId && !feedRows.some((item) => item.post_id === notificationPostId)) {
      const { data: targetPost, error: targetError } = await client.from('posts').select('id,author_id,body,media_type,media_path,created_at').eq('id', notificationPostId).maybeSingle();
      if (targetError) throw targetError;
      if (targetPost) {
        const [profileResult, likesResult, commentsResult, viewerLikeResult, followingResult] = await Promise.all([
          client.rpc('get_public_profile_cards', { p_user_ids: [targetPost.author_id] }),
          client.from('post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', notificationPostId),
          client.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', notificationPostId),
          client.from('post_likes').select('post_id').eq('post_id', notificationPostId).eq('user_id', authenticatedUserId).maybeSingle(),
          client.from('follows').select('followed_id').eq('follower_id', authenticatedUserId).eq('followed_id', targetPost.author_id).maybeSingle(),
        ]);
        let targetProfile = profileResult.data?.[0];
        if (!targetProfile) {
          const { data: profile } = await client.from('profiles').select('display_name,handle').eq('user_id', targetPost.author_id).maybeSingle();
          targetProfile = profile || {};
        }
        feedRows.unshift({
          post_id: targetPost.id,
          author_id: targetPost.author_id,
          display_name: targetProfile.display_name || 'Orbit Member',
          handle: targetProfile.handle || '@member',
          body: targetPost.body,
          media_type: targetPost.media_type,
          media_path: targetPost.media_path,
          created_at: targetPost.created_at,
          like_count: likesResult.count || 0,
          comment_count: commentsResult.count || 0,
          liked_by_me: Boolean(viewerLikeResult.data),
          following: Boolean(followingResult.data),
        });
      }
    }
    const feedList = document.querySelector('#feed-list');
    feedList.replaceChildren();
    if (!feedRows.length) {
      feedList.innerHTML = '<p class="match-empty">No real posts have been published yet.</p>';
    } else {
      for (const item of feedRows) {
        const post = document.createElement('article');
        post.className = 'post-card'; post.id = `post-${item.post_id}`; post.dataset.postId = item.post_id; post.dataset.author = String(item.handle || '').replace(/^@/, ''); post.dataset.authorId = item.author_id; post.dataset.mediaPath = item.media_path || '';
        const liked = Boolean(item.liked_by_me);
        let mediaUrl = '';
        if (item.media_path) {
          const { data: signed } = await client.storage.from('iqzodiac-media').createSignedUrl(item.media_path, 3600);
          mediaUrl = signed?.signedUrl || '';
        }
        const bodyMarkup = item.body ? `<p class="post-body">${escapeHTML(item.body)}</p>` : '';
        const editPostLabel = feedText('Edit post', 'تعديل المنشور');
        const deletePostLabel = feedText('Delete post', 'حذف المنشور');
        const moreActionsLabel = feedText('Post options', 'خيارات المنشور');
        const ownerActions = item.author_id === authenticatedUserId ? `<details class="post-owner-menu"><summary class="post-owner-menu-trigger" aria-label="${escapeHTML(moreActionsLabel)}" title="${escapeHTML(moreActionsLabel)}"><span aria-hidden="true">⋮</span></summary><div class="post-owner-menu-panel"><button class="post-edit-button" type="button">${escapeHTML(editPostLabel)}</button><button class="post-delete-button" type="button">${escapeHTML(deletePostLabel)}</button></div></details>` : '';
        post.innerHTML = `<header class="post-header"><div class="post-avatar home-avatar-small">${escapeHTML(String(item.display_name || 'OM').slice(0, 1))}</div><div class="post-author"><strong>${escapeHTML(item.display_name || 'Orbit Member')}</strong><span>${escapeHTML(item.handle || '@member')} · ${escapeHTML(formatDateTime(item.created_at))}</span></div>${ownerActions}</header>${bodyMarkup}${createPostMedia(item, mediaUrl)}<div class="post-meta"><span class="like-count">${formatCount(Number(item.like_count || 0))} likes</span><span class="comment-count">${formatCount(Number(item.comment_count || 0))} comments</span></div><div class="post-actions"><button class="post-action like-button ${liked ? 'is-liked' : ''}" type="button" data-like="${liked}"><span class="action-icon">${liked ? '♥' : '♡'}</span><span>${liked ? 'Liked' : 'Like'}</span></button><button class="post-action comment-focus" type="button"><span class="action-icon">◌</span><span>Comment</span></button><button class="post-action save-post-action ${savedPostIds.has(item.post_id) ? 'is-saved' : ''}" data-saved="${savedPostIds.has(item.post_id)}" aria-pressed="${savedPostIds.has(item.post_id)}" type="button"><span class="action-icon">${savedPostIds.has(item.post_id) ? '✓' : '🔖'}</span><span>${savedPostIds.has(item.post_id) ? 'Saved' : 'Save'}</span></button><button class="post-action share-action" type="button"><span class="action-icon">↗</span><span>Share</span></button></div><div class="comment-list"></div><form class="comment-form"><input type="text" maxlength="180" placeholder="Write a comment..." aria-label="Write a comment" /><button type="submit" aria-label="Post comment">↗</button></form>`;
        feedList.append(post); bindPost(post);
      }
    }
    const postIds = feedRows.map((item) => item.post_id).filter(Boolean);
    if (postIds.length) {
      let comments = [];
      const { data: enrichedComments, error: commentsError } = await client.rpc('get_post_comments', { p_post_ids: postIds });
      if (!commentsError) {
        comments = enrichedComments || [];
      } else {
        const { data: basicComments, error: basicCommentsError } = await client.from('comments').select('id,post_id,author_id,parent_comment_id,body,created_at,media_type,media_path,media_mime,media_size_bytes').in('post_id', postIds).order('created_at', { ascending: true });
        if (basicCommentsError) throw basicCommentsError;
        comments = (basicComments || []).map((comment) => ({ ...comment, handle: comment.author_id === authenticatedUserId ? currentPublicIdentity.handle : '@member' }));
      }
      comments = await Promise.all(comments.map(async (comment) => {
        if (!comment.media_path) return comment;
        const { data: signed } = await client.storage.from(commentMediaBucket).createSignedUrl(comment.media_path, 3600);
        return { ...comment, media_url: signed?.signedUrl || '' };
      }));
      document.querySelectorAll('#feed-list .post-card').forEach((post) => renderComments(post, comments.filter((comment) => comment.post_id === post.dataset.postId)));
    }
    if (notificationPostId) requestAnimationFrame(focusNotificationTarget);
    const today = new Date().toLocaleDateString('en-CA');
    const { data: mood } = await client.from('daily_moods').select('mood').eq('mood_date', today).maybeSingle();
    if (mood?.mood && moodCopy[mood.mood]) selectMood(mood.mood);
    const publishButton = document.querySelector('#publish-post');
    const cleanButton = publishButton.cloneNode(true); publishButton.replaceWith(cleanButton);
    const mediaInput = document.querySelector('#post-media-input');
    const addMediaButton = document.querySelector('#add-post-media');
    addMediaButton.addEventListener('click', () => mediaInput.click());
    mediaInput.addEventListener('change', () => {
      const [file] = mediaInput.files || [];
      if (!file) return;
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const maxBytes = isVideo ? maxVideoBytes : maxImageBytes;
      if ((!isImage && !isVideo) || file.size > maxBytes) {
        clearComposerMedia();
        showToast(isVideo ? 'Video must be 50 MB or smaller.' : 'Choose an image or video within the size limit.');
        return;
      }
      setComposerMedia(file);
    });
    cleanButton.addEventListener('click', async () => {
      const body = escapeText(document.querySelector('#post-text').value);
      if (!body && !composerMedia) { showToast('Write something or add a photo/video before publishing.'); return; }
      cleanButton.disabled = true;
      let mediaPath = null;
      try {
        const mediaType = composerMedia?.type.startsWith('video/') ? 'video' : (composerMedia ? 'image' : null);
        const mediaMime = composerMedia?.type || null;
        if (composerMedia) {
          const extension = (composerMedia.name.match(/\.([a-z0-9]+)$/i)?.[1] || (mediaType === 'video' ? 'mp4' : 'jpg')).toLowerCase();
          mediaPath = `${authenticatedUserId}/posts/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await client.storage.from('iqzodiac-media').upload(mediaPath, composerMedia, { contentType: composerMedia.type, cacheControl: '3600', upsert: false });
          if (uploadError) throw uploadError;
        }
        const { error: insertError } = await client.from('posts').insert({ author_id: authenticatedUserId, body, media_type: mediaType, media_path: mediaPath, media_mime: mediaMime, media_size_bytes: composerMedia?.size || null });
        if (insertError) throw insertError;
        document.querySelector('#post-text').value = '';
        clearComposerMedia();
        showToast('Your post is saved to the shared feed.');
        window.setTimeout(() => window.location.reload(), 400);
      } catch (error) {
        if (mediaPath) await client.storage.from('iqzodiac-media').remove([mediaPath]);
        console.warn('Post could not be published.', error);
        showToast('Your post could not be saved.');
        cleanButton.disabled = false;
      }
    });
  } catch (error) {
    console.warn('Home feed could not be loaded from Supabase.', error);
    document.querySelector('#feed-list').innerHTML = '<p class="match-empty">The shared feed is temporarily unavailable. No sample posts are shown.</p>';
  }
})();
