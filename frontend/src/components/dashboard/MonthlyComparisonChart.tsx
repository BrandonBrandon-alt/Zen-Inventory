"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";

interface MonthlySales {
  monthName: string;
  year: number;
  revenue: number;
  volume: number;
}

interface MonthlyComparisonChartProps {
  data: MonthlySales[];
}

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function MonthlyComparisonChart({ data }: MonthlyComparisonChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin registros mensuales"
        description="No hay suficientes datos históricos para generar la comparativa."
        icon={<BarChart3 size={40} className="opacity-20" />}
      />
    );
  }

  // Reverse data to show chronological order (Backend usually returns DESC)
  const chartData = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis 
          dataKey="monthName" 
          stroke="var(--neutral-400)" 
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val) => val.substring(0, 3).toUpperCase()}
        />
        <YAxis 
          stroke="var(--neutral-400)" 
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
          formatter={(value: any, name: any) => {
            if (name === "revenue") return [formatCOP(value), "Facturación"];
            return [value, "Unidades"];
          }}
          labelFormatter={(label, payload) => {
            const item = payload[0]?.payload;
            return item ? `${item.monthName} ${item.year}` : label;
          }}
        />
        <Bar 
          dataKey="revenue" 
          name="Facturación" 
          radius={[6, 6, 0, 0]}
          barSize={40}
        >
          {chartData.map((_entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={index === chartData.length - 1 ? "var(--brand-500)" : "var(--neutral-700)"} 
            />
          ))}
        </Bar>barChart
      </BarChart>
    </ResponsiveContainer>
  );
}
