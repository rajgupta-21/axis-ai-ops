import { PageContainer } from "@/components/PageContainer";
import { SkeletonBlock, SkeletonCard, SkeletonTable } from "@/components/Skeletons";

/**
 * Dashboard fallback. The root page fetches the server list, and each server
 * without a cached snapshot triggers a collection, so a cold load is measured in
 * seconds rather than milliseconds.
 */
export default function Loading() {
  return (
    <PageContainer>
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading dashboard</span>
        <SkeletonBlock className="h-7 w-64" />
        <SkeletonBlock className="mt-2 h-4 w-96" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-8">
          <SkeletonTable rows={5} label="Loading servers" />
        </div>
      </div>
    </PageContainer>
  );
}
