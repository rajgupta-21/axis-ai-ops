import Link from "next/link";
import { apiFetchSafe } from "@/lib/apiClient";
import { AnalysisRecord } from "@/domain/analysis";
import { RiskBadge } from "@/components/RiskBadge";
import { formatDateTime } from "@/lib/format";
import { HistoryIcon } from "@/components/icons";
import { PageContainer } from "@/components/PageContainer";
import { StatusNotice } from "@/components/StatusNotice";

export const dynamic = "force-dynamic";

const IMPACT_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default async function HistoryPage() {
  const result = await apiFetchSafe<AnalysisRecord[]>("/api/analyses?limit=200");
  const analyses = result.ok ? result.data : [];
  const error = result.ok ? null : result.error.message;

  const counts = IMPACT_LEVELS.map((level) => ({
    level,
    count: analyses.filter((a) => a.impactLevel === level).length,
  }));

  return (
    <PageContainer>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
          <HistoryIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analysis History</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Every completed impact analysis is an immutable historical record.
          </p>
        </div>
      </div>

      {error && (
        <StatusNotice tone="error" title="Analysis history is unavailable" message={error} />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{analyses.length}</p>
        </div>
        {counts.map((entry) => (
          <div key={entry.level} className="rounded-lg border border-slate-200 bg-white p-4">
            <RiskBadge level={entry.level} size="sm" />
            <p className="mt-2 text-2xl font-semibold text-slate-900">{entry.count}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Server</th>
              <th className="px-4 py-3">Component</th>
              <th className="px-4 py-3">Current</th>
              <th className="px-4 py-3">Latest</th>
              <th className="px-4 py-3">Impact</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analyses.map((analysis) => (
              <tr key={analysis.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(analysis.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/servers/${analysis.serverId}`} className="font-medium text-slate-900 hover:underline">
                    {analysis.hostname}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{analysis.component}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                    {analysis.currentVersion}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                    {analysis.latestVersion}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={analysis.impactLevel} />
                </td>
                <td className="px-4 py-3 text-slate-600">{analysis.confidence}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/analyses/${analysis.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Completed
                  </Link>
                </td>
              </tr>
            ))}
            {analyses.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  {/* "None yet" and "we could not ask" are different facts, and
                      showing the first when the second is true is misleading. */}
                  {error ? "The list could not be loaded." : "No analyses have been run yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </PageContainer>
  );
}
