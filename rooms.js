(() => {
  'use strict';

  const list = document.querySelector('#rooms-list');
  const status = document.querySelector('#rooms-status');
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

  const loadRooms = async () => {
    status.textContent = 'جاري الاتصال...';
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session?.user?.id) throw new Error('auth_required');
      const { data, error } = await client.from('vip_live_sessions')
        .select('id,title,description,status,viewer_count,started_at,created_at')
        .in('status', ['scheduled', 'live'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      status.textContent = `${data?.length || 0} جلسة منشورة`;
      if (!data?.length) {
        list.innerHTML = '<p class="rooms-empty">لا توجد جلسات مباشرة منشورة حاليًا في قاعدة البيانات.</p>';
        return;
      }
      list.innerHTML = data.map((room) => `<article class="room-card"><div><div class="room-state">${room.status === 'live' ? 'مباشر الآن' : 'مجدولة'}</div><h2>${escapeHTML(room.title)}</h2><p>${escapeHTML(room.description || 'لم يضف المضيف وصفًا.')}</p></div><div class="room-meta"><span>${Number.isFinite(room.viewer_count) ? `${room.viewer_count} مشاهد` : 'العدد غير متاح'}</span><span>${escapeHTML(dateLabel(room.started_at || room.created_at))}</span></div></article>`).join('');
    } catch (error) {
      status.textContent = 'تعذر الاتصال';
      list.innerHTML = `<p class="rooms-error">تعذر تحميل الجلسات الحقيقية من قاعدة البيانات. ${escapeHTML(error?.message || 'حاول مرة أخرى بعد تسجيل الدخول.')}</p>`;
    }
  };

  loadRooms();
})();
