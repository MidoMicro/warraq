// الجسر الآمن بين واجهة ورّاق ونظام التشغيل
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('warraqDesktop', {
  isDesktop: true,
  platform: process.platform,
  pending: () => ipcRenderer.invoke('wq:pending'),
  setDirty: (v) => ipcRenderer.invoke('wq:dirty', v),
  setTitle: (t) => ipcRenderer.invoke('wq:title', t),
  open: () => ipcRenderer.invoke('wq:open'),
  saveAs: (name, ext, data) => ipcRenderer.invoke('wq:saveAs', { name, ext, data }),
  write: (path, data) => ipcRenderer.invoke('wq:write', { path, data }),
  pdf: (pageSize) => ipcRenderer.invoke('wq:pdf', { pageSize }),
  print: () => ipcRenderer.invoke('wq:print'),
  showItem: (p) => ipcRenderer.invoke('wq:showItem', p),
  onOpenFile: (cb) => ipcRenderer.on('open-file', (e, f) => cb(f)),
  version: () => ipcRenderer.invoke('wq:version'),
  checkUpdate: () => ipcRenderer.invoke('wq:checkUpdate'),
  onUpdate: (cb) => ipcRenderer.on('update-status', (e, s) => cb(s))
});
