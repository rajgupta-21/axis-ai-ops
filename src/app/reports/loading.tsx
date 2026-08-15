import { PageContainer } from "@/components/PageContainer";
import { SkeletonBlock, SkeletonTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <PageContainer>
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading reports</span>
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="mt-2 h-4 w-80" />
        <div className="mt-6">
          <SkeletonTable rows={8} />
        </div>
      </div>
    </PageContainer>
  );
}
