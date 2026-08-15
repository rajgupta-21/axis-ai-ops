Agent 1 — Server Patch Impact Analysis Workflow

Build Agent 1: Server Version & Patch Impact Analysis as a structured analysis agent, not a chatbot.

The agent receives a server ID and software component to analyze.

It calls the Ansible/AWX Adapter to collect the latest server snapshot.

The adapter returns normalized server facts independent of whether the source is simulated AWX or real AWX.

The agent extracts the installed software and its current version from the snapshot.

It identifies relevant server context: OS, resources, services, modules, ports, and configuration.

The agent calls the Release Adapter to retrieve the latest version and official release information.

Release information includes version, release date, changelog, security changes, and configuration changes.

The Comparison Engine deterministically compares the current and latest versions.

It calculates version gaps without using the LLM for basic version comparison.

It correlates release changes with the server's installed modules, services, dependencies, and configuration.

The engine produces structured risk factors and a normalized comparison result.

This comparison becomes the input context for the Impact Analyzer.

The Impact Analyzer sends the structured data to Claude Sonnet 5 through Amazon Bedrock.

Claude evaluates compatibility, security impact, operational risk, performance considerations, and dependencies.

Claude generates a structured assessment with Impact Level and Confidence.

The analysis includes reasoning, risks, recommended actions, pre-upgrade checks, and rollback considerations.

Claude must never invent missing facts; unavailable information must be reported as Insufficient data.

The completed analysis is persisted in PostgreSQL for history and auditing.

The UI displays the analysis and allows the user to Re-analyze, repeating the workflow with fresh data.

The final analysis can be converted into a professional PDF report; the agent only recommends changes and never automatically patches or modifies the server.

## important the input should be in a document which user can add in the main dashboard also the final output is in a documnte or a report for each server or for all server.
