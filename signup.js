const form = document.querySelector('#signup-form');
const toast = document.querySelector('.toast');
const toastMessage = document.querySelector('.toast-message');
let toastTimer;

const showToast = (message) => {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
};

const createPseudonym = () => {
  const roots = ['Nova', 'Luna', 'Orion', 'Astra', 'Echo', 'Comet', 'Sage', 'River', 'Sol', 'Lyra'];
  const bytes = new Uint8Array(3);
  try { window.crypto.getRandomValues(bytes); } catch { bytes.set([Math.random() * 256, Math.random() * 256, Math.random() * 256]); }
  const root = roots[bytes[0] % roots.length];
  const code = ((bytes[1] << 8) | bytes[2]).toString(16).padStart(4, '0').toUpperCase();
  const displayName = `${root}-${code}`;
  const handle = `@${root.toLowerCase()}${code.toLowerCase()}`;
  return { displayName, handle, initials: root.slice(0, 1).toUpperCase() };
};

const bindPreview = (inputId, previewId, label) => {
  const input = document.querySelector(`#${inputId}`);
  const preview = document.querySelector(`#${previewId}`);
  input.addEventListener('change', () => {
    const [file] = input.files;
    if (!file) return;
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.alt = `${label} preview`;
    preview.replaceChildren(image);
    preview.classList.add('has-preview');
    input.closest('.upload-card').classList.add('is-ready');
    showToast(`${label} photo preview is local to this device.`);
  });
};

bindPreview('id-photo', 'id-preview', 'ID');
bindPreview('face-photo', 'face-preview', 'Face');

const birthDateInput = document.querySelector('#birth-date');
const today = new Date();
const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const latestBirthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
const earliestBirthDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
birthDateInput.min = toDateValue(earliestBirthDate);
birthDateInput.max = toDateValue(latestBirthDate);

const ageFromBirthDate = (birthDateValue) => {
  const [year, month, day] = birthDateValue.split('-').map(Number);
  let age = today.getFullYear() - year;
  const birthdayHasPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const password = document.querySelector('#password').value;
  const confirmation = document.querySelector('#password-confirm').value;
  if (password !== confirmation) { showToast('Passwords do not match.'); return; }
  const birthDate = birthDateInput.value;
  const age = ageFromBirthDate(birthDate);
  if (!birthDate || age < 18 || age > 120) { showToast('Please choose a valid date of birth.'); return; }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector('span').textContent = 'Creating…';
  try {
    const client = await window.IQZodiacSupabase.ready;
    const firstName = document.querySelector('#first-name').value.trim();
    const lastName = document.querySelector('#last-name').value.trim();
    const email = document.querySelector('#email').value.trim().toLowerCase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, age, birth_date: birthDate, phone: document.querySelector('#phone-number').value.trim() } },
    });
    if (error) throw error;
    if (!data.session) {
      window.location.assign('./login.html?confirmed=1');
      return;
    }
    window.location.assign('./assistant.html?welcome=1');
  } catch (error) {
    showToast(error?.message || 'Account creation failed.');
    button.disabled = false;
    button.querySelector('span').textContent = 'Create account';
  }
});
