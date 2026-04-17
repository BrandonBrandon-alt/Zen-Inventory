"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { TrendingUp, BarChart3, Activity, Users, DollarSign, Package, ShoppingCart } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable, { Column } from "@/components/ui/DataTable";
import Spinner from "@/components/ui/Spinner";

type GlobalSummary = components["schemas"]["GlobalSummary"];
type BranchPerformance = components["schemas"]["BranchPerformance"];

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [performance, setPerformance] = useState<BranchPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    async function fetchData() {
      try {
        const [sumRes, perfRes] = await Promise.all([
          apiClient.GET("/api/v1/analytics/global-summary"),
          apiClient.GET("/api/v1/analytics/branch-performance"),
        ]);
        setSummary(sumRes.data ?? null);
        setPerformance(perfRes.data ?? []);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  if (loading) return <Spinner fullPage />;

  const maxRevenue = Math.max(...performance.map((p) => p.revenue ?? 0), 1);

  const columns: Column<BranchPerformance>[] = [
    {
      header: "Sede",
      key: "branchName",
      render: (p) => <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-100)" }}>{p.branchName}</span>
    },
    {
      header: "Transacciones",
      key: "salesCount",
      align: "right",
      render: (p) => <span style={{ fontSize: "14px", color: "var(--neutral-300)", fontFamily: "monospace" }}>{p.salesCount}</span>
    },
    {
      header: "Uds Vendidas",
      key: "unitsSold",
      align: "right",
      render: (p) => (
        <Badge variant="neutral">
          <span style={{ fontWeight: 600 }}>{p.unitsSold}</span>
        </Badge>
      )
    }
  ];

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Análisis Global"
        description="Rendimiento comparativo y métricas consolidadas de todas las sucursales de la red."
      />

      {/* Stats Overview */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
        gap: "24px",
        marginBottom: "40px",
        marginTop: "32px"
      }}>
        <Card style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Ingresos Totales</p>
              <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)" }}>{formatCOP(summary?.totalRevenue ?? 0)}</h2>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(34, 197, 94, 0.1)", color: "#4ade80" }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>
            <TrendingUp size={14} />
            <span>+12.5% desde el último mes</span>
          </div>
        </Card>

        <Card style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Valor Inventario</p>
              <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)" }}>{formatCOP(summary?.totalInventoryValue ?? 0)}</h2>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", background: "var(--brand-900)", color: "var(--brand-400)" }}>
              <Package size={20} />
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Consolidado de {summary?.branchCount} sedes activas</p>
        </Card>

        <Card style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Unidades Vendidas</p>
              <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--neutral-50)" }}>{(summary?.totalUnitsSold ?? 0).toLocaleString()}</h2>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>
              <ShoppingCart size={20} />
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Media de {formatCOP(summary?.averageTicket ?? 0)} por ticket</p>
        </Card>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", 
        gap: "32px"
      }}>
        {/* Branch Comparison */}
        <Card style={{ padding: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
            <BarChart3 size={20} style={{ color: "var(--brand-500)" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--neutral-100)" }}>Ingresos por Sede</h3>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {performance.map((p) => (
              <div key={p.branchId}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--neutral-200)" }}>{p.branchName}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-400)" }}>{formatCOP(p.revenue ?? 0)}</span>
                </div>
                <div style={{ 
                  height: "8px", 
                  background: "var(--neutral-900)", 
                  borderRadius: "4px", 
                  overflow: "hidden" 
                }}>
                  <div style={{ 
                    height: "100%", 
                    width: `${((p.revenue ?? 0) / maxRevenue) * 100}%`,
                    background: "linear-gradient(90deg, var(--brand-600), var(--brand-400))",
                    borderRadius: "4px",
                    transition: "width 1s ease-in-out"
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Operational Metrics */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "32px 32px 0 32px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
            <Activity size={20} style={{ color: "var(--brand-500)" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--neutral-100)" }}>Métricas Operativas</h3>
          </div>
          <DataTable<BranchPerformance>
            columns={columns}
            data={performance}
            isLoading={loading}
          />
        </Card>
      </div>
    </div>
  );
}
