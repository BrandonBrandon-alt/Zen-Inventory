"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";

interface QuantitySelectorProps {
  value: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onChange: (val: number) => void;
  max?: number;
  min?: number;
  size?: "sm" | "md";
}

export default function QuantitySelector({ 
  value, 
  onIncrease, 
  onDecrease, 
  onChange, 
  max,
  min = 1,
  size = "md"
}: QuantitySelectorProps) {
  const isSm = size === "sm";
  const height = isSm ? "28px" : "36px";
  const btnWidth = isSm ? "28px" : "32px";
  const inputWidth = isSm ? "30px" : "36px";

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      background: "var(--bg-surface)", 
      border: "1px solid var(--border-default)",
      borderRadius: isSm ? "8px" : "12px",
      overflow: "hidden",
      height
    }}>
      <button 
        type="button"
        onClick={onDecrease}
        disabled={value <= min}
        style={{ 
          width: btnWidth, 
          height: "100%", 
          border: "none", 
          background: "none", 
          cursor: value <= min ? "not-allowed" : "pointer", 
          color: value <= min ? "var(--neutral-700)" : "var(--neutral-400)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          opacity: value <= min ? 0.5 : 1,
          transition: "all 0.15s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = value <= min ? "none" : "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Minus size={isSm ? 12 : 14} />
      </button>
      <input 
        type="number" 
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const val = parseInt(e.target.value) || min;
          let finalVal = val;
          if (max !== undefined) finalVal = Math.min(val, max);
          onChange(Math.max(finalVal, min));
        }}
        style={{ 
          width: inputWidth, 
          textAlign: "center", 
          border: "none", 
          background: "none", 
          color: "var(--neutral-50)", 
          fontSize: isSm ? "12px" : "13px", 
          fontWeight: 700,
          outline: "none",
          appearance: "none",
          margin: 0
        }}
      />
      <button 
        type="button"
        onClick={onIncrease}
        disabled={max !== undefined && value >= max}
        style={{ 
          width: btnWidth, 
          height: "100%", 
          border: "none", 
          background: "none", 
          cursor: (max !== undefined && value >= max) ? "not-allowed" : "pointer", 
          color: (max !== undefined && value >= max) ? "var(--neutral-700)" : "var(--neutral-400)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          opacity: (max !== undefined && value >= max) ? 0.5 : 1,
          transition: "all 0.15s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = (max !== undefined && value >= max) ? "none" : "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Plus size={isSm ? 12 : 14} />
      </button>
    </div>
  );
}
