(() => {
  'use strict';

  const keys = {
    profile: 'iqzodiac-current-profile',
    likes: 'iqzodiac-match-likes',
    skips: 'iqzodiac-match-skips',
    reveals: 'iqzodiac-face-reveals',
    messages: 'iqzodiac-match-messages',
  };
  const safeRead = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const currentUser = { id: 'alex-stone', name: 'Alex Stone', handle: '@alex.stone', initials: 'AS' };
  const candidates = [
    { id: 'maya-chen', name: 'Maya Chen', handle: '@mayachen', initials: 'MC', age: 29, city: 'Brooklyn, NY', element: 'Water', bio: 'Drawn to honest conversations, slow mornings, and the kind of curiosity that makes ordinary days feel new.', interests: ['Writing', 'Coffee walks', 'Museums'], preview: 'preview-water', matched: true },
    { id: 'noah-williams', name: 'Noah Williams', handle: '@noahw', initials: 'NW', age: 31, city: 'Austin, TX', element: 'Air', bio: 'I collect questions, small road trips, and playlists for every version of a day.', interests: ['Road trips', 'Music', 'Design'], preview: 'preview-air', matched: false },
    { id: 'lina-ortiz', name: 'Lina Ortiz', handle: '@linaortiz', initials: 'LO', age: 27, city: 'Lisbon, PT', element: 'Earth', bio: 'Looking for someone who notices the quiet details and makes room for a good laugh.', interests: ['Ceramics', 'Gardens', 'Cooking'], preview: 'preview-earth', matched: false },
  ];

  const adapter = {
    async getCurrentProfile() { return safeRead(keys.profile, { ...currentUser, facePhoto: { originalAssetRef: null, protectedPreviewRef: 'protected-alex-preview' }, faceHidden: true }); },
    async listCandidates() { return candidates.map(({ originalAssetRef, ...candidate }) => candidate); },
    async recordLike(candidateId) { const likes = safeRead(keys.likes, {}); likes[candidateId] = true; write(keys.likes, likes); return this.getMatch(candidateId); },
    async recordSkip(candidateId) { const skips = safeRead(keys.skips, {}); skips[candidateId] = true; write(keys.skips, skips); return { skipped: true, candidateId }; },
    async getMatch(candidateId) { const likes = safeRead(keys.likes, {}); return { matched: Boolean(likes[candidateId]) || candidateId === 'maya-chen', candidateId, createdAt: new Date().toISOString() }; },
    async getMatches() { const likes = safeRead(keys.likes, {}); return candidates.filter((candidate) => candidate.matched || likes[candidate.id]); },
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
