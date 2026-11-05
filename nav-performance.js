(() => {
  'use strict';

  const prefetched = new Set();
  const canPrefetch = () => navigator.onLine !== false && !navigator.connection?.saveData;

  const isLocalPage = (anchor) => {
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
    if (anchor.origin !== window.location.origin) return false;
    const url = new URL(anchor.href);
    return url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '';
  };

  const prefetch = (href) => {
    if (!canPrefetch() || prefetched.has(href) || href === window.location.href) return;
    prefetched.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = href;
    link.fetchPriority = 'low';
    document.head.append(link);
  };

  const showNavigationProgress = () => {
    document.documentElement.classList.add('is-navigating');
    window.setTimeout(() => document.documentElement.classList.remove('is-navigating'), 4000);
  };

  document.documentElement.classList.add('page-enter');
  window.requestAnimationFrame(() => document.documentElement.classList.add('page-ready'));

  document.addEventListener('pointerover', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (isLocalPage(anchor)) prefetch(anchor.href);
  }, { passive: true });

  document.addEventListener('focusin', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (isLocalPage(anchor)) prefetch(anchor.href);
  });

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (!isLocalPage(anchor) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href);
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    showNavigationProgress();
  }, { passive: true });
})();
