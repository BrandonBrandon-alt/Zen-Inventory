"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import type { components } from "@/api/schema";

import Spinner from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import BranchPerformanceChart from "@/components/dashboard/BranchPerformanceChart";
import TopProductsList from "@/components/dashboard/TopProductsList";
import SalesTrendChart from "@/components/dashboard/SalesTrendChart";
import AlertsList from "@/components/dashboard/AlertsList";
import ActiveTransfersList from "@/components/dashboard/ActiveTransfersList";

type BranchValuation = components["schemas"]["BranchValuation"];
type TopProduct = components["schemas"]["TopSellingProduct"];
type StockAlert = components["schemas"]["StockAlertResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];
type TransferResponse = components["schemas"]["TransferResponse"];
type SalesTrend = { saleDate?: string; revenue?: number };

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function DashboardPage() {
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [transfers, setTransfers] = useState<TransferResponse[]>([]);
  const [performance, setPerformance] = useState<components["schemas"]["BranchPerformance"][]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [global, setGlobal] = useState<components["schemas"]["GlobalSummary"] | null>(null);
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "month" | "all">("all");
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isSeller = session?.rol === "SELLER";
  const isInventory = session?.rol === "OPERADOR_INVENTARIO";

  useEffect(() => {
    if (isSeller) {
      router.push("/sales/pos");
    }
  }, [isSeller, router]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function fetchAll() {
      try {
        let startDate: string | undefined = undefined;
        let endDate: string | undefined = undefined;
        const now = new Date();

        if (timeRange === "today") {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          startDate = today.toISOString();
          endDate = new Date(today.getTime() + 86400000 - 1).toISOString();
        } else if (timeRange === "7d") {
          const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          startDate = past.toISOString();
        } else if (timeRange === "month") {
          const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = startMonth.toISOString();
        }

        const dateQuery = { startDate, endDate };
        const cleanQuery = Object.fromEntries(Object.entries(dateQuery).filter(([_, v]) => v != null));

        const [top, bra, glo, perf, tra, trendRes] = await Promise.all([
          // @ts-ignore
          apiClient.GET("/api/v1/analytics/top-products", { params: { query: { limit: 5, ...cleanQuery } } }),
          apiClient.GET("/api/branches"),
          // @ts-ignore
          apiClient.GET("/api/v1/analytics/global-summary", { params: { query: { ...cleanQuery } } }),
          // @ts-ignore
          apiClient.GET("/api/v1/analytics/branch-performance", { params: { query: { ...cleanQuery } } }),
          apiClient.GET("/api/v1/transfers"),
          // @ts-ignore
          (apiClient as any).GET("/api/v1/analytics/sales-trend", { params: { query: cleanQuery } }),
        ]);

        setTopProducts(top.data ?? []);
        setGlobal(glo.data ?? null);
        setPerformance(perf.data ?? []);
        setTransfers((tra.data ?? []).filter(t => t.status !== "RECEIVED"));
        setSalesTrend(trendRes?.data ?? []);

        const branchList = bra.data ?? [];
        setBranches(branchList);

        if (branchList.length > 0) {
          // @ts-ignore
          const alertRes = await apiClient.GET("/api/v1/alerts", { params: { query: {} } });
          setAlerts((alertRes.data ?? []).filter(a => !a.resolved));
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    async function fetchLocal() {
      try {
        let startDate: string | undefined = undefined;
        let endDate: string | undefined = undefined;
        const now = new Date();

        if (timeRange === "today") {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          startDate = today.toISOString();
          endDate = new Date(today.getTime() + 86400000 - 1).toISOString();
        } else if (timeRange === "7d") {
          const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          startDate = past.toISOString();
        } else if (timeRange === "month") {
          const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = startMonth.toISOString();
        }

        const dateQuery = { startDate, endDate };
        const cleanQuery = Object.fromEntries(Object.entries(dateQuery).filter(([_, v]) => v != null));

        const [traRes, braRes, gloRes, topRes, trendRes] = await Promise.all([
          apiClient.GET("/api/v1/transfers"),
          apiClient.GET("/api/branches"),
          // @ts-ignore
          apiClient.GET("/api/v1/analytics/global-summary", { params: { query: { ...cleanQuery } } }),
          // @ts-ignore
          apiClient.GET("/api/v1/analytics/top-products", { params: { query: { limit: 5, ...cleanQuery } } }),
          // @ts-ignore
          (apiClient as any).GET("/api/v1/analytics/sales-trend", { params: { query: cleanQuery } }),
        ]);

        setBranches(braRes.data ?? []);
        setTopProducts(topRes.data ?? []);
        setGlobal(gloRes.data ?? null);
        setSalesTrend(trendRes?.data ?? []);

        let branchTransfers = traRes.data ?? [];
        if (session?.sucursalId) {
          const myBranchId = Number(session.sucursalId);
          branchTransfers = branchTransfers.filter((t: any) =>
            Number(t.originBranchId) === myBranchId || Number(t.destinationBranchId) === myBranchId
          );
        }
        setTransfers(branchTransfers.filter((t: any) => t.status !== "RECEIVED"));

        if (session?.sucursalId) {
          // @ts-ignore
          const alertRes = await apiClient.GET("/api/v1/alerts", { params: { query: { branchId: session.sucursalId } } });
          setAlerts((alertRes.data ?? []).filter(a => !a.resolved));
        }
      } catch (e) {
        console.error("Manager dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      fetchAll();
    } else if (isManager || isInventory) {
      fetchLocal();
    } else {
      setLoading(false);
    }
  }, [isAdmin, isManager, isInventory, timeRange, session]);

  // Derived state with useMemo
  const branchMap = useMemo(() => {
    const map = new Map<number, string>();
    (branches || []).forEach(b => {
      if (b.id !== undefined && b.nombre !== undefined) {
        map.set(b.id, b.nombre);
      }
    });
    return map;
  }, [branches]);
  const activeAlerts = alerts.length;

  if (loading) return <Spinner fullPage />;

  // ─────────────────────────────────────────────────────────────
  // 1. Dashboard Operativo (Bodeguero)
  // ─────────────────────────────────────────────────────────────
  if (isInventory) {
    const myBranch = Number(session?.sucursalId);
    const vehiculosPorRecibir = transfers.filter(t => Number(t.destinationBranchId) === myBranch && t.status === "IN_TRANSIT").length;
    const porEmpacar = transfers.filter(t => Number(t.originBranchId) === myBranch && (t.status === "PREPARING" || t.status === "AUTHORIZED")).length;

    return (
      <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
        <PageHeader title="Panel de Operaciones" description={`Hola ${session?.nombre}. Resumen logístico del día en tu sucursal.`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginTop: "32px" }}>
          <Link href="/transfers" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
            <Card title="Recibos Pendientes" style={{ border: "1px solid var(--brand-500)", background: "rgba(217, 99, 79, 0.05)" }}>
              <div style={{ padding: "20px 0", display: "flex", alignItems: "baseline", gap: "12px" }}>
                <span style={{ fontSize: "48px", fontWeight: "900", color: "var(--brand-500)", lineHeight: 1 }}>{vehiculosPorRecibir}</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--neutral-400)", textTransform: "uppercase" }}>Camiones en ruta</span>
              </div>
            </Card>
          </Link>
          <Link href="/transfers" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
            <Card title="Despachos por Preparar" style={{ border: "1px solid var(--color-warning)", background: "rgba(245, 158, 11, 0.05)" }}>
              <div style={{ padding: "20px 0", display: "flex", alignItems: "baseline", gap: "12px" }}>
                <span style={{ fontSize: "48px", fontWeight: "900", color: "var(--color-warning)", lineHeight: 1 }}>{porEmpacar}</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--neutral-400)", textTransform: "uppercase" }}>Traslados por empacar</span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Dashboard Gerencial (Sede)
  // ─────────────────────────────────────────────────────────────
  if (isManager) {
    return (
      <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
        <PageHeader title="Panel de Gerencia" description={`Bienvenido, ${session?.nombre ?? "Gerente"}. Información operativa y analítica de tu sede.`} />
        
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px", marginTop: "16px" }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              color: 'var(--neutral-100)',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            <option value="today">Ventas de Hoy</option>
            <option value="7d">Últimos 7 Días</option>
            <option value="month">Este Mes</option>
            <option value="all">Histórico Completo</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", marginBottom: "32px" }}>
          <KpiCard
            label="Ventas Netas"
            value={formatCOP(global?.totalRevenue ?? 0)}
            sub={`Ticket Promedio: ${formatCOP(global?.averageTicket ?? 0)}`}
            accent="#10b981"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
          />
          <KpiCard
            label="Valor Inventario Local"
            value={formatCOP(global?.totalInventoryValue ?? 0)}
            sub="Basado en stock actual"
            accent="#f59e0b"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 8l-9-4-9 4m18 8l-9 4-9-4m18-4l-9 4-9-4m9-11v11" /></svg>}
          />
          <Link href="/transfers" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
            <KpiCard
              label="Traslados Pendientes"
              value={String(transfers.filter(t => t.status === "PENDING").length)}
              sub="Requieren tu aprobación"
              accent="#3b82f6"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>}
            />
          </Link>
          <Link href="/alerts" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
            <KpiCard
              label="Alertas de Stock"
              value={String(activeAlerts)}
              sub="Productos en nivel crítico"
              accent={activeAlerts > 0 ? "var(--brand-500)" : "#10b981"}
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}
            />
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "32px" }}>
          <Card title="Tendencia de Facturación">
            <div style={{ width: '100%', height: 300, paddingTop: '16px' }}>
              <SalesTrendChart data={salesTrend} variant="line" />
            </div>
          </Card>
          <Card title="Productos más vendidos (Sede)">
            <TopProductsList products={topProducts} />
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
          <Card title="Traslados en Curso">
            <ActiveTransfersList transfers={transfers} branchMap={branchMap} />
          </Card>
          <Card title="Alertas de Stock">
            <AlertsList alerts={alerts} />
          </Card>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Dashboard Administrativo (Panel Global)
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Panel de Control Administrativo"
        description={`Bienvenido, ${session?.nombre ?? session?.email ?? "Administrador"}. Visualiza el estado global de tu red.`}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            color: 'var(--neutral-100)',
            outline: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          <option value="today">Ventas de Hoy</option>
          <option value="7d">Últimos 7 Días</option>
          <option value="month">Este Mes</option>
          <option value="all">Histórico Completo</option>
        </select>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutral-100)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          Visión Global
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", marginBottom: "36px" }}>
          <KpiCard
            label="Ventas Netas"
            value={formatCOP(global?.totalRevenue ?? 0)}
            sub={`Ticket Promedio: ${formatCOP(global?.averageTicket ?? 0)}`}
            accent="#10b981"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
          />
          <KpiCard
            label="Valor Inventario"
            value={formatCOP(global?.totalInventoryValue ?? 0)}
            sub={`${branches.length} sedes operativas`}
            accent="#f59e0b"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 8l-9-4-9 4m18 8l-9 4-9-4m18-4l-9 4-9-4m9-11v11" /></svg>}
          />
          <Link href="/transfers" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
            <KpiCard
              label="Traslados Activos"
              value={String(transfers.length)}
              sub="Movimientos en proceso"
              accent="#3b82f6"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>}
            />
          </Link>
          <Link href="/alerts" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
            <KpiCard
              label="Alertas Críticas"
              value={String(activeAlerts)}
              sub="Acciones requeridas"
              accent={activeAlerts > 0 ? "var(--brand-500)" : "#10b981"}
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}
            />
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutral-100)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
          Análisis Comparativo
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <Card title="Rendimiento por Sucursal">
              <div style={{ width: '100%', height: 320, padding: "10px 0" }}>
                <BranchPerformanceChart data={performance} />
              </div>
            </Card>

            <Card title="Top Productos más vendidos">
              <TopProductsList products={topProducts} />
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <Card title="Traslados en Curso">
              <ActiveTransfersList transfers={transfers} branchMap={branchMap} />
            </Card>

            <Card title="Alertas de Stock">
              <AlertsList alerts={alerts} />
            </Card>
          </div>

        </div>
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutral-100)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          Desempeño Cronológico
        </h2>
        <Card title="Tendencia de Ventas en el Tiempo (Facturación por Día)">
          <div style={{ width: '100%', height: 350, paddingTop: '16px' }}>
            <SalesTrendChart data={salesTrend} variant="line" />
          </div>
        </Card>
      </div>

    </div>
  );
}
