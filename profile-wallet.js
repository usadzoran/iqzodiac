(() => {
  'use strict';

  const copy = {
    en: {
      kicker: '03 / Profile wallet',
      title: 'Coins & gifts',
      description: 'Your coin balance and gift options are together here. Purchases and sending stay disabled until their secure server-side flows are connected.',
      balanceLabel: 'Available balance',
      coinUnit: 'coins',
      buyButton: 'Buy coins',
      purchaseNote: 'Purchases are disabled until secure checkout and verified payment webhooks are connected.',
      ledgerLink: 'Transaction history ↗',
      walletBadge: { loading: 'CHECKING WALLET', verified: 'VERIFIED', empty: 'NO WALLET', error: 'NOT VERIFIED' },
      walletStatus: {
        loading: 'Checking your verified coin balance…',
        verified: 'Your balance is verified.',
        empty: 'No wallet is linked yet. Your current balance is 0 coins.',
        error: 'Could not verify your balance.',
      },
      gifts: {
        kicker: 'GIFTS · IN YOUR PROFILE',
        title: 'Available gifts',
        badge: { loading: 'CHECKING', ready: 'CATALOG READY', empty: 'NO GIFTS', error: 'UNAVAILABLE' },
        status: {
          loading: 'Checking available gifts…',
          ready: 'Gift choices are shown below. Sending is disabled until a verified server-side gift flow is connected.',
          empty: 'No gifts are available for this account yet. No gift will be sent and no coins will be deducted.',
          error: 'Could not load gifts. No gift will be sent and no coins will be deducted.',
        },
        unavailablePrice: 'Price unavailable',
        coinUnit: 'coins',
        sendDisabled: 'Sending unavailable',
        fallbackName: 'Gift',
        fallbackCategory: 'Gift',
      },
    },
    ar: {
      kicker: '٠٣ / محفظة الملف الشخصي',
      title: 'العملات والهدايا',
      description: 'رصيد العملات وخيارات الهدايا في مكان واحد هنا. يبقى الشراء والإرسال معطّلين حتى ربط التدفقات الآمنة على الخادم.',
      balanceLabel: 'الرصيد المتاح',
      coinUnit: 'عملة',
      buyButton: 'شراء العملات',
      purchaseNote: 'الشراء معطّل حتى ربط بوابة دفع آمنة والتحقق من إشعارات الدفع من الخادم.',
      ledgerLink: 'سجل المعاملات ↗',
      walletBadge: { loading: 'جارٍ التحقق', verified: 'موثّق', empty: 'لا توجد محفظة', error: 'غير موثّق' },
      walletStatus: {
        loading: 'جارٍ التحقق من رصيد العملات الموثق…',
        verified: 'تم التحقق من رصيدك.',
        empty: 'لا توجد محفظة مرتبطة بعد. رصيدك الحالي ٠ عملة.',
        error: 'تعذّر التحقق من رصيدك.',
      },
      gifts: {
        kicker: 'الهدايا · في ملفك الشخصي',
        title: 'الهدايا المتاحة',
        badge: { loading: 'جارٍ التحقق', ready: 'الكتالوج جاهز', empty: 'لا توجد هدايا', error: 'غير متاح' },
        status: {
          loading: 'جارٍ التحقق من الهدايا المتاحة…',
          ready: 'تظهر خيارات الهدايا أدناه. يبقى الإرسال معطّلًا حتى ربط تدفق موثّق وآمن على الخادم.',
          empty: 'لا توجد هدايا متاحة لهذا الحساب حاليًا. لن تُرسل هدية ولن تُخصم عملات.',
          error: 'تعذّر تحميل الهدايا. لن تُرسل هدية ولن تُخصم عملات.',
        },
        unavailablePrice: 'السعر غير متاح',
        coinUnit: 'عملة',
        sendDisabled: 'الإرسال غير متاح',
        fallbackName: 'هدية',
        fallbackCategory: 'هدية',
      },
    },
  };

  let walletState = 'loading';
  let availableCoins = null;
  let giftState = 'loading';
  let gifts = [];

  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value;
  };

  const formatPrice = (rawPrice, language, text) => {
    const raw = String(rawPrice ?? '');
    if (!/^\d+$/.test(raw)) return text.gifts.unavailablePrice;
    return `${new Intl.NumberFormat(language).format(BigInt(raw))} ${text.gifts.coinUnit}`;
  };

  const renderGiftCards = (language, text) => {
    const grid = byId('profile-gift-grid');
    if (!grid) return;
    grid.replaceChildren();
    grid.dataset.state = giftState;

    if (giftState !== 'ready') return;
    gifts.forEach((gift) => {
      const card = document.createElement('article');
      card.className = 'profile-gift-item';

      const art = document.createElement('img');
      art.className = 'profile-gift-art';
      art.src = gift.asset_path || `./assets/gifts/${gift.icon_asset_ref}.svg`;
      art.alt = String(gift[language === 'ar' ? 'name_ar' : 'name_en'] || gift.name || gift.gift_code || text.gifts.fallbackName);

      const details = document.createElement('div');
      details.className = 'profile-gift-copy';
      const name = document.createElement('h4');
      name.textContent = art.alt;
      const category = document.createElement('p');
      category.textContent = `${String(gift.category || text.gifts.fallbackCategory)} · $${Number(gift.usd_value || 0).toFixed(2)}`;
      details.append(name, category);

      const offer = document.createElement('div');
      offer.className = 'profile-gift-offer';
      const price = document.createElement('span');
      price.className = 'profile-gift-price';
      price.textContent = formatPrice(gift.price_coins, language, text);
      const send = document.createElement('button');
      send.className = 'profile-gift-send';
      send.type = 'button';
      send.disabled = true;
      send.setAttribute('aria-disabled', 'true');
      send.textContent = text.gifts.sendDisabled;
      offer.append(price, send);

      card.append(art, details, offer);
      grid.append(card);
    });
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
    setText('profile-wallet-ledger', text.ledgerLink);
    setText('profile-wallet-badge', text.walletBadge[walletState]);
    setText('profile-wallet-status', text.walletStatus[walletState]);
    setText('profile-gift-kicker', text.gifts.kicker);
    setText('profile-gift-title', text.gifts.title);
    setText('profile-gift-badge', text.gifts.badge[giftState]);
    setText('profile-gift-status', text.gifts.status[giftState]);

    const amount = byId('profile-wallet-coins');
    if (amount) amount.textContent = availableCoins === null ? '—' : new Intl.NumberFormat(language).format(availableCoins);
    const purchaseButton = byId('profile-buy-coins');
    if (purchaseButton) {
      purchaseButton.disabled = true;
      purchaseButton.setAttribute('aria-disabled', 'true');
    }
    const walletStatus = byId('profile-wallet-status');
    if (walletStatus) walletStatus.dataset.state = walletState;
    const giftStatus = byId('profile-gift-status');
    if (giftStatus) giftStatus.dataset.state = giftState;
    renderGiftCards(language, text);
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
      walletState = data ? 'verified' : 'empty';
    } catch {
      availableCoins = null;
      walletState = 'error';
    }
    render();
  })();

  (async () => {
    try {
      const listGifts = window.IQZodiacData?.adapter?.listGifts;
      if (typeof listGifts !== 'function') throw new Error('Gift catalog unavailable');
      const rows = await listGifts.call(window.IQZodiacData.adapter);
      gifts = Array.isArray(rows) ? rows.filter((gift) => gift && typeof gift === 'object') : [];
      giftState = gifts.length ? 'ready' : 'empty';
    } catch {
      gifts = [];
      giftState = 'error';
    }
    render();
  })();
})();
