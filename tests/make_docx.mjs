import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, FootnoteReferenceRun, AlignmentType } = d;
const doc = new Document({
  footnotes: { 1: { children: [new Paragraph({ children: [new TextRun('نولز، التعلم الذاتي، ص 18.')] })] } },
  sections: [{ children: [
    new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: true, children: [new TextRun({ text: 'الفصل الأول', rightToLeft: true })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.JUSTIFIED, children: [
      new TextRun({ text: 'يعد التعلم ', rightToLeft: true }), new TextRun({ text: 'الذاتي', bold: true, rightToLeft: true }),
      new TextRun({ text: ' مفهوما مهما', rightToLeft: true }), new FootnoteReferenceRun(1)] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Background')] }),
    new Paragraph({ children: [new TextRun({ text: 'Italic text', italics: true })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun('نقطة أولى')] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun('نقطة ثانية')] }),
    new Table({ rows: [
      new TableRow({ children: [new TableCell({ children: [new Paragraph('الدراسة')] }), new TableCell({ children: [new Paragraph('السنة')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph('الشمري')] }), new TableCell({ children: [new Paragraph('2021')] })] }) ] }),
    new Paragraph({ children: [new TextRun('النهاية')] })
  ] }]
});
fs.writeFileSync('tests/fixtures/sample.docx', await Packer.toBuffer(doc));
console.log('docx ok');
