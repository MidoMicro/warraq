/* ===== tashkeel: التشكيل الآلي بنظام الاقتراح والمراجعة =====
   المحرك: نموذج libtashkeel (Musharraf Omer، رخصة MIT) يعمل محلياً بـ onnxruntime-web (رخصة MIT)، بدون إنترنت.
   - يحترم الحركات التي كتبها المستخدم (تُرسل للنموذج كتلميحات).
   - لا يلمس الآيات المدرجة ولا ما بين ﴿ ﴾ ولا الحواشي والاستشهادات.
   - الكلمات التي ثقة النموذج فيها أقل من الحد يوضع تحتها خط، والضغط عليها يعرض البديل. */
const TK_CHARS = ' #!"()-./:[]«»،؛؟ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي'; // المعرّف = الموضع + 1 (صفر للحشو)
const TK_DIAC = ['', 'ً', 'ٌ', 'ٍ', 'َ', 'ُ', 'ِ', 'ًّ', 'ٌّ', 'ٍّ', 'َّ', 'ُّ', 'ِّ', 'ْ', 'ّ']; // المعرّف = الموضع + 1
const TK_HARAKAT = /[ً-ْ]/;
const TK_NUM = /[0-9٠-٩]/;
const TK_DOUBT = 0.75;
const TK_SKIP = '.wq-ayah,.wq-ayah-ref,.wq-fn,.wq-cite,sup,.wq-toc,.wq-bib';
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
    const session = await ort.InferenceSession.create(new Uint8Array(await get('tashkeel/model.onnx')), { executionProviders: ['wasm'] });
    TK = { ort, session };
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
    if (mode !== 'remove' && model.length) {
      // تقطيع بالجمل حتى لا تطول المدخلات
      let start = 0;
      while (start < model.length) {
        let end = Math.min(model.length, start + 400);
        if (end < model.length) { for (let k = end - 1; k > start + 100; k--) if ('.؟!؛'.includes(model[k].it.ch)) { end = k + 1; break; } }
        const part = model.slice(start, end);
        const res = await tkRun(part.map((m) => m.id), part.map((m) => tkHintId(m.hint)));
        part.forEach((m, k) => { m.r = res[k]; });
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
      letters.forEach((it, idx) => {
        const isLast = it === wd.items[wd.items.length - 1];
        if (mode === 'remove') it.newDiac = '';
        else if (mode === 'ends' && !isLast) it.newDiac = null; // يبقى كما هو
        else it.newDiac = it.m.r ? it.m.r.d : '';
      });
      if (mode === 'remove') return;
      const scored = letters.filter((it) => it.newDiac !== null && it.m.r);
      const worst = scored.reduce((a, it) => (!a || it.m.r.conf < a.m.r.conf) ? it : a, null);
      if (worst && worst.m.r.conf < TK_DOUBT) { wd.doubt = worst; doubt++; }
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
function tkInRange(range, node, i) { try { return range.comparePoint(node, i) === 0 && !(range.endContainer === node && range.endOffset === i); } catch (e) { return false; } }
/* البديل: نفس الكلمة مع الحركة الثانية في أضعف حرف */
function tkAltWord(wd) {
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
