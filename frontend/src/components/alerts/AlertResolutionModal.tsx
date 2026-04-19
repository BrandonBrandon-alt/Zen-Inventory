"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/context/ToastContext";
import { Truck, ShoppingCart, XCircle } from "lucide-react";
import type { components } from "@/api/schema";

type StockAlertResponse = components["schemas"]["StockAlertResponse"] | any;
type ProductResponse = components["schemas"]["ProductResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];
type SupplierResponse = components["schemas"]["SupplierResponse"];

interface AlertResolutionModalProps {
  alert: StockAlertResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Tab = "TRANSFER" | "PURCHASE" | "DISMISSED" | "AUTHORIZE";

export default function AlertResolutionModal({ alert, onClose, onSuccess }: AlertResolutionModalProps) {
  const { showToast } = useToast();
  const session = getSession();
  const isAdmin = session?.rol === "ADMIN";

  const [activeTab, setActiveTab] = useState<Tab>("TRANSFER");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  // Data for logic
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [branchStocks, setBranchStocks] = useState<Record<number, number>>({});
  const [supplier, setSupplier] = useState<SupplierResponse | null>(null);

  // Form State
  const [originBranchId, setOriginBranchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [arrivalDate, setArrivalDate] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (alert) {
      if (alert.type === "TRANSFER_REQUEST") {
        setActiveTab("AUTHORIZE");
      } else {
        setActiveTab("TRANSFER");
      }
      loadInitialData();
    }
  }, [alert]);

  const loadInitialData = async () => {
    if (!alert) return;
    setFetchingData(true);
    try {
      // 1. Fetch Product
      const { data: prod } = await apiClient.GET("/api/catalog/products/{id}", {
        params: { path: { id: alert.productId } }
      });
      setProduct(prod ?? null);
      
      if (prod) {
        setQuantity(100); // Default suggestion
        
        // 2. Fetch Supplier if exists (for Path B)
        if (prod.proveedorId) {
          const { data: supp } = await apiClient.GET("/api/catalog/suppliers/{id}", {
            params: { path: { id: prod.proveedorId } }
          });
          setSupplier(supp ?? null);
          
          if (supp?.tiempoEntregaDias) {
            const date = new Date();
            date.setDate(date.getDate() + supp.tiempoEntregaDias);
            setArrivalDate(date.toISOString().split("T")[0]);
          }
        }

        // 3. Fetch Branches and Stocks (for Path A)
        const { data: bras } = await apiClient.GET("/api/branches");
        const otherBranches = (bras ?? []).filter(b => b.id !== alert.branchId);
        setBranches(otherBranches);

        const stocks: Record<number, number> = {};
        await Promise.all(otherBranches.map(async (b) => {
          try {
            const { data: inv } = await apiClient.GET("/api/v1/inventory/branches/{branchId}/products/{productId}", {
              params: { path: { branchId: b.id!, productId: alert.productId } }
            });
            stocks[b.id!] = inv?.currentQuantity ?? 0;
          } catch (e) {
            stocks[b.id!] = 0;
          }
        }));
        setBranchStocks(stocks);
        
        // Set default origin branch if anyone has stock
        const branchWithStock = otherBranches.find(b => stocks[b.id!] > 0);
        if (branchWithStock) setOriginBranchId(branchWithStock.id!);
        
        // If not in Path B (no admin), default to +2 days for Path A
        if (!arrivalDate) {
           const date = new Date();
           date.setDate(date.getDate() + 2);
           setArrivalDate(date.toISOString().split("T")[0]);
        }
      }
    } catch (err) {
      showToast("Error al cargar datos de resolución", "error");
    } finally {
      setFetchingData(false);
    }
  };

  const handleResolve = async () => {
    if (!alert) return;
    setLoading(true);
    try {
      let endpoint = "";
      let body: any = {};

      if (activeTab === "TRANSFER") {
        if (!originBranchId) throw new Error("Debes seleccionar una sucursal de origen.");
        endpoint = `/api/v1/alerts/${alert.id}/resolve/transfer`;
        body = { originBranchId, quantity, userId: session?.id };
      } else if (activeTab === "PURCHASE") {
        endpoint = `/api/v1/alerts/${alert.id}/resolve/purchase`;
        body = { estimatedArrival: `${arrivalDate}T12:00:00`, quantity };
      } else if (activeTab === "AUTHORIZE") {
        // First authorize the transfer
        const { error: prepError } = await apiClient.POST(`/api/v1/transfers/${alert.referenceId}/prepare` as any, {});
        if (prepError) throw prepError;

        // Then resolve the alert
        endpoint = `/api/v1/alerts/${alert.id}/resolve/dismiss`;
        body = { reason: "Autorizado desde el Centro de Resoluciones" };
      } else {
        if (!reason) throw new Error("Debes proporcionar un motivo para el descarte.");
        endpoint = `/api/v1/alerts/${alert.id}/resolve/dismiss`;
        body = { reason };
      }

      // Use the generic POST since we don't have types for these new routes yet in schema.d.ts
      const { error } = await apiClient.POST(endpoint as any, {
        body
      });

      if (error) throw error;

      showToast("Alerta resuelta con éxito", "success");
      onSuccess();
    } catch (err: any) {
      showToast(err.message || "Error al resolver la alerta", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!alert) return null;

  return (
    <Modal open={!!alert} onClose={onClose} title="Gestión de Resolución de Alerta" size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Contexto de la alerta */}
        <div style={{ padding: "16px", background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
           <p style={{ fontSize: "14px", color: "var(--neutral-100)", fontWeight: 600, marginBottom: "4px" }}>{alert.message}</p>
           <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Producto ID: {alert.productId} • Sucursal ID: {alert.branchId}</p>
        </div>

        {fetchingData ? (
          <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>
        ) : (
          <>
            {/* Tabs de Decisión */}
            <div style={{ display: "flex", background: "var(--bg-surface)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-default)", gap: "4px" }}>
              {alert.type === "TRANSFER_REQUEST" ? (
                <button 
                  onClick={() => setActiveTab("AUTHORIZE")}
                  style={{ ...tabStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: activeTab === "AUTHORIZE" ? "var(--brand-500)" : "transparent", color: activeTab === "AUTHORIZE" ? "white" : "var(--neutral-400)" }}
                >
                  <Truck size={16} /> Autorizar Salida
                </button>
              ) : (
                <button 
                  onClick={() => setActiveTab("TRANSFER")}
                  style={{ ...tabStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: activeTab === "TRANSFER" ? "var(--brand-500)" : "transparent", color: activeTab === "TRANSFER" ? "white" : "var(--neutral-400)" }}
                >
                  <Truck size={16} /> Traslado Interno
                </button>
              )}
              {isAdmin && alert.type !== "TRANSFER_REQUEST" && (
                <button 
                  onClick={() => setActiveTab("PURCHASE")}
                  style={{ ...tabStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: activeTab === "PURCHASE" ? "var(--brand-500)" : "transparent", color: activeTab === "PURCHASE" ? "white" : "var(--neutral-400)" }}
                >
                  <ShoppingCart size={16} /> Orden de Compra
                </button>
              )}
              <button 
                onClick={() => setActiveTab("DISMISSED")}
                style={{ ...tabStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: activeTab === "DISMISSED" ? "var(--brand-500)" : "transparent", color: activeTab === "DISMISSED" ? "white" : "var(--neutral-400)" }}
              >
                <XCircle size={16} /> Descartar
              </button>
            </div>

            <div style={{ minHeight: "220px" }}>
              {activeTab === "TRANSFER" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>Solicita mercancía a otra sede que tenga stock disponible.</p>
                  <Select
                    label="Sucursal de Origen"
                    value={originBranchId}
                    onChange={(val) => setOriginBranchId(val)}
                    options={branches.map(b => ({ 
                      value: b.id!, 
                      label: `${b.nombre} (Stock: ${branchStocks[b.id!] || 0})` 
                    }))}
                  />
                  <Input 
                    label="Cantidad a Solicitar"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
              )}

              {activeTab === "AUTHORIZE" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ background: "rgba(var(--brand-500-rgb), 0.05)", padding: "16px", borderRadius: "12px", border: "1px solid var(--brand-500)" }}>
                    <p style={{ fontSize: "14px", color: "var(--neutral-100)", fontWeight: 600, marginBottom: "8px" }}>Autorización de Salida</p>
                    <p style={{ fontSize: "13px", color: "var(--neutral-300)", lineHeight: "1.5" }}>
                      Al confirmar esta resolución, estarás autorizando formalmente el despacho de la mercancia solicitada por la sucursal vecina.
                    </p>
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Traslado ID:</span>
                      <Badge variant="info">#{alert.referenceId}</Badge>
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--neutral-500)", textAlign: "center", fontStyle: "italic" }}>
                    Esto marcará el traslado como "PREPARING" para que el equipo de bodega pueda realizar el despacho físico.
                  </p>
                </div>
              )}

              {activeTab === "PURCHASE" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ padding: "12px", background: "rgba(217, 99, 79, 0.05)", borderRadius: "8px", border: "1px solid var(--brand-glow)" }}>
                    <p style={{ fontSize: "12px", color: "var(--brand-400)", fontWeight: 600 }}>INFORMACIÓN DEL PROVEEDOR</p>
                    <p style={{ fontSize: "14px", color: "var(--neutral-100)" }}>{supplier?.nombre || "No asociado"}</p>
                    <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>Tiempo de entrega: {supplier?.tiempoEntregaDias || 0} días</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <Input 
                      label="Cantidad a Comprar"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                    <Input 
                      label="Precio Unitario"
                      type="number"
                      value={product?.costoPromedio || 0}
                      disabled
                    />
                  </div>
                  <Input 
                    label="Fecha Estimada de Llegada"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>
              )}

              {activeTab === "DISMISSED" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ fontSize: "13px", color: "var(--neutral-400)" }}>Marca la alerta como resuelta sin realizar movimientos de mercancia (ej: producto descontinuado).</p>
                  <Select 
                    label="Motivo del Descarte"
                    value={reason}
                    onChange={(val) => setReason(val)}
                    options={[
                      { value: "FIN_TEMPORADA", label: "Fin de Temporada" },
                      { value: "DESCONTINUADO", label: "Producto Descontinuado" },
                      { value: "ERROR_SISTEMA", label: "Error de Conteo / Ajuste Pendiente" },
                      { value: "OTRO", label: "Otro motivo" },
                    ]}
                  />
                  {reason === "OTRO" && (
                    <Input 
                      label="Especifique el motivo"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
              <Button 
                variant="primary" 
                fullWidth 
                onClick={handleResolve} 
                loading={loading}
              >
                Confirmar Resolución
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

const tabStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: "8px",
  border: "none",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease"
};
