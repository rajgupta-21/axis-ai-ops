-- Audit trail of system activity, read by the Logs page.
--
-- Written idempotently for the same reason as the knowledge_chunks migration:
-- it has to apply cleanly to both a fresh Postgres and the existing
-- development database.

DO $$ BEGIN
    CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "request_id" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "server_id" TEXT,
    "analysis_id" TEXT,
    "context" JSONB,
    "error_stack" TEXT,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- The plain timestamp index serves the unfiltered "latest activity" view; the
-- two composite indexes serve the level and category filters, which are the
-- only two narrowings the UI offers. `timestamp` trails the filter column in
-- each so the index also supplies the ordering.
CREATE INDEX IF NOT EXISTS "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "activity_logs_level_timestamp_idx" ON "activity_logs"("level", "timestamp");
CREATE INDEX IF NOT EXISTS "activity_logs_category_timestamp_idx" ON "activity_logs"("category", "timestamp");

-- Grouping every line of one request together is how a failure is traced back
-- through the calls that led to it.
CREATE INDEX IF NOT EXISTS "activity_logs_request_id_idx" ON "activity_logs"("request_id");
