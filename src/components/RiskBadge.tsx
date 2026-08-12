const IMPACT_STYLES: Record<string, { pill: string; dot: string }> = {
  LOW: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  MEDIUM: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  HIGH: { pill: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-orange-500" },
  CRITICAL: { pill: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
};

export function RiskBadge({ level, size = "md" }: { level: string | null; size?: "sm" | "md" }) {
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  if (!level) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 font-medium text-slate-500 ring-1 ring-inset ring-slate-400/20 ${padding}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Not analyzed
      </span>
    );
  }

  const style = IMPACT_STYLES[level] ?? IMPACT_STYLES.MEDIUM;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${style.pill} ${padding}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {level}
    </span>
  );
}
