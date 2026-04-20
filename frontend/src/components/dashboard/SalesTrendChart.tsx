"use client";

import React, { memo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import EmptyState from "@/components/ui/EmptyState";

type SalesTrend = { saleDate?: string; revenue?: number };

interface SalesTrendChartProps {
  data: SalesTrend[];
  variant?: "line" | "area";
}

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

const SalesTrendChart = memo(function SalesTrendChart({ data, variant = "line" }: SalesTrendChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin histórico"
        description="No hay tendencia de ventas disponible en el periodo seleccionado."
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" />
            <path d="M18 9l-5 5-3-3-5 5" />
          </svg>
        }
      />
    );
  }

  const RenderChart = variant === "area" ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RenderChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
        <defs>
          {variant === "area" && (
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand-500)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--brand-500)" stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="saleDate"
          stroke="var(--neutral-400)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
          tickFormatter={(val) => {
             // Avoid formatting "Hoy" or "Este Mes" if string
             if (isNaN(Date.parse(val))) return val;
             return new Date(val).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
          }}
        />
        <YAxis
          stroke="var(--neutral-400)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={80}
          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
          formatter={(value: any) => [formatCOP(Number(value) || 0), "Ingresos Netos"]}
          labelFormatter={(label) => `Fecha: ${label}`}
        />
        {variant === "line" ? (
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--brand-500)"
            strokeWidth={3}
            dot={{ r: 4, fill: "var(--brand-500)", strokeWidth: 0 }}
            activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
          />
        ) : (
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--brand-500)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        )}
      </RenderChart>
    </ResponsiveContainer>
  );
});

export default SalesTrendChart;
