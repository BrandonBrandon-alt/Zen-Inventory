"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

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
  placement?: "top" | "bottom";
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
  placement = "bottom",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);  const [menuCoords, setMenuCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0 });

  const hasError = Boolean(error);
  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update position when opening
  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest('.select-portal-menu')) {
           setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setSearchTerm(""), 200); 
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (option: Option) => {
    if (disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const menuOpen = isOpen && mounted;

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
          ref={triggerRef}
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
            boxShadow: isOpen ? "0 0 0 3px rgba(217,99,79,0.22)" : "var(--shadow-sm)",
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

        {menuOpen && createPortal(
          <div
            className="select-portal-menu custom-scrollbar"
            style={{
              position: "fixed",
              top: placement === "bottom" ? `${menuCoords.bottom + 4}px` : "auto",
              bottom: placement === "top" ? `${window.innerHeight - menuCoords.top + 4}px` : "auto",
              left: `${menuCoords.left}px`,
              width: `${menuCoords.width}px`,
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              zIndex: 10000,
              maxHeight: "320px",
              overflowY: "auto",
              padding: "6px",
              animation: "slideDown 0.15s ease-out forwards",
              overscrollBehavior: "contain",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {options.length > 2 && (
              <div style={{ position: "sticky", top: "-6px", background: "var(--bg-card)", paddingBottom: "6px", zIndex: 10, paddingTop: "6px" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-500)" strokeWidth="2" style={{ position: "absolute", left: "10px" }}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                    placeholder="Buscar..."
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 30px",
                      borderRadius: "6px",
                      border: "1px solid var(--neutral-700)",
                      background: "var(--bg-surface)",
                      color: "var(--neutral-100)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ height: "1px", background: "var(--neutral-800)", marginTop: "6px" }} />
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div style={{ padding: "16px 12px", fontSize: "13px", color: "var(--neutral-500)", textAlign: "center" }}>
                No se encontraron resultados
              </div>
            ) : (
              <div style={{ marginTop: "2px" }}>
                {filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option);
                    }}
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
                      marginBottom: "2px"
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
                ))}
              </div>
            )}
          </div>,
          document.body
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
