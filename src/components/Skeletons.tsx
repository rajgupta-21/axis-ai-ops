/**
 * Shared loading placeholders.
 *
 * These exist because the data behind this UI is genuinely slow on a cold cache:
 * collecting server facts is several SSH round trips, and a release lookup is a
 * web search plus an LLM call per package. A skeleton that mirrors the shape of
 * the real content tells the user the page is working and stops the layout
 * jumping when the content arrives.
 */

/** One shimmering grey block. Sized by the caller. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

/** Placeholder for a table of software, services, or analyses. */
export function SkeletonTable({ rows = 6, label }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      {label ? <span className="sr-only">{label}</span> : null}
      <div className="space-y-3">
        <div className="flex gap-4">
          <SkeletonBlock className="h-4 w-1/4" />
          <SkeletonBlock className="h-4 w-1/6" />
          <SkeletonBlock className="h-4 w-1/6" />
          <SkeletonBlock className="h-4 w-1/5" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-t border-slate-100 pt-3">
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-1/6" />
            <SkeletonBlock className="h-4 w-1/6" />
            <SkeletonBlock className="h-4 w-1/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a card in a summary grid. */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="mt-4 h-8 w-1/2" />
      <SkeletonBlock className="mt-3 h-3 w-2/3" />
    </div>
  );
}

/**
 * An explicit, honest wait message for the software list. A bare spinner implies
 * "any moment now"; a first collection can take minutes, so it says why.
 */
export function SoftwareLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <Spinner />
        <p className="text-sm text-slate-600">
          Identifying installed software and looking up the latest released versions. The first run for a
          server can take a few minutes; later visits are served from cache.
        </p>
      </div>
      <SkeletonTable rows={8} label="Loading software inventory" />
    </div>
  );
}

/** Small inline spinner. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-slate-400 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
