// اختبار آلي لورّاق 3أ: يشغّل الصفحة في كروم ويفحص السلوك الأساسي
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const file = 'file://' + path.resolve(process.argv[2] || 'dist/index.html');
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
await pg.goto(file);
await pg.waitForSelector('#page');
await pg.evaluate(() => localStorage.clear());
await pg.reload(); await pg.waitForTimeout(300);
if (await pg.isVisible('#startOv')) await pg.click('#startClose');

// 1) الواجهة عربية من اليمين لليسار
check('UI is Arabic RTL', await pg.evaluate(() => document.documentElement.dir === 'rtl' && document.querySelector('.tab.on').textContent.includes('الرئيسية')));

// 2) كتابة عربية + أرقام عربية تلقائية
await pg.click('#page');
await pg.keyboard.type('الفصل الأول سنة 2024');
let txt = await pg.evaluate(() => document.querySelector('#page').innerText);
check('Arabic numerals auto-convert in Arabic paragraph', txt.includes('٢٠٢٤'), txt.trim());

// 3) فقرة إنجليزية: اتجاهها يسار والأرقام تبقى غربية؟ (الوضع العربي يحوّل فقط في الفقرات العربية)
await pg.keyboard.press('Enter');
await pg.keyboard.type('Self-directed learning since 1975');
const p2 = await pg.evaluate(() => { const ps = document.querySelectorAll('#page p'); const p = ps[ps.length - 1]; return { dir: p.matches(':dir(ltr)'), text: p.textContent }; });
check('English paragraph is LTR automatically', p2.dir, JSON.stringify(p2));
check('Western digits kept in English paragraph', p2.text.includes('1975'));

// 4) عنوان ١ يظهر في خريطة الرسالة
await pg.keyboard.press('Enter');
await pg.keyboard.type('مقدمة البحث');
await pg.click('button[data-block="H1"]');
await pg.waitForTimeout(400);
const nav = await pg.evaluate(() => Array.from(document.querySelectorAll('#navList .nav-item')).map((b) => b.textContent));
check('Heading appears in document map', nav.includes('مقدمة البحث'), JSON.stringify(nav));

// 5) عدّاد الكلمات
const st = await pg.textContent('#stWords');
check('Word counter shows words', /كلمة/.test(st) && !/^٠ /.test(st), st);

// 6) تبديل الأرقام إلى 123 يحوّل المستند كله
await pg.click('button:has-text("123")');
txt = await pg.evaluate(() => document.querySelector('#page').innerText);
check('Switch to western numerals converts document', txt.includes('2024') && !txt.includes('٢٠٢٤'));
await pg.click('button[title*="١٢٣"]');
txt = await pg.evaluate(() => document.querySelector('#page').innerText);
check('Switch back to Arabic numerals', txt.includes('٢٠٢٤') && txt.includes('1975'), 'English paragraph stays 1975');

// 7) الفرنسي: علامات التنصيص والمسافة قبل : ! ?
await pg.evaluate(() => { window.WQ_API.loadDocIntoEditor(window.WQ_API.newDocModel('fr')); });
await pg.click('#page');
await pg.keyboard.type('Il a dit "bonjour" : merci!');
txt = await pg.evaluate(() => document.querySelector('#page').innerText);
const ok7 = txt.includes('« bonjour »') && txt.includes(' :') && txt.includes('merci !');
check('French typography (« » and thin space before : !)', ok7, JSON.stringify(txt.trim()));
check('French document is LTR', await pg.evaluate(() => document.querySelector('#page').dir === 'ltr'));

// 8) جدول
await pg.evaluate(() => window.WQ_API.insertTable(2, 3, true));
check('Table insert 2x3 with header', await pg.evaluate(() => { const tb = document.querySelector('#page table'); return tb && tb.querySelectorAll('th').length === 3 && tb.querySelectorAll('td').length === 3; }));

// 9) لصق من Word: تنظيف
const clean = await pg.evaluate(() => window.WQ_API.sanitizeHtml('<p class="MsoNormal" style="color:red"><span style="mso-x:1">نص <b>عريض</b></span></p><script>alert(1)</script><img src="http://x/y.png"><img src="data:image/png;base64,AA">'));
check('Paste sanitizer strips junk, scripts and remote images', !/Mso|style|script|http:/.test(clean) && clean.includes('<b>عريض</b>') && clean.includes('data:image/png'), clean);

// 10) حفظ ملف .warraq (تنزيل) وفتحه مرة أخرى
await pg.evaluate(() => { window.WQ_API.loadDocIntoEditor(window.WQ_API.newDocModel('ar')); });
await pg.fill('#docTitle', 'رسالة تجريبية');
await pg.click('#page');
await pg.keyboard.type('نص للحفظ 15');
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
let fname = dl.suggestedFilename();
// headless Chrome يخفي الأسماء غير اللاتينية؛ نتأكد من الامتداد بعنوان لاتيني أيضاً
await pg.fill('#docTitle', 'Thesis Draft');
const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
fname = dl2.suggestedFilename();
const tmp = '/tmp/' + Date.now() + '.warraq';
await dl.saveAs(tmp);
const saved = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
check('Saves as .warraq file', fname === 'Thesis Draft.warraq', fname);
check('File format header correct', saved.format === 'warraq' && saved.formatVersion === 1 && saved.meta.title === 'رسالة تجريبية');
check('Saved state shown', (await pg.textContent('#saveState')) === 'محفوظ');

await pg.evaluate(() => { window.WQ_API.loadDocIntoEditor(window.WQ_API.newDocModel('ar')); });
await pg.setInputFiles('#fileOpen', tmp);
await pg.waitForTimeout(400);
txt = await pg.evaluate(() => document.querySelector('#page').innerText);
check('Open .warraq restores content', txt.includes('نص للحفظ ١٥') && (await pg.inputValue('#docTitle')) === 'رسالة تجريبية', txt.trim());

// 11) ملف غير صالح يُرفض
fs.writeFileSync('/tmp/bad.warraq', '{"hello":1}');
await pg.setInputFiles('#fileOpen', '/tmp/bad.warraq');
await pg.waitForTimeout(300);
check('Invalid file rejected with message', (await pg.textContent('#toast')).includes('مش ملف ورّاق'));

// 12) الحفظ التلقائي يبقى بعد إعادة التحميل
await pg.click('#page');
await pg.keyboard.press('End');
await pg.keyboard.type(' إضافة بعد الحفظ');
await pg.waitForTimeout(1600);
await pg.reload(); await pg.waitForTimeout(500);
txt = await pg.evaluate(() => document.querySelector('#page').innerText);
check('Autosave survives reload', txt.includes('إضافة بعد الحفظ'), txt.trim());

// 13) تبديل لغة الواجهة
await pg.click('#btnUiLang');
const en = await pg.evaluate(() => ({ dir: document.documentElement.dir, tab: document.querySelector('.tab.on').textContent, pageDir: document.querySelector('#page').dir }));
check('UI switches to English LTR, document stays RTL', en.dir === 'ltr' && en.tab === 'Home' && en.pageDir === 'rtl', JSON.stringify(en));
await pg.click('#btnUiLang');

// 14) لقطة شاشة للمراجعة
await pg.evaluate(() => {
  window.WQ_API.loadDocIntoEditor(Object.assign(window.WQ_API.newDocModel('ar'), { content: { html:
    '<h1>الفصل الأول: الإطار النظري</h1><h2>المبحث الأول: مفهوم التعلّم الذاتي</h2><p>يُعدّ مفهوم التعلّم الذاتي (Self-directed Learning) من أبرز المفاهيم التربوية الحديثة، وقد ظهر في الأدبيات منذ عام ١٩٧٥.</p><blockquote>المتعلّم البالغ يتحمّل مسؤولية تعلّمه.</blockquote><p>Knowles defined it as a process in which individuals take the initiative (1975).</p><h2>المبحث الثاني: الدراسات السابقة</h2><table><tbody><tr><th>الدراسة</th><th>السنة</th><th>النتيجة</th></tr><tr><td>الشمري</td><td>٢٠٢١</td><td>أثر إيجابي</td></tr><tr><td>Garrison</td><td>1997</td><td>Positive</td></tr></tbody></table>' } }));
});
await pg.waitForTimeout(300);
await pg.screenshot({ path: 'tests/screenshot.png' });

check('No JavaScript errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
