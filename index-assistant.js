(() => {
  'use strict';

  const trigger = document.querySelector('.assistant-placeholder');
  const modal = document.querySelector('#landing-assistant-modal');
  const input = document.querySelector('#smart-chat-input');
  if (!trigger || !modal) return;

  const setOpen = (open) => {
    modal.hidden = !open;
    document.body.classList.toggle('assistant-modal-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) window.setTimeout(() => input?.focus(), 40);
  };

  trigger.addEventListener('click', () => setOpen(true));
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-assistant-close]')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
})();
