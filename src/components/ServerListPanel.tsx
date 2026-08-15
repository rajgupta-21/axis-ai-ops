"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ServerSummary } from "@/domain/server";
import { StatusBadge } from "./StatusBadge";
import { RefreshIcon } from "./icons";
import { formatRelativeCollected } from "@/lib/format";
import { SkeletonBlock } from "./Skeletons";

export function ServerListPanel() {
  const pathname = usePathname();
  const [servers, setServers] = useState<ServerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ServerSummary[]>("/api/servers");
      setServers(data);
      setLastUpdated(new Date().toISOString());
    } catch {
      setError("Unable to load servers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  const filtered = (servers ?? []).filter((server) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return server.hostname.toLowerCase().includes(q) || server.ipAddress.includes(q);
  });

  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">Servers</h2>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh servers"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search servers..."
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-2">
        {error && <p className="px-2 py-4 text-sm text-red-600">{error}</p>}
        {/*
          This panel lives in the layout, so the route-level loading.tsx does not
          cover it — it has to render its own placeholder. Rows shaped like the
          real entries keep the sidebar from collapsing and re-expanding as the
          list arrives.
        */}
        {!error && servers === null && (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-1">
            <span className="sr-only">Loading servers</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-4 w-12" />
                </div>
                <SkeletonBlock className="mt-1.5 h-3 w-24" />
                <SkeletonBlock className="mt-1.5 h-3 w-36" />
              </div>
            ))}
          </div>
        )}
        {!error && servers !== null && filtered.length === 0 && (
          <p className="px-2 py-4 text-sm text-slate-400">No servers match &ldquo;{query}&rdquo;.</p>
        )}
        <ul className="space-y-1">
          {filtered.map((server) => {
            const active = pathname === `/servers/${server.id}`;
            return (
              <li key={server.id}>
                <Link
                  href={`/servers/${server.id}`}
                  className={`block rounded-md px-3 py-2.5 transition ${
                    active ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${active ? "text-white" : "text-slate-900"}`}>
                      {server.hostname}
                    </span>
                    <StatusBadge status={server.status} size="sm" />
                  </div>
                  <p className={`mt-0.5 text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>
                    {server.ipAddress}
                  </p>
                  <div className={`mt-1.5 flex items-center gap-3 text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>
                    <span>CPU {server.cpuUsagePercent ?? "—"}%</span>
                    <span>Mem {server.memoryUsedPercent ?? "—"}%</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
        <span>{lastUpdated ? `Last updated: ${formatRelativeCollected(lastUpdated)}` : ""}</span>
      </div>
    </aside>
  );
}
