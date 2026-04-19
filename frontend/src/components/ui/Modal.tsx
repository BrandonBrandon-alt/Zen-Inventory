"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeWidths = { 
  sm: "380px", 
  md: "480px", 
  lg: "600px", 
  xl: "850px",
  "2xl": "1100px"
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "24px",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth: sizeWidths[size],
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          animation: "fadeInUp 0.2s cubic-bezier(0.16,1,0.3,1)",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "22px 24px 20px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="modal-title"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--neutral-50)",
                letterSpacing: "-0.02em",
                marginBottom: description ? "4px" : 0,
              }}
            >
              {title}
            </h2>
            {description && (
              <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--neutral-400)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--neutral-100)";
              e.currentTarget.style.borderColor = "var(--neutral-500)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--neutral-400)";
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }} className="custom-scrollbar">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
