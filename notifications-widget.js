(() => {
  const badge = document.querySelector('#notification-badge');
  if (!badge || !window.IQZodiacSupabase?.ready) return;
  (async () => {
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data: auth } = await client.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return;
      const update = async () => {
        const { count } = await client.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null);
        const unread = Number(count || 0);
        badge.hidden = unread === 0;
        badge.textContent = unread > 99 ? '99+' : String(unread);
      };
      await update();
      client.channel(`notification-badge:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, update).subscribe();
    } catch (error) { console.warn('Notification badge could not be loaded.', error); }
  })();
})();
