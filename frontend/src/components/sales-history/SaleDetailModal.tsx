"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SaleReceipt from "./SaleReceipt";
import type { SaleReceiptData } from "./SaleReceipt";
import DataTable, { Column } from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import { usePrint } from "@/hooks/usePrint";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/api/client";
import { 
  User, 
  Store, 
  Calendar, 
  Hash, 
  Printer, 
  AlertTriangle,
  Package,
  CreditCard
} from "lucide-react";

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any | null;
  isAdmin: boolean;
  onSaleCanceled?: () => void;
}

export default function SaleDetailModal({
  isOpen,
  onClose,
  sale,
  isAdmin,
  onSaleCanceled,
}: SaleDetailModalProps) {
  const { showToast } = useToast();
  const { print, isPrinting } = usePrint();
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!sale) return null;

  const handleCancelSale = async () => {
    if (!cancelReason.trim()) {
      showToast("Ingrese el motivo de la anulación.", "warning");
      return;
    }

    setIsCanceling(true);
    try {
      await apiClient.DELETE("/api/v1/sales/{id}", { 
        params: { 
          path: { id: sale.id },
          query: { reason: cancelReason } 
        } 
      });
      showToast("Venta anulada correctamente.", "success");
      onSaleCanceled?.();
      onClose();
    } catch (error: any) {
      showToast("Error al procesar la anulación.", "error");
    } finally {
      setIsCanceling(false);
      setShowCancelConfirm(false);
    }
  };

  const handlePrint = () => {
    const receiptData: SaleReceiptData = {
      id: sale.id,
      date: sale.date,
      subtotal: sale.subtotal ?? sale.totalFinal,
      totalDiscount: sale.totalDiscount ?? 0,
      totalFinal: sale.totalFinal,
      branchName: sale.branchName,
      userName: sale.userName,
      customerName: sale.customerName,
      customerDocument: sale.customerDocument,
      details: (sale.details ?? []).map((d: any) => ({
        id: d.id,
        productId: d.productId,
        productName: d.productName,
        quantity: d.quantity,
        unitPriceApplied: d.unitPriceApplied,
        discountPercentage: d.discountPercentage ?? 0,
        subtotalLine: d.subtotalLine,
      }))
    };
    print(<SaleReceipt sale={receiptData} />);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);

  const columns: Column<any>[] = [
    {
      header: "Descripción del Item",
      key: "productName",
      render: (d) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-[var(--neutral-50)] uppercase tracking-tight">{d.productName || "Producto"}</span>
          <span className="text-[11px] font-bold text-[var(--neutral-500)] uppercase tracking-widest">{formatCurrency(d.unitPriceApplied)} c/u</span>
        </div>
      )
    },
    {
      header: "Cant.",
      key: "quantity",
      align: "center",
      width: "80px",
      render: (d) => (
        <div className="flex items-center justify-center">
            <span className="tabular text-[13px] font-black text-[var(--neutral-400)] bg-[var(--bg-surface)]/50 px-3 py-1 rounded-lg border border-[var(--neutral-800)]">
                {d.quantity}
            </span>
        </div>
      )
    },
    {
      header: "Subtotal",
      key: "subtotalLine",
      align: "right",
      width: "120px",
      render: (d) => (
        <span className="tabular text-[14px] font-black text-[var(--brand-400)]">
          {formatCurrency(d.subtotalLine)}
        </span>
      )
    }
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Auditoría de Venta"
      description={`Referencia ERP: #${sale.id}`}
      size="xl"
    >
      <div className="space-y-6 animate-fade-in pb-20">
        {/* Status Indicator - Standardized Card usage */}
        <Card className="!p-4 bg-[var(--bg-card)] shadow-sm border-[var(--neutral-800)]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${sale.status === 'COMPLETED' ? "bg-[var(--color-success)] shadow-[0_0_10px_var(--color-success-glow)]" : "bg-[var(--color-danger)] shadow-[0_0_10px_var(--color-danger-glow)]"}`} />
                    <span className="text-[11px] font-black text-[var(--neutral-400)] uppercase tracking-widest">
                        {sale.status === 'COMPLETED' ? "Transacción Aprobada" : "Transacción Anulada"}
                    </span>
                </div>
                {sale.status === 'CANCELLED' && (
                    <Badge variant="danger" dot>REF-{sale.id}</Badge>
                )}
            </div>
        </Card>

        {/* Core Metrics Grid - Standardized Cards */}
        <div className="grid grid-cols-2 gap-3">
            {[
                { icon: <Calendar size={14} />, label: "Fecha", value: new Date(sale.date).toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' }) },
                { icon: <Store size={14} />, label: "Sucursal", value: sale.branchName || "Sede Central" },
                { icon: <User size={14} />, label: "Vendedor", value: sale.userName || "Admin" },
                { icon: <Hash size={14} />, label: "Registro", value: `POS-${sale.id}` }
            ].map((metric, idx) => (
                <Card key={idx} className="!p-4 flex flex-col gap-2 group hover:border-[var(--neutral-700)] transition-colors">
                    <div className="flex items-center gap-2 opacity-60">
                        <span className="text-[var(--brand-400)]">{metric.icon}</span>
                        <span className="text-[9px] font-black text-[var(--neutral-400)] uppercase tracking-widest">{metric.label}</span>
                    </div>
                    <p className="text-[13px] font-black text-[var(--neutral-50)] uppercase truncate">{metric.value}</p>
                </Card>
            ))}
        </div>

        {/* Responsible Section - Standardized Card */}
        <Card title="Responsable / Cliente" className="shadow-sm">
            <div className="flex flex-col">
                <p className="text-lg font-black text-[var(--neutral-50)] uppercase tracking-tight">{sale.customerName || "Venta General"}</p>
                <div className="flex items-center gap-2 mt-1">
                    <CreditCard size={12} className="text-[var(--brand-400)]" />
                    <p className="tabular text-xs text-[var(--neutral-500)] font-bold uppercase tracking-widest">DNI: {sale.customerDocument || "PÚBLICO GENERAL"}</p>
                </div>
            </div>
        </Card>

        {/* Itemized Table - Unified DataTable */}
        <div 
            className="border border-[var(--neutral-800)] rounded-3xl overflow-hidden bg-[var(--bg-surface)]/30 shadow-2xl overflow-y-auto custom-scrollbar"
            style={{ maxHeight: "300px" }}
        >
            <DataTable<any>
                columns={columns}
                data={sale.details ?? []}
                density="compact"
                minWidth="100%"
                emptyState={{
                    title: "Sin registros",
                    description: "No hay items registrados en esta transacción.",
                    icon: <Package size={24} className="text-[var(--neutral-700)]" />
                }}
            />
        </div>

        {/* Financial Recap - Standardized Card with Brand accents */}
        <Card className="relative overflow-hidden group border-[var(--brand-500)]/20 bg-[var(--bg-card)]">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CreditCard size={64} className="text-[var(--brand-400)]" />
            </div>
            <div className="relative z-10">
                <p className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest mb-1">Total Confirmado de Operación</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-black text-[var(--brand-400)] uppercase tracking-widest">COP</span>
                    <p className="tabular text-4xl font-black text-[var(--neutral-50)] tracking-tighter">
                        {formatCurrency(sale.totalFinal).replace(/COP|\$/g, "").trim()}
                    </p>
                </div>
            </div>
        </Card>

        {/* Actions - Footer Pattern */}
        <div className="space-y-3 pt-6 border-t border-[var(--neutral-800)]">
            {!showCancelConfirm ? (
                <>
                    <Button variant="primary" fullWidth onClick={handlePrint} leftIcon={<Printer size={16} />} loading={isPrinting} >
                        {isPrinting ? "Preparando..." : "Imprimir Comprobante Fiscal"}
                    </Button>
                    {isAdmin && sale.status === 'COMPLETED' && (
                        <Button variant="danger" fullWidth onClick={() => setShowCancelConfirm(true)} leftIcon={<AlertTriangle size={16} />}>
                            Anular esta Transacción
                        </Button>
                    )}
                </>
            ) : (
                <Card className="border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 !p-5">
                    <p className="text-xs font-black text-[var(--color-danger)] uppercase tracking-widest mb-3">Justificación de la anulación</p>
                    <textarea 
                        className="w-full bg-[var(--bg-base)] border border-[var(--neutral-800)] rounded-xl p-4 text-[var(--neutral-50)] text-sm outline-none focus:border-[var(--color-danger)]/50 focus:ring-1 focus:ring-[var(--color-danger)]/20 transition-all min-h-[100px] mb-4 font-sans"
                        placeholder="Describa el motivo detallado..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <div className="flex gap-3">
                        <Button fullWidth variant="danger" loading={isCanceling} onClick={handleCancelSale}>Confirmar Anulación</Button>
                        <Button fullWidth variant="ghost" onClick={() => setShowCancelConfirm(false)}>Desistir</Button>
                    </div>
                </Card>
            )}
        </div>

      </div>
    </Modal>
  );
}
