/* ===== ui: الشريط والتبويبات والنوافذ وشريط الحالة والتشغيل ===== */
const FONTS = [
  ['Amiri', 'أميري / Amiri'], ['Noto Naskh Arabic', 'نوتو نسخ / Noto Naskh'], ['Cairo', 'كايرو / Cairo'], ['Tajawal', 'تجو\u0651ال / Tajawal'],
  ['Times New Roman', 'Times New Roman'], ['Arial', 'Arial']
];
const SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
const TABS = [
  { id: 'file', key: 'tabFile' }, { id: 'home', key: 'tabHome' }, { id: 'insert', key: 'tabInsert' }, { id: 'table', key: 'tabTable' },
  { id: 'cite', key: 'tabCite' }, { id: 'thesis', key: 'tabThesis' },
  { id: 'layout', key: 'tabLayout' }, { id: 'view', key: 'tabView' }
];
let activeTab = 'home';
let lastRange = null;

/* ---------- عناصر مساعدة ---------- */
function el(tag, props = {}, kids = []) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'data') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  });
  kids.forEach((c) => e.append(c));
  return e;
}
function rb(html, title, run, cls = '', data = {}) {
  return el('button', { class: 'rb ' + cls, html, title, 'aria-label': title, data,
    onmousedown: (e) => e.preventDefault(), onclick: run });
}
const sep = () => el('span', { class: 'rsep' });
function rsel(title, options, value, onchange) {
  const s = el('select', { class: 'rsel', title, 'aria-label': title,
    onmousedown: saveRange, onfocus: saveRange,
    onchange: (e) => { restoreRange(); onchange(e.target.value); } });
  options.forEach(([v, label]) => { const o = el('option', { value: v }); o.textContent = label; if (String(v) === String(value)) o.selected = true; s.append(o); });
  return s;
}
function saveRange() {
  const sel = document.getSelection();
  if (sel.rangeCount && page.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
}
function restoreRange() {
  if (!lastRange) return;
  page.focus();
  const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(lastRange);
}

/* ---------- التبويبات ---------- */
function renderTabs() {
  const nav = $('#tabs'); nav.innerHTML = '';
  TABS.forEach((tb) => {
    const b = el('button', { class: 'tab' + (tb.id === activeTab ? ' on' : ''), role: 'tab', 'aria-selected': String(tb.id === activeTab),
      onclick: () => { activeTab = tb.id; renderTabs(); renderRibbon(); } });
    b.textContent = t(tb.key);
    if (tb.soon) b.append(el('span', { class: 'soon-badge', html: escapeHtml(t('soon')) }));
    nav.append(b);
  });
}

function renderRibbon() {
  const r = $('#ribbon'); r.innerHTML = '';
  const s = WQ.doc.settings;
  const add = (...xs) => xs.forEach((x) => r.append(x));
  switch (activeTab) {
    case 'file':
      add(rb('＋ ' + t('new'), t('new'), () => newDocument()),
        rb('📂 ' + t('open'), t('open') + ' (Ctrl+O)', openFilePicker),
        rb('⇪ ' + t('importWord'), t('importWord'), openDocxPicker),
        rb('💾 ' + t('save'), t('save') + ' (Ctrl+S)', () => saveFile(false), 'outline'),
        ...(WQ.desktop ? [rb('💾… ' + t('saveAs'), t('saveAs') + ' (Ctrl+Shift+S)', () => saveFile(true))] : []),
        sep(), el('span', { class: 'rlabel', html: escapeHtml(t('exportGroup')) }),
        rb('⎙ ' + t('print'), t('print') + ' (Ctrl+P)', doPrint, 'outline'),
        rb('PDF', t('exportPdfT'), exportPDF, 'special'), rb('W ' + t('exportWord'), t('exportWordT'), () => exportDocx(), 'special'),
        rb('▶ ' + t('exportPpt'), t('exportPptT'), () => exportPptx(), 'special'),
        rb('🖼 ' + t('exportPng'), t('exportPng'), () => exportPNG(false)), rb('🗂 ' + t('exportPngAll'), t('exportPngAll'), () => exportPNG(true)),
        sep(), rb('◷ ' + t('snapshots'), t('snapshots'), openSnapshotsDialog), rb('ⓘ ' + t('props'), t('props'), openPropsDialog), rb('✎ ' + t('about'), t('about'), openAbout), rb('⚑ ' + t('reportIssue'), t('reportIssueT'), openIssues));
      break;
    case 'home':
      add(rb('↶', t('undo'), () => cmd('undo')), rb('↷', t('redo'), () => cmd('redo')), sep(),
        rsel(t('font'), FONTS, '', setFont),
        rsel(t('size'), SIZES.map((n) => [n, String(n)]), 16, (v) => setFontSize(+v)), sep(),
        rb('<b>B</b>', t('bold'), () => cmd('bold'), '', { state: 'bold' }),
        rb('<i>I</i>', t('italic'), () => cmd('italic'), '', { state: 'italic' }),
        rb('<u>U</u>', t('underline'), () => cmd('underline'), '', { state: 'underline' }),
        rb('<s>S</s>', t('strike'), () => cmd('strikeThrough'), '', { state: 'strikeThrough' }),
        colorBtn(t('color'), 'foreColor', '#0F5F66'), colorBtn(t('highlight'), 'hiliteColor', '#FAEEDA'), sep(),
        rb(alignIcon('start'), t('alignStart'), () => align('start')), rb(alignIcon('center'), t('alignCenter'), () => align('center')),
        rb(alignIcon('end'), t('alignEnd'), () => align('end')), rb(alignIcon('justify'), t('justify'), () => align('justify')), sep(),
        rb('• ≡', t('bullets'), () => cmd('insertUnorderedList')), rb('1. ≡', t('numbered'), () => cmd('insertOrderedList')),
        rb('⇥', t('indent'), () => cmd('indent')), rb('⇤', t('outdent'), () => cmd('outdent')), sep(),
        rb(t('h1'), t('h1'), () => setBlock('h1'), 'outline', { block: 'H1' }), rb(t('h2'), t('h2'), () => setBlock('h2'), 'outline', { block: 'H2' }),
        rb(t('h3'), t('h3'), () => setBlock('h3'), 'outline', { block: 'H3' }), rb(t('normal'), t('normal'), () => setBlock('p'), 'outline', { block: 'P' }),
        rb(t('quote'), t('quote'), () => setBlock('blockquote'), 'outline', { block: 'BLOCKQUOTE' }),
        rb('⌫ ' + t('clear'), t('clear'), clearFormat), sep(),
        el('span', { class: 'rlabel', html: escapeHtml(t('numerals')) }),
        rb('١٢٣', t('numerals') + ' ١٢٣', () => setNumerals('arabic'), 'special' + (s.numerals === 'arabic' ? ' on' : '')),
        rb('123', t('numerals') + ' 123', () => setNumerals('western'), 'special' + (s.numerals === 'western' ? ' on' : '')));
      break;
    case 'insert':
      add(rb('▦ ' + t('table'), t('table'), openTableDialog), rb('🖼 ' + t('image'), t('image'), () => { saveRange(); $('#fileImage').value = ''; $('#fileImage').click(); }),
        sep(), rb('⤓ ' + t('pageBreak'), t('pageBreak'), insertPageBreak), rb('― ' + t('hr'), t('hr'), () => insertHtml('<hr><p dir="auto"><br></p>')),
        sep(), rb('« »', t('quotes'), insertQuotes, 'special'), rb('﴿ ﴾ ' + t('insertAyah'), t('insertAyah'), openAyahDialog, 'special'));
      break;
    case 'table': {
      const c = curCell(), tb = c && c.closest('table');
      add(rb('▦ ' + t('table'), t('table'), openTableDialog), sep(),
        rb('↑ ' + t('rowAbove'), t('rowAbove'), () => tableOp('rowAbove')), rb('↓ ' + t('rowBelow'), t('rowBelow'), () => tableOp('rowBelow')),
        rb('→ ' + t('colRight'), t('colRight'), () => tableOp('colRight')), rb('← ' + t('colLeft'), t('colLeft'), () => tableOp('colLeft')), sep(),
        rb('✕ ' + t('delRow'), t('delRow'), () => tableOp('delRow'), 'outline'), rb('✕ ' + t('delCol'), t('delCol'), () => tableOp('delCol'), 'outline'),
        rb('🗑 ' + t('delTable'), t('delTable'), () => tableOp('delTable'), 'outline'), sep(),
        el('span', { class: 'rlabel', html: escapeHtml(t('tblBorders')) }),
        rsel(t('tblBorders'), [['all', t('bdAll')], ['outside', t('bdOutside')], ['inside', t('bdInside')], ['h', t('bdH')], ['apa', t('bdApa')], ['none', t('bdNone')]], tb ? tableBorderOf(tb) : 'all', setTableBorders),
        el('span', { class: 'rlabel', html: '· ' + escapeHtml(t('tblHint')) }));
      break;
    }
    case 'cite':
      add(el('span', { class: 'rlabel', html: escapeHtml(t('citeStyle')) }),
        rsel(t('citeStyle'), [['notes', t('styleNotes')], ['apa', 'APA'], ['vancouver', 'Vancouver']], s.citeStyle || 'notes', setCiteStyle), sep(),
        rb('¹ ' + t('insertFootnote'), t('insertFootnote'), () => { saveRange(); openFootnoteDialog(); }, 'special'),
        rb('❝ ' + t('insertCitation'), t('insertCitation'), () => { saveRange(); openCiteDialog(); }, 'special'),
        rb('＋ ' + t('newRef'), t('newRef'), () => { saveRange(); openRefDialog(); }), sep(),
        rb('▤ ' + t('bibliography'), t('bibliography'), () => insertBlock('wq-bib'), 'outline'),
        rb('☰ ' + t('toc'), t('toc'), () => insertBlock('wq-toc'), 'outline'), sep(),
        el('span', { class: 'rlabel', html: escapeHtml(t('fnNumbering')) }),
        rsel(t('fnNumbering'), [['cont', t('fnCont')], ['page', t('fnPerPage')]], s.fnRestart ? 'page' : 'cont', (v) => { WQ.doc.settings.fnRestart = v === 'page'; markDirty(); }),
        el('span', { class: 'rlabel', html: '· ' + escapeHtml(t('citeHint')) }));
      break;
    case 'thesis':
      add(rb('﴿ ﴾ ' + t('insertAyah'), t('insertAyah'), openAyahDialog, 'special'), sep(),
        rb('▦ ' + t('templates'), t('templates'), openStart), rb('☰ ' + t('toc'), t('toc'), () => insertBlock('wq-toc')),
        rb('▤ ' + t('bibliography'), t('bibliography'), () => insertBlock('wq-bib')), sep(),
        rb('◷ ' + t('snapshots'), t('snapshots'), openSnapshotsDialog));
      break;
    case 'layout':
      add(el('span', { class: 'rlabel', html: escapeHtml(t('docLang')) }),
        rsel(t('docLang'), [['ar', t('langAr')], ['en', t('langEn')], ['fr', t('langFr')]], s.lang, setDocLang), sep(),
        el('span', { class: 'rlabel', html: escapeHtml(t('pageSize')) }),
        rsel(t('pageSize'), [['a4', 'A4'], ['letter', 'Letter']], s.pageSize, (v) => setSetting('pageSize', v)),
        el('span', { class: 'rlabel', html: escapeHtml(t('margins')) }),
        rsel(t('margins'), [['normal', t('mNormal')], ['narrow', t('mNarrow')], ['wide', t('mWide')]], s.margins, (v) => setSetting('margins', v)),
        el('span', { class: 'rlabel', html: escapeHtml(t('lineSpacing')) }),
        ...(isRuled() ? [] : [rsel(t('lineSpacing'), [['1', '1.0'], ['115', '1.15'], ['15', '1.5'], ['2', '2.0']], s.lineSpacing, (v) => setSetting('lineSpacing', v))]), sep(),
        el('span', { class: 'rlabel', html: escapeHtml(t('pageBorder')) }),
        rsel(t('pageBorder'), [['none', t('pbNone')], ['single', t('pbSingle')], ['double', t('pbDouble')], ['thick', t('pbThick')], ['thickThin', t('pbThickThin')]], s.pageBorder || 'none', (v) => { setSetting('pageBorder', v); renderRibbon(); if (v !== 'none') { toast(t('pbHint')); if (!document.body.classList.contains('pages-mode')) { setPagesView(true); return; } } if (document.body.classList.contains('pages-mode')) paginate(); }),
        ...(frameOf(s) ? [rsel(t('pbColor'), [['teal', t('cTeal')], ['black', t('cBlack')], ['copper', t('cCopper')]], s.pageBorderColor || 'teal', (v) => { setSetting('pageBorderColor', v); if (document.body.classList.contains('pages-mode')) paginate(); })] : []), sep(),
        el('span', { class: 'rlabel', html: escapeHtml(t('ruling')) }),
        rsel(t('ruling'), [['off', t('ruleOff')], ['dots', t('ruleDots')], ['dash', t('ruleDash')], ['line', t('ruleLine')]], s.ruled || 'off', (v) => { setSetting('ruled', v); renderRibbon(); }),
        ...(isRuled() ? [el('span', { class: 'rlabel', html: escapeHtml(t('ruleGap')) }),
          rsel(t('ruleGap'), ['0.7', '0.8', '0.9', '1', '1.1', '1.2', '1.5'].map((g) => [g, (WQ.ui === 'ar' ? toArabicDigits(g).replace('.', '\u066B') : g) + ' ' + t('cm')]), String(s.ruleGap || '1'), (v) => setSetting('ruleGap', v))] : []));
      break;
    case 'view':
      add(el('span', { class: 'rlabel', html: escapeHtml(t('zoom')) }),
        rsel(t('zoom'), [75, 90, 100, 110, 125, 150].map((z) => [z, z + '%']), WQ.prefs.zoom, (v) => { WQ.prefs.zoom = +v; applyPrefs(); savePrefs(); }), sep(),
        rb('☰ ' + t('showMap'), t('showMap'), () => { WQ.prefs.showNav = !WQ.prefs.showNav; applyPrefs(); savePrefs(); renderRibbon(); }, WQ.prefs.showNav ? 'on' : ''),
        rb('▤ ' + t('showRefs'), t('showRefs'), () => { WQ.prefs.showRefs = !WQ.prefs.showRefs; applyPrefs(); savePrefs(); renderRibbon(); }, WQ.prefs.showRefs ? 'on' : ''), sep(),
        rb('▭▭ ' + t('pagesView'), t('pagesView'), () => setPagesView(!document.body.classList.contains('pages-mode')), document.body.classList.contains('pages-mode') ? 'on' : ''), sep(),
        rb('◎ ' + t('focus'), t('focus'), () => { document.body.classList.add('focus'); page.focus(); }),
        rb('🎯 ' + t('dailyGoal'), t('goalTitle'), openGoalDialog));
      break;
  }
  updateToolbarState();
}
function alignIcon(w) {
  const lines = { start: ['100%', '70%', '85%'], center: ['100%', '70%', '85%'], end: ['100%', '70%', '85%'], justify: ['100%', '100%', '100%'] }[w];
  const just = w === 'center' ? 'center' : (w === 'end' ? 'flex-end' : 'flex-start');
  return '<span style="display:inline-flex;flex-direction:column;gap:2px;width:16px;align-items:' + just + '">' +
    lines.map((x) => '<span style="height:2px;width:' + x + ';background:currentColor"></span>').join('') + '</span>';
}
function colorBtn(title, command, color) {
  const wrap = el('span', { style: 'display:inline-flex;align-items:center' });
  const btn = rb('<span style="border-bottom:3px solid ' + color + ';padding:0 3px">' + (command === 'foreColor' ? 'A' : '▮') + '</span>', title, () => cmd(command, inp.value));
  const inp = el('input', { type: 'color', value: color, title, 'aria-label': title, style: 'width:18px;height:22px;border:none;padding:0;background:none;cursor:pointer',
    onmousedown: saveRange, onchange: (e) => { restoreRange(); btn.firstChild.style.borderBottomColor = e.target.value; cmd(command, e.target.value); } });
  wrap.append(btn, inp);
  return wrap;
}

function updateToolbarState() {
  $$('[data-state]').forEach((b) => { let on = false; try { on = document.queryCommandState(b.dataset.state); } catch (e) {} b.classList.toggle('on', on); });
  const blk = currentBlock();
  const tag = blk ? (blk.closest('h1,h2,h3,blockquote') || blk).tagName : '';
  $$('[data-block]').forEach((b) => b.classList.toggle('on', b.dataset.block === tag));
}

/* ---------- إعدادات المستند ---------- */
function setSetting(k, v) { WQ.doc.settings[k] = v; applyDocSettings(); markDirty(); refreshDerivedSoon(); }
function setNumerals(mode) { WQ.doc.settings.numerals = mode; applyDocSettings(); convertAllNumerals(); markDirty(); renderRibbon(); updateStatus(); }
function setDocLang(lang) {
  WQ.doc.settings.lang = lang;
  applyDocSettings();
  WQ.doc.settings.numerals = lang === 'ar' ? 'arabic' : 'western';
  convertAllNumerals();
  markDirty(); renderRibbon(); updateStatus();
}

/* ---------- النوافذ ---------- */
function showModal({ title, body, actions = [], onOpen, wide }) {
  const root = $('#modalRoot');
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } });
  const m = el('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const hd = el('header', {}, [el('span', { html: escapeHtml(title) }), el('button', { html: '×', 'aria-label': t('close'), onclick: close })]);
  const bd = el('div', { class: 'body', html: body });
  const ac = el('div', { class: 'actions' });
  actions.forEach((a) => ac.append(el('button', { class: a.cls || 'btn2', html: escapeHtml(a.label), onclick: () => { const keep = a.run && a.run(m) === false; if (!keep) close(); } })));
  m.append(hd, bd, ac); back.append(m); root.innerHTML = ''; root.append(back);
  document.addEventListener('keydown', esc);
  if (onOpen) onOpen(m);
  const first = m.querySelector('input,select'); if (first) first.focus();
}
function openTableDialog() {
  saveRange();
  showModal({
    title: t('tableTitle'),
    body: '<div class="row"><div><label>' + t('rows') + '</label><input id="tRows" type="number" min="1" max="50" value="3"></div>' +
      '<div><label>' + t('cols') + '</label><input id="tCols" type="number" min="1" max="12" value="3"></div></div>' +
      '<label style="display:flex;gap:6px;align-items:center"><input id="tHead" type="checkbox" checked style="width:auto;margin:0">' + t('headerRow') + '</label>',
    actions: [{ label: t('cancel') }, { label: t('insert'), cls: 'btn', run: (m) => {
      const r = Math.min(50, Math.max(1, +$('#tRows', m).value || 3)), c = Math.min(12, Math.max(1, +$('#tCols', m).value || 3));
      restoreRange(); insertTable(r, c, $('#tHead', m).checked);
    } }]
  });
}
function openPropsDialog() {
  const d = WQ.doc;
  showModal({
    title: t('propsTitle'),
    body: '<label>' + t('title') + '</label><input id="pTitle" dir="auto" value="' + escapeHtml($('#docTitle').value) + '">' +
      '<label>' + t('author') + '</label><input id="pAuthor" dir="auto" value="' + escapeHtml(d.meta.author || '') + '">' +
      '<label>' + t('docLang') + '</label><select id="pLang"><option value="ar">' + t('langAr') + '</option><option value="en">' + t('langEn') + '</option><option value="fr">' + t('langFr') + '</option></select>',
    onOpen: (m) => { $('#pLang', m).value = d.settings.lang; },
    actions: [{ label: t('cancel') }, { label: t('ok'), cls: 'btn', run: (m) => {
      $('#docTitle').value = $('#pTitle', m).value.trim(); d.meta.author = $('#pAuthor', m).value.trim();
      const lang = $('#pLang', m).value; if (lang !== d.settings.lang) setDocLang(lang); else markDirty();
    } }]
  });
}
function openGoalDialog() {
  showModal({
    title: t('goalTitle'),
    body: '<label>' + t('goalLabel') + '</label><input id="gVal" type="number" min="50" step="50" value="' + WQ.prefs.dailyGoal + '">',
    actions: [{ label: t('cancel') }, { label: t('ok'), cls: 'btn', run: (m) => { WQ.prefs.dailyGoal = Math.max(50, +$('#gVal', m).value || 1000); savePrefs(); updateStatus(); } }]
  });
}

/* ---------- شريط الحالة وهدف اليوم ---------- */
function updateStatus() {
  if (!page) return;
  const { words, chars } = countWords();
  const p = WQ.prefs;
  // الهدف اليومي يحسب الكلمات اللي اتكتبت فعلاً، مش اللي اتفتحت أو اتستوردت
  if (p.goalDay !== todayKey()) { p.goalDay = todayKey(); p.goalDone = 0; savePrefs(); }
  if (WQ._lastWords == null) WQ._lastWords = words;
  const delta = words - WQ._lastWords;
  if (delta > 0 && delta < 400) { p.goalDone = (p.goalDone || 0) + delta; savePrefs(); }
  WQ._lastWords = words;
  const today = p.goalDone || 0;
  $('#stWords').textContent = fmtNum(words) + ' ' + t('words') + ' · ' + fmtNum(chars) + ' ' + t('chars') + ' · ' + fmtNum(approxPages()) + ' ' + (PV.exact ? t('pagesExact') : t('pagesApprox'));
  $('#stGoal').textContent = t('dailyGoal') + ': ' + fmtNum(today) + ' / ' + fmtNum(p.dailyGoal);
  const s = WQ.doc.settings;
  $('#stLang').textContent = t('docLang') + ': ' + I18N[WQ.ui].langLabel[s.lang] + ' · ' + (s.numerals === 'arabic' ? '١٢٣' : '123');
}

/* ---------- تفضيلات الواجهة ---------- */
function savePrefs() { lsSet(LS_PREFS, WQ.prefs); }
function applyPrefs() {
  document.body.classList.toggle('hide-nav', !WQ.prefs.showNav);
  document.body.classList.toggle('hide-ref', !WQ.prefs.showRefs);
  document.documentElement.style.setProperty('--zoom', WQ.prefs.zoom / 100);
}
function applyUiLang() {
  const L = I18N[WQ.ui];
  document.documentElement.lang = WQ.ui; document.documentElement.dir = L.dir;
  $$('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  $('#btnUiLang').textContent = L.switchTo;
  $('#btnSnap').textContent = '◷ ' + (WQ.ui === 'ar' ? 'لقطة' : 'Snapshot');
  $('#docTitle').placeholder = t('untitled');
  document.documentElement.style.setProperty('--pb-label', JSON.stringify(t('pageBreakLabel')));
  $('.app-ver').textContent = t('appName') + ' · ' + t('version') + ' ' + APP_VERSION + ' (' + APP_STAGE + ')';
  $('.focus-exit') && ($('.focus-exit').textContent = t('exitFocus'));
  document.title = t('appName') + ' – ' + (WQ.ui === 'ar' ? 'Warraq' : 'ور\u0651اق');
  if (WQ.doc) { applyDocSettings(); renderTabs(); renderRibbon(); renderCitations(); buildNav(); updateStatus(); setSaveState(WQ.dirty ? 'unsaved' : 'saved'); }
}

/* ---------- التشغيل ---------- */
function boot() {
  WQ.prefs = Object.assign(WQ.prefs, lsGet(LS_PREFS) || {});
  WQ.ui = WQ.prefs.ui === 'en' ? 'en' : 'ar';
  document.body.append(el('button', { class: 'btn2 focus-exit', onclick: () => document.body.classList.remove('focus') }));
  initEditor();
  initCiteEvents();
  initPagesEvents();
  initTableMenu();
  restoreOrNew();
  applyPrefs();
  applyUiLang();
  if (!(page.innerText || '').trim()) openStart();
  $('#btnUiLang').onclick = () => { WQ.ui = WQ.ui === 'ar' ? 'en' : 'ar'; WQ.prefs.ui = WQ.ui; savePrefs(); applyUiLang(); };
  $('#docTitle').addEventListener('input', markDirty);
  $('#fileOpen').addEventListener('change', onFileChosen);
  $('#fileDocx').addEventListener('change', onDocxChosen);
  $('#btnSnap').onclick = () => { takeSnapshot(t('manualSnap')); markDirty(); toast(t('snapTaken')); };
  $('#fileImage').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { restoreRange(); insertImage(String(r.result)); }; r.readAsDataURL(f);
  });
  $('#stGoal').onclick = openGoalDialog;
  page.addEventListener('blur', saveRange);
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(false); }
    else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openFilePicker(); }
    else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); doPrint(); }
    else if (e.key === 'Escape' && document.body.classList.contains('focus')) document.body.classList.remove('focus');
  });
  // قدرة الحفظ في معاينة Claude (إن و\u064Fجدت)
  initDesktop();
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then((d) => { WQ.downloads = d || null; }).catch(() => {});
    }
  } catch (e) {}
  window.WQ_API = { WQ, exportPDF, exportPNG, drawPage, zipStore, paginate, setPagesView, PV: () => PV, takeSnapshot, restoreSnapshot, applyTemplate, docxToWarraq, loadQuran, insertAyah, searchQuran, openStart, refreshDerived, setCiteStyle, addCitation, addFootnote, insertBlock, renderCitations, apaRef, vanRef, serializeDoc, parseDoc, loadDocIntoEditor, sanitizeHtml, countWords, setDocLang, setNumerals, setBlock, insertTable, newDocModel };
}
document.addEventListener('DOMContentLoaded', boot);
