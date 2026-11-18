// يجهّز واجهة ورّاق لنسخة الكمبيوتر: ينسخ dist، ويحمّل الخطوط العربية (رخصة OFL) لتعمل بدون إنترنت
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'dist');
const WEB = path.join(__dirname, 'web');
const FONTS = [
  { dir: 'amiri', family: 'Amiri' }, { dir: 'amiriquran', family: 'Amiri Quran' },
  { dir: 'notonaskharabic', family: 'Noto Naskh Arabic' }, { dir: 'cairo', family: 'Cairo' }, { dir: 'tajawal', family: 'Tajawal' }
];
function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); }
}
// على GitHub Actions نستخدم مفتاح البناء المؤقت (GITHUB_TOKEN) حتى لا نصطدم بحد طلبات GitHub
const GH_HEADERS = Object.assign({ 'User-Agent': 'warraq-build' }, process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {});
async function getJson(u) { const r = await fetch(u, { headers: GH_HEADERS }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); }
async function main() {
  fs.rmSync(WEB, { recursive: true, force: true });
  copyDir(SRC, WEB);
  const fdir = path.join(WEB, 'fonts'); fs.mkdirSync(fdir, { recursive: true });
  let css = '', ok = 0; const failed = [];
  for (const f of FONTS) {
    try {
      const list = await getJson('https://api.github.com/repos/google/fonts/contents/ofl/' + f.dir);
      for (const it of list) {
        if (!/\.(ttf|txt)$/i.test(it.name)) continue;
        if (/\.txt$/i.test(it.name) && !/OFL/i.test(it.name)) continue;
        const r = await fetch(it.download_url); if (!r.ok) throw new Error('dl ' + it.name);
        const local = f.dir + '-' + it.name.replace(/[\[\],]/g, '_');
        fs.writeFileSync(path.join(fdir, local), Buffer.from(await r.arrayBuffer()));
        if (!/\.ttf$/i.test(it.name)) continue;
        const variable = /\[/.test(it.name);
        const weight = variable ? '200 1000' : (/Black/.test(it.name) ? 900 : /ExtraBold/.test(it.name) ? 800 : /Bold/.test(it.name) ? 700 : /Medium/.test(it.name) ? 500 : /Light/.test(it.name) ? 300 : 400);
        const style = /Italic/.test(it.name) ? 'italic' : 'normal';
        css += "@font-face{font-family:'" + f.family + "';src:url('fonts/" + local + "') format('truetype');font-weight:" + weight + ';font-style:' + style + ';font-display:swap}\n';
        ok++;
      }
      console.log('  ✓ ' + f.family);
    } catch (e) { console.log('  ✗ ' + f.family + ': ' + e.message); failed.push(f.family); }
  }
  fs.writeFileSync(path.join(WEB, 'fonts.css'), css);
  let html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf-8');
  if (ok) html = html.replace(/<link rel="preconnect"[^>]*>\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts.css">');
  fs.writeFileSync(path.join(WEB, 'index.html'), html);
  console.log(ok ? 'Fonts bundled: ' + ok + ' files (offline-ready)' : 'WARNING: fonts not downloaded; app will use Google Fonts when online');
  // في البناء الآلي: لازم كل الخطوط تتحمّل، وإلا البناء يفشل بدل ما يطلع برنامج ناقص
  if (process.env.STRICT_FONTS && failed.length) { console.error('STRICT_FONTS: missing fonts'); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
