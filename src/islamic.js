/* ===== islamic: الصلاة على النبي ﷺ والترضّي، وأبيات الشعر، والتحقق من الآيات المنقولة يدوياً ===== */

/* ---------- العبارات الشرعية ---------- */
const HONORIFICS = ['ﷺ', 'صلى الله عليه وسلم', 'عليه السلام', 'رضي الله عنه', 'رضي الله عنها', 'رضي الله عنهما', 'رضي الله عنهم',
  'رحمه الله', 'رحمها الله', 'رحمهم الله', 'تعالى', 'عزّ وجلّ', 'سبحانه وتعالى'];
function insertHonorific(txt) {
  if (!txt) return;
  focusPage();
  document.execCommand('insertText', false, txt);
  onInput();
}

/* ---------- أبيات الشعر: صدر وعجز متقابلان ---------- */
// الفاصل بين الشطرين: *** أو … أو ... أو Tab أو ثلاث مسافات فأكثر
const BAYT_SPLIT = /\s*(?:\*{2,}|…|\.{3,}|\t+|\s{3,})\s*/;
function poemHtml(text) {
  return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split(BAYT_SPLIT).filter(Boolean);
    if (parts.length >= 2) return '<p class="wq-bayt" dir="rtl"><span class="sadr">' + E(parts[0]) + '</span><span class="ajz">' + E(parts.slice(1).join(' ')) + '</span></p>';
    return '<p class="wq-bayt single" dir="rtl">' + E(l) + '</p>';
  }).join('');
}
/* إدراج كتل كاملة بعد الفقرة الحالية (insertHTML يدمج أول كتلة في الفقرة التي فيها المؤشر) */
function insertBlocksAfter(html) {
  focusPage();
  const sel = document.getSelection();
  let blk = sel.rangeCount ? sel.anchorNode : null;
  while (blk && blk.parentNode !== page) blk = blk.parentNode;
  const tpl = document.createElement('template'); tpl.innerHTML = html + '<p dir="auto"><br></p>';
  const tail = tpl.content.lastChild;
  if (blk && blk.nodeType === 1 && blk.tagName === 'P' && !blk.textContent.trim() && !blk.querySelector('img,sup,.wq-ayah')) blk.replaceWith(tpl.content);
  else if (blk) blk.after(tpl.content);
  else page.append(tpl.content);
  const r = document.createRange(); r.setStart(tail, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
  markDirty(); onInput();
}
function openPoemDialog() {
  saveRange();
  showModal({
    title: t('poemTitle'), wide: true,
    body: '<p class="wq-note" style="font-size:12px;line-height:1.8">' + E(t('poemHint')) + '</p>' +
      '<textarea id="poemText" dir="rtl" rows="6" placeholder="' + E(t('poemPh')) + '"></textarea>' +
      '<label>' + E(t('preview')) + '</label><div class="preview-box page" id="poemPrev" dir="rtl" style="min-height:0;font-size:15px"></div>',
    actions: [{ label: t('cancel') }, { label: t('insert'), cls: 'btn', run: (m) => {
      const h = poemHtml($('#poemText', m).value); if (!h) return false;
      restoreRange(); insertBlocksAfter(h);
    } }],
    onOpen: (m) => {
      const ta = $('#poemText', m), pv = $('#poemPrev', m);
      ta.oninput = () => { pv.innerHTML = poemHtml(ta.value); };
      setTimeout(() => ta.focus(), 0);
    }
  });
}

/* ---------- التحقق من الآيات المكتوبة يدوياً ---------- */
// مفتاح الهيكل: نحذف التشكيل وحروف المد والهمزات حتى لا يُعدّ فرق الرسم العثماني والإملائي خطأ (الصلوة/الصلاة)
const skel = (w) => normAr(w).replace(/[اءئؤيوى]/g, '');
let QW = null; // كلمات المصحف: { k: الهيكل, s, a, o: الكلمة الأصلية بعلامات الوقف }
function quranWords() {
  if (QW) return QW;
  const words = [], index = new Map();
  QURAN.view.forEach((sura, si) => sura.forEach((ayah, ai) => {
    ayah.split(' ').forEach((tok) => {
      const k = skel(tok);
      if (!k) { if (words.length) words[words.length - 1].o += ' ' + tok; return; }
      const w = { k, s: si + 1, a: ai + 1, o: tok, first: false };
      if (!words.length || words[words.length - 1].a !== w.a || words[words.length - 1].s !== w.s) w.first = true;
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(words.length);
      words.push(w);
    });
  }));
  words.forEach((w, i) => { const nx = words[i + 1]; w.last = !nx || nx.a !== w.a || nx.s !== w.s; });
  QW = { words, index };
  return QW;
}
// كلمات النص المنقول (حرف النداء "يا" يُلصق بما بعده كما في الرسم العثماني: يٰأيها)
function userWords(text) {
  const raw = String(text).replace(/[﴿﴾{}()«»"“”\[\]،,.:;؛!?؟۝\d٠-٩]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    if (skel(raw[i]) === '' && normAr(raw[i]) === 'يا' && raw[i + 1]) { out.push({ o: raw[i] + ' ' + raw[i + 1], k: skel(raw[i] + raw[i + 1]) }); i++; continue; }
    const k = skel(raw[i]); if (k) out.push({ o: raw[i], k });
  }
  return out;
}
/* أفضل موضع في المصحف: تصويت مواضع البداية، ثم مقارنة كلمة بكلمة (LCS) */
function matchQuran(text) {
  const { words, index } = quranWords();
  const U = userWords(text); if (U.length < 3) return null;
  const votes = new Map();
  U.forEach((u, i) => {
    const pos = index.get(u.k); if (!pos || pos.length > 400) return; // الكلمات الشائعة جداً لا تُرشد
    pos.forEach((p) => { const st = p - i; votes.set(st, (votes.get(st) || 0) + 1); });
  });
  // نجمع أصوات البدايات المتقاربة (±٣): الكلمة الناقصة أو الزائدة تزحزح ما بعدها
  const sums = [];
  votes.forEach((v, st) => { let sum = 0; for (let d = -3; d <= 3; d++) sum += votes.get(st + d) || 0; sums.push([st, sum]); });
  sums.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  if (!sums.length || sums[0][1] < Math.min(3, Math.ceil(U.length * 0.4))) return null;
  // نقارن أفضل المرشحين كلمة بكلمة، ونختار الأعلى تطابقاً (وعند التساوي: الموضع الأسبق في المصحف)
  let bestRes = null;
  const seenFrom = new Set();
  for (const [st] of sums.slice(0, 8)) {
    const from = Math.max(0, st - 3); if (seenFrom.has(from)) continue; seenFrom.add(from);
    const r = alignAt(U, words, from, Math.min(words.length, st + U.length + 3));
    if (r && (!bestRes || r.score > bestRes.score + 1e-9 || (Math.abs(r.score - bestRes.score) < 1e-9 && r.pos < bestRes.pos))) bestRes = r;
  }
  if (!bestRes || bestRes.score < 0.6) return null;
  return bestRes;
}
function alignAt(U, words, from, to) {
  const W = words.slice(from, to);
  const n = U.length, m = W.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = U[i].k === W[j].k ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0, firstJ = -1, lastJ = -1;
  while (i < n && j < m) {
    if (U[i].k === W[j].k) { if (firstJ < 0) firstJ = j; lastJ = j; ops.push({ t: '=', u: U[i].o, q: W[j].o }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ t: '+', u: U[i].o }); i++; }
    else { if (firstJ >= 0) ops.push({ t: '-', q: W[j].o }); j++; }
  }
  while (i < n) ops.push({ t: '+', u: U[i++].o });
  // الكلمات الناقصة بعد آخر تطابق من سياق النافذة لا من الاقتباس
  while (ops.length && ops[ops.length - 1].t === '-') ops.pop();
  if (firstJ < 0) return null;
  const same = ops.filter((o) => o.t === '=').length;
  const score = same / Math.max(n, lastJ - firstJ + 1);
  const a0 = W[firstJ], a1 = W[lastJ];
  const exact = ops.every((o) => o.t === '=');
  const full = a0.first && a1.last && a0.s === a1.s;
  const quran = W.slice(firstJ, lastJ + 1).map((w) => w.o).join(' ');
  return { s: a0.s, a: a0.a, s2: a1.s, b: a1.a, ops, exact, full, score, quran, pos: from + firstJ };
}
// المواضع المرشحة: نص بين ﴿ ﴾ أو { } أو (( )) خارج الآيات المدرجة من المصدر
const QCAND = /﴿([^﴾]{6,}?)﴾|\{([^}]{6,}?)\}|\(\(([^)]{6,}?)\)\)/g;
function findQuranCandidates() {
  const out = [];
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest('.wq-ayah,.wq-ayah-ref,.wq-toc,.wq-bib') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n;
  while ((n = tw.nextNode())) {
    QCAND.lastIndex = 0; let m;
    while ((m = QCAND.exec(n.textContent))) out.push({ raw: m[0], text: m[1] || m[2] || m[3] });
  }
  return out;
}
function opsHtml(ops) {
  return ops.map((o) => o.t === '=' ? E(o.q) : (o.t === '+' ? '<del class="qd-extra" title="' + E(t('qvExtra')) + '">' + E(o.u) + '</del>' : '<ins class="qd-miss" title="' + E(t('qvMissing')) + '">' + E(o.q) + '</ins>')).join(' ');
}
function qRefLabel(r) {
  return r.s === r.s2 ? ayahRef(r.s, r.a, r.b) : ayahRef(r.s, r.a, QURAN.suras[r.s - 1].ayas) + ' – ' + ayahRef(r.s2, 1, r.b);
}
/* الاستبدال: آيات كاملة ← آية محمية من المصدر، واقتباس جزئي ← نص المصحف بين ﴿ ﴾ */
function replaceCandidate(c, r) {
  // نبحث عن النص من جديد وقت الاستبدال (الاستبدالات السابقة تغيّر مواضع العقد)
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest('.wq-ayah,.wq-ayah-ref') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n, node = null, at = -1;
  while ((n = tw.nextNode())) { at = n.textContent.indexOf(c.raw); if (at >= 0) { node = n; break; } }
  if (!node) return false;
  const rg = document.createRange(); rg.setStart(node, at); rg.setEnd(node, at + c.raw.length);
  const tpl = document.createElement('template');
  tpl.innerHTML = (r.full) ? ayahSpan(r.s, r.a, r.b) : '<span dir="rtl">﴿' + E(r.quran) + '﴾</span>';
  rg.deleteContents(); rg.insertNode(tpl.content);
  markDirty(); renderCitations();
  return true;
}
async function verifyQuranQuotes(onlySelection) {
  saveRange();
  showModal({ title: t('qvTitle'), body: '<p class="soon">' + E(t('quranLoading')) + '</p>', wide: true, actions: [{ label: t('cancel') }] });
  try { await loadQuran(); } catch (e) { const b = $('.modal .body'); if (b) b.innerHTML = '<p class="soon">' + E(t('quranUnavailable')) + '</p>'; return; }
  $('#modalRoot').innerHTML = '';
  let cands;
  if (onlySelection && lastRange && !lastRange.collapsed) cands = [{ text: lastRange.toString(), sel: true }];
  else cands = findQuranCandidates();
  const res = cands.map((c) => ({ c, r: matchQuran(c.text) }));
  const nOk = res.filter((x) => x.r && x.r.exact).length, nDiff = res.filter((x) => x.r && !x.r.exact).length, nNo = res.filter((x) => !x.r).length;
  let h = '';
  if (!cands.length) h = '<p>' + E(t('qvNone')) + '</p>';
  else {
    h = '<p class="qv-sum">' + E(t('qvSummary').replace('{ok}', fmtNum(nOk)).replace('{diff}', fmtNum(nDiff)).replace('{no}', fmtNum(nNo))) + '</p>';
    res.forEach((x, i) => {
      const r = x.r, cls = !r ? 'no' : (r.exact ? 'ok' : 'diff');
      h += '<div class="qv-item ' + cls + '" data-i="' + i + '"><div class="qv-head"><span class="qv-badge">' + E(t(!r ? 'qvNotFound' : (r.exact ? 'qvMatch' : 'qvDiffers'))) + '</span>' +
        (r ? ' <b>' + E(qRefLabel(r)) + '</b>' + (r.full ? '' : ' <span class="wq-note">(' + E(t('qvPartial')) + ')</span>') : '') + '</div>' +
        '<div class="qv-text" dir="rtl">' + (r ? opsHtml(r.ops) : E(x.c.text)) + '</div>' +
        (r && !x.c.sel ? '<button class="btn2 qv-fix" data-i="' + i + '">' + E(t(r.full ? 'qvReplaceFull' : 'qvReplacePart')) + '</button>' : '') + '</div>';
    });
    h += '<p class="wq-note" style="line-height:1.8">' + E(t('qvNote')) + '</p>';
  }
  showModal({ title: t('qvTitle'), body: h + quranCredits(), wide: true, actions: [{ label: t('ok'), cls: 'btn' }],
    onOpen: (m) => $$('.qv-fix', m).forEach((b) => b.onclick = () => {
      const x = res[+b.dataset.i];
      if (replaceCandidate(x.c, x.r)) { b.replaceWith(el('span', { class: 'qv-done', html: '✓ ' + E(t('qvReplaced')) })); }
    }) });
}
