import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { ShoppingCart, RotateCcw, Truck, CreditCard, ArrowRight, ChevronDown, XCircle } from "lucide-react";

const EXTERNAL_MOTIVES: Record<string, { label: string, path: string, description: string, icon: any }> = {
  COMPRA: {
    label: "Ir a Compras",
    path: "/purchases",
    description: "Para registrar el ingreso de mercancía por compra, debes generar una Orden de Compra formal para afectar correctamente las cuentas por pagar.",
    icon: <ShoppingCart size={24} />
  },
  DEVOLUCION: {
    label: "Ir a Historial de Ventas",
    path: "/sales/history",
    description: "Las devoluciones de clientes deben ser procesadas desde el historial de ventas para vincular correctamente el producto con la factura y validar el reembolso.",
    icon: <RotateCcw size={24} />
  },
  TRASLADO: {
    label: "Ir a Traslados",
    path: "/transfers",
    description: "El movimiento de stock entre sedes se gestiona desde el módulo de traslados para asegurar la trazabilidad y el inventario en tránsito.",
    icon: <Truck size={24} />
  },
  VENTA: {
    label: "Ir al POS",
    path: "/sales/pos",
    description: "Las salidas por venta deben realizarse a través del Punto de Venta (POS) para emitir el comprobante y descargar el stock vinculado a la factura.",
    icon: <CreditCard size={24} />
  }
};

export interface AdjustData {
  type: "INGRESO" | "RETIRO";
  quantity: number | "";
  reason: any;
  unitCost: number | "";
  observations: string;
  subReason: string;
  unitId: number | null;
}

interface AdjustStockModalProps {
  open: boolean;
  onClose: () => void;
  product: any; // ProductResponse
  units: any[];
  isInventoryRole: boolean;
  branchId?: number;
  initialData: AdjustData;
  onSubmit: (data: AdjustData) => Promise<void>;
  loading: boolean;
}

export default function AdjustStockModal({
  open,
  onClose,
  product,
  units,
  isInventoryRole,
  branchId,
  initialData,
  onSubmit,
  loading
}: AdjustStockModalProps) {
  const router = useRouter();
  const [adjustData, setAdjustData] = useState<AdjustData>(initialData);

  useEffect(() => {
    if (open) {
      setAdjustData(initialData);
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    await onSubmit(adjustData);
  };

  return (
    <Modal 
      open={open} 
      onClose={onClose}
      title={`Registrar Movimiento - ${product?.nombre}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {product?.activo === false && (
          <div style={{ 
            padding: "16px", 
            background: "var(--color-danger-10)", 
            border: "1px solid var(--color-danger-20)", 
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "var(--color-danger)"
          }}>
            <div style={{ padding: "8px", background: "var(--color-danger-10)", borderRadius: "8px" }}>
              <XCircle size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, textTransform: "uppercase" }}>Producto Descatalogado</h4>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>Este producto está inactivo en el catálogo. Use este módulo solo para ajustes de liquidación.</p>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
          <button 
            onClick={() => setAdjustData({...adjustData, type: "INGRESO"})}
            style={{
              padding: "16px", borderRadius: "12px", border: "2px solid", cursor: "pointer", fontWeight: 700,
              borderColor: adjustData.type === "INGRESO" ? "var(--color-success)" : "var(--neutral-800)",
              background: adjustData.type === "INGRESO" ? "color-mix(in srgb, var(--color-success), transparent 90%)" : "transparent",
              color: adjustData.type === "INGRESO" ? "var(--color-success)" : "var(--neutral-500)"
            }}
          >
            ENTRADA (+)
          </button>
          <button 
            onClick={() => setAdjustData({...adjustData, type: "RETIRO"})}
            style={{
              padding: "16px", borderRadius: "12px", border: "2px solid", cursor: "pointer", fontWeight: 700,
              borderColor: adjustData.type === "RETIRO" ? "var(--color-danger)" : "var(--neutral-800)",
              background: adjustData.type === "RETIRO" ? "color-mix(in srgb, var(--color-danger), transparent 90%)" : "transparent",
              color: adjustData.type === "RETIRO" ? "var(--color-danger)" : "var(--neutral-500)"
            }}
          >
            SALIDA (-)
          </button>
        </div>

        <Select
          label="Motivo del Movimiento"
          value={adjustData.reason}
          onChange={(val) => setAdjustData({...adjustData, reason: val})}
          options={(adjustData.type === "INGRESO" ? [
            { value: "COMPRA", label: "Compra a Proveedor" },
            { value: "DEVOLUCION", label: "Devolución de Cliente" },
            { value: "AJUSTE_POSITIVO", label: "Ajuste de Auditoría (+)" },
            { value: "TRASLADO", label: "Traslado Recibido" }
          ] : [
            { value: "VENTA", label: "Venta a Cliente" },
            { value: "MERMA", label: "Merma / Daño" },
            { value: "AJUSTE_NEGATIVO", label: "Ajuste de Auditoría (-)" },
            { value: "TRASLADO", label: "Traslado Enviado" }
          ]).filter(opt => {
            if (isInventoryRole && opt.value === "DEVOLUCION") return false;
            if (isInventoryRole && opt.value === "VENTA") return false;
            return true;
          })}
        />

        {adjustData.reason === "MERMA" && (
          <Select 
            label="Categoría de Merma / Daño (Obligatorio)"
            value={adjustData.subReason}
            onChange={(val) => setAdjustData({...adjustData, subReason: val})}
            options={[
              { value: "CADUCIDAD", label: "Caducidad (Semillas viejas)" },
              { value: "DAÑO_FISICO", label: "Daño Físico (Bulto roto, accidente)" },
              { value: "ROBO_PERDIDA", label: "Robo / Pérdida" },
              { value: "DEFECTO_FABRICA", label: "Defecto de Fábrica (Proveedor)" }
            ]}
            placeholder="Seleccione categoría..."
          />
        )}

        {/* Unit Selector */}
        <div className="space-y-2">
          <span className="text-[11px] font-black text-[var(--neutral-500)] uppercase tracking-widest block">Unidad del Movimiento</span>
          <div className="relative">
            <select 
              className="w-full bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-xl px-4 py-3 text-[13px] font-bold text-[var(--neutral-100)] focus:ring-2 focus:ring-[var(--brand-500)]/20 focus:border-[var(--brand-500)] outline-none transition-all appearance-none cursor-pointer"
              value={adjustData.unitId || ""}
              onChange={(e) => setAdjustData({...adjustData, unitId: e.target.value ? Number(e.target.value) : null})}
            >
              <option value="">Unidad Base ({units.find(u => u.esBase)?.nombreUnidad || 'Sistema'})</option>
              {units.filter(u => !u.esBase).map(u => (
                <option key={u.id} value={u.unidadId}>
                  {u.nombreUnidad} (x{u.factorConversion})
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neutral-500)]">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {EXTERNAL_MOTIVES[adjustData.reason as string] ? (
          <div style={{ 
            padding: "24px", 
            borderRadius: "16px", 
            background: "var(--bg-surface)", 
            border: "1px solid var(--neutral-800)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "16px",
            animation: "fade-in 0.3s ease"
          }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              borderRadius: "50%", 
              background: "var(--brand-500-10)", 
              color: "var(--brand-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              {EXTERNAL_MOTIVES[adjustData.reason as string].icon}
            </div>
            <div>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--neutral-50)" }}>Flujo Protegido</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--neutral-400)", lineHeight: "1.5" }}>
                {EXTERNAL_MOTIVES[adjustData.reason as string].description}
              </p>
            </div>
            {(() => {
              const hasSuppliers = product?.proveedores && product.proveedores.length > 0;
              const preferredSupplier = product?.proveedores?.find((p: any) => p.preferido);
              const targetSupplier = preferredSupplier || (hasSuppliers ? product.proveedores[0] : null);

              return (
                <div className="w-full space-y-3">
                  {!hasSuppliers && adjustData.reason === "COMPRA" && (
                    <div className="flex items-center gap-2 p-3 bg-[var(--color-danger-10)] border border-[var(--color-danger-20)] rounded-xl text-[var(--color-danger)] animate-in fade-in slide-in-from-top-1">
                      <XCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-tight">Sin proveedores vinculados en el catálogo</span>
                    </div>
                  )}
                  
                  <Button 
                    variant="primary" 
                    fullWidth 
                    disabled={!hasSuppliers && adjustData.reason === "COMPRA"}
                    onClick={() => {
                      const path = EXTERNAL_MOTIVES[adjustData.reason as string].path;
                      onClose();
                      
                      const params = new URLSearchParams();
                      if (branchId) params.set("branchId", branchId.toString());

                      if (adjustData.reason === "COMPRA") {
                        if (targetSupplier) params.set("preselectedSupplier", targetSupplier.id.toString());
                        params.set("preselectedProduct", product.id.toString());
                      } else {
                        if (product?.id) params.set("productId", product.id.toString());
                      }
                      
                      const query = params.toString();
                      router.push(`${path}${query ? `?${query}` : ""}`);
                    }}
                    leftIcon={hasSuppliers || adjustData.reason !== "COMPRA" ? <ArrowRight size={16} /> : <XCircle size={16} />}
                  >
                    {!hasSuppliers && adjustData.reason === "COMPRA" 
                      ? "Configurar Proveedores" 
                      : EXTERNAL_MOTIVES[adjustData.reason as string].label}
                  </Button>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {(adjustData.reason === "AJUSTE_POSITIVO" || adjustData.reason === "MERMA" || adjustData.reason === "AJUSTE_NEGATIVO") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Input 
                  label={`Cantidad a ${adjustData.type === "INGRESO" ? "Ingresar" : "Retirar"}`}
                  type="number"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({...adjustData, quantity: e.target.value === "" ? "" : Number(e.target.value)})}
                  placeholder="0"
                />
                {adjustData.type === "INGRESO" && (
                  <Input 
                    label="Costo Unitario (Sugerido)"
                    type="number"
                    value={adjustData.unitCost}
                    onChange={(e) => setAdjustData({...adjustData, unitCost: e.target.value === "" ? "" : Number(e.target.value)})}
                    placeholder="0"
                  />
                )}
              </div>
            )}

            {(adjustData.reason === "AJUSTE_POSITIVO" || adjustData.reason === "AJUSTE_NEGATIVO") && (
              <Input 
                label="Justificación del Ajuste (Motivo Detallado)"
                value={adjustData.observations}
                onChange={(e) => setAdjustData({...adjustData, observations: e.target.value})}
                placeholder="Explique el motivo de este ajuste manual..."
              />
            )}

            {(adjustData.reason === "AJUSTE_POSITIVO" || adjustData.reason === "MERMA" || adjustData.reason === "AJUSTE_NEGATIVO") && (
              <div style={{ display: "flex", gap: "12px" }}>
                <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
                <Button 
                  variant="primary" 
                  fullWidth 
                  onClick={handleSubmit} 
                  loading={loading}
                  style={{ background: adjustData.type === "INGRESO" ? "var(--color-success)" : "var(--color-danger)" }}
                >
                  Registrar {adjustData.type === "INGRESO" ? "Entrada" : "Salida"}
                </Button>
              </div>
            )}
            
            {!adjustData.reason && (
              <Button variant="ghost" fullWidth onClick={onClose}>Cerrar</Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
