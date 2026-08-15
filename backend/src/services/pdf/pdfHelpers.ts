export const MARGIN = 54;
export const PAGE_WIDTH = 595.28; // A4 pt
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export const COLORS = {
  navy: "#0f2540",
  slate: "#334155",
  muted: "#64748b",
  border: "#cbd5e1",
  panel: "#f1f5f9",
  white: "#ffffff",
  LOW: "#16a34a",
  MEDIUM: "#d97706",
  HIGH: "#dc2626",
  CRITICAL: "#7c1d1d",
};

export function impactColor(level: string): string {
  return (COLORS as Record<string, string>)[level] ?? COLORS.slate;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export function sectionTitle(doc: PDFKit.PDFDocument, number: number | string, title: string) {
  doc.moveDown(1);
  doc
    .fillColor(COLORS.navy)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(`${number}. ${title}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc
    .moveTo(MARGIN, doc.y + 4)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 4)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);
  doc.fillColor(COLORS.slate).font("Helvetica").fontSize(10.5);
}

export function bulletList(doc: PDFKit.PDFDocument, items: string[], emptyLabel = "Insufficient data") {
  const list = items.length > 0 ? items : [emptyLabel];
  for (const item of list) {
    doc.circle(MARGIN + 3, doc.y + 5, 1.6).fill(COLORS.slate);
    doc
      .fillColor(COLORS.slate)
      .text(item, MARGIN + 12, doc.y - 6, { width: CONTENT_WIDTH - 12 });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.4);
}

export function paragraph(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(COLORS.slate).font("Helvetica").fontSize(10.5).text(text, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: "left",
  });
  doc.moveDown(0.6);
}

export function keyValueRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.navy).text(label, MARGIN, y, { width: 150 });
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.slate).text(value, MARGIN + 160, y, {
    width: CONTENT_WIDTH - 160,
  });
  doc.moveDown(0.3);
}

export function renderImpactBadge(doc: PDFKit.PDFDocument, level: string, confidence: string) {
  const color = impactColor(level);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, 90, 26, 4).fill(color);
  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(level, MARGIN, y + 7, { width: 90, align: "center" });

  doc
    .fillColor(COLORS.slate)
    .font("Helvetica")
    .fontSize(10)
    .text(`Confidence: ${confidence}`, MARGIN + 104, y + 8);

  doc.y = y + 34;
}

/** Adds a per-page footer (and, past the first page, a running header) to every buffered page. */
export function addHeadersAndFooters(doc: PDFKit.PDFDocument, headerText: string, footerText: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);

    if (i > 0) {
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(headerText, MARGIN, 24, { width: CONTENT_WIDTH, align: "left" });
      doc
        .moveTo(MARGIN, 38)
        .lineTo(MARGIN + CONTENT_WIDTH, 38)
        .strokeColor(COLORS.border)
        .stroke();
    }

    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(footerText, MARGIN, doc.page.height - 40, { width: CONTENT_WIDTH - 60, align: "left" });

    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(`Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - 40, {
        width: CONTENT_WIDTH,
        align: "right",
      });
  }
}
