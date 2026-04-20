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
    <Card className="flex-1 min-w-[240px] p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 bg-[var(--bg-card)] border-[var(--neutral-800)] shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
      {/* Decorative Gradient Glow */}
      <div 
        className="absolute -top-10 -right-10 w-32 h-32 blur-[80px] opacity-20 transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em] mb-2 leading-none">
            {title}
          </p>
          <h3 className="text-2xl font-black text-[var(--neutral-50)] tracking-tight leading-none tabular-nums" style={{ textShadow: `0 0 20px color-mix(in srgb, ${color}, transparent 80%)` }}>
            {amount}
          </h3>
        </div>
        
        <div 
          className="p-3 rounded-2xl border transition-all duration-300 group-hover:scale-110"
          style={{ 
            background: `color-mix(in srgb, ${color}, transparent 95%)`,
            borderColor: `color-mix(in srgb, ${color}, transparent 80%)`,
            color: color,
            boxShadow: `0 8px 15px -5px color-mix(in srgb, ${color}, transparent 60%)`
          }}
        >
          {icon}
        </div>
      </div>
      
      {/* Background Icon Watermark */}
      <div 
        className="absolute -bottom-4 -right-4 opacity-[0.03] transition-all duration-500 group-hover:opacity-[0.08] group-hover:scale-110"
        style={{ color: color }}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 100, strokeWidth: 1 })}
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
