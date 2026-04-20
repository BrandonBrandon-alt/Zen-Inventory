"use client";

import React, { memo } from "react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { components } from "@/api/schema";

type TransferResponse = components["schemas"]["TransferResponse"];

interface ActiveTransfersListProps {
  transfers: TransferResponse[];
  branchMap: Map<number, string>;
}

const ActiveTransfersList = memo(function ActiveTransfersList({ transfers, branchMap }: ActiveTransfersListProps) {
  if (transfers.length === 0) {
    return (
      <EmptyState
        title="Sin movimientos"
        description="No hay traslados activos actualmente."
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {transfers.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
            borderBottom: i < transfers.length - 1 ? "1px solid var(--border-subtle)" : "none",
          }}
        >
          <div>
            <p style={{ fontSize: "13px", color: "var(--neutral-100)" }}>
              {branchMap.get(t.originBranchId!) || "Sede A"} → {branchMap.get(t.destinationBranchId!) || "Sede B"}
            </p>
            <p style={{ fontSize: "11px", color: "var(--neutral-500)" }}>
              {t.status === "REQUESTED" ? "Solicitado" : t.status === "PENDING" ? "Por Aprobar" : t.status === "IN_TRANSIT" ? "En Tránsito" : t.status}
            </p>
          </div>
          <Badge variant={t.status === "IN_TRANSIT" ? "warning" : "neutral"}>ID #{t.id}</Badge>
        </div>
      ))}
    </div>
  );
});

export default ActiveTransfersList;
