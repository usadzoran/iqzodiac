(() => {
  'use strict';
  const list = document.querySelector('#rooms-list');
  const status = document.querySelector('#rooms-status');
  const categoryFilter = document.querySelector('#rooms-category-filter');
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  let rooms = [];
  const render = () => {
    const selected = categoryFilter.value;
    const visible = selected === 'all' ? rooms : rooms.filter((room) => room.category === selected);
    list.replaceChildren();
    if (!visible.length) { list.innerHTML = '<p class="rooms-empty">لا توجد جلسات مباشرة في هذه الفئة حاليًا.</p>'; return; }
    const groups = new Map();
    visible.forEach((room) => { const category = room.category || 'General'; if (!groups.has(category)) groups.set(category, []); groups.get(category).push(room); });
    groups.forEach((items, category) => {
      const section = document.createElement('section'); section.className = 'rooms-category';
      section.innerHTML = `<div class="rooms-category-heading"><h2>${escapeHTML(category)}</h2><span>${items.length} بث مباشر</span></div><div class="rooms-grid">${items.map((room) => `<article class="room-card"><div><div class="room-state">${room.status === 'live' ? 'مباشر الآن' : 'مجدولة'}</div><h2>${escapeHTML(room.title)}</h2><p>${escapeHTML(room.description || 'لم يضف المضيف وصفًا.')}</p></div><div class="room-meta"><span>${Number.isFinite(room.viewer_count) ? `${room.viewer_count} مشاهد` : 'العدد غير متاح'}</span><span>${escapeHTML(dateLabel(room.started_at || room.created_at))}</span></div></article>`).join('')}</div>`;
      list.append(section);
    });
  };
  categoryFilter.addEventListener('change', render);
  const loadRooms = async () => {
    status.textContent = 'جاري الاتصال...';
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session?.user?.id) throw new Error('auth_required');
      const { data, error } = await client.from('vip_live_sessions').select('id,title,description,status,category,viewer_count,started_at,created_at').in('status', ['scheduled', 'live']).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      rooms = (data || []).map((room) => ({ ...room, category: String(room.category || 'General').trim() || 'General' }));
      const categories = [...new Set(rooms.map((room) => room.category))].sort((a, b) => a.localeCompare(b));
      categoryFilter.replaceChildren(new Option('كل الفئات', 'all'));
      categories.forEach((category) => categoryFilter.add(new Option(category, category)));
      status.textContent = `${rooms.length} جلسة · ${categories.length} فئة`;
      render();
    } catch (error) { status.textContent = 'تعذر الاتصال'; list.innerHTML = `<p class="rooms-error">تعذر تحميل الجلسات الحقيقية من قاعدة البيانات. ${escapeHTML(error?.message || 'حاول مرة أخرى بعد تسجيل الدخول.')}</p>`; }
  };
  loadRooms();
})();
