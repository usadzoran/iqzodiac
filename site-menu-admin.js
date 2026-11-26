(() => {
  'use strict';
  const root = document.querySelector('#site-menu-admin');
  const adminContent = document.querySelector('#admin-content');
  if (!root) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  let client;
  let menus = [];
  let selected = '';
  let started = false;
  let busy = false;

  const toast = (message) => {
    const node = document.querySelector('#admin-toast');
    if (node) {
      node.textContent = message;
      node.hidden = false;
      window.clearTimeout(toast.timer);
      toast.timer = window.setTimeout(() => { node.hidden = true; }, 3500);
    } else {
      const status = root.querySelector('[data-menu-status]');
      if (status) status.textContent = message;
    }
  };

  const validHref = (value) => {
    const href = String(value || '').trim();
    if (!href || href.length > 500 || /[\s\\\u0000-\u001f\u007f]/.test(href) || href.startsWith('//')) return false;
    try {
      const url = new URL(href, window.location.href);
      if (url.protocol === 'https:') return Boolean(url.hostname) && !url.username && !url.password;
      if (url.protocol === 'http:') return url.origin === window.location.origin;
      if (url.protocol === 'mailto:') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decodeURIComponent(url.pathname));
      if (url.protocol === 'tel:') return /^\+?[0-9().-]{3,30}$/.test(decodeURIComponent(url.pathname));
      return false;
    } catch (_) { return false; }
  };

  const audit = async (action, entityId, metadata = {}) => {
    const { error } = await client.rpc('iqzodiac_admin_audit', {
      p_action_code: action,
      p_entity_type: 'site_menu',
      p_entity_id: entityId || null,
      p_metadata: metadata,
    });
    if (error) throw error;
  };

  const auditAfterWrite = async (action, entityId, metadata) => {
    try { await audit(action, entityId, metadata); return true; }
    catch (error) { toast(`Saved, but the audit entry could not be written: ${error.message || 'unknown error'}`); return false; }
  };

  const load = async () => {
    const { data, error } = await client.from('site_menus')
      .select('id,menu_key,title_en,title_ar,location,is_active,sort_order')
      .order('sort_order').order('title_en').limit(100);
    if (error) throw error;
    menus = data || [];
    if (!menus.some((menu) => menu.id === selected)) selected = menus[0]?.id || '';
    render();
    if (selected) await loadItems();
  };

  const render = () => {
    root.innerHTML = `<article class="admin-card admin-wide">
      <div class="admin-section-heading"><div><h2>Website menus</h2><p>Manage footer, header, dropdown, user, and side menus. Inactive menus and links are hidden from visitors.</p></div></div>
      <form id="site-menu-form" class="admin-toolbar">
        <input class="admin-input" name="key" required maxlength="64" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="menu-key" aria-label="Menu key" />
        <input class="admin-input" name="en" required maxlength="80" placeholder="Menu name (English)" aria-label="English menu name" />
        <input class="admin-input" name="ar" required maxlength="80" placeholder="اسم القائمة" dir="rtl" aria-label="Arabic menu name" />
        <select class="admin-select" name="location" aria-label="Menu placement"><option value="footer">Footer menu</option><option value="header">Header menu</option><option value="dropdown">Dropdown menu</option><option value="user">User menu</option><option value="side">Side menu</option></select>
        <input class="admin-input" name="order" type="number" min="0" max="1000000" value="100" aria-label="Menu order" />
        <button class="admin-button admin-button-primary" type="submit">Add menu</button>
      </form>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Key</th><th>English name</th><th>Arabic name</th><th>Placement</th><th>Visible</th><th>Order</th><th>Actions</th></tr></thead><tbody>${menus.map((menu) => `<tr data-menu-row="${esc(menu.id)}"><td><code>${esc(menu.menu_key)}</code></td><td><input data-field="en" class="admin-input" value="${esc(menu.title_en)}" maxlength="80" aria-label="English menu name" /></td><td><input data-field="ar" class="admin-input" value="${esc(menu.title_ar)}" maxlength="80" dir="rtl" aria-label="Arabic menu name" /></td><td><select data-field="location" class="admin-select"><option value="footer" ${menu.location === 'footer' ? 'selected' : ''}>Footer</option><option value="header" ${menu.location === 'header' ? 'selected' : ''}>Header</option><option value="dropdown" ${menu.location === 'dropdown' ? 'selected' : ''}>Dropdown</option><option value="user" ${menu.location === 'user' ? 'selected' : ''}>User menu</option><option value="side" ${menu.location === 'side' ? 'selected' : ''}>Side menu</option></select></td><td><input data-field="active" type="checkbox" ${menu.is_active ? 'checked' : ''} aria-label="Menu visible" /></td><td><input data-field="order" class="admin-input" type="number" min="0" max="1000000" value="${Number(menu.sort_order)}" aria-label="Menu order" /></td><td><div class="admin-actions"><button type="button" class="admin-action" data-save-menu="${esc(menu.id)}">Save</button><button type="button" class="admin-action" data-open-menu="${esc(menu.id)}">Links</button><button type="button" class="admin-action admin-button-danger" data-delete-menu="${esc(menu.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>
      <div class="admin-toolbar"><label>Manage links in menu <select id="site-menu-select" class="admin-select">${menus.map((menu) => `<option value="${esc(menu.id)}" ${menu.id === selected ? 'selected' : ''}>${esc(menu.title_en)} / ${esc(menu.title_ar)}</option>`).join('')}</select></label></div>
      <div id="site-menu-items"><p class="admin-status">${menus.length ? 'Select a menu to manage links.' : 'Create a menu first.'}</p></div>
      <p class="admin-status" data-menu-status aria-live="polite"></p>
    </article>`;

    root.querySelector('#site-menu-form').addEventListener('submit', (event) => void addMenu(event));
    root.querySelector('#site-menu-select').addEventListener('change', (event) => { selected = event.target.value; void loadItems(); });
    root.querySelectorAll('[data-save-menu]').forEach((button) => button.addEventListener('click', () => void saveMenu(button)));
    root.querySelectorAll('[data-open-menu]').forEach((button) => button.addEventListener('click', () => {
      selected = button.dataset.openMenu;
      root.querySelector('#site-menu-select').value = selected;
      void loadItems();
    }));
    root.querySelectorAll('[data-delete-menu]').forEach((button) => button.addEventListener('click', () => void deleteMenu(button)));
  };

  const addMenu = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || busy) return;
    const values = new FormData(form);
    const row = {
      menu_key: String(values.get('key')).trim(),
      title_en: String(values.get('en')).trim(),
      title_ar: String(values.get('ar')).trim(),
      location: String(values.get('location')),
      sort_order: Number(values.get('order')),
    };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.menu_key) || !Number.isInteger(row.sort_order) || row.sort_order < 0 || row.sort_order > 1000000) {
      toast('Check the menu key and order value.');
      return;
    }
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) { toast(userError?.message || 'Your session has expired.'); return; }
    busy = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const { data, error } = await client.from('site_menus').insert({ ...row, created_by: userData.user.id }).select('id').single();
      if (error) throw error;
      const auditLogged = await auditAfterWrite('create_site_menu', data.id, { menu_key: row.menu_key, location: row.location });
      form.reset();
      await load();
      if (auditLogged) toast('Menu added.');
    } catch (error) { toast(error.message || 'Menu could not be added.'); }
    finally { busy = false; submit.disabled = false; }
  };

  const saveMenu = async (button) => {
    if (busy) return;
    const row = button.closest('[data-menu-row]');
    const values = {
      title_en: row.querySelector('[data-field="en"]').value.trim(),
      title_ar: row.querySelector('[data-field="ar"]').value.trim(),
      location: row.querySelector('[data-field="location"]').value,
      is_active: row.querySelector('[data-field="active"]').checked,
      sort_order: Number(row.querySelector('[data-field="order"]').value),
    };
    if (!values.title_en || !values.title_ar || !Number.isInteger(values.sort_order) || values.sort_order < 0 || values.sort_order > 1000000) {
      toast('Enter both menu names and a valid order from 0 to 1,000,000.');
      return;
    }
    busy = true;
    button.disabled = true;
    try {
      const { error } = await client.from('site_menus').update(values).eq('id', button.dataset.saveMenu);
      if (error) throw error;
      const auditLogged = await auditAfterWrite('update_site_menu', button.dataset.saveMenu, { location: values.location, is_active: values.is_active, sort_order: values.sort_order });
      await load();
      if (auditLogged) toast('Menu saved.');
    } catch (error) { toast(error.message || 'Menu could not be saved.'); button.disabled = false; }
    finally { busy = false; }
  };

  const deleteMenu = async (button) => {
    if (busy) return;
    const menu = menus.find((item) => item.id === button.dataset.deleteMenu);
    if (!menu) return;
    button.disabled = true;
    try {
      const { count, error: countError } = await client.from('site_menu_items').select('id', { count: 'exact', head: true }).eq('menu_id', menu.id);
      if (countError) throw countError;
      const linkCount = Number(count || 0);
      if (!window.confirm(`Delete “${menu.title_en}”?${linkCount ? ` This will also delete its ${linkCount} associated link(s).` : ''}`)) {
        button.disabled = false;
        return;
      }
      const { error } = await client.from('site_menus').delete().eq('id', menu.id);
      if (error) throw error;
      const auditLogged = await auditAfterWrite('delete_site_menu', menu.id, { menu_key: menu.menu_key, cascaded_link_count: linkCount });
      await load();
      if (auditLogged) toast('Menu deleted.');
    } catch (error) { toast(error.message || 'Menu could not be deleted.'); button.disabled = false; }
  };

  const loadItems = async () => {
    const box = root.querySelector('#site-menu-items');
    if (!box || !selected) { if (box) box.innerHTML = '<p class="admin-empty">Create a menu first.</p>'; return; }
    box.innerHTML = '<p class="admin-status">Loading menu links…</p>';
    const { data, error } = await client.from('site_menu_items')
      .select('id,label_en,label_ar,href,sort_order,is_active')
      .eq('menu_id', selected).order('sort_order').order('created_at').limit(300);
    if (error) { box.innerHTML = `<p class="admin-error">${esc(error.message || 'Menu links could not be loaded.')}</p>`; return; }
    const rows = data || [];
    box.innerHTML = `<h3>Menu links</h3><form id="site-menu-item-form" class="admin-toolbar"><input class="admin-input" name="en" required maxlength="100" placeholder="Label (English)" aria-label="English link title" /><input class="admin-input" name="ar" required maxlength="100" placeholder="النص العربي" dir="rtl" aria-label="Arabic link title" /><input class="admin-input" name="href" required maxlength="500" placeholder="/site-pages.html?slug=about-us or https://…" aria-label="Link URL" /><input class="admin-input" name="order" type="number" min="0" max="1000000" value="100" aria-label="Link order" /><button class="admin-button admin-button-primary" type="submit">Add link</button></form><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>English</th><th>Arabic</th><th>URL</th><th>Visible</th><th>Order</th><th>Actions</th></tr></thead><tbody>${rows.map((item) => `<tr data-item-row="${esc(item.id)}"><td><input class="admin-input" data-field="en" value="${esc(item.label_en)}" maxlength="100" aria-label="English link title" /></td><td><input class="admin-input" data-field="ar" value="${esc(item.label_ar)}" maxlength="100" dir="rtl" aria-label="Arabic link title" /></td><td><input class="admin-input" data-field="href" value="${esc(item.href)}" maxlength="500" aria-label="Link URL" /></td><td><input type="checkbox" data-field="active" ${item.is_active ? 'checked' : ''} aria-label="Link visible" /></td><td><input class="admin-input" type="number" data-field="order" min="0" max="1000000" value="${Number(item.sort_order)}" aria-label="Link order" /></td><td><div class="admin-actions"><button type="button" class="admin-action" data-save-item="${esc(item.id)}">Save</button><button type="button" class="admin-action admin-button-danger" data-delete-item="${esc(item.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;

    box.querySelector('#site-menu-item-form').addEventListener('submit', (event) => void addItem(event));
    box.querySelectorAll('[data-save-item]').forEach((button) => button.addEventListener('click', () => void saveItem(button)));
    box.querySelectorAll('[data-delete-item]').forEach((button) => button.addEventListener('click', () => void deleteItem(button)));
  };

  const addItem = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || busy) return;
    const values = new FormData(form);
    const row = {
      menu_id: selected,
      label_en: String(values.get('en')).trim(),
      label_ar: String(values.get('ar')).trim(),
      href: String(values.get('href')).trim(),
      sort_order: Number(values.get('order')),
    };
    if (!validHref(row.href)) { toast('Enter a same-site path, a valid HTTPS URL, or a valid email/telephone link.'); return; }
    if (!Number.isInteger(row.sort_order) || row.sort_order < 0 || row.sort_order > 1000000) { toast('Link order must be from 0 to 1,000,000.'); return; }
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) { toast(userError?.message || 'Your session has expired.'); return; }
    busy = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const { data, error } = await client.from('site_menu_items').insert({ ...row, created_by: userData.user.id }).select('id').single();
      if (error) throw error;
      const auditLogged = await auditAfterWrite('create_site_menu_item', data.id, { menu_id: selected });
      await loadItems();
      if (auditLogged) toast('Link added.');
    } catch (error) { toast(error.message || 'Link could not be added.'); submit.disabled = false; }
    finally { busy = false; }
  };

  const saveItem = async (button) => {
    if (busy) return;
    const row = button.closest('[data-item-row]');
    const values = {
      label_en: row.querySelector('[data-field="en"]').value.trim(),
      label_ar: row.querySelector('[data-field="ar"]').value.trim(),
      href: row.querySelector('[data-field="href"]').value.trim(),
      is_active: row.querySelector('[data-field="active"]').checked,
      sort_order: Number(row.querySelector('[data-field="order"]').value),
    };
    if (!values.label_en || !values.label_ar) { toast('Both English and Arabic link titles are required.'); return; }
    if (!validHref(values.href)) { toast('Enter a same-site path, a valid HTTPS URL, or a valid email/telephone link.'); return; }
    if (!Number.isInteger(values.sort_order) || values.sort_order < 0 || values.sort_order > 1000000) { toast('Link order must be from 0 to 1,000,000.'); return; }
    busy = true;
    button.disabled = true;
    try {
      const { error } = await client.from('site_menu_items').update(values).eq('id', button.dataset.saveItem);
      if (error) throw error;
      const auditLogged = await auditAfterWrite('update_site_menu_item', button.dataset.saveItem, { menu_id: selected, is_active: values.is_active, sort_order: values.sort_order });
      await loadItems();
      if (auditLogged) toast('Link saved.');
    } catch (error) { toast(error.message || 'Link could not be saved.'); button.disabled = false; }
    finally { busy = false; }
  };

  const deleteItem = async (button) => {
    if (busy || !window.confirm('Delete this menu link?')) return;
    busy = true;
    button.disabled = true;
    try {
      const { error } = await client.from('site_menu_items').delete().eq('id', button.dataset.deleteItem);
      if (error) throw error;
      const auditLogged = await auditAfterWrite('delete_site_menu_item', button.dataset.deleteItem, { menu_id: selected });
      await loadItems();
      if (auditLogged) toast('Link deleted.');
    } catch (error) { toast(error.message || 'Link could not be deleted.'); button.disabled = false; }
    finally { busy = false; }
  };

  const start = async () => {
    if (started || !adminContent || adminContent.hidden) return;
    if (window.sessionStorage.getItem('iqz_admin_second_factor') !== 'verified') return;
    started = true;
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData?.session) throw new Error(sessionError?.message || 'Admin sign-in required.');
      const { data: admin, error } = await client.rpc('iqzodiac_is_admin');
      if (error || admin !== true) throw new Error('Administrator access required.');
      await load();
    } catch (error) {
      started = false;
      root.innerHTML = `<p class="admin-error">${esc(error.message || 'Menu controls unavailable.')}</p>`;
    }
  };

  if (adminContent) {
    new MutationObserver(() => { if (!adminContent.hidden) void start(); })
      .observe(adminContent, { attributes: true, attributeFilter: ['hidden'] });
    if (!adminContent.hidden) void start();
  }
})();
