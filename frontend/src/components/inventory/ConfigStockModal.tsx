import React, { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface ConfigStockModalProps {
  open: boolean;
  onClose: () => void;
  productName?: string;
  initialMinStock: number;
  onSubmit: (minStock: number) => Promise<void>;
  loading: boolean;
}

export default function ConfigStockModal({
  open,
  onClose,
  productName,
  initialMinStock,
  onSubmit,
  loading
}: ConfigStockModalProps) {
  const [minStockValue, setMinStockValue] = useState<number | "">("");

  useEffect(() => {
    if (open) {
      setMinStockValue(initialMinStock);
    }
  }, [open, initialMinStock]);

  const handleSubmit = async () => {
    await onSubmit(Number(minStockValue) || 0);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Configurar Alertas - ${productName || "Producto"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input 
          label="Stock Mínimo para Alerta"
          type="number"
          value={minStockValue}
          onChange={(e) => setMinStockValue(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="0"
        />
        <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Guardar Cambios</Button>
      </div>
    </Modal>
  );
}
