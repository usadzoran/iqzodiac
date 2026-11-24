

## Clad Body API integration
- [x] Inspect the existing private 3D Body capture flow, viewer, storage bucket, tables, policies, and delete function before changing it.
- [x] Preserve the existing six private photo views and use the front view as the provider input because the official Clad photo endpoint accepts one photo plus a height in centimetres.
- [x] Add an authenticated server-only `body-model-reconstruct` Edge Function that reads `CLAD_API_KEY` from Supabase Edge Function environment variables, submits the photo to Clad, polls the returned job, validates the returned GLB, stores it privately, and persists returned measurements.
- [x] Add additive model metadata for provider state, job/reference identifiers, params, measurements, height, and safe processing error codes; do not delete or recreate existing tables or files.
- [x] Add height input, explicit Uploading/Processing/Completed/Failed states, and real measurement rendering to the existing Profile 3D Body card.
- [x] Render the six capture previews as compact, responsive cards on desktop and mobile; keep saved private photos as small thumbnails rather than full-size images.
- [x] Resize prepared views to a maximum 2000-pixel edge and compress each JPEG to at most 3 MiB before upload; enforce the same cap at the client upload boundary.
- [x] Verify the live `iqzodiac-body-private` bucket is private, accepts JPEG/GLB, has a 50 MiB per-object limit, and currently contains 0 objects; verify owner-scoped RLS and that `body-model-reconstruct` is deployed with JWT verification.
- [ ] Verify that `CLAD_API_KEY` is configured as a Supabase Edge Function Secret (set it through a secure secret-entry path if missing), then perform an authenticated reconstruction only when authorized; do not use user/test photos for a production smoke test.

## Discover Vault
- [x] Add an additive private Vault card inside the existing Discover page for images, videos, and audio recordings.
- [x] Store Vault metadata in an owner-only RLS table and files in a non-public Supabase Storage bucket scoped to the authenticated user.
- [x] Require WebAuthn platform user verification before revealing Vault media; supported devices may use Face ID, fingerprint, device PIN, or device pattern through the operating system.
- [x] Provide private upload, signed-url playback, lock, and delete controls without changing existing Discover destinations.
- [ ] Run an authenticated device test on iOS/Android to verify Face ID/device-lock prompts, upload/playback, cross-account denial, and deletion.

## Site Ads Manager
- [x] Create a separate private Ads Manager page, outside the member UI and separate from the general Admin Control Center UI.
- [x] Allow the advertising administrator to create, edit, preview, publish, draft, and delete HTML advertisements.
- [x] Preserve legacy multi-target campaigns and allow new campaigns to choose one page (or all supported pages) and one compatible placement per campaign; keep height and priority controls available as optional advanced settings.
- [x] Store ad records under RLS and restrict write access to the existing server-side admin identity.
- [x] Render published ads through sandboxed iframes so supplied HTML cannot access the IQZodiac page DOM or session.
- [x] Add protected per-ad analytics for unique daily views, clicks, and click-through rate, with event recording isolated from the ad iframe.
- [x] Keep the private Ads Studio in English and offer clear dependent Page and Placement dropdowns, defaulting to all supported content/member pages and Header; save targeting to the existing `site_ads.sections`, `site_ads.placements`, and `site_ads.placement` fields and confirm success only after a persisted row is returned.
- [x] Confirm save success only after Supabase returns the persisted ad row; preserve form contents and show an actionable error if insert/update fails or no row is returned.
- [x] Ensure published active ads are readable by anonymous visitors and render on all supported content/member pages at the selected header, main-content, or footer placement; retain Home post-feed and Reels between-video placements, refresh already-open pages, and keep drafts and out-of-window ads hidden.
- [ ] With explicit user approval, verify a real ad using the user's content; do not create or publish test data in production.


## صفحات الموقع ومحررو المحتوى
- [x] من لوحة تحكم المسؤول، يمكن تعيين محرري محتوى لمستخدمين مسجلين عبر البريد المؤكد وإيقاف/إعادة تفعيل صلاحيتهم؛ هذا الدور مستقل عن مشرفي الغرف الصوتية والبث المباشر، ولا يمنح مسؤولية كاملة.
- [x] يتيح محررو المحتوى مساحة خاصة لإضافة وتعديل الصفحات/الأقسام العامة ثنائية اللغة (العنوان والمحتوى والرابط والترتيب)، ونشرها أو إخفاءها؛ يرى الزوار المنشور فقط ويمكنهم الوصول إليه من دليل صفحات ظاهر في الموقع.
- [x] يتيح محررو المحتوى إدارة تصنيفات Marketplace للمنتجات والخدمات (إنشاء وتعديل الأسماء والترتيب والإظهار/الإخفاء)، دون حذف سجلات التصنيفات أو امتلاك صلاحيات الأعضاء والمالية وميزات VIP أو إدارة المسؤولين.
- [x] تفرض RLS والدوال الخادمية نطاق الصلاحيات؛ يُعرض محتوى الصفحات كنص آمن لا HTML غير موثوق، وتبقى أدوار مشرفي الغرف وVIP دون تغيير.
- [x] تبقى واجهة إضافة التصنيفات من نوع Product/Service متاحة لمسؤولي الموقع، وتعمل إدارتها من لوحة محتوى المحررين دون التأثير في الإعلانات المرتبطة بها.

## صلاحيات إدارة هيكل الموقع للمسؤول
- [x] يستطيع المسؤول مشاهدة صفحات الموقع العامة المنشورة والمسودات، إضافة صفحة وتعديلها ونشرها أو إخفاءها، وحذفها مع تأكيد؛ يظل حذف الصفحات محصورًا بمسؤول الموقع وليس محرر المحتوى.
- [x] يستطيع المسؤول إنشاء قوائم تذييل متعددة، وإضافة/تعديل/حذف عناصرها وإعادة تسمية القوائم وترتيبها وإظهارها/إخفاؤها؛ تظهر القوائم المفعلة وروابطها في تذييلات صفحات الموقع.
- [x] تفرض RLS صلاحيات المسؤول على عمليات القوائم والحذف، ويظل الزوار قادرين على قراءة القوائم والعناصر المنشورة فقط.

## أقسام الموقع وأنواع القوائم
- [x] يختار المسؤول نوع المحتوى (صفحة مستقلة أو قسم) وموقع ظهور القسم (الرئيسية، Discover، Marketplace، الملف الشخصي، أو دليل الصفحات) مع عنوان EN/AR ومحتوى وترتيب وحالة نشر.
- [x] تظهر الأقسام المنشورة كنص آمن في موقع العرض المحدد، وتبقى الصفحات المستقلة في دليل الصفحات العامة.
- [x] يختار المسؤول نوع القائمة ومكانها (Footer، Header، Dropdown، User menu، Side menu)، ويدير اسم القائمة وروابطها وأسماء الروابط وترتيبها وإظهارها/إخفاءها وحذفها.

## Long-form Videos
- [x] Verify the existing production `videos` and `video_categories` schemas, public-read/published and owner-upload policies, and the private `iqzodiac-video-library` bucket before connecting the frontend; do not create test video or category rows in production.
- [x] Add a separate Videos section where signed-in users can preview and publish MP4/WebM videos up to 50 MiB, with no six-minute Reels duration cap, and all site visitors can watch published videos.
- [x] Add user-entered title, description, optional admin-created category, and explicit rights confirmation to video publishing; respect the existing database and storage policy constraints.
- [x] Add a protected Videos tab to the Admin Control Center that lets the administrator create bilingual video categories and show/hide them for upload and feed filters.
- [x] Add a Videos destination to the site navigation and translate its label in English and Arabic; keep the new section separate from Reels.
- [x] Validate scripts, forms, RLS-compatible payload fields and limits, category filtering, local preview, and player code paths through local checks and read-only review; do not write production test data.
