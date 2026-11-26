(() => {
  'use strict';

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const date = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '—';
  const mounted = new WeakSet();
  const locationLabels = {
    pages: 'Public pages directory',
    home: 'Home page',
    discover: 'Discover page',
    marketplace: 'Marketplace',
    profile: 'Profile page',
  };

  const mount = async (client, root) => {
    if (!root || mounted.has(root)) return;
    const isAdmin = root.dataset.siteAdmin === 'true';
    let assignedScopes;
    if (isAdmin) {
      assignedScopes = ['public_pages', 'home_sections', 'discover_sections', 'marketplace_sections', 'profile_sections', 'marketplace_categories'];
    } else {
      const { data, error } = await client.rpc('iqzodiac_my_site_content_scopes');
      if (error) throw error;
      assignedScopes = Array.isArray(data) ? data : [];
    }
    const scopes = new Set(assignedScopes);
    const sectionLocations = ['home', 'discover', 'marketplace', 'profile'].filter((location) => scopes.has(`${location}_sections`));
    const canManagePages = scopes.has('public_pages') || sectionLocations.length > 0;
    const canManageCategories = scopes.has('marketplace_categories');
    if (!canManagePages && !canManageCategories) throw new Error('This account has no active website-content areas assigned.');
    mounted.add(root);

    const activePanel = canManagePages ? 'pages' : 'categories';
    const pageTab = canManagePages ? `<button class="content-tab-button ${activePanel === 'pages' ? 'is-active' : ''}" type="button" data-content-tab="pages">Website sections</button>` : '';
    const categoryTab = canManageCategories ? `<button class="content-tab-button ${activePanel === 'categories' ? 'is-active' : ''}" type="button" data-content-tab="categories">Marketplace categories</button>` : '';
    const pageTypeOptions = [
      ...(scopes.has('public_pages') ? [['page', 'Standalone page']] : []),
      ...(sectionLocations.length ? [['section', 'Website section']] : []),
    ];
    const pagePanel = canManagePages ? `
      <section class="content-panel ${activePanel === 'pages' ? 'is-active' : ''}" data-content-panel="pages">
        <article class="admin-card admin-wide">
          <div class="admin-section-heading"><div><h2>Website sections / pages</h2><p>Only content in your assigned areas is shown here. Create a section or edit its bilingual content and publication status.</p></div></div>
          <form id="content-page-form" class="content-editor-form">
            <input type="hidden" id="content-page-id" />
            <label>English title<input id="content-page-title-en" class="admin-input" required maxlength="120" /></label>
            <label>Arabic title<input id="content-page-title-ar" class="admin-input" required maxlength="120" dir="rtl" /></label>
            <label>Page link (slug)<input id="content-page-slug" class="admin-input" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="about-us" autocomplete="off" /></label>
            <label>Content type<select id="content-page-type" class="admin-select">${pageTypeOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
            <label>Display location<select id="content-page-location" class="admin-select"></select></label>
            <label>Display order<input id="content-page-order" class="admin-input" type="number" min="0" max="1000000" value="100" required /></label>
            <label class="content-editor-wide">English content<textarea id="content-page-body-en" class="content-textarea" maxlength="30000" rows="8"></textarea></label>
            <label class="content-editor-wide">Arabic content<textarea id="content-page-body-ar" class="content-textarea" maxlength="30000" rows="8" dir="rtl"></textarea></label>
            <label class="admin-check"><input id="content-page-published" type="checkbox" /> Published and visible to visitors</label>
            <div class="content-editor-actions"><button class="admin-button admin-button-primary" type="submit">Create / save section</button><button class="admin-button" id="content-page-reset" type="button">Clear form</button><span class="admin-status" id="content-page-status" aria-live="polite"></span></div>
          </form>
          <div id="content-pages-table"><p class="admin-status">Loading pages…</p></div>
        </article>
      </section>` : '';
    const categoriesPanel = canManageCategories ? `
      <section class="content-panel ${activePanel === 'categories' ? 'is-active' : ''}" data-content-panel="categories">
        <article class="admin-card admin-wide">
          <div class="admin-section-heading"><div><h2>Marketplace categories</h2><p>Create and maintain Product or Service categories. Hide categories rather than deleting them so linked listings remain intact.</p></div></div>
          <form id="content-category-form" class="admin-toolbar">
            <input id="content-category-en" class="admin-input" required maxlength="80" placeholder="English name" />
            <input id="content-category-ar" class="admin-input" required maxlength="80" placeholder="الاسم العربي" dir="rtl" />
            <select id="content-category-kind" class="admin-select"><option value="product">Product</option><option value="service">Service</option></select>
            <button class="admin-button admin-button-primary" type="submit">Add category</button>
          </form>
          <div id="content-categories-table"><p class="admin-status">Loading categories…</p></div>
        </article>
      </section>` : '';

    root.innerHTML = `<nav class="content-tabs" aria-label="Content workspace sections">${pageTab}${categoryTab}</nav>${pagePanel}${categoriesPanel}`;

    const toast = (message) => {
      const node = document.querySelector('#content-toast');
      if (node) {
        node.textContent = message;
        node.hidden = false;
        window.clearTimeout(toast.timer);
        toast.timer = window.setTimeout(() => { node.hidden = true; }, 3500);
      } else {
        const status = root.querySelector('#content-page-status');
        if (status) status.textContent = message;
      }
    };
    const report = (container, error, fallback) => {
      container.innerHTML = `<p class="admin-error">${escapeHTML(error?.message || fallback)}</p>`;
    };
    const mayManagePage = (row) => {
      if (isAdmin) return true;
      if (row.content_type === 'page') return row.display_location === 'pages' && scopes.has('public_pages');
      return row.content_type === 'section' && sectionLocations.includes(row.display_location);
    };
    const locationOptionsForType = (type) => type === 'page'
      ? (scopes.has('public_pages') || isAdmin ? ['pages'] : [])
      : (type === 'section' ? sectionLocations : []);

    let pages = [];
    const loadPages = async () => {
      const container = root.querySelector('#content-pages-table');
      if (!container) return;
      container.innerHTML = '<p class="admin-status">Loading pages…</p>';
      const { data, error } = await client.from('site_pages')
        .select('id,slug,title_en,title_ar,body_en,body_ar,content_type,display_location,is_published,sort_order,updated_at')
        .order('sort_order').order('title_en').limit(300);
      if (error) { report(container, error, 'Pages could not be loaded.'); return; }
      pages = (data || []).filter(mayManagePage);
      if (!pages.length) { container.innerHTML = '<p class="admin-empty">No website content is available in the areas assigned to this editor. Create the first page or section above.</p>'; return; }
      container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>English title</th><th>Arabic title</th><th>Link</th><th>Type</th><th>Location</th><th>State</th><th>Order</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${pages.map((page) => `<tr><td>${escapeHTML(page.title_en)}</td><td dir="rtl">${escapeHTML(page.title_ar)}</td><td><code>${escapeHTML(page.slug)}</code></td><td>${page.content_type === 'section' ? 'Section' : 'Page'}</td><td>${escapeHTML(locationLabels[page.display_location] || page.display_location || 'pages')}</td><td>${page.is_published ? 'Published' : 'Draft'}</td><td>${Number(page.sort_order)}</td><td class="muted">${escapeHTML(date(page.updated_at))}</td><td><div class="admin-actions"><button class="admin-action" type="button" data-page-edit="${escapeHTML(page.id)}">Edit</button><button class="admin-action" type="button" data-page-publish="${escapeHTML(page.id)}" data-published="${page.is_published}">${page.is_published ? 'Unpublish' : 'Publish'}</button>${isAdmin ? `<button class="admin-action admin-button-danger" type="button" data-page-delete="${escapeHTML(page.id)}">Delete</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
    };

    const typeSelect = root.querySelector('#content-page-type');
    const locationSelect = root.querySelector('#content-page-location');
    const syncLocationOptions = (selectedLocation = '') => {
      if (!locationSelect) return;
      const options = locationOptionsForType(typeSelect.value);
      locationSelect.innerHTML = options.map((location) => `<option value="${location}">${locationLabels[location]}</option>`).join('');
      if (options.includes(selectedLocation)) locationSelect.value = selectedLocation;
      locationSelect.disabled = options.length <= 1;
    };
    if (typeSelect) {
      typeSelect.value = pageTypeOptions[0]?.[0] || 'page';
      typeSelect.disabled = pageTypeOptions.length <= 1;
      syncLocationOptions();
      typeSelect.addEventListener('change', () => syncLocationOptions());
    }

    const resetPageForm = () => {
      const form = root.querySelector('#content-page-form');
      if (!form) return;
      form.reset();
      root.querySelector('#content-page-id').value = '';
      root.querySelector('#content-page-order').value = '100';
      root.querySelector('#content-page-status').textContent = '';
      typeSelect.value = pageTypeOptions[0]?.[0] || 'page';
      syncLocationOptions();
    };
    const savePage = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const id = root.querySelector('#content-page-id').value;
      const row = {
        slug: root.querySelector('#content-page-slug').value.trim(),
        title_en: root.querySelector('#content-page-title-en').value.trim(),
        title_ar: root.querySelector('#content-page-title-ar').value.trim(),
        body_en: root.querySelector('#content-page-body-en').value,
        body_ar: root.querySelector('#content-page-body-ar').value,
        is_published: root.querySelector('#content-page-published').checked,
        sort_order: Number(root.querySelector('#content-page-order').value),
        content_type: typeSelect.value,
        display_location: locationSelect.value,
      };
      if (!mayManagePage(row)) { toast('This account is not assigned to manage that site area.'); return; }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) { toast('Use lowercase English letters, numbers, and single hyphens in the page link.'); return; }
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const request = id
          ? client.from('site_pages').update(row).eq('id', id).select('id').single()
          : client.from('site_pages').insert(row).select('id').single();
        const { error } = await request;
        if (error) throw error;
        toast(id ? 'Page updated.' : 'Page created.');
        resetPageForm();
        await loadPages();
      } catch (error) { toast(error.message || 'The page could not be saved.'); }
      finally { button.disabled = false; }
    };
    const editPage = (id) => {
      const page = pages.find((row) => row.id === id);
      if (!page || !mayManagePage(page)) return;
      root.querySelector('#content-page-id').value = page.id;
      root.querySelector('#content-page-slug').value = page.slug;
      root.querySelector('#content-page-title-en').value = page.title_en;
      root.querySelector('#content-page-title-ar').value = page.title_ar;
      root.querySelector('#content-page-body-en').value = page.body_en || '';
      root.querySelector('#content-page-body-ar').value = page.body_ar || '';
      root.querySelector('#content-page-order').value = String(page.sort_order ?? 100);
      typeSelect.value = page.content_type || 'page';
      syncLocationOptions(page.display_location || 'pages');
      root.querySelector('#content-page-published').checked = Boolean(page.is_published);
      root.querySelector('#content-page-form').scrollIntoView({ behavior:'smooth', block:'start' });
    };
    const deletePage = async (button) => {
      const page = pages.find((row) => row.id === button.dataset.pageDelete);
      if (!page || !isAdmin) return;
      button.disabled = true;
      try {
        const menuLinks = [];
        for (let offset = 0; offset <= 50000; offset += 1000) {
          const { data: batch, error: linksError } = await client.from('site_menu_items')
            .select('id,label_en,label_ar,href').range(offset, offset + 999);
          if (linksError) throw linksError;
          menuLinks.push(...(batch || []));
          if (!batch || batch.length < 1000) break;
          if (offset === 50000) throw new Error('Could not finish checking menu links. The page was not deleted.');
        }
        const linkedItems = menuLinks.filter((item) => {
          try {
            const url = new URL(item.href, window.location.href);
            return url.origin === window.location.origin
              && url.pathname.toLowerCase().endsWith('/site-pages.html')
              && url.searchParams.get('slug') === page.slug;
          } catch (_) { return false; }
        });
        if (linkedItems.length) {
          const labels = linkedItems.slice(0, 3).map((item) => item.label_en || item.label_ar || item.href).join(', ');
          throw new Error(`This page is linked from ${linkedItems.length} menu link(s) (${labels}). Remove or update those links before deleting the page.`);
        }
        if (!window.confirm(`Permanently delete “${page.title_en}”? This cannot be undone.`)) { button.disabled = false; return; }
        const { error } = await client.from('site_pages').delete().eq('id', page.id);
        if (error) throw error;
        toast('Page deleted.');
        await loadPages();
      } catch (error) { toast(error.message || 'The page could not be deleted.'); button.disabled = false; }
    };

    const setPagePublished = async (button) => {
      const id = button.dataset.pagePublish;
      const page = pages.find((row) => row.id === id);
      if (!page || !mayManagePage(page)) return;
      button.disabled = true;
      try {
        const { error } = await client.from('site_pages').update({ is_published: button.dataset.published !== 'true' }).eq('id', id);
        if (error) throw error;
        toast(button.dataset.published === 'true' ? 'Page unpublished.' : 'Page published.');
        await loadPages();
      } catch (error) { toast(error.message || 'The page state could not be changed.'); button.disabled = false; }
    };

    const loadCategories = async () => {
      const container = root.querySelector('#content-categories-table');
      if (!container || !canManageCategories) return;
      container.innerHTML = '<p class="admin-status">Loading categories…</p>';
      const { data, error } = await client.from('marketplace_categories').select('id,kind,slug,name_en,name_ar,is_active,sort_order').order('kind').order('sort_order').limit(200);
      if (error) { report(container, error, 'Categories could not be loaded.'); return; }
      if (!data?.length) { container.innerHTML = '<p class="admin-empty">No categories available.</p>'; return; }
      container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>English</th><th>Arabic</th><th>Type / slug</th><th>Order</th><th>Visible</th><th>Action</th></tr></thead><tbody>${data.map((row) => `<tr data-category-row="${escapeHTML(row.id)}"><td><input data-category-field="name_en" value="${escapeHTML(row.name_en)}" maxlength="80" aria-label="English category name" /></td><td><input data-category-field="name_ar" value="${escapeHTML(row.name_ar)}" maxlength="80" dir="rtl" aria-label="Arabic category name" /></td><td>${escapeHTML(row.kind)}<div class="muted">${escapeHTML(row.slug)}</div></td><td><input data-category-field="sort_order" type="number" min="0" max="1000000" value="${Number(row.sort_order || 0)}" aria-label="Category display order" /></td><td><input data-category-field="is_active" type="checkbox" ${row.is_active ? 'checked' : ''} aria-label="Category visible" /></td><td><button type="button" class="admin-action" data-category-save="${escapeHTML(row.id)}">Save</button></td></tr>`).join('')}</tbody></table></div>`;
    };
    const addCategory = async (event) => {
      event.preventDefault();
      if (!canManageCategories) return;
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await client.rpc('iqzodiac_content_add_marketplace_category', {
          p_kind: root.querySelector('#content-category-kind').value,
          p_name_en: root.querySelector('#content-category-en').value.trim(),
          p_name_ar: root.querySelector('#content-category-ar').value.trim(),
        });
        if (error) throw error;
        form.reset();
        toast('Marketplace category added.');
        await loadCategories();
      } catch (error) { toast(error.message || 'The category could not be added.'); }
      finally { button.disabled = false; }
    };
    const saveCategory = async (button) => {
      if (!canManageCategories) return;
      const row = button.closest('[data-category-row]');
      const get = (field) => row.querySelector(`[data-category-field="${field}"]`);
      button.disabled = true;
      try {
        const { error } = await client.rpc('iqzodiac_content_update_marketplace_category', {
          p_category_id: row.dataset.categoryRow,
          p_name_en: get('name_en').value.trim(),
          p_name_ar: get('name_ar').value.trim(),
          p_is_active: get('is_active').checked,
          p_sort_order: Number(get('sort_order').value),
        });
        if (error) throw error;
        toast('Marketplace category saved.');
        await loadCategories();
      } catch (error) { toast(error.message || 'The category could not be saved.'); button.disabled = false; }
    };

    root.querySelectorAll('[data-content-tab]').forEach((tab) => tab.addEventListener('click', () => {
      root.querySelectorAll('[data-content-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
      root.querySelectorAll('[data-content-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.contentPanel === tab.dataset.contentTab));
      if (tab.dataset.contentTab === 'categories') void loadCategories();
      else void loadPages();
    }));
    root.querySelector('#content-page-form')?.addEventListener('submit', (event) => void savePage(event));
    root.querySelector('#content-page-reset')?.addEventListener('click', resetPageForm);
    root.querySelector('#content-category-form')?.addEventListener('submit', (event) => void addCategory(event));
    root.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-page-edit]');
      if (edit) { editPage(edit.dataset.pageEdit); return; }
      const publish = event.target.closest('[data-page-publish]');
      if (publish) { void setPagePublished(publish); return; }
      const removePage = event.target.closest('[data-page-delete]');
      if (removePage && isAdmin) { void deletePage(removePage); return; }
      const category = event.target.closest('[data-category-save]');
      if (category) void saveCategory(category);
    });
    await Promise.all([
      canManagePages ? loadPages() : Promise.resolve(),
      canManageCategories ? loadCategories() : Promise.resolve(),
    ]);
  };

  window.IQZodiacSiteContent = { mount };

  if (document.body.hasAttribute('data-site-content-page')) {
    (async () => {
      const loading = document.querySelector('#content-loading');
      const errorBox = document.querySelector('#content-access-error');
      const root = document.querySelector('#site-content-workspace');
      try {
        const client = await window.IQZodiacSupabase.ready;
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData?.session) throw new Error('Sign in with an account authorized for site content management.');
        const { data: allowed, error } = await client.rpc('iqzodiac_can_manage_site_content');
        if (error || allowed !== true) throw new Error('This account is not assigned to manage site content.');
        const { data: isAdmin, error: adminError } = await client.rpc('iqzodiac_is_admin');
        if (adminError) throw adminError;
        root.dataset.siteAdmin = isAdmin === true ? 'true' : 'false';
        loading.hidden = true;
        root.hidden = false;
        await mount(client, root);
      } catch (error) {
        loading.hidden = true;
        errorBox.textContent = error.message || 'The content workspace is temporarily unavailable.';
        errorBox.hidden = false;
      }
    })();
  }
})();
