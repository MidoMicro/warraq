# بناء ورّاق لويندوز

## ✅ الطريقة الرسمية (من 0.7.0): البناء الآلي على GitHub
مش محتاج تبني على جهازك خالص. من صفحة المستودع: **Releases ← Draft a new release**، واعمل علامة جديدة (Tag) زي `v0.7.1`، وبعدين **Publish**.
GitHub Actions بيبني ملف التثبيت في حوالي ١٠ دقايق، وبيرفقه بالإصدار ومعاه ملفات التحديث التلقائي (`latest.yml` و`.blockmap`)، والبرامج المثبّتة بتتحدث لوحدها.
⚠️ **قبل أي إصدار:** رقم الإصدار لازم يكون واحد في 3 أماكن: العلامة `vX.Y.Z`، و`desktop/package.json`، و`APP_VERSION` في `src/core.js`. ولو مختلفين، البناء بيوقف برسالة واضحة.
ولو عايز نسخة تجريبية من غير إصدار: **Actions ← بناء ملف التثبيت ← Run workflow**، وهتلاقي الملف في صفحة التشغيل تحت Artifacts.

---
## الطريقة اليدوية القديمة (للطوارئ فقط)
# بناء برنامج ورّاق على ويندوز

## الطريقة السريعة (لو عايز تبنيه بنفسك على ويندوز)
1. ثبّت Node.js (نسخة LTS) من الموقع الرسمي nodejs.org.
2. افتح فولدر `desktop` في نافذة الأوامر (PowerShell).
3. نفّذ الأوامر دي بالترتيب:

```
npm install
node prepare.js
npm run dist:win
```

4. ملف التثبيت هيطلع في فولدر `desktop\release` باسم `Warraq-Setup-<الإصدار>.exe`.

## لو تحميل Electron بطيء (تجربة 2026-11-18 على جهاز المالك)
السيرفر الصيني (npmmirror) كان بطيئاً جداً، وGitHub كان الأسرع. الطريقة اللي نجحت:

```
curl.exe -L -C - --retry 30 --retry-delay 5 --retry-all-errors -o "$env:USERPROFILE\Downloads\electron.zip" https://github.com/electron/electron/releases/download/v33.2.1/electron-v33.2.1-win32-x64.zip
$env:ELECTRON_SKIP_BINARY_DOWNLOAD="1"
npm install
Expand-Archive "$env:USERPROFILE\Downloads\electron.zip" -DestinationPath .\node_modules\electron\dist -Force
Set-Content -Path .\node_modules\electron\path.txt -Value "electron.exe" -NoNewline
node prepare.js
npx electron-builder --win --x64 "--config.electronDist=node_modules/electron/dist"
```

- ابنِ في فولدر بسيط مثل `C:\wq` وليس داخل المستندات (المزامنة مع OneDrive تسبب أخطاء EPERM).
- في PowerShell لازم الخيار `--config.electronDist=...` يكون بين علامتي تنصيص.

## ملاحظات
- `prepare.js` بينسخ واجهة ورّاق من فولدر `dist`، وبيحمّل الخطوط العربية (رخصة OFL المجانية) عشان البرنامج يشتغل من غير إنترنت.
- البرنامج غير موقّع رقمياً (نسخة تجريبية)، فويندوز هيطلّع تحذير أزرق أول مرة: اضغط "مزيد من المعلومات" ثم "تشغيل على أي حال".
