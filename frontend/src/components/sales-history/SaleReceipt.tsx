"use client";

import React from "react";

export interface SaleReceiptData {
  id: number;
  date: string;
  subtotal: number;
  totalDiscount: number;
  totalFinal: number;
  branchName?: string | null;
  userName?: string | null;
  customerName?: string | null;
  customerDocument?: string | null;
  globalDiscountPercentage?: number | null;
  details: Array<{
    id: number;
    productId: number;
    productName?: string | null;
    quantity: number;
    unitPriceApplied: number;
    discountPercentage: number;
    subtotalLine: number;
  }>;
}

interface SaleReceiptProps {
  sale: SaleReceiptData;
}

const BRAND = "#c0392b";
const TEXT_DARK = "#111111";
const TEXT_MID = "#444444";
const TEXT_LIGHT = "#777777";
const BORDER = "#dddddd";
const BG_TOTALS = "#f5f5f5";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export default function SaleReceipt({ sale }: SaleReceiptProps) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "280px",
        margin: "0 auto",
        padding: "16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "12px",
        color: TEXT_DARK,
        backgroundColor: "#ffffff",
        lineHeight: 1.45,
      }}
    >
      {/* ── Header ──────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <div
          style={{
            fontSize: "22px",
            fontWeight: 900,
            letterSpacing: "4px",
            color: TEXT_DARK,
          }}
        >
          ZEN INVENTORY
        </div>
        <div
          style={{
            fontSize: "9px",
            fontWeight: 600,
            color: TEXT_LIGHT,
            letterSpacing: "1px",
            marginTop: "2px",
          }}
        >
          SISTEMAS AGROINDUSTRIALES
        </div>
        {/* dot separator */}
        <div
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: BRAND,
            margin: "10px auto",
          }}
        />
        <div style={{ fontSize: "10px", color: TEXT_MID, lineHeight: 1.6 }}>
          NIT: 900.123.456-1
          <br />
          {sale.branchName || "Sede Principal"}
          <br />
          Tel: (604) 444-0000
        </div>
        <div
          style={{
            marginTop: "12px",
            padding: "5px 8px",
            border: `1px solid ${BORDER}`,
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 700,
            color: BRAND,
          }}
        >
          FACTURA DE VENTA N° {String(sale.id).padStart(6, "0")}
        </div>
      </div>

      {/* ── Info grid ───────────────────────────── */}
      <div
        style={{
          borderTop: `1px dashed ${BORDER}`,
          borderBottom: `1px dashed ${BORDER}`,
          padding: "10px 0",
          marginBottom: "10px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        <InfoCell label="Fecha" value={formatDate(sale.date)} />
        <InfoCell label="Hora" value={formatTime(sale.date)} />
        <div style={{ gridColumn: "span 2" }}>
          <InfoCell label="Atendido por" value={sale.userName || "Operador"} />
        </div>
      </div>

      {/* ── Customer ────────────────────────────── */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, color: TEXT_LIGHT, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Cliente / NIT
        </div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: TEXT_DARK, textTransform: "uppercase", marginTop: "2px" }}>
          {sale.customerName || "Venta General (Público)"}
        </div>
        <div style={{ fontSize: "10px", color: TEXT_LIGHT, marginTop: "1px" }}>
          {sale.customerDocument || "No Identificado"}
        </div>
      </div>

      <div style={{ height: "1px", background: BORDER, margin: "10px 0" }} />

      {/* ── Items table ─────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            <th style={{ textAlign: "left", fontSize: "9px", fontWeight: 700, color: TEXT_LIGHT, textTransform: "uppercase", paddingBottom: "6px" }}>
              Descripción
            </th>
            <th style={{ textAlign: "center", width: "30px", fontSize: "9px", fontWeight: 700, color: TEXT_LIGHT, textTransform: "uppercase", paddingBottom: "6px" }}>
              Cant
            </th>
            <th style={{ textAlign: "right", width: "70px", fontSize: "9px", fontWeight: 700, color: TEXT_LIGHT, textTransform: "uppercase", paddingBottom: "6px" }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sale.details?.map((d, idx) => (
            <tr key={d.id ?? idx} style={{ borderBottom: `1px solid ${BG_TOTALS}` }}>
              <td style={{ padding: "7px 0", verticalAlign: "top" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: TEXT_DARK, textTransform: "uppercase" }}>
                  {d.productName || `Producto #${d.productId}`}
                </div>
                <div style={{ fontSize: "9px", color: TEXT_LIGHT, marginTop: "1px" }}>
                  {formatCurrency(d.unitPriceApplied)} c/u
                </div>
              </td>
              <td style={{ padding: "7px 0", textAlign: "center", fontSize: "11px", fontWeight: 700, color: TEXT_DARK, verticalAlign: "top" }}>
                {d.quantity}
              </td>
              <td style={{ padding: "7px 0", textAlign: "right", fontSize: "11px", fontWeight: 700, color: TEXT_DARK, verticalAlign: "top" }}>
                {formatCurrency(d.subtotalLine)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ──────────────────────────────── */}
      <div
        style={{
          marginTop: "10px",
          background: BG_TOTALS,
          padding: "10px",
          borderRadius: "4px",
        }}
      >
        {/* Mejor visualización: Subtotal -> Descuento Global -> Total */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: TEXT_MID, marginBottom: "5px" }}>
          <span>Subtotal Bruto</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>

        {sale.globalDiscountPercentage !== undefined && sale.globalDiscountPercentage !== null && sale.globalDiscountPercentage > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: BRAND, marginBottom: "5px" }}>
            <span>Desc. Global ({sale.globalDiscountPercentage}%)</span>
            {/* El totalDiscount en este punto ya incluye los descuentos por item y el global */}
            <span>Aplicado al total</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: BRAND, marginBottom: "5px" }}>
            <span>Total Ahorro</span>
            <span>-{formatCurrency(sale.totalDiscount)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, color: TEXT_DARK, textTransform: "uppercase" }}>
            Valor Total
          </span>
          <span style={{ fontSize: "15px", fontWeight: 900, color: BRAND }}>
            {formatCurrency(sale.totalFinal)}
          </span>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          marginTop: "16px",
          paddingTop: "10px",
          borderTop: `1px dashed ${BORDER}`,
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 700, color: TEXT_DARK, letterSpacing: "2px" }}>
          GRACIAS POR SU COMPRA
        </div>
        <div
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: BRAND,
            margin: "8px auto",
          }}
        />
        <div style={{ fontSize: "9px", color: TEXT_LIGHT, lineHeight: 1.6 }}>
          Documento equivalente a factura de venta.
          <br />
          Favor verificar su mercancía.
          <br />
          Software: Zen Inventory ERP v2.0
        </div>
      </div>
    </div>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: TEXT_LIGHT, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </span>
      <span style={{ fontSize: "11px", fontWeight: 600, color: TEXT_DARK, marginTop: "1px" }}>
        {value}
      </span>
    </div>
  );
}