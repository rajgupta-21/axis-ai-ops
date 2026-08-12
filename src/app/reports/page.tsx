import Link from "next/link";
import { apiFetch, getApiBaseUrl } from "@/lib/apiClient";
import { ReportListItem } from "@/domain/report";
import { RiskBadge } from "@/components/RiskBadge";
import { PageContainer } from "@/components/PageContainer";
import { formatDateTime } from "@/lib/format";
import { DocumentIcon, DownloadIcon, InboxIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await apiFetch<ReportListItem[]>("/api/reports?limit=200");

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <DocumentIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Every PDF report ever generated from an impact analysis, most recent first.
            </p>
          </div>
        </div>

        {reports.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            <InboxIcon className="h-4 w-4 text-slate-400" />
            No reports have been generated yet. Download a report from any analysis page to create one.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Report Number</th>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Component</th>
                  <th className="px-4 py-3">Impact</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                      {report.reportNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/servers/${report.serverId}`} className="font-medium text-slate-900 hover:underline">
                        {report.hostname}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{report.component}</td>
                    <td className="px-4 py-3">
                      <RiskBadge level={report.impactLevel} size="sm" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {formatDateTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/analyses/${report.analysisId}`} className="text-sm text-slate-500 hover:text-slate-800">
                          View analysis
                        </Link>
                        <a
                          href={`${getApiBaseUrl()}/api/analyses/${report.analysisId}/report`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
