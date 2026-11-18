/* ===== pptx: تحويل الرسالة إلى عرض المناقشة (PowerPoint) ===== */
let _pptxLib = null;
function loadPptxLib() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (_pptxLib) return _pptxLib;
  _pptxLib = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/pptxgen.bundle.js';
    sc.onload = () => window.PptxGenJS ? res(window.PptxGenJS) : rej(new Error('lib'));
    sc.onerror = () => { _pptxLib = null; rej(new Error('load')); };
    document.head.appendChild(sc);
  });
  return _pptxLib;
}
const FRONT = /^(الإقرار|الإهداء|الشكر|المستخلص|الملخص|فهرس|قائمة المراجع|المراجع|الملاحق|declaration|acknowledg|abstract|contents|table of contents|references|appendi)/i;
const isPlaceholder = (s) => /^\s*\[[^\]]*\]\s*$/.test(s);
function firstSentence(s, max = 150) {
  s = s.replace(/\s+/g, ' ').trim();
  const m = s.match(/^(.+?[.!؟?])(\s|$)/);
  let out = m && m[1].length > 25 ? m[1] : s;
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return out;
}
/* نقرأ هيكل الرسالة: الفصول ← المباحث ← الفقرات والجداول والصور */
function outline() {
  const secs = []; let H1 = null, H2 = null;
  const front = [];
  let firstBreak = false;
  Array.from(page.children).forEach((e) => {
    if (e.tagName === 'HR' && e.classList.contains('wq-pagebreak')) { firstBreak = true; return; }
    if (!firstBreak && !H1 && e.tagName === 'P' && e.textContent.trim()) { front.push(e.innerText.trim()); }
    if (e.classList.contains('wq-toc') || e.classList.contains('wq-bib')) return;
    if (e.tagName === 'H1') { H1 = { title: e.textContent.trim(), subs: [], front: FRONT.test(e.textContent.trim()) }; secs.push(H1); H2 = null; return; }
    if (!H1) return;
    if (e.tagName === 'H2' || e.tagName === 'H3') { if (e.tagName === 'H2' || !H2) { H2 = { title: e.textContent.trim(), paras: [], tables: [], imgs: [] }; H1.subs.push(H2); } else H2.paras.push(e.textContent.trim()); return; }
    if (!H2) { H2 = { title: H1.title, paras: [], tables: [], imgs: [], self: true }; H1.subs.push(H2); }
    if (e.tagName === 'TABLE') H2.tables.push(Array.from(e.querySelectorAll('tr')).slice(0, 8).map((r) => Array.from(r.children).slice(0, 6).map((c) => ({ t: c.innerText.trim(), h: c.tagName === 'TH' }))));
    $$('img', e).forEach((im) => H2.imgs.push(im.src));
    if (/^(P|LI|BLOCKQUOTE|UL|OL)$/.test(e.tagName)) {
      if (e.tagName === 'UL' || e.tagName === 'OL') $$('li', e).forEach((li) => { const tx = li.innerText.trim(); if (tx) H2.paras.push(tx); });
      else { const tx = e.innerText.replace(/\(\S{1,4}\)/g, '').trim(); if (tx && !isPlaceholder(tx)) H2.paras.push(tx); }
    }
  });
  return { secs, front };
}

async function exportPptx() {
  toast(t('pptLoading'));
  let Lib;
  try { Lib = await loadPptxLib(); } catch (e) { toast(t('pptFail')); return null; }
  renderCitations();
  const s = WQ.doc.settings, rtl = s.lang === 'ar';
  const TEAL = '0F5F66', COPPER = 'B8732E', PAPER = 'F4EFE6', INK = '2B2B2B';
  const font = rtl ? 'Arial' : 'Calibri';
  const txt = (o) => Object.assign({ fontFace: font, color: INK, rtlMode: rtl, align: rtl ? 'right' : 'left', lang: rtl ? 'ar-EG' : 'en-US' }, o);
  const p = new Lib();
  p.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5
  p.title = $('#docTitle').value || t('untitled');
  p.author = WQ.doc.meta.author || '';
  p.company = 'Warraq';
  p.rtlMode = rtl;
  p.defineSlideMaster({ title: 'WQ', background: { color: 'FFFFFF' },
    objects: [{ rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: TEAL } } }, { rect: { x: 0, y: 7.38, w: 13.33, h: 0.12, fill: { color: COPPER } } }],
    slideNumber: { x: rtl ? 0.3 : 12.4, y: 6.95, w: 0.7, h: 0.3, fontFace: font, fontSize: 11, color: '6B6B6B' } });
  const { secs, front } = outline();
  const doc = WQ.doc;
  const L = (ar, en) => rtl ? ar : en;

  // 1) شريحة العنوان
  let sl = p.addSlide(); sl.background = { color: TEAL };
  // سطور صفحة العنوان: نحذف الخانات اللي لسه ما اتملتش [ ... ] والكلمات الوصفية
  const realFront = front.map((x) => x.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((x) => x && !/^(إعداد الطالب|إعداد|إشراف|By|Supervised by)$/i.test(x));
  const hasTitle = p.title && !isPlaceholder(p.title) && p.title !== t('untitled');
  const titleLine = hasTitle ? p.title : (realFront.find((x) => x.length > 8) || p.title);
  sl.addText(titleLine, txt({ x: 0.8, y: 2.2, w: 11.7, h: 1.6, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' }));
  const subs = realFront.filter((x) => x !== titleLine).slice(0, 6).join('\n');
  if (subs) sl.addText(subs, txt({ x: 0.8, y: 4.0, w: 11.7, h: 2.2, fontSize: 18, color: 'DCEFEE', align: 'center', valign: 'top' }));
  else if (doc.meta.author) sl.addText(doc.meta.author, txt({ x: 0.8, y: 4.0, w: 11.7, h: 0.8, fontSize: 20, color: 'DCEFEE', align: 'center' }));
  sl.addShape(p.ShapeType.rect, { x: 5.9, y: 3.85, w: 1.5, h: 0.06, fill: { color: COPPER }, line: { color: COPPER } });

  // 2) محتوى العرض
  let chapters = secs.filter((x) => !x.front);
  if (!chapters.length) chapters = secs; // ملف كله مقدمات (مثل ملخص منفصل)
  if (chapters.length) {
    sl = p.addSlide({ masterName: 'WQ' });
    sl.addText(L('محتوى العرض', 'Outline'), txt({ x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 32, bold: true, color: TEAL }));
    sl.addText(chapters.slice(0, 8).map((c) => ({ text: c.title, options: { bullet: { code: '25C6' }, paraSpaceAfter: 8, breakLine: true, rtlMode: rtl, align: rtl ? 'right' : 'left' } })), txt({ x: 0.8, y: 1.5, w: 11.7, h: 5.2, fontSize: 22, valign: 'top' }));
  }
  // 3) الفصول والمباحث
  let slides = 0;
  chapters.forEach((c) => {
    sl = p.addSlide(); sl.background = { color: PAPER };
    sl.addShape(p.ShapeType.rect, { x: rtl ? 12.6 : 0, y: 0, w: 0.73, h: 7.5, fill: { color: TEAL }, line: { color: TEAL } });
    sl.addText(c.title, txt({ x: 1, y: 2.5, w: 11, h: 2.2, fontSize: 38, bold: true, color: TEAL, valign: 'middle' }));
    c.subs.forEach((sub) => {
      const bullets = sub.paras.filter((x) => !isPlaceholder(x)).slice(0, 5).map((x) => firstSentence(x));
      if (bullets.length) {
        sl = p.addSlide({ masterName: 'WQ' });
        sl.addText(sub.self ? c.title : sub.title, txt({ x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 28, bold: true, color: TEAL }));
        sl.addText(bullets.map((b) => ({ text: b, options: { bullet: { code: '25CF' }, paraSpaceAfter: 10, breakLine: true, rtlMode: RTL_CH.test(b), align: RTL_CH.test(b) ? 'right' : 'left' } })), txt({ x: 0.8, y: 1.4, w: 11.7, h: 5.4, fontSize: 20, valign: 'top', fit: 'shrink' }));
        sl.addNotes(sub.paras.join('\n\n').slice(0, 3000));
        slides++;
      }
      sub.tables.forEach((tb) => {
        sl = p.addSlide({ masterName: 'WQ' });
        sl.addText(sub.title, txt({ x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 26, bold: true, color: TEAL }));
        const rows = tb.map((r) => (rtl ? r.slice().reverse() : r).map((cell) => ({ text: cell.t, options: { bold: cell.h, fill: { color: cell.h ? 'DCEFEE' : 'FFFFFF' }, align: rtl ? 'right' : 'left', rtlMode: rtl } })));
        sl.addTable(rows, { x: 0.8, y: 1.5, w: 11.7, fontFace: font, fontSize: 16, border: { type: 'solid', color: '999999', pt: 0.75 }, autoPage: false });
        slides++;
      });
      sub.imgs.slice(0, 3).forEach((src) => {
        sl = p.addSlide({ masterName: 'WQ' });
        sl.addText(sub.title, txt({ x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 26, bold: true, color: TEAL }));
        sl.addImage({ data: src, x: 1.5, y: 1.4, w: 10.3, h: 5.5, sizing: { type: 'contain', w: 10.3, h: 5.5 } });
        slides++;
      });
    });
  });
  // 4) المراجع
  const groups = typeof bibEntries === 'function' ? bibEntries() : [];
  const refs = []; groups.forEach((g) => g.items.forEach((x) => { const tmp = document.createElement('div'); tmp.innerHTML = s.citeStyle === 'vancouver' ? vanRef(x.r) : apaRef(x.r); refs.push(tmp.textContent); }));
  if (refs.length) {
    sl = p.addSlide({ masterName: 'WQ' });
    sl.addText(L('أهم المراجع', 'Key references'), txt({ x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 28, bold: true, color: TEAL }));
    sl.addText(refs.slice(0, 8).map((r) => ({ text: r, options: { paraSpaceAfter: 6, breakLine: true, rtlMode: RTL_CH.test(r), align: RTL_CH.test(r) ? 'right' : 'left' } })), txt({ x: 0.8, y: 1.4, w: 11.7, h: 5.4, fontSize: 14, valign: 'top', fit: 'shrink' }));
  }
  // 5) الختام
  sl = p.addSlide(); sl.background = { color: TEAL };
  sl.addText(L('شكراً لحسن استماعكم', 'Thank you'), txt({ x: 0.8, y: 2.6, w: 11.7, h: 1.4, fontSize: 44, bold: true, color: 'FFFFFF', align: 'center' }));
  sl.addText(L('أسئلتكم ومناقشتكم', 'Questions and discussion'), txt({ x: 0.8, y: 4.0, w: 11.7, h: 0.8, fontSize: 22, color: 'DCEFEE', align: 'center' }));

  const blob = await p.write({ outputType: 'blob' });
  WQ._lastPptx = blob;
  if (await saveBlob(safeFileName() + (rtl ? ' - عرض المناقشة' : ' - defense'), 'pptx', blob)) toast(t('exportedPpt'));
  return blob;
}
