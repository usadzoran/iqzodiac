const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;
let composerMedia = null;

const showToast = (message) => {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
};

const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
const escapeText = (value) => value.trim().slice(0, 500);

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

const bindPost = (post) => {
  const likeButton = post.querySelector('.like-button');
  const commentButton = post.querySelector('.comment-focus');
  const shareButton = post.querySelector('.share-action');
  const likeCount = post.querySelector('.like-count');
  const commentCount = post.querySelector('.comment-count');
  const commentForm = post.querySelector('.comment-form');
  const commentInput = commentForm.querySelector('input');
  const commentList = post.querySelector('.comment-list');

  likeButton.addEventListener('click', () => {
    const liked = likeButton.dataset.like === 'true';
    const number = Number(likeCount.textContent.replace(/[^0-9]/g, '')) + (liked ? -1 : 1);
    likeButton.dataset.like = String(!liked);
    likeButton.classList.toggle('is-liked', !liked);
    likeButton.querySelector('.action-icon').textContent = liked ? '♡' : '♥';
    likeButton.querySelector('span:last-child').textContent = liked ? 'Like' : 'Liked';
    likeCount.textContent = `${formatCount(number)} likes`;
    showToast(liked ? 'Like removed.' : 'Post liked.');
  });

  commentButton.addEventListener('click', () => {
    commentInput.focus();
    commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  shareButton.addEventListener('click', () => showToast('Post link copied to your orbit.'));

  commentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = escapeText(commentInput.value);
    if (!value) return;
    const comment = document.createElement('div');
    comment.className = 'comment';
    const avatar = document.createElement('span');
    avatar.className = 'comment-avatar home-avatar-small';
    avatar.textContent = 'AS';
    const copy = document.createElement('p');
    const author = document.createElement('strong');
    author.textContent = 'alex.stone';
    copy.append(author, document.createTextNode(` ${value}`));
    comment.append(avatar, copy);
    commentList.append(comment);
    const count = Number(commentCount.textContent.replace(/[^0-9]/g, '')) + 1;
    commentCount.textContent = `${formatCount(count)} comments`;
    commentInput.value = '';
    showToast('Comment added.');
  });
};

document.querySelectorAll('.post-card').forEach(bindPost);

document.querySelectorAll('[data-flow]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.flow} is coming soon.`));
});

const followedPeople = new Set(JSON.parse(window.localStorage.getItem('iqzodiac-following') || '[]'));
const updateFollowState = (button) => {
  const following = followedPeople.has(button.dataset.follow);
  button.classList.toggle('is-following', following);
  button.textContent = following ? '✓' : '+';
  button.setAttribute('aria-label', `${following ? 'Unfollow' : 'Follow'} ${button.dataset.follow === 'linaortiz' ? 'Lina Ortiz' : 'Noah Williams'}`);
};
document.querySelectorAll('[data-follow]').forEach((button) => {
  updateFollowState(button);
  button.addEventListener('click', () => {
    const handle = button.dataset.follow;
    if (followedPeople.has(handle)) {
      followedPeople.delete(handle);
      showToast('You unfollowed this person.');
    } else {
      followedPeople.add(handle);
      showToast('You’re following this person.');
    }
    window.localStorage.setItem('iqzodiac-following', JSON.stringify([...followedPeople]));
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
const moodStorageKey = `iqzodiac-mood-${todayKey}`;
let selectedMood = null;
try { selectedMood = window.localStorage.getItem(moodStorageKey); } catch { selectedMood = null; }
const selectMood = (mood) => {
  selectedMood = mood;
  moodButtons.forEach((button) => {
    const selected = button.dataset.mood === mood;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  moodMessage.textContent = moodCopy[mood];
  moodReflection.hidden = false;
  try { window.localStorage.setItem(moodStorageKey, mood); } catch { /* Keep the check-in usable when storage is disabled. */ }
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

const mediaInput = document.querySelector('#post-media-input');
const composerPreview = document.querySelector('#composer-media-preview');
mediaInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  composerMedia = file;
  createMediaPreview(file, composerPreview);
  showToast(`${file.name} is ready to publish.`);
});

document.querySelector('#publish-post').addEventListener('click', () => {
  const text = escapeText(document.querySelector('#post-text').value);
  if (!text && !composerMedia) {
    showToast('Write something or add a photo/video first.');
    return;
  }

  const post = document.createElement('article');
  post.className = 'post-card post-card-new';
  post.dataset.postId = `new-${Date.now()}`;
  post.innerHTML = `<header class="post-header"><div class="post-avatar home-avatar-small">AS</div><div class="post-author"><strong>alex.stone</strong><span>@alex.stone · just now</span></div><button class="post-more" type="button" aria-label="More options">···</button></header><p class="post-body"></p><div class="post-media-slot"></div><div class="post-meta"><span class="like-count">0 likes</span><span class="comment-count">0 comments</span></div><div class="post-actions"><button class="post-action like-button" type="button" data-like="false"><span class="action-icon">♡</span><span>Like</span></button><button class="post-action comment-focus" type="button"><span class="action-icon">◌</span><span>Comment</span></button><button class="post-action share-action" type="button"><span class="action-icon">↗</span><span>Share</span></button></div><div class="comment-list"></div><form class="comment-form"><input type="text" maxlength="180" placeholder="Write a comment..." aria-label="Write a comment on your post" /><button type="submit" aria-label="Post comment">↗</button></form>`;
  post.querySelector('.post-body').textContent = text;
  if (!text) post.querySelector('.post-body').remove();
  if (composerMedia) createMediaPreview(composerMedia, post.querySelector('.post-media-slot'), 'post-uploaded-media');
  post.dataset.author = 'alex.stone';
  document.querySelector('#feed-list').prepend(post);
  bindPost(post);
  if (filters.find((item) => item.classList.contains('is-active'))?.dataset.filter === 'following') post.hidden = true;
  document.querySelector('#post-text').value = '';
  composerMedia = null;
  mediaInput.value = '';
  composerPreview.replaceChildren();
  composerPreview.hidden = true;
  showToast('Your post is live.');
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
