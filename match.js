(() => {
  'use strict';

  const { adapter } = window.IQZodiacData;
  const card = document.querySelector('#match-card');
  const matchesList = document.querySelector('#matches-list');
  const toast = document.querySelector('.toast');
  const toastMessage = document.querySelector('.toast-message');
  const searchForm = document.querySelector('#match-search-form');
  const queueCount = document.querySelector('#queue-count');
  const queueLabel = document.querySelector('#queue-label');
  let toastTimer;
  let presenceTimer;
  let candidates = [];
  let index = 0;
  let canInteract = false;

  const language = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const copy = {
    en: {
      setupKicker: 'YOUR DISCOVERY PROFILE', setupTitle: 'Complete only what is missing.',
      setupBody: 'Your saved answers stay in place. Continue the discovery setup to fill in the missing details; you will not be asked to repeat completed questions.',
      resume: 'Continue profile setup', noResults: 'No other eligible member profiles are available yet. We will not show sample profiles or invented compatibility scores.',
      finished: 'You have reached the end of this member queue. Check back later for newly eligible profiles.',
      error: 'Match is temporarily unavailable. Your profile and interactions were not changed.',
      interests: 'Shared interests', personality: 'Personality answers aligned', noInterests: 'No shared interests yet',
      age: 'Age', zodiac: 'Zodiac', element: 'Element', online: 'Online', offline: 'Offline',
      realMember: 'REAL MEMBER · PRIVACY-RESPECTING PROFILE', protected: 'Only information members chose to share is shown.',
      compatibility: 'calculated compatibility', noCandidates: 'No real eligible member profiles found.',
      mutual: 'Mutual match · chat ↗', privateMatch: 'Private match · chat ↗',
      searchError: 'Search could not be completed.', likeError: 'Like could not be saved. Try again.', skipError: 'Pass could not be saved. Try again.',
      passed: 'Passed. The next eligible profile is ready.', likeSaved: 'Like saved.',
      missing: { profile: 'discovery profile', personality: 'personality answers', interests: 'interests', birthdate: 'zodiac from your saved birth date', element: 'personality element', completion: 'profile completion' },
    },
    ar: {
      setupKicker: 'ملف الاكتشاف', setupTitle: 'أكمل الجزء الناقص فقط.',
      setupBody: 'إجاباتك المحفوظة باقية. تابع إعداد الاكتشاف لإكمال التفاصيل الناقصة فقط، دون إعادة الأسئلة المكتملة.',
      resume: 'متابعة إعداد الملف', noResults: 'لا تتوفر حاليًا ملفات أعضاء مؤهلين أخرى. لن نعرض حسابات تجريبية أو نسب توافق مختلقة.',
      finished: 'وصلت إلى نهاية قائمة الأعضاء الحالية. عُد لاحقًا لرؤية الملفات المؤهلة الجديدة.',
      error: 'خدمة Match غير متاحة مؤقتًا. لم نغيّر ملفك أو تفاعلاتك.',
      interests: 'الاهتمامات المشتركة', personality: 'إجابات شخصية متوافقة', noInterests: 'لا توجد اهتمامات مشتركة بعد',
      age: 'العمر', zodiac: 'البرج', element: 'العنصر', online: 'متصل', offline: 'غير متصل',
      realMember: 'عضو حقيقي · ملف يحترم الخصوصية', protected: 'نعرض فقط المعلومات التي اختار العضو مشاركتها.',
      compatibility: 'توافق محسوب', noCandidates: 'لا توجد ملفات أعضاء حقيقية مؤهلة.',
      mutual: 'تطابق متبادل · محادثة ↗', privateMatch: 'تطابق خاص · محادثة ↗',
      searchError: 'تعذر إكمال البحث.', likeError: 'تعذر حفظ الإعجاب. حاول مجددًا.', skipError: 'تعذر حفظ التخطي. حاول مجددًا.',
      passed: 'تم التخطي. الملف المؤهل التالي جاهز.', likeSaved: 'تم حفظ الإعجاب.',
      missing: { profile: 'ملف الاكتشاف', personality: 'إجابات الشخصية', interests: 'الاهتمامات', birthdate: 'البرج من تاريخ الميلاد المحفوظ', element: 'عنصر الشخصية', completion: 'اكتمال الملف' },
    },
  };
  const text = (key) => copy[language()][key];
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const publicName = (profile) => profile.pseudonym || profile.publicName || profile.displayName || 'IQZodiac member';
  const publicInitials = (profile) => publicName(profile).split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IQ';
  const getPublicProfile = (person) => adapter.toPublicProfile ? adapter.toPublicProfile({ ...person, publicName: person.displayName, publicHandle: person.handle, publicPhotos: person.publicPhotos || [], privacy: { photosPublic: person.photosPublic === true } }) : { id: person.id, displayName: publicName(person), pseudonym: publicName(person), handle: person.publicHandle || '@member' };
  const showToast = (message) => { toastMessage.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000); };
  const setControlsEnabled = (enabled) => {
    canInteract = enabled;
    document.querySelector('#skip-button').disabled = !enabled;
    document.querySelector('#like-button').disabled = !enabled;
  };
  const stopPresence = () => {
    if (presenceTimer) window.clearInterval(presenceTimer);
    presenceTimer = null;
    void adapter.setMatchPresence(false).catch(() => {});
  };
  const startPresence = async () => {
    await adapter.setMatchPresence(true);
    presenceTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void adapter.setMatchPresence(true).catch((error) => console.warn('Match presence heartbeat failed.', error));
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      void adapter.setMatchPresence(document.visibilityState === 'visible').catch((error) => console.warn('Match presence update failed.', error));
    });
    window.addEventListener('pagehide', stopPresence, { once: true });
  };
  const setCardNotice = (title, body, link = '') => {
    card.className = 'match-card match-card-notice';
    card.innerHTML = `<div class="match-card-content"><p class="card-kicker">${escapeHTML(text('setupKicker'))}</p><h2>${escapeHTML(title)}</h2><p>${escapeHTML(body)}</p>${link}<div class="protected-note"><b>◉</b>${escapeHTML(text('protected'))}</div></div>`;
    setControlsEnabled(false);
  };
  const setError = () => {
    queueCount.textContent = '—';
    setCardNotice(language() === 'ar' ? 'تعذر تحميل الأعضاء.' : 'Members could not be loaded.', text('error'));
  };
  const renderCard = () => {
    const person = candidates[index];
    queueCount.textContent = candidates.length ? `${String(Math.min(index + 1, candidates.length)).padStart(2, '0')} / ${String(candidates.length).padStart(2, '0')}` : '00 / 00';
    if (!person) {
      const body = candidates.length ? text('finished') : text('noResults');
      setCardNotice(language() === 'ar' ? 'لا توجد ملفات في قائمة العرض.' : 'No profiles in this queue.', body);
      return;
    }
    const profile = getPublicProfile(person);
    const score = person.compatibilityScore !== null && person.compatibilityScore !== undefined && Number.isFinite(Number(person.compatibilityScore)) ? `${escapeHTML(person.compatibilityScore)}%` : '—';
    const photos = Array.isArray(profile.photos) ? profile.photos.filter((src) => typeof src === 'string' && /^https:\/\//i.test(src)).slice(0, 3) : [];
    const interests = (person.commonInterests || []).slice(0, 10).map((interest) => `<span class="interest-chip">${escapeHTML(interest)}</span>`).join('');
    const age = Number.isInteger(Number(person.age)) && person.age !== null ? `<span class="match-detail"><small>${escapeHTML(text('age'))}</small><strong>${escapeHTML(person.age)}</strong></span>` : '';
    const elementName = person.element ? person.element[0].toUpperCase() + person.element.slice(1) : '';
    const personality = person.personalityComparisons > 0 ? `<div class="match-reasons"><span>${escapeHTML(text('personality'))}: ${escapeHTML(person.personalityMatches)} / ${escapeHTML(person.personalityComparisons)}</span></div>` : '';
    const photoMarkup = photos.length ? `<div class="match-member-photos">${photos.map((src) => `<img class="public-profile-photo" src="${escapeHTML(src)}" alt="${escapeHTML(publicName(profile))} — public profile photo" loading="lazy" />`).join('')}</div>` : '';
    card.className = `match-card preview-${escapeHTML(person.element || 'air')}`;
    card.innerHTML = `<div class="match-card-content"><div class="match-score"><strong>${score}</strong><span>${escapeHTML(text('compatibility'))}</span></div><p class="card-kicker">${escapeHTML(text('realMember'))}</p><h2>${escapeHTML(publicName(profile))}</h2>${photoMarkup}<div class="match-member-details">${age}${person.zodiac ? `<span class="match-detail"><small>${escapeHTML(text('zodiac'))}</small><strong>${escapeHTML(person.zodiac)}</strong></span>` : ''}${elementName ? `<span class="match-detail"><small>${escapeHTML(text('element'))}</small><strong>${escapeHTML(elementName)}</strong></span>` : ''}<span class="match-connection ${person.isOnline ? 'is-online' : 'is-offline'}"><i aria-hidden="true"></i>${escapeHTML(person.isOnline ? text('online') : text('offline'))}</span></div><p class="match-shared-title">${escapeHTML(text('interests'))}</p><div class="interest-row">${interests || `<span class="match-no-shared">${escapeHTML(text('noInterests'))}</span>`}</div>${personality}<div class="protected-note"><b>◉</b>${escapeHTML(text('protected'))}</div></div>`;
    setControlsEnabled(true);
  };

  const loadCandidates = async (filters = {}) => {
    candidates = await adapter.listCandidates(filters);
    index = 0;
    renderCard();
  };
  const renderMatches = async () => {
    const matches = await adapter.getMatches();
    document.querySelector('#match-count').textContent = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;
    matchesList.replaceChildren();
    if (!matches.length) {
      matchesList.innerHTML = `<p class="match-empty">${escapeHTML(language() === 'ar' ? 'لا توجد مطابقات متبادلة بعد.' : 'No mutual matches yet.')}</p>`;
      return;
    }
    matches.forEach((person) => {
      const profile = getPublicProfile(person);
      const item = document.createElement('a');
      item.className = 'match-mini';
      item.href = `./messages.html?match=${encodeURIComponent(profile.id || '')}`;
      const initials = document.createElement('span'); initials.className = 'mini-protected'; initials.textContent = publicInitials(profile);
      const copyBlock = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = publicName(profile);
      const detail = document.createElement('small'); detail.textContent = language() === 'ar' ? text('mutual') : text('mutual');
      copyBlock.append(name, detail); item.append(initials, copyBlock); matchesList.append(item);
    });
  };
  const openMatchModal = (person) => {
    const profile = getPublicProfile(person);
    document.querySelector('#modal-you').textContent = window.IQZodiacData.currentUser?.initials || 'OM';
    document.querySelector('#modal-them').textContent = publicInitials(profile);
    document.querySelector('#match-modal').hidden = false;
    document.querySelector('#open-conversation').href = `./messages.html?match=${encodeURIComponent(profile.id || '')}`;
    document.querySelector('#close-match').focus();
  };

  document.querySelector('#skip-button').addEventListener('click', async () => {
    const person = candidates[index];
    if (!canInteract || !person) return;
    setControlsEnabled(false);
    try {
      await adapter.recordSkip(person.id);
      index += 1; renderCard(); showToast(text('passed'));
    } catch (error) { console.warn('Match pass could not be saved.', error); setControlsEnabled(true); showToast(text('skipError')); }
  });
  document.querySelector('#like-button').addEventListener('click', async () => {
    const person = candidates[index];
    if (!canInteract || !person) return;
    setControlsEnabled(false);
    try {
      const result = await adapter.recordLike(person.id);
      index += 1; renderCard(); await renderMatches();
      if (result.matched) openMatchModal(person); else showToast(text('likeSaved'));
    } catch (error) { console.warn('Match like could not be saved.', error); setControlsEnabled(true); showToast(text('likeError')); }
  });
  document.querySelector('#close-match').addEventListener('click', () => { document.querySelector('#match-modal').hidden = true; });
  document.querySelector('#match-modal').addEventListener('click', (event) => { if (event.target.id === 'match-modal') event.currentTarget.hidden = true; });
  searchForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const minAge = Number(document.querySelector('#search-min-age').value || 0);
    const maxAge = Number(document.querySelector('#search-max-age').value || 0);
    if ((minAge && minAge < 18) || (maxAge && maxAge > 120) || (minAge && maxAge && minAge > maxAge)) { showToast(language() === 'ar' ? 'اختر نطاقًا عمريًا صحيحًا من 18 إلى 120.' : 'Choose a valid age range from 18 to 120.'); return; }
    const button = searchForm.querySelector('button'); button.disabled = true;
    try {
      await loadCandidates({ country: document.querySelector('#search-country').value, city: document.querySelector('#search-city').value, minAge, maxAge, interest: document.querySelector('#search-interest').value });
    } catch (error) { console.warn(text('searchError'), error); setError(); showToast(text('searchError')); }
    finally { button.disabled = false; }
  });

  (async () => {
    try {
      const client = await window.IQZodiacSupabase.ready;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        const target = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`./login.html?next=${encodeURIComponent(target)}`);
        return;
      }
      await startPresence();
      const snapshot = await adapter.getDiscoverySnapshot();
      if (!snapshot.signedIn) throw new Error('A signed-in account is required.');
      if (!snapshot.complete) {
        const missing = snapshot.missing.map((key) => text('missing')[key]).filter(Boolean);
        const message = missing.length ? `${text('setupBody')} ${language() === 'ar' ? 'المطلوب الآن: ' : 'Still needed: '}${missing.join(language() === 'ar' ? '، ' : ', ')}.` : text('setupBody');
        const link = `<a class="button button-secondary" href="./discovery-profile.html?resume=1">${escapeHTML(text('resume'))} <span class="button-arrow">↗</span></a>`;
        setCardNotice(text('setupTitle'), message, link);
        queueLabel.textContent = text('setupKicker').toUpperCase(); queueCount.textContent = '—';
        return;
      }
      await loadCandidates();
      await renderMatches();
    } catch (error) {
      console.warn('Match could not be initialized.', error);
      setError();
    }
  })();

  document.addEventListener('iqzodiac:languagechange', () => {
    if (!canInteract) return;
    renderCard();
  });
})();
