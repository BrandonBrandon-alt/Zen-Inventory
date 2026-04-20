"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  children,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--btn-primary-bg)",
      color: "var(--btn-primary-text)",
      border: "1px solid transparent",
    },
    ghost: {
      background: "transparent",
      color: "var(--neutral-200)",
      border: "1px solid transparent",
    },
    danger: {
      background: "rgba(224,112,112,0.1)",
      color: "var(--color-danger)",
      border: "1px solid rgba(224,112,112,0.3)",
    },
  };

  const hoverStyles: Record<string, Partial<React.CSSProperties>> = {
    primary: { background: "var(--btn-primary-hover-bg)", transform: "translateY(-1px)", boxShadow: "0 4px 16px rgba(0,0,0,0.18)" },
    ghost:   { background: "var(--bg-hover)",  transform: "translateY(-1px)" },
    danger:  { background: "rgba(224,112,112,0.18)", transform: "translateY(-1px)" },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: "7px 14px", fontSize: "13px", borderRadius: "var(--radius-sm)" },
    md: { padding: "10px 18px", fontSize: "14px", borderRadius: "var(--radius-md)" },
    lg: { padding: "12px 22px", fontSize: "14.5px", borderRadius: "var(--radius-md)" },
  };

  return (
    <button
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        fontFamily: "var(--font-sans)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        transition: "all 0.18s ease",
        outline: "none",
        width: fullWidth ? "100%" : undefined,
        opacity: isDisabled ? 0.55 : 1,
        ...baseStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        Object.assign(e.currentTarget.style, hoverStyles[variant]);
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        Object.assign(e.currentTarget.style, baseStyles[variant], { transform: "none", boxShadow: "none" });
      }}
      {...props}
    >
      {loading ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}>
          <path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round" />
        </svg>
      ) : leftIcon ? (
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{leftIcon}</span>
      ) : null}
      {children}
    </button>
  );
}
