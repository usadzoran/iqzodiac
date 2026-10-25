(() => {
  'use strict';

  const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const text = {
    en: {
      checking: 'Checking secure wallet status…',
      connected: (version) => `Supabase connected · schema ${version}. No authenticated wallet is linked to this local signup.`,
      unavailable: 'Could not verify Supabase. Wallet balances and actions remain unavailable.',
      noPackages: 'No coin packages are configured. Purchases are disabled; no payment was created.',
      noPayouts: 'Payouts are disabled; no withdrawal request has been submitted.',
      noTransactions: 'No verified transaction rows are available.',
    },
    ar: {
      checking: 'جارٍ التحقق من حالة المحفظة الآمنة…',
      connected: (version) => `قاعدة Supabase متصلة · إصدار المخطط ${version}. لا توجد محفظة موثقة مرتبطة بهذا التسجيل المحلي.`,
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

  window.IQZodiacVipData.getFeatureStatus().then((features) => {
    set('wallet-db-status', text.connected(features.schema_version), 'ok');
    set('checkout-status', features.coin_purchases_enabled ? text.noPackages : text.noPackages, 'pending');
    set('withdraw-status', features.payouts_enabled ? text.noPayouts : text.noPayouts, 'pending');
  }).catch(() => {
    set('wallet-db-status', text.unavailable, 'error');
    set('checkout-status', text.unavailable, 'error');
    set('withdraw-status', text.unavailable, 'error');
  });
})();
