"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import type { components } from "@/api/schema";
import Spinner from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import DataTable, { Column } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { 
  ArrowRight, 
  Truck, 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Timer,
  MessageCircle
} from "lucide-react";

// Components
import NewTransferModal from "@/components/transfers/NewTransferModal";
import ReceiveTransferModal from "@/components/transfers/ReceiveTransferModal";
import DispatchTransferModal from "@/components/transfers/DispatchTransferModal";
import PrepareTransferModal from "@/components/transfers/PrepareTransferModal";
import ResolutionModal from "@/components/ui/ResolutionModal";

type TransferResponse = components["schemas"]["TransferResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

function TransfersContent() {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<TransferResponse[]>([]);
  const [branches, setBranches] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const productIdPreselected = searchParams.get("productId");
  const branchIdPreselected = searchParams.get("branchId");

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [receivingTransfer, setReceivingTransfer] = useState<TransferResponse | null>(null);
  const [dispatchingTransfer, setDispatchingTransfer] = useState<TransferResponse | null>(null);
  const [preparingTransfer, setPreparingTransfer] = useState<TransferResponse | null>(null);
  const [resolvingTransfer, setResolvingTransfer] = useState<{ t: TransferResponse; mode: "cancel" | "reject" } | null>(null);
  const [viewingReason, setViewingReason] = useState<TransferResponse | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<"all" | "resolutions" | "monitor">("all");
  const [filterOrigin, setFilterOrigin] = useState<string>("all");
  const [filterDestination, setFilterDestination] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const session = typeof window !== "undefined" ? getSession() : null;
  const router = useRouter();
  const isAdmin = session?.rol === "ADMIN";
  const isSeller = session?.rol === "SELLER";
  const myBranchId = session?.sucursalId || null;

  useEffect(() => {
    if (isSeller) {
      router.push("/sales/pos");
    }
  }, [isSeller, router]);

  const fetchTransfers = useCallback(async () => {
    try {
      const [tRes, bRes] = await Promise.all([
        apiClient.GET("/api/v1/transfers"),
        apiClient.GET("/api/branches"),
      ]);
      
      const allTransfers = tRes.data ?? [];
      // Filter for non-admins: only show where I am origin or destination
      if (!isAdmin && myBranchId) {
        setTransfers(allTransfers.filter(t => t.originBranchId === myBranchId || t.destinationBranchId === myBranchId));
      } else {
        setTransfers(allTransfers);
      }
      
      setBranches(new Map((bRes.data ?? []).map(b => [b.id!, b.nombre!])));
    } catch (err) {
      showToast("Error al cargar traslados", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, myBranchId, showToast]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    if (productIdPreselected) {
      setIsNewModalOpen(true);
    }
  }, [productIdPreselected]);

  useEffect(() => {
    if (branchIdPreselected) {
      setFilterOrigin(branchIdPreselected);
    }
  }, [branchIdPreselected]);

  const filteredTransfers = transfers.filter(t => {
    if (activeTab === "resolutions" && t.status !== "WITH_ISSUE") return false;
    if (filterOrigin !== "all" && t.originBranchId?.toString() !== filterOrigin) return false;
    if (filterDestination !== "all" && t.destinationBranchId?.toString() !== filterDestination) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const handleCancel = async (id: number, reason: string) => {
    try {
      await (apiClient as any).POST(`/api/v1/transfers/${id}/cancel`, {
        body: { reason, userId: session?.id }
      });
      showToast("Traslado cancelado correctamente", "success");
      fetchTransfers();
    } catch (err) {
      throw new Error("No se pudo cancelar el traslado. Verifique su conexión.");
    }
  };

  const handleReject = async (id: number, reason: string) => {
    try {
      await (apiClient as any).POST(`/api/v1/transfers/${id}/reject`, {
        body: { reason, userId: session?.id }
      });
      showToast("Traslado rechazado", "success");
      fetchTransfers();
    } catch (err) {
      throw new Error("No se pudo rechazar el traslado.");
    }
  };

  const handleResolve = async (id: number, type: "shrinkage" | "resend" | "claim") => {
    if (!confirm(`¿Estás seguro de resolver esta novedad como ${type}?`)) return;
    
    setProcessingId(id);
    try {
      await (apiClient as any).POST(`/api/v1/transfers/${id}/resolve-${type}`);
      showToast("Novedad resuelta", "success");
      fetchTransfers();
    } catch (err) {
      showToast("Error al resolver la novedad", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const monitorColumns: Column<TransferResponse>[] = [
    {
      header: "ID / Fecha",
      key: "id",
      width: "120px",
      render: (t) => (
        <div>
          <div style={{ fontSize: "14px", color: "var(--neutral-100)", fontWeight: 600 }}>#{t.id}</div>
          <div style={{ fontSize: "12px", color: "var(--neutral-500)" }}>{new Date(t.requestDate || "").toLocaleDateString()}</div>
        </div>
      )
    },
    {
      header: "Ruta (Origen → Destino)",
      key: "originBranchId",
      render: (t) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ minWidth: "100px" }}>
            <span style={{ fontSize: "12px", display: "block", color: "var(--neutral-500)", marginBottom: "2px" }}>De:</span>
            <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{branches.get(t.originBranchId!) || t.originBranchId}</span>
          </div>
          <ArrowRight size={12} style={{ color: "var(--neutral-600)", margin: "0 4px" }} />
          <div style={{ minWidth: "100px" }}>
            <span style={{ fontSize: "12px", display: "block", color: "var(--neutral-500)", marginBottom: "2px" }}>Para:</span>
            <span style={{ fontSize: "13px", color: "var(--neutral-100)", fontWeight: 600 }}>{branches.get(t.destinationBranchId!) || t.destinationBranchId}</span>
          </div>
        </div>
      )
    },
    {
      header: "Estado",
      key: "status",
      width: "150px",
      render: (t) => {
        const s = t.status || "PENDING";
        let variant: "neutral" | "success" | "warning" | "danger" | "info" = "neutral";
        let icon = <Clock size={12} />;
        let label = s;
        
        switch (s) {
          case "PENDING": label = "Pendiente"; break;
          case "PREPARING": variant = "info"; icon = <Timer size={12} />; label = "Preparando"; break;
          case "IN_TRANSIT": variant = "warning"; icon = <Truck size={12} />; label = "En Tránsito"; break;
          case "DELIVERED": variant = "success"; icon = <CheckCircle2 size={12} />; label = "Entregado"; break;
          case "WITH_ISSUE": variant = "danger"; icon = <AlertCircle size={12} />; label = "Con Novedad"; break;
          case "CANCELLED":
          case "REJECTED":
            variant = "danger"; icon = <XCircle size={12} />; label = s === "CANCELLED" ? "Cancelado" : "Rechazado";
            break;
        }

        return (
          <div className="flex flex-col gap-1.5">
            <Badge variant={variant} dot>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {icon}
                {label}
              </div>
            </Badge>
            {(s === "CANCELLED" || s === "REJECTED") && (t as any).reasonResolution && (
              <div className="flex items-center gap-2 mt-1">
                <p style={{ fontSize: "10px", color: "var(--neutral-500)", fontStyle: "italic", lineHeight: "1.2", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(t as any).reasonResolution}
                </p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingReason(t); }}
                  className="p-1 hover:bg-[var(--brand-500)]/10 text-[var(--brand-400)] rounded-md transition-all animate-pulse"
                  title="Leer motivo detallado"
                >
                  <MessageCircle size={12} />
                </button>
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: "Items",
      key: "details",
      render: (t) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Package size={14} style={{ color: "var(--neutral-500)" }} />
          <span style={{ fontSize: "13px", color: "var(--neutral-400)" }}>{t.details?.length} productos</span>
        </div>
      )
    }
  ];

  if (loading) return <Spinner fullPage />;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Gestión de Traslados"
        description="Solicita y gestiona el movimiento de mercancía entre las sucursales de la red."
      />

      <div style={{ 
        display: "flex", 
        flexDirection: "row", 
        flexWrap: "wrap",
        justifyContent: "space-between", 
        alignItems: "flex-end", 
        marginBottom: "32px", 
        gap: "24px" 
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Button variant="primary" onClick={() => setIsNewModalOpen(true)}>
            + Nueva Solicitud
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "24px", borderBottom: "1px solid var(--border-default)" }}>
        <button 
          onClick={() => setActiveTab("all")}
          style={{ 
            padding: "12px 20px", 
            background: "none", 
            border: "none", 
            color: activeTab === "all" ? "var(--brand-500)" : "var(--neutral-400)",
            borderBottom: activeTab === "all" ? "2px solid var(--brand-500)" : "none",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Panel General
        </button>
        <button 
          onClick={() => setActiveTab("resolutions")}
          style={{ 
            padding: "12px 20px", 
            background: "none", 
            border: "none", 
            color: activeTab === "resolutions" ? "var(--brand-500)" : "var(--neutral-400)",
            borderBottom: activeTab === "resolutions" ? "2px solid var(--brand-500)" : "none",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          Centro de Resoluciones
          {transfers.filter(t => t.status === "WITH_ISSUE").length > 0 && (
            <span style={{ background: "var(--color-danger)", color: "white", borderRadius: "10px", padding: "2px 8px", fontSize: "10px" }}>
              {transfers.filter(t => t.status === "WITH_ISSUE").length}
            </span>
          )}
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab("monitor")}
            style={{ 
              padding: "12px 20px", 
              background: "none", 
              border: "none", 
              color: activeTab === "monitor" ? "var(--brand-500)" : "var(--neutral-400)",
              borderBottom: activeTab === "monitor" ? "2px solid var(--brand-500)" : "none",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            Monitor Logístico
          </button>
        )}
      </div>

      {activeTab === "monitor" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", gap: "16px" }}>
            <Card style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px", marginBottom: "0px", minWidth: "220px" }}>
              <div style={{ padding: "10px", borderRadius: "10px", background: "var(--brand-900)", color: "var(--brand-400)" }}>
                <Truck size={24} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Traslados Activos</span>
                <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--brand-500)" }}>{transfers.filter(t => !["DELIVERED", "CANCELLED", "REJECTED"].includes(t.status || "")).length}</span>
              </div>
            </Card>

            {transfers.filter(t => t.status === "WITH_ISSUE").length > 0 && (
              <Card style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px", marginBottom: "0px", minWidth: "220px", border: "1px solid rgba(217,99,79,0.3)" }}>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(217,99,79,0.1)", color: "var(--brand-500)" }}>
                  <AlertCircle size={24} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Con Novedades</span>
                  <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--brand-500)" }}>{transfers.filter(t => t.status === "WITH_ISSUE").length}</span>
                </div>
              </Card>
            )}
          </div>

          <Card style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <DataTable<TransferResponse>
              columns={monitorColumns}
              data={transfers}
              isLoading={loading}
              emptyState={{
                title: "Sin actividad logística",
                description: "No hay traslados registrados en el sistema.",
                icon: <ArrowRight size={40} />
              }}
            />
          </Card>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <Select
              label="Sede Origen"
              value={filterOrigin}
              onChange={(val) => setFilterOrigin(val)}
              options={[
                { value: "all", label: "Todas las sedes" },
                ...Array.from(branches.entries()).map(([id, name]) => ({ value: id.toString(), label: name }))
              ]}
            />
            <Select
              label="Sede Destino"
              value={filterDestination}
              onChange={(val) => setFilterDestination(val)}
              options={[
                { value: "all", label: "Todas las sedes" },
                ...Array.from(branches.entries()).map(([id, name]) => ({ value: id.toString(), label: name }))
              ]}
            />
            <Select
              label="Estado"
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: "all", label: "Cualquier estado" },
                { value: "PENDING", label: "Pendiente" },
                { value: "PREPARING", label: "Preparando" },
                { value: "IN_TRANSIT", label: "En Tránsito" },
                { value: "DELIVERED", label: "Completado" },
                { value: "WITH_ISSUE", label: "Con Novedad" },
                { value: "CANCELLED", label: "Cancelado" },
                { value: "REJECTED", label: "Rechazado" },
              ]}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {filteredTransfers.length === 0 ? (
              <EmptyState
                title="Sin resultados"
                description="No se encontraron traslados con los filtros seleccionados."
                icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>}
              />
            ) : (
              filteredTransfers.map((t) => (
                <Card key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "24px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Ruta</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                        <span>{branches.get(t.originBranchId!) || t.originBranchId}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        <span>{branches.get(t.destinationBranchId!) || t.destinationBranchId}</span>
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Estado</p>
                      <Badge variant={t.status === "DELIVERED" ? "success" : t.status === "IN_TRANSIT" ? "warning" : t.status === "WITH_ISSUE" ? "danger" : t.status === "CANCELLED" || t.status === "REJECTED" ? "neutral" : "neutral"}>
                        {t.status === "PENDING" ? "Pendiente" : t.status === "PREPARING" ? "Preparando" : t.status === "IN_TRANSIT" ? "En Tránsito" : t.status === "DELIVERED" ? "Entregado" : t.status === "WITH_ISSUE" ? "Con Novedad" : t.status === "CANCELLED" ? "Cancelado" : t.status === "REJECTED" ? "Rechazado" : (t.status || "")}
                      </Badge>
                    </div>

                    {(t.status === "CANCELLED" || t.status === "REJECTED") && (t as any).reasonResolution && (
                      <div style={{ maxWidth: "250px" }}>
                        <p style={{ fontSize: "11px", color: "var(--color-danger)", textTransform: "uppercase", marginBottom: "4px" }}>Motivo de {(t.status === "CANCELLED" ? "Cancelación" : "Rechazo")}</p>
                        <p style={{ fontSize: "13px", fontStyle: "italic", color: "var(--neutral-300)" }}>{(t as any).reasonResolution}</p>
                      </div>
                    )}

                    <div>
                      <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Items</p>
                      <p style={{ fontSize: "14px" }}>{t.details?.length} productos</p>
                    </div>

                    <div>
                      <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Creado</p>
                      <p style={{ fontSize: "14px" }}>{new Date(t.requestDate!).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    {t.status === "PENDING" && (isAdmin || t.originBranchId === myBranchId) && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => setPreparingTransfer(t)}>Preparar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setResolvingTransfer({ t, mode: "cancel" })} loading={processingId === t.id}>Cancelar</Button>
                      </>
                    )}
                    {t.status === "PENDING" && (isAdmin || t.destinationBranchId === myBranchId) && (
                      <Button variant="ghost" size="sm" onClick={() => setResolvingTransfer({ t, mode: "reject" })} loading={processingId === t.id} style={{ color: "var(--error-500)" }}>Rechazar</Button>
                    )}
                    {t.status === "PREPARING" && (isAdmin || t.originBranchId === myBranchId) && (
                      <Button variant="primary" size="sm" onClick={() => setDispatchingTransfer(t)}>Despachar</Button>
                    )}
                    {t.status === "IN_TRANSIT" && (isAdmin || t.destinationBranchId === myBranchId) && (
                      <Button variant="primary" size="sm" onClick={() => setReceivingTransfer(t)}>Recibir</Button>
                    )}
                    {t.status === "WITH_ISSUE" && isAdmin && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "shrinkage")}>Marcar Merma</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "resend")}>Reenviar Faltante</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "claim")}>Iniciar Reclamación</Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <NewTransferModal 
        open={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSuccess={fetchTransfers}
        currentBranchId={myBranchId} isAdmin={isAdmin} initialProductId={productIdPreselected}
      />
      <ReceiveTransferModal
        open={!!receivingTransfer} onClose={() => setReceivingTransfer(null)} onSuccess={fetchTransfers}
        transfer={receivingTransfer} userId={session?.id || null}
      />
      <DispatchTransferModal
        open={!!dispatchingTransfer} onClose={() => setDispatchingTransfer(null)} onSuccess={fetchTransfers}
        transfer={dispatchingTransfer} userId={session?.id || null}
      />
      <PrepareTransferModal
        open={!!preparingTransfer} onClose={() => setPreparingTransfer(null)} onSuccess={fetchTransfers}
        transfer={preparingTransfer}
      />
      <ResolutionModal
        open={!!resolvingTransfer} onClose={() => setResolvingTransfer(null)}
        title={resolvingTransfer?.mode === "cancel" ? "Cancelar Traslado" : "Rechazar Traslado"}
        confirmLabel={resolvingTransfer?.mode === "cancel" ? "Confirmar Cancelación" : "Confirmar Rechazo"}
        onConfirm={async (reason) => {
          if (!resolvingTransfer) return;
          if (resolvingTransfer.mode === "cancel") await handleCancel(resolvingTransfer.t.id!, reason);
          else await handleReject(resolvingTransfer.t.id!, reason);
        }}
      />
      <Modal
        open={!!viewingReason} onClose={() => setViewingReason(null)}
        title={viewingReason?.status === "CANCELLED" ? "Motivo de Cancelación" : "Motivo de Rechazo"}
      >
        <div style={{ padding: "8px 0" }}>
          <div style={{ background: "rgba(var(--brand-500-rgb), 0.05)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-default)", marginBottom: "20px" }}>
            <p style={{ fontSize: "15px", lineHeight: "1.6", color: "var(--neutral-200)", fontStyle: "italic" }}>
              "{ (viewingReason as any)?.reasonResolution }"
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ color: "var(--neutral-500)" }}>Traslado ID:</span>
            <span style={{ color: "var(--neutral-300)", fontWeight: 600 }}>#{viewingReason?.id}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function TransfersManagementPage() {
  return (
    <Suspense fallback={<Spinner fullPage />}>
      <TransfersContent />
    </Suspense>
  );
}
