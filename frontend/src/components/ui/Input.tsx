"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, rightElement, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? "input-" + Math.random().toString(36).substr(2, 9);
    const hasError = Boolean(error);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: hasError ? "var(--color-danger)" : "var(--neutral-300)",
            }}
          >
            {label}
          </label>
        )}

        <div style={{ position: "relative" }}>
          {icon && (
            <span
              style={{
                position: "absolute", left: "13px", top: "50%",
                transform: "translateY(-50%)",
                color: hasError ? "var(--color-danger)" : "var(--neutral-500)",
                display: "flex", alignItems: "center", pointerEvents: "none",
              }}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: `1px solid ${hasError ? "rgba(224,112,112,0.5)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-md)",
              padding: icon
                ? rightElement ? "11px 48px 11px 40px" : "11px 14px 11px 40px"
                : rightElement ? "11px 48px 11px 14px" : "11px 14px",
              fontSize: "14px",
              color: "var(--neutral-50)",
              outline: "none",
              transition: "border-color 0.18s, box-shadow 0.18s",
              fontFamily: "var(--font-sans)",
              colorScheme: props.type === "date" ? "dark" : undefined,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = hasError ? "rgba(224,112,112,0.7)" : "rgba(217,99,79,0.5)";
              e.currentTarget.style.boxShadow  = hasError ? "0 0 0 3px rgba(224,112,112,0.1)" : "0 0 0 3px rgba(217,99,79,0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = hasError ? "rgba(224,112,112,0.5)" : "var(--border-default)";
              e.currentTarget.style.boxShadow = "none";
            }}
            {...props}
          />

          {rightElement && (
            <span style={{ position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
              {rightElement}
            </span>
          )}
        </div>

        {error && (
          <p style={{ fontSize: "12px", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm.5 7.5h-1v-1h1v1zm0-2.5h-1V3.5h1V6z"/>
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;

export function PasswordInput(props: Omit<InputProps, "type" | "rightElement">) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? "text" : "password"}
      rightElement={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-500)", display: "flex", alignItems: "center", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neutral-200)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neutral-500)")}
        >
          {show ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      }
    />
  );
}
