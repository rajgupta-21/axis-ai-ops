-- Knowledge base for the agent's RAG retrieval.
--
-- This table and the pgvector extension were originally created by hand on the
-- development database and never captured in a migration, so `migrate deploy`
-- against a fresh Postgres produced a schema without them. Nothing crashed —
-- retrieve_context catches the failure and proceeds ungrounded — which is
-- exactly why it went unnoticed: the agent quietly lost its memory of every
-- release note it had ever ingested. Containerising the database made a fresh
-- Postgres the normal case rather than the exception, so it has to be here.
--
-- Every statement is idempotent: this migration also has to apply cleanly to
-- the existing development database, where the objects are already present.

-- Provides the `vector` column type. Requires a Postgres image with pgvector
-- available (the compose file uses pgvector/pgvector); on a stock postgres
-- image this statement fails with "extension \"vector\" is not available".
CREATE EXTENSION IF NOT EXISTS vector;

-- The dimension must match EMBEDDING_DIMENSIONS in backend/.env, because the
-- column width is fixed at creation and an embedding of a different length is
-- rejected on insert rather than truncated. 1024 matches llama-text-embed-v2,
-- the configured Pinecone model. Changing the embedding model means altering
-- this column in a new migration.
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "version" TEXT,
    "source_url" TEXT,
    "chunk_text" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- Retrieval always filters by component before ranking by vector distance, so
-- this index does the selective work. No ANN index on `embedding` on purpose:
-- per-component chunk counts are small, exact search is fast at this size, and
-- an ivfflat/hnsw index would trade recall for a speed-up nothing needs yet.
CREATE INDEX IF NOT EXISTS "knowledge_chunks_component_idx" ON "knowledge_chunks"("component");
