"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { ArrowRight, Truck, Package, Clock, CheckCircle2, History } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable, { Column } from "@/components/ui/DataTable";
import Spinner from "@/components/ui/Spinner";

type TransferResponse = components["schemas"]["TransferResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

export default function TransferMonitorPage() {
  const router = useRouter();
  const [transfers, setTransfers] = useState<TransferResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    async function fetchData() {
      try {
        const [transRes, branchRes] = await Promise.all([
          apiClient.GET("/api/v1/transfers"),
          apiClient.GET("/api/branches"),
        ]);
        setTransfers(transRes.data ?? []);
        setBranches(branchRes.data ?? []);
      } catch (error) {
        console.error("Error fetching transfers:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const getBranchName = (id: number) => branches.find(b => b.id === id)?.nombre ?? `Sede ${id}`;

  const columns: Column<TransferResponse>[] = [
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
          <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{getBranchName(t.originBranchId || 0)}</span>
          <ArrowRight size={12} style={{ color: "var(--neutral-600)" }} />
          <span style={{ fontSize: "13px", color: "var(--neutral-100)", fontWeight: 600 }}>{getBranchName(t.destinationBranchId || 0)}</span>
        </div>
      )
    },
    {
      header: "Estado",
      key: "status",
      width: "130px",
      render: (t) => {
        const status = t.status || "PENDIENTE";
        let variant: "neutral" | "success" | "warning" | "error" = "neutral";
        let icon = <Clock size={12} />;
        
        if (status === "ENTREGADO") {
          variant = "success";
          icon = <CheckCircle2 size={12} />;
        } else if (status === "EN_TRANSITO") {
          variant = "warning";
          icon = <Truck size={12} />;
        }

        return (
          <Badge variant={variant as any} dot>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {icon}
              {status}
            </div>
          </Badge>
        );
      }
    },
    {
      header: "Items",
      key: "details",
      render: (t) => (
        <span style={{ fontSize: "13px", color: "var(--neutral-400)" }}>
          {t.details?.length} productos
        </span>
      )
    },
    {
      header: "Llegada Est.",
      key: "estimatedArrivalDate",
      align: "right",
      render: (t) => (
        <span style={{ fontSize: "13px", color: "var(--neutral-500)", fontFamily: "monospace" }}>
          {t.estimatedArrivalDate ? new Date(t.estimatedArrivalDate).toLocaleDateString() : "—"}
        </span>
      )
    }
  ];

  if (loading) return <Spinner fullPage />;

  const activeTransfers = transfers.filter(t => t.status !== "ENTREGADO").length;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Monitor Logístico"
        description="Seguimiento en tiempo real de todos los traslados de mercancía entre sucursales."
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
          <Card style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", marginBottom: "0px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>Traslados Activos</span>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--brand-500)" }}>{activeTransfers}</span>
            </div>
            <div style={{ padding: "8px", borderRadius: "8px", background: "var(--brand-900)", color: "var(--brand-400)" }}>
              <Truck size={20} />
            </div>
          </Card>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <DataTable<TransferResponse>
          columns={columns}
          data={transfers}
          isLoading={loading}
          emptyState={{
            title: "Sin actividad logística",
            description: "No hay traslados registrados en el sistema.",
            icon: <History size={40} />
          }}
        />
      </Card>
    </div>
  );
}
