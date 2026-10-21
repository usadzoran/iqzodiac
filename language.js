(() => {
  const translations = {
    en: { home: 'Home', discover: 'Discover', profile: 'Profile', newSection: 'New section', switchTo: 'عربي', aria: 'Switch to Arabic' },
    ar: { home: 'الرئيسية', discover: 'اكتشاف', profile: 'الملف الشخصي', newSection: 'قسم جديد', switchTo: 'EN', aria: 'Switch to English' },
  };

  const stored = window.localStorage.getItem('iqzodiac-language');
  const browserLocales = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  const browserSuggestsArabic = browserLocales.some((locale) => /^ar(?:-|$)/i.test(locale));
  let language = stored === 'ar' || stored === 'en' ? stored : (browserSuggestsArabic ? 'ar' : 'en');

  const applyLanguage = () => {
    const copy = translations[language];
    document.documentElement.dataset.menuLanguage = language;
    document.querySelectorAll('[data-menu-key]').forEach((node) => {
      const key = node.dataset.menuKey;
      if (copy[key]) node.textContent = copy[key];
    });
    document.querySelectorAll('[data-language-toggle]').forEach((button) => {
      button.textContent = copy.switchTo;
      button.setAttribute('aria-label', copy.aria);
      button.title = copy.aria;
    });
  };

  document.querySelectorAll('[data-language-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      language = language === 'en' ? 'ar' : 'en';
      window.localStorage.setItem('iqzodiac-language', language);
      applyLanguage();
    });
  });

  applyLanguage();
})();
