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
  placement?: "top" | "bottom"; // <--- NUEVO
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
  placement = "bottom", // <--- NUEVO (Por defecto abre hacia abajo)
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // NUEVO: Estado para el buscador
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); // NUEVO: Referencia para el auto-focus

  const hasError = Boolean(error);
  const selectedOption = options.find((o) => o.value === value);

  // Filtrar opciones basadas en el texto de búsqueda
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Limpiar el buscador cuando se cierra el menú y hacer focus al abrir
  useEffect(() => {
    if (!isOpen) {
      // Pequeño retraso para que la animación de cierre termine antes de vaciar el texto
      setTimeout(() => setSearchTerm(""), 200); 
    } else {
      // Auto-focus en el input de búsqueda cuando se abre
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
        {/* BOTÓN SELECTOR PRINCIPAL */}
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

        {/* MENÚ DESPLEGABLE */}
        {isOpen && (
          <div
            className="custom-scrollbar"
            style={{
              position: "absolute",
              top: placement === "bottom" ? "calc(100% + 4px)" : "auto",
              bottom: placement === "top" ? "calc(100% + 4px)" : "auto",
              left: 0,
              right: 0,
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              zIndex: 9999,
              maxHeight: "320px",
              overflowY: "auto",
              padding: "6px",
              animation: "slideDown 0.15s ease",
              overscrollBehavior: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: "var(--neutral-700) transparent",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* NUEVO: INPUT DE BÚSQUEDA STICKY */}
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
                    onClick={(e) => e.stopPropagation()} // Evita que hacer clic en el buscador cierre el menú
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
                      transition: "border 0.2s"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--brand-500)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "var(--neutral-700)"}
                  />
                </div>
                <div style={{ height: "1px", background: "var(--neutral-800)", marginTop: "6px" }} />
              </div>
            )}

            {/* LISTA DE OPCIONES FILTRADAS */}
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "16px 12px", fontSize: "13px", color: "var(--neutral-500)", textAlign: "center" }}>
                No se encontraron resultados
              </div>
            ) : (
              <div style={{ marginTop: "2px" }}>
                {filteredOptions.map((option) => (
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
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--neutral-700);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--neutral-600);
        }
      `}</style>
    </div>
  );
}