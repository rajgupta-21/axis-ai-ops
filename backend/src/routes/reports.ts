import { Router } from "express";
import { handleApiError, ok } from "@/lib/apiResponse";
import { listReports } from "@/repositories/reportRepository";
import { generateCombinedReport } from "@/services/reportService";

export const reportsRouter = Router();

/** Lists every generated PDF report across all servers, most recent first. */
reportsRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const reports = await listReports(limit);
    ok(res, reports);
  } catch (error) {
    handleApiError(res, error);
  }
});

/** Streams a single PDF combining the latest impact analysis for every server. */
reportsRouter.get("/combined", async (_req, res) => {
  try {
    const buffer = await generateCombinedReport();
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="combined-impact-report.pdf"');
    res.send(buffer);
  } catch (error) {
    handleApiError(res, error);
  }
});
