import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: "var(--font-geist-sans)",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "2.4rem",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: "0.5rem",
        }}
      >
        Carbon Contractors
      </h1>
      <p style={{ color: "#888", fontSize: "1.1rem", marginBottom: "2rem" }}>
        Human-as-a-Service for the agentic web.
      </p>
      <p
        style={{
          color: "#666",
          maxWidth: "460px",
          textAlign: "center",
          lineHeight: 1.6,
          marginBottom: "2.5rem",
        }}
      >
        AI agents discover, hire, and pay human workers through MCP. Payments in
        USDC on Base. No middleman.
      </p>
      <Link
        href="/connect"
        style={{
          padding: "0.75rem 2rem",
          borderRadius: "8px",
          background: "#0052ff",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "0.95rem",
        }}
      >
        Register as a Worker
      </Link>
      <div
        style={{
          marginTop: "3rem",
          textAlign: "center",
          color: "#444",
          fontSize: "0.8rem",
        }}
      >
        <p>MCP Endpoint</p>
        <code
          style={{
            fontFamily: "var(--font-geist-mono)",
            color: "#0052ff",
          }}
        >
          /api/mcp
        </code>
      </div>
    </div>
  );
}
