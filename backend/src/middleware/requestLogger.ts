import type { NextFunction, Request, Response } from "express";
import { log, newRequestId, withRequestContext } from "@/lib/logger";

/**
 * Paths that are deliberately not audited.
 *
 * Two kinds, for two different reasons:
 *
 * `/health` and `/ready` are polled every few seconds by Docker's healthcheck.
 * Auditing them would bury every real event under thousands of identical lines
 * and make the retention problem an order of magnitude worse.
 *
 * `/api/logs` is excluded because the Logs page polls it while open. Logging
 * those reads would mean the page's own refresh is the loudest activity in the
 * system — each poll writing entries that the next poll then displays, so the
 * table fills with the act of watching it rather than with anything the system
 * actually did.
 */
const UNAUDITED = [/^\/health$/, /^\/ready$/, /^\/api\/logs/];

/**
 * Records one audit entry per HTTP request, and gives everything the request
 * triggers a shared requestId.
 *
 * Logging happens on `finish` rather than up front, so a single entry can carry
 * the status and duration — the two facts that make it worth reading. Anything
 * a service logs while handling the request inherits the same requestId
 * through AsyncLocalStorage, which is what lets the UI reassemble a failure
 * from the request that caused it.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (UNAUDITED.some((pattern) => pattern.test(req.path))) {
    next();
    return;
  }

  const requestId = newRequestId();
  const startedAt = process.hrtime.bigint();

  // Echoed so a client — or someone reading a failed response in the network
  // tab — can look the request up on the Logs page by its id.
  res.setHeader("X-Request-Id", requestId);

  withRequestContext({ requestId, method: req.method, path: req.path }, () => {
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const status = res.statusCode;

      // 5xx is ours, 4xx is the caller's, and the two want different levels:
      // a stream of 404s is not an incident, a single 500 is.
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

      log(level, "http", `${req.method} ${req.originalUrl} → ${status}`, {
        event: `http.${level === "info" ? "request" : "request_failed"}`,
        statusCode: status,
        durationMs: Math.round(durationMs),
        serverId: typeof req.params?.id === "string" ? req.params.id : null,
        context: {
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          ip: req.ip,
        },
      });
    });

    next();
  });
}
