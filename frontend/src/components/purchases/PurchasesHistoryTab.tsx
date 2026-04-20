import React from "react";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import { 
  Building2, Package, X, Calendar, Clock, 
  Eye, Truck, CheckCircle, TrendingUp, CreditCard, XCircle 
} from "lucide-react";

interface PurchasesHistoryTabProps {
  filteredOrders: any[];
  isLoadingOrders: boolean;
  filterSupplierId: string;
  setFilterSupplierId: (val: string) => void;
  filterProductId: string;
  setFilterProductId: (val: string) => void;
  suppliers: any[];
  products: any[];
  branches: any[];
  formatCurrency: (amount: number) => string;
  session: any;
  openOrderDetail: (row: any) => void;
  receiveOrder: (id: number) => void;
  handleCloseShortfall: (id: number) => void;
  handleApproveOrder: (id: number) => void;
  handleApproveException: (id: number) => void;
  registerPayment: (id: number) => void;
  setResolvingOrder: (row: any) => void;
  showToast: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export default function PurchasesHistoryTab({
  filteredOrders, isLoadingOrders, filterSupplierId, setFilterSupplierId, 
  filterProductId, setFilterProductId, suppliers, products, branches, 
  formatCurrency, session, openOrderDetail, receiveOrder, handleCloseShortfall, 
  handleApproveOrder, handleApproveException, registerPayment, setResolvingOrder, showToast
}: PurchasesHistoryTabProps) {

  const columns = [
    { 
      key: "id", 
      label: "ID", 
      render: (row: any) => <span className="font-mono text-[var(--brand-400)] font-bold">#{String(row.id).padStart(5, '0')}</span> 
    },
    { 
      key: "requestDate", 
      label: "Emisión y Plazo", 
      render: (row: any) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[var(--neutral-100)] font-bold">
            <Calendar size={12} className="text-[var(--brand-500)]" /> 
            {new Date(row.requestDate).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-2">
            <Truck size={12} className="text-[var(--neutral-500)]" />
            <span className="text-[10px] font-black text-[var(--neutral-400)] uppercase tracking-widest">
              {row.deliveryLeadTimeDays || 0} DÍAS PACTADOS
            </span>
          </div>
        </div>
      )
    },
    { 
      key: "estimatedArrivalDate", 
      label: "Expectativa", 
      render: (row: any) => (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest opacity-60">Llegada Est.</span>
          <div className="flex items-center gap-2 font-black text-[var(--neutral-50)] text-[13px]">
            {new Date(row.estimatedArrivalDate).toLocaleDateString()}
          </div>
        </div>
      )
    },
    { 
      key: "details", 
      label: "Mercancía", 
      render: (row: any) => (
        <div className="flex flex-col gap-1 max-w-[220px]">
          {row.details && row.details.length > 0 ? (
            row.details.slice(0, 2).map((detail: any, idx: number) => {
              const prod = products.find(p => p.id === detail.productId);
              return (
                <div key={idx} className="flex items-center gap-2 bg-[var(--bg-surface)] px-2 py-1 rounded-lg border border-[var(--neutral-800)]/50 group hover:border-[var(--brand-500)]/30 transition-colors">
                  <span className="text-[10px] font-black text-[var(--brand-400)]">{detail.quantity}x</span>
                  <span className="text-[11px] font-bold text-[var(--neutral-300)] truncate uppercase tracking-tight">
                    {prod?.nombre || `Prod #${detail.productId}`}
                  </span>
                </div>
              );
            })
          ) : (
            <span className="text-[10px] text-[var(--neutral-600)] uppercase font-black tracking-widest">Sin detalles</span>
          )}
          {row.details && row.details.length > 2 && (
            <span className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em] ml-2">
              + {row.details.length - 2} ítem(s) más
            </span>
          )}
        </div>
      ) 
    },
    { 
      key: "supplierId", 
      label: "Socio Comercial", 
      render: (row: any) => <span className="font-semibold text-[var(--neutral-100)]">{suppliers.find(s => s.id === row.supplierId)?.nombre || "Desconocido"}</span> 
    },
    { 
      key: "branchId", 
      label: "Sucursal", 
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-[var(--neutral-500)]" />
          <span className="font-bold text-[var(--neutral-100)] uppercase tracking-tight text-[11px]">
            {branches.find(b => b.id === row.branchId)?.nombre || `Sucursal #${row.branchId}`}
          </span>
        </div>
      )
    },
    { 
      key: "total", 
      label: "Monto Total", 
      render: (row: any) => <span className="font-black text-[var(--neutral-50)]">{formatCurrency(row.total)}</span> 
    },
    { 
      key: "receptionStatus", 
      label: "Logística", 
      render: (row: any) => (
        <div className="flex flex-col gap-1.5">
          <Badge 
            variant={row.receptionStatus === "RECEIVED_TOTAL" ? "success" : (row.receptionStatus as string) === "CANCELLED" ? "danger" : row.receptionStatus === "IN_TRANSIT" ? "warning" : row.receptionStatus === "AWAITING_APPROVAL" ? "neutral" : "info"} 
            dot
          >
            {row.receptionStatus === "RECEIVED_TOTAL" ? "ENTREGADO" : (row.receptionStatus as string) === "CANCELLED" ? "CANCELADO" : row.receptionStatus === "IN_TRANSIT" ? "EN CAMINO" : row.receptionStatus === "AWAITING_APPROVAL" ? "SOLICITADO" : "APROBADO"}
          </Badge>
          {(row.receptionStatus as string) === "CANCELLED" && row.reasonResolution && (
            <p className="text-[10px] text-[var(--neutral-500)] italic leading-tight max-w-[120px]">
              {row.reasonResolution}
            </p>
          )}
        </div>
      ) 
    },
    { 
      key: "paymentStatus", 
      label: "Finanzas", 
      render: (row: any) => (
        <Badge variant={row.paymentStatus === "PAGADO" ? "success" : "danger"}>
          {row.paymentStatus === "PAGADO" ? "PAGADO" : "DEUDA ACTIVA"}
        </Badge>
      ) 
    },
    { 
      key: "actions", 
      label: "", 
      render: (row: any) => {
        const isAdmin = session?.rol === "ADMIN";
        const isManager = session?.rol === "MANAGER";
        
        return (
          <div className="flex justify-end gap-2">
            <button onClick={() => openOrderDetail(row)} className="p-2 text-[var(--neutral-400)] hover:text-[var(--neutral-50)] hover:bg-[var(--bg-hover)] rounded-lg transition-all" title="Ver Detalle">
              <Eye size={16} />
            </button>
            
            {row.receptionStatus !== "RECEIVED_TOTAL" && 
             row.receptionStatus !== "CANCELLED" && 
             row.receptionStatus !== "AWAITING_APPROVAL" && (
              <button 
                onClick={() => receiveOrder(row.id)} 
                className="p-2 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded-lg transition-all" 
                title={row.receptionStatus === "RECEIVED_PARTIAL" ? "Recibir Restante" : "Confirmar Recepción"}
              >
                <Truck size={16} />
              </button>
            )}

            {row.receptionStatus === "RECEIVED_PARTIAL" && isManager && (
              <button 
                onClick={() => handleCloseShortfall(row.id)} 
                className="p-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg transition-all" 
                title="Liquidación Final (Cerrar con Faltante)"
              >
                <X size={16} />
              </button>
            )}

            {row.receptionStatus === "AWAITING_APPROVAL" && (isAdmin || isManager) && (
              <button 
                onClick={() => handleApproveOrder(row.id)} 
                className="p-2 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded-lg transition-all" 
                title="Aprobar Solicitud"
              >
                <CheckCircle size={16} />
              </button>
            )}

            {row.receptionStatus === "PENDING" && isAdmin && !row.exceptionApproved && (
              <button 
                onClick={() => {
                  if (confirm("¿Aprobar excepción de límite de crédito para esta orden?")) {
                    handleApproveException(row.id);
                  }
                }} 
                className="p-2 text-[var(--brand-400)] hover:bg-[var(--brand-400)]/10 rounded-lg transition-all" 
                title="Aprobar Excepción"
              >
                <TrendingUp size={16} />
              </button>
            )}

            {row.exceptionApproved && (
              <div className="p-2 text-[var(--color-success)]" title="Excepción Aprobada">
                <CheckCircle size={16} />
              </div>
            )}

            {row.paymentStatus === "POR_PAGAR" && row.receptionStatus !== "CANCELLED" && (
              <button 
                onClick={() => registerPayment(row.id)} 
                className="p-2 text-[var(--brand-400)] hover:bg-[var(--brand-500)]/10 rounded-lg transition-all" 
                title="Registrar Pago"
              >
                <CreditCard size={16} />
              </button>
            )}

            {(row.receptionStatus === "PENDING" || row.receptionStatus === "AWAITING_APPROVAL") && (
              <button 
                onClick={() => setResolvingOrder(row)} 
                className="p-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg transition-all" 
                title="Anular Orden"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-surface)] p-6 rounded-[1.5rem] border border-[var(--neutral-800)] shadow-sm">
        <div className="w-full md:w-64">
          <Select 
            label="Filtrar por Proveedor" 
            value={filterSupplierId} 
            onChange={setFilterSupplierId} 
            options={[{ value: "", label: "Todos los proveedores" }, ...suppliers.map(s => ({ value: String(s.id), label: s.nombre }))]} 
            icon={<Building2 size={14} />} 
            className="bg-[var(--bg-base)] border-[var(--neutral-800)]/50"
          />
        </div>
        <div className="w-full md:w-64">
          <Select 
            label="Filtrar por Producto" 
            value={filterProductId} 
            onChange={setFilterProductId} 
            options={[{ value: "", label: "Todos los productos" }, ...products.map(p => ({ value: String(p.id), label: p.nombre }))]} 
            icon={<Package size={14} />} 
            className="bg-[var(--bg-base)] border-[var(--neutral-800)]/50"
          />
        </div>
        {(filterSupplierId || filterProductId) && (
          <button onClick={() => { setFilterSupplierId(""); setFilterProductId(""); }} className="flex items-center gap-2 text-xs font-bold text-[var(--brand-400)] hover:text-[var(--brand-300)] transition-colors h-10 mt-6 px-4 rounded-xl hover:bg-[var(--brand-500)]/5">
            <X size={14} /> REINICIAR BUSQUEDA
          </button>
        )}
      </div>

      <Card title={`Kardex de Adquisiciones (${filteredOrders.length})`} className="shadow-2xl border-[var(--neutral-800)] bg-[var(--bg-card)] overflow-hidden rounded-[2rem]">
        <DataTable 
          itemsPerPage={25}
          columns={columns.map(col => ({ ...col, header: col.label }))} 
          data={filteredOrders} 
          isLoading={isLoadingOrders}
          emptyState={{
            title: "Registros no encontrados",
            description: "Ajusta los filtros o términos de búsqueda para encontrar lo que necesitas.",
            icon: <Package size={48} className="text-[var(--neutral-700)]" />
          }}
        />
      </Card>
    </div>
  );
}
