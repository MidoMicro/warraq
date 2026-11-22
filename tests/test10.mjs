// اختبار الدفعة أ (0.8.0): حقول كتب التراث، والصلاة والترضي، وأبيات الشعر، والتحقق من الآيات، والسورة كاملة بأرقام الآيات
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const R = (o) => Object.assign({ type: 'book', lang: '', authors: '', title: '', year: '', journal: '', volume: '', issue: '', pages: '', publisher: '', place: '', university: '', degree: '', url: '', accessed: '', editor: '', edition: '', death: '' }, o);

// 1) كتب التراث: المحقق والطبعة والجزء وسنة الوفاة
const h = await pg.evaluate((refs) => {
  const A = window.WQ_API;
  const footnotes = { a: { refId: 'rK', page: '45', vol: '3', text: '' }, b: { refId: 'rK', page: '50', vol: '3', text: '' }, c: { refId: 'rL', page: '12', vol: '2', text: '' }, d: { refId: 'rK', page: '9', vol: '1', text: '' } };
  const html = '<p>أ<sup class="wq-fn" data-fn="a" contenteditable="false">*</sup> ب<sup class="wq-fn" data-fn="b" contenteditable="false">*</sup> ج<sup class="wq-fn" data-fn="c" contenteditable="false">*</sup> د<sup class="wq-fn" data-fn="d" contenteditable="false">*</sup></p><div class="wq-bib" contenteditable="false"></div>';
  A.loadDocIntoEditor(Object.assign(A.newDocModel('ar'), { references: refs, footnotes, content: { html } })); A.refreshDerived();
  const r = { notes: Array.from(document.querySelectorAll('#fnZone .fn-item')).map((x) => x.textContent) };
  A.setCiteStyle('apa'); r.apaIn = Array.from(document.querySelectorAll('#page .wq-cite')).map((x) => x.textContent); r.apaBib = document.querySelector('.wq-bib').innerText;
  A.setCiteStyle('vancouver'); r.van = document.querySelector('.wq-bib').innerText;
  A.setCiteStyle('notes'); r.back = Array.from(document.querySelectorAll('#fnZone .fn-item')).map((x) => x.textContent);
  r.saved = JSON.parse(A.serializeDoc()).references[0];
  return r;
}, [R({ id: 'rK', authors: 'ابن كثير، إسماعيل بن عمر', death: '774', title: 'تفسير القرآن العظيم', editor: 'سامي بن محمد سلامة', edition: '2', year: '1420هـ', publisher: 'دار طيبة', place: 'الرياض' }),
  R({ id: 'rL', lang: 'en', authors: 'Lane, Edward William', death: '1876', title: 'An Arabic-English Lexicon', editor: 'Stanley Lane-Poole', edition: '3', year: '1968', publisher: 'Librairie du Liban', place: 'Beirut' })]);
check('Heritage full note: name first, death, tahqiq, edition, volume', h.notes[0] === '(١) ابن كثير، إسماعيل بن عمر (ت ٧٧٤هـ)، تفسير القرآن العظيم، تحقيق: سامي بن محمد سلامة، ط٢، دار طيبة، الرياض، ١٤٢٠هـ، ج ٣، ص ٤٥.', h.notes[0]);
check('Ibid keeps volume', h.notes[1] === '(٢) المرجع نفسه، ج ٣، ص ٥٠.', h.notes[1]);
check('English: (d. 1876), ed., 3rd ed., vol. 2', h.notes[2].includes('(d. 1876)') && h.notes[2].includes('ed. Stanley Lane-Poole') && h.notes[2].includes('3rd ed.') && h.notes[2].includes('vol. 2, p. 12'), h.notes[2]);
check('Op. cit. keeps volume', h.notes[3] === '(٤) ابن كثير، مرجع سابق، ج ١، ص ٩.', h.notes[3]);
check('APA in-text and list carry volume/editor/edition', h.apaIn[0] === '(ابن كثير، ١٤٢٠هـ، ج ٣، ص ٤٥)' && h.apaBib.includes('(تحقيق: سامي بن محمد سلامة، ط٢)'), h.apaIn[0]);
check('Vancouver: Edited by + 3rd ed. without double period', h.van.includes('Edited by Stanley Lane-Poole. 3rd ed. Beirut') && !h.van.includes('..'), h.van);
check('Volume survives APA → notes round trip', h.back[0] === h.notes[0] && h.back[3] === h.notes[3]);
check('Saved file keeps editor/edition/death', h.saved.editor === 'سامي بن محمد سلامة' && h.saved.edition === '2' && h.saved.death === '774');

// نافذة المرجع: حقول الكتاب الجديدة ونافذة الاستشهاد فيها الجزء
await pg.click('.tab:has-text("التوثيق")'); await pg.click('.rb:has-text("مرجع جديد")');
const fields = await pg.evaluate(() => Array.from(document.querySelectorAll('.modal [data-f]')).map((x) => x.dataset.f));
check('Book dialog has death/editor/edition', ['death', 'editor', 'edition'].every((f) => fields.includes(f)), fields.join(','));
await pg.click('.modal .btn2, .modal button:has-text("إلغاء")').catch(() => {}); await pg.evaluate(() => { document.querySelector('#modalRoot').innerHTML = ''; });

// 2) الصلاة والترضي
await pg.evaluate(() => window.WQ_API.loadDocIntoEditor(window.WQ_API.newDocModel('ar')));
await pg.click('#page'); await pg.keyboard.type('قال رسول الله ');
await pg.click('.tab:has-text("إدراج")');
await pg.focus('select[title="الصلاة والترضّي"]'); await pg.selectOption('select[title="الصلاة والترضّي"]', 'ﷺ');
await pg.keyboard.type(' وقال أبو بكر ');
await pg.focus('select[title="الصلاة والترضّي"]'); await pg.selectOption('select[title="الصلاة والترضّي"]', 'رضي الله عنه');
const txt = await pg.evaluate(() => document.querySelector('#page').textContent);
check('Honorifics inserted at cursor', txt.includes('رسول الله ﷺ وقال أبو بكر رضي الله عنه'), txt);
check('Honorific menu resets to its title', await pg.evaluate(() => document.querySelector('select[title="الصلاة والترضّي"]').value === ''));

// 3) أبيات الشعر
await pg.click('.rb:has-text("أبيات شعر")');
await pg.fill('#poemText', 'على قدر أهل العزم تأتي العزائم *** وتأتي على قدر الكرام المكارم\nوتعظم في عين الصغير صغارها\tوتصغر في عين العظيم العظائم\nالمتنبي');
const prev = await pg.evaluate(() => document.querySelectorAll('#poemPrev .wq-bayt .sadr').length);
check('Poem preview splits hemistichs (*** and Tab)', prev === 2);
await pg.click('.modal .btn:has-text("إدراج")'); await pg.waitForTimeout(200);
const poem = await pg.evaluate(() => {
  const ps = Array.from(document.querySelectorAll('#page p.wq-bayt'));
  const r = ps[0].querySelector('.sadr').getBoundingClientRect(), r2 = ps[0].querySelector('.ajz').getBoundingClientRect();
  return { n: ps.length, single: ps[2] && ps[2].classList.contains('single'), sadrRight: r.left > r2.left, sameRow: Math.abs(r.top - r2.top) < 3, w: Math.round(r.width), w2: Math.round(r2.width) };
});
check('Poem: 2 verses + centered line', poem.n === 3 && poem.single, JSON.stringify(poem));
check('Sadr on the right, ajz on the left, same row, equal width', poem.sadrRight && poem.sameRow && poem.w === poem.w2, JSON.stringify(poem));
const kept = await pg.evaluate(() => { const A = window.WQ_API; const d = A.parseDoc(A.serializeDoc()); return A.sanitizeHtml(d.content.html, true); });
check('Poem markup survives save/open', (kept.match(/class="wq-bayt"/g) || []).length === 2 && kept.includes('class="sadr"') && kept.includes('wq-bayt single'));
// عرض الصفحات وPDF وWord
await pg.evaluate(() => window.WQ_API.setPagesView(true)); await pg.waitForTimeout(400);
check('Poem layout kept in pages view', await pg.evaluate(() => { const p = document.querySelector('.pv-page p.wq-bayt'); return !!p && getComputedStyle(p).display === 'flex'; }));
await pg.evaluate(() => window.WQ_API.setPagesView(false));
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => exportDocx())]);
await dl.saveAs('/tmp/t10.docx');
const xml = execFileSync('unzip', ['-p', '/tmp/t10.docx', 'word/document.xml']).toString();
check('Word: verse = borderless 3-column table, hemistichs distributed', (xml.match(/<w:gridCol w:w="\d+"\/><w:gridCol w:w="\d+"\/><w:gridCol/g) || []).length === 2 && (xml.match(/w:jc w:val="distribute"/g) || []).length === 4 && xml.includes('w:insideV w:val="nil"'));
check('Word: bidi before jc (valid order)', !/<w:jc [^>]*\/><w:bidi\/>/.test(xml));

// 4) السورة كاملة بأرقام الآيات
await pg.evaluate(async () => { await window.WQ_API.loadQuran(); window.WQ_API.loadDocIntoEditor(window.WQ_API.newDocModel('ar')); });
await pg.click('#page'); await pg.click('.tab:has-text("إدراج")');
await pg.click('.rb:has-text("إدراج آية")'); await pg.waitForSelector('#qSura');
await pg.selectOption('#qSura', '112'); await pg.click('#qWhole'); await pg.check('#qNum');
const pv = await pg.textContent('#qPrev');
check('Whole surah button selects all ayat', (await pg.inputValue('#qTo')) === '4');
check('Verse numbers ۝١…۝٤ in preview', pv.includes('۝١') && pv.includes('۝٤'), pv.slice(0, 80));
await pg.click('.modal .btn:has-text("إدراج")'); await pg.waitForTimeout(200);
const n1 = await pg.evaluate(async () => { const A = window.WQ_API; const d = A.parseDoc(A.serializeDoc()); A.loadDocIntoEditor(d); await new Promise((r) => setTimeout(r, 300)); const s = document.querySelector('#page .wq-ayah'); return { n: s.dataset.n, t: s.textContent }; });
check('Numbered verses survive reopen + source re-check', n1.n === '1' && n1.t.includes('۝٤'), JSON.stringify(n1).slice(0, 100));
check('Long range allowed (Al-Baqarah 1–286)', await pg.evaluate(() => window.WQ_API.ayahText(2, 1, 286).split(' ').length > 6000));

// 5) التحقق من الآيات المكتوبة يدوياً
await pg.evaluate(() => {
  const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('ar'));
  document.querySelector('#page').innerHTML =
    '<p>قال تعالى: ﴿يا أيها الذين آمنوا استعينوا بالصبر والصلاة إن الله مع الصابرين﴾ وهذا مطابق.</p>' +
    '<p>وقال: {يا أيها الذين آمنوا استعينوا بالصبر إن الله مع الصابرين} وهذا ناقص.</p>' +
    '<p>وقال: ((الحمد لله رب العالمين)) آية كاملة.</p>' +
    '<p>ونص: {هذا كلام عادي ليس من القرآن الكريم إطلاقا} للتجربة.</p>';
});
await pg.click('.rb:has-text("تحقّق من الآيات")'); await pg.waitForSelector('.qv-item');
const qv = await pg.evaluate(() => Array.from(document.querySelectorAll('.qv-item')).map((x) => ({ cls: x.className, head: x.querySelector('.qv-head').textContent, miss: Array.from(x.querySelectorAll('ins')).map((i) => i.textContent), fix: !!x.querySelector('.qv-fix') })));
check('Found 4 typed quotations', qv.length === 4, qv.map((x) => x.cls).join(' | '));
check('Imla\'i spelling (الصلاة/آمنوا/يا أيها) = match, Al-Baqarah 153', qv[0].cls.includes('ok') && qv[0].head.includes('البقرة') && qv[0].head.includes('١٥٣'), qv[0].head);
check('Missing word detected and shown (والصلوة)', qv[1].cls.includes('diff') && qv[1].miss.some((m) => m.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').includes('صلوة')), JSON.stringify(qv[1].miss));
check('Full verse recognized (Al-Fatihah 2)', qv[2].cls.includes('ok') && qv[2].head.includes('الفاتحة') && !qv[2].head.includes('جزء'), qv[2].head);
check('Non-Quran text = not found, no replace button', qv[3].cls.includes('no') && !qv[3].fix);
await pg.click('.qv-item >> nth=2 >> .qv-fix'); await pg.click('.qv-item >> nth=1 >> .qv-fix');
await pg.click('.modal .btn:has-text("موافق")').catch(() => {});
const after = await pg.evaluate(() => ({ ay: Array.from(document.querySelectorAll('#page .wq-ayah')).map((s) => s.dataset.s + ':' + s.dataset.a), p2: document.querySelectorAll('#page p')[1].textContent }));
check('Full verse replaced by protected verse from source', after.ay.includes('1:2'), JSON.stringify(after.ay));
check('Partial quote replaced with exact Quran text (after earlier replacement)', after.p2.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').includes('ٱلصلوة') && after.p2.includes('وهذا ناقص'), after.p2);

check('No JavaScript errors', errs.length === 0, errs.join(' | '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
