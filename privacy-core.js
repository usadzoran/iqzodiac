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
    role: 'user',
  };
  const compatibilityDefaults = { zodiac: '', element: '', interests: [], personalityAnswers: [] };
  const roleDefaults = { role: 'user', entitlements: { match: true, daily: true, vipHub: false, priorityMatching: false } };
  const walletDefaults = { status: 'not_connected', coins: null, receivedCoins: null, cashBalance: null, pendingCash: null, currency: null };
  const database = () => window.IQZodiacSupabase?.ready;
  const sessionUser = async () => {
    const client = await database();
    if (!client) return { client: null, user: null };
    const { data } = await client.auth.getUser();
    return { client, user: data.user || null };
  };
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
    async getCurrentProfile() {
      const saved = sanitizeStoredProfile(safeRead(keys.profile, {}));
      const base = { ...currentUser, ...compatibilityDefaults, ...roleDefaults, facePhoto: { originalAssetRef: null, protectedPreviewRef: null, faceHidden: true, visibility: 'private' }, faceHidden: true, ...saved, role: 'user', entitlements: { ...roleDefaults.entitlements }, privacy: { ...privacyDefaults, ...(saved.privacy || {}) }, interests: Array.isArray(saved.interests) ? saved.interests : compatibilityDefaults.interests };
      try {
        const { client, user } = await sessionUser();
        if (!client || !user) return base;
        const { data: profile } = await client.from('profiles').select('user_id,first_name,last_name,age,phone,country,city,birth_country,birth_city,residence_country,residence_city,preferred_language,display_name,handle,privacy').eq('user_id', user.id).maybeSingle();
        const { data: discovery } = await client.from('discovery_profiles').select('zodiac_sign,personality_element,interests').eq('user_id', user.id).maybeSingle();
        const metadata = user.user_metadata || {};
        const merged = { ...base, id: user.id, displayName: profile?.display_name || base.displayName, pseudonym: profile?.display_name || base.pseudonym, handle: profile?.handle || base.handle, firstName: profile?.first_name || metadata.first_name || base.firstName || '', lastName: profile?.last_name || metadata.last_name || base.lastName || '', age: profile?.age || metadata.age || base.age || null, phone: profile?.phone || metadata.phone || base.phone || '', country: profile?.residence_country || profile?.country || metadata.country || base.country || '', city: profile?.residence_city || profile?.city || metadata.city || base.city || '', birthCountry: profile?.birth_country || metadata.birth_country || base.birthCountry || '', birthCity: profile?.birth_city || metadata.birth_city || base.birthCity || '', residenceCountry: profile?.residence_country || profile?.country || metadata.residence_country || base.country || '', residenceCity: profile?.residence_city || profile?.city || metadata.residence_city || base.city || '', preferredLanguage: profile?.preferred_language || metadata.preferred_language || base.preferredLanguage || 'en', privacy: { ...base.privacy, ...(profile?.privacy || {}) }, zodiac: discovery?.zodiac_sign || base.zodiac, element: discovery?.personality_element || base.element, interests: discovery?.interests || base.interests };
        write(keys.profile, merged);
        return merged;
      } catch (error) { console.warn('Profile could not be loaded from Supabase.', error); return base; }
    },
    async getCurrentPublicProfile() { return toPublicProfile(await this.getCurrentProfile()); },
    toPublicProfile,
    async updatePublicIdentity({ displayName, handle }) {
      const current = await this.getCurrentProfile();
      const safeDisplayName = String(displayName || current.displayName || current.pseudonym || 'Orbit Member').trim().replace(/[<>]/g, '').slice(0, 32) || 'Orbit Member';
      const safeHandle = String(handle || current.handle || '@orbit-member').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'orbit-member';
      const initials = safeDisplayName.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OM';
      const next = { ...current, name: safeDisplayName, displayName: safeDisplayName, pseudonym: safeDisplayName, handle: `@${safeHandle}`, initials, privacyProfileVersion: 2 };
      write(keys.profile, next);
      try { const { client, user } = await sessionUser(); if (client && user) await client.from('profiles').update({ display_name: safeDisplayName, handle: `@${safeHandle}`, updated_at: new Date().toISOString() }).eq('user_id', user.id); } catch (error) { console.warn('Public identity sync failed.', error); }
      return next;
    },
    async updatePersonalDetails({ firstName, lastName, country, city, birthCountry, birthCity, residenceCountry, residenceCity, preferredLanguage } = {}) {
      const current = await this.getCurrentProfile();
      const clean = (value, max = 80) => String(value || '').trim().replace(/[<>]/g, '').slice(0, max);
      const nextResidenceCountry = clean(residenceCountry || country);
      const nextResidenceCity = clean(residenceCity || city);
      const next = { ...current, firstName: clean(firstName), lastName: clean(lastName), country: nextResidenceCountry, city: nextResidenceCity, residenceCountry: nextResidenceCountry, residenceCity: nextResidenceCity, birthCountry: clean(birthCountry), birthCity: clean(birthCity), preferredLanguage: preferredLanguage === 'ar' ? 'ar' : 'en' };
      write(keys.profile, next);
      try {
        const { client, user } = await sessionUser();
        if (client && user) {
          await client.auth.updateUser({ data: { first_name: next.firstName, last_name: next.lastName, country: next.country, city: next.city, birth_country: next.birthCountry, birth_city: next.birthCity, residence_country: next.residenceCountry, residence_city: next.residenceCity, preferred_language: next.preferredLanguage } });
          await client.from('profiles').update({ first_name: next.firstName, last_name: next.lastName, country: next.country, city: next.city, birth_country: next.birthCountry, birth_city: next.birthCity, residence_country: next.residenceCountry, residence_city: next.residenceCity, preferred_language: next.preferredLanguage, updated_at: new Date().toISOString() }).eq('user_id', user.id);
        }
      } catch (error) { console.warn('Personal details sync failed.', error); }
      return next;
    },
    async updatePrivacyPreferences(patch = {}) {
      const current = await this.getCurrentProfile();
      const next = { ...current, privacy: { ...current.privacy, photosPublic: patch.photosPublic === true } };
      write(keys.profile, next);
      try { const { client, user } = await sessionUser(); if (client && user) { await client.from('profiles').update({ privacy: next.privacy, updated_at: new Date().toISOString() }).eq('user_id', user.id); await client.from('profile_media').update({ is_public: next.privacy.photosPublic, updated_at: new Date().toISOString() }).eq('user_id', user.id); } } catch (error) { console.warn('Privacy sync failed.', error); }
      return next;
    },
    async listMyMedia() {
      try {
        const client = await database();
        if (!client) return [];
        const { data, error } = await client.from('profile_media').select('id,storage_path,media_type,mime_type,size_bytes,is_public,created_at').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        const items = await Promise.all((data || []).map(async (item) => { const signed = await client.storage.from('iqzodiac-media').createSignedUrl(item.storage_path, 3600); return { ...item, url: signed.data?.signedUrl || '' }; }));
        return items.filter((item) => item.url);
      } catch (error) { console.warn('Profile media could not be loaded.', error); return []; }
    },
    async uploadMedia(file, mediaType = 'photo') {
      const client = await database();
      if (!client) throw new Error('A signed-in account is required.');
      const { data: authData } = await client.auth.getUser();
      const user = authData?.user;
      if (!user || !file) throw new Error('A signed-in account is required.');
      const allowed = mediaType === 'avatar' ? file.type.startsWith('image/') : (file.type.startsWith('image/') || file.type.startsWith('video/'));
      const maxSize = mediaType === 'avatar' ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
      if (!allowed || file.size > maxSize) throw new Error(mediaType === 'avatar' ? 'Choose an image under 5 MB.' : 'Choose an image or video under 50 MB.');
      const extension = (file.name.split('.').pop() || (file.type.split('/')[1] || 'bin')).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
      const path = `${user.id}/${mediaType}/${crypto.randomUUID()}.${extension}`;
      if (mediaType === 'avatar') {
        const { data: old } = await client.from('profile_media').select('id,storage_path').eq('user_id', user.id).eq('media_type', 'avatar').limit(10);
        if (old?.length) { await client.storage.from('iqzodiac-media').remove(old.map((item) => item.storage_path)); await client.from('profile_media').delete().in('id', old.map((item) => item.id)); }
      }
      const upload = await client.storage.from('iqzodiac-media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
      if (upload.error) throw upload.error;
      const row = await client.from('profile_media').insert({ user_id: user.id, storage_path: path, media_type: mediaType, mime_type: file.type, size_bytes: file.size, is_public: mediaType !== 'avatar' && (await this.getCurrentProfile()).privacy.photosPublic }).select('id,storage_path,media_type,mime_type,size_bytes,is_public,created_at').single();
      if (row.error) { await client.storage.from('iqzodiac-media').remove([path]); throw row.error; }
      const signed = await client.storage.from('iqzodiac-media').createSignedUrl(path, 3600);
      return { ...row.data, url: signed.data?.signedUrl || '' };
    },
    async deleteMedia(media) {
      const client = await database();
      if (!client || !media?.id || !media.storage_path) return false;
      const removed = await client.storage.from('iqzodiac-media').remove([media.storage_path]);
      if (removed.error) throw removed.error;
      const result = await client.from('profile_media').delete().eq('id', media.id);
      if (result.error) throw result.error;
      return true;
    },
    async updateCompatibilityProfile(patch) {
      const current = await this.getCurrentProfile(); const next = { ...current, ...patch, interests: Array.isArray(patch.interests) ? patch.interests : current.interests }; write(keys.profile, next);
      try { const { client, user } = await sessionUser(); if (client && user) await client.from('discovery_profiles').upsert({ user_id: user.id, zodiac_sign: patch.zodiac || current.zodiac || null, personality_element: patch.element || current.element || null, interests: next.interests, discovery_status: 'in_progress', discoverable: false, updated_at: new Date().toISOString() }); } catch (error) { console.warn('Compatibility sync failed.', error); }
      return next;
    },
    async listCandidates(filters = {}) {
      try {
        const client = await database();
        if (!client) return [];
        const { data, error } = await client.rpc('search_compatible_profiles', {
          p_country: filters.country?.trim() || null,
          p_city: filters.city?.trim() || null,
          p_min_age: filters.minAge ? Number(filters.minAge) : null,
          p_max_age: filters.maxAge ? Number(filters.maxAge) : null,
          p_interest: filters.interest?.trim() || null,
        });
        if (error) throw error;
        return Array.isArray(data) ? data.map((profile) => ({
          id: profile.user_id,
          displayName: profile.display_name,
          pseudonym: profile.display_name,
          handle: profile.handle,
          publicHandle: profile.handle,
          interests: Array.isArray(profile.interests) ? profile.interests : [],
          compatibilityScore: profile.compatibility_score,
          privacy: { ...privacyDefaults },
        })) : [];
      } catch (error) {
        console.warn('Unable to load real compatibility profiles.', error);
        return [];
      }
    },
    async getAccountAccess() { return { role: 'user', entitlements: { ...roleDefaults.entitlements } }; },
    async requestVipCheckout() { return { status: 'checkout_not_connected', message: 'VIP checkout is disabled; no payment was initiated.' }; },
    async getWallet() {
      try { const client = await database(); if (client) { const { data, error } = await client.from('vip_wallets').select('spendable_coins').maybeSingle(); if (error) throw error; return data ? { status: 'connected_read_only', coins: Number(data.spendable_coins || 0), receivedCoins: null, cashBalance: null, pendingCash: null, currency: 'coins' } : { ...walletDefaults, status: 'connected_empty' }; } } catch (error) { console.warn('Wallet could not be loaded.', error); }
      return { ...walletDefaults };
    },
    async getWalletTransactions() {
      try { const client = await database(); if (client) { const { data, error } = await client.from('vip_wallet_ledger').select('id,delta_coins,entry_type,created_at').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data || []; } } catch (error) { console.warn('Wallet ledger could not be loaded.', error); }
      return [];
    },
    async listGifts() {
      try { const client = await database(); if (client) { const { data, error } = await client.from('vip_gifts').select('id,gift_code,name,category,icon_asset_ref,price_coins').eq('is_active', true).order('sort_order').limit(100); if (error) throw error; return data || []; } } catch (error) { console.warn('Gift catalog could not be loaded.', error); }
      return [];
    },
    async sendGift() { throw new Error('Gift sending is disabled until a verified server-side integration is connected.'); },
    async receiveGift() { throw new Error('Gift settlement is disabled until a verified server-side integration is connected.'); },
    async convertReceivedCoins() { throw new Error('Earnings conversion is disabled until a payout policy and provider are connected.'); },
    async createCoinCheckout() { return { status: 'checkout_not_connected', message: 'Coin purchases are disabled; no payment order was created.' }; },
    async requestWithdrawal() { return { status: 'payout_not_connected', message: 'Payouts are disabled; no withdrawal request has been submitted.' }; },
    async recordLike(candidateId) {
      try { const client = await database(); if (client) { const { data, error } = await client.rpc('record_match_like', { p_candidate_id: candidateId }); if (error) throw error; return { matched: Boolean(data), candidateId, createdAt: new Date().toISOString() }; } } catch (error) { console.warn('Match like could not be saved.', error); }
      const likes = safeRead(keys.likes, {}); likes[candidateId] = true; write(keys.likes, likes); return this.getMatch(candidateId);
    },
    async recordSkip(candidateId) {
      try { const client = await database(); if (client) { const { error } = await client.rpc('record_match_skip', { p_candidate_id: candidateId }); if (error) throw error; return { skipped: true, candidateId }; } } catch (error) { console.warn('Match skip could not be saved.', error); }
      const skips = safeRead(keys.skips, {}); skips[candidateId] = true; write(keys.skips, skips); return { skipped: true, candidateId };
    },
    async getMatch(candidateId) { const matches = await this.getMatches(); return { matched: matches.some((item) => item.id === candidateId || item.otherUserId === candidateId), candidateId, createdAt: new Date().toISOString() }; },
    async getMatches() {
      try { const client = await database(); if (client) { const { data, error } = await client.rpc('get_my_matches'); if (error) throw error; return (data || []).map((item) => ({ id: item.other_user_id, otherUserId: item.other_user_id, displayName: item.display_name, pseudonym: item.display_name, handle: item.handle, publicHandle: item.handle, compatibilityScore: null, matchId: item.match_id, createdAt: item.created_at })); } } catch (error) { console.warn('Matches could not be loaded.', error); }
      return [];
    },
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
