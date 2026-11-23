/* ===== ruler: المسطرة الأفقية — هوامش الصفحة بالسحب، ومسافات الفقرة (السطر الأول، المعلّقة، البداية، النهاية) ===== */
const RU = { drag: null, raf: 0 };
function rulerEl() { return $('#ruler'); }
function initRuler() {
  const r = rulerEl(); if (!r) return;
  r.innerHTML = '<div class="ru-track"><div class="ru-m ru-ml"></div><div class="ru-m ru-mr"></div><div class="ru-ticks"></div>' +
    '<div class="ru-edge" data-k="ml"></div><div class="ru-edge" data-k="mr"></div>' +
    '<div class="ru-mk ru-first" data-k="first"></div><div class="ru-mk ru-hang" data-k="hang"></div><div class="ru-mk ru-box" data-k="box"></div><div class="ru-mk ru-end" data-k="end"></div></div>';
  r.addEventListener('mousedown', (e) => e.preventDefault());
  r.addEventListener('pointerdown', rulerDown);
  r.addEventListener('dblclick', (e) => { if (e.target.closest('.ru-m,.ru-edge')) openMarginsDialog(); });
  document.addEventListener('selectionchange', () => { if (!RU.drag) refreshRulerSoon(); });
  page.addEventListener('input', refreshRulerSoon);
  window.addEventListener('resize', refreshRulerSoon);
  refreshRuler();
}
function refreshRulerSoon() { cancelAnimationFrame(RU.raf); RU.raf = requestAnimationFrame(refreshRuler); }
/* موضع (سم من حافة الورقة اليسرى) لكل علامة */
function rulerGeom() {
  const s = WQ.doc.settings, W = pageWidthCm(s), m = pageMargins(s);
  const sheet = $('#sheet'), sr = sheet.getBoundingClientRect();
  const k = sr.width / W; // بكسل الشاشة لكل سم
  return { W, m, k, sr };
}
function rulerBlockPos(b, g) {
  const pr = page.getBoundingClientRect(), br = b.getBoundingClientRect(), cs = getComputedStyle(b);
  const px2cm = (v) => (parseFloat(v) || 0) / 37.7953;
  const rtl = isRtlAt(b);
  const leftIn = (br.left - pr.left) / g.k + px2cm(cs.borderLeftWidth) + px2cm(cs.paddingLeft);
  const rightIn = (pr.right - br.right) / g.k + px2cm(cs.borderRightWidth) + px2cm(cs.paddingRight);
  const L = g.m.l + leftIn, R = g.W - g.m.r - rightIn; // حدود نص الفقرة
  const ti = px2cm(cs.textIndent);
  return rtl ? { rtl, start: R, end: L, first: R - ti } : { rtl, start: L, end: R, first: L + ti };
}
function refreshRuler() {
  const r = rulerEl(); if (!r || !WQ.doc || !r.firstChild) return;
  const g = rulerGeom(), pct = (x) => (x / g.W * 100) + '%';
  r.style.width = g.W + 'cm';
  $('.ru-ml', r).style.width = pct(g.m.l); $('.ru-mr', r).style.width = pct(g.m.r);
  const [el1, el2] = $$('.ru-edge', r); el1.style.left = pct(g.m.l); el2.style.left = pct(g.W - g.m.r);
  el1.title = el2.title = t('rulerMargin');
  // التدريج: من حافة النص في بداية السطر
  const rtlDoc = WQ.doc.settings.lang === 'ar';
  const key = g.W + '|' + g.m.l + '|' + g.m.r + '|' + rtlDoc + '|' + WQ.doc.settings.numerals;
  const tk = $('.ru-ticks', r);
  if (tk.dataset.key !== key) {
    tk.dataset.key = key; let h = '';
    const o = rtlDoc ? g.W - g.m.r : g.m.l, dir = rtlDoc ? -1 : 1, N = Math.ceil(g.W * 4);
    for (let n = -N; n <= N; n++) {
      const x = o + dir * n * 0.25; if (x <= 0.05 || x >= g.W - 0.05) continue;
      if (n % 4 === 0 && n !== 0) {
        const v = String(Math.abs(n / 4)), lab = WQ.doc.settings.numerals === 'arabic' ? toArabicDigits(v) : v;
        h += '<span class="ru-n" style="left:' + pct(x) + '">' + lab + '</span>';
      } else if (n !== 0) h += '<span class="ru-t' + (n % 2 === 0 ? ' half' : '') + '" style="left:' + pct(x) + '"></span>';
    }
    tk.innerHTML = h;
  }
  const b = currentBlock(), blk = b && b.closest(PARA_SEL);
  const on = !!(blk && page.contains(blk) && !document.body.classList.contains('pages-mode'));
  r.classList.toggle('no-para', !on);
  if (on) {
    const p = rulerBlockPos(blk, g);
    const set = (c, x, tt) => { const e = $(c, r); e.style.left = pct(x); e.title = tt; };
    set('.ru-first', p.first, t('rulerFirst')); set('.ru-hang', p.start, t('rulerHanging'));
    set('.ru-box', p.start, t('rulerStart')); set('.ru-end', p.end, t('rulerEnd'));
  }
}
function rulerDown(e) {
  const h = e.target.closest('.ru-mk,.ru-edge'); if (!h || e.button !== 0) return;
  e.preventDefault();
  const k = h.dataset.k, g = rulerGeom();
  const d = { k, g, x0: e.clientX };
  if (k === 'first' || k === 'hang' || k === 'box' || k === 'end') {
    d.blocks = selectedBlocks();
    if (!d.blocks.length) return;
    d.init = d.blocks.map((b) => blockIndents(b));
    d.rtl = d.init[0].rtl;
  } else {
    const s = WQ.doc.settings, m = pageMargins(s);
    if (s.margins !== 'custom') Object.assign(s, { margins: 'custom', mT: m.t, mB: m.b, mL: m.l, mR: m.r });
  }
  RU.drag = d;
  h.setPointerCapture(e.pointerId);
  h.addEventListener('pointermove', rulerMove);
  h.addEventListener('pointerup', rulerUp, { once: true });
  h.addEventListener('pointercancel', rulerUp, { once: true });
  rulerGuide(e.clientX);
}
function rulerGuide(x) {
  let gd = $('#ruGuide');
  if (x == null) { if (gd) gd.remove(); return; }
  if (!gd) { gd = el('div', { id: 'ruGuide', class: 'ru-guide no-print' }); document.body.append(gd); }
  const cr = $('#canvas').getBoundingClientRect();
  gd.style.left = x + 'px'; gd.style.top = cr.top + 'px'; gd.style.height = cr.height + 'px';
}
function rulerMove(e) {
  const d = RU.drag; if (!d) return;
  const step = e.altKey ? 0.05 : 0.25;
  let dcm = (e.clientX - d.x0) / d.g.k; // موجب = نحو اليمين
  dcm = Math.round(dcm / step) * step;
  rulerGuide(d.x0 + dcm * d.g.k);
  const s = WQ.doc.settings;
  if (d.k === 'ml' || d.k === 'mr') {
    const m0 = d.m0 || (d.m0 = { l: +s.mL, r: +s.mR });
    const lim = (v) => Math.min(d.g.W / 2 - 2, Math.max(0.5, Math.round(v * 100) / 100));
    if (d.k === 'ml') s.mL = lim(m0.l + dcm); else s.mR = lim(m0.r - dcm);
    applyDocSettings();
    return;
  }
  // اتجاه "للداخل" لعلامات البداية: يسار في العربي، يمين في الإنجليزي — والعكس لعلامة النهاية
  const inward = d.rtl ? -dcm : dcm;
  d.blocks.forEach((b, i) => {
    const o = d.init[i]; let start = o.start, first = o.first, end = o.end;
    if (d.k === 'first') first = o.first + inward;
    else if (d.k === 'hang') { start = o.start + inward; first = o.first - inward; }
    else if (d.k === 'box') start = o.start + inward;
    else if (d.k === 'end') end = o.end - inward;
    start = Math.max(0, start); end = Math.max(0, end);
    if (start + first < 0) first = -start;
    setBlockIndent(b, { start, first, end });
  });
  refreshRuler();
}
function rulerUp(e) {
  const d = RU.drag; RU.drag = null; rulerGuide(null);
  e.target.removeEventListener('pointermove', rulerMove);
  if (!d) return;
  if (d.k === 'ml' || d.k === 'mr') { markDirty(); PV.exact = false; refreshDerivedSoon(); if (activeTab === 'layout') renderRibbon(); }
  else onInput();
  refreshRuler();
}
/* نافذة الهوامش المخصصة */
function openMarginsDialog() {
  const s = WQ.doc.settings, m = pageMargins(s);
  const f = (id, lab, v) => '<div><label>' + E(lab) + ' (' + E(t('cm')) + ')</label><input id="' + id + '" type="number" min="0.3" max="8" step="0.05" value="' + (Math.round(v * 100) / 100) + '"></div>';
  showModal({ title: t('customMargins'),
    body: '<div class="row">' + f('mgT', t('mTop'), m.t) + f('mgB', t('mBottom'), m.b) + '</div><div class="row">' + f('mgR', t('mRight'), m.r) + f('mgL', t('mLeft'), m.l) + '</div>' +
      '<p class="wq-note" style="font-size:12px">' + E(t('marginsHint')) + '</p>',
    actions: [{ label: t('cancel') }, { label: t('ok'), cls: 'btn', run: (mm) => {
      const v = (id) => +$('#' + id, mm).value;
      Object.assign(s, { margins: 'custom', mT: v('mgT'), mB: v('mgB'), mL: v('mgL'), mR: v('mgR') });
      const q = pageMargins(s); Object.assign(s, { mT: q.t, mB: q.b, mL: q.l, mR: q.r });
      applyDocSettings(); markDirty(); PV.exact = false; refreshDerivedSoon(); renderRibbon();
      if (document.body.classList.contains('pages-mode')) paginate();
    } }] });
}
