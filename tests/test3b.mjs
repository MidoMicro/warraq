// اختبار الدفعة 3ب: الحواشي والمراجع والاستشهادات والفهرس
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve(process.argv[2] || 'dist/index.html');
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 950 } });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
await pg.goto(file); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
if (await pg.isVisible('#startOv')) await pg.click('#startClose');

const fnTexts = () => pg.evaluate(() => Array.from(document.querySelectorAll('#fnZone .fn-item')).map((p) => p.textContent.trim()));
const typeEnd = async (s) => { await pg.click('#page'); await pg.keyboard.press('Control+End'); await pg.keyboard.type(s); };

// 1) إضافة مرجع من الواجهة: تبويب التوثيق ← مرجع جديد
await pg.click('#page'); await pg.keyboard.type('يُعدّ التعلّم الذاتي من أبرز المفاهيم');
await pg.click('.tab:has-text("التوثيق")');
await pg.click('.rb:has-text("مرجع جديد")');
await pg.fill('[data-f="authors"]', 'نولز، مالكوم');
await pg.fill('[data-f="title"]', 'التعلّم الذاتي');
await pg.fill('[data-f="year"]', '1975');
await pg.fill('[data-f="publisher"]', 'دار الفكر');
await pg.fill('[data-f="place"]', 'القاهرة');
const prev = await pg.textContent('#refPrev');
check('Live preview while typing reference', prev.includes('نولز') && prev.includes('١٩٧٥'), prev);
await pg.click('.modal .btn:has-text("حفظ وإدراج")');
await pg.waitForSelector('#cPage');
await pg.fill('#cPage', '18');
await pg.click('.modal .btn:has-text("إدراج")');
await pg.waitForTimeout(300);
let fns = await fnTexts();
check('First citation = full note', fns.length === 1 && fns[0].includes('مالكوم نولز') && fns[0].includes('ص ١٨'), fns[0]);

// 2) مراجع إضافية عبر الواجهة البرمجية
await pg.evaluate(() => {
  const D = window.WQ_API.WQ.doc;
  D.references.push({ id: 'rB', type: 'article', lang: '', authors: 'الشمري، فهد', title: 'أثر التعلم الذاتي', year: '2021', journal: 'مجلة العلوم التربوية', volume: '12', issue: '3', pages: '40-60', publisher: '', place: '', university: '', degree: '', url: '', accessed: '' });
  D.references.push({ id: 'rC', type: 'article', lang: '', authors: 'Garrison, D. Randy', title: 'Self-directed learning: Toward a comprehensive model', year: '1997', journal: 'Adult Education Quarterly', volume: '48', issue: '1', pages: '18-33', publisher: '', place: '', university: '', degree: '', url: '', accessed: '' });
});
const refA = await pg.evaluate(() => window.WQ_API.WQ.doc.references[0].id);
const cite = async (id, p) => { await pg.click('#page'); await pg.keyboard.press('Control+End'); await pg.keyboard.type(' نص'); await pg.evaluate(([i, q]) => window.WQ_API.addCitation(i, q), [id, p]); };
await cite(refA, '22');   // ← المرجع نفسه
await cite('rB', '45');   // ← كامل
await cite(refA, '30');   // ← مرجع سابق
await cite('rC', '20');   // ← full English
await cite('rC', '25');   // ← Ibid.
await pg.waitForTimeout(300);
fns = await fnTexts();
check('Consecutive same ref → المرجع نفسه', fns[1] === '(٢) المرجع نفسه، ص ٢٢.', fns[1]);
check('New ref → full note', fns[2].includes('فهد الشمري') && fns[2].includes('مجلة العلوم التربوية'), fns[2]);
check('Earlier ref again → مرجع سابق', fns[3] === '(٤) نولز، مرجع سابق، ص ٣٠.', fns[3]);
check('English ref full note keeps Latin digits', fns[4].includes('D. Randy Garrison') && fns[4].includes('p. 20'), fns[4]);
check('English consecutive → Ibid.', fns[5] === '(٦) Ibid., p. 25.', fns[5]);
check('Markers numbered (١)…(٦)', (await pg.evaluate(() => Array.from(document.querySelectorAll('#page .wq-fn')).map((e) => e.textContent).join(' '))) === '(١) (٢) (٣) (٤) (٥) (٦)');

// 3) حاشية نصية تكسر سلسلة "المرجع نفسه"
await pg.click('#page'); await pg.keyboard.press('Control+End');
await pg.evaluate(() => window.WQ_API.addFootnote({ text: 'انظر الملحق رقم 1' }));
await cite('rC', '30');
fns = await fnTexts();
check('Text footnote breaks Ibid chain → op. cit.', fns[7] === '(٨) Garrison, op. cit., p. 30.', fns[7]);

// 4) قائمة المراجع
await pg.click('#page'); await pg.keyboard.press('Control+End'); await pg.keyboard.press('Enter');
await pg.evaluate(() => window.WQ_API.insertBlock('wq-bib'));
let bib = await pg.evaluate(() => document.querySelector('.wq-bib').innerText);
check('Bibliography: Arabic group first then foreign', bib.indexOf('المراجع العربية') < bib.indexOf('المراجع الأجنبية') && bib.includes('Garrison, D. R. (1997)'), bib.replace(/\n/g, ' | '));
check('Bibliography Arabic sorted (الشمري before نولز)', bib.indexOf('الشمري') < bib.indexOf('نولز'));

// 5) التحويل إلى APA
await pg.evaluate(() => window.WQ_API.setCiteStyle('apa'));
const apaCites = await pg.evaluate(() => Array.from(document.querySelectorAll('#page .wq-cite')).map((e) => e.textContent));
check('Switch to APA converts citations inline', apaCites.length === 7 && apaCites[0] === '(نولز، ١٩٧٥، ص ١٨)' && apaCites.includes('(Garrison, 1997, p. 20)'), JSON.stringify(apaCites));
fns = await fnTexts();
check('Only the text footnote remains in APA', fns.length === 1 && fns[0].includes('الملحق'), JSON.stringify(fns));

// 6) Vancouver
await pg.evaluate(() => window.WQ_API.setCiteStyle('vancouver'));
const van = await pg.evaluate(() => Array.from(document.querySelectorAll('#page .wq-cite')).map((e) => e.textContent).join(' '));
check('Vancouver numbers by first appearance', van === '[١] [١] [٢] [١] [٣] [٣] [٣]', van);
bib = await pg.evaluate(() => document.querySelector('.wq-bib').innerText);
check('Vancouver bibliography in citation order', bib.indexOf('١. نولز') > -1 && bib.indexOf('٢. الشمري') > bib.indexOf('١. نولز') && bib.includes('٣. Garrison DR'), bib.replace(/\n/g, ' | '));

// 7) الرجوع للحواشي
await pg.evaluate(() => window.WQ_API.setCiteStyle('notes'));
fns = await fnTexts();
check('Back to notes restores footnotes with Ibid logic', fns.length === 8 && fns[1].includes('المرجع نفسه'), fns.length + '');

// 8) فهرس المحتويات
await pg.evaluate(() => {
  const p = document.querySelector('#page');
  p.insertAdjacentHTML('afterbegin', '<div class="wq-toc" contenteditable="false"></div><h1 dir="auto">الفصل الأول</h1><h2 dir="auto">المبحث الأول</h2>');
  p.insertAdjacentHTML('beforeend', '<hr class="wq-pagebreak"><h1 dir="auto">الفصل الثاني</h1>');
  window.WQ_API.refreshDerived();
});
const toc = await pg.evaluate(() => Array.from(document.querySelectorAll('.wq-toc .toc-row')).map((r) => r.innerText.replace(/\s+/g, ' ')));
check('TOC lists headings with page numbers', toc.length === 3 && toc[2].includes('الفصل الثاني') && /[٢-٩]$/.test(toc[2].trim()), JSON.stringify(toc));
const nav = await pg.evaluate(() => Array.from(document.querySelectorAll('#navList .nav-item')).map((b) => b.textContent));
check('Doc map ignores TOC/bibliography titles', nav.length === 3, JSON.stringify(nav));

// 9) حفظ وفتح يحافظ على كل شيء + التنسيق
await pg.evaluate(() => { const p = document.querySelector('#page > p'); p.innerHTML += ' <span style="font-family: Cairo; font-size: 20pt; color: rgb(184, 115, 46);">منسّق</span>'; });
await pg.fill('#docTitle', 'Test3b');
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
const tmp = '/tmp/t3b.warraq'; await dl.saveAs(tmp);
const saved = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
check('File contains references and footnotes', saved.references.length === 3 && Object.keys(saved.footnotes).length === 8 && saved.settings.citeStyle === 'notes');
await pg.evaluate(() => window.WQ_API.loadDocIntoEditor(window.WQ_API.newDocModel('ar')));
await pg.setInputFiles('#fileOpen', tmp); await pg.waitForTimeout(400);
fns = await fnTexts();
const fmt = await pg.evaluate(() => { const s = document.querySelector('#page span[style*="Cairo"]'); return s ? s.getAttribute('style') : ''; });
check('Reopen restores footnotes with Ibid logic', fns.length === 8 && fns[1] === '(٢) المرجع نفسه، ص ٢٢.', fns[1]);
check('Reopen keeps font/size/color formatting', /Cairo/.test(fmt) && /20pt/.test(fmt) && /color/.test(fmt), fmt);
check('Reopen keeps page break and TOC', await pg.evaluate(() => !!document.querySelector('#page hr.wq-pagebreak') && document.querySelectorAll('.wq-toc .toc-row').length === 3));

// 10) لصق خارجي لا يُدخل حواشي مزيفة
const pasted = await pg.evaluate(() => window.WQ_API.sanitizeHtml('<p>a<sup class="wq-fn" data-fn="x1">1</sup></p>'));
check('Untrusted paste drops Warraq footnote markers', !pasted.includes('wq-fn'), pasted);

// 11) حذف حاشية بالضغط عليها
await pg.click('#page .wq-fn >> nth=0');
await pg.click('.modal button:has-text("حذف")');
await pg.waitForTimeout(200);
fns = await fnTexts();
check('Delete footnote renumbers and recomputes', fns.length === 7 && fns[0].includes('مالكوم نولز') && fns[0].includes('ص ٢٢'), fns[0]);

// 12) لوحة المراجع
const panel = await pg.evaluate(() => ({ cards: document.querySelectorAll('.ref-card').length, head: document.querySelector('#refPanel h3').textContent }));
check('Reference panel lists 3 refs with count', panel.cards === 3 && panel.head.includes('٣'), JSON.stringify(panel));

// لقطة شاشة
await pg.evaluate(() => {
  const D = window.WQ_API.WQ.doc; const keep = D.references; const fnsObj = {};
  const doc = Object.assign(window.WQ_API.newDocModel('ar'), { references: keep, footnotes: { a1: { refId: keep[0].id, page: '18', text: '' }, a2: { refId: keep[0].id, page: '22', text: '' }, a3: { refId: 'rB', page: '45', text: '' }, a4: { refId: keep[0].id, page: '30', text: '' } },
    content: { html: '<h1>الفصل الأول: الإطار النظري</h1><p>يُعدّ مفهوم التعلّم الذاتي (Self-directed Learning) من أبرز المفاهيم التربوية الحديثة<sup class="wq-fn" data-fn="a1" contenteditable="false">*</sup>، وأشار نولز إلى أن المتعلّم البالغ يتحمّل مسؤولية تعلّمه<sup class="wq-fn" data-fn="a2" contenteditable="false">*</sup>، وهو ما أكّدته الدراسات العربية اللاحقة<sup class="wq-fn" data-fn="a3" contenteditable="false">*</sup>، مع التأكيد على دور البيئة<sup class="wq-fn" data-fn="a4" contenteditable="false">*</sup>.</p><div class="wq-bib" contenteditable="false"></div>' } });
  window.WQ_API.loadDocIntoEditor(doc);
});
await pg.click('.tab:has-text("التوثيق")');
await pg.waitForTimeout(300);
await pg.screenshot({ path: 'tests/screenshot3b.png' });

check('No JavaScript errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
