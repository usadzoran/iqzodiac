(() => {
  'use strict';
  const clientReady = window.IQZodiacSupabase?.ready;
  const savedGrid = document.querySelector('#saved-reels-grid');
  const likedGrid = document.querySelector('#liked-reels-grid');
  const status = document.querySelector('#reel-collections-status');
  if (!clientReady || !savedGrid || !likedGrid || !status) return;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const setStatus = (message) => { status.textContent = message; };
  const renderEmpty = (grid, message) => { grid.innerHTML = `<p class="reel-collection-empty">${escapeHTML(message)}</p>`; };
  const signedMedia = async (client, row) => {
    try { const { data } = await client.storage.from('iqzodiac-media').createSignedUrl(row.media_path, 3600); return data?.signedUrl || ''; }
    catch { return ''; }
  };
  const loadRows = async (client, table, userId) => {
    const { data: links, error } = await client.from(table).select('reel_id,created_at').eq('user_id', userId).order('created_at', { ascending:false }).limit(100);
    if (error) throw error;
    const ids = (links || []).map((link) => link.reel_id);
    if (!ids.length) return [];
    const { data: reels, error: reelsError } = await client.from('reels').select('id,caption,media_path,created_at,duration_seconds').in('id', ids);
    if (reelsError) throw reelsError;
    const byId = new Map((reels || []).map((row) => [row.id, row]));
    return Promise.all(ids.map(async (id) => { const row = byId.get(id); return row ? { ...row, signed_url: await signedMedia(client, row) } : { id, unavailable:true }; }));
  };
  const renderRows = (grid, rows, kind) => {
    if (!rows.length) { renderEmpty(grid, kind === 'saved' ? 'You have not saved any Reels yet.' : 'You have not liked any Reels yet.'); return; }
    grid.innerHTML = rows.map((row) => row.unavailable || !row.signed_url
      ? `<article class="reel-collection-tile is-unavailable"><span class="reel-collection-thumb">×</span><strong>Reel unavailable</strong><small>The original video is no longer available.</small></article>`
      : `<article class="reel-collection-tile"><a href="./reel.html?reel=${encodeURIComponent(row.id)}" aria-label="Open Reel"><img loading="lazy" src="${escapeHTML(row.signed_url)}" alt="${escapeHTML(row.caption || 'Saved Reel')}" /><span class="reel-collection-play" aria-hidden="true">▶</span></a><div class="reel-collection-tile-copy"><span>${escapeHTML(row.caption || 'Reel')}</span>${kind === 'liked' ? `<button type="button" data-remove-like="${escapeHTML(row.id)}" aria-label="Remove like">♥</button>` : `<button type="button" data-remove-save="${escapeHTML(row.id)}" aria-label="Remove saved Reel">🔖</button>`}</div></article>`).join('');
  };
  const load = async () => {
    try {
      const client = await clientReady;
      const { data, error } = await client.auth.getUser();
      const userId = data?.user?.id;
      if (error || !userId) { setStatus('Sign in to see your Reel collections.'); return; }
      setStatus('Loading your Reel collections…');
      const [saved, liked] = await Promise.all([loadRows(client, 'reel_saves', userId), loadRows(client, 'reel_likes', userId)]);
      renderRows(savedGrid, saved, 'saved'); renderRows(likedGrid, liked, 'liked');
      setStatus(`${saved.length} saved · ${liked.length} liked`);
    } catch (error) { console.warn('Reel collections could not be loaded.', error); setStatus('Reel collections are temporarily unavailable.'); }
  };
  const remove = async (event) => {
    const likeId = event.target.closest('[data-remove-like]')?.dataset.removeLike;
    const saveId = event.target.closest('[data-remove-save]')?.dataset.removeSave;
    if (!likeId && !saveId) return;
    event.preventDefault();
    const client = await clientReady;
    const { data } = await client.auth.getUser();
    if (!data?.user?.id) return;
    const table = likeId ? 'reel_likes' : 'reel_saves';
    const reelId = likeId || saveId;
    const { error } = await client.from(table).delete().eq('reel_id', reelId).eq('user_id', data.user.id);
    if (error) { setStatus('The change could not be saved.'); return; }
    await load();
  };
  document.querySelectorAll('[data-reel-collection-tab]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-reel-collection-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
    document.querySelectorAll('[data-reel-collection-panel]').forEach((panel) => panel.hidden = panel.dataset.reelCollectionPanel !== tab.dataset.reelCollectionTab);
  }));
  document.addEventListener('click', remove);
  load();
})();
