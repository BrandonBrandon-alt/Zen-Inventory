"use client";

import React, { useEffect, useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { apiClient } from "@/api/client";
import { useToast } from "@/context/ToastContext";
import { getSession } from "@/api/auth";
import { 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  MessageSquare,
  Package,
  Info,
  Lock
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toolbar from "@/components/ui/Toolbar";
import SearchFilter from "@/components/ui/SearchFilter";

import PageHeader from "@/components/ui/PageHeader";

export default function ReturnsPage() {
  const { showToast } = useToast();
  const session = typeof window !== "undefined" ? getSession() : null;
  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isApprover = isAdmin || isManager;
  
  const [requests, setRequests] = useState<any[]>([]);
  const [branchesMap, setBranchesMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Selection for resolution
  const [resolvingRequest, setResolvingRequest] = useState<any>(null);
  const [resolutionComment, setResolutionComment] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // ADMIN fetches all returns and also branches for mapping
        const [returnsRes, branchesRes]: any = await Promise.all([
          apiClient.GET("/api/v1/returns" as any, {}),
          apiClient.GET("/api/branches")
        ]);
        
        setRequests(returnsRes.data || []);
        if (branchesRes.data) {
          const bMap = new Map<number, string>(branchesRes.data.map((b: any) => [b.id as number, b.nombre as string]));
          setBranchesMap(bMap);
        }
      } else {
        // Others only fetch their branch
        if (!session?.sucursalId) return;
        const data: any = await apiClient.GET(`/api/v1/returns/branch/{branchId}` as any, {
          params: {
              path: { branchId: session.sucursalId }
          }
        });
        setRequests(data.data || []);
      }
    } catch (err) {
      showToast("Error al cargar las solicitudes de devolución.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [session?.sucursalId]);

  const handleResolve = async (id: number, approved: boolean) => {
    if (!resolutionComment.trim()) {
      showToast("Debes proporcionar un comentario o motivo.", "error");
      return;
    }

    setProcessing(true);
    try {
      const endpoint = approved ? `/api/v1/returns/{id}/approve` : `/api/v1/returns/{id}/reject`;
      const paramName = approved ? "comment" : "reason";
      
      await apiClient.POST(endpoint as any, {
        params: {
            path: { id },
            query: { [paramName]: resolutionComment }
        }
      } as any);

      showToast(approved ? "Devolución aprobada y stock actualizado." : "Devolución rechazada.", "success");
      setResolvingRequest(null);
      setResolutionComment("");
      fetchRequests();
    } catch (err: any) {
      showToast(err.message || "Error al procesar la solicitud.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return requests;
    const lowerSearch = searchTerm.toLowerCase();
    
    return requests.filter(r => {
      const idMatch = r.id?.toString().toLowerCase().includes(lowerSearch) || `ref-${r.id}`.toLowerCase().includes(lowerSearch);
      const saleMatch = r.saleId?.toString().toLowerCase().includes(lowerSearch);
      const reasonMatch = r.motivoGeneral?.toLowerCase().includes(lowerSearch);
      const statusMatch = r.estado?.toLowerCase().includes(lowerSearch);
      const itemMatch = r.items?.some((it: any) => 
        it.productoId?.toString().toLowerCase().includes(lowerSearch)
      );
      
      return idMatch || saleMatch || reasonMatch || statusMatch || itemMatch;
    });
  }, [requests, searchTerm]);

  const columns: Column<any>[] = [
    {
      header: "Solicitud",
      key: "id",
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-[var(--neutral-50)] uppercase">REF-{r.id}</span>
          <span className="text-[10px] font-bold text-[var(--brand-400)] uppercase tracking-widest">Venta #{r.saleId}</span>
        </div>
      )
    },
    {
      header: "Fecha",
      key: "fechaSolicitud",
      render: (r) => (
        <div className="flex items-center gap-2 text-[var(--neutral-400)]">
          <Calendar size={12} />
          <span className="text-[12px] font-medium">{new Date(r.fechaSolicitud).toLocaleDateString()}</span>
        </div>
      )
    },
    {
      header: "Motivo y Productos",
      key: "motivoGeneral",
      render: (r) => (
        <div className="flex flex-col gap-1 max-w-md">
          <p className="text-[13px] font-bold text-[var(--neutral-300)] truncate">{r.motivoGeneral}</p>
          <div className="flex gap-2 flex-wrap">
            {r.items.map((it: any, idx: number) => (
              <span key={idx} className="bg-[var(--bg-surface)] px-2 py-0.5 rounded-md text-[10px] border border-[var(--neutral-800)] text-[var(--neutral-500)]">
                {it.cantidad}x Prod#{it.productoId}
              </span>
            ))}
          </div>
        </div>
      )
    },
    ...(isAdmin ? [{
      header: "Sede",
      key: "sucursalId",
      render: (r: any) => (
        <Badge variant="neutral">
          {branchesMap.get(Number(r.sucursalId)) || `ID: ${r.sucursalId}`}
        </Badge>
      )
    }] : []),
    {
      header: "Estado",
      key: "estado",
      render: (r) => {
        if (r.estado === 'PENDIENTE') return <Badge variant="warning" dot>Pendiente</Badge>;
        if (r.estado === 'APROBADA') return <Badge variant="success" dot>Aprobada</Badge>;
        return <Badge variant="danger" dot>Rechazada</Badge>;
      }
    },
    {
      header: "Acción",
      key: "actions",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
           {isApprover && r.estado === 'PENDIENTE' ? (
             <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setResolvingRequest(r)}
                leftIcon={<RotateCcw size={14} />}
             >
                Resolver
             </Button>
           ) : (
             <div className="text-[var(--neutral-600)] italic text-[11px]">Cerrado</div>
           )}
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }} className="animate-fade-in">
      <PageHeader 
        title="Gestión de Devoluciones" 
        description="Control jerárquico de retornos y ajustes de inventario por sede."
      />

      <div className="w-full">
        <Toolbar
          className="mb-16"
          left={
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] flex items-center gap-3">
                 <Info size={14} className="text-[var(--brand-400)]" />
                 <span className="text-[11px] font-bold text-[var(--neutral-400)] uppercase tracking-wider">
                   Sucursal: {isAdmin ? 'Todas' : (session?.sucursalId || '—')}
                 </span>
              </div>
              
              {!isApprover && (
                <div className="px-4 py-2 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 flex items-center gap-2">
                  <Lock size={12} className="text-[var(--color-danger)]" />
                  <span className="text-[11px] text-[var(--color-danger)] font-black uppercase tracking-widest leading-none">Solo Lectura</span>
                </div>
              )}
            </div>
          }
        >
          <SearchFilter 
            placeholder="Buscar por REF, venta, motivo o producto..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </Toolbar>

      <div className="grid grid-cols-1 gap-6">
        <Card>
            <div className="overflow-x-auto">
                <DataTable 
                    columns={columns}
                    data={filteredRequests}
                    isLoading={loading}
                    emptyState={{
                        title: "Sin devoluciones",
                        description: searchTerm ? "No se encontraron resultados para tu búsqueda." : "No se han registrado solicitudes de devolución recientemente.",
                        icon: <RotateCcw size={48} className="opacity-10" />
                    }}
                />
            </div>
        </Card>
      </div>
      </div>

      {/* RESOLUTION MODAL */}
      <Modal
        open={!!resolvingRequest}
        onClose={() => setResolvingRequest(null)}
        title={`Resolución de Devolución #${resolvingRequest?.id}`}
        description="Evalúe la solicitud y confirme el reingreso a stock."
        size="lg"
      >
        <div className="flex flex-col gap-5">
          {/* Summary Box with Depth */}
          <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--neutral-800)] shadow-inner">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
                <span className="text-[11px] font-black text-[var(--neutral-400)] uppercase tracking-widest">Resumen de Operación</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase">Venta Originaria</span>
                   <span className="text-[14px] font-black text-[var(--neutral-50)]">ORD-{resolvingRequest?.saleId}</span>
                </div>
                <div className="flex flex-col gap-1 items-end">
                   <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase">Solicitante</span>
                   <span className="text-[14px] font-black text-[var(--neutral-50)] text-right">User #{resolvingRequest?.solicitanteId}</span>
                </div>
             </div>
             <div className="mt-6 pt-5 border-t border-[var(--neutral-800)]">
                <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase block mb-3">Items en proceso de retorno</span>
                <div className="space-y-2">
                   {resolvingRequest?.items.map((it: any, idx: number) => (
                     <div key={idx} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                           <div className="p-1.5 bg-[var(--brand-500)]/10 rounded-lg">
                              <Package size={14} className="text-[var(--brand-400)]" />
                           </div>
                           <span className="font-bold text-[13px] text-[var(--neutral-200)]">Producto #{it.productoId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-[var(--neutral-500)] font-bold uppercase">Cant:</span>
                           <span className="text-[15px] font-black text-[var(--brand-400)] tabular">x{it.cantidad}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-2">
                <MessageSquare className="text-[var(--brand-400)]" size={14} />
                <span className="text-[11px] font-black text-[var(--neutral-400)] uppercase tracking-widest">Sustentación del Seller</span>
             </div>
             <div className="bg-[var(--bg-surface)] p-4 rounded-3xl border border-[var(--neutral-800)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[var(--brand-500)]/30" />
                <p className="text-[13px] text-[var(--neutral-200)] font-medium italic pl-2 leading-relaxed">
                   "{resolvingRequest?.motivoGeneral}"
                </p>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[11px] font-black text-[var(--neutral-500)] uppercase tracking-widest block ml-1">Comentario de Resolución</label>
             <textarea 
                className="w-full bg-[var(--bg-base)] border border-[var(--neutral-800)] rounded-3xl p-5 text-[14px] font-medium text-[var(--neutral-50)] outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)]/20 transition-all min-h-[120px] shadow-sm font-sans"
                placeholder="Explique por qué aprueba o rechaza esta devolución..."
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
             />
          </div>

          <div className="bg-[var(--color-warning)]/5 p-4 rounded-3xl border border-[var(--color-warning)]/20 flex gap-4 items-center mb-2">
             <div className="p-2 bg-[var(--color-warning)]/10 rounded-2xl">
                <Clock className="text-[var(--color-warning)]" size={20} />
             </div>
             <p className="text-[12px] text-[var(--neutral-400)] font-medium leading-relaxed">
                <strong className="text-[var(--color-warning)]">Aviso de Stock:</strong> Al aprobar, las cantidades retornarán de inmediato al inventario disponible de la sede.
             </p>
          </div>

          <div className="flex gap-3 pt-2">
             <Button 
                variant="ghost" 
                fullWidth 
                onClick={() => handleResolve(resolvingRequest.id, false)}
                loading={processing}
                leftIcon={<XCircle size={18} />}
                className="!py-6 rounded-3xl !border-[var(--neutral-800)] hover:!bg-[var(--color-danger)]/5 hover:!text-[var(--color-danger)]"
             >
                Rechazar
             </Button>
             <Button 
                variant="primary" 
                fullWidth 
                onClick={() => handleResolve(resolvingRequest.id, true)}
                loading={processing}
                leftIcon={<CheckCircle size={18} />}
                className="!py-6 rounded-3xl shadow-[0_10px_30px_rgba(var(--brand-rgb),0.3)]"
             >
                Aprobar Solicitud
             </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
