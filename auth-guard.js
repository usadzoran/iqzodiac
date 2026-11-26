(() => {
  'use strict';
  const target = `${window.location.pathname}${window.location.search}`;
  const retryDelays = [0, 350, 800, 1500];

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const getSessionWithRetry = async (client) => {
    let lastError;
    for (const delay of retryDelays) {
      if (delay) await wait(delay);
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          lastError = error;
          continue;
        }
        if (data.session) return data.session;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return null;
  };

  window.IQZodiacSupabase?.ready.then(async (client) => {
    const session = await getSessionWithRetry(client);
    if (!session) {
      window.location.replace(`./login.html?next=${encodeURIComponent(target)}`);
      return;
    }
    window.IQZodiacAuth = { client, session };
    document.documentElement.dataset.authenticated = 'true';
    const syncPresence = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { error } = await client.rpc('match_presence_heartbeat', { p_online: true });
        if (error) throw error;
      } catch (error) { console.warn('Presence heartbeat failed.', error); }
    };
    const presenceTimer = window.setInterval(() => void syncPresence(), 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncPresence(); });
    window.addEventListener('pagehide', () => window.clearInterval(presenceTimer), { once: true });
    void syncPresence();
  }).catch((error) => {
    // A temporary configuration/network failure must not be treated as a logout.
    console.warn('Authentication check could not be completed.', error);
  });
})();
