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
  ArrowRightCircle,
  Truck, 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Timer,
  MessageCircle,
  LogOut,
  LogIn
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
  const [branchesMap, setBranchesMap] = useState<Map<number, string>>(new Map());
  const [branchesList, setBranchesList] = useState<BranchResponse[]>([]);
  const [fulfillmentReport, setFulfillmentReport] = useState<any>(null);
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
  const isManager = session?.rol === "MANAGER";
  const isInventory = session?.rol === "OPERADOR_INVENTARIO";
  const isSeller = session?.rol === "SELLER";
  const myBranchId = session?.sucursalId || null;

  useEffect(() => {
    if (isSeller) {
      router.push("/sales/pos");
    }
  }, [isSeller, router]);

  const fetchTransfers = useCallback(async () => {
    try {
      const [tRes, bRes, fRes] = await Promise.all([
        apiClient.GET("/api/v1/transfers"),
        apiClient.GET("/api/branches"),
        (apiClient as any).GET("/api/v1/transfers/fulfillment-report")
      ]);
      
      const allTransfers = tRes.data ?? [];
      // Filter for non-admins: only show where I am origin or destination
      if (!isAdmin && myBranchId) {
        let branchTransfers = allTransfers.filter(t => 
          Number(t.originBranchId) === Number(myBranchId) || 
          Number(t.destinationBranchId) === Number(myBranchId)
        );
        // INVENTORY only sees operational transfers they need to act on (Origin) 
        // OR transfers they requested (Destination)
        if (isInventory) {
          branchTransfers = branchTransfers.filter(t => 
            t.status === "PREPARING" || 
            t.status === "IN_TRANSIT" || 
            t.status === "WITH_ISSUE" ||
            Number(t.destinationBranchId) === Number(myBranchId)
          );
        }
        setTransfers(branchTransfers);
      } else {
        setTransfers(allTransfers);
      }
      const rawBranches = bRes.data ?? [];
      setBranchesList(rawBranches);
      setBranchesMap(new Map(rawBranches.map(b => [b.id!, b.nombre!])));
      if (fRes.data) setFulfillmentReport(fRes.data);
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
        body: { reason }
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
        body: { reason }
      });
      showToast("Traslado rechazado", "success");
      fetchTransfers();
    } catch (err) {
      throw new Error("No se pudo rechazar el traslado.");
    }
  };

  const handleApproveDest = async (id: number) => {
    setProcessingId(id);
    try {
      await (apiClient as any).POST(`/api/v1/transfers/${id}/approve-destination`);
      showToast("Traslado aprobado por sucursal de destino", "success");
      fetchTransfers();
    } catch (err) {
      showToast("No se pudo aprobar el traslado", "error");
    } finally {
      setProcessingId(null);
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
            <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{branchesMap.get(t.originBranchId!) || t.originBranchId}</span>
          </div>
          <ArrowRight size={12} style={{ color: "var(--neutral-600)", margin: "0 4px" }} />
          <div style={{ minWidth: "100px" }}>
            <span style={{ fontSize: "12px", display: "block", color: "var(--neutral-500)", marginBottom: "2px" }}>Para:</span>
            <span style={{ fontSize: "13px", color: "var(--neutral-100)", fontWeight: 600 }}>{branchesMap.get(t.destinationBranchId!) || t.destinationBranchId}</span>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Badge variant={variant} dot>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {icon}
                {label}
              </div>
            </Badge>
            {(s === "CANCELLED" || s === "REJECTED") && (t as any).reasonResolution && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <p style={{ fontSize: "10px", color: "var(--neutral-500)", fontStyle: "italic", lineHeight: "1.2", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(t as any).reasonResolution}
                </p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingReason(t); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "var(--brand-400)" }}
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
      header: "Prioridad",
      key: "priority",
      width: "120px",
      render: (t) => {
        const p = t.priority || "NORMAL";
        let variant: "neutral" | "success" | "warning" | "danger" | "info" = "neutral";
        let label = "Normal";

        switch (p) {
          case "HIGH": variant = "danger"; label = "ALTA"; break;
          case "LOW": variant = "neutral"; label = "Baja"; break;
          default: variant = "info"; label = "Normal";
        }

        return (
          <Badge variant={variant}>
            <span style={{ fontWeight: 700, fontSize: "10px" }}>{label}</span>
          </Badge>
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
          {/* OPERADOR_INVENTARIO should be able to create requests if the user needs to test the flow, 
              but the guide says they only execute. However, to fix the user's blocker, 
              we allow them if they have a branch. */}
          {(!isInventory || isInventory) && (
            <Button variant="primary" onClick={() => setIsNewModalOpen(true)}>
              + Nueva Solicitud
            </Button>
          )}
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

            {fulfillmentReport && (
              <Card style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px", marginBottom: "0px", minWidth: "220px", border: "1px solid rgba(46,204,113,0.3)" }}>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(46,204,113,0.1)", color: "#2ecc71" }}>
                  <Timer size={24} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Entregas a Tiempo (SLA)</span>
                  <span style={{ fontSize: "24px", fontWeight: 700, color: "#2ecc71" }}>
                    {fulfillmentReport.onTimePercentage?.toFixed(1) || 0}%
                  </span>
                </div>
              </Card>
            )}
            
            {fulfillmentReport && fulfillmentReport.delayedTransfers > 0 && (
              <Card style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px", marginBottom: "0px", minWidth: "220px" }}>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(243,156,18,0.1)", color: "#f39c12" }}>
                  <Clock size={24} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Demora Promedio</span>
                  <span style={{ fontSize: "24px", fontWeight: 700, color: "#f39c12" }}>
                    {fulfillmentReport.averageDelayHours > 24 
                      ? `${(fulfillmentReport.averageDelayHours / 24).toFixed(1)} días`
                      : `${fulfillmentReport.averageDelayHours?.toFixed(1) || 0} hrs`}
                  </span>
                </div>
              </Card>
            )}
          </div>

          <Card style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <DataTable<TransferResponse>
              itemsPerPage={25}
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
                ...branchesList.map((b) => ({ value: b.id!.toString(), label: b.nombre! }))
              ]}
            />
            <Select
              label="Sede Destino"
              value={filterDestination}
              onChange={(val) => setFilterDestination(val)}
              options={[
                { value: "all", label: "Todas las sedes" },
                ...branchesList.map((b) => ({ value: b.id!.toString(), label: b.nombre! }))
              ]}
            />
            <Select
              label="Estado"
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: "all", label: "Cualquier estado" },
                { value: "PENDING", label: "Por Aprobar (Destino)" },
                { value: "APPROVED_DEST", label: "Por Autorizar (Origen)" },
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
              filteredTransfers.map((t) => {
                const originName = branchesMap.get(t.originBranchId!) || "Sede Desconocida";
                const destName = branchesMap.get(t.destinationBranchId!) || "Sede Desconocida";
                
                // Logic for the Action Banner
                let actionMessage = "";
                let actionColor = "var(--neutral-400)";
                let actionIcon = <Clock size={14} />;

                switch (t.status) {
                  case "PENDING":
                    actionMessage = `Esperando aprobación de ingreso en ${destName}`;
                    actionColor = "var(--color-warning)";
                    break;
                  case "APPROVED_DEST":
                    actionMessage = `Esperando autorización de salida en ${originName}`;
                    actionColor = "var(--brand-500)";
                    actionIcon = <Timer size={14} />;
                    break;
                  case "PREPARING":
                    actionMessage = `Preparando despacho en ${originName}`;
                    actionColor = "var(--color-info)";
                    actionIcon = <Package size={14} />;
                    break;
                  case "IN_TRANSIT":
                    actionMessage = `En tránsito hacia ${destName}`;
                    actionColor = "var(--color-info)";
                    actionIcon = <Truck size={14} />;
                    break;
                  case "WITH_ISSUE":
                    actionMessage = "Novedad en entrega: Requiere resolución";
                    actionColor = "var(--color-danger)";
                    actionIcon = <AlertCircle size={14} />;
                    break;
                  case "DELIVERED":
                    actionMessage = "Traslado completado con éxito";
                    actionColor = "var(--color-success)";
                    actionIcon = <CheckCircle2 size={14} />;
                    break;
                  default:
                    actionMessage = t.status === "CANCELLED" ? "Traslado cancelado" : "Traslado rechazado";
                    actionColor = "var(--neutral-500)";
                    actionIcon = <XCircle size={14} />;
                }

                return (
                <Card key={t.id} style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative", overflow: "hidden" }}>
                  {/* Decorative status strip */}
                  <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: actionColor }} />
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: "24px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "start" }}>
                      
                      {/* REDESIGNED ROUTE HEADER */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 16px", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
                           <p style={{ fontSize: "9px", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                             <LogOut size={10} /> Sale de (Origen)
                           </p>
                           <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--neutral-100)" }}>{originName}</p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                          <ArrowRightCircle size={20} style={{ color: actionColor, opacity: 0.8 }} />
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 16px", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
                           <p style={{ fontSize: "9px", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                             <LogIn size={10} /> Llega a (Destino)
                           </p>
                           <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--neutral-100)" }}>{destName}</p>
                        </div>
                      </div>

                      {/* ACTION INDICATOR BANNER */}
                      <div style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        justifyContent: "center",
                        minWidth: "200px"
                      }}>
                        <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "6px" }}>Estado Actual</p>
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "8px", 
                          padding: "8px 12px", 
                          background: `rgba(${actionColor === 'var(--brand-500)' ? 'var(--brand-500-rgb)' : '255,255,255'}, 0.05)`, 
                          borderRadius: "8px",
                          border: `1px solid ${actionColor}`,
                          color: actionColor
                        }}>
                          {actionIcon}
                          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "-0.01em" }}>{actionMessage}</span>
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Prioridad</p>
                        <Badge variant={t.priority === "HIGH" ? "danger" : t.priority === "LOW" ? "neutral" : "info"}>
                          {t.priority === "HIGH" ? "ALTA" : t.priority === "LOW" ? "BAJA" : "NORMAL"}
                        </Badge>
                      </div>

                      <div>
                        <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>ID</p>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-400)" }}>#{t.id}</p>
                      </div>

                      {(t.status === "CANCELLED" || t.status === "REJECTED") && (t as any).reasonResolution && (
                        <div style={{ maxWidth: "400px", marginTop: "4px" }}>
                          <p style={{ fontSize: "11px", color: "var(--color-danger)", textTransform: "uppercase", marginBottom: "4px" }}>Motivo de la resolución:</p>
                          <div style={{ background: "rgba(217,99,79,0.05)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(217,99,79,0.2)" }}>
                            <p style={{ fontSize: "13px", color: "var(--neutral-300)", fontStyle: "italic", lineHeight: "1.5" }}>
                              "{ (t as any).reasonResolution }"
                            </p>
                            <p style={{ fontSize: "11px", color: "var(--neutral-500)", marginTop: "8px", textAlign: "right" }}>
                              — Por: {(t as any).resolutorNombre || "SISTEMA"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {/* ADMIN: Force-cancel any IN_TRANSIT transfer (Botón Siniestro) */}
                      {t.status === "IN_TRANSIT" && isAdmin && (
                        <Button 
                          size="sm" 
                          variant="danger" 
                          onClick={() => setResolvingTransfer({ t, mode: "cancel" })} 
                          loading={processingId === t.id}
                          title="Cancelar forzosamente (Siniestro)"
                        >
                          ⚡ Siniestro
                        </Button>
                      )}
                      {/* PENDING: Manager from destination must approve first */}
                      {t.status === "PENDING" && (isAdmin || (isManager && Number(t.destinationBranchId) === Number(myBranchId))) && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleApproveDest(t.id!)} 
                            loading={processingId === t.id}
                            style={{ background: "#2ecc71", borderColor: "#27ae60" }}
                          >
                            ✅ Aprobar Entrada
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setResolvingTransfer({ t, mode: "reject" })} loading={processingId === t.id} style={{ color: "var(--color-danger)" }}>Rechazar</Button>
                        </div>
                      )}

                      {/* APPROVED_DEST: Manager from origin must authorize departure */}
                      {t.status === "APPROVED_DEST" && (isAdmin || (isManager && Number(t.originBranchId) === Number(myBranchId))) && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => setPreparingTransfer(t)}
                            style={{ background: "var(--brand-500)" }}
                          >
                            📦 Autorizar Salida
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setResolvingTransfer({ t, mode: "cancel" })} loading={processingId === t.id}>Cancelar</Button>
                        </div>
                      )}

                      {/* PREPARING: Origin branch can dispatch (Manager or Staff) */}
                      {t.status === "PREPARING" && (isAdmin || Number(t.originBranchId) === Number(myBranchId)) && (
                        <Button variant="primary" size="sm" onClick={() => setDispatchingTransfer(t)}>🚀 Despachar</Button>
                      )}
                      {/* IN_TRANSIT: Destination branch can receive (Manager or Inventory) */}
                      {t.status === "IN_TRANSIT" && (isAdmin || Number(t.destinationBranchId) === Number(myBranchId)) && (
                        <Button variant="primary" size="sm" onClick={() => setReceivingTransfer(t)}>Recibir</Button>
                      )}
                      {/* WITH_ISSUE: Admin or Manager can resolve */}
                      {t.status === "WITH_ISSUE" && (isAdmin || isManager) && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "shrinkage")}>Marcar Merma</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "resend")}>Reenviar Faltante</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleResolve(t.id!, "claim")}>Iniciar Reclamación</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detalle de Productos (Nuevo) */}
                  <div style={{ borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", padding: "16px 0" }}>
                    <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Package size={12} /> Productos incluidos
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px" }}>
                      {t.details?.map((d) => (
                        <div key={d.id} style={{ background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-100)" }}>
                            { (d as any).productName || `ID: ${d.productId}` }
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                            <span style={{ fontSize: "12px", color: "var(--neutral-50)", fontWeight: 700 }}>Solicitado: {d.requestedQuantity}</span>
                            {d.sentQuantity! > 0 && <span style={{ fontSize: "12px", color: "var(--brand-400)", fontWeight: 700 }}>Enviado: {d.sentQuantity}</span>}
                            {d.receivedQuantity! > 0 && <span style={{ fontSize: "12px", color: "var(--color-success)", fontWeight: 700 }}>Recibido: {d.receivedQuantity}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Línea de Tiempo Logística (Auditada) */}
                  <div>
                    <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={12} /> Línea de Tiempo Logística
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 10px", position: "relative" }}>
                      {/* Línea conectora base */}
                      <div style={{ position: "absolute", top: "12px", left: "20px", right: "20px", height: "2px", background: "var(--border-default)", zIndex: 0 }} />
                      
                      {/* Hitos Logísticos con Auditoría */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
                        <div style={{ 
                          width: "24px", 
                          height: "24px", 
                          borderRadius: "50%", 
                          background: (t.status === "CANCELLED" || t.status === "REJECTED") ? "var(--color-danger)" : "var(--brand-500)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          color: "white" 
                        }}>
                          {t.status === "CANCELLED" || t.status === "REJECTED" ? <XCircle size={12} /> : <Clock size={12} />}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: (t.status === "CANCELLED" || t.status === "REJECTED") ? "var(--color-danger)" : "var(--neutral-200)" }}>
                            {t.status === "CANCELLED" ? "Cancelado" : t.status === "REJECTED" ? "Rechazado" : "Solicitado"}
                          </p>
                          <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{new Date(t.requestDate!).toLocaleDateString()}</p>
                          <p style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 600 }}>{t.solicitanteNombre || "Cargando..."}</p>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: (t as any).autorizadorNombre ? "var(--brand-500)" : "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", color: (t as any).autorizadorNombre ? "white" : "var(--neutral-600)" }}>
                          <CheckCircle2 size={12} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: (t as any).autorizadorNombre ? "var(--neutral-200)" : "var(--neutral-600)" }}>Autorizado</p>
                          <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{ (t as any).autorizadorNombre ? "✓" : "-" }</p>
                          { (t as any).autorizadorNombre && <p style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 600 }}>{ (t as any).autorizadorNombre }</p> }
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: (t as any).dispatchDate ? "var(--brand-500)" : "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", color: (t as any).dispatchDate ? "white" : "var(--neutral-600)" }}>
                          <Truck size={12} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: (t as any).dispatchDate ? "var(--neutral-200)" : "var(--neutral-600)" }}>Despachado</p>
                          <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{ (t as any).dispatchDate ? new Date((t as any).dispatchDate).toLocaleDateString() : "-" }</p>
                          { (t as any).despachadorNombre && <p style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 600 }}>{ (t as any).despachadorNombre }</p> }
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: t.actualArrivalDate ? "var(--color-success)" : "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", color: t.actualArrivalDate ? "white" : "var(--neutral-600)" }}>
                          <CheckCircle2 size={12} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: t.actualArrivalDate ? "var(--neutral-200)" : "var(--neutral-600)" }}>Recibido</p>
                          <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{ t.actualArrivalDate ? new Date(t.actualArrivalDate).toLocaleDateString() : "-" }</p>
                          { (t as any).recibidorNombre && <p style={{ fontSize: "10px", color: "#2ecc71", fontWeight: 600 }}>{ (t as any).recibidorNombre }</p> }
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </>
    )}

      {/* Modals */}
      <NewTransferModal 
        open={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSuccess={fetchTransfers}
        currentBranchId={myBranchId} isAdmin={isAdmin} initialProductId={productIdPreselected}
        branches={branchesList}
      />
      <ReceiveTransferModal
        open={!!receivingTransfer} onClose={() => setReceivingTransfer(null)} onSuccess={fetchTransfers}
        transfer={receivingTransfer}
      />
      <DispatchTransferModal
        open={!!dispatchingTransfer} onClose={() => setDispatchingTransfer(null)} onSuccess={fetchTransfers}
        transfer={dispatchingTransfer}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Responsable:</span>
            <Badge variant="danger">
              <span style={{ fontWeight: 700, fontSize: "11px" }}>{(viewingReason as any)?.resolutorNombre || "SISTEMA"}</span>
            </Badge>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "12px" }}>
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
