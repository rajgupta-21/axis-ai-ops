import { ServerSnapshot } from "@/domain/server";
import { CpuIcon, DiskIcon, MemoryIcon } from "./icons";

function thresholdColor(percent: number): { text: string; bar: string; chip: string } {
  if (percent >= 80) return { text: "text-red-600", bar: "bg-red-500", chip: "bg-red-50 text-red-600" };
  if (percent >= 65) return { text: "text-amber-600", bar: "bg-amber-500", chip: "bg-amber-50 text-amber-600" };
  return { text: "text-emerald-600", bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-600" };
}

function MetricRow({
  icon: Icon,
  label,
  percent,
  detail,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  label: string;
  percent: number;
  detail: string;
}) {
  const tone = thresholdColor(percent);
  return (
    <div className="flex items-center gap-4 py-3">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone.chip}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className={`text-sm font-semibold ${tone.text}`}>{percent}%</p>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      </div>
      <p className="w-24 flex-shrink-0 text-right text-xs text-slate-400">{detail}</p>
    </div>
  );
}

export function ResourceMetricsPanel({ snapshot }: { snapshot: ServerSnapshot }) {
  const usedCores = (snapshot.cpu.cores * snapshot.cpu.usagePercent) / 100;
  const usedMemoryGb = (snapshot.memory.totalMB * snapshot.memory.usedPercent) / 100 / 1024;
  const totalMemoryGb = snapshot.memory.totalMB / 1024;
  const usedDiskGb = (snapshot.disk.totalGB * snapshot.disk.usedPercent) / 100;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Resource Metrics</p>
      <div className="mt-1 divide-y divide-slate-100">
        <MetricRow
          icon={CpuIcon}
          label="CPU"
          percent={snapshot.cpu.usagePercent}
          detail={`${usedCores.toFixed(2)} / ${snapshot.cpu.cores} cores`}
        />
        <MetricRow
          icon={MemoryIcon}
          label="Memory"
          percent={snapshot.memory.usedPercent}
          detail={`${usedMemoryGb.toFixed(1)} / ${totalMemoryGb.toFixed(1)} GB`}
        />
        <MetricRow
          icon={DiskIcon}
          label="Disk"
          percent={snapshot.disk.usedPercent}
          detail={`${usedDiskGb.toFixed(0)} / ${snapshot.disk.totalGB} GB`}
        />
        {snapshot.network && (
          <div className="flex items-center gap-4 py-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
                <path d="M4 12h16M12 4c2 2.2 3 5 3 8s-1 5.8-3 8c-2-2.2-3-5-3-8s1-5.8 3-8z" />
              </svg>
            </span>
            <div className="flex flex-1 items-center justify-between text-sm">
              <p className="font-medium text-slate-700">Network</p>
              <div className="flex items-center gap-4 text-slate-500">
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {snapshot.network.inboundMbps ?? "—"} Mbps
                </span>
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {snapshot.network.outboundMbps ?? "—"} Mbps
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
