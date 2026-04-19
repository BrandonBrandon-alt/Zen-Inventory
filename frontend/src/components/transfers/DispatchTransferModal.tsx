"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import DataTable, { Column } from "@/components/ui/DataTable";

type TransferResponse = components["schemas"]["TransferResponse"];
type TransferDetailResponse = components["schemas"]["TransferDetailResponse"];

interface DispatchTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transfer: TransferResponse | null;
}

export default function DispatchTransferModal({ open, onClose, onSuccess, transfer }: DispatchTransferModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Map<number, string>>(new Map());
  const [carrier, setCarrier] = useState("");
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [sentQuantities, setSentQuantities] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    if (open && transfer) {
      // Initialize sent quantities with requested quantities
      const initial: { [key: number]: number } = {};
      transfer.details?.forEach(d => {
        initial[d.id!] = d.requestedQuantity || 0;
      });
      setSentQuantities(initial);
      setCarrier("");
      setShippingCost("");
      setTrackingNumber("");
      setEstimatedArrivalDate(new Date(Date.now() + 86400000).toISOString().split("T")[0]);

      // Fetch products to show names
      apiClient.GET("/api/catalog/products").then(res => {
        setProducts(new Map((res.data ?? []).map(p => [p.id!, p.nombre!])));
      });
    }
  }, [open, transfer]);

  const handleQuantityChange = (detailId: number, val: string) => {
    const num = parseInt(val) || 0;
    setSentQuantities({ ...sentQuantities, [detailId]: num });
  };

  const handleSubmit = async () => {
    if (!transfer || !carrier) {
      showToast("Por favor ingresa el transportista", "warning");
      return;
    }

    setLoading(true);
    try {
      await (apiClient as any).POST("/api/v1/transfers/{id}/dispatch", {
        params: { path: { id: transfer.id! } },
        body: {
          carrier,
          shippingCost: parseFloat(shippingCost) || 0,
          trackingNumber: trackingNumber || null,
          estimatedArrivalDate: estimatedArrivalDate ? new Date(estimatedArrivalDate).toISOString() : null,
          items: Object.entries(sentQuantities).map(([id, qty]) => ({
            detailId: parseInt(id),
            sentQuantity: qty,
          })),
        },
      });

      showToast("Traslado despachado correctamente", "success");
      onSuccess();
      onClose();
    } catch (err) {
      showToast("Error al despachar el traslado", "error");
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<TransferDetailResponse>[] = [
    {
      header: "Producto",
      key: "productId",
      render: (d) => <span style={{ fontSize: "13px", fontWeight: 600 }}>{products.get(d.productId!) || `ID: ${d.productId}`}</span>
    },
    {
      header: "Solicitado",
      key: "requestedQuantity",
      align: "center",
      render: (d) => <span style={{ fontWeight: 700, color: "var(--neutral-50)" }}>{d.requestedQuantity}</span>
    },
    {
      header: "A Enviar",
      key: "id",
      align: "right",
      width: "100px",
      render: (d) => (
        <input
          type="number"
          min="0"
          max={d.requestedQuantity}
          value={sentQuantities[d.id!] || 0}
          onChange={(e) => handleQuantityChange(d.id!, e.target.value)}
          style={{
            width: "100%",
            padding: "6px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            background: "var(--bg-base)",
            color: "var(--neutral-100)",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "13px",
          }}
        />
      )
    }
  ];

  if (!transfer) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Despachar/Preparar Traslado #${transfer.id}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>
          Confirma las cantidades finales a enviar y registra el transportista responsable. 
          Si no tienes stock suficiente, puedes ajustar la cantidad a enviar.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Input
            label="Transportista"
            placeholder="Empresa o conductor"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            required
          />
          <Input
            label="Fecha Est. de Llegada"
            type="date"
            value={estimatedArrivalDate}
            onChange={(e) => setEstimatedArrivalDate(e.target.value)}
            required
          />
          <Input
            label="Costo Flete / Envío ($)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 50.00"
            value={shippingCost}
            onChange={(e) => setShippingCost(e.target.value)}
          />
          <Input
            label="Número de Guía / Tracking"
            placeholder="Opcional"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
        </div>

        <div style={{ overflow: "hidden", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <DataTable<TransferDetailResponse>
            itemsPerPage={25}
            columns={columns}
            data={transfer.details ?? []}
            density="compact"
            minWidth="100%"
          />
        </div>

        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
            Confirmar Despacho
          </Button>
        </div>
      </div>
    </Modal>
  );
}
