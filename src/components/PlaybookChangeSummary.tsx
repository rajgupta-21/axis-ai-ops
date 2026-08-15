import { PlaybookImpactContext } from "@/domain/comparison";

/**
 * Shows what a statically-parsed Ansible playbook declares it would do —
 * never what was actually executed, since the playbook is never run.
 */
export function PlaybookChangeSummary({ playbook }: { playbook: PlaybookImpactContext }) {
  const hasChanges =
    playbook.targetedPackages.length > 0 ||
    playbook.serviceChanges.length > 0 ||
    playbook.configChanges.length > 0 ||
    playbook.portChanges.length > 0;

  return (
    <div className="space-y-4">
      {playbook.targetedPackages.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">Packages</p>
          <ul className="mt-2 space-y-1.5">
            {playbook.targetedPackages.map((pkg) => (
              <li key={pkg.name} className="text-sm text-slate-700">
                <span className="font-mono">{pkg.name}</span>: {pkg.installedVersion ?? "not installed"} →{" "}
                {pkg.targetVersion ?? "Insufficient data"}
                {pkg.versionGap && !pkg.versionGap.insufficientData && (
                  <span className="ml-2 text-xs text-slate-500">({pkg.versionGap.description})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {playbook.serviceChanges.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">Services</p>
          <ul className="mt-2 space-y-1.5">
            {playbook.serviceChanges.map((svc) => (
              <li key={svc.name} className="text-sm text-slate-700">
                <span className="font-mono">{svc.name}</span>
                {svc.state && ` — ${svc.state}`}
                {svc.currentlyRunning !== undefined && (
                  <span className="ml-2 text-xs text-slate-500">
                    (currently {svc.currentlyRunning ? "running" : "not running"})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {playbook.configChanges.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">Configuration</p>
          <ul className="mt-2 space-y-1.5">
            {playbook.configChanges.map((cfg, i) => (
              <li key={i} className="text-sm text-slate-700">
                {cfg.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {playbook.portChanges.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">Ports</p>
          <ul className="mt-2 space-y-1.5">
            {playbook.portChanges.map((port, i) => (
              <li key={i} className="text-sm text-slate-700">
                Port {port.port}
                {port.protocol && `/${port.protocol}`}
                {port.state && ` — ${port.state}`}
                {port.currentlyOpen !== undefined && (
                  <span className="ml-2 text-xs text-slate-500">
                    (currently {port.currentlyOpen ? "open" : "not open"})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasChanges && <p className="text-sm text-slate-500">No recognizable package, service, config, or port changes were found.</p>}

      {playbook.opaqueTasks.length > 0 && (
        <div>
          <p className="text-sm font-medium text-amber-700">Unresolvable Tasks — Insufficient Data</p>
          <p className="mt-1 text-xs text-slate-500">
            These tasks run raw shell/command/script content whose effect cannot be statically determined.
          </p>
          <ul className="mt-2 space-y-1.5">
            {playbook.opaqueTasks.map((task, i) => (
              <li key={i} className="font-mono text-sm text-slate-700">
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}

      {playbook.warnings.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">Parsing Notes</p>
          <ul className="mt-2 space-y-1.5">
            {playbook.warnings.map((warning, i) => (
              <li key={i} className="text-sm text-slate-500">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
