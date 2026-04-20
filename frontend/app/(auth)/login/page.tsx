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
        {/* Spacer top */}
        <div aria-hidden="true" />

        {/* Hero Branding Center */}
        <div style={{ animation: "fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) both", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", textAlign: "center" }}>
          {/* Main Logo */}
          <div
            style={{
              width: "120px",
              height: "120px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Logo size={120} />
          </div>
          
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(48px, 5.5vw, 76px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "var(--neutral-50)",
              display: "flex",
              gap: "0.15em",
              flexWrap: "wrap",
              justifyContent: "center"
            }}
          >
            {"Zen Inventory".split("").map((char, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: char === " " ? "pre" : "normal",
                  animation: `letterReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${0.2 + i * 0.04}s`,
                }}
              >
                {char}
              </span>
            ))}
          </h1>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            <p
              style={{
                fontSize: "24px",
                color: "var(--brand-400)",
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Gestiona tu inventario con inteligencia.
            </p>
            <p
              style={{
                fontSize: "16px",
                color: "var(--neutral-400)",
                lineHeight: 1.6,
                maxWidth: "460px",
                fontFamily: "var(--font-sans)",
              }}
            >
              Sistema multi-sucursal con alertas proactivas, trazabilidad completa y analítica en tiempo real.
            </p>
          </div>
        </div>

        {/* Footer branding */}
        <p style={{ fontSize: "13px", color: "var(--neutral-500)", fontFamily: "var(--font-sans)", textAlign: "center" }}>
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
              { role: "Admin",    email: "admin@zeninventory.co",    pw: "123456",    dot: "var(--brand-500)" },
              { role: "Gerentenorte",  email: "gerenten@zeninventory.co",  pw: "123456",  dot: "var(--color-warning)" },
              { role: "Gerentesur", email: "gerentes@gmail.com", pw: "123456", dot: "var(--color-warning)" },
              { role: "Operador norte", email: "operadonc@zeninventory.co", pw: "123456", dot: "var(--color-success)" },
              { role: "Operador sur", email: "operadors@zeninventory.co", pw: "123456", dot: "var(--color-success)" },

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
        @keyframes letterReveal {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
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
