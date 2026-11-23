// اختبار المرحلة 8: الرخصة والروابط في "عن ورّاق"، وزر الإبلاغ، وإشعارات التحديث التلقائي في نسخة الكمبيوتر
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  → ' + info : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
// 1) نسخة المتصفح
{
  const pg = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
  check('Version 0.9.2 shown', (await pg.textContent('.app-ver')).includes('0.9.2'));
  await pg.click('.tab:has-text("ملف")');
  check('File tab has "report a problem"', await pg.$('.rb:has-text("بلّغ عن مشكلة")') !== null);
  const [popup] = await Promise.all([pg.waitForEvent('popup'), pg.click('.rb:has-text("بلّغ عن مشكلة")')]);
  check('Report opens GitHub issue chooser', decodeURIComponent(popup.url()).includes('github.com/MidoMicro/warraq/issues/new/choose'), popup.url()); await popup.close();
  await pg.click('.rb:has-text("عن ورّاق")'); await pg.waitForTimeout(200);
  const about = await pg.evaluate(() => { const m = document.querySelector('.modal'); return { txt: m.textContent, links: Array.from(m.querySelectorAll('a')).map((a) => a.href), btns: Array.from(m.querySelectorAll('button')).map((b) => b.textContent) }; });
  check('About: GPL-3.0 + privacy + source links', about.txt.includes('GPL-3.0') && about.links.some((h) => h.endsWith('/privacy.html')) && about.links.some((h) => h === 'https://github.com/MidoMicro/warraq'), JSON.stringify(about.links));
  check('Web: no update button', !about.btns.some((b) => b.includes('التحديثات')));
}
// 2) نسخة الكمبيوتر (جسر Electron مُحاكى)
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript(() => {
    window.__upd = [];
    window.warraqDesktop = { isDesktop: true, platform: 'win32', pending: async () => null, setDirty: async () => {}, setTitle: async () => {}, open: async () => null,
      saveAs: async () => null, write: async () => true, pdf: async () => new Uint8Array(), print: async () => true, showItem: async () => true, onOpenFile: () => {},
      version: async () => '0.7.0', checkUpdate: async () => window.__nextCheck, onUpdate: (cb) => { window.__fireUpdate = cb; } };
  });
  const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelectorAll('.start-ov').forEach((x) => x.remove()));
  const toastText = () => pg.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  await pg.evaluate(() => window.__fireUpdate({ state: 'downloading', version: '0.7.1' })); await pg.waitForTimeout(100);
  check('Desktop: "downloading update" notice', (await toastText()).includes('0.7.1'), await toastText());
  await pg.evaluate(() => window.__fireUpdate({ state: 'ready', version: '0.7.1' })); await pg.waitForTimeout(100);
  check('Desktop: "update ready" notice', (await toastText()).includes('هتتثبّت'), await toastText());
  await pg.click('.tab:has-text("ملف")'); await pg.click('.rb:has-text("عن ورّاق")'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { window.__nextCheck = { version: '0.7.0', current: '0.7.0' }; });
  await pg.click('.modal button:has-text("التحقق من التحديثات")'); await pg.waitForTimeout(200);
  check('Desktop: check → up to date', (await toastText()).includes('أحدث نسخة'), await toastText());
  await pg.click('.rb:has-text("عن ورّاق")'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { window.__nextCheck = { error: true }; });
  await pg.click('.modal button:has-text("التحقق من التحديثات")'); await pg.waitForTimeout(200);
  check('Desktop: check offline → friendly error', (await toastText()).includes('الإنترنت'), await toastText());
}
check('No page errors', errs.length === 0, errs.join(' | '));
console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
await browser.close();
