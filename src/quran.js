/* ===== quran: إدراج الآيات من نص مشروع Tanzil (الرسم العثماني) بدون أي تعديل للنص ===== */
let QURAN = null, QURAN_IDX = null, _qLoading = null;

function quranCredits() {
  return '<p class="wq-note" style="line-height:1.8">' + E(t('quranCredit')) +
    ' <a href="https://tanzil.net" target="_blank" rel="noopener">tanzil.net</a></p>';
}
async function loadQuran() {
  if (QURAN) return QURAN;
  if (!_qLoading) _qLoading = fetch('quran.json').then((r) => { if (!r.ok) throw new Error('http'); return r.json(); }).then((q) => {
    // نص Tanzil يضع البسملة في بداية الآية الأولى من كل سورة (عدا الفاتحة والتوبة)،
    // والبسملة ليست من الآية؛ فنفصلها عند العرض والإدراج، ويبقى باقي النص كما هو حرفياً
    const basmala = q.text[0][0] + ' ';
    q.view = q.text.map((sura, i) => sura.map((a, j) => (i > 0 && j === 0 && a.startsWith(basmala)) ? a.slice(basmala.length) : a));
    QURAN = q;
    QURAN_IDX = q.view.map((sura) => sura.map(normAr));
    return q;
  }).catch((e) => { _qLoading = null; throw e; });
  return _qLoading;
}
/* تطبيع للبحث فقط (النص الم\u064Fدرج يبقى الأصل حرفيا\u064B): نحذف التشكيل وعلامات الوقف ونوح\u0651د الألف والياء */
function normAr(s) {
  return String(s)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0671\u0622\u0623\u0625]/g, 'ا')
    .replace(/[\u0649]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim();
}
function searchQuran(q, max = 30) {
  const n = normAr(q); if (n.length < 2) return [];
  const out = [];
  for (let s = 0; s < QURAN_IDX.length && out.length < max; s++)
    for (let a = 0; a < QURAN_IDX[s].length && out.length < max; a++)
      if (QURAN_IDX[s][a].includes(n)) out.push([s + 1, a + 1]);
  return out;
}
const ayahText = (s, a, b) => QURAN.view[s - 1].slice(a - 1, b).join(' ');
function suraLabel(s) { const x = QURAN.suras[s - 1]; return WQ.doc.settings.lang === 'ar' ? x.name : x.tname; }
function ayahRef(s, a, b) {
  const ar = WQ.doc.settings.lang === 'ar';
  const num = (v) => ar ? toArabicDigits(String(v)) : String(v);
  const range = a === b ? num(a) : num(a) + '-' + num(b);
  return ar ? suraLabel(s) + ': ' + range : suraLabel(s) + ' ' + s + ':' + (a === b ? a : a + '-' + b);
}
function ayahFootText(s, a, b) {
  const ar = WQ.doc.settings.lang === 'ar';
  if (ar) return 'سورة ' + suraLabel(s) + '، ' + (a === b ? 'الآية ' + toArabicDigits(String(a)) : 'الآيات ' + toArabicDigits(a + '-' + b)) + '.';
  return "Qur'an, " + suraLabel(s) + ' ' + s + ':' + (a === b ? a : a + '-' + b) + '.';
}
function ayahSpan(s, a, b) {
  return '<span class="wq-ayah" data-s="' + s + '" data-a="' + a + '" data-b="' + b + '" contenteditable="false" dir="rtl" lang="ar">﴿' + E(ayahText(s, a, b)) + '﴾</span>';
}
function insertAyah(s, a, b, opt) {
  let html = ayahSpan(s, a, b);
  if (opt.where === 'text') html += ' <span class="wq-ayah-ref" contenteditable="false">[' + E(ayahRef(s, a, b)) + ']</span>';
  if (opt.block) {
    insertHtml('<p dir="rtl" style="text-align: center">' + html + '</p><p dir="auto"><br></p>');
  } else insertHtml(html + '&nbsp;');
  if (opt.where === 'note') {
    // نضع مؤشر الحاشية بعد الآية مباشرة
    const spans = $$('.wq-ayah', page); const last = spans.filter((x) => +x.dataset.s === s && +x.dataset.a === a).pop();
    const id = uid('f');
    WQ.doc.footnotes[id] = { refId: '', page: '', text: ayahFootText(s, a, b) };
    const sup = document.createElement('sup'); sup.className = 'wq-fn'; sup.dataset.fn = id; sup.contentEditable = 'false'; sup.textContent = '*';
    if (last) last.after(sup);
  }
  markDirty(); renderCitations();
}

async function openAyahDialog() {
  saveRange();
  showModal({ title: t('insertAyah'), body: '<p class="soon">' + E(t('quranLoading')) + '</p>', wide: true, actions: [{ label: t('cancel') }] });
  try { await loadQuran(); } catch (e) {
    const b = $('.modal .body'); if (b) b.innerHTML = '<p class="soon">' + E(t('quranUnavailable')) + '</p>';
    return;
  }
  $('#modalRoot').innerHTML = '';
  let sel = { s: 1, a: 1, b: 1 };
  const opts = QURAN.suras.map((x) => '<option value="' + x.n + '">' + (WQ.ui === 'ar' ? toArabicDigits(String(x.n)) + '. ' + E(x.name) : x.n + '. ' + E(x.tname)) + '</option>').join('');
  const body =
    '<label>' + E(t('ayahSearch')) + '</label><input id="qSearch" dir="rtl" placeholder="' + E(t('ayahSearchPh')) + '">' +
    '<div id="qResults" class="q-results"></div>' +
    '<div class="row" style="grid-template-columns:2fr 1fr 1fr"><div><label>' + E(t('sura')) + '</label><select id="qSura">' + opts + '</select></div>' +
    '<div><label>' + E(t('fromAyah')) + '</label><input id="qFrom" type="number" min="1" value="1"></div><div><label>' + E(t('toAyah')) + '</label><input id="qTo" type="number" min="1" value="1"></div></div>' +
    '<label>' + E(t('preview')) + '</label><div class="preview-box ayah-prev" id="qPrev" dir="rtl"></div>' +
    '<div class="chips"><button class="chip on" data-w="text">' + E(t('refInText')) + '</button><button class="chip" data-w="note">' + E(t('refInNote')) + '</button>' +
    '<label style="display:flex;gap:6px;align-items:center;margin:0 8px"><input id="qBlock" type="checkbox" checked style="width:auto;margin:0">' + E(t('ownLine')) + '</label></div>' +
    quranCredits();
  let where = 'text';
  showModal({ title: t('insertAyah'), body, wide: true,
    actions: [{ label: t('cancel') }, { label: t('insert'), cls: 'btn', run: (m) => { restoreRange(); insertAyah(sel.s, sel.a, sel.b, { where, block: $('#qBlock', m).checked }); } }],
    onOpen: (m) => {
      const S = $('#qSura', m), F = $('#qFrom', m), T = $('#qTo', m);
      const upd = () => {
        const s = +S.value, max = QURAN.suras[s - 1].ayas;
        let a = Math.min(max, Math.max(1, +F.value || 1)), b = Math.min(max, Math.max(a, +T.value || a));
        if (b - a > 19) b = a + 19;
        F.max = T.max = max; sel = { s, a, b };
        $('#qPrev', m).innerHTML = '<span class="wq-ayah">﴿' + E(ayahText(s, a, b)) + '﴾</span> <span class="wq-ayah-ref">[' + E(ayahRef(s, a, b)) + ']</span>';
      };
      const pick = (s, a) => { S.value = s; F.value = a; T.value = a; upd(); };
      S.onchange = () => { F.value = 1; T.value = 1; upd(); };
      F.oninput = () => { if (+T.value < +F.value) T.value = F.value; upd(); };
      T.oninput = upd;
      $$('.chip', m).forEach((c) => c.onclick = () => { where = c.dataset.w; $$('.chip', m).forEach((x) => x.classList.toggle('on', x === c)); });
      let tmr;
      $('#qSearch', m).oninput = (e) => {
        clearTimeout(tmr); tmr = setTimeout(() => {
          const res = searchQuran(e.target.value);
          const box = $('#qResults', m);
          if (!e.target.value.trim()) { box.innerHTML = ''; return; }
          if (!res.length) { box.innerHTML = '<p class="wq-note">' + E(t('noResults')) + '</p>'; return; }
          box.innerHTML = res.map(([s, a]) => '<button class="q-hit" data-s="' + s + '" data-a="' + a + '"><b>' + E(ayahRef(s, a, a)) + '</b> ' + E(QURAN.view[s - 1][a - 1].slice(0, 90)) + '</button>').join('');
          $$('.q-hit', box).forEach((h) => h.onclick = () => pick(+h.dataset.s, +h.dataset.a));
        }, 200);
      };
      upd();
      setTimeout(() => $('#qSearch', m).focus(), 0);
    } });
}

/* عند فتح ملف: نعيد كتابة نص الآيات من المصدر لضمان مطابقته للأصل حرفيا\u064B */
async function verifyAyat() {
  const spans = $$('.wq-ayah', page); if (!spans.length) return;
  try { await loadQuran(); } catch (e) { return; }
  spans.forEach((sp) => {
    const s = +sp.dataset.s, a = +sp.dataset.a, b = +sp.dataset.b;
    if (!(s >= 1 && s <= 114) || !(a >= 1) || !(b >= a) || b > QURAN.suras[s - 1].ayas) { sp.classList.add('ayah-bad'); return; }
    const want = '﴿' + ayahText(s, a, b) + '﴾';
    if (sp.textContent !== want) sp.textContent = want;
  });
}
