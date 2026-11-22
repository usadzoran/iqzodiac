(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#ad-form');
  const list = $('#ads-list');
  const status = $('#ads-status');
  const preview = $('#ad-preview');
  const submit = $('#ad-submit');
  const sectionChoices = [...document.querySelectorAll('.ad-section-choice')];
  const placementChoices = [...document.querySelectorAll('.ad-placement-choice')];
  let client;
  let editingId = null;

  const sectionLabels = { all: 'All eligible sections', home: 'Home', reels: 'Reels', discover: 'Discover', profile: 'Profile', daily: 'Daily', marketplace: 'Marketplace', live: 'Live rooms' };
  const placementLabels = { header: 'Header', hero: 'Hero', feed_between: 'Between posts', reels_between: 'Between Reels', footer: 'Footer' };
  const setStatus = (message, error = false) => { status.textContent = message; status.dataset.error = error ? 'true' : 'false'; };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const frame = (html, height) => { const iframe = document.createElement('iframe'); iframe.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox'); iframe.referrerPolicy = 'no-referrer'; iframe.style.height = `${Math.max(40, Math.min(600, Number(height) || 100))}px`; iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden}body{font-family:system-ui,sans-serif}</style></head><body>${html}</body></html>`; return iframe; };
  const checkedValues = (choices) => choices.filter((choice) => choice.checked).map((choice) => choice.value);
  const normalizedSections = (ad) => Array.isArray(ad.sections) && ad.sections.length ? ad.sections : [ad.placement === 'reels_between' ? 'reels' : 'home'];
  const normalizedPlacements = (ad) => Array.isArray(ad.placements) && ad.placements.length ? ad.placements : [ad.placement];

  const updateSummary = () => {
    const sections = checkedValues(sectionChoices);
    const placements = checkedValues(placementChoices);
    const summary = $('#ad-target-summary');
    if (!sections.length || !placements.length) { summary.textContent = 'Choose at least one section and one position.'; summary.dataset.ready = 'false'; return false; }
    summary.textContent = `${sections.map((value) => sectionLabels[value]).join(' + ')}  ·  ${placements.map((value) => placementLabels[value]).join(' + ')}`;
    summary.dataset.ready = 'true';
    return true;
  };

  const syncSectionChoices = (changed) => {
    if (changed.value === 'all' && changed.checked) sectionChoices.filter((choice) => choice !== changed).forEach((choice) => { choice.checked = false; });
    if (changed.value !== 'all' && changed.checked) { const all = sectionChoices.find((choice) => choice.value === 'all'); if (all) all.checked = false; }
    updateSummary();
  };

  const setChoices = (choices, values) => choices.forEach((choice) => { choice.checked = values.includes(choice.value); });
  const reset = () => { form.reset(); $('#ad-id').value = ''; $('#ad-height').value = '100'; $('#ad-priority').value = '0'; setChoices(sectionChoices, []); setChoices(placementChoices, []); editingId = null; submit.textContent = 'Create advertisement'; preview.replaceChildren(); updateSummary(); };
  const readForm = () => ({ name: $('#ad-name').value.trim(), sections: checkedValues(sectionChoices), placements: checkedValues(placementChoices), html_code: $('#ad-html').value, height_px: Number($('#ad-height').value), priority: Number($('#ad-priority').value), is_active: $('#ad-active').checked });
  const showPreview = () => { const value = readForm(); preview.replaceChildren(frame(value.html_code, value.height_px)); };

  const loadAnalytics = async () => {
    const target = $('#ads-analytics-list');
    const { data, error } = await client.rpc('iqzodiac_site_ads_analytics');
    if (error) throw error;
    const rows = data || [];
    const views = rows.reduce((sum, row) => sum + Number(row.views || 0), 0);
    const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    $('#ads-total-views').textContent = views.toLocaleString();
    $('#ads-total-clicks').textContent = clicks.toLocaleString();
    $('#ads-average-ctr').textContent = `${views ? ((clicks / views) * 100).toFixed(2) : '0.00'}%`;
    if (!rows.length) { target.innerHTML = '<p class="ads-status">No analytics yet. Publish an advertisement to start collecting data.</p>'; return; }
    target.innerHTML = rows.map((row) => `<div class="ads-analytics-row"><div><strong>${escape(row.name)}</strong><small class="ads-pill ${row.is_active ? '' : 'off'}">${row.is_active ? 'Active' : 'Draft'}</small></div><div class="ads-analytics-values"><span><b>${Number(row.views || 0).toLocaleString()}</b> views</span><span><b>${Number(row.clicks || 0).toLocaleString()}</b> clicks</span><span><b>${Number(row.ctr || 0).toFixed(2)}%</b> CTR</span></div></div>`).join('');
  };

  const load = async () => {
    const { data, error } = await client.from('site_ads').select('id,name,placement,placements,sections,html_code,height_px,priority,is_active,starts_at,ends_at,created_at').order('updated_at', { ascending: false }).limit(200);
    if (error) throw error;
    list.replaceChildren();
    $('#ads-count').textContent = String(data?.length || 0);
    if (!data?.length) { list.innerHTML = '<p class="ads-status">No advertisements yet.</p>'; return; }
    data.forEach((ad) => {
      const sections = normalizedSections(ad); const placements = normalizedPlacements(ad);
      const item = document.createElement('article'); item.className = 'ads-item';
      item.innerHTML = `<div><strong>${escape(ad.name)}</strong><small>${sections.map((value) => escape(sectionLabels[value] || value)).join(' · ')}</small><div class="ads-item-tags">${placements.map((value) => `<span>${escape(placementLabels[value] || value)}</span>`).join('')}</div><span class="ads-pill ${ad.is_active ? '' : 'off'}">${ad.is_active ? 'Active' : 'Draft'}</span></div><div class="ads-item-actions"><button class="ads-button" type="button" data-edit="${ad.id}">Edit</button><button class="ads-button danger" type="button" data-delete="${ad.id}">Delete</button></div>`;
      list.append(item);
    });
    list._ads = data;
  };

  const save = async (event) => {
    event.preventDefault();
    const value = readForm();
    if (!value.name || !value.html_code.trim()) { setStatus('Campaign name and HTML code are required.', true); return; }
    if (!value.sections.length || !value.placements.length) { setStatus('Select at least one section and one ad position.', true); updateSummary(); return; }
    submit.disabled = true; setStatus('Saving…');
    try {
      const payload = { ...value, placement: value.placements[0], html_code: value.html_code.trim() };
      const result = editingId ? await client.from('site_ads').update(payload).eq('id', editingId) : await client.from('site_ads').insert({ ...payload, created_by: (await client.auth.getUser()).data.user.id });
      if (result.error) throw result.error;
      reset(); await load(); await loadAnalytics(); setStatus('Advertisement saved.');
    } catch (error) { setStatus(error.message || 'Could not save advertisement.', true); } finally { submit.disabled = false; }
  };

  const edit = (ad) => { editingId = ad.id; $('#ad-name').value = ad.name; $('#ad-html').value = ad.html_code; $('#ad-height').value = ad.height_px; $('#ad-priority').value = ad.priority; $('#ad-active').checked = ad.is_active; setChoices(sectionChoices, normalizedSections(ad)); setChoices(placementChoices, normalizedPlacements(ad)); submit.textContent = 'Update advertisement'; updateSummary(); showPreview(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (id) => { if (!window.confirm('Delete this advertisement?')) return; const { error } = await client.from('site_ads').delete().eq('id', id); if (error) { setStatus(error.message, true); return; } await load(); setStatus('Advertisement deleted.'); };

  const init = async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data: session } = await client.auth.getSession();
      if (!session.session) { window.location.replace('./login.html?next=./orbit-ads-studio-7f3a91c2.html'); return; }
      const { data: allowed, error } = await client.rpc('iqzodiac_is_admin');
      if (error || allowed !== true) { $('#ads-loading').hidden = true; $('#ads-denied').hidden = false; return; }
      $('#ads-loading').hidden = true; $('#ads-content').hidden = false;
      sectionChoices.forEach((choice) => choice.addEventListener('change', () => syncSectionChoices(choice)));
      placementChoices.forEach((choice) => choice.addEventListener('change', updateSummary));
      form.addEventListener('submit', save); $('#ad-preview-button').addEventListener('click', showPreview); $('#ad-reset').addEventListener('click', reset);
      $('#ads-refresh-analytics').addEventListener('click', () => loadAnalytics().catch((error) => setStatus(error.message || 'Could not load analytics.', true)));
      list.addEventListener('click', (event) => { const editId = event.target.dataset.edit; const deleteId = event.target.dataset.delete; const ads = list._ads || []; if (editId) edit(ads.find((item) => item.id === editId)); if (deleteId) void remove(deleteId); });
      updateSummary(); await load(); await loadAnalytics();
    } catch (error) { $('#ads-loading').hidden = true; $('#ads-denied').hidden = false; setStatus('Ads Manager is temporarily unavailable.', true); }
  };
  void init();
})();
