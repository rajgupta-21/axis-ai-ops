import { promises as fs } from "fs";
import path from "path";
import { AppError, ErrorCodes } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getAnalysisById, listLatestAnalysisPerServer } from "@/repositories/analysisRepository";
import { createReport, getReportByAnalysisId, nextReportNumber } from "@/repositories/reportRepository";
import { buildAnalysisReportPdf } from "./pdf/buildAnalysisReportPdf";
import { buildCombinedReportPdf } from "./pdf/buildCombinedReportPdf";

const REPORTS_DIR = path.join(process.cwd(), "generated-reports");

async function ensureReportsDir(): Promise<void> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

/**
 * Loads (or generates and persists) the PDF report for an analysis.
 * Reports are immutable once generated for a given analysis id.
 */
export async function getOrGenerateReport(
  analysisId: string
): Promise<{ buffer: Buffer; reportNumber: string }> {
  const record = await getAnalysisById(analysisId);
  if (!record) {
    throw new AppError(ErrorCodes.ANALYSIS_NOT_FOUND, `Analysis not found: ${analysisId}`, 404);
  }

  const existing = await getReportByAnalysisId(analysisId);
  if (existing) {
    try {
      const buffer = await fs.readFile(existing.filePath);
      return { buffer, reportNumber: existing.reportNumber };
    } catch {
      // Fall through and regenerate if the file is missing on disk.
    }
  }

  const reportNumber = existing?.reportNumber ?? (await nextReportNumber());

  let buffer: Buffer;
  try {
    buffer = await buildAnalysisReportPdf(record, reportNumber);
  } catch (error) {
    logger.error("report", `PDF generation failed for analysis ${record.id}.`, {
      event: "report.failed",
      analysisId: record.id,
      context: { reportNumber },
      error,
    });
    throw new AppError(
      ErrorCodes.REPORT_FAILED,
      "The analysis was completed, but the report could not be generated.",
      502
    );
  }

  await ensureReportsDir();
  const filePath = path.join(REPORTS_DIR, `${reportNumber}.pdf`);
  await fs.writeFile(filePath, buffer);
  await createReport(analysisId, reportNumber, filePath);

  return { buffer, reportNumber };
}

/**
 * Builds a combined PDF across the latest analysis for every server.
 * Generated fresh on every request — not persisted, since it is a
 * point-in-time snapshot across servers rather than a single analysis.
 */
export async function generateCombinedReport(): Promise<Buffer> {
  const records = await listLatestAnalysisPerServer();
  try {
    return await buildCombinedReportPdf(records);
  } catch (error) {
    logger.error("report", "Combined PDF generation failed.", {
      event: "report.combined_failed",
      context: { analyses: records.length },
      error,
    });
    throw new AppError(
      ErrorCodes.REPORT_FAILED,
      "The combined report could not be generated.",
      502
    );
  }
}
