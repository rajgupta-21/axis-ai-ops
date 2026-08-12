import { SoftwareVersionInfo } from "@/domain/software";
import { ServiceInfo, ServerSnapshot } from "@/domain/server";

function SummaryCardShell({
  title,
  onViewAll,
  viewAllLabel,
  children,
}: {
  title: string;
  onViewAll: () => void;
  viewAllLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-1 flex-1 divide-y divide-slate-100">{children}</div>
      <button
        type="button"
        onClick={onViewAll}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        {viewAllLabel}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function SoftwareSummaryCard({
  software,
  onViewAll,
}: {
  software: SoftwareVersionInfo[];
  onViewAll: () => void;
}) {
  return (
    <SummaryCardShell title="Installed Software" onViewAll={onViewAll} viewAllLabel="View all software">
      {software.slice(0, 5).map((item) => {
        const upToDate = item.currentVersion === item.latestVersion;
        return (
          <div key={item.name} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="font-medium text-slate-800">{item.name}</span>
            <span className={upToDate ? "text-emerald-600" : "text-amber-600"}>
              {upToDate ? "Up to date" : "Update available"}
            </span>
          </div>
        );
      })}
      {software.length === 0 && <p className="py-2 text-sm text-slate-400">No software detected.</p>}
    </SummaryCardShell>
  );
}

export function ServicesSummaryCard({
  services,
  onViewAll,
}: {
  services: ServiceInfo[];
  onViewAll: () => void;
}) {
  return (
    <SummaryCardShell title="Services" onViewAll={onViewAll} viewAllLabel="View all services">
      {services.slice(0, 5).map((service) => (
        <div key={service.name} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span className="font-medium text-slate-800">{service.name}</span>
          <span
            className={`inline-flex items-center gap-1.5 capitalize ${
              service.status === "running" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${service.status === "running" ? "bg-emerald-500" : "bg-slate-400"}`} />
            {service.status}
          </span>
        </div>
      ))}
      {services.length === 0 && <p className="py-2 text-sm text-slate-400">No services detected.</p>}
    </SummaryCardShell>
  );
}

const DATABASE_SOFTWARE = ["postgresql", "mysql", "mariadb", "mongodb", "redis"];
const WEB_SOFTWARE = ["nginx", "apache", "httpd", "caddy"];

export function ConfigurationSummaryCard({
  snapshot,
  onViewAll,
}: {
  snapshot: ServerSnapshot;
  onViewAll: () => void;
}) {
  const webServer = snapshot.software.find((s) => WEB_SOFTWARE.includes(s.name.toLowerCase()));
  const database = snapshot.software.find((s) => DATABASE_SOFTWARE.includes(s.name.toLowerCase()));

  return (
    <SummaryCardShell title="Configuration Summary" onViewAll={onViewAll} viewAllLabel="View full configuration">
      <Row label="Enabled Modules" value={snapshot.modules.length > 0 ? snapshot.modules.join(", ") : "None"} />
      <Row label="Open Ports" value={snapshot.configuration.ports.join(", ") || "None"} />
      <Row label="Web Server" value={webServer ? `${webServer.name} (${webServer.version})` : "—"} />
      <Row label="Database" value={database ? `${database.name} (${database.version})` : "—"} />
      <Row label="Timezone" value={snapshot.configuration.timezone} />
    </SummaryCardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex-shrink-0 text-slate-500">{label}</span>
      <span className="truncate text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
