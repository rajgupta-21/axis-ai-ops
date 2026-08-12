import { Router } from "express";
import { handleApiError, ok } from "@/lib/apiResponse";
import { listReports } from "@/repositories/reportRepository";

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
