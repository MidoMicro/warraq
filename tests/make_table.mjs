// جدول برأس مدمج (مثل جداول الرسائل): خلية "البند" مدمجة رأسياً، وأقسام مدمجة أفقياً على 3 أعمدة، 13 عمود
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, VerticalMergeType, AlignmentType } = require('docx');
const P = (t, c) => new Paragraph({ bidirectional: true, alignment: c ? AlignmentType.CENTER : AlignmentType.BOTH, children: [new TextRun({ text: t, rightToLeft: true, size: 24 })] });
const cell = (t, o = {}) => new TableCell({ children: [P(t, o.c)], columnSpan: o.span, verticalMerge: o.vm });
const depts = ['قسم المختبرات الإكلينيكية والتعقيم والمسار الصحي', 'قسم العلاج الطبيعي والتأهيل الصحي', 'قسم التمريض', 'اجمالي العدد بالكلية مع التعقيم والمسار الصحي'];
const subs = ['شطر الطلاب', 'شطر الطالبات', 'اجمالي'];
const data = [['عدد الطلبة', '221', '346', '567', '6', '69', '75', '57', '93', '150', '284', '508', '792'],
  ['عدد الأعضاء', '8', '8', '16', '5', '7', '12', '6', '12', '18', '21', '34', '46'],
  ['نسبة الطلبة للأعضاء', '1:28', '1:35', '1:35', '1:1', '1:10', '1:6', '1:9', '1:8', '1:8', '1:14', '1:15', '1:17']];
const rows = [
  new TableRow({ tableHeader: true, children: [cell('البند', { vm: VerticalMergeType.RESTART }), ...depts.map((d) => cell(d, { span: 3, c: true }))] }),
  new TableRow({ tableHeader: true, children: [cell('', { vm: VerticalMergeType.CONTINUE }), ...[0, 1, 2, 3].flatMap(() => subs.map((s) => cell(s, { c: true })))] }),
  ...data.map((r) => new TableRow({ children: r.map((x, i) => cell(x, { c: i > 0 })) }))
];
const widths = [1300, ...Array(12).fill(700)];
const doc = new Document({ sections: [{ children: [
  P('نسبة أعداد الطلاب والطالبات الى أعضاء هيئة التدريس بالكلية:'),
  new Table({ rows, visuallyRightToLeft: true, columnWidths: widths, width: { size: 9700, type: WidthType.DXA } }),
  P('أقسام وتخصصات أعضاء هيئة التدريس بالكلية:')
] }] });
fs.writeFileSync('fixtures/merged-table.docx', await Packer.toBuffer(doc));
console.log('ok');
