"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import type { components } from "@/api/schema";

import Spinner    from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard    from "@/components/ui/KpiCard";
import Card       from "@/components/ui/Card";
import Badge      from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

// ── Types ──────────────────────────────────────────────────
type BranchValuation = components["schemas"]["BranchValuation"];
type TopProduct      = components["schemas"]["TopSellingProduct"];
type StockAlert      = components["schemas"]["StockAlertResponse"];
type BranchResponse  = components["schemas"]["BranchResponse"];
type TransferResponse = components["schemas"]["TransferResponse"];
type SalesTrend      = { saleDate?: string; revenue?: number };

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

// ── AlertRow: usa Badge ────────────────────────────────────
function AlertRow({ alert }: { alert: StockAlert }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div
          style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: alert.resolved ? "var(--color-success)" : "var(--brand-500)",
            marginTop: "6px", flexShrink: 0,
          }}
        />
        <div>
          <p style={{ fontSize: "13.5px", color: "var(--neutral-100)", marginBottom: "2px" }}>
            {alert.message}
          </p>
          <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>
            Sucursal #{alert.branchId} · Producto #{alert.productId}
          </p>
        </div>
      </div>
      <Badge variant={alert.resolved ? "success" : "danger"}>
        {alert.resolved ? "Resuelta" : "Activa"}
      </Badge>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────
export default function DashboardPage() {
  const [valuations, setValuations]   = useState<BranchValuation[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [alerts, setAlerts]           = useState<StockAlert[]>([]);
  const [branches, setBranches]       = useState<BranchResponse[]>([]);
  const [transfers, setTransfers]     = useState<TransferResponse[]>([]);
  const [performance, setPerformance] = useState<components["schemas"]["BranchPerformance"][]>([]);
  const [salesTrend, setSalesTrend]   = useState<SalesTrend[]>([]);
  const [global, setGlobal]           = useState<components["schemas"]["GlobalSummary"] | null>(null);
  const [timeRange, setTimeRange]     = useState<"today"|"7d"|"month"|"all">("all");
  const [loading, setLoading]         = useState(true);
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isSeller = session?.rol === "SELLER";

  useEffect(() => {
    if (isSeller) {
      router.push("/sales/pos");
    } else if (isManager) {
      // Por ahora redirigimos al Manager al inventario ya que el dashboard es global
      router.push("/inventory");
    }
  }, [isSeller, isManager, router]);

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

        // Limpiar undefined parameters
        const cleanQuery = Object.fromEntries(Object.entries(dateQuery).filter(([_, v]) => v != null));

        const [val, top, bra, glo, perf, tra, trendRes] = await Promise.all([
          apiClient.GET("/api/v1/analytics/valuations"),
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
        
        setValuations(val.data ?? []);
        setTopProducts(top.data ?? []);
        setGlobal(glo.data ?? null);
        setPerformance(perf.data ?? []);
        setTransfers((tra.data ?? []).filter(t => t.status !== "RECEIVED"));
        setSalesTrend(trendRes?.data ?? []);
        
        const branchList = bra.data ?? [];
        setBranches(branchList);

        if (branchList.length > 0) {
          // @ts-ignore - branchId is now optional in backend, schema pending update
          const alertRes = await apiClient.GET("/api/v1/alerts", { params: { query: {} } });
          setAlerts((alertRes.data ?? []).filter(a => !a.resolved));
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [isAdmin, timeRange]);

  if (loading) return <Spinner fullPage />;

  const activeAlerts = alerts.length;
  const topProduct   = topProducts[0];
  const branchMap = new Map(branches.map(b => [b.id, b.nombre]));

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Panel de Control Administrativo"
        description={`Bienvenido, ${session?.nombre ?? session?.email ?? "Administrador"}. Visualiza el estado global de tu red de sucursales.`}
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
              appearance: 'none',
            }}
          >
            <option value="today">Ventas de Hoy</option>
            <option value="7d">Últimos 7 Días</option>
            <option value="month">Este Mes</option>
            <option value="all">Histórico Completo</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutral-100)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Visión Global
        </h2>
        {/* KPI Grid */}
        <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "24px",
          marginBottom: "36px",
        }}
      >
        <KpiCard
          label="Ventas Netas"
          value={formatCOP(global?.totalRevenue ?? 0)}
          sub={`Ticket Promedio: ${formatCOP(global?.averageTicket ?? 0)}`}
          accent="#10b981"
          delay="0s"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <KpiCard
          label="Valor Inventario"
          value={formatCOP(global?.totalInventoryValue ?? 0)}
          sub={`${branches.length} sedes operativas`}
          accent="#f59e0b"
          delay="0.1s"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 8l-9-4-9 4m18 8l-9 4-9-4m18-4l-9 4-9-4m9-11v11"/></svg>}
        />
        <Link href="/transfers/monitor" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
          <KpiCard
            label="Traslados Activos"
            value={String(transfers.length)}
            sub="Movimientos en proceso"
            accent="#3b82f6"
            delay="0.2s"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>}
          />
        </Link>
        <Link href="/alerts" style={{ textDecoration: 'none' }} className="transition-transform hover:scale-[1.02]">
          <KpiCard
            label="Alertas Críticas"
            value={String(activeAlerts)}
            sub="Acciones requeridas"
            accent={activeAlerts > 0 ? "var(--brand-500)" : "#10b981"}
            delay="0.3s"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
          />
        </Link>
      </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutral-100)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          Análisis Comparativo
        </h2>
        <div className="dashboard-grid">
        <style jsx>{`
          .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
          @media (max-width: 1024px) {
            .dashboard-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Rendimiento por Sucursal Visual (BarChart) */}
          <Card title="Rendimiento por Sucursal" delay="0.4s">
            <div style={{ width: '100%', height: 320, padding: "10px 0" }}>
              {performance.length === 0 ? (
                <EmptyState 
                  title="Sin datos" 
                  description="No hay sucursales con ventas registradas en el periodo." 
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>}
                />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={performance} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                    <XAxis dataKey="branchName" stroke="var(--neutral-400)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--neutral-400)" fontSize={11} tickLine={false} axisLine={false} width={80} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                    <Tooltip 
                      cursor={{ fill: 'var(--bg-hover)' }}
                      contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--neutral-100)' }}
                      formatter={(value: any) => [formatCOP(Number(value) || 0), "Ingresos Netos"]}
                    />
                    <Bar dataKey="revenue" fill="var(--brand-500)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Top Products */}
          <Card title="Top Productos más vendidos" delay="0.45s">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {topProducts.map((prod, idx) => (
                <div key={prod.productId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ 
                    width: "32px", height: "32px", borderRadius: "50%", 
                    background: idx === 0 ? "rgba(251, 191, 36, 0.2)" : (idx === 1 ? "rgba(156, 163, 175, 0.2)" : "rgba(180, 83, 9, 0.2)"),
                    color: idx === 0 ? "var(--color-warning)" : (idx === 1 ? "var(--neutral-400)" : "#b45309"),
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px"
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-100)", lineHeight: 1.2 }}>{prod.productName}</p>
                    <p style={{ fontSize: "11px", color: "var(--brand-500)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>ID: {prod.productId}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "15px", fontWeight: 900, color: "var(--color-success)" }}>{prod.totalSoldQuantity}</p>
                    <p style={{ fontSize: "10px", color: "var(--neutral-500)" }}>UNDS</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                 <EmptyState 
                   title="Sin datos" 
                   description="No hay ventas suficientes registradas." 
                   icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                 />
              )}
            </div>
          </Card>
        </div>

        {/* Valorización de Inventario y Alertas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card title="Traslados en Curso" delay="0.25s">
            {transfers.length === 0 ? (
              <EmptyState title="Sin movimientos" description="No hay traslados activos actualmente." 
                icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>}
              />
            ) : (
              transfers.map((t, i) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < transfers.length -1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <div>
                    <p style={{ fontSize: "13px", color: "var(--neutral-100)" }}>
                      {branchMap.get(t.originBranchId!) || "Sede A"} → {branchMap.get(t.destinationBranchId!) || "Sede B"}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--neutral-500)" }}>{t.status === "REQUESTED" ? "Solicitado" : "Enviado"}</p>
                  </div>
                  <Badge variant={t.status === "DISPATCHED" ? "warning" : "neutral"}>
                    ID #{t.id}
                  </Badge>
                </div>
              ))
            )}
          </Card>

          <Card title="Alertas de Stock" delay="0.3s">
            {alerts.length === 0 ? (
              <EmptyState title="Todo normal" description="No hay alertas críticas en la red." 
                icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              />
            ) : (
              alerts.slice(0, 4).map(a => <AlertRow key={a.id} alert={a} />)
            )}
          </Card>
        </div>
      </div>
      </div>

      {/* Gráfico de Tendencia Full Width */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutral-100)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Desempeño Cronológico
        </h2>
         <Card title="Tendencia de Ventas en el Tiempo (Facturación por Día)" delay="0.5s">
           <div style={{ width: '100%', height: 350, paddingTop: '16px' }}>
              {salesTrend.length === 0 ? (
                <EmptyState 
                  title="Sin histórico" 
                  description="No hay tendencia de ventas disponible en el periodo seleccionado." 
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18"/><path d="M18 9l-5 5-3-3-5 5"/></svg>}
                />
              ) : (
                <ResponsiveContainer>
                  <LineChart data={salesTrend} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                    <XAxis dataKey="saleDate" stroke="var(--neutral-400)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="var(--neutral-400)" fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--neutral-100)' }}
                      formatter={(value: any) => [formatCOP(Number(value) || 0), "Facturación Diaria"]}
                      labelFormatter={(label) => `Fecha: ${label}`}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
           </div>
         </Card>
      </div>

    </div>
  );
}
