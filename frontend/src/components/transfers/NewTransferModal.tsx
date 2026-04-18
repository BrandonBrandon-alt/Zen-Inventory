"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
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
  initialProductId?: string | null;
}

export default function NewTransferModal({ open, onClose, onSuccess, currentBranchId, isAdmin, initialProductId }: NewTransferModalProps) {
  const { showToast } = useToast();
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    originBranchId: "",
    destinationBranchId: currentBranchId?.toString() || "",
    estimatedArrivalDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    productId: "",
    quantity: 1,
  });
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      async function fetchData() {
        try {
          const [bRes, pRes] = await Promise.all([
            apiClient.GET("/api/branches"),
            apiClient.GET("/api/catalog/products"),
          ]);
          setBranches(bRes.data ?? []);
          setProducts(pRes.data ?? []);
        } catch (err) {
          showToast("Error al cargar datos necesarios", "error");
        }
      }
      fetchData();
    }
  }, [open, showToast]);

  useEffect(() => {
    if (open && initialProductId) {
      setFormData(prev => ({ ...prev, productId: initialProductId }));
    }
  }, [open, initialProductId]);

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.estimatedArrivalDate);
    selectedDate.setHours(24, 0, 0, 0); // Consider end of selected day for date inputs

    if (selectedDate < today) {
      showToast("La fecha estimada de llegada no puede ser anterior a hoy", "warning");
      return;
    }

    setLoading(true);
    try {
      await apiClient.POST("/api/v1/transfers", {
        body: {
          originBranchId: parseInt(formData.originBranchId),
          destinationBranchId: parseInt(formData.destinationBranchId),
          estimatedArrivalDate: new Date(formData.estimatedArrivalDate).toISOString(),
          items: [
            {
              productId: parseInt(formData.productId),
              requestedQuantity: formData.quantity,
            },
          ],
        },
      });

      showToast("Solicitud de traslado creada con éxito", "success");
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        originBranchId: "",
        destinationBranchId: currentBranchId?.toString() || "",
        estimatedArrivalDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        productId: "",
        quantity: 1,
      });
    } catch (err) {
      showToast("Error al crear la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Solicitar Traslado de Mercancía">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>
          Crea una solicitud formal para mover productos desde otra sucursal hacia la tuya. 
          Un administrador o personal de la sede origen deberá despachar el pedido.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Select
            label="Sede Origen (De donde sale)"
            placeholder="Selecciona origen"
            value={formData.originBranchId}
            error={formData.originBranchId && formData.originBranchId === formData.destinationBranchId ? "No puede ser la misma que el destino" : undefined}
            onChange={(val) => setFormData({ ...formData, originBranchId: val })}
            options={branches.map(b => ({ value: b.id!.toString(), label: b.nombre! }))}
          />

          <Select
            label="Sede Destino (A donde llega)"
            placeholder="Selecciona destino"
            value={formData.destinationBranchId}
            error={formData.destinationBranchId && formData.originBranchId === formData.destinationBranchId ? "No puede ser la misma que el origen" : undefined}
            disabled={!isAdmin}
            onChange={(val) => setFormData({ ...formData, destinationBranchId: val })}
            options={branches.map(b => ({ value: b.id!.toString(), label: b.nombre! }))}
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
                Disp. en origen: <strong>{availableStock}</strong> unidades
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

        <Input
          label="Fecha Estimada de Llegada"
          type="date"
          min={new Date().toISOString().split("T")[0]}
          value={formData.estimatedArrivalDate}
          onChange={(e) => setFormData({ ...formData, estimatedArrivalDate: e.target.value })}
        />

        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
            Crear Solicitud
          </Button>
        </div>
      </div>
    </Modal>
  );
}
