import PDFDocument from "pdfkit";
import { AnalysisRecord } from "@/domain/analysis";
import {
  MARGIN,
  PAGE_WIDTH,
  CONTENT_WIDTH,
  COLORS,
  formatDate,
  sectionTitle,
  bulletList,
  paragraph,
  keyValueRow,
  renderImpactBadge,
  addHeadersAndFooters,
} from "./pdfHelpers";

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

      addHeadersAndFooters(
        doc,
        `${reportNumber} — ${record.hostname} — ${record.component}`,
        "Server Impact Analysis Report — Analysis Only — No Automated Remediation"
      );
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
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

