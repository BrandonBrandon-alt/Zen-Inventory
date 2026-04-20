import React from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart2, TrendingUp, DollarSign } from "lucide-react";

interface TransferAnalyticsTabProps {
  logisticsAnalytics: any;
  branchesMap: Map<number, string>;
}

export default function TransferAnalyticsTab({ logisticsAnalytics, branchesMap }: TransferAnalyticsTabProps) {
  if (!logisticsAnalytics) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fade-in 0.3s ease" }}>
      {/* Global KPI cards */}
      {logisticsAnalytics.globalMetrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <Card style={{ padding: "20px 24px", marginBottom: 0 }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Total Traslados</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--brand-400)" }}>{logisticsAnalytics.globalMetrics.totalTransfers}</p>
          </Card>
          <Card style={{ padding: "20px 24px", marginBottom: 0 }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Cumplimiento SLA</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#2ecc71" }}>{logisticsAnalytics.globalMetrics.onTimePercentage?.toFixed(1)}%</p>
          </Card>
          <Card style={{ padding: "20px 24px", marginBottom: 0 }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Retrasados</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-danger)" }}>{logisticsAnalytics.globalMetrics.delayedTransfers}</p>
          </Card>
          <Card style={{ padding: "20px 24px", marginBottom: 0 }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Demora Promedio</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#f39c12" }}>
              {logisticsAnalytics.globalMetrics.averageDelayHours > 24
                ? `${(logisticsAnalytics.globalMetrics.averageDelayHours / 24).toFixed(1)} días`
                : `${logisticsAnalytics.globalMetrics.averageDelayHours?.toFixed(1) || 0} hrs`}
            </p>
          </Card>
        </div>
      )}

      {/* Route Metrics Chart */}
      {logisticsAnalytics.topRoutes?.length > 0 ? (
        <Card style={{ padding: "24px", marginBottom: 0 }}>
          <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontWeight: 700, color: "var(--neutral-100)", fontSize: "15px", marginBottom: "4px" }}>Rendimiento por Ruta</h3>
              <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Top 10 rutas por volumen de traslados</p>
            </div>
            <TrendingUp size={18} style={{ color: "var(--brand-400)" }} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={logisticsAnalytics.topRoutes.map((r: any) => ({
                ruta: `${branchesMap.get(r.originBranchId) || `S${r.originBranchId}`} → ${branchesMap.get(r.destinationBranchId) || `S${r.destinationBranchId}`}`,
                total: r.totalTransfers,
                aTiempo: r.onTimeTransfers,
                retrasados: r.delayedTransfers,
                urgentes: r.urgentCount,
              }))}
              margin={{ top: 5, right: 30, left: 0, bottom: 80 }}
            >
              <XAxis
                dataKey="ruta"
                tick={{ fill: "var(--neutral-500)", fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: "var(--neutral-500)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "var(--surface-02)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "var(--neutral-100)" }}
              />
              <Legend wrapperStyle={{ paddingTop: "60px", fontSize: "12px" }} />
              <Bar dataKey="aTiempo" name="A tiempo" fill="#2ecc71" radius={[4,4,0,0]} />
              <Bar dataKey="retrasados" name="Retrasados" fill="#e74c3c" radius={[4,4,0,0]} />
              <Bar dataKey="urgentes" name="Alta prioridad" fill="#f39c12" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card style={{ padding: "24px", marginBottom: 0 }}>
          <EmptyState
            title="Sin datos de rutas"
            description="Aún no hay suficientes traslados completados para generar reportes por ruta."
            icon={<BarChart2 size={40} />}
          />
        </Card>
      )}

      {/* Route Detail Table */}
      {logisticsAnalytics.topRoutes?.length > 0 && (
        <Card style={{ padding: "24px", marginBottom: 0 }}>
          <h3 style={{ fontWeight: 700, color: "var(--neutral-100)", fontSize: "15px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <DollarSign size={16} style={{ color: "var(--brand-400)" }} />
            Desglose por Ruta
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {["Ruta", "Total", "A Tiempo", "Retrasados", "% SLA", "Demora Prom.", "Costo Total", "Alta Prior."].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logisticsAnalytics.topRoutes.map((r: any, i: number) => {
                  const sla = r.totalTransfers > 0 ? ((r.onTimeTransfers / (r.onTimeTransfers + r.delayedTransfers || 1)) * 100) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-default)", transition: "background 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px", color: "var(--neutral-100)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {branchesMap.get(r.originBranchId) || `Sucursal ${r.originBranchId}`}
                        <span style={{ color: "var(--neutral-500)", margin: "0 6px" }}>→</span>
                        {branchesMap.get(r.destinationBranchId) || `Sucursal ${r.destinationBranchId}`}
                      </td>
                      <td style={{ padding: "12px", color: "var(--neutral-300)" }}>{r.totalTransfers}</td>
                      <td style={{ padding: "12px" }}><Badge variant="success">{r.onTimeTransfers}</Badge></td>
                      <td style={{ padding: "12px" }}><Badge variant={r.delayedTransfers > 0 ? "danger" : "neutral"}>{r.delayedTransfers}</Badge></td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ color: sla >= 80 ? "#2ecc71" : sla >= 50 ? "#f39c12" : "#e74c3c", fontWeight: 700 }}>
                          {isNaN(sla) ? "—" : `${sla.toFixed(0)}%`}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "var(--neutral-400)" }}>
                        {r.averageDelayHours > 0
                          ? r.averageDelayHours > 24
                            ? `${(r.averageDelayHours / 24).toFixed(1)} días`
                            : `${r.averageDelayHours.toFixed(1)} hrs`
                          : <span style={{ color: "var(--neutral-600)" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px", color: "var(--neutral-200)", fontWeight: 600 }}>
                        {r.totalShippingCost > 0 ? `$${Number(r.totalShippingCost).toLocaleString("es-CO", { minimumFractionDigits: 0 })}` : <span style={{ color: "var(--neutral-600)" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {r.urgentCount > 0 ? <Badge variant="danger">{r.urgentCount}</Badge> : <span style={{ color: "var(--neutral-600)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
