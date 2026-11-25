(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#ad-form');
  const list = $('#ads-list');
  const status = $('#ads-status');
  const preview = $('#ad-preview');
  const actionButtons = [...document.querySelectorAll('[data-ad-action]')];
  const sectionSelect = $('#ad-section');
  const placementSelect = $('#ad-placement');
  const supportedPages = [
    { value: 'home', label: 'Home' },
    { value: 'reels', label: 'Reels' },
    { value: 'discover', label: 'Discover' },
    { value: 'profile', label: 'Profile' },
    { value: 'reel_profile', label: 'Reel profiles' },
    { value: 'daily', label: 'Daily news & weather' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'live', label: 'Live rooms' },
    { value: 'audio_rooms', label: 'Audio rooms' },
    { value: 'rooms', label: 'Spaces hub' },
    { value: 'messages', label: 'Messages' },
    { value: 'match', label: 'Match' },
    { value: 'movies', label: 'Movies' },
    { value: 'vip', label: 'VIP' },
    { value: 'vip_live', label: 'VIP Live' },
    { value: 'wallet', label: 'Wallet' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'landing', label: 'Landing page' }
  ];
  const allPlacements = ['header', 'hero', 'footer'];
  const placementsByPage = {
    home: ['header', 'hero', 'feed_between', 'footer'],
    reels: ['header', 'hero', 'reels_between', 'footer']
  };
  const placementLabels = {
    header: 'Header — after page heading/navigation',
    hero: 'Main content — after the introduction',
    feed_between: 'Between posts — after 3 posts (Home)',
    reels_between: 'Between Reels — after 3 videos (Reels)',
    footer: 'Footer — near the bottom of the page'
  };
  const sectionLabels = Object.fromEntries(supportedPages.map(({ value, label }) => [value, label]));
  sectionLabels.all = 'All supported content and member pages';
  let client;
  let editingId = null;
  let editingTarget = null;

  const setStatus = (message, kind = 'info') => {
    status.textContent = message;
    status.dataset.error = kind === 'error' ? 'true' : 'false';
    status.dataset.warning = kind === 'warning' ? 'true' : 'false';
  };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const frame = (html, height) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox');
    iframe.referrerPolicy = 'no-referrer';
    iframe.style.height = `${Math.max(40, Math.min(600, Number(height) || 100))}px`;
    iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden}body{font-family:system-ui,sans-serif}</style></head><body>${html}</body></html>`;
    return iframe;
  };
  const normalizedSections = (ad) => Array.isArray(ad.sections) && ad.sections.length ? ad.sections : [ad.placement === 'reels_between' ? 'reels' : 'home'];
  const normalizedPlacements = (ad) => Array.isArray(ad.placements) && ad.placements.length ? ad.placements : [ad.placement];
  const placementsForSections = (sections) => {
    const pages = sections.includes('all') ? supportedPages.map(({ value }) => value) : sections;
    return allPlacements.concat(['feed_between', 'reels_between']).filter((placement) => pages.length > 0 && pages.every((page) => (placementsByPage[page] || allPlacements).includes(placement)));
  };
  const targetCompatibility = (sections, placements) => {
    const available = placementsForSections(sections);
    return sections.length > 0 && placements.length > 0 && placements.every((placement) => available.includes(placement));
  };
  const makeOption = (value, label) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  };
  const buildSectionOptions = (preservedLabel = '') => {
    sectionSelect.replaceChildren(makeOption('all', sectionLabels.all));
    supportedPages.forEach(({ value, label }) => sectionSelect.append(makeOption(value, label)));
    if (preservedLabel) sectionSelect.prepend(makeOption('__saved__', `Keep current targeting — ${preservedLabel}`));
  };
  const buildPlacementOptions = (sections, preferred = '', preservedLabel = '') => {
    placementSelect.replaceChildren();
    const available = placementsForSections(sections);
    if (preservedLabel) placementSelect.append(makeOption('__saved__', `Keep current placement — ${preservedLabel}`));
    available.forEach((value) => placementSelect.append(makeOption(value, placementLabels[value] || value)));
    if (preferred && available.includes(preferred)) placementSelect.value = preferred;
    else if (available.length) placementSelect.value = available[0];
  };
  const showSummary = () => {
    const summary = $('#ad-target-summary');
    if (editingTarget && sectionSelect.value === '__saved__' && placementSelect.value === '__saved__') {
      const pages = editingTarget.sections.map((value) => sectionLabels[value] || value).join(' + ');
      const placements = editingTarget.placements.map((value) => placementLabels[value] || value).join(' + ');
      summary.textContent = `Keeping this saved campaign's targeting: ${pages} · ${placements}. Change both lists to replace it.`;
      summary.dataset.ready = 'true';
      return true;
    }
    const section = sectionSelect.value;
    const placement = placementSelect.value;
    if (!section || section === '__saved__' || !placement || placement === '__saved__') {
      summary.textContent = 'Choose both a page and a compatible placement.';
      summary.dataset.ready = 'false';
      return false;
    }
    summary.textContent = `${sectionLabels[section] || section} · ${placementLabels[placement] || placement}`;
    summary.dataset.ready = 'true';
    return true;
  };
  const reset = () => {
    form.reset();
    $('#ad-id').value = '';
    $('#ad-height').value = '100';
    $('#ad-priority').value = '0';
    editingId = null;
    editingTarget = null;
    buildSectionOptions();
    sectionSelect.value = 'all';
    buildPlacementOptions(['all'], 'header');
    preview.replaceChildren();
    preview.hidden = true;
    setStatus('');
    showSummary();
  };
  const readForm = (action) => {
    let sections;
    let placements;
    if (editingTarget && sectionSelect.value === '__saved__' && placementSelect.value === '__saved__') {
      sections = editingTarget.sections.slice();
      placements = editingTarget.placements.slice();
    } else {
      sections = sectionSelect.value && sectionSelect.value !== '__saved__' ? [sectionSelect.value] : [];
      placements = placementSelect.value && placementSelect.value !== '__saved__' ? [placementSelect.value] : [];
    }
    return {
      name: $('#ad-name').value.trim(),
      sections,
      placements,
      html_code: $('#ad-html').value,
      height_px: Number($('#ad-height').value),
      priority: Number($('#ad-priority').value),
      is_active: action === 'publish'
    };
  };
  const showPreview = () => {
    const value = readForm('draft');
    if (!value.html_code.trim()) {
      setStatus('Add the HTML creative before opening the preview.', 'error');
      $('#ad-html').focus();
      return;
    }
    preview.replaceChildren(frame(value.html_code, value.height_px));
    preview.hidden = false;
  };

  const friendlyError = (error) => {
    const code = String(error?.code || error?.status || '');
    const message = String(error?.message || '');
    if (code === 'NO_ROW_RETURNED') return 'The database did not return a saved ad row. Your form is still intact; please retry.';
    if (code === 'AUTH_REQUIRED' || code === '401' || code === '403' || code === '42501' || /permission|row-level security|not authenticated/i.test(message)) return 'The current account cannot save ads. Check that you are signed in with ads administrator access.';
    if (/failed to fetch|network|fetch/i.test(message)) return 'Could not reach the database. Your form is still intact; check the connection and retry.';
    return `The ad was not saved. Your form is still intact; please retry${code ? ` (code ${escape(code)})` : ''}.`;
  };

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
    if (!rows.length) {
      target.innerHTML = '<p class="ads-status">No analytics yet. Metrics appear after a published ad is served.</p>';
      return;
    }
    target.innerHTML = rows.map((row) => `<div class="ads-analytics-row"><div><strong>${escape(row.name)}</strong><small class="ads-pill ${row.is_active ? '' : 'off'}">${row.is_active ? 'Published' : 'Draft'}</small></div><div class="ads-analytics-values"><span><b>${Number(row.views || 0).toLocaleString()}</b> views</span><span><b>${Number(row.clicks || 0).toLocaleString()}</b> clicks</span><span><b>${Number(row.ctr || 0).toFixed(2)}%</b> CTR</span></div></div>`).join('');
  };

  const load = async () => {
    const { data, error } = await client.from('site_ads').select('id,name,placement,placements,sections,html_code,height_px,priority,is_active,starts_at,ends_at,created_at,updated_at').order('updated_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ads = data || [];
    list.replaceChildren();
    list._ads = ads;
    $('#ads-count').textContent = String(ads.length);
    if (!ads.length) {
      list.innerHTML = '<p class="ads-status">No saved ads are in the database yet.</p>';
      return;
    }
    ads.forEach((ad) => {
      const sections = normalizedSections(ad);
      const placements = normalizedPlacements(ad);
      const item = document.createElement('article');
      item.className = 'ads-item';
      item.innerHTML = `<div><strong>${escape(ad.name)}</strong><small>${sections.map((value) => escape(sectionLabels[value] || value)).join(' · ')}</small><div class="ads-item-tags">${placements.map((value) => `<span>${escape(placementLabels[value] || value)}</span>`).join('')}</div><span class="ads-pill ${ad.is_active ? '' : 'off'}">${ad.is_active ? 'Published' : 'Draft'}</span></div><div class="ads-item-actions"><button class="ads-button" type="button" data-edit="${escape(ad.id)}">Edit</button><button class="ads-button danger" type="button" data-delete="${escape(ad.id)}">Delete</button></div>`;
      list.append(item);
    });
  };

  const save = async (event) => {
    event.preventDefault();
    const action = event.submitter?.dataset.adAction || 'publish';
    const value = readForm(action);
    if (!value.name || !value.html_code.trim()) {
      setStatus('Enter a campaign name and HTML creative first.', 'error');
      return;
    }
    if (!targetCompatibility(value.sections, value.placements)) {
      setStatus('Choose a page and a placement that is available on that page. Your ad data has not been changed.', 'error');
      if (sectionSelect.value === '__saved__') sectionSelect.focus();
      else placementSelect.focus();
      showSummary();
      return;
    }
    if (!Number.isFinite(value.height_px) || value.height_px < 40 || value.height_px > 600 || !Number.isFinite(value.priority)) {
      setStatus('Check the height and priority. Height must be between 40 and 600 pixels.', 'error');
      $('#ad-target-options').open = true;
      return;
    }

    actionButtons.forEach((button) => { button.disabled = true; });
    setStatus(action === 'publish' ? 'Saving and publishing the ad…' : 'Saving the draft…');
    try {
      const payload = { ...value, placement: value.placements[0], html_code: value.html_code.trim() };
      let result;
      if (editingId) {
        result = await client.from('site_ads').update(payload).eq('id', editingId).select('id').maybeSingle();
      } else {
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!userData?.user?.id) throw Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' });
        result = await client.from('site_ads').insert({ ...payload, created_by: userData.user.id }).select('id').single();
      }
      if (result.error) throw result.error;
      if (!result.data?.id) throw Object.assign(new Error('No persisted advertisement was returned'), { code: 'NO_ROW_RETURNED' });

      const selectedPages = value.sections.includes('all') ? sectionLabels.all : value.sections.map((section) => sectionLabels[section] || section).join(' and ');
      const successMessage = action === 'publish'
        ? `Ad saved and published. It is now active for visitors on ${selectedPages} at the selected placement.`
        : 'Draft saved. It will not be shown to visitors until published.';
      reset();
      setStatus(successMessage);
      try {
        await load();
      } catch {
        setStatus(`${successMessage} The database write succeeded, but the campaign list could not refresh. Reload the page to verify.`, 'warning');
      }
      try {
        await loadAnalytics();
      } catch {
        $('#ads-analytics-list').innerHTML = '<p class="ads-status">The ad was saved, but analytics could not refresh. Try again later.</p>';
      }
    } catch (error) {
      setStatus(friendlyError(error), 'error');
    } finally {
      actionButtons.forEach((button) => { button.disabled = false; });
    }
  };

  const edit = (ad) => {
    if (!ad) return;
    editingId = ad.id;
    $('#ad-id').value = ad.id;
    $('#ad-name').value = ad.name || '';
    $('#ad-html').value = ad.html_code || '';
    $('#ad-height').value = String(ad.height_px || 100);
    $('#ad-priority').value = String(ad.priority ?? 0);
    const sections = normalizedSections(ad);
    const placements = normalizedPlacements(ad);
    const knownSection = sections.length === 1 && (sections[0] === 'all' || supportedPages.some(({ value }) => value === sections[0]));
    const knownPlacement = placements.length === 1;
    const supported = sections.length === 1 && placementsForSections(sections).includes(placements[0]);
    editingTarget = { sections, placements };
    const canRepresentTarget = knownSection && knownPlacement && supported;
    const savedPagesLabel = sections.map((value) => sectionLabels[value] || value).join(' + ');
    buildSectionOptions(canRepresentTarget ? '' : savedPagesLabel);
    sectionSelect.value = canRepresentTarget ? sections[0] : '__saved__';
    const savedPlacementsLabel = placements.map((value) => placementLabels[value] || value).join(' + ');
    buildPlacementOptions(canRepresentTarget ? sections : [], canRepresentTarget ? placements[0] : '', canRepresentTarget ? '' : savedPlacementsLabel);
    if (!canRepresentTarget) placementSelect.value = '__saved__';
    preview.replaceChildren();
    preview.hidden = true;
    showSummary();
    showPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this ad permanently?')) return;
    try {
      const { data, error } = await client.from('site_ads').delete().eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data?.id) throw Object.assign(new Error('No persisted advertisement was returned'), { code: 'NO_ROW_RETURNED' });
      await load();
      setStatus('Ad deleted.');
    } catch (error) {
      setStatus(friendlyError(error), 'error');
    }
  };

  const init = async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) {
        window.location.replace('./login.html?next=./orbit-ads-studio-7f3a91c2.html');
        return;
      }
      const { data: allowed, error } = await client.rpc('iqzodiac_is_admin');
      if (error || allowed !== true) {
        $('#ads-loading').hidden = true;
        $('#ads-denied').hidden = false;
        $('#ads-denied-message').textContent = 'This studio is available only to an authorized IQZodiac ads administrator.';
        return;
      }

      $('#ads-loading').hidden = true;
      $('#ads-content').hidden = false;
      buildSectionOptions();
      sectionSelect.value = 'all';
      buildPlacementOptions(['all'], 'header');
      sectionSelect.addEventListener('change', () => {
        editingTarget = null;
        buildPlacementOptions(sectionSelect.value === '__saved__' ? [] : [sectionSelect.value]);
        showSummary();
      });
      placementSelect.addEventListener('change', () => {
        editingTarget = null;
        showSummary();
      });
      form.addEventListener('submit', (event) => { void save(event); });
      $('#ad-preview-button').addEventListener('click', showPreview);
      $('#ad-reset').addEventListener('click', reset);
      $('#ads-refresh-analytics').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await loadAnalytics();
        } catch {
          $('#ads-analytics-list').innerHTML = '<p class="ads-status">Could not load analytics. Check your connection and try again.</p>';
        } finally {
          button.disabled = false;
        }
      });
      list.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-edit]');
        const deleteButton = event.target.closest('[data-delete]');
        const ads = list._ads || [];
        if (editButton) edit(ads.find((item) => item.id === editButton.dataset.edit));
        if (deleteButton) void remove(deleteButton.dataset.delete);
      });
      showSummary();
      try {
        await load();
      } catch {
        list.innerHTML = '<p class="ads-status">Could not load saved ads. Check the connection and reload this page.</p>';
      }
      try {
        await loadAnalytics();
      } catch {
        $('#ads-analytics-list').innerHTML = '<p class="ads-status">Could not load analytics. Use the refresh button to retry.</p>';
      }
    } catch {
      $('#ads-loading').hidden = true;
      $('#ads-denied').hidden = false;
      $('#ads-denied-message').textContent = 'Could not verify access right now. Reload this page or check your connection.';
    }
  };

  reset();
  void init();
})();
