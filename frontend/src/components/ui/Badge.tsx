// Badge.tsx – Pastilla de estado reutilizable
// Variantes: success | danger | warning | neutral | info

type BadgeVariant = "success" | "danger" | "warning" | "neutral" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string; // Permitir estilos externos
}

const variantTokens: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  success: {
    bg:     "rgba(111,191,138,0.12)",
    color:  "var(--color-success)",
    border: "rgba(111,191,138,0.25)",
  },
  danger: {
    bg:     "rgba(217,99,79,0.12)",
    color:  "var(--brand-500)",
    border: "rgba(217,99,79,0.25)",
  },
  warning: {
    bg:     "rgba(251,191,36,0.10)",
    color:  "var(--color-warning)",
    border: "rgba(251,191,36,0.25)",
  },
  neutral: {
    bg:     "var(--bg-hover)",
    color:  "var(--neutral-400)",
    border: "var(--border-default)",
  },
  info: {
    bg:     "rgba(96,165,250,0.10)",
    color:  "var(--color-info)",
    border: "rgba(96,165,250,0.25)",
  },
};

export default function Badge({ children, variant = "neutral", dot = false, className }: BadgeProps) {
  const t = variantTokens[variant];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: "20px",
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {dot && (
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
