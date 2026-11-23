/* ===== hadith: مكتبة الأحاديث (الكتب السبعة ومسند أحمد والدارمي) — الإدراج والتخريج والتحقق =====
   القاعدة الثابتة: ورّاق لا يحكم على حديث أبداً؛ يعرض أحكام العلماء منسوبة لأصحابها كما في المصدر. */
let HD_INDEX = null, _hdIdxLoading = null;
const HD_BOOK = {}, _hdBookLoading = {};

async function loadHadithIndex() {
  if (HD_INDEX) return HD_INDEX;
  if (!_hdIdxLoading) _hdIdxLoading = fetch('hadith/index.json').then((r) => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then((x) => { HD_INDEX = x; return x; }).catch((e) => { _hdIdxLoading = null; throw e; });
  return _hdIdxLoading;
}
async function loadHadithBook(id) {
  if (HD_BOOK[id]) return HD_BOOK[id];
  await loadHadithIndex();
  const meta = HD_INDEX.books.find((b) => b.id === id); if (!meta) throw new Error('book');
  if (!_hdBookLoading[id]) _hdBookLoading[id] = fetch('hadith/' + id + '.json').then((r) => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then((d) => {
      const map = new Map(); d.h.forEach((x, i) => map.set(x[0], i));
      HD_BOOK[id] = { meta, g: d.g, h: d.h, map, norm: null };
      return HD_BOOK[id];
    }).catch((e) => { delete _hdBookLoading[id]; throw e; });
  return _hdBookLoading[id];
}
async function loadAllHadith(onStep) {
  await loadHadithIndex();
  for (const b of HD_INDEX.books) { await loadHadithBook(b.id); if (onStep) onStep(b); }
}
/* تطبيع للبحث والمقارنة فقط (النص المُدرج يبقى الأصل حرفياً) */
const HD_PUNCT = /[،؛؟۔.,:;!?"'«»“”„()[\]{}\-–—_*/\\|<>]/g;
function hdNorm(s) { return normAr(String(s).replace(HD_PUNCT, ' ')); }
function hdNormBook(B) { if (!B.norm) B.norm = B.h.map((x) => ' ' + hdNorm(x[1]) + ' '); return B.norm; }
const hdNum = (key) => String(key).split('.')[0];
/* لغة التخريج والأحكام: عربي افتراضياً مع الواجهة العربية (الحديث عربي)، ويختار المستخدم English من النافذة */
function hdDefLang() { return WQ.ui === 'ar' || WQ.doc.settings.lang === 'ar' ? 'ar' : 'en'; }
function hdDigits(s, lang) { return (lang || hdDefLang()) === 'ar' ? toArabicDigits(String(s)) : String(s); }
function hdGet(bk, key) { const B = HD_BOOK[bk]; if (!B) return null; const i = B.map.get(String(key)); return i === undefined ? null : B.h[i]; }

/* بداية المتن (تقريبية): بعد أول «قال رسول الله ﷺ» أو «عن النبي ﷺ قال»؛ وإلا فالنص كاملاً */
// بداية المتن: «قال رسول الله ﷺ: …» أو «رسول الله ﷺ قال/يقول: …» (الفعل بلا فاء؛ «سأل رسول الله ﷺ فقال» ليست بداية المتن)
const HD_MATN_RE = /(?:(?<![\u0621-\u064A])قال\s+(?:رسول\s+الله|النبي)\s+[-–(]?\s*(?:ﷺ|صلى\s+الله\s+عليه\s+و\s*سلم)\s*[-–)]?\s*[:،,]?\s*)|(?:(?:رسول|النبي)\s+(?:الله\s+)?[-–(]?\s*(?:ﷺ|صلى\s+الله\s+عليه\s+و\s*سلم)\s*[-–)]?\s*[،,]?\s*(?:أنه\s+)?(?:قال|يقول)\s*[:،,]?\s*)/;
function hdMatnStart(text) {
  // نبحث في نص بلا تشكيل (ترتيب علامات التشكيل يختلف بين المصادر) ثم نعيد الموضع إلى النص الأصلي
  let bare = ''; const map = [];
  for (let i = 0; i < text.length; i++) if (!/[\u064B-\u065F\u0670\u0640]/.test(text[i])) { bare += text[i]; map.push(i); }
  map.push(text.length);
  const m = HD_MATN_RE.exec(bare);
  if (!m) return 0;
  let o = map[m.index + m[0].length];
  while (o < text.length && /[\s"«“]/.test(text[o])) o++;
  return (o > text.length * 0.85) ? 0 : o;
}
function hdSlice(text, o, e) { return text.slice(o || 0, e || text.length).trim(); }
/* ظبط علامات الترقيم في النص المُدرج (الحروف والتشكيل كما هي في المصدر):
   لا مسافة قبل ، : ؛ . ؟ !، ومسافة واحدة بعدها، وعلامة " التي ليس لها نظير تُحذف، والمسافات داخل "…" تُزال */
/* صيغ الصلاة والترضي التي يكتبها المصدر بلا تشكيل داخل نص مشكول: تُشكَّل بصيغتها الصحيحة (ولا تُلمس أي كلمة أخرى) */
const HD_HONOR = [
  [/(^|[^\u0621-\u0652])صلى الله عليه و ?سلم(?![\u0621-\u0652])/g, '$1صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ'],
  [/(^|[^\u0621-\u0652])رض[يى] الله عنهما(?![\u0621-\u0652])/g, '$1رَضِيَ اللَّهُ عَنْهُمَا'],
  [/(^|[^\u0621-\u0652])رض[يى] الله عنها(?![\u0621-\u0652])/g, '$1رَضِيَ اللَّهُ عَنْهَا'],
  [/(^|[^\u0621-\u0652])رض[يى] الله عنهم(?![\u0621-\u0652])/g, '$1رَضِيَ اللَّهُ عَنْهُمْ'],
  [/(^|[^\u0621-\u0652])رض[يى] الله عنه(?![\u0621-\u0652])/g, '$1رَضِيَ اللَّهُ عَنْهُ']
];
function hdTypo(s) {
  s = String(s);
  HD_HONOR.forEach(([re, rep]) => { s = s.replace(re, rep); });
  s = s.replace(/\s+/g, ' ').replace(/\s+([،:؛.؟!,)\]])/g, '$1').replace(/([(\[])\s+/g, '$1')
    .replace(/([،:؛؟!,])(?=[^\s"«»)\]،:؛.؟!,])/g, '$1 ');
  const q = []; for (let i = 0; i < s.length; i++) if (s[i] === '"') q.push(i);
  if (q.length % 2) { const k = q.pop(); s = s.slice(0, k) + ' ' + s.slice(k + 1); } // علامة بلا نظير
  // داخل كل زوج "…": لا مسافة بعد الفتح ولا قبل الإغلاق
  let open = true;
  s = s.replace(/\s*"\s*/g, (m) => { const r = open ? (/^\s/.test(m) ? ' "' : '"') : (/\s$/.test(m) ? '" ' : '"'); open = !open; return r; });
  return s.replace(/\s+/g, ' ').replace(/\s+([،:؛.؟!,])/g, '$1').trim();
}

/* أحكام العلماء: [اسم العالم بالعربية، الحكم بالعربية (أو الأصل إن لم تتوفر ترجمة دقيقة)، الأصل الإنجليزي] */
function hdGrades(bk, item, lang) {
  const B = HD_BOOK[bk]; if (!B || !item[2]) return [];
  const ar = (lang || hdDefLang()) === 'ar';
  return item[2].map((gi) => { const g = B.g[gi]; return { who: ar ? (HD_INDEX.graders[g[0]] || g[0]) : g[0], grade: ar ? (g[1] || g[2]) : g[2], en: g[2] }; });
}
function hdBookName(bk, short, lang) {
  const b = HD_BOOK[bk] ? HD_BOOK[bk].meta : (HD_INDEX && HD_INDEX.books.find((x) => x.id === bk));
  if (!b) return bk;
  const ar = (lang || hdDefLang()) === 'ar';
  return ar ? (short ? b.short : b.name) : (short ? b.enShort : b.en);
}
function hdRefLabel(bk, key, lang) { return hdBookName(bk, true, lang) + ' (' + hdDigits(hdNum(key), lang) + ')'; }
/* نص التخريج: «أخرجه البخاري (١).» + الأحكام منسوبة: «قال الألباني: صحيح.» */
function hdTakhrij(bk, key, withGrades, lang) {
  lang = lang || hdDefLang();
  const ar = lang === 'ar';
  let s = ar ? 'أخرجه ' + hdRefLabel(bk, key, lang) + '.' : 'Narrated by ' + hdRefLabel(bk, key, lang) + '.';
  if (withGrades) {
    const it = hdGet(bk, key);
    const gs = it ? hdGrades(bk, it, lang) : [];
    if (gs.length) s += ' ' + gs.map((g) => ar ? 'قال ' + g.who + ': ' + g.grade + '.' : 'Graded “' + g.grade + '” by ' + g.who + '.').join(' ');
  }
  return s;
}
function hdText(bk, key, o, e) { const it = hdGet(bk, key); return it ? '«' + hdTypo(hdSlice(it[1], o, e)) + '»' : null; }
function hadithSpan(bk, key, o, e) {
  const it = hdGet(bk, key); if (!it) return '';
  return '<span class="wq-hadith" data-bk="' + bk + '" data-k="' + E(String(key)) + '"' + (o ? ' data-o="' + o + '"' : '') + (e ? ' data-e="' + e + '"' : '') +
    ' contenteditable="false" dir="rtl" lang="ar">' + E(hdText(bk, key, o, e)) + '</span>';
}
function hdAddFootnoteAfter(node, text) {
  const id = uid('f');
  WQ.doc.footnotes[id] = { refId: '', page: '', text };
  const sup = document.createElement('sup'); sup.className = 'wq-fn'; sup.dataset.fn = id; sup.contentEditable = 'false'; sup.textContent = '*';
  node.after(sup);
}
/* إدراج داخل الفقرة نفسها: insertHTML في Chrome يضع العنصر المحمي خارج الفقرة إذا كان المؤشر في آخرها */
function hdInsertInline(html) {
  focusPage();
  const sel = document.getSelection();
  let r = sel.rangeCount && page.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : null;
  if (!r) { const p = el('p', { dir: 'auto' }); page.append(p); r = document.createRange(); r.setStart(p, 0); }
  r.deleteContents();
  let host = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
  if (host === page) { // المؤشر بين الفقرات: نُنشئ فقرة
    const p = el('p', { dir: 'auto' }); page.insertBefore(p, page.childNodes[r.startOffset] || null);
    r = document.createRange(); r.setStart(p, 0); host = p;
  }
  const blk = host.closest(BLOCK_SEL) || host;
  if (!blk.textContent.trim() && !blk.querySelector('img,sup,.wq-ayah,.wq-hadith')) { blk.innerHTML = ''; r = document.createRange(); r.setStart(blk, 0); }
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const lastNode = tpl.content.lastChild;
  r.insertNode(tpl.content);
  if (lastNode) { const c = document.createRange(); c.setStartAfter(lastNode); c.collapse(true); sel.removeAllRanges(); sel.addRange(c); }
  onInput();
}
function insertHadith(bk, key, opt) {
  const o = opt.o !== undefined && opt.o !== null ? opt.o : (opt.matn ? hdMatnStart(hdGet(bk, key)[1]) : 0);
  let html = hadithSpan(bk, key, o, 0);
  if (opt.where === 'text') html += ' [' + E(hdTakhrij(bk, key, false, opt.lang).replace(/\.$/, '')) + ']';
  hdInsertInline(html + '&nbsp;');
  const last = $$('.wq-hadith', page).filter((x) => x.dataset.bk === bk && x.dataset.k === String(key)).pop();
  let tail = last;
  if (opt.where === 'note' && last) { hdAddFootnoteAfter(last, hdTakhrij(bk, key, opt.grades, opt.lang)); tail = last.nextSibling; }
  // المؤشر بعد رقم الحاشية والمسافة، فأي كتابة أو Enter تأتي بعد الحديث وحاشيته معاً
  if (tail) {
    let after = tail.nextSibling;
    if (!after || after.nodeType !== 3) { after = document.createTextNode('\u00A0'); tail.after(after); }
    const r = document.createRange(); r.setStart(after, after.textContent.length); r.collapse(true);
    const sl = document.getSelection(); sl.removeAllRanges(); sl.addRange(r);
  }
  normalizeBlocks(); markDirty(); renderCitations();
}
/* البحث في الدرر السنية: يفتح موقع الدرر في المتصفح (أونلاين)، ولا يُخزّن ورّاق شيئاً */
function dorarUrl(text) {
  const w = hdNorm(text).split(' ').filter(Boolean).slice(0, 12).join(' ');
  return 'https://dorar.net/hadith/search?q=' + encodeURIComponent(w);
}
/* الترجمة الإنجليزية: تفتح الحديث نفسه على sunnah.com في المتصفح (أونلاين، لا يُخزّن شيء) */
const SUNNAH_DIRECT = { bukhari: 1, muslim: 1, abudawud: 1, tirmidhi: 1, nasai: 1, ibnmajah: 1 };
function sunnahUrl(bk, key, text) {
  if (SUNNAH_DIRECT[bk]) {
    const [n, sub] = String(key).split('.');
    const letter = bk === 'muslim' && sub && +sub > 0 ? String.fromCharCode(96 + Math.min(26, +sub)) : '';
    return 'https://sunnah.com/' + bk + ':' + n + letter;
  }
  return 'https://sunnah.com/search?q=' + encodeURIComponent(hdNorm(text).split(' ').filter(Boolean).slice(0, 8).join(' '));
}
function hdCredits() {
  return '<p class="wq-note" style="line-height:1.8">' + E(t('hdCredit')) +
    ' <a href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noopener">hadith-api</a> · <a href="https://github.com/mhashim6/Open-Hadith-Data" target="_blank" rel="noopener">Open-Hadith-Data</a></p>';
}
function hdGradesHtml(bk, item) {
  const gs = hdGrades(bk, item);
  if (!gs.length) return '<p class="wq-note">' + E(t(bk === 'bukhari' || bk === 'muslim' ? 'hdSahihayn' : 'hdNoGrades')) + '</p>';
  return '<ul class="hd-grades">' + gs.map((g) => '<li><b>' + E(g.who) + ':</b> ' + E(g.grade) + (g.grade !== g.en ? ' <span class="wq-note" dir="ltr">(' + E(g.en) + ')</span>' : '') + '</li>').join('') + '</ul>' +
    '<p class="wq-note">' + E(t('hdGradesNote')) + '</p>';
}

/* البحث: كل كلمات الاستعلام (بعد التطبيع) لازم تظهر في الحديث */
function searchHadith(ids, q, max = 40) {
  const words = hdNorm(q).split(' ').filter((w) => w.length > 1);
  if (!words.length) return [];
  const out = [];
  for (const id of ids) {
    const B = HD_BOOK[id]; if (!B) continue;
    const N = hdNormBook(B);
    for (let i = 0; i < N.length && out.length < max; i++) if (words.every((w) => N[i].includes(w))) out.push([id, B.h[i][0]]);
    if (out.length >= max) break;
  }
  return out;
}

async function openHadithDialog() {
  saveRange();
  showModal({ title: t('insertHadith'), body: '<p class="soon">' + E(t('hdLoading')) + '</p>', wide: true, actions: [{ label: t('cancel') }] });
  try { await loadHadithIndex(); await loadHadithBook('bukhari'); } catch (e) {
    const b = $('.modal .body'); if (b) b.innerHTML = '<p class="soon">' + E(t('hdUnavailable')) + '</p>';
    return;
  }
  $('#modalRoot').innerHTML = '';
  const ar = WQ.ui === 'ar';
  const opts = '<option value="*">' + E(t('hdAllBooks')) + '</option>' + HD_INDEX.books.map((b) => '<option value="' + b.id + '"' + (b.id === 'bukhari' ? ' selected' : '') + '>' + E(ar ? b.name : b.en) + ' (' + fmtNum(b.count) + ')</option>').join('');
  const body =
    '<div class="row" style="grid-template-columns:2fr 1fr"><div><label>' + E(t('hdBook')) + '</label><select id="hBook">' + opts + '</select></div>' +
    '<div><label>' + E(t('hdNumber')) + '</label><input id="hNum" inputmode="numeric" placeholder="١"></div></div>' +
    '<p class="wq-note" id="hNumbering"></p>' +
    '<label>' + E(t('hdSearch')) + '</label><input id="hSearch" dir="rtl" placeholder="' + E(t('hdSearchPh')) + '">' +
    '<div id="hResults" class="q-results"></div>' +
    '<label>' + E(t('preview')) + '</label><div class="preview-box hd-prev" id="hPrev" dir="rtl"><p class="wq-note">' + E(t('hdPick')) + '</p></div>' +
    '<div id="hGrades"></div>' +
    '<div class="chips"><button class="chip on" data-p="matn">' + E(t('hdMatn')) + '</button><button class="chip" data-p="full">' + E(t('hdFull')) + '</button>' +
    '<span style="width:12px"></span><button class="chip on" data-w="note">' + E(t('refInNote')) + '</button><button class="chip" data-w="text">' + E(t('refInText')) + '</button>' +
    '<label style="display:flex;gap:6px;align-items:center;margin:0 8px"><input id="hWithG" type="checkbox" checked style="width:auto;margin:0">' + E(t('hdWithGrades')) + '</label>' +
    '<a class="chip" id="hDorar" target="_blank" rel="noopener" href="https://dorar.net/hadith">' + E(t('hdDorar')) + '</a>' +
    '<a class="chip" id="hSunnah" target="_blank" rel="noopener" href="https://sunnah.com">' + E(t('hdSunnah')) + '</a></div>' +
    '<div class="chips"><span class="wq-note" style="align-self:center">' + E(t('hdTkLang')) + ':</span><button class="chip' + (hdDefLang() === 'ar' ? ' on' : '') + '" data-l="ar">عربي</button><button class="chip' + (hdDefLang() === 'en' ? ' on' : '') + '" data-l="en">English</button></div>' +
    '<p class="wq-note">' + E(t('hdDorarNote')) + '</p>' + hdCredits();
  let sel = null, part = 'matn', where = 'note', tkLang = hdDefLang(), customO = null;
  showModal({ title: t('insertHadith'), body, wide: true,
    actions: [{ label: t('cancel') }, { label: t('insert'), cls: 'btn', run: (m) => {
      if (!sel) { toast(t('hdPick')); return false; }
      restoreRange(); insertHadith(sel.bk, sel.key, { matn: part === 'matn', o: part === 'matn' ? customO : 0, where, grades: $('#hWithG', m).checked, lang: tkLang });
    } }],
    onOpen: (m) => {
      const Bk = $('#hBook', m), Nm = $('#hNum', m), Sr = $('#hSearch', m), box = $('#hResults', m);
      const showNumbering = () => {
        const b = HD_INDEX.books.find((x) => x.id === Bk.value);
        $('#hNumbering', m).textContent = b ? t('hdNumbering') + ': ' + b.numbering : '';
        Nm.disabled = !b;
      };
      const upd = () => {
        const prev = $('#hPrev', m), gr = $('#hGrades', m);
        if (!sel) { prev.innerHTML = '<p class="wq-note">' + E(t('hdPick')) + '</p>'; gr.innerHTML = ''; return; }
        const it = hdGet(sel.bk, sel.key);
        const o = part === 'matn' ? (customO !== null ? customO : hdMatnStart(it[1])) : 0;
        // النص كله كلمات قابلة للضغط: الضغط على كلمة يجعلها بداية المتن، وما قبلها باهت
        let words = '', mm; const re = /\S+/g;
        while ((mm = re.exec(it[1]))) words += '<span class="hw' + (mm.index < o ? ' dim' : '') + '" data-o="' + mm.index + '">' + E(mm[0]) + '</span> ';
        prev.innerHTML = '<b>' + E(hdRefLabel(sel.bk, sel.key)) + '</b> <span class="wq-note">' + E(t('hdPickStart')) + '</span><br><span class="wq-hadith">' + words + '</span>' +
          (part === 'matn' && !o ? '<p class="wq-note">' + E(t('hdNoMatn')) + '</p>' : '');
        $$('.hw', prev).forEach((w) => w.onclick = () => { customO = +w.dataset.o; part = 'matn'; $$('.chip[data-p]', m).forEach((x) => x.classList.toggle('on', x.dataset.p === 'matn')); upd(); });
        gr.innerHTML = '<label>' + E(t('hdGrades')) + '</label>' + hdGradesHtml(sel.bk, it);
        $('#hDorar', m).href = dorarUrl(hdSlice(it[1], hdMatnStart(it[1])));
        $('#hSunnah', m).href = sunnahUrl(sel.bk, sel.key, hdSlice(it[1], hdMatnStart(it[1])));
      };
      const pick = (bk, key) => { sel = { bk, key }; customO = null; $$('.q-hit', box).forEach((h) => h.classList.toggle('on', h.dataset.bk === bk && h.dataset.k === key)); upd(); };
      const ensure = async (ids) => {
        for (const id of ids) if (!HD_BOOK[id]) { box.innerHTML = '<p class="wq-note">' + E(t('hdLoading')) + ' ' + E(hdBookName(id)) + '</p>'; await loadHadithBook(id); }
      };
      const listHits = (res) => {
        if (!res.length) { box.innerHTML = '<p class="wq-note">' + E(t('noResults')) + '</p>'; return; }
        box.innerHTML = res.map(([bk, key]) => '<button class="q-hit" data-bk="' + bk + '" data-k="' + E(key) + '"><b>' + E(hdRefLabel(bk, key)) + '</b> ' + E(hdTypo(hdSlice(hdGet(bk, key)[1], hdMatnStart(hdGet(bk, key)[1]))).slice(0, 110)) + '</button>').join('');
        $$('.q-hit', box).forEach((h) => h.onclick = () => pick(h.dataset.bk, h.dataset.k));
      };
      Bk.onchange = async () => { showNumbering(); if (Bk.value !== '*') { await ensure([Bk.value]); box.innerHTML = ''; } if (Sr.value.trim()) Sr.oninput(); else if (Nm.value.trim()) Nm.oninput(); };
      Nm.oninput = async () => {
        const v = Nm.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
        if (!/^\d+$/.test(v) || Bk.value === '*') return;
        await ensure([Bk.value]);
        const B = HD_BOOK[Bk.value];
        // صحيح مسلم والبخاري: الرقم الواحد قد يضم أكثر من رواية (١١.٠١، ١١.٠٢ …)
        const res = B.h.filter((x) => hdNum(x[0]) === v).slice(0, 40).map((x) => [Bk.value, x[0]]);
        listHits(res);
        if (res.length) pick(res[0][0], res[0][1]);
      };
      let tmr;
      Sr.oninput = () => {
        clearTimeout(tmr); tmr = setTimeout(async () => {
          if (!Sr.value.trim()) { box.innerHTML = ''; return; }
          const ids = Bk.value === '*' ? HD_INDEX.books.map((b) => b.id) : [Bk.value];
          await ensure(ids);
          listHits(searchHadith(ids, Sr.value));
        }, 250);
      };
      $$('.chip[data-p]', m).forEach((c) => c.onclick = () => { part = c.dataset.p; customO = null; $$('.chip[data-p]', m).forEach((x) => x.classList.toggle('on', x === c)); upd(); });
      $$('.chip[data-l]', m).forEach((c) => c.onclick = () => { tkLang = c.dataset.l; $$('.chip[data-l]', m).forEach((x) => x.classList.toggle('on', x === c)); });
      $$('.chip[data-w]', m).forEach((c) => c.onclick = () => { where = c.dataset.w; $$('.chip[data-w]', m).forEach((x) => x.classList.toggle('on', x === c)); $('#hWithG', m).disabled = where !== 'note'; });
      showNumbering();
      setTimeout(() => Sr.focus(), 0);
    } });
}

/* عند فتح ملف: نعيد كتابة نص الأحاديث المُدرجة من المصدر لضمان مطابقتها للأصل حرفياً */
async function verifyHadiths() {
  const spans = $$('.wq-hadith', page); if (!spans.length) return;
  try { await loadHadithIndex(); } catch (e) { return; }
  for (const sp of spans) {
    const bk = sp.dataset.bk;
    try { await loadHadithBook(bk); } catch (e) { sp.classList.add('hd-bad'); continue; }
    const it = hdGet(bk, sp.dataset.k);
    const o = +sp.dataset.o || 0, e = +sp.dataset.e || 0;
    if (!it || o > it[1].length || (e && (e <= o || e > it[1].length))) { sp.classList.add('hd-bad'); continue; }
    const want = hdText(bk, sp.dataset.k, o, e);
    if (sp.textContent !== want) sp.textContent = want;
  }
  if (typeof renderIndexes === 'function') renderIndexes();
}

/* ---------- التحقق من الأحاديث المكتوبة يدوياً ---------- */
// الكلمات مع مواضعها في النص الأصلي (لاستخراج المقطع المطابق حرفياً من المصدر)
function hdWords(text) {
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(text))) { const k = hdNorm(m[0]); if (k) out.push({ k, o: m[0], i: m.index, j: m.index + m[0].length }); }
  return out;
}
// مقارنة كلمة بكلمة (أطول تتابع مشترك) بين الاقتباس ومقطع من الحديث
function hdAlign(U, W) {
  const n = U.length, m = W.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = U[i].k === W[j].k ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0, firstJ = -1, lastJ = -1;
  while (i < n && j < m) {
    if (U[i].k === W[j].k) { if (firstJ < 0) firstJ = j; lastJ = j; ops.push({ t: '=', u: U[i].o, q: W[j].o }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ t: '+', u: U[i].o }); i++; }
    else { if (firstJ >= 0) ops.push({ t: '-', q: W[j].o }); j++; }
  }
  while (i < n) ops.push({ t: '+', u: U[i++].o });
  while (ops.length && ops[ops.length - 1].t === '-') ops.pop();
  if (firstJ < 0) return null;
  const same = ops.filter((x) => x.t === '=').length;
  return { ops, score: same / Math.max(n, lastJ - firstJ + 1), exact: ops.every((x) => x.t === '='), o: W[firstJ].i, e: W[lastJ].j };
}
// البحث السريع: نوافذ من ٣ كلمات من الاقتباس، ثم مقارنة دقيقة لأفضل المرشحين
function matchHadith(text) {
  const U = hdWords(text); if (U.length < 4) return null;
  const keys = U.map((w) => w.k);
  const wins = [];
  const step = Math.max(1, Math.floor((keys.length - 3) / 7));
  for (let s = 0; s + 3 <= keys.length; s += step) wins.push(' ' + keys.slice(s, s + 3).join(' ') + ' ');
  const hits = [];
  for (const id in HD_BOOK) {
    const N = hdNormBook(HD_BOOK[id]);
    for (let i = 0; i < N.length; i++) {
      let c = 0; for (const w of wins) if (N[i].includes(w)) c++;
      if (c) hits.push({ id, i, c });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.c - a.c);
  const top = hits[0].c, cand = hits.filter((h) => h.c >= Math.max(1, top - 1)).slice(0, 12);
  let best = null;
  for (const h of cand) {
    const B = HD_BOOK[h.id], it = B.h[h.i];
    const r = hdAlign(U, hdWords(it[1]));
    if (r && (!best || r.score > best.score + 1e-9)) best = Object.assign(r, { bk: h.id, key: it[0], others: [] });
    else if (r && best && Math.abs(r.score - best.score) < 1e-9 && best.others.length < 6) best.others.push([h.id, it[0]]);
  }
  if (!best || best.score < 0.5) return null;
  return best;
}
// المواضع المرشحة: نص بين « » أو “ ” أو " " (٥ كلمات فأكثر) خارج النصوص المدرجة من المصدر
const HCAND = /«([^»]{12,}?)»|“([^”]{12,}?)”|"([^"]{12,}?)"/g;
const HD_SKIP = '.wq-ayah,.wq-ayah-ref,.wq-hadith,.wq-toc,.wq-bib,.wq-idx-ayat,.wq-idx-hadith';
function findHadithCandidates() {
  const out = [];
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest(HD_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n;
  while ((n = tw.nextNode())) {
    HCAND.lastIndex = 0; let m;
    while ((m = HCAND.exec(n.textContent))) { const tx = m[1] || m[2] || m[3]; if (tx.trim().split(/\s+/).length >= 5) out.push({ raw: m[0], text: tx }); }
  }
  return out;
}
function replaceHadithCandidate(c, r, addNote) {
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest(HD_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n, node = null, at = -1;
  while ((n = tw.nextNode())) { at = n.textContent.indexOf(c.raw); if (at >= 0) { node = n; break; } }
  if (!node) return false;
  const rg = document.createRange(); rg.setStart(node, at); rg.setEnd(node, at + c.raw.length);
  const len = hdGet(r.bk, r.key)[1].length;
  const tpl = document.createElement('template');
  tpl.innerHTML = hadithSpan(r.bk, r.key, r.o, r.e >= len ? 0 : r.e);
  const sp = tpl.content.firstChild;
  rg.deleteContents(); rg.insertNode(tpl.content);
  if (addNote) hdAddFootnoteAfter(sp, hdTakhrij(r.bk, r.key, true));
  normalizeBlocks(); markDirty(); renderCitations();
  return true;
}
async function verifyHadithQuotes(onlySelection) {
  saveRange();
  let cands;
  if (onlySelection && lastRange && !lastRange.collapsed) cands = [{ text: lastRange.toString(), sel: true }];
  else cands = findHadithCandidates();
  showModal({ title: t('hvTitle'), body: '<p class="soon" id="hvProg">' + E(t('hdLoading')) + '</p>', wide: true, actions: [{ label: t('cancel') }] });
  if (!cands.length) { const b = $('.modal .body'); if (b) b.innerHTML = '<p>' + E(t('hvNone')) + '</p>'; return; }
  try {
    await loadAllHadith((b) => { const p = $('#hvProg'); if (p) p.textContent = t('hdLoading') + ' ' + (WQ.ui === 'ar' ? b.name : b.en); });
  } catch (e) { const b = $('.modal .body'); if (b) b.innerHTML = '<p class="soon">' + E(t('hdUnavailable')) + '</p>'; return; }
  const p = $('#hvProg'); if (p) p.textContent = t('hvWorking');
  await new Promise((r) => setTimeout(r, 30));
  $('#modalRoot').innerHTML = '';
  const res = cands.map((c) => ({ c, r: matchHadith(c.text) }));
  const nOk = res.filter((x) => x.r && x.r.exact).length, nDiff = res.filter((x) => x.r && !x.r.exact).length, nNo = res.filter((x) => !x.r).length;
  let h = '<p class="qv-sum">' + E(t('hvSummary').replace('{ok}', fmtNum(nOk)).replace('{diff}', fmtNum(nDiff)).replace('{no}', fmtNum(nNo))) + '</p>';
  res.forEach((x, i) => {
    const r = x.r, cls = !r ? 'no' : (r.exact ? 'ok' : 'diff');
    const it = r && hdGet(r.bk, r.key);
    h += '<div class="qv-item ' + cls + '"><div class="qv-head"><span class="qv-badge">' + E(t(!r ? 'hvNotFound' : (r.exact ? 'qvMatch' : 'qvDiffers'))) + '</span>' +
      (r ? ' <b>' + E(hdRefLabel(r.bk, r.key)) + '</b>' + (r.others.length ? ' <span class="wq-note">' + E(t('hvAlso')) + ' ' + E(r.others.map(([b, k]) => hdRefLabel(b, k)).join('، ')) + '</span>' : '') : '') + '</div>' +
      '<div class="qv-text" dir="rtl">' + (r ? opsHtml(r.ops) : E(x.c.text)) + '</div>' +
      (r ? hdGradesHtml(r.bk, it) : '') +
      '<div class="chips">' + (r && !x.c.sel ? '<button class="btn2 hv-fix" data-i="' + i + '">' + E(t('hvReplace')) + '</button>' : '') +
      '<a class="chip" target="_blank" rel="noopener" href="' + E(dorarUrl(x.c.text)) + '">' + E(t('hdDorar')) + '</a></div></div>';
  });
  h += '<p class="wq-note" style="line-height:1.8">' + E(t('hvNote')) + '</p>';
  showModal({ title: t('hvTitle'), body: h + hdCredits(), wide: true, actions: [{ label: t('ok'), cls: 'btn' }],
    onOpen: (m) => $$('.hv-fix', m).forEach((b) => b.onclick = () => {
      const x = res[+b.dataset.i];
      if (replaceHadithCandidate(x.c, x.r, true)) b.replaceWith(el('span', { class: 'qv-done', html: '✓ ' + E(t('qvReplaced')) }));
    }) });
}

/* ---------- قائمة الضغط على الحديث المُدرج ---------- */
function closeHdMenu() { const x = document.getElementById('hdMenu'); if (x) x.remove(); }
function hdSetPart(sp, matn) {
  const it = hdGet(sp.dataset.bk, sp.dataset.k); if (!it) return;
  const o = matn ? hdMatnStart(it[1]) : 0;
  if (o) sp.dataset.o = o; else delete sp.dataset.o;
  delete sp.dataset.e;
  sp.textContent = hdText(sp.dataset.bk, sp.dataset.k, o, 0);
  normalizeBlocks(); markDirty(); refreshDerivedSoon();
  return o;
}
function hdDelete(sp) {
  const nx = sp.nextSibling;
  if (nx && nx.nodeType === 1 && nx.classList.contains('wq-fn')) { delete WQ.doc.footnotes[nx.dataset.fn]; nx.remove(); }
  sp.remove(); normalizeBlocks(); markDirty(); renderCitations();
}
function hdInfo(sp) {
  const bk = sp.dataset.bk, key = sp.dataset.k, it = hdGet(bk, key); if (!it) return;
  const b = HD_BOOK[bk].meta;
  showModal({ title: hdRefLabel(bk, key), wide: true, body:
    '<p><b>' + E(WQ.ui === 'ar' ? b.name : b.en) + '</b> · ' + E(t('hdNumbering')) + ': ' + E(b.numbering) + '</p>' +
    '<label>' + E(t('hdTakhrijLbl')) + '</label><div class="preview-box">' + E(hdTakhrij(bk, key, true)) + '</div>' +
    '<label>' + E(t('hdGrades')) + '</label>' + hdGradesHtml(bk, it) +
    '<div class="chips"><a class="chip" target="_blank" rel="noopener" href="' + E(dorarUrl(hdSlice(it[1], hdMatnStart(it[1])))) + '">' + E(t('hdDorar')) + '</a>' +
    '<a class="chip" target="_blank" rel="noopener" href="' + E(sunnahUrl(bk, key, hdSlice(it[1], hdMatnStart(it[1])))) + '">' + E(t('hdSunnah')) + '</a></div>' + hdCredits(),
    actions: [{ label: t('close'), cls: 'btn' }] });
}
function initHadithEvents() {
  page.addEventListener('click', async (e) => {
    const sp = e.target.closest && e.target.closest('.wq-hadith'); if (!sp || !page.contains(sp)) return;
    closeHdMenu();
    try { await loadHadithBook(sp.dataset.bk); } catch (er) { toast(t('hdUnavailable')); return; }
    const hasMatn = !!hdMatnStart((hdGet(sp.dataset.bk, sp.dataset.k) || [0, ''])[1]);
    const m = el('div', { class: 'ctx-menu', id: 'hdMenu', role: 'menu' });
    const item = (label, run, dis) => m.append(el('button', { class: 'ctx-item', role: 'menuitem', html: E(label), ...(dis ? { disabled: 'disabled' } : {}), onmousedown: (ev) => ev.preventDefault(),
      onclick: () => { closeHdMenu(); run(); } }));
    const isMatn = !!sp.dataset.o;
    m.append(el('div', { class: 'wq-note', style: 'padding:4px 10px', html: E(hdRefLabel(sp.dataset.bk, sp.dataset.k)) }));
    if (isMatn) item(t('hdFull'), () => hdSetPart(sp, false));
    else item(t('hdMenuMatn'), () => { if (!hdSetPart(sp, true)) toast(t('hdNoMatnShort')); }, !hasMatn);
    item(t('hdMenuInfo'), () => hdInfo(sp));
    item(t('hdDorar'), () => window.open(dorarUrl(sp.textContent), '_blank', 'noopener'));
    item(t('hdSunnah'), () => window.open(sunnahUrl(sp.dataset.bk, sp.dataset.k, sp.textContent), '_blank', 'noopener'));
    m.append(el('div', { class: 'ctx-sep' }));
    item(t('hdMenuDelete'), () => hdDelete(sp));
    document.body.append(m);
    const r = sp.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(e.clientX, innerWidth - m.offsetWidth - 6)) + 'px';
    m.style.top = Math.min(e.clientY + 8, innerHeight - m.offsetHeight - 6) + 'px';
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#hdMenu')) closeHdMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHdMenu(); });
}
