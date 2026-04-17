import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Ingresar | Zen Inventory",
  description: "Accede al sistema de gestión de inventario de Zen Inventory.",
};

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ─── Panel Izquierdo: Branding editorial ─────────── */}
      <div
        style={{
          flex: "0 0 50%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          borderRight: "1px solid var(--border-default)",
          background: "var(--bg-base)",
        }}
        className="hidden-mobile"
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Logo size={36} />
          </div>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--neutral-50)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "-0.02em",
            }}
          >
            Zen Inventory
          </span>
        </div>

        {/* Headline editorial (estilo Zen) */}
        <div style={{ animation: "fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) both" }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(40px, 4.5vw, 60px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--neutral-50)",
              marginBottom: "20px",
            }}
          >
            gestiona{" "}
            <em
              style={{
                color: "var(--brand-500)",
                fontStyle: "italic",
                fontFamily: "var(--font-serif)",
              }}
            >
              tu inventario
            </em>
            <br />
            con inteligencia
          </h1>
          <p
            style={{
              fontSize: "16px",
              color: "var(--neutral-400)",
              lineHeight: 1.7,
              maxWidth: "400px",
              fontFamily: "var(--font-sans)",
            }}
          >
            Sistema multi-sucursal con alertas proactivas, trazabilidad completa y analítica en tiempo real.
          </p>
        </div>

        {/* Footer branding */}
        <p style={{ fontSize: "13px", color: "var(--neutral-500)", fontFamily: "var(--font-sans)" }}>
          © {new Date().getFullYear()} Zen Inventory Logic
        </p>
      </div>

      {/* ─── Panel Derecho: Login form ───────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "var(--bg-surface)",
        }}
      >
        {/* Mobile logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "40px",
          }}
          className="show-mobile"
        >
          <Logo size={32} />
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--neutral-100)", letterSpacing: "-0.02em" }}>
            Zen Inventory
          </span>
        </div>

        {/* Form container */}
        <div
          style={{
            width: "100%",
            maxWidth: "380px",
            animation: "fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "32px" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--neutral-50)",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
                marginBottom: "8px",
              }}
            >
              Bienvenido de vuelta
            </h2>
            <p style={{ fontSize: "14px", color: "var(--neutral-400)" }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <LoginForm />

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "28px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border-default)" }} />
            <span style={{ fontSize: "11px", color: "var(--neutral-500)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              demo
            </span>
            <div style={{ flex: 1, height: "1px", background: "var(--border-default)" }} />
          </div>

          {/* Demo accounts */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { role: "Admin",    email: "admin@zeninventory.co",    pw: "admin123",    dot: "var(--brand-500)" },
              { role: "Gerente",  email: "gerente@zeninventory.co",  pw: "gerente123",  dot: "var(--neutral-400)" },
              { role: "Operador", email: "operador@zeninventory.co", pw: "operador123", dot: "var(--neutral-500)" },
            ].map(({ role, email, pw, dot }) => (
              <div
                key={role}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "12px",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, color: "var(--neutral-300)", width: "60px", flexShrink: 0 }}>{role}</span>
                <span style={{ color: "var(--neutral-500)", fontFamily: "monospace", fontSize: "11.5px", flex: 1 }}>{email}</span>
                <span style={{ color: "var(--neutral-600)", fontFamily: "monospace", fontSize: "11px" }}>{pw}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </main>
  );
}
