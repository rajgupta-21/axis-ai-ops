import PDFDocument from "pdfkit";
import { AnalysisRecord } from "@/domain/analysis";

const MARGIN = 54;
const PAGE_WIDTH = 595.28; // A4 pt
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
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

function impactColor(level: string): string {
  return (COLORS as Record<string, string>)[level] ?? COLORS.slate;
}

function formatDate(iso: string): string {
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

function sectionTitle(doc: PDFKit.PDFDocument, number: number, title: string) {
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

function bulletList(doc: PDFKit.PDFDocument, items: string[], emptyLabel = "Insufficient data") {
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

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(COLORS.slate).font("Helvetica").fontSize(10.5).text(text, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: "left",
  });
  doc.moveDown(0.6);
}

function keyValueRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.navy).text(label, MARGIN, y, { width: 150 });
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.slate).text(value, MARGIN + 160, y, {
    width: CONTENT_WIDTH - 160,
  });
  doc.moveDown(0.3);
}

export async function buildAnalysisReportPdf(
  record: AnalysisRecord,
  reportNumber: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: `Server Impact Analysis Report — ${record.hostname}`,
        Author: "Server Version & Patch Impact Analysis",
        Subject: `${record.component} upgrade impact analysis`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderCover(doc, record, reportNumber);

      doc.addPage();
      sectionTitle(doc, 2, "Executive Summary");
      paragraph(doc, record.analysis.executiveSummary);
      keyValueRow(doc, "Impact Level", record.impactLevel);
      keyValueRow(doc, "Confidence", record.confidence);

      sectionTitle(doc, 3, "Server Information");
      keyValueRow(doc, "Hostname", record.hostname);
      keyValueRow(doc, "Server ID", record.serverId);
      keyValueRow(doc, "Component Analyzed", record.component);
      keyValueRow(doc, "Analysis Generated", formatDate(record.createdAt));

      sectionTitle(doc, 4, "Current Environment");
      doc.table({
        columnStyles: [140, "*"],
        defaultStyle: { padding: 6, border: [0, 0, 1, 0], borderColor: COLORS.border, textColor: COLORS.slate },
        data: [
          [{ text: "Current Version", font: { family: "Helvetica-Bold" } }, record.comparison.currentVersion],
          [{ text: "Latest Available Version", font: { family: "Helvetica-Bold" } }, record.comparison.latestVersion],
          [{ text: "Version Gap", font: { family: "Helvetica-Bold" } }, record.comparison.versionGap.description],
          [{ text: "Security Changes Present", font: { family: "Helvetica-Bold" } }, record.comparison.securityChanges ? "Yes" : "No"],
          [{ text: "Configuration Changes Present", font: { family: "Helvetica-Bold" } }, record.comparison.configurationChanges ? "Yes" : "No"],
        ],
      });
      doc.moveDown(0.6);

      sectionTitle(doc, 5, "Software Version Comparison");
      doc.table({
        columnStyles: ["*", "*", "*"],
        defaultStyle: { padding: 6, border: 1, borderColor: COLORS.border, textColor: COLORS.slate },
        data: [
          [
            { text: "Component", font: { family: "Helvetica-Bold" }, backgroundColor: COLORS.panel },
            { text: "Current", font: { family: "Helvetica-Bold" }, backgroundColor: COLORS.panel },
            { text: "Latest", font: { family: "Helvetica-Bold" }, backgroundColor: COLORS.panel },
          ],
          [record.component, record.comparison.currentVersion, record.comparison.latestVersion],
        ],
      });
      doc.moveDown(0.6);

      sectionTitle(doc, 6, "Release Changes");
      keyValueRow(doc, "Release Date", record.release.releaseDate);
      keyValueRow(doc, "Source", record.release.source);
      doc.moveDown(0.3);
      bulletList(doc, record.release.changes);

      sectionTitle(doc, 7, "Configuration Analysis");
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.navy).text("Server Dependencies");
      doc.moveDown(0.2);
      bulletList(doc, record.comparison.serverDependencies, "None detected");
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.navy).text("Risk Factors");
      doc.moveDown(0.2);
      bulletList(doc, record.comparison.riskFactors, "No elevated risk factors identified");

      sectionTitle(doc, 8, "Security Impact");
      bulletList(doc, record.analysis.securityImpact);

      sectionTitle(doc, 9, "Compatibility Impact");
      bulletList(doc, record.analysis.compatibilityImpact);

      sectionTitle(doc, 10, "Operational Impact");
      bulletList(doc, record.analysis.operationalRisk);

      sectionTitle(doc, 11, "Risk Rating");
      renderImpactBadge(doc, record.impactLevel, record.confidence);
      doc.moveDown(0.4);
      bulletList(doc, record.analysis.risks);

      sectionTitle(doc, 12, "Recommendations");
      bulletList(doc, record.analysis.recommendedActions);

      sectionTitle(doc, 13, "Pre-Upgrade Checklist");
      bulletList(doc, record.analysis.preUpgradeChecks);

      sectionTitle(doc, 14, "Rollback Plan");
      bulletList(doc, record.analysis.rollbackConsiderations);

      sectionTitle(doc, 15, "Analysis Metadata");
      keyValueRow(doc, "Report Number", reportNumber);
      keyValueRow(doc, "Analysis ID", record.id);
      keyValueRow(doc, "Server ID", record.serverId);
      keyValueRow(doc, "Generated At", formatDate(record.createdAt));
      keyValueRow(doc, "Release Source", record.release.source);

      addHeadersAndFooters(doc, record, reportNumber);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function renderImpactBadge(doc: PDFKit.PDFDocument, level: string, confidence: string) {
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

function renderCover(doc: PDFKit.PDFDocument, record: AnalysisRecord, reportNumber: string) {
  doc.rect(0, 0, PAGE_WIDTH, 210).fill(COLORS.navy);

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("SERVER VERSION & PATCH IMPACT ANALYSIS", MARGIN, 60, { characterSpacing: 1 });

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text("Server Impact Analysis Report", MARGIN, 90, { width: CONTENT_WIDTH });

  doc
    .fillColor("#cbd5e1")
    .font("Helvetica")
    .fontSize(12)
    .text(`Component: ${record.component}`, MARGIN, 150);

  doc.y = 260;
  doc.fillColor(COLORS.slate);

  keyValueRow(doc, "Server", record.hostname);
  keyValueRow(doc, "Generated", formatDate(record.createdAt));
  keyValueRow(doc, "Analysis ID", record.id);
  keyValueRow(doc, "Report Number", reportNumber);
  keyValueRow(doc, "Current Version", record.comparison.currentVersion);
  keyValueRow(doc, "Latest Version", record.comparison.latestVersion);

  doc.moveDown(1);
  renderImpactBadge(doc, record.impactLevel, record.confidence);

  doc.moveDown(2);
  doc
    .fillColor(COLORS.muted)
    .fontSize(9)
    .text(
      "This report is a technical assessment generated by the Server Version & Patch Impact Analysis platform. It is analysis-only and contains no automated remediation actions.",
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH }
    );
}

function addHeadersAndFooters(doc: PDFKit.PDFDocument, record: AnalysisRecord, reportNumber: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);

    if (i > 0) {
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(`${reportNumber} — ${record.hostname} — ${record.component}`, MARGIN, 24, {
          width: CONTENT_WIDTH,
          align: "left",
        });
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
      .text(
        "Server Impact Analysis Report — Analysis Only — No Automated Remediation",
        MARGIN,
        doc.page.height - 40,
        { width: CONTENT_WIDTH - 60, align: "left" }
      );

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
