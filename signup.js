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

const authMessage = (error) => {
  const code = String(error?.code || error?.status || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code.includes('user_already_exists') || message.includes('already registered') || message.includes('already been registered')) return 'This email is already registered. Try logging in instead.';
  if (code.includes('email_address_invalid') || message.includes('invalid email')) return 'Please enter a valid email address.';
  if (code.includes('password') && (message.includes('weak') || message.includes('length'))) return 'Choose a stronger password with at least 8 characters.';
  if (message.includes('rate limit')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'The connection to secure sign-up failed. Check your internet connection and try again.';
  return error?.message || 'Account creation failed. Please try again.';
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
bindPreview('profile-photo', 'profile-preview', 'Profile');

const saveProfilePhoto = async (client, user, file) => {
  if (!client || !user || !file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'jpg';
  const path = `${user.id}/avatar/${crypto.randomUUID()}.${extension}`;
  const upload = await client.storage.from('iqzodiac-media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (upload.error) throw upload.error;
  const row = await client.from('profile_media').insert({ user_id: user.id, storage_path: path, media_type: 'avatar', mime_type: file.type, size_bytes: file.size, is_public: false });
  if (row.error) { await client.storage.from('iqzodiac-media').remove([path]); throw row.error; }
};

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
    const country = document.querySelector('#country').value.trim();
    const city = document.querySelector('#city').value.trim();
    const preferredLanguage = document.querySelector('#preferred-language').value;
    const email = document.querySelector('#email').value.trim().toLowerCase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL('./login.html?confirmed=1', window.location.href).href,
        data: { first_name: firstName, last_name: lastName, age, birth_date: birthDate, phone: document.querySelector('#phone-number').value.trim(), country, city, preferred_language: preferredLanguage },
      },
    });
    if (error) throw error;
    try { window.localStorage.setItem('iqzodiac-language', preferredLanguage); } catch { /* Keep account creation working if storage is unavailable. */ }
    const profilePhoto = document.querySelector('#profile-photo').files?.[0];
    if (data.session && data.user && profilePhoto) { try { await saveProfilePhoto(client, data.user, profilePhoto); } catch (photoError) { console.warn('Profile photo upload deferred.', photoError); } }
    if (!data.session) {
      showToast('Account created. Check your email and click the confirmation link before logging in.');
      window.setTimeout(() => window.location.assign('./login.html?confirmed=1'), 1800);
      return;
    }
    window.location.assign('./assistant.html?welcome=1');
  } catch (error) {
    showToast(authMessage(error));
    button.disabled = false;
    button.querySelector('span').textContent = 'Create account';
  }
});
