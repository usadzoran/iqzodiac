(() => {
  'use strict';

  const list = document.querySelector('#reel-stats-list');
  const chartSvg = document.querySelector('#reel-activity-chart');
  const chartMessage = document.querySelector('#chart-state-message');
  const chartTooltip = document.querySelector('#chart-tooltip');
  const chartShell = document.querySelector('.chart-shell');
  const svgNS = 'http://www.w3.org/2000/svg';
  const chartSize = { width: 900, height: 330, left: 64, right: 22, top: 20, bottom: 48 };
  const t = {
    en: {
      back: '← Back to Reels', kicker: 'YOUR CREATOR DASHBOARD', title: 'Your Reels,', titleAccent: 'in numbers.', intro: 'See how your videos are reaching your orbit. A view is counted once per signed-in viewer after at least three seconds of playback.', profile: 'Back to profile', views: 'Unique views', viewsNote: 'Across all your Reels', likes: 'Likes', likesNote: 'People who liked your videos', comments: 'Comments', commentsNote: 'Conversations started', interactions: 'Total interactions', interactionsNote: 'Likes and comments combined', listKicker: 'PERFORMANCE BY VIDEO', listTitle: 'Your published Reels', reelCount: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, loading: 'Loading your Reel analytics…', empty: 'You have not published any Reels yet. Publish your first video to see its performance here.', error: 'Your Reel analytics could not be loaded right now. Please try again later.', untitled: 'Untitled Reel', metricViews: 'Unique views', metricLikes: 'Likes', metricComments: 'Comments', openReel: 'Open Reel', tagline: 'Look inward. Move forward.',
      chartKicker: 'GROWTH OVER TIME', chartTitle: 'Views & interactions', chartDescription: 'Cumulative activity during the selected period.', chartViews: 'Unique views', chartInteractions: 'Interactions', chartRangeLabel: (days) => `Last ${days} days`, chartRangeAria: (days) => `Show the last ${days} days`, chartLegendAria: 'Show or hide a chart series', chartFootnote: 'Views are unique signed-in viewers. Interactions combine recorded likes and comments; removed activity is not included in historical totals.', chartLoading: 'Loading your activity chart…', chartUnavailable: 'The activity chart is temporarily unavailable. Your Reel totals are still shown above.', chartEmpty: 'No recorded views or interactions in this period yet.', chartSvgTitle: 'Reel views and interactions over time', chartSvgDescription: 'Cumulative unique views and interactions by day. Focus or point to a marker for details.', chartTooltipViews: (value) => `${value} views`, chartTooltipInteractions: (value) => `${value} interactions`,
    },
    ar: {
      back: '← العودة إلى Reels', kicker: 'لوحة إحصاءات صانع المحتوى', title: 'Reels الخاصة بك،', titleAccent: 'بالأرقام.', intro: 'تابع وصول فيديوهاتك إلى دائرتك. تُحتسب مشاهدة فريدة واحدة لكل مستخدم مسجّل بعد تشغيل الفيديو ثلاث ثوانٍ على الأقل.', profile: 'العودة إلى الملف الشخصي', views: 'مشاهدات فريدة', viewsNote: 'على جميع فيديوهات Reels', likes: 'الإعجابات', likesNote: 'من أعجبوا بفيديوهاتك', comments: 'التعليقات', commentsNote: 'المحادثات التي بدأت', interactions: 'إجمالي التفاعلات', interactionsNote: 'الإعجابات والتعليقات معًا', listKicker: 'الأداء حسب الفيديو', listTitle: 'فيديوهات Reels المنشورة', reelCount: (n) => `${n} ${n === 1 ? 'Reel' : 'Reels'}`, loading: 'جارٍ تحميل إحصاءات Reels…', empty: 'لم تنشر أي Reel بعد. انشر أول فيديو لعرض أدائه هنا.', error: 'تعذّر تحميل إحصاءات Reels الآن. حاول مرة أخرى لاحقًا.', untitled: 'Reel بلا عنوان', metricViews: 'مشاهدات فريدة', metricLikes: 'إعجابات', metricComments: 'تعليقات', openReel: 'فتح الـ Reel', tagline: 'تأمل في ذاتك. انطلق إلى الأمام.',
      chartKicker: 'النمو بمرور الوقت', chartTitle: 'المشاهدات والتفاعلات', chartDescription: 'النشاط التراكمي خلال الفترة المحددة.', chartViews: 'مشاهدات فريدة', chartInteractions: 'التفاعلات', chartRangeLabel: (days) => `آخر ${days} يومًا`, chartRangeAria: (days) => `عرض آخر ${days} يومًا`, chartLegendAria: 'إظهار سلسلة من الرسم أو إخفاؤها', chartFootnote: 'المشاهدات فريدة للمستخدمين المسجلين. تجمع التفاعلات الإعجابات والتعليقات المسجلة؛ ولا يشمل السجل التاريخي النشاط المحذوف.', chartLoading: 'جارٍ تحميل مخطط النشاط…', chartUnavailable: 'مخطط النشاط غير متاح مؤقتًا. ما زالت إجماليات Reels معروضة أعلاه.', chartEmpty: 'لا توجد مشاهدات أو تفاعلات مسجلة خلال هذه الفترة بعد.', chartSvgTitle: 'المشاهدات والتفاعلات على Reels بمرور الوقت', chartSvgDescription: 'المشاهدات الفريدة والتفاعلات التراكمية حسب اليوم. ركّز على نقطة أو مرّر المؤشر لعرض التفاصيل.', chartTooltipViews: (value) => `${value} مشاهدة`, chartTooltipInteractions: (value) => `${value} تفاعل`,
    },
  };

  let rows = [];
  let state = 'loading';
  let loading = false;
  let client = null;
  let chartDays = 30;
  let chartRows = [];
  let chartState = 'loading';
  let chartRequestId = 0;
  const visibleSeries = { views: true, interactions: true };

  const language = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = () => t[language()];
  const asBigInt = (value) => { try { return BigInt(value || 0); } catch { return 0n; } };
  const asNumber = (value) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; };
  const locale = () => language() === 'ar' ? 'ar' : 'en';
  const formatCount = (value) => new Intl.NumberFormat(locale()).format(asBigInt(value));
  const formatDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(date); };
  const formatChartDate = (value, options = { month: 'short', day: 'numeric' }) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(locale(), { ...options, timeZone: 'UTC' }).format(date);
  };
  const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  const svgNode = (name, attributes = {}) => {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const renderMessage = (message) => {
    list.replaceChildren();
    const notice = document.createElement('p'); notice.className = 'reel-stats-message'; notice.textContent = message; list.append(notice);
  };

  const metric = (value, label) => {
    const wrapper = document.createElement('div'); wrapper.className = 'reel-performance-metric';
    const count = document.createElement('strong'); count.textContent = formatCount(value);
    const caption = document.createElement('span'); caption.textContent = label;
    wrapper.append(count, caption);
    return wrapper;
  };

  const renderRows = () => {
    const text = copy();
    const views = rows.reduce((sum, row) => sum + asBigInt(row.view_count), 0n);
    const likes = rows.reduce((sum, row) => sum + asBigInt(row.like_count), 0n);
    const comments = rows.reduce((sum, row) => sum + asBigInt(row.comment_count), 0n);
    setText('stats-total-views', formatCount(views));
    setText('stats-total-likes', formatCount(likes));
    setText('stats-total-comments', formatCount(comments));
    setText('stats-total-interactions', formatCount(likes + comments));
    setText('stats-reel-count', text.reelCount(rows.length));
    list.replaceChildren();

    if (!rows.length) { renderMessage(text.empty); return; }
    rows.forEach((row) => {
      const card = document.createElement('article'); card.className = 'reel-performance-card';
      const heading = document.createElement('div'); heading.className = 'reel-performance-heading';
      const title = document.createElement('h3'); title.textContent = String(row.caption || '').trim() || text.untitled;
      const date = document.createElement('p'); date.textContent = formatDate(row.created_at);
      heading.append(title, date);
      const open = document.createElement('a'); open.className = 'reel-performance-link'; open.href = `./reel.html?reel=${encodeURIComponent(row.reel_id)}`; open.textContent = text.openReel;
      const metrics = document.createElement('div'); metrics.className = 'reel-performance-metrics';
      metrics.append(metric(row.view_count, text.metricViews), metric(row.like_count, text.metricLikes), metric(row.comment_count, text.metricComments));
      card.append(heading, open, metrics); list.append(card);
    });
  };

  const renderTooltip = (index, x, y) => {
    if (!chartTooltip || !chartRows[index] || chartSvg.hidden) return;
    const row = chartRows[index];
    const text = copy();
    chartTooltip.replaceChildren();
    const date = document.createElement('strong'); date.textContent = formatChartDate(row.activity_date, { dateStyle: 'medium' });
    const views = document.createElement('span'); views.textContent = text.chartTooltipViews(formatCount(row.cumulative_views));
    const interactions = document.createElement('span'); interactions.textContent = text.chartTooltipInteractions(formatCount(row.cumulative_interactions));
    chartTooltip.append(date, views, interactions);
    chartTooltip.style.left = `${Math.max(13, Math.min(87, x / chartSize.width * 100))}%`;
    chartTooltip.style.top = `${Math.max(17, Math.min(82, y / chartSize.height * 100))}%`;
    chartTooltip.hidden = false;
  };
  const hideTooltip = () => { if (chartTooltip) chartTooltip.hidden = true; };

  const renderChartStatus = (message) => {
    chartSvg.hidden = true;
    hideTooltip();
    chartMessage.textContent = message;
    chartMessage.hidden = false;
  };

  const niceStep = (value) => {
    const safe = Math.max(value, 1);
    const power = 10 ** Math.floor(Math.log10(safe));
    const normalized = safe / power;
    const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return factor * power;
  };

  const drawSeries = (key, values, colorClass, ariaLabel, axisMaximum) => {
    const { left, right, top, bottom, width, height } = chartSize;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const xAt = (index) => chartRows.length <= 1 ? left + plotWidth / 2 : left + plotWidth * index / (chartRows.length - 1);
    const yAt = (value) => top + plotHeight - (value / axisMaximum) * plotHeight;

    const points = values.map((value, index) => ({ x: xAt(index), y: yAt(value), value }));
    const lineGroup = svgNode('g', { class: `chart-series chart-series-${key}${visibleSeries[key] ? '' : ' is-hidden'}` });
    const pointGroup = svgNode('g', { class: `chart-points chart-points-${key}${visibleSeries[key] ? '' : ' is-hidden'}` });
    const path = svgNode('path', { class: `chart-series-line ${colorClass}`, d: points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '), 'aria-label': ariaLabel });
    lineGroup.append(path);

    points.forEach((point, index) => {
      const row = chartRows[index];
      const accessibleLabel = `${formatChartDate(row.activity_date, { dateStyle: 'full' })}: ${copy().chartTooltipViews(formatCount(row.cumulative_views))}, ${copy().chartTooltipInteractions(formatCount(row.cumulative_interactions))}`;
      const group = svgNode('g', { class: 'chart-data-point', tabindex: visibleSeries[key] ? '0' : '-1', role: 'img', 'aria-label': accessibleLabel });
      const hitArea = svgNode('circle', { class: 'chart-point-hit-area', cx: point.x, cy: point.y, r: 10 });
      const marker = svgNode('circle', { class: `chart-point-${key}`, cx: point.x, cy: point.y, r: 4 });
      group.append(hitArea, marker);
      group.addEventListener('pointerenter', () => renderTooltip(index, point.x, point.y));
      group.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch' && document.activeElement !== group) hideTooltip(); });
      group.addEventListener('focus', () => renderTooltip(index, point.x, point.y));
      group.addEventListener('blur', hideTooltip);
      group.addEventListener('click', () => renderTooltip(index, point.x, point.y));
      pointGroup.append(group);
    });
    return { lineGroup, pointGroup };
  };

  const renderChart = () => {
    if (chartState === 'loading') { renderChartStatus(copy().chartLoading); return; }
    if (chartState === 'error') { renderChartStatus(copy().chartUnavailable); return; }
    const hasActivity = chartRows.some((row) => asBigInt(row.cumulative_views) > 0n || asBigInt(row.cumulative_interactions) > 0n);
    if (!chartRows.length || !hasActivity) { renderChartStatus(copy().chartEmpty); return; }

    chartMessage.hidden = true;
    chartSvg.hidden = false;
    hideTooltip();
    const grid = document.querySelector('#chart-grid');
    const yLabels = document.querySelector('#chart-y-labels');
    const xLabels = document.querySelector('#chart-x-labels');
    const lines = document.querySelector('#chart-lines');
    const points = document.querySelector('#chart-points');
    grid.replaceChildren(); yLabels.replaceChildren(); xLabels.replaceChildren(); lines.replaceChildren(); points.replaceChildren();

    const viewValues = chartRows.map((row) => asNumber(row.cumulative_views));
    const interactionValues = chartRows.map((row) => asNumber(row.cumulative_interactions));
    const visibleValues = [...(visibleSeries.views ? viewValues : []), ...(visibleSeries.interactions ? interactionValues : [])];
    const maximum = Math.max(...visibleValues, 0);
    const step = niceStep(maximum / 4);
    const axisMaximum = Math.max(step, Math.ceil(maximum / step) * step);
    const viewsSeries = drawSeries('views', viewValues, 'chart-view-line', copy().chartViews, axisMaximum);
    const interactionSeries = drawSeries('interactions', interactionValues, 'chart-interaction-line', copy().chartInteractions, axisMaximum);
    const { left, right, top, bottom, width, height } = chartSize;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const yAt = (value) => top + plotHeight - (value / axisMaximum) * plotHeight;

    for (let value = 0; value <= axisMaximum + step / 2; value += step) {
      const y = yAt(value);
      grid.append(svgNode('line', { class: 'chart-grid-line', x1: left, x2: width - right, y1: y, y2: y }));
      const label = svgNode('text', { class: 'chart-axis-label chart-y-label', x: left - 11, y: y + 4 });
      label.textContent = formatCount(Math.round(value)); yLabels.append(label);
    }

    const labelIndexes = new Set([0, Math.round((chartRows.length - 1) / 4), Math.round((chartRows.length - 1) / 2), Math.round((3 * (chartRows.length - 1)) / 4), chartRows.length - 1]);
    labelIndexes.forEach((index) => {
      const row = chartRows[index];
      const x = chartRows.length <= 1 ? left + plotWidth / 2 : left + plotWidth * index / (chartRows.length - 1);
      const label = svgNode('text', { class: 'chart-axis-label chart-x-label', x, y: height - 14 });
      label.textContent = formatChartDate(row.activity_date, { month: 'short', day: 'numeric' }); xLabels.append(label);
    });

    lines.append(viewsSeries.lineGroup, interactionSeries.lineGroup);
    points.append(viewsSeries.pointGroup, interactionSeries.pointGroup);
    document.querySelectorAll('[data-chart-series]').forEach((button) => {
      button.setAttribute('aria-pressed', String(visibleSeries[button.dataset.chartSeries]));
    });
  };

  const loadActivitySeries = async () => {
    if (!client) return;
    const requestId = ++chartRequestId;
    chartState = 'loading'; renderChart();
    try {
      const { data, error } = await client.rpc('get_my_reel_activity_series', { p_days: chartDays });
      if (error) throw error;
      if (requestId !== chartRequestId) return;
      chartRows = Array.isArray(data) ? data : [];
      chartState = 'ready'; renderChart();
    } catch (error) {
      if (requestId !== chartRequestId) return;
      console.warn('Reel activity chart could not be loaded.', error);
      chartRows = []; chartState = 'error'; renderChart();
    }
  };

  const updateChartControls = () => {
    const text = copy();
    document.querySelectorAll('[data-chart-days]').forEach((button) => {
      const days = Number(button.dataset.chartDays);
      button.setAttribute('aria-pressed', String(days === chartDays));
      button.setAttribute('aria-label', text.chartRangeAria(days));
    });
    document.querySelectorAll('[data-chart-series]').forEach((button) => {
      const key = button.dataset.chartSeries;
      button.setAttribute('aria-pressed', String(visibleSeries[key]));
      button.setAttribute('aria-label', `${text.chartLegendAria}: ${key === 'views' ? text.chartViews : text.chartInteractions}`);
    });
    setText('chart-period-note', text.chartRangeLabel(chartDays));
  };

  const applyCopy = () => {
    const text = copy();
    setText('stats-back-link', text.back);
    setText('stats-kicker', text.kicker);
    const title = document.querySelector('#stats-title');
    if (title) { title.replaceChildren(document.createTextNode(`${text.title} `)); const accent = document.createElement('span'); accent.textContent = text.titleAccent; title.append(accent); }
    const shortVideoNote = language() === 'ar' ? 'وتُحتسب مشاهدة الفيديو الأقصر عند اكتمال تشغيله.' : 'Shorter videos count after full playback.';
    setText('stats-intro', `${text.intro} ${shortVideoNote}`);
    const profileLink = document.querySelector('#stats-profile-link');
    if (profileLink) { profileLink.replaceChildren(document.createTextNode(`${text.profile} `)); const arrow = document.createElement('span'); arrow.className = 'button-arrow'; arrow.textContent = '↗'; profileLink.append(arrow); }
    setText('stats-total-views-label', text.views); setText('stats-total-views-note', text.viewsNote);
    setText('stats-total-likes-label', text.likes); setText('stats-total-likes-note', text.likesNote);
    setText('stats-total-comments-label', text.comments); setText('stats-total-comments-note', text.commentsNote);
    setText('stats-total-interactions-label', text.interactions); setText('stats-total-interactions-note', text.interactionsNote);
    setText('stats-list-kicker', text.listKicker); setText('stats-list-title', text.listTitle); setText('stats-footer-tagline', text.tagline);
    setText('chart-kicker', text.chartKicker); setText('activity-chart-title', text.chartTitle); setText('chart-description', text.chartDescription);
    setText('chart-views-label', text.chartViews); setText('chart-interactions-label', text.chartInteractions); setText('chart-footnote', text.chartFootnote);
    setText('activity-svg-title', text.chartSvgTitle); setText('activity-svg-desc', text.chartSvgDescription);
    document.querySelector('#chart-range-control')?.setAttribute('aria-label', language() === 'ar' ? 'اختر الفترة الزمنية للرسم' : 'Choose chart period');
    document.querySelector('#chart-legend')?.setAttribute('aria-label', text.chartLegendAria);
    updateChartControls();
    if (state === 'loading') renderMessage(text.loading);
    else if (state === 'error') renderMessage(text.error);
    else if (state === 'ready') renderRows();
    renderChart();
  };

  document.querySelectorAll('[data-chart-days]').forEach((button) => button.addEventListener('click', () => {
    const days = Number(button.dataset.chartDays);
    if (![7, 30, 90].includes(days) || days === chartDays) return;
    chartDays = days; updateChartControls(); void loadActivitySeries();
  }));
  document.querySelectorAll('[data-chart-series]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.chartSeries;
    if (!Object.hasOwn(visibleSeries, key)) return;
    visibleSeries[key] = !visibleSeries[key];
    updateChartControls(); renderChart();
  }));
  chartShell?.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTooltip(); });

  const load = async () => {
    if (loading) return;
    loading = true; state = 'loading'; applyCopy();
    try {
      client = await window.IQZodiacSupabase?.ready;
      if (!client) throw new Error('supabase_unavailable');
      const { data: userData, error: authError } = await client.auth.getUser();
      if (authError || !userData?.user?.id) throw new Error('authentication_required');
      const { data, error } = await client.rpc('get_my_reel_stats');
      if (error) throw error;
      rows = Array.isArray(data) ? data : [];
      state = 'ready'; renderRows();
      void loadActivitySeries();
    } catch (error) {
      console.warn('Private Reel analytics could not be loaded.', error);
      state = 'error'; renderMessage(copy().error);
      chartState = 'error'; renderChart();
    } finally {
      loading = false;
    }
  };

  document.addEventListener('iqzodiac:languagechange', applyCopy);
  applyCopy();
  void load();
})();
