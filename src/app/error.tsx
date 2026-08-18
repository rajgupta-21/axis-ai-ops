"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RefreshIcon } from "@/components/icons";

/**
 * The safety net beneath every page in the app.
 *
 * Pages fetch through apiFetchSafe and render their own degraded states, so
 * reaching this boundary means something genuinely unanticipated threw. It
 * exists so that case still lands on the app's own chrome — with the reason and
 * a way out — instead of Next.js's raw runtime error overlay, which offers the
 * user nothing to do.
 *
 * The sidebar lives in the root layout, which this boundary sits inside, so
 * navigation survives whatever happened here.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page] unhandled render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-8 py-12">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50">
            <AlertTriangleIcon className="h-5 w-5 text-red-500" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900">This page could not be displayed</h1>
            <p className="mt-1 text-sm text-slate-500">
              The rest of the application is unaffected — the navigation on the left still works.
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 font-mono text-xs break-words text-slate-600">
          {error.message || "An unexpected error occurred."}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <RefreshIcon className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
