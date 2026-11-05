const form = document.querySelector('#login-form');
const status = document.querySelector('#login-status');
const next = new URLSearchParams(window.location.search).get('next');
const confirmed = new URLSearchParams(window.location.search).get('confirmed');

const setStatus = (message, isError = false) => {
  status.textContent = message;
  status.style.color = isError ? '#d86b6b' : '';
};

if (confirmed === '1') setStatus('Your account was created. Confirm your email, then enter your password to log in.');

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
    const message = String(error?.message || '').toLowerCase().includes('email not confirmed')
      ? 'Please confirm your email from the message we sent before logging in.'
      : (error?.message || 'Unable to sign in. Please check your details.');
    setStatus(message, true);
    button.disabled = false;
  }
});
