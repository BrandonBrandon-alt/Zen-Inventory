"use client";

import React, { useState } from "react";
import Badge from "@/components/ui/Badge";
import { AlertCircle, TrendingDown, Target, HelpCircle } from "lucide-react";

interface InventoryRotation {
  productId: number;
  productName: string;
  soldQuantity: number;
  currentStock: number;
  rotationRatio: number;
  isDeadStock: boolean;
  inactiveDays: number;
}


interface InventoryInsightTableProps {
  data: InventoryRotation[];
}

export default function InventoryInsightTable({ data }: InventoryInsightTableProps) {
  const [activeTab, setActiveTab] = useState<"dead" | "low">("dead");

  const deadStock = data.filter(i => i.isDeadStock).slice(0, 10);
  // Low rotation: Sold > 0 but low ratio (bottom 10% or just lowest we have)
  const lowRotation = data
    .filter(i => !i.isDeadStock && i.soldQuantity > 0)
    .sort((a, b) => a.rotationRatio - b.rotationRatio)
    .slice(0, 10);

  const currentData = activeTab === "dead" ? deadStock : lowRotation;

  return (
    <div className="flex flex-col gap-6">
      {/* Tab Selectors */}
      <div className="flex bg-[var(--bg-card)] p-1.5 rounded-2xl border border-[var(--border-subtle)] w-fit">
        <button
          onClick={() => setActiveTab("dead")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${
            activeTab === "dead" 
            ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] shadow-sm" 
            : "text-[var(--neutral-400)] hover:text-[var(--neutral-200)]"
          }`}
        >
          <AlertCircle size={14} />
          Stock Muerto
          {deadStock.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-[var(--color-danger)] text-white text-[10px] rounded-full">{deadStock.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("low")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${
            activeTab === "low" 
            ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)] shadow-sm" 
            : "text-[var(--neutral-400)] hover:text-[var(--neutral-200)]"
          }`}
        >
          <TrendingDown size={14} />
          Baja Rotación
        </button>
      </div>

      {/* Header Info */}
      <div className="flex items-start gap-4 p-4 bg-[var(--bg-surface)] rounded-3xl border border-[var(--neutral-800)]">
        <div className={`p-2 rounded-2xl ${activeTab === 'dead' ? 'bg-[var(--color-danger)]/10' : 'bg-[var(--color-warning)]/10'}`}>
          {activeTab === 'dead' ? <Target className="text-[var(--color-danger)]" size={20} /> : <TrendingDown className="text-[var(--color-warning)]" size={20} />}
        </div>
        <div>
          <h4 className="text-[13px] font-black text-[var(--neutral-100)] uppercase tracking-tight">
            {activeTab === 'dead' ? 'Análisis de Capital Estancado' : 'Optimización de Inventario'}
          </h4>
          <p className="text-[12px] text-[var(--neutral-400)] font-medium leading-relaxed mt-0.5">
            {activeTab === 'dead' 
              ? 'Productos con stock físico que no han registrado ventas en los últimos 30 días.' 
              : 'Productos con movimiento pero cuya velocidad de salida es ineficiente respecto al stock.'}
          </p>
        </div>
      </div>

      {/* Table List */}
      <div className="overflow-hidden">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest leading-none">
              <th className="px-4 pb-2">Producto</th>
              <th className="px-4 pb-2 text-center">Stock</th>
              <th className="px-4 pb-2 text-center">Días Inactivo</th>
              <th className="px-4 pb-2 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? currentData.map((item) => (
              <tr key={item.productId} className="group bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] transition-colors">
                <td className="px-4 py-3 rounded-l-2xl border-y border-l border-[var(--neutral-800)] group-hover:border-[var(--neutral-700)]">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-[var(--neutral-200)] uppercase">{item.productName}</span>
                    <span className="text-[10px] font-medium text-[var(--neutral-500)]">ID: #{item.productId}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center border-y border-[var(--neutral-800)] group-hover:border-[var(--neutral-700)]">
                  <span className="text-[14px] font-black text-[var(--neutral-100)]">{item.currentStock} <span className="text-[10px] opacity-40">u</span></span>
                </td>
                <td className="px-4 py-3 text-center border-y border-[var(--neutral-800)] group-hover:border-[var(--neutral-700)]">
                  <div className="flex flex-col items-center">
                     <span className={`text-[13px] font-black ${activeTab === 'dead' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'}`}>
                        {item.inactiveDays} {item.inactiveDays === 1 ? 'día' : 'días'}
                     </span>
                     <div className="w-12 h-1 bg-[var(--neutral-800)] rounded-full mt-1 overflow-hidden">
                        <div 
                          className={`h-full ${activeTab === 'dead' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-warning)]'}`} 
                          style={{ width: `${Math.min((item.inactiveDays / 30) * 100, 100)}%` }} 
                        />
                     </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right rounded-r-2xl border-y border-r border-[var(--neutral-800)] group-hover:border-[var(--neutral-700)]">
                   <Badge variant={activeTab === 'dead' ? 'danger' : 'warning'} dot>
                     {activeTab === 'dead' ? 'Muerto' : 'Lento'}
                   </Badge>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="py-20 text-center bg-[var(--bg-surface)] rounded-3xl border border-[var(--neutral-800)] border-dashed">
                   <HelpCircle className="mx-auto mb-3 text-[var(--neutral-500)] opacity-30" size={32} />
                   <span className="text-[13px] font-medium text-[var(--neutral-500)]">No se detectaron problemas de {activeTab === 'dead' ? 'stock estancado' : 'baja rotación'}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
