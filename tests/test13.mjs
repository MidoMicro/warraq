// اختبار 0.9.3: اتجاه السطر الفارغ، ولغة المستند، والمتن، والصيغ المشكولة، والخطوط، والحواشي، وقائمة الحديث
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const fresh = (lang) => pg.evaluate((l) => { const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel(l)); }, lang);
const caretEnd = () => pg.evaluate(() => { const p = document.querySelector('#page p:last-child'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector('#page').focus(); });

// 1) السطر الفارغ يأخذ اتجاه لغة المستند
await fresh('ar');
check('Empty paragraph is RTL in an Arabic doc', await pg.evaluate(() => document.querySelector('#page p').matches(':dir(rtl)')));
await caretEnd(); await pg.keyboard.type('Hello world');
check('Typing English in it turns it LTR', await pg.evaluate(() => document.querySelector('#page p').matches(':dir(ltr)')));
await fresh('en');
check('Empty paragraph is LTR in an English doc', await pg.evaluate(() => document.querySelector('#page p').matches(':dir(ltr)')));
await caretEnd(); await pg.keyboard.type('مرحبا');
check('Typing Arabic in it turns it RTL', await pg.evaluate(() => document.querySelector('#page p').matches(':dir(rtl)')));

// 2) لغة المستند من الشريط السفلي، والتنبيه
await pg.click('#stLang');
await pg.click('.modal .chip[data-l="ar"]');
check('Status-bar language button switches the document to Arabic', await pg.evaluate(() => WQ.doc.settings.lang === 'ar' && document.querySelector('#stLang').textContent.includes('عربي')));
await pg.evaluate(() => { const A = window.WQ_API; const d = A.newDocModel('en'); d.content.html = '<p dir="auto">' + 'هذا نص عربي طويل في مستند لغته الإنجليزية '.repeat(8) + '</p>'; A.loadDocIntoEditor(d); });
await pg.waitForTimeout(100);
check('Hint appears when an English doc is mostly Arabic', await pg.$('#langHint') !== null);
await pg.click('#langHint .btn');
check('Hint button makes the document Arabic', await pg.evaluate(() => WQ.doc.settings.lang === 'ar' && !document.querySelector('#langHint')));

// 3) بداية المتن، والصيغ المشكولة
const mt = await pg.evaluate(async () => { const A = window.WQ_API; const B = await A.loadHadithBook('bukhari'); const g = (k) => B.h[B.map.get(k)][1];
  return [A.hdMatnStart(g('1')), A.hdMatnStart(g('2')), A.hdTypo(g('2'))]; });
check('Bukhari 1: matn found; Bukhari 2: question not cut (full text)', mt[0] > 0 && mt[1] === 0, mt[0] + ' / ' + mt[1]);
check('Honorifics vocalized in hadith text', mt[2].includes('صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ') && !/(^|\s)صلى الله عليه وسلم/.test(mt[2]) && !/رضى الله/.test(mt[2]));

// 4) الخطوط
await fresh('ar');
await pg.click('.tab:has-text("تخطيط")');
const opts = await pg.evaluate(() => Array.from(document.querySelectorAll('.ribbon select.rsel')[0].options).map((o) => o.value));
check('Document-font list has the new bundled fonts', ['Scheherazade New', 'Lateef', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'Almarai', 'Readex Pro', 'El Messiri', 'Changa', 'Markazi Text'].every((f) => opts.includes(f)), opts.length + ' fonts');
await pg.selectOption('.ribbon select.rsel >> nth=0', 'Lateef');
await pg.selectOption('.ribbon select.rsel >> nth=1', 'Changa');
const ff = await pg.evaluate(() => { document.querySelector('#page').innerHTML = '<h1 dir="auto">عنوان</h1><p dir="auto">نص</p>'; return [getComputedStyle(document.querySelector('#page p')).fontFamily, getComputedStyle(document.querySelector('#page h1')).fontFamily, WQ.doc.settings.docFont]; });
check('Document font applied to text and headings font to headings', ff[0].startsWith('Lateef') && ff[1].startsWith('Changa') && ff[2] === 'Lateef', ff.join(' | '));
const bad = await pg.evaluate(() => { const A = window.WQ_API; const d = A.newDocModel('ar'); d.settings.docFont = "x;}body{background:url(http://e)}"; A.loadDocIntoEditor(d); return [WQ.doc.settings.docFont, document.documentElement.style.getPropertyValue('--doc-font')]; });
check('Unsafe font names from a file are ignored', bad[0] === undefined && !bad[1].includes('url'), JSON.stringify(bad));
await pg.evaluate(() => window.WQ_API.setSetting ? 0 : 0);

// 5) Word: أرقام الحواشي تتبع «١٢٣»، وخط العناوين
const dx = await pg.evaluate(async () => {
  const A = window.WQ_API; const d = A.newDocModel('en'); d.settings.numerals = 'arabic'; d.settings.headFont = 'Changa';
  d.content.html = '<h1 dir="auto">Title</h1><p dir="auto">Text<sup class="wq-fn" data-fn="f1" contenteditable="false">*</sup></p>'; d.footnotes = { f1: { refId: '', page: '', text: 'note' } };
  A.loadDocIntoEditor(d); A.renderCitations();
  const z = await unzip(await docxBuilder().build().arrayBuffer());
  return [await z.text('word/document.xml'), await z.text('word/styles.xml'), document.querySelector('#page .wq-fn').textContent];
});
check('Word footnote numbers follow the ١٢٣ choice', dx[0].includes('<w:footnotePr><w:numFmt w:val="hindiNumbers"/>') && dx[2] === '١', dx[2]);
check('Word heading style uses the headings font', /w:styleId="Heading1".*?w:rFonts w:ascii="Changa"/.test(dx[1]));

// 6) الإدراج: بداية متن يختارها المستخدم، والمؤشر بعد الحاشية
await fresh('ar');
await pg.evaluate(() => { const p = document.querySelector('#page p'); p.textContent = 'قال: '; });
await caretEnd();
await pg.click('.tab:has-text("إدراج")');
await pg.click('.ribbon button:has-text("حديث")'); await pg.waitForSelector('#hBook');
await pg.fill('#hNum', '2'); await pg.waitForTimeout(500);
const pickO = await pg.evaluate(() => { const ws = document.querySelectorAll('#hPrev .hw'); const w = Array.from(ws).find((x) => x.textContent.replace(/[ً-ْ]/g, '') === 'أحيانا') || ws[10]; w.click(); return +w.dataset.o; });
const dimmed = await pg.evaluate(() => document.querySelectorAll('#hPrev .hw.dim').length);
check('Clicking a word in the preview sets the matn start', pickO > 0 && dimmed > 5, pickO + ' / dim ' + dimmed);
await pg.click('.modal .actions .btn');
await pg.keyboard.type('xyz');
const ins = await pg.evaluate(() => { const sp = document.querySelector('#page .wq-hadith'); const sup = sp.nextSibling; return { o: sp.dataset.o, sup: sup && sup.classList && sup.classList.contains('wq-fn'), after: sup && sup.nextSibling && sup.nextSibling.textContent, start: sp.textContent.slice(0, 12) }; });
check('Inserted from the chosen word', String(ins.o) === String(pickO), JSON.stringify(ins));
check('Typing after insert goes after the footnote mark', ins.sup && /xyz/.test(ins.after || ''), JSON.stringify(ins));

// 7) قائمة الحديث المُدرج
await pg.click('#page .wq-hadith');
await pg.waitForSelector('#hdMenu');
const menu = await pg.evaluate(() => Array.from(document.querySelectorAll('#hdMenu .ctx-item')).map((b) => b.textContent));
check('Clicking a hadith opens its menu', menu.some((x) => x.includes('النص كاملاً')) && menu.some((x) => x.includes('حذف')), menu.join(' | '));
await pg.click('#hdMenu .ctx-item:has-text("النص كاملاً")');
check('Menu: switch to full text with isnad', await pg.evaluate(() => !document.querySelector('#page .wq-hadith').dataset.o));
await pg.click('#page .wq-hadith'); await pg.waitForSelector('#hdMenu');
await pg.click('#hdMenu .ctx-item:has-text("التخريج وأحكام")');
check('Menu: reference and grades dialog', await pg.evaluate(() => document.querySelector('.modal .body').textContent.includes('أخرجه البخاري (٢)')));
await pg.click('.modal .actions .btn');
await pg.click('#page .wq-hadith'); await pg.waitForSelector('#hdMenu');
await pg.click('#hdMenu .ctx-item:has-text("حذف")');
check('Menu: delete removes hadith and its footnote', await pg.evaluate(() => !document.querySelector('#page .wq-hadith') && !document.querySelector('#page .wq-fn') && Object.keys(WQ.doc.footnotes).length === 0));

check('No page errors', errs.length === 0, errs.join(' | '));
await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
