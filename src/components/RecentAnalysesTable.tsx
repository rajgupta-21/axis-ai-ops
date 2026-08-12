import Link from "next/link";
import { AnalysisRecord } from "@/domain/analysis";
import { RiskBadge } from "./RiskBadge";
import { formatAnalysisCode, formatDateTime } from "@/lib/format";
import { InboxIcon } from "./icons";

export function RecentAnalysesTable({ analyses }: { analyses: AnalysisRecord[] }) {
  if (analyses.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <InboxIcon className="h-4 w-4 text-slate-400" />
        No analyses have been run for this server yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Analysis ID</th>
            <th className="px-4 py-3">Component</th>
            <th className="px-4 py-3">Current Version</th>
            <th className="px-4 py-3">Latest Version</th>
            <th className="px-4 py-3">Impact</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Analyzed At</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {analyses.map((analysis) => (
            <tr key={analysis.id} className="transition hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{formatAnalysisCode(analysis.id)}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{analysis.component}</td>
              <td className="px-4 py-3 text-slate-600">{analysis.currentVersion}</td>
              <td className="px-4 py-3 text-slate-600">{analysis.latestVersion}</td>
              <td className="px-4 py-3">
                <RiskBadge level={analysis.impactLevel} size="sm" />
              </td>
              <td className="px-4 py-3 text-slate-600">{analysis.confidence}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Completed
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(analysis.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/analyses/${analysis.id}`} className="text-slate-400 hover:text-slate-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
