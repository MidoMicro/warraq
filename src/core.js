/* ===== core: الثوابت والحالة والأدوات العامة ===== */
const APP_VERSION = '0.11.0';
const APP_STAGE = '9';
const APP_UPDATED = '2026-11-18';
const FILE_FORMAT = 'warraq';
const FILE_FORMAT_VERSION = 1;
const LS_KEY = 'warraq.autosave.v1';
const LS_PREFS = 'warraq.prefs.v1';

const WQ = {
  ui: 'ar',
  doc: null,          // { meta, settings, content }
  dirty: false,       // تعديلات لم ت\u064Fحفظ في ملف
  downloads: null,    // قدرة الحفظ في المعاينة (إن وجدت)
  prefs: { ui: 'ar', dailyGoal: 1000, goalDay: '', goalDone: 0, showNav: true, showRefs: true, zoom: 100 }
};

const t = (k) => (I18N[WQ.ui] && I18N[WQ.ui][k] !== undefined) ? I18N[WQ.ui][k] : (I18N.ar[k] ?? k);
/* نصوص تُطبع داخل المستند (عناوين القوائم والفهارس): بلغة المستند لا بلغة الواجهة */
const tDoc = (k) => { const L = WQ.doc && WQ.doc.settings.lang === 'ar' ? 'ar' : 'en'; return I18N[L][k] !== undefined ? I18N[L][k] : t(k); };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const nowISO = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().slice(0, 10);

/* ---------- الأرقام ---------- */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toArabicDigits = (s) => s.replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
const toWesternDigits = (s) => s.replace(/[\u0660-\u0669]/g, (d) => String(AR_DIGITS.indexOf(d)));
/* تنسيق رقم للواجهة حسب لغة الواجهة */
const fmtNum = (n) => {
  const s = Math.round(n).toLocaleString('en-US');
  return WQ.ui === 'ar' ? toArabicDigits(s).replace(/,/g, '٬') : s;
};

/* ---------- هوامش الصفحة (سم): الجاهزة أو المخصصة من المسطرة ---------- */
const MARGIN_PRESETS = { normal: { t: 2.5, b: 2.5, l: 2.5, r: 2.5 }, narrow: { t: 1.27, b: 1.27, l: 1.27, r: 1.27 }, wide: { t: 2.54, b: 2.54, l: 5.08, r: 5.08 } };
function pageMargins(s) {
  if (s.margins === 'custom') {
    const v = (x, d) => { const n = parseFloat(x); return isFinite(n) ? Math.min(8, Math.max(0.3, n)) : d; };
    return { t: v(s.mT, 2.5), b: v(s.mB, 2.5), l: v(s.mL, 2.5), r: v(s.mR, 2.5) };
  }
  return MARGIN_PRESETS[s.margins] || MARGIN_PRESETS.normal;
}
const pageWidthCm = (s) => s.pageSize === 'letter' ? 21.59 : 21;
const pageHeightCm = (s) => s.pageSize === 'letter' ? 27.94 : 29.7;

/* ---------- مستند جديد ---------- */
function newDocModel(lang = 'ar') {
  return {
    meta: { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', author: '', created: nowISO(), modified: nowISO() },
    settings: {
      lang,                                   // ar | en | fr
      numerals: lang === 'ar' ? 'arabic' : 'western', // arabic | western
      pageSize: 'a4', margins: 'normal', lineSpacing: '15',
      citeStyle: 'notes'                      // notes | apa | vancouver | ieee | harvard | chicago | mla
    },
    content: { html: '' },
    references: [],
    footnotes: {},
    snapshots: []
  };
}

/* ---------- أدوات صغيرة ---------- */
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
