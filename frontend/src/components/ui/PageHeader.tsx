// PageHeader.tsx – Cabecera de página reutilizable
// Título serif + descripción con soporte para acento italic coral

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: "32px", animation: "fadeInUp 0.4s ease both", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <h1
          className="page-header-title"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 700,
            color: "var(--brand-400)",
            letterSpacing: "-0.03em",
            marginBottom: description ? "6px" : 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: "14px", color: "var(--neutral-400)" }}>{description}</p>
        )}
      </div>
      {actions && <div>{actions}</div>}
      
      <style jsx>{`
        .page-header-title em {
          font-style: italic;
          color: var(--brand-500);
          font-family: var(--font-serif);
        }
      `}</style>
    </div>
  );
}
