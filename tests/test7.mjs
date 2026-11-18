// اختبار 0.6.2: الجداول المدمجة (docx و doc) + تسطير الصفحة
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
const shape = () => pg.evaluate(() => { const t = document.querySelector('#page table'); if (!t) return null;
  const pr = document.querySelector('#page').getBoundingClientRect(), tr = t.getBoundingClientRect();
  return { over: Math.round(tr.right - pr.right) > 1 || Math.round(pr.left - tr.left) > 1, cols: t.querySelectorAll('col').length,
    rows: Array.from(t.rows).map((r) => Array.from(r.cells).map((c) => (c.colSpan > 1 ? 'c' + c.colSpan : '') + (c.rowSpan > 1 ? 'r' + c.rowSpan : '')).join(',')) }; });
const imp = async (f) => { await clear(); await pg.setInputFiles('#fileDocx', f); await pg.waitForTimeout(900); await clear(); };

await imp('tests/fixtures/merged-table.docx');
let s = await shape();
check('DOCX: merged header (rowspan + colspan)', s && s.rows[0] === 'r2,c3,c3,c3,c3' && s.rows[1].split(',').length === 12, JSON.stringify(s && s.rows.slice(0, 2)));
check('DOCX: column widths kept, table fits page', s && s.cols === 13 && !s.over);
check('DOCX: header rows become TH', await pg.evaluate(() => document.querySelectorAll('#page table tr:nth-child(2) th').length === 12));

await imp('tests/fixtures/merged-table.doc');
s = await shape();
check('DOC (Word 97): merged header read from row properties', s && s.rows[0] === 'r2,c3,c3,c3,c3' && s.rows.length === 5 && s.rows[4].split(',').length === 13, JSON.stringify(s && s.rows));
check('DOC: table fits page', s && !s.over && s.cols === 13);

// تصدير Word: الدمج الرأسي والأفقي
const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.evaluate(() => exportDocx())]);
const out = '/tmp/t7.docx'; await dl.saveAs(out);
const xml = execSync('unzip -p ' + out + ' word/document.xml').toString();
check('Word export: vMerge restart/continue + gridSpan', /<w:vMerge w:val="restart"\/>/.test(xml) && /<w:vMerge\/>/.test(xml) && (xml.match(/<w:gridSpan w:val="3"\/>/g) || []).length === 4);
check('Word export: real column widths', /<w:gridCol w:w="(\d+)"\/>/.test(xml) && new Set((xml.match(/<w:gridCol w:w="\d+"/g) || [])).size === 2);

// تقسيم الجدول عبر الصفحات: لا قطع داخل خلية مدمجة، وتكرار صفوف العنوان
await pg.evaluate(() => {
  const t = document.querySelector('#page table'); const tb = t.tBodies[0]; const last = tb.rows[tb.rows.length - 1];
  for (let i = 0; i < 60; i++) tb.append(last.cloneNode(true));
  t.querySelectorAll('tr:nth-child(-n+2) td').forEach((c) => { const h = document.createElement('th'); h.innerHTML = c.innerHTML; ['colspan', 'rowspan', 'dir'].forEach((a) => c.hasAttribute(a) && h.setAttribute(a, c.getAttribute(a))); c.replaceWith(h); });
  window.WQ_API.setPagesView(true);
});
await pg.waitForTimeout(400);
const split = await pg.evaluate(() => { const ts = Array.from(document.querySelectorAll('#pagesView table')); return { n: ts.length, head2: ts[1] && ts[1].rows[0].cells[0].rowSpan === 2 && ts[1].rows[1].cells.length === 12, cols: ts[1] && ts[1].querySelectorAll('col').length }; });
check('Pages: table split repeats both header rows + widths', split.n >= 2 && split.head2 && split.cols === 13, JSON.stringify(split));
await pg.evaluate(() => window.WQ_API.setPagesView(false));

// ملف الرسالة الحقيقي (list of tables)
await imp('/tmp/lot.doc');
s = await shape();
check('Real thesis .doc still imports its table', s && s.rows.length > 10 && !s.over, s && s.rows.length + ' rows');

// تسطير الصفحة
await pg.evaluate(() => { const A = window.WQ_API; A.WQ.doc.settings.ruled = 'off'; document.querySelector('#page').innerHTML = Array.from({ length: 4 }, () => '<p dir="auto">نص تجريبي على سطر الكراسة يمتد إلى أكثر من سطر واحد حتى نتحقق من أن كل الأسطر تقع على الخطوط في الصفحة.</p>').join(''); A.refreshDerived(); });
await pg.click('.tab:has-text("تخطيط")');
check('Ribbon: line spacing visible when not ruled', await pg.$('select[title="تباعد الأسطر"]') !== null);
await pg.selectOption('select[title="تسطير الصفحة"]', 'dots');
await pg.waitForTimeout(200);
const r = await pg.evaluate(() => { const p = document.querySelector('#page'); const cs = getComputedStyle(p); return { cls: p.classList.contains('ruled'), lh: parseFloat(cs.lineHeight), bg: cs.backgroundImage.includes('svg'), gapSel: !!document.querySelector('select[title="المسافة بين السطور"]'), ls: !!document.querySelector('select[title="تباعد الأسطر"]') }; });
check('Ruled: lines + line height = 1 cm', r.cls && r.bg && Math.abs(r.lh - 37.8) < 0.5, JSON.stringify(r));
check('Ruled: gap selector replaces line spacing', r.gapSel && !r.ls);
await pg.selectOption('select[title="المسافة بين السطور"]', '1.2');
const lh2 = await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#page')).lineHeight));
check('Ruled: gap 1.2 cm applied', Math.abs(lh2 - 45.35) < 0.5, String(lh2));
// كل سطر كتابة يقع فوق خط: خط الكتابة قريب من خط التسطير (أقل من 6 بكسل فوقه)
const align = await pg.evaluate(() => { const p = document.querySelector('#page'); const R = window.WQ_API.WQ._rule;
  const pTop = p.getBoundingClientRect().top; const sp = document.createElement('span'); sp.style.cssText = 'display:inline-block;width:0;height:0';
  const para = p.querySelector('p:nth-child(3)'); para.append(sp); const base = sp.getBoundingClientRect().top - pTop; sp.remove();
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
  const line = Math.ceil((base / z - R.off) / R.gap) * R.gap + R.off; return +(line - base / z).toFixed(1); });
check('Ruled: text baseline sits on the line', align >= 0 && align < 6, align + 'px');
await pg.evaluate(() => window.WQ_API.setPagesView(true)); await pg.waitForTimeout(300);
const pv = await pg.evaluate(() => ({ box: !!document.querySelector('.pv-box.ruled'), body: document.querySelector('.pv-body').classList.contains('ruled') }));
check('Ruled: pages view + PDF canvas draw lines', pv.box && pv.body && await pg.evaluate(() => { const cv = window.WQ_API.drawPage(document.querySelector('.pv-page'), 1); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 0x8D && d[i + 1] === 0xB4) n++; return n > 200; }));
const saved = await pg.evaluate(() => { const A = window.WQ_API; const o = JSON.parse(A.serializeDoc()); const d = A.parseDoc(JSON.stringify(o)); return d.settings.ruled + '/' + d.settings.ruleGap; });
check('Ruled: saved in .warraq file', saved === 'dots/1.2', saved);
check('No page errors', errs.length === 0, errs.join(' | '));
console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
await browser.close();
