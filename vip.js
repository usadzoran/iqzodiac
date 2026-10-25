(() => {
  'use strict';

  const status = document.getElementById('vip-status');
  const action = document.getElementById('vip-action');
  action.disabled = true;
  action.setAttribute('aria-disabled', 'true');

  window.IQZodiacVipData.getFeatureStatus().then((features) => {
    const enabled = features.coin_purchases_enabled === true;
    status.dataset.state = 'ok';
    status.textContent = enabled
      ? `Supabase connected · schema ${features.schema_version}. Checkout still requires a verified payment provider.`
      : `Supabase connected · schema ${features.schema_version}. VIP checkout is not connected; no payment can be made.`;
  }).catch(() => {
    status.dataset.state = 'error';
    status.textContent = 'Could not verify Supabase. VIP checkout remains disabled.';
  });
})();
