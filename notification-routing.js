(() => {
  'use strict';
  const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  const urlFor = (row = {}) => {
    const type = String(row.notification_type || '');
    const url = new URL('./home.html', document.baseURI);
    if (type === 'reel_comment' || type === 'reel_like') {
      if (!uuid(row.reel_id)) return url;
      url.pathname = new URL('./reel.html', document.baseURI).pathname;
      url.searchParams.set('reel', row.reel_id);
      if (type === 'reel_comment' && uuid(row.reel_comment_id)) url.searchParams.set('comment', row.reel_comment_id);
      return url;
    }
    if (type === 'post_comment' || type === 'comment_reply' || type === 'post_like') {
      if (!uuid(row.post_id)) return url;
      url.searchParams.set('post', row.post_id);
      if (type !== 'post_like' && uuid(row.comment_id)) url.searchParams.set('comment', row.comment_id);
      return url;
    }
    if (type === 'private_message' && uuid(row.actor_id)) {
      url.pathname = new URL('./messages.html', document.baseURI).pathname;
      url.searchParams.set('match', row.actor_id);
      if (uuid(row.message_id)) url.searchParams.set('message', row.message_id);
      return url;
    }
    if ((type === 'profile_like' || type === 'profile_follow') && uuid(row.actor_id)) {
      url.pathname = new URL('./reel-profile.html', document.baseURI).pathname;
      url.searchParams.set('user', row.actor_id);
    }
    return url;
  };
  window.IQZodiacNotifications = Object.freeze({
    urlFor,
    navigate(row) { window.location.assign(urlFor(row).href); },
  });
})();
