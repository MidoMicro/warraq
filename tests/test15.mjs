// اختبار 0.10.0 (الدفعة د): IEEE وHarvard وChicago وMLA، واستيراد BibTeX/RIS وتصديره، وDOI، والترقيم التمهيدي
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const plain = (h) => h.replace(/<[^>]+>/g, '');

// 1) الأنماط على مقال وكتاب
const R = await pg.evaluate(() => {
  const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('en'));
  const art = { id: 'r1', type: 'article', lang: 'en', authors: 'Smith, Anna\nLee, Brian', title: 'Deep learning for Arabic', year: '2020', journal: 'Journal of AI', volume: '12', issue: '3', pages: '45–67', doi: '10.1000/xyz123' };
  const book = { id: 'r2', type: 'book', lang: 'en', authors: 'Doe, John', title: 'Research Methods', year: '2019', publisher: 'Sage', place: 'London', edition: '2' };
  return { ieeeA: A.ieeeRef(art), ieeeB: A.ieeeRef(book), harA: A.harvardRef(art), harB: A.harvardRef(book), chiA: A.chicagoRef(art), chiB: A.chicagoRef(book), mlaA: A.mlaRef(art), mlaB: A.mlaRef(book),
    inH: A.inTextFor('harvard', art, '50', '', 1), inC: A.inTextFor('chicago', art, '50', '', 1), inM: A.inTextFor('mla', art, '50', '', 1), inI: A.inTextFor('ieee', art, '50', '', 3) };
});
check('IEEE article', plain(R.ieeeA) === 'A. Smith and B. Lee, "Deep learning for Arabic," Journal of AI, vol. 12, no. 3, pp. 45–67, 2020. https://doi.org/10.1000/xyz123', plain(R.ieeeA));
check('IEEE book', plain(R.ieeeB) === 'J. Doe, Research Methods, 2nd ed. London: Sage, 2019.', plain(R.ieeeB));
check('Harvard article', plain(R.harA) === "Smith, A. and Lee, B. (2020) 'Deep learning for Arabic', Journal of AI, 12(3), pp. 45–67. https://doi.org/10.1000/xyz123", plain(R.harA));
check('Harvard book', plain(R.harB) === 'Doe, J. (2019) Research Methods. 2nd edn. London: Sage.', plain(R.harB));
check('Chicago author-date article', plain(R.chiA) === 'Smith, Anna, and Brian Lee. 2020. "Deep learning for Arabic." Journal of AI 12 (3): 45–67. https://doi.org/10.1000/xyz123', plain(R.chiA));
check('Chicago author-date book', plain(R.chiB) === 'Doe, John. 2019. Research Methods. 2nd ed. London: Sage.', plain(R.chiB));
check('MLA 9 article', plain(R.mlaA) === 'Smith, Anna, and Brian Lee. "Deep learning for Arabic." Journal of AI, vol. 12, no. 3, 2020, pp. 45–67. https://doi.org/10.1000/xyz123', plain(R.mlaA));
check('MLA 9 book', plain(R.mlaB) === 'Doe, John. Research Methods. 2nd ed., Sage, 2019.', plain(R.mlaB));
check('In-text: Harvard (Smith and Lee, 2020, p. 50)', plain(R.inH) === '(Smith and Lee, 2020, p. 50)', plain(R.inH));
check('In-text: Chicago (Smith and Lee 2020, 50)', plain(R.inC) === '(Smith and Lee 2020, 50)', plain(R.inC));
check('In-text: MLA (Smith and Lee 50)', plain(R.inM) === '(Smith and Lee 50)', plain(R.inM));
check('In-text: IEEE [3, p. 50]', plain(R.inI) === '[3, p. 50]', plain(R.inI));

// 2) تبديل النمط في المستند: IEEE مرقّم بترتيب الظهور، وMLA عنوانها Works Cited
const sw = await pg.evaluate(() => {
  const A = window.WQ_API; const d = A.newDocModel('en');
  d.references = [{ id: 'ra', type: 'book', lang: 'en', authors: 'Zed, Z.', title: 'Zeta', year: '2001', publisher: 'P' }, { id: 'rb', type: 'book', lang: 'en', authors: 'Abel, A.', title: 'Alpha', year: '2002', publisher: 'Q' }].map((r) => Object.assign({ place: '', journal: '', volume: '', issue: '', pages: '', university: '', degree: '', url: '', accessed: '', editor: '', edition: '', death: '', doi: '' }, r));
  d.settings.citeStyle = 'apa';
  d.content.html = '<p dir="auto">A <span class="wq-cite" data-ref="ra" data-page="" data-vol="" contenteditable="false">[*]</span> B <span class="wq-cite" data-ref="rb" data-page="" data-vol="" contenteditable="false">[*]</span></p><div class="wq-bib" contenteditable="false"></div>';
  A.loadDocIntoEditor(d);
  A.setCiteStyle('ieee');
  const ieee = [Array.from(document.querySelectorAll('#page .wq-cite')).map((x) => x.textContent), Array.from(document.querySelectorAll('#page .bib-item')).map((x) => x.textContent.slice(0, 8))];
  A.setCiteStyle('mla');
  const mla = [document.querySelector('#page .wq-bib .wq-block-title').textContent, Array.from(document.querySelectorAll('#page .bib-item')).map((x) => x.textContent.slice(0, 4))];
  return { ieee, mla };
});
check('IEEE: numbered by first appearance, list in that order', JSON.stringify(sw.ieee[0]) === '["[1]","[2]"]' && sw.ieee[1][0].startsWith('[1] Z.') && sw.ieee[1][1].startsWith('[2] A.'), JSON.stringify(sw.ieee));
check('MLA: "Works Cited", alphabetical', sw.mla[0] === 'Works Cited' && sw.mla[1][0] === 'Abel' && sw.mla[1][1] === 'Zed,', JSON.stringify(sw.mla));
await pg.click('.tab:has-text("التوثيق")');
const opts = await pg.evaluate(() => Array.from(document.querySelector('.ribbon select.rsel').options).map((o) => o.value).join(','));
check('Style list has the 4 new styles', ['ieee', 'harvard', 'chicago', 'mla'].every((s) => opts.includes(s)), opts);

// 3) BibTeX وRIS
const bib = `@article{smith2020,
  author = {Smith, Anna and Brian Lee},
  title = {{Deep} learning for {A}rabic \\& more},
  journal = {Journal of AI}, volume = {12}, number = 3, pages = {45--67}, year = {2020}, doi = {10.1000/xyz123}
}
@book{doe, author = "John Doe", title = "Research Methods", publisher = {Sage}, address = {London}, year = 2019, edition = {2}}
@phdthesis{ali, author = {Ali, Omar}, title = {Thesis title}, school = {Cairo University}, year = {2018}}`;
const ris = `TY  - JOUR
AU  - Hassan, Mona
AU  - Karim, Ali
TI  - Arabic NLP survey
JO  - Computational Linguistics
VL  - 45
IS  - 2
SP  - 100
EP  - 130
PY  - 2021/05/01
DO  - 10.1162/coli_a_00001
ER  -
TY  - BOOK
AU  - Ibn Khaldun
TI  - Muqaddimah
PB  - Dar
PY  - 1980
ER  - `;
const P = await pg.evaluate(([b, r]) => { const A = window.WQ_API; return { b: A.parseBibTeX(b), r: A.parseRIS(r) }; }, [bib, ris]);
check('BibTeX: 3 entries with types', P.b.length === 3 && P.b[0].type === 'article' && P.b[1].type === 'book' && P.b[2].type === 'thesis' && P.b[2].degree === 'phd', JSON.stringify(P.b.map((x) => x.type)));
check('BibTeX: authors, braces, accents and pages cleaned', P.b[0].authors === 'Smith, Anna\nLee, Brian' && P.b[0].title === 'Deep learning for Arabic & more' && P.b[0].pages === '45–67' && P.b[0].issue === '3' && P.b[0].doi === '10.1000/xyz123' && P.b[1].authors === 'Doe, John', JSON.stringify(P.b[0]));
check('RIS: 2 entries, pages joined, year from date', P.r.length === 2 && P.r[0].type === 'article' && P.r[0].pages === '100–130' && P.r[0].year === '2021' && P.r[0].authors === 'Hassan, Mona\nKaram, Ali'.replace('Karam', 'Karim') && P.r[1].type === 'book', JSON.stringify(P.r[0]));
const imp = await pg.evaluate(([b]) => { const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('en')); const r1 = A.importRefs(A.parseBibTeX(b)); const r2 = A.importRefs(A.parseBibTeX(b)); return [r1, r2, WQ.doc.references.length]; }, [bib]);
check('Import adds 3, skips duplicates on re-import', imp[0].added === 3 && imp[1].added === 0 && imp[1].dup === 3 && imp[2] === 3, JSON.stringify(imp));
const exp = await pg.evaluate(() => { const A = window.WQ_API; const s = A.toBibTeX(WQ.doc.references); const back = A.parseBibTeX(s); return [s.slice(0, 80), back.length, back[0].title, back[0].pages]; });
check('BibTeX export round-trips', exp[1] === 3 && exp[2] === 'Deep learning for Arabic & more' && exp[3] === '45–67', JSON.stringify(exp));
await pg.click('.ribbon button:has-text("استيراد مراجع")');
await pg.fill('#riText', ris);
await pg.waitForTimeout(100);
const found = await pg.textContent('#riInfo');
await pg.click('.modal .actions .btn');
check('Import dialog: paste RIS → found and added', /٢|2/.test(found) && await pg.evaluate(() => WQ.doc.references.length === 5), found);

// 4) DOI (بيانات Crossref مُحاكاة)
const cr = await pg.evaluate(() => { const A = window.WQ_API;
  const m = { type: 'journal-article', title: ['A <i>study</i>'], author: [{ given: 'Anna', family: 'Smith' }, { given: 'B.', family: 'Lee' }], issued: { 'date-parts': [[2020, 5]] }, 'container-title': ['Nature'], volume: '580', issue: '7802', page: '123-130', publisher: 'Springer' };
  return [A.crossrefToRef(m, '10.1038/x'), A.cleanDOI('https://doi.org/10.1038/s41586-020-2012-7.'), A.cleanDOI('no doi')]; });
check('DOI: Crossref record mapped to a reference', cr[0].type === 'article' && cr[0].title === 'A study' && cr[0].authors === 'Smith, Anna\nLee, B.' && cr[0].year === '2020' && cr[0].pages === '123–130' && cr[0].journal === 'Nature', JSON.stringify(cr[0]));
check('DOI: cleaned from a URL; invalid rejected', cr[1] === '10.1038/s41586-020-2012-7' && cr[2] === '', JSON.stringify(cr.slice(1)));
await pg.evaluate(() => { const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('en')); });
await pg.click('.ribbon button:has-text("مرجع جديد")');
await pg.click('.modal .chip[data-tp="article"]');
check('Reference dialog has DOI field with fetch button', await pg.$('.modal input[data-f="doi"]') !== null && await pg.$('#doiBtn') !== null);
await pg.click('.modal header button');

// 5) الترقيم التمهيدي
const fr = await pg.evaluate(async () => {
  const A = window.WQ_API; const d = A.newDocModel('ar'); d.settings.frontNum = 'roman';
  d.content.html = '<p dir="auto">صفحة العنوان</p><hr class="wq-pagebreak"><h1 dir="auto">الإهداء</h1><p dir="auto">نص</p><hr class="wq-pagebreak"><h1 dir="auto">المستخلص</h1><p dir="auto">نص</p><hr class="wq-pagebreak"><div class="wq-toc" contenteditable="false"></div><hr class="wq-pagebreak"><h1 dir="auto">الفصل الأول</h1><p dir="auto">نص</p><hr class="wq-pagebreak"><h1 dir="auto">الفصل الثاني</h1>';
  A.loadDocIntoEditor(d); A.paginate();
  const nums = Array.from(document.querySelectorAll('#pagesView .pv-num')).map((x) => x.textContent);
  const toc = Array.from(document.querySelectorAll('#pagesView .toc-row')).map((r) => r.lastElementChild.textContent);
  A.setPagesView(false);
  const z = await unzip(await docxBuilder().build().arrayBuffer()); const x = await z.text('word/document.xml');
  return { nums, toc, sects: (x.match(/<w:sectPr>/g) || []).length, abjad: x.includes('w:fmt="arabicAbjad" w:start="1"'), main: /<w:pgNumType w:fmt="hindiNumbers" w:start="1"\/>(?!.*<w:titlePg\/>)/.test(x.slice(x.lastIndexOf('<w:sectPr>'))) };
});
check('Pages: front matter أ ب ج د, chapter 1 restarts at ١', JSON.stringify(fr.nums) === JSON.stringify(['', 'ب', 'ج', 'د', '١', '٢']), JSON.stringify(fr.nums));
check('TOC shows front letters and chapter numbers', JSON.stringify(fr.toc) === JSON.stringify(['ب', 'ج', '١', '٢']), JSON.stringify(fr.toc));
check('Word: two sections, abjad front, main restarts at 1', fr.sects === 2 && fr.abjad && fr.main, JSON.stringify(fr));

check('No page errors', errs.length === 0, errs.join(' | '));
await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
