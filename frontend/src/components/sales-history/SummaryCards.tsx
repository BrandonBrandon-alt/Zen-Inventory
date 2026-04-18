import React from "react";
import { TrendingUp, Calendar, Clock } from "lucide-react";
import Card from "../ui/Card";

interface SummaryCardProps {
  title: string;
  amount: string;
  icon: React.ReactNode;
  color: string;
}

function SummaryItem({ title, amount, icon, color }: SummaryCardProps) {
  return (
    <Card style={{ 
      flex: 1, 
      minWidth: "240px", 
      padding: "24px",
      position: "relative",
      overflow: "hidden",
      border: "1px solid var(--neutral-800)",
      background: "var(--bg-card)",
      boxShadow: "0 4px 20px -5px rgba(0,0,0,0.3)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            {title}
          </p>
          <h3 style={{ fontSize: "28px", fontWeight: 800, color: "var(--neutral-50)", margin: 0 }}>
            {amount}
          </h3>
        </div>
        <div style={{ 
          padding: "12px", 
          borderRadius: "14px", 
          background: `color-mix(in srgb, ${color}, transparent 90%)`,
          color: color,
          boxShadow: `0 0 15px -5px ${color}`
        }}>
          {icon}
        </div>
      </div>
      <div style={{ 
        position: "absolute", 
        bottom: "-15px", 
        right: "-15px", 
        opacity: 0.05,
        transform: "scale(3.5)",
        color: color
      }}>
        {icon}
      </div>
    </Card>
  );
}

interface SummaryCardsProps {
  daily: string;
  weekly: string;
  monthly: string;
  total: string;
}

export default function SummaryCards({ daily, weekly, monthly, total }: SummaryCardsProps) {
  return (
    <div style={{ 
      display: "flex", 
      gap: "24px", 
      marginBottom: "32px", 
      flexWrap: "wrap",
      animation: "fade-in-up 0.5s ease-out"
    }}>
      <SummaryItem 
        title="Ventas de Hoy" 
        amount={daily} 
        icon={<Clock size={22} />} 
        color="var(--brand-400)" 
      />
      <SummaryItem 
        title="Esta Semana" 
        amount={weekly} 
        icon={<TrendingUp size={22} />} 
        color="var(--color-info)" 
      />
      <SummaryItem 
        title="Este Mes" 
        amount={monthly} 
        icon={<Calendar size={22} />} 
        color="var(--color-success)" 
      />
      <SummaryItem 
        title="Ventas Totales" 
        amount={total} 
        icon={<TrendingUp size={22} />} 
        color="var(--color-info)" 
      />
    </div>
  );
}
