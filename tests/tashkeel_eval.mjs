// التشغيل: python3 build.py ثم bash run_srv.sh node tests/tashkeel_eval.mjs full  (ثم python3 tests/tashkeel_score.py)
// يقيس خط التشكيل الحقيقي في ورّاق على جمل الذهب
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const gold = fs.readFileSync('tests/tashkeel_gold.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage(); await pg.goto('http://localhost:8765/index.html'); await pg.waitForTimeout(300);
const mode = process.argv[2] || 'full';
const out = await pg.evaluate(async ([g, mode]) => {
  document.querySelectorAll('.start-ov').forEach((x) => x.remove());
  const bare = (s) => s.replace(/[ً-ْ]/g, '');
  const A = window.WQ_API; A.loadDocIntoEditor(Object.assign(A.newDocModel('ar'), { content: { html: g.map((s) => '<p>' + bare(s) + '</p>').join('') } }));
  const r = document.createRange(); r.selectNodeContents(document.querySelector('#page')); lastRange = r;
  await A.tashkeelSelection(mode);
  return Array.from(document.querySelectorAll('#page p')).map((p) => Array.from(p.childNodes).map((n) => n.nodeType === 3 ? n.textContent : (n.classList.contains('wq-tk-q') ? '⟦' + n.textContent + '⟧' : n.textContent)).join(''));
}, [gold, mode]);
fs.writeFileSync('/tmp/tashkeel_pred_' + mode + '.txt', out.join('\n'));
await b.close();
