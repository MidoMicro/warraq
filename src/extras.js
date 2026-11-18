/* ===== extras: اللقطات، وشاشة البداية، والقوالب، والاستيراد من Word ===== */
const LS_RECENT = 'warraq.recent.v1';
const SNAP_MAX = 30;
const SNAP_AUTO_MIN = 10; // دقائق بين اللقطات التلقائية

/* ======================= اللقطات ======================= */
const clone = (o) => JSON.parse(JSON.stringify(o || null));
function takeSnapshot(label, auto = false) {
  const d = WQ.doc; if (!d) return null;
  d.snapshots = d.snapshots || [];
  const html = editorHtml();
  const last = d.snapshots[d.snapshots.length - 1];
  if (auto && last && last.html === html) return null;
  const snap = { id: uid('s'), at: nowISO(), label: label || '', auto, title: $('#docTitle').value.trim(), words: countWords().words,
    html, footnotes: clone(d.footnotes), references: clone(d.references), settings: clone(d.settings) };
  d.snapshots.push(snap);
  while (d.snapshots.length > SNAP_MAX) {
    const i = d.snapshots.findIndex((s) => s.auto);
    d.snapshots.splice(i >= 0 ? i : 0, 1);
  }
  return snap;
}
function maybeAutoSnapshot() {
  const d = WQ.doc; if (!d) return;
  const last = (d.snapshots || []).slice(-1)[0];
  if (!last || (Date.now() - Date.parse(last.at)) > SNAP_AUTO_MIN * 60000) takeSnapshot('', true);
}
function restoreSnapshot(id) {
  const d = WQ.doc, s = (d.snapshots || []).find((x) => x.id === id); if (!s) return;
  takeSnapshot(t('beforeRestore'));
  d.content.html = s.html; d.footnotes = clone(s.footnotes) || {}; d.references = clone(s.references) || []; d.settings = Object.assign(d.settings, clone(s.settings));
  if (s.title) d.meta.title = s.title;
  loadDocIntoEditor(d); markDirty(); renderRibbon();
  toast(t('restoredSnap'));
}
function fmtTime(iso) {
  const dt = new Date(iso);
  const s = dt.toLocaleString(WQ.ui === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return WQ.ui === 'ar' ? s : toWesternDigits(s);
}
function openSnapshotsDialog() {
  const draw = (m) => {
    const list = (WQ.doc.snapshots || []).slice().reverse();
    let h = '<div class="row" style="grid-template-columns:1fr auto;align-items:end"><div><label>' + E(t('snapLabel')) + '</label><input id="snapName" dir="auto" placeholder="' + E(t('snapLabelPh')) + '"></div>' +
      '<button class="btn" id="snapTake" style="margin-bottom:10px">' + E(t('takeSnap')) + '</button></div>';
    if (!list.length) h += '<p class="soon">' + E(t('noSnaps')) + '</p>';
    list.forEach((s) => {
      h += '<div class="ref-card snap-row"><div class="ra">' + E(s.label || t('autoSnap')) + '</div><div class="rm">' + E(fmtTime(s.at)) + ' · ' + fmtNum(s.words) + ' ' + E(t('words')) + '</div>' +
        '<div class="acts"><button class="c" data-r="' + s.id + '">' + E(t('restore')) + '</button><button data-d="' + s.id + '">' + E(t('del')) + '</button></div></div>';
    });
    h += '<p class="wq-note">' + E(t('snapNote')) + '</p>';
    $('.body', m).innerHTML = h;
    $('#snapTake', m).onclick = () => { takeSnapshot($('#snapName', m).value.trim() || t('manualSnap')); markDirty(); draw(m); toast(t('snapTaken')); };
    $$('[data-r]', m).forEach((b) => b.onclick = () => { restoreSnapshot(b.dataset.r); $('#modalRoot').innerHTML = ''; });
    $$('[data-d]', m).forEach((b) => b.onclick = () => { WQ.doc.snapshots = WQ.doc.snapshots.filter((x) => x.id !== b.dataset.d); markDirty(); draw(m); });
  };
  showModal({ title: t('snapshots'), body: '', wide: true, actions: [{ label: t('close') }], onOpen: draw });
}

/* ======================= الملفات الأخيرة (نسخ محلية) ======================= */
function updateRecent(fileJson) {
  const d = WQ.doc; if (!d || !d.meta.id) return;
  if (!(page.innerText || '').trim()) return;
  if (fileJson.length > 1500000) return;
  let list = lsGet(LS_RECENT) || [];
  list = list.filter((x) => x.id !== d.meta.id);
  list.unshift({ id: d.meta.id, title: $('#docTitle').value.trim(), at: nowISO(), file: fileJson });
  list = list.slice(0, 5);
  while (list.length && !lsSet(LS_RECENT, list)) list.pop();
}

/* ======================= القوالب ======================= */
const PB = '<hr class="wq-pagebreak">';
const P = (s, style) => '<p dir="auto"' + (style ? ' style="' + style + '"' : '') + '>' + s + '</p>';
const C = (s, size) => P(s, 'text-align: center' + (size ? '; font-size: ' + size : ''));
function titlePage(lang, degree) {
  if (lang === 'en') return C('[University name]') + C('[Faculty / College]') + C('[Department]') + C('<br>') +
    C('<b>[Thesis title]</b>', '22pt') + C('<br>') + C('A thesis submitted in partial fulfilment of the requirements for the degree of ' + degree) + C('<br>') +
    C('By') + C('<b>[Student name]</b>') + C('<br>') + C('Supervised by') + C('<b>[Supervisor name]</b>') + C('<br>') + C('[Year]') + PB;
  return C('[اسم الجامعة]') + C('[اسم الكلية]') + C('[اسم القسم]') + C('<br>') + C('<b>[عنوان الرسالة]</b>', '22pt') + C('<br>') +
    C('رسالة مقدمة لاستكمال متطلبات الحصول على درجة ' + degree + ' في [التخصص]') + C('<br>') +
    C('إعداد الطالب') + C('<b>[اسم الطالب]</b>') + C('<br>') + C('إشراف') + C('<b>[اسم المشرف]</b>') + C('<br>') + C('[العام الجامعي]') + PB;
}
const TOC = '<div class="wq-toc" contenteditable="false"></div>' + PB;
const BIB = '<div class="wq-bib" contenteditable="false"></div>';
const H = (n, s) => '<h' + n + ' dir="auto">' + s + '</h' + n + '>';
function thesisBodyAr(phd) {
  return H(1, 'الإقرار') + P('[نص الإقرار حسب نموذج جامعتك]') + PB +
    H(1, 'الإهداء') + P('[الإهداء]') + PB + H(1, 'الشكر والتقدير') + P('[الشكر والتقدير]') + PB +
    H(1, 'المستخلص') + P('[ملخص الرسالة في حدود ٣٠٠ كلمة]') + P('<b>الكلمات المفتاحية:</b> [كلمة، كلمة، كلمة]') + PB +
    TOC +
    H(1, 'الفصل الأول: الإطار العام للدراسة') + H(2, 'مقدمة') + P('[اكتب هنا]') + H(2, 'مشكلة الدراسة') + P('[اكتب هنا]') +
    H(2, 'أسئلة الدراسة') + P('[اكتب هنا]') + H(2, 'أهداف الدراسة') + P('[اكتب هنا]') + H(2, 'أهمية الدراسة') + P('[اكتب هنا]') +
    H(2, 'حدود الدراسة') + P('[اكتب هنا]') + H(2, 'مصطلحات الدراسة') + P('[اكتب هنا]') + PB +
    H(1, 'الفصل الثاني: الإطار النظري والدراسات السابقة') + H(2, 'المبحث الأول') + P('[اكتب هنا]') + H(2, 'المبحث الثاني') + P('[اكتب هنا]') +
    H(2, 'الدراسات السابقة') + P('[اكتب هنا]') + H(2, 'التعقيب على الدراسات السابقة') + P('[اكتب هنا]') + PB +
    H(1, 'الفصل الثالث: منهجية الدراسة وإجراءاتها') + H(2, 'منهج الدراسة') + P('[اكتب هنا]') + H(2, 'مجتمع الدراسة وعينتها') + P('[اكتب هنا]') +
    H(2, 'أدوات الدراسة') + P('[اكتب هنا]') + H(2, 'الأساليب الإحصائية') + P('[اكتب هنا]') + PB +
    H(1, 'الفصل الرابع: نتائج الدراسة ومناقشتها') + P('[اكتب هنا]') + PB +
    (phd ? H(1, 'الفصل الخامس: النموذج المقترح') + P('[اكتب هنا]') + PB : '') +
    H(1, phd ? 'الفصل السادس: الخلاصة والتوصيات' : 'الفصل الخامس: الخلاصة والتوصيات') + H(2, 'ملخص النتائج') + P('[اكتب هنا]') +
    H(2, 'التوصيات') + P('[اكتب هنا]') + H(2, 'مقترحات لدراسات مستقبلية') + P('[اكتب هنا]') + PB +
    BIB + PB + H(1, 'الملاحق') + P('[الملاحق]');
}
const TEMPLATES = {
  blank: { lang: 'ar', html: () => '<p dir="auto"><br></p>' },
  master: { lang: 'ar', title: 'رسالة ماجستير', html: () => titlePage('ar', 'الماجستير') + thesisBodyAr(false) },
  phd: { lang: 'ar', title: 'رسالة دكتوراه', html: () => titlePage('ar', 'الدكتوراه') + thesisBodyAr(true) },
  paper: { lang: 'ar', title: 'بحث محك\u0651م', html: () =>
    C('<b>[عنوان البحث]</b>', '20pt') + C('[اسم الباحث] · [الجهة] · [البريد الإلكتروني]') +
    H(2, 'الملخص') + P('[ملخص البحث بالعربية في حدود ٢٥٠ كلمة]') + P('<b>الكلمات المفتاحية:</b> [كلمة، كلمة، كلمة]') +
    '<h2 dir="ltr">Abstract</h2><p dir="ltr">[English abstract]</p><p dir="ltr"><b>Keywords:</b> [word, word, word]</p>' +
    H(1, 'المقدمة') + P('[اكتب هنا]') + H(1, 'مشكلة البحث وأسئلته') + P('[اكتب هنا]') + H(1, 'منهج البحث') + P('[اكتب هنا]') +
    H(1, 'النتائج') + P('[اكتب هنا]') + H(1, 'المناقشة') + P('[اكتب هنا]') + H(1, 'الخاتمة والتوصيات') + P('[اكتب هنا]') + BIB },
  thesisEn: { lang: 'en', title: 'Thesis', html: () => titlePage('en', 'Master of [Field]') +
    H(1, 'Declaration') + P('[Declaration text as required by your university]') + PB + H(1, 'Acknowledgements') + P('[Acknowledgements]') + PB +
    H(1, 'Abstract') + P('[Abstract, about 300 words]') + P('<b>Keywords:</b> [word, word, word]') + PB + TOC +
    H(1, 'Chapter 1: Introduction') + H(2, 'Background') + P('[Write here]') + H(2, 'Problem statement') + P('[Write here]') + H(2, 'Research questions') + P('[Write here]') +
    H(2, 'Objectives') + P('[Write here]') + H(2, 'Significance') + P('[Write here]') + PB +
    H(1, 'Chapter 2: Literature review') + P('[Write here]') + PB + H(1, 'Chapter 3: Methodology') + P('[Write here]') + PB +
    H(1, 'Chapter 4: Results and discussion') + P('[Write here]') + PB + H(1, 'Chapter 5: Conclusion and recommendations') + P('[Write here]') + PB +
    BIB + PB + H(1, 'Appendices') + P('[Appendices]') }
};
function applyTemplate(kind) {
  const tp = TEMPLATES[kind]; if (!tp) return;
  const d = newDocModel(tp.lang);
  d.content.html = tp.html();
  d.meta.title = tp.title || '';
  if (tp.lang === 'ar') d.content.html = toArabicDigitsInText(d.content.html);
  loadDocIntoEditor(d);
  WQ.dirty = false; setSaveState('saved'); autosave();
  closeStart(); renderRibbon();
  page.focus();
}
function toArabicDigitsInText(html) { return html.replace(/>([^<]*)</g, (m, x) => '>' + toArabicDigits(x) + '<'); }

/* ======================= شاشة البداية ======================= */
function openStart() {
  closeStart();
  const recent = (lsGet(LS_RECENT) || []).filter((r) => !WQ.doc || r.id !== WQ.doc.meta.id || true);
  const card = (k, icon, label) => '<button class="tpl-card" data-tpl="' + k + '"><span class="tpl-ic">' + icon + '</span>' + E(label) + '</button>';
  let h = '<div class="start-box"><div class="start-head"><span class="logo">' + $('.titlebar .logo').innerHTML + '</span><div><div class="start-title">' + E(t('welcome')) + '</div><div class="wq-note">' + E(t('welcomeSub')) + '</div></div>' +
    '<button class="start-x" id="startClose" aria-label="' + E(t('close')) + '">×</button></div>' +
    '<div class="start-grid"><div><div class="start-sec">' + E(t('startNew')) + '</div><div class="tpl-grid">' +
    card('blank', '▢', t('tplBlank')) + card('master', '🎓', t('tplMaster')) + card('phd', '📜', t('tplPhd')) + card('paper', '📄', t('tplPaper')) + card('thesisEn', 'EN', t('tplThesisEn')) +
    '</div><div class="start-actions"><button class="btn2" id="stOpen">' + E(t('openWarraq')) + '</button><button class="btn2" id="stImport">' + E(t('importWord')) + '</button></div></div>' +
    '<div class="start-recent"><div class="start-sec">' + E(t('recent')) + '</div>';
  if (!recent.length) h += '<p class="wq-note">' + E(t('noRecent')) + '</p>';
  recent.forEach((r, i) => { h += '<button class="recent-item" data-i="' + i + '" dir="auto"><b>' + E(r.title || t('untitled')) + '</b><br><span class="wq-note">' + E(fmtTime(r.at)) + '</span></button>'; });
  h += '<p class="wq-note">' + E(t(WQ.desktop ? 'recentNoteDesktop' : 'recentNote')) + '</p></div></div></div>';
  const ov = el('div', { class: 'start-ov', id: 'startOv', html: h });
  document.body.append(ov);
  $('#startClose').onclick = closeStart;
  $$('.tpl-card', ov).forEach((b) => b.onclick = () => applyTemplate(b.dataset.tpl));
  $('#stOpen').onclick = () => { closeStart(); openFilePicker(); };
  $('#stImport').onclick = () => { closeStart(); openDocxPicker(); };
  $$('.recent-item', ov).forEach((b) => b.onclick = () => {
    const r = recent[+b.dataset.i]; const doc = r && parseDoc(r.file);
    if (!doc) { toast(t('openErr')); return; }
    loadDocIntoEditor(doc); WQ.dirty = true; setSaveState('autosaved'); closeStart(); renderRibbon();
  });
}
function closeStart() { const o = $('#startOv'); if (o) o.remove(); }

/* ======================= الاستيراد من Word (.docx) ======================= */
function openDocxPicker() { $('#fileDocx').value = ''; $('#fileDocx').click(); }

/* قارئ zip بسيط (بدون مكتبات) */
async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('zip');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loff = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    files[name] = { method, csize, loff };
    p += 46 + nlen + xlen + clen;
  }
  const read = async (name) => {
    const f = files[name]; if (!f) return null;
    const lp = f.loff, start = lp + 30 + dv.getUint16(lp + 26, true) + dv.getUint16(lp + 28, true);
    const data = u8.slice(start, start + f.csize);
    if (f.method === 0) return data;
    const ds = new DecompressionStream('deflate-raw');
    const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  };
  return { names: Object.keys(files), read, text: async (n) => { const b = await read(n); return b ? dec.decode(b) : null; } };
}
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const kids = (n, name) => Array.from(n.childNodes).filter((c) => c.nodeType === 1 && (!name || c.localName === name));
const kid = (n, name) => kids(n, name)[0];
const wval = (n) => n ? (n.getAttributeNS(W_NS, 'val') ?? n.getAttribute('w:val')) : null;
const isOn = (n) => !!n && !['0', 'false', 'none'].includes(wval(n));

async function docxToWarraq(buf) {
  const z = await unzip(buf);
  const xml = (s) => s ? new DOMParser().parseFromString(s, 'application/xml') : null;
  const docX = xml(await z.text('word/document.xml'));
  if (!docX) throw new Error('docx');
  const stylesX = xml(await z.text('word/styles.xml'));
  const fnX = xml(await z.text('word/footnotes.xml'));
  const relsX = xml(await z.text('word/_rels/document.xml.rels'));
  // الأنماط ← العناوين
  const head = {};
  if (stylesX) Array.from(stylesX.getElementsByTagNameNS(W_NS, 'style')).forEach((s) => {
    const id = s.getAttributeNS(W_NS, 'styleId'), nm = (wval(kid(s, 'name')) || '').toLowerCase();
    const m = nm.match(/^heading\s*(\d)/); if (m) head[id] = Math.min(3, +m[1]); else if (nm === 'title') head[id] = 1;
  });
  // الصور
  const rels = {};
  if (relsX) Array.from(relsX.getElementsByTagName('Relationship')).forEach((r) => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const imgCache = {};
  const imgData = async (rid) => {
    const target = rels[rid]; if (!target) return '';
    const path = 'word/' + target.replace(/^\.?\//, '');
    if (imgCache[path] !== undefined) return imgCache[path];
    const b = await z.read(path); if (!b) return (imgCache[path] = '');
    const ext = path.split('.').pop().toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext];
    if (!mime) return (imgCache[path] = '');
    let bin = ''; for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
    return (imgCache[path] = 'data:' + mime + ';base64,' + btoa(bin));
  };
  // الحواشي
  const fnText = {};
  if (fnX) Array.from(fnX.getElementsByTagNameNS(W_NS, 'footnote')).forEach((f) => {
    const id = f.getAttributeNS(W_NS, 'id');
    fnText[id] = Array.from(f.getElementsByTagNameNS(W_NS, 't')).map((x) => x.textContent).join('').trim();
  });
  const footnotes = {};
  // الترقيم: numId ← نوع القائمة لكل مستوى (bullet / decimal / none …)
  const numX = xml(await z.text('word/numbering.xml'));
  const numFmt = {};
  if (numX) {
    const abs = {};
    Array.from(numX.getElementsByTagNameNS(W_NS, 'abstractNum')).forEach((a) => {
      const lv = {}; kids(a, 'lvl').forEach((l) => { lv[l.getAttributeNS(W_NS, 'ilvl')] = wval(kid(l, 'numFmt')) || 'decimal'; });
      abs[a.getAttributeNS(W_NS, 'abstractNumId')] = lv;
    });
    Array.from(numX.getElementsByTagNameNS(W_NS, 'num')).forEach((n) => { numFmt[n.getAttributeNS(W_NS, 'numId')] = abs[wval(kid(n, 'abstractNumId'))] || {}; });
  }
  let hasHeadingStyles = false;
  let pending = []; // فقرات مربعات النص، تُضاف قبل الفقرة التي تحملها

  const runs = async (n, info) => {
    let out = '';
    for (const c of kids(n)) {
      if (c.localName === 'r') {
        const pr = kid(c, 'rPr');
        let s = '', txt = '';
        for (const x of kids(c)) {
          if (x.localName === 't') { s += E(x.textContent); txt += x.textContent; }
          else if (x.localName === 'tab') { s += ' '; txt += ' '; }
          else if (x.localName === 'br') s += '<br>';
          else if (x.localName === 'footnoteReference') {
            const id = uid('f'); footnotes[id] = { refId: '', page: '', text: fnText[x.getAttributeNS(W_NS, 'id')] || '' };
            s += '<sup class="wq-fn" data-fn="' + id + '" contenteditable="false">*</sup>';
          } else if (x.localName === 'drawing' || x.localName === 'pict' || x.localName === 'AlternateContent') {
            const host = x.localName === 'AlternateContent' ? (kid(x, 'Choice') || kid(x, 'Fallback')) : x;
            const box = host && host.getElementsByTagNameNS(W_NS, 'txbxContent')[0];
            if (box) { (await flatten(box)).forEach((it) => { it.inBox = true; pending.push(it); }); continue; }
            // WordArt (نص فني): النص في خاصية string، وغالباً يكون عنوان الصفحة
            const tp = host && Array.from(host.getElementsByTagNameNS('*', 'textpath')).find((x) => (x.getAttribute('string') || '').trim());
            const art = tp && tp.getAttribute('string').trim();
            if (art) { pending.push({ kind: 'p', inner: '<b>' + E(art) + '</b>', plain: art, info: { chars: art.length, bold: art.length, maxSz: 99 }, center: true, art: true }); continue; }
            const blip = host && (host.getElementsByTagNameNS('*', 'blip')[0] || host.getElementsByTagNameNS('*', 'imagedata')[0]);
            const rid = blip && (blip.getAttribute('r:embed') || blip.getAttribute('r:id') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
            const src = rid ? await imgData(rid) : '';
            if (src) s += '<img src="' + src + '" alt="">';
          }
        }
        if (txt.trim() && info) {
          const L = txt.trim().length;
          info.chars += L;
          if (pr && (isOn(kid(pr, 'b')) || isOn(kid(pr, 'bCs')))) info.bold += L;
          const sz = pr && (+wval(kid(pr, 'sz')) || +wval(kid(pr, 'szCs')));
          if (sz) info.maxSz = Math.max(info.maxSz, sz);
        }
        if (pr && s.trim() && !s.startsWith('<sup class="wq-fn"')) {
          if (isOn(kid(pr, 'b')) || isOn(kid(pr, 'bCs'))) s = '<b>' + s + '</b>';
          if (isOn(kid(pr, 'i')) || isOn(kid(pr, 'iCs'))) s = '<i>' + s + '</i>';
          if (kid(pr, 'u') && wval(kid(pr, 'u')) !== 'none') s = '<u>' + s + '</u>';
          if (isOn(kid(pr, 'strike'))) s = '<s>' + s + '</s>';
          const va = wval(kid(pr, 'vertAlign')); if (va === 'superscript') s = '<sup>' + s + '</sup>'; else if (va === 'subscript') s = '<sub>' + s + '</sub>';
        }
        out += s;
      } else if (['hyperlink', 'smartTag', 'ins', 'fldSimple'].includes(c.localName)) out += await runs(c, info);
      else if (c.localName === 'sdt') { const ct = kid(c, 'sdtContent'); if (ct) out += await runs(ct, info); }
    }
    return out;
  };
  // تنظيف المسافات في أول وآخر الفقرة (كانت تُستخدم للإزاحة يدوياً)
  const trimHtml = (h) => h.replace(/^((?:<[biu]>)*)(?:\s|&nbsp;)+/, '$1').replace(/(?:\s|&nbsp;)+((?:<\/[biu]>)*)$/, '$1').replace(/<([biu])>\s*<\/\1>/g, '');
  const para = async (p) => {
    const pr = kid(p, 'pPr');
    const st = pr && wval(kid(pr, 'pStyle'));
    const jc = pr && wval(kid(pr, 'jc'));
    const lvl = st && head[st];
    const info = { chars: 0, bold: 0, maxSz: 0 };
    const inner = trimHtml(await runs(p, info));
    const plain = inner.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();
    if (!plain && !/<img|wq-fn/.test(inner)) return { kind: 'empty' };
    if (lvl) { hasHeadingStyles = true; return { kind: 'h', level: lvl, inner }; }
    const np = pr && kid(pr, 'numPr');
    if (np) {
      const fmt = (numFmt[wval(kid(np, 'numId'))] || {})[wval(kid(np, 'ilvl')) || '0'];
      if (fmt && fmt !== 'none') return { kind: 'li', list: fmt === 'bullet' ? 'ul' : 'ol', inner };
    }
    return { kind: 'p', inner, plain, info, center: jc === 'center', justify: jc === 'both' || jc === 'distribute' };
  };
  const tableHtml = async (c) => {
    const wattr = (e, a) => e && (e.getAttributeNS(W_NS, a) || e.getAttribute('w:' + a));
    const grid = kid(c, 'tblGrid');
    const widths = grid ? kids(grid, 'gridCol').map((g) => +wattr(g, 'w') || 0) : [];
    const rows = [];
    for (const tr of kids(c, 'tr')) {
      const trPr = kid(tr, 'trPr');
      const row = { cells: [], before: trPr ? +wval(kid(trPr, 'gridBefore')) || 0 : 0 };
      const head = !!(trPr && kid(trPr, 'tblHeader') && isOn(kid(trPr, 'tblHeader')));
      for (const tc of kids(tr, 'tc')) {
        const pr = kid(tc, 'tcPr');
        const vmEl = pr && kid(pr, 'vMerge');
        const vm = vmEl ? (wval(vmEl) === 'restart' ? 'restart' : 'cont') : null;
        const shd = pr && kid(pr, 'shd');
        const items = await flatten(tc);
        const parts = items.map((x) => x.kind === 'tbl' ? x.html : x.inner).filter(Boolean);
        const firstP = items.find((x) => x.kind === 'p');
        row.cells.push({ html: parts.join('<br>'), span: pr ? +wval(kid(pr, 'gridSpan')) || 1 : 1, vm, head,
          align: firstP && firstP.center ? 'center' : '', fill: shd ? wattr(shd, 'fill') : '' });
      }
      rows.push(row);
    }
    return buildGridTable(rows, widths.every((w) => w > 0) ? widths : null);
  };
  async function flatten(container) {
    const out = [];
    for (const c of kids(container)) {
      if (c.localName === 'p') { const r = await para(c); out.push(...pending); pending = []; out.push(r); }
      else if (c.localName === 'tbl') out.push({ kind: 'tbl', html: await tableHtml(c) });
      else if (c.localName === 'sdt') { const ct = kid(c, 'sdtContent'); if (ct) out.push(...await flatten(ct)); }
    }
    return out;
  }
  const items = await flatten(docX.getElementsByTagNameNS(W_NS, 'body')[0]);

  // اكتشاف العناوين تلقائياً عندما لا يستخدم الملف أنماط العناوين (شائع جداً في الرسائل)
  let detected = 0;
  if (!hasHeadingStyles) {
    const sizes = items.filter((x) => x.kind === 'p' && x.plain.length > 150 && x.info.maxSz).map((x) => x.info.maxSz).sort((a, b) => a - b);
    const base = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 24;
    items.forEach((x) => {
      if (x.kind !== 'p' || !x.info.chars) return;
      const txt = x.plain, len = txt.length;
      if (len > 120 || /[.!؟?]$/.test(txt) && !/^\d+(\.\d+)*\.?\s/.test(txt)) return;
      const boldAll = x.info.bold / x.info.chars >= 0.85;
      const bigger = x.info.maxSz >= base + 4;
      if (!(boldAll || bigger)) return;
      if (x.info.maxSz && x.info.maxSz < base) return;
      let level;
      const m = txt.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
      if (m && m[3]) level = 3; else if (m && m[2]) level = 2;
      else if (/^(الفصل|الباب|chapter|introduction|review of literature|summary|conclusion|references|abstract|المقدمة|الخاتمة|الملخص|المراجع)/i.test(txt) || x.info.maxSz >= base + 12 || (x.center && bigger)) level = 1;
      else level = bigger ? 2 : 3;
      x.kind = 'h'; x.level = level;
      x.inner = x.inner.replace(/<\/?b>/g, '');
      detected++;
    });
  }
  // البناء النهائي: نحذف الفراغات في البداية والنهاية، ونختصر الفراغات المتتالية لفقرة واحدة، ونجمع القوائم
  let html = '', list = null, lastEmpty = true;
  items.forEach((x) => {
    if (x.kind === 'empty') { if (list) { html += '</' + list + '>'; list = null; } if (!lastEmpty) { html += '<p dir="auto"><br></p>'; lastEmpty = true; } return; }
    if (x.kind === 'li') {
      if (list !== x.list) { if (list) html += '</' + list + '>'; html += '<' + x.list + '>'; list = x.list; }
      html += '<li dir="auto">' + x.inner + '</li>'; lastEmpty = false; return;
    }
    if (list) { html += '</' + list + '>'; list = null; }
    if (x.kind === 'h') html += '<h' + x.level + ' dir="auto">' + x.inner + '</h' + x.level + '>';
    else if (x.kind === 'tbl') html += x.html;
    else html += '<p dir="auto"' + (x.center ? ' style="text-align: center"' : (x.justify ? ' style="text-align: justify"' : '')) + '>' + x.inner + '</p>';
    lastEmpty = false;
  });
  if (list) html += '</' + list + '>';
  html = html.replace(/(<p dir="auto"><br><\/p>)+$/, '');
  return { html, footnotes, detected };
}
async function onDocxChosen(e) {
  const f = e.target.files[0]; if (!f) return;
  await importWordBytes(f.name, await f.arrayBuffer());
}
async function importWordBytes(fname, buf) {
  const f = { name: fname };
  const sig = new Uint8Array(buf.slice(0, 4));
  // ملف Word القديم (.doc 97-2003): توقيعه D0 CF 11 E0
  const legacy = sig[0] === 0xD0 && sig[1] === 0xCF && sig[2] === 0x11 && sig[3] === 0xE0;
  toast(t('importing'));
  try {
    let res;
    if (legacy) { try { res = doc97ToWarraq(buf); } catch (e) { showLegacyDocHelp(f.name); return; } }
    else res = await docxToWarraq(buf);
    const { html, footnotes, detected } = res;
    const plain = html.replace(/<[^>]+>/g, '');
    const ar = (plain.match(/[\u0600-\u06FF]/g) || []).length, la = (plain.match(/[A-Za-z]/g) || []).length;
    const d = newDocModel(ar >= la ? 'ar' : 'en');
    // نحترم نوع الأرقام اللي كاتب بيه صاحب الملف
    const wd = (plain.match(/[0-9]/g) || []).length, ad = (plain.match(/[\u0660-\u0669]/g) || []).length;
    if (d.settings.lang === 'ar' && wd > ad) d.settings.numerals = 'western';
    d.content.html = sanitizeHtml(html, true);
    d.footnotes = footnotes;
    d.meta.title = f.name.replace(/\.docx?$/i, '');
    loadDocIntoEditor(d);
    takeSnapshot(t('afterImport'));
    WQ.dirty = true; markDirty(); renderRibbon();
    let msg = t('importOk').replace('{n}', fmtNum(Object.keys(footnotes).length));
    if (detected) msg += ' · ' + t('headingsDetected').replace('{n}', fmtNum(detected));
    toast(msg);
    if (legacy) setTimeout(() => toast(t('legacyRead')), 2800);
  } catch (err) {
    toast(t('importErr'));
  }
}
function showLegacyDocHelp(name) {
  showModal({ title: t('legacyTitle'), body:
    '<p>' + E(t('legacyIntro').replace('{f}', name)) + '</p><ol style="line-height:2;margin:0 0 10px;padding-inline-start:1.4em">' +
    '<li>' + E(t('legacy1')) + '</li><li>' + E(t('legacy2')) + '</li><li>' + E(t('legacy3')) + '</li><li>' + E(t('legacy4')) + '</li></ol>' +
    '<p class="wq-note">' + E(t('legacyNote')) + '</p>',
    actions: [{ label: t('close'), cls: 'btn' }] });
}

/* ======================= عن ور\u0651اق ======================= */
function openAbout() {
  showModal({ title: t('about'), body:
    '<div style="text-align:center"><span class="logo" style="display:inline-block;transform:scale(2.2);margin:14px">' + $('.titlebar .logo').innerHTML + '</span>' +
    '<div class="start-title">' + E(t('appName')) + '</div><p class="wq-note">' + E(t('version')) + ' ' + APP_VERSION + ' (' + APP_STAGE + ') · ' + APP_UPDATED + '</p></div>' +
    '<p>' + E(t('aboutText')) + '</p><div id="aboutCredits"></div>',
    actions: [...(WQ.desktop && window.warraqDesktop.checkUpdate ? [{ label: t('checkUpdate'), cls: 'btn outline', keep: true, run: checkForUpdates }] : []), { label: t('close'), cls: 'btn' }],
    onOpen: (m) => { $('#aboutCredits', m).innerHTML = (typeof quranCredits === 'function' ? quranCredits() : '') + '<p class="wq-note">' + E(t('pptCredit')) + '</p>' +
      '<p class="wq-note">' + E(t('licenseLine')) + '</p><p class="wq-note" style="display:flex;gap:12px;flex-wrap:wrap">' +
      '<a href="' + WQ_LINKS.issues + '" target="_blank" rel="noopener">' + E(t('reportIssue')) + '</a>' +
      '<a href="' + WQ_LINKS.privacy + '" target="_blank" rel="noopener">' + E(t('privacy')) + '</a>' +
      '<a href="' + WQ_LINKS.source + '" target="_blank" rel="noopener">' + E(t('sourceCode')) + '</a></p>'; } });
}
const WQ_LINKS = { issues: 'https://github.com/MidoMicro/warraq/issues/new/choose', privacy: 'https://getwarraq.org/privacy.html', source: 'https://github.com/MidoMicro/warraq' };
function openIssues() { window.open(WQ_LINKS.issues, '_blank', 'noopener'); }
async function checkForUpdates() {
  try {
    const r = await window.warraqDesktop.checkUpdate();
    if (!r || r.error) toast(t('updError'));
    else if (r.version && r.version !== r.current) toast(t('updDownloading').replace('{v}', r.version));
    else toast(t('upToDate'));
  } catch (e) { toast(t('updError')); }
}
