/* ===== doc97: قراءة ملفات Word القديمة (.doc 97-2003) مباشرة، بدون مكتبات =====
   يقرأ النص والفقرات والجداول والحواشي. التنسيق (العريض والأحجام) غير مقروء في هذا الإصدار،
   والعناوين تُكتشف من شكل السطر (الترقيم 2.1 وكلمات مثل الفصل/Chapter). */

function cfbRead(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0xE011CFD0) throw new Error('not cfb');
  const secSize = 1 << dv.getUint16(0x1E, true), miniSize = 1 << dv.getUint16(0x20, true);
  const nFat = dv.getUint32(0x2C, true), dirStart = dv.getUint32(0x30, true), miniCutoff = dv.getUint32(0x38, true);
  const miniFatStart = dv.getUint32(0x3C, true), difatStart = dv.getUint32(0x44, true);
  const secOff = (s) => (s + 1) * secSize;
  // DIFAT ← قائمة قطاعات FAT
  const fatSecs = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) { const s = dv.getUint32(0x4C + i * 4, true); if (s < 0xFFFFFFFA) fatSecs.push(s); }
  let d = difatStart, guard = 0;
  while (d < 0xFFFFFFFA && fatSecs.length < nFat && guard++ < 10000) {
    const per = secSize / 4 - 1;
    for (let i = 0; i < per && fatSecs.length < nFat; i++) { const s = dv.getUint32(secOff(d) + i * 4, true); if (s < 0xFFFFFFFA) fatSecs.push(s); }
    d = dv.getUint32(secOff(d) + per * 4, true);
  }
  const fat = new Uint32Array(fatSecs.length * secSize / 4);
  fatSecs.forEach((s, i) => { for (let j = 0; j < secSize / 4; j++) fat[i * secSize / 4 + j] = dv.getUint32(secOff(s) + j * 4, true); });
  const chain = (start) => { const out = []; let s = start, g = 0; while (s < 0xFFFFFFFA && g++ < 1e6) { out.push(s); s = fat[s]; } return out; };
  const readChain = (start, size) => {
    const secs = chain(start), out = new Uint8Array(secs.length * secSize);
    secs.forEach((s, i) => out.set(u8.subarray(secOff(s), secOff(s) + secSize), i * secSize));
    return size !== undefined ? out.subarray(0, size) : out;
  };
  // الدليل
  const dirBytes = readChain(dirStart), ddv = new DataView(dirBytes.buffer);
  const entries = [];
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
    const nl = ddv.getUint16(o + 64, true); if (!nl) { entries.push(null); continue; }
    let name = ''; for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(ddv.getUint16(o + i * 2, true));
    entries.push({ name, type: dirBytes[o + 66], start: ddv.getUint32(o + 116, true), size: ddv.getUint32(o + 120, true) });
  }
  const root = entries[0];
  const miniStream = root ? readChain(root.start, root.size) : new Uint8Array(0);
  const miniFat = miniFatStart < 0xFFFFFFFA ? (() => { const b = readChain(miniFatStart); const v = new DataView(b.buffer); const a = new Uint32Array(b.length / 4); for (let i = 0; i < a.length; i++) a[i] = v.getUint32(i * 4, true); return a; })() : new Uint32Array(0);
  const stream = (name) => {
    const e = entries.find((x) => x && x.type === 2 && x.name === name); if (!e) return null;
    if (e.size >= miniCutoff) return readChain(e.start, e.size);
    const out = new Uint8Array(e.size); let s = e.start, o = 0, g = 0;
    while (s < 0xFFFFFFFA && o < e.size && g++ < 1e6) { const n = Math.min(miniSize, e.size - o); out.set(miniStream.subarray(s * miniSize, s * miniSize + n), o); o += n; s = miniFat[s]; }
    return out;
  };
  return { stream };
}

function doc97Text(buf) {
  const cfb = cfbRead(buf);
  const wd = cfb.stream('WordDocument'); if (!wd) throw new Error('no WordDocument');
  const w = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (w.getUint16(0, true) !== 0xA5EC) throw new Error('not word');
  const flags = w.getUint16(0x0A, true);
  if (flags & 0x0100) throw new Error('encrypted');
  const table = cfb.stream((flags & 0x0200) ? '1Table' : '0Table'); if (!table) throw new Error('no table');
  const t = new DataView(table.buffer, table.byteOffset, table.byteLength);
  // FibRgLw97: ccpText ثم ccpFtn
  const csw = w.getUint16(32, true), lwOff = 34 + csw * 2 + 2;
  const ccpText = w.getInt32(lwOff + 12, true), ccpFtn = w.getInt32(lwOff + 16, true);
  const cbRgLw = w.getUint16(lwOff - 2, true) * 4, fcOff = lwOff + cbRgLw + 2;
  // FibRgFcLcb97: fcClx هو الزوج رقم 33
  const fcClx = w.getUint32(fcOff + 33 * 8, true), lcbClx = w.getUint32(fcOff + 33 * 8 + 4, true);
  let p = fcClx; const end = fcClx + lcbClx;
  while (p < end && table[p] === 0x01) { p += 3 + t.getUint16(p + 1, true); }
  if (table[p] !== 0x02) throw new Error('clx');
  const lcb = t.getUint32(p + 1, true); p += 5;
  const n = (lcb - 4) / 12;
  const cps = []; for (let i = 0; i <= n; i++) cps.push(t.getUint32(p + i * 4, true));
  const pcdBase = p + (n + 1) * 4;
  const dec1252 = new TextDecoder('windows-1252'), dec16 = new TextDecoder('utf-16le');
  let text = '';
  const cellFcs = []; // موضع كل علامة خلية/صف (\x07) في المتن داخل WordDocument
  for (let i = 0; i < n; i++) {
    const fcRaw = t.getUint32(pcdBase + i * 8 + 2, true), len = cps[i + 1] - cps[i];
    const comp = !!(fcRaw & 0x40000000), fc0 = comp ? (fcRaw & 0x3FFFFFFF) / 2 : fcRaw;
    const piece = comp ? dec1252.decode(wd.subarray(fc0, fc0 + len)) : dec16.decode(wd.subarray(fc0, fc0 + len * 2));
    for (let k = 0; k < piece.length && cps[i] + k < ccpText; k++) if (piece.charCodeAt(k) === 7) cellFcs.push(fc0 + k * (comp ? 1 : 2));
    text += piece;
  }
  let taps = [];
  try { taps = cellFcs.map(tapReader(wd, w, t, fcOff, cfb.stream('Data'))); } catch (e) { taps = []; }
  return { main: text.slice(0, ccpText), ftn: text.slice(ccpText, ccpText + Math.max(0, ccpFtn)), taps };
}

/* خصائص صف الجدول (TAP) من خصائص فقرة نهاية الصف: حدود الخلايا والدمج.
   يرجع null لعلامة نهاية خلية عادية، و{ centers, cells } لعلامة نهاية الصف */
function tapReader(wd, w, t, fcOff, data) {
  const dv = data && new DataView(data.buffer, data.byteOffset, data.byteLength);
  // PlcBtePapx هو الزوج رقم 13 في FibRgFcLcb97
  const fcBte = w.getUint32(fcOff + 13 * 8, true), lcbBte = w.getUint32(fcOff + 13 * 8 + 4, true);
  const nb = (lcbBte - 4) / 8;
  const aFc = [], aPn = [];
  for (let i = 0; i <= nb; i++) aFc.push(t.getUint32(fcBte + i * 4, true));
  for (let i = 0; i < nb; i++) aPn.push(t.getUint32(fcBte + (nb + 1) * 4 + i * 4, true) & 0x3FFFFF);
  const sprmLen = (g, p, sprm) => {
    switch (sprm >> 13) {
      case 0: case 1: return 1; case 2: case 4: case 5: return 2; case 3: return 4; case 7: return 3;
      default: return sprm === 0xD608 || sprm === 0xD606 ? g.getUint16(p, true) + 1 : g.getUint8(p) + 1;
    }
  };
  return (fc) => {
    let b = -1; for (let i = 0; i < nb; i++) if (fc >= aFc[i] && fc < aFc[i + 1]) { b = i; break; }
    if (b < 0) return null;
    const base = aPn[b] * 512, crun = wd[base + 511];
    let j = -1;
    for (let i = 0; i < crun; i++) { const a = w.getUint32(base + i * 4, true), z = w.getUint32(base + (i + 1) * 4, true); if (fc >= a && fc < z) { j = i; break; } }
    if (j < 0) return null;
    const bOff = wd[base + (crun + 1) * 4 + j * 13];
    if (!bOff) return null;
    let p = base + bOff * 2, len;
    const cb = wd[p];
    if (cb === 0) { len = wd[p + 1] * 2; p += 2; } else { len = cb * 2 - 1; p += 1; }
    let tap = null;
    const scan = (g, bytes, p, end) => {
      while (p + 2 <= end) {
        const sprm = g.getUint16(p, true); p += 2;
        const L = sprmLen(g, p, sprm);
        if (sprm === 0x6646 && dv) { const o = g.getUint32(p, true); if (o + 2 <= data.length) scan(dv, data, o + 2, o + 2 + dv.getUint16(o, true)); } // sprmPHugePapx: الخصائص في Data
        if (sprm === 0xD608) {
          const q = p + 2, itc = bytes[q];
          const centers = []; for (let k = 0; k <= itc; k++) centers.push(g.getInt16(q + 1 + k * 2, true));
          const tcBase = q + 1 + (itc + 1) * 2, room = p + L - tcBase;
          const cells = [];
          for (let k = 0; k < itc; k++) {
            const f = (k + 1) * 20 <= room ? g.getUint16(tcBase + k * 20, true) : 0;
            cells.push({ hm: f & 3, vm: (f >> 5) & 3 });
          }
          tap = { centers, cells };
        }
        p += L;
      }
    };
    scan(w, wd, p + 2, p + len); // بعد istd
    return tap;
  };
}

/* النص ← فقرات ورّاق */
function cleanFields(s) {
  // الحقول: \x13 تعليمات \x14 نتيجة \x15 ← نحتفظ بالنتيجة فقط
  let out = '', depth = 0, mode = [];
  for (const ch of s) {
    if (ch === '\x13') { depth++; mode.push('instr'); continue; }
    if (ch === '\x14') { if (mode.length) mode[mode.length - 1] = 'res'; continue; }
    if (ch === '\x15') { depth = Math.max(0, depth - 1); mode.pop(); continue; }
    if (mode.length && mode[mode.length - 1] === 'instr') continue;
    out += ch;
  }
  return out;
}
/* خلايا جدول Word القديم + خصائص الصفوف ← جدول ورّاق بالدمج وعرض الأعمدة */
function doc97Grid(cells, cellTaps, fmt) {
  const rows = []; let cur = [];
  cells.forEach((c, k) => {
    if (cellTaps[k]) { rows.push({ texts: cur, tap: cellTaps[k] }); cur = []; } else cur.push(c);
  });
  if (cur.length) rows.push({ texts: cur, tap: null });
  // حدود الأعمدة = اتحاد حدود خلايا كل الصفوف
  const bounds = [];
  rows.forEach((r) => r.tap && r.tap.centers.forEach((x) => { if (!bounds.some((b) => Math.abs(b - x) <= 15)) bounds.push(x); }));
  bounds.sort((a, b) => a - b);
  const at = (x) => { let best = 0; bounds.forEach((b, i) => { if (Math.abs(b - x) < Math.abs(bounds[best] - x)) best = i; }); return best; };
  const model = rows.filter((r) => r.texts.length).map((r) => {
    const tp = r.tap, ok = tp && tp.cells.length === r.texts.length && tp.centers.length === r.texts.length + 1;
    const row = { cells: [], before: ok ? at(tp.centers[0]) : 0 };
    r.texts.forEach((txt, k) => {
      const info = ok ? tp.cells[k] : { hm: 0, vm: 0 };
      const span = ok ? Math.max(1, at(tp.centers[k + 1]) - at(tp.centers[k])) : 1;
      const html = fmt(txt);
      if ((info.hm & 2) && !(info.hm & 1) && row.cells.length) { const prev = row.cells[row.cells.length - 1]; prev.span += span; if (html) prev.html += (prev.html ? '<br>' : '') + html; return; }
      row.cells.push({ html, span, vm: (info.vm & 1) ? ((info.vm & 2) ? 'restart' : 'cont') : null });
    });
    return row;
  });
  const widths = bounds.length > 2 ? bounds.slice(1).map((b, i) => b - bounds[i]) : null;
  return buildGridTable(model, widths);
}
function doc97ToWarraq(buf) {
  const { main, ftn, taps } = doc97Text(buf);
  // نصوص الحواشي: كل حاشية تبدأ بالعلامة \x02
  const fnTexts = cleanFields(ftn).split('\x02').slice(1).map((x) => x.replace(/[\r\x07\x0B\x0C\x01\x08]+/g, ' ').trim());
  const footnotes = {};
  let fnIdx = 0;
  const inline = (s) => {
    let h = '';
    for (const ch of s) {
      if (ch === '\x02') { const id = uid('f'); footnotes[id] = { refId: '', page: '', text: fnTexts[fnIdx++] || '' }; h += '<sup class="wq-fn" data-fn="' + id + '" contenteditable="false">*</sup>'; }
      else if (ch === '\x0B') h += '<br>';
      else if (ch === '\x01' || ch === '\x08' || ch === '\x05' || ch < ' ' && ch !== '\t') { /* صورة/كائن/رمز تحكم */ }
      else if (ch === '\t') h += ' ';
      else h += E(ch);
    }
    return h.replace(/^\s+|\s+$/g, '');
  };
  const body = cleanFields(main).replace(/\x0C/g, '\r\x0C\r');
  // نقسم النص لمقاطع تنتهي بـ \r (فقرة) أو \x07 (خلية جدول)
  const segs = []; let cur = '';
  let mi = 0; // ترتيب علامة \x07 ← خصائص الصف (TAP) المقابلة
  for (const ch of body) { if (ch === '\r' || ch === '\x07') { segs.push({ t: cur, end: ch, tap: ch === '\x07' ? taps[mi++] || null : null }); cur = ''; } else cur += ch; }
  if (cur) segs.push({ t: cur, end: '\r' });
  const items = [];
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    if (sg.t === '\x0C') { items.push({ kind: 'break' }); continue; }
    if (sg.end === '\r' && !(segs[i + 1] && segs[i + 1].end === '\x07')) { items.push({ kind: 'p', raw: sg.t }); continue; }
    // منطقة جدول: خلايا (والفقرات داخل الخلية تُدمج معها)
    const cells = [], cellTaps = []; let acc = [];
    while (i < segs.length) {
      const x = segs[i];
      if (x.end === '\x07') {
        acc.push(x.t);
        // أول خلية: الفقرات اللي قبلها غالباً عنوان فوق الجدول، مش جزء من الخلية
        if (!cells.length && acc.length > 1) { acc.slice(0, -1).forEach((t0) => items.push({ kind: 'p', raw: t0 })); acc = acc.slice(-1); }
        cells.push(acc.join('\n')); cellTaps.push(x.tap); acc = []; i++; continue;
      }
      if (segs[i + 1] && segs[i + 1].end === '\x07') { acc.push(x.t); i++; continue; }
      break;
    }
    i--;
    if (cellTaps.some(Boolean)) { items.push({ kind: 'tbl', cells, cellTaps }); continue; }
    // ملف بدون خصائص صفوف مقروءة: عدد الأعمدة من الصف الأول (حتى أول علامة نهاية صف = خلية فارغة)
    const firstEnd = cells.indexOf('');
    const ncol = firstEnd > 0 ? firstEnd : cells.length;
    const rows = [];
    for (let k = 0; k < cells.length;) {
      const row = cells.slice(k, k + ncol); if (!row.length) break;
      rows.push(row); k += ncol;
      if (cells[k] === '') k++; // علامة نهاية الصف
    }
    items.push({ kind: 'tbl', rows: rows.filter((r) => r.some((c) => c.trim())) });
  }
  // العناوين من شكل السطر + تنظيف الفراغات
  let html = '', lastEmpty = true, detected = 0;
  items.forEach((it) => {
    if (it.kind === 'break') { if (!lastEmpty) { html += '<hr class="wq-pagebreak">'; lastEmpty = true; } return; }
    if (it.kind === 'tbl' && it.cellTaps) { html += doc97Grid(it.cells, it.cellTaps, (c) => c.split('\n').map(inline).filter(Boolean).join('<br>')); lastEmpty = false; return; }
    if (it.kind === 'tbl') {
      html += '<table><tbody>' + it.rows.map((r, ri) => '<tr>' + r.map((c) => '<td dir="auto">' + (c.split('\n').map(inline).filter(Boolean).join('<br>') || '<br>') + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      lastEmpty = false; return;
    }
    const h = inline(it.raw), plain = h.replace(/<[^>]+>/g, '').trim();
    if (!plain && !/wq-fn/.test(h)) { if (!lastEmpty) { html += '<p dir="auto"><br></p>'; lastEmpty = true; } return; }
    const m = plain.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?[.)]?\s+\S/);
    let lvl = 0;
    if (plain.length <= 90 && !/[.!؟?،,;]$/.test(plain)) {
      if (m && m[3]) lvl = 3; else if (m && m[2]) lvl = 2;
      else if (/^(الفصل|الباب|المبحث|chapter|introduction|review of literature|summary|conclusion|references|abstract|المقدمة|الخاتمة|الملخص|المراجع|قائمة)/i.test(plain) && plain.length <= 60) lvl = /^(المبحث)/.test(plain) ? 2 : 1;
    }
    if (lvl) { html += '<h' + lvl + ' dir="auto">' + h + '</h' + lvl + '>'; detected++; }
    else html += '<p dir="auto">' + h + '</p>';
    lastEmpty = false;
  });
  html = html.replace(/(<p dir="auto"><br><\/p>|<hr class="wq-pagebreak">)+$/, '');
  return { html, footnotes, detected, fromDoc: true };
}
