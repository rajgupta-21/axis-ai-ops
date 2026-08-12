"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { GaugeIcon, RefreshIcon } from "./icons";

type AnalysisStage =
  | "idle"
  | "collecting"
  | "checking-release"
  | "comparing"
  | "analyzing"
  | "generating-report"
  | "completed"
  | "failed";

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: "",
  collecting: "Collecting server data...",
  "checking-release": "Checking latest version...",
  comparing: "Comparing changes...",
  analyzing: "Running impact analysis...",
  "generating-report": "Finalizing analysis...",
  completed: "Analysis complete.",
  failed: "Analysis failed.",
};

const STAGE_SEQUENCE: AnalysisStage[] = [
  "collecting",
  "checking-release",
  "comparing",
  "analyzing",
  "generating-report",
];

export function AnalysisWorkflow({
  serverId,
  component,
  label = "Analyze",
  variant = "solid",
  className,
}: {
  serverId: string;
  component: string;
  label?: string;
  variant?: "solid" | "outline";
  className?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = stage !== "idle" && stage !== "completed" && stage !== "failed";
  const Icon = label.toLowerCase().includes("re-analyze") ? RefreshIcon : GaugeIcon;

  async function run() {
    setError(null);
    setStage("collecting");

    let stageIndex = 0;
    timerRef.current = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, STAGE_SEQUENCE.length - 1);
      setStage(STAGE_SEQUENCE[stageIndex]);
    }, 900);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/servers/${serverId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component }),
      });
      const body = await response.json();

      if (timerRef.current) clearInterval(timerRef.current);

      if (!response.ok || !body.success) {
        setStage("failed");
        setError(body?.error?.message ?? "Impact analysis could not be completed.");
        return;
      }

      setStage("completed");
      router.push(`/analyses/${body.data.id}`);
      router.refresh();
    } catch {
      if (timerRef.current) clearInterval(timerRef.current);
      setStage("failed");
      setError("Impact analysis could not be completed. Please try again.");
    }
  }

  const variantClass =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      : "bg-slate-900 text-white hover:bg-slate-700";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={run}
        disabled={running}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass}`}
      >
        <Icon className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
        {running ? "Analyzing..." : label}
      </button>
      {stage !== "idle" && (
        <p className={`mt-2 text-sm ${stage === "failed" ? "text-red-600" : "text-slate-500"}`}>
          {STAGE_LABELS[stage]}
        </p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
