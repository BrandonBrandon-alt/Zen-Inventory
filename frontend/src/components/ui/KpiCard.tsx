"use client";

import React from "react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
  delay?: string;
  progress?: number; // 0 to 100
}

export default function KpiCard({ label, value, sub, icon, accent, delay, progress }: KpiCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-2xl)",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        animation: `fadeIn 0.4s ease-out ${delay ?? "0s"} both`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "var(--radius-md)",
            background: accent ? `${accent}12` : "var(--bg-hover)",
            border: `1px solid ${accent ? `${accent}20` : "var(--border-default)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent ?? "var(--neutral-400)",
          }}
        >
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 }) : icon}
        </div>
      </div>
      <div>
        <p
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "var(--neutral-50)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginBottom: sub ? "6px" : 0,
          }}
          className="tabular"
        >
          {value}
        </p>
        
        {progress !== undefined && (
          <div style={{ width: "100%", height: "4px", background: "var(--neutral-800)", borderRadius: "2px", overflow: "hidden", margin: "12px 0" }}>
            <div 
              style={{ 
                width: `${progress}%`, 
                height: "100%", 
                background: accent ?? "var(--brand-500)", 
                borderRadius: "2px",
                boxShadow: accent ? `0 0 10px ${accent}40` : "none",
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)"
              }} 
            />
          </div>
        )}

        {sub && (
          <p style={{ fontSize: "12px", color: "var(--neutral-500)", fontWeight: 500 }}>{sub}</p>
        )}
      </div>
    </div>
  );
}
