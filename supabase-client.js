(() => {
  'use strict';

  const configUrl = './public/supabase-public-config.json';
  const ready = (async () => {
    if (!window.supabase?.createClient) throw new Error('Supabase client library is not loaded.');
    const response = await fetch(configUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load Supabase configuration.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.publishableKey) throw new Error('Supabase configuration is incomplete.');
    return window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  })();

  window.IQZodiacSupabase = { ready };
})();
