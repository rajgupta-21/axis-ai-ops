const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  healthy: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  warning: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  critical: { pill: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
  unknown: { pill: "bg-slate-100 text-slate-600 ring-slate-400/20", dot: "bg-slate-400" },
};

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold capitalize ring-1 ring-inset ${style.pill} ${padding}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === "healthy" ? "animate-pulse" : ""} ${style.dot}`} />
      {status}
    </span>
  );
}
