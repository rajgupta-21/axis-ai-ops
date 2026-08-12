# Agent 1 — Server Version & Patch Impact Analysis

## 1. Objective

Build a production-quality prototype for **Agent 1: Server Version & Patch Impact Analysis**.

The system must provide an end-to-end structured workflow that:

1. Lists all monitored servers.
2. Displays detailed server configuration and current state.
3. Receives server information through an **Ansible/AWX adapter**.
4. Uses simulated Ansible/AWX data for the prototype.
5. Keeps the Ansible integration isolated behind an interface so it can later be replaced by a real AWX API without frontend or analysis-layer changes.
6. Identifies installed software and versions.
7. Searches official release sources for the latest available software versions.
8. Compares:
   - Current server version
   - Latest available version
   - Release/change information
   - Server configuration
   - Server metrics
   - Installed services/packages

9. Performs higher-level impact analysis using **Claude Sonnet 5 through Amazon Bedrock**.
10. Displays the analysis in a professional dashboard.
11. Allows users to **Re-analyze** a server.
12. Generates and downloads a professionally formatted PDF report.
13. Persists server snapshots, release information, comparisons, analyses, and reports in PostgreSQL.

The system must remain a structured server-analysis workflow rather than a chatbot.

---

# 2. Technology Stack

Use the following technologies:

- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **Node.js API/backend**
- **PostgreSQL**
- **Amazon Bedrock**
- **Claude Sonnet 5**
- **Ansible/AWX integration abstraction**
- **REST APIs**
- **PDF generation**

Keep the architecture simple and modular.

Do **not** introduce:

- Kubernetes
- Redis
- Kafka
- Vector databases
- Unnecessary message queues
- Unnecessary microservices

---

# 3. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │    Next.js UI       │
                    │                     │
                    │ Dashboard           │
                    │ Server Details      │
                    │ Impact Analysis     │
                    │ Analysis History    │
                    └──────────┬──────────┘
                               │
                               │ REST API
                               ▼
                    ┌─────────────────────┐
                    │    Node.js API      │
                    │                     │
                    │ Server Service      │
                    │ Analysis Service    │
                    │ Report Service      │
                    └───────┬───────┬─────┘
                            │       │
              ┌─────────────┘       └──────────────┐
              ▼                                    ▼
    ┌──────────────────┐                 ┌──────────────────┐
    │ Ansible Adapter  │                 │ Release Adapter  │
    │                  │                 │                  │
    │ Simulated AWX    │                 │ Simulated        │
    │ Real AWX later   │                 │ Official Web API │
    └────────┬─────────┘                 └────────┬─────────┘
             │                                    │
             ▼                                    ▼
      Server Snapshot                    Latest Release Data
             │                                    │
             └────────────────┬───────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │ Comparison Engine   │
                    │                     │
                    │ Version differences │
                    │ Config correlation  │
                    │ Risk factors        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Impact Analyzer     │
                    │                     │
                    │ Claude Sonnet 5     │
                    │ Amazon Bedrock      │
                    └──────────┬──────────┘
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
              ┌─────────────┐     ┌──────────────┐
              │ PostgreSQL  │     │ PDF Report   │
              └─────────────┘     └──────────────┘
```

---

# 4. Core Design Principle

The system must strictly separate:

```text
Data Collection
       ↓
Normalization
       ↓
Version Discovery
       ↓
Deterministic Comparison
       ↓
Impact Analysis
       ↓
Persistence
       ↓
Presentation
       ↓
PDF Reporting
```

The responsibilities are:

### Ansible/AWX

Source of truth for:

- Current server state
- OS
- Kernel
- CPU
- Memory
- Disk
- Installed packages
- Installed software
- Services
- Modules
- Configuration
- Collected metrics

### Release Adapter

Source of truth for:

- Latest available version
- Release date
- Release notes
- Security changes
- Configuration changes
- Compatibility information
- Dependency changes

### Comparison Engine

Responsible for deterministic calculations such as:

- Version gap
- Major/minor/patch differences
- Configuration correlations
- Installed module correlations
- Risk factors

### Claude Sonnet 5

Responsible for higher-level reasoning:

> What does this release change mean for this specific server?

The LLM must **not** calculate facts that deterministic code can reliably calculate.

---

# 5. Project Structure

Use a modular project structure similar to:

```text
src/
├── app/
│   ├── page.tsx
│   ├── servers/
│   │   ├── page.tsx
│   │   └── [serverId]/
│   │       └── page.tsx
│   │
│   ├── analyses/
│   │   └── [analysisId]/
│   │       └── page.tsx
│   │
│   └── history/
│       └── page.tsx
│
├── api/
│   ├── servers/
│   ├── analyses/
│   └── reports/
│
├── adapters/
│   ├── ansible/
│   │   ├── AnsibleAdapter.ts
│   │   ├── SimulatedAnsibleAdapter.ts
│   │   └── AWXApiAdapter.ts
│   │
│   ├── release/
│   │   ├── ReleaseAdapter.ts
│   │   ├── SimulatedReleaseAdapter.ts
│   │   └── OfficialReleaseAdapter.ts
│   │
│   └── bedrock/
│       ├── BedrockAdapter.ts
│       └── ClaudeBedrockAdapter.ts
│
├── services/
│   ├── serverService.ts
│   ├── collectionService.ts
│   ├── releaseService.ts
│   ├── comparisonService.ts
│   ├── impactAnalysisService.ts
│   └── reportService.ts
│
├── domain/
│   ├── server.ts
│   ├── release.ts
│   ├── comparison.ts
│   └── analysis.ts
│
├── repositories/
│   ├── serverRepository.ts
│   ├── snapshotRepository.ts
│   ├── analysisRepository.ts
│   └── reportRepository.ts
│
├── lib/
│   ├── db.ts
│   ├── version.ts
│   └── security.ts
│
└── components/
    ├── ServerTable.tsx
    ├── ServerOverview.tsx
    ├── MetricsCards.tsx
    ├── SoftwareTable.tsx
    ├── ServiceTable.tsx
    ├── AnalysisSummary.tsx
    ├── RiskBadge.tsx
    ├── AnalysisTimeline.tsx
    └── DownloadReportButton.tsx
```

---

# 6. Ansible Adapter

Create the interface:

```typescript
export interface AnsibleAdapter {
  getServers(): Promise<Server[]>;
  getServerDetails(serverId: string): Promise<ServerDetails>;
  collectServerData(serverId: string): Promise<ServerSnapshot>;
}
```

The frontend and services must depend on this interface rather than a concrete implementation.

---

# 7. Normalized Server Model

Create a normalized server model:

```typescript
export interface Server {
  id: string;
  hostname: string;
  ipAddress: string;
  os: {
    name: string;
    version: string;
  };
  status: "healthy" | "warning" | "critical" | "unknown";
  lastCollectedAt: string;
}
```

The detailed snapshot should contain:

```typescript
export interface ServerSnapshot {
  serverId: string;
  hostname: string;
  ipAddress: string;

  os: {
    name: string;
    version: string;
  };

  kernel: string;
  architecture: string;

  cpu: {
    cores: number;
    usagePercent: number;
  };

  memory: {
    totalMB: number;
    usedPercent: number;
  };

  disk: {
    totalGB: number;
    usedPercent: number;
  };

  network?: {
    inboundMbps?: number;
    outboundMbps?: number;
  };

  software: SoftwareComponent[];

  services: ServiceInfo[];

  modules: string[];

  configuration: ConfigurationData;

  collectedAt: string;
}
```

---

# 8. Simulated Ansible Adapter

Implement:

```text
SimulatedAnsibleAdapter
```

It must provide realistic data for at least five servers:

```text
app-server-01
app-server-02
web-server-01
db-server-01
api-server-01
```

Each server must have different:

- OS versions
- Software versions
- CPU utilization
- Memory utilization
- Disk utilization
- Services
- Modules
- Configuration
- Risk factors

Do not place this data inside React components.

The simulated adapter should be the only location responsible for simulated Ansible data.

---

# 9. Example Server Data

Use data based on the following structure:

```json
{
  "serverId": "srv-001",
  "hostname": "app-server-01",
  "ipAddress": "10.0.1.25",
  "os": {
    "name": "Ubuntu",
    "version": "22.04"
  },
  "kernel": "5.15.0",
  "architecture": "x86_64",
  "cpu": {
    "cores": 4,
    "usagePercent": 72
  },
  "memory": {
    "totalMB": 8192,
    "usedPercent": 68
  },
  "disk": {
    "totalGB": 100,
    "usedPercent": 61
  },
  "software": [
    {
      "name": "nginx",
      "version": "1.24.0"
    },
    {
      "name": "postgresql",
      "version": "15.4"
    },
    {
      "name": "node",
      "version": "20.11.1"
    }
  ],
  "services": [
    {
      "name": "nginx",
      "status": "running"
    },
    {
      "name": "postgresql",
      "status": "running"
    }
  ],
  "modules": ["ssl", "http_v2"],
  "collectedAt": "2026-08-12T10:00:00Z"
}
```

Add realistic configuration information without exposing secrets.

---

# 10. Real AWX Integration Preparation

Create:

```text
AWXApiAdapter
```

The implementation should follow:

```text
Node.js
   ↓
AWX REST API
   ↓
Launch Job
   ↓
Ansible Playbook
   ↓
Target Server
   ↓
Facts / packages / services / metrics
   ↓
AWX Job Result
   ↓
Node.js normalization
```

The adapter should eventually support:

```typescript
class AWXApiAdapter implements AnsibleAdapter {
  async getServers(): Promise<Server[]> {
    // AWX inventory lookup
  }

  async getServerDetails(serverId: string): Promise<ServerDetails> {
    // AWX host details
  }

  async collectServerData(serverId: string): Promise<ServerSnapshot> {
    // Launch AWX job and normalize result
  }
}
```

Do not expose AWX credentials to the frontend.

Use environment variables:

```env
ANSIBLE_PROVIDER=simulated

AWX_BASE_URL=
AWX_USERNAME=
AWX_PASSWORD=
AWX_TOKEN=
AWX_JOB_TEMPLATE_ID=
```

Only the backend may access these values.

---

# 11. Provider Selection

Use configuration-based dependency injection.

```env
ANSIBLE_PROVIDER=simulated
```

Later:

```env
ANSIBLE_PROVIDER=awx
```

Example:

```typescript
export function createAnsibleAdapter(): AnsibleAdapter {
  switch (process.env.ANSIBLE_PROVIDER) {
    case "awx":
      return new AWXApiAdapter();

    case "simulated":
    default:
      return new SimulatedAnsibleAdapter();
  }
}
```

No frontend changes should be required when switching providers.

---

# 12. Release Adapter

Create:

```typescript
export interface ReleaseAdapter {
  getLatestVersion(
    software: string,
    currentVersion: string,
  ): Promise<ReleaseInformation>;
}
```

Model:

```typescript
export interface ReleaseInformation {
  software: string;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  changes: string[];
  securityChanges: string[];
  configurationChanges: string[];
  compatibilityChanges: string[];
  source: string;
}
```

The system must clearly distinguish:

```text
CURRENT SERVER DATA
```

from:

```text
LATEST RELEASE DATA
```

---

# 13. Release Discovery

For the prototype, use simulated release information where required.

The architecture must allow later integration with official sources such as:

- Official project release pages
- Official changelogs
- Official GitHub releases
- Official vendor APIs

Do not treat arbitrary third-party pages as authoritative when an official release source is available.

For example:

```json
{
  "software": "nginx",
  "currentVersion": "1.24.0",
  "latestVersion": "1.26.2",
  "releaseDate": "2026-01-01",
  "changes": [
    "Security improvements",
    "HTTP/2 changes",
    "Configuration changes"
  ],
  "securityChanges": ["Security fixes"],
  "configurationChanges": ["Configuration behavior changes"],
  "compatibilityChanges": [],
  "source": "official release source"
}
```

---

# 14. Comparison Engine

Create a deterministic comparison service:

```typescript
export interface ComparisonResult {
  component: string;

  currentVersion: string;
  latestVersion: string;

  versionGap: {
    major: number;
    minor: number;
    patch: number;
    description: string;
  };

  securityChanges: boolean;
  configurationChanges: boolean;

  serverDependencies: string[];

  riskFactors: string[];
}
```

Example:

```json
{
  "component": "nginx",
  "currentVersion": "1.24.0",
  "latestVersion": "1.26.2",
  "versionGap": {
    "major": 0,
    "minor": 2,
    "patch": 2,
    "description": "2 minor releases behind"
  },
  "securityChanges": true,
  "configurationChanges": true,
  "serverDependencies": ["http_v2", "ssl"],
  "riskFactors": ["HTTP/2 enabled", "Custom SSL configuration"]
}
```

The comparison engine must perform deterministic operations before the LLM is invoked.

Do not ask Claude to calculate:

- Version differences
- Whether versions differ
- Basic numerical metrics
- CPU percentage
- Memory percentage
- Disk percentage

---

# 15. Version Comparison Logic

Implement proper semantic version comparison.

The engine should identify:

```text
Major difference
Minor difference
Patch difference
```

Example:

```text
Current: 1.24.0
Latest:  1.26.2

Major gap: 0
Minor gap: 2
Patch gap: 2
```

Also handle versions such as:

```text
20.11.1
20.19.x
15.4
15.7
```

If the version cannot be safely parsed, mark:

```text
Insufficient data
```

rather than guessing.

---

# 16. Configuration Correlation

The comparison engine should correlate release changes with the server configuration.

For example:

```text
Release:
HTTP/2 behavior changed

Server:
http_v2 enabled

Result:
Relevant configuration detected
```

Another example:

```text
Release:
SSL behavior changed

Server:
ssl module enabled
custom SSL configuration present

Result:
Potential configuration impact
```

The engine should generate structured risk factors such as:

```text
HTTP/2 enabled
SSL module enabled
Custom configuration detected
High CPU utilization
High memory utilization
Database service running
Production-facing web service
```

---

# 17. Impact Analysis

Create:

```text
ImpactAnalysisService
```

The service should receive the normalized comparison and call Claude Sonnet 5 through Amazon Bedrock.

Architecture:

```text
ComparisonResult
      ↓
ImpactAnalysisService
      ↓
Claude Bedrock Adapter
      ↓
Claude Sonnet 5
      ↓
Structured Analysis
```

---

# 18. Bedrock Adapter

Create:

```typescript
export interface BedrockAdapter {
  analyzeImpact(
    comparison: ComparisonResult,
    serverSnapshot: ServerSnapshot,
    release: ReleaseInformation,
  ): Promise<ImpactAnalysis>;
}
```

Implement:

```text
ClaudeBedrockAdapter
```

Amazon credentials must only exist on the backend.

Example environment configuration:

```env
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=
```

Do not expose these values to browser code.

---

# 19. LLM Prompt Requirements

The Claude prompt must clearly establish:

```text
You are a server patch impact analysis system.

Analyze only the supplied server state, release information,
and deterministic comparison.

Do not invent:
- vulnerabilities
- compatibility issues
- configuration changes
- downtime requirements
- dependencies
- release behavior

If information is missing, explicitly return:
"Insufficient data".

Your responsibility is to determine the likely impact
of upgrading the specified software on the specified server.
```

The LLM should analyze:

### Compatibility

Consider:

- OS
- Modules
- Services
- Configuration
- Dependencies

### Security

Consider:

- Security fixes
- Known security changes supplied by the release adapter
- Security importance

### Operational Risk

Consider:

- Possible downtime
- Restart requirements
- Configuration changes
- Dependency risk

### Performance

Consider:

- Potential performance improvements
- Resource utilization
- Resource considerations

---

# 20. Structured LLM Output

The model must return structured JSON matching:

```typescript
export interface ImpactAnalysis {
  impactLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  confidence: "LOW" | "MEDIUM" | "HIGH";

  executiveSummary: string;

  reasoning: string[];

  risks: string[];

  securityImpact: string[];

  compatibilityImpact: string[];

  operationalRisk: string[];

  performanceImpact: string[];

  recommendedActions: string[];

  preUpgradeChecks: string[];

  rollbackConsiderations: string[];
}
```

The output must be validated before being stored.

If the model returns malformed output:

1. Attempt structured parsing/repair where appropriate.
2. Validate the result.
3. Do not persist invalid analysis.
4. Return a controlled API error if validation fails.

---

# 21. Anti-Hallucination Requirement

The LLM must not invent facts.

For example, if the release information does not contain a specific vulnerability identifier, the model must not fabricate one.

Use:

```text
Insufficient data
```

when appropriate.

The analysis should distinguish between:

```text
Known fact
```

and:

```text
Potential impact
```

---

# 22. Server List

Create a `/servers` page.

Display:

| Server        | IP        | OS           | CPU | Memory | Disk | Status  | Software | Last Collection | Analysis |
| ------------- | --------- | ------------ | --: | -----: | ---: | ------- | -------: | --------------- | -------- |
| app-server-01 | 10.0.1.25 | Ubuntu 22.04 | 72% |    68% |  61% | Healthy |        3 | Recent          | Medium   |
| app-server-02 | 10.0.1.26 | Ubuntu 22.04 | 58% |    55% |  49% | Healthy |        4 | Recent          | Low      |
| web-server-01 | 10.0.1.40 | Ubuntu 24.04 | 42% |    48% |  52% | Healthy |        4 | Recent          | Low      |
| db-server-01  | 10.0.1.30 | Ubuntu 22.04 | 84% |    78% |  73% | Warning |        3 | Recent          | High     |
| api-server-01 | 10.0.1.50 | Debian 12    | 61% |    63% |  58% | Healthy |        4 | Recent          | Medium   |

Rows/cards should be clickable.

Navigate to:

```text
/server/:serverId
```

---

# 23. Server Details Page

Create:

```text
/server/:serverId
```

Sections:

## Overview

Display:

- Hostname
- IP
- OS
- Kernel
- Architecture
- Server status
- Last collection time

## Resource Metrics

Display:

- CPU
- Memory
- Disk
- Network if available

Use clear metric cards.

## Installed Software

Table:

| Software   | Current Version | Latest Version | Version Gap | Impact |
| ---------- | --------------- | -------------- | ----------- | ------ |
| nginx      | 1.24.0          | 1.26.2         | 2 minor     | Medium |
| PostgreSQL | 15.4            | 15.7           | 3 patch     | Low    |
| Node.js    | 20.11.1         | 20.19.x        | Minor       | Medium |

## Services

| Service    | Status  |
| ---------- | ------- |
| nginx      | Running |
| PostgreSQL | Running |
| Node.js    | Running |

## Configuration

Display:

- Enabled modules
- Important configuration values
- Ports
- Running services
- Installed packages
- OS information

Never display:

- Passwords
- Tokens
- Private keys
- API credentials
- Secrets

---

# 24. Analysis Workflow

When the user selects a software component and clicks:

```text
Analyze
```

execute:

```text
Analyze
   ↓
Collect server snapshot
   ↓
Identify installed software
   ↓
Get latest release information
   ↓
Run deterministic comparison
   ↓
Correlate configuration
   ↓
Call Claude Sonnet 5
   ↓
Validate analysis
   ↓
Persist analysis
   ↓
Refresh analysis UI
```

Do not reload the entire page.

---

# 25. Re-analyze Workflow

Add a prominent:

```text
Re-analyze
```

button.

The process should be:

```text
Re-analyze
    ↓
Collect latest server snapshot
    ↓
Get latest release information
    ↓
Run comparison
    ↓
Call Bedrock
    ↓
Store new analysis
    ↓
Refresh UI
```

Show live progress:

```text
Collecting server data...
Checking latest version...
Comparing changes...
Running impact analysis...
Generating report...
```

The analysis timestamp must be displayed.

---

# 26. Impact Analysis UI

Create a dedicated analysis page:

```text
/analyses/:analysisId
```

Top summary:

```text
Server
app-server-01

Component
nginx

Current Version
1.24.0

Latest Version
1.26.2

Impact
MEDIUM

Confidence
HIGH
```

Use clear badges:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Recommended sections:

1. Executive Summary
2. Version Comparison
3. Server Configuration Impact
4. Security Impact
5. Compatibility Impact
6. Operational Risk
7. Performance Impact
8. Recommended Actions
9. Pre-Upgrade Checklist
10. Rollback Considerations

---

# 27. Analysis History

Create:

```text
/history
```

Display:

| Date         | Server        | Component | Current | Latest | Impact | Confidence | Status    |
| ------------ | ------------- | --------- | ------- | ------ | ------ | ---------- | --------- |
| Aug 12, 2026 | app-server-01 | nginx     | 1.24.0  | 1.26.2 | Medium | High       | Completed |

Allow users to open previous analyses.

Previous analyses must remain immutable historical records.

---

# 28. Database

Use PostgreSQL.

Recommended entities:

```text
servers
server_snapshots
software_inventory
release_information
comparisons
impact_analyses
analysis_history
reports
```

Relationship:

```text
Server
   │
   ├── ServerSnapshot
   │       │
   │       └── SoftwareInventory
   │
   └── Analysis
           │
           ├── ReleaseInformation
           │
           ├── Comparison
           │
           └── Report
```

---

# 29. Server Table

Suggested fields:

```text
servers
--------
id
hostname
ip_address
os_name
os_version
status
created_at
updated_at
last_collected_at
```

---

# 30. Server Snapshot Table

Suggested fields:

```text
server_snapshots
----------------
id
server_id
kernel
architecture
cpu_cores
cpu_usage_percent
memory_total_mb
memory_used_percent
disk_total_gb
disk_used_percent
network_data
modules
configuration
collected_at
```

---

# 31. Software Inventory

Suggested fields:

```text
software_inventory
------------------
id
snapshot_id
name
version
created_at
```

---

# 32. Release Information

Suggested fields:

```text
release_information
-------------------
id
software
current_version
latest_version
release_date
changes
security_changes
configuration_changes
compatibility_changes
source
created_at
```

---

# 33. Comparison

Suggested fields:

```text
comparisons
-----------
id
server_snapshot_id
release_information_id
component
version_gap
security_changes_detected
configuration_changes_detected
server_dependencies
risk_factors
created_at
```

---

# 34. Impact Analysis

Suggested fields:

```text
impact_analyses
---------------
id
server_id
comparison_id
impact_level
confidence
executive_summary
reasoning
risks
security_impact
compatibility_impact
operational_risk
performance_impact
recommended_actions
pre_upgrade_checks
rollback_considerations
created_at
```

Use JSON/JSONB fields where appropriate for structured arrays.

---

# 35. Reports

Suggested fields:

```text
reports
-------
id
analysis_id
report_number
file_path
created_at
```

Example report number:

```text
ANA-000001
```

---

# 36. Secrets

Never store secrets in source code.

Do not store passwords in PostgreSQL as plain text.

Never expose:

```text
AWS credentials
AWX credentials
Database passwords
API tokens
Private keys
```

to the frontend.

Use environment variables or an appropriate secret-management mechanism.

---

# 37. REST API

Implement:

```http
GET /api/servers
```

Returns all monitored servers.

---

```http
GET /api/servers/:id
```

Returns detailed server information.

---

```http
POST /api/servers/:id/collect
```

Collects a new server snapshot.

---

```http
GET /api/servers/:id/software
```

Returns installed software and discovered versions.

---

```http
GET /api/servers/:id/analyses
```

Returns analysis history for the server.

---

```http
POST /api/servers/:id/reanalyze
```

Runs the complete analysis workflow.

---

```http
GET /api/analyses/:id
```

Returns a specific analysis.

---

```http
GET /api/analyses/:id/report
```

Generates or retrieves the PDF report.

---

# 38. API Response Design

Use consistent response structures.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "Impact analysis could not be completed"
  }
}
```

Do not leak internal stack traces or credentials.

---

# 39. PDF Reporting

Implement a proper PDF reporting service.

The PDF must contain:

```text
Server Impact Analysis Report

Server: app-server-01
Generated: 12 August 2026
Analysis ID: ANA-000001
```

Sections:

1. Cover
2. Executive Summary
3. Server Information
4. Current Environment
5. Software Version Comparison
6. Release Changes
7. Configuration Analysis
8. Security Impact
9. Compatibility Impact
10. Operational Impact
11. Risk Rating
12. Recommendations
13. Pre-Upgrade Checklist
14. Rollback Plan
15. Analysis Metadata

Use:

- Professional margins
- Page breaks
- Headings
- Tables
- Alignment
- Header/footer
- Page numbers
- Readable fonts
- Consistent spacing
- Professional enterprise styling

The PDF should look like a technical assessment report rather than a browser printout.

---

# 40. PDF Generation Flow

```text
GET /api/analyses/:id/report
             ↓
Report Service
             ↓
Load Analysis
             ↓
Load Server Snapshot
             ↓
Load Release Data
             ↓
Load Comparison
             ↓
Build Report Document
             ↓
Generate PDF
             ↓
Return PDF
```

---

# 41. Dashboard

The root dashboard should provide a high-level operational view.

Display:

### Server Summary

```text
Total Servers       5
Healthy             3
Warning             1
Critical            1
```

### Recent Analyses

Show the most recent analyses.

### Risk Distribution

Display:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Servers Requiring Attention

Prioritize servers with:

- High impact
- Critical impact
- Security-related changes
- High CPU utilization
- High memory utilization
- High disk utilization

---

# 42. UI Design

Use a clean enterprise dashboard.

Recommended layout:

```text
┌─────────────────────────────────────────────────────┐
│ Server Impact Analysis                              │
│                                                     │
│ Dashboard   Servers   Analysis History             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Total Servers   Healthy   Warning   Critical      │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Monitored Servers                                  │
│                                                     │
│  Server        OS       CPU    Memory   Status      │
│  app-server    Ubuntu   72%    68%     Healthy      │
│  db-server     Ubuntu   84%    78%     Warning      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Avoid excessive visual decoration.

Prioritize:

- Readability
- Information hierarchy
- Tables
- Status badges
- Metric cards
- Clear actions
- Consistent spacing

---

# 43. Server Details Layout

```text
┌──────────────────────────────────────────────────────┐
│ app-server-01                                        │
│ 10.0.1.25 · Ubuntu 22.04 · Healthy                  │
│                                                      │
│ [Collect Data]                    [Re-analyze]       │
├──────────────────────────────────────────────────────┤
│                                                      │
│ CPU        Memory        Disk       Services         │
│ 72%        68%           61%        2 Running        │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Installed Software                                   │
│                                                      │
│ nginx       1.24.0 → 1.26.2       [Analyze]          │
│ PostgreSQL  15.4   → 15.7         [Analyze]          │
│ Node.js     20.11  → 20.19        [Analyze]          │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Services                                             │
│                                                      │
│ nginx          Running                             │
│ PostgreSQL     Running                             │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Configuration                                        │
│                                                      │
│ Modules: SSL, HTTP/2                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

# 44. Analysis Layout

```text
┌──────────────────────────────────────────────────────┐
│ Impact Analysis                                      │
│                                                      │
│ app-server-01 · nginx                                │
│                                                      │
│ Current       Latest       Impact      Confidence    │
│ 1.24.0        1.26.2       MEDIUM      HIGH          │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Executive Summary                                    │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Version Comparison                                   │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Security Impact                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Compatibility Impact                                 │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Operational Risk                                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Recommended Actions                                  │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Pre-Upgrade Checklist                                │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Rollback Considerations                              │
│                                                      │
│ [Re-analyze]                    [Download Report]     │
└──────────────────────────────────────────────────────┘
```

---

# 45. Re-analysis State Management

Do not reload the entire browser page.

Use client-side state for the workflow state:

```typescript
type AnalysisStage =
  | "idle"
  | "collecting"
  | "checking-release"
  | "comparing"
  | "analyzing"
  | "generating-report"
  | "completed"
  | "failed";
```

Display the current stage in the UI.

Disable duplicate analysis requests while an analysis is running.

---

# 46. Error Handling

Handle failures at every integration boundary.

Examples:

### Ansible Failure

```text
Unable to collect server data.
The previous snapshot remains available.
```

### Release Source Failure

```text
Latest release information could not be retrieved.
Impact analysis cannot determine the version impact reliably.
```

### Bedrock Failure

```text
Impact analysis could not be completed.
The collected server and release comparison remains available.
```

### PDF Failure

```text
The analysis was completed, but the report could not be generated.
```

Do not silently fail.

---

# 47. Data Freshness

Every server snapshot must have:

```text
collectedAt
```

Every release record must have:

```text
createdAt
releaseDate
```

Every analysis must have:

```text
createdAt
```

The UI should clearly show when information was collected.

Example:

```text
Server data collected:
12 Aug 2026, 10:00 UTC

Analysis generated:
12 Aug 2026, 10:04 UTC
```

---

# 48. Security Architecture

The final system must enforce:

```text
Browser
   │
   │ REST
   ▼
Node.js API
   │
   ├── Ansible/AWX
   │
   ├── Release Sources
   │
   ├── Bedrock
   │
   └── PostgreSQL
```

The browser must never directly communicate with:

```text
AWX
AWS Bedrock
PostgreSQL
```

---

# 49. AI Safety Boundary

The prototype must strictly follow:

```text
AI
 ↓
Analysis
 ↓
Recommendation
```

Never:

```text
AI
 ↓
Unrestricted shell
 ↓
Production server
```

The AI must not:

- Execute shell commands
- SSH into servers
- Modify server configuration
- Install packages
- Restart services
- Apply patches
- Launch arbitrary Ansible jobs

The prototype is analysis-only.

---

# 50. No Automatic Patching

Do not implement:

```text
Patch
Upgrade
Restart
Execute
Apply
```

actions.

Only provide recommendations such as:

```text
Recommended Actions

1. Review nginx configuration.
2. Validate HTTP/2 behavior in staging.
3. Confirm SSL configuration compatibility.
4. Create a rollback package.
5. Schedule maintenance if restart is required.
```

---

# 51. Seed Data

Create at least five servers.

## app-server-01

```text
OS: Ubuntu 22.04
CPU: 72%
Memory: 68%
Disk: 61%

Software:
nginx 1.24.0
PostgreSQL 15.4
Node.js 20.11.1

Modules:
ssl
http_v2
```

## app-server-02

```text
OS: Ubuntu 22.04
CPU: 58%
Memory: 55%
Disk: 49%

Software:
nginx 1.24.0
Node.js 20.12.2
Redis 7.2.x

Modules:
ssl
http_v2
```

## web-server-01

```text
OS: Ubuntu 24.04
CPU: 42%
Memory: 48%
Disk: 52%

Software:
nginx 1.26.x
Node.js 20.x

Modules:
ssl
http_v2
gzip
```

## db-server-01

```text
OS: Ubuntu 22.04
CPU: 84%
Memory: 78%
Disk: 73%

Software:
PostgreSQL 15.4
nginx 1.24.0

Services:
postgresql
nginx
```

## api-server-01

```text
OS: Debian 12
CPU: 61%
Memory: 63%
Disk: 58%

Software:
Node.js 20.11.1
nginx 1.24.0

Services:
node
nginx
```

Make each server meaningfully different so the dashboard demonstrates realistic analysis scenarios.

---

# 52. Example Impact Scenario

For `app-server-01` and nginx:

```text
Current Version
1.24.0

Latest Version
1.26.2

Version Gap
2 minor releases + patch difference

Server Configuration
HTTP/2 enabled
SSL enabled

CPU
72%

Memory
68%
```

Release information:

```text
Security improvements
HTTP/2 changes
Configuration changes
```

The deterministic comparison should produce:

```json
{
  "component": "nginx",
  "currentVersion": "1.24.0",
  "latestVersion": "1.26.2",
  "securityChanges": true,
  "configurationChanges": true,
  "serverDependencies": ["http_v2", "ssl"],
  "riskFactors": [
    "HTTP/2 enabled",
    "SSL module enabled",
    "Current CPU utilization is 72%"
  ]
}
```

Claude should then determine the higher-level impact.

---

# 53. Dependency Injection

Create factories for each integration:

```typescript
createAnsibleAdapter();
createReleaseAdapter();
createBedrockAdapter();
```

Example:

```typescript
const ansibleAdapter = createAnsibleAdapter();
const releaseAdapter = createReleaseAdapter();
const bedrockAdapter = createBedrockAdapter();
```

Services should receive these dependencies rather than importing concrete implementations directly.

Example:

```typescript
class ImpactAnalysisService {
  constructor(
    private readonly ansibleAdapter: AnsibleAdapter,
    private readonly releaseAdapter: ReleaseAdapter,
    private readonly bedrockAdapter: BedrockAdapter,
  ) {}

  async analyze(serverId: string, software: string) {
    // workflow
  }
}
```

This makes the system testable and allows providers to be replaced.

---

# 54. Environment Configuration

Provide:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# Ansible
ANSIBLE_PROVIDER=simulated

# AWX
AWX_BASE_URL=
AWX_TOKEN=
AWX_JOB_TEMPLATE_ID=

# Release provider
RELEASE_PROVIDER=simulated

# AWS
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Bedrock
BEDROCK_MODEL_ID=
```

Never commit actual values.

Provide:

```text
.env.example
```

instead.

---

# 55. Database Initialization

The prototype should include:

- Database schema
- Migrations
- Seed script
- Sample server data
- Sample software inventory
- Sample analyses where useful

The application should be able to start from an empty PostgreSQL database and initialize its required schema.

---

# 56. Development Experience

Provide scripts similar to:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:migrate": "...",
    "db:seed": "...",
    "db:reset": "..."
  }
}
```

The exact commands should match the selected PostgreSQL ORM/migration solution.

---

# 57. Prototype Completion Criteria

The implementation is complete only when the following workflow works:

```text
Open Dashboard
       ↓
View 5 servers
       ↓
Select app-server-01
       ↓
View server configuration
       ↓
View installed software
       ↓
Click Analyze
       ↓
Collect simulated Ansible data
       ↓
Get release information
       ↓
Run deterministic comparison
       ↓
Call Claude Sonnet 5 through Bedrock
       ↓
Persist analysis
       ↓
Display impact analysis
       ↓
Click Re-analyze
       ↓
Generate a new analysis
       ↓
Open Analysis History
       ↓
Open previous analysis
       ↓
Click Download Report
       ↓
Generate professional PDF
       ↓
Download PDF
```

Every major action must be functional.

Do not leave:

- Placeholder pages
- Fake buttons
- Dead navigation
- Mock chatbot interactions
- Unimplemented API routes
- Disconnected UI components

---

# 58. Acceptance Criteria

## Data Collection

- [ ] Five simulated servers are available.
- [ ] Server data is isolated inside `SimulatedAnsibleAdapter`.
- [ ] Frontend never contains simulated Ansible data.
- [ ] `AnsibleAdapter` interface is implemented.
- [ ] `AWXApiAdapter` structure exists for future integration.
- [ ] Provider can be switched using environment configuration.

## Release Discovery

- [ ] `ReleaseAdapter` interface exists.
- [ ] Simulated release data works.
- [ ] Current and latest release data are clearly separated.
- [ ] Official release integration can later replace simulated data.

## Comparison

- [ ] Version comparison is deterministic.
- [ ] Version gaps are calculated by code.
- [ ] Configuration correlations are calculated before the LLM call.
- [ ] Risk factors are structured.
- [ ] The LLM is not responsible for basic calculations.

## AI Analysis

- [ ] Claude Sonnet 5 is accessed through a Bedrock adapter.
- [ ] AWS credentials never reach the frontend.
- [ ] Structured output is validated.
- [ ] Hallucinated facts are explicitly prohibited.
- [ ] Missing information results in `Insufficient data`.
- [ ] Analysis contains impact, confidence, risks, recommendations, checks, and rollback considerations.

## UI

- [ ] Dashboard works.
- [ ] Server list works.
- [ ] Server details work.
- [ ] Installed software is displayed.
- [ ] Services are displayed.
- [ ] Configuration is displayed.
- [ ] Analyze works.
- [ ] Re-analyze works.
- [ ] Analysis history works.
- [ ] Previous reports can be opened.
- [ ] Loading states are displayed.
- [ ] Error states are displayed.

## PDF

- [ ] Download Report works.
- [ ] PDF has a professional layout.
- [ ] PDF includes all required sections.
- [ ] PDF includes report ID.
- [ ] PDF includes timestamps.
- [ ] PDF includes tables.
- [ ] PDF includes page numbers.
- [ ] PDF includes headers and footers.

## Security

- [ ] No secrets are hardcoded.
- [ ] No credentials are exposed to the browser.
- [ ] No direct browser-to-AWX communication exists.
- [ ] No direct browser-to-Bedrock communication exists.
- [ ] No automatic patching exists.
- [ ] LLM cannot execute commands.
- [ ] Sensitive server configuration is filtered.

---

# 59. Final Architecture

The completed prototype should implement:

```text
                         ┌──────────────────────┐
                         │      Next.js         │
                         │                      │
                         │ Dashboard            │
                         │ Servers              │
                         │ Server Details       │
                         │ Impact Analysis      │
                         │ Analysis History     │
                         └──────────┬───────────┘
                                    │
                                  REST
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Node.js API      │
                         │                      │
                         │ Server Service       │
                         │ Collection Service   │
                         │ Release Service      │
                         │ Comparison Service   │
                         │ Analysis Service     │
                         │ Report Service       │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └─────────────┐
                    ▼                                  ▼
          ┌───────────────────┐              ┌───────────────────┐
          │ AnsibleAdapter    │              │ ReleaseAdapter    │
          │                   │              │                   │
          │ Simulated         │              │ Simulated         │
          │ AWX API           │              │ Official Sources  │
          └─────────┬─────────┘              └─────────┬─────────┘
                    │                                  │
                    ▼                                  ▼
             Server Snapshot                    Release Information
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
                         ┌──────────────────────┐
                         │ Comparison Engine    │
                         │                      │
                         │ Version Gap          │
                         │ Config Correlation   │
                         │ Dependencies         │
                         │ Risk Factors        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Impact Analyzer      │
                         │                      │
                         │ Bedrock              │
                         │ Claude Sonnet 5      │
                         └──────────┬───────────┘
                                    │
                       ┌────────────┴─────────────┐
                       ▼                          ▼
              ┌──────────────────┐       ┌─────────────────┐
              │   PostgreSQL     │       │  PDF Service    │
              │                  │       │                 │
              │ Servers          │       │ Enterprise PDF  │
              │ Snapshots        │       │ Reports         │
              │ Releases         │       └─────────────────┘
              │ Comparisons      │
              │ Analyses         │
              │ History          │
              └──────────────────┘
```

---

# 60. Final Implementation Principle

The implementation should preserve the following responsibility boundaries:

```text
ANSIBLE/AWX
    =
"What is running on this server?"

RELEASE ADAPTER
    =
"What changed in the new version?"

COMPARISON ENGINE
    =
"How are those two states different?"

CLAUDE SONNET 5
    =
"What does that difference mean for this server?"

POSTGRESQL
    =
"What did we collect and analyze?"

PDF SERVICE
    =
"How do we produce the formal technical assessment?"

NEXT.JS
    =
"How does the user inspect and interact with the analysis?"
```

The final prototype must therefore be an **actual server impact-analysis platform**, not an AI chatbot with simulated responses.

The primary production-extension path should be:

```text
SimulatedAnsibleAdapter
        ↓
AWXApiAdapter

SimulatedReleaseAdapter
        ↓
OfficialReleaseAdapter

Mock/optional Bedrock
        ↓
Claude Sonnet 5 via Amazon Bedrock
```

The frontend, domain models, comparison engine, persistence layer, and analysis workflow should not need to be redesigned when the simulated integrations are replaced with real infrastructure.
