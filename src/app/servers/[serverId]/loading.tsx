import { SkeletonBlock, SkeletonCard } from "@/components/Skeletons";

/**
 * Instant fallback while a server's details resolve.
 *
 * Next wraps the page in a Suspense boundary using this as the fallback, so
 * navigating to a server paints immediately instead of leaving the previous
 * screen up while facts are collected. The shape mirrors the real page — title,
 * tab strip, summary cards — so nothing shifts when the content swaps in.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading server details</span>

      <div className="border-b border-slate-200 px-8 pt-6">
        <SkeletonBlock className="h-7 w-56" />
        <SkeletonBlock className="mt-2 h-4 w-72" />
        <div className="mt-6 flex gap-6 pb-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-4 w-20" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-8 py-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
