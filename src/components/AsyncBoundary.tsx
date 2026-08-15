"use client";

import { Component, ReactNode, Suspense } from "react";

/**
 * Suspense plus an error boundary, as one wrapper.
 *
 * Streaming data into a Client Component with `use()` needs both: Suspense for
 * the pending state, and an error boundary for the rejected one. Without the
 * boundary a failed request — an unreachable host, a timed-out release lookup —
 * throws during render and takes down the whole interactive tree, so a slow
 * software list would lose the user their tabs, metrics, and analysis history.
 * Scoped per section, a failure stays inside the section that caused it.
 */
export function AsyncBoundary({
  fallback,
  errorFallback,
  children,
}: {
  fallback: ReactNode;
  /** Rendered instead of the children when the promise rejects. */
  errorFallback?: (message: string) => ReactNode;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary errorFallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; errorFallback?: (message: string) => ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : "Something went wrong." };
  }

  render() {
    if (this.state.message === null) return this.props.children;

    if (this.props.errorFallback) return this.props.errorFallback(this.state.message);

    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {this.state.message}
      </div>
    );
  }
}
