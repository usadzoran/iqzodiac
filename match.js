(() => {
  const { adapter } = window.IQZodiacData;
  const card = document.querySelector('#match-card');
  const matchesList = document.querySelector('#matches-list');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');
  let toastTimer;
  let candidates = [];
  let index = 0;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const publicName = (profile) => profile.pseudonym || profile.publicName || profile.displayName || 'IQZodiac member';
  const publicInitials = (profile) => publicName(profile).split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IQ';
  const showToast = (message) => { toastMessage.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800); };
  const getPublicProfile = (person) => adapter.toPublicProfile ? adapter.toPublicProfile(person) : { id: person.id, displayName: publicName(person), pseudonym: publicName(person), handle: person.publicHandle || '@member' };

  const renderCard = () => {
    const person = candidates[index];
    document.querySelector('#queue-count').textContent = person ? `${String(index + 1).padStart(2, '0')} / ${String(candidates.length).padStart(2, '0')}` : 'NOT CONNECTED';
    if (!person) {
      card.innerHTML = '<div class="match-card-content"><p class="card-kicker">REAL MEMBER MATCHES ONLY</p><h2>No completed matches yet.</h2><p>No other eligible member profile is available yet. No sample profiles or invented compatibility results are shown here.</p><a class="button button-secondary" href="./assistant.html">Open Assistant setup <span class="button-arrow">↗</span></a></div>';
      document.querySelector('#skip-button').disabled = true;
      document.querySelector('#like-button').disabled = true;
      return;
    }
    const profile = getPublicProfile(person);
    const score = Number.isFinite(Number(person.compatibilityScore)) ? `${escapeHTML(person.compatibilityScore)}%` : '—';
    const photos = Array.isArray(profile.photos) ? profile.photos.filter((src) => typeof src === 'string' && (/^https:\/\//i.test(src) || src.startsWith('/assets/'))) : [];
    card.className = 'match-card';
    card.innerHTML = `<div class="match-card-content"><div class="match-score"><strong>${score}</strong><span>compatibility</span></div><p class="card-kicker">PSEUDONYM · PRIVATE DETAILS HIDDEN</p><h2>${escapeHTML(publicName(profile))}</h2>${photos.length ? `<div class="interest-row">${photos.slice(0, 3).map((src) => `<img class="public-profile-photo" src="${escapeHTML(src)}" alt="Public profile photo" loading="lazy" />`).join('')}</div>` : ''}<p>Only the member’s pseudonym and explicitly public photos are shown here.</p><div class="protected-note"><b>◉</b> Real name and personal details stay private</div></div>`;
    document.querySelector('#skip-button').disabled = false;
    document.querySelector('#like-button').disabled = false;
  };

  const renderMatches = async () => {
    const matches = await adapter.getMatches();
    document.querySelector('#match-count').textContent = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;
    matchesList.replaceChildren();
    if (!matches.length) {
      matchesList.innerHTML = '<p class="match-empty">No real match records are available yet. Complete your discovery profile to continue.</p>';
      return;
    }
    matches.forEach((person) => {
      const profile = getPublicProfile(person);
      const item = document.createElement('a');
      item.className = 'match-mini';
      item.href = `./messages.html?match=${encodeURIComponent(profile.id || '')}`;
      const initials = document.createElement('span');
      initials.className = 'mini-protected';
      initials.textContent = publicInitials(profile);
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = publicName(profile);
      const detail = document.createElement('small');
      const score = Number.isFinite(Number(person.compatibilityScore)) ? `${person.compatibilityScore}% compatible · chat ↗` : 'Private match · chat ↗';
      detail.textContent = score;
      copy.append(name, detail);
      item.append(initials, copy);
      matchesList.append(item);
    });
  };

  const openMatchModal = (person) => {
    const profile = getPublicProfile(person);
    document.querySelector('#modal-you').textContent = window.IQZodiacData.currentUser?.initials || 'OM';
    document.querySelector('#modal-them').textContent = publicInitials(profile);
    document.querySelector('#match-modal').hidden = false;
    document.querySelector('#open-conversation').href = `./messages.html?match=${encodeURIComponent(profile.id || '')}`;
    document.querySelector('#open-gifts').href = `./gift-store.html?to=${encodeURIComponent(profile.id || '')}`;
    document.querySelector('#close-match').focus();
  };

  document.querySelector('#skip-button').addEventListener('click', async () => {
    const person = candidates[index];
    if (!person) return;
    await adapter.recordSkip(person.id);
    index += 1;
    renderCard();
    showToast('Passed. The next compatible orbit is ready.');
  });
  document.querySelector('#like-button').addEventListener('click', async () => {
    const person = candidates[index];
    if (!person) return;
    const result = await adapter.recordLike(person.id);
    index += 1;
    renderCard();
    await renderMatches();
    if (result.matched) openMatchModal(person);
    else showToast(`Like saved. ${person.compatibilityScore || 'A'} compatibility noted.`);
  });
  document.querySelector('#close-match').addEventListener('click', () => { document.querySelector('#match-modal').hidden = true; });
  document.querySelector('#match-modal').addEventListener('click', (event) => { if (event.target.id === 'match-modal') event.currentTarget.hidden = true; });
  (async () => {
    const wallet = await adapter.getWallet();
    document.querySelector('#quick-coins').textContent = wallet.coins.toLocaleString();
    candidates = await adapter.listCandidates();
    renderCard();
    await renderMatches();
  })();
})();
