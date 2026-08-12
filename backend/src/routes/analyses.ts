import { Router } from "express";
import { fail, handleApiError, ok } from "@/lib/apiResponse";
import { getAnalysisById, listRecentAnalyses } from "@/repositories/analysisRepository";
import { getOrGenerateReport } from "@/services/reportService";

export const analysesRouter = Router();

/** Lists the most recent analyses across all servers (used by the Dashboard and Analysis History pages). */
analysesRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 500);
    const analyses = await listRecentAnalyses(limit);
    ok(res, analyses);
  } catch (error) {
    handleApiError(res, error);
  }
});

analysesRouter.get("/:id", async (req, res) => {
  try {
    const record = await getAnalysisById(req.params.id);
    if (!record) {
      fail(res, "ANALYSIS_NOT_FOUND", `Analysis not found: ${req.params.id}`, 404);
      return;
    }
    ok(res, record);
  } catch (error) {
    handleApiError(res, error);
  }
});

analysesRouter.get("/:id/report", async (req, res) => {
  try {
    const { buffer, reportNumber } = await getOrGenerateReport(req.params.id);
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportNumber}.pdf"`);
    res.send(buffer);
  } catch (error) {
    handleApiError(res, error);
  }
});
