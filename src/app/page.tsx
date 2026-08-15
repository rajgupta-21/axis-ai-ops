import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { ServerSummary } from "@/domain/server";
import { AnalysisRecord } from "@/domain/analysis";
import { ServerTable } from "@/components/ServerTable";
import { AnalysisTimeline } from "@/components/AnalysisTimeline";
import { PlaybookAnalysisPanel } from "@/components/PlaybookAnalysisPanel";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { PageContainer } from "@/components/PageContainer";
import {
  AlertTriangleIcon,
  DashboardIcon,
  GaugeIcon,
  ServerIcon,
  ShieldIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const IMPACT_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const IMPACT_BAR_COLOR: Record<string, string> = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500",
};

function attentionReasons(server: ServerSummary): string[] {
  const reasons: string[] = [];
  if (server.status === "critical") reasons.push("Server status is critical");
  else if (server.status === "warning") reasons.push("Server status is warning");
  if (server.latestImpactLevel === "CRITICAL") reasons.push("Critical impact analysis on file");
  else if (server.latestImpactLevel === "HIGH") reasons.push("High impact analysis on file");
  if ((server.cpuUsagePercent ?? 0) >= 75) reasons.push(`High CPU utilization (${server.cpuUsagePercent}%)`);
  if ((server.memoryUsedPercent ?? 0) >= 75) reasons.push(`High memory utilization (${server.memoryUsedPercent}%)`);
  if ((server.diskUsedPercent ?? 0) >= 80) reasons.push(`High disk utilization (${server.diskUsedPercent}%)`);
  return reasons;
}

export default async function DashboardPage() {
  const [servers, recentAnalyses] = await Promise.all([
    apiFetch<ServerSummary[]>("/api/servers"),
    apiFetch<AnalysisRecord[]>("/api/analyses?limit=5"),
  ]);

  const healthy = servers.filter((s) => s.status === "healthy").length;
  const warning = servers.filter((s) => s.status === "warning").length;
  const critical = servers.filter((s) => s.status === "critical").length;

  const riskDistribution = IMPACT_LEVELS.map((level) => ({
    level,
    count: servers.filter((s) => s.latestImpactLevel === level).length,
  }));
  const maxRiskCount = Math.max(1, ...riskDistribution.map((r) => r.count));

  const attention = servers
    .map((server) => ({ server, reasons: attentionReasons(server) }))
    .filter((entry) => entry.reasons.length > 0);

  return (
    <PageContainer>
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <DashboardIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Operational overview of monitored servers and recent impact analyses.
            </p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Servers" value={servers.length} icon={ServerIcon} accent="text-slate-900" iconBg="bg-slate-100" />
        <SummaryCard label="Healthy" value={healthy} icon={ShieldIcon} accent="text-emerald-600" iconBg="bg-emerald-50" />
        <SummaryCard label="Warning" value={warning} icon={AlertTriangleIcon} accent="text-amber-600" iconBg="bg-amber-50" />
        <SummaryCard label="Critical" value={critical} icon={AlertTriangleIcon} accent="text-red-600" iconBg="bg-red-50" />
      </section>

      <section>
        <div className="flex items-center gap-2">
          <ServerIcon className="h-4 w-4 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Monitored Servers</h2>
        </div>
        <div className="mt-3">
          <ServerTable servers={servers} />
        </div>
      </section>

      <section>
        <PlaybookAnalysisPanel servers={servers} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center gap-2">
            <GaugeIcon className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Recent Analyses</h2>
          </div>
          <div className="mt-3">
            <AnalysisTimeline analyses={recentAnalyses} />
          </div>

          <div className="mt-6 flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Risk Distribution</h2>
          </div>
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            {riskDistribution.map((entry) => (
              <div key={entry.level} className="flex items-center gap-3">
                <div className="w-24 flex-shrink-0">
                  <RiskBadge level={entry.level} size="sm" />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${IMPACT_BAR_COLOR[entry.level]} transition-all`}
                    style={{ width: `${(entry.count / maxRiskCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 flex-shrink-0 text-right text-sm font-medium text-slate-600">
                  {entry.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Servers Requiring Attention</h2>
          </div>
          <div className="mt-3">
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                <ShieldIcon className="h-4 w-4 text-emerald-500" />
                No servers currently require attention.
              </p>
            ) : (
              <ul className="space-y-2">
                {attention.map(({ server, reasons }) => (
                  <li key={server.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/servers/${server.id}`}
                        className="text-sm font-semibold text-slate-900 hover:underline"
                      >
                        {server.hostname}
                      </Link>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={server.status} size="sm" />
                        <RiskBadge level={server.latestImpactLevel} size="sm" />
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {reasons.map((reason) => (
                        <li key={reason} className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
    </PageContainer>
  );
}

function SummaryCard({
  label,
  value,
  accent = "text-slate-900",
  icon: Icon,
  iconBg,
}: {
  label: string;
  value: number;
  accent?: string;
  icon: (props: { className?: string }) => React.ReactElement;
  iconBg: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconBg}`}>
          <Icon className={`h-4 w-4 ${accent}`} />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
