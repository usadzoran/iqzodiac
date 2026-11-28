(() => {
  'use strict';
  const form = document.querySelector('#recovery-form');
  const invalid = document.querySelector('#recovery-invalid');
  const success = document.querySelector('#recovery-success');
  const status = document.querySelector('#recovery-status');
  const submit = document.querySelector('#recovery-submit');
  let client = null;
  let recoverySession = false;
  let completed = false;
  const recoveryMarker = () => /(?:^|[&#])type=recovery(?:&|$)/i.test(`${location.hash.slice(1)}&${location.search.slice(1)}`)
    || new URLSearchParams(location.search).has('code');
  const showForm = () => {
    invalid.hidden = true;
    form.hidden = false;
  };
  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.dataset.error = isError ? 'true' : 'false';
  };

  (async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          recoverySession = true;
          showForm();
        }
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session && recoveryMarker()) {
        recoverySession = true;
        showForm();
      }
    } catch {
      invalid.hidden = false;
    }
  })();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client || !recoverySession || completed) {
      invalid.hidden = false;
      form.hidden = true;
      return;
    }
    const password = document.querySelector('#new-password').value;
    const confirmation = document.querySelector('#confirm-password').value;
    if (password.length < 8) { setStatus('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.', true); return; }
    if (password !== confirmation) { setStatus('كلمتا المرور غير متطابقتين.', true); return; }
    submit.disabled = true;
    setStatus('جارٍ تحديث كلمة المرور…');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      completed = true;
      form.hidden = true;
      success.hidden = false;
    } catch (error) {
      setStatus(error?.message || 'تعذر تحديث كلمة المرور. اطلب رابطًا جديدًا.', true);
      submit.disabled = false;
    }
  });
})();
