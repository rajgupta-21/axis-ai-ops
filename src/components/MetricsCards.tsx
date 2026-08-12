import { CpuIcon, DiskIcon, MemoryIcon, ServicesIcon } from "./icons";

function thresholdColor(percent: number): { text: string; bar: string } {
  if (percent >= 80) return { text: "text-red-600", bar: "bg-red-500" };
  if (percent >= 65) return { text: "text-amber-600", bar: "bg-amber-500" };
  return { text: "text-emerald-600", bar: "bg-emerald-500" };
}

function ProgressBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${colorClass} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function MetricsCards({
  cpu,
  memory,
  disk,
  services,
}: {
  cpu: number;
  memory: number;
  disk: number;
  services: { running: number; total: number };
}) {
  const cpuColor = thresholdColor(cpu);
  const memoryColor = thresholdColor(memory);
  const diskColor = thresholdColor(disk);
  const servicesPercent = services.total > 0 ? (services.running / services.total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">CPU</p>
          <CpuIcon className={`h-4 w-4 ${cpuColor.text}`} />
        </div>
        <p className={`mt-1 text-2xl font-semibold ${cpuColor.text}`}>{cpu}%</p>
        <ProgressBar percent={cpu} colorClass={cpuColor.bar} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Memory</p>
          <MemoryIcon className={`h-4 w-4 ${memoryColor.text}`} />
        </div>
        <p className={`mt-1 text-2xl font-semibold ${memoryColor.text}`}>{memory}%</p>
        <ProgressBar percent={memory} colorClass={memoryColor.bar} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Disk</p>
          <DiskIcon className={`h-4 w-4 ${diskColor.text}`} />
        </div>
        <p className={`mt-1 text-2xl font-semibold ${diskColor.text}`}>{disk}%</p>
        <ProgressBar percent={disk} colorClass={diskColor.bar} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Services</p>
          <ServicesIcon className="h-4 w-4 text-slate-500" />
        </div>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {services.running}
          <span className="text-base font-normal text-slate-400"> / {services.total}</span>
        </p>
        <ProgressBar percent={servicesPercent} colorClass="bg-slate-500" />
      </div>
    </div>
  );
}
