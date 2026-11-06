(() => {
  'use strict';
  const getLanguage = () => window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const copy = {
    en: {
      checking: 'Checking secure wallet status…',
      connected: (version) => `Account services connected · release ${version}.`,
      unavailable: 'Could not verify account services. Wallet balances and actions remain unavailable.',
      noPayouts: 'Payouts are disabled; no withdrawal request has been submitted.',
      noCoins: 'No verified coin transactions are available.',
      noCash: 'No verified USD earnings are available.',
      authUnavailable: 'Sign in to view account balances.',
      cashError: 'USD earnings could not be verified; no cash balance is shown.',
      coinsError: 'Coin transactions could not be verified.',
      purchase: {
        kicker: '01 / Coin purchases',
        heading: 'Buy coins from your Profile',
        copy: 'Coin purchases are managed from your Profile. This page keeps your verified balance and transaction history.',
        badge: 'PROFILE',
        status: 'Checkout remains disabled until secure payment and server verification are connected.',
        link: 'Open Profile wallet',
      },
      cash: {
        title: 'Creator earnings · USD',
        note: 'Cash earnings are recorded only from verified cash events. Coin gifts are not converted into USD.',
        lifetime: 'Lifetime creator share', available: 'Available', pending: 'Pending',
        reserved: 'Reserved for withdrawal', withdrawn: 'Paid out', history: 'Recent USD ledger entries',
      },
      coinHistory: 'Coin activity',
    },
    ar: {
      checking: 'جارٍ التحقق من حالة المحفظة الآمنة…',
      connected: (version) => `خدمات الحساب متصلة · الإصدار ${version}.`,
      unavailable: 'تعذّر التحقق من خدمات الحساب. الأرصدة والعمليات غير متاحة.',
      noPayouts: 'السحب معطّل ولم يُرسل أي طلب سحب.',
      noCoins: 'لا توجد معاملات عملات موثّقة لعرضها.',
      noCash: 'لا توجد أرباح USD موثّقة لعرضها.',
      authUnavailable: 'سجّل الدخول لعرض أرصدة الحساب.',
      cashError: 'تعذّر التحقق من أرباح USD؛ لن نعرض رصيدًا نقديًا.',
      coinsError: 'تعذّر التحقق من معاملات العملات.',
      purchase: {
        kicker: '٠١ / شراء العملات',
        heading: 'اشترِ العملات من ملفك الشخصي',
        copy: 'تُدار مشتريات العملات من صفحة الملف الشخصي. تعرض هذه الصفحة رصيدك الموثق وسجل المعاملات.',
        badge: 'الملف الشخصي',
        status: 'يبقى الدفع معطّلًا حتى ربط وسيلة دفع آمنة والتحقق من العمليات على الخادم.',
        link: 'افتح محفظة الملف الشخصي',
      },
      cash: {
        title: 'أرباح المنشئ · USD',
        note: 'تُسجّل الأرباح النقدية من أحداث نقدية موثّقة فقط. لا تتحول هدايا العملات إلى USD.',
        lifetime: 'إجمالي حصة المنشئ', available: 'متاح', pending: 'قيد الانتظار',
        reserved: 'محجوز للسحب', withdrawn: 'مدفوع', history: 'أحدث قيود دفتر USD',
      },
      coinHistory: 'حركة العملات',
    },
  };
  const byId = (id) => document.getElementById(id);
  const setText = (id, value, state) => {
    const element = byId(id);
    if (!element) return;
    element.textContent = value;
    if (state) element.dataset.state = state;
  };
  const formatUsd = (value, language) => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' }).format(number);
  };
  const renderCopy = () => {
    const labels = copy[getLanguage()];
    const purchase = labels.purchase;
    setText('wallet-purchase-kicker', purchase.kicker);
    setText('wallet-purchase-heading', purchase.heading);
    setText('wallet-purchase-copy', purchase.copy);
    setText('wallet-purchase-badge', purchase.badge);
    setText('wallet-purchase-status', purchase.status, 'pending');
    setText('wallet-purchase-link', purchase.link);
    setText('cash-title', labels.cash.title);
    setText('cash-note', labels.cash.note);
    setText('cash-label-lifetime', labels.cash.lifetime);
    setText('cash-label-available', labels.cash.available);
    setText('cash-label-pending', labels.cash.pending);
    setText('cash-label-reserved', labels.cash.reserved);
    setText('cash-label-withdrawn', labels.cash.withdrawn);
    setText('cash-history-title', labels.cash.history);
    setText('coin-history-title', labels.coinHistory);
  };
  document.addEventListener('iqzodiac:languagechange', renderCopy);
  renderCopy();

  const renderRows = (containerId, rows, emptyText, formatter) => {
    const container = byId(containerId);
    if (!container) return;
    container.replaceChildren();
    if (!rows?.length) {
      const empty = document.createElement('p');
      empty.className = 'wallet-status';
      empty.textContent = emptyText;
      container.append(empty);
      return;
    }
    rows.forEach((row) => {
      const item = document.createElement('p');
      item.className = 'transaction-row';
      item.textContent = formatter(row);
      container.append(item);
    });
  };
  const entryLabel = (value) => String(value || '').replaceAll('_', ' ');
  const updateCash = (balance, rows, labels) => {
    const amount = (key) => formatUsd(balance?.[key] ?? 0, getLanguage());
    setText('wallet-cash', amount('available_usd'));
    setText('cash-lifetime', amount('lifetime_usd'));
    setText('cash-available', amount('available_usd'));
    setText('cash-pending', amount('pending_usd'));
    setText('cash-reserved', amount('reserved_usd'));
    setText('cash-withdrawn', amount('withdrawn_usd'));
    renderRows('cash-transaction-list', rows, labels.noCash, (row) => {
      const earning = row.entry_type === 'earning' || row.entry_type === 'earning_released';
      const movement = earning
        ? row.creator_share_usd
        : [row.delta_available_usd, row.delta_pending_usd, row.delta_reserved_usd, row.delta_withdrawn_usd, row.delta_lifetime_usd]
          .find((value) => Number(value) !== 0) ?? 0;
      const parts = [entryLabel(row.entry_type), formatUsd(movement, getLanguage())];
      if (row.status) parts.push(entryLabel(row.status));
      if (row.created_at) parts.push(new Date(row.created_at).toLocaleDateString(getLanguage()));
      return parts.join(' · ');
    });
  };

  const labels = copy[getLanguage()];
  setText('wallet-coins', '—');
  setText('wallet-cash', '—');
  setText('wallet-db-status', labels.checking, 'pending');
  renderRows('transaction-list', [], labels.noCoins, () => '');
  renderRows('cash-transaction-list', [], labels.noCash, () => '');

  (async () => {
    try {
      const [features, client] = await Promise.all([
        window.IQZodiacVipData.getFeatureStatus(),
        window.IQZodiacSupabase.ready,
      ]);
      setText('wallet-db-status', labels.connected(features.schema_version), 'ok');
      setText('withdraw-status', labels.noPayouts, 'pending');
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user?.id) {
        setText('wallet-db-status', labels.authUnavailable, 'pending');
        setText('wallet-coins', '—');
        setText('wallet-cash', '—');
        return;
      }
      const userId = userData.user.id;
      const [walletResult, coinLedgerResult, cashBalanceResult, cashLedgerResult] = await Promise.all([
        client.from('vip_wallets').select('spendable_coins').eq('user_id', userId).maybeSingle(),
        client.from('vip_wallet_ledger').select('id,delta_coins,entry_type,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        client.from('vip_creator_usd_balances').select('creator_user_id,lifetime_usd,available_usd,pending_usd,reserved_usd,withdrawn_usd').eq('creator_user_id', userId).maybeSingle(),
        client.from('vip_creator_earnings_usd_ledger').select('id,entry_type,creator_share_usd,delta_lifetime_usd,delta_available_usd,delta_pending_usd,delta_reserved_usd,delta_withdrawn_usd,status,created_at').eq('creator_user_id', userId).order('created_at', { ascending: false }).limit(20),
      ]);
      if (walletResult.error) throw walletResult.error;
      const coins = walletResult.data?.spendable_coins ?? '0';
      setText('wallet-coins', new Intl.NumberFormat(getLanguage()).format(BigInt(coins)));
      renderRows('transaction-list', coinLedgerResult.error ? [] : coinLedgerResult.data, coinLedgerResult.error ? labels.coinsError : labels.noCoins, (row) => `${entryLabel(row.entry_type)}: ${row.delta_coins > 0 ? '+' : ''}${row.delta_coins} · ${new Date(row.created_at).toLocaleDateString(getLanguage())}`);
      if (cashBalanceResult.error || cashLedgerResult.error) {
        ['wallet-cash', 'cash-lifetime', 'cash-available', 'cash-pending', 'cash-reserved', 'cash-withdrawn'].forEach((id) => setText(id, '—'));
        renderRows('cash-transaction-list', [], labels.cashError, () => '');
      } else {
        updateCash(cashBalanceResult.data, cashLedgerResult.data, labels);
      }
    } catch {
      setText('wallet-db-status', labels.unavailable, 'error');
      setText('withdraw-status', labels.unavailable, 'error');
      ['wallet-coins', 'wallet-cash', 'cash-lifetime', 'cash-available', 'cash-pending', 'cash-reserved', 'cash-withdrawn'].forEach((id) => setText(id, '—'));
      renderRows('transaction-list', [], labels.coinsError, () => '');
      renderRows('cash-transaction-list', [], labels.cashError, () => '');
    }
  })();
})();
