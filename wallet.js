(() => {
  'use strict';

  const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const text = {
    en: {
      checking: 'Checking secure wallet status…',
      connected: (version, coins) => `Supabase connected · schema ${version}. ${coins === null ? 'No wallet row exists for this account.' : `${coins} verified coins available.`}`,
      unavailable: 'Could not verify Supabase. Wallet balances and actions remain unavailable.',
      noPackages: 'No coin packages are configured. Purchases are disabled; no payment was created.',
      noPayouts: 'Payouts are disabled; no withdrawal request has been submitted.',
      noTransactions: 'No verified transaction rows are available.',
    },
    ar: {
      checking: 'جارٍ التحقق من حالة المحفظة الآمنة…',
      connected: (version, coins) => `قاعدة Supabase متصلة · إصدار المخطط ${version}. ${coins === null ? 'لا توجد محفظة مرتبطة بهذا الحساب بعد.' : `الرصيد الموثق: ${coins} عملة.`}`,
      unavailable: 'تعذّر التحقق من Supabase. الأرصدة والعمليات غير متاحة.',
      noPackages: 'لا توجد باقات عملات مضبوطة. الشراء معطّل ولم تُنشأ أي عملية دفع.',
      noPayouts: 'السحب معطّل ولم يُرسل أي طلب سحب.',
      noTransactions: 'لا توجد قيود معاملات موثّقة لعرضها.',
    },
  }[language];

  const byId = (id) => document.getElementById(id);
  const set = (id, value, state) => {
    const element = byId(id);
    if (!element) return;
    element.textContent = value;
    if (state) element.dataset.state = state;
  };

  byId('wallet-coins').textContent = '—';
  byId('wallet-cash').textContent = '—';
  set('wallet-db-status', text.checking, 'pending');
  set('transaction-list', text.noTransactions);

  Promise.all([window.IQZodiacVipData.getFeatureStatus(), window.IQZodiacSupabase.ready.then((client) => client.from('vip_wallets').select('spendable_coins').maybeSingle()), window.IQZodiacSupabase.ready.then((client) => client.from('vip_wallet_ledger').select('id,delta_coins,entry_type,created_at').order('created_at', { ascending: false }).limit(20))]).then(([features, walletResult, ledgerResult]) => {
    if (walletResult.error || ledgerResult.error) throw walletResult.error || ledgerResult.error;
    const coins = walletResult.data?.spendable_coins == null ? null : Number(walletResult.data.spendable_coins);
    byId('wallet-coins').textContent = coins === null ? '—' : coins.toLocaleString();
    set('wallet-db-status', text.connected(features.schema_version, coins), 'ok');
    set('transaction-list', ledgerResult.data?.length ? ledgerResult.data.map((row) => `${row.entry_type}: ${row.delta_coins > 0 ? '+' : ''}${row.delta_coins}`).join(' · ') : text.noTransactions);
    set('checkout-status', features.coin_purchases_enabled ? text.noPackages : text.noPackages, 'pending');
    set('withdraw-status', features.payouts_enabled ? text.noPayouts : text.noPayouts, 'pending');
  }).catch(() => {
    set('wallet-db-status', text.unavailable, 'error');
    set('checkout-status', text.unavailable, 'error');
    set('withdraw-status', text.unavailable, 'error');
  });
})();
