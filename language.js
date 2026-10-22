(() => {
  const STORE_KEY = 'iqzodiac-language';
  const dictionaries = window.IQZodiacTranslations || { enToAr: {}, arToEn: {} };
  const menuLabels = {
    en: { home: 'Home', discover: 'Discover', rooms: 'Audio rooms', profile: 'Profile' },
    ar: { home: 'الرئيسية', discover: 'اكتشاف', rooms: 'الغرف الصوتية', profile: 'الملف الشخصي' },
  };
  const pageLanguage = /^ar(?:-|$)/i.test(document.documentElement.lang) ? 'ar' : 'en';
  let storedLanguage = null;
  try { storedLanguage = localStorage.getItem(STORE_KEY); } catch { /* Language still works for this page. */ }
  let language = storedLanguage === 'ar' || storedLanguage === 'en' ? storedLanguage : pageLanguage;
  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  let applying = false;

  const preserveWhitespace = (source, replacement) => {
    const leading = source.match(/^\s*/)?.[0] || '';
    const trailing = source.match(/\s*$/)?.[0] || '';
    const end = trailing.length ? source.length - trailing.length : source.length;
    return leading + replacement + source.slice(end);
  };

  const localizeCount = (source, target) => {
    if (target === 'ar') {
      const requestMatch = source.match(/^(\d+)\s+requests?$/i);
      if (requestMatch) return `${new Intl.NumberFormat('ar').format(Number(requestMatch[1]))} طلبات`;
      const match = source.match(/^([\d,٬.]+)\s+(likes|comments|followers)$/i);
      if (!match) return null;
      const count = Number(match[1].replace(/[,٬]/g, ''));
      const noun = match[2].toLowerCase() === 'likes' ? 'إعجابًا' : match[2].toLowerCase() === 'comments' ? 'تعليقًا' : 'متابعًا';
      return `${new Intl.NumberFormat('ar').format(count)} ${noun}`;
    }
    const requestMatch = source.match(/^([\d٠-٩]+)\s+طلبات$/);
    if (requestMatch) {
      const digits = requestMatch[1].replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      const count = Number(digits);
      return `${count} request${count === 1 ? '' : 's'}`;
    }
    const match = source.match(/^([\d٠-٩٬,]+)\s+(إعجابًا?|إعجابات|تعليقًا?|تعليقات|متابعًا?|متابعون)$/);
    if (!match) return null;
    const digits = match[1].replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬,]/g, '');
    const noun = /إعجاب/.test(match[2]) ? 'likes' : /تعليق/.test(match[2]) ? 'comments' : 'followers';
    return `${new Intl.NumberFormat('en').format(Number(digits))} ${noun}`;
  };

  const translateValue = (source, target) => {
    const table = target === 'ar' ? dictionaries.enToAr : dictionaries.arToEn;
    if (Object.prototype.hasOwnProperty.call(table, source)) return table[source];
    const numbered = source.match(/^(\d+[.)]\s*)(.+)$/);
    if (numbered && Object.prototype.hasOwnProperty.call(table, numbered[2])) return numbered[1] + table[numbered[2]];
    return localizeCount(source, target) ?? source;
  };

  const translateTextNode = (node) => {
    if (!node.parentElement || node.parentElement.closest('script,style,noscript,[data-language-toggle]')) return;
    const current = node.nodeValue;
    const previous = textRecords.get(node);
    const source = previous && current === previous.applied ? previous.source : current;
    const clean = source.trim();
    if (!clean) return;
    const menuNode = node.parentElement.closest('[data-menu-key]');
    const replacement = menuNode && menuLabels[language][menuNode.dataset.menuKey]
      ? menuLabels[language][menuNode.dataset.menuKey]
      : translateValue(clean, language);
    const desired = preserveWhitespace(source, replacement);
    if (current !== desired) node.nodeValue = desired;
    textRecords.set(node, { source, applied: desired });
  };

  const translateAttribute = (element, attribute) => {
    const current = element.getAttribute(attribute);
    if (current === null) return;
    let records = attributeRecords.get(element);
    if (!records) { records = new Map(); attributeRecords.set(element, records); }
    const previous = records.get(attribute);
    const source = previous && current === previous.applied ? previous.source : current;
    const desired = translateValue(source, language);
    if (current !== desired) element.setAttribute(attribute, desired);
    records.set(attribute, { source, applied: desired });
  };

  const translateDocumentTitle = () => {
    const source = document.documentElement.dataset.i18nTitle && document.title === document.documentElement.dataset.i18nTitleApplied
      ? document.documentElement.dataset.i18nTitle : document.title;
    const desired = translateValue(source, language);
    if (document.title !== desired) document.title = desired;
    document.documentElement.dataset.i18nTitle = source;
    document.documentElement.dataset.i18nTitleApplied = desired;
  };

  const formatToday = () => {
    const date = document.querySelector('#today-date');
    if (!date) return;
    const formatted = new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
    if (date.textContent !== formatted) date.textContent = formatted;
  };

  const applyLanguage = () => {
    if (applying || !document.body) return;
    applying = true;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
    document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach((element) => {
      ['placeholder', 'aria-label', 'title', 'alt'].forEach((attribute) => translateAttribute(element, attribute));
    });
    document.querySelectorAll('[data-language-toggle]').forEach((button) => {
      const label = language === 'en' ? 'عربي' : 'EN';
      if (button.textContent !== label) button.textContent = label;
    });
    formatToday();
    translateDocumentTitle();
    applying = false;
    document.dispatchEvent(new CustomEvent('iqzodiac:languagechange', { detail: { language } }));
  };

  const switchLanguage = () => {
    language = language === 'en' ? 'ar' : 'en';
    try { localStorage.setItem(STORE_KEY, language); } catch { /* Keep switching functional if storage is unavailable. */ }
    applyLanguage();
  };
  document.querySelectorAll('[data-language-toggle]').forEach((button) => button.addEventListener('click', switchLanguage));
  window.addEventListener('storage', (event) => {
    if (event.key !== STORE_KEY || (event.newValue !== 'ar' && event.newValue !== 'en')) return;
    language = event.newValue;
    applyLanguage();
  });

  const style = document.createElement('style');
  style.id = 'iqzodiac-menu-stability';
  style.textContent = `
    .user-bottom-menu {
      position: fixed !important; z-index: 9999 !important; left: 50% !important; right: auto !important;
      bottom: 16px !important; transform: translateX(-50%) !important; width: min(calc(100% - 36px), 650px) !important;
      display: flex !important; align-items: center !important; justify-content: space-between !important;
      gap: 7px !important; margin: 0 !important; padding: 8px !important;
      border: 1px solid rgba(218,225,255,.16) !important; border-radius: 18px !important;
      background: rgba(9,14,29,.9) !important; box-shadow: 0 16px 45px rgba(0,0,0,.38) !important;
      backdrop-filter: blur(18px) !important;
    }
    .user-bottom-menu a, .user-bottom-menu button {
      box-sizing: border-box !important; flex: 1 1 0% !important; min-width: 0 !important;
      min-height: 44px !important; display: inline-flex !important; align-items: center !important;
      justify-content: center !important; -webkit-tap-highlight-color: transparent !important;
      text-decoration: none !important; box-shadow: none !important;
    }
    .user-bottom-menu a:hover, .user-bottom-menu a:active, .user-bottom-menu a:focus,
    .user-bottom-menu a[aria-current], .user-bottom-menu button:hover,
    .user-bottom-menu button:active, .user-bottom-menu button:focus {
      border-color: transparent !important; background: transparent !important;
      color: var(--dim, #9aacc3) !important; transform: none !important;
      filter: none !important; box-shadow: none !important; outline: none !important;
    }
    .user-bottom-menu a:focus-visible, .user-bottom-menu button:focus-visible {
      outline: 2px solid var(--cyan, #83e5e8) !important; outline-offset: 2px !important;
    }
    @media (max-width: 560px) {
      .user-bottom-menu { bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important; width: calc(100% - 16px) !important; gap: 3px !important; padding: 6px !important; }
      .user-bottom-menu a, .user-bottom-menu button { padding: 9px 5px !important; font-size: 8px !important; letter-spacing: .02em !important; }
    }
    html[dir="rtl"] .home-page, html[dir="rtl"] .messages-page,
    html[dir="rtl"] .profile-page, html[dir="rtl"] .signup-page { text-align: start; }
  `;
  document.head.append(style);
  applyLanguage();

  const observer = new MutationObserver((records) => {
    if (applying) return;
    if (records.some((record) => record.type === 'characterData' || record.addedNodes.length > 0 || record.type === 'attributes')) applyLanguage();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });

  window.IQZodiacLanguage = {
    get language() { return language; },
    get locale() { return language === 'ar' ? 'ar' : 'en'; },
    t(english, arabic) { return language === 'ar' ? arabic : english; },
    apply: applyLanguage,
  };
})();
