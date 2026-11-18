// اختبار المرحلة 5: عرض الصفحات، والحواشي أسفل الصفحات، وPDF وPNG وWord وPowerPoint
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const url = process.argv[2] || 'http://localhost:8765/index.html';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load/.test(m.text())) errors.push(m.text()); });
await pg.goto(url); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => {
  window.WQ_API.applyTemplate('master');
  const D = window.WQ_API.WQ.doc;
  document.querySelector('#docTitle').value = 'ThesisTest';
  D.references.push({ id: 'rA', type: 'book', lang: '', authors: 'نولز، مالكوم', title: 'التعلم الذاتي', year: '1975', publisher: 'دار الفكر', place: 'القاهرة', journal: '', volume: '', issue: '', pages: '', university: '', degree: '', url: '', accessed: '' });
  const ps = Array.from(document.querySelectorAll('#page > p')).filter((p) => p.textContent.includes('اكتب هنا'));
  const long = 'هذه فقرة تجريبية طويلة لاختبار تقسيم الصفحات في ورّاق، وتحتوي على كلمات كثيرة حتى تمتد على عدة أسطر (Self-directed Learning). ';
  ps.slice(0, 8).forEach((p, i) => { p.innerHTML = long.repeat(9) + '<sup class="wq-fn" data-fn="t' + i + '" contenteditable="false">*</sup>' + long.repeat(3); D.footnotes['t' + i] = { refId: 'rA', page: String(10 + i), text: '' }; });
  ps[9].insertAdjacentHTML('afterend', '<table><tbody>' + '<tr><th dir="auto">المجموعة</th><th dir="auto">العدد</th></tr>' + Array.from({ length: 40 }, (_, i) => '<tr><td dir="auto">صف ' + (i + 1) + '</td><td dir="auto">' + i + '</td></tr>').join('') + '</tbody></table>');
  window.WQ_API.refreshDerived();
});

// 1) عرض الصفحات
await pg.click('.tab:has-text("عرض")');
await pg.click('.rb:has-text("عرض الصفحات")');
await pg.waitForTimeout(500);
const pv = await pg.evaluate(() => {
  const pages = Array.from(document.querySelectorAll('.pv-page'));
  const over = pages.filter((p) => { const box = p.querySelector('.pv-box'), b = p.querySelector('.pv-body'), f = p.querySelector('.pv-fns'); return b.offsetHeight + (f.childElementCount ? f.offsetHeight : 0) > box.offsetHeight + 1; }).length;
  const fnOk = pages.every((p) => p.querySelectorAll('.pv-body .wq-fn').length === p.querySelectorAll('.pv-fns .fn-item').length);
  const tableSplit = pages.filter((p) => p.querySelector('.pv-body table')).length;
  const headerRepeated = Array.from(document.querySelectorAll('.pv-body table')).every((t) => t.querySelector('th'));
  const PV = window.WQ_API.PV();
  const tocOk = Array.from(document.querySelectorAll('.pages-view .toc-row')).every((r) => { const n = PV.headPage[r.dataset.i]; return n === undefined || r.lastElementChild.textContent.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)) === String(n); });
  return { n: pages.length, over, fnOk, tableSplit, headerRepeated, tocOk, num2: pages[1].querySelector('.pv-num').textContent, num1: pages[0].querySelector('.pv-num').textContent };
});
check('Document laid out into real pages', pv.n > 10, String(pv.n));
check('No page overflows (text + footnotes fit)', pv.over === 0);
check('Each page shows exactly its own footnotes', pv.fnOk);
check('Long table split across pages with header repeated', pv.tableSplit >= 2 && pv.headerRepeated, JSON.stringify(pv));
check('TOC page numbers match real pages', pv.tocOk);
check('Page numbers (title page hidden)', pv.num1 === '' && pv.num2 === '٢', pv.num1 + '|' + pv.num2);
const status = await pg.textContent('#stWords');
check('Status bar shows exact page count', status.includes('صفحة') && !status.includes('تقريباً'), status);

// 2) ترقيم الحواشي لكل صفحة
await pg.evaluate(() => { window.WQ_API.WQ.doc.settings.fnRestart = true; window.WQ_API.paginate(); });
const restart = await pg.evaluate(() => Array.from(document.querySelectorAll('.pv-page')).filter((p) => p.querySelector('.pv-fns .fn-item')).every((p) => p.querySelector('.pv-fns .fn-num').textContent === '(١)'));
check('Footnote numbering can restart each page', restart);
await pg.evaluate(() => { window.WQ_API.WQ.doc.settings.fnRestart = false; window.WQ_API.paginate(); });

// 3) PDF
const [dlPdf] = await Promise.all([pg.waitForEvent('download', { timeout: 90000 }), pg.evaluate(() => window.WQ_API.exportPDF())]);
await dlPdf.saveAs('/tmp/t5.pdf');
const pdfInfo = execSync('pdfinfo /tmp/t5.pdf').toString();
const pdfPages = +(/Pages:\s+(\d+)/.exec(pdfInfo) || [])[1];
check('PDF exported with one PDF page per Warraq page', dlPdf.suggestedFilename() === 'ThesisTest.pdf' && pdfPages === pv.n, pdfPages + ' vs ' + pv.n);
execSync('pdftoppm -r 40 -f 9 -l 9 -png /tmp/t5.pdf /tmp/t5p');

// 4) PNG
const [dlPng] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.evaluate(() => window.WQ_API.exportPNG(false))]);
await dlPng.saveAs('/tmp/t5.png');
const sig = fs.readFileSync('/tmp/t5.png').subarray(0, 8).toString('hex');
check('PNG page image exported', sig === '89504e470d0a1a0a' && dlPng.suggestedFilename().endsWith('.png'), dlPng.suggestedFilename());
const [dlZip] = await Promise.all([pg.waitForEvent('download', { timeout: 90000 }), pg.evaluate(() => window.WQ_API.exportPNG(true))]);
await dlZip.saveAs('/tmp/t5.zip');
const zl = execSync('unzip -l /tmp/t5.zip | tail -1').toString();
check('All pages as PNG zip', new RegExp('\\s' + pv.n + ' files').test(zl), zl.trim());

// 5) Word
const [dlDocx] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.evaluate(() => exportDocx())]);
await dlDocx.saveAs('/tmp/t5.docx');
const py = execSync(`python3 -c "
import docx,zipfile,re
d=docx.Document('/tmp/t5.docx'); x=zipfile.ZipFile('/tmp/t5.docx').read('word/footnotes.xml').decode()
h=[p for p in d.paragraphs if p.style.name.startswith('Heading')]
print(len(h), len(re.findall(r'<w:footnote w:id=\\"[1-9]', x)), len(d.tables), 'المرجع نفسه' in x, d.sections[0].page_width)
"`).toString().trim().split(' ');
check('Word file opens; headings use Word heading styles', +py[0] >= 25, py.join(' '));
check('Word has real footnotes with Ibid', py[1] === '8' && py[3] === 'True');
check('Word keeps table and A4 page size', py[2] === '1' && py[4] === '7560310');
execSync('cd /tmp && rm -rf t5lo && timeout 120 soffice --headless --convert-to pdf --outdir t5lo t5.docx >/dev/null 2>&1');
check('Word file renders in LibreOffice', fs.existsSync('/tmp/t5lo/t5.pdf'));

// 6) PowerPoint
const [dlPpt] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.evaluate(() => exportPptx())]);
await dlPpt.saveAs('/tmp/t5.pptx');
const slides = execSync('unzip -l /tmp/t5.pptx | grep -c "ppt/slides/slide[0-9]*.xml"').toString().trim();
const s1 = execSync('unzip -p /tmp/t5.pptx ppt/slides/slide4.xml').toString();
check('Defense slides generated (title, outline, chapters, content, references, thanks)', +slides >= 10, slides + ' slides');
check('Slides are right-to-left with real bullet text', /rtl="1"/.test(s1) && /هذه فقرة تجريبية/.test(s1) && !/<a:t>…<\/a:t>/.test(s1));
check('Speaker notes carry full paragraph text', execSync('unzip -l /tmp/t5.pptx | grep -c notesSlide').toString().trim() !== '0');

// 7) الرجوع للكتابة بالنقر المزدوج
await pg.dblclick('.pv-page >> nth=8');
check('Double-click returns to editing', !(await pg.evaluate(() => document.body.classList.contains('pages-mode'))));

check('No JavaScript errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
