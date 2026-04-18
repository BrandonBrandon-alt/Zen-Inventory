"use client";

import React from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Plus, Eye } from "lucide-react";

interface InventoryItem {
  id: number;
  productId: number;
  productoNombre: string;
  sku: string;
  stockActual: number;
  precioVenta: number;
}

interface InventoryItemCardProps {
  item: InventoryItem;
  onClick: (item: InventoryItem) => void;
  mode?: "add" | "view";
  priceOverride?: number | null;
  priceListName?: string | null;
  priceListVariant?: "success" | "danger" | "warning" | "neutral" | "info";
}

export default function InventoryItemCard({ item, onClick, mode = "add", priceOverride, priceListName, priceListVariant = "info" }: InventoryItemCardProps) {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

  const finalPrice = priceOverride || item.precioVenta;
  const isOverride = !!priceOverride && priceOverride !== item.precioVenta;

  return (
    <Card 
      onClick={() => onClick(item)}
      className={`p-5 cursor-pointer transition-all border-[var(--neutral-700)] bg-[var(--bg-card)] shadow-md hover:border-[var(--brand-500)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] group relative overflow-hidden ${item.stockActual <= 0 ? 'opacity-50 grayscale pointer-events-none' : ''}`}
    >
      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-[var(--brand-500)] text-[var(--neutral-50)] p-1 rounded-bl-lg shadow-lg">
          {mode === "add" ? <Plus className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </div>
      </div>
      
      <div className="flex justify-between items-start mb-4">
        <Badge variant={item.stockActual > 10 ? "success" : "warning"}>
          {item.stockActual} en stock
        </Badge>
        <span className="text-[11px] font-mono text-[var(--neutral-400)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--neutral-800)]">{item.sku}</span>
      </div>
      
      <h3 className="font-bold text-[var(--neutral-100)] group-hover:text-[var(--brand-400)] transition-colors line-clamp-2 min-h-[3rem] text-lg uppercase tracking-tight">
        {item.productoNombre}
      </h3>
      
      <div className="mt-6 flex items-baseline justify-between">
        <div className="flex flex-col">
            <p className="text-[10px] text-[var(--neutral-500)] uppercase font-black tracking-tighter">
              {isOverride ? "Precio de Lista" : "Precio de Venta"}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-black ${isOverride ? 'text-[var(--brand-400)]' : 'text-[var(--neutral-50)]'}`}>
                {formatCurrency(finalPrice)}
              </span>
              {isOverride && (
                <span className="text-[10px] line-through text-[var(--neutral-600)] font-bold">
                  {formatCurrency(item.precioVenta)}
                </span>
              )}
            </div>
        </div>
        {isOverride && (
          <Badge variant={priceListVariant} dot>{priceListName || "LISTA"}</Badge>
        )}
      </div>
    </Card>
  );
}
