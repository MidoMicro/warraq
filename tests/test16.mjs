// اختبار 0.11.0: الشريط المجمّع، المسطرة (الهوامش ومسافات الفقرة)، تباعد أسطر الفقرة، البحث والاستبدال، ناسخ التنسيق، والتصدير
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
const pg = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
const DOC = '<h1 dir="auto">الفصل الأول</h1><p dir="auto">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ، هذه فقرة تجريبية طويلة نسبياً لنرى المسافة البادئة والمسافة المعلقة، والبحث عن كلمة الله في النص.</p><p dir="auto">فقرة ثانية فيها كلمة الله أيضاً وكلمة الإله.</p>';
const load = (html) => pg.evaluate((h) => { const A = window.WQ_API; const d = A.newDocModel('ar'); d.content.html = h; A.loadDocIntoEditor(d); }, html);
await load(DOC);

// 1) الشريط المجمّع
const groups = await pg.$$eval('.ribbon .rg-label', (xs) => xs.map((x) => x.textContent));
check('Home ribbon has labelled groups', ['الحافظة', 'الخط', 'الفقرة', 'الأنماط', 'العربية', 'التحرير'].every((g) => groups.includes(g)), groups.join('|'));
check('Ribbon uses Warraq SVG icons', await pg.$$eval('.ribbon svg.wq-ic', (x) => x.length) >= 15);
check('Clipboard/painter/find buttons exist', await pg.$('.ribbon button:has-text("لصق")') && await pg.$('.ribbon button:has-text("نسخ التنسيق")') && await pg.$('.ribbon button:has-text("استبدال")') ? true : false);
check('Styles gallery reflects current block', await (async () => { await pg.click('#page h1'); await pg.waitForTimeout(100); return pg.$eval('.sg[data-block="H1"]', (b) => b.classList.contains('on')); })());

// 2) الهوامش المركزية
const pm = await pg.evaluate(() => { const A = window.WQ_API; return [A.pageMargins({ margins: 'normal' }), A.pageMargins({ margins: 'wide' }), A.pageMargins({ margins: 'custom', mT: 3, mB: 2, mL: 1.5, mR: 4 }), A.pageMargins({ margins: 'custom', mT: 'x', mB: 99, mL: 0, mR: 2 })]; });
check('pageMargins presets & custom (clamped)', pm[1].l === 5.08 && pm[1].t === 2.54 && pm[2].r === 4 && pm[2].l === 1.5 && pm[3].t === 2.5 && pm[3].b === 8 && pm[3].l === 0.3, JSON.stringify(pm));

// 3) المسطرة: سحب الهامش الأيسر
await pg.click('#page p'); await pg.waitForTimeout(150);
const k = await pg.evaluate(() => document.querySelector('#sheet').getBoundingClientRect().width / 21);
const ed = await pg.$eval('.ru-edge', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 5 }; });
await pg.mouse.move(ed.x, ed.y); await pg.mouse.down(); await pg.mouse.move(ed.x + k, ed.y, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
const mg = await pg.evaluate(() => { const s = window.WQ_API.WQ.doc.settings; const cs = getComputedStyle(document.querySelector('#sheet')); return { m: s.margins, l: s.mL, r: s.mR, pl: parseFloat(cs.paddingLeft) / 37.7953, pr: parseFloat(cs.paddingRight) / 37.7953 }; });
check('Dragging ruler margin → custom margins (left 3.5, right 2.5)', mg.m === 'custom' && Math.abs(mg.l - 3.5) < 0.01 && mg.r === 2.5, JSON.stringify(mg));
check('Sheet padding follows custom margins', Math.abs(mg.pl - 3.5) < 0.02 && Math.abs(mg.pr - 2.5) < 0.02, JSON.stringify(mg));

// 4) المسطرة: السطر الأول (عربي: السحب لليسار = للداخل)
await pg.click('#page p'); await pg.waitForTimeout(150);
const drag = async (sel, dx, dy = 0) => { const b = await pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await pg.mouse.move(b.x, b.y); await pg.mouse.down(); await pg.mouse.move(b.x + dx, b.y + dy, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(120); };
await drag('.ru-first', -k);
let st = await pg.$eval('#page p', (p) => ({ ti: p.style.textIndent, mr: p.style.marginRight }));
check('First-line marker → text-indent 1cm', st.ti === '1cm', JSON.stringify(st));
await drag('.ru-hang', -2 * k);
st = await pg.$eval('#page p', (p) => ({ ti: p.style.textIndent, mr: p.style.marginRight }));
check('Hanging marker moves start, keeps first line in place', st.mr === '2cm' && st.ti === '-1cm', JSON.stringify(st));
await drag('.ru-box', k);
st = await pg.$eval('#page p', (p) => ({ ti: p.style.textIndent, mr: p.style.marginRight }));
check('Start box moves both (start 1cm, indent kept)', st.mr === '1cm' && st.ti === '-1cm', JSON.stringify(st));
const endB = await pg.$eval('.ru-end', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height - 2 }; });
await pg.mouse.move(endB.x, endB.y); await pg.mouse.down(); await pg.mouse.move(endB.x + 1.5 * k, endB.y, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(120);
st = await pg.$eval('#page p', (p) => p.style.marginLeft);
check('End marker → end indent 1.5cm (left side in Arabic)', st === '1.5cm', st);
const pos = await pg.evaluate(() => { const p = document.querySelector('#page p'), A = window.WQ_API; const r = A.rulerBlockPos(p, { W: 21, m: A.pageMargins(A.WQ.doc.settings), k: document.querySelector('#sheet').getBoundingClientRect().width / 21 }); return r; });
check('Ruler reads paragraph geometry back (start 17.5, first 16.5)', Math.abs(pos.start - 17.5) < 0.05 && Math.abs(pos.first - 18.5) < 0.05 && Math.abs(pos.end - 5) < 0.05, JSON.stringify(pos));

// 5) زيادة/إنقاص المسافة البادئة وتباعد أسطر الفقرة
await load(DOC);
await pg.click('#page p'); await pg.waitForTimeout(100);
await pg.click('.ribbon button[title="زيادة المسافة البادئة"]');
check('Increase indent → 1.27cm start', await pg.$eval('#page p', (p) => p.style.marginRight) === '1.27cm');
await pg.click('.ribbon button[title="إنقاص المسافة البادئة"]');
check('Decrease indent → 0', await pg.$eval('#page p', (p) => p.style.marginRight) === '0cm');
await pg.selectOption('#paraLs', '2');
check('Paragraph line spacing 2.0 applied to that paragraph only', await pg.evaluate(() => { const ps = document.querySelectorAll('#page p'); return ps[0].style.lineHeight === '2' && !ps[1].style.lineHeight; }));
await pg.click('#page p:nth-of-type(2)'); await pg.waitForTimeout(100);
check('Line spacing select follows the cursor', await pg.$eval('#paraLs', (s) => s.value) === '');
const rt = await pg.evaluate(() => { const A = window.WQ_API; document.querySelector('#page p').style.textIndent = '1cm'; const html = A.serializeDoc(); const d = A.parseDoc(html); A.loadDocIntoEditor(d); const p = document.querySelector('#page p'); return [p.style.lineHeight, p.style.textIndent]; });
check('Saved file keeps line-height and text-indent', rt[0] === '2' && rt[1] === '1cm', JSON.stringify(rt));

// 6) Word: التباعد والمسافات والهوامش المخصصة
const wx = await pg.evaluate(async () => {
  const A = window.WQ_API, s = A.WQ.doc.settings; Object.assign(s, { margins: 'custom', mT: 3, mB: 2, mL: 1.5, mR: 4 });
  const p = document.querySelector('#page p'); p.style.marginRight = '2cm'; p.style.marginLeft = '0.5cm'; p.style.textIndent = '-1cm';
  const z = await unzip(await docxBuilder().build().arrayBuffer()); return z.text('word/document.xml');
});
check('Word: paragraph spacing line=480', wx.includes('<w:spacing w:line="480" w:lineRule="auto"/>'));
check('Word: logical indents (start=right in RTL) + hanging', wx.includes('<w:ind w:left="1134" w:right="284" w:hanging="567"/>'), (wx.match(/<w:ind [^>]*>/) || [''])[0]);
check('Word: custom page margins', wx.includes('w:top="1701" w:right="2268" w:bottom="1134" w:left="851"'), (wx.match(/<w:pgMar [^>]*>/) || [''])[0]);
check('Word: pPr order bidi → spacing → ind → jc', /<w:bidi\/><w:spacing [^>]*\/><w:ind [^>]*\/><w:jc /.test(wx));

const imp = await pg.evaluate(async () => { const r = await window.WQ_API.docxToWarraq(await docxBuilder().build().arrayBuffer()); const d = document.createElement('div'); d.innerHTML = r.html; const p = Array.from(d.querySelectorAll('p')).find((x) => x.textContent.includes('بسم') || x.textContent.includes('بِسْمِ')); return p ? p.getAttribute('style') : ''; });
check('Word import keeps indents and line spacing', /margin-right: 2cm/.test(imp) && /margin-left: 0\.5cm/.test(imp) && /text-indent: -1cm/.test(imp) && /line-height: 2/.test(imp), imp);

// 7) عرض الصفحات بهوامش غير متماثلة
const pv = await pg.evaluate(() => { const A = window.WQ_API; A.paginate(); const p = document.querySelector('#pagesView .pv-page'); const cs = getComputedStyle(p); const r = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((x) => Math.round(parseFloat(x) / 37.7953 * 100) / 100); A.setPagesView(false); return r; });
check('Pages view uses asymmetric margins (3, 4, 2, 1.5)', JSON.stringify(pv) === '[3,4,2,1.5]', JSON.stringify(pv));

// 8) البحث والاستبدال
await load(DOC + '<p dir="auto">نص <span class="wq-hadith" data-bk="bukhari" data-k="1" contenteditable="false" dir="rtl" lang="ar">قال الله في حديث</span> بعده.</p>');
await pg.click('#page p'); await pg.keyboard.press('Control+f'); await pg.waitForTimeout(100);
check('Ctrl+F opens find bar (replace hidden)', await pg.$('#findBar') !== null && !(await pg.$eval('#findBar', (b) => b.classList.contains('with-rep'))));
await pg.waitForTimeout(600);
const HD = await pg.$eval('.wq-hadith', (h) => h.textContent);
const inHd = await pg.evaluate((h) => { const A = window.WQ_API; return (h.replace(/[\u064B-\u065F\u0670\u0640]/g, '').match(/الله/g) || []).length; }, HD);
await pg.fill('#frFind', 'الله'); await pg.waitForTimeout(150);
const nAll = await pg.evaluate(() => window.WQ_API.FR.hits.length), nProt = await pg.evaluate(() => window.WQ_API.FR.hits.filter((h) => h.prot).length);
check('Ignore diacritics: اللهِ + الله ×2 outside, plus matches inside the hadith (marked protected)', nAll === 3 + inHd && nProt === inHd && inHd > 0, nAll + ' / prot ' + nProt + ' / ' + inHd);
await pg.fill('#frFind', 'الرحمن'); await pg.waitForTimeout(100);
const rh1 = await pg.evaluate(() => window.WQ_API.FR.hits.filter((h) => !h.prot).length);
await pg.click('#frTk'); await pg.waitForTimeout(100);
const rh0 = await pg.evaluate(() => window.WQ_API.FR.hits.filter((h) => !h.prot).length);
check('"الرحمن" matches الرَّحْمَنِ only when ignoring diacritics', rh1 === 1 && rh0 === 0, rh1 + '/' + rh0);
await pg.click('#frTk');
await pg.click('#frWw'); await pg.fill('#frFind', 'فقرة'); await pg.waitForTimeout(100);
const ww = await pg.evaluate(() => window.WQ_API.FR.hits.length);
await pg.fill('#frFind', 'فقر'); await pg.waitForTimeout(100);
check('Whole word: "فقرة" 2, "فقر" 0', ww === 2 && await pg.evaluate(() => window.WQ_API.FR.hits.length) === 0);
await pg.click('#frWw');
await pg.keyboard.press('Escape');
check('Esc closes find bar', await pg.$('#findBar') === null);
await pg.click('#page p'); await pg.keyboard.press('Control+h'); await pg.waitForTimeout(100);
check('Ctrl+H opens with replace row', await pg.$eval('#findBar', (b) => b.classList.contains('with-rep')));
await pg.fill('#frFind', 'الله'); await pg.fill('#frRep', 'الرب'); await pg.waitForTimeout(100);
await pg.press('#frFind', 'Enter'); await pg.waitForTimeout(100);
check('Enter selects first result and shows 1 / N', (await pg.$eval('#frCount', (c) => c.textContent)).startsWith('١ / '), await pg.$eval('#frCount', (c) => c.textContent));
const snaps0 = await pg.evaluate(() => (window.WQ_API.WQ.doc.snapshots || []).length);
await pg.click('#frAll'); await pg.waitForTimeout(150);
const after = await pg.evaluate(() => ({ txt: document.querySelector('#page').textContent, hd: document.querySelector('.wq-hadith').textContent, snaps: (window.WQ_API.WQ.doc.snapshots || []).length }));
check('Replace all: 3 replaced, protected hadith untouched', (after.txt.match(/الرب/g) || []).length === 3 && after.hd === HD, after.txt.slice(0, 80));
check('Snapshot taken before replace all', after.snaps === snaps0 + 1, after.snaps + ' vs ' + snaps0);
await pg.fill('#frFind', 'ثانية'); await pg.fill('#frRep', 'أخرى'); await pg.waitForTimeout(100);
await pg.click('#frOne'); await pg.waitForTimeout(50); await pg.click('#frOne'); await pg.waitForTimeout(100);
check('Replace one works (undoable insertText)', await pg.evaluate(() => document.querySelector('#page').textContent.includes('فقرة أخرى')));
await pg.click('#frClose');

// 9) ناسخ التنسيق
await load('<p dir="auto"><b><span style="font-size: 20pt;">منسّق</span></b> عادي هنا</p>');
await pg.evaluate(() => { const s = document.querySelector('#page span'); const r = document.createRange(); r.setStart(s.firstChild, 2); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); });
await pg.click('.ribbon button:has-text("نسخ التنسيق")');
check('Painter armed (cursor class)', await pg.evaluate(() => document.body.classList.contains('painting')));
await pg.evaluate(() => { const p = document.querySelector('#page p'); const t = p.lastChild; const r = document.createRange(); r.setStart(t, 1); r.setEnd(t, 5); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); });
await pg.dispatchEvent('#page', 'mouseup'); await pg.waitForTimeout(150);
const pt = await pg.evaluate(() => { const w = document.createTreeWalker(document.querySelector('#page p'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode()) && !n.textContent.includes('عادي')); const cs = getComputedStyle(n.parentNode); return { w: cs.fontWeight, size: Math.round(parseFloat(cs.fontSize) * 0.75), armed: document.body.classList.contains('painting') }; });
check('Painter applies bold + 20pt and disarms', +pt.w >= 700 && pt.size === 20 && !pt.armed, JSON.stringify(pt));

// 10) نافذة الهوامش وإخفاء المسطرة
await pg.evaluate(() => window.WQ_API.openMarginsDialog());
await pg.fill('#mgT', '2'); await pg.fill('#mgL', '3'); await pg.click('.modal .btn');
const md = await pg.evaluate(() => { const s = window.WQ_API.WQ.doc.settings; return [s.margins, s.mT, s.mL]; });
check('Custom margins dialog', md[0] === 'custom' && md[1] === 2 && md[2] === 3, JSON.stringify(md));
await pg.click('.tab:has-text("تخطيط")');
check('Layout margins select shows custom', await pg.$eval('select[title="الهوامش"]', (s) => s.value) === 'custom');
await pg.click('.tab:has-text("عرض")'); await pg.click('.ribbon button:has-text("المسطرة")');
check('View → ruler toggles off', await pg.evaluate(() => getComputedStyle(document.querySelector('#ruler')).display === 'none'));
await pg.click('.ribbon button:has-text("المسطرة")');

check('No page errors', errs.length === 0, errs.join(' | '));
console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
await browser.close();
