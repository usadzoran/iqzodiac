(() => {
  'use strict';

  const PAGE_SIZE = 12;
  const byId = (id) => document.getElementById(id);
  const tabNames = ['posts', 'comments', 'saved', 'about'];
  const panels = Object.fromEntries(tabNames.map((name) => [name, byId(`profile-panel-${name}`)]));
  const tabs = [...document.querySelectorAll('[data-profile-tab]')];
  const mediaUrlCache = new Map();
  const copy = {
    en: {
      posts: 'Posts', comments: 'Comments', saved: 'Saved', about: 'About', feedOptions: 'Feed Options', latest: 'Latest', oldest: 'Oldest', mostLiked: 'Most Liked', media: 'Media',
      loading: 'Loading…', loadMore: 'Load more', loadFailed: 'Could not load this section. Try again.',
      noPosts: 'No posts have been published yet.', noComments: 'You have not commented on anyone’s posts yet.', noSaved: 'You have not saved any posts or Reels yet.',
      post: 'Post', reel: 'Reel', you: 'You', member: 'Member', openPost: 'View post', openReel: 'View Reel',
      save: 'Save', unsave: 'Saved · Remove', saveDone: 'Saved to your profile.', unsaveDone: 'Removed from Saved.', saveFailed: 'Could not update Saved. Try again.',
      likes: (n) => `${n} likes`, commentsCount: (n) => `${n} comments`, commentOn: (name) => `Comment on ${name}’s post`, yourComment: 'Your comment',
      emptyMedia: 'This item has no available media.', authorFallback: 'Member',
    },
    ar: {
      posts: 'المنشورات', comments: 'التعليقات', saved: 'المحفوظات', about: 'حول', feedOptions: 'خيارات الموجز', latest: 'الأحدث', oldest: 'الأقدم', mostLiked: 'الأكثر إعجابًا', media: 'الوسائط',
      loading: 'جارٍ التحميل…', loadMore: 'تحميل المزيد', loadFailed: 'تعذّر تحميل هذا القسم. حاول مجددًا.',
      noPosts: 'لم تُنشر أي منشورات بعد.', noComments: 'لم تعلّق على منشورات الآخرين بعد.', noSaved: 'لم تحفظ أي منشور أو Reel بعد.',
      post: 'منشور', reel: 'Reel', you: 'أنت', member: 'عضو', openPost: 'عرض المنشور', openReel: 'عرض Reel',
      save: 'حفظ', unsave: 'محفوظ · إزالة', saveDone: 'تم الحفظ في ملفك الشخصي.', unsaveDone: 'تمت الإزالة من المحفوظات.', saveFailed: 'تعذّر تحديث المحفوظات. حاول مجددًا.',
      likes: (n) => `${new Intl.NumberFormat('ar').format(n)} إعجاب`, commentsCount: (n) => `${new Intl.NumberFormat('ar').format(n)} تعليق`, commentOn: (name) => `تعليق على منشور ${name}`, yourComment: 'تعليقك',
      emptyMedia: 'لا توجد وسائط متاحة لهذا العنصر.', authorFallback: 'عضو',
    },
  };
  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const t = (key, ...args) => {
    const value = copy[language()][key];
    return typeof value === 'function' ? value(...args) : (value ?? key);
  };
  const number = (value) => new Intl.NumberFormat(language() === 'ar' ? 'ar' : 'en').format(Number(value) || 0);
  const formatDate = (value) => {
    try { return new Intl.DateTimeFormat(language() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(value)); }
    catch { return ''; }
  };

  let client = null;
  let userId = null;
  let publicName = '';
  let publicHandle = '';
  let feedOption = 'latest';
  let activeTab = 'posts';
  let postsOffset = 0;
  let commentsOffset = 0;
  let savedOffset = 0;
  let postsReloadQueued = false;
  const loadedTabs = new Set();
  const loadingTabs = new Set();

  const setStatus = (name, message, state = '') => {
    const node = byId(`profile-${name}-status`);
    if (!node) return;
    node.textContent = message;
    node.dataset.state = state;
  };
  const getList = (name) => byId(`profile-${name}-list`);
  const setBusy = (name, value) => {
    const panel = panels[name];
    if (panel) panel.setAttribute('aria-busy', String(value));
  };
  const addEmpty = (list, message) => {
    const empty = document.createElement('p');
    empty.className = 'profile-feed-empty';
    empty.setAttribute('role', 'status');
    empty.textContent = message;
    list.append(empty);
  };
  const makeDate = (value, className = 'profile-item-date') => {
    const node = document.createElement('time');
    node.className = className;
    node.dateTime = value || '';
    node.textContent = formatDate(value);
    return node;
  };
  const makeLink = (href, label, className = 'profile-item-link') => {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.textContent = label;
    return link;
  };
  const signedUrl = async (path) => {
    if (!path || !client) return '';
    const cached = mediaUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now() + 45_000) return cached.url;
    const { data, error } = await client.storage.from('iqzodiac-media').createSignedUrl(path, 900);
    if (error || !data?.signedUrl) return '';
    mediaUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 900_000 });
    return data.signedUrl;
  };
  const appendMedia = async (target, path, type, alt) => {
    if (!path) return;
    const url = await signedUrl(path);
    if (!url) {
      const unavailable = document.createElement('p');
      unavailable.className = 'profile-item-media-unavailable';
      unavailable.textContent = t('emptyMedia');
      target.append(unavailable);
      return;
    }
    const media = type === 'video' ? document.createElement('video') : document.createElement('img');
    media.className = 'profile-item-media';
    media.src = url;
    media.alt = type === 'video' ? '' : alt;
    if (type === 'video') {
      media.controls = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.muted = true;
      media.setAttribute('aria-label', alt);
    } else {
      media.loading = 'lazy';
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'profile-item-media-wrap';
    wrapper.append(media);
    target.append(wrapper);
  };
  const bookmarkIcon = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6.75 3.75h10.5c.83 0 1.5.67 1.5 1.5v15l-6.75-4.5-6.75 4.5v-15c0-.83.67-1.5 1.5-1.5Z');
    svg.append(path);
    return svg;
  };
  const updateSaveButton = (button, type, id, saved) => {
    button.dataset.itemType = type;
    button.dataset.itemId = id;
    button.dataset.saved = String(saved);
    button.setAttribute('aria-pressed', String(saved));
    button.classList.toggle('is-saved', saved);
    const label = button.querySelector('.profile-save-label');
    if (label) label.textContent = saved ? t('unsave') : t('save');
    button.setAttribute('aria-label', saved ? t('unsave') : t('save'));
  };
  const updateAllSaveButtons = (type, id, saved) => {
    document.querySelectorAll('.profile-save-toggle').forEach((button) => {
      if (button.dataset.itemType !== type || button.dataset.itemId !== id) return;
      updateSaveButton(button, type, id, saved);
      if (!saved && button.dataset.savedPanel === 'true') {
        button.closest('.profile-item-card')?.remove();
      }
    });
    if (!saved && !getList('saved')?.querySelector('.profile-item-card')) {
      getList('saved')?.replaceChildren();
      addEmpty(getList('saved'), t('noSaved'));
      setStatus('saved', t('noSaved'));
    }
  };
  const makeSaveButton = (type, id, saved, fromSavedPanel = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-item-action profile-save-toggle';
    button.dataset.savedPanel = String(fromSavedPanel);
    button.append(bookmarkIcon());
    const label = document.createElement('span');
    label.className = 'profile-save-label';
    button.append(label);
    updateSaveButton(button, type, id, saved);
    button.addEventListener('click', async () => {
      if (!client || !userId || !window.IQZodiacSavedItems) return;
      const current = button.dataset.saved === 'true';
      button.disabled = true;
      try {
        const next = await window.IQZodiacSavedItems.toggle(client, userId, type, id, current);
        updateAllSaveButtons(type, id, next);
        if (next && loadedTabs.has('saved')) {
          loadedTabs.delete('saved');
          savedOffset = 0;
          getList('saved').replaceChildren();
          byId('profile-saved-more').hidden = true;
        }
        const toast = document.querySelector('.toast');
        const message = document.querySelector('.toast-message');
        if (toast && message) {
          message.textContent = next ? t('saveDone') : t('unsaveDone');
          toast.classList.add('is-visible');
          window.clearTimeout(toast._profileSaveTimer);
          toast._profileSaveTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
        }
      } catch (error) {
        console.warn('Saved item could not be updated.', error);
        const toast = document.querySelector('.toast');
        const message = document.querySelector('.toast-message');
        if (toast && message) {
          message.textContent = t('saveFailed');
          toast.classList.add('is-visible');
          window.clearTimeout(toast._profileSaveTimer);
          toast._profileSaveTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
        }
      } finally {
        button.disabled = false;
      }
    });
    return button;
  };

  const renderPostCard = async (row, savedIds) => {
    const id = row.post_id;
    const card = document.createElement('article');
    card.className = 'profile-item-card';
    card.dataset.itemType = 'post';
    card.dataset.itemId = id;
    const header = document.createElement('header');
    header.className = 'profile-item-header';
    const author = document.createElement('div');
    author.className = 'profile-item-author';
    const avatar = document.createElement('span');
    avatar.className = 'profile-item-avatar';
    avatar.textContent = String(publicName || t('you')).trim().split(/[\s_-]+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IQ';
    const authorCopy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = publicName || t('you');
    const handle = document.createElement('small');
    handle.textContent = publicHandle || '';
    authorCopy.append(name, handle);
    author.append(avatar, authorCopy);
    header.append(author, makeDate(row.created_at));
    card.append(header);
    if (row.body) {
      const body = document.createElement('p');
      body.className = 'profile-item-body';
      body.textContent = row.body;
      card.append(body);
    }
    if (row.media_path) await appendMedia(card, row.media_path, row.media_type, t('post'));
    const meta = document.createElement('div');
    meta.className = 'profile-item-meta';
    const likes = document.createElement('span'); likes.textContent = t('likes', Number(row.like_count) || 0);
    const comments = document.createElement('span'); comments.textContent = t('commentsCount', Number(row.comment_count) || 0);
    meta.append(likes, comments);
    card.append(meta);
    const actions = document.createElement('div'); actions.className = 'profile-item-actions';
    actions.append(makeSaveButton('post', id, savedIds.has(id)));
    actions.append(makeLink(`./home.html#post-${encodeURIComponent(id)}`, t('openPost')));
    card.append(actions);
    return card;
  };

  const renderCommentCard = async (row, savedIds, profiles) => {
    const card = document.createElement('article');
    card.className = 'profile-item-card profile-comment-card';
    card.dataset.itemType = 'post';
    card.dataset.itemId = row.post_id;
    const profile = profiles.get(row.post_author_id) || {};
    const authorName = profile.display_name || profile.handle || t('authorFallback');
    const header = document.createElement('header'); header.className = 'profile-item-header';
    const title = document.createElement('strong'); title.textContent = t('commentOn', authorName);
    header.append(title, makeDate(row.created_at));
    card.append(header);
    const quote = document.createElement('blockquote'); quote.className = 'profile-comment-parent'; quote.textContent = row.post_body || '';
    if (quote.textContent) card.append(quote);
    if (row.post_media_path) await appendMedia(card, row.post_media_path, row.post_media_type, t('post'));
    const commentHeading = document.createElement('span'); commentHeading.className = 'profile-comment-label'; commentHeading.textContent = t('yourComment');
    const commentBody = document.createElement('p'); commentBody.className = 'profile-item-body'; commentBody.textContent = row.body || '';
    card.append(commentHeading, commentBody);
    if (row.comment_media_path) await appendMedia(card, row.comment_media_path, row.comment_media_type, t('yourComment'));
    const actions = document.createElement('div'); actions.className = 'profile-item-actions';
    actions.append(makeSaveButton('post', row.post_id, savedIds.has(row.post_id)));
    actions.append(makeLink(`./home.html#post-${encodeURIComponent(row.post_id)}`, t('openPost')));
    card.append(actions);
    return card;
  };

  const renderSavedCard = async (item, entity, profiles) => {
    const isReel = item.item_type === 'reel';
    const type = isReel ? 'reel' : 'post';
    const id = isReel ? item.reel_id : item.post_id;
    const card = document.createElement('article');
    card.className = 'profile-item-card profile-saved-card';
    card.dataset.itemType = type;
    card.dataset.itemId = id;
    const header = document.createElement('header'); header.className = 'profile-item-header';
    const author = document.createElement('strong');
    const profile = profiles.get(entity.author_id) || {};
    author.textContent = profile.display_name || profile.handle || (isReel ? t('member') : (publicName || t('you')));
    header.append(author, makeDate(item.created_at));
    card.append(header);
    const caption = isReel ? entity.caption : entity.body;
    if (caption) { const body = document.createElement('p'); body.className = 'profile-item-body'; body.textContent = caption; card.append(body); }
    if (entity.media_path) await appendMedia(card, entity.media_path, entity.media_type || (isReel ? 'video' : null), isReel ? t('reel') : t('post'));
    const actions = document.createElement('div'); actions.className = 'profile-item-actions';
    actions.append(makeSaveButton(type, id, true, true));
    actions.append(makeLink(isReel ? `./reel.html?reel=${encodeURIComponent(id)}` : `./home.html#post-${encodeURIComponent(id)}`, isReel ? t('openReel') : t('openPost')));
    card.append(actions);
    return card;
  };

  const loadPosts = async (reset = false) => {
    if (!client || !userId) return;
    if (loadingTabs.has('posts')) { if (reset) postsReloadQueued = true; return; }
    if (reset || postsOffset === 0) { postsOffset = 0; getList('posts').replaceChildren(); }
    loadingTabs.add('posts'); setBusy('posts', true); setStatus('posts', t('loading'));
    try {
      const sort = feedOption === 'media' ? 'latest' : feedOption;
      const { data, error } = await client.rpc('get_profile_posts', {
        p_user_id: userId, p_sort: sort, p_media_only: feedOption === 'media', p_limit: PAGE_SIZE, p_offset: postsOffset,
      });
      if (error) throw error;
      const rows = data || [];
      const ids = rows.map((row) => row.post_id).filter(Boolean);
      const savedIds = await window.IQZodiacSavedItems.getSavedIds(client, userId, 'post', ids);
      const cards = await Promise.all(rows.map((row) => renderPostCard(row, savedIds)));
      if (!postsOffset && !rows.length) addEmpty(getList('posts'), t('noPosts'));
      else getList('posts').append(...cards);
      postsOffset += rows.length;
      byId('profile-posts-more').hidden = rows.length < PAGE_SIZE;
      setStatus('posts', rows.length ? '' : t('noPosts'));
      loadedTabs.add('posts');
    } catch (error) {
      console.warn('Profile posts could not be loaded.', error);
      setStatus('posts', t('loadFailed'), 'error');
      byId('profile-posts-more').hidden = false;
    } finally {
      loadingTabs.delete('posts'); setBusy('posts', false);
      if (postsReloadQueued) { postsReloadQueued = false; loadedTabs.delete('posts'); void loadPosts(true); }
    }
  };

  const loadComments = async (reset = false) => {
    if (!client || !userId || loadingTabs.has('comments')) return;
    if (reset || commentsOffset === 0) { commentsOffset = 0; getList('comments').replaceChildren(); }
    loadingTabs.add('comments'); setBusy('comments', true); setStatus('comments', t('loading'));
    try {
      const { data, error } = await client.rpc('get_profile_comments', { p_user_id: userId, p_limit: PAGE_SIZE, p_offset: commentsOffset });
      if (error) throw error;
      const rows = data || [];
      const postIds = [...new Set(rows.map((row) => row.post_id).filter(Boolean))];
      const authorIds = [...new Set(rows.map((row) => row.post_author_id).filter(Boolean))];
      const [savedIds, profilesResult] = await Promise.all([
        window.IQZodiacSavedItems.getSavedIds(client, userId, 'post', postIds),
        authorIds.length ? client.rpc('get_public_profile_cards', { p_user_ids: authorIds }) : Promise.resolve({ data: [], error: null }),
      ]);
      const profiles = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
      const cards = await Promise.all(rows.map((row) => renderCommentCard(row, savedIds, profiles)));
      if (!commentsOffset && !rows.length) addEmpty(getList('comments'), t('noComments'));
      else getList('comments').append(...cards);
      commentsOffset += rows.length;
      byId('profile-comments-more').hidden = rows.length < PAGE_SIZE;
      setStatus('comments', rows.length ? '' : t('noComments'));
      loadedTabs.add('comments');
    } catch (error) {
      console.warn('Profile comments could not be loaded.', error);
      setStatus('comments', t('loadFailed'), 'error');
      byId('profile-comments-more').hidden = false;
    } finally { loadingTabs.delete('comments'); setBusy('comments', false); }
  };

  const loadSaved = async (reset = false) => {
    if (!client || !userId || loadingTabs.has('saved')) return;
    if (reset || savedOffset === 0) { savedOffset = 0; getList('saved').replaceChildren(); }
    loadingTabs.add('saved'); setBusy('saved', true); setStatus('saved', t('loading'));
    try {
      const { data, error } = await client.from('saved_items')
        .select('id,item_type,post_id,reel_id,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(savedOffset, savedOffset + PAGE_SIZE - 1);
      if (error) throw error;
      const items = data || [];
      const postIds = items.filter((item) => item.item_type === 'post').map((item) => item.post_id).filter(Boolean);
      const reelIds = items.filter((item) => item.item_type === 'reel').map((item) => item.reel_id).filter(Boolean);
      const [postsResult, reelsResult] = await Promise.all([
        postIds.length ? client.from('posts').select('id,author_id,body,media_type,media_path,created_at').in('id', postIds).limit(PAGE_SIZE) : Promise.resolve({ data: [], error: null }),
        reelIds.length ? client.from('reels').select('id,author_id,caption,media_path,media_mime,created_at').in('id', reelIds).limit(PAGE_SIZE) : Promise.resolve({ data: [], error: null }),
      ]);
      if (postsResult.error) throw postsResult.error;
      if (reelsResult.error) throw reelsResult.error;
      const entities = new Map();
      (postsResult.data || []).forEach((row) => entities.set(`post:${row.id}`, { ...row, media_type: row.media_type }));
      (reelsResult.data || []).forEach((row) => entities.set(`reel:${row.id}`, { ...row, media_type: 'video' }));
      const authorIds = [...new Set([...(postsResult.data || []), ...(reelsResult.data || [])].map((row) => row.author_id).filter(Boolean))];
      const profilesResult = authorIds.length ? await client.rpc('get_public_profile_cards', { p_user_ids: authorIds }) : { data: [], error: null };
      const profiles = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
      const ordered = items.map((item) => ({ item, entity: entities.get(`${item.item_type}:${item.item_type === 'reel' ? item.reel_id : item.post_id}`) })).filter((row) => row.entity);
      const cards = await Promise.all(ordered.map(({ item, entity }) => renderSavedCard(item, entity, profiles)));
      if (!savedOffset && !cards.length) addEmpty(getList('saved'), t('noSaved'));
      else {
        if (cards.length) getList('saved').querySelector('.profile-feed-empty')?.remove();
        getList('saved').append(...cards);
      }
      savedOffset += items.length;
      byId('profile-saved-more').hidden = items.length < PAGE_SIZE;
      setStatus('saved', cards.length ? '' : t('noSaved'));
      loadedTabs.add('saved');
    } catch (error) {
      console.warn('Saved profile items could not be loaded.', error);
      setStatus('saved', t('loadFailed'), 'error');
      byId('profile-saved-more').hidden = false;
    } finally { loadingTabs.delete('saved'); setBusy('saved', false); }
  };

  const loadTab = (name) => {
    if (name === 'posts' && !loadedTabs.has(name)) void loadPosts();
    if (name === 'comments' && !loadedTabs.has(name)) void loadComments();
    if (name === 'saved' && !loadedTabs.has(name)) void loadSaved();
  };
  const activateTab = (name, persist = true) => {
    if (!tabNames.includes(name)) name = 'posts';
    activeTab = name;
    tabs.forEach((tab) => {
      const selected = tab.dataset.profileTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-active', selected);
    });
    Object.entries(panels).forEach(([key, panel]) => { if (panel) panel.hidden = key !== name; });
    const options = byId('profile-feed-options');
    if (options) options.hidden = name !== 'posts';
    if (persist) {
      try { history.replaceState(null, '', `${location.pathname}${location.search}#${name}`); } catch { /* Keep the tab usable when history is restricted. */ }
    }
    if (name === 'about') document.dispatchEvent(new CustomEvent('iqzodiac:profiletabchange', { detail: { tab: 'about' } }));
    loadTab(name);
  };
  const applyCopy = () => {
    document.querySelectorAll('[data-profile-copy]').forEach((node) => { node.textContent = t(node.dataset.profileCopy); });
    document.querySelectorAll('.profile-feed-option').forEach((button) => { button.textContent = t(button.dataset.profileOption); });
    document.querySelectorAll('.profile-item-date[datetime]').forEach((node) => { node.textContent = formatDate(node.dateTime); });
    document.querySelectorAll('.profile-save-toggle').forEach((button) => updateSaveButton(button, button.dataset.itemType, button.dataset.itemId, button.dataset.saved === 'true'));
    document.querySelectorAll('.profile-comment-label').forEach((node) => { node.textContent = t('yourComment'); });
  };

  const optionMenu = byId('profile-feed-options-menu');
  byId('profile-feed-options-trigger')?.addEventListener('click', () => {
    const open = optionMenu.hidden;
    optionMenu.hidden = !open;
    byId('profile-feed-options-trigger').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#profile-feed-options')) {
      if (optionMenu) optionMenu.hidden = true;
      byId('profile-feed-options-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });
  document.querySelectorAll('.profile-feed-option').forEach((button) => button.addEventListener('click', () => {
    feedOption = button.dataset.profileOption;
    document.querySelectorAll('.profile-feed-option').forEach((option) => {
      const selected = option === button;
      option.setAttribute('aria-pressed', String(selected));
      option.classList.toggle('is-selected', selected);
    });
    optionMenu.hidden = true;
    byId('profile-feed-options-trigger').setAttribute('aria-expanded', 'false');
    loadedTabs.delete('posts');
    void loadPosts(true);
  }));
  byId('profile-posts-more')?.addEventListener('click', () => void loadPosts());
  byId('profile-comments-more')?.addEventListener('click', () => void loadComments());
  byId('profile-saved-more')?.addEventListener('click', () => void loadSaved());
  tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.profileTab)));
  document.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.dataset.profileTab === activeTab);
    const rtl = document.documentElement.dir === 'rtl';
    const forward = event.key === 'ArrowRight' ? !rtl : rtl;
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else nextIndex = (index + (forward ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex]?.focus();
    activateTab(tabs[nextIndex]?.dataset.profileTab);
  });
  document.addEventListener('iqzodiac:languagechange', applyCopy);
  applyCopy();

  (async () => {
    try {
      client = await window.IQZodiacSupabase?.ready;
      if (!client) throw new Error('Supabase client unavailable');
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      userId = data.session?.user?.id || null;
      if (!userId) throw new Error('Sign-in required');
      const { data: profile, error: profileError } = await client.from('profiles').select('display_name,handle').eq('user_id', userId).maybeSingle();
      if (profileError) console.warn('Public profile label could not be loaded.', profileError);
      publicName = profile?.display_name || t('you');
      publicHandle = profile?.handle || '';
      const requested = location.hash.slice(1).toLowerCase();
      activateTab(tabNames.includes(requested) ? requested : 'posts', false);
    } catch (error) {
      console.warn('Profile tabs could not initialize.', error);
      tabNames.filter((name) => name !== 'about').forEach((name) => {
        const list = getList(name);
        if (list) list.replaceChildren();
        setBusy(name, false);
        setStatus(name, t('loadFailed'), 'error');
      });
      activateTab('posts', false);
    }
  })();
})();
