/* ===== fileio: صيغة ملف \u200E.warraq\u200E والحفظ والفتح والحفظ التلقائي ===== */

/* بنية الملف (الإصدار 1): JSON بهذه الحقول.
   في نسخة الكمبيوتر سيصبح الملف حزمة مضغوطة بنفس البنية + الصور والقطات كملفات منفصلة. */
function serializeDoc() {
  const d = WQ.doc;
  d.content.html = editorHtml();
  d.meta.id = d.meta.id || ('d' + Date.now().toString(36));
  d.meta.title = $('#docTitle').value.trim();
  d.meta.modified = nowISO();
  return JSON.stringify({
    format: FILE_FORMAT,
    formatVersion: FILE_FORMAT_VERSION,
    app: { name: 'Warraq', version: APP_VERSION },
    meta: d.meta,
    settings: d.settings,
    content: d.content,
    references: d.references || [],
    footnotes: d.footnotes || {},
    snapshots: d.snapshots || []
  });
}

function parseDoc(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return null; }
  if (!o || o.format !== FILE_FORMAT || typeof o.formatVersion !== 'number' || !o.content) return null;
  const base = newDocModel(o.settings && o.settings.lang || 'ar');
  return {
    meta: Object.assign(base.meta, o.meta || {}),
    settings: Object.assign(base.settings, o.settings || {}),
    content: { html: sanitizeHtml(String(o.content.html || ''), true) },
    references: Array.isArray(o.references) ? o.references.filter((r) => r && ID_RE.test(r.id || '')).map(cleanRef) : [],
    footnotes: cleanFootnotes(o.footnotes),
    snapshots: Array.isArray(o.snapshots) ? o.snapshots.slice(-SNAP_MAX).filter((s) => s && ID_RE.test(s.id || '')).map((s) => ({
      id: s.id, at: String(s.at || ''), label: String(s.label || '').slice(0, 200), auto: !!s.auto, title: String(s.title || '').slice(0, 300), words: +s.words || 0,
      html: sanitizeHtml(String(s.html || ''), true), footnotes: cleanFootnotes(s.footnotes),
      references: Array.isArray(s.references) ? s.references.filter((r) => r && ID_RE.test(r.id || '')).map(cleanRef) : [],
      settings: Object.assign(newDocModel('ar').settings, s.settings || {}) })) : []
  };
}

function safeFileName() {
  const name = ($('#docTitle').value.trim() || t('untitled')).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);
  return name;
}

/* ---------- الحالة ---------- */
function setSaveState(kind) {
  const el = $('#saveState');
  el.textContent = t(kind);
  el.classList.toggle('dirty', kind !== 'saved');
}
let _autoT;
function markDirty() {
  WQ.dirty = true;
  if (typeof PV !== 'undefined') { PV.exact = false; PV.stale = true; }
  setSaveState('unsaved');
  maybeAutoSnapshot();
  clearTimeout(_autoT);
  _autoT = setTimeout(autosave, 1200);
}
function autosave() {
  const file = serializeDoc();
  if (lsSet(LS_KEY, { savedAt: nowISO(), dirty: WQ.dirty, file })) setSaveState(WQ.dirty ? 'autosaved' : 'saved');
  updateRecent(file);
}

/* ---------- حفظ ---------- */
let _noteShown = false;
async function saveFile() {
  const json = serializeDoc();
  const base = safeFileName();
  if (WQ.downloads) {
    try {
      await WQ.downloads.save({ filename: base + '.warraq.json', data: json });
      afterSave();
      if (!_noteShown) { _noteShown = true; setTimeout(() => toast(t('previewNote')), 2700); }
    } catch (err) {
      const code = err && err.code;
      toast(code === 'declined' ? t('saveDeclined') : t('saveUnavailable'));
    }
    return;
  }
  // خارج المعاينة (ملف محلي أو نسخة الكمبيوتر): تنزيل مباشر بامتداد \u200E.warraq\u200E
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = base + '.warraq';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    afterSave();
  } catch (e) { toast(t('saveUnavailable')); }
}
function afterSave() {
  WQ.dirty = false;
  setSaveState('saved');
  autosave();
  toast(t('saveOk'));
}

/* ---------- فتح ---------- */
function openFilePicker() { $('#fileOpen').value = ''; $('#fileOpen').click(); }
function onFileChosen(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const doc = parseDoc(String(r.result));
    if (!doc) { toast(t('openErr')); return; }
    loadDocIntoEditor(doc);
    WQ.dirty = false; setSaveState('saved'); autosave(); renderRibbon();
    toast(t('openOk'));
  };
  r.readAsText(f, 'utf-8');
}

/* ---------- جديد ---------- */
function newDocument(force) {
  if (WQ.dirty && !force) {
    showModal({
      title: t('newConfirmTitle'),
      body: '<p>' + escapeHtml(t('newConfirm')) + '</p>',
      actions: [
        { label: t('discard'), cls: 'btn2', run: () => newDocument(true) },
        { label: t('saveFirst'), cls: 'btn', run: () => saveFile() }
      ]
    });
    return;
  }
  openStart();
}

/* ---------- الاسترجاع عند الفتح ---------- */
function restoreOrNew() {
  const saved = lsGet(LS_KEY);
  const doc = saved && saved.file ? parseDoc(saved.file) : null;
  if (doc) {
    loadDocIntoEditor(doc);
    if (doc.content.html && page.innerText.trim()) toast(t('restored'));
    WQ.dirty = !!saved.dirty; setSaveState(WQ.dirty ? 'autosaved' : 'saved');
  } else {
    loadDocIntoEditor(newDocModel('ar'));
    WQ.dirty = false; setSaveState('saved');
  }
}
