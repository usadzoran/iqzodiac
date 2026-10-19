const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;

function showToast(flow) {
  toastMessage.textContent = `${flow} will open here soon.`;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

document.querySelectorAll('[data-flow]').forEach((button) => {
  button.addEventListener('click', () => showToast(button.dataset.flow));
});
