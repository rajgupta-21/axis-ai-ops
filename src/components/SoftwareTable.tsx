import { SoftwareVersionInfo } from "@/domain/software";
import { RiskBadge } from "./RiskBadge";
import { AnalysisWorkflow } from "./AnalysisWorkflow";
import { VersionIcon } from "./icons";

export function SoftwareTable({
  serverId,
  software,
  readOnly = false,
}: {
  serverId: string;
  software: SoftwareVersionInfo[];
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Software</th>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">Version Gap</th>
            <th className="px-4 py-3">Impact</th>
            {!readOnly && <th className="px-4 py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {software.map((item) => {
            const upToDate = item.currentVersion === item.latestVersion;
            return (
              <tr key={item.name}>
                <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                      {item.currentVersion}
                    </span>
                    {!upToDate && (
                      <>
                        <VersionIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-700">
                          {item.latestVersion}
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {upToDate ? (
                    <span className="text-emerald-600">Up to date</span>
                  ) : (
                    item.versionGapDescription
                  )}
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={item.latestImpactLevel} />
                </td>
                {!readOnly && (
                  <td className="px-4 py-3 text-right">
                    <AnalysisWorkflow serverId={serverId} component={item.name} label="Analyze" />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
