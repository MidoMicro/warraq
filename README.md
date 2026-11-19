<div dir="rtl">

# ورّاق – Warraq

**محرّر نصوص عربي للباحثين والطلبة.** اكتب رسالتك، ودع التوثيق لورّاق.

🌐 **الموقع والتحميل:** [getwarraq.org](https://getwarraq.org) · 🖥️ **من المتصفح:** [getwarraq.org/app](https://getwarraq.org/app/) · 🐞 **[الإبلاغ عن مشكلة أو اقتراح](https://github.com/MidoMicro/warraq/issues/new/choose)**

## أبرز المزايا
- الحواشي السفلية، و«المرجع نفسه» و«مرجع سابق» تلقائياً، وأنماط APA وVancouver والحواشي العربية.
- إدراج الآيات القرآنية بالرسم العثماني من مشروع تنزيل، محميةً من التعديل.
- العربية والإنجليزية في الصفحة نفسها باتجاه صحيح، والفرنسية قريباً جداً.
- استيراد Word ‏(‎.docx‎ و‎.doc‎ القديم) بالجداول المدمجة، والتصدير إلى Word وPDF وصور PNG.
- تحويل الرسالة إلى عرض مناقشة PowerPoint بضغطة واحدة.
- عرض الصفحات الحقيقي، وفهرس المحتويات، وقائمة المراجع، وتسطير الصفحة، وإطار الصفحة.
- مستنداتك تبقى على جهازك. اقرأ [سياسة الخصوصية](https://getwarraq.org/privacy.html).

## بناء ورّاق من المصدر
```bash
python3 build_quran.py   # data/ ← dist/quran.json (مع فحص حرفي لنص القرآن)
python3 build.py         # src/ ← dist/index.html (نسخة المتصفح)
cd desktop && npm install && node prepare.js && npx electron-builder --win --x64 --publish never
```
البناء الرسمي يتم آلياً على GitHub Actions:
- `pages.yml` ينشر الموقع (`site/`) ونسخة المتصفح (`app/`) على getwarraq.org عند أي تعديل.
- `release.yml` يبني ملف التثبيت لويندوز عند إنشاء إصدار بعلامة مثل `v0.7.0`، ويرفقه بالإصدار مع ملفات التحديث التلقائي.

## سياسة توقيع الكود (Code signing policy)
توقيع الكود مجاني، تقدّمه [SignPath.io](https://signpath.io)، والشهادة صادرة عن [SignPath Foundation](https://signpath.org).
التفاصيل وأدوار الفريق (المؤلفون والمراجعون والمعتمدون: [MidoMicro](https://github.com/MidoMicro)) في [صفحة سياسة توقيع الكود](https://getwarraq.org/code-signing.html).
الخصوصية: لا ينقل البرنامج أي معلومات إلى أنظمة أخرى على الشبكة إلا بطلب المستخدم، والاتصال التلقائي الوحيد هو التحقق من التحديثات. اقرأ [سياسة الخصوصية](https://getwarraq.org/privacy.html).

## الترخيص
ورّاق برنامج حرّ مفتوح المصدر بترخيص **GPL-3.0** (انظر ملف `LICENSE`).

## شكر وتقدير
- نص القرآن الكريم من [مشروع تنزيل](https://tanzil.net) (Tanzil Quran Text، Uthmani 1.1) كما هو حرفياً، وبترخيصه.
- الخطوط العربية (أميري، ونوتو نسخ، وكايرو، وتجوّال) بترخيص SIL OFL المجاني.
- [PptxGenJS](https://github.com/gitbrent/PptxGenJS) لعروض PowerPoint (ترخيص MIT)، و[Electron](https://www.electronjs.org) لبرنامج الكمبيوتر (ترخيص MIT).

صناعة عربية مصرية 🇪🇬

</div>

---

**Warraq** is an Arabic-first document editor for researchers and students: automatic footnotes and Ibid., APA/Vancouver, Quran verses from Tanzil, Word import/export, PDF, and one-click defense slides. Free and open source under GPL-3.0. Download at [getwarraq.org](https://getwarraq.org).

**Code signing policy:** Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org). Details: [getwarraq.org/code-signing.html](https://getwarraq.org/code-signing.html).
