(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const loading = $('#admin-loading');
  const content = $('#admin-content');
  const errorBox = $('#admin-error');
  const toast = $('#admin-toast');
  const table = $('#users-table');
  const profileFields = ['first_name', 'last_name', 'age', 'phone', 'display_name', 'handle', 'country', 'city', 'preferred_language', 'birth_country', 'birth_city', 'residence_country', 'residence_city'];
  const labels = {
    user_id: 'معرّف الحساب', email: 'البريد الإلكتروني', auth_phone: 'هاتف Auth', first_name: 'الاسم الأول', last_name: 'اسم العائلة', age: 'العمر', phone: 'الهاتف في الملف', display_name: 'الاسم الظاهر', handle: 'اسم المستخدم', country: 'البلد', city: 'المدينة', preferred_language: 'اللغة', birth_country: 'بلد الميلاد', birth_city: 'مدينة الميلاد', residence_country: 'بلد الإقامة', residence_city: 'مدينة الإقامة', created_at: 'تاريخ إنشاء الحساب', profile_created_at: 'تاريخ إنشاء الملف', updated_at: 'آخر تحديث للملف', last_sign_in_at: 'آخر دخول', email_confirmed_at: 'تأكيد البريد', phone_confirmed_at: 'تأكيد الهاتف', banned_until: 'حظر حتى', privacy: 'إعدادات الخصوصية'
  };
  const errorText = {
    owner_required: 'هذا القسم متاح لمالك الموقع فقط.', owner_account_protected: 'لا يمكن تنفيذ هذا الإجراء على حساب المالك.',
    user_list_unavailable: 'تعذر تحميل حسابات المستخدمين.', profile_list_unavailable: 'تعذر تحميل الملفات الشخصية.',
    invalid_email: 'تحقق من عنوان البريد الإلكتروني.', invite_failed: 'تعذر إرسال الدعوة. تحقق من إعدادات البريد أو وجود حساب بهذا العنوان.',
    password_reset_email_failed: 'تعذر إرسال رسالة إعادة التعيين.', profile_update_failed: 'تعذر حفظ الملف الشخصي؛ قد يكون اسم المستخدم مستخدمًا بالفعل.',
    email_update_failed: 'تعذر تغيير البريد الإلكتروني.', profile_not_found: 'لا يوجد ملف شخصي مرتبط بهذا الحساب.', invalid_profile_fields: 'تحقق من الاسم واسم المستخدم والعمر واللغة.',
    account_status_update_failed: 'تعذر تغيير حالة الحساب.', email_confirmation_mismatch: 'البريد المدخل لا يطابق بريد الحساب.',
    account_delete_failed: 'تعذر حذف الحساب؛ قد تكون هناك سجلات مرتبطة تحتاج إلى معالجة.', user_not_found: 'الحساب غير موجود.',
    owner_authorization_unavailable: 'تعذر التحقق من صلاحية المالك من الخادم.', admin_users_operation_failed: 'تعذر تنفيذ العملية. حاول لاحقًا.'
  };
  let client = null;
  let rows = [];
  let page = 1;
  const perPage = 50;
  let hasNext = false;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const shortId = (value) => value ? `${String(value).slice(0, 8)}…` : '—';
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const notify = (message) => {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => { toast.hidden = true; }, 4000);
  };
  const resolveError = (code) => errorText[code] || 'تعذر الاتصال بخدمة الإدارة الآمنة. تحقق من نشر الوظيفة الخادمية ثم أعد المحاولة.';
  const api = async (payload) => {
    const { data, error } = await client.functions.invoke('admin-users', { body: payload });
    if (error) {
      let code = '';
      if (error.context && typeof error.context.json === 'function') {
        try { const response = await error.context.json(); code = response?.error || ''; } catch { /* Use the generic safe error below. */ }
      }
      throw new Error(resolveError(code));
    }
    if (!data?.ok) throw new Error(resolveError(data?.error || ''));
    return data;
  };
  const showFailure = (message, login = false) => {
    loading.hidden = true;
    content.hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = message;
    if (login) {
      const link = document.createElement('a');
      link.className = 'admin-button admin-button-primary';
      link.href = './iqz-admin-login.html?next=%2Fiqzodiac%2Fiqz-control-7f3a91c2.html';
      link.textContent = 'الانتقال إلى تسجيل دخول الإدارة';
      errorBox.append(document.createTextNode(' '), link);
    }
  };
  const accountStatus = (user) => Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now());
  const filteredRows = () => {
    const query = $('#user-search').value.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter((user) => {
      const profile = user.profile || {};
      return [user.email, user.auth_phone, user.id, profile.first_name, profile.last_name, profile.display_name, profile.handle, profile.phone, profile.city, profile.country]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    });
  };
  const render = () => {
    const visible = filteredRows();
    $('#users-page-number').textContent = `الصفحة ${page}`;
    $('#users-prev').disabled = page <= 1;
    $('#users-next').disabled = !hasNext;
    $('#users-page-status').textContent = `المعروض في هذه الصفحة: ${rows.length} · نتائج البحث: ${visible.length}`;
    if (!visible.length) {
      table.innerHTML = '<p class="admin-empty">لا توجد حسابات مطابقة في هذه الصفحة.</p>';
      return;
    }
    const body = visible.map((user) => {
      const p = user.profile || {};
      const banned = accountStatus(user);
      const emailConfirmed = Boolean(user.email_confirmed_at);
      const phone = user.auth_phone || p.phone || '—';
      return `<tr data-user-row="${escapeHTML(user.id)}"><td class="admin-users-identity"><strong>${escapeHTML(p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '—')}</strong><span class="muted">${escapeHTML(user.email || '—')}</span><span class="muted">${escapeHTML(shortId(user.id))}</span></td><td>${escapeHTML(p.handle || '—')}</td><td>${escapeHTML(phone)}</td><td>${escapeHTML([p.city, p.country].filter(Boolean).join('، ') || '—')}</td><td><span class="admin-users-status-pill ${banned ? 'is-banned' : 'is-active'}">${banned ? 'معلّق' : 'نشط'}</span><div class="muted">${emailConfirmed ? 'بريد مؤكد' : 'غير مؤكد'}</div></td><td>${escapeHTML(formatDate(user.created_at))}</td><td><div class="admin-actions"><button class="admin-action" type="button" data-action="details" data-id="${escapeHTML(user.id)}">تفاصيل</button><button class="admin-action" type="button" data-action="edit" data-id="${escapeHTML(user.id)}">تعديل</button><button class="admin-action" type="button" data-action="reset" data-id="${escapeHTML(user.id)}">إعادة تعيين</button><button class="admin-action" type="button" data-action="ban" data-id="${escapeHTML(user.id)}" data-banned="${banned ? 'true' : 'false'}">${banned ? 'إعادة تفعيل' : 'تعليق'}</button><button class="admin-action admin-button-danger" type="button" data-action="delete" data-id="${escapeHTML(user.id)}">حذف نهائي</button></div></td></tr>`;
    }).join('');
    table.innerHTML = `<div class="admin-table-wrap admin-users-table"><table class="admin-table"><thead><tr><th>الحساب</th><th>اسم المستخدم</th><th>الهاتف</th><th>الموقع</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead><tbody>${body}</tbody></table></div>`;
  };
  const loadUsers = async () => {
    $('#users-page-status').textContent = 'جارٍ تحميل الحسابات…';
    $('#refresh-users').disabled = true;
    try {
      const data = await api({ action: 'list', page, per_page: perPage });
      rows = data.users || [];
      hasNext = Boolean(data.has_next);
      render();
    } catch (error) {
      $('#users-page-status').textContent = error.message;
      table.innerHTML = '';
      notify(error.message);
    } finally {
      $('#refresh-users').disabled = false;
    }
  };
  const openDialog = (id) => { const dialog = document.getElementById(id); if (dialog?.showModal) dialog.showModal(); };
  const closeDialog = (id) => document.getElementById(id)?.close();
  const detail = (label, value, wide = false) => `<div class="admin-user-detail${wide ? ' admin-user-detail-wide' : ''}"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value || '—')}</dd></div>`;
  const showDetails = (user) => {
    const p = user.profile || {};
    $('#details-title').textContent = p.display_name || user.email || 'تفاصيل المستخدم';
    const fields = [
      ['معرّف الحساب', user.id], ['البريد الإلكتروني', user.email], ['هاتف Auth', user.auth_phone],
      ['الاسم الأول', p.first_name], ['اسم العائلة', p.last_name], ['الاسم الظاهر', p.display_name], ['اسم المستخدم', p.handle], ['العمر', p.age],
      ['الهاتف في الملف', p.phone], ['البلد', p.country], ['المدينة', p.city], ['اللغة', p.preferred_language],
      ['بلد الميلاد', p.birth_country], ['مدينة الميلاد', p.birth_city], ['بلد الإقامة', p.residence_country], ['مدينة الإقامة', p.residence_city],
      ['تاريخ إنشاء الحساب', formatDate(user.created_at)], ['تاريخ إنشاء الملف', formatDate(p.created_at)], ['آخر تحديث للملف', formatDate(p.updated_at)],
      ['آخر دخول', formatDate(user.last_sign_in_at)], ['تأكيد البريد', formatDate(user.email_confirmed_at)], ['تأكيد الهاتف', formatDate(user.phone_confirmed_at)], ['الحظر حتى', formatDate(user.banned_until)]
    ];
    const markup = fields.map(([label, value]) => detail(label, String(value ?? ''))).join('');
    const privacy = p.privacy ? JSON.stringify(p.privacy, null, 2) : '—';
    $('#user-details-body').innerHTML = `${markup}${detail('إعدادات الخصوصية', privacy, true)}<div class="admin-user-detail admin-user-detail-wide"><dt>كلمة المرور</dt><dd>غير قابلة للاسترجاع أو العرض. استخدم خيار إعادة تعيين كلمة المرور لإرسال رسالة رسمية للمستخدم.</dd></div>`;
    openDialog('user-details-dialog');
  };
  const showEdit = (user) => {
    const form = $('#user-edit-form');
    const p = user.profile || {};
    $('#edit-user-id').value = user.id;
    $('#edit-email').value = user.email || '';
    for (const field of profileFields) {
      const input = form.elements.namedItem(field);
      if (input) input.value = p[field] ?? '';
    }
    form.elements.namedItem('handle').value = String(p.handle || '').replace(/^@/, '');
    $('#edit-status').textContent = '';
    openDialog('user-edit-dialog');
  };
  const withButton = async (button, operation) => {
    button.disabled = true;
    try { await operation(); } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  };
  table.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const user = rows.find((row) => row.id === button.dataset.id);
    if (!user) return;
    const action = button.dataset.action;
    if (action === 'details') { showDetails(user); return; }
    if (action === 'edit') { showEdit(user); return; }
    if (action === 'reset') {
      if (!window.confirm(`سيُرسل رابط إعادة تعيين كلمة المرور إلى ${user.email || 'البريد المسجل'}. هل تريد المتابعة؟`)) return;
      withButton(button, async () => { await api({ action: 'reset_password', user_id: user.id }); notify('تم طلب إرسال رسالة إعادة التعيين إلى البريد المسجل.'); });
      return;
    }
    if (action === 'ban') {
      const banned = button.dataset.banned === 'true';
      const message = banned ? `إعادة تفعيل الحساب ${user.email || ''}؟` : `تعليق الحساب ${user.email || ''}؟ لن يستطيع صاحبه تسجيل الدخول أثناء التعليق.`;
      if (!window.confirm(message)) return;
      withButton(button, async () => { await api({ action: 'set_ban', user_id: user.id, banned: !banned }); notify(banned ? 'تمت إعادة تفعيل الحساب.' : 'تم تعليق الحساب.'); await loadUsers(); });
      return;
    }
    if (action === 'delete') {
      const answer = window.prompt(`هذا حذف دائم وقد يزيل بيانات مرتبطة بالحساب. اكتب البريد الإلكتروني للحساب للتأكيد:\n${user.email || ''}`);
      if (!answer || answer.trim().toLowerCase() !== String(user.email || '').toLowerCase()) { if (answer !== null) notify('لم يطابق البريد؛ لم يتم الحذف.'); return; }
      withButton(button, async () => { await api({ action: 'delete', user_id: user.id, confirm_email: answer.trim() }); notify('تم حذف الحساب نهائيًا.'); await loadUsers(); });
    }
  });
  $('#refresh-users').addEventListener('click', loadUsers);
  $('#user-search-button').addEventListener('click', render);
  $('#user-search').addEventListener('input', render);
  $('#users-prev').addEventListener('click', async () => { if (page > 1) { page -= 1; await loadUsers(); } });
  $('#users-next').addEventListener('click', async () => { if (hasNext) { page += 1; await loadUsers(); } });
  $('#invite-open').addEventListener('click', () => openDialog('user-invite-dialog'));
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));
  $('#user-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form).entries());
    const profile = Object.fromEntries(profileFields.map((key) => [key, values[key] ?? '']));
    profile.handle = String(profile.handle).replace(/^@/, '');
    if (profile.age === '') profile.age = null;
    submit.disabled = true;
    $('#edit-status').textContent = 'جارٍ الحفظ…';
    try {
      await api({ action: 'update', user_id: $('#edit-user-id').value, email: values.email, profile });
      closeDialog('user-edit-dialog');
      notify('تم حفظ التغييرات. قد يحتاج البريد الجديد إلى تأكيد المستخدم.');
      await loadUsers();
    } catch (error) { $('#edit-status').textContent = error.message; }
    finally { submit.disabled = false; }
  });
  $('#user-invite-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    $('#invite-status').textContent = 'جارٍ إرسال الدعوة…';
    try {
      await api({ action: 'invite', email: values.email, first_name: values.first_name, last_name: values.last_name });
      form.reset();
      closeDialog('user-invite-dialog');
      notify('أُرسلت دعوة البريد. سيظهر الحساب بعد إنشائه/قبوله.');
      page = 1;
      await loadUsers();
    } catch (error) { $('#invite-status').textContent = error.message; }
    finally { submit.disabled = false; }
  });

  (async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) { showFailure('سجّل الدخول بحساب مالك الموقع أولًا.', true); return; }
      await api({ action: 'list', page: 1, per_page: perPage });
      loading.hidden = true;
      content.hidden = false;
      content.style.display = 'block';
      await loadUsers();
    } catch (error) {
      showFailure(error.message || 'تعذر فتح لوحة إدارة المستخدمين.');
    }
  })();
})();
