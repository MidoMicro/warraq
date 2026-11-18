// اختبار نسخة الكمبيوتر: نحاكي جسر Electron، ونتأكد من الحفظ في نفس الملف والفتح وPDF النصّي
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const url = process.argv[2] || 'http://localhost:8765/index.html';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const pg = await ctx.newPage();
const errors = []; pg.on('pageerror', (e) => errors.push(String(e)));
const log = [];
await pg.exposeFunction('__mockLog', (x) => { log.push(JSON.parse(x)); });
let pdfBytes = null;
await pg.exposeFunction('__mockPdf', async () => {
  const b = await pg.pdf({ preferCSSPageSize: true, printBackground: true });
  pdfBytes = b; return Array.from(b.subarray(0, 8));
});
const sample = fs.readFileSync('tests/fixtures/sample.doc');
await pg.addInitScript((docBytes) => {
  const listeners = [];
  window.warraqDesktop = {
    isDesktop: true, platform: 'win32',
    pending: async () => null,
    setDirty: async (v) => { window.__mockLog(JSON.stringify({ op: 'dirty', v })); },
    setTitle: async (t) => { window.__mockLog(JSON.stringify({ op: 'title', t })); },
    open: async () => ({ path: 'C:\\Users\\x\\Documents\\old.doc', name: 'old.doc', data: new Uint8Array(docBytes) }),
    saveAs: async (name, ext, data) => { window.__mockLog(JSON.stringify({ op: 'saveAs', name, ext, size: data.length })); return 'C:\\Users\\x\\Documents\\' + name + '.' + ext; },
    write: async (path, data) => { window.__mockLog(JSON.stringify({ op: 'write', path, size: data.length })); return true; },
    pdf: async () => { const head = await window.__mockPdf(); return new Uint8Array(head); },
    print: async () => true, showItem: async () => true,
    onOpenFile: (cb) => listeners.push(cb)
  };
}, Array.from(sample));
await pg.goto(url); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
check('Desktop mode detected', await pg.evaluate(() => document.body.classList.contains('desktop')));
await pg.click('.tpl-card[data-tpl="paper"]'); await pg.waitForTimeout(300);
await pg.fill('#docTitle', 'Paper1');
await pg.click('#page'); await pg.keyboard.type('نص جديد');
await pg.keyboard.press('Control+s'); await pg.waitForTimeout(300);
await pg.keyboard.type(' وتعديل'); await pg.keyboard.press('Control+s'); await pg.waitForTimeout(300);
const saves = log.filter((x) => x.op === 'saveAs' || x.op === 'write');
check('First Ctrl+S asks where to save (.warraq)', saves[0] && saves[0].op === 'saveAs' && saves[0].ext === 'warraq', JSON.stringify(saves[0]));
check('Next Ctrl+S saves in the same file silently', saves[1] && saves[1].op === 'write' && saves[1].path.endsWith('Paper1.warraq'), JSON.stringify(saves[1]));
const titles = log.filter((x) => x.op === 'title').map((x) => x.t);
check('Window title: app name, isolated file name, unsaved dot', titles.some((x) => x.includes('Paper1.warraq') && x.endsWith(' •')) && titles[titles.length - 1].includes('\u2068Paper1.warraq\u2069') && !titles[titles.length - 1].endsWith('•'), JSON.stringify(titles.slice(-2)));
check('Unsaved state reported to the window (for close prompt)', log.some((x) => x.op === 'dirty' && x.v === true) && log.filter((x) => x.op === 'dirty').pop().v === false);
// حفظ باسم
await pg.keyboard.press('Control+Shift+s'); await pg.waitForTimeout(300);
check('Ctrl+Shift+S = Save as', log.filter((x) => x.op === 'saveAs').length === 2);
// PDF نصّي
await pg.evaluate(() => {
  const p = Array.from(document.querySelectorAll('#page > p')).find((x) => x.textContent.includes('اكتب هنا'));
  p.innerHTML = 'يُعدّ مفهوم التعلّم الذاتي (Self-directed Learning) من أبرز المفاهيم<sup class="wq-fn" data-fn="t1" contenteditable="false">*</sup>.';
  window.WQ_API.WQ.doc.footnotes.t1 = { refId: '', page: '', text: 'حاشية للاختبار' };
  window.WQ_API.refreshDerived();
});
const nPages = await pg.evaluate(() => window.WQ_API.paginate());
await pg.evaluate(() => exportPDF());
await pg.waitForTimeout(300);
fs.writeFileSync('/tmp/t6.pdf', pdfBytes);
const info = execSync('pdfinfo /tmp/t6.pdf').toString();
const txt = execSync('pdftotext -layout /tmp/t6.pdf -').toString();
const pdfPages = +(/Pages:\s+(\d+)/.exec(info) || [])[1];
check('Desktop PDF has same page count (no blank pages)', pdfPages === nPages, pdfPages + ' vs ' + nPages);
check('Desktop PDF text is selectable (Arabic + English)', /Self-directed/.test(txt) && /حاشية/.test(txt) && !/خريطة الرسالة/.test(txt), txt.slice(0, 80).replace(/\s+/g, ' '));
check('PDF saved through the save dialog', log.some((x) => x.op === 'saveAs' && x.ext === 'pdf'));
execSync('pdftoppm -r 40 -f 1 -l 1 -png /tmp/t6.pdf /tmp/t6p');
// فتح ملف .doc قديم من نافذة النظام
await pg.evaluate(() => openFilePicker()); await pg.waitForTimeout(600);
const opened = await pg.evaluate(() => ({ text: document.querySelector('#page').innerText.slice(0, 40), path: window.WQ_API.WQ.filePath, fn: document.querySelectorAll('#fnZone .fn-item').length }));
check('Open dialog imports old .doc (then Save asks for a new .warraq)', opened.text.includes('الفصل الأول') && opened.path === null && opened.fn === 1, JSON.stringify(opened));
check('No JavaScript errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
