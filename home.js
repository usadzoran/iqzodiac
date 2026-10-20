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

document.querySelectorAll('.feed-filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.feed-filter-button').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    if (button.dataset.flow) showToast(`${button.dataset.flow} is coming soon.`);
  });
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
  document.querySelector('#feed-list').prepend(post);
  bindPost(post);
  document.querySelector('#post-text').value = '';
  composerMedia = null;
  mediaInput.value = '';
  composerPreview.replaceChildren();
  composerPreview.hidden = true;
  showToast('Your post is live.');
});
