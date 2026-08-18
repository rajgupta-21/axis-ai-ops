import express from "express";
import cors from "cors";
import { serversRouter } from "./routes/servers";
import { analysesRouter } from "./routes/analyses";
import { reportsRouter } from "./routes/reports";
import { systemRouter } from "./routes/system";
import { logsRouter } from "./routes/logs";
import { requestLogger } from "./middleware/requestLogger";
import { prisma } from "./lib/db";
import { describeCache } from "./lib/cache";
import { logger } from "./lib/logger";

export function createApp() {
  const app = express();

  app.use(cors({
    // Without this the browser cannot read the header, so the request id shown
    // in a failed response is invisible to the very client that needs it.
    exposedHeaders: ["X-Request-Id"],
  }));
  app.use(express.json());

  // Registered before the routes so every request below is audited, and after
  // the body parser only because nothing here reads the body.
  app.use(requestLogger);

  /**
   * Liveness: the process is up and serving. Intentionally checks nothing else,
   * so a restart loop cannot be triggered by a dependency being briefly down.
   */
  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  /**
   * Readiness: the API can actually do its job.
   *
   * Kept separate from /health because the two answer different questions and
   * an orchestrator needs both. /health alone reported "ok" while the database
   * was down and every page was failing — which is exactly the case a health
   * check exists to catch, and the reason the compose healthcheck should point
   * here instead.
   */
  app.get("/ready", async (_req, res) => {
    let database = false;
    let detail: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch (error) {
      detail = error instanceof Error ? error.message.split("\n")[0] : "unreachable";
    }

    const cache = describeCache();
    res.status(database ? 200 : 503).json({
      success: database,
      data: {
        database,
        databaseError: detail,
        // The cache is an optimisation, so its absence is reported but never
        // makes the service unready — the API serves every request without it.
        cacheEnabled: cache.enabled,
        cacheConnected: cache.connected,
      },
    });
  });

  app.use("/api/servers", serversRouter);
  app.use("/api/analyses", analysesRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/system", systemRouter);
  app.use("/api/logs", logsRouter);

  app.use((req, res) => {
    logger.warn("http", `No route matched ${req.method} ${req.originalUrl}.`, {
      event: "http.not_found",
      statusCode: 404,
    });
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found." } });
  });

  return app;
}
