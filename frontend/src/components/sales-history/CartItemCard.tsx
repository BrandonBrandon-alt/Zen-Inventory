"use client";

import React from "react";
import { Tag, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import QuantitySelector from "@/components/ui/QuantitySelector";

interface CartItem {
  productId: number;
  nombre: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  stockAvailable: number;
  priceListId: number | null;
}

interface CartItemCardProps {
  item: CartItem;
  priceLists: { id: number; nombre: string }[];
  updateQuantity: (id: number, delta: number) => void;
  setQuantity: (id: number, val: number) => void;
  updateDiscount: (id: number, pct: number) => void;
  removeFromCart: (id: number) => void;
  updateItemPriceList: (id: number, listId: number | null) => void;
  formatCurrency: (val: number) => string;
}

export default function CartItemCard({
  item,
  priceLists,
  updateQuantity,
  setQuantity,
  updateDiscount,
  removeFromCart,
  updateItemPriceList,
  formatCurrency
}: CartItemCardProps) {
  return (
    <div className="p-4 bg-[var(--bg-card)] rounded-[16px] flex flex-col gap-3 relative animate-fade-in shadow-sm">
      <div className="flex justify-between gap-[10px]">
        <div className="flex-1">
          <h4 className="text-[14px] font-bold text-[var(--neutral-50)] m-0 leading-[1.2] uppercase">
            {item.nombre}
          </h4>
          <span className="text-[10px] font-extrabold text-[var(--brand-400)] font-mono">
            {item.sku}
          </span>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <p className="text-[14px] font-extrabold text-[var(--neutral-50)] m-0">
              {formatCurrency(item.unitPrice * item.quantity)}
            </p>

            <div className="relative">
              <select
                value={item.priceListId || ""}
                onChange={(e) => updateItemPriceList(item.productId, e.target.value ? Number(e.target.value) : null)}
                className="appearance-none border border-current rounded-md px-2 py-0.5 pr-5 text-[10px] font-extrabold cursor-pointer outline-none uppercase transition-all"
                style={{
                  background: item.priceListId === 2 ? "var(--color-success-bg)" : item.priceListId === 3 ? "var(--color-warning-bg)" : "var(--brand-500-10)",
                  color: item.priceListId === 2 ? "var(--color-success)" : item.priceListId === 3 ? "var(--color-warning)" : "var(--brand-400)",
                }}
              >
                <option value="">MINORISTA</option>
                {priceLists.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre.toUpperCase()}</option>
                ))}
              </select>
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
                <Tag size={8} />
              </div>
            </div>
          </div>
          {item.discountPercentage > 0 && (
            <Badge variant="success" dot className="mt-1">{item.discountPercentage}% Dto</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <QuantitySelector
          value={item.quantity}
          onIncrease={() => updateQuantity(item.productId, 1)}
          onDecrease={() => updateQuantity(item.productId, -1)}
          onChange={(val: number) => setQuantity(item.productId, val)}
          max={item.stockAvailable}
        />

        <div className="flex-1 flex items-center bg-[var(--bg-surface)] rounded-[12px] px-2.5 h-9 gap-2">
          <Tag size={12} className="text-[var(--color-success)]" />
          <span className="text-[10px] font-bold text-[var(--neutral-500)] uppercase">Dto</span>
          <input
            type="number"
            value={item.discountPercentage === 0 ? "" : item.discountPercentage}
            onChange={(e) => updateDiscount(item.productId, e.target.value === "" ? 0 : (parseInt(e.target.value) || 0))}
            placeholder="0"
            className="flex-1 bg-transparent border-none text-[var(--color-success)] text-[13px] font-extrabold text-right outline-none"
          />
          <span className="text-[11px] font-extrabold text-[var(--neutral-600)]">%</span>
        </div>

        <button
          onClick={() => removeFromCart(item.productId)}
          className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-[var(--neutral-50)] transition-all"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
