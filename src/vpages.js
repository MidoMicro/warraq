/* ===== vpages: الصفحات منفصلة وقت الكتابة =====
   لا نلمس محتوى المستند أبداً: الفقرة التي لا تتسع في صفحتها تنزل كاملة لأول الصفحة التالية
   بقاعدة CSS مولّدة (#page > :nth-child(n){margin-top}) في ورقة أنماط خاصة، والصفحات نفسها
   بطاقات بيضاء مرسومة خلف النص، وفيها أرقام الصفحات. الحواشي تبقى في آخر المستند وقت الكتابة. */
const VP = { on: false, raf: 0, last: 0, pages: 1, tops: null, P: 0, gap: 0 };
const VP_GAP = 24; // المسافة بين الصفحات (بكسل)
function vpEnabled() {
  return WQ.prefs.sepPages !== false && !isRuled() && !document.body.classList.contains('pages-mode') && window.innerWidth > 900;
}
function vpStyleEl() {
  let s = $('#vpStyle');
  if (!s) { s = el('style', { id: 'vpStyle' }); document.head.append(s); }
  return s;
}
function vpDeco() {
  let d = $('#vpDeco');
  if (!d) { d = el('div', { id: 'vpDeco', class: 'vp-deco no-print', 'aria-hidden': 'true' }); $('#sheet').prepend(d); }
  return d;
}
function refreshPagesSoon() {
  if (VP.raf) return;
  const wait = Math.max(0, (page.childElementCount > 800 ? 300 : 120) - (performance.now() - VP.last));
  VP.raf = setTimeout(() => requestAnimationFrame(() => { VP.raf = 0; layoutPages(); }), wait);
}
function layoutPages() {
  VP.last = performance.now();
  const sheet = $('#sheet'); if (!sheet || !WQ.doc) return;
  const st = vpStyleEl();
  const on = vpEnabled();
  document.body.classList.toggle('vpages', on);
  if (!on) { if (st.textContent) st.textContent = ''; sheet.style.minHeight = ''; vpDeco().innerHTML = ''; VP.on = false; VP.tops = null; return; }
  VP.on = true;
  const s = WQ.doc.settings, m = pageMargins(s);
  const H = pageHeightCm(s) * CM, mt = m.t * CM, mb = m.b * CM, G = VP_GAP, P = H + G;
  VP.P = P;
  // 1) نقيس بلا دفع (قراءة واحدة لكل الفقرات)
  st.textContent = '';
  const sr = sheet.getBoundingClientRect(), z = sr.width / (sheet.offsetWidth || 1) || 1;
  const kids = Array.from(page.children);
  const geo = kids.map((b) => { const r = b.getBoundingClientRect(); return { t: (r.top - sr.top) / z, h: r.height / z }; });
  const fz = $('#fnZone'), fr = fz.getBoundingClientRect();
  const fnBottom = fz.offsetHeight ? (fr.bottom - sr.top) / z : 0;
  // 2) نحسب الدفع: كل دفع يُزيح ما بعده بنفس المقدار
  let S = 0, rules = '';
  const tops = [];
  const cTop = (k) => k * P + mt, cBot = (k) => k * P + H - mb, maxH = H - mt - mb;
  for (let i = 0; i < kids.length; i++) {
    const b = kids[i], g = geo[i];
    let t = g.t + S;
    const k = Math.max(0, Math.floor(t / P));
    const prev = kids[i - 1];
    const forced = prev && prev.tagName === 'HR' && prev.classList.contains('wq-pagebreak');
    // العنوان لا يبقى وحده في آخر الصفحة: يحتاج مكاناً للفقرة التي بعده (أو لسطرين منها إن كانت طويلة)
    let headExtra = 0;
    if (/^H[1-3]$/.test(b.tagName) && geo[i + 1]) { const nx = geo[i + 1]; headExtra = nx.h <= maxH / 2 ? (nx.t + nx.h) - (g.t + g.h) : 60; }
    let target = null;
    if (i > 0) {
      if (t > cBot(k) - 0.5) target = cTop(k + 1);                 // بدأت في الهامش السفلي أو الفاصل
      else if (t < cTop(k) - 0.5) target = cTop(k);                // في الهامش العلوي
      else if (forced && t > cTop(k) + 1) target = cTop(k + 1);    // بعد فاصل صفحة
      else if (t + g.h + headExtra > cBot(k) + 0.5 && t > cTop(k) + 1) target = cTop(k + 1); // لا تتسع: تنزل كاملة
    }
    if (target !== null && target - t > 0.5) {
      const delta = target - t;
      const gapNow = g.t - (geo[i - 1].t + geo[i - 1].h);
      rules += '#page>:nth-child(' + (i + 1) + '){margin-top:' + (Math.round((gapNow + delta) * 100) / 100) + 'px!important}';
      S += delta; t = target;
    }
    tops.push(t);
  }
  st.textContent = '@media screen{body.vpages ' + rules.replace(/}(?=#page)/g, '}body.vpages ') + '}';
  VP.tops = tops;
  // 3) عدد الصفحات وبطاقاتها
  const lastB = Math.max(kids.length ? tops[tops.length - 1] + geo[geo.length - 1].h : mt, fnBottom ? fnBottom + S : 0);
  const n = Math.max(1, Math.ceil((lastB + mb) / P - 1e-6));
  VP.pages = n;
  sheet.style.minHeight = (n * P - G) + 'px';
  const deco = vpDeco();
  const hideFirst = s.hideFirstNum !== false;
  const lab = (k) => (s.numerals === 'arabic' && s.lang === 'ar') ? toArabicDigits(String(k)) : String(k);
  if (deco.childElementCount !== n || deco.dataset.k !== [H, mb, s.numerals, s.lang].join('|')) {
    deco.dataset.k = [H, mb, s.numerals, s.lang].join('|');
    let h = '';
    for (let k = 0; k < n; k++) h += '<div class="vp-card" style="top:' + (k * P) + 'px;height:' + H + 'px"><span class="vp-num" style="bottom:' + Math.max(8, mb / 2 - 8) + 'px">' + (k === 0 && hideFirst ? '' : lab(k + 1)) + '</span></div>';
    deco.innerHTML = h;
  }
  if (typeof updateStatus === 'function' && VP._n !== n) { VP._n = n; updateStatus(); }
}
/* رقم الصفحة وقت الكتابة لعنصر داخل المستند */
function vpPageOf(elm) {
  if (!VP.on || !VP.P) return 0;
  const sheet = $('#sheet'), sr = sheet.getBoundingClientRect(), z = sr.width / (sheet.offsetWidth || 1) || 1;
  const t = (elm.getBoundingClientRect().top - sr.top) / z;
  return Math.max(1, Math.floor(t / VP.P) + 1);
}
function initVPages() {
  page.addEventListener('input', refreshPagesSoon);
  page.addEventListener('load', refreshPagesSoon, true); // الصور
  window.addEventListener('resize', refreshPagesSoon);
  try { document.fonts.ready.then(refreshPagesSoon); document.fonts.addEventListener('loadingdone', refreshPagesSoon); } catch (e) {}
  refreshPagesSoon();
}
