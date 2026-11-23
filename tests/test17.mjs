// اختبار 0.12.0: الصفحات منفصلة وقت الكتابة (دفع الفقرة كاملة للصفحة التالية بقواعد CSS، دون لمس المحتوى)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const PARA = 'هذه فقرة تجريبية طويلة نسبياً لنرى كيف تنقسم الصفحات وقت الكتابة في ورّاق، والفقرة التي لا تتسع في صفحتها تنزل كاملة للصفحة التالية مع بقاء النص كما هو دون أي تعديل.';
const DOC = (() => { let h = '<h1 dir="auto">الفصل الأول</h1>'; for (let i = 1; i <= 34; i++) h += '<p dir="auto">' + i + ' ' + PARA + '</p>'; h += '<hr class="wq-pagebreak"><h1 dir="auto">الفصل الثاني</h1><p dir="auto">بداية الفصل الثاني.</p>'; return h; })();
await pg.evaluate((h) => { const A = window.WQ_API; const d = A.newDocModel('ar'); d.content.html = h; A.loadDocIntoEditor(d); }, DOC);
await pg.waitForTimeout(500);
// كل فقرة داخل منطقة النص في صفحتها
const audit = () => pg.evaluate(() => {
  const s = document.querySelector('#sheet'), sr = s.getBoundingClientRect(), z = sr.width / s.offsetWidth, V = window.WQ_API.VP();
  const st = window.WQ_API.WQ.doc.settings, m = window.WQ_API.pageMargins(st), CMp = 37.7953, H = 29.7 * CMp, mt = m.t * CMp, mb = m.b * CMp;
  const bad = [], starts = [];
  Array.from(document.querySelector('#page').children).forEach((b, i) => {
    const r = b.getBoundingClientRect(), t = (r.top - sr.top) / z, bt = (r.bottom - sr.top) / z, k = Math.floor(t / V.P);
    if (bt > k * V.P + H - mb + 1 || t < k * V.P + mt - 1) bad.push([i, b.tagName, Math.round(t), Math.round(bt), k]);
    starts.push([b.tagName, k + 1, Math.round(t - (k * V.P + mt))]);
  });
  return { bad, starts, pages: V.pages, on: V.on };
});
let a = await audit();
check('Separate pages on by default', a.on && await pg.evaluate(() => document.body.classList.contains('vpages')));
check('More than one page card drawn', a.pages >= 3 && await pg.$$eval('.vp-card', (c) => c.length) === a.pages, String(a.pages));
check('No paragraph crosses a page bottom or sits in a margin', a.bad.length === 0, JSON.stringify(a.bad.slice(0, 3)));
const pushed = a.starts.filter((x, i) => i > 0 && x[2] <= 2 && x[1] > 1);
check('Pushed paragraphs start exactly at the next page top', pushed.length >= 2, JSON.stringify(pushed.slice(0, 3)));
const ch2 = a.starts.findIndex((x, i) => x[0] === 'H1' && i > 0);
check('Page break: chapter 2 starts at the top of a new page', ch2 > 0 && a.starts[ch2][2] <= 2 && a.starts[ch2][1] > a.starts[ch2 - 2][1], JSON.stringify(a.starts[ch2]));
check('Document content untouched (no margins written into HTML)', await pg.evaluate(() => !document.querySelector('#page').innerHTML.includes('margin-top') && !window.WQ_API.serializeDoc().includes('margin-top')));
check('Push rules live in a scoped style sheet', await pg.evaluate(() => /body\.vpages #page>:nth-child\(\d+\)\{margin-top:/.test(document.querySelector('#vpStyle').textContent)));
const nums = await pg.$$eval('.vp-num', (x) => x.map((n) => n.textContent));
check('Page numbers on cards (first hidden, Arabic digits)', nums[0] === '' && nums[1] === '٢', JSON.stringify(nums.slice(0, 3)));
check('Status bar page count = cards', await pg.evaluate(() => document.querySelector('#stWords').textContent.includes(window.WQ_API.WQ.ui === 'ar' ? ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'][window.WQ_API.VP().pages] : '')));
const h2p = await pg.evaluate(() => window.WQ_API.pageOf(document.querySelectorAll('#page h1')[1]));
check('pageOf uses the visible pages (chapter 2)', h2p === a.starts[ch2][1], h2p + ' vs ' + a.starts[ch2][1]);

// العنوان لا يبقى وحده في آخر الصفحة
await pg.evaluate((p) => { const A = window.WQ_API; const d = A.newDocModel('ar'); let h = ''; for (let i = 1; i <= 60; i++) h += (i % 6 === 0 ? '<h2 dir="auto">مبحث ' + i + '</h2>' : '') + '<p dir="auto">' + p + '</p>'; d.content.html = h; A.loadDocIntoEditor(d); }, PARA);
await pg.waitForTimeout(400);
a = await audit();
const orphan = await pg.evaluate(() => { const s = document.querySelector('#sheet'), sr = s.getBoundingClientRect(), z = sr.width / s.offsetWidth, V = window.WQ_API.VP(); const kids = Array.from(document.querySelector('#page').children); return kids.some((b, i) => /^H/.test(b.tagName) && kids[i + 1] && Math.floor(((b.getBoundingClientRect().top - sr.top) / z) / V.P) !== Math.floor(((kids[i + 1].getBoundingClientRect().top - sr.top) / z) / V.P)); });
check('Headings stay with their next paragraph', !orphan && a.bad.length === 0);

// الكتابة: إضافة فقرات تعيد التوزيع
await pg.evaluate(() => { const p = document.querySelectorAll('#page p')[3]; const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
await pg.focus('#page');
for (let i = 0; i < 6; i++) { await pg.keyboard.press('Enter'); await pg.keyboard.type('سطر جديد ' + i); }
await pg.waitForTimeout(500);
a = await audit();
check('After typing new paragraphs: still no crossings', a.bad.length === 0, JSON.stringify(a.bad.slice(0, 3)));
check('Undo still works after re-layout', await pg.evaluate(() => { const before = document.querySelectorAll('#page p').length; document.execCommand('undo'); return document.querySelectorAll('#page p').length <= before; }));

// التكبير
await pg.evaluate(() => { const A = window.WQ_API; A.WQ.prefs.zoom = 125; document.documentElement.style.setProperty('--zoom', 1.25); A.layoutPages(); });
a = await audit();
check('Zoom 125%: layout still correct', a.bad.length === 0, JSON.stringify(a.bad.slice(0, 2)));
await pg.evaluate(() => { document.documentElement.style.setProperty('--zoom', 1); window.WQ_API.WQ.prefs.zoom = 100; window.WQ_API.layoutPages(); });

// هوامش مخصصة
await pg.evaluate(() => { const A = window.WQ_API, s = A.WQ.doc.settings; Object.assign(s, { margins: 'custom', mT: 4, mB: 3, mL: 2.5, mR: 2.5 }); A.applyDocSettings(); A.layoutPages(); });
a = await audit();
check('Custom top/bottom margins respected', a.bad.length === 0, JSON.stringify(a.bad.slice(0, 2)));

// عرض الصفحات والتصدير لا يتأثران
const pv = await pg.evaluate(() => { const A = window.WQ_API; A.setPagesView(true); const on = document.body.classList.contains('vpages'); const mts = Array.from(document.querySelectorAll('#pagesView .pv-body > *')).map((x) => parseFloat(getComputedStyle(x).marginTop)); A.setPagesView(false); return { on, max: Math.max(...mts) }; });
check('Pages view: vpages off and no pushed margins in clones', !pv.on && pv.max < 60, JSON.stringify(pv));
await pg.waitForTimeout(300);
check('Back to writing: separate pages again', await pg.evaluate(() => document.body.classList.contains('vpages')));
const wx = await pg.evaluate(async () => { const z = await unzip(await docxBuilder().build().arrayBuffer()); return z.text('word/document.xml'); });
check('Word export has no layout spacing', !/w:before="\d{4,}"/.test(wx));

// التسطير والإيقاف من تبويب عرض
await pg.evaluate(() => { const A = window.WQ_API; A.WQ.doc.settings.ruled = 'dots'; A.layoutPages(); });
check('Ruled page: continuous mode (no separate pages)', await pg.evaluate(() => !document.body.classList.contains('vpages') && document.querySelector('#vpStyle').textContent === ''));
await pg.evaluate(() => { const A = window.WQ_API; A.WQ.doc.settings.ruled = 'off'; A.layoutPages(); });
await pg.click('.tab:has-text("عرض")'); await pg.click('.ribbon button:has-text("فصل الصفحات")'); await pg.waitForTimeout(200);
check('View → separate pages toggles off', await pg.evaluate(() => !document.body.classList.contains('vpages') && document.querySelector('#sheet').style.minHeight === '' && window.WQ_API.WQ.prefs.sepPages === false));
await pg.click('.ribbon button:has-text("فصل الصفحات")'); await pg.waitForTimeout(200);
check('…and back on', await pg.evaluate(() => document.body.classList.contains('vpages')));

// الأداء: ٢٠٠ صفحة تقريباً
const perf = await pg.evaluate((p) => { const A = window.WQ_API; const d = A.newDocModel('ar'); let h = ''; for (let i = 1; i <= 2400; i++) h += '<p dir="auto">' + p + '</p>'; d.content.html = h; A.loadDocIntoEditor(d); const t0 = performance.now(); A.layoutPages(); return { ms: Math.round(performance.now() - t0), pages: A.VP().pages }; }, PARA);
check('Long document (~200 pages) laid out fast', perf.ms < 400 && perf.pages > 150, JSON.stringify(perf));

check('No page errors', errs.length === 0, errs.join(' | '));
console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
await browser.close();
