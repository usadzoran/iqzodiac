(() => {
  'use strict';
  const root = document.querySelector('#admin-staff-workspace');
  const adminContent = document.querySelector('#admin-content');
  if (!root || !adminContent) return;

  const modules = [
    ['news_articles', 'News & articles'],
    ['posts_feed', 'Posts & community feed'],
    ['reels_videos', 'Reels & video library'],
    ['discover_match', 'Discover & Match'],
    ['members_profiles', 'Members & profiles'],
    ['marketplace', 'Marketplace & categories'],
    ['reports_moderation', 'Reports & moderation'],
    ['live_audio', 'Live & audio rooms'],
    ['website_pages_content', 'Website pages & content'],
    ['website_menus', 'Website menus & navigation'],
  ];
  const permissionLabels = [
    ['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['publish', 'Publish'],
    ['unpublish', 'Unpublish'], ['delete', 'Delete'], ['moderate', 'Moderate'],
    ['manage_settings', 'Manage settings'],
  ];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '—';
  const toast = (message) => {
    const node = document.querySelector('#admin-toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { node.hidden = true; }, 3500);
  };
  let client;
  let rows = [];
  let started = false;

  const renderForm = () => {
    root.innerHTML = `<article class="admin-card admin-wide">
      <div class="admin-section-heading"><div><h2>Employee access</h2><p>Only the master administrator can assign staff access. Each checked permission is independent; selecting a module grants nothing by itself.</p></div></div>
      <form id="admin-staff-form" class="admin-staff-form">
        <div class="admin-staff-identity">
          <label>Confirmed account email<input id="staff-email" class="admin-input" type="email" required maxlength="254" autocomplete="off" placeholder="person@example.com" /></label>
          <label>Job title<input id="staff-job-title" class="admin-input" required maxlength="120" placeholder="News editor" /></label>
          <label class="staff-description">Job description<textarea id="staff-job-description" class="content-textarea" maxlength="1000" rows="3" placeholder="Responsibilities and scope"></textarea></label>
        </div>
        <p class="admin-status">The account must already exist and have a confirmed email. This does not create or invite an Auth account. No permission is selected by default.</p>
        <div class="admin-permission-grid" aria-label="Independent module permissions">${modules.map(([key, label]) => `<fieldset class="admin-permission-card"><legend>${esc(label)}</legend><div class="admin-permission-options">${permissionLabels.map(([permission, title]) => `<label><input type="checkbox" data-module-key="${key}" value="${permission}" /><span>${esc(title)}</span></label>`).join('')}</div></fieldset>`).join('')}</div>
        <div class="content-editor-actions"><button class="admin-button admin-button-primary" type="submit">Save employee access</button><button class="admin-button" id="staff-reset" type="button">Clear form</button><span id="staff-form-status" class="admin-status" aria-live="polite"></span></div>
      </form>
      <div class="admin-section-heading staff-list-heading"><div><h2>Employees</h2><p>Suspending preserves the saved permission set; revoking removes all module grants. Reactivating a suspended employee restores only the saved grants.</p></div><button type="button" class="admin-button" id="staff-refresh">Refresh employees</button></div>
      <div id="admin-staff-table"><p class="admin-status">Loading employees…</p></div>
    </article>`;
    root.querySelector('#admin-staff-form').addEventListener('submit', (event) => void saveEmployee(event));
    root.querySelector('#staff-reset').addEventListener('click', resetForm);
    root.querySelector('#staff-refresh').addEventListener('click', () => void loadEmployees());
    root.addEventListener('click', handleClick);
  };

  const resetForm = () => {
    root.querySelector('#admin-staff-form')?.reset();
    root.querySelector('#staff-form-status').textContent = 'Select an existing confirmed account and explicit permissions.';
    root.querySelector('#admin-staff-form [type="submit"]').textContent = 'Save employee access';
  };

  const loadEmployees = async () => {
    const target = root.querySelector('#admin-staff-table');
    if (!target) return;
    target.innerHTML = '<p class="admin-status">Loading employees…</p>';
    const { data, error } = await client.rpc('iqzodiac_admin_list_employees');
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      target.innerHTML = '<p class="admin-empty">No employees have been assigned.</p>';
      return;
    }
    target.innerHTML = `<div class="admin-table-wrap"><table class="admin-table admin-staff-table"><thead><tr><th>Employee</th><th>Job title</th><th>Module permissions</th><th>Status</th><th>Last activity</th><th>Actions</th></tr></thead><tbody>${rows.map((row) => {
      const grants = Array.isArray(row.permissions) ? row.permissions : [];
      const moduleNames = new Map(modules);
      const grantsByModule = new Map();
      for (const item of grants) {
        if (!grantsByModule.has(item.module_key)) grantsByModule.set(item.module_key, []);
        grantsByModule.get(item.module_key).push(item.permission_key);
      }
      const grantsHtml = [...grantsByModule.entries()].map(([module, permissions]) => `<div class="staff-grant"><strong>${esc(moduleNames.get(module) || module)}</strong><span>${permissions.map((item) => esc(permissionLabels.find(([key]) => key === item)?.[1] || item)).join(' · ')}</span></div>`).join('') || '<span class="muted">No active module grants</span>';
      const actions = row.status === 'active'
        ? `<button type="button" class="admin-action" data-staff-edit="${esc(row.user_id)}">Edit</button><button type="button" class="admin-action" data-staff-state="${esc(row.user_id)}" data-next-state="suspended">Suspend</button><button type="button" class="admin-action admin-button-danger" data-staff-state="${esc(row.user_id)}" data-next-state="revoked">Revoke</button>`
        : row.status === 'suspended'
          ? `<button type="button" class="admin-action" data-staff-edit="${esc(row.user_id)}">Edit</button><button type="button" class="admin-action" data-staff-state="${esc(row.user_id)}" data-next-state="active">Reactivate</button><button type="button" class="admin-action admin-button-danger" data-staff-state="${esc(row.user_id)}" data-next-state="revoked">Revoke</button>`
          : `<button type="button" class="admin-action" data-staff-edit="${esc(row.user_id)}">Assign again</button>`;
      return `<tr><td><strong>${esc(row.email || '—')}</strong><div class="muted">${esc(row.display_name || '')}${row.handle ? ` · ${esc(row.handle)}` : ''}</div></td><td>${esc(row.job_title)}<div class="muted">${esc(row.job_description || '')}</div></td><td>${grantsHtml}</td><td><span class="staff-status staff-status-${esc(row.status)}">${esc(row.status)}</span></td><td class="muted">${esc(formatDate(row.last_activity_at))}</td><td><div class="admin-actions">${actions}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const email = root.querySelector('#staff-email').value.trim();
    const jobTitle = root.querySelector('#staff-job-title').value.trim();
    const jobDescription = root.querySelector('#staff-job-description').value;
    const grouped = new Map();
    root.querySelectorAll('[data-module-key]:checked').forEach((input) => {
      if (!grouped.has(input.dataset.moduleKey)) grouped.set(input.dataset.moduleKey, []);
      grouped.get(input.dataset.moduleKey).push(input.value);
    });
    if (!grouped.size) {
      root.querySelector('#staff-form-status').textContent = 'Choose at least one explicit permission; a module assignment alone is not access.';
      return;
    }
    const payload = [...grouped].map(([module_key, permissions]) => ({ module_key, permissions }));
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    root.querySelector('#staff-form-status').textContent = 'Verifying the confirmed account and saving permissions…';
    try {
      const { error } = await client.rpc('iqzodiac_admin_save_employee', {
        p_email: email,
        p_job_title: jobTitle,
        p_job_description: jobDescription,
        p_permissions: payload,
      });
      if (error) throw error;
      resetForm();
      root.querySelector('#staff-form-status').textContent = 'Employee access saved.';
      toast('Employee permissions saved.');
      await loadEmployees();
    } catch (error) {
      root.querySelector('#staff-form-status').textContent = explainError(error);
    } finally { button.disabled = false; }
  };

  const explainError = (error) => {
    const code = `${error?.message || ''} ${error?.details || ''}`;
    if (code.includes('confirmed_user_not_found')) return 'No existing account with a confirmed email matches this address. The person must register and confirm their email first.';
    if (code.includes('employee_requires_explicit_permission')) return 'Select at least one specific permission; module access alone grants nothing.';
    if (code.includes('master_admin_required')) return 'Only the master site administrator can manage employees.';
    return error?.message || 'The employee change could not be saved.';
  };

  const handleClick = (event) => {
    const edit = event.target.closest('[data-staff-edit]');
    if (edit) {
      const row = rows.find((item) => item.user_id === edit.dataset.staffEdit);
      if (!row) return;
      root.querySelector('#staff-email').value = row.email || '';
      root.querySelector('#staff-job-title').value = row.job_title || '';
      root.querySelector('#staff-job-description').value = row.job_description || '';
      const selected = new Set((row.permissions || []).map((item) => `${item.module_key}:${item.permission_key}`));
      root.querySelectorAll('[data-module-key]').forEach((input) => { input.checked = selected.has(`${input.dataset.moduleKey}:${input.value}`); });
      root.querySelector('#admin-staff-form [type="submit"]').textContent = row.status === 'revoked' ? 'Assign employee again' : 'Save employee changes';
      root.querySelector('#staff-form-status').textContent = `Editing ${row.email}. Saving will reactivate the account with only the selected permissions.`;
      root.querySelector('#admin-staff-form').scrollIntoView({ behavior:'smooth', block:'start' });
      return;
    }
    const stateButton = event.target.closest('[data-staff-state]');
    if (!stateButton) return;
    const row = rows.find((item) => item.user_id === stateButton.dataset.staffState);
    if (!row) return;
    const next = stateButton.dataset.nextState;
    const prompt = next === 'revoked'
      ? `Revoke all module access for ${row.email}? Saved permissions will be removed.`
      : `${next === 'suspended' ? 'Suspend' : 'Reactivate'} ${row.email}?`;
    if (!window.confirm(prompt)) return;
    stateButton.disabled = true;
    void client.rpc('iqzodiac_admin_set_employee_status', { p_user_id: row.user_id, p_status: next })
      .then(({ error }) => { if (error) throw error; toast(`Employee access ${next}.`); return loadEmployees(); })
      .catch((error) => { toast(explainError(error)); stateButton.disabled = false; });
  };

  const start = async () => {
    if (started || adminContent.hidden || !window.IQZodiacAdminCenter?.access?.is_master) return;
    started = true;
    try {
      client = window.IQZodiacAdminCenter.client || await window.IQZodiacSupabase.ready;
      const { data: access, error: accessError } = await client.rpc('iqzodiac_admin_my_access');
      if (accessError) throw accessError;
      if (!access?.is_master) throw new Error('Only the master site administrator can manage employees.');
      renderForm();
      await loadEmployees();
    } catch (error) {
      started = false;
      root.innerHTML = `<p class="admin-error">${esc(explainError(error))}</p>`;
    }
  };

  new MutationObserver(() => { if (!adminContent.hidden) void start(); })
    .observe(adminContent, { attributes:true, attributeFilter:['hidden'] });
})();
