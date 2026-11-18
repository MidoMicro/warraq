// اختبار الدفعة 3ج: الآيات، واللقطات، وشاشة البداية والقوالب، والاستيراد من Word
// يتطلب خادماً محلياً على dist/ (لأن الآيات تُحمَّل من quran.json)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const url = process.argv[2] || 'http://localhost:8765/index.html';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 950 } });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load/.test(m.text())) errors.push(m.text()); });
await pg.goto(url); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);

// 1) شاشة البداية تظهر أول مرة
check('Start screen shows on first run', await pg.isVisible('#startOv'));
await pg.screenshot({ path: 'tests/screenshot3c-start.png' });

// 2) قالب رسالة ماجستير
await pg.click('.tpl-card[data-tpl="master"]');
await pg.waitForTimeout(400);
const tpl = await pg.evaluate(() => ({
  start: !!document.querySelector('#startOv'),
  h1: Array.from(document.querySelectorAll('#page h1')).map((h) => h.textContent),
  toc: document.querySelectorAll('.wq-toc .toc-row').length, bib: !!document.querySelector('.wq-bib'),
  title: document.querySelector('#docTitle').value, breaks: document.querySelectorAll('#page hr.wq-pagebreak').length }));
const fits = await pg.evaluate(() => { const sh = document.querySelector('#sheet').getBoundingClientRect(), pg = document.querySelector('#page').getBoundingClientRect(); return sh.bottom >= pg.bottom - 1; });
check('White sheet grows with long content (no overflow)', fits);
check('Master template: chapters, TOC, bibliography, page breaks', !tpl.start && tpl.h1.includes('الفصل الأول: الإطار العام للدراسة') && tpl.h1.includes('الفصل الخامس: الخلاصة والتوصيات') && tpl.toc > 10 && tpl.bib && tpl.breaks > 8, JSON.stringify({ h1: tpl.h1.length, toc: tpl.toc, breaks: tpl.breaks, title: tpl.title }));

// 3) إدراج آية: البحث بكلمة بدون تشكيل يجد الآية
await pg.evaluate(() => window.WQ_API.loadQuran());
const hits = await pg.evaluate(() => window.WQ_API.searchQuran('زدني علما'));
check('Search without diacritics finds Taha 114', hits.some(([s, a]) => s === 20 && a === 114), JSON.stringify(hits));
const verbatim = await pg.evaluate(async () => { const r = await fetch('quran.json'); const q = await r.json(); return q.text[19][113]; });
const srcLine = fs.readFileSync('data/quran-uthmani.txt', 'utf-8').split('\n').find((l) => l.startsWith('20|114|')).split('|')[2];
check('Verse text identical to Tanzil source', verbatim === srcLine);

// 4) الإدراج من النافذة (التخريج في النص)
await pg.click('.tab:has-text("الرسالة")');
await pg.evaluate(() => { const p = document.querySelector('#page h2 + p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
await pg.click('.rb:has-text("إدراج آية")');
await pg.waitForSelector('#qSearch');
await pg.fill('#qSearch', 'زدني علما');
await pg.waitForSelector('.q-hit');
await pg.click('.q-hit >> nth=0');
const prev = await pg.textContent('#qPrev');
check('Dialog preview shows verse + [طه: ١١٤]', prev.includes('[طه: ١١٤]') && prev.includes('﴿'), prev);
await pg.click('.modal .btn:has-text("إدراج")');
await pg.waitForTimeout(300);
const ins = await pg.evaluate(() => { const a = document.querySelector('#page .wq-ayah'); return a ? { t: a.textContent, ce: a.getAttribute('contenteditable'), ref: a.parentNode.textContent } : null; });
check('Verse inserted, protected (not editable), with reference', ins && ins.ce === 'false' && ins.t === '﴿' + srcLine + '﴾' && ins.ref.includes('[طه: ١١٤]'), JSON.stringify(ins));

// 5) نطاق آيات في الحاشية
await pg.evaluate(() => window.WQ_API.insertAyah(2, 255, 256, { where: 'note', block: false }));
await pg.waitForTimeout(200);
const fn = await pg.evaluate(() => Array.from(document.querySelectorAll('#fnZone .fn-item')).map((x) => x.textContent).pop());
check('Verse range with footnote reference', fn && fn.includes('سورة البقرة، الآيات ٢٥٥-٢٥٦'), fn);

// 6) نص آية متلاعب به في ملف يُصحَّح من المصدر عند الفتح
await pg.fill('#docTitle', 'Q');
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
const tmp = '/tmp/q.warraq'; await dl.saveAs(tmp);
const j = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
check('Snapshots stored in file', Array.isArray(j.snapshots) && j.snapshots.length >= 1, String(j.snapshots.length));
j.content.html = j.content.html.replace('عِلْمًا', 'مالًا');
fs.writeFileSync('/tmp/q-tampered.warraq', JSON.stringify(j));
await pg.setInputFiles('#fileOpen', '/tmp/q-tampered.warraq'); await pg.waitForTimeout(800);
const fixed = await pg.evaluate(() => document.querySelector('#page .wq-ayah').textContent);
check('Tampered verse restored from source on open', fixed === '﴿' + srcLine + '﴾');

// 7) اللقطات: خذ لقطة، غيّر، استرجع
await pg.evaluate(() => window.WQ_API.takeSnapshot('قبل الحذف'));
const snapId = await pg.evaluate(() => window.WQ_API.WQ.doc.snapshots.slice(-1)[0].id);
await pg.evaluate(() => { document.querySelector('#page').innerHTML = '<p dir="auto">نص جديد فقط</p>'; window.WQ_API.refreshDerived(); });
await pg.evaluate((id) => window.WQ_API.restoreSnapshot(id), snapId);
await pg.waitForTimeout(300);
const back = await pg.evaluate(() => ({ h1: document.querySelectorAll('#page h1').length, snaps: window.WQ_API.WQ.doc.snapshots.map((s) => s.label) }));
check('Restore snapshot brings content back and keeps pre-restore copy', back.h1 > 5 && back.snaps.includes('قبل الاسترجاع'), JSON.stringify(back.snaps));
await pg.click('.tab:has-text("ملف")');
await pg.click('.rb:has-text("اللقطات")');
const rows = await pg.locator('.snap-row').count();
check('Snapshots dialog lists snapshots', rows >= 3, String(rows));
await pg.click('.modal header button');

// 8) الاستيراد من Word
await pg.setInputFiles('#fileDocx', 'tests/fixtures/sample.docx');
await pg.waitForTimeout(800);
const imp = await pg.evaluate(() => ({
  h1: document.querySelector('#page h1')?.textContent, h2: document.querySelector('#page h2')?.textContent,
  bold: document.querySelector('#page b')?.textContent, ital: document.querySelector('#page i')?.textContent,
  li: document.querySelectorAll('#page ul li').length, td: Array.from(document.querySelectorAll('#page td')).map((x) => x.textContent),
  fn: Array.from(document.querySelectorAll('#fnZone .fn-item')).map((x) => x.textContent), title: document.querySelector('#docTitle').value,
  lang: window.WQ_API.WQ.doc.settings.lang }));
check('Word import: headings', imp.h1 === 'الفصل الأول' && imp.h2 === 'Background', JSON.stringify([imp.h1, imp.h2]));
check('Word import: bold, italic, list', imp.bold === 'الذاتي' && imp.ital === 'Italic text' && imp.li === 2);
check('Word import: table', imp.td.join('|') === 'الدراسة|السنة|الشمري|2021', imp.td.join('|'));
check('Word import: footnote becomes Warraq footnote', imp.fn.length === 1 && imp.fn[0].includes('نولز، التعلم الذاتي'), JSON.stringify(imp.fn));
check('Word import: title from filename, Arabic doc', imp.title === 'sample' && imp.lang === 'ar');

// 8ب) ملف يحاكي الرسائل الحقيقية (بدون أنماط عناوين)
const goalBefore = await pg.textContent('#stGoal');
await pg.setInputFiles('#fileDocx', 'tests/fixtures/real-like.docx');
await pg.waitForTimeout(800);
const rl = await pg.evaluate(() => ({
  h: Array.from(document.querySelectorAll('#page h1,#page h2,#page h3')).map((h) => h.tagName + ':' + h.textContent),
  firstIsHeading: document.querySelector('#page').firstElementChild.tagName,
  emptyRuns: (document.querySelector('#page').innerHTML.match(/(<p dir="auto"><br><\/p>){2,}/g) || []).length,
  lead: Array.from(document.querySelectorAll('#page p')).filter((p) => /^\s/.test(p.textContent)).length,
  ol: document.querySelectorAll('#page ol li').length, hiddenNum: Array.from(document.querySelectorAll('#page p')).some((p) => p.textContent === 'فقرة بترقيم مخفي'),
  numerals: window.WQ_API.WQ.doc.settings.numerals, toast: document.querySelector('#toast').textContent }));
check('Auto-detects headings by size/bold/numbering', JSON.stringify(rl.h) === JSON.stringify(['H1:الفصل الثاني', 'H2:2.1 الإطار النظري:', 'H3:2.1.1 المفهوم']), JSON.stringify(rl.h));
check('Bold sentence ending with period stays a paragraph', !rl.h.some((x) => x.includes('جملة عريضة')));
check('Leading empties removed, runs of empties collapsed, spaces trimmed', rl.firstIsHeading === 'H1' && rl.emptyRuns === 0 && rl.lead === 0, JSON.stringify(rl));
check('List numbering: none → paragraph, decimal → ordered list', rl.hiddenNum && rl.ol === 2);
check("Keeps author's Western digits in Arabic doc", rl.numerals === 'western' && rl.toast.includes('عنوان تلقائياً'), rl.numerals);
const goal = await pg.textContent('#stGoal');
check('Imported words do not count toward daily goal', goal === goalBefore, goalBefore + ' → ' + goal);

// 8ج) ملف Word قديم (.doc) يُقرأ مباشرة
await pg.setInputFiles('#fileDocx', 'tests/fixtures/sample.doc');
await pg.waitForTimeout(800);
const old = await pg.evaluate(() => ({
  modal: !!document.querySelector('.modal'), text: document.querySelector('#page').innerText,
  fn: Array.from(document.querySelectorAll('#fnZone .fn-item')).map((x) => x.textContent),
  td: Array.from(document.querySelectorAll('#page td')).map((x) => x.textContent), title: document.querySelector('#docTitle').value }));
check('Old .doc read directly: text', !old.modal && old.text.includes('الفصل الأول') && old.text.includes('Italic text') && old.title === 'sample', old.text.slice(0, 60));
check('Old .doc read directly: footnote and table', old.fn.length === 1 && old.fn[0].includes('نولز') && old.td.join('|') === 'الدراسة|السنة|الشمري|2021', JSON.stringify([old.fn, old.td]));

// 9) الملفات الأخيرة في شاشة البداية
await pg.waitForTimeout(1500);
await pg.evaluate(() => window.WQ_API.openStart());
const recent = await pg.locator('.recent-item').count();
check('Recent list shows local copies', recent >= 2, String(recent));
await pg.click('#startClose');

// 10) عن ورّاق: ذكر مصدر Tanzil
await pg.evaluate(() => window.WQ_API.loadQuran());
await pg.click('.tab:has-text("ملف")');
await pg.click('.rb:has-text("عن ورّاق")');
const about = await pg.textContent('.modal .body');
check('About shows Tanzil attribution + link', about.includes('Tanzil') && about.includes('tanzil.net'));
await pg.click('.modal .btn');

// لقطة شاشة لإدراج آية
await pg.evaluate(() => { window.WQ_API.applyTemplate('paper'); });
await pg.evaluate(() => { const p = document.querySelectorAll('#page > p')[4]; const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
await pg.click('.tab:has-text("الرسالة")');
await pg.click('.rb:has-text("إدراج آية")');
await pg.waitForSelector('#qSearch');
await pg.fill('#qSearch', 'اقرا باسم ربك');
await pg.waitForSelector('.q-hit');
await pg.click('.q-hit >> nth=0');
await pg.screenshot({ path: 'tests/screenshot3c-ayah.png' });

const alaq = await pg.evaluate(() => window.WQ_API.searchQuran('اقرا باسم ربك'));
const alaqTxt = await pg.evaluate(() => document.querySelector('#qPrev').textContent);
const src96 = fs.readFileSync('data/quran-uthmani.txt', 'utf-8').split('\n').find((l) => l.startsWith('96|1|')).split('|')[2];
check('Basmala separated from first verse (rest verbatim)', alaq[0][0] === 96 && !alaqTxt.includes('ٱلرَّحِيمِ') && src96.endsWith(alaqTxt.split('﴾')[0].slice(1)), alaqTxt);
check('No JavaScript errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
