/* ===== docx: تصدير ملف Word حقيقي (عناوين، تنسيق، اتجاه، قوائم، جداول، صور، حواشي Word أصلية، إعداد الصفحة) ===== */
function cssHex(c) { const m = String(c).match(/\d+/g); return m && m.length >= 3 ? m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase() : ''; }
/* حدود الجدول حسب اختيار المستخدم */
function tblBorderXml(t) {
  const k = (t.className.match(/\bbd-(\w+)\b/) || [])[1] || 'all';
  const on = { all: 'top left bottom right insideH insideV', outside: 'top left bottom right', inside: 'insideH insideV', h: 'top bottom insideH', apa: 'top bottom', none: '' }[k] || '';
  return ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => on.split(' ').includes(b)
    ? '<w:' + b + ' w:val="single" w:sz="' + ((k === 'apa' || k === 'outside') && !/^inside/.test(b) ? 12 : 4) + '" w:space="0" w:color="' + (k === 'apa' ? '222222' : (k === 'outside' ? '555555' : '999999')) + '"/>'
    : '<w:' + b + ' w:val="nil"/>').join('');
}
/* إطار الصفحة في Word */
function pgBordersXml(s) {
  const k = s.pageBorder; if (!k || k === 'none') return '';
  const v = { single: ['single', 12], double: ['double', 6], thick: ['single', 24], thickThin: ['thickThinSmallGap', 24] }[k]; if (!v) return '';
  const col = ({ teal: '0F5F66', black: '222222', copper: 'B8732E' })[s.pageBorderColor] || '0F5F66';
  return '<w:pgBorders w:offsetFrom="text">' + ['top', 'left', 'bottom', 'right'].map((b) => '<w:' + b + ' w:val="' + v[0] + '" w:sz="' + v[1] + '" w:space="24" w:color="' + col + '"/>').join('') + '</w:pgBorders>';
}

const X = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const RTL_CH = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_CH = /[A-Za-z\u00C0-\u024F]/;
const twip = (cm) => Math.round(cm * 567);

function docxBuilder() {
  const st = { media: [], fnXml: [], fnId: 1, nums: [], rels: [] };
  const s = WQ.doc.settings;
  const docFont = (getComputedStyle(page).fontFamily.split(',')[0] || 'Amiri').replace(/["']/g, '').trim();

  /* ---------- النص ← تشغيلات Word ---------- */
  function runXml(text, f) {
    if (!text) return '';
    // نقسم حسب الاتجاه: المقاطع العربية ت\u064Fعل\u064E\u0651م rtl
    const segs = []; let cur = null;
    for (const ch of text) {
      const k = RTL_CH.test(ch) ? 'R' : (LTR_CH.test(ch) ? 'L' : 'N');
      if (!cur) { cur = { k: k === 'N' ? (f.rtlPara ? 'R' : 'L') : k, t: ch }; continue; }
      if (k === 'N' || k === cur.k) cur.t += ch; else { segs.push(cur); cur = { k, t: ch }; }
    }
    if (cur) segs.push(cur);
    return segs.map((g) => {
      let pr = '';
      if (f.style) pr += '<w:rStyle w:val="' + f.style + '"/>';
      const font = f.font || (f.ayah ? 'Amiri Quran' : null);
      if (font) pr += '<w:rFonts w:ascii="' + X(font) + '" w:hAnsi="' + X(font) + '" w:cs="' + X(font) + '"/>';
      if (f.b) pr += '<w:b/><w:bCs/>';
      if (f.i) pr += '<w:i/><w:iCs/>';
      if (f.s) pr += '<w:strike/>';
      if (f.color) pr += '<w:color w:val="' + f.color + '"/>';
      if (f.sz) pr += '<w:sz w:val="' + f.sz + '"/><w:szCs w:val="' + f.sz + '"/>';
      if (f.hl) pr += '<w:shd w:val="clear" w:color="auto" w:fill="' + f.hl + '"/>';
      if (f.u) pr += '<w:u w:val="single"/>';
      if (f.va) pr += '<w:vertAlign w:val="' + f.va + '"/>';
      if (g.k === 'R') pr += '<w:rtl/>';
      return '<w:r>' + (pr ? '<w:rPr>' + pr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + X(g.t) + '</w:t></w:r>';
    }).join('');
  }
  const hex = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m || (m[4] !== undefined && +m[4] === 0)) return null; return [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  function inline(node, f) {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { out += runXml(c.textContent.replace(/\n/g, ' '), f); return; }
      if (c.nodeType !== 1) return;
      const g = Object.assign({}, f);
      const tag = c.tagName;
      if (c.classList.contains('wq-fn')) { out += footnoteRef(c.dataset.fn, f); return; }
      if (c.classList.contains('wq-ayah')) { g.ayah = true; g.color = '0B4C52'; }
      if (c.classList.contains('wq-hadith')) g.color = '5A3E1B';
      if (c.classList.contains('ibid')) { /* نص عادي */ }
      if (tag === 'BR') { out += '<w:r><w:br/></w:r>'; return; }
      if (tag === 'IMG') { out += imageRun(c); return; }
      if (tag === 'B' || tag === 'STRONG') g.b = true;
      if (tag === 'I' || tag === 'EM') g.i = true;
      if (tag === 'U') g.u = true;
      if (tag === 'S' || tag === 'STRIKE') g.s = true;
      if (tag === 'SUP') g.va = 'superscript';
      if (tag === 'SUB') g.va = 'subscript';
      const sty = c.style;
      if (sty) {
        if (sty.fontWeight && +sty.fontWeight >= 600 || sty.fontWeight === 'bold') g.b = true;
        if (sty.fontStyle === 'italic') g.i = true;
        if (/underline/.test(sty.textDecorationLine || sty.textDecoration || '')) g.u = true;
        if (/line-through/.test(sty.textDecorationLine || sty.textDecoration || '')) g.s = true;
        if (sty.fontFamily) g.font = sty.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (sty.fontSize && /pt$/.test(sty.fontSize)) g.sz = Math.round(parseFloat(sty.fontSize) * 2);
        if (sty.color) g.color = hex(sty.color) || g.color;
        if (sty.backgroundColor) g.hl = hex(sty.backgroundColor) || g.hl;
      }
      out += inline(c, g);
    });
    return out;
  }
  /* ---------- الحواشي (حواشي Word أصلية) ---------- */
  function footnoteRef(id, f) {
    const n = st.fnId++;
    const body = (WQ._fnBody || {})[id] || '';
    const tmp = document.createElement('div'); tmp.innerHTML = body;
    const rtlFn = RTL_CH.test(tmp.textContent) || (!LTR_CH.test(tmp.textContent) && s.lang === 'ar');
    st.fnXml.push('<w:footnote w:id="' + n + '"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/>' + (rtlFn ? '<w:bidi/>' : '') + '</w:pPr>' +
      '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>' +
      inline(tmp, { rtlPara: rtlFn }) + '</w:p></w:footnote>');
    return '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="' + n + '"/></w:r>';
  }
  /* ---------- الصور ---------- */
  function imageRun(img) {
    const m = /^data:image\/(png|jpe?g|gif);base64,/.exec(img.getAttribute('src') || ''); if (!m) return '';
    const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
    const idx = st.media.length + 1, rid = 'rIdImg' + idx;
    st.media.push({ name: 'image' + idx + '.' + ext, data: dataUrlBytes(img.src), ext });
    const maxW = (s.pageSize === 'letter' ? 21.59 : 21) - 2 * (s.margins === 'narrow' ? 1.27 : (s.margins === 'wide' ? 5.08 : 2.5));
    let w = img.naturalWidth || 400, h = img.naturalHeight || 300;
    const wcm = Math.min(maxW, w / 37.8); h = h * (wcm / (w / 37.8)); w = wcm; const hcm = h / 37.8;
    const cx = Math.round(w * 360000), cy = Math.round(hcm * 360000);
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + idx + '" name="Picture ' + idx + '"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + idx + '" name="image' + idx + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  /* ---------- الفقرات ---------- */
  const isRtl = (e) => { try { return e.matches(':dir(rtl)'); } catch (x) { return s.lang === 'ar'; } };
  function para(e, extraPr, f) {
    const rtl = isRtl(e);
    const ta = e.style && e.style.textAlign;
    let pr = extraPr || '';
    if (rtl) pr += '<w:bidi/>';
    if (ta === 'center') pr += '<w:jc w:val="center"/>';
    else if (ta === 'justify' || (!ta && /^(P|LI|BLOCKQUOTE)$/.test(e.tagName))) pr += '<w:jc w:val="both"/>';
    else if (ta === 'right') pr += '<w:jc w:val="' + (rtl ? 'start' : 'end') + '"/>';
    else if (ta === 'left') pr += '<w:jc w:val="' + (rtl ? 'end' : 'start') + '"/>';
    return '<w:p>' + (pr ? '<w:pPr>' + pr + '</w:pPr>' : '') + inline(e, Object.assign({ rtlPara: rtl }, f || {})) + '</w:p>';
  }
  /* محاذاة واحدة في آخر خصائص الفقرة (ترتيب Word: bidi قبل jc) */
  function withJc(px, v) {
    px = px.replace(/<w:jc w:val="[^"]*"\/>/g, '');
    return px.includes('<w:pPr>') ? px.replace('</w:pPr>', '<w:jc w:val="' + v + '"/></w:pPr>') : px.replace('<w:p>', '<w:p><w:pPr><w:jc w:val="' + v + '"/></w:pPr>');
  }
  function newNum(ordered) {
    const id = st.nums.length + 1; st.nums.push(ordered ? 2 : 1); return id;
  }
  const cw = twip(((s.pageSize === 'letter' ? 21.59 : 21) - 2 * (s.margins === 'narrow' ? 1.27 : (s.margins === 'wide' ? 5.08 : 2.5))));
  function block(e) {
    const tag = e.tagName;
    if (/^H[1-3]$/.test(tag)) return para(e, '<w:pStyle w:val="Heading' + tag[1] + '"/>');
    if (tag === 'P' && e.classList.contains('wq-bayt')) {
      // البيت في Word: جدول بلا حدود بعمودين، وكل شطر موزّع على عرض خليته
      const halves = e.classList.contains('single') ? null : [e.querySelector('.sadr'), e.querySelector('.ajz')];
      if (!halves || !halves[0] || !halves[1]) return withJc(para(e), 'center');
      const w = Math.floor(cw * 0.44), gap = cw - 2 * w;
      const cell = (h, cw2) => '<w:tc><w:tcPr><w:tcW w:w="' + cw2 + '" w:type="dxa"/></w:tcPr>' + (h ? withJc(para(h), 'distribute') : '<w:p/>') + '</w:tc>';
      return '<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="' + cw + '" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>' +
        '<w:tblGrid><w:gridCol w:w="' + w + '"/><w:gridCol w:w="' + gap + '"/><w:gridCol w:w="' + w + '"/></w:tblGrid><w:tr>' + cell(halves[0], w) + cell(null, gap) + cell(halves[1], w) + '</w:tr></w:tbl>';
    }
    if (tag === 'P') return para(e);
    if (tag === 'BLOCKQUOTE') return para(e, '<w:pStyle w:val="Quote"/>');
    if (tag === 'HR') return e.classList.contains('wq-pagebreak') ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
    if (tag === 'UL' || tag === 'OL') {
      const id = newNum(tag === 'OL');
      return Array.from(e.children).filter((li) => li.tagName === 'LI').map((li) => para(li, '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + id + '"/></w:numPr>')).join('');
    }
    if (tag === 'TABLE') {
      const rows = Array.from(e.rows);
      // شبكة الإشغال: الخلايا المدمجة رأسياً تظهر في Word كخلايا vMerge متتالية
      const occ = rows.map(() => []); let ncol = 1;
      rows.forEach((r, ri) => {
        let col = 0;
        Array.from(r.cells).forEach((c) => {
          while (occ[ri][col]) col++;
          const cs = c.colSpan || 1, rs = Math.min(c.rowSpan || 1, rows.length - ri);
          for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) occ[ri + a][col + b] = { c, first: a === 0, lead: b === 0, cs };
          col += cs; ncol = Math.max(ncol, col);
        });
      });
      const pct = Array.from(e.querySelectorAll(':scope > colgroup > col')).map((c) => parseFloat(c.style.width) || 0);
      const colW = pct.length === ncol && pct.every((v) => v > 0) ? pct.map((v) => Math.floor(cw * v / 100)) : Array(ncol).fill(Math.floor(cw / ncol));
      // حجم خط الجدول مثل ورّاق: الجداول العريضة بخط أصغر حتى لا تتكسر الكلمات
      const tsz = e.classList.contains('dense') ? 19 : (e.classList.contains('compact') ? 24 : 27);
      const rtl = isRtl(e);
      let x = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>' + (rtl ? '<w:bidiVisual/>' : '') + '<w:tblW w:w="5000" w:type="pct"/>' +
        '<w:tblBorders>' + tblBorderXml(e) + '</w:tblBorders><w:tblCellMar><w:left w:w="45" w:type="dxa"/><w:right w:w="45" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>';
      colW.forEach((w) => { x += '<w:gridCol w:w="' + w + '"/>'; });
      x += '</w:tblGrid>';
      rows.forEach((r, ri) => {
        const head = Array.from(r.cells).length && Array.from(r.cells).every((c) => c.tagName === 'TH');
        x += '<w:tr>' + (head && ri < 3 ? '<w:trPr><w:tblHeader/></w:trPr>' : '');
        for (let col = 0; col < ncol; col++) {
          const o = occ[ri][col];
          if (!o) { x += '<w:tc><w:tcPr><w:tcW w:w="' + colW[col] + '" w:type="dxa"/></w:tcPr><w:p/></w:tc>'; continue; }
          if (!o.lead) continue;
          const c = o.c, w = colW.slice(col, col + o.cs).reduce((a, b) => a + b, 0);
          const vm = (c.rowSpan || 1) > 1 ? (o.first ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>') : '';
          const apa = e.classList.contains('bd-apa');
          const bg = c.style.backgroundColor ? cssHex(c.style.backgroundColor) : (c.tagName === 'TH' && !apa ? 'F4EFE6' : '');
          const apaLine = apa && (c.tagName === 'TH' || ri === 0) ? '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="222222"/></w:tcBorders>' : '';
          x += '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.cs > 1 ? '<w:gridSpan w:val="' + o.cs + '"/>' : '') + vm + apaLine +
            (bg ? '<w:shd w:val="clear" w:color="auto" w:fill="' + bg + '"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr>';
          if (o.first) {
            let pp = para(c, '', Object.assign({ sz: tsz }, c.tagName === 'TH' ? { b: true } : {})).replace('<w:jc w:val="both"/>', '');
            if (c.style.textAlign === 'center' && !/<w:jc /.test(pp)) pp = pp.replace(/<w:pPr>/g, '<w:pPr><w:jc w:val="center"/>');
            x += pp || '<w:p/>';
          } else x += '<w:p/>';
          x += '</w:tc>';
        }
        x += '</w:tr>';
      });
      return x + '</w:tbl><w:p/>';
    }
    if (e.classList && e.classList.contains('wq-toc')) {
      // فهرس Word حقيقي: الأرقام الحالية من ورّاق، وWord يقدر يحدّثها (F9) على خطوط الجهاز
      const rows = Array.from(e.querySelectorAll('.toc-row'));
      let x = '', ri = 0;
      e.childNodes.forEach((c) => {
        if (c.nodeType !== 1) return;
        if (c.classList.contains('wq-block-title')) x += para(c, '<w:pStyle w:val="TOCHeading"/>');
        else if (c.classList.contains('toc-row')) {
          const title = c.firstElementChild ? c.firstElementChild.textContent : '', num = c.lastElementChild ? c.lastElementChild.textContent : '';
          const lvl = (/l(\d)/.exec(c.className) || [0, 1])[1];
          const rtl = isRtl(c);
          const first = ri === 0, last = ri === rows.length - 1; ri++;
          x += '<w:p><w:pPr><w:pStyle w:val="TOC' + lvl + '"/>' + (rtl ? '<w:bidi/>' : '') + '<w:tabs><w:tab w:val="end" w:leader="dot" w:pos="' + cw + '"/></w:tabs></w:pPr>' +
            (first ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : '') +
            runXml(title, { rtlPara: rtl }) + '<w:r><w:tab/></w:r>' + runXml(num, { rtlPara: rtl }) +
            (last ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : '') + '</w:p>';
        }
      });
      return x;
    }
    if (e.classList && e.classList.contains('wq-bib')) {
      let x = '';
      e.childNodes.forEach((c) => {
        if (c.nodeType !== 1 || c.classList.contains('wq-note')) return;
        if (c.classList.contains('wq-block-title')) x += para(c, '<w:pStyle w:val="Heading1"/>');
        else if (c.classList.contains('wq-block-sub')) x += para(c, '<w:pStyle w:val="Heading3"/>');
        else x += para(c, '<w:pStyle w:val="Bibliography"/>');
      });
      return x;
    }
    if (tag === 'DIV') return Array.from(e.children).map(block).join('');
    return para(e);
  }

  /* ---------- التجميع ---------- */
  function build() {
    renderCitations();
    if (!PV.exact) { const was = document.body.classList.contains('pages-mode'); paginate(); if (!was) document.body.classList.remove('pages-mode'); }
    renderToc();
    const body = Array.from(page.children).map(block).join('');
    const ar = s.lang === 'ar', hindi = ar && s.numerals === 'arabic';
    const W = s.pageSize === 'letter' ? 12240 : 11906, H = s.pageSize === 'letter' ? 15840 : 16838;
    const mT = twip(s.margins === 'narrow' ? 1.27 : (s.margins === 'wide' ? 2.54 : 2.5)), mS = twip(s.margins === 'narrow' ? 1.27 : (s.margins === 'wide' ? 5.08 : 2.5));
    const line = { '1': 240, '115': 276, '15': 360, '2': 480 }[s.lineSpacing] || 360;
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const hideFirst = s.hideFirstNum !== false;
    const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr1"/>' + (hideFirst ? '<w:footerReference w:type="first" r:id="rIdFtr2"/>' : '') +
      '<w:footnotePr><w:numFmt w:val="' + (hindi ? 'hindiNumbers' : 'decimal') + '"/>' + (s.fnRestart ? '<w:numRestart w:val="eachPage"/>' : '') + '</w:footnotePr>' +
      '<w:pgSz w:w="' + W + '" w:h="' + H + '"/><w:pgMar w:top="' + mT + '" w:right="' + mS + '" w:bottom="' + mT + '" w:left="' + mS + '" w:header="708" w:footer="567" w:gutter="0"/>' +
      pgBordersXml(s) + '<w:pgNumType w:fmt="' + (hindi ? 'hindiNumbers' : 'decimal') + '"/>' + (hideFirst ? '<w:titlePg/>' : '') + (ar ? '<w:bidi/>' : '') + '</w:sectPr>';
    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body + sect + '</w:body></w:document>';
    const rPrDef = '<w:rFonts w:ascii="' + X(docFont) + '" w:hAnsi="' + X(docFont) + '" w:cs="' + X(docFont) + '" w:eastAsia="' + X(docFont) + '"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="en-US" w:bidi="ar-EG"/>';
    const hs = (id, name, sz, color, lvl) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>' + (lvl !== undefined ? '<w:outlineLvl w:val="' + lvl + '"/>' : '') + '</w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="' + color + '"/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:style>';
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' + rPrDef + '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="' + line + '" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      hs('Heading1', 'heading 1', 52, '0F5F66', 0) + hs('Heading2', 'heading 2', 42, '0F5F66', 1) + hs('Heading3', 'heading 3', 36, '33504F', 2) + hs('TOCHeading', 'TOC Heading', 42, '0F5F66') +
      '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:start="567"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="TOC3"><w:name w:val="toc 3"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:start="1134"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:start w:val="single" w:sz="18" w:space="8" w:color="B8732E"/></w:pBdr><w:ind w:start="567" w:end="567"/></w:pPr><w:rPr><w:color w:val="444444"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Bibliography"><w:name w:val="Bibliography"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:start="567" w:hanging="567"/><w:jc w:val="start"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/><w:color w:val="B8732E"/></w:rPr></w:style>' +
      '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>' +
      '</w:styles>';
    const lvl = (fmt, txt) => '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/><w:lvlText w:val="' + txt + '"/><w:lvlJc w:val="start"/><w:pPr><w:ind w:start="720" w:hanging="360"/></w:pPr></w:lvl>';
    const numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="1">' + lvl('bullet', '•') + '</w:abstractNum><w:abstractNum w:abstractNumId="2">' + lvl(hindi ? 'hindiNumbers' : 'decimal', '%1.') + '</w:abstractNum>' +
      st.nums.map((a, i) => '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + a + '"/>' + (a === 2 ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : '') + '</w:num>').join('') + '</w:numbering>';
    const footnotesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ' + NS + '>' +
      '<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>' +
      st.fnXml.join('') + '</w:footnotes>';
    const ftr = (withNum) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
      (withNum ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>' : '') + '</w:p></w:ftr>';
    const settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      '<Relationship Id="rIdFn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' +
      '<Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      '<Relationship Id="rIdFtr2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>' +
      st.media.map((m, i) => '<Relationship Id="rIdImg' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.name + '"/>').join('') + '</Relationships>';
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + X($('#docTitle').value || '') + '</dc:title><dc:creator>' + X(WQ.doc.meta.author || '') + '</dc:creator><cp:lastModifiedBy>Warraq ' + APP_VERSION + '</cp:lastModifiedBy>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + nowISO().replace(/\.\d+Z$/, 'Z') + '</dcterms:modified></cp:coreProperties>';
    return zipStore([
      { name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rootRels }, { name: 'docProps/core.xml', data: core },
      { name: 'word/document.xml', data: documentXml }, { name: 'word/styles.xml', data: stylesXml }, { name: 'word/numbering.xml', data: numberingXml },
      { name: 'word/footnotes.xml', data: footnotesXml }, { name: 'word/settings.xml', data: settingsXml },
      { name: 'word/footer1.xml', data: ftr(true) }, { name: 'word/footer2.xml', data: ftr(false) },
      { name: 'word/_rels/document.xml.rels', data: rels },
      ...st.media.map((m) => ({ name: 'word/media/' + m.name, data: m.data }))
    ]);
  }
  return { build };
}
async function exportDocx() {
  toast(t('exporting'));
  const blob = docxBuilder().build();
  WQ._lastDocx = blob;
  if (await saveBlob(safeFileName(), 'docx', blob)) toast(t('exportedDocx'));
  return blob;
}
