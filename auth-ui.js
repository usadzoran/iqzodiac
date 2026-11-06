(() => {
  'use strict';

  const loginUrl = './login.html';
  const buttonLabel = () => window.IQZodiacLanguage?.language === 'ar' ? 'تسجيل الخروج' : 'Log out';

  const style = document.createElement('style');
  style.textContent = `
    .site-nav .site-logout { position: relative; flex: 1 1 0; min-width: 0; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 48px; padding: 0 4px; border: 1px solid transparent; border-radius: 15px; background: transparent; color: var(--orange, #f2a77c); cursor: pointer; font: 9px "DM Mono", monospace; letter-spacing: .04em; text-transform: uppercase; transition: color .18s ease, background .18s ease, border-color .18s ease, transform .18s ease; }
    .site-nav .site-logout:hover, .site-nav .site-logout:focus-visible { color: var(--ink, #f6f6f0); background: rgba(242,167,124,.08); border-color: rgba(242,167,124,.3); transform: translateY(-2px); outline: none; }
    .site-nav .site-logout:disabled { cursor: wait; opacity: .55; transform: none; }
    @media (max-width: 600px) { .site-nav .site-logout { min-height: 45px; padding-inline: 2px; font-size: 7px; letter-spacing: 0; } }
  `;
  document.head.append(style);

  const updateLabel = (button) => {
    button.querySelector('[data-logout-label]').textContent = buttonLabel();
    button.setAttribute('aria-label', buttonLabel());
  };

  const addLogoutButton = () => {
    const navigation = document.querySelector('.site-nav');
    if (!navigation || navigation.querySelector('[data-logout]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.logout = 'true';
    button.className = 'site-logout';
    button.innerHTML = '<span class="nav-glyph" aria-hidden="true">↪</span><span data-logout-label></span>';
    updateLabel(button);
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const client = await window.IQZodiacSupabase.ready;
        const { error } = await client.auth.signOut();
        if (error) throw error;
        window.location.replace(loginUrl);
      } catch (error) {
        console.error('Manual sign out failed.', error);
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
    navigation.append(button);
    document.addEventListener('iqzodiac:languagechange', () => updateLabel(button));
  };

  addLogoutButton();
})();
