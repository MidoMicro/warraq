/* ===== refstyles: أنماط IEEE وHarvard وChicago (المؤلف والتاريخ) وMLA 9، واستيراد/تصدير BibTeX وRIS، وجلب المرجع بـ DOI ===== */
const STYLES = ['notes', 'apa', 'vancouver', 'ieee', 'harvard', 'chicago', 'mla'];
const NUMERIC_STYLES = ['vancouver', 'ieee'];
const ST_T = {
  en: { vol: 'vol.', no: 'no.', pp: 'pp.', p: 'p.', phd: 'PhD dissertation', ms: "Master's thesis", online: 'Available at:', acc: 'Accessed', ieeeOnline: '[Online]. Available:', edn: 'edn.', and: 'and' },
  ar: { vol: 'مج', no: 'ع', pp: 'ص', p: 'ص', phd: 'رسالة دكتوراه', ms: 'رسالة ماجستير', online: 'متاح على:', acc: 'تاريخ الاطلاع', ieeeOnline: 'متاح على:', edn: 'ط', and: 'و' },
  fr: { vol: 'vol.', no: 'n°', pp: 'p.', p: 'p.', phd: 'Thèse de doctorat', ms: 'Mémoire de master', online: 'Disponible sur :', acc: 'Consulté le', ieeeOnline: '[En ligne]. Disponible :', edn: 'éd.', and: 'et' }
};
const doiLink = (r) => r.doi ? ' <span dir="ltr">https://doi.org/' + E(r.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')) + '</span>' : '';
const urlLink = (u) => '<span dir="ltr">' + E(u) + '</span>';
const natName = (x, L) => x.given ? x.given + ' ' + x.family : x.family;
const invName = (x, L) => x.given ? x.family + (L === 'ar' ? '، ' : ', ') + x.given : x.family;
function joinAnd(arr, L, oxford) {
  if (arr.length <= 1) return arr.join('');
  if (L === 'ar') return arr.slice(0, -1).join('، ') + ' و' + arr[arr.length - 1];
  return arr.slice(0, -1).join(', ') + (oxford && arr.length > 2 ? ',' : '') + ' ' + ST_T[L].and + ' ' + arr[arr.length - 1];
}
const addDot = (s) => /[.؟!]$/.test(s) ? s + ' ' : s + '. ';
const edn = (r, L, word) => { const e = editionStr(r, L); return e && word ? e.replace(/ ed\.$/, ' ' + word) : e; };

/* ---- IEEE ---- */
function ieeeRef(r) {
  const L = refLang(r), S = ST_T[L], c = TERMS[L].c, a = parseAuthors(r);
  const names = a.map((x) => L === 'ar' ? natName(x, L) : (x.given ? initials(x.given) + ' ' + x.family : x.family));
  const au = a.length > 6 ? E(names[0]) + ' ' + TERMS[L].etal : E(joinAnd(names, L, true));
  const head = au ? au + c : '';
  const q = (s) => L === 'ar' ? '"' + E(s) + '"' : '"' + E(s) + ',"';
  switch (r.type) {
    case 'article': return head + q(r.title) + ' ' + em(r.journal, L) + (r.volume ? c + S.vol + ' ' + N(r.volume, L) : '') + (r.issue ? c + S.no + ' ' + N(r.issue, L) : '') + (r.pages ? c + S.pp + ' ' + N(r.pages, L) : '') + c + yearOf(r, L) + '.' + doiLink(r);
    case 'thesis': return head + q(r.title) + ' ' + (r.degree === 'phd' ? S.phd : S.ms) + c + E(r.university) + c + yearOf(r, L) + '.';
    case 'web': return head + q(r.title) + ' ' + (r.publisher ? E(r.publisher) + '. ' : '') + S.ieeeOnline + ' ' + urlLink(r.url) + (r.accessed ? ' (' + S.acc.toLowerCase() + ' ' + N(r.accessed, L) + ').' : '');
    default: return head + addDot(ttl(r, L) + (r.edition ? c + edn(r, L) : '')) + (r.place ? E(r.place) + ': ' : '') + (r.publisher ? E(r.publisher) + c : '') + yearOf(r, L) + '.' + doiLink(r);
  }
}
/* ---- Harvard (Cite Them Right) ---- */
function harvardRef(r) {
  const L = refLang(r), S = ST_T[L], c = TERMS[L].c, a = parseAuthors(r);
  const names = a.map((x) => L === 'ar' ? invName(x, L) : (x.given ? x.family + ', ' + initials(x.given) : x.family));
  const au = (a.length ? E(joinAnd(names, L)) : ttl(r, L)) + ' (' + yearOf(r, L) + ') ';
  const t0 = a.length ? ttl(r, L) + '. ' : '';
  switch (r.type) {
    case 'article': return au + "'" + E(r.title) + "'" + c + em(r.journal, L) + (r.volume ? c + N(r.volume, L) : '') + (r.issue ? '(' + N(r.issue, L) + ')' : '') + (r.pages ? c + S.pp + ' ' + N(r.pages, L) : '') + '.' + doiLink(r);
    case 'thesis': return au + t0 + (r.degree === 'phd' ? S.phd : S.ms) + '. ' + E(r.university) + '.';
    case 'web': return au + t0 + S.online + ' ' + urlLink(r.url) + (r.accessed ? ' (' + S.acc + ': ' + N(r.accessed, L) + ')' : '') + '.';
    default: return au + t0 + (r.edition ? addDot(edn(r, L, L === 'en' ? 'edn.' : '')) : '') + (r.place ? E(r.place) + ': ' : '') + E(r.publisher) + (r.publisher ? '.' : '') + doiLink(r);
  }
}
/* ---- Chicago 17 (المؤلف والتاريخ) ---- */
function chicagoNames(a, L) {
  if (!a.length) return '';
  const ns = a.slice(0, 10).map((x, i) => i === 0 ? invName(x, L) : natName(x, L));
  if (a.length === 2 && L !== 'ar') return E(ns[0]) + ', ' + ST_T[L].and + ' ' + E(ns[1]); // «Smith, Anna, and Brian Lee»
  return a.length > 10 ? E(ns.slice(0, 7).join(L === 'ar' ? '، ' : ', ')) + ' ' + TERMS[L].etal : E(joinAnd(ns, L, true));
}
function chicagoRef(r) {
  const L = refLang(r), S = ST_T[L], a = parseAuthors(r);
  const au = (a.length ? chicagoNames(a, L) + '. ' : '') + yearOf(r, L) + '. ';
  const q = '"' + E(r.title) + '." ';
  switch (r.type) {
    case 'article': return au + q + em(r.journal, L) + (r.volume ? ' ' + N(r.volume, L) : '') + (r.issue ? ' (' + N(r.issue, L) + ')' : '') + (r.pages ? ': ' + N(r.pages, L) : '') + '.' + doiLink(r);
    case 'thesis': return au + q + (r.degree === 'phd' ? S.phd : S.ms) + (L === 'ar' ? '، ' : ', ') + E(r.university) + '.';
    case 'web': return au + q + (r.publisher ? E(r.publisher) + '. ' : '') + (r.accessed ? S.acc + ' ' + N(r.accessed, L) + '. ' : '') + urlLink(r.url) + '.';
    default: return au + ttl(r, L) + '. ' + (r.editor ? addDot(editorStr(r, L)) : '') + (r.edition ? addDot(edn(r, L)) : '') + (r.place ? E(r.place) + ': ' : '') + E(r.publisher) + (r.publisher ? '.' : '') + doiLink(r);
  }
}
/* ---- MLA 9 ---- */
function mlaNames(a, L) {
  if (!a.length) return '';
  if (a.length === 1) return E(invName(a[0], L));
  if (a.length === 2) return E(invName(a[0], L)) + (L === 'ar' ? '، و' : ', and ') + E(natName(a[1], L));
  return E(invName(a[0], L)) + (L === 'ar' ? '، ' : ', ') + TERMS[L].etal;
}
function mlaRef(r) {
  const L = refLang(r), S = ST_T[L], c = TERMS[L].c, a = parseAuthors(r);
  const au = a.length ? mlaNames(a, L) + '. ' : '';
  const q = '"' + E(r.title) + '." ';
  switch (r.type) {
    case 'article': return au + q + em(r.journal, L) + (r.volume ? c + S.vol + ' ' + N(r.volume, L) : '') + (r.issue ? c + S.no + ' ' + N(r.issue, L) : '') + c + yearOf(r, L) + (r.pages ? c + S.pp + ' ' + N(r.pages, L) : '') + '.' + doiLink(r);
    case 'thesis': return au + ttl(r, L) + '. ' + yearOf(r, L) + '. ' + E(r.university) + c + (r.degree === 'phd' ? S.phd : S.ms) + '.';
    case 'web': return au + q + (r.publisher ? em(r.publisher, L) + c : '') + (r.year ? yearOf(r, L) + c : '') + urlLink(r.url) + '.' + (r.accessed ? ' ' + S.acc + ' ' + N(r.accessed, L) + '.' : '');
    default: return au + ttl(r, L) + '. ' + (r.editor ? editorStr(r, L) + c : '') + (r.edition ? edn(r, L) + c : '') + (r.publisher ? E(r.publisher) + c : '') + yearOf(r, L) + '.' + doiLink(r);
  }
}
/* ---- الاستشهاد داخل النص ---- */
function shortAuthors(r, L, max, oxford) {
  const a = parseAuthors(r);
  if (!a.length) return ttl(r, L);
  if (a.length > max) return E(a[0].family) + ' ' + TERMS[L].etal;
  return E(joinAnd(a.map((x) => x.family), L, oxford));
}
function inTextFor(style, r, page, vol, num) {
  const L = refLang(r), T = TERMS[L], S = ST_T[L], ps = page ? N(page, L) : '', vs = vol ? N(vol, L) : '';
  const loc = (pfx) => (vs ? T.vol + ' ' + vs + (ps ? ':' : '') : '') + (ps ? (vs ? '' : pfx) + ps : '');
  switch (style) {
    case 'vancouver': return '[' + N(num, WQ.doc.settings.lang) + ']';
    case 'ieee': return '[' + N(num, WQ.doc.settings.lang) + (ps || vs ? T.c + loc(S.p + ' ') : '') + ']';
    case 'harvard': return '(' + shortAuthors(r, L, 3) + T.c + yearOf(r, L) + (ps || vs ? T.c + loc(S.p + ' ') : '') + ')';
    case 'chicago': return '(' + shortAuthors(r, L, 3, true) + ' ' + yearOf(r, L) + (ps || vs ? T.c + loc('') : '') + ')';
    case 'mla': return '(' + shortAuthors(r, L, 2) + (ps || vs ? ' ' + loc('') : '') + ')';
    default: return apaInText(r, page, vol);
  }
}
function refEntry(style, r, num) {
  switch (style) {
    case 'vancouver': return N(num, WQ.doc.settings.lang) + '. ' + vanRef(r);
    case 'ieee': return '[' + N(num, WQ.doc.settings.lang) + '] ' + ieeeRef(r);
    case 'harvard': return harvardRef(r);
    case 'chicago': return chicagoRef(r);
    case 'mla': return mlaRef(r);
    default: return apaRef(r);
  }
}
const STYLE_NAMES = { apa: 'APA 7', vancouver: 'Vancouver', ieee: 'IEEE', harvard: 'Harvard', chicago: 'Chicago (author-date)', mla: 'MLA 9' };

/* ======================= BibTeX / RIS ======================= */
const TEX_ACC = { "'": { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' }, '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' }, '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' }, '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' }, '~': { n: 'ñ', a: 'ã', o: 'õ', N: 'Ñ' }, c: { c: 'ç', C: 'Ç' } };
function texClean(s) {
  return String(s)
    .replace(/\\([`'"^~]|c\s)\{?\\?([A-Za-z])\}?/g, (m, a, ch) => ((TEX_ACC[a.trim()] || {})[ch]) || ch)
    .replace(/\\&/g, '&').replace(/\\%/g, '%').replace(/\\_/g, '_').replace(/\\ss\b/g, 'ß').replace(/---/g, '—').replace(/--/g, '–')
    .replace(/\\[a-zA-Z]+\s*/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}
/* اسم المؤلف ← «العائلة، الاسم» كما يفهمه ورّاق */
function personToWQ(n) {
  n = texClean(n);
  if (!n) return '';
  if (n.includes(',')) { const [f, ...g] = n.split(','); return f.trim() + ', ' + g.join(' ').trim(); }
  const parts = n.split(' ');
  if (parts.length === 1) return n;
  return parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
}
function parseBibTeX(src) {
  const out = []; const re = /@(\w+)\s*\{\s*([^,]*),/g; let m;
  while ((m = re.exec(src))) {
    const type = m[1].toLowerCase(); if (/^(comment|string|preamble)$/.test(type)) continue;
    // نقرأ حتى القوس المُغلِق المناظر
    let i = re.lastIndex, depth = 1, body = '';
    for (; i < src.length && depth > 0; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') depth--; if (depth > 0) body += ch; }
    re.lastIndex = i;
    const f = {}; let k = 0;
    while (k < body.length) {
      const fm = /\s*([A-Za-z][\w-]*)\s*=\s*/y; fm.lastIndex = k; const mm = fm.exec(body); if (!mm) break;
      k = fm.lastIndex; let val = '';
      if (body[k] === '{') { let d = 0; const st = k; for (; k < body.length; k++) { if (body[k] === '{') d++; else if (body[k] === '}') { d--; if (d === 0) { k++; break; } } } val = body.slice(st + 1, k - 1); }
      else if (body[k] === '"') { k++; for (; k < body.length && body[k] !== '"'; k++) val += body[k]; k++; }
      else { while (k < body.length && body[k] !== ',') val += body[k++]; }
      f[mm[1].toLowerCase()] = val.trim();
      while (k < body.length && /[\s,]/.test(body[k])) k++;
    }
    const tp = type === 'article' ? 'article' : (/thesis/.test(type) ? 'thesis' : ((type === 'misc' || type === 'online' || type === 'electronic' || type === 'webpage') && (f.url || f.howpublished) ? 'web' : 'book'));
    out.push({
      type: tp, authors: (f.author || '').split(/\s+and\s+/i).map(personToWQ).filter(Boolean).join('\n'), title: texClean(f.title || f.booktitle || ''),
      year: texClean(f.year || (f.date || '').slice(0, 4)), publisher: texClean(f.publisher || f.organization || ''), place: texClean(f.address || f.location || ''),
      journal: texClean(f.journal || f.journaltitle || ''), volume: texClean(f.volume || ''), issue: texClean(f.number || f.issue || ''), pages: texClean(f.pages || ''),
      university: texClean(f.school || f.institution || ''), degree: type === 'phdthesis' ? 'phd' : 'master', url: texClean(f.url || (f.howpublished || '').replace(/^\\url\{?|\}$/g, '')),
      accessed: texClean(f.urldate || ''), editor: (f.editor || '').split(/\s+and\s+/i).map((x) => texClean(x)).filter(Boolean).join('، '), edition: texClean(f.edition || ''), doi: texClean(f.doi || '')
    });
  }
  return out;
}
function parseRIS(src) {
  const out = []; let cur = null;
  src.split(/\r?\n/).forEach((line) => {
    const m = /^([A-Z][A-Z0-9])  - ?(.*)$/.exec(line); if (!m) return;
    const [, tag, v0] = m, v = v0.trim();
    if (tag === 'TY') { cur = { ty: v, au: [], ed: [] }; return; }
    if (!cur) return;
    if (tag === 'ER') { out.push(cur); cur = null; return; }
    const set = (k) => { if (!cur[k]) cur[k] = v; };
    if (/^(AU|A1)$/.test(tag)) cur.au.push(v); else if (/^(ED|A2)$/.test(tag) && cur.ty !== 'JOUR') cur.ed.push(v);
    else if (/^(TI|T1)$/.test(tag)) set('ti'); else if (/^(PY|Y1|DA)$/.test(tag)) { if (!cur.py) cur.py = (v.match(/\d{4}/) || [''])[0]; }
    else if (/^(JO|JF|T2|JA)$/.test(tag)) set('jo'); else if (tag === 'VL') set('vl'); else if (tag === 'IS') set('is');
    else if (tag === 'SP') set('sp'); else if (tag === 'EP') set('ep'); else if (tag === 'PB') set('pb'); else if (tag === 'CY') set('cy');
    else if (tag === 'UR') set('ur'); else if (tag === 'DO') set('do'); else if (tag === 'ET') set('et'); else if (tag === 'Y2') set('y2');
  });
  return out.map((x) => {
    const tp = /^(JOUR|JFULL|MGZN|NEWS|EJOUR)$/.test(x.ty) ? 'article' : (x.ty === 'THES' ? 'thesis' : (/^(ELEC|WEB|BLOG)$/.test(x.ty) ? 'web' : 'book'));
    return { type: tp, authors: x.au.map((a) => a.includes(',') ? a : personToWQ(a)).join('\n'), title: x.ti || '', year: x.py || '', publisher: x.pb || '', place: x.cy || '',
      journal: x.jo || '', volume: x.vl || '', issue: x.is || '', pages: x.sp ? x.sp + (x.ep ? '–' + x.ep : '') : '', university: tp === 'thesis' ? (x.pb || '') : '', degree: 'master',
      url: x.ur || '', accessed: x.y2 || '', editor: x.ed.join('، '), edition: x.et || '', doi: x.do || '' };
  });
}
function parseRefsText(txt) {
  const s = String(txt || '');
  if (/^\s*TY  -/m.test(s)) return parseRIS(s);
  if (/@\w+\s*\{/.test(s)) return parseBibTeX(s);
  return [];
}
const refKey = (r) => (normAr(String(r.title || '')).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + '|' + String(r.year || '').trim());
function importRefs(list) {
  const have = new Set((WQ.doc.references || []).map(refKey));
  let added = 0, dup = 0;
  list.forEach((x) => {
    if (!x.title) return;
    const r = cleanRef(Object.assign({ id: uid('r') }, x));
    if (have.has(refKey(r))) { dup++; return; }
    have.add(refKey(r)); WQ.doc.references.push(r); added++;
  });
  if (added) { markDirty(); renderCitations(); }
  return { added, dup };
}
/* تصدير مراجع المستند BibTeX */
function toBibTeX(refs) {
  const esc = (s) => String(s || '').replace(/[{}]/g, '');
  const used = new Set();
  return refs.map((r) => {
    const a = parseAuthors(r);
    let key = ((a[0] && a[0].family) || 'ref').replace(/[^A-Za-z0-9]/g, '') + (r.year || '').replace(/\D/g, '') || 'ref';
    if (!/^[A-Za-z]/.test(key)) key = 'ref' + key;
    let k2 = key, n = 1; while (used.has(k2)) k2 = key + String.fromCharCode(96 + (++n)); used.add(k2);
    const tp = r.type === 'article' ? 'article' : (r.type === 'thesis' ? (r.degree === 'phd' ? 'phdthesis' : 'mastersthesis') : (r.type === 'web' ? 'misc' : 'book'));
    const f = [['author', a.map((x) => x.given ? x.family + ', ' + x.given : x.family).join(' and ')], ['title', r.title], ['year', r.year], ['journal', r.journal], ['volume', r.volume], ['number', r.issue],
      ['pages', (r.pages || '').replace(/[–-]/, '--')], ['publisher', r.publisher], ['address', r.place], ['school', r.university], ['edition', r.edition], ['editor', r.editor], ['url', r.url], ['urldate', r.accessed], ['doi', r.doi]];
    return '@' + tp + '{' + k2 + ',\n' + f.filter(([, v]) => v).map(([k, v]) => '  ' + k + ' = {' + esc(v) + '}').join(',\n') + '\n}';
  }).join('\n\n') + '\n';
}
function openRefImportDialog() {
  showModal({ title: t('refImport'), wide: true,
    body: '<p class="wq-note" style="font-size:12px;line-height:1.8">' + E(t('refImportHelp')) + '</p>' +
      '<div class="chips"><button class="btn2" id="riFile" type="button">' + E(t('refImportFile')) + '</button><input type="file" id="riPick" accept=".bib,.ris,.txt,.bibtex" hidden></div>' +
      '<textarea id="riText" dir="ltr" rows="8" placeholder="@article{...}  /  TY  - JOUR ..."></textarea><p class="wq-note" id="riInfo"></p>',
    actions: [{ label: t('cancel') }, { label: t('refImportDo'), cls: 'btn', run: (m) => {
      const list = parseRefsText($('#riText', m).value);
      if (!list.length) { $('#riInfo', m).textContent = t('refImportNone'); return false; }
      const res = importRefs(list);
      toast(t('refImportDone').replace('{n}', fmtNum(res.added)).replace('{d}', fmtNum(res.dup)));
    } }],
    onOpen: (m) => {
      const ta = $('#riText', m), info = $('#riInfo', m);
      const upd = () => { const n = parseRefsText(ta.value).length; info.textContent = n ? t('refImportFound').replace('{n}', fmtNum(n)) : ''; };
      ta.oninput = upd;
      $('#riFile', m).onclick = () => $('#riPick', m).click();
      $('#riPick', m).onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((s) => { ta.value = s; upd(); }); };
    } });
}
async function exportBibTeX() {
  const refs = WQ.doc.references || [];
  if (!refs.length) { toast(t('noRefs')); return; }
  const blob = new Blob([toBibTeX(refs)], { type: 'application/x-bibtex' });
  if (await saveBlob(safeFileName() + ' - references', 'bib', blob)) toast(t('refExported'));
  return blob;
}
/* ======================= جلب المرجع بالـ DOI (Crossref، أونلاين وبضغطة المستخدم فقط) ======================= */
function cleanDOI(s) { const m = String(s || '').trim().match(/10\.\d{4,9}\/\S+/); return m ? m[0].replace(/[.,;]+$/, '') : ''; }
function crossrefToRef(msg, doi) {
  const tp = /journal-article|proceedings-article|posted-content/.test(msg.type) ? 'article' : (/dissertation/.test(msg.type) ? 'thesis' : 'book');
  const dp = ((msg.issued || msg.published || msg['published-print'] || {})['date-parts'] || [[]])[0];
  return { type: tp, authors: (msg.author || []).map((a) => a.family ? a.family + (a.given ? ', ' + a.given : '') : (a.name || '')).filter(Boolean).join('\n'),
    title: ((msg.title || [])[0] || '').replace(/<[^>]+>/g, ''), year: dp[0] ? String(dp[0]) : '', journal: (msg['container-title'] || [])[0] || '', volume: msg.volume || '', issue: msg.issue || '',
    pages: (msg.page || '').replace('-', '–'), publisher: msg.publisher || '', place: msg['publisher-location'] || '', university: tp === 'thesis' ? (msg.institution && msg.institution[0] && msg.institution[0].name) || msg.publisher || '' : '',
    url: '', edition: msg['edition-number'] || '', doi };
}
async function fetchDOI(doi) {
  const d = cleanDOI(doi); if (!d) throw new Error('doi');
  const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(d), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json();
  return crossrefToRef(j.message || {}, d);
}
