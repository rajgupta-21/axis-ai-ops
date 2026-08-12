"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { RefreshIcon } from "./icons";

export function CollectDataButton({ serverId }: { serverId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function collect() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/servers/${serverId}/collect`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body?.error?.message ?? "Unable to collect server data.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to collect server data. The previous snapshot remains available.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={collect}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Collecting..." : "Collect Data"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
