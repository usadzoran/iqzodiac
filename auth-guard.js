(() => {
  'use strict';
  const target = `${window.location.pathname}${window.location.search}`;
  window.IQZodiacSupabase?.ready.then(async (client) => {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      window.location.replace(`./login.html?next=${encodeURIComponent(target)}`);
      return;
    }
    document.documentElement.dataset.authenticated = 'true';
  }).catch(() => {
    window.location.replace(`./login.html?next=${encodeURIComponent(target)}`);
  });
})();
