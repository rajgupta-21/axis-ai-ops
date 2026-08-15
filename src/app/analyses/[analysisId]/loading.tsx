import { PageContainer } from "@/components/PageContainer";
import { SkeletonBlock, SkeletonCard } from "@/components/Skeletons";

export default function Loading() {
  return (
    <PageContainer>
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading analysis</span>
        <SkeletonBlock className="h-7 w-72" />
        <SkeletonBlock className="mt-2 h-4 w-96" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-11/12" />
          <SkeletonBlock className="h-4 w-4/5" />
        </div>
      </div>
    </PageContainer>
  );
}
