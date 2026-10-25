const form = document.querySelector('#login-form');
const status = document.querySelector('#login-status');
const next = new URLSearchParams(window.location.search).get('next');

const setStatus = (message, isError = false) => {
  status.textContent = message;
  status.style.color = isError ? '#d86b6b' : '';
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus('Signing you in…');
  try {
    const client = await window.IQZodiacSupabase.ready;
    const { error } = await client.auth.signInWithPassword({
      email: document.querySelector('#login-email').value.trim(),
      password: document.querySelector('#login-password').value,
    });
    if (error) throw error;
    window.location.replace(next && next.startsWith('/') ? next : './home.html');
  } catch (error) {
    setStatus(error?.message || 'Unable to sign in. Please check your details.', true);
    button.disabled = false;
  }
});
