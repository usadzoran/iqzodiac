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
  const currentUser = { id: 'alex-stone', name: 'Alex Stone', handle: '@alex.stone', initials: 'AS', role: 'user' };
  const candidates = [
    { id: 'maya-chen', name: 'Maya Chen', handle: '@mayachen', initials: 'MC', age: 29, city: 'Brooklyn, NY', zodiac: 'Cancer', element: 'Water', bio: 'Drawn to honest conversations, slow mornings, and the kind of curiosity that makes ordinary days feel new.', interests: ['Writing', 'Coffee walks', 'Museums'], preview: 'preview-water', matched: true },
    { id: 'noah-williams', name: 'Noah Williams', handle: '@noahw', initials: 'NW', age: 31, city: 'Austin, TX', zodiac: 'Gemini', element: 'Air', bio: 'I collect questions, small road trips, and playlists for every version of a day.', interests: ['Road trips', 'Music', 'Design'], preview: 'preview-air', matched: false },
    { id: 'lina-ortiz', name: 'Lina Ortiz', handle: '@linaortiz', initials: 'LO', age: 27, city: 'Lisbon, PT', zodiac: 'Taurus', element: 'Earth', bio: 'Looking for someone who notices the quiet details and makes room for a good laugh.', interests: ['Ceramics', 'Gardens', 'Cooking'], preview: 'preview-earth', matched: false },
  ];
  const compatibilityDefaults = { zodiac: 'Taurus', element: 'Water', interests: ['Writing', 'Coffee walks'], personalityAnswers: [] };
  const roleDefaults = { role: 'user', entitlements: { match: true, daily: true, vipHub: false, priorityMatching: false } };
  const walletDefaults = { coins: 250, receivedCoins: 0, cashBalance: 0, pendingCash: 0, currency: 'USD', coinToUsdRate: 100, minimumWithdrawalCoins: 1000, platformFeePercent: 20 };
  const gifts = [
    { id: 'starlight', name: 'Starlight', icon: '✦', price: 10, tone: 'cyan', note: 'A small signal that says: I noticed you.' },
    { id: 'moon-note', name: 'Moon note', icon: '☾', price: 35, tone: 'lilac', note: 'For a conversation that feels easy.' },
    { id: 'orbit-bloom', name: 'Orbit bloom', icon: '✺', price: 80, tone: 'orange', note: 'A brighter gesture for a mutual match.' },
    { id: 'constellation', name: 'Constellation', icon: '✧', price: 150, tone: 'gold', note: 'The big one: you found something rare.' },
  ];
  const scoreCandidate = (profile, candidate) => {
    const ownInterests = new Set((profile.interests || []).map((item) => item.trim().toLowerCase()).filter(Boolean));
    const shared = candidate.interests.filter((item) => ownInterests.has(item.toLowerCase()));
    let score = 35 + shared.length * 12;
    if (profile.zodiac && profile.zodiac === candidate.zodiac) score += 25;
    if (profile.element && profile.element === candidate.element) score += 18;
    if (profile.element && ['Water', 'Earth'].includes(profile.element) && ['Water', 'Earth'].includes(candidate.element)) score += 5;
    return { ...candidate, compatibilityScore: Math.min(99, score), matchReasons: [...shared.map((item) => `Shared interest: ${item}`), profile.zodiac === candidate.zodiac ? 'Same zodiac sign' : `${candidate.element} energy may complement yours` ] };
  };

  const adapter = {
    async getCurrentProfile() { const saved = safeRead(keys.profile, {}); return { ...currentUser, ...compatibilityDefaults, ...roleDefaults, facePhoto: { originalAssetRef: null, protectedPreviewRef: 'protected-alex-preview' }, faceHidden: true, ...saved, interests: Array.isArray(saved.interests) ? saved.interests : compatibilityDefaults.interests }; },
    async updateCompatibilityProfile(patch) { const current = await this.getCurrentProfile(); const next = { ...current, ...patch, interests: Array.isArray(patch.interests) ? patch.interests : current.interests }; write(keys.profile, next); return next; },
    async listCandidates() { const profile = await this.getCurrentProfile(); return candidates.map((candidate) => scoreCandidate(profile, candidate)).sort((a, b) => b.compatibilityScore - a.compatibilityScore).map(({ originalAssetRef, ...candidate }) => candidate); },
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
    async getMatch(candidateId) { const likes = safeRead(keys.likes, {}); return { matched: Boolean(likes[candidateId]) || candidateId === 'maya-chen', candidateId, createdAt: new Date().toISOString() }; },
    async getMatches() { const likes = safeRead(keys.likes, {}); const profile = await this.getCurrentProfile(); return candidates.filter((candidate) => candidate.matched || likes[candidate.id]).map((candidate) => scoreCandidate(profile, candidate)); },
    async getRevealState(matchId) { const states = safeRead(keys.reveals, {}); return states[matchId] || { mine: false, partner: false }; },
    async requestReveal(matchId) { return this.setOwnRevealConsent(matchId, true); },
    async setOwnRevealConsent(matchId, value) { const states = safeRead(keys.reveals, {}); states[matchId] = { ...(states[matchId] || {}), mine: Boolean(value) }; write(keys.reveals, states); return states[matchId]; },
    async setPartnerRevealConsent(matchId, value) { const states = safeRead(keys.reveals, {}); states[matchId] = { ...(states[matchId] || {}), partner: Boolean(value) }; write(keys.reveals, states); return states[matchId]; },
    canRevealFace(state) { return Boolean(state && state.mine && state.partner); },
    async getConversation(matchId) { const all = safeRead(keys.messages, {}); return all[matchId] || []; },
    async appendMessage(matchId, message) { const all = safeRead(keys.messages, {}); all[matchId] = [...(all[matchId] || []), message]; write(keys.messages, all); return all[matchId]; },
  };

  window.IQZodiacData = { adapter, keys, currentUser };
})();
