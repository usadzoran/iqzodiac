(() => {
  'use strict';

  const BUCKET = 'iqzodiac-vault-private';
  const CREDENTIAL_KEY = 'iqzodiac.vault.passkey.credential.v1';
  const $ = (selector) => document.querySelector(selector);
  const refs = {
    card: $('#vault-card'),
    locked: $('#vault-locked'),
    unlocked: $('#vault-unlocked'),
    status: $('#vault-status'),
    unlock: $('#vault-unlock'),
    setup: $('#vault-setup'),
    input: $('#vault-file-input'),
    list: $('#vault-list'),
    empty: $('#vault-empty'),
    close: $('#vault-lock'),
  };

  let client;
  let user;
  let unlocked = false;

  const setStatus = (message, kind = '') => {
    if (!refs.status) return;
    refs.status.textContent = message;
    refs.status.dataset.kind = kind;
  };

  const bytesToText = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const typeFor = (mime) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : null;
  const extensionFor = (name, mime) => {
    const ext = (name.match(/\.([a-z0-9]{1,8})$/i)?.[1] || mime.split('/')[1] || 'bin').toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext.replace(/[^a-z0-9]/g, '');
  };
  const base64url = (bytes) => {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const fromBase64url = (value) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  };
  const storedCredential = () => {
    try { return JSON.parse(localStorage.getItem(CREDENTIAL_KEY) || 'null'); } catch { return null; }
  };
  const saveCredential = (credential) => {
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ id: credential.id, rawId: base64url(new Uint8Array(credential.rawId)) }));
  };

  const supportsWebAuthn = () => Boolean(window.PublicKeyCredential && navigator.credentials);
  const webAuthnOptions = (challenge, userId) => ({
    challenge,
    rp: { name: 'IQZodiac Vault', id: window.location.hostname },
    user: { id: userId, name: user.email || user.id, displayName: 'IQZodiac Vault' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    timeout: 60000,
    attestation: 'none',
  });

  const registerDeviceUnlock = async () => {
    if (!supportsWebAuthn()) throw new Error('device_unlock_unavailable');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userHandle = crypto.getRandomValues(new Uint8Array(32));
    const credential = await navigator.credentials.create({ publicKey: webAuthnOptions(challenge, userHandle) });
    if (!credential) throw new Error('device_unlock_cancelled');
    saveCredential(credential);
  };

  const verifyDeviceUnlock = async () => {
    if (!supportsWebAuthn()) throw new Error('device_unlock_unavailable');
    const stored = storedCredential();
    if (!stored?.rawId) return registerDeviceUnlock();
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({ publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromBase64url(stored.rawId) }],
      userVerification: 'required',
      timeout: 60000,
    } });
    if (!assertion) throw new Error('device_unlock_cancelled');
  };

  const mediaMarkup = (row, url) => {
    const safeName = row.original_name.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    if (row.media_type === 'image') return `<img src="${url}" alt="${safeName}" loading="lazy">`;
    if (row.media_type === 'video') return `<video src="${url}" controls preload="metadata"></video>`;
    return `<audio src="${url}" controls preload="metadata"></audio>`;
  };

  const loadItems = async () => {
    const { data, error } = await client.from('vault_items').select('id,storage_path,media_type,mime_type,original_name,size_bytes,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    refs.list.replaceChildren();
    refs.empty.hidden = Boolean(data?.length);
    for (const row of data || []) {
      const { data: signed, error: signedError } = await client.storage.from(BUCKET).createSignedUrl(row.storage_path, 900);
      if (signedError || !signed?.signedUrl) continue;
      const item = document.createElement('article');
      item.className = 'vault-item';
      item.innerHTML = `<div class="vault-preview">${mediaMarkup(row, signed.signedUrl)}</div><div class="vault-item-meta"><strong>${row.original_name.replace(/[&<>"']/g, '')}</strong><span>${bytesToText(row.size_bytes)}</span><button type="button" data-delete="${row.id}" aria-label="Delete ${row.original_name}">Delete</button></div>`;
      refs.list.append(item);
    }
  };

  const openVault = async () => {
    setStatus('Confirm with Face ID, fingerprint, or your device lock…');
    try {
      await verifyDeviceUnlock();
      unlocked = true;
      refs.locked.hidden = true;
      refs.unlocked.hidden = false;
      await loadItems();
      setStatus('Vault unlocked.', 'success');
    } catch (error) {
      const message = error?.name === 'NotAllowedError' || error?.message === 'device_unlock_cancelled' ? 'Unlock cancelled. Your files remain protected.' : 'This browser or device does not support secure device unlock.';
      setStatus(message, 'error');
    }
  };

  const lockVault = () => {
    unlocked = false;
    refs.unlocked.hidden = true;
    refs.locked.hidden = false;
    refs.list.replaceChildren();
    refs.empty.hidden = false;
    setStatus('Vault locked.');
  };

  const upload = async (file) => {
    if (!unlocked || !user) return;
    const mediaType = typeFor(file.type);
    if (!mediaType || file.size > 100 * 1024 * 1024) throw new Error('unsupported_file');
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || `vault.${extensionFor(file.name, file.type)}`;
    const path = `${user.id}/${id}/${safeName}`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '0', upsert: false });
    if (uploadError) throw uploadError;
    const { error: rowError } = await client.from('vault_items').insert({ id, user_id: user.id, storage_path: path, media_type: mediaType, mime_type: file.type, original_name: safeName, size_bytes: file.size });
    if (rowError) { await client.storage.from(BUCKET).remove([path]); throw rowError; }
  };

  const handleFiles = async (files) => {
    if (!files.length) return;
    refs.input.disabled = true;
    setStatus('Uploading privately…');
    try {
      for (const file of files) await upload(file);
      await loadItems();
      setStatus('Files saved privately.', 'success');
    } catch (error) {
      setStatus(error?.message === 'unsupported_file' ? 'Use an image, video, or audio file up to 100 MB.' : 'The private upload could not be completed.', 'error');
    } finally { refs.input.disabled = false; refs.input.value = ''; }
  };

  const removeItem = async (id) => {
    if (!unlocked) return;
    const { data: row, error } = await client.from('vault_items').select('id,storage_path').eq('id', id).maybeSingle();
    if (error || !row) return;
    const { error: storageError } = await client.storage.from(BUCKET).remove([row.storage_path]);
    if (storageError) { setStatus('The file could not be deleted.', 'error'); return; }
    const { error: deleteError } = await client.from('vault_items').delete().eq('id', id);
    if (deleteError) { setStatus('The file record could not be deleted.', 'error'); return; }
    await loadItems();
  };

  const init = async () => {
    try {
      client = await window.IQZodiacSupabase.ready;
      const { data } = await client.auth.getUser();
      user = data?.user;
      if (!user) return;
      refs.unlock.addEventListener('click', openVault);
      refs.setup.addEventListener('click', openVault);
      refs.close.addEventListener('click', lockVault);
      refs.input.addEventListener('change', () => handleFiles([...refs.input.files]));
      refs.list.addEventListener('click', (event) => { const button = event.target.closest('[data-delete]'); if (button) void removeItem(button.dataset.delete); });
      if (!supportsWebAuthn()) { refs.setup.disabled = true; refs.unlock.disabled = true; setStatus('Secure device unlock is not available in this browser.'); }
    } catch { setStatus('Vault is temporarily unavailable.', 'error'); }
  };
  void init();
})();
