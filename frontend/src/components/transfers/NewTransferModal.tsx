"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import type { components } from "@/api/schema";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";

type ProductResponse = components["schemas"]["ProductResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

interface NewTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentBranchId: number | null;
  isAdmin: boolean;
  isManager: boolean;
  initialProductId?: string | null;
  initialType?: "INBOUND" | "OUTBOUND" | null;
  branches: BranchResponse[];
}

export default function NewTransferModal({ open, onClose, onSuccess, currentBranchId, isAdmin, isManager, initialProductId, initialType, branches }: NewTransferModalProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferType, setTransferType] = useState<"INBOUND" | "OUTBOUND">(initialType ?? "INBOUND");

  const [formData, setFormData] = useState({
    originBranchId: "",
    destinationBranchId: currentBranchId?.toString() || "",
    productId: "",
    quantity: 1,
    priority: "NORMAL",
  });
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  // Re-sync when type changes
  useEffect(() => {
    if (transferType === "INBOUND") {
      setFormData(prev => ({ 
        ...prev, 
        destinationBranchId: currentBranchId?.toString() || "",
        originBranchId: prev.originBranchId === currentBranchId?.toString() ? "" : prev.originBranchId
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        originBranchId: currentBranchId?.toString() || "",
        destinationBranchId: prev.destinationBranchId === currentBranchId?.toString() ? "" : prev.destinationBranchId
      }));
    }
  }, [transferType, currentBranchId]);

  useEffect(() => {
    if (open) {
      async function fetchData() {
        try {
          const res = await apiClient.GET("/api/catalog/products");
          const allProds = res.data ?? [];
          setProducts(allProds.filter(p => (p as any).activo !== false));
        } catch (err) {
          showToast("Error al cargar productos", "error");
        }
      }
      fetchData();
    }
  }, [open, showToast]);

  useEffect(() => {
    if (open && initialProductId) {
      setFormData(prev => ({ ...prev, productId: initialProductId }));
    }
    if (open && initialType) {
      setTransferType(initialType);
    }
  }, [open, initialProductId, initialType]);

  useEffect(() => {
    if (formData.originBranchId && formData.productId) {
      apiClient.GET("/api/v1/inventory/branches/{branchId}/products/{productId}", {
        params: { path: { branchId: parseInt(formData.originBranchId), productId: parseInt(formData.productId) } }
      }).then(res => {
        setAvailableStock((res.data as any)?.currentQuantity ?? 0);
      }).catch(() => {
        setAvailableStock(0);
      });
    } else {
      setAvailableStock(null);
    }
  }, [formData.originBranchId, formData.productId]);

  const handleSubmit = async () => {
    if (!formData.originBranchId || !formData.destinationBranchId || !formData.productId || formData.quantity <= 0) {
      showToast("Por favor completa todos los campos correctamente", "warning");
      return;
    }

    if (formData.originBranchId === formData.destinationBranchId) {
      showToast("La sucursal de origen y destino no pueden ser la misma", "warning");
      return;
    }

    setLoading(true);
    try {
      await apiClient.POST("/api/v1/transfers", {
        body: {
          originBranchId: parseInt(formData.originBranchId),
          destinationBranchId: parseInt(formData.destinationBranchId),
          estimatedArrivalDate: undefined,
          items: [
            {
              productId: parseInt(formData.productId),
              requestedQuantity: formData.quantity,
            },
          ],
          priority: formData.priority,
        },
      });

      showToast("Solicitud de traslado creada con éxito", "success");
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        originBranchId: "",
        destinationBranchId: currentBranchId?.toString() || "",
        productId: "",
        quantity: 1,
        priority: "NORMAL",
      });
      setTransferType("INBOUND");
    } catch (err) {
      showToast("Error al crear la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  const originSelector = (
    <Select
      label={transferType === "INBOUND" ? "Sede de Origen (Donde pido)" : "Sede de Origen (Mi Sede)"}
      placeholder="Selecciona origen"
      value={formData.originBranchId}
      error={formData.originBranchId && formData.originBranchId === formData.destinationBranchId ? "No puede ser la misma" : undefined}
      disabled={transferType === "OUTBOUND" && !isAdmin}
      onChange={(val) => setFormData({ ...formData, originBranchId: val })}
      options={branches.map(b => ({ value: b.id!.toString(), label: b.nombre! }))}
    />
  );

  const destinationSelector = (
    <Select
      label={transferType === "OUTBOUND" ? "Sede de Destino (A donde envío)" : "Sede de Destino (Mi Sede)"}
      placeholder="Selecciona destino"
      value={formData.destinationBranchId}
      error={formData.destinationBranchId && formData.originBranchId === formData.destinationBranchId ? "No puede ser la misma" : undefined}
      disabled={transferType === "INBOUND" && !isAdmin}
      onChange={(val) => setFormData({ ...formData, destinationBranchId: val })}
      options={branches.map(b => ({ value: b.id!.toString(), label: b.nombre! }))}
    />
  );

  return (
    <Modal open={open} onClose={onClose} title="Gestionar Traslado de Mercancía">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Toggle Mode */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", background: "var(--bg-accent)", padding: "4px", borderRadius: "10px" }}>
          <button
            onClick={() => setTransferType("INBOUND")}
            style={{
              padding: "8px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              background: transferType === "INBOUND" ? "var(--brand-500)" : "transparent",
              color: transferType === "INBOUND" ? "#fff" : "var(--neutral-400)",
              transition: "all 0.2s"
            }}
          >
            Solicitar Entrada (Ingreso)
          </button>
          <button
            onClick={() => setTransferType("OUTBOUND")}
            style={{
              padding: "8px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              background: transferType === "OUTBOUND" ? "var(--brand-500)" : "transparent",
              color: transferType === "OUTBOUND" ? "#fff" : "var(--neutral-400)",
              transition: "all 0.2s"
            }}
          >
            Registrar Salida (Retiro)
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>
          {transferType === "INBOUND" 
            ? (isAdmin || isManager 
                ? "Pide mercancía de otra sede. Tu solicitud se aprobará automáticamente por tu rango." 
                : "Pide mercancía de otra sede hacia la tuya. El responsable de la otra sede deberá autorizar el envío.")
            : "Selecciona una sede destino para enviar productos desde tu inventario actual."
          }
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {transferType === "INBOUND" ? (
            <>
              {destinationSelector}
              {originSelector}
            </>
          ) : (
            <>
              {originSelector}
              {destinationSelector}
            </>
          )}

          <Select
            label="Prioridad"
            placement="top"
            placeholder="Nivel de prioridad"
            value={formData.priority}
            onChange={(val) => setFormData({ ...formData, priority: val })}
            options={[
              { value: "HIGH", label: "Alta Urgencia" },
              { value: "NORMAL", label: "Normal" },
              { value: "LOW", label: "Baja Prioridad" },
            ]}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Select
              label="Producto"
              placeholder="Busca un producto"
              value={formData.productId}
              onChange={(val) => setFormData({ ...formData, productId: val })}
              options={products.map(p => ({ value: p.id!.toString(), label: p.nombre! }))}
            />
            {availableStock !== null && (
              <span style={{ fontSize: "12px", color: availableStock > 0 ? "var(--neutral-400)" : "var(--color-danger)" }}>
                Stock en sede origen: <strong>{availableStock}</strong> unidades
              </span>
            )}
          </div>

          <Input
            label="Cantidad"
            type="number"
            min="1"
            value={formData.quantity}
            error={availableStock !== null && formData.quantity > availableStock ? "Excede el stock disponible" : undefined}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
          />
        </div>

        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
            {transferType === "INBOUND" ? "Solicitar Traslado" : "Registrar Salida"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
