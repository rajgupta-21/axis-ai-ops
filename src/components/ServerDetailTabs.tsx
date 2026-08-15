"use client";

import { use, useState } from "react";
import { ServerDetails } from "@/domain/server";
import { AnalysisRecord } from "@/domain/analysis";
import { SoftwareVersionInfo } from "@/domain/software";
import { StatusBadge } from "./StatusBadge";
import { CollectDataButton } from "./CollectDataButton";
import { AnalysisWorkflow } from "./AnalysisWorkflow";
import { DownloadReportButton } from "./DownloadReportButton";
import { ServerInfoCard } from "./ServerInfoCard";
import { ResourceMetricsPanel } from "./ResourceMetricsPanel";
import { SoftwareTable } from "./SoftwareTable";
import { ServiceTable } from "./ServiceTable";
import { ConfigurationPanel } from "./ConfigurationPanel";
import { RecentAnalysesTable } from "./RecentAnalysesTable";
import { AnalysisTimeline } from "./AnalysisTimeline";
import { SoftwareSummaryCard, ServicesSummaryCard, ConfigurationSummaryCard } from "./ServerSummaryCards";
import { AsyncBoundary } from "./AsyncBoundary";
import { SkeletonCard, SoftwareLoading } from "./Skeletons";

const TABS = ["Overview", "Software", "Services", "Configuration", "Analysis", "History"] as const;
type Tab = (typeof TABS)[number];

/**
 * Resolves the streamed software list. Rendered only inside an AsyncBoundary, so
 * the pending and failed states are handled by the boundary rather than here.
 */
function SoftwareSummarySection({
  promise,
  onViewAll,
}: {
  promise: Promise<SoftwareVersionInfo[]>;
  onViewAll: () => void;
}) {
  return <SoftwareSummaryCard software={use(promise)} onViewAll={onViewAll} />;
}

function SoftwareTableSection({
  serverId,
  promise,
  readOnly,
}: {
  serverId: string;
  promise: Promise<SoftwareVersionInfo[]>;
  readOnly?: boolean;
}) {
  return <SoftwareTable serverId={serverId} software={use(promise)} readOnly={readOnly} />;
}

export function ServerDetailTabs({
  server,
  softwarePromise,
  analyses,
}: {
  server: ServerDetails;
  /**
   * Unresolved on purpose. Release lookups make this the slowest data on the
   * page by minutes on a cold cache, so it streams in separately instead of
   * holding up the rest of the render.
   */
  softwarePromise: Promise<SoftwareVersionInfo[]>;
  analyses: AnalysisRecord[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const snapshot = server.snapshot;
  const latestAnalysis = analyses[0];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-8 pt-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{server.hostname}</h1>
            <StatusBadge status={server.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {server.ipAddress} · {server.os.name} {server.os.version}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CollectDataButton serverId={server.id} />
          {latestAnalysis ? (
            <>
              <AnalysisWorkflow
                serverId={server.id}
                component={latestAnalysis.component}
                label="Re-analyze"
                variant="outline"
              />
              <DownloadReportButton analysisId={latestAnalysis.id} />
            </>
          ) : (
            <p className="max-w-[14rem] text-xs text-slate-400">
              Run an analysis from the Software tab to enable re-analyze and reports.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-slate-200 px-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-8 py-6">
        {activeTab === "Overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <ServerInfoCard server={server} />
              {snapshot && <ResourceMetricsPanel snapshot={snapshot} />}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <AsyncBoundary fallback={<SkeletonCard />}>
                <SoftwareSummarySection
                  promise={softwarePromise}
                  onViewAll={() => setActiveTab("Software")}
                />
              </AsyncBoundary>
              {snapshot && (
                <ServicesSummaryCard services={snapshot.services} onViewAll={() => setActiveTab("Services")} />
              )}
              {snapshot && (
                <ConfigurationSummaryCard snapshot={snapshot} onViewAll={() => setActiveTab("Configuration")} />
              )}
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Recent Impact Analyses</p>
              <RecentAnalysesTable analyses={analyses.slice(0, 5)} />
            </div>
          </div>
        )}

        {activeTab === "Software" && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Reference view of installed software and discovered versions. Use the Analysis tab to run or
              re-run an impact analysis.
            </p>
            <AsyncBoundary fallback={<SoftwareLoading />}>
              <SoftwareTableSection serverId={server.id} promise={softwarePromise} readOnly />
            </AsyncBoundary>
          </div>
        )}

        {activeTab === "Services" && snapshot && <ServiceTable services={snapshot.services} />}

        {activeTab === "Configuration" && snapshot && <ConfigurationPanel snapshot={snapshot} />}

        {activeTab === "Analysis" && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Select a software component and click Analyze to run the full impact analysis workflow:
              collect snapshot, check latest release, compare, and run Claude Sonnet 5 through Bedrock.
            </p>
            <AsyncBoundary fallback={<SoftwareLoading />}>
              <SoftwareTableSection serverId={server.id} promise={softwarePromise} />
            </AsyncBoundary>
          </div>
        )}

        {activeTab === "History" && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Every analysis is an immutable historical record for this server.
            </p>
            <AnalysisTimeline analyses={analyses} />
          </div>
        )}
      </div>
    </div>
  );
}
