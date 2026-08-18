import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/db";
import { closeCache } from "./lib/cache";
import { flushLogs, logger } from "./lib/logger";

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

/**
 * Confirms the database is reachable before the API starts taking traffic.
 *
 * Without this, a stopped database produced no startup error at all — the
 * server reported "listening" as usual, and the only symptom was a full Prisma
 * stack trace per request, repeated for every query on every page load, with
 * the actual cause (ECONNREFUSED) buried at the bottom of each one. Twice that
 * turned a stopped dev database into a debugging session.
 *
 * Deliberately a warning rather than a fatal error: the API degrades to
 * explained failures rather than blank pages, and a database that is merely
 * slow to start should not stop the process. The point is to say the true cause
 * once, at the top of the log, in terms that name the fix.
 */
async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    // Prisma puts the useful part on `code` (ECONNREFUSED) and fills `message`
    // with a rendered call site, so the code is preferred and the message is
    // only a fallback — and then its first NON-EMPTY line, since the message
    // begins with blank lines and taking [0] printed nothing at all.
    const code = (error as { code?: string })?.code;
    const detail =
      code ??
      (error instanceof Error ? error.message : String(error))
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) ??
      "The connection was refused.";
    const url = process.env.DATABASE_URL ?? "";
    // Port 51213/51214 is the Prisma-managed dev database, which does not start
    // with the app and does not survive a reboot — by far the most likely cause
    // here, so name its exact command rather than generic advice.
    const isPrismaDev = url.includes("51213") || url.includes("51214") || url.startsWith("prisma+postgres://");

    console.error("\n  The database is not reachable, so every request will fail.");
    console.error(`  ${detail}`);
    console.error(
      isPrismaDev
        ? "\n  This project uses a Prisma-managed dev database, which must be started separately:\n" +
            "      npx prisma dev start default        (from backend/)\n" +
            "      npx prisma dev ls                   to check its status\n"
        : "\n  Check DATABASE_URL and that the database server is running.\n"
    );
    return false;
  }
}

async function main() {
  const databaseReady = await checkDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Server Version & Patch Impact Analysis API listening on http://localhost:${PORT}`);
    // Audited so the Logs page opens on a definite "the API started, here is
    // how it was configured" line. Every restart is then visible as a boundary
    // in the trail, which is the first thing you want when behaviour changed.
    logger.info("system", `API started on port ${PORT}.`, {
      event: "system.started",
      context: {
        port: PORT,
        databaseReady,
        nodeEnv: process.env.NODE_ENV ?? "development",
        ansibleProvider: process.env.ANSIBLE_PROVIDER ?? "simulated",
        releaseProvider: process.env.RELEASE_PROVIDER ?? "simulated",
      },
    });

    if (!databaseReady) {
      console.warn("  Started WITHOUT a database — endpoints will return errors until it is running.");
      logger.error("database", "Started without a reachable database; endpoints will fail until it is running.", {
        event: "database.unreachable_at_startup",
      });
    }
  });

  /**
   * Shuts down in an order that does not lose work.
   *
   * An analysis routinely runs for minutes, so killing the process on SIGTERM
   * discarded in-flight work mid-request and left the Prisma pool and Redis
   * connection open. Every container stop and every dev-server restart did
   * this. Now the listener closes first so no new request is accepted, in-flight
   * requests are given time to finish, and only then are the connections closed.
   */
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    // A second Ctrl-C should exit immediately rather than be swallowed.
    if (shuttingDown) {
      console.warn(`\n${signal} again — exiting now.`);
      process.exit(1);
    }
    shuttingDown = true;
    console.log(`\n${signal} received, finishing in-flight requests…`);
    logger.info("system", `${signal} received; shutting down.`, { event: "system.shutdown" });

    const forced = setTimeout(() => {
      console.warn("  Shutdown timed out after 30s; exiting anyway.");
      process.exit(1);
    }, 30_000);
    // Do not let the timer itself hold the process open once everything closes.
    forced.unref();

    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Drained before Prisma disconnects, because the queue is written through
    // it. Skipping this lost the shutdown entry and anything logged by the last
    // requests — precisely the lines that explain an unexpected restart.
    await flushLogs().catch(() => undefined);

    // Closed after the server, never before: a request still being served needs
    // both of these to finish.
    await Promise.allSettled([prisma.$disconnect(), closeCache()]);

    clearTimeout(forced);
    console.log("  Closed cleanly.");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main();
