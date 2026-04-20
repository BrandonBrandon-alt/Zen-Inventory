"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import { useToast } from "@/context/ToastContext";
import type { components } from "@/api/schema";

import Spinner    from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import Card       from "@/components/ui/Card";
import Badge      from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Modal      from "@/components/ui/Modal";
import Button     from "@/components/ui/Button";
import AlertResolutionModal from "@/components/alerts/AlertResolutionModal";

// ── Types ──────────────────────────────────────────────────
type StockAlert     = components["schemas"]["StockAlertResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

// ── AlertCard ──────────────────────────────────────────────
function AlertCard({
  alert,
  branchName,
  onResolve,
  router,
}: {
  alert: StockAlert;
  branchName: string;
  onResolve: (id: number) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const resolved = alert.resolved ?? false;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: "14px",
        padding: "14px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: resolved ? "var(--color-success)" : "var(--brand-500)",
          flexShrink: 0,
          boxShadow: resolved ? "none" : "0 0 6px var(--brand-glow)",
        }}
      />

      {/* Content */}
      <div>
        <p style={{ fontSize: "13.5px", color: "var(--neutral-100)", marginBottom: "3px", lineHeight: 1.4 }}>
          {alert.message}
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>
          {branchName}
          </span>
          <span style={{ fontSize: "12px", color: "var(--neutral-600)" }}>·</span>
          <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>
            Producto #{alert.productId}
          </span>
          {alert.alertDate && (
            <>
              <span style={{ fontSize: "12px", color: "var(--neutral-600)" }}>·</span>
              <span style={{ fontSize: "12px", color: "var(--neutral-600)" }}>
                {new Date(alert.alertDate).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Badge variant={resolved ? "success" : "danger"} dot>
          {resolved ? "Resuelta" : "Activa"}
        </Badge>
        {!resolved && (
          alert.type === "RETURN_REQUEST" ? (
            <Button variant="ghost" size="sm" onClick={() => router.push("/returns")}>
              Ver Solicitud
            </Button>
          ) : alert.type === "TRANSFER_REQUEST" ? (
            <Button variant="ghost" size="sm" onClick={() => router.push("/transfers")}>
              Ver Traslado
            </Button>
          ) : alert.type === "PURCHASE_REQUEST" ? (
            <Button variant="ghost" size="sm" onClick={() => router.push("/purchases")}>
              Ver Compra
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResolve(alert.id!)}
              leftIcon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              }
            >
              Resolver
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function AlertsPage() {
  const [branches, setBranches]       = useState<BranchResponse[]>([]);
  const [alerts, setAlerts]           = useState<StockAlert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [scanning, startScan]         = useTransition();
  const [resolving, startResolve]     = useTransition();
  const [confirmId, setConfirmId]     = useState<number | null>(null);
  const [filter, setFilter]           = useState<"all" | "active" | "resolved">("all");
  const [scanResult, setScanResult]   = useState<string | null>(null);

  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isSeller = session?.rol === "SELLER";

  // Redirigir si es SELLER (no tiene permiso aquí)
  useEffect(() => {
    if (isSeller) {
      router.push("/sales/pos");
    }
  }, [isSeller]);

  // Initial load
  useEffect(() => {
    async function load() {
      try {
        const { data: branchList } = await apiClient.GET("/api/branches");
        const bra = branchList ?? [];
        setBranches(bra);

        if (bra.length > 0) {
          await refreshAlerts(bra);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const refreshAlerts = async (branchList = branches) => {
    if (isAdmin) {
      const results = await Promise.all(
        branchList.map((b) =>
          apiClient.GET("/api/v1/alerts", { params: { query: { branchId: b.id! } } })
        )
      );
      setAlerts(results.flatMap((r) => r.data ?? []));
    } else {
      // Para MANAGER y OPERADOR_INVENTARIO, el backend ya filtra por su sede automáticamente
      const { data } = await apiClient.GET("/api/v1/alerts");
      setAlerts(data ?? []);
    }
  };

  // Force scan
  const handleScan = () => {
    showToast("Escaneando el inventario en busca de quiebres de stock...", "info", "Escaneo iniciado");
    startScan(async () => {
      await apiClient.POST("/api/v1/alerts/scan");
      await refreshAlerts();
      const newCount = alerts.filter((a) => !a.resolved).length;
      showToast(`Escaneo completo. Se encontraron ${newCount} alertas activas.`, "success", "Escaneo finalizado");
      setScanResult(`Escaneo completo. ${newCount} alerta${newCount !== 1 ? "s" : ""} activa${newCount !== 1 ? "s" : ""}.`);
      setTimeout(() => setScanResult(null), 4000);
    });
  };


  const handleSuccess = () => {
    refreshAlerts();
    setSelectedAlert(null);
  };

  const [selectedAlert, setSelectedAlert] = useState<StockAlert | null>(null);

  const { showToast } = useToast();


  // Branch name lookup
  const branchName = (id: number | undefined) =>
    branches.find((b) => b.id === id)?.nombre ?? `Sucursal #${id}`;

  // Filtered list
  const filtered = alerts.filter((a) => {
    if (filter === "active")   return !a.resolved;
    if (filter === "resolved") return a.resolved;
    return true;
  });

  const activeCount   = alerts.filter((a) => !a.resolved).length;
  const resolvedCount = alerts.filter((a) => a.resolved).length;

  if (loading) return <Spinner fullPage />;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <PageHeader
        title="Alertas de Stock"
        description="Monitoreo proactivo de quiebres de inventario en todas las sedes."
      />

      <div style={{ 
        display: "flex", 
        flexDirection: "row", 
        flexWrap: "wrap",
        justifyContent: "space-between", 
        alignItems: "flex-end", 
        marginBottom: "28px", 
        gap: "24px" 
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Button
            variant="ghost"
            loading={scanning}
            onClick={handleScan}
            style={{ marginTop: "4px", flexShrink: 0 }}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
          >
            {scanning ? "Escaneando…" : "Escanear stock"}
          </Button>
        </div>
      </div>

      {/* Scan result banner */}
      {scanResult && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "rgba(111,191,138,0.10)",
            border: "1px solid rgba(111,191,138,0.25)",
            color: "var(--color-success)",
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeInUp 0.2s ease",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {scanResult}
        </div>
      )}

      {/* Summary + Filter tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
          animation: "fadeInUp 0.35s ease 0.05s both",
        }}
      >
        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "3px",
            gap: "2px",
          }}
        >
          {([
            { key: "all",      label: `Todas (${alerts.length})` },
            { key: "active",   label: `Activas (${activeCount})` },
            { key: "resolved", label: `Resueltas (${resolvedCount})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: filter === key ? 600 : 400,
                color: filter === key ? "var(--neutral-50)" : "var(--neutral-500)",
                background: filter === key ? "var(--bg-hover)" : "transparent",
                border: filter === key ? "1px solid var(--border-default)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "var(--font-sans)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", gap: "8px" }}>
          {activeCount > 0 && <Badge variant="danger" dot>{activeCount} activas</Badge>}
          {resolvedCount > 0 && <Badge variant="success" dot>{resolvedCount} resueltas</Badge>}
        </div>
      </div>

      {/* Alerts Card */}
      <Card delay="0.1s">
        {filtered.length === 0 ? (
          <EmptyState
            icon={
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            }
            title={
              filter === "active"
                ? "Sin alertas activas"
                : filter === "resolved"
                ? "Sin alertas resueltas"
                : "Sin alertas registradas"
            }
            description={
              filter === "active"
                ? "Todos los productos están por encima del stock mínimo."
                : "Haz clic en 'Escanear stock' para detectar quiebres de inventario."
            }
            action={
              filter !== "resolved" ? (
                <Button variant="ghost" size="sm" loading={scanning} onClick={handleScan}>
                  Escanear ahora
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            {filtered.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                branchName={branchName(alert.branchId)}
                onResolve={(id) => setSelectedAlert(alerts.find(a => a.id === id) || null)}
                router={router}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Gateway de Resolución Modal */}
      <AlertResolutionModal 
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
