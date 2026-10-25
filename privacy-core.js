(() => {
  'use strict';

  const keys = {
    profile: 'iqzodiac-current-profile',
    likes: 'iqzodiac-match-likes',
    skips: 'iqzodiac-match-skips',
    reveals: 'iqzodiac-face-reveals',
    messages: 'iqzodiac-match-messages',
    wallet: 'iqzodiac-wallet',
    transactions: 'iqzodiac-wallet-transactions',
  };
  const safeRead = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const privacyDefaults = { publicIdentity: 'pseudonym', realNameVisibility: 'private', personalInfoVisibility: 'private', ageVisibility: false, phoneVisibility: false, photosPublic: false, revealRequiresMutualConsent: true };
  const createPseudonym = () => {
    const roots = ['Nova', 'Luna', 'Orion', 'Astra', 'Echo', 'Comet', 'Sage', 'River', 'Sol', 'Lyra'];
    const bytes = new Uint8Array(3);
    try { window.crypto.getRandomValues(bytes); } catch { bytes.set([Math.random() * 256, Math.random() * 256, Math.random() * 256]); }
    const root = roots[bytes[0] % roots.length];
    const code = ((bytes[1] << 8) | bytes[2]).toString(16).padStart(4, '0').toUpperCase();
    return { displayName: `${root}-${code}`, handle: `@${root.toLowerCase()}${code.toLowerCase()}` };
  };
  const sanitizeStoredProfile = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    if (raw.privacyProfileVersion === 2) return raw;
    const pseudonym = createPseudonym();
    const oldPrivacy = raw.privacy && typeof raw.privacy === 'object' ? raw.privacy : {};
    const photosPublic = oldPrivacy.photosPublic === true || localStorage.getItem('iqzodiac:gallery-visible') === 'true';
    const safeProfile = {
      id: String(raw.id || `user-${Date.now()}`),
      name: pseudonym.displayName,
      displayName: pseudonym.displayName,
      pseudonym: pseudonym.displayName,
      handle: pseudonym.handle,
      initials: pseudonym.displayName.slice(0, 1).toUpperCase(),
      role: raw.role === 'vip' ? 'vip' : 'user',
      zodiac: typeof raw.zodiac === 'string' ? raw.zodiac : '',
      element: typeof raw.element === 'string' ? raw.element : '',
      interests: Array.isArray(raw.interests) ? raw.interests : [],
      personalityAnswers: Array.isArray(raw.personalityAnswers) ? raw.personalityAnswers : [],
      onboarding: raw.onboarding && typeof raw.onboarding === 'object' ? raw.onboarding : { status: 'pending' },
      createdAt: raw.createdAt || new Date().toISOString(),
      privacyProfileVersion: 2,
      privacy: { ...privacyDefaults, photosPublic },
      facePhoto: { originalAssetRef: null, protectedPreviewRef: null, faceHidden: true, visibility: 'private' },
      faceHidden: true,
    };
    write(keys.profile, safeProfile);
    try { localStorage.removeItem('iqzodiac:phone-visible'); } catch { /* Ignore unavailable storage. */ }
    return safeProfile;
  };
  const storedProfile = sanitizeStoredProfile(safeRead(keys.profile, {}));
  const currentUser = {
    id: storedProfile.id || 'local-member',
    name: storedProfile.displayName || 'Orbit Member',
    displayName: storedProfile.displayName || 'Orbit Member',
    handle: storedProfile.handle || '@orbit-member',
    initials: storedProfile.initials || 'OM',
    role: storedProfile.role || 'user',
  };
  const compatibilityDefaults = { zodiac: '', element: '', interests: [], personalityAnswers: [] };
  const roleDefaults = { role: 'user', entitlements: { match: true, daily: true, vipHub: false, priorityMatching: false } };
  const walletDefaults = { coins: 250, receivedCoins: 0, cashBalance: 0, pendingCash: 0, currency: 'USD', coinToUsdRate: 100, minimumWithdrawalCoins: 1000, platformFeePercent: 20 };
  const gifts = [
    { id: 'starlight', name: 'Starlight', icon: '✦', price: 10, tone: 'cyan', note: 'A small signal that says: I noticed you.' },
    { id: 'moon-note', name: 'Moon note', icon: '☾', price: 35, tone: 'lilac', note: 'For a conversation that feels easy.' },
    { id: 'orbit-bloom', name: 'Orbit bloom', icon: '✺', price: 80, tone: 'orange', note: 'A brighter gesture for a mutual match.' },
    { id: 'constellation', name: 'Constellation', icon: '✧', price: 150, tone: 'gold', note: 'The big one: you found something rare.' },
  ];
  const toPublicProfile = (profile = {}) => {
    const displayName = String(profile.pseudonym || profile.publicName || (profile.privacyProfileVersion === 2 ? profile.displayName : '') || 'Orbit Member').trim().slice(0, 32) || 'Orbit Member';
    const requestedHandle = profile.pseudonymousHandle || profile.publicHandle || (profile.privacyProfileVersion === 2 ? profile.handle : '@orbit-member');
    const handle = /^@[a-z0-9._-]{1,31}$/i.test(requestedHandle || '') ? requestedHandle : '@orbit-member';
    const publicProfile = { id: profile.id || null, displayName, pseudonym: displayName, handle };
    if (profile.privacy?.photosPublic === true) {
      const safeRef = (ref) => typeof ref === 'string' && (/^https:\/\//i.test(ref) || ref.startsWith('/assets/')) ? ref : null;
      const avatar = safeRef(profile.publicAvatarRef);
      const photos = Array.isArray(profile.publicPhotos) ? profile.publicPhotos.map(safeRef).filter(Boolean).slice(0, 24) : [];
      if (avatar) publicProfile.avatar = avatar;
      if (photos.length) publicProfile.photos = photos;
    }
    return publicProfile;
  };
  const adapter = {
    async getCurrentProfile() { const saved = sanitizeStoredProfile(safeRead(keys.profile, {})); return { ...currentUser, ...compatibilityDefaults, ...roleDefaults, facePhoto: { originalAssetRef: null, protectedPreviewRef: null, faceHidden: true, visibility: 'private' }, faceHidden: true, ...saved, privacy: { ...privacyDefaults, ...(saved.privacy || {}) }, interests: Array.isArray(saved.interests) ? saved.interests : compatibilityDefaults.interests }; },
    async getCurrentPublicProfile() { return toPublicProfile(await this.getCurrentProfile()); },
    toPublicProfile,
    async updatePublicIdentity({ displayName, handle }) {
      const current = await this.getCurrentProfile();
      const safeDisplayName = String(displayName || current.displayName || current.pseudonym || 'Orbit Member').trim().replace(/[<>]/g, '').slice(0, 32) || 'Orbit Member';
      const safeHandle = String(handle || current.handle || '@orbit-member').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'orbit-member';
      const initials = safeDisplayName.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
      const next = { ...current, name: safeDisplayName, displayName: safeDisplayName, pseudonym: safeDisplayName, handle: `@${safeHandle}`, initials, privacyProfileVersion: 2 };
      write(keys.profile, next);
      return next;
    },
    async updatePrivacyPreferences(patch = {}) {
      const current = await this.getCurrentProfile();
      const next = { ...current, privacy: { ...current.privacy, photosPublic: patch.photosPublic === true } };
      write(keys.profile, next);
      return next;
    },
    async updateCompatibilityProfile(patch) { const current = await this.getCurrentProfile(); const next = { ...current, ...patch, interests: Array.isArray(patch.interests) ? patch.interests : current.interests }; write(keys.profile, next); return next; },
    async listCandidates() { return []; },
    async getAccountAccess() { const profile = await this.getCurrentProfile(); const isVip = profile.role === 'vip'; return { role: isVip ? 'vip' : 'user', entitlements: { ...roleDefaults.entitlements, ...(isVip ? { vipHub: true, priorityMatching: true } : {}) } }; },
    async requestVipCheckout() { return { status: 'checkout_not_connected', message: 'VIP checkout is ready to connect to a payment provider.' }; },
    async getWallet() { return { ...walletDefaults, ...safeRead(keys.wallet, {}) }; },
    async getWalletTransactions() { return safeRead(keys.transactions, []); },
    async listGifts() { return gifts; },
    async sendGift({ giftId, recipientId }) { const gift = gifts.find((item) => item.id === giftId); const wallet = await this.getWallet(); if (!gift) throw new Error('Gift not found'); if (!recipientId) throw new Error('Choose a recipient'); if (wallet.coins < gift.price) throw new Error('Not enough coins'); const next = { ...wallet, coins: wallet.coins - gift.price }; const transaction = { id: `gift-${Date.now()}`, type: 'gift_sent', giftId, recipientId, coins: -gift.price, createdAt: new Date().toISOString() }; write(keys.wallet, next); write(keys.transactions, [transaction, ...(await this.getWalletTransactions())]); return { gift, wallet: next, transaction }; },
    async receiveGift({ giftId, senderId }) { const gift = gifts.find((item) => item.id === giftId); const wallet = await this.getWallet(); if (!gift) throw new Error('Gift not found'); const next = { ...wallet, receivedCoins: wallet.receivedCoins + gift.price }; const transaction = { id: `received-${Date.now()}`, type: 'gift_received', giftId, senderId, coins: gift.price, createdAt: new Date().toISOString() }; write(keys.wallet, next); write(keys.transactions, [transaction, ...(await this.getWalletTransactions())]); return { gift, wallet: next, transaction }; },
    async convertReceivedCoins(coins) { const wallet = await this.getWallet(); const amount = Number(coins); if (!Number.isFinite(amount) || amount <= 0 || amount > wallet.receivedCoins) throw new Error('Invalid received coin amount'); const gross = amount / wallet.coinToUsdRate; const fee = gross * wallet.platformFeePercent / 100; const next = { ...wallet, receivedCoins: wallet.receivedCoins - amount, cashBalance: wallet.cashBalance + gross - fee }; write(keys.wallet, next); return { wallet: next, gross, fee, net: gross - fee }; },
    async createCoinCheckout(packageId, provider) { return { status: 'checkout_not_connected', packageId, provider, message: 'Coin checkout is ready for a server-side PayPal or card provider integration. No card details are collected here.' }; },
    async requestWithdrawal({ coins, method }) { const wallet = await this.getWallet(); const amount = Number(coins); if (!Number.isFinite(amount) || amount < wallet.minimumWithdrawalCoins) throw new Error(`Minimum withdrawal is ${wallet.minimumWithdrawalCoins.toLocaleString()} coins`); if (amount > wallet.receivedCoins) throw new Error('Insufficient received-gift balance'); const feeCoins = Math.round(amount * wallet.platformFeePercent / 100); return { status: 'payout_not_connected', method, coins: amount, feeCoins, message: 'Withdrawal request is ready for server-side payout verification.' }; },
    async recordLike(candidateId) { const likes = safeRead(keys.likes, {}); likes[candidateId] = true; write(keys.likes, likes); return this.getMatch(candidateId); },
    async recordSkip(candidateId) { const skips = safeRead(keys.skips, {}); skips[candidateId] = true; write(keys.skips, skips); return { skipped: true, candidateId }; },
    async getMatch(candidateId) { const likes = safeRead(keys.likes, {}); return { matched: Boolean(likes[candidateId]), candidateId, createdAt: new Date().toISOString() }; },
    async getMatches() { return []; },
    async getRevealState(matchId) { const states = safeRead(keys.reveals, {}); return states[matchId] || { mine: false, partner: false }; },
    async requestReveal(matchId) { return this.setOwnRevealConsent(matchId, true); },
    async setOwnRevealConsent(matchId, value) { const states = safeRead(keys.reveals, {}); states[matchId] = { ...(states[matchId] || {}), mine: Boolean(value) }; write(keys.reveals, states); return states[matchId]; },
    async setPartnerRevealConsent(matchId, value) { const states = safeRead(keys.reveals, {}); states[matchId] = { ...(states[matchId] || {}), partner: Boolean(value) }; write(keys.reveals, states); return states[matchId]; },
    canRevealFace(state) { return Boolean(state && state.mine && state.partner); },
    async getConversation(matchId) { const all = safeRead(keys.messages, {}); return all[matchId] || []; },
    async appendMessage(matchId, message) { const all = safeRead(keys.messages, {}); all[matchId] = [...(all[matchId] || []), message]; write(keys.messages, all); return all[matchId]; },
  };

  window.IQZodiacData = { adapter, keys, currentUser, toPublicProfile };
})();
