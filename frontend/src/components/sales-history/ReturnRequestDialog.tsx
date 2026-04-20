"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { apiClient } from "@/api/client";
import { useToast } from "@/context/ToastContext";
import { AlertTriangle, Info, Package, ChevronRight, RotateCcw } from "lucide-react";

interface ReturnRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
  branchId: number;
  requesterId: number;
  onSuccess: () => void;
}

export default function ReturnRequestDialog({
  isOpen,
  onClose,
  sale,
  branchId,
  requesterId,
  onSuccess
}: ReturnRequestDialogProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [generalReason, setGeneralReason] = useState("");
  
  // Track selected quantities and reasons per item
  const [returnItems, setReturnItems] = useState<Record<number, { quantity: number; reason: string }>>({});

  const handleQuantityChange = (productId: number, quantity: number, max: number) => {
    if (quantity < 0) return;
    if (quantity > max) {
        showToast(`Cantidad excede el límite de compra (${max})`, "warning");
        return;
    }
    setReturnItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity }
    }));
  };

  const handleReasonChange = (productId: number, reason: string) => {
    setReturnItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], reason }
    }));
  };

  const handleSubmit = async () => {
    if (!generalReason.trim()) {
      showToast("Por favor, indique el motivo general del retorno.", "warning");
      return;
    }

    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, data]) => data.quantity > 0)
      .map(([productId, data]) => ({
        productId: Number(productId),
        quantity: data.quantity,
        reasonSpecific: data.reason || generalReason,
        unitPricePaid: sale.details.find((d: any) => d.productId === Number(productId))?.unitPriceApplied
      }));

    if (itemsToReturn.length === 0) {
      showToast("Seleccione al menos un producto para devolver.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.POST("/api/v1/returns" as any, {
        body: {
          saleId: sale.id,
          branchId,
          requesterId,
          generalReason,
          items: itemsToReturn
        }
      });
      showToast("Solicitud enviada. Pendiente de aprobación por el Manager.", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Falla en la comunicación con el servidor.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Solicitud de Devolución"
      description={`Iniciando proceso para Venta #${sale?.id}`}
      size="lg"
    >
      <div className="flex flex-col gap-6">
        {/* Info Banner */}
        <div className="bg-[var(--brand-500)]/5 p-4 rounded-3xl border border-[var(--brand-500)]/10 flex gap-4 items-center">
            <div className="p-2 bg-[var(--brand-500)]/10 rounded-2xl">
                <Info className="text-[var(--brand-400)]" size={20} />
            </div>
            <p className="text-[12px] text-[var(--neutral-400)] leading-relaxed">
                Especifique los ítems a retornar. El stock no se verá afectado hasta que un <strong className="text-[var(--neutral-200)] text-bold">Manager</strong> apruebe esta operación.
            </p>
        </div>

        <Input 
          label="Motivo Maestro de la Devolución"
          placeholder="Ej: Producto defectuoso, el cliente cambió de opinión..."
          value={generalReason}
          onChange={(e: any) => setGeneralReason(e.target.value)}
          required
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <span className="text-[11px] font-black text-[var(--neutral-500)] uppercase tracking-widest">Detalle de Productos</span>
             <span className="text-[10px] font-bold text-[var(--brand-400)] bg-[var(--brand-400)]/10 px-2 py-0.5 rounded-full uppercase">Selección Parcial</span>
          </div>

          <div className="overflow-hidden border border-[var(--neutral-800)] rounded-3xl bg-[var(--bg-surface)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--neutral-900)] border-b border-[var(--neutral-800)]">
                  <th className="px-5 py-4 text-[10px] font-black text-[var(--neutral-500)] uppercase">Producto</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[var(--neutral-500)] uppercase text-center">En Factura</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[var(--neutral-500)] uppercase text-center">Retorno</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[var(--neutral-500)] uppercase">Justificación por Item</th>
                </tr>
              </thead>
              <tbody>
                {sale?.details.map((detail: any) => (
                  <tr key={detail.productId} className="border-b border-[var(--neutral-800)] last:border-0 hover:bg-black/10 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[var(--bg-base)] border border-[var(--neutral-800)] flex items-center justify-center">
                           <Package size={14} className="text-[var(--neutral-400)]" />
                        </div>
                        <span className="text-[13px] font-bold text-[var(--neutral-50)]">{detail.productName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                       <span className="text-[13px] font-black text-[var(--neutral-500)] tabular">{detail.quantity}</span>
                    </td>
                    <td className="px-5 py-4 w-28">
                      <div className="relative group">
                        <input 
                            type="number"
                            className="w-full bg-[var(--bg-card)] border border-[var(--neutral-800)] rounded-xl px-3 py-2 text-[14px] font-black outline-none focus:border-[var(--brand-500)] text-center tabular group-hover:border-[var(--neutral-700)] transition-all"
                            value={returnItems[detail.productId]?.quantity || ""}
                            onChange={(e) => handleQuantityChange(detail.productId, e.target.value === "" ? 0 : Number(e.target.value), detail.quantity)}
                            placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <input 
                        type="text"
                        className="w-full bg-transparent border-b border-[var(--neutral-800)] px-2 py-1 text-[12px] outline-none focus:border-[var(--brand-500)] focus:text-[var(--neutral-100)] transition-all placeholder:text-[var(--neutral-700)]"
                        value={returnItems[detail.productId]?.reason || ""}
                        onChange={(e) => handleReasonChange(detail.productId, e.target.value)}
                        placeholder="Nota opcional..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-4 pt-10 border-t border-[var(--neutral-800)] mt-4">
          <Button 
            variant="ghost" 
            fullWidth 
            onClick={onClose} 
            disabled={submitting}
            className="rounded-3xl !py-6 font-bold"
          >
            Abortar Proceso
          </Button>
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleSubmit} 
            loading={submitting}
            leftIcon={<RotateCcw size={18} />}
            className="rounded-3xl !py-6 font-black shadow-[0_10px_30px_rgba(var(--brand-rgb),0.2)]"
          >
            Enviar a Aprobación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
