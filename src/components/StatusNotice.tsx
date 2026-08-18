import { AlertTriangleIcon } from "./icons";

/**
 * The banner a page shows when it rendered without all of its data.
 *
 * Two tones for two genuinely different situations, because the reader's next
 * action differs:
 *
 *   "warning" — the data shown is real but stale. The request succeeded from a
 *               fallback (last known state in the database rather than a live
 *               inventory read). Nothing on screen is wrong, it is just old.
 *   "error"   — this section has no data at all and is empty for a reason.
 *
 * Collapsing them into one style would let a stale-but-usable dashboard look
 * identical to a broken one.
 */
export function StatusNotice({
  tone,
  title,
  message,
}: {
  tone: "warning" | "error";
  title: string;
  message: string;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";
  const iconColor = tone === "warning" ? "text-amber-500" : "text-red-500";

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${styles}`} role="status">
      <AlertTriangleIcon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
}

/**
 * The in-place replacement for a section whose data could not be loaded, sized
 * to sit where the table or chart would have been so the page keeps its shape.
 */
export function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
      <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
      {message}
    </div>
  );
}
