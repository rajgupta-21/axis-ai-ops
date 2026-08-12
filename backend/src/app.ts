import express from "express";
import cors from "cors";
import { serversRouter } from "./routes/servers";
import { analysesRouter } from "./routes/analyses";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  app.use("/api/servers", serversRouter);
  app.use("/api/analyses", analysesRouter);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found." } });
  });

  return app;
}
