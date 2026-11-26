(() => {
  'use strict';

  const language = () => document.documentElement.lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const local = (row, field) => row[`${field}_${language()}`] || row[`${field}_${language() === 'ar' ? 'en' : 'ar'}`] || '';
  let menus = [];
  let items = [];
  let loading = false;
  let refreshPending = false;

  const makeLinks = (links) => {
    const list = document.createElement('ul');
    for (const item of links) {
      const rawHref = String(item.href || '');
      if (!rawHref || rawHref !== rawHref.trim() || rawHref.startsWith('//') || /[\s\\\u0000-\u001f\u007f]/.test(rawHref)) continue;
      let url;
      try { url = new URL(rawHref, window.location.href); } catch (_) { continue; }
      const safe = url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
        || url.origin === window.location.origin && !url.username && !url.password
        || url.protocol === 'mailto:' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname)
        || url.protocol === 'tel:' && /^\+?[0-9().-]{3,30}$/.test(url.pathname);
      if (!safe) continue;
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.textContent = local(item, 'label');
      anchor.href = item.href;
      if (url.protocol === 'https:' && url.origin !== window.location.origin) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      li.append(anchor);
      list.append(li);
    }
    return list;
  };

  const clearManagedMenus = () => {
    document.querySelectorAll('[data-managed-site-menu-id]').forEach((node) => node.remove());
    const footerWrap = document.querySelector('footer .managed-site-menus');
    if (footerWrap) footerWrap.remove();
    const sidePanel = document.querySelector('.managed-side-panel');
    if (sidePanel) sidePanel.replaceChildren();
  };

  const ensureSideMenu = () => {
    let dock = document.querySelector('.managed-side-menu');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'managed-side-menu';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'managed-side-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
      const panel = document.createElement('aside');
      panel.className = 'managed-side-panel';
      panel.hidden = true;
      dock.append(toggle, panel);
      document.body.append(dock);
      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
      });
    }
    dock.querySelector('.managed-side-toggle').setAttribute('aria-label', language() === 'ar' ? 'فتح قائمة الموقع' : 'Open site menu');
    return dock;
  };

  const renderOne = (menu, links) => {
    const title = local(menu, 'title') || menu.title_en || menu.title_ar || '';
    if (menu.location === 'footer') {
      const footer = document.querySelector('footer');
      if (!footer) return;
      let wrap = footer.querySelector('.managed-site-menus');
      if (!wrap) {
        wrap = document.createElement('nav');
        wrap.className = 'managed-site-menus';
        footer.prepend(wrap);
      }
      wrap.setAttribute('aria-label', language() === 'ar' ? 'قوائم تذييل الموقع' : 'Site footer menus');
      const group = document.createElement('section');
      group.className = 'managed-site-menu';
      group.dataset.managedSiteMenuId = menu.id;
      const heading = document.createElement('h2');
      heading.textContent = title;
      group.append(heading, makeLinks(links));
      wrap.append(group);
      return;
    }
    if (menu.location === 'side') {
      const dock = ensureSideMenu();
      const group = document.createElement('section');
      group.className = 'managed-site-menu';
      group.dataset.managedSiteMenuId = menu.id;
      const heading = document.createElement('h2');
      heading.textContent = title;
      group.append(heading, makeLinks(links));
      dock.querySelector('.managed-side-panel').append(group);
      return;
    }

    const host = document.querySelector('.home-nav, .profile-topbar, .site-pages-header-actions, .topbar, header') || document.querySelector('nav');
    if (!host) return;
    if (menu.location === 'header') {
      const nav = document.createElement('nav');
      nav.className = 'managed-header-menu';
      nav.dataset.managedSiteMenuId = menu.id;
      nav.setAttribute('aria-label', title);
      nav.append(makeLinks(links));
      host.append(nav);
      return;
    }
    const details = document.createElement('details');
    details.className = menu.location === 'user' ? 'managed-user-menu' : 'managed-dropdown-menu';
    details.dataset.managedSiteMenuId = menu.id;
    const summary = document.createElement('summary');
    summary.textContent = title;
    details.append(summary, makeLinks(links));
    host.append(details);
  };

  const render = () => {
    clearManagedMenus();
    const renderedMenus = [];
    for (const menu of menus) {
      const menuItems = items.filter((item) => item.menu_id === menu.id && item.is_active);
      if (!menuItems.length) continue;
      renderOne(menu, menuItems);
      renderedMenus.push(menu);
    }
    const dock = document.querySelector('.managed-side-menu');
    if (dock) dock.hidden = !renderedMenus.some((menu) => menu.location === 'side');
  };

  const refresh = async () => {
    if (loading) { refreshPending = true; return; }
    loading = true;
    try {
      const client = await window.IQZodiacSupabase.ready;
      const [{ data: menuRows, error: menuError }, { data: itemRows, error: itemError }] = await Promise.all([
        client.from('site_menus').select('id,title_en,title_ar,location,is_active,sort_order').eq('is_active', true).order('sort_order').order('title_en').limit(100),
        client.from('site_menu_items').select('id,menu_id,label_en,label_ar,href,is_active,sort_order').eq('is_active', true).order('sort_order').limit(500),
      ]);
      if (menuError) throw menuError;
      if (itemError) throw itemError;
      menus = menuRows || [];
      items = itemRows || [];
      render();
    } catch (error) {
      menus = [];
      items = [];
      render();
      console.warn('Managed site menus could not be refreshed.', error);
    } finally {
      loading = false;
      if (refreshPending) {
        refreshPending = false;
        void refresh();
      }
    }
  };

  const run = () => {
    void refresh();
    // Live Supabase Realtime currently does not publish these tables; refetch on page return.
    window.addEventListener('focus', () => void refresh());
    window.addEventListener('pageshow', () => void refresh());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refresh();
    });
    document.addEventListener('iqzodiac:languagechange', render);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
