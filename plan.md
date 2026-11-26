

## Clad Body API Integration

Reuse the existing `profile-body3d` capture flow, private `iqzodiac-body-private` bucket, `profile_body_models` records, `body-model-access` viewer, and `body-model-delete` cleanup. The official Clad photo contract accepts one photo plus `height_cm`, returns an asynchronous `job_id`, and later returns a base64 GLB mesh, measurements, and opaque params. The existing front photo is the provider input; the remaining private views are retained for the user's private capture set and existing readiness guard.

Add a server-only `body-model-reconstruct` Edge Function. It authenticates the Supabase JWT, reads the front JPEG from private Storage with the service role, reads `CLAD_API_KEY` only from Edge Function environment variables, submits the multipart request to `https://api.clad.you/v1/body/from-photo`, polls only the returned Clad job URL, validates the returned GLB container and size, uploads it to the existing private bucket, stores measurements and provider metadata, and marks the model ready. Failures mark the model failed without exposing provider keys or raw provider responses.

Extend the existing model record additively with source, provider reference, provider params, measurements JSON, and processing error metadata. No existing tables, photos, models, or storage files are deleted. The UI adds a required height field and invokes reconstruction after all private uploads, showing Uploading, Processing, Completed, and Failed states. Existing viewer, visibility rules, and deletion remain in place.

### Project structure

- `profile.html`, `profile-body3d.js`, `profile-body3d-data.js`: existing capture UI and authenticated client calls.
- `body3d-viewer.js`: existing Three.js GLB viewer, reused unchanged.
- `supabase/functions/body-model-reconstruct/index.ts`: authenticated Clad integration and result persistence.
- `supabase/functions/_shared/clad-body-provider.ts`: Clad request, polling, GLB validation, and measurement normalization.
- `supabase/migrations/20261121170000_clad_body_integration.sql`: additive metadata and safe trigger compatibility.

### Design

- Design movement: restrained cyber-luxury product UI.
- Core principles: private by default, explicit consent, truthful processing states, and progressive disclosure of measurements.
- Color philosophy: retain IQZodiac's midnight blue and cyan accents; use cyan for active processing and green only for a confirmed completed model.
- Layout paradigm: keep the existing profile card and add a compact measurement/status panel rather than creating a new section.
- Signature elements: privacy badge, stateful progress label, and a compact measurement grid.
- Interaction philosophy: every provider action is explicit and cancellable through deletion; no success state is shown before a real GLB is stored.
- Animation: subtle status transitions only; respect reduced-motion preferences.
- Typography system: reuse the existing profile typography and card hierarchy.
- Brand essence: a private, measurable body profile for IQZodiac members; precise, discreet, practical.
- Brand voice: clear and honest, e.g. “Your model is processing securely.” and “No model is shown until a real result is stored.”
- Wordmark & logo: reuse existing IQZodiac identity; no new logo.
- Signature brand color: existing cyan accent used for secure processing.

### Official evidence

Clad's official developer page states that the service accepts one photo or eight short questions and exposes GLB meshes plus ISO 8559-1 measurements. The official OpenAPI document defines `POST /v1/body/from-photo` as multipart form data with `photo` and `height_cm`, returning an asynchronous `job_id`; `GET /v1/jobs/{job_id}` returns queued, running, completed, or failed status and the completed mesh, measurements, and opaque params. It also defines bearer authentication and a weekly photo quota. Source: https://clad.you/developers and https://api.clad.you/openapi.json.


## Discover Vault

Reuse the existing Discover page and navigation rather than creating a second Discover route. Add a compact Vault card with private image, video, and audio upload controls. Store only owner-scoped metadata in `vault_items` and originals in the non-public `iqzodiac-vault-private` bucket, with RLS and Storage policies requiring the authenticated user's folder.

The browser uses WebAuthn platform user verification before revealing signed media URLs. On supported phones this invokes Face ID, fingerprint, or the operating-system device lock, which may be a PIN or pattern. The web platform does not expose a direct API for a site's own custom phone pattern. The server-side privacy boundary remains Supabase Auth, RLS, and private Storage; the biometric prompt is an additional local unlock gate.


## Site Ads Manager — simplified publishing
Reuse the private Ads Studio, existing `site_ads` table and RLS, and sandboxed `ad-runtime.js`; do not create ad records for testing. Restore the studio to English with the IQZodiac midnight/cyan visual style and a short publishing path: choose one page (or all supported content/member pages) and one placement from clear dependent dropdowns, then publish or save a draft. Persist the selected page/placement through the existing `sections`, `placements`, and legacy `placement` columns, using only values accepted by the database constraints; add an additive migration for the supported page keys. Install header, main-content, and footer slots on supported content/member pages while retaining Home's post-feed and Reels' between-video positions. Keep drafts and out-of-window ads hidden, confirm persistence using a returned database row before clearing the form, distinguish a persisted ad from a failed list/analytics refresh, and refresh already-open pages on focus and periodically only while visible. Do not publish or insert synthetic production ads during validation.


## إدارة الصفحات ومحرّري محتوى الموقع

نفّذ مسارًا منفصلًا عن أدوار غرف البث والصوت وعن أدوار VIP: يعيّن مسؤول الموقع محرّري محتوى من حسابات مسجلة ومؤكدة البريد، بصلاحية محدودة إلى الصفحات العامة وتصنيفات Marketplace ومحتواها فقط. لا يحصل المحرر على صلاحيات مسؤول الموقع أو إدارة الأعضاء والمالية وميزات VIP أو صلاحيات الإشراف على محتوى الأعضاء. تُفرض الصلاحيات في PostgreSQL/RLS ودوال محدودة، لا بمجرد إخفاء عناصر الواجهة.

أنشئ جدول صفحات عامة مترجمًا (EN/AR) بعناوين ومسارات slug ومحتوى نصي آمن للنشر/الإخفاء والترتيب. يعرض الموقع دليل صفحات وقالبًا عامًا يعتمد على Supabase، مع إخراج النص كنص عادي لتفادي XSS. اجمع إدارة الصفحات وتصنيفات Marketplace الحالية (المنتجات/الخدمات) في مساحة محتوى خاصة بالمحررين، وأضف في مركز المسؤول شاشة لتعيين المحررين وإبطال صلاحيتهم. يظل دور moderator الخاص بـVIP/الغرف كما هو دون ربطه بالمحررين.

### بنية الملفات
- `iqz-control-7f3a91c2.html`, `admin.js`, `admin.css`: تبويبات إدارة الصفحات والمحررين.
- `site-content.html`, `site-content.js`, `site-content.css`: مساحة محتوى محدودة لمحرري الموقع.
- `site-pages.html`, `site-pages.js`: دليل الزوار وعرض الصفحة العامة.
- `home.html`: نقطة دخول ظاهرة إلى دليل الصفحات.
- `supabase/migrations/20261122130000_site_content_management.sql`: جداول الصفحات والمحررين، RPC إدارية محدودة، وسياسات RLS وتصنيفات Marketplace.

### تصميم الواجهة
أعد استخدام تصميم IQZodiac الليلي ذي اللمسات السماوية بدل إدخال لغة بصرية جديدة. المبادئ: صلاحيات متدرجة، محتوى متعدد اللغة، نشر صريح، وإدخال نص آمن. تبقى شاشات الإدارة موجزة وجداولها عملية ومتوافقة مع الجوال. يظل الموقع الحالي ومسارات الغرف والصوت والبث دون تغيير.

## قسم الفيديوهات الطويلة (Videos)

إضافة صفحة مستقلة `videos.html` ومنطقها في `videos.js` وأنماطها في `videos.css`، منفصلة عن Reels. يستطيع المستخدم المسجّل رفع فيديو MP4 أو WebM حتى 50 MiB، مع معاينة محلية، عنوان ووصف وتصنيف اختياري وتأكيد امتلاك الحقوق؛ لا يُطبّق حد Reels البالغ 6 دقائق. تُعرض الفيديوهات المنشورة لجميع زوار الموقع عبر مشغل HTML5 وSigned URLs قصيرة العمر من حاوية `iqzodiac-video-library` الخاصة، مع احترام RLS. يجب إظهار حد الرفع بوضوح لأن الحد مفروض حاليًا في الحاوية وجدول البيانات.

إضافة تبويب إدارة Videos إلى `iqz-control-7f3a91c2.html` و`admin.js` لإنشاء التصنيفات الثنائية اللغة وإظهارها/إخفائها باستخدام جدول `video_categories` وسياسات الأدمن الموجودة. إضافة رابط Videos إلى التنقل العام، ودعم الاسم بالإنجليزية والعربية في `language.js`. جداول `videos` و`video_categories` والحاوية والسياسات موجودة أصلًا في Supabase؛ لا تُكرر DDL ولا تُنشئ بيانات تجريبية أثناء التحقق.

### بنية المشروع
- `videos.html`, `videos.js`, `videos.css`: الواجهة العامة، النشر، المعاينة، تحميل الفيديوهات وتصفية التصنيفات.
- `iqz-control-7f3a91c2.html`, `admin.js`, `admin.css`: تبويب إدارة تصنيفات فيديوهات الأدمن.
- صفحات HTML ذات `.site-nav` و`language.js`: رابط الفيديوهات وترجمته.
- Supabase الحالي: `public.videos`, `public.video_categories`, وحاوية `iqzodiac-video-library` وسياسات RLS/Storage الجاهزة.

### التصميم
إعادة استخدام أسلوب IQZodiac الحالي: خلفية ليلية، بطاقات زجاجية داكنة، تركواز للعناصر النشطة، وتباين واضح. صفحة فيديو مستقلة تتعامل مع المحتوى كفيديو طويل لا كـReels قصيرة؛ المعاينة محلية قبل النشر، والتحكم بالتشغيل بيد المشاهد، ورسائل الرفع تشرح حد الحجم واشتراط الحقوق. واجهة عربية/إنجليزية، وتصنيفات قابلة لإدارة الأدمن.


## Match discovery flow and truthful compatibility

Reuse the existing signup → discovery-profile setup → Match pages, Supabase `discovery_profiles`/`discovery_answers`, privacy adapter, and mutual-like/skip records. Signup already stores the member's date of birth in Auth metadata and the account trigger copies it into the single discovery-profile row; `discovery-profile.js` loads and saves the personality answers and interests. Resume only missing fields, derive the zodiac from the already-saved birth date, preserve completed/discoverable state when editing profile preferences, and never delete or duplicate existing answers.

Replace the existing candidate RPC contract through an additive migration: verify both members have complete, discoverable, current-version profile data; compare actual shared interests and comparable personality answers; add zodiac and element as smaller, explicit factors; exclude self, prior passes/likes, and ineligible members; return age/location only when privacy settings allow; and keep likes, skips, and mutual matches. Add minimal authenticated Match presence with stale-heartbeat expiry because no general member-presence table exists. Match itself must verify the session and the current discovery snapshot before searching, show a targeted resume action only for missing fields, and otherwise immediately render real members with an evidence-based score, public shared interests, zodiac, element, Online/Offline, privacy-permitted age, and only consented public media.

### Project structure

- `signup.js` and the existing signup trigger: preserve the birth date already supplied at registration; do not add duplicate personality questions to the signup form.
- `discovery-profile.js`: hydrate Supabase before saving; resume from saved answers and birth date; request only missing answers/interests/date/element; keep the existing single profile row and upsert answer keys.
- `privacy-core.js` and `profile.js`: expose the signed-in discovery snapshot, load safe candidate fields/media, and preserve discovery completion while editing preferences.
- `match.html`, `match.js`, and `match.css`: fix the malformed navigation fragment, verify the session/profile at entry, and render real eligible member details responsively without routing completed users through profile setup again.
- `supabase/migrations/<new additive Match migration>.sql`: update the existing search RPC safely, retain existing interaction records, and add authenticated ephemeral presence; do not delete tables or member data.

### Design

Keep the existing IQZodiac Match layout, midnight palette, and responsive card structure. Use the existing pseudonym-first privacy rules and explicit public-photo policy; add only compact interest/personality chips and Online/Offline status. Show a compatibility score only when it is computed from real comparable interests/answers and transparent optional factors; do not use a baseline or fabricated score. No duplicate Match page, repeated setup questionnaire, or sample profiles.


## بطاقات ملفات Your Feed والصداقة وبحث Find Your Orbit

إعادة استخدام موجز Your Feed وصفحة Profile الحالية، مع RPCs آمنة في Supabase بدل قراءة حقول الملفات الخاصة مباشرة. الضغط على اسم/صورة صاحب المنشور أو كاتب التعليق يفتح بطاقة تعرض الاسم المستعار والـhandle والاهتمامات المحفوظة فقط عندما يكون ملف الاكتشاف مكتملاً وقابلاً للاكتشاف؛ لا تُعرض الهوية القانونية أو العمر/الموقع أو الوسائط الخاصة. الإعجاب من البطاقة يُخزّن في سجل مستقل عن `match_likes` حتى لا يُحوّل تفاعل الملف إلى Match أو يشترط أهلية Match.

يمثل جدول `friendships` زوجًا واحدًا مرتبًا ويخزن طلبًا معلّقًا أو علاقة مقبولة/مرفوضة. RPCs تتحقق من هوية الطرف المسجّل وتسمح للمستقبِل وحده بقبول/رفض الطلب. يعرض Profile طلبات واردة وأصدقاء مقبولين؛ حالة Online/Offline متاحة للأصدقاء المقبولين فقط. يبدأ heartbeat عام للمستخدم المصادق عليه عبر الصفحات، وتعتمد Offline على مهلة الـpresence الحالية بدل إنهاء كل تبويب حضور المستخدم عند إغلاقه.

يوسّع بحث Match الحالي لقبول `@username` أو UUID دقيق. يطبّق الخادم هذا الشرط داخل مجموعة المرشحين قبل الترتيب والحد، مع إبقاء شروط الاكتمال/الاكتشاف، استبعاد المستخدم الحالي، مرشحات الخصوصية، الإعجاب والتخطي والتوافق الحالي دون تغيير.

### بنية الملفات
- `home.js`, `home.html`, `styles.css`, `social-profile.js`: فتح البطاقة من مؤلف المنشور/التعليق، عرض الاهتمامات، الإعجاب وطلب/قبول الصداقة.
- `profile.html`, `social-profile.js`, `auth-guard.js`: صندوق طلبات الأصدقاء، قائمة الأصدقاء والحضور العام الآمن.
- `match.html`, `match.js`, `privacy-core.js`, `match.css`: حقل بحث Find Your Orbit وربطه بمرشح الخادم.
- `supabase/migrations/<new additive migrations>.sql`: جدول التفاعلات والصداقة، RLS/RPC، إشعار طلب الصداقة، وتوسيع بحث Match دون حذف البيانات أو تليين شروط الخصوصية.

### تصميم الواجهة
إعادة استخدام أسلوب IQZodiac الليلي والتركوازي، مع بطاقة حوار قصيرة قابلة للإغلاق ولوحة أصدقاء موجزة داخل Community. الأزرار تعرض الحالات الفعلية (Like، طلب مُرسل، طلب وارد، أصدقاء) من قاعدة البيانات، وتبقى جميع القوائم قابلة للاستخدام على الهاتف ولوحة المفاتيح.
