(() => {
  'use strict';

  const getLanguage = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const text = {
    en: {
      checking: 'Checking secure wallet status…',
      connected: (version, coins) => `Account services connected · release ${version}. ${coins === null ? 'No wallet is linked to this account yet.' : `${coins} verified coins available.`}`,
      unavailable: 'Could not verify account services. Wallet balances and actions remain unavailable.',
      noPayouts: 'Payouts are disabled; no withdrawal request has been submitted.',
      noTransactions: 'No verified transaction rows are available.',
    },
    ar: {
      checking: 'جارٍ التحقق من حالة المحفظة الآمنة…',
      connected: (version, coins) => `خدمات الحساب متصلة · الإصدار ${version}. ${coins === null ? 'لا توجد محفظة مرتبطة بهذا الحساب بعد.' : `الرصيد الموثق: ${coins} عملة.`}`,
      unavailable: 'تعذّر التحقق من خدمات الحساب. الأرصدة والعمليات غير متاحة.',
      noPayouts: 'السحب معطّل ولم يُرسل أي طلب سحب.',
      noTransactions: 'لا توجد قيود معاملات موثّقة لعرضها.',
    },
  };

  const purchaseCopy = {
    en: {
      kicker: '01 / Coin purchases',
      heading: 'Buy coins from your Profile',
      copy: 'Coin purchases are managed from your Profile. This page keeps your verified balance and transaction history.',
      badge: 'PROFILE',
      status: 'Checkout remains disabled until secure payment and server verification are connected.',
      link: 'Open Profile wallet',
    },
    ar: {
      kicker: '٠١ / شراء العملات',
      heading: 'اشترِ العملات من ملفك الشخصي',
      copy: 'تُدار مشتريات العملات من صفحة الملف الشخصي. تعرض هذه الصفحة رصيدك الموثق وسجل المعاملات.',
      badge: 'الملف الشخصي',
      status: 'يبقى الدفع معطّلًا حتى ربط وسيلة دفع آمنة والتحقق من العمليات على الخادم.',
      link: 'افتح محفظة الملف الشخصي',
    },
  };

  const byId = (id) => document.getElementById(id);
  const set = (id, value, state) => {
    const element = byId(id);
    if (!element) return;
    element.textContent = value;
    if (state) element.dataset.state = state;
  };

  const renderPurchaseLocation = () => {
    const copy = purchaseCopy[getLanguage()];
    set('wallet-purchase-kicker', copy.kicker);
    set('wallet-purchase-heading', copy.heading);
    set('wallet-purchase-copy', copy.copy);
    set('wallet-purchase-badge', copy.badge);
    set('wallet-purchase-status', copy.status, 'pending');
    set('wallet-purchase-link', copy.link);
  };
  document.addEventListener('iqzodiac:languagechange', renderPurchaseLocation);
  renderPurchaseLocation();

  const languageText = text[getLanguage()];
  byId('wallet-coins').textContent = '—';
  byId('wallet-cash').textContent = '—';
  set('wallet-db-status', languageText.checking, 'pending');
  set('transaction-list', languageText.noTransactions);

  Promise.all([
    window.IQZodiacVipData.getFeatureStatus(),
    window.IQZodiacSupabase.ready.then((client) => client.from('vip_wallets').select('spendable_coins').maybeSingle()),
    window.IQZodiacSupabase.ready.then((client) => client.from('vip_wallet_ledger').select('id,delta_coins,entry_type,created_at').order('created_at', { ascending: false }).limit(20)),
  ]).then(([features, walletResult, ledgerResult]) => {
    if (walletResult.error || ledgerResult.error) throw walletResult.error || ledgerResult.error;
    const coins = walletResult.data?.spendable_coins == null ? null : BigInt(walletResult.data.spendable_coins);
    const formattedCoins = coins === null ? null : new Intl.NumberFormat(getLanguage()).format(coins);
    byId('wallet-coins').textContent = formattedCoins ?? '—';
    set('wallet-db-status', languageText.connected(features.schema_version, formattedCoins), 'ok');
    set('transaction-list', ledgerResult.data?.length ? ledgerResult.data.map((row) => `${row.entry_type}: ${row.delta_coins > 0 ? '+' : ''}${row.delta_coins}`).join(' · ') : languageText.noTransactions);
    set('withdraw-status', features.payouts_enabled ? languageText.noPayouts : languageText.noPayouts, 'pending');
  }).catch(() => {
    set('wallet-db-status', languageText.unavailable, 'error');
    set('withdraw-status', languageText.unavailable, 'error');
  });
})();
