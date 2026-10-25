(() => {
  'use strict';

  let configPromise;
  let featureStatusPromise;

  async function getConfig() {
    if (!configPromise) {
      configPromise = (async () => {
        const configUrl = new URL('public/supabase-public-config.json', document.baseURI);
        const response = await fetch(configUrl, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('supabase_config_unavailable');
        const config = await response.json();
        const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
        const publishableKey = String(config.publishableKey || '');
        if (!/^https:\/\//i.test(supabaseUrl) || !publishableKey.startsWith('sb_publishable_')) {
          throw new Error('supabase_config_invalid');
        }
        return { supabaseUrl, publishableKey, apiBaseUrl: String(config.apiBaseUrl || '').trim().replace(/\/+$/, '') };
      })();
    }
    return configPromise;
  }

  async function getFeatureStatus() {
    if (!featureStatusPromise) {
      featureStatusPromise = (async () => {
        const config = await getConfig();
        const query = new URLSearchParams({
          select: 'schema_version,live_streaming_enabled,coin_purchases_enabled,gift_sending_enabled,payouts_enabled',
          singleton: 'eq.true',
        });
        const response = await fetch(`${config.supabaseUrl}/rest/v1/vip_feature_status?${query}`, {
          cache: 'no-store',
          headers: { apikey: config.publishableKey, Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('supabase_status_unavailable');
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.length !== 1) throw new Error('supabase_status_missing');
        return rows[0];
      })();
    }
    return featureStatusPromise;
  }

  async function getLiveApiUrl() {
    const config = await getConfig();
    return config.apiBaseUrl
      ? `${config.apiBaseUrl}/api/vip/live`
      : new URL('/api/vip/live', window.location.origin).toString();
  }

  window.IQZodiacVipData = Object.freeze({ getConfig, getFeatureStatus, getLiveApiUrl });
})();
