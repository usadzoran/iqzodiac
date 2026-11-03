# تشغيل مساعد IQZodiac الذكي عبر Supabase

المساعد الآن يعمل من خلال Edge Function المنشورة في مشروع Supabase Zodiaque:

```text
https://mludiumdvwdvuetivxvj.supabase.co/functions/v1/assistant-chat
```

الوظيفة تتطلب JWT صالحًا (`verify_jwt=true`) وتتحقق من المستخدم قبل البحث أو حفظ سجل المحادثة.

## متغيرات Edge Function السرية

أضف هذه القيم في Supabase Dashboard → Edge Functions → Secrets، أو عبر Supabase CLI:

```text
OPENAI_API_KEY=your_server_only_key
YOUTUBE_API_KEY=your_server_only_key
TMDB_API_KEY=your_server_only_key
IQZODIAC_ASSISTANT_MODEL=gpt-6-luna
ASSISTANT_ALLOWED_ORIGIN=https://usadzoran.github.io
```

`TMDB_API_KEY` و`YOUTUBE_API_KEY` اختياريان، لكن البحث عن الأفلام أو الفيديوهات لن يعمل فعليًا بدونهما. لا تضع أي مفتاح داخل ملفات frontend أو GitHub.

## سجل المحادثات وRLS

تم إنشاء جدول `public.assistant_conversation_logs` مع:

- `user_id` مرتبط بـ `auth.users`.
- `conversation_id` لربط رسائل المحادثة الواحدة.
- `role` محصور في `user` أو `assistant`.
- `intent` محصور في `site_help` أو `youtube_search` أو `media_search`.
- `results` كمصفوفة JSON للنتائج التي أرجعها الخادم.
- فهارس حسب المستخدم والمحادثة والتاريخ.

سياسات RLS تسمح للمستخدم بقراءة وإضافة وحذف سجله فقط. لا توجد صلاحية `anon`، ولا توجد صلاحية تحديث عامة للصفوف.

## إعداد الواجهة

تم تحديث `assistant-config.js` ليستخدم رابط Supabase مباشرة. ترسل الواجهة access token الحالي في ترويسة `Authorization`، وترسل `conversationId` للحفاظ على سجل المحادثة نفسه.

## الوظائف الممنوعة

المساعد لا يملك صلاحية تعديل الحساب، منح VIP، تغيير الرصيد أو المدفوعات، إرسال رسائل، كشف الصور الخاصة، قراءة ملفات مستخدمين آخرين، أو تنفيذ عمليات إدارية. البحث والرد منفصلان عن جداول المستخدمين الخاصة.

## التحقق

تم نشر الوظيفة بحالة `ACTIVE` مع `verify_jwt=true`. كما تم تشغيل فحص JavaScript المحلي بعد تحديث إعدادات الاتصال. يجب بعد إضافة الأسرار اختبار سؤال عن الموقع، بحث YouTube، وبحث فيلم بحساب مستخدم مسجل الدخول.
