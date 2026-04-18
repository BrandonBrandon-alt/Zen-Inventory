"use client";

import React from "react";
import Badge from "./Badge";

interface StockStatusProps {
  current: number;
  min: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  unit?: string;
  showLabels?: boolean;
}

export default function StockStatus({ 
  current, 
  min,
  max = 100,
  size = "md",
  unit = "UND",
  showLabels = true 
}: StockStatusProps) {
  const isCritical = current <= min && min > 0;
  const isEmpty = current === 0;
  const isSmall = size === "sm";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {!isSmall && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ 
            fontSize: size === "lg" ? "24px" : "18px", 
            fontWeight: 800, 
            color: isEmpty ? "var(--color-danger)" : isCritical ? "var(--color-warning)" : "var(--neutral-50)" 
          }}>
            {current}
          </span>
          <span style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase" }}>
            {unit}
          </span>
        </div>
      )}
      {showLabels && (
        <div style={{ display: "flex" }}>
          {isEmpty ? (
            <Badge variant="danger">Agotado</Badge>
          ) : isCritical ? (
            <Badge variant="warning">Suelo Crítico</Badge>
          ) : (
            <Badge variant="success">Óptimo</Badge>
          )}
        </div>
      )}
    </div>
  );
}

