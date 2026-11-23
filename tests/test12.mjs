// اختبار الدفعة ج (0.9.0): مكتبة الأحاديث — الإدراج والتخريج والأحكام المنسوبة والتحقق
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const HAR = /[ً-ْٰ]/g;
const load = (html, lang = 'ar', fns = {}) => pg.evaluate(async ([h, l, f]) => { const A = window.WQ_API; A.loadDocIntoEditor(Object.assign(A.newDocModel(l), { footnotes: f, content: { html: h } })); }, [html, lang, fns]);

// 1) الشريط
await pg.click('.tab:has-text("إدراج")');
const btns = await pg.evaluate(() => Array.from(document.querySelectorAll('.ribbon button')).map((b) => b.textContent));
check('Insert ribbon has Hadith and Verify-hadiths buttons', btns.some((x) => x.includes('حديث')) && btns.some((x) => x.includes('تحقّق من الأحاديث')), btns.filter((x) => /حديث|الأحاديث/.test(x)).join(' | '));

// 2) الفهرس والكتب
const idx = await pg.evaluate(async () => { const I = await window.WQ_API.loadHadithIndex(); return I.books.map((b) => b.id + ':' + b.count); });
check('Index lists the nine books', idx.length === 9 && ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'ahmad', 'darimi'].every((b) => idx.some((x) => x.startsWith(b + ':'))), idx.join(' '));
const total = idx.reduce((a, x) => a + +x.split(':')[1], 0);
check('About 65k hadiths bundled', total > 60000, String(total));

// 3) البحث والرقم والتخريج
const s1 = await pg.evaluate(async () => { const A = window.WQ_API; await A.loadHadithBook('bukhari'); return A.searchHadith(['bukhari'], 'إنما الأعمال بالنيات').slice(0, 3); });
check('Search without diacritics finds Bukhari 1', s1.length && s1[0][0] === 'bukhari' && s1[0][1] === '1', JSON.stringify(s1));
const tk = await pg.evaluate(async () => { const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('ar')); return A.hdTakhrij('bukhari', '1', true); });
check('Takhrij: «أخرجه البخاري (١).»', tk === 'أخرجه البخاري (١).', tk);
const tkAD = await pg.evaluate(async () => { const A = window.WQ_API; await A.loadHadithBook('abudawud'); return A.hdTakhrij('abudawud', '2201', true); });
check('Abu Dawud takhrij carries attributed Arabic grades', tkAD.startsWith('أخرجه أبو داود (٢٢٠١).') && /قال الألباني: /.test(tkAD) && /قال زبير علي زئي: /.test(tkAD), tkAD);
const mus = await pg.evaluate(async () => { const A = window.WQ_API; await A.loadHadithBook('muslim'); return [A.hdTakhrij('muslim', '11.02', false), A.searchHadith(['muslim'], 'الدين النصيحة').length]; });
check('Muslim sub-numbers cite the main number «مسلم (١١)»', mus[0] === 'أخرجه مسلم (١١).' && mus[1] >= 1, JSON.stringify(mus));
const matn = await pg.evaluate(async () => { const A = window.WQ_API; const B = await A.loadHadithBook('bukhari'); const tx = B.h[B.map.get('1')][1]; return tx.slice(A.hdMatnStart(tx), A.hdMatnStart(tx) + 30); });
check('Matn detection starts at «إنما الأعمال»', matn.replace(HAR, '').startsWith('إنما الأعمال'), matn);
const ahm = await pg.evaluate(async () => { const A = window.WQ_API; const a = await A.loadHadithBook('ahmad'); const d = await A.loadHadithBook('darimi'); return [a.h.length, a.h[0][1].slice(0, 20), d.h.length, /[‏‎]/.test(a.h[0][1])]; });
check('Musnad Ahmad and al-Darimi load, invisible marks cleaned', ahm[0] > 26000 && ahm[2] > 3300 && !ahm[3], JSON.stringify(ahm));

// 3ب) ظبط علامات الترقيم (0.9.1)
const typo = await pg.evaluate(async () => { const A = window.WQ_API; const sp = document.createElement('div'); A.loadDocIntoEditor(A.newDocModel('ar'));
  document.querySelector('#page').innerHTML = '<p>' + A.hadithSpan('bukhari', '1', 0, 0) + '</p>'; return document.querySelector('#page .wq-hadith').textContent; });
check('Inserted text: no space before ، or :, no stray quote', !/\s[،:]/.test(typo) && !typo.includes('"'), typo.slice(0, 80));
check('Letters and diacritics unchanged by tidying', await pg.evaluate(async () => { const A = window.WQ_API; const B = await A.loadHadithBook('bukhari'); const raw = B.h[B.map.get('1')][1];
  const strip = (x) => x.replace(/[^\u0621-\u0652\u0670]/g, ''); return strip(A.hdTypo(raw)) === strip(raw); }));
// 4) نافذة الإدراج: رقم ← معاينة وأحكام ← إدراج مع حاشية
await load('<p>قال النبي ﷺ: </p>');
await pg.evaluate(() => { const p = document.querySelector('#page p').firstChild; const r = document.createRange(); r.setStart(p, p.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
await pg.click('.ribbon button:has-text("حديث")');
await pg.waitForSelector('#hBook');
await pg.selectOption('#hBook', 'abudawud');
await pg.fill('#hNum', '٢٢٠١');
await pg.waitForTimeout(400);
const prev = await pg.evaluate(() => [document.querySelector('#hPrev').textContent.slice(0, 40), document.querySelector('#hGrades').textContent, document.querySelector('#hDorar').href]);
check('Dialog previews hadith with attributed grades', prev[0].includes('أبو داود (٢٢٠١)') && prev[1].includes('الألباني') && prev[1].includes('ورّاق لا يحكم'), prev[0] + ' / ' + prev[1].slice(0, 80));
check('Dorar button links to a dorar.net search', /^https:\/\/dorar\.net\/hadith\/search\?q=/.test(prev[2]), prev[2].slice(0, 70));
const defPart = await pg.evaluate(() => document.querySelector('.chip[data-p].on').dataset.p);
check('Dialog defaults to matn only', defPart === 'matn', defPart);
await pg.click('.modal .actions .btn');
const ins = await pg.evaluate(() => { const sp = document.querySelector('#page .wq-hadith'); const fn = document.querySelector('#page .wq-fn'); return { bk: sp && sp.dataset.bk, k: sp && sp.dataset.k, o: sp && sp.dataset.o, txt: sp && sp.textContent.slice(0, 30), fn: fn && WQ.doc.footnotes[fn.dataset.fn].text, after: sp && sp.nextSibling === fn }; });
check('Inserted protected hadith span (matn only)', ins.bk === 'abudawud' && ins.k === '2201' && +ins.o > 0 && ins.txt.startsWith('«'), JSON.stringify(ins).slice(0, 160));
check('Hadith text prints in the normal text colour', await pg.evaluate(() => getComputedStyle(document.querySelector('#page .wq-hadith')).color === getComputedStyle(document.querySelector('#page p')).color));
check('Footnote takhrij with grades placed right after it', ins.after && ins.fn.startsWith('أخرجه أبو داود (٢٢٠١).') && ins.fn.includes('قال الألباني'), ins.fn);

// 5) الحماية: نص معدّل يعود للأصل عند الفتح، والنسخ من خارج ورّاق لا ينشئ عناصر محمية
const saved = await pg.evaluate(() => window.WQ_API.serializeDoc());
const restored = await pg.evaluate(async (j) => {
  const A = window.WQ_API; const d = A.parseDoc(j);
  d.content.html = d.content.html.replace(/«[^»]+»/, '«نص معدّل»');
  A.loadDocIntoEditor(d); await new Promise((r) => setTimeout(r, 400));
  const sp = document.querySelector('#page .wq-hadith'); return sp.textContent.slice(0, 12) + '|' + sp.textContent.includes('معدّل');
}, saved);
check('Tampered hadith text restored from source on open', restored.endsWith('|false'), restored);
const san = await pg.evaluate(() => { const A = window.WQ_API; const h = '<span class="wq-hadith" data-bk="bukhari" data-k="1">«x»</span>'; return [A.sanitizeHtml(h, false), A.sanitizeHtml(h, true), A.sanitizeHtml('<span class="wq-hadith" data-bk="bukhari" data-k="1 onerror">«x»</span>', true)]; });
check('Sanitizer: pasted span becomes text, trusted span kept, bad attrs rejected', !san[0].includes('wq-hadith') && san[1].includes('data-k="1"') && !san[2].includes('wq-hadith'), san.join(' || '));

// 6) التحقق من الأحاديث المكتوبة يدوياً
const t0 = Date.now();
const m = await pg.evaluate(async () => {
  const A = window.WQ_API; await A.loadAllHadith();
  const a = A.matchHadith('إنما الأعمال بالنيات وإنما لكل امرئ ما نوى');
  const b = A.matchHadith('إنما الأعمال بالنية وإنما لكل امرئ ما نوى فمن كانت هجرته إلى دنيا يصيبها');
  const c = A.matchHadith('هذا كلام عادي ليس حديثا من الكتب أبدا ولا يشبهها');
  return [a && [a.bk, a.key, a.exact], b && [b.bk, b.exact, b.ops.filter((o) => o.t !== '=').map((o) => o.u || o.q)], c];
});
check('Exact typed hadith matched to its source', m[0] && m[0][2] === true, JSON.stringify(m[0]));
check('Changed word reported as a difference', m[1] && m[1][1] === false && m[1][2].some((w) => /النية/.test(w)), JSON.stringify(m[1]));
check('Non-hadith text not matched', m[2] === null);
check('Matching across all books is fast', Date.now() - t0 < 15000, (Date.now() - t0) + ' ms incl. loading');

await load('<p>وفي الحديث: «الدين النصيحة قلنا لمن قال لله ولكتابه ولرسوله ولأئمة المسلمين وعامتهم» وهو أصل عظيم.</p><p>وقال آخر: «كلام لا أصل له في كتب الحديث المعروفة عندنا»</p>');
await pg.click('.ribbon button:has-text("تحقّق من الأحاديث")');
await pg.waitForSelector('.qv-sum', { timeout: 20000 });
const hv = await pg.evaluate(() => [document.querySelector('.qv-sum').textContent, Array.from(document.querySelectorAll('.qv-item')).map((x) => x.className + ':' + x.querySelector('.qv-head').textContent.slice(0, 60))]);
check('Verify dialog: one found, one not found', hv[1].length === 2 && /مسلم/.test(hv[1][0]) && hv[1][1].includes('no'), JSON.stringify(hv));
await pg.click('.hv-fix');
const rep = await pg.evaluate(() => { const sp = document.querySelector('#page .wq-hadith'); const fn = sp && sp.nextSibling; return { bk: sp && sp.dataset.bk, t: sp && sp.textContent.replace(/[ً-ْٰ]/g, '').slice(0, 20), fn: fn && fn.classList && fn.classList.contains('wq-fn') ? WQ.doc.footnotes[fn.dataset.fn].text : '', left: document.querySelector('#page p').textContent.includes('وهو أصل عظيم') }; });
check('Replace inserts source text + takhrij footnote, keeps surrounding text', rep.bk === 'muslim' && rep.t.startsWith('«الدين النصيحة') && rep.fn.startsWith('أخرجه مسلم') && rep.left, JSON.stringify(rep));
await pg.click('.modal .actions .btn');

// 7) مستند إنجليزي
const en = await pg.evaluate(() => { const A = window.WQ_API; A.loadDocIntoEditor(A.newDocModel('en')); return A.hdTakhrij('bukhari', '1', false); });
check('English takhrij', en === 'Narrated by al-Bukhari (1).', en);

check('No page errors', errs.length === 0, errs.join(' | '));
await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
