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
  Cell,
} from "recharts";
import EmptyState from "@/components/ui/EmptyState";
import type { components } from "@/api/schema";

type BranchValuation = components["schemas"]["BranchValuation"];

interface ValuationBarChartProps {
  data: BranchValuation[];
}

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

const ValuationBarChart = memo(function ValuationBarChart({ data }: ValuationBarChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin inventario"
        description="No hay información de valoración de sucursales."
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 8l-9-4-9 4m18 8l-9 4-9-4m18-4l-9 4-9-4m9-11v11" />
          </svg>
        }
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="branchName"
          type="category"
          fontSize={11}
          stroke="var(--neutral-400)"
          width={80}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--bg-hover)" }}
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            color: "var(--neutral-100)",
          }}
          formatter={(val: any) => [formatCOP(Number(val) || 0), "Valor Inventario"]}
        />
        <Bar dataKey="totalValue" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={index === 0 ? "var(--brand-500)" : "var(--neutral-600)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export default ValuationBarChart;
