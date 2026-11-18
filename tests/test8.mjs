// اختبار: أدوات الجدول (صفوف/أعمدة/حذف/حدود) + إطار الصفحة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
const clear = () => pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
await clear();
// جدول 3×3 بأرقام
await pg.evaluate(() => {
  const p = document.querySelector('#page');
  p.innerHTML = '<p dir="auto">قبل</p><table><tbody>' + [0, 1, 2].map((r) => '<tr>' + [0, 1, 2].map((c) => '<td dir="auto">' + r + c + '</td>').join('') + '</tr>').join('') + '</tbody></table><p dir="auto">بعد</p>';
});
const put = (sel) => pg.evaluate((sel) => { const c = document.querySelector(sel); const r = document.createRange(); r.selectNodeContents(c); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector('#page').focus(); }, sel);
const grid = () => pg.evaluate(() => Array.from(document.querySelector('#page table').rows).map((r) => Array.from(r.cells).map((c) => (c.textContent || '_') + (c.colSpan > 1 ? '^' + c.colSpan : '') + (c.rowSpan > 1 ? 'v' + c.rowSpan : '')).join(' ')));
await pg.click('.tab:has-text("جدول")');
check('Table tab exists with tools', await pg.$('.rb:has-text("صف فوق")') !== null && await pg.$('select[title="حدود الجدول"]') !== null);
await put('#page tr:nth-child(2) td:nth-child(2)'); // الخلية 11
await pg.click('.rb:has-text("صف تحت")');
let g = await grid();
check('Insert row below', g.length === 4 && g[2] === '_ _ _', JSON.stringify(g));
await put('#page tr:nth-child(1) td:nth-child(1)');
await pg.click('.rb:has-text("صف فوق")');
g = await grid(); check('Insert row above', g.length === 5 && g[0] === '_ _ _' && g[1] === '00 01 02');
// RTL: "عمود يمين" = قبل الخلية منطقياً
await put('#page tr:nth-child(2) td:nth-child(2)'); // 01
await pg.click('.rb:has-text("عمود يمين")');
g = await grid(); check('Insert column right (RTL = before)', g[1] === '00 _ 01 02', JSON.stringify(g[1]));
await put('#page tr:nth-child(2) td:nth-child(3)'); // 01
await pg.click('.rb:has-text("عمود شمال")');
g = await grid(); check('Insert column left (RTL = after)', g[1] === '00 _ 01 _ 02' && g.every((r) => r.split(' ').length === 5), JSON.stringify(g));
await put('#page tr:nth-child(2) td:nth-child(4)');
await pg.click('.rb:has-text("حذف العمود")');
await put('#page tr:nth-child(2) td:nth-child(2)');
await pg.click('.rb:has-text("حذف العمود")');
g = await grid(); check('Delete columns', g[1] === '00 01 02' && g.every((r) => r.split(' ').length === 3), JSON.stringify(g));
await put('#page tr:nth-child(1) td:nth-child(1)'); await pg.click('.rb:has-text("حذف الصف")');
await put('#page tr:nth-child(3) td:nth-child(1)'); await pg.click('.rb:has-text("حذف الصف")');
g = await grid(); check('Delete rows', JSON.stringify(g) === JSON.stringify(['00 01 02', '10 11 12', '20 21 22']), JSON.stringify(g));
// قائمة الزر الأيمن
await pg.click('#page tr:nth-child(3) td:nth-child(3)', { button: 'right' });
check('Right-click menu on cell', await pg.$('#tblMenu .ctx-item') !== null);
await pg.click('#tblMenu .ctx-item:has-text("صف تحت")');
g = await grid(); check('Context menu inserts row', g.length === 4 && !(await pg.$('#tblMenu')), JSON.stringify(g));
await pg.click('#page tr:nth-child(4) td:nth-child(1)', { button: 'right' });
await pg.click('#tblMenu .ctx-item:has-text("حذف الصف")');
// جدول مدمج: الإضافة والحذف تحافظ على الدمج
await pg.evaluate(() => { document.querySelector('#page table').outerHTML = '<table class="wq-grid"><colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup><tbody><tr><th rowspan="2" dir="auto">A</th><th colspan="2" dir="auto">B</th></tr><tr><th dir="auto">b1</th><th dir="auto">b2</th></tr><tr><td dir="auto">x</td><td dir="auto">1</td><td dir="auto">2</td></tr></tbody></table>'; });
await put('#page tr:nth-child(2) th:nth-child(1)'); // b1
await pg.click('.rb:has-text("عمود شمال")'); // بعد b1 → داخل نطاق B
g = await grid(); const cols = await pg.evaluate(() => document.querySelectorAll('#page col').length);
check('Merged: new column inside a spanned header widens it', g[0] === 'Av2 B^3' && g[1] === 'b1 _ b2' && g[2] === 'x 1 _ 2' && cols === 4, JSON.stringify(g));
await put('#page tr:nth-child(1) th:nth-child(1)'); // A (rowspan 2)
await pg.click('.rb:has-text("حذف الصف")');
g = await grid(); check('Merged: deleting first row moves rowspan cell down', g[0] === 'A b1 _ b2' && g.length === 2, JSON.stringify(g));
await put('#page tr:nth-child(1) th:nth-child(1)');
await pg.click('.rb:has-text("صف تحت")');
g = await grid(); check('Row below a header gets normal cells', g.length === 3 && await pg.evaluate(() => document.querySelector('#page tr:nth-child(2)').cells[0].tagName === 'TD'), JSON.stringify(g));
// الحدود
await put('#page tr:nth-child(3) td:nth-child(1)');
for (const [v, cls] of [['apa', 'bd-apa'], ['h', 'bd-h'], ['none', 'bd-none'], ['outside', 'bd-outside'], ['inside', 'bd-inside']]) {
  await pg.selectOption('select[title="حدود الجدول"]', v);
  const ok = await pg.evaluate((cls) => document.querySelector('#page table').classList.contains(cls), cls);
  if (!ok) check('Borders ' + v, false);
}
const bi = await pg.evaluate(() => { const c = document.querySelector('#page tr:nth-child(2) td:nth-child(2)'); const cs = getComputedStyle(c); return cs.borderTopStyle + ',' + cs.borderTopWidth; });
check('Border modes apply (inside → solid inner lines)', bi === 'solid,1px', bi);
await pg.selectOption('select[title="حدود الجدول"]', 'apa');
const saved = await pg.evaluate(() => { const A = window.WQ_API; const d = A.parseDoc(A.serializeDoc()); return d.content.html.includes('bd-apa'); });
check('Border style kept in .warraq file', saved);
// إطار الصفحة
await pg.click('.tab:has-text("تخطيط")');
await pg.selectOption('select[title="إطار الصفحة"]', 'double');
await pg.waitForTimeout(500);
const fr = await pg.evaluate(() => ({ pv: document.body.classList.contains('pages-mode'), n: document.querySelectorAll('.pv-page').length, f: document.querySelectorAll('.pv-page .pv-frame.f-double').length }));
check('Page border: every page gets a frame (auto pages view)', fr.pv && fr.n >= 1 && fr.f === fr.n, JSON.stringify(fr));
await pg.selectOption('select[title="لون الإطار"]', 'copper');
await pg.waitForTimeout(300);
const px = await pg.evaluate(() => { const pv = document.querySelector('.pv-page'); const fr = pv.querySelector('.pv-frame').getBoundingClientRect(), r0 = pv.getBoundingClientRect();
  const cv = window.WQ_API.drawPage(pv, 1); const d = cv.getContext('2d').getImageData(Math.round(fr.left - r0.left), Math.round(r0.height / 2), 4, 1).data; let best = [255, 255, 255]; for (let i = 0; i < 16; i += 4) if (d[i] + d[i + 1] + d[i + 2] < best[0] + best[1] + best[2]) best = [d[i], d[i + 1], d[i + 2]]; return best; });
check('Page border drawn in PDF/PNG (copper)', Math.abs(px[0] - 0xB8) < 30 && Math.abs(px[1] - 0x73) < 30, JSON.stringify(px));
await pg.selectOption('select[title="إطار الصفحة"]', 'thickThin'); await pg.waitForTimeout(300);
check('Thick & thin frame has inner line', await pg.evaluate(() => !!document.querySelector('.pv-frame.f-thickThin .pv-frame-in')));
// Word
const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.evaluate(() => exportDocx())]);
await dl.saveAs('/tmp/t8.docx');
const xml = execSync('unzip -p /tmp/t8.docx word/document.xml').toString();
check('Word: page border (pgBorders)', /<w:pgBorders w:offsetFrom="text"><w:top w:val="thickThinSmallGap"[^>]*w:color="B8732E"/.test(xml));
check('Word: APA table borders', /<w:tblBorders><w:top w:val="single" w:sz="12"[^>]*\/><w:left w:val="nil"\/>/.test(xml) && /<w:insideV w:val="nil"\/>/.test(xml) && /<w:tcBorders><w:bottom/.test(xml));
await pg.selectOption('select[title="إطار الصفحة"]', 'none'); await pg.waitForTimeout(300);
check('Page border off removes frame', await pg.evaluate(() => !document.querySelector('.pv-frame')));
check('No page errors', errs.length === 0, errs.join(' | '));
console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
await browser.close();
