"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/context/ToastContext";

// Components
import NewTransferModal from "@/components/transfers/NewTransferModal";
import ReceiveTransferModal from "@/components/transfers/ReceiveTransferModal";
import DispatchTransferModal from "@/components/transfers/DispatchTransferModal";
import PrepareTransferModal from "@/components/transfers/PrepareTransferModal";

type TransferResponse = components["schemas"]["TransferResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

export default function TransfersManagementPage() {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<TransferResponse[]>([]);
  const [branches, setBranches] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [receivingTransfer, setReceivingTransfer] = useState<TransferResponse | null>(null);
  const [dispatchingTransfer, setDispatchingTransfer] = useState<TransferResponse | null>(null);
  const [preparingTransfer, setPreparingTransfer] = useState<TransferResponse | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<"all" | "resolutions">("all");
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

  const filteredTransfers = transfers.filter(t => {
    if (activeTab === "resolutions" && t.status !== "WITH_ISSUE") return false;
    if (filterOrigin !== "all" && t.originBranchId?.toString() !== filterOrigin) return false;
    if (filterDestination !== "all" && t.destinationBranchId?.toString() !== filterDestination) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const handleCancel = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas cancelar este traslado?")) return;
    
    setProcessingId(id);
    try {
      await (apiClient as any).POST("/api/v1/transfers/{id}/cancel", {
        params: { path: { id } }
      });
      showToast("Traslado cancelado", "success");
      fetchTransfers();
    } catch (err) {
      showToast("Error al cancelar el traslado", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolve = async (id: number, type: "shrinkage" | "resend" | "claim") => {
    if (!confirm(`¿Estás seguro de resolver esta novedad como ${type}?`)) return;
    
    setProcessingId(id);
    try {
      await (apiClient as any).POST(`/api/v1/transfers/{id}/resolve-${type}`, {
        params: { path: { id } }
      });
      showToast("Novedad resuelta", "success");
      fetchTransfers();
    } catch (err) {
      showToast("Error al resolver la novedad", "error");
    } finally {
      setProcessingId(null);
    }
  };


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
      </div>

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
                  <Badge variant={t.status === "DELIVERED" ? "success" : t.status === "IN_TRANSIT" ? "warning" : t.status === "WITH_ISSUE" ? "danger" : t.status === "CANCELLED" ? "neutral" : "neutral"}>
                    {t.status === "PENDING" ? "Pendiente" : t.status === "PREPARING" ? "Preparando" : t.status === "IN_TRANSIT" ? "En Tránsito" : t.status === "DELIVERED" ? "Entregado" : t.status === "WITH_ISSUE" ? "Con Novedad" : t.status === "CANCELLED" ? "Cancelado" : t.status}
                  </Badge>
                </div>

                <div>
                  <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Items</p>
                  <p style={{ fontSize: "14px" }}>{t.details?.length} productos</p>
                </div>

                <div>
                  <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Creado</p>
                  <p style={{ fontSize: "14px" }}>{new Date(t.requestDate!).toLocaleDateString()}</p>
                </div>

                {(t as any).carrier && (
                  <div>
                    <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Transportista</p>
                    <p style={{ fontSize: "14px" }}>{(t as any).carrier}</p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {/* ACTIONS */}
                {t.status === "PENDING" && (isAdmin || t.originBranchId === myBranchId) && (
                  <>
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => setPreparingTransfer(t)}
                    >
                      Preparar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleCancel(t.id!)}
                      loading={processingId === t.id}
                    >
                      Cancelar
                    </Button>
                  </>
                )}

                {t.status === "PREPARING" && (isAdmin || t.originBranchId === myBranchId) && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => setDispatchingTransfer(t)}
                  >
                    Despachar
                  </Button>
                )}

                {t.status === "IN_TRANSIT" && (isAdmin || t.destinationBranchId === myBranchId) && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => setReceivingTransfer(t)}
                  >
                    Recibir
                  </Button>
                )}

                {t.status === "WITH_ISSUE" && isAdmin && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "shrinkage")}>Marcar Merma</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "resend")}>Reenviar Faltante</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "claim")}>Iniciar Reclamación</Button>
                  </div>
                )}

                {t.status === "DELIVERED" && (
                  <span style={{ fontSize: "12px", color: "var(--color-success)", fontWeight: 600 }}>Completado</span>
                )}

                {t.status === "UNDER_CLAIM" && (
                  <span style={{ fontSize: "12px", color: "var(--brand-500)", fontWeight: 600 }}>En Reclamación</span>
                )}

                {t.status === "CANCELLED" && (
                  <span style={{ fontSize: "12px", color: "var(--neutral-500)", fontWeight: 600 }}>Cancelado</span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      <NewTransferModal 
        open={isNewModalOpen} 
        onClose={() => setIsNewModalOpen(false)} 
        onSuccess={fetchTransfers}
        currentBranchId={myBranchId}
        isAdmin={isAdmin}
      />

      <ReceiveTransferModal
        open={!!receivingTransfer}
        onClose={() => setReceivingTransfer(null)}
        onSuccess={fetchTransfers}
        transfer={receivingTransfer}
        userId={session?.id || null}
      />

      <DispatchTransferModal
        open={!!dispatchingTransfer}
        onClose={() => setDispatchingTransfer(null)}
        onSuccess={fetchTransfers}
        transfer={dispatchingTransfer}
        userId={session?.id || null}
      />

      <PrepareTransferModal
        open={!!preparingTransfer}
        onClose={() => setPreparingTransfer(null)}
        onSuccess={fetchTransfers}
        transfer={preparingTransfer}
      />
    </div>
  );
}
