"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { DollarSign, Package, ShoppingCart, Activity } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import Spinner from "@/components/ui/Spinner";
import KpiCard from "@/components/ui/KpiCard";
import Badge from "@/components/ui/Badge";

import SalesTrendChart from "@/components/dashboard/SalesTrendChart";
import TopProductsList from "@/components/dashboard/TopProductsList";
import ValuationBarChart from "@/components/dashboard/ValuationBarChart";

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
    if (!session || (session.rol !== "ADMIN" && session.rol !== "MANAGER")) {
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

  // Derived columns (useMemo para no recomputar referencias de DataTable)
  const columns: Column<BranchPerformance>[] = useMemo(() => [
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
  ], []);

  if (loading) return <Spinner fullPage />;

  const session = getSession();
  const isAdmin = session?.rol === "ADMIN";

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <PageHeader
        title={isAdmin ? "Análisis Global de Red" : "Análisis de Mi Sede"}
        description={isAdmin
          ? "Perspectiva holística del rendimiento operativo y financiero de toda la red."
          : "Métricas operativas y financieras de tu sucursal en tiempo real."
        }
      />

      {/* Primary KPI Cards (Reusing KpiCard Component) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        <KpiCard
          label="Ingresos Totales"
          value={formatCOP(summary?.totalRevenue ?? 0)}
          sub="Verificado"
          icon={<DollarSign size={20} />}
          accent="var(--brand-500)"
          delay="0s"
        />
        <KpiCard
          label="Valor de Activos"
          value={formatCOP(summary?.totalInventoryValue ?? 0)}
          sub={`Consolidado en ${summary?.branchCount} sedes`}
          icon={<Package size={20} />}
          delay="0.1s"
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatCOP(summary?.averageTicket ?? 0)}
          sub="Por cada transacción"
          icon={<ShoppingCart size={20} />}
          delay="0.2s"
        />
        <KpiCard
          label="Volumen de Red"
          value={(summary?.totalUnitsSold ?? 0).toLocaleString()}
          sub="Unidades movilizadas"
          icon={<Activity size={20} />}
          delay="0.3s"
        />
      </div>

      {/* Main Analysis Section */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Sales Trend vs Performance */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card title="Evolución de Ingresos" style={{ padding: "24px", minHeight: "400px" }}>
            <div style={{ width: "100%", height: 320 }}>
              <SalesTrendChart data={salesTrend} variant="area" />
            </div>
          </Card>

          <Card title="Desempeño Comparativo por Sede" style={{ padding: 0, overflow: "hidden" }}>
            <DataTable<BranchPerformance>
              itemsPerPage={25}
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
              <ValuationBarChart data={valuations} />
            </div>
          </Card>

          <Card title="Top 5 Productos Estrella" style={{ padding: "24px" }}>
            <TopProductsList products={topProducts} showViewAll />
          </Card>
        </div>
      </div>
    </div>
  );
}
