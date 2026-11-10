(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const tr = (en, ar) => document.documentElement.lang === 'ar' ? ar : en;
  const routeParams = new URLSearchParams(location.search);
  let client; let user; let categories = []; let listings = []; let sellerListings = []; let editingListingId = null; let imageUrls = new Map(); let favoriteIds = new Set();
  const status = (message) => { $('#market-status').textContent = message; };
  const money = (value, currency) => { try { return new Intl.NumberFormat(undefined, { style:'currency', currency:currency || 'USD', maximumFractionDigits:2 }).format(Number(value || 0)); } catch { return `${Number(value || 0).toFixed(2)} ${currency || 'USD'}`; } };
  const categoryName = (category) => category ? (document.documentElement.lang === 'ar' ? category.name_ar : category.name_en) : 'Other';
  const selectedCategory = (kind, value) => categories.find((category) => category.id === value && (!kind || category.kind === kind));
  const populateCategories = (select, kind = '') => { const previous = select.value; select.innerHTML = `<option value="">${select === $('#sell-category') ? 'Choose category' : 'All categories'}</option>` + categories.filter((category) => !kind || category.kind === kind).map((category) => `<option value="${category.id}">${escapeHTML(categoryName(category))}</option>`).join(''); if ([...select.options].some((option) => option.value === previous)) select.value = previous; };
  const renderCards = () => {
    const query = $('#market-search').value.trim().toLowerCase(); const kind = $('#market-kind').value; const category = $('#market-category').value; const country = $('#market-country').value.trim().toLowerCase(); const city = $('#market-city').value.trim().toLowerCase(); const maxPrice = Number($('#market-max-price').value); const sort = $('#market-sort').value;
    const filtered = listings.filter((listing) => (!kind || listing.kind === kind) && (!category || listing.category_id === category) && (!query || `${listing.title} ${listing.description} ${listing.brand || ''}`.toLowerCase().includes(query)) && (!country || (listing.country || '').toLowerCase().includes(country)) && (!city || (listing.city || '').toLowerCase().includes(city)) && (!maxPrice || Number(listing.price) <= maxPrice)).sort((a,b) => sort === 'views' ? b.views_count - a.views_count : sort === 'price_low' ? Number(a.price) - Number(b.price) : sort === 'price_high' ? Number(b.price) - Number(a.price) : new Date(b.created_at) - new Date(a.created_at));
    $('#market-heading').textContent = query || kind || category || country || city || maxPrice ? 'Matching listings' : 'Recently added';
    status(filtered.length ? `${filtered.length} real listing${filtered.length === 1 ? '' : 's'} found.` : 'No active listings match these filters.');
    $('#listing-grid').innerHTML = filtered.length ? filtered.map((listing) => { const image = imageUrls.get(listing.id); const category = selectedCategory('', listing.category_id); return `<article class="listing-card" data-listing-id="${listing.id}"><div class="listing-image">${image ? `<img loading="lazy" src="${escapeHTML(image)}" alt="${escapeHTML(listing.title)}" />` : 'No image added'}</div><div class="listing-card-body"><div class="listing-card-top"><span class="listing-kind">${listing.kind === 'service' ? 'Service' : 'Product'}</span><span class="listing-location">${escapeHTML([listing.city, listing.country].filter(Boolean).join(', '))}</span></div><h3>${escapeHTML(listing.title)}</h3><p>${escapeHTML(categoryName(category))} · ${escapeHTML(listing.seller?.display_name || listing.seller?.handle || 'IQZodiac member')}</p><div class="listing-price">${listing.pricing_type === 'contact' ? 'Contact seller' : `${money(listing.price, listing.currency_code)}${listing.pricing_type === 'hourly' ? ' / hour' : ''}`}</div><div class="listing-card-actions"><button type="button" data-open-listing="${listing.id}">View details ↗</button><button type="button" class="${favoriteIds.has(listing.id) ? 'is-favorite' : ''}" data-favorite="${listing.id}" aria-label="Add to favorites">${favoriteIds.has(listing.id) ? '♥ Saved' : '♡ Save'}</button></div></div></article>`; }).join('') : '<div class="market-empty">No member listings are available yet. Be the first to publish a real product or service.</div>';
  };
  const loadImages = async (rows) => { imageUrls = new Map(); const ids = rows.map((row) => row.id); if (!ids.length) return; const { data: images } = await client.from('marketplace_listing_images').select('listing_id,storage_path,display_order').in('listing_id', ids).order('display_order', { ascending:true }).limit(200); await Promise.all((images || []).map(async (image) => { if (imageUrls.has(image.listing_id)) return; const { data } = await client.storage.from('marketplace-media').createSignedUrl(image.storage_path, 3600); if (data?.signedUrl) imageUrls.set(image.listing_id, data.signedUrl); })); };
  const loadListings = async () => { status('Loading real listings…'); const [{ data: rows, error }, { data: favorites }] = await Promise.all([client.from('marketplace_listings').select('id,seller_id,kind,title,description,category_id,price,currency_code,pricing_type,condition,brand,quantity,country,city,delivery_options,shipping_cost,service_area,remote_service,status,featured,views_count,created_at,updated_at').eq('status','active').is('deleted_at', null).order('created_at',{ ascending:false }).limit(100), client.from('marketplace_favorites').select('listing_id').eq('user_id', user.id).limit(200)]); if (error) { status('Listings could not be loaded. Please refresh and try again.'); console.warn('Marketplace listings query failed.', error); return; } const sellerIds = [...new Set((rows || []).map((row) => row.seller_id).filter(Boolean))]; const { data: sellers } = sellerIds.length ? await client.from('profiles').select('user_id,display_name,handle').in('user_id', sellerIds).limit(100) : { data: [] }; const sellerById = new Map((sellers || []).map((seller) => [seller.user_id, seller])); listings = (rows || []).map((row) => ({ ...row, seller: sellerById.get(row.seller_id) || null })); favoriteIds = new Set((favorites || []).map((row) => row.listing_id)); await loadImages(listings); renderCards(); const requested = routeParams.get('listing'); if (requested && listings.some((row) => row.id === requested)) openListing(requested); };
  const openListing = async (id) => { const listing = listings.find((row) => row.id === id); if (!listing) return; void client.rpc('marketplace_increment_view', { p_listing_id:id }); const image = imageUrls.get(id); const category = selectedCategory('', listing.category_id); const messageAction = listing.seller_id === user.id ? `<p class="market-owner-note">${tr('This is your listing.', 'هذا إعلانك.')}</p>` : `<a class="button button-primary" href="./messages.html?listing=${encodeURIComponent(listing.id)}">${tr('Message seller privately', 'مراسلة البائع بشكل خاص')}</a>`; $('#listing-detail').innerHTML = `<div class="listing-detail-grid"><div class="detail-image">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(listing.title)}" />` : 'No image added by seller'}</div><div class="detail-copy"><span class="listing-kind">${listing.kind === 'service' ? 'Service' : 'Product'} · ${escapeHTML(categoryName(category))}</span><h2>${escapeHTML(listing.title)}</h2><p class="listing-price">${listing.pricing_type === 'contact' ? 'Contact seller' : `${money(listing.price, listing.currency_code)}${listing.pricing_type === 'hourly' ? ' / hour' : ''}`}</p><div class="detail-meta"><span>Seller: <strong>${escapeHTML(listing.seller?.display_name || listing.seller?.handle || 'IQZodiac member')}</strong></span><span>Location: <strong>${escapeHTML([listing.city, listing.country].filter(Boolean).join(', ') || 'Not specified')}</strong></span>${listing.condition ? `<span>Condition: <strong>${escapeHTML(listing.condition.replace('_',' '))}</strong></span>` : ''}<span>Delivery: <strong>${escapeHTML((listing.delivery_options || []).join(', '))}</strong></span><span>Views: <strong>${Number(listing.views_count || 0) + 1}</strong></span></div><p class="detail-description">${escapeHTML(listing.description)}</p><div class="detail-actions">${messageAction}<button class="button button-ghost" type="button" data-detail-favorite="${listing.id}">${favoriteIds.has(listing.id) ? '♥ Saved' : '♡ Add to favorites'}</button><button class="button button-ghost" type="button" disabled title="Online payment is not configured yet">Buy now unavailable</button></div><p class="market-status">Online checkout will appear here only after a verified payment provider is configured. No payment is collected in this version.</p></div></div>`; $('#listing-dialog').showModal(); };
  const sellerListingStatus = (value) => ({ active:tr('Live','نشط'), draft:tr('Draft','مسودة'), paused:tr('Paused','متوقف'), sold:tr('Sold','مباع'), completed:tr('Completed','مكتمل') }[value] || value);
  const renderSellerListings = () => {
    const target = $('#seller-listing-list');
    target.innerHTML = sellerListings.length ? sellerListings.map((listing) => {
      const category = selectedCategory(listing.kind, listing.category_id);
      const price = listing.pricing_type === 'contact' ? tr('Contact for price', 'السعر عند التواصل') : money(listing.price, listing.currency_code);
      const editable = ['active', 'draft', 'paused'].includes(listing.status);
      return `<article class="seller-listing-row"><div class="seller-listing-info"><div class="seller-listing-heading"><span class="seller-listing-status status-${escapeHTML(listing.status)}">${escapeHTML(sellerListingStatus(listing.status))}</span><span class="listing-kind">${listing.kind === 'service' ? tr('Service','خدمة') : tr('Product','منتج')}</span></div><h3>${escapeHTML(listing.title)}</h3><p>${escapeHTML(categoryName(category))} · ${escapeHTML(price)}</p><small>${escapeHTML(tr('Updated','آخر تعديل'))} ${escapeHTML(new Intl.DateTimeFormat(undefined, { dateStyle:'medium' }).format(new Date(listing.updated_at || listing.created_at)))}</small></div><div class="seller-listing-actions"><button class="button button-ghost" type="button" data-edit-listing="${escapeHTML(listing.id)}" ${editable ? '' : `disabled title="${escapeHTML(tr('Sold or completed listings cannot be edited.', 'لا يمكن تعديل الإعلانات المباعة أو المكتملة.'))}"`}>${tr('Edit','تعديل')}</button><button class="button button-danger" type="button" data-delete-listing="${escapeHTML(listing.id)}">${tr('Delete','حذف')}</button></div></article>`;
    }).join('') : `<div class="market-empty">${tr('You have not published any listings yet. Use + Sell to create one.', 'لم تنشر أي إعلانات بعد. استخدم زر البيع لإضافة إعلان.')}</div>`;
  };
  const loadSellerListings = async () => {
    const sellerStatus = $('#seller-listings-status');
    sellerStatus.textContent = tr('Loading your listings…', 'جارٍ تحميل إعلاناتك…');
    const { data, error } = await client.from('marketplace_listings').select('id,kind,title,description,category_id,price,currency_code,pricing_type,condition,country,city,delivery_options,status,created_at,updated_at').eq('seller_id', user.id).is('deleted_at', null).order('updated_at', { ascending:false }).limit(100);
    if (error) { sellerListings = []; sellerStatus.textContent = tr('Your listings could not be loaded. Please try again.', 'تعذر تحميل إعلاناتك. حاول مرة أخرى.'); console.warn('Seller listings query failed.', error); renderSellerListings(); return; }
    sellerListings = data || [];
    sellerStatus.textContent = `${sellerListings.length} ${tr('listing(s) in your seller dashboard.', 'إعلان في لوحة البائع.')}`;
    renderSellerListings();
  };
  const setSellMode = (editing) => {
    $('#sell-kind').disabled = editing;
    $('#sell-form .eyebrow').textContent = editing ? tr('EDIT YOUR LISTING', 'تعديل إعلانك') : tr('CREATE A REAL LISTING', 'إنشاء إعلان حقيقي');
    $('#sell-dialog-title').textContent = editing ? tr('Make your changes.', 'حدّث تفاصيل إعلانك.') : tr('Put something in orbit.', 'ضع شيئًا في المدار.');
    $('#sell-submit').textContent = editing ? tr('Save changes', 'حفظ التعديلات') : tr('Publish listing', 'نشر الإعلان');
    const hint = $('#sell-images-hint');
    hint.hidden = !editing;
    hint.textContent = editing ? tr('New images are added to the listing. Existing images stay in place.', 'ستُضاف الصور الجديدة إلى الإعلان، وتبقى الصور الحالية كما هي.') : '';
  };
  const openNewListing = () => {
    editingListingId = null;
    $('#sell-form').reset();
    $('#sell-kind').value = 'product';
    $('#sell-currency').value = 'USD';
    populateCategories($('#sell-category'), 'product');
    $('#condition-field').hidden = false;
    $('#sell-status').textContent = '';
    setSellMode(false);
    $('#sell-dialog').showModal();
  };
  const openEditListing = (id) => {
    const listing = sellerListings.find((row) => row.id === id);
    if (!listing) return;
    editingListingId = listing.id;
    $('#sell-form').reset();
    $('#sell-kind').value = listing.kind;
    populateCategories($('#sell-category'), listing.kind);
    $('#sell-category').value = listing.category_id || '';
    $('#sell-title').value = listing.title || '';
    $('#sell-description').value = listing.description || '';
    $('#sell-price').value = Number(listing.price || 0).toFixed(2);
    $('#sell-currency').value = listing.currency_code || 'USD';
    $('#sell-pricing').value = listing.pricing_type || 'fixed';
    $('#sell-condition').value = listing.condition || 'new';
    $('#condition-field').hidden = listing.kind === 'service';
    $('#sell-country').value = listing.country || '';
    $('#sell-city').value = listing.city || '';
    $('#sell-form').querySelectorAll('input[name="delivery"]').forEach((input) => { input.checked = (listing.delivery_options || []).includes(input.value); });
    $('#sell-images').value = '';
    $('#sell-status').textContent = '';
    setSellMode(true);
    $('#sell-dialog').showModal();
  };
  const deleteSellerListing = async (id, button) => {
    const listing = sellerListings.find((row) => row.id === id);
    if (!listing || !window.confirm(tr(`Remove “${listing.title}” from the public Marketplace? Existing order and chat history will be kept.`, `هل تريد إزالة «${listing.title}» من السوق؟ ستبقى سجلات الطلبات والمحادثات محفوظة.`))) return;
    button.disabled = true;
    $('#seller-listings-status').textContent = tr('Deleting listing…', 'جارٍ حذف الإعلان…');
    const { error } = await client.rpc('marketplace_delete_listing', { p_listing_id:id });
    if (error) {
      button.disabled = false;
      $('#seller-listings-status').textContent = error.message?.includes('listing_has_open_transactions') ? tr('Resolve the open order or service request before removing this listing.', 'يجب إكمال طلب الشراء أو الخدمة المفتوح قبل إزالة الإعلان.') : tr('The listing could not be deleted. Please try again.', 'تعذر حذف الإعلان. حاول مرة أخرى.');
      console.warn('Marketplace listing deletion failed.', error);
      return;
    }
    sellerListings = sellerListings.filter((row) => row.id !== id);
    renderSellerListings();
    await loadListings();
    $('#seller-listings-status').textContent = tr('Listing removed from Marketplace. Its order and chat history remains available.', 'تمت إزالة الإعلان من السوق مع الاحتفاظ بسجل الطلبات والمحادثات.');
  };
  const toggleFavorite = async (id, button) => { button.disabled = true; const saved = favoriteIds.has(id); const result = saved ? await client.from('marketplace_favorites').delete().eq('listing_id', id).eq('user_id', user.id) : await client.from('marketplace_favorites').insert({ listing_id:id, user_id:user.id }); button.disabled = false; if (result.error) { status('This listing could not be saved.'); return; } if (saved) favoriteIds.delete(id); else favoriteIds.add(id); renderCards(); };
  const uploadImages = async (listingId, files) => {
    const selected = [...files];
    if (!selected.length) return { uploaded:0, failed:0 };
    const { data: existing, error: countError } = await client.from('marketplace_listing_images').select('id').eq('listing_id', listingId).limit(9);
    if (countError) return { uploaded:0, failed:selected.length };
    const slots = Math.max(0, 8 - (existing || []).length);
    const accepted = selected.filter((file) => ['image/jpeg','image/png','image/webp'].includes(file.type) && file.size <= 8 * 1024 * 1024).slice(0, slots);
    let uploaded = 0; let failed = selected.length - accepted.length;
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      const path = `${user.id}/${listingId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const { error } = await client.storage.from('marketplace-media').upload(path, file, { contentType:file.type, upsert:false });
      if (error) { failed += 1; continue; }
      const { error: imageError } = await client.from('marketplace_listing_images').insert({ listing_id:listingId, storage_path:path, alt_text:file.name, display_order:(existing || []).length + index });
      if (imageError) { failed += 1; await client.storage.from('marketplace-media').remove([path]); continue; }
      uploaded += 1;
    }
    return { uploaded, failed };
  };
  const handleSell = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const sellStatus = $('#sell-status');
    const kind = $('#sell-kind').value;
    const files = $('#sell-images').files;
    const delivery = [...form.querySelectorAll('input[name="delivery"]:checked')].map((input) => input.value);
    if (!delivery.length) { sellStatus.textContent = tr('Choose at least one delivery option.', 'اختر طريقة تسليم واحدة على الأقل.'); return; }
    const isEditing = Boolean(editingListingId);
    const params = {
      p_kind:kind,
      p_title:$('#sell-title').value.trim(),
      p_description:$('#sell-description').value.trim(),
      p_category_id:$('#sell-category').value || null,
      p_price:Number($('#sell-price').value),
      p_currency_code:$('#sell-currency').value.trim().toUpperCase(),
      p_pricing_type:$('#sell-pricing').value,
      p_condition:kind === 'product' ? $('#sell-condition').value : null,
      p_country:$('#sell-country').value.trim(),
      p_city:$('#sell-city').value.trim(),
      p_delivery_options:delivery,
    };
    sellStatus.textContent = isEditing ? tr('Saving your changes securely…', 'جارٍ حفظ تعديلاتك بأمان…') : tr('Publishing securely…', 'جارٍ النشر بأمان…');
    const result = isEditing
      ? await client.rpc('marketplace_update_listing', { p_listing_id:editingListingId, ...params })
      : await client.rpc('marketplace_publish_listing', params);
    const listingId = result.data;
    if (result.error || !listingId) {
      console.warn('Marketplace listing save failed.', result.error);
      sellStatus.textContent = result.error?.message?.includes('listing_has_open_transactions') ? tr('Resolve open orders or service requests before editing this listing.', 'أكمل طلبات الشراء أو الخدمة المفتوحة قبل تعديل الإعلان.') : tr('The listing could not be saved. Check the category, price, currency and fields.', 'تعذر حفظ الإعلان. تحقق من الفئة والسعر والعملة والحقول.');
      return;
    }
    let uploadSummary = { uploaded:0, failed:0 };
    if (files.length) uploadSummary = await uploadImages(listingId, files);
    const successText = isEditing ? tr('Listing updated.', 'تم تحديث الإعلان.') : tr('Listing published.', 'تم نشر الإعلان.');
    const warningText = uploadSummary.failed ? tr(' Some images could not be added; the listing itself was saved.', ' تعذر إضافة بعض الصور، لكن تم حفظ الإعلان.') : '';
    status(successText + warningText);
    form.reset();
    $('#sell-currency').value = 'USD';
    editingListingId = null;
    $('#sell-dialog').close();
    await loadListings();
    if (!$('#seller-dashboard').hidden) await loadSellerListings();
  };
  const bind = () => {
    ['#market-search','#market-kind','#market-category','#market-country','#market-city','#market-max-price','#market-sort'].forEach((selector) => $(selector).addEventListener(selector === '#market-search' ? 'input' : 'change', renderCards));
    $('#clear-filters').addEventListener('click', () => { ['#market-search','#market-country','#market-city','#market-max-price'].forEach((selector) => $(selector).value = ''); $('#market-kind').value = ''; $('#market-category').value = ''; renderCards(); });
    $('#open-sell').addEventListener('click', openNewListing);
    $('#open-my-listings').addEventListener('click', async () => { $('#seller-dashboard').hidden = false; await loadSellerListings(); $('#seller-dashboard').scrollIntoView({ behavior:'smooth', block:'start' }); });
    $('#close-seller-dashboard').addEventListener('click', () => { $('#seller-dashboard').hidden = true; });
    $('#sell-kind').addEventListener('change', () => { populateCategories($('#sell-category'), $('#sell-kind').value); $('#condition-field').hidden = $('#sell-kind').value === 'service'; });
    $('#sell-form').addEventListener('submit', handleSell);
    $('#seller-listing-list').addEventListener('click', (event) => {
      const edit = event.target.closest('[data-edit-listing]');
      const remove = event.target.closest('[data-delete-listing]');
      if (edit) openEditListing(edit.dataset.editListing);
      if (remove) void deleteSellerListing(remove.dataset.deleteListing, remove);
    });
    document.addEventListener('click', (event) => { const open = event.target.closest('[data-open-listing]'); const favorite = event.target.closest('[data-favorite], [data-detail-favorite]'); if (open) openListing(open.dataset.openListing); if (favorite) void toggleFavorite(favorite.dataset.favorite || favorite.dataset.detailFavorite, favorite); if (event.target.matches('[data-close-dialog]')) event.target.closest('dialog').close(); });
  };
  (async () => { try { client = await window.IQZodiacSupabase.ready; const { data: session } = await client.auth.getSession(); user = session.session?.user; if (!user) { status('Please sign in to browse Marketplace.'); return; } const { data: categoryRows, error } = await client.from('marketplace_categories').select('id,kind,slug,name_en,name_ar').eq('is_active', true).order('sort_order').limit(100); if (error) throw error; categories = categoryRows || []; populateCategories($('#market-category')); populateCategories($('#sell-category'), 'product'); bind(); await loadListings(); } catch (error) { console.warn('Marketplace could not load.', error); status('Marketplace is temporarily unavailable.'); } })();
})();
