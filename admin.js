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
      const [{ data: profiles, error: profilesError, count: profileCount }, { data: media, error: mediaError, count: mediaCount }, { data: categories, error: categoriesError }] = await Promise.all([
        client.from('profiles').select('display_name,handle,country,city,preferred_language,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(25),
        client.from('profile_media').select('id', { count: 'exact', head: true }),
        client.from('marketplace_categories').select('id,kind,slug,name_en,name_ar,is_active,sort_order').order('sort_order').limit(100),
      ]);
      if (profilesError || mediaError || categoriesError) throw profilesError || mediaError || categoriesError;
      document.querySelector('#member-count').textContent = Number(profileCount || 0).toLocaleString();
      document.querySelector('#media-count-admin').textContent = Number(mediaCount || 0).toLocaleString();
      const rows = (profiles || []).map((profile) => `<tr><td>${escapeHTML(profile.display_name)}</td><td>${escapeHTML(profile.handle)}</td><td>${escapeHTML([profile.city, profile.country].filter(Boolean).join(', ') || '—')}</td><td>${escapeHTML(profile.preferred_language || 'en')}</td><td>${escapeHTML(new Date(profile.created_at).toLocaleDateString())}</td></tr>`).join('');
      document.querySelector('#profiles-table').innerHTML = rows ? `<table class="admin-table"><thead><tr><th>Name</th><th>Handle</th><th>Location</th><th>Language</th><th>Joined</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="admin-status">No profiles are available.</p>';
      const categoryRows = (categories || []).map((category) => `<tr><td>${escapeHTML(category.name_en)}</td><td dir="rtl">${escapeHTML(category.name_ar)}</td><td>${escapeHTML(category.kind)}</td><td>${category.is_active ? 'Visible' : 'Hidden'}</td><td><button type="button" class="category-toggle" data-category-id="${category.id}" data-category-active="${category.is_active}">${category.is_active ? 'Hide' : 'Show'}</button></td></tr>`).join('');
      document.querySelector('#market-category-table').innerHTML = categoryRows ? `<table class="admin-table"><thead><tr><th>English</th><th>Arabic</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>${categoryRows}</tbody></table>` : '<p class="admin-status">No Marketplace categories are available.</p>';
      document.querySelector('#market-category-form').addEventListener('submit', async (event) => { event.preventDefault(); const kind = document.querySelector('#market-category-kind').value; const nameEn = document.querySelector('#market-category-en').value.trim(); const nameAr = document.querySelector('#market-category-ar').value.trim(); const slug = `${kind}-${nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`; const { error } = await client.from('marketplace_categories').insert({ kind, slug, name_en: nameEn, name_ar: nameAr, sort_order: 500 }); if (error) { alert(error.message); return; } location.reload(); });
      document.querySelectorAll('.category-toggle').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; await client.from('marketplace_categories').update({ is_active: button.dataset.categoryActive !== 'true' }).eq('id', button.dataset.categoryId); location.reload(); }));
      loading.hidden = true; content.hidden = false;
    } catch (error) { console.warn('Administration could not be loaded.', error); showError('The private administration area is temporarily unavailable.'); }
  })();
})();
