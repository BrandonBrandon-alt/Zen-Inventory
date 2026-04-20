"use client";

import React from "react";
import { Truck, Package, DollarSign, TrendingUp } from "lucide-react";

interface TransferImpact {
  activeTransfersCount: number;
  totalItemsInTransit: number;
  totalValuationInTransit: number;
}

interface TransfersImpactDisplayProps {
  data: TransferImpact;
}

const formatCOP = (val: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function TransfersImpactDisplay({ data }: TransfersImpactDisplayProps) {
  return (
    <div className="flex flex-col gap-6 p-6 bg-[var(--bg-card)] rounded-[32px] border border-[var(--neutral-800)] relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[var(--brand-500)] opacity-[0.03] blur-[60px] rounded-full pointer-events-none" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--brand-500)]/10 rounded-2xl">
            <Truck size={20} className="text-[var(--brand-500)]" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-[14px] font-black text-[var(--neutral-100)] uppercase tracking-tight leading-none">Logística en Tránsito</h3>
            <span className="text-[10px] font-bold text-[var(--neutral-500)] uppercase tracking-widest mt-1">Impacto comercial activo</span>
          </div>
        </div>
        <div className="px-3 py-1 bg-[var(--brand-500)] text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
          Activo
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Metric 1 */}
        <div className="bg-[var(--bg-surface)] p-5 rounded-[24px] border border-[var(--neutral-800)]/50">
          <div className="flex items-center gap-2 mb-3 text-[var(--neutral-500)]">
             <Package size={14} />
             <span className="text-[10px] font-black uppercase tracking-widest">Unidades</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-black text-[var(--neutral-50)]">{data.totalItemsInTransit}</span>
            <span className="text-[11px] font-bold text-[var(--neutral-500)] uppercase">Saliendo</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[var(--bg-surface)] p-5 rounded-[24px] border border-[var(--neutral-800)]/50">
          <div className="flex items-center gap-2 mb-3 text-[var(--neutral-500)]">
             <TrendingUp size={14} />
             <span className="text-[10px] font-black uppercase tracking-widest">Envíos</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-black text-[var(--neutral-50)]">{data.activeTransfersCount}</span>
            <span className="text-[11px] font-bold text-[var(--neutral-500)] uppercase">Rutas</span>
          </div>
        </div>
      </div>

      {/* Main Impact Card */}
      <div className="bg-gradient-to-br from-[var(--neutral-800)]/40 to-transparent p-6 rounded-[24px] border border-white/5 flex items-center justify-between group">
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-[var(--neutral-500)] uppercase tracking-widest mb-1 group-hover:text-[var(--brand-400)] transition-colors">Capital en Tránsito</span>
          <span className="text-[22px] font-black text-[var(--brand-500)] tabular-nums">{formatCOP(data.totalValuationInTransit)}</span>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--neutral-400)] group-hover:bg-[var(--brand-500)] group-hover:text-white transition-all shadow-xl">
          <DollarSign size={20} />
        </div>
      </div>

      <p className="text-[11px] text-[var(--neutral-500)] font-medium leading-relaxed px-1">
        Representa el valor total a precio de costo de los productos que han salido de origen pero no han sido recibidos en destino.
      </p>
    </div>
  );
}
