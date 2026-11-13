(() => {
  'use strict';
  const data = window.IQZodiacBody3DData;
  if (!data) return;

  const grid = document.getElementById('body3d-angle-grid');
  const saveButton = document.getElementById('body3d-save-set');
  const deleteAllButton = document.getElementById('body3d-delete-all');
  const progressLabel = document.getElementById('body3d-progress-label');
  const progressBar = document.getElementById('body3d-progress-bar');
  const recordStatus = document.getElementById('body3d-record-status');
  const qualityNote = document.getElementById('body3d-quality-note');
  const engineBadge = document.getElementById('body3d-privacy-badge');
  const ownerModels = document.getElementById('body3d-owner-models');
  const guide = document.getElementById('body3d-instructions');
  const selected = new Map();
  let activeAngle = null;
  let busy = false;
  let existing = [];
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const setStatus = (message, state = '') => { recordStatus.textContent = message; recordStatus.dataset.state = state; };
  const angles = data.angles;
  const angleNames = { front: 'Front view', back: 'Back view', left: 'Left side', right: 'Right side', front_left_45: 'Front left 45°', front_right_45: 'Front right 45°', back_left_45: 'Back left 45°', back_right_45: 'Back right 45°' };
  const t = (english, arabic) => window.IQZodiacLanguage?.t(english, arabic) ?? english;
  const errorText = (error, arabic) => t(error?.message || 'An unexpected error occurred.', arabic);
  const angleNamesArabic = { front: 'الواجهة الأمامية', back: 'الواجهة الخلفية', left: 'الجانب الأيسر', right: 'الجانب الأيمن', front_left_45: 'أمامي يسار ٤٥°', front_right_45: 'أمامي يمين ٤٥°', back_left_45: 'خلفي يسار ٤٥°', back_right_45: 'خلفي يمين ٤٥°' };
  const checksPassed = () => ['body3d-check-full', 'body3d-check-pose', 'body3d-check-face'].every((id) => document.getElementById(id).checked);

  const refreshProgress = () => {
    const count = selected.size;
    progressLabel.textContent = t(`${count} / ${angles.length} views selected`, `تم اختيار ${new Intl.NumberFormat('ar').format(count)} من ${new Intl.NumberFormat('ar').format(angles.length)} زوايا`);
    progressBar.style.width = `${count / angles.length * 100}%`;
    grid.querySelectorAll('.body3d-angle-card').forEach((card) => {
      const current = selected.get(card.dataset.angle);
      card.classList.toggle('is-ready', Boolean(current));
      const button = card.querySelector('.body3d-capture');
      button.textContent = current ? 'Replace photo' : 'Add photo';
      const thumb = card.querySelector('.body3d-thumb');
      thumb.replaceChildren();
      thumb.hidden = !current;
      if (current) {
        const image = document.createElement('img');
        image.src = current.url;
        image.alt = `${angleNames[card.dataset.angle]} preview, face area intentionally excluded by the member`;
        const quality = document.createElement('span');
        quality.textContent = `${current.width} × ${current.height} · ${Math.round(current.blob.size / 1024)} KB`;
        thumb.append(image, quality);
      }
    });
    saveButton.disabled = busy || count !== angles.length || !checksPassed();
    deleteAllButton.hidden = busy || (!selected.size && !existing.length);
  };

  const inspectImage = (imageData) => {
    const { image, sourceWidth, sourceHeight } = imageData;
    const scale = Math.min(1, 240 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0, sumSq = 0, edgeSum = 0, edgeCount = 0;
    const width = canvas.width, height = canvas.height;
    const luminance = new Float32Array(width * height);
    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      const y = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
      luminance[j] = y; sum += y; sumSq += y * y;
    }
    const mean = sum / luminance.length;
    for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < width - 1; x += 2) {
      const p = y * width + x;
      const laplacian = 4 * luminance[p] - luminance[p - 1] - luminance[p + 1] - luminance[p - width] - luminance[p + width];
      edgeSum += laplacian * laplacian; edgeCount++;
    }
    const variance = Math.max(0, sumSq / luminance.length - mean * mean);
    return { mean, contrast: Math.sqrt(variance), sharpness: edgeCount ? edgeSum / edgeCount : 0 };
  };

  const compressPhoto = async (file) => {
    if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file for this view.');
    if (file.size < 1 || file.size > 40 * 1024 * 1024) throw new Error('Each source image must be smaller than 40 MB.');
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw new Error('This image format could not be opened here. Try a JPEG, PNG or WebP image.'); }
    try {
      const width = bitmap.width, height = bitmap.height;
      if (width < 720 || height < 1100) throw new Error('This image is too small for the photo set. Use an upright image at least 720 × 1100 pixels.');
      const maxEdge = 2400;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#f4f4f0'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = inspectImage({ image: bitmap, sourceWidth: width, sourceHeight: height });
      const issues = [];
      if (quality.mean < 35) issues.push('very dark exposure');
      if (quality.mean > 225) issues.push('very bright exposure');
      if (quality.contrast < 18) issues.push('low image contrast');
      if (quality.sharpness < 7) issues.push('possible blur (rough estimate)');
      if (issues.length) throw new Error(`Image quality needs attention: ${issues.join(', ')}. Retake in even light and keep the camera steady.`);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not prepare this image for upload.')), 'image/jpeg', .94));
      if (blob.size > 25 * 1024 * 1024) throw new Error('The prepared photo exceeds the secure storage limit. Choose a smaller original.');
      return { blob, width: canvas.width, height: canvas.height, quality };
    } finally { bitmap.close(); }
  };

  const acceptFile = async (angle, file) => {
    if (!file) return;
    setStatus(t(`Checking ${angleNames[angle]}…`, `جارٍ فحص ${angleNamesArabic[angle]}…`), 'busy');
    try {
      const result = await compressPhoto(file);
      const previous = selected.get(angle);
      if (previous?.url) URL.revokeObjectURL(previous.url);
      selected.set(angle, { ...result, url: URL.createObjectURL(result.blob) });
      qualityNote.textContent = 'Size, exposure, contrast and a rough sharpness estimate passed. Full-body framing, obstructions, pose consistency and face privacy still require your own visual check.';
      setStatus(t(`${angleNames[angle]} is ready. You can preview it or replace it before upload.`, `أصبحت صورة ${angleNamesArabic[angle]} جاهزة. يمكنك معاينتها أو استبدالها قبل الرفع.`), 'success');
      refreshProgress();
    } catch (error) {
      setStatus(t(error.message || 'That image could not be prepared.', 'تعذّر تجهيز الصورة. تحقّق من نوعها وجودتها وحجمها ثم حاول مجددًا.'), 'error');
    }
  };

  const openGuide = (angle) => {
    activeAngle = angle;
    if (guide?.showModal) guide.showModal();
    else setStatus('Photo guidance is unavailable in this browser.', 'error');
  };
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-capture-angle]');
    if (button && !busy) openGuide(button.dataset.captureAngle);
  });
  guide.querySelector('[data-body3d-choice="camera"]').addEventListener('click', () => {
    const card = grid.querySelector(`[data-angle="${CSS.escape(activeAngle)}"]`);
    const input = card?.querySelector('.body3d-camera-input');
    guide.close();
    if (input) { input.value = ''; input.click(); }
  });
  guide.querySelector('[data-body3d-choice="file"]').addEventListener('click', () => {
    const card = grid.querySelector(`[data-angle="${CSS.escape(activeAngle)}"]`);
    const input = card?.querySelector('.body3d-file-input');
    guide.close();
    if (input) { input.value = ''; input.click(); }
  });
  guide.querySelector('[data-body3d-choice="cancel"]').addEventListener('click', () => guide.close());
  grid.querySelectorAll('.body3d-angle-card').forEach((card) => {
    const angle = card.dataset.angle;
    card.querySelector('.body3d-camera-input').addEventListener('change', (event) => { void acceptFile(angle, event.target.files?.[0]); });
    card.querySelector('.body3d-file-input').addEventListener('change', (event) => { void acceptFile(angle, event.target.files?.[0]); });
  });
  document.querySelectorAll('.body3d-checklist input').forEach((input) => input.addEventListener('change', refreshProgress));

  const renderSavedModels = async () => {
    ownerModels.querySelectorAll('.body3d-viewer-wrap').forEach((node) => window.IQZodiacBody3DViewer?.unmount(node));
    existing = await data.listMine();
    ownerModels.replaceChildren();
    engineBadge.textContent = t(existing.some((model) => model.visibility === 'show' && model.status === 'ready') ? 'VISIBLE' : 'HIDDEN', existing.some((model) => model.visibility === 'show' && model.status === 'ready') ? 'ظاهر' : 'مخفي');
    deleteAllButton.hidden = busy || (!selected.size && !existing.length);
    for (const model of existing) {
      const item = document.createElement('article');
      item.className = 'body3d-saved-set';
      const titleCopy = model.status === 'ready' ? ['3D model ready', 'المجسم ثلاثي الأبعاد جاهز'] : model.status === 'failed' ? ['Reconstruction failed', 'فشلت إعادة بناء المجسم'] : model.status === 'cancelled' ? ['Photo set cancelled', 'أُلغيت مجموعة الصور'] : ['Private photo set · awaiting reconstruction service', 'مجموعة صور خاصة · بانتظار خدمة إعادة البناء'];
      const title = document.createElement('h3'); title.textContent = t(...titleCopy);
      const copy = document.createElement('p');
      copy.textContent = model.status === 'ready' ? t('The actual reconstruction service reported this model as ready.', 'أكدت خدمة إعادة البناء الفعلية جاهزية هذا المجسم.') : t('The eight private images are stored securely. Reconstruction does not start until a real AI service is connected.', 'حُفظت الصور الخاصة الثماني بأمان. لن تبدأ إعادة البناء حتى ربط خدمة ذكاء اصطناعي فعلية.');
      const details = document.createElement('p');
      details.textContent = model.originals_retention === 'keep_until_deleted' ? t('Original retention: Keep until deleted', 'الاحتفاظ بالصور الأصلية: حتى حذفها') : t('Original retention: Delete after processing', 'الاحتفاظ بالصور الأصلية: حذفها بعد المعالجة');
      const visibilityLabel = document.createElement('label');
      visibilityLabel.className = 'body3d-visibility-setting';
      visibilityLabel.append(document.createTextNode(t('3D Body Visibility', 'خصوصية المجسم ثلاثي الأبعاد')));
      const visibility = document.createElement('select');
      visibility.setAttribute('aria-label', t('3D Body Visibility', 'خصوصية المجسم ثلاثي الأبعاد'));
      const hide = document.createElement('option'); hide.value = 'hide'; hide.textContent = t('Hide — only you can view this model', 'إخفاء — يمكنك وحدك مشاهدة هذا المجسم');
      const show = document.createElement('option'); show.value = 'show'; show.textContent = t('Show — display this model on your profile', 'إظهار — عرض هذا المجسم في ملفك الشخصي'); show.disabled = model.status !== 'ready' || model.face_anonymized !== true;
      visibility.append(hide, show); visibility.value = model.visibility === 'show' ? 'show' : 'hide';
      visibility.addEventListener('change', async () => {
        const nextValue = visibility.value;
        visibility.disabled = true;
        try { await data.setVisibility(model.id, nextValue); setStatus(nextValue === 'show' ? t('This model is now visible on your profile.', 'أصبح هذا المجسم ظاهراً في ملفك الشخصي.') : t('This model is hidden from other members.', 'هذا المجسم مخفي عن الأعضاء الآخرين.'), 'success'); await renderSavedModels(); }
        catch (error) { visibility.value = model.visibility === 'show' ? 'show' : 'hide'; setStatus(errorText(error, 'تعذّر تغيير خصوصية المجسم. حاول مجددًا.'), 'error'); visibility.disabled = false; }
      });
      visibilityLabel.append(visibility);
      item.append(title, copy, details, visibilityLabel);
      if (model.status === 'ready') {
        const viewer = document.createElement('div'); viewer.className = 'body3d-viewer-wrap'; viewer.setAttribute('data-body3d-viewer', 'owner'); viewer.setAttribute('aria-label', t('Private 3D body model viewer', 'عارض المجسم ثلاثي الأبعاد الخاص'));
        item.append(viewer);
        void window.IQZodiacBody3DViewer?.mount(viewer, model.id, { owner: true });
      } else {
        try {
          const photos = await data.listMyPhotos(model.id);
          if (photos.length) {
            const strip = document.createElement('div'); strip.className = 'body3d-photo-list';
            photos.forEach((photo) => { const image = document.createElement('img'); image.src = photo.url; image.alt = t(`${angleNames[photo.angle] || photo.angle} private photo`, `صورة خاصة ${angleNamesArabic[photo.angle] || photo.angle}`); image.loading = 'lazy'; strip.append(image); });
            item.append(strip);
            const keep = document.createElement('button'); keep.type = 'button'; keep.className = 'body3d-capture'; keep.textContent = t('Set originals to keep', 'الاحتفاظ بالصور الأصلية');
            keep.addEventListener('click', async () => { try { await data.setRetention(model.id, 'keep_until_deleted'); await renderSavedModels(); } catch (error) { setStatus(errorText(error, 'تعذّر حفظ سياسة الاحتفاظ بالصور.'), 'error'); } });
            const erase = document.createElement('button'); erase.type = 'button'; erase.className = 'body3d-capture'; erase.textContent = t('Delete originals after processing', 'حذف الصور الأصلية بعد المعالجة');
            erase.addEventListener('click', async () => { try { await data.setRetention(model.id, 'delete_after_processing'); await renderSavedModels(); } catch (error) { setStatus(errorText(error, 'تعذّر حفظ سياسة الاحتفاظ بالصور.'), 'error'); } });
            item.append(keep, erase);
          }
        } catch (error) { console.warn('Private body photos could not be loaded.', error); }
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'body3d-capture'; remove.textContent = t('Delete this photo set and model', 'حذف مجموعة الصور والمجسم');
      remove.addEventListener('click', async () => {
        if (!window.confirm(t('Permanently delete every photo and model file in this set? This cannot be undone.', 'هل تريد حذف كل الصور وملف المجسم في هذه المجموعة نهائيًا؟ لا يمكن التراجع عن ذلك.'))) return;
        remove.disabled = true;
        try { await data.deleteCaptureSet(model.id); await renderSavedModels(); setStatus(t('The body photo set and its stored files were deleted.', 'حُذفت مجموعة صور الجسم والملفات المخزنة المرتبطة بها.'), 'success'); }
        catch (error) { setStatus(errorText(error, 'تعذّر حذف مجموعة الصور بالكامل.'), 'error'); remove.disabled = false; }
      });
      item.append(remove);
      ownerModels.append(item);
    }
    refreshProgress();
  };

  saveButton.addEventListener('click', async () => {
    if (busy || selected.size !== angles.length || !checksPassed()) return;
    busy = true; refreshProgress();
    let modelId = null;
    try {
      setStatus('Creating a private photo-set record…', 'busy');
      const retention = document.getElementById('body3d-retention').value;
      modelId = await data.createCaptureSet(retention);
      let uploaded = 0;
      for (const angle of angles) {
        await data.uploadPhoto(modelId, angle, selected.get(angle).blob);
        uploaded++;
        setStatus(t(`Uploading private photos: ${uploaded} / ${angles.length}.`, `جارٍ رفع الصور الخاصة: ${new Intl.NumberFormat('ar').format(uploaded)} من ${new Intl.NumberFormat('ar').format(angles.length)}.`), 'busy');
      }
      setStatus('All eight photos are stored privately. Status: awaiting reconstruction service; no model has been generated.', 'success');
      for (const current of selected.values()) URL.revokeObjectURL(current.url);
      selected.clear();
      document.querySelectorAll('.body3d-checklist input').forEach((input) => { input.checked = false; });
      await renderSavedModels();
    } catch (error) {
      if (modelId) {
        try { await data.deleteCaptureSet(modelId); }
        catch (cleanupError) { console.error('Incomplete photo set requires manual deletion.', cleanupError); }
      }
      setStatus(errorText(error, 'تعذّر رفع الصور. بقيت الصور المحددة هنا؛ تحقّق من الاتصال وحاول مجددًا.'), 'error');
      await renderSavedModels().catch(() => {});
    } finally { busy = false; refreshProgress(); }
  });

  deleteAllButton.addEventListener('click', async () => {
    if (!window.confirm('Permanently delete all your body photos, 3D models and related records? This cannot be undone.')) return;
    busy = true; refreshProgress();
    try {
      const rows = await data.listMine();
      for (const model of rows) await data.deleteCaptureSet(model.id);
      for (const value of selected.values()) URL.revokeObjectURL(value.url);
      selected.clear();
      document.querySelectorAll('.body3d-checklist input').forEach((input) => { input.checked = false; });
      setStatus('All body photo sets, model files and related records were deleted.', 'success');
      await renderSavedModels();
    } catch (error) { setStatus(errorText(error, 'لم يتسنّ حذف كل بيانات الجسم. حاول مجددًا.'), 'error'); }
    finally { busy = false; refreshProgress(); }
  });

  window.addEventListener('beforeunload', () => selected.forEach((value) => URL.revokeObjectURL(value.url)));
  window.addEventListener('iqzodiac:languagechange', refreshProgress);
  refreshProgress();
  void renderSavedModels().then(() => setStatus(existing.length ? t(`${existing.length} private body record(s) loaded.`, `تم تحميل ${new Intl.NumberFormat('ar').format(existing.length)} من سجلات الجسم الخاصة.`) : t('No saved body photo sets yet.', 'لا توجد مجموعات صور جسم محفوظة بعد.'))).catch((error) => setStatus(errorText(error, 'تعذّر تحميل بيانات الجسم الخاصة.'), 'error'));
})();
