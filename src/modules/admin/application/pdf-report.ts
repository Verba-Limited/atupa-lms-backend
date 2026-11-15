import PDFDocument from 'pdfkit';

export interface PdfSection {
  heading: string;
  /** Label/value pairs shown as a short list. */
  facts?: Array<[string, string | number | null | undefined]>;
  table?: { columns: string[]; rows: Array<Array<string | number | null>> };
  empty?: string;
}

const GREEN = '#0b7a3e';
const MAX_ROWS = 200;

/** A plain, printable report for meetings (M-23). */
export function renderPdfReport(input: {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(GREEN).fontSize(18).text('ATUPA LMS');
    doc.fillColor('#222').fontSize(15).text(input.title);
    doc
      .fillColor('#666')
      .fontSize(9)
      .text(
        `${input.subtitle ? `${input.subtitle} · ` : ''}Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      );
    doc.moveDown();

    for (const section of input.sections) {
      doc.fillColor(GREEN).fontSize(12).text(section.heading);
      doc.moveDown(0.3).fillColor('#222').fontSize(9.5);
      for (const [label, value] of section.facts ?? []) {
        doc.text(`${label}: ${value ?? '-'}`);
      }
      if (section.table) {
        const { columns, rows } = section.table;
        if (!rows.length) {
          doc.fillColor('#666').text(section.empty ?? 'No data yet.');
        } else {
          drawTable(doc, columns, rows.slice(0, MAX_ROWS));
          if (rows.length > MAX_ROWS) {
            doc
              .fillColor('#666')
              .text(`… ${rows.length - MAX_ROWS} more rows in the CSV export`);
          }
        }
      }
      doc.moveDown();
    }
    doc.end();
  });
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: string[],
  rows: Array<Array<string | number | null>>,
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const colWidth = width / columns.length;
  const line = (cells: Array<string | number | null>, bold = false) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#222');
    let height = 0;
    cells.forEach((cell, i) => {
      const text = cell === null || cell === undefined ? '-' : String(cell);
      doc.text(text, left + i * colWidth, y, { width: colWidth - 6 });
      height = Math.max(height, doc.y - y);
    });
    doc.y = y + height + 3;
    doc.x = left;
  };
  line(columns, true);
  rows.forEach((r) => line(r));
  doc.font('Helvetica');
}
