import { Router } from "express";
import { z } from "zod";
import { ok, fail, handleApiError } from "@/lib/apiResponse";
import { listServers, getServerDetails } from "@/services/serverService";
import { collectServerData } from "@/services/collectionService";
import { listServerSoftware } from "@/services/softwareService";
import { listAnalysesForServer } from "@/repositories/analysisRepository";
import { analyzeServerSoftware } from "@/services/impactAnalysisService";
import { analyzeServerFromPlaybook } from "@/services/playbookAnalysisService";

export const serversRouter = Router();

serversRouter.get("/", async (_req, res) => {
  try {
    const servers = await listServers();
    ok(res, servers);
  } catch (error) {
    handleApiError(res, error);
  }
});

serversRouter.get("/:id", async (req, res) => {
  try {
    const details = await getServerDetails(req.params.id);
    ok(res, details);
  } catch (error) {
    handleApiError(res, error);
  }
});

serversRouter.post("/:id/collect", async (req, res) => {
  try {
    const snapshot = await collectServerData(req.params.id);
    ok(res, snapshot);
  } catch (error) {
    handleApiError(res, error);
  }
});

serversRouter.get("/:id/software", async (req, res) => {
  try {
    const software = await listServerSoftware(req.params.id);
    ok(res, software);
  } catch (error) {
    handleApiError(res, error);
  }
});

serversRouter.get("/:id/analyses", async (req, res) => {
  try {
    const analyses = await listAnalysesForServer(req.params.id);
    ok(res, analyses);
  } catch (error) {
    handleApiError(res, error);
  }
});

const ReanalyzeSchema = z.object({
  component: z.string().min(1),
});

/**
 * Runs the full analysis workflow for a server/component pair. Used by
 * both the initial "Analyze" action and the "Re-analyze" action — both
 * perform the identical collect -> compare -> analyze -> persist pipeline.
 */
serversRouter.post("/:id/reanalyze", async (req, res) => {
  try {
    const parsed = ReanalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, "VALIDATION_FAILED", "A software component name is required.", 400);
      return;
    }

    const record = await analyzeServerSoftware(req.params.id, parsed.data.component);
    ok(res, record);
  } catch (error) {
    handleApiError(res, error);
  }
});

const AnalyzePlaybookSchema = z.object({
  playbookYaml: z.string().min(1),
});

/**
 * Runs the impact-analysis pipeline against an uploaded Ansible playbook.
 * The playbook is parsed statically and never executed against this or
 * any other server.
 */
serversRouter.post("/:id/analyze-playbook", async (req, res) => {
  try {
    const parsed = AnalyzePlaybookSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, "VALIDATION_FAILED", "An Ansible playbook (YAML) is required.", 400);
      return;
    }

    const record = await analyzeServerFromPlaybook(req.params.id, parsed.data.playbookYaml);
    ok(res, record);
  } catch (error) {
    handleApiError(res, error);
  }
});
