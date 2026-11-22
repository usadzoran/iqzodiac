(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const form = $('#ad-form');
  const list = $('#ads-list');
  const status = $('#ads-status');
  const preview = $('#ad-preview');
  const submit = $('#ad-submit');
  let client;
  let editingId = null;

  const placementLabels = { header: 'Header', hero: 'Hero', feed_between: 'Between posts', reels_between: 'Between Reels', footer: 'Footer' };
  const setStatus = (message, error = false) => { status.textContent = message; status.dataset.error = error ? 'true' : 'false'; };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const frame = (html, height) => { const iframe = document.createElement('iframe'); iframe.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox'); iframe.referrerPolicy = 'no-referrer'; iframe.style.height = `${Math.max(40, Math.min(600, Number(height) || 100))}px`; iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden}body{font-family:system-ui,sans-serif}</style></head><body>${html}</body></html>`; return iframe; };
  const reset = () => { form.reset(); $('#ad-id').value = ''; $('#ad-height').value = '100'; $('#ad-priority').value = '0'; $('#ad-active').checked = false; editingId = null; submit.textContent = 'Create advertisement'; preview.replaceChildren(); };
  const readForm = () => ({ name: $('#ad-name').value.trim(), placement: $('#ad-placement').value, html_code: $('#ad-html').value, height_px: Number($('#ad-height').value), priority: Number($('#ad-priority').value), is_active: $('#ad-active').checked });
  const showPreview = () => { const value = readForm(); preview.replaceChildren(frame(value.html_code, value.height_px)); };

  const load = async () => {
    const { data, error } = await client.from('site_ads').select('id,name,placement,html_code,height_px,priority,is_active,starts_at,ends_at,created_at').order('updated_at', { ascending: false }).limit(200);
    if (error) throw error;
    list.replaceChildren();
    if (!data?.length) { list.innerHTML = '<p class="ads-status">No advertisements yet.</p>'; return; }
    data.forEach((ad) => {
      const item = document.createElement('article'); item.className = 'ads-item';
      item.innerHTML = `<div><strong>${escape(ad.name)}</strong><small>${escape(placementLabels[ad.placement] || ad.placement)} · priority ${ad.priority}</small><span class="ads-pill ${ad.is_active ? '' : 'off'}">${ad.is_active ? 'Active' : 'Draft'}</span></div><div class="ads-item-actions"><button class="ads-button" type="button" data-edit="${ad.id}">Edit</button><button class="ads-button danger" type="button" data-delete="${ad.id}">Delete</button></div>`;
      list.append(item);
    });
    list._ads = data;
  };

  const save = async (event) => {
    event.preventDefault();
    const value = readForm();
    if (!value.name || !value.html_code.trim()) { setStatus('Name and HTML code are required.', true); return; }
    submit.disabled = true; setStatus('Saving…');
    try {
      const payload = { ...value, html_code: value.html_code.trim() };
      const result = editingId ? await client.from('site_ads').update(payload).eq('id', editingId) : await client.from('site_ads').insert({ ...payload, created_by: (await client.auth.getUser()).data.user.id });
      if (result.error) throw result.error;
      reset(); await load(); setStatus('Advertisement saved.');
    } catch (error) { setStatus(error.message || 'Could not save advertisement.', true); } finally { submit.disabled = false; }
  };

  const edit = (ad) => { editingId = ad.id; $('#ad-name').value = ad.name; $('#ad-placement').value = ad.placement; $('#ad-html').value = ad.html_code; $('#ad-height').value = ad.height_px; $('#ad-priority').value = ad.priority; $('#ad-active').checked = ad.is_active; submit.textContent = 'Update advertisement'; showPreview(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (id) => { if (!window.confirm('Delete this advertisement?')) return; const { error } = await client.from('site_ads').delete().eq('id', id); if (error) { setStatus(error.message, true); return; } await load(); setStatus('Advertisement deleted.'); };

  const init = async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data: session } = await client.auth.getSession();
      if (!session.session) { window.location.replace('./login.html?next=./ads-manager.html'); return; }
      const { data: allowed, error } = await client.rpc('iqzodiac_is_admin');
      if (error || allowed !== true) { $('#ads-loading').hidden = true; $('#ads-denied').hidden = false; return; }
      $('#ads-loading').hidden = true; $('#ads-content').hidden = false;
      form.addEventListener('submit', save); $('#ad-preview-button').addEventListener('click', showPreview); $('#ad-reset').addEventListener('click', reset);
      list.addEventListener('click', (event) => { const editId = event.target.dataset.edit; const deleteId = event.target.dataset.delete; const ads = list._ads || []; if (editId) edit(ads.find((item) => item.id === editId)); if (deleteId) void remove(deleteId); });
      await load();
    } catch (error) { $('#ads-loading').hidden = true; $('#ads-denied').hidden = false; setStatus('Ads Manager is temporarily unavailable.', true); }
  };
  void init();
})();
