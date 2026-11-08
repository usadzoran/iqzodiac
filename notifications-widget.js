(() => {
  const badge = document.querySelector('#notification-badge');
  if (!badge || !window.IQZodiacSupabase?.ready) return;

  const trigger = document.querySelector('#notification-trigger');
  const popover = document.querySelector('#notification-popover');
  const popoverList = document.querySelector('#notification-popover-list');
  const markReadButton = document.querySelector('#popover-mark-read');
  let client = null;
  let userId = null;
  let notificationRows = [];

  const updateBadge = () => {
    const unread = notificationRows.filter((row) => !row.read_at).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  };

  const markNotificationRead = async (id) => {
    const readAt = new Date().toISOString();
    notificationRows = notificationRows.map((row) => row.id === id ? { ...row, read_at: readAt } : row);
    updateBadge();
    try {
      await client.from('notifications').update({ read_at: readAt }).eq('id', id);
    } catch (error) {
      console.warn('Notification could not be marked as read.', error);
    }
  };

  const deleteNotification = async (id) => {
    const previousRows = notificationRows;
    notificationRows = notificationRows.filter((row) => row.id !== id);
    updateBadge();
    renderPopover();
    const { error } = await client.from('notifications').delete().eq('id', id);
    if (error) {
      notificationRows = previousRows;
      updateBadge();
      renderPopover();
      console.warn('Notification could not be deleted.', error);
    }
  };

  const renderPopover = () => {
    if (!popoverList) return;
    popoverList.replaceChildren();
    const rows = notificationRows.slice(0, 8);
    if (!rows.length) {
      popoverList.innerHTML = '<p class="sidebar-note">No notifications.</p>';
      return;
    }
    rows.forEach((row) => {
      const entry = document.createElement('div');
      entry.className = 'notification-popover-entry';
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `notification-popover-item${row.read_at ? '' : ' is-unread'}`;
      item.dataset.reelId = row.reel_id || '';
      const icon = document.createElement('span');
      icon.textContent = row.read_at ? '·' : '•';
      const copy = document.createElement('span');
      copy.textContent = row.message || 'New notification';
      const time = document.createElement('small');
      time.textContent = row.created_at ? new Date(row.created_at).toLocaleString() : '';
      copy.append(time);
      item.append(icon, copy);
      item.addEventListener('click', async () => {
        await markNotificationRead(row.id);
        renderPopover();
        if (row.reel_id) window.location.href = `./reel.html?reel=${encodeURIComponent(row.reel_id)}`;
      });
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'notification-delete';
      deleteButton.setAttribute('aria-label', 'Delete notification');
      deleteButton.title = 'Delete notification';
      deleteButton.textContent = '×';
      deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        await deleteNotification(row.id);
      });
      entry.append(item, deleteButton);
      popoverList.append(entry);
    });
  };

  trigger?.addEventListener('click', () => {
    const open = Boolean(popover?.hidden);
    if (popover) popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) renderPopover();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#notification-menu')) {
      if (popover) popover.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });

  markReadButton?.addEventListener('click', async () => {
    if (!userId) return;
    const readAt = new Date().toISOString();
    notificationRows = notificationRows.map((row) => ({ ...row, read_at: row.read_at || readAt }));
    updateBadge();
    renderPopover();
    try {
      await client.from('notifications').update({ read_at: readAt }).eq('recipient_id', userId).is('read_at', null);
    } catch (error) {
      console.warn('Notifications could not be marked as read.', error);
    }
  });

  (async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data: auth } = await client.auth.getUser();
      userId = auth?.user?.id;
      if (!userId) return;
      const update = async () => {
        const { data, error } = await client.from('notifications').select('id,message,read_at,created_at,post_id,comment_id,reel_id,reel_comment_id').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(30);
        if (error) throw error;
        notificationRows = data || [];
        updateBadge();
        renderPopover();
      };
      await update();
      client.channel(`notification-menu:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, update).subscribe();
    } catch (error) {
      console.warn('Notifications could not be loaded.', error);
    }
  })();
})();
