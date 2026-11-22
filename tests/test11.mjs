// اختبار الدفعة ب (0.8.1): التشكيل الآلي بنظام الاقتراح والمراجعة (libtashkeel + onnxruntime-web، يعمل محلياً)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const HAR = /[ً-ْ]/g;
const load = (html) => pg.evaluate(async (h) => { const A = window.WQ_API; await A.loadQuran(); A.loadDocIntoEditor(Object.assign(A.newDocModel('ar'), { footnotes: { f1: { refId: '', page: '', text: 'حاشية' } }, content: { html: h } })); }, html);
const run = (mode, sel) => pg.evaluate(async ([m, s]) => {
  const p = document.querySelector('#page'), r = document.createRange();
  if (s === 'all') r.selectNodeContents(p);
  else if (s && s.word) { const tn = Array.from(p.querySelectorAll('p'))[s.p].firstChild; const i = tn.textContent.indexOf(s.word); r.setStart(tn, i); r.setEnd(tn, i + s.word.length); }
  else { const tn = p.querySelectorAll('p')[s ? s.p : 0].firstChild; r.setStart(tn, 2); r.collapse(true); }
  lastRange = r; await window.WQ_API.tashkeelSelection(m);
  return { html: p.innerHTML, ps: Array.from(p.querySelectorAll('p')).map((x) => x.textContent), toast: document.querySelector('#toast').textContent };
}, [mode, sel]);

// 1) الشريط
await pg.click('.tab:has-text("الرئيسية")');
const opts = await pg.evaluate(() => Array.from(document.querySelectorAll('select[title="التشكيل"] option')).map((o) => o.value));
check('Home ribbon has Diacritics menu (full/ends/remove/accept)', ['full', 'ends', 'remove', 'accept'].every((v) => opts.includes(v)), opts.join(','));

// 2) تشكيل كامل للمستند مع حماية الآيات والحواشي
await load('<p>قال ابن خلدون في مقدمته إن العلم والتعليم طبيعي في العمران البشري<sup class="wq-fn" data-fn="f1" contenteditable="false">*</sup></p>' +
  '<p>قال تعالى ﴿إن الله غفور رحيم﴾ وهذا نص مكتوب</p>' +
  '<p dir="rtl"><span class="wq-ayah" data-s="1" data-a="2" data-b="2" contenteditable="false" dir="rtl" lang="ar">﴿x﴾</span> ذهب الولد إلى المدرسة</p>');
const ayahBefore = await pg.evaluate(() => document.querySelector('.wq-ayah').textContent);
let r = await run('full', 'all');
check('Academic sentence vocalized', r.ps[0].startsWith('قَالَ ابْنُ خَلْدُونَ فِي مُقَدِّمَتِهِ إِنَّ'), r.ps[0].slice(0, 60));
check('Typed Quran between ﴿ ﴾ left untouched', r.ps[1].includes('﴿إن الله غفور رحيم﴾') && r.ps[1].includes('وَهَذَا'), r.ps[1]);
check('Protected verse span untouched', await pg.evaluate((b) => document.querySelector('.wq-ayah').textContent === b, ayahBefore));
check('Footnote marker kept', r.html.includes('class="wq-fn"'));
check('Toast reports words, doubts and Quran skip', /شُكّلت/.test(r.toast) && r.toast.includes('القرآنية'), r.toast);
const q = await pg.evaluate(() => Array.from(document.querySelectorAll('#page .wq-tk-q')).map((s) => [s.textContent, s.dataset.alt]));
check('Uncertain words underlined with an alternative', q.length >= 1 && q.every(([a, b]) => b && b !== a), JSON.stringify(q));
check('Known error العَلم → alternative العِلم offered', q.some(([a, b]) => a.replace(HAR, '') === 'العلم' && b === 'الْعِلْمَ'), JSON.stringify(q));
check('Snapshot taken before diacritics', await pg.evaluate(() => window.WQ_API.WQ.doc.snapshots.some((s) => (s.label || '').includes('قبل التشكيل'))));

// 3) قائمة المراجعة
await pg.click('#page .wq-tk-q >> nth=0');
const menu = await pg.evaluate(() => Array.from(document.querySelectorAll('#tkMenu .tk-w')).map((x) => x.textContent));
check('Review menu: keep / alternative / no diacritics', menu.length === 3 && menu[2] === menu[0].replace(HAR, ''), JSON.stringify(menu));
await pg.click('#tkMenu .tk-opt >> nth=1');
const after = await pg.evaluate(() => ({ n: document.querySelectorAll('#page .wq-tk-q').length, t: document.querySelector('#page p').textContent }));
check('Choosing the alternative replaces the word and removes the mark', after.n === q.length - 1 && after.t.includes(q[0][1]), JSON.stringify(after));
// الحفظ والفتح يحتفظان بالكلمات المعلّمة
const kept = await pg.evaluate(() => { const A = window.WQ_API; return A.sanitizeHtml(A.parseDoc(A.serializeDoc()).content.html, true); });
check('Marks survive save/open (trusted)', (kept.match(/class="wq-tk-q"/g) || []).length === q.length - 1 && kept.includes('data-alt='));
check('Marks dropped from untrusted paste', !(await pg.evaluate((h) => window.WQ_API.sanitizeHtml(h), kept)).includes('wq-tk-q'));
// عرض الصفحات وWord بدون خطوط
await pg.evaluate(() => window.WQ_API.setPagesView(true)); await pg.waitForTimeout(300);
check('No underline in pages view / PDF', await pg.evaluate(() => { const s = document.querySelector('.pv-page .wq-tk-q'); return !s || getComputedStyle(s).borderBottomStyle === 'none'; }));
await pg.evaluate(() => window.WQ_API.setPagesView(false));
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => exportDocx())]);
await dl.saveAs('/tmp/t11.docx');
const xml = execFileSync('unzip', ['-p', '/tmp/t11.docx', 'word/document.xml']).toString();
check('Word export carries the vocalized text', xml.includes('قَالَ') && xml.includes('خَلْدُونَ'));
// اعتماد الكل
r = await run('accept', { p: 0 });
check('Accept (cursor only) clears all marks in the document', !r.html.includes('wq-tk-q'), r.toast);

// 4) احترام حركات المستخدم (تلميحات)
await load('<p>مَن كتبَ الرسالةَ؟</p>');
r = await run('full', { p: 0 });
check('User diacritics kept as hints', r.ps[0].startsWith('مَنْ') && r.ps[0].includes('بَ') && r.ps[0].includes('الرِّسَالَةَ'), r.ps[0]);

// 5) التحديد فقط
await load('<p>ذهب الولد إلى المدرسة صباحا</p>');
r = await run('full', { p: 0, word: 'المدرسة' });
check('Only the selected word is vocalized', r.ps[0].startsWith('ذهب الولد إلى ') && /الْمَدْرَسَةِ|المَدْرَسَةِ/.test(r.ps[0]) && r.ps[0].endsWith(' صباحا'), r.ps[0]);

// 6) أواخر الكلمات فقط
await load('<p>ذهب الولد إلى المدرسة</p>');
r = await run('ends', { p: 0 });
const ws = r.ps[0].split(' ');
check('Word endings only: inner letters bare, last letter marked', ws.length === 4 && ws.every((w) => !HAR.test(w.slice(0, -2).replace(/[ً-ْ]$/, ''))) && /[ً-ْ]$/.test(ws[1]), r.ps[0]);

// 7) إزالة التشكيل
await load('<p>قَالَ ابْنُ خَلْدُونَ</p>');
r = await run('remove', { p: 0 });
check('Remove diacritics', r.ps[0] === 'قال ابن خلدون', r.ps[0]);

// 8) عن ورّاق: ذكر المحرك ورخصته
await pg.click('.tab:has-text("ملف")'); await pg.click('.rb:has-text("عن ورّاق")'); await pg.waitForTimeout(200);
check('About credits libtashkeel + onnxruntime-web (MIT)', await pg.evaluate(() => { const x = document.querySelector('.modal').textContent; return x.includes('libtashkeel') && x.includes('onnxruntime-web'); }));

check('No JavaScript errors', errs.length === 0, errs.join(' | '));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
