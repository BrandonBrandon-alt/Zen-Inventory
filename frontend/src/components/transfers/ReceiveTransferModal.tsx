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

interface ReceiveTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transfer: TransferResponse | null;
}

export default function ReceiveTransferModal({ open, onClose, onSuccess, transfer }: ReceiveTransferModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Map<number, string>>(new Map());
  const [receivedQuantities, setReceivedQuantities] = useState<{ [key: number]: number }>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && transfer) {
      // Initialize received quantities with sent quantities
      const initial: { [key: number]: number } = {};
      transfer.details?.forEach(d => {
        initial[d.id!] = d.sentQuantity || d.requestedQuantity || 0;
      });
      setReceivedQuantities(initial);
      setNotes("");

      // Fetch products to show names
      apiClient.GET("/api/catalog/products").then(res => {
        setProducts(new Map((res.data ?? []).map(p => [p.id!, p.nombre!])));
      });
    }
  }, [open, transfer]);

  const handleQuantityChange = (detailId: number, val: string) => {
    const num = parseInt(val) || 0;
    setReceivedQuantities({ ...receivedQuantities, [detailId]: num });
  };

  const handleSubmit = async () => {
    if (!transfer) return;

    const hasDiscrepancy = Object.entries(receivedQuantities).some(([id, qty]) => {
      const detail = transfer.details?.find(d => d.id === parseInt(id));
      return qty < (detail?.sentQuantity || detail?.requestedQuantity || 0);
    });

    if (hasDiscrepancy && !notes.trim()) {
      showToast("Debes ingresar observaciones detallando la razón de la discrepancia", "warning");
      return;
    }

    setLoading(true);
    try {
      await (apiClient as any).POST("/api/v1/transfers/{id}/receive", {
        params: { path: { id: transfer.id! } },
        body: {
          notes,
          items: Object.entries(receivedQuantities).map(([id, qty]) => ({
            detailId: parseInt(id),
            receivedQuantity: qty,
          })),
        },
      });

      showToast("Recepción registrada correctamente", "success");
      onSuccess();
      onClose();
    } catch (err) {
      showToast("Error al registrar la recepción", "error");
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
      header: "Enviado",
      key: "sentQuantity",
      align: "center",
      render: (d) => <span style={{ fontWeight: 600, color: "var(--neutral-400)" }}>{d.sentQuantity || d.requestedQuantity}</span>
    },
    {
      header: "Recibido",
      key: "id",
      align: "right",
      width: "100px",
      render: (d) => (
        <input
          type="number"
          min="0"
          max={d.sentQuantity || d.requestedQuantity}
          value={receivedQuantities[d.id!] || 0}
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
    <Modal open={open} onClose={onClose} title={`Recibir Traslado #${transfer.id}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>
          Confirma la recepción física de los productos. Si llegó menos de lo enviado, ingresa la cantidad real; el sistema generará una alerta por el faltante automáticamente.
        </p>

        <div style={{ overflow: "hidden", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <DataTable<TransferDetailResponse>
            itemsPerPage={25}
            columns={columns}
            data={transfer.details ?? []}
            density="compact"
            minWidth="100%"
          />
        </div>

        <Input
          label="Observaciones / Novedades"
          placeholder="Escribe aquí si hubo algún problema con la entrega..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
            Confirmar Recepción
          </Button>
        </div>
      </div>
    </Modal>
  );
}
