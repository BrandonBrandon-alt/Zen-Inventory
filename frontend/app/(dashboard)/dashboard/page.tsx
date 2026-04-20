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
import Badge from "@/components/ui/Badge";

import BranchPerformanceChart from "@/components/dashboard/BranchPerformanceChart";
import TopProductsList from "@/components/dashboard/TopProductsList";
import SalesTrendChart from "@/components/dashboard/SalesTrendChart";
import AlertsList from "@/components/dashboard/AlertsList";
import ActiveTransfersList from "@/components/dashboard/ActiveTransfersList";

// New Advanced Components
import MonthlyComparisonChart from "@/components/dashboard/MonthlyComparisonChart";
import InventoryInsightTable from "@/components/dashboard/InventoryInsightTable";
import ReplenishmentGrid from "@/components/dashboard/ReplenishmentGrid";
import TransfersImpactDisplay from "@/components/dashboard/TransfersImpactDisplay";

import { 
  LineChart as LineChartIcon, 
  LayoutGrid, 
  Zap, 
  BarChart3, 
  PackageSearch,
  ShoppingCart,
  Boxes,
  TrendingUp
} from "lucide-react";

type TopProduct = components["schemas"]["TopSellingProduct"];
type StockAlert = components["schemas"]["StockAlertResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];
type TransferResponse = components["schemas"]["TransferResponse"];
type SalesTrend = { saleDate?: string; revenue?: number };

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<{
    topProducts: TopProduct[];
    alerts: StockAlert[];
    branches: BranchResponse[];
    transfers: TransferResponse[];
    performance: components["schemas"]["BranchPerformance"][];
    salesTrend: SalesTrend[];
    global: components["schemas"]["GlobalSummary"] | null;
    monthlySales: any[];
    inventoryRotation: any[];
    replenishment: any[];
    transferImpact: any | null;
  }>({
    topProducts: [],
    alerts: [],
    branches: [],
    transfers: [],
    performance: [],
    salesTrend: [],
    global: null,
    monthlySales: [],
    inventoryRotation: [],
    replenishment: [],
    transferImpact: null,
  });

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
    if (!isAdmin && !isManager && !isInventory) {
      setLoading(false);
      return;
    }

    async function fetchData() {
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

        const cleanQuery = { startDate, endDate };

        const basePromises = [
          apiClient.GET("/api/v1/analytics/top-products", { params: { query: { limit: 5, ...cleanQuery } } } as any),
          apiClient.GET("/api/branches"),
          apiClient.GET("/api/v1/analytics/global-summary", { params: { query: { ...cleanQuery } } } as any),
          apiClient.GET("/api/v1/analytics/sales-trend", { params: { query: cleanQuery } } as any),
          isAdmin ? apiClient.GET("/api/v1/analytics/branch-performance", { params: { query: { ...cleanQuery } } } as any) : Promise.resolve({ data: [] }),
          apiClient.GET("/api/v1/transfers"),
          apiClient.GET("/api/v1/analytics/monthly-sales" as any, {}),
          apiClient.GET("/api/v1/analytics/inventory-rotation" as any, {}),
          apiClient.GET("/api/v1/analytics/replenishment-insights" as any, {}),
          apiClient.GET("/api/v1/analytics/transfers-impact" as any, {}),
          apiClient.GET("/api/v1/alerts", { params: { query: isManager ? { branchId: session?.sucursalId } : {} } } as any)
        ];

        const [top, bra, glo, trend, perf, tra, monthly, rotation, repl, impact, alertRes] = await Promise.all(basePromises);

        const transfersData = (tra?.data ?? []) as any[];
        let filteredTransfers = transfersData;
        if (isManager && session?.sucursalId) {
          const myBranchId = Number(session.sucursalId);
          filteredTransfers = transfersData.filter((t: any) =>
            Number(t.originBranchId) === myBranchId || Number(t.destinationBranchId) === myBranchId
          );
        }

        setDashboardData({
          topProducts: top?.data ?? [],
          branches: bra?.data ?? [],
          global: glo?.data ?? null,
          salesTrend: trend?.data ?? [],
          performance: perf?.data ?? [],
          transfers: filteredTransfers.filter((t: any) => t.status !== "RECEIVED"),
          monthlySales: monthly?.data ?? [],
          inventoryRotation: rotation?.data ?? [],
          replenishment: repl?.data ?? [],
          transferImpact: impact?.data ?? null,
          alerts: (alertRes?.data ?? []).filter((a: any) => !a.resolved),
        });

      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAdmin, isManager, isInventory, timeRange, session]);

  const branchMap = useMemo(() => {
    const map = new Map<number, string>();
    (dashboardData.branches || []).forEach(b => {
      if (b.id !== undefined && b.nombre !== undefined) {
        map.set(b.id, b.nombre);
      }
    });
    return map;
  }, [dashboardData.branches]);

  if (loading) return <Spinner fullPage />;

  const rangeButtons = (
    <div className="flex items-center gap-4 bg-[var(--bg-card)] p-1.5 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
      {["today", "7d", "month", "all"].map((range) => (
        <button
          key={range}
          onClick={() => setTimeRange(range as any)}
          className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${
            timeRange === range 
              ? "bg-[var(--brand-500)] text-white shadow-lg" 
              : "text-[var(--neutral-400)] hover:text-[var(--neutral-200)]"
          }`}
        >
          {range === "today" ? "Hoy" : range === "7d" ? "7D" : range === "month" ? "Mes" : "Total"}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1600px", margin: "0 auto" }} className="space-y-12">
      <PageHeader 
        title={isAdmin ? "Executive Intelligence" : "Dashboard de Gestión"} 
        description={isAdmin ? `Bienvenido, ${session?.nombre}. Resumen consolidado.` : `Hola ${session?.nombre}. Estado operativo.`} 
        actions={rangeButtons}
      />

      {isInventory ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Link href="/transfers" className="group">
                <div className="bg-[var(--bg-card)] p-8 rounded-[32px] border border-[var(--brand-500)] shadow-2xl transition-all hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-[var(--brand-500)]/10 rounded-2xl">
                      <Boxes className="text-[var(--brand-500)]" size={28} />
                    </div>
                    <Badge variant="info">Recibos</Badge>
                  </div>
                  <h3 className="text-[18px] font-black text-[var(--neutral-50)] mb-1 uppercase tracking-tight">En Ruta</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[52px] font-black text-[var(--brand-500)] leading-none">
                      {dashboardData.transfers.filter(t => Number(t.destinationBranchId) === Number(session?.sucursalId) && t.status === "IN_TRANSIT").length}
                    </span>
                    <span className="text-[12px] font-bold text-[var(--neutral-500)] uppercase">Traslados</span>
                  </div>
                </div>
              </Link>
              <Link href="/transfers" className="group">
                <div className="bg-[var(--bg-card)] p-8 rounded-[32px] border border-[var(--color-warning)] shadow-2xl transition-all hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-[var(--color-warning)]/10 rounded-2xl">
                      <Zap className="text-[var(--color-warning)]" size={28} />
                    </div>
                    <Badge variant="warning">Packing</Badge>
                  </div>
                  <h3 className="text-[18px] font-black text-[var(--neutral-50)] mb-1 uppercase tracking-tight">Pendientes</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[52px] font-black text-[var(--color-warning)] leading-none">
                      {dashboardData.transfers.filter(t => Number(t.originBranchId) === Number(session?.sucursalId) && (t.status === "PREPARING" || t.status === "AUTHORIZED")).length}
                    </span>
                    <span className="text-[12px] font-bold text-[var(--neutral-500)] uppercase">Traslados</span>
                  </div>
                </div>
              </Link>
            </div>
            <Card title="Productos para Reabastecimiento" headerRight={<ShoppingCart size={18} className="text-[var(--neutral-500)]" />}>
              <ReplenishmentGrid data={dashboardData.replenishment} />
            </Card>
          </div>
          <div className="lg:col-span-4 space-y-8">
            {dashboardData.transferImpact && <TransfersImpactDisplay data={dashboardData.transferImpact} />}
            <Card title="Alertas Críticas">
              <AlertsList alerts={dashboardData.alerts} />
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-12 pb-12">
          {/* Layer 1: Executive Pulse (KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <KpiCard
              label="Ventas Netas"
              value={formatCOP(dashboardData.global?.totalRevenue ?? 0)}
              sub={`Ticket Promedio: ${formatCOP(dashboardData.global?.averageTicket ?? 0)}`}
              accent="var(--color-success)"
              progress={75}
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
            />
            <KpiCard
              label="Valor Inventario"
              value={formatCOP(dashboardData.global?.totalInventoryValue ?? 0)}
              sub={isAdmin ? `${dashboardData.branches.length} sedes` : "Local"}
              accent="var(--color-warning)"
              progress={45}
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 8l-9-4-9 4m18 8l-9 4-9-4m18-4l-9 4-9-4m9-11v11" /></svg>}
            />
            <KpiCard
              label="Rotación Global"
              value={`${((dashboardData.inventoryRotation.reduce((a, b) => a + (b.rotationRatio || 0), 0) / (dashboardData.inventoryRotation.length || 1)) * 100).toFixed(1)}%`}
              sub="Eficiencia catálogo"
              accent="var(--brand-500)"
              progress={62}
              icon={<BarChart3 size={22} strokeWidth={2.5} />}
            />
            <KpiCard
              label="Acciones Críticas"
              value={String(dashboardData.alerts.length)}
              sub="Pendientes"
              accent={dashboardData.alerts.length > 0 ? "var(--color-danger)" : "var(--color-success)"}
              progress={dashboardData.alerts.length > 0 ? 85 : 0}
              icon={<Zap size={22} strokeWidth={2.5} />}
            />
          </div>

          {/* Layer 2: Commercial Intelligence (2/3 + 1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <Card title="Tendencia de Ingresos" headerRight={<LineChartIcon size={18} className="text-[var(--neutral-500)]" />}>
                <div className="h-[360px] w-full pt-4">
                  <SalesTrendChart data={dashboardData.salesTrend} variant="area" />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-4">
              <Card title="Comparativa Mensual" headerRight={<BarChart3 size={18} className="text-[var(--neutral-500)]" />}>
                <div className="h-[360px] w-full pt-4">
                  <MonthlyComparisonChart data={dashboardData.monthlySales} />
                </div>
              </Card>
            </div>
          </div>

          {/* Layer 3: Inventory & Logistics Deep Dive (3/5 + 2/5 approx 7/12) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <Card title="Análisis de Eficiencia y Rotación" headerRight={<PackageSearch size={18} className="text-[var(--neutral-500)]" />}>
                <InventoryInsightTable data={dashboardData.inventoryRotation} />
              </Card>
            </div>
            <div className="lg:col-span-5 space-y-8">
              {dashboardData.transferImpact && <TransfersImpactDisplay data={dashboardData.transferImpact} />}
              <Card title="Velocidad de Productos" headerRight={<TrendingUp size={16} className="text-[var(--brand-500)]" />}>
                <TopProductsList products={dashboardData.topProducts} />
              </Card>
            </div>
          </div>

          {/* Layer 4: Operations & Control (5/12 + 7/12) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <Card title="Gestión de Reabastecimiento" headerRight={<ShoppingCart size={18} className="text-[var(--neutral-500)]" />}>
                <ReplenishmentGrid data={dashboardData.replenishment} />
              </Card>
            </div>
            <div className="lg:col-span-7 space-y-8">
               <Card title="Monitoreo de Alertas Stock" headerRight={<Zap size={18} className="text-[var(--color-danger)]" />}>
                <AlertsList alerts={dashboardData.alerts} />
              </Card>
              <Card title="Traslados en Curso" headerRight={<Badge variant="info">Logística</Badge>}>
                <ActiveTransfersList transfers={dashboardData.transfers} branchMap={branchMap} />
              </Card>
              {isAdmin && (
                <Card title="Rendimiento Global de Sedes">
                  <div className="h-[300px] py-4">
                    <BranchPerformanceChart data={dashboardData.performance} />
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
