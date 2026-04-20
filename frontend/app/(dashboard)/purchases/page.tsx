"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Package, TrendingUp, Search, Plus, Trash2, 
  ShoppingCart, Building2, Calendar, DollarSign,
  CheckCircle, ArrowRight, Truck, Minus, X, 
  Eye, Percent, CreditCard, Clock, Warehouse, XCircle, ChevronDown
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import QuantitySelector from "@/components/ui/QuantitySelector";
import ResolutionModal from "@/components/ui/ResolutionModal";
import PurchasesHistoryTab from "@/components/purchases/PurchasesHistoryTab";
import NewPurchaseDraft from "@/components/purchases/NewPurchaseDraft";
import { apiClient } from "@/api/client";
import { useToast } from "@/context/ToastContext";
import { getSession } from "@/api/auth";

// ── Utils ──────────────────────────────────────────────────
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
};

// ── Types ──────────────────────────────────────────────────
interface Product { id: number; sku: string; nombre: string; costoPromedio: number; precioVenta: number; }
interface PurchaseDetail { productId: number; nombre: string; sku: string; quantity: number; unitPrice: number | ""; discountPct: number | ""; }
interface OrderDetailItem { id: number; productId: number; quantity: number; unitPrice: number; subtotal: number; discountPct?: number; productName?: string; }
interface PurchaseOrder { id: number; supplierId: number; branchId: number; requestDate: string; estimatedArrivalDate: string; actualArrivalDate: string | null; receptionStatus: "AWAITING_APPROVAL" | "PENDING" | "IN_TRANSIT" | "RECEIVED_TOTAL" | "RECEIVED_PARTIAL" | "CANCELLED"; paymentStatus: "POR_PAGAR" | "PAGADO"; total: number; details?: OrderDetailItem[]; reasonResolution?: string; resolutionDate?: string; exceptionApproved?: boolean; }
interface CppImpact { productId: number; productName: string; oldCpp: number; newCpp: number; quantityReceived: number; }
interface ReceiveOrderResult { orderId: number; status: string; impacts: CppImpact[]; }

// ── UI Sub-Components ────────────────────────────────────────
// Moved to modular components.

// ── Main Page Component ──────────────────────────────────────

function PurchasesContent() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const [activeTab, setActiveTab] = useState<"history" | "new">("new");
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productIdPreselected = searchParams.get("preselectedProduct") || searchParams.get("productId");
  const supplierIdPreselected = searchParams.get("preselectedSupplier");
  const branchIdPreselected = searchParams.get("branchId");

  // Protect route
  useEffect(() => {
    if (session?.rol === "SELLER") {
      router.replace("/dashboard");
    }
  }, [router, session]);

  // State: Catalogs
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // State: History & Filters
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // State: New Order
  const [supplierId, setSupplierId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
  const [paymentDueDays, setPaymentDueDays] = useState<string>("30");
  const [cart, setCart] = useState<PurchaseDetail[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingOrder, setResolvingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingItems, setReceivingItems] = useState<Record<number, number>>({});
  const [receivingUnits, setReceivingUnits] = useState<Record<number, number | null>>({});
  const [productUnitsData, setProductUnitsData] = useState<Record<number, any[]>>({});

  useEffect(() => {
    fetchCatalogs();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (supplierIdPreselected) {
      setSupplierId(supplierIdPreselected);
    }
  }, [supplierIdPreselected]);

  const fetchCatalogs = async () => {
    try {
      const [suppliersRes, branchesRes, productsRes] = await Promise.all([
        apiClient.GET("/api/catalog/suppliers", {}),
        apiClient.GET("/api/branches", {}),
        apiClient.GET("/api/catalog/products", {})
      ]);

      if (suppliersRes.data) setSuppliers(suppliersRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (error) {
      console.error("Error fetching catalogs:", error);
      showToast("Error al cargar catálogos.", "error");
    }
  };

  useEffect(() => {
    if (activeTab === "new") {
      fetchProductsForSupplier(supplierId);
    }
  }, [supplierId, activeTab]);

  const fetchProductsForSupplier = async (sid: string) => {
    try {
      if (!sid) {
        // Si no hay proveedor, solo cargar si hay búsqueda o nada?
        // En un ERP con N:M, "productos sin proveedor" no debería ser el default para compras.
        // Pero para facilitar, si no hay proveedor mostramos vacío o el top.
        setProducts([]);
        return;
      }
      const { data } = await (apiClient as any).GET("/api/catalog/suppliers/{id}/products", {
        params: { path: { id: parseInt(sid) } }
      });
      setProducts(data ?? []);
    } catch (err) {
      console.error("Error fetching supplier products", err);
    }
  };

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const { data, error } = await (apiClient.GET as any)("/api/v1/purchases", {});
      if (data) setOrders(data as unknown as PurchaseOrder[]);
      if (error) showToast("Error al cargar historial de compras.", "error");
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // ── Handlers & Memos ───────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = searchTerm ? p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      return matchSearch;
    });
  }, [products, searchTerm]);

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      const matchSupplier = filterSupplierId ? o.supplierId === parseInt(filterSupplierId) : true;
      const matchProduct = filterProductId ? o.details?.some(d => d.productId === parseInt(filterProductId)) : true;
      return matchSupplier && matchProduct;
    });

    const session = getSession();
    if (session?.rol === "ADMIN") {
      result = [...result].sort((a, b) => {
        const branchA = branches.find(br => br.id === a.branchId)?.nombre || "";
        const branchB = branches.find(br => br.id === b.branchId)?.nombre || "";
        return branchA.localeCompare(branchB);
      });
    }

    return result;
  }, [orders, filterSupplierId, filterProductId, branches]);

  const financialSummary = useMemo(() => {
    return cart.reduce((acc, curr) => {
      const discount = Number(curr.discountPct) || 0;
      const price = Number(curr.unitPrice) || 0;
      return acc + (curr.quantity * price * (1 - discount / 100));
    }, 0);
  }, [cart]);

  const cartActions = {
    addToCart: (prod: Product) => {
      setCart(prev => {
        const existing = prev.find(item => item.productId === prod.id);
        if (existing) {
          return prev.map(item => item.productId === prod.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        return [...prev, {
          productId: prod.id,
          nombre: prod.nombre,
          sku: prod.sku,
          quantity: 1,
          unitPrice: prod.costoPromedio || 0,
          discountPct: 0
        }];
      });
    },
    removeFromCart: (id: number) => setCart(prev => prev.filter(item => item.productId !== id)),
    updateQuantity: (id: number, delta: number) => setCart(prev => prev.map(item => item.productId === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)),
    setQuantity: (id: number, val: number) => val >= 1 && setCart(prev => prev.map(item => item.productId === id ? { ...item, quantity: val } : item)),
    setUnitPrice: (id: number, val: number | "") => setCart(prev => prev.map(item => item.productId === id ? { ...item, unitPrice: val } : item)),
    setDiscount: (id: number, val: number | "") => setCart(prev => prev.map(item => item.productId === id ? { ...item, discountPct: typeof val === "number" ? Math.min(100, Math.max(0, val)) : val } : item)),
    clearCart: () => { if (confirm("¿Descartar el borrador entero?")) setCart([]); }
  };

  useEffect(() => {
    async function prefillProduct() {
      if (productIdPreselected) {
        const prodId = parseInt(productIdPreselected);
        
        // If already in list, use it; otherwise fetch it
        let prod = products.find(p => p.id === prodId);
        
        if (!prod) {
          try {
            const { data, error } = await apiClient.GET("/api/catalog/products/{id}", {
              params: { path: { id: prodId } }
            });
            if (data) prod = data as Product;
          } catch (err) {
            console.error("Error pre-filling product:", err);
          }
        }

        if (prod) {
          // Check if already in cart to avoid duplicates on every re-render
          setCart(prev => {
            const exists = prev.some(item => item.productId === prodId);
            if (exists) return prev;
            return [...prev, {
              productId: prod!.id,
              nombre: prod!.nombre,
              sku: prod!.sku,
              quantity: 1,
              unitPrice: prod!.costoPromedio || 0,
              discountPct: 0
            }];
          });
        }
      }
    }
    
    prefillProduct();
  }, [productIdPreselected, products]); // Dependency on products helps if they load later

  useEffect(() => {
    if (branchIdPreselected) {
      setBranchId(branchIdPreselected);
    } else if (session && (session.rol === "OPERADOR_INVENTARIO" || session.rol === "MANAGER") && session.sucursalId) {
      setBranchId(String(session.sucursalId));
    }
  }, [branchIdPreselected, session]);

  useEffect(() => {
    if (receivingOrder) {
      const initialItems: Record<number, number> = {};
      const initialUnits: Record<number, number | null> = {};
      receivingOrder.details?.forEach(detail => {
        initialItems[detail.id] = detail.quantity;
        initialUnits[detail.id] = null;
        
        if (!productUnitsData[detail.productId]) {
          // @ts-ignore - Endpoint may not be in generated schema yet
          apiClient.GET(`/api/catalog/products/${detail.productId}/units`, {})
            .then(res => {
              if (res.data) {
                setProductUnitsData(prev => ({ ...prev, [detail.productId]: res.data as any[] }));
              }
            })
            .catch(err => console.error("Error fetching units", err));
        }
      });
      setReceivingItems(initialItems);
      setReceivingUnits(initialUnits);
    }
  }, [receivingOrder]);

  const handleSubmitOrder = async () => {
    if (!supplierId || !branchId || cart.length === 0) {
      showToast("Faltan datos obligatorios (Proveedor, Sucursal y Productos).", "warning");
      return;
    }
    const session = getSession();
    if (!session) {
      showToast("Sesión expirada.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplierId: parseInt(supplierId),
        userId: session.id,
        branchId: parseInt(branchId),
        leadTimeDays: leadTimeDays || 3,
        paymentDueDays: parseInt(paymentDueDays) || 30,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice) || 0,
          discountPct: Number(item.discountPct) || 0
        }))
      };

      const { error } = await apiClient.POST("/api/v1/purchases", { body: payload as any });
      if (error) {
        const msg = (error as any).message || "Error al procesar la orden.";
        showToast(msg, "error");
      } else {
        showToast("¡Orden de compra generada exitosamente!", "success");
        setCart([]);
        setSupplierId("");
        setBranchId("");
        setLeadTimeDays(3);
        if (session?.rol === "OPERADOR_INVENTARIO") {
          router.push("/inventory");
        } else {
          setActiveTab("history");
          fetchOrders();
        }
      }
    } catch (err: any) {
      showToast("Error de conexión con el servidor.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const receiveOrder = async (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setReceivingOrder(order);
  };

  const handleReceiveConfirm = async () => {
    if (!receivingOrder) return;
    const session = getSession();
    if (!session) return;

    setIsSubmitting(true);
    try {
      const items = Object.entries(receivingItems).map(([detailId, qty]) => ({
        detailId: parseInt(detailId),
        quantityReceived: qty
      }));

      const { data, error } = await (apiClient as any).POST("/api/v1/purchases/{id}/receive", {
        params: { path: { id: receivingOrder.id } },
        body: { userId: session.id, items }
      });

      if (!error) {
        const result = data as ReceiveOrderResult;
        showToast("Mercancía recibida correctamente.", "success");
        
        if (result.impacts && result.impacts.length > 0) {
          result.impacts.forEach(impact => {
            const diff = impact.newCpp - impact.oldCpp;
            showToast(
              `${impact.productName}: CPP ${formatCurrency(impact.oldCpp)} -> ${formatCurrency(impact.newCpp)}`,
              diff > 0 ? "warning" : diff < 0 ? "success" : "info"
            );
          });
        }
        
        setReceivingOrder(null);
        fetchOrders();
      } else {
        showToast("Error al procesar la recepción.", "error");
      }
    } catch (err) {
      showToast("Error de conexión.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShortfall = async (orderId: number) => {
    if (!confirm("¿Estás seguro de liquidar esta orden? Los saldos pendientes no podrán recibirse después.")) return;
    
    const session = getSession();
    if (!session) return;

    try {
      const { error } = await (apiClient as any).POST("/api/v1/purchases/{id}/close-shortfall", {
        params: { path: { id: orderId }, query: { userId: session.id } }
      });
      if (!error) {
        showToast("Orden liquidada y cerrada con éxito.", "success");
        fetchOrders();
      } else {
        showToast("Error al liquidar la orden.", "error");
      }
    } catch (err) {
      showToast("Error de conexión.", "error");
    }
  };

  const handleCancelPurchase = async (orderId: number, reason: string) => {
    const session = getSession();
    if (!session) return;
    
    try {
      const { error } = await (apiClient as any).POST("/api/v1/purchases/{id}/cancel", {
        params: { path: { id: orderId } },
        body: { reason, userId: session.id }
      });
      if (!error) {
        showToast("Orden de compra cancelada.", "success");
        fetchOrders();
      } else {
        throw new Error("Error al cancelar la orden.");
      }
    } catch (err: any) {
      throw new Error(err.message || "Error al cancelar la orden.");
    }
  };

  const registerPayment = async (orderId: number) => {
    try {
      const { error } = await (apiClient.POST as any)("/api/v1/purchases/{id}/pay", {
        params: { path: { id: orderId } }
      });
      if (!error) {
        showToast("Pago registrado correctamente.", "success");
        fetchOrders();
      } else {
        showToast("Error al registrar pago.", "error");
      }
    } catch (err) {
      showToast("Error de conexión.", "error");
    }
  };

  const handleApproveOrder = async (orderId: number) => {
    const session = getSession();
    if (!session) return;

    try {
      const { error } = await (apiClient.POST as any)("/api/v1/purchases/{id}/approve", {
        params: { 
          path: { id: orderId },
          query: { userId: session.id }
        }
      });
      if (!error) {
        showToast("Orden de compra aprobada correctamente.", "success");
        fetchOrders();
      } else {
        showToast("Error al aprobar la orden.", "error");
      }
    } catch (err) {
      showToast("Error de conexión.", "error");
    }
  };

  const handleApproveException = async (orderId: number) => {
    const session = getSession();
    if (!session) return;
    
    try {
      const { error } = await (apiClient.POST as any)("/api/v1/purchases/{id}/approve-exception", {
        params: { 
          path: { id: orderId },
          query: { userId: session.id }
        }
      });
      if (!error) {
        showToast("Excepción de compra aprobada correctamente.", "success");
        fetchOrders();
      } else {
        showToast("Error al aprobar la excepción.", "error");
      }
    } catch (err) {
      showToast("Error de conexión.", "error");
    }
  };

  const openOrderDetail = async (order: PurchaseOrder) => {
    setIsLoadingDetail(true);
    try {
      const { data, error } = await apiClient.GET("/api/v1/purchases/{id}", {
        params: { path: { id: order.id } }
      });
      if (data) {
        setSelectedOrder(data as unknown as PurchaseOrder);
      }
    } catch (err) {
      showToast("No se pudo cargar el detalle.", "error");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ── Views ──────────────────────────────────────────────────

  const renderHistory = () => (
    <PurchasesHistoryTab 
      filteredOrders={filteredOrders}
      isLoadingOrders={isLoadingOrders}
      filterSupplierId={filterSupplierId}
      setFilterSupplierId={setFilterSupplierId}
      filterProductId={filterProductId}
      setFilterProductId={setFilterProductId}
      suppliers={suppliers}
      products={products}
      branches={branches}
      formatCurrency={formatCurrency}
      session={session}
      openOrderDetail={openOrderDetail}
      receiveOrder={receiveOrder}
      handleCloseShortfall={handleCloseShortfall}
      handleApproveOrder={handleApproveOrder}
      handleApproveException={handleApproveException}
      registerPayment={registerPayment}
      setResolvingOrder={setResolvingOrder}
      showToast={showToast}
    />
  );

  const renderNewOrder = () => {
    const isBranchRestricted = session?.rol === "MANAGER" || session?.rol === "OPERADOR_INVENTARIO";
    
    return (
      <NewPurchaseDraft 
        filteredProducts={filteredProducts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        cartActions={cartActions}
        cart={cart}
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        branchId={branchId}
        setBranchId={setBranchId}
        leadTimeDays={leadTimeDays}
        setLeadTimeDays={setLeadTimeDays}
        paymentDueDays={paymentDueDays}
        setPaymentDueDays={setPaymentDueDays}
        isSubmitting={isSubmitting}
        handleSubmitOrder={handleSubmitOrder}
        financialSummary={financialSummary}
        suppliers={suppliers}
        branches={branches}
        branchDisabled={isBranchRestricted}
      />
    );
  };

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto", minHeight: "100vh" }}>
      <PageHeader 
        title="Gestor de Abastecimiento"
        description="Administra flujos B2B, gestiona recepciones y supervisa el pasivo corriente con proveedores."
      />

      <div className="flex flex-col items-center mb-10 gap-6 animate-fade-in">
        <div className="flex gap-2 bg-[var(--bg-card)] p-1 rounded-xl shadow-sm">
          <Button 
            variant={activeTab === "new" ? "primary" : "ghost"} 
            size="md"
            onClick={() => setActiveTab("new")}
            style={{ borderRadius: "10px", fontWeight: 800, textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px" }}
          >
            <ShoppingCart size={18} className="mr-2" /> Nueva Negociación
          </Button>
          {session?.rol !== "OPERADOR_INVENTARIO" && (
            <Button 
              variant={activeTab === "history" ? "primary" : "ghost"} 
              size="md"
              onClick={() => setActiveTab("history")}
              style={{ borderRadius: "10px", fontWeight: 800, textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px" }}
            >
              <TrendingUp size={18} className="mr-2" /> Historial Diario
            </Button>
          )}
        </div>

        {activeTab === "new" && cart.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-[var(--brand-500)]/10 border border-[var(--brand-500)]/20 rounded-2xl animate-in slide-in-from-top-2">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-widest mb-1">Borrador Activo</span>
              <span className="text-sm font-black text-[var(--brand-400)] leading-none">{cart.length} ÍTEMS CONFIGURADOS</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        {activeTab === "history" ? renderHistory() : renderNewOrder()}
      </div>

      {/* Detail Modal - Standardized with global design system */}
      <Modal
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Orden #${String(selectedOrder.id).padStart(6, '0')}` : ""}
        description={selectedOrder ? `Emitida el ${new Date(selectedOrder.requestDate).toLocaleDateString(undefined, { dateStyle: 'long' })}` : ""}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedOrder(null)}>
              Cerrar
            </Button>
            {selectedOrder?.receptionStatus !== "RECEIVED_TOTAL" && 
             selectedOrder?.receptionStatus !== "CANCELLED" && 
             selectedOrder?.receptionStatus !== "AWAITING_APPROVAL" && (
              <Button 
                onClick={() => { if (selectedOrder) { receiveOrder(selectedOrder.id); setSelectedOrder(null); } }}
                leftIcon={<CheckCircle size={18} />}
              >
                Confirmar Recepción
              </Button>
            )}
          </>
        }
      >
        {selectedOrder && (
          <div className="space-y-10 py-4">
            {/* Resolution Header (If cancelled) */}
            {(selectedOrder.receptionStatus as string) === "CANCELLED" && (
              <div className="p-6 bg-[var(--color-danger)]/5 rounded-2xl border border-[var(--color-danger)]/20 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[var(--color-danger)]/10 rounded-xl flex items-center justify-center text-[var(--color-danger)] shrink-0">
                    <XCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-[var(--color-danger)] uppercase tracking-[0.2em] mb-1">Orden de Compra Anulada</h4>
                    <p className="text-sm text-[var(--neutral-100)] font-medium leading-relaxed italic">
                      "{selectedOrder.reasonResolution || "Sin motivo especificado"}"
                    </p>
                    {selectedOrder.resolutionDate && (
                      <p className="text-[10px] text-[var(--neutral-500)] mt-2 uppercase font-black tracking-widest">
                        FECHA DE ANULACIÓN: {new Date(selectedOrder.resolutionDate).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Header Info Cards - More Spacious */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--neutral-800)] flex items-start gap-5 shadow-sm">
                <div className="w-12 h-12 bg-[var(--brand-500)]/10 rounded-2xl flex items-center justify-center text-[var(--brand-400)] shrink-0 border border-[var(--brand-500)]/20 shadow-inner">
                  <Building2 size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em] block mb-2">Entidad Proveedora</span>
                  <p className="text-base font-black text-[var(--neutral-50)] uppercase tracking-tight">
                    {suppliers.find(s => s.id === selectedOrder.supplierId)?.nombre || "Desconocido"}
                  </p>
                </div>
              </div>
              
              <div className="p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--neutral-800)] flex items-start gap-5 shadow-sm">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/20 shadow-inner">
                  <Warehouse size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em] block mb-2">Sede de Recepción</span>
                  <p className="text-base font-black text-[var(--neutral-50)] uppercase tracking-tight">
                    {branches.find(b => b.id === selectedOrder.branchId)?.nombre || "Desconocido"}
                  </p>
                </div>
              </div>
            </div>

            {/* Products Table - Enhanced Styling */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[11px] font-black text-[var(--neutral-400)] uppercase tracking-[0.25em]">Detalle de Mercancía Recibida</h3>
                <div className="flex items-center gap-2">
                   <Badge variant="neutral">{selectedOrder.details?.length || 0} ITEMS</Badge>
                </div>
              </div>

              <div className="overflow-hidden border border-[var(--neutral-800)] rounded-3xl bg-[var(--bg-card)] shadow-xl">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-[var(--neutral-900)]/80 text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5 border-b border-[var(--neutral-800)]">Referencia / Producto</th>
                      <th className="px-8 py-5 text-center border-b border-[var(--neutral-800)]">Cant.</th>
                      <th className="px-8 py-5 text-right border-b border-[var(--neutral-800)]">Costo Unit.</th>
                      <th className="px-8 py-5 text-right border-b border-[var(--neutral-800)]">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--neutral-800)]">
                    {selectedOrder.details?.map((detail: any) => {
                      const product = products.find(p => p.id === detail.productId);
                      return (
                        <tr key={detail.id} className="hover:bg-[var(--bg-hover)]/30 transition-all group">
                          <td className="px-8 py-5">
                            <div className="font-black text-[var(--neutral-50)] group-hover:text-[var(--brand-400)] transition-colors uppercase tracking-tight text-[13px]">
                              {product?.nombre || `Prod #${detail.productId}`}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--brand-500)] font-bold mt-1 opacity-60 tracking-wider">SKU: {product?.sku}</div>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className="font-mono text-[13px] font-black text-[var(--neutral-100)] bg-[var(--bg-surface)] px-4 py-1.5 rounded-xl border border-[var(--neutral-800)] shadow-inner">
                              {detail.quantity}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right font-bold text-[var(--neutral-400)] tabular text-[13px]">
                            {formatCurrency(detail.unitPrice)}
                          </td>
                          <td className="px-8 py-5 text-right font-black text-[var(--neutral-50)] tabular text-[14px]">
                            {formatCurrency(detail.subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary - Premium Style */}
            <div className="flex justify-end pr-4">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-[0.3em]">Total de Adquisición</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-black text-[var(--brand-400)] uppercase">COP</span>
                  <span className="text-5xl font-black text-[var(--neutral-50)] tabular tracking-tighter" style={{ textShadow: "0 0 40px var(--brand-glow)" }}>
                    {formatCurrency(selectedOrder.total).replace(/COP|\$/g, "").trim()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ResolutionModal
        open={!!resolvingOrder}
        onClose={() => setResolvingOrder(null)}
        title="Anular Orden de Compra"
        confirmLabel="Confirmar Anulación"
        onConfirm={async (reason) => {
          if (resolvingOrder) {
            await handleCancelPurchase(resolvingOrder.id, reason);
          }
        }}
      />

      <Modal 
        open={!!receivingOrder} 
        onClose={() => setReceivingOrder(null)} 
        title="Confirmar Recepción de Mercancía"
        size="md"
      >
        {receivingOrder && (
          <div className="space-y-6">
            <div className="p-4 bg-[var(--brand-500)]/10 border border-[var(--brand-500)]/20 rounded-2xl">
              <p className="text-sm text-[var(--neutral-100)] leading-relaxed">
                Ingrese las cantidades físicas recibidas. Si recibe menos de lo pedido, la orden pasará a estado <span className="font-bold text-[var(--brand-400)]">PARCIAL</span>.
              </p>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {receivingOrder.details?.map(detail => {
                const product = products.find(p => p.id === detail.productId);
                return (
                  <div key={detail.id} className="p-5 bg-[var(--bg-card)] border border-[var(--neutral-800)] rounded-3xl flex flex-col gap-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-[13px] font-black text-[var(--neutral-50)] uppercase tracking-tight">{product?.nombre || "Producto"}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="neutral">{detail.quantity} PEDIDOS</Badge>
                        </div>
                      </div>
                      <div className="w-32">
                        <QuantitySelector 
                          value={receivingItems[detail.id] || 0}
                          onChange={(val) => setReceivingItems(prev => ({ ...prev, [detail.id]: val }))}
                          onIncrease={() => setReceivingItems(prev => ({ ...prev, [detail.id]: (prev[detail.id] || 0) + 1 }))}
                          onDecrease={() => setReceivingItems(prev => ({ ...prev, [detail.id]: Math.max(0, (prev[detail.id] || 0) - 1) }))}
                        />
                      </div>
                    </div>
                    
                    {/* Unit Selector */}
                    <div className="pt-4 border-t border-[var(--neutral-800)]/50">
                      <div className="flex flex-col gap-2">
                         <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-[0.15em]">Unidad de Recepción</span>
                         <div className="relative">
                           <select 
                             className="w-full bg-[var(--neutral-900)] border border-[var(--neutral-800)] rounded-xl px-4 py-3 text-[12px] font-bold text-[var(--neutral-100)] focus:ring-2 focus:ring-[var(--brand-500)]/20 focus:border-[var(--brand-500)] outline-none transition-all appearance-none cursor-pointer"
                             value={receivingUnits[detail.id] || ""}
                             onChange={(e) => setReceivingUnits(prev => ({ ...prev, [detail.id]: e.target.value ? Number(e.target.value) : null }))}
                           >
                             <option value="">Unidad Base (Sistema)</option>
                             {productUnitsData[detail.productId]?.map(u => (
                               !u.esBase && (
                                 <option key={u.id} value={u.unidadId}>
                                   {u.nombreUnidad} (x{u.factorConversion})
                                 </option>
                               )
                             ))}
                           </select>
                           <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neutral-500)]">
                             <ChevronDown size={14} />
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 mt-8">
              <Button variant="ghost" fullWidth onClick={() => setReceivingOrder(null)}>Cancelar</Button>
              <Button 
                variant="primary" 
                fullWidth
                loading={isSubmitting}
                onClick={handleReceiveConfirm}
                style={{ height: "50px", borderRadius: "16px" }}
              >
                Sincronizar Inventario
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--neutral-700); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--neutral-600); }
      `}</style>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={40} />
          <p className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em]">Cargando gestor de abastecimiento...</p>
        </div>
      </div>
    }>
      <PurchasesContent />
    </Suspense>
  );
}