(() => {
  'use strict';

  const bucket = 'iqzodiac-body-private';
  const angleKeys = ['front', 'back', 'left', 'right', 'front_left_45', 'back_left_45'];

  async function signedInClient() {
    const client = await window.IQZodiacSupabase?.ready;
    if (!client) throw new Error('The secure database is not available.');
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error('Sign in to save your private photo set.');
    return { client, user: data.user };
  }

  const body3d = {
    angles: [...angleKeys],

    async listMine() {
      const { client } = await signedInClient();
      const { data, error } = await client.rpc('get_my_profile_body_models');
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },

    async listMyPhotos(modelId) {
      const { client } = await signedInClient();
      const { data, error } = await client.from('profile_body_scan_photos')
        .select('id,model_id,angle,storage_path,mime_type,size_bytes,uploaded_at')
        .eq('model_id', modelId)
        .order('angle', { ascending: true });
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) return [];
      const { data: signedRows, error: signedError } = await client.storage.from(bucket)
        .createSignedUrls(rows.map((row) => row.storage_path), 1800);
      if (signedError) throw signedError;
      const urls = new Map((signedRows || []).filter((row) => row.signedUrl).map((row) => [row.path, row.signedUrl]));
      return rows.map((row) => ({ ...row, url: urls.get(row.storage_path) || '' }));
    },

    async createCaptureSet(retention) {
      const { client, user } = await signedInClient();
      const id = crypto.randomUUID();
      const { data, error } = await client.from('profile_body_models')
        .insert({ id, user_id: user.id, originals_retention: retention === 'keep_until_deleted' ? 'keep_until_deleted' : 'delete_after_processing' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },

    async uploadPhoto(modelId, angle, file) {
      const { client, user } = await signedInClient();
      if (!angleKeys.includes(angle) || !(file instanceof Blob) || file.type !== 'image/jpeg' || file.size < 1 || file.size > 25 * 1024 * 1024) {
        throw new Error('The prepared photo is not valid for secure upload.');
      }
      const path = `${user.id}/${modelId}/${angle}.jpg`;
      const { error: uploadError } = await client.storage.from(bucket).upload(path, file, {
        contentType: 'image/jpeg',
        cacheControl: '300',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: rowError } = await client.from('profile_body_scan_photos').insert({
        model_id: modelId,
        user_id: user.id,
        angle,
        storage_path: path,
        mime_type: 'image/jpeg',
        size_bytes: file.size,
      });
      if (rowError) {
        await client.storage.from(bucket).remove([path]).catch(() => {});
        throw rowError;
      }
      return path;
    },

    async deleteCaptureSet(modelId) {
      const { client, user } = await signedInClient();
      if (!modelId) throw new Error('A model identifier is required.');
      const { data, error } = await client.functions.invoke('body-model-delete', { body: { model_id: modelId } });
      if (error) throw error;
      if (data?.deleted !== true) throw new Error('The body photo set could not be deleted.');
      return true;
    },

    async setVisibility(modelId, visibility) {
      const { client } = await signedInClient();
      const { error } = await client.rpc('set_profile_body_visibility', { p_model_id: modelId, p_visibility: visibility === 'show' ? 'show' : 'hide' });
      if (error) throw error;
      return true;
    },

    async setRetention(modelId, retention) {
      const { client } = await signedInClient();
      const value = retention === 'keep_until_deleted' ? 'keep_until_deleted' : 'delete_after_processing';
      const { error } = await client.rpc('set_profile_body_retention', { p_model_id: modelId, p_retention: value });
      if (error) throw error;
      return true;
    },

    async getVisibleModel(userId) {
      if (!userId) return null;
      const client = await window.IQZodiacSupabase?.ready;
      if (!client) return null;
      const { data, error } = await client.from('profile_body_models')
        .select('id,user_id,status,visibility,face_anonymized')
        .eq('user_id', userId)
        .eq('status', 'ready')
        .eq('visibility', 'show')
        .eq('face_anonymized', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },

    async modelEndpoint(modelId, download = false) {
      const client = await window.IQZodiacSupabase?.ready;
      if (!client?.supabaseUrl) throw new Error('The model service is unavailable.');
      const query = new URLSearchParams({ model_id: modelId });
      if (download) query.set('download', '1');
      return `${client.supabaseUrl}/functions/v1/body-model-access?${query.toString()}`;
    },

    async accessToken() {
      const client = await window.IQZodiacSupabase?.ready;
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data?.session?.access_token || null;
    },
  };

  window.IQZodiacBody3DData = body3d;
})();
