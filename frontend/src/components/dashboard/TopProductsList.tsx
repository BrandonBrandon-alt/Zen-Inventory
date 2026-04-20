"use client";

import React, { memo } from "react";
import type { components } from "@/api/schema";
import EmptyState from "@/components/ui/EmptyState";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

type TopProduct = components["schemas"]["TopSellingProduct"];

interface TopProductsListProps {
  products: TopProduct[];
  showViewAll?: boolean;
}

const TopProductsList = memo(function TopProductsList({ products, showViewAll }: TopProductsListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {products.length === 0 ? (
        <EmptyState
          title="Sin datos"
          description="No hay ventas suficientes registradas."
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      ) : (
        products.map((prod, idx) => (
          <div
            key={prod.productId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 14px",
              background: "var(--bg-surface)",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: idx === 0 
                  ? "var(--brand-900)" 
                  : idx === 1 
                    ? "rgba(156, 163, 175, 0.2)" 
                    : "rgba(180, 83, 9, 0.2)",
                color: idx === 0 
                  ? "var(--brand-400)" 
                  : idx === 1 
                    ? "var(--neutral-400)" 
                    : "#b45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "13px",
              }}
            >
              {idx + 1}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-100)", lineHeight: 1.2 }}>
                {prod.productName}
              </p>
              <p style={{ fontSize: "11px", color: "var(--neutral-500)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                ID: {prod.productId}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "15px", fontWeight: 900, color: "var(--color-success)" }}>
                {prod.totalSoldQuantity}
              </p>
              <p style={{ fontSize: "10px", color: "var(--neutral-600)", textTransform: "uppercase" }}>Uds</p>
            </div>
          </div>
        ))
      )}
      
      {showViewAll && products.length > 0 && (
        <Button variant="ghost" size="sm" style={{ marginTop: "8px", width: "100%", justifyContent: "space-between" }}>
          Ver catálogo completo <ArrowRight size={14} />
        </Button>
      )}
    </div>
  );
});

export default TopProductsList;
