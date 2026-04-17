"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string | number | null;
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccione una opción",
  error,
  icon,
  disabled = false,
  className = "",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasError = Boolean(error);
  const selectedOption = options.find((o) => o.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    if (disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef}
      className={className}
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "6px", 
        position: "relative", 
        opacity: disabled ? 0.6 : 1,
        zIndex: isOpen ? 50 : 1,
      }}
    >
      <label
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: hasError ? "var(--color-danger)" : "var(--neutral-300)",
        }}
      >
        {label}
      </label>

      <div style={{ position: "relative" }}>
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            width: "100%",
            background: "var(--bg-card)",
            border: `1px solid ${isOpen ? "var(--brand-500)" : hasError ? "rgba(224,112,112,0.5)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-md)",
            padding: icon ? "11px 40px" : "11px 14px",
            fontSize: "14px",
            color: selectedOption ? "var(--neutral-50)" : "var(--neutral-500)",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: isOpen ? "0 0 0 3px rgba(217,99,79,0.12)" : "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {icon && (
              <span style={{ color: hasError ? "var(--color-danger)" : "var(--neutral-500)", display: "flex" }}>
                {icon}
              </span>
            )}
            <span>{selectedOption ? selectedOption.label : placeholder}</span>
          </div>

          <svg 
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ 
              transition: "transform 0.2s", 
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: "var(--neutral-500)"
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="custom-scrollbar"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              zIndex: 9999,
              maxHeight: "240px",
              overflowY: "auto",
              padding: "6px",
              animation: "slideDown 0.15s ease",
            }}
          >
            {options.length === 0 ? (
              <div style={{ padding: "12px", fontSize: "13px", color: "var(--neutral-500)", textAlign: "center" }}>
                No hay opciones disponibles
              </div>
            ) : (
              options.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    fontSize: "13.5px",
                    color: option.value === value ? "var(--neutral-50)" : "var(--neutral-300)",
                    background: option.value === value ? "rgba(217,99,79,0.1)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.1s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => {
                    if (option.value !== value) e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (option.value !== value) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {option.label}
                  {option.value === value && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-500)" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              ))
            )}
          </div>
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

      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
