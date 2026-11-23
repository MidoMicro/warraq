/* ===== pages: عرض الصفحات الحقيقي (تقسيم المستند لصفحات، والحواشي أسفل كل صفحة، وأرقام الصفحات) ===== */
const CM = 37.7953;
function pageGeom() {
  const s = WQ.doc.settings;
  const W = s.pageSize === 'letter' ? 21.59 * CM : 21 * CM, H = s.pageSize === 'letter' ? 27.94 * CM : 29.7 * CM;
  const m = s.margins === 'narrow' ? { t: 1.27, s: 1.27 } : (s.margins === 'wide' ? { t: 2.54, s: 5.08 } : { t: 2.5, s: 2.5 });
  return { W, H, mt: m.t * CM, ms: m.s * CM, cw: W - 2 * m.s * CM, ch: H - 2 * m.t * CM };
}
let PV = { pages: 0, stale: true, headPage: {} };
/* الترقيم التمهيدي: الصفحات قبل أول فصل (عنوان ١ ليس من المقدمات) بالحروف، ثم ١ من أول فصل */
const ABJAD = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];
function toRoman(n) { const v = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; v.forEach(([k, r]) => { while (n >= k) { s += r; n -= k; } }); return s; }
function frontLabel(n) { return WQ.doc.settings.lang === 'ar' ? (ABJAD[n - 1] || toArabicDigits(String(n))) : toRoman(n); }
/* أول عنصر من صلب الرسالة: عنوان ١ لا يبدأ بكلمات المقدمات (الإقرار، الإهداء، المستخلص، فهرس…) */
function bodyStartHeading() { return $$('h1', page).find((h) => h.textContent.trim() && !h.closest('.wq-toc,.wq-bib') && !FRONT.test(h.textContent.trim())) || null; }
/* رقم الصفحة كما يُطبع: بعد عرض الصفحات من جدول الأرقام، وقبله رقم عادي */
function pvLabel(n) { return (PV.exact && PV.labels && PV.labels[n - 1] !== undefined) ? PV.labels[n - 1] : N(n, WQ.doc.settings.lang); }

function makePage(g, n) {
  const s = WQ.doc.settings;
  const pg = el('div', { class: 'pv-page' + (s.pageSize === 'letter' ? ' letter' : ''), 'data-n': String(n) });
  pg.style.width = g.W + 'px'; pg.style.height = g.H + 'px'; pg.style.padding = g.mt + 'px ' + g.ms + 'px';
  const box = el('div', { class: 'pv-box' + (isRuled() ? ' ruled' : '') }); box.style.height = g.ch + 'px';
  const body = el('div', { class: 'page pv-body ' + Array.from(page.classList).filter((c) => /^(ls-|num-ar|ruled$)/.test(c)).join(' '), dir: page.dir, lang: page.lang });
  const fns = el('div', { class: 'pv-fns fn-zone', dir: page.dir, lang: page.lang });
  const num = el('div', { class: 'pv-num' }); num.style.bottom = (g.mt / 2 - 8) + 'px';
  box.append(body, fns); pg.append(box, num);
  addPageFrame(pg, g);
  return { pg, body, fns, num };
}
/* حواشي الصفحة = المؤشرات الموجودة في متنها */
function fillFootnotes(P, startNo) {
  const restart = WQ.doc.settings.fnRestart;
  const marks = $$('.wq-fn', P.body);
  let h = '', i = 0;
  marks.forEach((m) => {
    i++;
    const n = restart ? i : startNo + i;
    const lab = fnMark(n);
    if (m.textContent !== lab) m.textContent = lab;
    h += '<p class="fn-item" dir="auto"><span class="fn-num">' + lab + '</span> ' + ((WQ._fnBody || {})[m.dataset.fn] || '…') + '</p>';
  });
  if (P.fns._h !== h) { P.fns.innerHTML = h; P.fns._h = h; }
  return marks.length;
}
const fits = (P, g) => P.body.offsetHeight + (P.fns.childElementCount ? P.fns.offsetHeight + 12 : 0) <= g.ch + 0.5;

/* تقسيم فقرة عند حدود الكلمات: أكبر جزء يتسع في الصفحة */
function splitByWords(block, P, g, fnStart) {
  const pts = [];
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode, re = /\s+/g; let m; while ((m = re.exec(n.textContent))) pts.push([n, m.index + m[0].length]); }
  if (!pts.length) return null;
  const headOf = (k) => { const r = document.createRange(); r.setStart(block, 0); r.setEnd(pts[k][0], pts[k][1]); const h = block.cloneNode(false); h.append(r.cloneContents()); return h; };
  let lo = 0, hi = pts.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const h = headOf(mid); P.body.append(h); fillFootnotes(P, fnStart);
    const ok = fits(P, g); h.remove();
    if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  fillFootnotes(P, fnStart);
  if (best < 0) return null;
  const head = headOf(best);
  const r = document.createRange(); r.setStart(pts[best][0], pts[best][1]); r.setEnd(block, block.childNodes.length);
  const tail = block.cloneNode(false); tail.append(r.cloneContents()); tail.classList.add('pv-cont');
  if (!tail.textContent.trim() && !tail.querySelector('img,.wq-fn')) return [head, null];
  return [head, tail];
}
/* تقسيم عنصر له أبناء (قائمة، جدول، فهرس، قائمة مراجع) */
function splitByChildren(block, P, g, fnStart) {
  const isTable = block.tagName === 'TABLE';
  const container = isTable ? (block.tBodies[0] || block) : block;
  const items = Array.from(container.children);
  if (items.length < 2) return null;
  // صفوف العنوان: الصفوف الأولى التي كل خلاياها عناوين (تتكرر في الصفحة التالية)
  let nHead = 0;
  if (isTable) while (nHead < items.length - 1 && items[nHead].cells.length && Array.from(items[nHead].cells).every((c) => c.tagName === 'TH')) nHead++;
  // لا نقسم الجدول داخل خلية مدمجة رأسياً
  const blocked = new Set();
  if (isTable) items.forEach((tr, i) => Array.from(tr.cells || []).forEach((c) => { for (let k = 1; k < (c.rowSpan || 1); k++) blocked.add(i + k); }));
  const cols = isTable ? block.querySelector(':scope > colgroup') : null;
  const make = (from, to, withHeader) => {
    const b = block.cloneNode(false);
    if (cols) b.append(cols.cloneNode(true));
    const c = isTable ? el('tbody') : b; if (isTable) b.append(c);
    if (withHeader) items.slice(0, nHead).forEach((x) => c.append(x.cloneNode(true)));
    items.slice(from, to).forEach((x) => c.append(x.cloneNode(true)));
    if (block.tagName === 'OL') b.setAttribute('start', String((+block.getAttribute('start') || 1) + from));
    return b;
  };
  let best = 0;
  for (let k = 1; k < items.length; k++) {
    const h = make(0, k, false); P.body.append(h); fillFootnotes(P, fnStart);
    const ok = fits(P, g); h.remove();
    if (!ok) break; if (!blocked.has(k)) best = k;
  }
  fillFootnotes(P, fnStart);
  if (best === 0 || best <= nHead) return null;
  const tail = make(best, items.length, true);
  if (block.tagName === 'OL') tail.setAttribute('start', String((+block.getAttribute('start') || 1) + best));
  return [make(0, best, false), tail];
}

/* التقسيم الكامل */
function paginate() {
  if (!WQ.doc) return 0;
  renderCitations();
  const g = pageGeom();
  updateRuling();
  const host = $('#pagesView');
  host.innerHTML = '';
  const wasMode = document.body.classList.contains('pages-mode');
  document.body.classList.add('pages-mode'); // القياس يحتاج العرض ظاهرا\u064B
  const zoomWas = getComputedStyle(document.documentElement).getPropertyValue('--zoom');
  document.documentElement.style.setProperty('--zoom', 1);
  const hs = headings(); hs.forEach((h, i) => { h.dataset.hid = String(i); });
  const bodyH = WQ.doc.settings.frontNum === 'roman' ? bodyStartHeading() : null; if (bodyH) bodyH.dataset.bodystart = '1';
  const xs = $$('.wq-ayah,.wq-hadith', page).filter((x) => !x.closest(IDX_SEL)); xs.forEach((x, i) => { x.dataset.xid = String(i); });
  const queue = Array.from(page.children).map((b, i) => { const c = b.cloneNode(true); c.dataset.bi = String(i); return c; });
  $$('[contenteditable]', host).forEach((x) => x.removeAttribute('contenteditable'));
  const pages = [];
  let fnCount = 0;
  let P = null;
  const newPage = () => {
    if (P) fnCount += WQ.doc.settings.fnRestart ? 0 : $$('.wq-fn', P.body).length;
    P = makePage(g, pages.length + 1); host.append(P.pg); pages.push(P);
  };
  newPage();
  let guard = 0;
  while (queue.length && guard++ < 200000) {
    const b = queue.shift();
    b.removeAttribute('contenteditable'); $$('[contenteditable]', b).forEach((x) => x.removeAttribute('contenteditable'));
    if (b.tagName === 'HR' && b.classList.contains('wq-pagebreak')) { if (P.body.childElementCount) newPage(); continue; }
    if (P.body.childElementCount === 0 && b.tagName === 'P' && !b.textContent.trim() && !b.querySelector('img')) continue; // لا نبدأ صفحة بسطر فاضي
    P.body.append(b); fillFootnotes(P, fnCount);
    if (fits(P, g)) {
      // عنوان في آخر الصفحة بدون مساحة لسطرين بعده ← ينتقل للصفحة التالية
      if (/^H[1-3]$/.test(b.tagName) && P.body.childElementCount > 1) {
        const room = g.ch - P.body.offsetHeight - (P.fns.childElementCount ? P.fns.offsetHeight + 12 : 0);
        if (room < 70) { b.remove(); fillFootnotes(P, fnCount); newPage(); P.body.append(b); fillFootnotes(P, fnCount); }
      }
      continue;
    }
    b.remove(); fillFootnotes(P, fnCount);
    let parts = null;
    if (/^(P|LI|BLOCKQUOTE|H1|H2|H3)$/.test(b.tagName) && !/^H/.test(b.tagName)) parts = splitByWords(b, P, g, fnCount);
    else if (/^(UL|OL|TABLE)$/.test(b.tagName) || b.classList.contains('wq-toc') || b.classList.contains('wq-bib') || b.classList.contains('wq-idx-ayat') || b.classList.contains('wq-idx-hadith')) parts = splitByChildren(b, P, g, fnCount);
    if (parts && parts[0]) {
      // لا نترك عنوانا\u064B وحيدا\u064B في آخر الصفحة
      P.body.append(parts[0]); fillFootnotes(P, fnCount);
      if (parts[1]) queue.unshift(parts[1]);
      newPage(); continue;
    }
    // العنصر لا ينقسم ولا يتسع: ننقله للصفحة التالية (ومعه العنوان الذي قبله)
    const prev = P.body.lastElementChild;
    if (P.body.childElementCount === 0) {
      P.body.append(b); fillFootnotes(P, fnCount); b.classList.add('pv-overflow'); newPage(); continue;
    }
    if (prev && /^H[1-3]$/.test(prev.tagName) && P.body.childElementCount > 1) { prev.remove(); fillFootnotes(P, fnCount); queue.unshift(b); queue.unshift(prev); newPage(); continue; }
    queue.unshift(b); newPage();
  }
  // حذف صفحة أخيرة فارغة + الترقيم النهائي
  while (pages.length > 1 && !pages[pages.length - 1].body.childElementCount) { pages.pop().pg.remove(); }
  fnCount = 0;
  const s = WQ.doc.settings;
  let bodyIdx = -1;
  if (bodyH) { bodyIdx = pages.findIndex((p) => p.body.querySelector('[data-bodystart]')); bodyH.removeAttribute('data-bodystart'); $$('[data-bodystart]', host).forEach((x) => x.removeAttribute('data-bodystart')); }
  PV.labels = [];
  pages.forEach((p, i) => {
    fillFootnotes(p, fnCount); if (!s.fnRestart) fnCount += $$('.wq-fn', p.body).length;
    const n = bodyIdx > 0 ? (i < bodyIdx ? -1 : i - bodyIdx + 1) : i + 1;
    const lab = n < 0 ? frontLabel(i + 1) : (s.numerals === 'arabic' && s.lang === 'ar' ? toArabicDigits(String(n)) : String(n));
    PV.labels.push(lab);
    p.num.textContent = (i === 0 && s.hideFirstNum !== false) ? '' : lab;
  });
  // أرقام الصفحات الحقيقية للعناوين، وتحديث الفهرس
  PV.headPage = {};
  pages.forEach((p, i) => $$('[data-hid]', p.body).forEach((h) => { if (PV.headPage[h.dataset.hid] === undefined) PV.headPage[h.dataset.hid] = i + 1; }));
  $$('.toc-row', host).forEach((r) => {
    const n = PV.headPage[r.dataset.i]; if (n === undefined) return;
    const sp = r.lastElementChild; if (sp) sp.textContent = PV.labels[n - 1] || N(n, WQ.doc.settings.lang);
  });
  $$('.wq-toc .wq-note', host).forEach((x) => x.remove());
  hs.forEach((h) => h.removeAttribute('data-hid'));
  PV.xPage = {};
  pages.forEach((p, i) => $$('[data-xid]', p.body).forEach((x) => { if (PV.xPage[x.dataset.xid] === undefined) PV.xPage[x.dataset.xid] = i + 1; }));
  xs.forEach((x) => x.removeAttribute('data-xid'));
  fixIndexPagesIn(host);
  PV.pages = pages.length; PV.stale = false; PV.exact = true;
  document.documentElement.style.setProperty('--zoom', zoomWas || 1);
  if (!wasMode) document.body.classList.remove('pages-mode');
  renderToc(); renderIndexes();
  return pages.length;
}

/* التبديل بين وضع الكتابة وعرض الصفحات */
function setPagesView(on) {
  document.body.classList.toggle('pages-mode', on);
  if (on) {
    const t0 = performance.now();
    const n = paginate();
    toast(t('pagesReady').replace('{n}', fmtNum(n)));
    WQ._paginateMs = Math.round(performance.now() - t0);
  }
  renderRibbon(); updateStatus();
}
function initPagesEvents() {
  $('#pagesView').addEventListener('dblclick', (e) => {
    const b = e.target.closest('[data-bi]');
    setPagesView(false);
    const target = b && page.children[+b.dataset.bi];
    if (target) { target.scrollIntoView({ block: 'center' }); }
  });
}
