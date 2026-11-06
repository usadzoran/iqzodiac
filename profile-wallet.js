(() => {
  'use strict';

  const copy = {
    en: {
      kicker: '03 / Wallet & gifts',
      title: 'Coins for gifts',
      description: 'Manage your coin balance here. Use coins to send gifts when gifting is enabled.',
      balanceLabel: 'Available balance',
      coinUnit: 'coins',
      buyButton: 'Buy coins',
      purchaseNote: 'Purchases are currently disabled until secure checkout and verified payment webhooks are connected.',
      giftsLink: 'View gift store',
      ledgerLink: 'Transaction history ↗',
      badge: { loading: 'CHECKING WALLET', verified: 'VERIFIED', empty: 'NO WALLET', error: 'NOT VERIFIED' },
      status: {
        loading: 'Checking your verified coin balance…',
        verified: 'Your balance is verified and ready for future gift use.',
        empty: 'No wallet is linked yet. Your current balance is 0 coins.',
        error: 'Could not verify your balance. No purchase can be made here.',
      },
    },
    ar: {
      kicker: '03 / المحفظة والهدايا',
      title: 'عملات للهدايا',
      description: 'أدر رصيد عملاتك من هنا. استخدم العملات لإرسال الهدايا عند تفعيل الإرسال.',
      balanceLabel: 'الرصيد المتاح',
      coinUnit: 'عملة',
      buyButton: 'شراء العملات',
      purchaseNote: 'الشراء معطّل حاليًا حتى ربط بوابة دفع آمنة والتحقق من إشعارات الدفع من الخادم.',
      giftsLink: 'استعراض متجر الهدايا',
      ledgerLink: 'سجل المعاملات ↗',
      badge: { loading: 'جارٍ التحقق', verified: 'موثّق', empty: 'لا توجد محفظة', error: 'غير موثّق' },
      status: {
        loading: 'جارٍ التحقق من رصيد العملات الموثق…',
        verified: 'تم التحقق من رصيدك. سيُستخدم لاحقًا لإرسال الهدايا.',
        empty: 'لا توجد محفظة مرتبطة بعد. رصيدك الحالي ٠ عملة.',
        error: 'تعذّر التحقق من رصيدك. لا يمكن إجراء شراء هنا.',
      },
    },
  };

  let state = 'loading';
  let availableCoins = null;
  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value;
  };

  const render = () => {
    const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
    const text = copy[language];
    setText('profile-wallet-kicker', text.kicker);
    setText('profile-wallet-title', text.title);
    setText('profile-wallet-description', text.description);
    setText('profile-wallet-balance-label', text.balanceLabel);
    setText('profile-wallet-coin-unit', text.coinUnit);
    setText('profile-buy-coins', text.buyButton);
    setText('profile-wallet-purchase-note', text.purchaseNote);
    setText('profile-wallet-gifts', text.giftsLink);
    setText('profile-wallet-ledger', text.ledgerLink);
    setText('profile-wallet-badge', text.badge[state]);
    setText('profile-wallet-status', text.status[state]);

    const amount = byId('profile-wallet-coins');
    if (amount) amount.textContent = availableCoins === null ? '—' : new Intl.NumberFormat(language).format(availableCoins);
    const purchaseButton = byId('profile-buy-coins');
    if (purchaseButton) {
      purchaseButton.disabled = true;
      purchaseButton.setAttribute('aria-disabled', 'true');
    }
    const status = byId('profile-wallet-status');
    if (status) status.dataset.state = state;
  };

  document.addEventListener('iqzodiac:languagechange', render);
  render();

  (async () => {
    try {
      if (!window.IQZodiacSupabase?.ready) throw new Error('Wallet service unavailable');
      const client = await window.IQZodiacSupabase.ready;
      const { data, error } = await client
        .from('vip_wallets')
        .select('spendable_coins')
        .maybeSingle();
      if (error) throw error;
      availableCoins = BigInt(data?.spendable_coins ?? 0);
      state = data ? 'verified' : 'empty';
    } catch {
      availableCoins = null;
      state = 'error';
    }
    render();
  })();
})();
