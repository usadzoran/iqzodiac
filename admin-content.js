(() => {
  'use strict';
  const adminContent = document.querySelector('#admin-content');
  const table = document.querySelector('#content-moderators-table');
  const form = document.querySelector('#content-moderator-form');
  const status = document.querySelector('#content-moderator-status');
  if (!adminContent || !table || !form || !status) return;

  const scopeLabels = {
    public_pages: 'Public pages',
    home_sections: 'Home sections',
    discover_sections: 'Discover sections',
    marketplace_sections: 'Marketplace sections',
    profile_sections: 'Profile sections',
    marketplace_categories: 'Marketplace categories',
  };
  const toast = (message) => {
    const node = document.querySelector('#admin-toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { node.hidden = true; }, 3200);
  };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const shortId = (value) => value ? `${String(value).slice(0, 8)}…` : '—';
  const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '—';
  const scopeNames = (scopes) => (scopes || []).map((scope) => scopeLabels[scope]).filter(Boolean);
  const selectedScopes = () => [...form.querySelectorAll('input[name="content-scope"]:checked')].map((input) => input.value);
  const setSelectedScopes = (scopes) => {
    const selected = new Set(scopes || []);
    form.querySelectorAll('input[name="content-scope"]').forEach((input) => { input.checked = selected.has(input.value); });
  };
  const explainError = (error) => {
    const message = error?.message || '';
    if (message.includes('confirmed_user_not_found')) return 'No existing account with a confirmed email matches this address. The account must register and confirm its email first; this panel does not create or invite Auth accounts.';
    if (message.includes('invalid_site_content_scopes')) return 'Select at least one valid site area.';
    return message || 'The content-editor change could not be completed.';
  };

  let started = false;
  let client;

  const loadModerators = async () => {
    const { data, error } = await client.rpc('iqzodiac_admin_list_site_content_moderators');
    if (error) throw error;
    table.innerHTML = data?.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Account</th><th>Public identity</th><th>Assigned site areas</th><th>Status</th><th>Granted</th><th>Revoked</th><th>Action</th></tr></thead><tbody>${data.map((row) => {
      const scopes = Array.isArray(row.scopes) ? row.scopes : [];
      const labels = scopeNames(scopes);
      return `<tr><td><strong>${escapeHTML(row.email || '—')}</strong><div class="muted">${escapeHTML(shortId(row.user_id))}</div></td><td>${escapeHTML(row.display_name || '—')}<div class="muted">${escapeHTML(row.handle || '')}</div></td><td>${labels.length ? labels.map((label) => `<span class="content-scope-chip">${escapeHTML(label)}</span>`).join(' ') : '<span class="muted">No areas assigned</span>'}</td><td>${row.is_active ? 'Active' : 'Inactive'}</td><td class="muted">${escapeHTML(formatDate(row.granted_at))}</td><td class="muted">${escapeHTML(formatDate(row.revoked_at))}</td><td><div class="admin-actions"><button type="button" class="admin-action" data-content-moderator-edit data-email="${escapeHTML(row.email)}" data-scopes="${escapeHTML(JSON.stringify(scopes))}">Edit areas</button><button type="button" class="admin-action${row.is_active ? ' admin-button-danger' : ''}" data-content-moderator-toggle data-email="${escapeHTML(row.email)}" data-active="${row.is_active}">${row.is_active ? 'Revoke' : 'Reactivate'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="admin-empty">No content editors have been assigned.</p>';
  };

  const loadContentAudit = async () => {
    const target = document.querySelector('#site-content-audit-table');
    if (!target) return;
    const { data, error } = await client.from('site_content_audit_log').select('id,actor_user_id,entity_type,entity_id,action_code,before_data,after_data,created_at').order('created_at', { ascending:false }).limit(30);
    if (error) throw error;
    target.innerHTML = data?.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Content item</th></tr></thead><tbody>${data.map((row) => {
      const content = row.after_data || row.before_data || {};
      const name = row.entity_type === 'site_pages' ? `${content.title_en || ''} / ${content.title_ar || ''} · ${content.slug || ''}` : `${content.kind || ''} · ${content.name_en || ''} / ${content.name_ar || ''}`;
      return `<tr><td>${escapeHTML(formatDate(row.created_at))}</td><td class="muted">${escapeHTML(shortId(row.actor_user_id))}</td><td>${escapeHTML(row.action_code.toLowerCase())}</td><td>${escapeHTML(row.entity_type)} <span class="muted">${escapeHTML(shortId(row.entity_id))}</span><div class="muted">${escapeHTML(name)}</div></td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="admin-empty">No site-content changes recorded yet.</p>';
  };

  const setModerator = async (email, active, button) => {
    const action = active ? 'Reactivate' : 'Revoke';
    if (!window.confirm(`${action} site-content access for ${email}? This does not grant administrator, menu, finance, or VIP access.`)) return;
    if (button) button.disabled = true;
    try {
      const { error } = await client.rpc('iqzodiac_admin_set_site_content_moderator', { p_email: email, p_is_active: active });
      if (error) throw error;
      toast(active ? 'Content access reactivated.' : 'Content access revoked.');
      await loadModerators();
      document.querySelector('#audit-refresh')?.click();
    } catch (error) {
      toast(explainError(error));
      if (button) button.disabled = false;
    }
  };

  const resetForm = () => {
    form.reset();
    status.textContent = 'Select a registered, email-confirmed account and at least one site area.';
    form.querySelector('[type="submit"]').textContent = 'Grant content access';
  };

  const bind = () => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.querySelector('#content-moderator-email').value.trim();
      const scopes = selectedScopes();
      const button = form.querySelector('[type="submit"]');
      if (!scopes.length) { status.textContent = 'Select at least one site area.'; return; }
      button.disabled = true;
      status.textContent = 'Verifying account and saving assigned areas…';
      try {
        const { error } = await client.rpc('iqzodiac_admin_set_site_content_moderator_scopes', { p_email: email, p_scopes: scopes });
        if (error) throw error;
        form.reset();
        button.textContent = 'Grant content access';
        status.textContent = 'Access and selected areas saved for the confirmed account.';
        toast('Content-editor access saved.');
        await loadModerators();
        document.querySelector('#audit-refresh')?.click();
      } catch (error) { status.textContent = explainError(error); }
      finally { button.disabled = false; }
    });
    document.querySelector('#content-moderator-reset')?.addEventListener('click', resetForm);
    document.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-content-moderator-edit]');
      if (edit) {
        document.querySelector('#content-moderator-email').value = edit.dataset.email || '';
        let scopes = [];
        try { scopes = JSON.parse(edit.dataset.scopes || '[]'); } catch (_) {}
        setSelectedScopes(scopes);
        form.querySelector('[type="submit"]').textContent = 'Save assigned areas';
        status.textContent = `Editing site areas for ${edit.dataset.email}.`;
        form.scrollIntoView({ behavior:'smooth', block:'center' });
        return;
      }
      const toggle = event.target.closest('[data-content-moderator-toggle]');
      if (toggle) void setModerator(toggle.dataset.email, toggle.dataset.active !== 'true', toggle);
    });
    document.querySelector('#refresh-all')?.addEventListener('click', () => {
      void loadModerators().catch((error) => { status.textContent = explainError(error); });
      void loadContentAudit().catch(() => {});
    });
    document.querySelector('#audit-refresh')?.addEventListener('click', () => void loadContentAudit().catch((error) => toast(error.message || 'Content audit could not be loaded.')));
  };

  const start = async () => {
    if (started || adminContent.hidden) return;
    started = true;
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data: session } = await client.auth.getSession();
      if (!session?.session) return;
      const { data: isAdmin, error } = await client.rpc('iqzodiac_is_admin');
      if (error || isAdmin !== true) return;
      const workspace = document.querySelector('#site-content-workspace');
      workspace.dataset.siteAdmin = 'true';
      await window.IQZodiacSiteContent.mount(client, workspace);
      bind();
      await Promise.all([loadModerators(), loadContentAudit()]);
    } catch (error) {
      console.warn('Admin content controls could not be initialized.', error);
      status.textContent = explainError(error);
    }
  };
  if (!adminContent.hidden) void start();
  new MutationObserver(() => { if (!adminContent.hidden) void start(); }).observe(adminContent, { attributes:true, attributeFilter:['hidden'] });
})();
