"use client";

/**
 * The last resort: an error in the root layout itself, where none of the app's
 * own chrome or providers are available. It ships its own <html> and inline
 * styles because nothing else is guaranteed to have loaded.
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
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#faf7f2",
          color: "#1c1917",
        }}
      >
        <main style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 500, margin: 0 }}>
            Bussola could not start
          </h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, marginTop: "0.5rem" }}>
            Something failed before the app finished loading. Reloading usually
            clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(0,0,0,0.15)",
              background: "#1c1917",
              color: "#faf7f2",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                opacity: 0.5,
                marginTop: "1rem",
              }}
            >
              {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
