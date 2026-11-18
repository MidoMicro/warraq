// ورّاق – برنامج الكمبيوتر (Electron): نافذة البرنامج، والملفات، والطباعة، وPDF النصّي
const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WEB = path.join(__dirname, 'web');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let win = null;
let pendingFile = fileFromArgs(process.argv);
let dirty = false;
let allowClose = false;

function fileFromArgs(argv) {
  const f = argv.slice(1).find((a) => /\.(warraq|docx|doc)$/i.test(a) && fs.existsSync(a));
  return f || null;
}
function readForRenderer(p) {
  const data = fs.readFileSync(p);
  return { path: p, name: path.basename(p), data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', (e, argv) => {
  const f = fileFromArgs(argv);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (f) win.webContents.send('open-file', readForRenderer(f)); }
});
app.on('open-file', (e, p) => { e.preventDefault(); if (win) win.webContents.send('open-file', readForRenderer(p)); else pendingFile = p; });

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, show: false,
    title: 'ورّاق – Warraq', icon: path.join(__dirname, 'build', 'icon.png'), backgroundColor: '#E9E3D7',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  try { win.webContents.session.setSpellCheckerLanguages(['ar', 'en-US', 'fr']); } catch (e) {}
  win.loadURL('app://warraq/index.html');
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // الروابط الخارجية تفتح في المتصفح
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // تعديلات غير محفوظة عند الإغلاق
  win.on('close', async (e) => {
    if (allowClose || !dirty) return;
    e.preventDefault();
    const r = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['حفظ', 'عدم الحفظ', 'إلغاء'], defaultId: 0, cancelId: 2,
      title: 'ورّاق', message: 'فيه تعديلات لم تُحفظ في الملف. تحب تحفظها قبل الإغلاق؟'
    });
    if (r.response === 2) return;
    if (r.response === 0) {
      const ok = await win.webContents.executeJavaScript('window.__wqDesktopSave ? window.__wqDesktopSave() : false', true).catch(() => false);
      if (!ok) return;
    }
    allowClose = true; win.close();
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = path.normalize(path.join(WEB, decodeURIComponent(u.pathname)));
    if (!p.startsWith(WEB)) return new Response('forbidden', { status: 403 });
    if (u.pathname === '/' || u.pathname === '') p = path.join(WEB, 'index.html');
    return net.fetch(pathToFileURL(p).toString());
  });
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
  } else Menu.setApplicationMenu(null);
  createWindow();
  setupUpdates();
});

/* ---------- التحديث التلقائي (من إصدارات GitHub) ----------
   يشتغل في البرنامج المثبّت فقط: يدوّر على نسخة جديدة بعد التشغيل بشوية، وينزّلها في الخلفية،
   ولما تخلص يسأل المستخدم. ولو اختار "لاحقاً" التحديث بيتثبّت لوحده لما يقفل البرنامج. */
function setupUpdates() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', () => { /* بدون إنترنت أو مشكلة مؤقتة: نحاول المرة الجاية */ });
  autoUpdater.on('update-available', (info) => { if (win) win.webContents.send('update-status', { state: 'downloading', version: info.version }); });
  autoUpdater.on('update-downloaded', async (info) => {
    if (!win) return;
    win.webContents.send('update-status', { state: 'ready', version: info.version });
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['إعادة التشغيل والتحديث', 'لاحقاً'], defaultId: 0, cancelId: 1, title: 'ورّاق',
      message: 'نسخة جديدة من ورّاق جاهزة (' + info.version + ')',
      detail: 'لو اخترت "لاحقاً" هيتم التحديث تلقائياً لما تقفل البرنامج. ملفاتك مش هتتأثر.'
    });
    if (r.response === 0) setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 10000);
  setInterval(check, 6 * 60 * 60 * 1000);
  ipcMain.handle('wq:checkUpdate', async () => {
    try { const r = await autoUpdater.checkForUpdates(); return r && r.updateInfo ? { version: r.updateInfo.version, current: app.getVersion() } : null; }
    catch (e) { return { error: true }; }
  });
}
app.on('window-all-closed', () => app.quit());

/* ---------- الجسر مع واجهة ورّاق ---------- */
ipcMain.handle('wq:pending', () => { const f = pendingFile; pendingFile = null; return f ? readForRenderer(f) : null; });
ipcMain.handle('wq:dirty', (e, v) => { dirty = !!v; return true; });
ipcMain.handle('wq:title', (e, t) => { if (win) win.setTitle(String(t || 'ورّاق')); return true; });
ipcMain.handle('wq:open', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [
    { name: 'ورّاق و Word', extensions: ['warraq', 'json', 'docx', 'doc'] }, { name: 'ورّاق', extensions: ['warraq'] }, { name: 'Word', extensions: ['docx', 'doc'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return readForRenderer(r.filePaths[0]);
});
const FILTERS = { warraq: 'ملف ورّاق', pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', png: 'صورة PNG', zip: 'ملف مضغوط' };
ipcMain.handle('wq:saveAs', async (e, { name, ext, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name + '.' + ext, filters: [{ name: FILTERS[ext] || ext, extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(data));
  return r.filePath;
});
ipcMain.handle('wq:write', (e, { path: p, data }) => { fs.writeFileSync(p, Buffer.from(data)); return true; });
ipcMain.handle('wq:pdf', async (e, { pageSize }) => {
  const buf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: pageSize || 'A4', margins: { marginType: 'none' } });
  return new Uint8Array(buf);
});
ipcMain.handle('wq:print', () => new Promise((res) => { win.webContents.print({ printBackground: true }, (ok) => res(ok)); }));
ipcMain.handle('wq:showItem', (e, p) => { shell.showItemInFolder(p); return true; });
ipcMain.handle('wq:version', () => app.getVersion());
