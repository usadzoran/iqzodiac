# تشغيل مساعد IQZodiac الذكي

المساعد الجديد يعمل عبر endpoint خادمي وليس من المتصفح مباشرة. هذا يمنع كشف مفاتيح OpenAI وYouTube وTMDB ويضع الصلاحيات في الخادم.

## المتغيرات المطلوبة في الخادم

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_publishable_or_anon_key
OPENAI_API_KEY=your_server_only_key
YOUTUBE_API_KEY=your_server_only_key
TMDB_API_KEY=your_server_only_key
ASSISTANT_ALLOWED_ORIGINS=https://usadzoran.github.io
ASSISTANT_RATE_LIMIT_PER_MINUTE=20
IQZODIAC_ASSISTANT_MODEL=gpt-6-luna
```

`TMDB_API_KEY` اختياري. بدونه يستطيع المساعد شرح الموقع والبحث في YouTube إذا كان `YOUTUBE_API_KEY` موجودًا، لكنه سيبلغ المستخدم بأن بحث الأفلام والشخصيات غير مهيأ.

## النشر

يحتوي المشروع على `api/assistant/chat.js` المتوافق مع Vercel. بعد نشر المشروع، ضع عنوان endpoint العام في `assistant-config.js`:

```js
window.IQZodiacAssistantConfig = Object.freeze({
  apiBase: 'https://your-project.vercel.app/api/assistant/chat',
});
```

لا تضع أي مفتاح API في `assistant-config.js` أو أي ملف frontend.

## الصلاحيات المسموحة

- شرح صفحات IQZodiac من خريطة الموقع المضمّنة في الخادم.
- البحث في YouTube وإرجاع روابط الفيديو فقط.
- البحث في TMDB عن الأفلام والمسلسلات والممثلين والشخصيات عند تفعيل المفتاح.
- الإجابة باللغة العربية أو الإنجليزية.

## الصلاحيات الممنوعة

المساعد لا يملك صلاحية تعديل الحساب، منح VIP، تغيير الرصيد أو المدفوعات، إرسال رسائل، كشف الصور الخاصة، قراءة ملفات مستخدمين آخرين، أو تنفيذ عمليات إدارية. التحقق من جلسة Supabase يتم قبل كل طلب، مع تحديد معدل الطلبات والتحقق من مصدر الموقع.

## ملاحظات الإنتاج

يجب تطبيق migration `20261103100000_discovery_reset_policy.sql` على Supabase حتى يعمل زر Start over بحذف إجابات الاكتشاف القديمة. لا يتم تشغيل ميزات الدفع أو VIP عبر المساعد؛ تلك العمليات يجب أن تبقى في endpoints منفصلة ومحمية.
