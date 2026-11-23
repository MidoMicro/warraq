/* ===== indexes: فهرس الآيات وفهرس الأحاديث (تلقائيان مثل فهرس المحتويات) =====
   يشملان الآيات والأحاديث المُدرجة من ورّاق (المحمية)، مع رقم الصفحة. الحقيقي بعد «عرض الصفحات» والتصدير، وتقريبي أثناء الكتابة. */
const IDX_KINDS = ['wq-idx-ayat', 'wq-idx-hadith'];
const IDX_SEL = '.wq-idx-ayat,.wq-idx-hadith';
/* طرف النص: أول كلمات منه */
function idxHead(txt, n) {
  const w = String(txt).replace(/[«»﴿﴾]/g, '').replace(/ ۝[٠-٩]+/g, '').trim().split(/\s+/);
  return w.slice(0, n).join(' ') + (w.length > n ? ' …' : '');
}
/* رقم صفحة عنصر: الحقيقي من عرض الصفحات إن وُجد، وإلا التقريبي */
function idxPageOf(el, i) { return (PV.exact && PV.xPage && PV.xPage[i] !== undefined) ? PV.xPage[i] : pageOf(el); }
function idxPagesStr(list) { return Array.from(new Set(list)).sort((a, b) => a - b).map((p) => pvLabel(p)).join(WQ.doc.settings.lang === 'ar' ? '، ' : ', '); }

function ayatEntries() {
  const m = new Map();
  $$('.wq-ayah', page).forEach((sp) => {
    if (sp.closest(IDX_SEL)) return;
    const s = +sp.dataset.s, a = +sp.dataset.a, b = +sp.dataset.b; if (!s || !a) return;
    const k = s + ':' + a + ':' + b;
    if (!m.has(k)) m.set(k, { s, a, b, text: sp.textContent, xs: [], els: [] });
    m.get(k).els.push(sp);
  });
  return Array.from(m.values()).sort((x, y) => x.s - y.s || x.a - y.a || x.b - y.b);
}
function hadithEntries() {
  const m = new Map();
  $$('.wq-hadith', page).forEach((sp) => {
    if (sp.closest(IDX_SEL)) return;
    const k = sp.dataset.bk + ':' + sp.dataset.k + ':' + (sp.dataset.o || 0);
    if (!m.has(k)) m.set(k, { bk: sp.dataset.bk, key: sp.dataset.k, text: sp.textContent, els: [] });
    m.get(k).els.push(sp);
  });
  // ترتيب أبجدي بأطراف الأحاديث (بلا تشكيل)، كما في فهارس الرسائل
  return Array.from(m.values()).sort((x, y) => hdNorm(idxHead(x.text, 8)).localeCompare(hdNorm(idxHead(y.text, 8)), 'ar'));
}
function renderIndexes() {
  const blocks = $$(IDX_SEL, page);
  if (!blocks.length) return;
  // أسماء السور والكتب تحتاج بياناتها: نحمّلها ثم نعيد الرسم
  if (!QURAN && $('.wq-ayah', page) && !renderIndexes._q) { renderIndexes._q = 1; loadQuran().then(() => { renderIndexes._q = 0; renderIndexes(); }).catch(() => {}); }
  if (!HD_INDEX && $('.wq-hadith', page) && !renderIndexes._h) { renderIndexes._h = 1; loadHadithIndex().then(() => { renderIndexes._h = 0; renderIndexes(); }).catch(() => {}); }
  // كل آية وحديث في المستند يأخذ رقماً ثابتاً في هذا الرسم (يُستخدم لربط أرقام الصفحات الحقيقية)
  const all = $$('.wq-ayah,.wq-hadith', page).filter((x) => !x.closest(IDX_SEL));
  const xi = new Map(all.map((x, i) => [x, i]));
  const pagesOf = (els) => idxPagesStr(els.map((e) => idxPageOf(e, xi.get(e))));
  const xidsOf = (els) => els.map((e) => xi.get(e)).join(',');
  const row = (cells, xs) => '<div class="idx-row"' + (xs !== undefined ? ' data-x="' + xs + '"' : '') + ' dir="auto">' + cells.map((c, k) => '<span class="c' + k + '">' + c + '</span>').join('') + '</div>';
  const note = PV.exact ? '' : '<p class="wq-note">' + E(t('pageApproxNote')) + '</p>';
  blocks.forEach((b) => {
    const ay = b.classList.contains('wq-idx-ayat');
    let h = '<div class="wq-block-title">' + E(tDoc(ay ? 'idxAyat' : 'idxHadith')) + '</div>';
    const list = ay ? ayatEntries() : hadithEntries();
    if (!list.length) h += '<p class="wq-note">' + E(t(ay ? 'idxEmptyAyat' : 'idxEmptyHadith')) + '</p>';
    else {
      h += '<div class="idx-row idx-head" dir="auto">' + (ay ? [tDoc('idxNo'), tDoc('idxAyah'), tDoc('idxSura'), tDoc('idxAyahNo'), tDoc('idxPage')] : [tDoc('idxNo'), tDoc('idxHadithCol'), tDoc('idxTakhrij'), tDoc('idxPage')]).map((c, k) => '<span class="c' + k + '">' + E(c) + '</span>').join('') + '</div>';
      list.forEach((x, i) => {
        const n = N(i + 1, WQ.doc.settings.lang);
        if (ay) {
          const num = x.a === x.b ? N(x.a, 'ar') : N(x.a, 'ar') + '–' + N(x.b, 'ar');
          h += row([n, '<span class="idx-q">﴿' + E(idxHead(x.text, 6)) + '﴾</span>', E(QURAN ? suraLabel(x.s) : String(x.s)), num, pagesOf(x.els)], xidsOf(x.els));
        } else {
          h += row([n, '«' + E(idxHead(x.text, 7)) + '»', E(hdRefLabel(x.bk, x.key)), pagesOf(x.els)], xidsOf(x.els));
        }
      });
      h += note;
    }
    if (b._h !== h) { b.innerHTML = h; b._h = h; }
    b.classList.toggle('ayat', ay);
  });
}
/* بعد تقسيم الصفحات: أرقام الصفحات الحقيقية في الفهارس داخل عرض الصفحات */
function fixIndexPagesIn(host) {
  $$('.idx-row[data-x]', host).forEach((r) => {
    const ids = r.dataset.x.split(',').filter(Boolean).map(Number);
    const ps = ids.map((i) => PV.xPage[i]).filter((v) => v !== undefined);
    if (ps.length) r.lastElementChild.textContent = idxPagesStr(ps);
  });
  $$('.wq-idx-ayat .wq-note,.wq-idx-hadith .wq-note', host).forEach((x) => x.remove());
}
