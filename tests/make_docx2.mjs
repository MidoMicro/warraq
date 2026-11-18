// ملف يحاكي الرسائل الحقيقية: بدون أنماط عناوين، فراغات كثيرة، مسافات بادئة، ترقيم "none"
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat } = require('docx');
const body = (t) => new Paragraph({ bidirectional: true, children: [new TextRun({ text: '   ' + t, size: 28, rightToLeft: true })] });
const head = (t, sz = 32) => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: sz })] });
const empty = () => new Paragraph({ children: [new TextRun({ text: '  ', size: 28 })] });
const long = 'هذا نص طويل يحاكي فقرة حقيقية في رسالة علمية ويحتوي على أكثر من مئة وخمسين حرفاً حتى يمكن حساب حجم الخط الأساسي للمتن بشكل صحيح في الاختبار الآلي لبرنامج ورّاق 2024.';
const doc = new Document({
  numbering: { config: [{ reference: 'none', levels: [{ level: 0, format: LevelFormat.NONE, text: '', alignment: AlignmentType.START }] },
                        { reference: 'dec', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1)', alignment: AlignmentType.START }] }] },
  sections: [{ children: [
    empty(), empty(), empty(), empty(),
    head('الفصل الثاني', 48),
    empty(), empty(),
    head('2.1 الإطار النظري:'),
    body(long), empty(), empty(), empty(),
    head('2.1.1 المفهوم'),
    body(long),
    new Paragraph({ numbering: { reference: 'none', level: 0 }, children: [new TextRun({ text: 'فقرة بترقيم مخفي', size: 28 })] }),
    new Paragraph({ numbering: { reference: 'dec', level: 0 }, children: [new TextRun({ text: 'بند مرقم أول', size: 28 })] }),
    new Paragraph({ numbering: { reference: 'dec', level: 0 }, children: [new TextRun({ text: 'بند مرقم ثان', size: 28 })] }),
    new Paragraph({ children: [new TextRun({ text: 'جملة عريضة قصيرة تنتهي بنقطة.', bold: true, size: 28 })] }),
    empty(), empty()
  ] }]
});
fs.writeFileSync('tests/fixtures/real-like.docx', await Packer.toBuffer(doc));
console.log('ok');
