(() => {
  'use strict';

  const language = window.IQZodiacLanguage?.language === 'ar' ? 'ar' : 'en';
  const labels = {
    en: {
      checking: 'Checking the Supabase database…',
      connected: (version) => `Supabase connected · schema ${version}. No authenticated VIP catalog is available to this local account.`,
      unavailable: 'Could not verify Supabase. The gift catalog remains unavailable.',
      empty: 'No gift catalog is configured. No gift can be sent and no coins will be deducted.',
    },
    ar: {
      checking: 'جارٍ التحقق من قاعدة بيانات Supabase…',
      connected: (version) => `قاعدة Supabase متصلة · إصدار المخطط ${version}. لا يوجد كتالوج VIP موثّق متاح لهذا الحساب المحلي.`,
      unavailable: 'تعذّر التحقق من Supabase. كتالوج الهدايا غير متاح.',
      empty: 'لم يُضبط كتالوج للهدايا. لا يمكن إرسال هدية ولن تُخصم أي عملات.',
    },
  }[language];

  const status = document.getElementById('gift-status');
  const grid = document.getElementById('gift-grid');
  document.getElementById('gift-coins').textContent = '—';
  status.textContent = labels.checking;

  function showEmptyCatalog() {
    const empty = document.createElement('p');
    empty.className = 'gift-status-empty';
    empty.textContent = labels.empty;
    grid.replaceChildren(empty);
  }

  window.IQZodiacVipData.getFeatureStatus().then((features) => {
    status.textContent = labels.connected(features.schema_version);
    status.dataset.state = 'ok';
    showEmptyCatalog();
  }).catch(() => {
    status.textContent = labels.unavailable;
    status.dataset.state = 'error';
    showEmptyCatalog();
  });
})();
