/* ===== desktop: تشغيل ورّاق كبرنامج على الكمبيوتر (يُفعَّل فقط داخل نسخة الكمبيوتر) ===== */
function initDesktop() {
  const D = window.warraqDesktop;
  if (!D || !D.isDesktop) return;
  WQ.desktop = D; WQ.filePath = null;
  document.body.classList.add('desktop');
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
  const updateTitle = () => {
    const name = WQ.filePath ? WQ.filePath.split(/[\\/]/).pop() : (($('#docTitle').value || t('untitled')) + '.warraq');
    D.setTitle(t('appName') + ' — ' + '\u2068' + name + '\u2069' + (WQ.dirty ? ' •' : ''));
  };
  // الحفظ في نفس الملف (Ctrl+S) أو "حفظ باسم"
  saveFile = async function (asNew) {
    const bytes = enc.encode(serializeDoc());
    let p = WQ.filePath;
    if (!p || asNew === true) p = await D.saveAs(safeFileName(), 'warraq', bytes);
    else await D.write(p, bytes);
    if (!p) { toast(t('saveDeclined')); return false; }
    WQ.filePath = p; afterSave(); D.setDirty(false); updateTitle();
    return true;
  };
  window.__wqDesktopSave = () => saveFile(false);
  const md = markDirty;
  markDirty = function () { md(); D.setDirty(true); updateTitle(); };
  // الفتح من نافذة النظام (ورّاق وWord)
  const openDesktopFile = async (f) => {
    closeStart();
    if (/\.(docx?|DOCX?)$/.test(f.name)) { WQ.filePath = null; await importWordBytes(f.name, f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength)); updateTitle(); return; }
    const doc = parseDoc(dec.decode(f.data));
    if (!doc) { toast(t('openErr')); return; }
    loadDocIntoEditor(doc);
    WQ.filePath = /\.warraq$/i.test(f.path) ? f.path : null;
    WQ.dirty = false; setSaveState('saved'); autosave(); renderRibbon(); D.setDirty(false); updateTitle();
    toast(t('openOk'));
  };
  openFilePicker = async function () { const f = await D.open(); if (f) await openDesktopFile(f); };
  openDocxPicker = openFilePicker;
  const nd = newDocument;
  newDocument = function (force) { if (force || !WQ.dirty) WQ.filePath = null; nd(force); };
  const at = applyTemplate;
  applyTemplate = function (k) { WQ.filePath = null; at(k); updateTitle(); };
  // حفظ أي ملف مُصدَّر عبر نافذة الحفظ
  saveBlob = async function (base, ext, blob) {
    const p = await D.saveAs(base, ext, new Uint8Array(await blob.arrayBuffer()));
    if (!p) { toast(t('saveDeclined')); return false; }
    return true;
  };
  // تجهيز الصفحات للطباعة الحقيقية
  const preparePrint = async () => {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    const was = document.body.classList.contains('pages-mode');
    document.body.classList.add('pages-mode');
    paginate();
    const letter = WQ.doc.settings.pageSize === 'letter';
    let st = $('#wqPrintSize');
    if (!st) { st = document.createElement('style'); st.id = 'wqPrintSize'; document.head.appendChild(st); }
    st.textContent = '@media print{@page{size:' + (letter ? 'letter' : 'A4') + ';margin:0}.pv-page{width:' + (letter ? '8.5in' : '210mm') + '!important;height:' + (letter ? '11in' : '297mm') + '!important}}';
    const zoomWas = getComputedStyle(document.documentElement).getPropertyValue('--zoom');
    document.documentElement.style.setProperty('--zoom', 1);
    return () => { document.documentElement.style.setProperty('--zoom', zoomWas || 1); if (!was) document.body.classList.remove('pages-mode'); };
  };
  // PDF نصّي حقيقي (الكلام يتحدد ويتنسخ)
  exportPDF = async function () {
    toast(t('exporting'));
    const restore = await preparePrint();
    let bytes;
    try { bytes = await D.pdf(WQ.doc.settings.pageSize === 'letter' ? 'Letter' : 'A4'); } finally { restore(); }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    WQ._lastPdf = blob;
    if (await saveBlob(safeFileName(), 'pdf', blob)) toast(t('exportedPdf'));
    return blob;
  };
  doPrint = async function () { const restore = await preparePrint(); try { await D.print(); } finally { restore(); } };
  // ملف مفتوح بالدبل كليك أو من سطر الأوامر
  D.onOpenFile((f) => openDesktopFile(f));
  if (D.onUpdate) D.onUpdate((s) => toast(t(s.state === 'ready' ? 'updReady' : 'updDownloading').replace('{v}', s.version)));
  D.pending().then((f) => { if (f) openDesktopFile(f); else updateTitle(); });
  $('#docTitle').addEventListener('input', updateTitle);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopImmediatePropagation(); saveFile(true); }
  }, true);
}
