(() => {
  'use strict';

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const date = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '—';
  const mounted = new WeakSet();

  const mount = async (client, root) => {
    if (!root || mounted.has(root)) return;
    mounted.add(root);
    root.innerHTML = `
      <nav class="content-tabs" aria-label="Content workspace sections">
        <button class="content-tab-button is-active" type="button" data-content-tab="pages">Public pages</button>
        <button class="content-tab-button" type="button" data-content-tab="categories">Marketplace categories</button>
      </nav>
      <section class="content-panel is-active" data-content-panel="pages">
        <article class="admin-card admin-wide">
          <div class="admin-section-heading"><div><h2>Public pages</h2><p>Plain-text bilingual content. Published pages appear in the visitor page directory.</p></div></div>
          <form id="content-page-form" class="content-editor-form">
            <input type="hidden" id="content-page-id" />
            <label>English title<input id="content-page-title-en" class="admin-input" required maxlength="120" /></label>
            <label>Arabic title<input id="content-page-title-ar" class="admin-input" required maxlength="120" dir="rtl" /></label>
            <label>Page link (slug)<input id="content-page-slug" class="admin-input" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="about-us" autocomplete="off" /></label>
            <label>Display order<input id="content-page-order" class="admin-input" type="number" min="0" max="1000000" value="100" required /></label>
            <label class="content-editor-wide">English content<textarea id="content-page-body-en" class="content-textarea" maxlength="30000" rows="8"></textarea></label>
            <label class="content-editor-wide">Arabic content<textarea id="content-page-body-ar" class="content-textarea" maxlength="30000" rows="8" dir="rtl"></textarea></label>
            <label class="admin-check"><input id="content-page-published" type="checkbox" /> Published and visible to visitors</label>
            <div class="content-editor-actions"><button class="admin-button admin-button-primary" type="submit">Save page</button><button class="admin-button" id="content-page-reset" type="button">Clear form</button><span class="admin-status" id="content-page-status" aria-live="polite"></span></div>
          </form>
          <div id="content-pages-table"><p class="admin-status">Loading pages…</p></div>
        </article>
      </section>
      <section class="content-panel" data-content-panel="categories">
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
      </section>`;

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

    let pages = [];
    const loadPages = async () => {
      const container = root.querySelector('#content-pages-table');
      container.innerHTML = '<p class="admin-status">Loading pages…</p>';
      const { data, error } = await client.from('site_pages').select('id,slug,title_en,title_ar,is_published,sort_order,updated_at').order('sort_order').order('title_en').limit(300);
      if (error) { report(container, error, 'Pages could not be loaded.'); return; }
      pages = data || [];
      if (!pages.length) { container.innerHTML = '<p class="admin-empty">No pages yet. Create the first public page above.</p>'; return; }
      container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>English title</th><th>Arabic title</th><th>Link</th><th>State</th><th>Order</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${pages.map((page) => `<tr><td>${escapeHTML(page.title_en)}</td><td dir="rtl">${escapeHTML(page.title_ar)}</td><td><code>${escapeHTML(page.slug)}</code></td><td>${page.is_published ? 'Published' : 'Draft'}</td><td>${Number(page.sort_order)}</td><td class="muted">${escapeHTML(date(page.updated_at))}</td><td><div class="admin-actions"><button class="admin-action" type="button" data-page-edit="${escapeHTML(page.id)}">Edit</button><button class="admin-action" type="button" data-page-publish="${escapeHTML(page.id)}" data-published="${page.is_published}">${page.is_published ? 'Unpublish' : 'Publish'}</button></div></td></tr>`).join('')}</tbody></table></div>`;
    };

    const resetPageForm = () => {
      root.querySelector('#content-page-form').reset();
      root.querySelector('#content-page-id').value = '';
      root.querySelector('#content-page-order').value = '100';
      root.querySelector('#content-page-status').textContent = '';
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
      };
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
      if (!page) return;
      root.querySelector('#content-page-id').value = page.id;
      root.querySelector('#content-page-slug').value = page.slug;
      root.querySelector('#content-page-title-en').value = page.title_en;
      root.querySelector('#content-page-title-ar').value = page.title_ar;
      root.querySelector('#content-page-body-en').value = page.body_en || '';
      root.querySelector('#content-page-body-ar').value = page.body_ar || '';
      root.querySelector('#content-page-order').value = String(page.sort_order ?? 100);
      root.querySelector('#content-page-published').checked = Boolean(page.is_published);
      root.querySelector('#content-page-form').scrollIntoView({ behavior:'smooth', block:'start' });
    };
    const setPagePublished = async (button) => {
      const id = button.dataset.pagePublish;
      const page = pages.find((row) => row.id === id);
      if (!page) return;
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
      container.innerHTML = '<p class="admin-status">Loading categories…</p>';
      const { data, error } = await client.from('marketplace_categories').select('id,kind,slug,name_en,name_ar,is_active,sort_order').order('kind').order('sort_order').limit(200);
      if (error) { report(container, error, 'Categories could not be loaded.'); return; }
      if (!data?.length) { container.innerHTML = '<p class="admin-empty">No categories available.</p>'; return; }
      container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>English</th><th>Arabic</th><th>Type / slug</th><th>Order</th><th>Visible</th><th>Action</th></tr></thead><tbody>${data.map((row) => `<tr data-category-row="${escapeHTML(row.id)}"><td><input data-category-field="name_en" value="${escapeHTML(row.name_en)}" maxlength="80" aria-label="English category name" /></td><td><input data-category-field="name_ar" value="${escapeHTML(row.name_ar)}" maxlength="80" dir="rtl" aria-label="Arabic category name" /></td><td>${escapeHTML(row.kind)}<div class="muted">${escapeHTML(row.slug)}</div></td><td><input data-category-field="sort_order" type="number" min="0" max="1000000" value="${Number(row.sort_order || 0)}" aria-label="Category display order" /></td><td><input data-category-field="is_active" type="checkbox" ${row.is_active ? 'checked' : ''} aria-label="Category visible" /></td><td><button type="button" class="admin-action" data-category-save="${escapeHTML(row.id)}">Save</button></td></tr>`).join('')}</tbody></table></div>`;
    };
    const addCategory = async (event) => {
      event.preventDefault();
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
    root.querySelector('#content-page-form').addEventListener('submit', (event) => void savePage(event));
    root.querySelector('#content-page-reset').addEventListener('click', resetPageForm);
    root.querySelector('#content-category-form').addEventListener('submit', (event) => void addCategory(event));
    root.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-page-edit]');
      if (edit) { editPage(edit.dataset.pageEdit); return; }
      const publish = event.target.closest('[data-page-publish]');
      if (publish) { void setPagePublished(publish); return; }
      const category = event.target.closest('[data-category-save]');
      if (category) void saveCategory(category);
    });
    await Promise.all([loadPages(), loadCategories()]);
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
