"use client";

import React, { memo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import EmptyState from "@/components/ui/EmptyState";
import type { components } from "@/api/schema";

type BranchPerformance = components["schemas"]["BranchPerformance"];

interface BranchPerformanceChartProps {
  data: BranchPerformance[];
}

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

const BranchPerformanceChart = memo(function BranchPerformanceChart({ data }: BranchPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin datos"
        description="No hay sucursales con ventas registradas en el periodo."
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 20v-6M6 20V10M18 20V4" />
          </svg>
        }
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="branchName"
          stroke="var(--neutral-400)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--neutral-400)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={80}
          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
        />
        <Tooltip
          cursor={{ fill: "var(--bg-hover)" }}
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            color: "var(--neutral-100)",
          }}
          formatter={(value: any) => [formatCOP(Number(value) || 0), "Ingresos Netos"]}
        />
        <Bar dataKey="revenue" fill="var(--brand-500)" radius={[4, 4, 0, 0]} maxBarSize={60} />
      </BarChart>
    </ResponsiveContainer>
  );
});

export default BranchPerformanceChart;
