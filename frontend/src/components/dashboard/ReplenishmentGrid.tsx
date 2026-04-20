"use client";

import React from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { ShoppingCart, ArrowUpRight, Zap, AlertTriangle } from "lucide-react";

interface ReplenishmentInsight {
  productId: number;
  productName: string;
  currentStock: number;
  minStock: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface ReplenishmentGridProps {
  data: ReplenishmentInsight[];
}

export default function ReplenishmentGrid({ data }: ReplenishmentGridProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-card)] rounded-3xl border border-dashed border-[var(--neutral-800)]">
         <Zap size={32} className="text-[var(--color-success)] opacity-30 mb-3" />
         <span className="text-[14px] font-bold text-[var(--neutral-100)] uppercase tracking-tight">Stock Saludable</span>
         <p className="text-[12px] text-[var(--neutral-400)] mt-1">No hay productos que requieran reabastecimiento urgente.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {data.slice(0, 4).map((item) => (
        <div 
          key={item.productId} 
          className="group relative bg-[var(--bg-surface)] p-5 rounded-3xl border border-[var(--neutral-800)] hover:border-[var(--brand-500)]/30 transition-all overflow-hidden"
        >
          {/* Accent decoration */}
          <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5 transition-opacity group-hover:opacity-10 ${item.priority === 'HIGH' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-warning)]'}`} />
          
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-2xl ${item.priority === 'HIGH' ? 'bg-[var(--color-danger)]/10' : 'bg-[var(--color-warning)]/10'}`}>
              <AlertTriangle size={18} className={item.priority === 'HIGH' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'} />
            </div>
            <Badge variant={item.priority === 'HIGH' ? 'danger' : 'warning'} dot>
              {item.priority === 'HIGH' ? 'Urgente' : 'Programar'}
            </Badge>
          </div>

          <div className="flex flex-col mb-4">
            <span className="text-[14px] font-black text-[var(--neutral-100)] uppercase truncate">{item.productName}</span>
            <span className="text-[10px] font-bold text-[var(--neutral-500)] uppercase tracking-widest">ID: #{item.productId}</span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--neutral-800)]/50">
            <div className="flex flex-col">
               <span className="text-[10px] font-medium text-[var(--neutral-500)] uppercase">Stock Actual</span>
               <span className={`text-[16px] font-black ${item.priority === 'HIGH' ? 'text-[var(--color-danger)]' : 'text-[var(--neutral-200)]'}`}>
                 {item.currentStock} <span className="text-[11px] opacity-40 font-bold">u</span>
               </span>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-medium text-[var(--neutral-500)] uppercase">Punto Mínimo</span>
               <span className="text-[16px] font-black text-[var(--neutral-100)] opacity-60">
                 {item.minStock} <span className="text-[11px] opacity-40 font-bold">u</span>
               </span>
            </div>
          </div>

          <Link 
            href={`/purchases?productId=${item.productId}`}
            className="w-full mt-5 flex items-center justify-center gap-2 py-3 bg-[var(--bg-card)] border border-[var(--neutral-800)] rounded-2xl text-[11px] font-black uppercase text-[var(--neutral-300)] hover:bg-[var(--brand-500)] hover:text-white hover:border-[var(--brand-500)] transition-all"
          >
            <ShoppingCart size={14} />
            Crear Compra
            <ArrowUpRight size={12} className="opacity-50" />
          </Link>
        </div>
      ))}
    </div>
  );
}
