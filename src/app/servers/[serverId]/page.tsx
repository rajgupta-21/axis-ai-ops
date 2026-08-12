import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { ServerDetails } from "@/domain/server";
import { AnalysisRecord } from "@/domain/analysis";
import { SoftwareVersionInfo } from "@/domain/software";
import { ServerOverview } from "@/components/ServerOverview";
import { MetricsCards } from "@/components/MetricsCards";
import { SoftwareTable } from "@/components/SoftwareTable";
import { ServiceTable } from "@/components/ServiceTable";
import { CollectDataButton } from "@/components/CollectDataButton";
import { AnalysisTimeline } from "@/components/AnalysisTimeline";
import { ConfigIcon, HistoryIcon, ServicesIcon, VersionIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ServerDetailsPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;

  let server: ServerDetails;
  try {
    server = await apiFetch<ServerDetails>(`/api/servers/${serverId}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "SERVER_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const [software, analyses] = await Promise.all([
    apiFetch<SoftwareVersionInfo[]>(`/api/servers/${serverId}/software`),
    apiFetch<AnalysisRecord[]>(`/api/servers/${serverId}/analyses`),
  ]);

  const snapshot = server.snapshot;
  const runningServices = snapshot?.services.filter((s) => s.status === "running").length ?? 0;

  return (
    <div className="space-y-8">
      <ServerOverview server={server} />

      <div className="flex items-center gap-3">
        <CollectDataButton serverId={serverId} />
        {snapshot?.network && (
          <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <span>
              Inbound <span className="font-semibold text-slate-800">{snapshot.network.inboundMbps ?? "—"} Mbps</span>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span>
              Outbound <span className="font-semibold text-slate-800">{snapshot.network.outboundMbps ?? "—"} Mbps</span>
            </span>
          </div>
        )}
      </div>

      {snapshot && (
        <MetricsCards
          cpu={snapshot.cpu.usagePercent}
          memory={snapshot.memory.usedPercent}
          disk={snapshot.disk.usedPercent}
          services={{ running: runningServices, total: snapshot.services.length }}
        />
      )}

      <section>
        <SectionHeading icon={VersionIcon} title="Installed Software" />
        <p className="mt-1 text-sm text-slate-500">
          Select a component and click Analyze to run the full impact analysis workflow.
        </p>
        <div className="mt-3">
          <SoftwareTable serverId={serverId} software={software} />
        </div>
      </section>

      {snapshot && (
        <section>
          <SectionHeading icon={ServicesIcon} title="Services" />
          <div className="mt-3">
            <ServiceTable services={snapshot.services} />
          </div>
        </section>
      )}

      {snapshot && (
        <section>
          <SectionHeading icon={ConfigIcon} title="Configuration" />
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <ConfigCard title="Enabled Modules">
              <ChipList items={snapshot.modules} empty="None" />
            </ConfigCard>

            <ConfigCard title="Open Ports">
              <ChipList items={snapshot.configuration.ports.map(String)} empty="None" tone="slate" />
            </ConfigCard>

            <ConfigCard title="Important Configuration Values" full>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(snapshot.configuration.importantValues).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">{key}</dt>
                    <dd className="text-sm font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </ConfigCard>

            <ConfigCard title="Installed Packages" full>
              <ChipList items={snapshot.configuration.installedPackages} empty="None" tone="slate" />
            </ConfigCard>

            <ConfigCard title="Operating System" full>
              <p className="text-sm text-slate-700">
                {snapshot.os.name} {snapshot.os.version} · Kernel {snapshot.kernel} · {snapshot.architecture}
              </p>
            </ConfigCard>
          </div>
        </section>
      )}

      <section>
        <SectionHeading icon={HistoryIcon} title="Analysis History" />
        <div className="mt-3">
          <AnalysisTimeline analyses={analyses} />
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

function ConfigCard({
  title,
  children,
  full = false,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${full ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChipList({
  items,
  empty,
  tone = "indigo",
}: {
  items: string[];
  empty: string;
  tone?: "indigo" | "slate";
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{empty}</p>;
  }

  const toneClass =
    tone === "indigo"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
      : "bg-slate-100 text-slate-600 ring-slate-400/20";

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
