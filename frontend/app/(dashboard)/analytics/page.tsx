"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  BarChart3, 
  Activity, 
  DollarSign, 
  Package, 
  ShoppingCart,
  ArrowRight,
  TrendingDown,
  ChevronRight
} from "lucide-react";

// Charts
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from "recharts";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import DataTable, { Column } from "@/components/ui/DataTable";
import Spinner from "@/components/ui/Spinner";

type GlobalSummary = components["schemas"]["GlobalSummary"];
type BranchPerformance = components["schemas"]["BranchPerformance"];
type SalesTrend = components["schemas"]["SalesTrend"];
type TopSellingProduct = components["schemas"]["TopSellingProduct"];
type BranchValuation = components["schemas"]["BranchValuation"];

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [performance, setPerformance] = useState<BranchPerformance[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [valuations, setValuations] = useState<BranchValuation[]>([]);

  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    async function fetchData() {
      try {
        const { data, error } = await apiClient.GET("/api/v1/analytics/dashboard");

        if (data) {
          setSummary(data.summary ?? null);
          setPerformance(data.performance ?? []);
          setSalesTrend(data.salesTrend ?? []);
          setTopProducts(data.topProducts ?? []);
          setValuations(data.valuations ?? []);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  // Derived Values
  const maxRevenuePerformance = useMemo(() => 
    Math.max(...performance.map(p => p.revenue ?? 0), 1), 
  [performance]);

  if (loading) return <Spinner fullPage />;

  const columns: Column<BranchPerformance>[] = [
    {
      header: "Sede",
      key: "branchName",
      render: (p) => <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-100)" }}>{p.branchName}</span>
    },
    {
      header: "Ingresos",
      key: "revenue",
      align: "right",
      render: (p) => <span style={{ fontSize: "14px", color: "var(--brand-400)", fontWeight: 600 }}>{formatCOP(p.revenue ?? 0)}</span>
    },
    {
      header: "Transacciones",
      key: "salesCount",
      align: "right",
      render: (p) => <span style={{ fontSize: "14px", color: "var(--neutral-400)", fontFamily: "monospace" }}>{p.salesCount}</span>
    },
    {
      header: "Eficiencia",
      key: "unitsSold",
      align: "right",
      render: (p) => (
        <Badge variant="neutral">
          {p.unitsSold} uds
        </Badge>
      )
    }
  ];

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <PageHeader
        title="Análisis Global"
        description="Perspectiva holística del rendimiento operativo y financiero de la red."
      />

      {/* Primary KPI Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
        gap: "20px" 
      }}>
        <Card style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ingresos Totales</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(217, 99, 79, 0.1)", color: "var(--brand-500)" }}>
              <DollarSign size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)", marginBottom: "8px" }}>{formatCOP(summary?.totalRevenue ?? 0)}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--color-success)" }}>
            <TrendingUp size={14} />
            <span>Verificado</span>
          </div>
        </Card>

        <Card style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Valor de Activos</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "var(--neutral-800)", color: "var(--neutral-400)" }}>
              <Package size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)", marginBottom: "8px" }}>{formatCOP(summary?.totalInventoryValue ?? 0)}</h2>
          <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Consolidado en {summary?.branchCount} sedes</span>
        </Card>

        <Card style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ticket Promedio</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "var(--neutral-800)", color: "var(--neutral-400)" }}>
              <ShoppingCart size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)", marginBottom: "8px" }}>{formatCOP(summary?.averageTicket ?? 0)}</h2>
          <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Por cada transacción</span>
        </Card>

        <Card style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Volumen de Red</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "var(--neutral-800)", color: "var(--neutral-400)" }}>
              <Activity size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)", marginBottom: "8px" }}>{(summary?.totalUnitsSold ?? 0).toLocaleString()}</h2>
          <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Unidades movilizadas</span>
        </Card>
      </div>

      {/* Main Analysis Section */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Sales Trend vs Performance */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card title="Evolución de Ingresos" style={{ padding: "24px", minHeight: "400px" }}>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-500)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--brand-500)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-800)" vertical={false} />
                  <XAxis 
                    dataKey="saleDate" 
                    fontSize={11} 
                    stroke="var(--neutral-500)" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                  />
                  <YAxis 
                    fontSize={11} 
                    stroke="var(--neutral-500)" 
                    tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip 
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--neutral-700)", borderRadius: "8px" }}
                    labelStyle={{ color: "var(--neutral-100)", fontWeight: 600, marginBottom: "4px" }}
                    itemStyle={{ color: "var(--brand-400)" }}
                    formatter={(val: any) => [formatCOP(Number(val) || 0), "Ingresos"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--brand-500)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Desempeño Comparativo por Sede" style={{ padding: 0, overflow: "hidden" }}>
            <DataTable<BranchPerformance>
              columns={columns}
              data={performance}
              isLoading={loading}
            />
          </Card>
        </div>

        {/* Top Products & Value Distribution */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card title="Distribución de Valor" style={{ padding: "24px" }}>
               <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valuations} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-800)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="branchName" 
                    type="category" 
                    fontSize={11} 
                    stroke="var(--neutral-300)" 
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--neutral-700)", borderRadius: "8px" }}
                    formatter={(val: any) => [formatCOP(Number(val) || 0), "Valor Inventario"]}
                  />
                  <Bar dataKey="totalValue" radius={[0, 4, 4, 0]}>
                    {valuations.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "var(--brand-500)" : "var(--neutral-600)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Top 5 Productos Estrella" style={{ padding: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {topProducts.map((p, idx) => (
                <div key={p.productId} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ 
                    width: "32px", 
                    height: "32px", 
                    borderRadius: "8px", 
                    background: idx === 0 ? "var(--brand-900)" : "var(--neutral-800)",
                    color: idx === 0 ? "var(--brand-400)" : "var(--neutral-500)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 700
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-100)" }}>{p.productName}</p>
                    <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>ID: {p.productId}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-200)" }}>{p.totalSoldQuantity}</p>
                    <p style={{ fontSize: "10px", color: "var(--neutral-600)", textTransform: "uppercase" }}>Uds</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" style={{ marginTop: "8px", width: "100%", justifyContent: "space-between" }}>
                Ver catálogo completo <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
