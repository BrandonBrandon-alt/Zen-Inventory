"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import type { components } from "@/api/schema";

import Spinner    from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import Card       from "@/components/ui/Card";
import Badge      from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Modal      from "@/components/ui/Modal";
import Toolbar    from "@/components/ui/Toolbar";
import Button     from "@/components/ui/Button";
import Input      from "@/components/ui/Input";
import Select     from "@/components/ui/Select";
import DataTable  from "@/components/ui/DataTable";
import Separator  from "@/components/ui/Separator";
import { useToast } from "@/context/ToastContext";
import { Search, Info, Lock, ShoppingCart, RotateCcw, Truck, CreditCard, ArrowRight, ShoppingBag, Repeat, AlertTriangle, CheckCircle, MinusCircle, ChevronDown } from "lucide-react";
import StockStatus from "@/components/ui/StockStatus";
import { usePersistence } from "@/hooks/usePersistence";
import SearchFilter from "@/components/ui/SearchFilter";

// ── Types ──────────────────────────────────────────────────
type ProductResponse  = components["schemas"]["ProductResponse"];
type LocalInventory   = components["schemas"]["LocalInventory"];
type BranchResponse   = components["schemas"]["BranchResponse"];
type InventoryProductResponse = components["schemas"]["InventoryProductResponse"];

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
    description: "Las devoluciones de clientes deben procesarse desde el historial de ventas para anular la factura y cargar el stock automáticamente.",
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

interface InventoryMovementExtended {
  id: number;
  type: "INGRESO" | "RETIRO";
  reason: string;
  quantity: number;
  date: string;
  productId: number;
  branchId: number;
  userId: number;
  referenceId?: number;
  referenceType?: string;
  observations?: string;
  finalBalance: number;
  subReason?: string;
}

// ── Main Page ──────────────────────────────────────────────
export default function InventoryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const session = typeof window !== "undefined" ? getSession() : null;
  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isInventory = session?.rol === "OPERADOR_INVENTARIO";
  const isSeller = session?.rol === "SELLER";
  const myBranchId = session?.sucursalId || null;

  const [invPageState, setInvPageState, isLoaded] = usePersistence("zen_inventory_inventory_state", {
    branchId: null as number | null,
    tab: "matrix" as "matrix" | "kardex",
    search: ""
  });

  const selectedBranchId = invPageState.branchId;
  const activeTab = invPageState.tab;
  const searchTerm = invPageState.search;

  const canEdit = isAdmin || isInventory || (isManager && selectedBranchId === myBranchId);
  const canSeeCost = isAdmin || isManager; // INVENTORY & SELLER do not see financial cost columns

  const setSelectedBranchId = (val: number | null) => setInvPageState(prev => ({ ...prev, branchId: val }));
  const setActiveTab = (val: "matrix" | "kardex") => setInvPageState(prev => ({ ...prev, tab: val }));
  const setSearchTerm = (val: string) => setInvPageState(prev => ({ ...prev, search: val }));

  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<number, InventoryProductResponse>>(new Map());
  
  // Kardex specific
  const [kardexMovements, setKardexMovements] = useState<InventoryMovementExtended[]>([]);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingInv, setLoadingInv] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "stockActual", direction: "desc" });

  // Modals state
  const [adjustingProduct, setAdjustingProduct] = useState<ProductResponse | null>(null);
  const [configProduct, setConfigProduct] = useState<{ p: ProductResponse; inv: any } | null>(null);
  
  const [adjustData, setAdjustData] = useState({
    type: "INGRESO" as "INGRESO" | "RETIRO",
    quantity: "" as number | "",
    reason: "" as any,
    unitCost: "" as number | "",
    observations: "",
    subReason: "",
    unitId: null as number | null,
  });
  const [adjustingProductUnits, setAdjustingProductUnits] = useState<any[]>([]);
  const [minStockValue, setMinStockValue] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  // Adjust modal validation: INVENTORY must provide a justification (min 15 chars)
  const observationsRequired = isInventory;

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const [bra, pro] = await Promise.all([
          apiClient.GET("/api/branches"),
          apiClient.GET("/api/catalog/products"),
        ]);
        setBranches(bra.data ?? []);
        setProducts(pro.data ?? []);
        
        // Prioritize myBranchId from session to avoid being blocked by empty branch lists
        if (!selectedBranchId) {
          if (myBranchId) {
            setSelectedBranchId(myBranchId);
          } else if (bra.data && bra.data.length > 0) {
            setSelectedBranchId(bra.data[0].id ?? null);
          }
        }
      } catch (err) {
        showToast("Error al inicializar datos", "error");
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, [showToast, myBranchId, selectedBranchId]);

  const refreshInventory = useCallback(async (branchId: number) => {
    setLoadingInv(true);
    try {
      const res = await apiClient.GET("/api/v1/inventory/branches/{branchId}", {
        params: { path: { branchId } }
      });
      const map = new Map<number, any>();
      (res.data ?? []).forEach((item: any) => {
        if (item.productId) map.set(item.productId, item);
      });
      setInventoryMap(map);
    } catch (err) {
      showToast("Error al cargar inventario", "error");
    } finally {
      setLoadingInv(false);
    }
  }, [showToast]);

  const fetchKardex = useCallback(async () => {
    if (!selectedBranchId) return;
    setKardexLoading(true);
    try {
      const res = await apiClient.GET("/api/v1/inventory/movements" as any, {});
      const allMovements = (res.data ?? []) as any[];
      
      let filtered = allMovements.filter(m => m.branchId === selectedBranchId);
      if (selectedProductId !== "all") {
        filtered = filtered.filter(m => m.productId === parseInt(selectedProductId));
      }
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setKardexMovements(filtered);
    } catch (err) {
      showToast("Error al cargar el Kardex", "error");
    } finally {
      setKardexLoading(false);
    }
  }, [selectedBranchId, selectedProductId, showToast]);

  useEffect(() => {
    if (selectedBranchId) {
      if (activeTab === "matrix") refreshInventory(selectedBranchId);
      else fetchKardex();
    }
  }, [selectedBranchId, activeTab, refreshInventory, fetchKardex]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  useEffect(() => {
    if (adjustingProduct) {
      setAdjustData(prev => ({ ...prev, unitId: null }));
      // @ts-ignore
      apiClient.GET(`/api/catalog/products/${adjustingProduct.id}/units`, {})
        .then(res => setAdjustingProductUnits((res.data ?? []) as any[]))
        .catch(err => console.error("Error fetching units", err));
    }
  }, [adjustingProduct]);

  const handleAdjustSubmit = async () => {
    if (!adjustingProduct || !selectedBranchId) return;
    const qty = typeof adjustData.quantity === "number" ? adjustData.quantity : 0;
    if (qty <= 0) {
      showToast("La cantidad debe ser mayor a 0", "warning");
      return;
    }
    if (!adjustData.reason) {
      showToast("El motivo es obligatorio", "warning");
      return;
    }
    if (observationsRequired && (adjustData.reason === "AJUSTE_POSITIVO" || adjustData.reason === "AJUSTE_NEGATIVO" || adjustData.reason === "MERMA") && adjustData.observations.trim().length < 15) {
      showToast("Debes justificar el ajuste con al menos 15 caracteres.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = adjustData.type === "INGRESO" 
        ? "/api/v1/inventory/branches/{branchId}/products/{productId}/add"
        : "/api/v1/inventory/branches/{branchId}/products/{productId}/withdraw";
      
      const { error } = await apiClient.POST(endpoint as any, {
        params: { path: { branchId: selectedBranchId, productId: adjustingProduct.id! } },
        body: {
          quantity: qty,
          unitId: adjustData.unitId,
          reason: adjustData.reason,
          userId: session?.id || 1,
          unitCost: adjustData.type === "INGRESO" ? (Number(adjustData.unitCost) || 0) : undefined,
          observations: adjustData.observations,
          subReason: adjustData.subReason,
        }
      });

      if (error) throw error;

      showToast(`Movimiento registrado con éxito`, "success");
      setAdjustingProduct(null);
      refreshInventory(selectedBranchId);
    } catch (err: any) {
      showToast(err.message || "Error al actualizar stock", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfigSubmit = async () => {
    if (!configProduct || !selectedBranchId) return;
    setSubmitting(true);
    try {
      const { error } = await apiClient.PUT("/api/v1/inventory/branches/{branchId}/products/{productId}/config", {
        params: { 
          path: { branchId: selectedBranchId, productId: configProduct.p.id! },
          query: { minimumStock: Number(minStockValue) || 0 }
        }
      });

      if (error) throw error;

      showToast("Stock mínimo actualizado", "success");
      setConfigProduct(null);
      refreshInventory(selectedBranchId);
    } catch (err) {
      showToast("Error al actualizar configuración", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getProductName = (id: number) => products.find(p => p.id === id)?.nombre || `Producto #${id}`;
  const getProductUnit = (id: number) => products.find(p => p.id === id)?.unitAbbreviation || "UND";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(p => {
        const inv = inventoryMap.get(p.id!);
        return (
          p.sku?.toLowerCase().includes(lowerSearch) ||
          p.nombre?.toLowerCase().includes(lowerSearch) ||
          p.unitAbbreviation?.toLowerCase().includes(lowerSearch) ||
          inv?.stockActual?.toString().includes(lowerSearch) ||
          p.precioVenta?.toString().includes(lowerSearch)
        );
      });
    }
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        let valA: any = (a as any)[sortConfig.key];
        let valB: any = (b as any)[sortConfig.key];
        if (sortConfig.key === "stockActual") {
          valA = inventoryMap.get(a.id!)?.stockActual ?? 0;
          valB = inventoryMap.get(b.id!)?.stockActual ?? 0;
        } else if (sortConfig.key === "stockMinimo") {
          valA = inventoryMap.get(a.id!)?.stockMinimo ?? 0;
          valB = inventoryMap.get(b.id!)?.stockMinimo ?? 0;
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [products, inventoryMap, searchTerm, sortConfig]);

  if (loadingInit) return <Spinner fullPage />;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Centro de Control de Inventario"
        description="Gestión inmutable de stock, auditoría de Kardex y niveles críticos por sucursal."
      />

      <div className="w-full">
        <Toolbar
          className="mb-16"
          left={
            <>
              <div className="w-[320px]">
                <Select
                  label="Sucursal de Consulta"
                  value={selectedBranchId}
                  onChange={(val) => setSelectedBranchId(val)}
                  options={branches.map(b => ({ value: b.id!, label: b.nombre! }))}
                  icon={<Info size={14} className="text-[var(--brand-400)]" />}
                />
              </div>

                <div className="flex gap-2 bg-[var(--bg-card)] p-1 rounded-xl  shadow-sm">
                  <Button 
                    variant={activeTab === "matrix" ? "primary" : "ghost"} 
                    size="sm"
                    onClick={() => setActiveTab("matrix")}
                    style={{ borderRadius: "10px", fontWeight: 800, textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px" }}
                  >
                    Matriz de Stock
                  </Button>
                  <Button 
                    variant={activeTab === "kardex" ? "primary" : "ghost"} 
                    size="sm"
                    onClick={() => setActiveTab("kardex")}
                    style={{ borderRadius: "10px", fontWeight: 800, textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px" }}
                  >
                    Kardex Histórico
                  </Button>
                </div>
            </>
          }
          right={
            <>
              {!canEdit && (
                <div className="px-4 py-2 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 flex items-center gap-2">
                  <Lock size={12} className="text-[var(--color-danger)]" />
                  <span className="text-[11px] text-[var(--color-danger)] font-black uppercase tracking-widest leading-none">Solo Lectura</span>
                </div>
              )}
            </>
          }
        >
          {activeTab === "matrix" && (
            <SearchFilter 
              placeholder="Buscar por SKU, nombre, unidad o stock..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          )}
        </Toolbar>

        <Separator />


        {activeTab === "matrix" && (
          <div className="mt-12 outline-none">
            <Card className="p-0 overflow-hidden border-[var(--neutral-800)] bg-[var(--bg-card)] shadow-2xl">
              <DataTable<ProductResponse>
                itemsPerPage={25}
                sortConfig={sortConfig}
                onSort={handleSort}
                columns={[
                  {
                    header: "SKU",
                    key: "sku",
                    width: "120px",
                    sortable: true,
                    render: (p) => (
                      <span className="tabular" style={{ fontSize: "12px", color: "var(--brand-400)", fontWeight: 700 }}>{p.sku}</span>
                    )
                  },
                  {
                    header: "Producto",
                    key: "nombre",
                    sortable: true,
                    render: (p) => (
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-100)", textTransform: "uppercase" }}>{p.nombre}</span>
                    )
                  },
                  {
                    header: "Unit.",
                    key: "unitAbbreviation",
                    align: "center",
                    sortable: true,
                    render: (p) => (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--neutral-500)", textTransform: "uppercase" }}>{p.unitAbbreviation || "UND"}</span>
                    )
                  },
                  {
                    header: "Stock Actual",
                    key: "stockActual",
                    align: "right",
                    sortable: true,
                    render: (p) => {
                      const inv = inventoryMap.get(p.id!);
                      const isCritical = inv && (inv.stockActual ?? 0) <= (inv.stockMinimo ?? 0);
                      return (
                        <div className="flex flex-col gap-1 items-end">
                           <div className="flex items-center gap-2">
                             {isCritical && (
                               <div className="animate-pulse flex items-center gap-1 bg-[var(--color-danger)]/10 text-[var(--color-danger)] px-2 py-0.5 rounded-md border border-[var(--color-danger)]/20 shadow-sm">
                                 <AlertTriangle size={10} />
                                 <span className="text-[9px] font-black uppercase tracking-tighter">Crítico</span>
                               </div>
                             )}
                             <span className="tabular" style={{ fontSize: "16px", fontWeight: 900, color: isCritical ? "var(--color-danger)" : "var(--neutral-50)" }}>
                              {inv?.stockActual ?? 0}
                            </span>
                           </div>
                          <StockStatus current={inv?.stockActual ?? 0} min={inv?.stockMinimo ?? 10} max={100} size="sm" />
                        </div>
                      );
                    }
                  },
                  {
                    header: "Stock Mín.",
                    key: "stockMinimo",
                    align: "right",
                    sortable: true,
                    render: (p) => {
                      const inv = inventoryMap.get(p.id!);
                      return <span className="tabular" style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-400)" }}>{inv?.stockMinimo ?? 0}</span>;
                    }
                  },
                  {
                    header: "Acciones",
                    key: "actions",
                    align: "right",
                    render: (p) => (
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setAdjustingProduct(p);
                            setAdjustData({ 
                              type: "INGRESO", 
                              quantity: "", 
                              reason: "", 
                              unitCost: p.costoPromedio ?? "",
                              observations: "",
                              subReason: "",
                              unitId: null
                            });
                          }}
                        >
                          Acciones
                        </Button>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const inv = inventoryMap.get(p.id!);
                            if (inv) {
                                setConfigProduct({ p, inv });
                                setMinStockValue(inv.stockMinimo ?? 0);
                            }
                          }}
                        >
                          Ajustar stock minimo
                        </Button>
                      </div>
                    )
                  }
                ]}
                data={filteredAndSortedProducts}
                isLoading={loadingInv}
              />
            </Card>
          </div>
        )}

        {activeTab === "kardex" && (
          <div className="mt-12 outline-none">
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <div style={{ width: "300px" }}>
              <Select
                label="Filtrar por Producto"
                value={selectedProductId}
                onChange={(val) => setSelectedProductId(val)}
                options={[
                  { value: "all", label: "Todos los productos" },
                  ...products.map(p => ({ value: p.id!.toString(), label: p.nombre! }))
                ]}
              />
            </div>

            <Card style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-default)" }}>
              <DataTable<InventoryMovementExtended>
                itemsPerPage={25}
                columns={[
                  {
                    header: "Fecha y Hora",
                    key: "date",
                    render: (m) => <span style={{ fontSize: "13px", color: "var(--neutral-400)" }}>{new Date(m.date).toLocaleString("es-CO", { hour12: true, dateStyle: 'short', timeStyle: 'short' })}</span>
                  },
                  {
                    header: "Producto",
                    key: "productId",
                    render: (m) => (
                      <div className="flex flex-col">
                        <span style={{ fontSize: "14px", fontWeight: 600 }}>{getProductName(m.productId)}</span>
                        {m.observations && (
                          <div className="flex gap-2 items-center flex-wrap">
                            <span style={{ fontSize: "11px", color: "var(--brand-400)", fontWeight: 700, fontStyle: "italic" }}>
                              Obs: {m.observations}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    header: "Tipo",
                    key: "type",
                    render: (m) => <Badge variant={m.type === "INGRESO" ? "success" : "danger"}>{m.type}</Badge>
                  },
                  {
                    header: "Motivo",
                    key: "reason",
                    render: (m) => {
                      const reasonStyles: Record<string, { color: string, bg: string, icon: any }> = {
                        COMPRA: { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", icon: <ShoppingBag size={12} /> },
                        VENTA: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", icon: <ShoppingCart size={12} /> },
                        DEVOLUCION: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)", icon: <Repeat size={12} /> },
                        TRASLADO: { color: "#6366f1", bg: "rgba(99, 102, 241, 0.1)", icon: <Truck size={12} /> },
                        MERMA: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.1)", icon: <AlertTriangle size={12} /> },
                        AJUSTE_POSITIVO: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", icon: <CheckCircle size={12} /> },
                        AJUSTE_NEGATIVO: { color: "#64748b", bg: "rgba(100, 116, 139, 0.1)", icon: <MinusCircle size={12} /> },
                      };

                      const style = reasonStyles[m.reason!] || { color: "var(--neutral-400)", bg: "var(--neutral-800)", icon: null };

                      return (
                        <div className="flex flex-col items-start gap-1">
                          <span style={{ 
                            fontSize: "9px", 
                            fontWeight: 800, 
                            padding: "2px 6px", 
                            borderRadius: "4px",
                            background: style.bg,
                            color: style.color,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            border: `1px solid ${style.color}20`
                          }}>
                            {style.icon}
                            {m.reason || "—"}
                          </span>
                          {m.subReason && (
                            <div style={{ transform: 'scale(0.8)', transformOrigin: 'left' }}>
                              <Badge variant="warning">
                                {m.subReason.replace("_", " ")}
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    }
                  },
                  {
                    header: "Cantidad",
                    key: "quantity",
                    align: "right",
                    render: (m) => (
                      <span style={{ fontWeight: 700, color: m.type === "INGRESO" ? "var(--color-success)" : "var(--color-danger)" }}>
                        {m.type === "INGRESO" ? "+" : "-"}{m.quantity}
                      </span>
                    )
                  },
                  {
                    header: "Saldo Resultante",
                    key: "finalBalance",
                    align: "right",
                    render: (m) => (
                      <span style={{ fontWeight: 800, color: "var(--neutral-100)" }}>
                        {m.finalBalance} <small style={{ color: "var(--neutral-500)" }}>{getProductUnit(m.productId)}</small>
                      </span>
                    )
                  }
                ]}
                data={kardexMovements}
                isLoading={kardexLoading}
                emptyState={{
                  title: "Sin movimientos",
                  description: "No se han registrado transacciones de inventario para estos filtros.",
                  icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                }}
              />
            </Card>
          </div>
          </div>
        )}
      </div>

      {/* MODAL: MOVIMIENTO (INGRESO/RETIRO) */}
      <Modal 
        open={!!adjustingProduct} 
        onClose={() => setAdjustingProduct(null)}
        title={`Registrar Movimiento - ${adjustingProduct?.nombre}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
            options={adjustData.type === "INGRESO" ? [
              { value: "COMPRA", label: "Compra a Proveedor" },
              { value: "DEVOLUCION", label: "Devolución de Cliente" },
              { value: "AJUSTE_POSITIVO", label: "Ajuste de Auditoría (+)" },
              { value: "TRASLADO", label: "Traslado Recibido" }
            ] : [
              { value: "VENTA", label: "Venta a Cliente" },
              { value: "MERMA", label: "Merma / Daño" },
              { value: "AJUSTE_NEGATIVO", label: "Ajuste de Auditoría (-)" },
              { value: "TRASLADO", label: "Traslado Enviado" }
            ]}
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
                <option value="">Unidad Base ({adjustingProductUnits.find(u => u.esBase)?.nombreUnidad || 'Sistema'})</option>
                {adjustingProductUnits.filter(u => !u.esBase).map(u => (
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
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => {
                  const path = EXTERNAL_MOTIVES[adjustData.reason as string].path;
                  const productId = adjustingProduct?.id;
                  setAdjustingProduct(null);
                  
                  const params = new URLSearchParams();
                  if (productId) params.set("productId", productId.toString());
                  if (selectedBranchId) params.set("branchId", selectedBranchId.toString());
                  
                  const query = params.toString();
                  router.push(`${path}${query ? `?${query}` : ""}`);
                }}
                leftIcon={<ArrowRight size={16} />}
              >
                {EXTERNAL_MOTIVES[adjustData.reason as string].label}
              </Button>
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
                  <Button variant="ghost" fullWidth onClick={() => setAdjustingProduct(null)}>Cancelar</Button>
                  <Button 
                    variant="primary" 
                    fullWidth 
                    onClick={handleAdjustSubmit} 
                    loading={submitting}
                    style={{ background: adjustData.type === "INGRESO" ? "var(--color-success)" : "var(--color-danger)" }}
                  >
                    Registrar {adjustData.type === "INGRESO" ? "Entrada" : "Salida"}
                  </Button>
                </div>
              )}
              
              {!adjustData.reason && (
                <Button variant="ghost" fullWidth onClick={() => setAdjustingProduct(null)}>Cerrar</Button>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* MODAL: MIN STOCK */}
      <Modal
        open={!!configProduct}
        onClose={() => setConfigProduct(null)}
        title={`Configurar Alertas - ${configProduct?.p.nombre}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Input 
            label="Stock Mínimo para Alerta"
            type="number"
            value={minStockValue}
            onChange={(e) => setMinStockValue(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
          />
          <Button variant="primary" fullWidth onClick={handleConfigSubmit} loading={submitting}>Guardar Cambios</Button>
        </div>
      </Modal>
    </div>
  );
}
