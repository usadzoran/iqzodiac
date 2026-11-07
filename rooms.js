(() => {
  'use strict';
  const liveList = document.querySelector('#rooms-list');
  const audioList = document.querySelector('#audio-rooms-list');
  const status = document.querySelector('#rooms-status');
  const audioStatus = document.querySelector('#audio-rooms-status');
  const categoryFilter = document.querySelector('#rooms-category-filter');
  const form = document.querySelector('#audio-room-form');
  const formStatus = document.querySelector('#audio-room-form-status');
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  let liveRooms = []; let audioRooms = [];
  const groupByCategory = (rows) => rows.reduce((groups, row) => { const category = row.category || 'General'; (groups[category] ||= []).push(row); return groups; }, {});
  const renderLive = () => {
    const selected = categoryFilter.value; const visible = selected === 'all' ? liveRooms : liveRooms.filter((room) => room.category === selected); liveList.replaceChildren();
    if (!visible.length) { liveList.innerHTML = '<p class="rooms-empty">لا توجد جلسات بث مباشر في هذه الفئة حاليًا.</p>'; return; }
    Object.entries(groupByCategory(visible)).forEach(([category, items]) => { const section = document.createElement('section'); section.className = 'rooms-category'; section.innerHTML = `<div class="rooms-category-heading"><h2>${escapeHTML(category)}</h2><span>${items.length} بث مباشر</span></div><div class="rooms-grid">${items.map((room) => `<article class="room-card"><div><div class="room-state">${room.status === 'live' ? 'مباشر الآن' : 'مجدولة'}</div><h2>${escapeHTML(room.title)}</h2><p>${escapeHTML(room.description || 'لم يضف المضيف وصفًا.')}</p></div><div class="room-meta"><span>${Number.isFinite(room.viewer_count) ? `${room.viewer_count} مشاهد` : 'العدد غير متاح'}</span><span>${escapeHTML(dateLabel(room.started_at || room.created_at))}</span></div></article>`).join('')}</div>`; liveList.append(section); });
  };
  const renderAudio = () => {
    const selected = categoryFilter.value; const visible = selected === 'all' ? audioRooms : audioRooms.filter((room) => room.category === selected); audioList.replaceChildren();
    if (!visible.length) { audioList.innerHTML = '<p class="rooms-empty">لا توجد غرف صوتية مفتوحة في هذه الفئة حاليًا.</p>'; return; }
    Object.entries(groupByCategory(visible)).forEach(([category, items]) => { const section = document.createElement('section'); section.className = 'rooms-category'; section.innerHTML = `<div class="rooms-category-heading"><h2>${escapeHTML(category)}</h2><span>${items.length} غرفة</span></div><div class="rooms-grid">${items.map((room) => `<article class="room-card audio-room-card"><div><div class="room-state">صوتي مفتوح</div><h2>${escapeHTML(room.title)}</h2><p>${escapeHTML(room.description || 'غرفة صوتية مفتوحة للنقاش.')}</p></div><div class="room-meta"><span>◉ ${Number(room.listener_count || 0)} مستمع</span><span>${escapeHTML(room.host_label || 'مضيف')}</span></div></article>`).join('')}</div>`; audioList.append(section); });
  };
  const refreshCategoryOptions = () => { const categories = [...new Set([...liveRooms, ...audioRooms].map((room) => room.category || 'General'))].sort((a, b) => a.localeCompare(b)); const selected = categoryFilter.value; categoryFilter.replaceChildren(new Option('كل الفئات', 'all')); categories.forEach((category) => categoryFilter.add(new Option(category, category))); categoryFilter.value = categories.includes(selected) ? selected : 'all'; };
  const load = async () => {
    status.textContent = 'جاري الاتصال...';
    try {
      const client = await window.IQZodiacSupabase.ready; const { data: sessionData } = await client.auth.getSession(); if (!sessionData.session?.user?.id) throw new Error('auth_required');
      const [{ data: live, error: liveError }, { data: audio, error: audioError }] = await Promise.all([client.from('vip_live_sessions').select('id,title,description,status,category,viewer_count,started_at,created_at').in('status', ['scheduled', 'live']).order('created_at', { ascending: false }).limit(100), client.from('audio_rooms').select('id,title,description,category,status,listener_count,host_user_id,created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(100)]);
      if (liveError) throw liveError; if (audioError) throw audioError;
      const hosts = [...new Set((audio || []).map((room) => room.host_user_id))]; const { data: profiles } = hosts.length ? await client.from('profiles').select('user_id,handle,display_name').in('user_id', hosts).limit(100) : { data: [] }; const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile.handle || profile.display_name || 'مضيف']));
      liveRooms = (live || []).map((room) => ({ ...room, category: String(room.category || 'General').trim() || 'General' })); audioRooms = (audio || []).map((room) => ({ ...room, category: String(room.category || 'General').trim() || 'General', host_label: profileMap.get(room.host_user_id) || 'مضيف' }));
      refreshCategoryOptions(); renderLive(); renderAudio(); status.textContent = `${liveRooms.length} بث · ${new Set(liveRooms.map((room) => room.category)).size} فئة`; audioStatus.textContent = `${audioRooms.length} غرفة مفتوحة`;
    } catch (error) { status.textContent = 'تعذر الاتصال'; audioStatus.textContent = 'تعذر الاتصال'; liveList.innerHTML = `<p class="rooms-error">تعذر تحميل البثوث. ${escapeHTML(error?.message || '')}</p>`; audioList.innerHTML = `<p class="rooms-error">تعذر تحميل الغرف الصوتية. ${escapeHTML(error?.message || '')}</p>`; }
  };
  categoryFilter.addEventListener('change', () => { renderLive(); renderAudio(); });
  form.addEventListener('submit', async (event) => { event.preventDefault(); formStatus.textContent = 'جاري فتح الغرفة...'; const title = document.querySelector('#audio-room-title').value.trim(); const description = document.querySelector('#audio-room-description').value.trim(); const category = document.querySelector('#audio-room-category').value; try { const client = await window.IQZodiacSupabase.ready; const { error } = await client.rpc('iqzodiac_create_audio_room', { p_title: title, p_description: description, p_category: category }); if (error) throw error; form.reset(); formStatus.textContent = 'تم فتح الغرفة داخل الفئة المحددة.'; await load(); } catch (error) { formStatus.textContent = error?.message || 'تعذر فتح الغرفة.'; } });
  load();
})();
