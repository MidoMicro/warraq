/* ===== format: أيقونات ورّاق، الحافظة، ناسخ التنسيق، تنسيق الفقرة (التباعد والمسافات البادئة)، البحث والاستبدال ===== */

/* ---------- أيقونات ورّاق (رسم خاص بالبرنامج، خط واحد بلون النص) ---------- */
const ICON_PATHS = {
  undo: 'M8 7H4V3M4 7c2-2.5 4.5-4 8-4 5 0 8 3.6 8 8s-3.6 8-8 8H8',
  redo: 'M16 7h4V3M20 7c-2-2.5-4.5-4-8-4-5 0-8 3.6-8 8s3.6 8 8 8h4',
  paste: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4',
  cut: 'M6 7a2.5 2.5 0 1 0 0 .01M6 17a2.5 2.5 0 1 0 0 .01M8 8l12 9M8 16l12-9',
  copy: 'M8 8h11v13H8zM5 16V3h11',
  painter: 'M4 4h12v5H4zM16 6.5h3v6h-8v3M10 15.5h2v6h-2z',
  grow: 'M3 20l5-14 5 14M5 15h6M17 13V5M14 8l3-3 3 3',
  shrink: 'M3 20l5-14 5 14M5 15h6M17 5v8M14 10l3 3 3-3',
  sup: 'M4 8l8 11M12 8l-8 11M15 4h4l-4 5h4',
  sub: 'M4 5l8 11M12 5l-8 11M15 15h4l-4 5h4',
  bullets: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  numbered: 'M10 6h11M10 12h11M10 18h11M4 4v4M3 10.5h2.5L3 14h3M3 16h3v4H3M3 18h2',
  indentMore: 'M3 4h18M10 9h11M10 14h11M3 19h18M3 9l4 2.5L3 14',
  indentLess: 'M3 4h18M10 9h11M10 14h11M3 19h18M7 9l-4 2.5L7 14',
  lineSp: 'M11 5h10M11 10h10M11 15h10M11 20h10M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2',
  find: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13M15.5 15.5L21 21',
  replace: 'M4 8h13l-3-3M20 16H7l3 3M4 8v2M20 16v-2',
  selectAll: 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4M8 9h8M8 12h8M8 15h5',
  clear: 'M5 5h11M10 5l-3 14M14 14l6 6M20 14l-6 6',
  ruler: 'M2 8h20v8H2zM6 8v3M10 8v4M14 8v3M18 8v4'
};
function icon(name, size = 18) {
  return '<svg class="wq-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICON_PATHS[name] + '"/></svg>';
}

/* ---------- الحافظة ---------- */
function clipCut() { focusPage(); try { document.execCommand('cut'); } catch (e) {} onInput(); }
function clipCopy() { focusPage(); try { document.execCommand('copy'); } catch (e) {} }
async function clipPaste() {
  focusPage();
  let ok = false;
  try { ok = document.execCommand('paste'); } catch (e) {}
  if (ok) return;
  try {
    const txt = await navigator.clipboard.readText();
    if (txt) { restoreRange(); document.execCommand('insertText', false, txt); onInput(); return; }
  } catch (e) {}
  toast(t('pasteFallback'));
}
function selectAllDoc() {
  focusPage();
  const r = document.createRange(); r.selectNodeContents(page);
  const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(r);
}

/* ---------- الفقرات المحددة ---------- */
const PARA_SEL = 'p,h1,h2,h3,blockquote,li';
function selectedBlocks() {
  const sel = document.getSelection();
  if (!sel.rangeCount || !page.contains(sel.anchorNode)) { if (lastRange) restoreRange(); }
  if (!sel.rangeCount) return [];
  const r = sel.getRangeAt(0);
  const one = currentBlock();
  if (r.collapsed) { const b = one && one.closest(PARA_SEL); return b && page.contains(b) ? [b] : []; }
  const out = $$(PARA_SEL, page).filter((b) => r.intersectsNode(b) && !b.querySelector(PARA_SEL) && !b.closest('[contenteditable="false"]'));
  return out.length ? out : (one && one.closest(PARA_SEL) ? [one.closest(PARA_SEL)] : []);
}
/* طول CSS إلى سم */
function cssCm(v) {
  const m = /^(-?[\d.]+)(cm|mm|px|pt|in|em)?$/.exec(String(v || '').trim()); if (!m) return 0;
  const n = parseFloat(m[1]);
  return { cm: n, mm: n / 10, px: n / 37.7953, pt: n / 28.3465, in: n * 2.54, em: n * 0.564 }[m[2] || 'px'] || 0;
}
const cmStr = (x) => (Math.round(x * 100) / 100) + 'cm';
/* المسافة البادئة المنطقية: البداية (يمين في العربي) والنهاية */
function blockIndents(b) {
  const rtl = isRtlAt(b), cs = getComputedStyle(b);
  const L = parseFloat(cs.marginLeft) / 37.7953, R = parseFloat(cs.marginRight) / 37.7953;
  return { rtl, start: rtl ? R : L, end: rtl ? L : R, first: parseFloat(cs.textIndent) / 37.7953 || 0 };
}
function setBlockIndent(b, o) {
  const rtl = isRtlAt(b);
  if (o.start != null) b.style[rtl ? 'marginRight' : 'marginLeft'] = cmStr(Math.max(0, o.start));
  if (o.end != null) b.style[rtl ? 'marginLeft' : 'marginRight'] = cmStr(Math.max(0, o.end));
  if (o.first != null) { const f = Math.round(o.first * 100) / 100; if (f) b.style.textIndent = cmStr(f); else b.style.removeProperty('text-indent'); }
}
function changeIndent(dir) {
  const bs = selectedBlocks(); if (!bs.length) return;
  bs.forEach((b) => { const i = blockIndents(b); setBlockIndent(b, { start: Math.max(0, Math.round((i.start + dir * 1.27) / 1.27) * 1.27) }); });
  onInput(); refreshRuler();
}
/* تباعد الأسطر للفقرة: [التسمية، قيمة CSS، قيمة Word] — تُطابق تباعد المستند */
const PARA_LS = [['1.0', '1.15', 240], ['1.15', '1.3', 276], ['1.5', '1.5', 360], ['2.0', '2', 480], ['2.5', '2.5', 600], ['3.0', '3', 720]];
function lsTwips(css) { const f = PARA_LS.find((x) => x[1] === String(css)); return f ? f[2] : Math.round(240 * (parseFloat(css) || 1.5)); }
function setParaLineSpacing(v) {
  if (isRuled()) { toast(t('lsRuledHint')); return; }
  const bs = selectedBlocks(); if (!bs.length) return;
  bs.forEach((b) => { if (v) b.style.lineHeight = v; else b.style.removeProperty('line-height'); });
  onInput();
}
function curParaLS() { const b = currentBlock(); return b && b.style.lineHeight ? b.style.lineHeight : ''; }

/* ---------- تكبير/تصغير الخط ---------- */
function stepFont(dir) {
  const b = currentBlock(); const sel = document.getSelection();
  let n = sel.rangeCount ? sel.anchorNode : null; if (n && n.nodeType === 3) n = n.parentNode;
  const pt = Math.round(parseFloat(getComputedStyle(n && page.contains(n) ? n : (b || page)).fontSize) * 0.75);
  const next = dir > 0 ? (SIZES.find((x) => x > pt) || pt + 4) : ([...SIZES].reverse().find((x) => x < pt) || Math.max(8, pt - 1));
  setFontSize(next);
}

/* ---------- ناسخ التنسيق ---------- */
let painter = null;
function startPainter() {
  if (painter) { stopPainter(); return; }
  const sel = document.getSelection(); if (!sel.rangeCount) restoreRange();
  if (!sel.rangeCount || !page.contains(sel.anchorNode)) { toast(t('painterNeedSel')); return; }
  let n = sel.anchorNode; if (n.nodeType === 3) n = n.parentNode;
  const cs = getComputedStyle(n), blk = currentBlock();
  const q = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  painter = {
    font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), pt: Math.round(parseFloat(cs.fontSize) * 0.75), color: cs.color,
    bg: (() => { let x = n; while (x && x !== page) { const c = getComputedStyle(x).backgroundColor; if (!isTransparent(c)) return c; x = x.parentNode; } return ''; })(),
    bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'),
    para: blk && blk.closest(PARA_SEL) ? { ta: blk.style.textAlign, lh: blk.style.lineHeight, ti: blk.style.textIndent, ml: blk.style.marginLeft, mr: blk.style.marginRight } : null
  };
  document.body.classList.add('painting');
  toast(t('painterOn'));
  renderRibbon();
}
function stopPainter() { painter = null; document.body.classList.remove('painting'); renderRibbon(); }
function applyPainter() {
  if (!painter) return;
  const sel = document.getSelection(); if (!sel.rangeCount || !page.contains(sel.anchorNode)) return;
  const p = painter; painter = null; document.body.classList.remove('painting');
  if (sel.isCollapsed) { renderRibbon(); return; }
  const keep = sel.getRangeAt(0).cloneRange();
  if (document.activeElement !== page) { page.focus(); sel.removeAllRanges(); sel.addRange(keep); }
  const set = (c, want) => { let on = false; try { on = document.queryCommandState(c); } catch (e) {} if (on !== want) document.execCommand(c); };
  set('bold', p.bold); set('italic', p.italic); set('underline', p.underline); set('strikeThrough', p.strike);
  document.execCommand('fontName', false, p.font);
  document.execCommand('foreColor', false, p.color);
  if (p.bg) document.execCommand('hiliteColor', false, p.bg);
  setFontSize(p.pt);
  if (p.para) selectedBlocks().forEach((b) => {
    [['textAlign', p.para.ta], ['lineHeight', p.para.lh], ['textIndent', p.para.ti], ['marginLeft', p.para.ml], ['marginRight', p.para.mr]].forEach(([k, v]) => { if (v) b.style[k] = v; else b.style[k] = ''; });
  });
  onInput(); renderRibbon(); refreshRuler();
}

/* ---------- البحث والاستبدال ---------- */
const FR = { open: false, hits: [], cur: -1, opt: { tk: true, cs: false, ww: false } };
const FR_SKIP = '.wq-ayah,.wq-hadith,.wq-ayah-ref,.wq-fn,.wq-cite,.wq-toc,.wq-bib,.wq-idx-ayat,.wq-idx-hadith';
const FR_TK = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
function frNorm(str, opt) {
  // يرجع النص الموحّد وخريطة من كل حرف فيه إلى موضعه في الأصل
  let out = '', map = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (opt.tk && FR_TK.test(c)) continue;
    let d = opt.cs ? c : c.toLowerCase(); if (d.length !== 1) d = c;
    out += d; map.push(i);
  }
  return { out, map };
}
function frSearch() {
  const q0 = ($('#frFind') || {}).value || '';
  FR.hits = []; FR.cur = -1;
  const qn = frNorm(q0, FR.opt).out;
  if (qn.trim()) {
    const blocks = $$(PARA_SEL + ',td,th', page).filter((b) => !b.querySelector(PARA_SEL + ',td,th'));
    const W = /[\p{L}\p{N}_]/u;
    blocks.forEach((b) => {
      const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      const nodes = []; let full = '';
      while (tw.nextNode()) { const n = tw.currentNode; nodes.push({ n, at: full.length, prot: !!n.parentNode.closest(FR_SKIP) }); full += n.textContent; }
      if (!full) return;
      const { out, map } = frNorm(full, FR.opt);
      let i = out.indexOf(qn);
      while (i >= 0) {
        const j = i + qn.length;
        const okW = !FR.opt.ww || ((i === 0 || !W.test(out[i - 1])) && (j >= out.length || !W.test(out[j])));
        if (okW) {
          const a = map[i], z = map[j - 1] + 1;
          // التشكيل الملاصق لآخر حرف يدخل في المطابقة
          let zz = z; while (zz < full.length && FR_TK.test(full[zz]) && FR.opt.tk) zz++;
          const len = (x) => x.n.textContent.length;
          const pos = (g) => { let k = 0; while (k < nodes.length - 1 && nodes[k].at + len(nodes[k]) <= g) k++; return [nodes[k].n, g - nodes[k].at]; };
          const posEnd = (g) => { let k = 0; while (k < nodes.length - 1 && nodes[k].at + len(nodes[k]) < g) k++; return [nodes[k].n, g - nodes[k].at]; };
          const r = document.createRange(); const [sn, so] = pos(a), [en, eo] = posEnd(zz);
          r.setStart(sn, so); r.setEnd(en, eo);
          const prot = nodes.some((x) => x.prot && x.at < zz && x.at + x.n.textContent.length > a);
          FR.hits.push({ r, prot });
        }
        i = out.indexOf(qn, i + Math.max(1, qn.length));
      }
    });
  }
  frPaint();
}
function frPaint() {
  try {
    if (window.CSS && CSS.highlights) {
      CSS.highlights.delete('wq-find'); CSS.highlights.delete('wq-find-cur');
      if (FR.open && FR.hits.length) {
        CSS.highlights.set('wq-find', new Highlight(...FR.hits.map((h) => h.r)));
        if (FR.cur >= 0 && FR.hits[FR.cur]) CSS.highlights.set('wq-find-cur', new Highlight(FR.hits[FR.cur].r));
      }
    }
  } catch (e) {}
  const c = $('#frCount');
  if (c) c.textContent = !($('#frFind').value || '').trim() ? '' : (FR.hits.length ? (FR.cur >= 0 ? fmtNum(FR.cur + 1) + ' / ' : '') + fmtNum(FR.hits.length) : t('noMatches'));
}
function frGo(dir) {
  if (!FR.hits.length) frSearch();
  if (!FR.hits.length) return;
  if (FR.cur < 0) {
    // أول نتيجة بعد المؤشر
    const sel = document.getSelection(); let k = 0;
    if (sel.rangeCount && page.contains(sel.anchorNode)) { const cr = sel.getRangeAt(0); k = FR.hits.findIndex((h) => h.r.compareBoundaryPoints(Range.START_TO_START, cr) >= 0); if (k < 0) k = 0; }
    FR.cur = dir > 0 ? k : (k - 1 + FR.hits.length) % FR.hits.length;
  } else FR.cur = (FR.cur + dir + FR.hits.length) % FR.hits.length;
  const h = FR.hits[FR.cur];
  const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(h.r.cloneRange());
  lastRange = h.r.cloneRange();
  const rc = h.r.getBoundingClientRect(), cv = $('#canvas'), cr = cv.getBoundingClientRect();
  if (rc.top < cr.top + 60 || rc.bottom > cr.bottom - 40) cv.scrollTop += rc.top - cr.top - cr.height / 3;
  frPaint();
}
function frReplaceOne() {
  if (FR.cur < 0 || !FR.hits[FR.cur]) { frGo(1); return; }
  const h = FR.hits[FR.cur];
  if (h.prot) { toast(t('frProtected')); frGo(1); return; }
  page.focus();
  const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(h.r.cloneRange());
  document.execCommand('insertText', false, $('#frRep').value || '');
  onInput();
  const idx = FR.cur; frSearch(); FR.cur = Math.min(idx, FR.hits.length) - 1; frGo(1);
}
function frReplaceAll() {
  frSearch();
  const rep = $('#frRep').value || '';
  const ok = FR.hits.filter((h) => !h.prot), skipped = FR.hits.length - ok.length;
  if (!ok.length) { toast(skipped ? t('frProtected') : t('noMatches')); return; }
  takeSnapshot(t('snapReplace'));
  for (let i = ok.length - 1; i >= 0; i--) {
    const r = ok[i].r; r.deleteContents();
    if (rep) r.insertNode(document.createTextNode(rep));
  }
  page.normalize();
  onInput();
  frSearch();
  toast(t('replacedN').replace('{n}', fmtNum(ok.length)) + (skipped ? ' ' + t('frSkipped').replace('{n}', fmtNum(skipped)) : ''));
}
function openFind(withReplace) {
  saveRange();
  let bar = $('#findBar');
  const selTxt = (() => { const s = document.getSelection(); const v = s && page.contains(s.anchorNode) ? s.toString() : ''; return v && v.length < 80 && !/\n/.test(v) ? v : ''; })();
  if (!bar) {
    bar = el('div', { id: 'findBar', class: 'find-bar no-print', role: 'search' });
    bar.innerHTML = '<div class="fr-row"><input id="frFind" dir="auto" placeholder="' + E(t('findPh')) + '"><span id="frCount" class="fr-count"></span>' +
      '<button class="rb" id="frPrev" title="' + E(t('findPrev')) + '">▲</button><button class="rb" id="frNext" title="' + E(t('findNext')) + ' (Enter)">▼</button>' +
      '<button class="rb" id="frToggle" title="' + E(t('replace')) + '">' + icon('replace', 16) + '</button><button class="rb" id="frClose" title="' + E(t('close')) + '">×</button></div>' +
      '<div class="fr-row fr-rep"><input id="frRep" dir="auto" placeholder="' + E(t('replacePh')) + '"><button class="btn2" id="frOne">' + E(t('replaceOne')) + '</button><button class="btn2" id="frAll">' + E(t('replaceAll')) + '</button></div>' +
      '<div class="fr-row fr-opts"><label><input type="checkbox" id="frTk"> ' + E(t('ignoreTashkeel')) + '</label><label><input type="checkbox" id="frCs"> ' + E(t('matchCase')) + '</label><label><input type="checkbox" id="frWw"> ' + E(t('wholeWord')) + '</label></div>';
    document.body.append(bar);
    window.addEventListener('resize', placeFind);
    const f = $('#frFind');
    f.addEventListener('input', () => { frSearch(); });
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); frGo(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') closeFind(); });
    $('#frRep').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); frReplaceOne(); } else if (e.key === 'Escape') closeFind(); });
    $('#frNext').onclick = () => frGo(1); $('#frPrev').onclick = () => frGo(-1);
    $('#frOne').onclick = frReplaceOne; $('#frAll').onclick = frReplaceAll; $('#frClose').onclick = closeFind;
    $('#frToggle').onclick = () => bar.classList.toggle('with-rep');
    [['frTk', 'tk'], ['frCs', 'cs'], ['frWw', 'ww']].forEach(([id, k]) => { const c = $('#' + id); c.checked = FR.opt[k]; c.onchange = () => { FR.opt[k] = c.checked; frSearch(); }; });
  }
  FR.open = true; placeFind();
  bar.classList.toggle('with-rep', !!withReplace);
  if (selTxt) $('#frFind').value = selTxt;
  $('#frFind').focus(); $('#frFind').select();
  frSearch();
}
function placeFind() {
  const bar = $('#findBar'); if (!bar) return;
  const r = $('#canvas').getBoundingClientRect();
  bar.style.top = (r.top + 8) + 'px';
  if (document.documentElement.dir === 'rtl') { bar.style.left = (r.left + 18) + 'px'; bar.style.right = ''; }
  else { bar.style.right = (window.innerWidth - r.right + 18) + 'px'; bar.style.left = ''; }
}
function closeFind() {
  FR.open = false; FR.hits = []; FR.cur = -1; frPaint();
  const b = $('#findBar'); if (b) b.remove();
  restoreRange();
}
function initFormatEvents() {
  page.addEventListener('mouseup', () => { if (painter) setTimeout(applyPainter, 0); });
  page.addEventListener('input', () => { if (FR.open) { clearTimeout(FR._t); FR._t = setTimeout(frSearch, 300); } });
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && !e.shiftKey && (k === 'f' || e.code === 'KeyF')) { e.preventDefault(); openFind(false); }
    else if (mod && !e.shiftKey && (k === 'h' || e.code === 'KeyH')) { e.preventDefault(); openFind(true); }
    else if (e.key === 'Escape' && painter) stopPainter();
    else if (e.key === 'Escape' && FR.open && !$('#modalRoot').children.length) closeFind();
  });
}
