/* ===== editor: محرك التحرير (الكتابة، الاتجاه، الأرقام، الطباعة الفرنسية، اللصق) ===== */
const BLOCK_SEL = 'p,h1,h2,h3,h4,blockquote,li,td,th,div';
const PAGE_H_PX = 29.7 * 37.7953; // ارتفاع A4 بالبكسل
let page;

function initEditor() {
  page = $('#page');
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  page.addEventListener('beforeinput', onBeforeInput);
  page.addEventListener('input', onInput);
  page.addEventListener('paste', onPaste);
  document.addEventListener('selectionchange', () => { if (page.contains(document.getSelection().anchorNode)) updateToolbarState(); });
}

/* ---------- المستند ↔ المحرر ---------- */
function loadDocIntoEditor(doc) {
  WQ.doc = doc;
  WQ._lastWords = null;
  doc.references = doc.references || [];
  doc.footnotes = doc.footnotes || {};
  doc.snapshots = doc.snapshots || [];
  page.innerHTML = doc.content.html || '<p dir="auto"><br></p>';
  normalizeBlocks();
  applyDocSettings();
  $('#docTitle').value = doc.meta.title || '';
  refreshDerived();
  if (typeof verifyAyat === 'function') verifyAyat();
}
function editorHtml() { return page.innerHTML; }

function applyDocSettings() {
  const s = WQ.doc.settings;
  const sheet = $('#sheet'), fz = $('#fnZone');
  page.dir = fz.dir = s.lang === 'ar' ? 'rtl' : 'ltr';
  page.lang = fz.lang = s.lang;
  sheet.classList.toggle('letter', s.pageSize === 'letter');
  sheet.classList.remove('m-narrow', 'm-wide');
  if (s.margins !== 'normal') sheet.classList.add('m-' + s.margins);
  page.classList.remove('ls-1', 'ls-115', 'ls-15', 'ls-2');
  page.classList.add('ls-' + s.lineSpacing);
  page.classList.toggle('num-ar', s.numerals === 'arabic' && s.lang === 'ar');
  page.dataset.placeholder = t('placeholder');
  page.classList.toggle('ruled', isRuled());
  updateRuling();
}
/* ---------- تسطير الصفحة (مثل الكراسة) ---------- */
const RULE_COLOR = '#8DB4BB';
function isRuled() { const r = WQ.doc && WQ.doc.settings.ruled; return !!r && r !== 'off'; }
function updateRuling() {
  const root = document.documentElement.style;
  if (!isRuled()) { WQ._rule = null; return; }
  const s = WQ.doc.settings;
  const gap = Math.round((+s.ruleGap || 1) * 37.7953 * 100) / 100;
  const kind = s.ruled;
  const tw = kind === 'dots' ? 6 : (kind === 'dash' ? 10 : 4);
  const shape = kind === 'dots' ? "<circle cx='3' cy='1' r='0.85' fill='" + RULE_COLOR + "'/>"
    : "<rect x='0' y='0.5' width='" + (kind === 'dash' ? 6 : 4) + "' height='1' fill='" + RULE_COLOR + "' fill-opacity='" + (kind === 'line' ? '0.7' : '1') + "'/>";
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + tw + "' height='" + gap + "'>" + shape + '</svg>';
  root.setProperty('--rule', gap + 'px');
  root.setProperty('--rule-w', tw + 'px');
  root.setProperty('--rule-img', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
  // خط السطر يقع تحت خط الكتابة مباشرة: نقيس موضع خط الكتابة بالخط الحالي
  const probe = el('div', { class: page.className, dir: page.dir, lang: page.lang, style: 'position:absolute;visibility:hidden;left:0;top:0;width:10cm;min-height:0;zoom:1;font-family:var(--doc-font)' });
  probe.innerHTML = '<p>\u0628\u0627<span style="display:inline-block;width:0;height:0"></span></p>';
  document.body.append(probe);
  const sp = probe.querySelector('span'), base = sp.offsetTop - probe.querySelector('p').offsetTop;
  probe.remove();
  const off = ((base + Math.max(2, gap * 0.08)) % gap + gap) % gap;
  root.setProperty('--rule-off', off + 'px');
  WQ._rule = { gap, off, kind };
}


/* كل فقرة تأخذ اتجاهها من أول حرف قوي فيها (عربي ← يمين، لاتيني ← يسار) */
function normalizeBlocks() {
  // نص مكتوب مباشرة في الصفحة بدون فقرة ← نلفه في فقرة
  Array.from(page.childNodes).forEach((n) => {
    if (n.nodeType === 3 && n.textContent.trim()) {
      const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n);
    }
  });
  $$(BLOCK_SEL, page).forEach((b) => { if (!b.hasAttribute('dir')) b.setAttribute('dir', 'auto'); });
}

function currentBlock() {
  const sel = document.getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.anchorNode;
  if (n && n.nodeType === 3) n = n.parentNode;
  const b = n && n.closest ? n.closest(BLOCK_SEL) : null;
  return b && page.contains(b) ? b : null;
}
function isRtlAt(block) {
  const el = block || page;
  try { return el.matches(':dir(rtl)'); } catch (e) { return getComputedStyle(el).direction === 'rtl'; }
}
function prevChar() {
  const sel = document.getSelection();
  if (!sel.rangeCount) return '';
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return '';
  const c = r.startContainer;
  if (c.nodeType === 3) return r.startOffset > 0 ? c.textContent[r.startOffset - 1] : '';
  return '';
}

/* ---------- تحويل ما ي\u064Fكتب لحظيا\u064B ---------- */
function transformTyped(data, block) {
  const s = WQ.doc.settings;
  const rtl = isRtlAt(block);
  let out = data, delPrevSpace = false;
  // الأرقام
  if (s.numerals === 'arabic' && rtl) out = toArabicDigits(out);
  else if (s.numerals === 'western') out = toWesternDigits(out);
  // قواعد الكتابة الفرنسية (في الفقرات اللاتينية فقط)
  if (s.lang === 'fr' && !rtl && out.length === 1) {
    const pc = prevChar();
    if (':;!?'.includes(out)) {
      if (pc === ' ' || pc === '\u00A0') { delPrevSpace = true; out = '\u202F' + out; }
      else if (pc && pc !== '\u202F') out = '\u202F' + out;
    } else if (out === '"') {
      out = (!pc || /[\s(\[\u00A0]/.test(pc)) ? '«\u202F' : '\u202F»';
    }
  }
  return { out, delPrevSpace };
}

function onBeforeInput(e) {
  if (e.isComposing) return;
  if (e.inputType === 'insertText' && e.data) {
    const { out, delPrevSpace } = transformTyped(e.data, currentBlock());
    if (out !== e.data) {
      e.preventDefault();
      if (delPrevSpace) document.execCommand('delete', false);
      document.execCommand('insertText', false, out);
    }
  }
}

function onInput() {
  normalizeBlocks();
  markDirty();
  refreshDerivedSoon();
}

/* ---------- تحويل الأرقام في المستند كله ---------- */
function convertAllNumerals() {
  const mode = WQ.doc.settings.numerals;
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const block = n.parentNode.closest(BLOCK_SEL) || page;
    const v = n.textContent;
    const nv = (mode === 'arabic' && isRtlAt(block)) ? toArabicDigits(v) : (mode === 'western' ? toWesternDigits(v) : v);
    if (nv !== v) n.textContent = nv;
  });
}

/* ---------- أوامر التنسيق ---------- */
function focusPage() {
  if (document.body.classList.contains('pages-mode')) setPagesView(false);
  if (page.contains(document.getSelection().anchorNode)) return;
  if (typeof lastRange !== 'undefined' && lastRange) restoreRange(); else page.focus();
}
function cmd(name, val = null) { focusPage(); document.execCommand(name, false, val); onInput(); updateToolbarState(); }
function setBlock(tag) { cmd('formatBlock', '<' + tag + '>'); }
function setFont(name) { cmd('fontName', name); }
function setFontSize(pt) {
  focusPage();
  document.execCommand('fontSize', false, '7');
  $$('font[size="7"]', page).forEach((f) => { const s = document.createElement('span'); s.style.fontSize = pt + 'pt'; s.innerHTML = f.innerHTML; f.replaceWith(s); });
  $$('span', page).forEach((s) => { if (s.style.fontSize === 'xxx-large' || s.style.fontSize === '-webkit-xxx-large') s.style.fontSize = pt + 'pt'; });
  onInput();
}
function align(where) {
  const rtl = isRtlAt(currentBlock());
  const map = { start: rtl ? 'justifyRight' : 'justifyLeft', end: rtl ? 'justifyLeft' : 'justifyRight', center: 'justifyCenter', justify: 'justifyFull' };
  cmd(map[where]);
}
function clearFormat() { cmd('removeFormat'); setBlock('p'); }

function insertHtml(html) { focusPage(); document.execCommand('insertHTML', false, html); onInput(); }
function insertTable(rows, cols, header) {
  let h = '<table><tbody>';
  for (let r = 0; r < rows; r++) {
    h += '<tr>';
    for (let c = 0; c < cols; c++) h += (header && r === 0) ? '<th dir="auto"><br></th>' : '<td dir="auto"><br></td>';
    h += '</tr>';
  }
  insertHtml(h + '</tbody></table><p dir="auto"><br></p>');
}
function insertImage(dataUrl) { insertHtml('<img src="' + dataUrl + '" alt=""><p dir="auto"><br></p>'); }
function insertPageBreak() { insertHtml('<hr class="wq-pagebreak"><p dir="auto"><br></p>'); }
function insertQuotes() {
  const fr = WQ.doc.settings.lang === 'fr';
  insertHtml(fr ? '«\u202F\u202F»' : '«»');
}

/* ---------- التنظيف: لصق من Word (غير موثوق) أو ملف ور\u0651اق (موثوق) ---------- */
/* ---------- بناء جدول من نموذج شبكي (للاستيراد من Word) ----------
   rows: [{ cells: [{ html, span, vm: 'restart'|'cont'|null, align, fill, head }], before }]
   widths: عرض الأعمدة (أي وحدة) ← نسب مئوية في colgroup */
function buildGridTable(rows, widths) {
  const grid = []; // grid[r][c] = الخلية التي تغطي هذا الموضع
  const out = rows.map(() => []);
  rows.forEach((row, ri) => {
    grid[ri] = grid[ri] || [];
    let col = 0;
    if (row.before) { out[ri].push({ html: '', span: row.before, blank: true, rs: 1 }); for (let k = 0; k < row.before; k++) grid[ri][col++] = null; }
    row.cells.forEach((c) => {
      const span = Math.max(1, c.span || 1);
      if (c.vm === 'cont') {
        const above = ri > 0 ? grid[ri - 1][col] : null;
        if (above && !above.blank) { above.rs++; for (let k = 0; k < span; k++) grid[ri][col + k] = above; col += span; return; }
      }
      const o = Object.assign({}, c, { span, rs: 1 });
      out[ri].push(o);
      for (let k = 0; k < span; k++) grid[ri][col + k] = o;
      col += span;
    });
  });
  let ncol = 0; grid.forEach((r) => { ncol = Math.max(ncol, r.length); });
  let h = '<table class="wq-grid' + (ncol >= 10 ? ' dense' : (ncol >= 7 ? ' compact' : '')) + '">';
  if (widths && widths.length === ncol && ncol > 1) {
    const tot = widths.reduce((a, b) => a + b, 0) || 1;
    h += '<colgroup>' + widths.map((w) => '<col style="width:' + (Math.round(w / tot * 1000) / 10) + '%">').join('') + '</colgroup>';
  }
  h += '<tbody>';
  out.forEach((cells) => {
    h += '<tr>' + cells.map((c) => {
      const tag = c.head ? 'th' : 'td';
      let st = '';
      if (c.align === 'center' || c.align === 'end' || c.align === 'justify') st += 'text-align: ' + c.align + ';';
      if (c.fill && /^[0-9A-F]{6}$/i.test(c.fill) && !/^(FFFFFF|auto)$/i.test(c.fill)) st += 'background-color: #' + c.fill + ';';
      return '<' + tag + ' dir="auto"' + (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rs > 1 ? ' rowspan="' + c.rs + '"' : '') + (st ? ' style="' + st + '"' : '') + '>' + (c.html || '<br>') + '</' + tag + '>';
    }).join('') + '</tr>';
  });
  return h + '</tbody></table>';
}
const ALLOWED = { P: 'p', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', STRIKE: 's',
  UL: 'ul', OL: 'ol', LI: 'li', TABLE: 'table', COLGROUP: 'colgroup', COL: 'col', THEAD: 'thead', TBODY: 'tbody', TR: 'tr', TD: 'td', TH: 'th', BR: 'br', BLOCKQUOTE: 'blockquote', SUP: 'sup', SUB: 'sub', IMG: 'img', HR: 'hr', SPAN: 'span', FONT: 'span' };
const STYLE_OK = ['font-family', 'font-size', 'color', 'background-color', 'text-align', 'margin-right', 'margin-left', 'font-weight', 'font-style', 'text-decoration-line', 'text-decoration'];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
function cleanStyle(st) {
  const out = [];
  STYLE_OK.forEach((k) => { const v = st.getPropertyValue(k); if (v && !/url\(|expression/i.test(v)) out.push(k + ': ' + v); });
  return out.join('; ');
}
function sanitizeHtml(html, trusted = false) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node) => {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += escapeHtml(n.textContent); return; }
      if (n.nodeType !== 1) return;
      if (/^(STYLE|SCRIPT|META|LINK|TITLE)$/.test(n.tagName)) return;
      const cls = n.getAttribute('class') || '';
      // عناصر ور\u0651اق الخاصة: ت\u064Fقبل من ملفات ور\u0651اق فقط
      if (/\bwq-ayah\b/.test(cls) && !cls.includes('wq-ayah-ref')) {
        const ok = ['s', 'a', 'b'].every((k) => /^\d{1,3}$/.test(n.dataset[k] || ''));
        if (trusted && ok) out += '<span class="wq-ayah" data-s="' + n.dataset.s + '" data-a="' + n.dataset.a + '" data-b="' + n.dataset.b + '" contenteditable="false" dir="rtl" lang="ar">' + escapeHtml(n.textContent) + '</span>';
        else out += escapeHtml(n.textContent);
        return;
      }
      if (cls.includes('wq-ayah-ref')) { out += trusted ? '<span class="wq-ayah-ref" contenteditable="false">' + escapeHtml(n.textContent) + '</span>' : escapeHtml(n.textContent); return; }
      if (/\bwq-(fn|cite|toc|bib)\b/.test(cls)) {
        if (!trusted) return;
        if (cls.includes('wq-fn') && ID_RE.test(n.dataset.fn || '')) out += '<sup class="wq-fn" data-fn="' + n.dataset.fn + '" contenteditable="false">*</sup>';
        else if (cls.includes('wq-cite') && ID_RE.test(n.dataset.ref || '')) out += '<span class="wq-cite" data-ref="' + n.dataset.ref + '" data-page="' + escapeHtml(n.dataset.page || '') + '" contenteditable="false">[*]</span>';
        else if (cls.includes('wq-toc')) out += '<div class="wq-toc" contenteditable="false"></div>';
        else if (cls.includes('wq-bib')) out += '<div class="wq-bib" contenteditable="false"></div>';
        return;
      }
      const tag = ALLOWED[n.tagName];
      if (!tag) {
        const inner = walk(n);
        out += (n.tagName === 'DIV' && inner.trim()) ? '<p dir="auto">' + inner + '</p>' : inner;
        return;
      }
      if (tag === 'br') { out += '<br>'; return; }
      if (tag === 'hr') { out += cls.includes('wq-pagebreak') ? '<hr class="wq-pagebreak">' : '<hr>'; return; }
      if (tag === 'img') { const src = n.getAttribute('src') || ''; if (src.startsWith('data:image/')) out += '<img src="' + escapeHtml(src) + '" alt="">'; return; }
      if (tag === 'col') { const w = (n.getAttribute('style') || '').match(/width:\s*([\d.]+)%/); out += '<col' + (w ? ' style="width:' + w[1] + '%"' : '') + '>'; return; }
      let attrs = '';
      if (tag === 'table') {
        const tc = (cls.match(/\b(wq-grid|dense|compact|bd-(?:outside|inside|h|apa|none))\b/g) || []);
        if (tc.length) attrs += ' class="' + tc.join(' ') + '"';
      }
      if (tag === 'td' || tag === 'th') {
        ['colspan', 'rowspan'].forEach((a) => { const v = n.getAttribute(a); if (v && /^\d+$/.test(v)) attrs += ' ' + a + '="' + v + '"'; });
      }
      if (/^(p|h1|h2|h3|li|td|th|blockquote)$/.test(tag)) {
        const d = n.getAttribute('dir');
        attrs += ' dir="' + (trusted && (d === 'rtl' || d === 'ltr') ? d : 'auto') + '"';
      }
      if (trusted && n.style && n.style.length) { const st = cleanStyle(n.style); if (st) attrs += ' style="' + escapeHtml(st) + '"'; }
      if (tag === 'span' && !attrs) { out += walk(n); return; }
      out += '<' + tag + attrs + '>' + walk(n) + '</' + tag + '>';
    });
    return out;
  };
  return walk(doc.body);
}
function onPaste(e) {
  const cd = e.clipboardData; if (!cd) return;
  e.preventDefault();
  const html = cd.getData('text/html');
  if (html) { insertHtml(sanitizeHtml(html)); return; }
  const text = cd.getData('text/plain');
  if (!text) return;
  const lines = text.replace(/\r/g, '').split('\n');
  if (lines.length === 1) { document.execCommand('insertText', false, text); onInput(); return; }
  insertHtml(lines.map((l) => '<p dir="auto">' + (escapeHtml(l) || '<br>') + '</p>').join(''));
}

/* ---------- إحصاءات وخريطة ---------- */
const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:['’\-][\p{L}\p{N}\p{M}]+)*/gu;
function countWords() {
  let text = page.innerText || '';
  $$('.wq-toc,.wq-bib,.wq-fn,.wq-cite', page).forEach((g) => { text = text.replace(g.innerText, ' '); });
  const words = text.match(WORD_RE) || [];
  return { words: words.length, chars: text.replace(/\s/g, '').length };
}
/* رقم الصفحة التقريبي لعنصر (يراعي فواصل الصفحات والهوامش) */
function pageContentHeight() {
  const s = WQ.doc.settings;
  const h = s.pageSize === 'letter' ? 27.94 : 29.7;
  const m = s.margins === 'narrow' ? 1.27 : (s.margins === 'wide' ? 2.54 : 2.5);
  return (h - 2 * m) * 37.7953;
}
function pageOf(elm) {
  const H = pageContentHeight();
  const top = (e) => { let y = 0; while (e && e !== page) { y += e.offsetTop; e = e.offsetParent; } return y; };
  const y0 = top(elm);
  let shift = 0;
  $$('hr.wq-pagebreak', page).forEach((hr) => {
    const y = top(hr) + shift;
    if (top(hr) < y0) { const nb = Math.ceil((y + 1) / H) * H; shift += nb - y; }
  });
  return Math.floor((y0 + shift) / H) + 1;
}
function approxPages() {
  if (typeof PV !== 'undefined' && PV.exact) return PV.pages;
  const last = page.lastElementChild;
  if (!last) return 1;
  const H = pageContentHeight();
  return Math.max(1, pageOf(last) + Math.floor(last.offsetHeight / H));
}
function buildNav() {
  const list = $('#navList');
  const hs = headings();
  if (!hs.length) { list.innerHTML = '<p class="nav-empty">' + escapeHtml(t('navEmpty')) + '</p>'; return; }
  list.innerHTML = '';
  hs.forEach((h) => {
    const b = document.createElement('button');
    b.className = 'nav-item l' + h.tagName[1];
    b.textContent = h.textContent.trim();
    b.dir = 'auto';
    b.onclick = () => {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const r = document.createRange(); r.selectNodeContents(h); r.collapse(false);
      const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    };
    list.appendChild(b);
  });
}
let _derivedT;
function refreshDerivedSoon() { clearTimeout(_derivedT); _derivedT = setTimeout(refreshDerived, 250); }
function headings() { return $$('h1,h2,h3', page).filter((h) => h.textContent.trim() && !h.closest('.wq-toc,.wq-bib')); }
function refreshDerived() { renderCitations(); buildNav(); updateStatus(); }
