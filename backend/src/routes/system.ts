import { Router } from "express";
import { ok } from "@/lib/apiResponse";

export const systemRouter = Router();

/**
 * Read-only, non-secret configuration summary — which adapter providers
 * are active. Never returns credentials, tokens, or connection strings.
 */
systemRouter.get("/info", (_req, res) => {
  const ansibleProvider = process.env.ANSIBLE_PROVIDER ?? "simulated";
  const releaseProvider = process.env.RELEASE_PROVIDER ?? "simulated";
  const bedrockProvider =
    process.env.BEDROCK_PROVIDER ??
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? "bedrock" : "mock");

  ok(res, {
    environment: process.env.NODE_ENV ?? "development",
    ansibleProvider,
    releaseProvider,
    bedrockProvider,
    bedrockModelId: bedrockProvider === "bedrock" ? process.env.BEDROCK_MODEL_ID ?? null : null,
    awsRegion: bedrockProvider === "bedrock" ? process.env.AWS_REGION ?? null : null,
  });
});
