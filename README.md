# Server Version & Patch Impact Analysis

A structured server-analysis workflow (not a chatbot) that collects server
state through an Ansible/AWX adapter, discovers the latest available
software versions, runs a deterministic comparison, and produces a
higher-level impact analysis using Claude Sonnet 5 through Amazon Bedrock.
Results are persisted in PostgreSQL and can be exported as a professional
PDF report.

The project is split into two independent processes:

- **`backend/`** — a Node.js + Express REST API. Owns all business logic: adapters, services, repositories, Prisma/PostgreSQL, and PDF generation. Holds every credential (AWX, AWS, database). CORS-enabled so the frontend can call it directly.
- **`/` (this root)** — the Next.js UI. Contains no business logic, no database access, and no credentials — every page and interactive component calls the Express API over plain REST.

## Architecture

```
Browser  --REST-->  Next.js UI  --REST-->  Express API (backend/)  -->  Ansible/AWX Adapter  -> Server Snapshot   \
                                                                                                                    > Comparison Engine -> Claude (Bedrock) -> PostgreSQL -> PDF
                                                                     -->  Release Adapter      -> Release Info    /
```

Inside `backend/src`:

- **Ansible/AWX Adapter** (`adapters/ansible`) — source of truth for current server state (OS, kernel, CPU, memory, disk, software, services, modules, configuration). `SimulatedAnsibleAdapter` provides realistic data for 5 servers; `AWXApiAdapter` is a scaffold for a real AWX integration. Switch with `ANSIBLE_PROVIDER`.
- **Release Adapter** (`adapters/release`) — source of truth for latest available version, release notes, security/config/compatibility changes. `SimulatedReleaseAdapter` covers nginx/PostgreSQL/Node.js/Redis; `OfficialReleaseAdapter` is a scaffold for real release sources. Switch with `RELEASE_PROVIDER`.
- **Comparison Engine** (`services/comparisonService.ts`, `lib/version.ts`) — deterministic version-gap calculation, configuration correlation, and risk-factor extraction. No LLM involvement.
- **Bedrock Adapter** (`adapters/bedrock`) — calls Claude Sonnet 5 through Amazon Bedrock (`ClaudeBedrockAdapter`) for higher-level reasoning only. A deterministic `MockBedrockAdapter` is used by default (`BEDROCK_PROVIDER=mock`) so the full workflow runs without AWS credentials; set `BEDROCK_PROVIDER=bedrock` plus AWS credentials to use the real model.
- **Services** (`services`) — orchestrate the workflow: collect -> identify software -> release lookup -> compare -> analyze -> validate -> persist.
- **Repositories** (`repositories`) + **Prisma/PostgreSQL** (`prisma/schema.prisma`) — persistence for servers, snapshots, software inventory, release information, comparisons, impact analyses, and reports. Analyses are immutable historical records; re-analyzing creates a new row rather than mutating an old one.
- **PDF Service** (`services/pdf`, `services/reportService.ts`) — builds an enterprise-styled, multi-section PDF report with pdfkit.
- **Routes** (`routes`) — Express routers exposing the REST API (`/api/servers`, `/api/analyses`).

The Next.js UI (`src/app`) never talks to AWX, Bedrock, or PostgreSQL directly — only to the Express API, which holds all credentials.

## Getting Started

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL at minimum
npm run db:migrate        # applies the schema
npm run db:seed           # seeds 5 servers + one sample analysis
npm run dev                # http://localhost:4000

# 2. Frontend (in a second terminal)
cd ..
npm install
cp .env.example .env       # NEXT_PUBLIC_API_BASE_URL defaults to http://localhost:4000
npm run dev                 # http://localhost:3000
```

Or, from the repo root, run both at once (after installing both):

```bash
npm run dev:all
```

### Redis cache (recommended)

Collecting server facts is several SSH round trips, and identifying the latest
release for a package is a web search plus an LLM call — per package. A
first-time server-detail load therefore takes minutes. Redis caches those
responses, which turns repeat loads into milliseconds:

```bash
docker compose up -d        # from the repo root
```

This publishes Redis on **6380**, not the default 6379, so it cannot collide
with a Redis already installed on the machine. `REDIS_URL` in `backend/.env`
points at it.

The cache is optional. With Redis stopped the API still answers every request,
just slowly, and reconnects by itself when Redis comes back. Set
`CACHE_ENABLED=false` to bypass it deliberately. `GET /api/system/info` reports
`cacheEnabled` and `cacheConnected`.

A collection or analysis invalidates that server's cached entries immediately,
so "Collect data" never appears to do nothing.

No local PostgreSQL? From `backend/`, Prisma can spin one up for you:

```bash
npx prisma dev -d       # prints a DATABASE_URL, paste it into backend/.env
```

## Environment Variables

- **Frontend** (`.env.example`): just `NEXT_PUBLIC_API_BASE_URL`, the Express API's base URL. No credentials.
- **Backend** (`backend/.env.example`): `DATABASE_URL`, and the provider switches below.

  - `ANSIBLE_PROVIDER=simulated|awx`
  - `RELEASE_PROVIDER=simulated|official`
  - `BEDROCK_PROVIDER=mock|bedrock` (defaults to `mock` unless AWS credentials are set)

Switching any of these requires no frontend or service-layer changes — only the adapter implementation behind the shared interface changes.

## Scripts

Frontend (root):

```bash
npm run dev          # start the Next.js dev server
npm run dev:backend  # run the backend's dev server from the root (convenience)
npm run dev:all      # run both frontend and backend concurrently
npm run build        # production build
npm run start        # run the production build
npm run lint         # eslint
```

Backend (`backend/`):

```bash
npm run dev          # start the Express dev server (tsx watch)
npm run build        # compile to dist/
npm run start        # run the compiled server
npm run db:generate  # regenerate the Prisma client
npm run db:migrate   # create/apply a migration (dev)
npm run db:deploy    # apply migrations (prod)
npm run db:seed      # seed 5 servers + a sample analysis
npm run db:reset     # drop, recreate, migrate, and reseed the database
```

## Workflow

1. Dashboard/Servers list the 5 simulated servers (`app-server-01`, `app-server-02`, `web-server-01`, `db-server-01`, `api-server-01`).
2. Server details show configuration, metrics, installed software, and services (secrets are filtered out before display).
3. Selecting a software component and clicking **Analyze** runs: collect snapshot -> identify software -> get release info -> deterministic comparison -> configuration correlation -> Claude Sonnet 5 (Bedrock) -> validate -> persist -> refresh, without a full page reload.
4. The analysis page shows impact level, confidence, and all required sections, plus **Re-analyze** (repeats the workflow and stores a new immutable record) and **Download Report** (generates/returns an enterprise PDF).
5. Analysis History lists every past analysis; previous analyses and reports remain accessible and unmodified.

## Notes on the prototype

- The AI is analysis-only: it cannot execute commands, SSH into servers, modify configuration, or apply patches. It only returns structured recommendations.
- If release or server data is missing, the model is instructed to return "Insufficient data" rather than inventing facts.
- PDF reports are stored under `backend/generated-reports/` (gitignored) and are immutable once generated for a given analysis.
- CORS is fully open by default for local development. Restrict `cors()` in `backend/src/app.ts` to a specific origin before deploying.
