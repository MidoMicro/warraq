/* ===== cite: المراجع والحواشي والاستشهادات وقائمة المراجع والفهرس ===== */

/* مصطلحات التوثيق حسب لغة المرجع (العرف في الرسائل العربية: المرجع العربي بمصطلحات عربية، والأجنبي بمصطلحاته) */
const TERMS = {
  ar: { ibid: 'المرجع نفسه', opcit: 'مرجع سابق', p: 'ص', and: 'و', etal: 'وآخرون', nd: 'د.ت', master: 'رسالة ماجستير', phd: 'رسالة دكتوراه', c: '، ', avail: 'متاح على' },
  en: { ibid: 'Ibid.', opcit: 'op. cit.', p: 'p.', and: '&', etal: 'et al.', nd: 'n.d.', master: "Master's thesis", phd: 'Doctoral dissertation', c: ', ', avail: 'Retrieved from' },
  fr: { ibid: 'Ibid.', opcit: 'op. cit.', p: 'p.', and: 'et', etal: 'et al.', nd: 's.d.', master: 'Mémoire de master', phd: 'Thèse de doctorat', c: ', ', avail: 'Disponible sur' }
};
const REF_TYPES = ['book', 'article', 'thesis', 'web'];
const REF_FIELDS = ['type', 'lang', 'authors', 'title', 'year', 'publisher', 'place', 'journal', 'volume', 'issue', 'pages', 'university', 'degree', 'url', 'accessed'];

const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hasArabic = (s) => /[\u0600-\u06FF]/.test(s || '');

function cleanRef(r) {
  const o = {};
  REF_FIELDS.forEach((k) => { o[k] = typeof r[k] === 'string' ? r[k].slice(0, 2000) : ''; });
  o.id = r.id;
  if (!REF_TYPES.includes(o.type)) o.type = 'book';
  if (!['ar', 'en', 'fr', ''].includes(o.lang)) o.lang = '';
  return o;
}
function cleanFootnotes(f) {
  const out = {};
  if (f && typeof f === 'object') Object.entries(f).forEach(([id, v]) => {
    if (ID_RE.test(id) && v && typeof v === 'object') out[id] = { refId: ID_RE.test(v.refId || '') ? v.refId : '', page: String(v.page || '').slice(0, 40), text: String(v.text || '').slice(0, 5000) };
  });
  return out;
}

/* ---------- أدوات التنسيق ---------- */
const refLang = (r) => r.lang || (hasArabic(r.title + r.authors) ? 'ar' : 'en');
function N(s, lang) { // الأرقام حسب إعداد المستند (العربية للمراجع العربية فقط)
  s = String(s || '');
  const mode = WQ.doc.settings.numerals;
  return (mode === 'arabic' && lang === 'ar') ? toArabicDigits(s) : toWesternDigits(s);
}
const E = escapeHtml;
function parseAuthors(r) {
  return (r.authors || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.split(/[,\u060C]/);
    return m.length > 1 ? { family: m[0].trim(), given: m.slice(1).join(' ').trim() } : { family: l, given: '' };
  });
}
const initials = (g) => g.split(/[\s.-]+/).filter(Boolean).map((x) => x[0].toUpperCase() + '.').join(' ');
/* العربي ي\u064Fمي\u064E\u0651ز بالخط العريض (المائل العربي غير مقروء)، واللاتيني بالمائل */
const em = (txt, lang, raw) => { const v = raw ? txt : E(txt); return lang === 'ar' ? '<b>' + v + '</b>' : '<i>' + v + '</i>'; };
const ttl = (r, lang) => lang === 'ar' ? '<b>' + E(r.title) + '</b>' : '<i>' + E(r.title) + '</i>';
function joinList(arr, lang, andWord) {
  const T = TERMS[lang];
  if (arr.length <= 1) return arr.join('');
  if (lang === 'ar') return arr.slice(0, -1).join('، ') + ' و' + arr[arr.length - 1];
  return arr.slice(0, -1).join(', ') + (arr.length > 2 ? ',' : '') + ' ' + (andWord || T.and) + ' ' + arr[arr.length - 1];
}
const yearOf = (r, lang) => r.year ? N(r.year, lang) : TERMS[lang].nd;
const pageStr = (page, lang) => page ? TERMS[lang].p + ' ' + N(page, lang) : '';

/* ---- APA ---- */
function apaAuthors(r, lang) {
  const a = parseAuthors(r);
  if (!a.length) return '';
  const names = a.slice(0, 20).map((x) => lang === 'ar' ? (x.given ? x.family + '، ' + x.given : x.family) : (x.given ? x.family + ', ' + initials(x.given) : x.family));
  return joinList(names, lang, '&');
}
function apaRef(r) {
  const L = refLang(r), T = TERMS[L], c = T.c;
  const au = apaAuthors(r, L) || ttl(r, L);
  const head = au + ' (' + yearOf(r, L) + '). ';
  const t0 = parseAuthors(r).length ? ttl(r, L) + '. ' : '';
  switch (r.type) {
    case 'article': return head + E(r.title) + '. ' + em(r.journal, L) + (r.volume ? c + em(N(r.volume, L), L, true) : '') + (r.issue ? '(' + N(r.issue, L) + ')' : '') + (r.pages ? c + N(r.pages, L) : '') + '.';
    case 'thesis': return head + t0.replace(/\. $/, ' ') + '[' + (r.degree === 'phd' ? T.phd : T.master) + c + E(r.university) + '].';
    case 'web': return head + t0 + (r.publisher ? E(r.publisher) + '. ' : '') + (r.url ? '<span dir="ltr">' + E(r.url) + '</span>' : '');
    default: return head + t0 + (r.place ? E(r.place) + ': ' : '') + E(r.publisher) + (r.publisher ? '.' : '');
  }
}
function apaInText(r, page) {
  const L = refLang(r), T = TERMS[L], a = parseAuthors(r);
  let who;
  if (!a.length) who = E(r.title);
  else if (a.length === 1) who = E(a[0].family);
  else if (a.length === 2) who = L === 'ar' ? E(a[0].family) + ' و' + E(a[1].family) : E(a[0].family) + ' & ' + E(a[1].family);
  else who = E(a[0].family) + ' ' + T.etal;
  return '(' + who + T.c + yearOf(r, L) + (page ? T.c + pageStr(page, L) : '') + ')';
}

/* ---- Vancouver ---- */
function vanRef(r) {
  const L = refLang(r), a = parseAuthors(r), sc = L === 'ar' ? '؛ ' : '; ', sc0 = L === 'ar' ? '؛' : ';';
  const names = a.slice(0, 6).map((x) => L === 'ar' ? (x.given ? x.family + ' ' + x.given : x.family) : x.family + (x.given ? ' ' + initials(x.given).replace(/[.\s]/g, '') : ''));
  let au = names.join(L === 'ar' ? '، ' : ', ');
  if (a.length > 6) au += (L === 'ar' ? '، ' : ', ') + TERMS[L].etal;
  au = au ? au + '. ' : '';
  switch (r.type) {
    case 'article': return au + E(r.title) + '. ' + E(r.journal) + '. ' + N(r.year, L) + (r.volume ? sc0 + N(r.volume, L) : '') + (r.issue ? '(' + N(r.issue, L) + ')' : '') + (r.pages ? ':' + N(r.pages, L) : '') + '.';
    case 'thesis': return au + E(r.title) + ' [' + (r.degree === 'phd' ? TERMS[L].phd : TERMS[L].master) + ']. ' + E(r.university) + sc + N(r.year, L) + '.';
    case 'web': return au + E(r.title) + ' [Internet]. ' + (r.publisher ? E(r.publisher) + sc : '') + N(r.year, L) + '. ' + (r.url ? '<span dir="ltr">' + E(r.url) + '</span>' : '');
    default: return au + E(r.title) + '. ' + (r.place ? E(r.place) + ': ' : '') + (r.publisher ? E(r.publisher) + sc : '') + N(r.year, L) + '.';
  }
}

/* ---- الحواشي (الأسلوب العربي / Chicago notes) ---- */
function noteAuthors(r, L) {
  const a = parseAuthors(r);
  if (!a.length) return '';
  const full = (x) => (x.given ? x.given + ' ' : '') + x.family;
  if (a.length > 3) return E(full(a[0])) + ' ' + TERMS[L].etal;
  return joinList(a.map((x) => E(full(x))), L, L === 'en' ? 'and' : undefined);
}
function noteFull(r, page) {
  const L = refLang(r), T = TERMS[L], c = T.c;
  const parts = [];
  const au = noteAuthors(r, L); if (au) parts.push(au);
  switch (r.type) {
    case 'article':
      parts.push(L === 'ar' ? '"' + E(r.title) + '"' : '"' + E(r.title) + '"');
      parts.push((L === 'ar' ? '<b>' + E(r.journal) + '</b>' : '<i>' + E(r.journal) + '</i>') + (r.volume ? ' ' + N(r.volume, L) : '') + (r.issue ? (L === 'ar' ? '، ع ' : ', no. ') + N(r.issue, L) : ''));
      parts.push(yearOf(r, L));
      break;
    case 'thesis':
      parts.push(ttl(r, L)); parts.push(r.degree === 'phd' ? T.phd : T.master); if (r.university) parts.push(E(r.university)); parts.push(yearOf(r, L));
      break;
    case 'web':
      parts.push(ttl(r, L)); if (r.publisher) parts.push(E(r.publisher)); if (r.url) parts.push(T.avail + ' <span dir="ltr">' + E(r.url) + '</span>');
      break;
    default:
      parts.push(ttl(r, L)); if (r.publisher) parts.push(E(r.publisher)); if (r.place) parts.push(E(r.place)); parts.push(yearOf(r, L));
  }
  if (page) parts.push(pageStr(page, L));
  return parts.join(c) + '.';
}
function noteShort(r, page) {
  const L = refLang(r), T = TERMS[L], a = parseAuthors(r);
  const who = a.length ? E(a[0].family) + (a.length > 2 ? ' ' + T.etal : '') : ttl(r, L);
  return who + T.c + T.opcit + (page ? T.c + pageStr(page, L) : '') + '.';
}
function noteIbid(r, page) {
  const L = refLang(r), T = TERMS[L];
  return '<span class="ibid">' + T.ibid + '</span>' + (page ? T.c + pageStr(page, L) : '') + (L === 'ar' ? '.' : (page ? '.' : ''));
}

/* ---------- الرسم: يمر على المستند بالترتيب ويحسب كل شيء ---------- */
const refById = (id) => (WQ.doc.references || []).find((r) => r.id === id);
function fnMark(n) {
  const s = WQ.doc.settings;
  const num = s.numerals === 'arabic' ? toArabicDigits(String(n)) : String(n);
  return s.lang === 'ar' ? '(' + num + ')' : num;
}
function renderCitations() {
  if (!WQ.doc) return;
  const style = WQ.doc.settings.citeStyle || 'notes';
  const fns = WQ.doc.footnotes;
  const order = [];       // ترتيب أول ظهور للمراجع (لـ Vancouver)
  const seen = new Set();
  let lastRef = null, n = 0;
  const zone = [];
  const fnBody = WQ._fnBody = {};
  $$('.wq-fn,.wq-cite', page).forEach((el) => {
    if (el.classList.contains('wq-fn')) {
      const f = fns[el.dataset.fn];
      if (!f) { el.remove(); return; }
      n++;
      const mark = fnMark(n);
      if (el.textContent !== mark) el.textContent = mark;
      let body = '';
      const r = f.refId && refById(f.refId);
      if (r) {
        if (style === 'notes') body = (lastRef === r.id) ? noteIbid(r, f.page) : (seen.has(r.id) ? noteShort(r, f.page) : noteFull(r, f.page));
        else if (style === 'apa') body = apaInText(r, f.page);
        else { if (!order.includes(r.id)) order.push(r.id); body = '[' + N(order.indexOf(r.id) + 1, WQ.doc.settings.lang) + ']'; }
        seen.add(r.id); lastRef = r.id;
      } else if (f.refId) lastRef = null;
      if (f.text) body += (body ? ' ' : '') + E(f.text);
      if (!f.refId) lastRef = null;
      fnBody[el.dataset.fn] = body || '…';
      zone.push('<p class="fn-item" dir="auto" data-fn="' + el.dataset.fn + '"><span class="fn-num">' + mark + '</span> ' + (body || '…') + '</p>');
    } else {
      const r = refById(el.dataset.ref);
      if (!r) { el.remove(); return; }
      let txt;
      if (style === 'vancouver') { if (!order.includes(r.id)) order.push(r.id); txt = '[' + N(order.indexOf(r.id) + 1, WQ.doc.settings.lang) + ']'; }
      else txt = apaInText(r, el.dataset.page);
      const plain = new DOMParser().parseFromString(txt, 'text/html').body.textContent;
      if (el.textContent !== plain) el.textContent = plain;
      seen.add(r.id);
    }
  });
  const fz = $('#fnZone');
  const html = zone.join('');
  if (fz._h !== html) { fz.innerHTML = html; fz._h = html; }
  WQ._citedOrder = order; WQ._cited = seen;
  renderBibliography();
  renderToc();
  renderRefPanel();
}

/* ---------- قائمة المراجع ---------- */
function bibEntries() {
  const style = WQ.doc.settings.citeStyle || 'notes';
  const cited = (WQ.doc.references || []).filter((r) => WQ._cited && WQ._cited.has(r.id));
  if (style === 'vancouver') {
    return [{ items: WQ._citedOrder.map((id, i) => ({ r: refById(id), num: i + 1 })).filter((x) => x.r) }];
  }
  const key = (r) => (parseAuthors(r)[0] || { family: r.title }).family + ' ' + r.title;
  const ar = cited.filter((r) => refLang(r) === 'ar').sort((a, b) => key(a).localeCompare(key(b), 'ar'));
  const fo = cited.filter((r) => refLang(r) !== 'ar').sort((a, b) => key(a).localeCompare(key(b), 'en'));
  const docAr = WQ.doc.settings.lang === 'ar';
  const groups = docAr ? [{ title: t('bibAr'), items: ar }, { title: t('bibForeign'), items: fo }] : [{ title: t('bibForeign'), items: fo }, { title: t('bibAr'), items: ar }];
  return groups.filter((g) => g.items.length).map((g) => ({ title: (ar.length && fo.length) ? g.title : '', items: g.items.map((r) => ({ r })) }));
}
function renderBibliography() {
  const blocks = $$('.wq-bib', page);
  if (!blocks.length) return;
  const style = WQ.doc.settings.citeStyle || 'notes';
  const groups = bibEntries();
  let h = '<div class="wq-block-title">' + E(t('bibTitle')) + '</div>';
  if (!groups.length || !groups.some((g) => g.items.length)) h += '<p class="wq-note">' + E(t('bibEmpty')) + '</p>';
  groups.forEach((g) => {
    if (g.title) h += '<div class="wq-block-sub">' + E(g.title) + '</div>';
    g.items.forEach((x) => {
      const txt = style === 'vancouver' ? N(x.num, WQ.doc.settings.lang) + '. ' + vanRef(x.r) : apaRef(x.r);
      h += '<p class="bib-item" dir="auto">' + txt + '</p>';
    });
  });
  blocks.forEach((b) => { if (b._h !== h) { b.innerHTML = h; b._h = h; } });
}

/* ---------- فهرس المحتويات ---------- */
function renderToc() {
  const blocks = $$('.wq-toc', page);
  if (!blocks.length) return;
  const hs = headings();
  let h = '<div class="wq-block-title">' + E(t('tocTitle')) + '</div>';
  if (!hs.length) h += '<p class="wq-note">' + E(t('tocEmpty')) + '</p>';
  hs.forEach((x, i) => {
    h += '<div class="toc-row l' + x.tagName[1] + '" data-i="' + i + '" dir="auto"><span>' + E(x.textContent.trim()) + '</span><span class="dots"></span><span>' + N((PV.exact && PV.headPage[i] !== undefined) ? PV.headPage[i] : pageOf(x), WQ.doc.settings.lang) + '</span></div>';
  });
  if (hs.length && !PV.exact) h += '<p class="wq-note">' + E(t('pageApproxNote')) + '</p>';
  blocks.forEach((b) => { if (b._h !== h) { b.innerHTML = h; b._h = h; } });
}

/* ---------- الإدراج ---------- */
function insertInline(html) { insertHtml(html); renderCitations(); }
function addFootnote(data) {
  const id = uid('f');
  WQ.doc.footnotes[id] = { refId: data.refId || '', page: data.page || '', text: data.text || '' };
  insertInline('<sup class="wq-fn" data-fn="' + id + '" contenteditable="false">*</sup>');
  return id;
}
function addCitation(refId, pageNo) {
  if ((WQ.doc.settings.citeStyle || 'notes') === 'notes') return addFootnote({ refId, page: pageNo });
  insertInline('<span class="wq-cite" data-ref="' + refId + '" data-page="' + E(pageNo || '') + '" contenteditable="false">[*]</span>');
}
function insertBlock(cls) {
  const ex = $('.' + cls, page);
  if (ex) { ex.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  insertHtml('<div class="' + cls + '" contenteditable="false"></div><p dir="auto"><br></p>');
  renderCitations();
}

/* ---------- تغيير نمط التوثيق (مع تحويل الاستشهادات) ---------- */
function setCiteStyle(style) {
  const prev = WQ.doc.settings.citeStyle || 'notes';
  if (prev === style) return;
  takeSnapshot(t('citeStyle') + ': ' + styleName(prev) + ' → ' + styleName(style));
  WQ.doc.settings.citeStyle = style;
  if (style === 'notes') {
    $$('.wq-cite', page).forEach((el) => {
      const id = uid('f');
      WQ.doc.footnotes[id] = { refId: el.dataset.ref, page: el.dataset.page || '', text: '' };
      const s = document.createElement('sup'); s.className = 'wq-fn'; s.dataset.fn = id; s.contentEditable = 'false'; s.textContent = '*';
      el.replaceWith(s);
    });
  } else if (prev === 'notes') {
    $$('.wq-fn', page).forEach((el) => {
      const f = WQ.doc.footnotes[el.dataset.fn];
      if (f && f.refId && !f.text) {
        const s = document.createElement('span'); s.className = 'wq-cite'; s.dataset.ref = f.refId; s.dataset.page = f.page || ''; s.contentEditable = 'false'; s.textContent = '[*]';
        el.replaceWith(s); delete WQ.doc.footnotes[el.dataset.fn];
      }
    });
  }
  markDirty(); renderCitations(); renderRibbon();
}

/* ---------- لوحة المراجع ---------- */
let refQuery = '';
function citeCount(id) {
  return $$('.wq-cite', page).filter((e) => e.dataset.ref === id).length +
    $$('.wq-fn', page).filter((e) => (WQ.doc.footnotes[e.dataset.fn] || {}).refId === id).length;
}
function renderRefPanel() {
  const body = $('#refPanelBody'); if (!body) return;
  const refs = WQ.doc.references || [];
  const q = refQuery.trim().toLowerCase();
  const list = refs.filter((r) => !q || (r.authors + ' ' + r.title + ' ' + r.year).toLowerCase().includes(q));
  const head = $('#refPanel h3 [data-i18n]');
  if (head) head.textContent = t('references') + ' (' + fmtNum(refs.length) + ')';
  let h = '<input class="ref-search" id="refSearch" placeholder="' + E(t('searchRefs')) + '" value="' + E(refQuery) + '">';
  if (!refs.length) h += '<p class="soon">' + E(t('noRefs')) + '</p>';
  list.forEach((r) => {
    const a = parseAuthors(r)[0];
    const n = citeCount(r.id);
    h += '<div class="ref-card" dir="auto" data-id="' + r.id + '"><div class="ra">' + E(a ? a.family + (a.given ? (refLang(r) === 'ar' ? '، ' : ', ') + a.given : '') : r.title) + '</div>' +
      '<div class="rm">' + E(r.title.slice(0, 60)) + ' · ' + E(N(r.year, refLang(r))) + (n ? ' · ' + E(t('citedTimes')) + ' ' + fmtNum(n) : '') + '</div>' +
      '<div class="acts"><button class="c" data-act="cite">' + E(t('cite')) + '</button><button data-act="edit">' + E(t('edit')) + '</button><button data-act="del">' + E(t('del')) + '</button></div></div>';
  });
  h += '<button class="btn ref-new" id="refNew">+ ' + E(t('newRef')) + '</button>';
  const focused = document.activeElement && document.activeElement.id === 'refSearch';
  if (body._h === h) return;
  body.innerHTML = h; body._h = h;
  const sInp = $('#refSearch');
  sInp.oninput = (e) => { refQuery = e.target.value; renderRefPanel(); };
  if (focused) { sInp.focus(); sInp.setSelectionRange(sInp.value.length, sInp.value.length); }
  $('#refNew').onclick = () => { saveRange(); openRefDialog(); };
  $$('.ref-card button', body).forEach((b) => {
    b.onmousedown = (e) => { e.preventDefault(); saveRange(); };
    b.onclick = () => {
      const id = b.closest('.ref-card').dataset.id, act = b.dataset.act;
      if (act === 'cite') openCiteDialog(id);
      else if (act === 'edit') openRefDialog(refById(id));
      else deleteRef(id);
    };
  });
}
function deleteRef(id) {
  const n = citeCount(id);
  const doDel = () => {
    $$('.wq-cite', page).filter((e) => e.dataset.ref === id).forEach((e) => e.remove());
    $$('.wq-fn', page).forEach((e) => { const f = WQ.doc.footnotes[e.dataset.fn]; if (f && f.refId === id) { if (f.text) f.refId = ''; else { e.remove(); delete WQ.doc.footnotes[e.dataset.fn]; } } });
    WQ.doc.references = WQ.doc.references.filter((r) => r.id !== id);
    markDirty(); renderCitations();
  };
  if (!n) { doDel(); return; }
  showModal({ title: t('del'), body: '<p>' + E(t('refInUse').replace('{n}', fmtNum(n))) + '</p>',
    actions: [{ label: t('cancel') }, { label: t('deleteAll'), cls: 'btn', run: doDel }] });
}

/* ---------- نافذة المرجع ---------- */
function openRefDialog(existing) {
  const r = existing ? Object.assign({}, existing) : cleanRef({ id: uid('r'), type: 'book' });
  const fieldsFor = { book: ['authors', 'title', 'year', 'publisher', 'place'], article: ['authors', 'title', 'year', 'journal', 'volume', 'issue', 'pages'],
    thesis: ['authors', 'title', 'year', 'university', 'degree'], web: ['authors', 'title', 'year', 'publisher', 'url', 'accessed'] };
  const style = WQ.doc.settings.citeStyle || 'notes';
  const preview = () => style === 'vancouver' ? vanRef(r) : (style === 'apa' ? apaRef(r) : noteFull(r, ''));
  const draw = (m) => {
    const b = $('.body', m);
    let h = '<div class="chips">' + REF_TYPES.map((tp) => '<button class="chip' + (r.type === tp ? ' on' : '') + '" data-tp="' + tp + '">' + E(t('rt_' + tp)) + '</button>').join('') + '</div>';
    fieldsFor[r.type].forEach((f) => {
      const v = E(r[f] || '');
      if (f === 'authors') h += '<label>' + E(t('f_authors')) + '</label><textarea data-f="authors" dir="auto" rows="2">' + v + '</textarea>';
      else if (f === 'degree') h += '<label>' + E(t('f_degree')) + '</label><select data-f="degree"><option value="master">' + E(t('degMaster')) + '</option><option value="phd"' + (r.degree === 'phd' ? ' selected' : '') + '>' + E(t('degPhd')) + '</option></select>';
      else h += '<label>' + E(t('f_' + f)) + '</label><input data-f="' + f + '" dir="' + (/url|year|volume|issue|pages|accessed/.test(f) ? 'ltr' : 'auto') + '" value="' + v + '">';
    });
    h += '<label>' + E(t('f_lang')) + '</label><select data-f="lang"><option value="">' + E(t('auto')) + '</option><option value="ar">' + E(t('langAr')) + '</option><option value="en">' + E(t('langEn')) + '</option><option value="fr">' + E(t('langFr')) + '</option></select>';
    h += '<label>' + E(t('preview')) + ' (' + E(styleName(style)) + ')</label><div class="preview-box" dir="auto" id="refPrev">' + preview() + '</div>';
    b.innerHTML = h;
    $('[data-f="lang"]', b).value = r.lang || '';
    $$('.chip', b).forEach((c) => c.onclick = () => { r.type = c.dataset.tp; draw(m); });
    $$('[data-f]', b).forEach((inp) => inp.addEventListener('input', () => { r[inp.dataset.f] = inp.value; $('#refPrev', b).innerHTML = preview(); }));
    $$('select[data-f]', b).forEach((inp) => inp.addEventListener('change', () => { r[inp.dataset.f] = inp.value; $('#refPrev', b).innerHTML = preview(); }));
  };
  const commit = (m, andInsert) => {
    if (!r.title.trim()) { const p = $('#refPrev', m); p.innerHTML = '<span style="color:#A32D2D">' + E(t('needTitle')) + '</span>'; return false; }
    const clean = cleanRef(r);
    const i = WQ.doc.references.findIndex((x) => x.id === clean.id);
    if (i >= 0) WQ.doc.references[i] = clean; else WQ.doc.references.push(clean);
    markDirty(); renderCitations();
    if (andInsert) setTimeout(() => openCiteDialog(clean.id), 50);
  };
  const actions = [{ label: t('cancel') }];
  if (!existing) actions.push({ label: t('saveOnly'), run: (m) => commit(m, false) });
  actions.push({ label: existing ? t('ok') : t('saveInsert'), cls: 'btn', run: (m) => commit(m, !existing) });
  showModal({ title: existing ? t('editRef') : t('newRef'), body: '', wide: true, actions, onOpen: draw });
}
function styleName(s) { return s === 'apa' ? 'APA' : (s === 'vancouver' ? 'Vancouver' : t('styleNotes')); }

/* ---------- نافذة الاستشهاد ---------- */
function openCiteDialog(preId) {
  const refs = WQ.doc.references;
  if (!refs.length) { openRefDialog(); return; }
  const opts = refs.map((r) => { const a = parseAuthors(r)[0]; return '<option value="' + r.id + '"' + (r.id === preId ? ' selected' : '') + '>' + E((a ? a.family + ' – ' : '') + r.title.slice(0, 50) + (r.year ? ' (' + r.year + ')' : '')) + '</option>'; }).join('');
  showModal({
    title: t('insertCitation'),
    body: '<label>' + E(t('chooseRef')) + '</label><select id="cRef" dir="auto">' + opts + '</select><label>' + E(t('pageNo')) + '</label><input id="cPage" dir="ltr">',
    actions: [{ label: t('cancel') }, { label: t('insert'), cls: 'btn', run: (m) => { restoreRange(); addCitation($('#cRef', m).value, $('#cPage', m).value.trim()); } }],
    onOpen: (m) => setTimeout(() => $('#cPage', m).focus(), 0)
  });
}

/* ---------- نافذة الحاشية ---------- */
function openFootnoteDialog(id) {
  const isNew = !id;
  const f = isNew ? { refId: '', page: '', text: '' } : Object.assign({}, WQ.doc.footnotes[id]);
  const opts = '<option value="">' + E(t('none')) + '</option>' + WQ.doc.references.map((r) => '<option value="' + r.id + '"' + (r.id === f.refId ? ' selected' : '') + '>' + E(((parseAuthors(r)[0] || {}).family || '') + ' – ' + r.title.slice(0, 45)) + '</option>').join('');
  const actions = [{ label: t('cancel') }];
  if (!isNew) actions.push({ label: t('del'), run: () => { const el = $('.wq-fn[data-fn="' + id + '"]', page); if (el) el.remove(); delete WQ.doc.footnotes[id]; markDirty(); renderCitations(); } });
  actions.push({ label: isNew ? t('insert') : t('ok'), cls: 'btn', run: (m) => {
    const data = { text: $('#fText', m).value.trim(), refId: $('#fRef', m).value, page: $('#fPage', m).value.trim() };
    if (isNew) { restoreRange(); addFootnote(data); } else { WQ.doc.footnotes[id] = data; markDirty(); renderCitations(); }
  } });
  showModal({
    title: t('fnTitle'),
    body: '<label>' + E(t('fnText')) + '</label><textarea id="fText" dir="auto">' + E(f.text) + '</textarea>' +
      '<div class="row"><div><label>' + E(t('fnRef')) + '</label><select id="fRef" dir="auto">' + opts + '</select></div><div><label>' + E(t('pageNo')) + '</label><input id="fPage" dir="ltr" value="' + E(f.page) + '"></div></div>',
    actions
  });
}

/* ---------- النقر على عناصر التوثيق ---------- */
function initCiteEvents() {
  page.addEventListener('click', (e) => {
    const fn = e.target.closest('.wq-fn');
    if (fn) { saveRange(); openFootnoteDialog(fn.dataset.fn); return; }
    const c = e.target.closest('.wq-cite');
    if (c) {
      const r = refById(c.dataset.ref);
      showModal({ title: t('cite'), body: '<div class="preview-box" dir="auto">' + (r ? apaRef(r) : '') + '</div><label>' + E(t('pageNo')) + '</label><input id="cpg" dir="ltr" value="' + E(c.dataset.page || '') + '">',
        actions: [{ label: t('del'), run: () => { c.remove(); markDirty(); renderCitations(); } }, { label: t('ok'), cls: 'btn', run: (m) => { c.dataset.page = $('#cpg', m).value.trim(); markDirty(); renderCitations(); } }] });
      return;
    }
    const row = e.target.closest('.toc-row');
    if (row) { const h = headings()[+row.dataset.i]; if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('#fnZone').addEventListener('click', (e) => { const it = e.target.closest('.fn-item'); if (it) openFootnoteDialog(it.dataset.fn); });
}
