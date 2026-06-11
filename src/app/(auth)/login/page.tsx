import Link from "next/link";

export default function LoginPage() {
  return (
    <main style={{
      minHeight: "100dvh", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px",
      background: "var(--bg)",
    }}>
      <div style={{ width: "100%", maxWidth: "340px", textAlign: "center" }}>
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: "var(--accent)", marginBottom: "12px",
        }}>
          Growth OS
        </p>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 600,
          color: "var(--text)", lineHeight: 1.25, letterSpacing: "-0.01em",
          marginBottom: "32px",
        }}>
          Show up. Log the number. Watch it compound.
        </h1>
        <Link href="/dashboard" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "13px 24px", borderRadius: "12px",
          background: "var(--accent)", color: "#fff",
          fontSize: "14px", fontWeight: 600, textDecoration: "none",
          letterSpacing: "0.01em",
        }}>
          Enter
        </Link>
      </div>
    </main>
  );
}
