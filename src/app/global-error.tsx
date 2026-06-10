"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global error boundary for the (app) route group (v3.1 §10 / D10).
 * Next.js calls this component when an unhandled error occurs in the layout
 * or any page within the segment. Reports to Sentry and shows a recovery UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf7",
          color: "#16181d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          margin: 0,
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#0f7b5f",
            }}
          >
            Growth OS
          </p>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              margin: "0.5rem 0",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            The error has been logged. Your data is safe.
            {error.digest && (
              <span
                style={{
                  display: "block",
                  marginTop: "0.5rem",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                }}
              >
                Error ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#0f7b5f",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
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
