import React from "react";
import { Eye, AlertCircle } from "lucide-react";
import DataTable, { Column } from "../ui/DataTable";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

interface HistoryTableProps {
  sales: any[];
  onOpenDetail: (sale: any) => void;
  formatCurrency: (amount: number) => string;
  onRefresh: () => void;
  isLoading?: boolean;
}

export default function HistoryTable({ sales, onOpenDetail, formatCurrency, onRefresh, isLoading }: HistoryTableProps) {
  
  const columns: Column<any>[] = [
    {
      header: "ID / Referencia",
      key: "id",
      width: "140px",
      render: (sale) => (
        <span className="tabular font-black text-[var(--brand-400)] tracking-tighter text-sm">
          #{String(sale.id).padStart(6, "0")}
        </span>
      )
    },
    {
      header: "Sucursal / Usuario",
      key: "branchName",
      render: (sale) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-[var(--neutral-50)] uppercase tracking-tight">
            {sale.branchName || `Sucursal ${sale.branchId}`}
          </span>
          <span className="text-[10px] text-[var(--neutral-500)] font-black uppercase tracking-widest mt-0.5">
            Responsable: {sale.userName || "Admin Central"}
          </span>
        </div>
      )
    },
    {
      header: "Cliente / Identificación",
      key: "customerName",
      render: (sale) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-[var(--neutral-100)] uppercase tracking-tight">
            {sale.customerName || "Consumidor Final"}
          </span>
          <span className="tabular text-[10px] text-[var(--brand-400)] font-black uppercase tracking-widest mt-0.5 opacity-70">
            DOC: {sale.customerDocument || "ANÓNIMO"}
          </span>
        </div>
      )
    },
    {
      header: "Valor de Factura",
      key: "totalFinal",
      align: "right",
      render: (sale) => (
        <span className="tabular text-base font-black text-[var(--neutral-50)]" style={{ textShadow: "0 0 15px var(--brand-glow)" }}>
          {formatCurrency(sale.totalFinal)}
        </span>
      )
    },
    {
      header: "Estado Transaccional",
      key: "status",
      align: "center",
      render: (sale) => {
        const rawStatus = (sale.status || "").toUpperCase().trim();
        const variantMap: Record<string, any> = {
          'COMPLETED': { variant: 'success', text: 'Venta Exitosa' },
          'RETURNED': { variant: 'warning', text: 'Devolución' },
          'CANCELED': { variant: 'neutral', text: 'Anulada' }
        };
        const config = variantMap[rawStatus] || { variant: 'neutral', text: rawStatus || 'Sin Estado' };
        return (
          <Badge variant={config.variant} className="font-black uppercase tracking-widest text-[9px] px-3">
            {config.text}
          </Badge>
        );
      }
    },
    {
      header: "Acciones",
      key: "actions",
      align: "right",
      width: "80px",
      render: () => (
        <Button variant="ghost" size="sm" title="Consultar Comprobante" className="text-[var(--brand-400)] hover:bg-[var(--brand-500)]/10">
          <Eye size={18} />
        </Button>
      )
    }
  ];

  const renderMobileCard = (sale: any) => (
    <div 
      style={{ padding: "20px", background: "var(--bg-base)", borderBottom: "1px solid var(--neutral-800)" }}
      onClick={() => onOpenDetail(sale)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span className="tabular" style={{ fontSize: "12px", fontWeight: 700, color: "var(--brand-400)" }}>#{sale.id}</span>
        <div style={{ 
            padding: "2px 8px", 
            borderRadius: "6px", 
            fontSize: "9px", 
            fontWeight: 800, 
            textTransform: "uppercase",
            background: sale.status === 'COMPLETED' ? "rgba(var(--color-success-rgb), 0.1)" : 
                        sale.status === 'RETURNED' ? "rgba(var(--color-warning-rgb), 0.1)" : "rgba(var(--neutral-500-rgb), 0.1)",
            color: sale.status === 'COMPLETED' ? "var(--color-success)" : 
                   sale.status === 'RETURNED' ? "var(--color-warning)" : "var(--neutral-400)",
            border: `1px solid ${sale.status === 'COMPLETED' ? "rgba(var(--color-success-rgb), 0.2)" : 
                                  sale.status === 'RETURNED' ? "rgba(var(--color-warning-rgb), 0.2)" : "rgba(var(--neutral-500-rgb), 0.2)"}`
        }}>
          {sale.status === 'COMPLETED' ? "Venta Ok" : sale.status === 'RETURNED' ? "Devolución" : "Anulada"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <p style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase", marginBottom: "2px" }}>Cliente</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--neutral-100)", textTransform: "uppercase" }}>{sale.customerName || "Gral."}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase", marginBottom: "2px" }}>Total</p>
          <p className="tabular" style={{ fontSize: "14px", fontWeight: 800, color: "var(--neutral-50)" }}>{formatCurrency(sale.totalFinal)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <DataTable
      itemsPerPage={15}
      columns={columns}
      data={sales}
      isLoading={isLoading}
      onRowClick={(sale) => onOpenDetail(sale)}
      minWidth="900px"
      emptyState={{
        title: "Sin registros encontrados",
        description: "No hay transacciones que coincidan con los filtros aplicados en esta sucursal.",
        icon: <AlertCircle size={40} />,
        action: (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            Refrescar base de datos
          </Button>
        )
      }}
    />
  );
}
