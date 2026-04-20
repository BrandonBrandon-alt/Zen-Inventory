// Card.tsx – Panel con borde/fondo + header opcional

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  headerRight?: React.ReactNode;
  delay?: string; // CSS animation delay e.g. "0.15s"
  style?: React.CSSProperties;
}

export default function Card({ children, title, headerRight, delay, style, className, ...props }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-2xl)",
        padding: "32px",
        animation: `fadeInUp 0.4s ease ${delay ?? "0s"} both`,
        ...style,
      }}
      {...props}
    >
      {(title || headerRight) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          {title && (
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--neutral-100)",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
          )}
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
