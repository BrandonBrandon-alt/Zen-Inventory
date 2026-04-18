"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { apiClient } from "@/api/client";
import { useToast } from "@/context/ToastContext";
import { getSession } from "@/api/auth";

// ── Utils ──────────────────────────────────────────────────
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
};

// ── Types ──────────────────────────────────────────────────
interface Product { id: number; sku: string; nombre: string; costoPromedio: number; precioVenta: number; proveedorId: number; }
interface PurchaseDetail { productId: number; nombre: string; sku: string; quantity: number; unitPrice: number | ""; discountPct: number | ""; }
interface OrderDetailItem { id: number; productId: number; quantity: number; unitPrice: number; subtotal: number; discountPct?: number; productName?: string; }
interface PurchaseOrder { id: number; supplierId: number; branchId: number; requestDate: string; estimatedArrivalDate: string; actualArrivalDate: string | null; receptionStatus: "PENDING" | "IN_TRANSIT" | "RECEIVED_TOTAL" | "RECEIVED_PARTIAL" | "CANCELLED"; paymentStatus: "POR_PAGAR" | "PAGADO"; total: number; details?: OrderDetailItem[]; resolutionReason?: string; resolutionDate?: string; }
interface CppImpact { productId: number; productName: string; oldCpp: number; newCpp: number; quantityReceived: number; }
interface ReceiveOrderResult { orderId: number; status: string; impacts: CppImpact[]; }

// ── UI Sub-Components (Clean & Minimalist) ─────────────────

// Removed local QuantityControl in favor of centralized QuantitySelector

const ProductCard = ({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) => (
  <div 
    onClick={() => onAdd(product)}
    className="group bg-[var(--bg-card)] border border-[var(--neutral-700)] hover:border-[var(--brand-500)] shadow-md hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] rounded-[1.5rem] p-6 cursor-pointer flex flex-col justify-between h-full transition-all duration-300 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="bg-[var(--brand-500)] text-[var(--neutral-50)] p-1 rounded-bl-lg shadow-lg">
        <Plus className="h-4 w-4" />
      </div>
    </div>
    
    <div>
      <span className="text-[10px] font-mono text-[var(--neutral-500)] font-black tracking-[0.2em] uppercase">{product.sku}</span>
      <h3 className="text-base font-black text-[var(--neutral-100)] mt-1 group-hover:text-[var(--brand-400)] transition-colors leading-tight uppercase tracking-tight line-clamp-2 min-h-[3rem]">
        {product.nombre}
      </h3>
    </div>
    
    <div className="mt-6 flex items-baseline justify-between">
      <div className="flex flex-col">
        <p className="text-[10px] text-[var(--neutral-500)] uppercase font-black tracking-tighter mb-1">Costo ERP</p>
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-[var(--neutral-50)]">
            {formatCurrency(product.costoPromedio || 0)}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const CartItemRow = ({ item, actions }: { item: PurchaseDetail, actions: any }) => (
  <div className="p-4 bg-[var(--bg-card)] border border-[var(--neutral-800)] rounded-2xl flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-right-2">
    <div className="flex justify-between items-start gap-3">
      <div className="flex-1">
        <h4 className="text-[13px] font-black text-[var(--neutral-50)] leading-tight uppercase tracking-tight">{item.nombre}</h4>
        <span className="text-[10px] font-mono text-[var(--brand-400)] font-bold tracking-tight uppercase">{item.sku}</span>
      </div>
      <div className="text-right">
        <p className="text-[14px] font-black text-[var(--neutral-50)]">{formatCurrency((Number(item.unitPrice) || 0) * item.quantity)}</p>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="w-32">
        <QuantitySelector 
          value={item.quantity} 
          onIncrease={() => actions.updateQuantity(item.productId, 1)} 
          onDecrease={() => actions.updateQuantity(item.productId, -1)} 
          onChange={(val: number) => actions.setQuantity(item.productId, val)}
        />
      </div>
      
      <div className="flex-1 flex items-center bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-xl px-2 h-9">
        <DollarSign size={12} className="text-[var(--brand-400)] mr-1" />
        <input 
          type="number" step="0.01" value={item.unitPrice} 
          onChange={(e) => actions.setUnitPrice(item.productId, e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))}
          placeholder="0"
          className="flex-1 bg-transparent border-none text-[var(--neutral-100)] text-[12px] font-black focus:outline-none text-right"
        />
      </div>

      <div className="w-16 flex items-center bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-xl px-2 h-9">
        <Percent size={10} className="text-[var(--brand-400)] mr-1" />
        <input 
          type="number" min="0" max="100" step="0.5" value={item.discountPct} 
          onChange={(e) => actions.setDiscount(item.productId, e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))}
          placeholder="0"
          className={`w-full bg-transparent border-none text-[12px] font-black focus:outline-none text-center ${(Number(item.discountPct) || 0) > 0 ? 'text-[var(--brand-400)]' : 'text-[var(--neutral-500)]'}`}
        />
      </div>

      <button 
        onClick={() => actions.removeFromCart(item.productId)}
        className="w-9 h-9 flex items-center justify-center text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-xl transition-all"
      >
        <Trash2 size={16} />
      </button>
    </div>

    {(Number(item.discountPct) || 0) > 0 && (
      <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--color-success)]/10 rounded-lg border border-dashed border-[var(--color-success)]/30">
        <span className="text-[9px] text-[var(--color-success)] font-black uppercase tracking-widest">Ahorro ({(Number(item.discountPct) || 0)}%)</span>
        <span className="text-[9px] text-[var(--color-success)] font-black">-{formatCurrency(item.quantity * (Number(item.unitPrice) || 0) * ((Number(item.discountPct) || 0) / 100))}</span>
      </div>
    )}
  </div>
);

// ── Main Page Component ──────────────────────────────────────

function PurchasesContent() {
  const [activeTab, setActiveTab] = useState<"history" | "new">("new");
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const productIdPreselected = searchParams.get("productId");
  const branchIdPreselected = searchParams.get("branchId");

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
  const [estimatedArrival, setEstimatedArrival] = useState<string>("");
  const [paymentDueDays, setPaymentDueDays] = useState<string>("");
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

  const fetchCatalogs = async () => {
    try {
      const [suppliersRes, branchesRes, productsRes] = await Promise.all([
        apiClient.GET("/api/catalog/suppliers", {}),
        apiClient.GET("/api/branches", {}),
        apiClient.GET("/api/catalog/products", {})
      ]);

      if (suppliersRes.data) setSuppliers(suppliersRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (productsRes.data) setProducts(productsRes.data as Product[]);
    } catch (error) {
      console.error("Error fetching catalogs:", error);
      showToast("Error al cargar catálogos.", "error");
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
      const matchSupplier = supplierId ? p.proveedorId === parseInt(supplierId) : true;
      const matchSearch = searchTerm ? p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      return matchSupplier && matchSearch;
    });
  }, [products, searchTerm, supplierId]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSupplier = filterSupplierId ? o.supplierId === parseInt(filterSupplierId) : true;
      const matchProduct = filterProductId ? o.details?.some(d => d.productId === parseInt(filterProductId)) : true;
      return matchSupplier && matchProduct;
    });
  }, [orders, filterSupplierId, filterProductId]);

  const financialSummary = useMemo(() => {
    return cart.reduce((acc, curr) => {
      const discount = Number(curr.discountPct) || 0;
      const price = Number(curr.unitPrice) || 0;
      return acc + (curr.quantity * price * (1 - discount / 100));
    }, 0);
  }, [cart]);

  const cartActions = {
    addToCart: (prod: Product) => {
      setSupplierId(String(prod.proveedorId));
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
    if (productIdPreselected && products.length > 0) {
      const prodId = parseInt(productIdPreselected);
      const prod = products.find(p => p.id === prodId);
      if (prod) {
        cartActions.addToCart(prod);
      }
    }
  }, [productIdPreselected, products]);

  useEffect(() => {
    if (branchIdPreselected) {
      setBranchId(branchIdPreselected);
    }
  }, [branchIdPreselected]);

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
        estimatedArrivalDate: (estimatedArrival || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]) + "T00:00:00",
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
        setEstimatedArrival("");
        setActiveTab("history");
        fetchOrders();
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

  const renderHistory = () => {
    const columns = [
      { 
        key: "id", 
        label: "ID", 
        render: (row: PurchaseOrder) => <span className="font-mono text-[var(--brand-400)] font-bold">#{String(row.id).padStart(5, '0')}</span> 
      },
      { 
        key: "requestDate", 
        label: "Fecha Emisión", 
        render: (row: PurchaseOrder) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[var(--neutral-300)] font-bold">
              <Calendar size={12} className="text-[var(--neutral-500)]" /> 
              {new Date(row.requestDate).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--neutral-500)] font-mono ml-5">
              <Clock size={10} />
              {new Date(row.requestDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )
      },
      { 
        key: "details", 
        label: "Mercancía", 
        render: (row: PurchaseOrder) => (
          <div className="flex flex-col gap-1 max-w-[220px]">
            {row.details && row.details.length > 0 ? (
              row.details.slice(0, 2).map((detail, idx) => {
                const prod = products.find(p => p.id === detail.productId);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-[var(--bg-surface)] px-2 py-1 rounded-lg border border-[var(--neutral-800)]/50 group hover:border-[var(--brand-500)]/30 transition-colors">
                    <span className="text-[10px] font-black text-[var(--brand-400)]">{detail.quantity}x</span>
                    <span className="text-[11px] font-bold text-[var(--neutral-300)] truncate uppercase tracking-tight">
                      {prod?.nombre || `Prod #${detail.productId}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <span className="text-[10px] text-[var(--neutral-600)] uppercase font-black tracking-widest">Sin detalles</span>
            )}
            {row.details && row.details.length > 2 && (
              <span className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em] ml-2">
                + {row.details.length - 2} ítem(s) más
              </span>
            )}
          </div>
        ) 
      },
      { 
        key: "supplierId", 
        label: "Socio Comercial", 
        render: (row: PurchaseOrder) => <span className="font-semibold text-[var(--neutral-100)]">{suppliers.find(s => s.id === row.supplierId)?.nombre || "Desconocido"}</span> 
      },
      { 
        key: "total", 
        label: "Monto Total", 
        render: (row: PurchaseOrder) => <span className="font-black text-[var(--neutral-50)]">{formatCurrency(row.total)}</span> 
      },
      { 
        key: "receptionStatus", 
        label: "Logística", 
        render: (row: PurchaseOrder) => (
          <div className="flex flex-col gap-1.5">
            <Badge 
              variant={row.receptionStatus === "RECEIVED_TOTAL" ? "success" : (row.receptionStatus as string) === "CANCELLED" ? "danger" : row.receptionStatus === "IN_TRANSIT" ? "warning" : "info"} 
              dot
            >
              {row.receptionStatus === "RECEIVED_TOTAL" ? "ENTREGADO" : (row.receptionStatus as string) === "CANCELLED" ? "CANCELADO" : row.receptionStatus === "IN_TRANSIT" ? "EN CAMINO" : "SOLICITADO"}
            </Badge>
            {(row.receptionStatus as string) === "CANCELLED" && row.resolutionReason && (
              <p className="text-[10px] text-[var(--neutral-500)] italic leading-tight max-w-[120px]">
                {row.resolutionReason}
              </p>
            )}
          </div>
        ) 
      },
      { 
        key: "paymentStatus", 
        label: "Finanzas", 
        render: (row: PurchaseOrder) => (
          <Badge variant={row.paymentStatus === "PAGADO" ? "success" : "danger"}>
            {row.paymentStatus === "PAGADO" ? "PAGADO" : "DEUDA ACTIVA"}
          </Badge>
        ) 
      },
      { 
        key: "actions", 
        label: "", 
        render: (row: PurchaseOrder) => {
          const session = getSession();
          const isManager = session?.rol === "ADMIN" || session?.rol === "GERENTE";
          
          return (
            <div className="flex justify-end gap-2">
              <button onClick={() => openOrderDetail(row)} className="p-2 text-[var(--neutral-400)] hover:text-[var(--neutral-50)] hover:bg-[var(--bg-hover)] rounded-lg transition-all" title="Ver Detalle">
                <Eye size={16} />
              </button>
              
              {row.receptionStatus !== "RECEIVED_TOTAL" && row.receptionStatus !== "CANCELLED" && (
                <button 
                  onClick={() => receiveOrder(row.id)} 
                  className="p-2 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded-lg transition-all" 
                  title={row.receptionStatus === "RECEIVED_PARTIAL" ? "Recibir Restante" : "Confirmar Recepción"}
                >
                  <Truck size={16} />
                </button>
              )}

              {row.receptionStatus === "RECEIVED_PARTIAL" && isManager && (
                <button 
                  onClick={() => handleCloseShortfall(row.id)} 
                  className="p-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg transition-all" 
                  title="Liquidación Final (Cerrar con Faltante)"
                >
                  <X size={16} />
                </button>
              )}

              {row.paymentStatus === "POR_PAGAR" && row.receptionStatus !== "CANCELLED" && (
                <button 
                  onClick={() => registerPayment(row.id)} 
                  className="p-2 text-[var(--brand-400)] hover:bg-[var(--brand-500)]/10 rounded-lg transition-all" 
                  title="Registrar Pago"
                >
                  <CreditCard size={16} />
                </button>
              )}

              {row.receptionStatus === "PENDING" && (
                <button 
                  onClick={() => setResolvingOrder(row)} 
                  className="p-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg transition-all" 
                  title="Anular Orden"
                >
                  <XCircle size={16} />
                </button>
              )}
            </div>
          );
        }
      }
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-surface)] p-6 rounded-[1.5rem] border border-[var(--neutral-800)] shadow-sm">
          <div className="w-full md:w-64">
            <Select 
              label="Filtrar por Proveedor" 
              value={filterSupplierId} 
              onChange={setFilterSupplierId} 
              options={[{ value: "", label: "Todos los proveedores" }, ...suppliers.map(s => ({ value: String(s.id), label: s.nombre }))]} 
              icon={<Building2 size={14} />} 
              className="bg-[var(--bg-base)] border-[var(--neutral-800)]/50"
            />
          </div>
          <div className="w-full md:w-64">
            <Select 
              label="Filtrar por Producto" 
              value={filterProductId} 
              onChange={setFilterProductId} 
              options={[{ value: "", label: "Todos los productos" }, ...products.map(p => ({ value: String(p.id), label: p.nombre }))]} 
              icon={<Package size={14} />} 
              className="bg-[var(--bg-base)] border-[var(--neutral-800)]/50"
            />
          </div>
          {(filterSupplierId || filterProductId) && (
            <button onClick={() => { setFilterSupplierId(""); setFilterProductId(""); }} className="flex items-center gap-2 text-xs font-bold text-[var(--brand-400)] hover:text-[var(--brand-300)] transition-colors h-10 mt-6 px-4 rounded-xl hover:bg-[var(--brand-500)]/5">
              <X size={14} /> REINICIAR BUSQUEDA
            </button>
          )}
        </div>

        <Card title={`Kardex de Adquisiciones (${filteredOrders.length})`} className="shadow-2xl border-[var(--neutral-800)] bg-[var(--bg-card)] overflow-hidden rounded-[2rem]">
          <DataTable 
            columns={columns.map(col => ({ ...col, header: col.label }))} 
            data={filteredOrders} 
            isLoading={isLoadingOrders}
            emptyState={{
              title: "Registros no encontrados",
              description: "Ajusta los filtros o términos de búsqueda para encontrar lo que necesitas.",
              icon: <Package size={48} className="text-[var(--neutral-700)]" />
            }}
          />
        </Card>
      </div>
    );
  };

  const renderNewOrder = () => (
    <main className="flex gap-8 flex-col lg:flex-row h-[82vh] animate-in fade-in zoom-in-95 duration-300 mt-8">
      
      {/* ── PANEL IZQUIERDO: CATÁLOGO ───────────────── */}
      <div className="flex flex-[3] flex-col gap-5 min-w-0 bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-3xl p-8 shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-[var(--neutral-50)] tracking-tight uppercase leading-none">Catálogo de Abastecimiento</h3>
            <p className="text-[10px] text-[var(--neutral-500)] font-black uppercase tracking-[0.2em] mt-2">Selección estratégica de insumos</p>
          </div>
          
          <div className="w-full md:w-72">
            <Input 
              icon={<Search className="h-4 w-4 text-[var(--brand-500)]" />} 
              placeholder="Filtro rápido..." 
              value={searchTerm} 
              onChange={(e: any) => setSearchTerm(e.target.value)} 
              className="bg-[var(--bg-base)] border-[var(--neutral-800)]" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
            {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={cartActions.addToCart} />)}
          </div>
          {filteredProducts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
              <Package size={64} strokeWidth={1} className="mb-4 text-[var(--neutral-500)]" />
              <p className="text-sm font-bold uppercase tracking-widest text-[var(--neutral-400)]">Sin resultados en catálogo</p>
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO: CHECKOUT ───────────────── */}
      <div className="flex w-full lg:w-[480px] flex-col rounded-3xl border border-[var(--neutral-800)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden relative">
        
        {/* Checkout Header */}
        <div className="flex flex-col gap-4 border-b border-[var(--neutral-800)] px-6 py-5 bg-[var(--bg-card)]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[var(--brand-500)]/10 p-2.5 rounded-xl border border-[var(--brand-500)]/20">
                <ShoppingCart className="h-5 w-5 text-[var(--brand-500)]" />
              </div>
              <div>
                <h2 className="font-black text-[var(--neutral-50)] text-base tracking-tight uppercase">Borrador de Negociación</h2>
                {cart.length > 0 && (
                  <button 
                    className="text-[10px] font-black text-[var(--neutral-500)] hover:text-[var(--color-danger)] transition-colors uppercase tracking-widest" 
                    onClick={cartActions.clearCart}
                  >
                    Descartar Todo
                  </button>
                )}
              </div>
            </div>
            <Badge variant="neutral">{cart.length} ítems</Badge>
          </div>
          
          <div className="space-y-3">
            <Select 
              label="Entidad Proveedora"
              value={supplierId} 
              onChange={(val) => { 
                if (cart.length === 0 || confirm("Cambiar de proveedor vaciará el carrito. ¿Confirmas?")) { 
                  if (cart.length > 0) setCart([]); 
                  setSupplierId(val); 
                } 
              }} 
              options={[{ value: "", label: "Seleccionar Proveedor" }, ...suppliers.map(s => ({ value: String(s.id), label: s.nombre }))]} 
              className="bg-[var(--bg-base)]/50 border-[var(--neutral-800)]/50" 
              icon={<Building2 size={14} />}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select 
                label="Sucursal Destino"
                value={branchId} 
                onChange={setBranchId} 
                options={[...branches.map(b => ({ value: String(b.id), label: b.nombre }))]} 
                className="bg-[var(--bg-base)]/50 border-[var(--neutral-800)]/50"
                icon={<Warehouse size={14} />}
              />
              <Input 
                label="ETA Estimada"
                type="date" 
                value={estimatedArrival} 
                onChange={(e: any) => setEstimatedArrival(e.target.value)} 
                icon={<Calendar size={14} className="text-[var(--neutral-500)]" />} 
                className="bg-[var(--bg-base)]/50 border-[var(--neutral-800)]/50" 
              />
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar bg-[var(--bg-base)]/10">
          {cart.length > 0 ? (
            cart.map(item => <CartItemRow key={item.productId} item={item} actions={cartActions} />)
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-10 opacity-20">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[var(--neutral-700)] flex items-center justify-center mb-4">
                <Plus size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[3px] text-center w-2/3">Añade ítems para iniciar la cotización</p>
            </div>
          )}
        </div>

        {/* Sticky Financials */}
        <div className="border-t border-[var(--neutral-800)] bg-[var(--bg-card)]/95 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 pb-2">
            <Input 
              label="Días de Crédito"
              type="number"
              value={paymentDueDays}
              onChange={(e: any) => setPaymentDueDays(e.target.value)}
              icon={<Clock size={14} />}
              className="bg-[var(--bg-surface)]/50"
              placeholder="0"
            />
            <div className="text-right flex flex-col justify-end">
                <span className="text-[10px] text-[var(--neutral-500)] uppercase font-black tracking-widest mb-1">Ahorro Aplicado</span>
                <span className="text-sm font-black text-[var(--color-success)]">-{formatCurrency(cart.reduce((acc, curr) => acc + (curr.quantity * (Number(curr.unitPrice) || 0) * ((Number(curr.discountPct) || 0) / 100)), 0))}</span>
            </div>
          </div>

          <div 
            className="flex justify-between text-2xl font-black text-[var(--neutral-50)] pt-5 border-t border-[var(--neutral-800)]"
            style={{ borderTopStyle: "dashed" }}
          >
            <span className="tracking-tighter uppercase">Inversión Final</span>
            <span style={{ 
              color: "var(--brand-400)", 
              textShadow: "0 0 20px var(--brand-glow)" 
            }}>
              {formatCurrency(financialSummary)}
            </span>
          </div>
          
          <Button 
            className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl bg-[var(--brand-600)] hover:bg-[var(--brand-500)] shadow-[0_15px_30px_rgba(217,99,79,0.3)] transition-all active:scale-[0.98]"
            onClick={handleSubmitOrder} 
            loading={isSubmitting}
            disabled={cart.length === 0}
          >
            {isSubmitting ? <Spinner size={20} /> : <div className="flex items-center gap-3"><ArrowRight className="h-5 w-5" /> <span>Sincronizar con ERP</span></div>}
          </Button>
        </div>
      </div>
    </main>
  );

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
          <Button 
            variant={activeTab === "history" ? "primary" : "ghost"} 
            size="md"
            onClick={() => setActiveTab("history")}
            style={{ borderRadius: "10px", fontWeight: 800, textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px" }}
          >
            <TrendingUp size={18} className="mr-2" /> Historial Diario
          </Button>
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
            {selectedOrder?.receptionStatus !== "RECEIVED_TOTAL" && (
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
                      "{selectedOrder.resolutionReason || "Sin motivo especificado"}"
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
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