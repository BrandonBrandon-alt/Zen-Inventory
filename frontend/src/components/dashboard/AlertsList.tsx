"use client";

import React, { memo } from "react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { components } from "@/api/schema";

type StockAlert = components["schemas"]["StockAlertResponse"];

interface AlertsListProps {
  alerts: StockAlert[];
}

const AlertRow = memo(function AlertRow({ alert }: { alert: StockAlert }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: alert.resolved ? "var(--color-success)" : "var(--brand-500)",
            marginTop: "6px",
            flexShrink: 0,
          }}
        />
        <div>
          <p style={{ fontSize: "13.5px", color: "var(--neutral-100)", marginBottom: "2px" }}>
            {alert.message}
          </p>
          <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>
            Sucursal #{alert.branchId} · Producto #{alert.productId}
          </p>
        </div>
      </div>
      <Badge variant={alert.resolved ? "success" : "danger"}>
        {alert.resolved ? "Resuelta" : "Activa"}
      </Badge>
    </div>
  );
});

const AlertsList = memo(function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        title="Todo normal"
        description="No hay alertas críticas en la red."
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="custom-scrollbar" style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "8px" }}>
      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} />
      ))}
    </div>
  );
});

export default AlertsList;
