(() => {
  'use strict';
  const loading = document.querySelector('#admin-loading');
  const content = document.querySelector('#admin-content');
  const errorBox = document.querySelector('#admin-error');
  const showError = (message) => { loading.hidden = true; errorBox.hidden = false; errorBox.textContent = message; };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  (async () => {
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data: session } = await client.auth.getSession();
      if (!session.session) { showError('This private area requires an authenticated owner account.'); return; }
      const { data: allowed, error: accessError } = await client.rpc('iqzodiac_is_admin');
      if (accessError || allowed !== true) { showError('Access is restricted to the verified site owner.'); return; }
      const [{ data: profiles, error: profilesError, count: profileCount }, { data: media, error: mediaError, count: mediaCount }] = await Promise.all([
        client.from('profiles').select('display_name,handle,country,city,preferred_language,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(25),
        client.from('profile_media').select('id', { count: 'exact', head: true }),
      ]);
      if (profilesError || mediaError) throw profilesError || mediaError;
      document.querySelector('#member-count').textContent = Number(profileCount || 0).toLocaleString();
      document.querySelector('#media-count-admin').textContent = Number(mediaCount || 0).toLocaleString();
      const rows = (profiles || []).map((profile) => `<tr><td>${escapeHTML(profile.display_name)}</td><td>${escapeHTML(profile.handle)}</td><td>${escapeHTML([profile.city, profile.country].filter(Boolean).join(', ') || '—')}</td><td>${escapeHTML(profile.preferred_language || 'en')}</td><td>${escapeHTML(new Date(profile.created_at).toLocaleDateString())}</td></tr>`).join('');
      document.querySelector('#profiles-table').innerHTML = rows ? `<table class="admin-table"><thead><tr><th>Name</th><th>Handle</th><th>Location</th><th>Language</th><th>Joined</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="admin-status">No profiles are available.</p>';
      loading.hidden = true; content.hidden = false;
    } catch (error) { console.warn('Administration could not be loaded.', error); showError('The private administration area is temporarily unavailable.'); }
  })();
})();
