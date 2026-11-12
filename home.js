const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;
let composerMedia = null;
const maxImageBytes = 15 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;

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
let savedProfile = {};
try { savedProfile = JSON.parse(window.localStorage.getItem('iqzodiac-current-profile') || '{}'); } catch { savedProfile = {}; }
const hasPseudonymousProfile = savedProfile.privacyProfileVersion === 2;
const currentPublicIdentity = {
  displayName: String(hasPseudonymousProfile ? (savedProfile.displayName || savedProfile.pseudonym || 'Orbit Member') : 'Orbit Member').slice(0, 32),
  handle: hasPseudonymousProfile && /^@[a-z0-9._-]{1,24}$/i.test(savedProfile.handle || '') ? savedProfile.handle : '@orbit-member',
  initials: String(hasPseudonymousProfile ? (savedProfile.initials || 'OM') : 'OM').slice(0, 2).toUpperCase(),
};
const createCommentElement = (comment, post, childrenByParent = {}, submitReply = null) => {
  const wrapper = document.createElement('div'); wrapper.className = 'comment-thread';
  const element = document.createElement('div'); element.className = 'comment'; element.dataset.commentId = comment.comment_id || comment.id || '';
  const avatar = document.createElement('span'); avatar.className = 'comment-avatar home-avatar-small'; avatar.textContent = String(comment.display_name || comment.handle || 'OM').replace(/^@/, '').slice(0, 2).toUpperCase();
  const content = document.createElement('div'); content.className = 'comment-content';
  const copy = document.createElement('p'); const author = document.createElement('strong'); author.textContent = comment.handle || comment.display_name || '@member';
  const body = document.createElement('span'); body.textContent = ` ${comment.body || ''}`;
  const time = document.createElement('small'); time.className = 'comment-time'; time.textContent = formatDateTime(comment.created_at); copy.append(author, body, time);
  const replyButton = document.createElement('button'); replyButton.type = 'button'; replyButton.className = 'comment-reply-button'; replyButton.textContent = 'Reply';
  const replyForm = document.createElement('form'); replyForm.className = 'comment-form comment-reply-form'; replyForm.hidden = true; replyForm.innerHTML = '<input type="text" maxlength="180" placeholder="Write a reply..." aria-label="Write a reply" /><button type="submit" aria-label="Post reply">↗</button>';
  replyButton.addEventListener('click', () => { replyForm.hidden = !replyForm.hidden; if (!replyForm.hidden) replyForm.querySelector('input').focus(); });
  replyForm.addEventListener('submit', async (event) => { event.preventDefault(); const input = replyForm.querySelector('input'); const value = escapeText(input.value); if (!value || !submitReply) return; if (await submitReply(comment.comment_id || comment.id, value)) { input.value = ''; replyForm.hidden = true; } });
  content.append(copy, replyButton, replyForm); element.append(avatar, content); wrapper.append(element);
  const children = document.createElement('div'); children.className = 'comment-replies'; (childrenByParent[comment.comment_id || comment.id] || []).forEach((child) => children.append(createCommentElement(child, post, childrenByParent, submitReply))); wrapper.append(children);
  return wrapper;
};
const renderComments = (post, rows) => {
  const list = post.querySelector('.comment-list'); list.replaceChildren(); post._commentRows = rows; const byParent = {};
  rows.forEach((row) => { (byParent[row.parent_comment_id || 'root'] ||= []).push(row); });
  const submitReply = async (parentCommentId, body) => {
    const client = await database(); if (!client || !authenticatedUserId) { showToast('Sign in to reply to comments.'); return false; }
    const { data, error } = await client.from('comments').insert({ post_id: post.dataset.postId, author_id: authenticatedUserId, parent_comment_id: parentCommentId, body }).select('id,post_id,author_id,parent_comment_id,body,created_at').single();
    if (error) { showToast('Reply could not be saved.'); return false; }
    const reply = { ...data, display_name: currentPublicIdentity.displayName, handle: currentPublicIdentity.handle, comment_id: data.id };
    post._commentRows = [...(post._commentRows || []), reply];
    const target = list.querySelector(`[data-comment-id="${CSS.escape(parentCommentId)}"]`)?.closest('.comment-thread')?.querySelector('.comment-replies');
    if (target) target.append(createCommentElement(reply, post, {}, submitReply));
    const count = post.querySelector('.comment-count'); count.textContent = `${formatCount(Number(count.textContent.replace(/[^0-9]/g, '')) + 1)} comments`; showToast('Reply added.'); return true;
  };
  (byParent.root || []).forEach((comment) => list.append(createCommentElement(comment, post, byParent, submitReply)));
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

const bindPost = (post) => {
  const likeButton = post.querySelector('.like-button');
  const commentButton = post.querySelector('.comment-focus');
  const shareButton = post.querySelector('.share-action');
  const saveButton = post.querySelector('.save-action');
  const likeCount = post.querySelector('.like-count');
  const commentCount = post.querySelector('.comment-count');
  const commentForm = post.querySelector('.comment-form');
  const commentInput = commentForm.querySelector('input');
  const commentList = post.querySelector('.comment-list');

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

  shareButton.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#post-${post.dataset.postId}`); showToast('Post link copied to your orbit.'); } catch { showToast('Copy is unavailable in this browser.'); }
  });

  const setSavedState = (saved) => {
    saveButton.dataset.saved = String(saved);
    saveButton.setAttribute('aria-pressed', String(saved));
    saveButton.classList.toggle('is-saved', saved);
    saveButton.querySelector('.save-label').textContent = saved ? (window.IQZodiacLanguage?.language === 'ar' ? 'تم الحفظ' : 'Saved') : (window.IQZodiacLanguage?.language === 'ar' ? 'حفظ' : 'Save');
    saveButton.setAttribute('aria-label', saveButton.querySelector('.save-label').textContent);
  };
  saveButton.addEventListener('click', async () => {
    if (!authenticatedUserId || !window.IQZodiacSavedItems) { showToast('Sign in to save posts.'); return; }
    const current = saveButton.dataset.saved === 'true';
    saveButton.disabled = true;
    try {
      const saved = await window.IQZodiacSavedItems.toggle(await database(), authenticatedUserId, 'post', post.dataset.postId, current);
      setSavedState(saved);
      showToast(saved ? (window.IQZodiacLanguage?.language === 'ar' ? 'تم حفظ المنشور.' : 'Post saved.') : (window.IQZodiacLanguage?.language === 'ar' ? 'تمت إزالة المنشور من المحفوظات.' : 'Post removed from Saved.'));
    } catch (error) {
      console.warn('Post save could not be updated.', error);
      showToast('Post could not be saved. Try again.');
    } finally { saveButton.disabled = false; }
  });
  setSavedState(saveButton.dataset.saved === 'true');

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = escapeText(commentInput.value);
    if (!value) return;
    const client = await database();
    if (!client || !authenticatedUserId || !/^[0-9a-f-]{36}$/i.test(post.dataset.postId || '')) { showToast('Sign in to comment on shared posts.'); return; }
    const { data, error } = await client.from('comments').insert({ post_id: post.dataset.postId, author_id: authenticatedUserId, body: value }).select('id,post_id,author_id,parent_comment_id,body,created_at').single();
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
document.addEventListener('iqzodiac:languagechange', () => {
  const isArabic = window.IQZodiacLanguage?.language === 'ar';
  document.querySelectorAll('.save-action').forEach((button) => {
    const label = button.querySelector('.save-label');
    if (!label) return;
    label.textContent = button.dataset.saved === 'true' ? (isArabic ? 'تم الحفظ' : 'Saved') : (isArabic ? 'حفظ' : 'Save');
    button.setAttribute('aria-label', label.textContent);
  });
});
(async () => {
  try {
    const client = await database();
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session?.user?.id) return;
    authenticatedUserId = sessionData.session.user.id;
    const { data: accountProfile } = await client.from('profiles').select('display_name,handle').eq('user_id', authenticatedUserId).maybeSingle();
    if (accountProfile) {
      currentPublicIdentity.displayName = String(accountProfile.display_name || currentPublicIdentity.displayName).slice(0, 32);
      currentPublicIdentity.handle = /^@[a-z0-9._-]{1,24}$/i.test(accountProfile.handle || '') ? accountProfile.handle : currentPublicIdentity.handle;
      currentPublicIdentity.initials = currentPublicIdentity.displayName.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
      applyCurrentIdentity();
    }
    const { data: feed, error } = await client.rpc('get_home_feed', { p_limit: 30 });
    if (error) throw error;
    const feedPostIds = (feed || []).map((item) => item.post_id).filter(Boolean);
    let savedPostIds = new Set();
    if (feedPostIds.length && window.IQZodiacSavedItems) {
      try { savedPostIds = await window.IQZodiacSavedItems.getSavedIds(client, authenticatedUserId, 'post', feedPostIds); }
      catch (savedError) { console.warn('Saved post states could not be loaded.', savedError); }
    }
    const feedList = document.querySelector('#feed-list');
    feedList.replaceChildren();
    if (!Array.isArray(feed) || !feed.length) {
      feedList.innerHTML = '<p class="match-empty">No real posts have been published yet.</p>';
    } else {
      for (const item of feed) {
        const post = document.createElement('article');
        post.className = 'post-card'; post.id = `post-${item.post_id}`; post.dataset.postId = item.post_id; post.dataset.author = String(item.handle || '').replace(/^@/, ''); post.dataset.authorId = item.author_id;
        const liked = Boolean(item.liked_by_me);
        const saved = savedPostIds.has(item.post_id);
        let mediaUrl = '';
        if (item.media_path) {
          const { data: signed } = await client.storage.from('iqzodiac-media').createSignedUrl(item.media_path, 3600);
          mediaUrl = signed?.signedUrl || '';
        }
        const bodyMarkup = item.body ? `<p class="post-body">${escapeHTML(item.body)}</p>` : '';
        post.innerHTML = `<header class="post-header"><div class="post-avatar home-avatar-small">${escapeHTML(String(item.display_name || 'OM').slice(0, 1))}</div><div class="post-author"><strong>${escapeHTML(item.display_name || 'Orbit Member')}</strong><span>${escapeHTML(item.handle || '@member')} · ${escapeHTML(formatDateTime(item.created_at))}</span></div></header>${bodyMarkup}${createPostMedia(item, mediaUrl)}<div class="post-meta"><span class="like-count">${formatCount(Number(item.like_count || 0))} likes</span><span class="comment-count">${formatCount(Number(item.comment_count || 0))} comments</span></div><div class="post-actions"><button class="post-action like-button ${liked ? 'is-liked' : ''}" type="button" data-like="${liked}"><span class="action-icon">${liked ? '♥' : '♡'}</span><span>${liked ? 'Liked' : 'Like'}</span></button><button class="post-action comment-focus" type="button"><span class="action-icon">◌</span><span>Comment</span></button><button class="post-action save-action ${saved ? 'is-saved' : ''}" type="button" data-saved="${saved}" aria-pressed="${saved}"><span class="bookmark-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.75 3.75h10.5c.83 0 1.5.67 1.5 1.5v15l-6.75-4.5-6.75 4.5v-15c0-.83.67-1.5 1.5-1.5Z" /></svg></span><span class="save-label">${saved ? 'Saved' : 'Save'}</span></button><button class="post-action share-action" type="button"><span class="action-icon">↗</span><span>Share</span></button></div><div class="comment-list"></div><form class="comment-form"><input type="text" maxlength="180" placeholder="Write a comment..." aria-label="Write a comment" /><button type="submit" aria-label="Post comment">↗</button></form>`;
        feedList.append(post); bindPost(post);
      }
    }
    const postIds = (feed || []).map((item) => item.post_id).filter(Boolean);
    if (postIds.length) {
      let comments = [];
      const { data: enrichedComments, error: commentsError } = await client.rpc('get_post_comments', { p_post_ids: postIds });
      if (!commentsError) {
        comments = enrichedComments || [];
      } else {
        const { data: basicComments, error: basicCommentsError } = await client.from('comments').select('id,post_id,author_id,body,created_at').in('post_id', postIds).order('created_at', { ascending: true });
        if (basicCommentsError) throw basicCommentsError;
        comments = (basicComments || []).map((comment) => ({ ...comment, handle: comment.author_id === authenticatedUserId ? currentPublicIdentity.handle : '@member' }));
      }
      document.querySelectorAll('#feed-list .post-card').forEach((post) => renderComments(post, comments.filter((comment) => comment.post_id === post.dataset.postId)));
    }
    const requestedPostId = window.location.hash.match(/^#post-([0-9a-f-]{36})$/i)?.[1];
    if (requestedPostId) {
      const requestedPost = document.getElementById(`post-${requestedPostId}`);
      if (requestedPost) requestAnimationFrame(() => requestedPost.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
    }
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
