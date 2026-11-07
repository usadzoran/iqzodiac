(() => {
  'use strict';
  const grid = document.getElementById('profile-reel-grid');
  const status = document.getElementById('profile-status');
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = (value) => String(value || 'Orbit Member').replace(/^@/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
  const formatDate = (value) => { try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); } catch { return ''; } };
  const clientReady = () => window.IQZodiacSupabase?.ready;
  const lazyVideos = new IntersectionObserver((entries, observer) => { entries.forEach((entry) => { if (!entry.isIntersecting) return; const video = entry.target; if (video.dataset.src) { video.src = video.dataset.src; video.removeAttribute('data-src'); } observer.unobserve(video); }); }, { rootMargin: '240px 0px' });

  const setProfile = (profile) => { const name = profile?.display_name || profile?.handle || 'Orbit Member'; document.getElementById('member-name').textContent = name; document.getElementById('member-handle').textContent = profile?.handle || '@orbit-member'; document.getElementById('member-avatar').textContent = initials(name); };
  const render = async (rows, client) => {
    grid.replaceChildren(); document.getElementById('reel-total').textContent = rows.length; document.getElementById('reel-likes-total').textContent = rows.reduce((sum, row) => sum + Number(row.like_count || 0), 0); status.textContent = `${rows.length} ${rows.length === 1 ? 'Reel' : 'Reels'}`;
    if (!rows.length) { grid.innerHTML = '<p class="profile-reel-empty">No published Reels yet.</p>'; return; }
    const signedUrls = await Promise.all(rows.map(async (row) => { try { const { data } = await client.storage.from('iqzodiac-media').createSignedUrl(row.media_path, 900); return data?.signedUrl || ''; } catch { return ''; } }));
    rows.forEach((row, index) => { const card = document.createElement('article'); card.className = 'profile-reel-card'; const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.preload = 'none'; video.muted = true; video.dataset.src = signedUrls[index]; video.setAttribute('aria-label', 'Published Reel'); const copy = document.createElement('div'); copy.className = 'profile-reel-card-copy'; copy.innerHTML = `<p class="profile-reel-date">${escapeHTML(formatDate(row.created_at))} · ${Number(row.duration_seconds || 0).toFixed(0)}s · ${Number(row.like_count || 0)} likes</p>${row.caption ? `<p class="profile-reel-caption">${escapeHTML(row.caption)}</p>` : ''}`; card.append(video, copy); grid.append(card); lazyVideos.observe(video); });
  };

  (async () => {
    try {
      const client = await clientReady();
      const { data: sessionData } = await client.auth.getSession();
      const userId = new URLSearchParams(window.location.search).get('user') || sessionData.session?.user?.id;
      if (!userId) throw new Error('no-user');
      const [{ data: profile }, { data: reels, error }] = await Promise.all([
        client.from('profiles').select('user_id,display_name,handle').eq('user_id', userId).maybeSingle(),
        client.from('reels').select('id,caption,media_path,duration_seconds,created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(24),
      ]);
      if (error) throw error;
      setProfile(profile);
      const ids = (reels || []).map((row) => row.id);
      let likeRows = [];
      if (ids.length) { const result = await client.from('reel_likes').select('reel_id').in('reel_id', ids).limit(1000); likeRows = result.data || []; }
      const counts = likeRows.reduce((map, row) => map.set(row.reel_id, (map.get(row.reel_id) || 0) + 1), new Map());
      await render((reels || []).map((row) => ({ ...row, like_count: counts.get(row.id) || 0 })), client);
    } catch (error) { console.warn('Reel profile could not be loaded.', error); status.textContent = 'Unavailable'; grid.innerHTML = '<p class="profile-reel-empty">This profile could not be loaded right now.</p>'; }
  })();
})();
