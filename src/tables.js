/* ===== tables: تعديل الجداول (إضافة وحذف الصفوف والأعمدة، حدود الجدول) + إطار الصفحة ===== */

/* الخلية التي فيها المؤشر */
function curCell() {
  const sel = document.getSelection();
  let n = sel && sel.rangeCount ? sel.anchorNode : null;
  if ((!n || !page.contains(n)) && typeof lastRange !== 'undefined' && lastRange) n = lastRange.startContainer;
  if (!n || !page.contains(n)) return null;
  const e = n.nodeType === 1 ? n : n.parentElement;
  return e && e.closest('td,th');
}
/* خريطة الجدول: أي خلية تغطي كل موضع (صف، عمود) مع حساب الدمج */
function tableMap(t) {
  const rows = Array.from(t.rows), map = rows.map(() => []), info = new Map();
  rows.forEach((tr, r) => {
    let c = 0;
    Array.from(tr.cells).forEach((cell) => {
      while (map[r][c]) c++;
      const cs = cell.colSpan || 1, rs = Math.max(1, Math.min(cell.rowSpan || 1, rows.length - r));
      info.set(cell, { r, c, cs, rs });
      for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) map[r + a][c + b] = cell;
      c += cs;
    });
  });
  let ncol = 0; map.forEach((x) => { ncol = Math.max(ncol, x.length); });
  return { rows, map, info, ncol };
}
function newCell(tag, ref) {
  const x = document.createElement(tag); x.setAttribute('dir', 'auto'); x.innerHTML = '<br>';
  if (ref && ref.style.textAlign) x.style.textAlign = ref.style.textAlign;
  return x;
}
function setSpan(cell, attr, v) { if (v > 1) cell.setAttribute(attr, String(v)); else cell.removeAttribute(attr); }
/* يضع خلية في الصف r قبل أول خلية تبدأ بعد العمود c */
function placeCell(M, r, c, cell) {
  const tr = M.rows[r];
  const next = Array.from(tr.cells).find((x) => x !== cell && M.info.get(x) && M.info.get(x).c > c);
  tr.insertBefore(cell, next || null);
}
function tableIsRtl(t) { return getComputedStyle(t).direction === 'rtl'; }
function afterTableEdit(focusCell) {
  if (focusCell && focusCell.isConnected) {
    const r = document.createRange(); r.selectNodeContents(focusCell); r.collapse(true);
    const s = document.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  onInput(); updateToolbarState();
}

function tableOp(op) {
  if (document.body.classList.contains('pages-mode')) setPagesView(false);
  const cell = curCell();
  if (!cell) { toast(t('tblNoCell')); return; }
  const t = cell.closest('table');
  if (op === 'delTable') { const nx = t.nextElementSibling; t.remove(); if (!page.children.length) page.innerHTML = '<p dir="auto"><br></p>'; afterTableEdit(nx && nx.tagName === 'P' ? nx : null); return; }
  const M = tableMap(t), me = M.info.get(cell);
  const cols = t.querySelector(':scope > colgroup');
  // يمين ويسار حسب اتجاه الجدول
  if (op === 'colRight') op = tableIsRtl(t) ? 'colBefore' : 'colAfter';
  if (op === 'colLeft') op = tableIsRtl(t) ? 'colAfter' : 'colBefore';

  if (op === 'rowAbove' || op === 'rowBelow') {
    const R = op === 'rowAbove' ? me.r : me.r + me.rs; // رقم الصف الجديد
    const tr = document.createElement('tr');
    const host = (M.rows[R] || M.rows[M.rows.length - 1]).parentNode;
    host.insertBefore(tr, M.rows[R] || null);
    const seen = new Set(); let first = null;
    for (let c = 0; c < M.ncol; c++) {
      const up = R > 0 ? M.map[R - 1][c] : null, down = R < M.rows.length ? M.map[R][c] : null;
      if (up && up === down) { if (!seen.has(up)) { seen.add(up); setSpan(up, 'rowspan', M.info.get(up).rs + 1); } continue; }
      const tag = up && down && up.tagName === 'TH' && down.tagName === 'TH' ? 'th' : 'td';
      const nc = newCell(tag, op === 'rowAbove' ? down : up); tr.append(nc);
      if (c === me.c) first = nc;
    }
    afterTableEdit(first || tr.cells[0]); return;
  }
  if (op === 'colBefore' || op === 'colAfter') {
    const K = op === 'colBefore' ? me.c : me.c + me.cs; // رقم العمود الجديد
    const seen = new Set(); let mine = null;
    M.rows.forEach((tr, r) => {
      const left = K > 0 ? M.map[r][K - 1] : null, right = M.map[r][K] || null;
      if (left && left === right) { if (!seen.has(left)) { seen.add(left); setSpan(left, 'colspan', M.info.get(left).cs + 1); } return; }
      const ref = op === 'colBefore' ? right : left;
      const nc = newCell(ref && ref.tagName === 'TH' && (!left || !right || left.tagName === right.tagName) ? 'th' : 'td', ref);
      placeCell(M, r, K - 1, nc);
      if (r === me.r) mine = nc;
    });
    if (cols) {
      const cs = Array.from(cols.children), nb = cs[Math.min(K, cs.length - 1)] || cs[cs.length - 1];
      if (nb) {
        const w = parseFloat(nb.style.width) || 0;
        const col = document.createElement('col');
        if (w) { nb.style.width = (Math.round(w / 2 * 10) / 10) + '%'; col.style.width = (Math.round(w / 2 * 10) / 10) + '%'; }
        cols.insertBefore(col, cs[K] || null);
      }
    }
    afterTableEdit(mine); return;
  }
  if (op === 'delRow') {
    if (M.rows.length <= 1) { tableOp('delTable'); return; }
    const R = me.r, seen = new Set();
    for (let c = 0; c < M.ncol; c++) {
      const x = M.map[R][c]; if (!x || seen.has(x)) continue; seen.add(x);
      const i = M.info.get(x);
      if (i.rs > 1) {
        setSpan(x, 'rowspan', i.rs - 1);
        if (i.r === R) placeCell(M, R + 1, i.c - 0.5, x); // الخلية المدمجة تنزل للصف التالي
      }
    }
    const nextRow = M.rows[R + 1] || M.rows[R - 1];
    M.rows[R].remove();
    afterTableEdit(nextRow && nextRow.cells[0]); return;
  }
  if (op === 'delCol') {
    if (M.ncol <= 1) { tableOp('delTable'); return; }
    const C = me.c, seen = new Set();
    M.rows.forEach((tr, r) => {
      const x = M.map[r][C]; if (!x || seen.has(x)) return; seen.add(x);
      const i = M.info.get(x);
      if (i.cs > 1) setSpan(x, 'colspan', i.cs - 1); else x.remove();
    });
    M.rows.forEach((tr) => { if (!tr.cells.length) tr.remove(); });
    if (cols && cols.children[C]) cols.children[C].remove();
    const row = M.rows[me.r].isConnected ? M.rows[me.r] : t.rows[0];
    afterTableEdit(row && row.cells[Math.min(C, row.cells.length - 1)]); return;
  }
}

/* ---------- حدود الجدول ---------- */
const TABLE_BORDERS = ['all', 'outside', 'inside', 'h', 'apa', 'none'];
function tableBorderOf(t) { const m = (t.className || '').match(/\bbd-(\w+)\b/); return m ? m[1] : 'all'; }
function setTableBorders(kind) {
  if (document.body.classList.contains('pages-mode')) setPagesView(false);
  const cell = curCell();
  if (!cell) { toast(t('tblNoCell')); return; }
  const tb = cell.closest('table');
  TABLE_BORDERS.forEach((k) => tb.classList.remove('bd-' + k));
  if (kind !== 'all') tb.classList.add('bd-' + kind);
  afterTableEdit(cell); renderRibbon();
}

/* ---------- قائمة الزر الأيمن داخل الجدول ---------- */
function initTableMenu() {
  page.addEventListener('contextmenu', (e) => {
    const c = e.target.closest && e.target.closest('td,th');
    if (!c || !page.contains(c)) return;
    e.preventDefault();
    closeTableMenu();
    const s = document.getSelection();
    if (!c.contains(s.anchorNode)) { const r = document.createRange(); r.selectNodeContents(c); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
    const m = el('div', { class: 'ctx-menu', id: 'tblMenu', role: 'menu' });
    const item = (label, fn) => m.append(el('button', { class: 'ctx-item', role: 'menuitem', html: label, onmousedown: (ev) => ev.preventDefault(), onclick: () => { closeTableMenu(); fn(); } }));
    item('↑ ' + escapeHtml(t('rowAbove')), () => tableOp('rowAbove'));
    item('↓ ' + escapeHtml(t('rowBelow')), () => tableOp('rowBelow'));
    item('→ ' + escapeHtml(t('colRight')), () => tableOp('colRight'));
    item('← ' + escapeHtml(t('colLeft')), () => tableOp('colLeft'));
    m.append(el('div', { class: 'ctx-sep' }));
    item('✕ ' + escapeHtml(t('delRow')), () => tableOp('delRow'));
    item('✕ ' + escapeHtml(t('delCol')), () => tableOp('delCol'));
    item('🗑 ' + escapeHtml(t('delTable')), () => tableOp('delTable'));
    document.body.append(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(e.clientX, innerWidth - w - 6) + 'px';
    m.style.top = Math.min(e.clientY, innerHeight - h - 6) + 'px';
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#tblMenu')) closeTableMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTableMenu(); });
  window.addEventListener('blur', closeTableMenu);
}
function closeTableMenu() { const m = document.getElementById('tblMenu'); if (m) m.remove(); }

/* ---------- إطار الصفحة ---------- */
const FRAME_COLORS = { teal: '#0F5F66', black: '#222222', copper: '#B8732E' };
function frameOf(s) { return s.pageBorder && s.pageBorder !== 'none' ? s.pageBorder : ''; }
function addPageFrame(pg, g) {
  const s = WQ.doc.settings, kind = frameOf(s);
  if (!kind) return;
  const inset = Math.max(0.6 * CM, Math.min(g.mt, g.ms) * 0.45);
  const color = FRAME_COLORS[s.pageBorderColor] || FRAME_COLORS.teal;
  const f = el('div', { class: 'pv-frame f-' + kind });
  f.style.cssText = 'inset:' + inset + 'px;color:' + color;
  if (kind === 'thickThin') f.append(el('div', { class: 'pv-frame-in' }));
  pg.append(f);
}
