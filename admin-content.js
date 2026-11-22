(() => {
  'use strict';
  const adminContent = document.querySelector('#admin-content');
  const table = document.querySelector('#content-moderators-table');
  const form = document.querySelector('#content-moderator-form');
  const status = document.querySelector('#content-moderator-status');
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
  let started = false;
  let client;

  const loadModerators = async () => {
    const { data, error } = await client.rpc('iqzodiac_admin_list_site_content_moderators');
    if (error) throw error;
    table.innerHTML = data?.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Account</th><th>Public identity</th><th>Status</th><th>Granted</th><th>Revoked</th><th>Action</th></tr></thead><tbody>${data.map((row) => `<tr><td><strong>${escapeHTML(row.email || '—')}</strong><div class="muted">${escapeHTML(shortId(row.user_id))}</div></td><td>${escapeHTML(row.display_name || '—')}<div class="muted">${escapeHTML(row.handle || '')}</div></td><td>${row.is_active ? 'Active' : 'Inactive'}</td><td class="muted">${escapeHTML(formatDate(row.granted_at))}</td><td class="muted">${escapeHTML(formatDate(row.revoked_at))}</td><td><button type="button" class="admin-action${row.is_active ? ' admin-button-danger' : ''}" data-content-moderator-toggle data-email="${escapeHTML(row.email)}" data-active="${row.is_active}">${row.is_active ? 'Revoke' : 'Reactivate'}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="admin-empty">No content editors have been assigned.</p>';
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
    const action = active ? 'grant' : 'revoke';
    if (!window.confirm(`${action === 'grant' ? 'Grant' : 'Revoke'} access for ${email}? This role only manages public pages and Marketplace categories.`)) return;
    if (button) button.disabled = true;
    try {
      const { error } = await client.rpc('iqzodiac_admin_set_site_content_moderator', { p_email: email, p_is_active: active });
      if (error) throw error;
      toast(active ? 'Content access granted.' : 'Content access revoked.');
      await loadModerators();
      document.querySelector('#audit-refresh')?.click();
    } catch (error) {
      toast(error.message || 'Content access could not be changed.');
      if (button) button.disabled = false;
    }
  };

  const bind = () => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.querySelector('#content-moderator-email').value.trim();
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      status.textContent = 'Verifying account…';
      try {
        const { error } = await client.rpc('iqzodiac_admin_set_site_content_moderator', { p_email: email, p_is_active: true });
        if (error) throw error;
        form.reset();
        status.textContent = 'Content access granted to the confirmed account.';
        toast('Content access granted.');
        await loadModerators();
        document.querySelector('#audit-refresh')?.click();
      } catch (error) { status.textContent = error.message || 'The account could not be assigned.'; }
      finally { button.disabled = false; }
    });
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-content-moderator-toggle]');
      if (button) void setModerator(button.dataset.email, button.dataset.active !== 'true', button);
    });
    document.querySelector('#refresh-all')?.addEventListener('click', () => { void loadModerators().catch((error) => { status.textContent = error.message || 'Content editors could not be loaded.'; }); void loadContentAudit().catch(() => {}); });
    document.querySelector('#audit-refresh')?.addEventListener('click', () => { void loadContentAudit().catch((error) => toast(error.message || 'Content audit could not be loaded.')); });
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
      await window.IQZodiacSiteContent.mount(client, document.querySelector('#site-content-workspace'));
      bind();
      await Promise.all([loadModerators(), loadContentAudit()]);
    } catch (error) {
      console.warn('Admin content controls could not be initialized.', error);
      status.textContent = error.message || 'Content controls are temporarily unavailable.';
    }
  };
  if (!adminContent) return;
  if (!adminContent.hidden) void start();
  new MutationObserver(() => { if (!adminContent.hidden) void start(); }).observe(adminContent, { attributes:true, attributeFilter:['hidden'] });
})();
