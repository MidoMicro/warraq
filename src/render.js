/* ===== render: رسم الصفحات على canvas (يحترم العربية)، وتصدير PDF وصور PNG، والطباعة ===== */

/* ---------- الحفظ العام لأي ملف ---------- */
async function saveBlob(base, ext, blob) {
  const name = base + '.' + ext;
  if (WQ.downloads) {
    try { await WQ.downloads.save({ filename: name, data: blob }); return true; }
    catch (err) { toast(err && err.code === 'declined' ? t('saveDeclined') : t('saveUnavailable')); return false; }
  }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    return true;
  } catch (e) { toast(t('saveUnavailable')); return false; }
}

/* ---------- رسم صفحة واحدة ---------- */
function fontOf(cs) { return cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
function isTransparent(c) { return !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c); }
function drawPage(pv, scale) {
  const r0 = pv.getBoundingClientRect();
  const cv = document.createElement('canvas');
  cv.width = Math.round(r0.width * scale); cv.height = Math.round(r0.height * scale);
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, r0.width, r0.height);
  const X = (x) => x - r0.left, Y = (y) => y - r0.top;
  const els = $$('*', pv);
  // 1) الخلفيات والحدود
  els.forEach((e) => {
    if (e.closest('.pv-num') && e !== pv) { /* نص فقط */ }
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = e.getBoundingClientRect(); if (!r.width && !r.height) return;
    if (!isTransparent(cs.backgroundColor)) { ctx.fillStyle = cs.backgroundColor; ctx.fillRect(X(r.left), Y(r.top), r.width, r.height); }
    [['Top', r.left, r.top, r.right, r.top], ['Bottom', r.left, r.bottom, r.right, r.bottom], ['Left', r.left, r.top, r.left, r.bottom], ['Right', r.right, r.top, r.right, r.bottom]].forEach(([side, x1, y1, x2, y2]) => {
      const w = parseFloat(cs['border' + side + 'Width']); const st = cs['border' + side + 'Style'];
      if (!w || st === 'none' || st === 'hidden') return;
      ctx.strokeStyle = cs['border' + side + 'Color'];
      ctx.setLineDash(st === 'dotted' ? [1, 2] : (st === 'dashed' ? [6, 4] : []));
      const sgn = side === 'Top' || side === 'Left' ? 1 : -1;
      // الخط المزدوج = خطان رفيعان بينهما فراغ
      const lines = st === 'double' && w >= 3 ? [[w / 6, w / 3], [w - w / 6, w / 3]] : [[w / 2, w]];
      lines.forEach(([d, lw]) => {
        const o = d * sgn; ctx.lineWidth = lw;
        ctx.beginPath();
        if (side === 'Top' || side === 'Bottom') { ctx.moveTo(X(x1), Y(y1) + o); ctx.lineTo(X(x2), Y(y2) + o); }
        else { ctx.moveTo(X(x1) + o, Y(y1)); ctx.lineTo(X(x2) + o, Y(y2)); }
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);
  });
  // خط فاصل الحواشي (عنصر وهمي ::before)
  $$('.pv-fns', pv).forEach((f) => {
    if (!f.childElementCount) return;
    const r = f.getBoundingClientRect(), w = r.width * 0.35, rtl = f.dir === 'rtl';
    const y = Y(r.top) + 4;
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(rtl ? X(r.right) - w : X(r.left), y); ctx.lineTo(rtl ? X(r.right) : X(r.left) + w, y); ctx.stroke();
  });
  // سطور الكراسة
  if (WQ._rule) $$('.pv-box.ruled', pv).forEach((bx) => {
    const r = bx.getBoundingClientRect(), f = bx.querySelector('.pv-fns');
    const limit = f && f.childElementCount ? f.getBoundingClientRect().top : r.bottom;
    const R = WQ._rule;
    ctx.strokeStyle = RULE_COLOR; ctx.lineWidth = R.kind === 'dots' ? 1.6 : 1; ctx.lineCap = R.kind === 'dots' ? 'round' : 'butt';
    ctx.globalAlpha = R.kind === 'line' ? 0.7 : 1;
    ctx.setLineDash(R.kind === 'dots' ? [0.01, 6] : (R.kind === 'dash' ? [6, 4] : []));
    for (let y = r.top + R.off + 1; y < limit - 1; y += R.gap) { ctx.beginPath(); ctx.moveTo(X(r.left) + 1, Y(y)); ctx.lineTo(X(r.right), Y(y)); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  });
  // 2) الصور
  $$('img', pv).forEach((im) => { const r = im.getBoundingClientRect(); try { ctx.drawImage(im, X(r.left), Y(r.top), r.width, r.height); } catch (e) {} });
  // 3) علامات القوائم
  $$('li', pv).forEach((li) => {
    const list = li.parentElement; if (!list) return;
    const cs = getComputedStyle(li), r = li.getBoundingClientRect();
    const idx = Array.from(list.children).indexOf(li) + (+list.getAttribute('start') || 1);
    let mark = '•';
    if (list.tagName === 'OL') mark = (getComputedStyle(list).listStyleType === 'arabic-indic' ? toArabicDigits(String(idx)) : String(idx)) + '.';
    ctx.font = fontOf(cs); ctx.fillStyle = cs.color; ctx.textBaseline = 'top';
    const rtl = li.matches(':dir(rtl)');
    ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'left' : 'right';
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    ctx.fillText(mark, rtl ? X(r.right) + 6 : X(r.left) - 6, Y(r.top) + (lh - parseFloat(cs.fontSize)) / 2);
  });
  // 4) النصوص كلمة كلمة (الترتيب والاتجاه من تخطيط المتصفح نفسه، والتشكيل من canvas)
  const walker = document.createTreeWalker(pv, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const n = walker.currentNode; const txt = n.textContent; if (!txt.trim()) continue;
    const pe = n.parentElement; const cs = getComputedStyle(pe);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const block = pe.closest('p,li,td,th,h1,h2,h3,blockquote,div') || pe;
    const rtl = block.matches(':dir(rtl)');
    ctx.font = fontOf(cs); ctx.fillStyle = cs.color; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
    const m0 = ctx.measureText('Hgجـ'); const asc = m0.fontBoundingBoxAscent, desc = m0.fontBoundingBoxDescent;
    let deco = '';
    for (let a = pe; a && a !== pv; a = a.parentElement) { const d = getComputedStyle(a).textDecorationLine; if (d && d !== 'none') deco += ' ' + d; }
    // نقسم كل كلمة لمقاطع حسب الاتجاه (عربي / لاتيني / محايد)، ونرسم كل مقطع في مكانه الفعلي
    const cls = (ch) => /[\u0590-\u05FF\u0620-\u064A\u066E-\u06D3\u06D5\u06FA-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(ch) ? 'R' : (/[A-Za-z\u00C0-\u024F]/.test(ch) ? 'L' : 'N');
    const blockDir = rtl ? 'R' : 'L';
    const drawSeg = (st, en, dir) => {
      range.setStart(n, st); range.setEnd(n, en);
      const rects = range.getClientRects(); if (!rects.length) return;
      const seg = txt.slice(st, en);
      if (rects.length > 1 && en - st > 1) { for (let k = st; k < en; k++) drawSeg(k, k + 1, dir); return; }
      const r = rects[0];
      ctx.direction = dir === 'R' ? 'rtl' : 'ltr'; ctx.textAlign = dir === 'R' ? 'right' : 'left';
      const base = Y(r.top) + (r.height - (asc + desc)) / 2 + asc;
      ctx.fillText(seg, dir === 'R' ? X(r.right) : X(r.left), base);
      if (deco) {
        ctx.strokeStyle = cs.color; ctx.lineWidth = Math.max(1, parseFloat(cs.fontSize) / 16);
        if (deco.includes('underline')) { ctx.beginPath(); ctx.moveTo(X(r.left), base + 3); ctx.lineTo(X(r.right), base + 3); ctx.stroke(); }
        if (deco.includes('line-through')) { const yy = base - asc * 0.3; ctx.beginPath(); ctx.moveTo(X(r.left), yy); ctx.lineTo(X(r.right), yy); ctx.stroke(); }
      }
    };
    const re = /\S+/g; let m;
    while ((m = re.exec(txt))) {
      const w = m[0], o = m.index;
      // مقاطع متجانسة (مع إلحاق علامات التشكيل بما قبلها)
      const segs = [];
      for (let i = 0; i < w.length; i++) {
        let c = cls(w[i]);
        if (/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/.test(w[i]) && segs.length) c = segs[segs.length - 1].c;
        if (segs.length && segs[segs.length - 1].c === c) segs[segs.length - 1].e = i + 1; else segs.push({ c, s: i, e: i + 1 });
      }
      segs.forEach((g, i) => {
        let d = g.c;
        if (d === 'N') {
          const prev = segs.slice(0, i).reverse().find((x) => x.c !== 'N'), next = segs.slice(i + 1).find((x) => x.c !== 'N');
          const pd = prev ? prev.c : blockDir, nd = next ? next.c : blockDir;
          d = (pd === 'L' && nd === 'L') ? 'L' : blockDir;
          if (pd === 'R' || nd === 'R') d = rtl ? 'R' : (pd === 'R' && nd === 'R' ? 'R' : 'L');
        }
        drawSeg(o + g.s, o + g.e, d);
      });
    }
  }
  return cv;
}

/* ---------- تجهيز الصفحات للرسم ---------- */
async function withPages(fn) {
  const wasMode = document.body.classList.contains('pages-mode');
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  if (!wasMode || PV.stale) { document.body.classList.add('pages-mode'); paginate(); }
  const zoomWas = getComputedStyle(document.documentElement).getPropertyValue('--zoom');
  document.documentElement.style.setProperty('--zoom', 1);
  try { return await fn($$('.pv-page', $('#pagesView'))); }
  finally {
    document.documentElement.style.setProperty('--zoom', zoomWas || 1);
    if (!wasMode) document.body.classList.remove('pages-mode');
  }
}
const sleep0 = () => new Promise((r) => setTimeout(r, 0));
function progress(msg) { toast(msg); }

/* ---------- PDF (صور الصفحات، بدون مكتبات) ---------- */
function dataUrlBytes(u) { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function pdfFromJpegs(imgs, wPt, hPt, title) {
  const enc = new TextEncoder(); const chunks = []; let len = 0; const offs = [];
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (id, body) => { offs[id] = len; push(id + ' 0 obj\n'); body(); push('\nendobj\n'); };
  const hex16 = (s) => { let h = 'FEFF'; for (const ch of s) { const c = ch.codePointAt(0); if (c > 0xFFFF) { const v = c - 0x10000; h += ((0xD800 + (v >> 10)).toString(16) + (0xDC00 + (v & 0x3FF)).toString(16)).toUpperCase(); } else h += c.toString(16).padStart(4, '0').toUpperCase(); } return '<' + h + '>'; };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = imgs.length, pageIds = [];
  for (let i = 0; i < n; i++) pageIds.push(5 + i * 3);
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Count ' + n + ' /Kids [' + pageIds.map((x) => x + ' 0 R').join(' ') + '] >>'));
  obj(3, () => push('<< /Title ' + hex16(title || 'Warraq') + ' /Producer (Warraq ' + APP_VERSION + ') /Creator (Warraq) >>'));
  obj(4, () => push('<< >>'));
  imgs.forEach((im, i) => {
    const p = 5 + i * 3, c = p + 1, x = p + 2;
    obj(p, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + wPt + ' ' + hPt + '] /Resources << /XObject << /Im' + i + ' ' + x + ' 0 R >> >> /Contents ' + c + ' 0 R >>'));
    const cs = 'q ' + wPt + ' 0 0 ' + hPt + ' 0 0 cm /Im' + i + ' Do Q';
    obj(c, () => push('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream'));
    obj(x, () => { push('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n'); push(im.bytes); push('\nendstream'); });
  });
  const xref = len; const total = 5 + n * 3;
  push('xref\n0 ' + total + '\n0000000000 65535 f \n');
  for (let i = 1; i < total; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  push('trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(chunks, { type: 'application/pdf' });
}
async function exportPDF() {
  progress(t('exporting'));
  const blob = await withPages(async (pages) => {
    const imgs = [];
    for (let i = 0; i < pages.length; i++) {
      const cv = drawPage(pages[i], 1.7);
      imgs.push({ w: cv.width, h: cv.height, bytes: dataUrlBytes(cv.toDataURL('image/jpeg', 0.8)) });
      if (i % 5 === 4) { progress(t('exportingN').replace('{n}', fmtNum(i + 1)).replace('{m}', fmtNum(pages.length))); await sleep0(); }
    }
    const letter = WQ.doc.settings.pageSize === 'letter';
    return pdfFromJpegs(imgs, letter ? 612 : 595.28, letter ? 792 : 841.89, $('#docTitle').value || t('untitled'));
  });
  if (await saveBlob(safeFileName(), 'pdf', blob)) toast(t('exportedPdf'));
  WQ._lastPdf = blob;
  return blob;
}

/* ---------- PNG ---------- */
function currentPageIndex(pages) {
  const top = $('#canvas').getBoundingClientRect().top + 40;
  let best = 0; pages.forEach((p, i) => { if (p.getBoundingClientRect().top <= top) best = i; });
  return best;
}
async function exportPNG(all) {
  progress(t('exporting'));
  await withPages(async (pages) => {
    const blobOf = (cv) => new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!all) {
      const i = document.body.classList.contains('pages-mode') ? currentPageIndex(pages) : 0;
      const b = await blobOf(drawPage(pages[i], 2));
      WQ._lastPng = b;
      if (await saveBlob(safeFileName() + '-' + (i + 1), 'png', b)) toast(t('exportedPng'));
      return;
    }
    const files = [];
    for (let i = 0; i < pages.length; i++) {
      const b = await blobOf(drawPage(pages[i], 2));
      files.push({ name: 'page-' + String(i + 1).padStart(3, '0') + '.png', data: new Uint8Array(await b.arrayBuffer()) });
      if (i % 5 === 4) { progress(t('exportingN').replace('{n}', fmtNum(i + 1)).replace('{m}', fmtNum(pages.length))); await sleep0(); }
    }
    const z = zipStore(files); WQ._lastZip = z;
    if (await saveBlob(safeFileName() + '-pages', 'zip', z)) toast(t('exportedPng'));
  });
}
/* ملف zip بسيط (بدون ضغط) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(a) { let c = 0xFFFFFFFF; for (let i = 0; i < a.length; i++) c = CRC_T[(c ^ a[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(); const parts = []; const cen = []; let off = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255], u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  files.forEach((f) => {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(lh, name, data);
    cen.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += lh.length + name.length + data.length;
  });
  const cenLen = cen.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cenLen), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...cen, end], { type: 'application/zip' });
}

/* ---------- الطباعة ---------- */
async function doPrint() {
  // داخل معاينة Claude الطباعة ممنوعة، فنعطي ملف PDF للطباعة
  if (WQ.downloads) { toast(t('printViaPdf')); await exportPDF(); return; }
  document.body.classList.add('pages-mode'); paginate();
  setTimeout(() => { try { window.print(); } catch (e) { exportPDF(); } }, 100);
}
