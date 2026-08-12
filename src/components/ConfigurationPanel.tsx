import { ServerSnapshot } from "@/domain/server";

export function ConfigurationPanel({ snapshot }: { snapshot: ServerSnapshot }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
          {snapshot.os.name} {snapshot.os.version} · Kernel {snapshot.kernel} · {snapshot.architecture} · Timezone{" "}
          {snapshot.configuration.timezone}
        </p>
      </ConfigCard>
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
