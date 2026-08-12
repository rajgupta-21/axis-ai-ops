import { ServerIcon } from "@/components/icons";

export default function ServersIndexPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-8 py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <ServerIcon className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Select a server</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Choose a server from the list to view its configuration, installed software, services, and
        impact analyses.
      </p>
    </div>
  );
}
