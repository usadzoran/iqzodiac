(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#ad-form');
  const list = $('#ads-list');
  const status = $('#ads-status');
  const preview = $('#ad-preview');
  const actionButtons = [...document.querySelectorAll('[data-ad-action]')];
  const sectionChoices = [...document.querySelectorAll('.ad-section-choice')];
  const placementChoices = [...document.querySelectorAll('.ad-placement-choice')];
  let client;
  let editingId = null;

  const sectionLabels = { all: 'كل الصفحات المدعومة', home: 'الرئيسية', reels: 'Reels', discover: 'اكتشف', profile: 'الملف الشخصي', daily: 'اليومي', marketplace: 'السوق', live: 'الغرف المباشرة' };
  const placementLabels = { header: 'رأس الصفحة', hero: 'المساحة الرئيسية', feed_between: 'بين المنشورات', reels_between: 'بين مقاطع Reels', footer: 'أسفل الصفحة' };
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
  const checkedValues = (choices) => choices.filter((choice) => choice.checked).map((choice) => choice.value);
  const normalizedSections = (ad) => Array.isArray(ad.sections) && ad.sections.length ? ad.sections : [ad.placement === 'reels_between' ? 'reels' : 'home'];
  const normalizedPlacements = (ad) => Array.isArray(ad.placements) && ad.placements.length ? ad.placements : [ad.placement];
  const placementsBySection = { home: ['header', 'hero', 'feed_between', 'footer'], reels: ['header', 'reels_between', 'footer'] };
  const targetCompatibility = (sections, placements) => {
    const targetSections = sections.includes('all') ? ['home', 'reels'] : sections;
    const unsupportedPlacements = placements.filter((placement) => !targetSections.some((section) => placementsBySection[section]?.includes(placement)));
    const uncoveredSections = targetSections.filter((section) => !placements.some((placement) => placementsBySection[section]?.includes(placement)));
    return { valid: !unsupportedPlacements.length && !uncoveredSections.length, unsupportedPlacements, uncoveredSections };
  };

  const updateSummary = () => {
    const sections = checkedValues(sectionChoices);
    const placements = checkedValues(placementChoices);
    const summary = $('#ad-target-summary');
    if (!sections.length || !placements.length) {
      summary.textContent = 'اختر صفحة مدعومة وموضعًا واحدًا على الأقل.';
      summary.dataset.ready = 'false';
      return false;
    }
    const compatibility = targetCompatibility(sections, placements);
    if (!compatibility.valid) {
      summary.textContent = compatibility.unsupportedPlacements.length
        ? `موضع ${placementLabels[compatibility.unsupportedPlacements[0]]} غير متاح ضمن الصفحات المختارة.`
        : 'اختر موضعًا متاحًا لكل صفحة مختارة؛ راجع وصف مواضع Home وReels.';
      summary.dataset.ready = 'false';
      return false;
    }
    summary.textContent = `${sections.map((value) => sectionLabels[value] || value).join(' + ')} · ${placements.map((value) => placementLabels[value] || value).join(' + ')}`;
    summary.dataset.ready = 'true';
    return true;
  };

  const syncSectionChoices = (changed) => {
    if (changed.value === 'all' && changed.checked) sectionChoices.filter((choice) => choice !== changed).forEach((choice) => { choice.checked = false; });
    if (changed.value !== 'all' && changed.checked) {
      const all = sectionChoices.find((choice) => choice.value === 'all');
      if (all) all.checked = false;
    }
    updateSummary();
  };

  const setChoices = (choices, values) => choices.forEach((choice) => { choice.checked = values.includes(choice.value); });
  const reset = () => {
    form.reset();
    $('#ad-id').value = '';
    $('#ad-height').value = '100';
    $('#ad-priority').value = '0';
    setChoices(sectionChoices, ['all']);
    setChoices(placementChoices, ['header']);
    editingId = null;
    preview.replaceChildren();
    preview.hidden = true;
    setStatus('');
    updateSummary();
  };
  const readForm = (action) => ({
    name: $('#ad-name').value.trim(),
    sections: checkedValues(sectionChoices),
    placements: checkedValues(placementChoices),
    html_code: $('#ad-html').value,
    height_px: Number($('#ad-height').value),
    priority: Number($('#ad-priority').value),
    is_active: action === 'publish'
  });
  const showPreview = () => {
    const value = readForm('draft');
    if (!value.html_code.trim()) {
      setStatus('أضف محتوى HTML قبل فتح المعاينة.', 'error');
      $('#ad-html').focus();
      return;
    }
    preview.replaceChildren(frame(value.html_code, value.height_px));
    preview.hidden = false;
  };

  const friendlyError = (error) => {
    const code = String(error?.code || error?.status || '');
    const message = String(error?.message || '');
    if (code === 'NO_ROW_RETURNED') return 'لم يُرجع النظام إعلانًا محفوظًا؛ لم تُمسح بيانات النموذج. أعد المحاولة.';
    if (code === 'AUTH_REQUIRED' || code === '401' || code === '403' || code === '42501' || /permission|row-level security|not authenticated/i.test(message)) return 'تعذر الحفظ بصلاحية الحساب الحالية. تحقّق من تسجيل الدخول وصلاحية مسؤول الإعلانات.';
    if (/failed to fetch|network|fetch/i.test(message)) return 'تعذر الاتصال بقاعدة البيانات. بقيت بياناتك في النموذج؛ افحص الاتصال ثم أعد المحاولة.';
    return `لم يُحفظ الإعلان؛ بقيت بياناتك في النموذج. أعد المحاولة${code ? ` (الرمز ${escape(code)})` : ''}.`;
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
      target.innerHTML = '<p class="ads-status">لا توجد إحصاءات بعد. ستظهر عند بدء عرض إعلان منشور.</p>';
      return;
    }
    target.innerHTML = rows.map((row) => `<div class="ads-analytics-row"><div><strong>${escape(row.name)}</strong><small class="ads-pill ${row.is_active ? '' : 'off'}">${row.is_active ? 'منشور' : 'مسودة'}</small></div><div class="ads-analytics-values"><span><b>${Number(row.views || 0).toLocaleString()}</b> مشاهدة</span><span><b>${Number(row.clicks || 0).toLocaleString()}</b> نقرة</span><span><b>${Number(row.ctr || 0).toFixed(2)}%</b> معدل النقر</span></div></div>`).join('');
  };

  const load = async () => {
    const { data, error } = await client.from('site_ads').select('id,name,placement,placements,sections,html_code,height_px,priority,is_active,starts_at,ends_at,created_at,updated_at').order('updated_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ads = data || [];
    list.replaceChildren();
    list._ads = ads;
    $('#ads-count').textContent = String(ads.length);
    if (!ads.length) {
      list.innerHTML = '<p class="ads-status">لا توجد إعلانات محفوظة بعد.</p>';
      return;
    }
    ads.forEach((ad) => {
      const sections = normalizedSections(ad);
      const placements = normalizedPlacements(ad);
      const item = document.createElement('article');
      item.className = 'ads-item';
      item.innerHTML = `<div><strong>${escape(ad.name)}</strong><small>${sections.map((value) => escape(sectionLabels[value] || value)).join(' · ')}</small><div class="ads-item-tags">${placements.map((value) => `<span>${escape(placementLabels[value] || value)}</span>`).join('')}</div><span class="ads-pill ${ad.is_active ? '' : 'off'}">${ad.is_active ? 'منشور' : 'مسودة'}</span></div><div class="ads-item-actions"><button class="ads-button" type="button" data-edit="${escape(ad.id)}">تعديل</button><button class="ads-button danger" type="button" data-delete="${escape(ad.id)}">حذف</button></div>`;
      list.append(item);
    });
  };

  const save = async (event) => {
    event.preventDefault();
    const action = event.submitter?.dataset.adAction || 'publish';
    const value = readForm(action);
    if (!value.name || !value.html_code.trim()) {
      setStatus('أدخل اسم الإعلان ومحتوى HTML أولًا.', 'error');
      return;
    }
    if (!value.sections.length || !value.placements.length) {
      setStatus('اختر صفحة مدعومة وموضعًا واحدًا على الأقل من الخيارات المتقدمة.', 'error');
      $('#ad-target-options').open = true;
      updateSummary();
      return;
    }
    if (!targetCompatibility(value.sections, value.placements).valid) {
      setStatus('الاستهداف لا يطابق مواضع موجودة في الصفحات المختارة. عدّل الخيارات؛ بقيت بيانات الإعلان كما هي.', 'error');
      $('#ad-target-options').open = true;
      updateSummary();
      return;
    }
    if (!Number.isFinite(value.height_px) || value.height_px < 40 || value.height_px > 600 || !Number.isFinite(value.priority)) {
      setStatus('تحقق من الارتفاع والأولوية؛ الارتفاع المقبول من ٤٠ إلى ٦٠٠ بكسل.', 'error');
      $('#ad-target-options').open = true;
      return;
    }

    actionButtons.forEach((button) => { button.disabled = true; });
    setStatus(action === 'publish' ? 'جارٍ حفظ الإعلان المنشور…' : 'جارٍ حفظ المسودة…');
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

      const selectedPages = value.sections.includes('all') ? 'كل الصفحات المدعومة (Home وReels)' : value.sections.map((section) => sectionLabels[section] || section).join(' و');
      const successMessage = action === 'publish'
        ? `تم حفظ الإعلان ونشره. سيظهر للزوار في ${selectedPages} ضمن مواضع العرض المختارة.`
        : 'تم حفظ الإعلان كمسودة؛ لن يظهر للزوار حتى تنشره.';
      reset();
      setStatus(successMessage);
      try {
        await load();
      } catch {
        setStatus(`${successMessage} تعذر تحديث قائمة الحملات الآن؛ أعد تحميل الصفحة للتحقق.`, 'warning');
      }
      try {
        await loadAnalytics();
      } catch {
        $('#ads-analytics-list').innerHTML = '<p class="ads-status">تم حفظ الإعلان؛ تعذر تحديث الإحصاءات الآن. استخدم زر التحديث لاحقًا.</p>';
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
    setChoices(sectionChoices, normalizedSections(ad));
    setChoices(placementChoices, normalizedPlacements(ad));
    preview.replaceChildren();
    preview.hidden = true;
    updateSummary();
    showPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الإعلان نهائيًا؟')) return;
    try {
      const { data, error } = await client.from('site_ads').delete().eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data?.id) throw Object.assign(new Error('No persisted advertisement was returned'), { code: 'NO_ROW_RETURNED' });
      await load();
      setStatus('تم حذف الإعلان.');
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
        $('#ads-denied-message').textContent = 'هذا الاستوديو متاح فقط لمسؤول الإعلانات المصرح له.';
        return;
      }

      $('#ads-loading').hidden = true;
      $('#ads-content').hidden = false;
      sectionChoices.forEach((choice) => choice.addEventListener('change', () => syncSectionChoices(choice)));
      placementChoices.forEach((choice) => choice.addEventListener('change', updateSummary));
      form.addEventListener('submit', (event) => { void save(event); });
      $('#ad-preview-button').addEventListener('click', showPreview);
      $('#ad-reset').addEventListener('click', reset);
      $('#ads-refresh-analytics').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await loadAnalytics();
        } catch {
          $('#ads-analytics-list').innerHTML = '<p class="ads-status">تعذر تحميل الإحصاءات. تحقق من الاتصال ثم أعد المحاولة.</p>';
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
      updateSummary();
      try {
        await load();
      } catch {
        list.innerHTML = '<p class="ads-status">تعذر تحميل الإعلانات المحفوظة. تحقق من الاتصال ثم أعد تحميل الصفحة.</p>';
      }
      try {
        await loadAnalytics();
      } catch {
        $('#ads-analytics-list').innerHTML = '<p class="ads-status">تعذر تحميل الإحصاءات؛ يمكنك إعادة المحاولة من زر التحديث.</p>';
      }
    } catch {
      $('#ads-loading').hidden = true;
      $('#ads-denied').hidden = false;
      $('#ads-denied-message').textContent = 'تعذر التحقق من صلاحية الدخول الآن. أعد تحميل الصفحة أو تحقق من اتصالك.';
    }
  };

  void init();
})();
