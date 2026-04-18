"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface ResolutionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
}

export default function ResolutionModal({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  confirmVariant = "danger",
}: ResolutionModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("El motivo es obligatorio para continuar.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason);
      setReason("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleSubmit}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label
            htmlFor="resolution-reason"
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--neutral-100)",
              marginBottom: "8px",
            }}
          >
            Motivo de la resolución
          </label>
          <textarea
            id="resolution-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explique brevemente el motivo de esta acción..."
            style={{
              width: "100%",
              backgroundColor: "var(--bg-card)",
              border: error ? "1px solid var(--error-500)" : "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              color: "var(--neutral-50)",
              fontSize: "14px",
              resize: "none",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              if (!error) e.currentTarget.style.borderColor = "var(--brand-400)";
            }}
            onBlur={(e) => {
              if (!error) e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          />
          {error && (
            <p
              style={{
                color: "var(--error-400)",
                fontSize: "12px",
                marginTop: "6px",
                fontWeight: 500,
              }}
            >
              {error}
            </p>
          )}
        </div>
        
        <p style={{ fontSize: "13px", color: "var(--neutral-400)", lineHeight: "1.5" }}>
          <span style={{ fontWeight: 600, color: "var(--warning-400)" }}>Aviso:</span> Esta acción es irreversible y quedará registrada en el historial de trazabilidad del sistema.
        </p>
      </div>
    </Modal>
  );
}
