(() => {
  'use strict';

  const columns = { post: 'post_id', reel: 'reel_id' };

  const getSavedIds = async (client, userId, type, itemIds) => {
    const column = columns[type];
    const ids = [...new Set((itemIds || []).filter(Boolean))];
    if (!column || !client || !userId || !ids.length) return new Set();

    const { data, error } = await client
      .from('saved_items')
      .select(column)
      .eq('user_id', userId)
      .in(column, ids)
      .limit(ids.length);
    if (error) throw error;
    return new Set((data || []).map((row) => row[column]).filter(Boolean));
  };

  const toggle = async (client, userId, type, itemId, currentlySaved) => {
    const column = columns[type];
    if (!column || !client || !userId || !itemId) throw new Error('A signed-in account and valid item are required.');

    if (currentlySaved) {
      const { error } = await client
        .from('saved_items')
        .delete()
        .eq('user_id', userId)
        .eq(column, itemId);
      if (error) throw error;
      return false;
    }

    const record = { user_id: userId, item_type: type, [column]: itemId };
    const { error } = await client.from('saved_items').insert(record);
    if (error && error.code !== '23505') throw error;
    return true;
  };

  window.IQZodiacSavedItems = Object.freeze({ getSavedIds, toggle });
})();
