/* ===== tashkeel: التشكيل الآلي بنظام الاقتراح والمراجعة =====
   ثلاثة محركات تعمل محلياً بـ onnxruntime-web (رخصة MIT)، بدون إنترنت، ويُختار تشكيل كل كلمة بالتصويت:
     L: libtashkeel (Musharraf Omer، MIT) — C: CATT (Abjad AI، Apache-2.0) — R: rawi-ensemble (TigreGotico، Apache-2.0)
   على امتحان ٣٠ جملة: L وحده ٨٩٪ كلمات صحيحة، وC وR ٩٢٪، والتصويت ٩٥٪، وكل الأخطاء الباقية في كلمات اختلفت عليها المحركات.
   - يحترم الحركات التي كتبها المستخدم (تُرسل للنموذج كتلميحات).
   - لا يلمس الآيات المدرجة ولا ما بين ﴿ ﴾ ولا الحواشي والاستشهادات.
   - الكلمات التي ثقة النموذج فيها أقل من الحد يوضع تحتها خط، والضغط عليها يعرض البديل. */
const TK_CHARS = ' #!"()-./:[]«»،؛؟ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي'; // المعرّف = الموضع + 1 (صفر للحشو)
const TK_DIAC = ['', 'ً', 'ٌ', 'ٍ', 'َ', 'ُ', 'ِ', 'ًّ', 'ٌّ', 'ٍّ', 'َّ', 'ُّ', 'ِّ', 'ْ', 'ّ']; // المعرّف = الموضع + 1
const TK_HARAKAT = /[ً-ْ]/;
const TK_NUM = /[0-9٠-٩]/;
/* حد الثقة الذي تحته تُعلَّم الكلمة للمراجعة (قِيس على ٣٠ جملة مشكولة يدوياً):
   0.90 يلتقط ٢٢ من ٢٧ خطأ ويعلّم ٢٠٪ من الكلمات، و0.97 يلتقط ٢٧ من ٢٧ ويعلّم نحو ٣٠٪ */
const TK_DOUBT = { full: 0.9, strict: 0.97, ends: 0.9 };
const TK_SUN = 'تثدذرزسشصضطظلن';
/* CATT: الحروف بترميز بكوالتر، والوسوم ← حركات */
const CATT_LETTERS = ['<PAD>', '<BOS>', '<EOS>', ' ', '$', '&', "'", '*', '<', '>', 'A', 'D', 'E', 'H', 'S', 'T', 'Y', 'Z', 'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z', '|', '}', '<MASK>'];
const AR2BW = { 'ء': "'", 'آ': '|', 'أ': '>', 'ؤ': '&', 'إ': '<', 'ئ': '}', 'ا': 'A', 'ب': 'b', 'ة': 'p', 'ت': 't', 'ث': 'v', 'ج': 'j', 'ح': 'H', 'خ': 'x', 'د': 'd', 'ذ': '*', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': '$', 'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'E', 'غ': 'g', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ى': 'Y', 'ي': 'y' };
const CATT_TAGS = ['', '', '', '', 'ُّ', 'ٌّ', 'َّ', 'ًّ', 'ِّ', 'ٍّ', 'ً', 'ٍ', 'ٌ', 'َ', 'ِ', 'ْ', 'ُ', 'ّ'];
/* rawi: معرّفات الحروف بعد فك الهمزات (NFD)، والأصناف ← حركات (أُبقي منها الحركات فقط) */
const RAWI_DIAC = ["", "", "", "", "", "", "", "", "", "", "ً", "ًَ", "ًّ", "ً", "ٌ", "ٌّ", "ٌ", "ٌ", "ٍ", "ٍّ", "ٍّ", "ٍ", "ٍ", "ٍ", "َ", "ََ", "ََّ", "ََّ", "ََ", "َُ", "َِ", "َّ", "َّ", "َّ", "َّ", "َ", "َ", "َ", "َ", "ُ", "ُُ", "ُِ", "ُّ", "ُّ", "ُ", "ُ", "ُ", "ِ", "ِِ", "ِِّ", "ِِ", "ِّ", "ِّ", "ِّ", "ِْ", "ِ", "ِ", "ِ", "ِ", "ّ", "ّّ", "ّْ", "ّ", "ْ", "ْْ", "ْ", "ْ", "", "", "", "", "", "", "", ""];
const RAWI_CHARS = {" ":3,"#":6,"!":4,"\"":5,"(":11,")":12,"-":16,".":17,"/":18,":":29,"[":61,"]":63,"«":97,"»":99,"،":145,"؛":146,"؟":147,"ء":148,"ا":149,"ب":150,"ة":151,"ت":152,"ث":153,"ج":154,"ح":155,"خ":156,"د":157,"ذ":158,"ر":159,"ز":160,"س":161,"ش":162,"ص":163,"ض":164,"ط":165,"ظ":166,"ع":167,"غ":168,"ف":170,"ق":171,"ك":172,"ل":173,"م":174,"ن":175,"ه":176,"و":177,"ى":178,"ي":179};
const RAWI_BASE = { 'آ': 'ا', 'أ': 'ا', 'إ': 'ا', 'ؤ': 'و', 'ئ': 'ي' };
/* صيغة موحّدة للحركة: حركة واحدة ثم الشدة (لتتساوى مخرجات المحركات عند المقارنة) */
function tkCanon(d) {
  d = String(d || '').replace(/[^\u064B-\u0652]/g, '');
  const sh = d.includes('ّ'), h = d.replace(/ّ/g, '').slice(-1);
  return h + (sh ? 'ّ' : '');
}
const TK_SKIP = '.wq-ayah,.wq-ayah-ref,.wq-hadith,.wq-fn,.wq-cite,sup,.wq-toc,.wq-bib';
let TK = null, _tkLoading = null;

async function loadTashkeel() {
  if (TK) return TK;
  if (!_tkLoading) _tkLoading = (async () => {
    const base = new URL('vendor/', location.href).href;
    const ort = await import(base + 'ort/ort.wasm.bundle.min.mjs');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const get = async (p) => { const r = await fetch(base + p); if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); };
    ort.env.wasm.wasmBinary = await get('ort/ort-wasm-simd-threaded.wasm');
    const mk = async (f) => ort.InferenceSession.create(new Uint8Array(await get('tashkeel/' + f)), { executionProviders: ['wasm'] });
    const session = await mk('model.onnx');
    // المحركان الإضافيان اختياريان: لو تعذّر تحميل أحدهما يعمل التشكيل بما تيسّر
    const opt = async (f) => { try { return await mk(f); } catch (e) { return null; } };
    TK = { ort, session, catt: await opt('catt.onnx'), rawi: await opt('rawi.onnx') };
    return TK;
  })().catch((e) => { _tkLoading = null; throw e; });
  return _tkLoading;
}
/* حركات المستخدم ← معرّف التلميح (الشدة تُكتب أحياناً قبل الحركة: نوحّد الترتيب) */
function tkHintId(d) {
  if (!d) return 1;
  const sh = d.includes('ّ'), h = d.replace(/ّ/g, '').slice(-1);
  const i = TK_DIAC.indexOf((h || '') + (sh ? 'ّ' : ''));
  return i >= 0 ? i + 1 : 1;
}
/* تشكيل سلسلة نصية: يعيد لكل حرف عربي في النموذج حركته وثقته والبديل الأقرب */
async function tkRun(chars, hints) {
  const { ort, session } = TK, n = chars.length;
  const ids = new BigInt64Array(n), hs = new BigInt64Array(n);
  for (let i = 0; i < n; i++) { ids[i] = BigInt(chars[i]); hs[i] = BigInt(hints[i]); }
  const out = await session.run({
    char_inputs: new ort.Tensor('int64', ids, [1, n]),
    diac_inputs: new ort.Tensor('int64', hs, [1, n]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(n)]), [1])
  });
  const pred = out.predictions.data, prob = out.logits.data, C = 15, res = [];
  for (let i = 0; i < n; i++) {
    const row = prob.subarray(i * C, i * C + C);
    let a = -1, b = -1;
    for (let k = 1; k < C; k++) { if (a < 0 || row[k] > row[a]) { b = a; a = k; } else if (b < 0 || row[k] > row[b]) b = k; }
    const p = pred[i];
    res.push({ d: TK_DIAC[p - 1] || '', conf: row[p], alt: TK_DIAC[(p === a ? b : a) - 1] || '' });
  }
  return res;
}

/* CATT: نص بترميز بكوالتر (غير العربي مسافة) ← حركة لكل حرف */
async function tkRunCatt(part) {
  const { ort, catt } = TK, n = part.length;
  const ids = new BigInt64Array(n);
  part.forEach((m, i) => { const bw = AR2BW[m.it.ch]; ids[i] = BigInt(bw ? CATT_LETTERS.indexOf(bw) : 3); });
  const out = await catt.run({ src: new ort.Tensor('int64', ids, [1, n]), src_mask: new ort.Tensor('bool', new Uint8Array(n * n).fill(1), [1, 1, n, n]) });
  const lg = out[catt.outputNames[0]].data, T = 18, res = [];
  for (let i = 0; i < n; i++) { let a = 0; for (let k = 1; k < T; k++) if (lg[i * T + k] > lg[i * T + a]) a = k; res.push(AR2BW[part[i].it.ch] ? tkCanon(CATT_TAGS[a]) : ''); }
  return res;
}
/* rawi: الحروف بعد فك الهمزات ← صنف حركة لكل حرف */
async function tkRunRawi(part) {
  const { ort, rawi } = TK, n = part.length;
  const ids = new BigInt64Array(n);
  part.forEach((m, i) => { const c = TK_NUM.test(m.it.ch) ? '#' : (RAWI_BASE[m.it.ch] || m.it.ch); ids[i] = BigInt(RAWI_CHARS[c] || 1); });
  const out = await rawi.run({ input: new ort.Tensor('int64', ids, [1, n]) });
  const cls = out[rawi.outputNames[0]].data;
  return Array.from({ length: n }, (_, i) => AR2BW[part[i].it.ch] ? tkCanon(RAWI_DIAC[Number(cls[i])] || '') : '');
}

/* الكتل التي يشملها التحديد (أو الفقرة الحالية) */
function tkBlocks(range) {
  const sel = 'p,h1,h2,h3,li,td,th,blockquote';
  if (range.collapsed) { let n = range.startContainer; n = n.nodeType === 3 ? n.parentNode : n; const b = n.closest && n.closest(sel); return b && page.contains(b) ? [b] : []; }
  return $$(sel, page).filter((b) => range.intersectsNode(b) && !b.querySelector(sel));
}
/* إزالة خطوط المراجعة داخل كتلة (قبل إعادة التشكيل) */
function tkUnwrap(root) { $$('.wq-tk-q', root).forEach((s) => s.replaceWith(document.createTextNode(s.textContent))); root.normalize(); }

async function tashkeelSelection(mode) {
  const range = (lastRange && page.contains(lastRange.startContainer)) ? lastRange.cloneRange() : null;
  if (!range) { toast(t('tkNothing')); return; }
  const blocks = tkBlocks(range);
  if (!blocks.length) { toast(t('tkNothing')); return; }
  if (mode === 'accept') { // المؤشر بدون تحديد ← المستند كله
    const roots = range.collapsed ? [page] : blocks;
    let n = 0; roots.forEach((b) => { n += $$('.wq-tk-q', b).length; tkUnwrap(b); });
    markDirty(); toast(t('tkAccepted').replace('{n}', fmtNum(n))); return;
  }
  if (mode !== 'remove') {
    toast(t('tkLoading'));
    try { await loadTashkeel(); } catch (e) { toast(t('tkUnavailable')); return; }
  }
  takeSnapshot(t('tkSnap'));
  if (mode !== 'remove') toast(t('tkWorking'));
  const whole = range.collapsed;
  let words = 0, doubt = 0, quranSkipped = false;
  for (const b of blocks) {
    tkUnwrap(b);
    // نجمع الحروف من عقد النص مع موضع كل حرف
    const items = [];
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: (x) => x.parentElement.closest(TK_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let node, inQ = false;
    while ((node = tw.nextNode())) {
      const s = node.textContent;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '﴿') inQ = true;
        const inRange = !inQ && (whole || tkInRange(range, node, i));
        if (inQ && ch !== '﴿' && ch !== '﴾' && TK_CHARS.includes(ch) && ch !== ' ') quranSkipped = quranSkipped || whole || tkInRange(range, node, i);
        items.push({ node, i, ch, inRange });
        if (ch === '﴾') inQ = false;
      }
    }
    // حرف النموذج: كل حرف معروف (والأرقام ← #)، والحركات تلميحات للحرف السابق
    const model = [];
    items.forEach((it) => {
      if (TK_HARAKAT.test(it.ch)) { const last = model[model.length - 1]; if (last && last.it.node === it.node && last.it.i === it.i - last.extra - 1) { last.hint += it.ch; last.extra++; } it.diacOf = last; return; }
      const id = TK_NUM.test(it.ch) ? 2 : TK_CHARS.indexOf(it.ch) + 1;
      if (id > 0) { const m = { it, id, hint: '', extra: 0 }; model.push(m); it.m = m; }
    });
    const doubtTh = TK_DOUBT[mode] || 0.9;
    if (mode !== 'remove' && model.length) {
      // تقطيع بالجمل حتى لا تطول المدخلات
      let start = 0;
      while (start < model.length) {
        let end = Math.min(model.length, start + 400);
        if (end < model.length) { for (let k = end - 1; k > start + 100; k--) if ('.؟!؛'.includes(model[k].it.ch)) { end = k + 1; break; } }
        const part = model.slice(start, end);
        const res = await tkRun(part.map((m) => m.id), part.map((m) => tkHintId(m.hint)));
        const rc = TK.catt ? await tkRunCatt(part) : null, rr = TK.rawi ? await tkRunRawi(part) : null;
        part.forEach((m, k) => { m.r = res[k]; m.v = { L: tkCanon(res[k].d) }; if (rc) m.v.C = rc[k]; if (rr) m.v.R = rr[k]; });
        start = end;
      }
    }
    // الكلمات: تتابع الحروف العربية
    let w = null; const wordsArr = [];
    items.forEach((it) => {
      const letter = it.m && it.m.id >= 18;
      if (letter) { if (!w) { w = { items: [] }; wordsArr.push(w); } w.items.push(it); }
      else if (!(it.diacOf && w)) w = null;
    });
    // الحركة الجديدة لكل حرف حسب الوضع
    wordsArr.forEach((wd) => {
      const letters = wd.items.filter((it) => it.inRange);
      if (!letters.length) return;
      words++;
      if (mode === 'remove') { letters.forEach((it) => { it.newDiac = ''; }); return; }
      const engines = wd.items[0].m.v ? Object.keys(wd.items[0].m.v) : [];
      if (engines.length >= 2) {
        // التصويت: لكل محرك تشكيل الكلمة كاملة (حركة المستخدم إن وُجدت تُفرض على الجميع)
        const last = wd.items.length - 1;
        const cand = {}; engines.forEach((e) => { cand[e] = tkRulesOn(wd.items, wd.items.map((it) => it.m.hint ? tkCanon(it.m.hint) : (it.m.v[e] || ''))); });
        const keyOf = (e) => mode === 'ends' ? cand[e][last] : cand[e].join('|');
        const count = {}; engines.forEach((e) => { const k = keyOf(e); count[k] = (count[k] || 0) + 1; });
        const order = ['C', 'R', 'L'].filter((e) => engines.includes(e));
        const win = order.reduce((a, e) => count[keyOf(e)] > count[keyOf(a)] ? e : a, order[0]);
        const top = count[keyOf(win)], unanimous = top === engines.length;
        wd.items.forEach((it, k) => { if (!it.inRange) return; it.newDiac = (mode === 'ends' && k !== last) ? null : cand[win][k]; });
        tkSpellingRules(wd.items);
        // المراجعة: الدقيقة تعلّم أي خلاف، والعادية تعلّم غياب الأغلبية أو مخالفة CATT
        const doubtful = mode === 'strict' ? !unanimous : (top === 1 || (engines.includes('C') && keyOf('C') !== keyOf(win)));
        if (doubtful) {
          const alt = order.find((e) => keyOf(e) !== keyOf(win));
          if (alt) { const tmp = wd.items.map((it, k) => ({ it, d: (mode === 'ends' && k !== last) ? null : cand[alt][k] })); wd.altStr = tkWordString(tmp); }
          wd.doubt = wd.items[last]; doubt++;
        }
        return;
      }
      // محرك واحد فقط: المراجعة بثقة النموذج
      letters.forEach((it) => {
        const isLast = it === wd.items[wd.items.length - 1];
        if (mode === 'ends' && !isLast) it.newDiac = null; // يبقى كما هو
        else it.newDiac = it.m.r ? it.m.r.d : '';
      });
      tkSpellingRules(wd.items);
      const scored = letters.filter((it) => it.newDiac !== null && it.m.r);
      const worst = scored.reduce((a, it) => (!a || it.m.r.conf < a.m.r.conf) ? it : a, null);
      if (worst && worst.m.r.conf < doubtTh) { wd.doubt = worst; doubt++; }
    });
    // إعادة كتابة عقد النص
    const byNode = new Map();
    items.forEach((it) => { if (!byNode.has(it.node)) byNode.set(it.node, []); byNode.get(it.node).push(it); });
    const wordOf = new Map(); wordsArr.forEach((wd) => wd.items.forEach((it) => wordOf.set(it, wd)));
    byNode.forEach((its, nd) => {
      const frag = document.createDocumentFragment();
      let buf = '', span = null, spanWord = null;
      const flush = () => { if (!buf) return; (span || frag).append(document.createTextNode(buf)); buf = ''; };
      its.forEach((it) => {
        const owner = it.diacOf ? it.diacOf.it : it;
        const wd = wordOf.get(owner);
        const wantSpan = wd && wd.doubt && wd.items[0].node === nd && wd.items[wd.items.length - 1].node === nd ? wd : null;
        if (wantSpan !== spanWord) { flush(); if (span) frag.append(span); span = null; spanWord = wantSpan; if (wantSpan) { span = document.createElement('span'); span.className = 'wq-tk-q'; span.dataset.alt = tkAltWord(wantSpan); } }
        if (it.diacOf) { if (it.diacOf.it.newDiac === null || it.diacOf.it.newDiac === undefined) buf += it.ch; return; }
        buf += it.ch;
        if (it.newDiac !== null && it.newDiac !== undefined) buf += it.newDiac;
      });
      flush(); if (span) frag.append(span);
      nd.replaceWith(frag);
    });
  }
  markDirty(); onInput();
  if (mode === 'remove') toast(t('tkRemoved').replace('{n}', fmtNum(words)));
  else toast(t('tkDone').replace('{n}', fmtNum(words)).replace('{m}', fmtNum(doubt)) + (quranSkipped ? ' ' + t('tkSkippedQuran') : ''));
}
/* قواعد إملائية ثابتة تكمّل النموذج (لا تغيّر ما قرره، تملأ الفراغ فقط):
   ١) الحرف الذي قبل ألف المد بلا حركة ← فتحة (صَباحًا ← صَبَاحًا)، إلا ألف «ال» بعد حرف جر أو عطف (بِالْ)
   ٢) لام «ال» القمرية بلا حركة ← سكون (الأَنْدَلُس ← الْأَنْدَلُس)
   ٣) إ بلا حركة ← كسرة */
function tkSpellingRules(w) {
  const set = (it, d) => { if (it && it.inRange && it.newDiac === '') it.newDiac = d; };
  w.forEach((it) => { if (it.ch === 'إ') set(it, 'ِ'); }); // ٣) الهمزة تحت الألف كسرة دائماً (إِلَى، إِنَّ)
  for (let k = 0; k < w.length - 1; k++) {
    if (w[k + 1].ch !== 'ا') continue;
    // ألف «ال» بعد حرف (بِالْ، كَالْ، وَالْ) أو حرفين (وَبِالْ، فَلِلْ…) ألف وصل لا يُفتح ما قبلها
    const article = (k === 0 && w.length > 3 && 'وفبكل'.includes(w[0].ch) && w[2].ch === 'ل') ||
      (k === 1 && w.length > 4 && 'وف'.includes(w[0].ch) && 'بكل'.includes(w[1].ch) && w[3].ch === 'ل');
    if (!article && w[k].ch !== 'ا') set(w[k], 'َ');
  }
  let a = -1;
  if (w.length > 2 && w[0].ch === 'ا' && w[1].ch === 'ل') a = 1;
  else if (w.length > 3 && 'وفبكل'.includes(w[0].ch) && w[1].ch === 'ا' && w[2].ch === 'ل') a = 2;
  if (a > 0) {
    const nx = w[a + 1], nd = nx ? (nx.newDiac !== null && nx.newDiac !== undefined ? nx.newDiac : nx.m.hint) : '';
    if (nx && !TK_SUN.includes(nx.ch) && !(nd || '').includes('ّ')) set(w[a], 'ْ');
  }
}
/* نفس القواعد الإملائية على تشكيل مرشّح (قبل المقارنة، حتى لا يُعدّ نقص كسرة إ أو فتحة ما قبل الألف خلافاً) */
function tkRulesOn(items, diacs) {
  const w = items.map((it, k) => ({ ch: it.ch, inRange: true, newDiac: diacs[k], m: it.m }));
  tkSpellingRules(w);
  return w.map((x) => x.newDiac);
}
function tkInRange(range, node, i) { try { return range.comparePoint(node, i) === 0 && !(range.endContainer === node && range.endOffset === i); } catch (e) { return false; } }
/* الكلمة بحركات معيّنة (null = كما كتبها المستخدم) */
function tkWordString(list) { return list.map(({ it, d }) => it.ch + (d === null || d === undefined ? (it.m.hint || '') : d)).join(''); }
/* البديل: تشكيل المحرك المخالف، أو الحركة الثانية في أضعف حرف (محرك واحد) */
function tkAltWord(wd) {
  if (wd.altStr) return wd.altStr;
  let s = '';
  wd.items.forEach((it) => {
    s += it.ch;
    const d = it === wd.doubt ? it.m.r.alt : (it.newDiac !== null && it.newDiac !== undefined ? it.newDiac : (it.m.hint || ''));
    s += d;
  });
  return s;
}

/* قائمة المراجعة عند الضغط على كلمة تحتها خط */
function initTashkeelEvents() {
  page.addEventListener('click', (e) => {
    const sp = e.target.closest && e.target.closest('.wq-tk-q'); if (!sp) return;
    closeTkMenu();
    const cur = sp.textContent, alt = sp.dataset.alt || '', bare = cur.replace(/[ً-ْ]/g, '');
    const m = el('div', { class: 'ctx-menu', id: 'tkMenu', role: 'menu' });
    const item = (label, txt) => m.append(el('button', { class: 'ctx-item tk-opt', role: 'menuitem', html: label, onmousedown: (ev) => ev.preventDefault(),
      onclick: () => { closeTkMenu(); sp.replaceWith(document.createTextNode(txt)); markDirty(); onInput(); } }));
    item('<span class="tk-w">' + E(cur) + '</span> <span class="wq-note">' + E(t('tkKeep')) + '</span>', cur);
    if (alt && alt !== cur) item('<span class="tk-w">' + E(alt) + '</span> <span class="wq-note">' + E(t('tkUse')) + '</span>', alt);
    item('<span class="tk-w">' + E(bare) + '</span> <span class="wq-note">' + E(t('tkStrip')) + '</span>', bare);
    document.body.append(m);
    const r = sp.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(r.left, innerWidth - m.offsetWidth - 6)) + 'px';
    m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 6) + 'px';
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#tkMenu')) closeTkMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTkMenu(); });
}
function closeTkMenu() { const m = document.getElementById('tkMenu'); if (m) m.remove(); }
