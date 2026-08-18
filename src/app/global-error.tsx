"use client";

/**
 * The boundary of last resort: a failure in the root layout itself, which sits
 * above app/error.tsx and so cannot be caught by it.
 *
 * Because the failed layout is what normally provides them, this must render
 * its own <html> and <body>, and it cannot rely on the sidebar, fonts, or any
 * data. Styles are inline for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "32rem", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            The application failed to start
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
            This usually means the backend API is unreachable. Check that it is running on the URL in
            NEXT_PUBLIC_API_BASE_URL.
          </p>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.75rem",
              background: "#f1f5f9",
              borderRadius: "0.375rem",
              padding: "0.5rem 0.75rem",
              marginTop: "1rem",
              wordBreak: "break-word",
            }}
          >
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
