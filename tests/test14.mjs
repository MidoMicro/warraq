// اختبار 0.9.4: فهرس الآيات وفهرس الأحاديث
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));

// مستند: آيات وأحاديث على صفحات مختلفة (فاصل صفحة)، وآية مكررة
await pg.evaluate(async () => {
  const A = window.WQ_API; await A.loadQuran(); await A.loadHadithBook('bukhari'); await A.loadHadithBook('abudawud');
  const d = A.newDocModel('ar');
  const ay = (s, a, b) => '<span class="wq-ayah" data-s="' + s + '" data-a="' + a + '" data-b="' + b + '" contenteditable="false" dir="rtl" lang="ar">﴿x﴾</span>';
  d.content.html = '<div class="wq-idx-ayat" contenteditable="false"></div><div class="wq-idx-hadith" contenteditable="false"></div><hr class="wq-pagebreak">' +
    '<p dir="auto">قال تعالى ' + ay(2, 255, 255) + ' وقال ' + ay(1, 1, 7) + '</p><p dir="auto">' + A.hadithSpan('bukhari', '1', 0, 0) + '</p>' +
    '<hr class="wq-pagebreak"><p dir="auto">' + ay(2, 255, 255) + ' ' + A.hadithSpan('abudawud', '2201', 0, 0) + '</p>';
  A.loadDocIntoEditor(d);
  await new Promise((r) => setTimeout(r, 600));
});
const ia = await pg.evaluate(() => Array.from(document.querySelectorAll('#page .wq-idx-ayat .idx-row:not(.idx-head)')).map((r) => Array.from(r.children).map((c) => c.textContent)));
check('Verse index lists 2 entries (duplicate merged)', ia.length === 2, JSON.stringify(ia).slice(0, 200));
check('Verse index in Mushaf order with surah names', ia[0] && ia[0][2] === 'الفاتحة' && ia[1][2] === 'البقرة' && ia[0][3] === '١–٧' && ia[1][3] === '٢٥٥', JSON.stringify(ia.map((r) => r.slice(2))));
const ih = await pg.evaluate(() => Array.from(document.querySelectorAll('#page .wq-idx-hadith .idx-row:not(.idx-head)')).map((r) => Array.from(r.children).map((c) => c.textContent)));
check('Hadith index lists both hadiths with references', ih.length === 2 && ih.some((r) => r[2] === 'البخاري (١)') && ih.some((r) => r[2] === 'أبو داود (٢٢٠١)'), JSON.stringify(ih.map((r) => r[2])));
check('Hadith index sorted alphabetically by its opening words', ih.length === 2 && ih[0][1].replace(/[ً-ْ]/g, '').localeCompare(ih[1][1].replace(/[ً-ْ]/g, ''), 'ar') <= 0);
check('No verse in the index is flagged as broken', await pg.evaluate(() => !document.querySelector('#page .ayah-bad')));

// أرقام الصفحات الحقيقية بعد عرض الصفحات
await pg.evaluate(() => window.WQ_API.paginate());
const pv = await pg.evaluate(() => [Array.from(document.querySelectorAll('#pagesView .wq-idx-ayat .idx-row:not(.idx-head)')).map((r) => r.lastElementChild.textContent),
  Array.from(document.querySelectorAll('#page .wq-idx-ayat .idx-row:not(.idx-head)')).map((r) => r.lastElementChild.textContent)]);
check('Pages view: Al-Baqarah 255 on pages ٢ and ٣', pv[0][1] === '٢، ٣' && pv[0][0] === '٢', JSON.stringify(pv[0]));
check('Editor index updated with exact pages too', pv[1][1] === '٢، ٣', JSON.stringify(pv[1]));
await pg.evaluate(() => window.WQ_API.setPagesView(false));

// لا تُحسب في عدد الكلمات، ولا يلتقطها التحقق من الآيات/الأحاديث
const wc = await pg.evaluate(() => { const A = window.WQ_API; const n1 = A.countWords().words; const b = document.querySelector('#page .wq-idx-ayat'); const h = document.querySelector('#page .wq-idx-hadith'); const x = b.outerHTML + h.outerHTML; b.remove(); h.remove(); const n2 = A.countWords().words; return [n1, n2]; });
check('Index text not counted as words', wc[0] === wc[1], JSON.stringify(wc));

// الحفظ والفتح
const re = await pg.evaluate(async () => { const A = window.WQ_API; const d = A.newDocModel('ar'); d.content.html = '<div class="wq-idx-ayat" contenteditable="false"><p>old</p></div><p dir="auto">نص</p>';
  A.loadDocIntoEditor(d); const j = A.serializeDoc(); const d2 = A.parseDoc(j); return [d2.content.html.includes('wq-idx-ayat'), A.sanitizeHtml('<div class="wq-idx-hadith">x</div>', false).includes('wq-idx')]; });
check('Index block kept on save, rejected from outside paste', re[0] && !re[1], JSON.stringify(re));

// Word
const dx = await pg.evaluate(async () => {
  const A = window.WQ_API; await A.loadQuran(); const d = A.newDocModel('ar');
  d.content.html = '<div class="wq-idx-ayat" contenteditable="false"></div><p dir="auto"><span class="wq-ayah" data-s="112" data-a="1" data-b="4" contenteditable="false" dir="rtl" lang="ar">﴿x﴾</span></p>';
  A.loadDocIntoEditor(d); await new Promise((r) => setTimeout(r, 300)); A.renderCitations();
  const z = await unzip(await docxBuilder().build().arrayBuffer()); return await z.text('word/document.xml');
});
check('Word: verse index exported as a table with header row', /<w:tbl>.*<w:tblHeader\/>.*الإخلاص.*<\/w:tbl>/.test(dx));

// الأزرار
await pg.click('.tab:has-text("الرسالة")');
const btn = await pg.evaluate(() => Array.from(document.querySelectorAll('.ribbon button')).map((b) => b.textContent).join('|'));
check('Thesis tab has both index buttons', btn.includes('فهرس الآيات') && btn.includes('فهرس الأحاديث'), btn);
await pg.evaluate(() => { const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('ar')); });
await pg.click('#page');
await pg.click('.ribbon button:has-text("فهرس الأحاديث")');
check('Button inserts the hadith index block', await pg.evaluate(() => !!document.querySelector('#page .wq-idx-hadith .wq-block-title')));

check('No page errors', errs.length === 0, errs.join(' | '));
await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
