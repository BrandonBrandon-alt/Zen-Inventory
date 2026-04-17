"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, TrendingUp, Search, Plus, Trash2, 
  ShoppingCart, Building2, Calendar, DollarSign,
  CheckCircle, ArrowRight, Truck, Minus, Tag, X, 
  Eye, Filter, Percent, CreditCard, Clock
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
import { apiClient } from "@/api/client";
import { useToast } from "@/context/ToastContext";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
};

// Interfaces Locales
interface Product {
  id: number;
  sku: string;
  nombre: string;
  costoPromedio: number;
  precioVenta: number;
  proveedorId: number;
}

interface PurchaseDetail {
  productId: number;
  nombre: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;  // Gap 1
}

interface OrderDetailItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountPct?: number;
}

interface PurchaseOrder {
  id: number;
  supplierId: number;
  branchId: number;
  requestDate: string;
  estimatedArrivalDate: string;
  actualArrivalDate: string | null;
  receptionStatus: "PENDING" | "IN_TRANSIT" | "RECEIVED_TOTAL";
  paymentStatus: "POR_PAGAR" | "PAGADO";  // Gap 2
  total: number;
  details?: OrderDetailItem[];  // Gap 4
}

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<"history" | "new">("new");
  const { showToast } = useToast();

  // Datos base
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Histórico
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Gap 3 — Filtros histórico
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [filterProductId, setFilterProductId] = useState("");

  // Gap 4 — Detalle de orden
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Formulario Nueva Orden
  const [supplierId, setSupplierId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [estimatedArrival, setEstimatedArrival] = useState<string>("");
  const [paymentDueDays, setPaymentDueDays] = useState<string>("30");  // Gap 2
  
  // Carrito de Orden
  const [cart, setCart] = useState<PurchaseDetail[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCatalogs();
    fetchOrders();
  }, []);

  const fetchCatalogs = async () => {
    try {
      const [supsRes, branchRes, prodRes] = await Promise.all([
        (apiClient.GET as any)("/api/catalog/suppliers", {}),
        (apiClient.GET as any)("/api/branches", {}),
        (apiClient.GET as any)("/api/catalog/products", {})
      ]);
      if (supsRes.data) setSuppliers(supsRes.data as any[]);
      if (branchRes.data) setBranches(branchRes.data as any[]);
      if (prodRes.data) setProducts(prodRes.data as Product[]);
    } catch (error) {
      console.error("Error al cargar catálogos:", error);
    }
  };

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await (apiClient.GET as any)("/api/v1/purchases", {});
      if (res.data) setOrders(res.data);
    } catch (error) {
      console.error("Error al cargar historial de compras:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products;

    if (supplierId) {
      result = result.filter(p => p.proveedorId === parseInt(supplierId));
    }

    if (searchTerm) {
      result = result.filter(item => 
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return result;
  }, [products, searchTerm, supplierId]);

  // Gap 3 — Filtrado local del histórico
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filterSupplierId) result = result.filter(o => o.supplierId === parseInt(filterSupplierId));
    if (filterProductId) result = result.filter(o => 
      o.details?.some(d => d.productId === parseInt(filterProductId))
    );
    return result;
  }, [orders, filterSupplierId, filterProductId]);


  // ----- MÉTODOS DEL CARRITO DE COMPRAS ----- //
  const addToCart = (prod: Product) => {
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
        discountPct: 0  // Gap 1
      }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const setQuantity = (productId: number, value: number) => {
    if (value < 1) return;
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, quantity: value } : item));
  };

  const setUnitPrice = (productId: number, newPrice: number) => {
    if (newPrice < 0) return;
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, unitPrice: newPrice } : item));
  };

  // Gap 1 — descuento por línea
  const setDiscount = (productId: number, pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct));
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, discountPct: clamped } : item));
  };

  // Gap 4 — cargar detalle de orden
  const openOrderDetail = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    if (!order.details) {
      setIsLoadingDetail(true);
      try {
        const res = await (apiClient.GET as any)(`/api/v1/purchases/${order.id}`, {});
        if (res.data) {
          setSelectedOrder(res.data);
          setOrders(prev => prev.map(o => o.id === order.id ? res.data : o));
        }
      } catch (e) {
        console.error("Error al cargar detalle de orden", e);
      } finally {
        setIsLoadingDetail(false);
      }
    }
  };

  // Gap 2 — registrar pago
  const registerPayment = async (orderId: number) => {
    try {
      await (apiClient.POST as any)(`/api/v1/purchases/${orderId}/pay`, {});
      showToast("Pago registrado correctamente", "success");
      fetchOrders();
      setSelectedOrder(null);
    } catch (e) {
      showToast("Error al registrar el pago", "error");
    }
  };

  const clearCart = () => {
    if (confirm("¿Estás seguro de descartar el borrador entero?")) {
      setCart([]);
    }
  };

  const financialSummary = useMemo(() => {
    return cart.reduce((acc, curr) => {
      const net = curr.quantity * curr.unitPrice * (1 - (curr.discountPct || 0) / 100);  // Gap 1
      return acc + net;
    }, 0);
  }, [cart]);


  const handleSubmitOrder = async () => {
    if (!supplierId || !branchId || !estimatedArrival) {
      return showToast("Faltan datos en la cabecera (Proveedor, Destino o Fecha)", "warning");
    }

    if (cart.length === 0) {
      return showToast("Debes añadir mercancía a la solicitud desde el catálogo", "warning");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        userId: 1,
        supplierId: parseInt(supplierId),
        branchId: parseInt(branchId),
        estimatedArrivalDate: new Date(estimatedArrival).toISOString(),
        paymentDueDays: parseInt(paymentDueDays),  // Gap 2
        items: cart.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct || 0  // Gap 1
        }))
      };

      const res = await (apiClient.POST as any)("/api/v1/purchases", { body: payload });
      if (res.error) throw res.error;
      
      showToast("Orden de compra creada exitosamente", "success");
      
      // Reset State
      setSupplierId("");
      setBranchId("");
      setEstimatedArrival("");
      setPaymentDueDays("30");  // Gap 2
      setCart([]);
      setActiveTab("history");
      fetchOrders();
    } catch (error) {
      console.error(error);
      showToast("Error al procesar la Orden Logística", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const receiveOrder = async (orderId: number) => {
    try {
      const res = await (apiClient.POST as any)(`/api/v1/purchases/${orderId}/receive`, {
        params: { query: { userId: 1 } }
      });
      if (res.error) throw res.error;
      showToast("Inventario Alimentado y Costos Financieros Promediados 🪄", "success");
      fetchOrders();
    } catch (error) {
      showToast("Error al registrar la recepción logística", "error");
    }
  };

  // ----- SUB COMPONENTES UI POS-STYLE ----- //
  const QuantitySelector = ({ value, onIncrease, onDecrease, onChange }: any) => (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      background: "var(--bg-surface)", 
      border: "1px solid var(--border-default)",
      borderRadius: "8px",
      overflow: "hidden",
      height: "32px"
    }}>
      <button 
        onClick={onDecrease}
        style={{ width: "28px", height: "100%", border: "none", background: "none", cursor: "pointer", color: "var(--neutral-400)", display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Minus size={14} />
      </button>
      <input 
        type="number" 
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        style={{ 
          width: "32px", 
          textAlign: "center", 
          border: "none", 
          background: "none", 
          color: "var(--neutral-50)", 
          fontSize: "12px", 
          fontWeight: 700,
          outline: "none",
          appearance: "none",
          margin: 0
        }}
      />
      <button 
        onClick={onIncrease}
        style={{ width: "28px", height: "100%", border: "none", background: "none", cursor: "pointer", color: "var(--neutral-400)", display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Plus size={14} />
      </button>
    </div>
  );

  const ProductCatalogCard = ({ p }: { p: Product }) => (
    <div 
      onClick={() => addToCart(p)}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--neutral-700)",
        borderRadius: "16px",
        padding: "20px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        height: "100%",
        position: "relative",
        overflow: "hidden"
      }}
      className="group hover:border-brand-500/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] active:scale-[0.98]"
    >
      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "white", marginBottom: "4px", lineHeight: "1.2" }}>{p.nombre}</h3>
        <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--neutral-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          REF: {p.sku}
        </span>
      </div>

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: "9px", fontWeight: 900, color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "2px" }}>Costo Ref.</p>
          <p style={{ fontSize: "20px", fontWeight: 900, color: "white", letterSpacing: "-0.03em" }}>{formatCurrency(p.costoPromedio || 0)}</p>
        </div>
        <div style={{ 
          width: "36px", 
          height: "36px", 
          borderRadius: "10px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          background: "var(--bg-base)",
          border: "1px solid var(--neutral-700)",
          color: "var(--neutral-300)",
          transition: "all 0.2s"
        }}
        className="group-hover:bg-brand-500 group-hover:text-white group-hover:border-brand-500"
        >
          <Plus size={18} strokeWidth={3} />
        </div>
      </div>
    </div>
  );

  const PurchaseItemCard = ({ item }: { item: PurchaseDetail }) => (
    <div style={{ 
      padding: "16px",
      background: "var(--bg-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      animation: "fadeIn 0.3s ease-out"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-50)", margin: 0, lineHeight: 1.2 }}>{item.nombre}</h4>
          <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--neutral-500)", fontFamily: "var(--font-mono)" }}>{item.sku}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "15px", fontWeight: 900, color: "var(--brand-400)", margin: 0 }}>
             {formatCurrency(item.unitPrice * item.quantity)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
        <QuantitySelector 
          value={item.quantity}
          onIncrease={() => updateQuantity(item.productId, 1)}
          onDecrease={() => updateQuantity(item.productId, -1)}
          onChange={(val: number) => setQuantity(item.productId, val)}
        />
        
        <div style={{ 
          flex: 1, 
          display: "flex", 
          alignItems: "center", 
          background: "var(--bg-surface)", 
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "0 10px",
          height: "32px",
          gap: "8px",
          transition: "border-color 0.2s"
        }}
        className="focus-within:border-brand-500/50"
        >
          <DollarSign size={14} className="text-neutral-500" />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--neutral-500)", textTransform: "uppercase" }}>Costo U.</span>
          <input 
            type="number"
            step="0.01"
            value={item.unitPrice}
            onChange={(e) => setUnitPrice(item.productId, parseFloat(e.target.value) || 0)}
            style={{ 
              flex: 1, 
              background: "none", 
              border: "none", 
              color: "var(--neutral-50)", 
              fontSize: "13px", 
              fontWeight: 800, 
              textAlign: "right", 
              outline: "none" 
            }}
          />
        </div>

        {/* Gap 1 — Campo de descuento por línea */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          background: "var(--bg-surface)", 
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "0 8px",
          height: "32px",
          gap: "4px",
          width: "80px",
          flexShrink: 0
        }}
        className="focus-within:border-brand-500/50"
        >
          <Percent size={12} className="text-neutral-500" />
          <input 
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={item.discountPct}
            onChange={(e) => setDiscount(item.productId, parseFloat(e.target.value) || 0)}
            style={{ 
              width: "100%",
              background: "none", 
              border: "none", 
              color: item.discountPct > 0 ? "var(--brand-400)" : "var(--neutral-50)", 
              fontSize: "12px", 
              fontWeight: 800,
              outline: "none" 
            }}
          />
        </div>

        <button 
          onClick={() => removeFromCart(item.productId)}
          style={{ 
            width: "32px", 
            height: "32px", 
            borderRadius: "8px", 
            border: "1px solid rgba(224,112,112,0.2)", 
            background: "rgba(224,112,112,0.05)", 
            color: "var(--color-danger)",
            cursor: "pointer",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-danger)", e.currentTarget.style.color = "white")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(224,112,112,0.05)", e.currentTarget.style.color = "var(--color-danger)")}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Gap 1 — Mostrar ahorro si hay descuento */}
      {item.discountPct > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed var(--neutral-800)" }}>
          <span style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 600 }}>Ahorro ({item.discountPct}%)</span>
          <span style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 800 }}>
            -{formatCurrency(item.quantity * item.unitPrice * (item.discountPct / 100))}
          </span>
        </div>
      )}

    </div>
  );

  // ----- RENDERIZADO DEL HISTÓRICO ----- //
  const renderHistory = () => (
    <>
      {/* Gap 3 — Filtros */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ minWidth: "200px", flex: 1 }}>
          <Select
            label="Proveedor"
            value={filterSupplierId}
            onChange={setFilterSupplierId}
            options={[{ value: "", label: "Todos los proveedores" }, ...suppliers.map(s => ({ value: String(s.id), label: s.nombre }))]}
            icon={<Building2 size={14} />}
          />
        </div>
        <div style={{ minWidth: "200px", flex: 1 }}>
          <Select
            label="Producto"
            value={filterProductId}
            onChange={setFilterProductId}
            options={[{ value: "", label: "Todos los productos" }, ...products.map(p => ({ value: String(p.id), label: p.nombre }))]}
            icon={<Package size={14} />}
          />
        </div>
        {(filterSupplierId || filterProductId) && (
          <button
            onClick={() => { setFilterSupplierId(""); setFilterProductId(""); }}
            style={{ alignSelf: "flex-end", marginBottom: "2px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border-default)", background: "transparent", color: "var(--neutral-400)", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      <Card title={`Diario de Transacciones Logísticas ${filteredOrders.length !== orders.length ? `(${filteredOrders.length} de ${orders.length})` : `(${orders.length})`}`}>
        {isLoadingOrders ? (
          <div className="flex justify-center p-10"><Spinner size={40} /></div>
        ) : (
          <DataTable
              columns={[
                { header: "No. Doc.", key: "id" },
                { header: "Proveedor", key: "supplier" },
                { header: "Destino", key: "branch" },
                { header: "Estimado", key: "date" },
                { header: "Recepción", key: "estado" },
                { header: "Pago", key: "pago" },  
                { header: "Inversión", key: "total", align: "right" },
                { header: "Acciones", key: "acciones", align: "right" }
              ]}
              data={filteredOrders.map(o => ({
                id: <span className="font-mono font-bold text-neutral-400">#{String(o.id).padStart(5, '0')}</span>,
                supplier: suppliers.find(s => s.id === o.supplierId)?.nombre || "N/A",
                branch: branches.find(b => b.id === o.branchId)?.nombre || "N/A",
                date: new Date(o.estimatedArrivalDate).toLocaleDateString(),
                estado: (
                  <Badge variant={o.receptionStatus === "PENDING" ? "warning" : o.receptionStatus === "IN_TRANSIT" ? "info" : "success"} dot>
                    {o.receptionStatus === "PENDING" ? "Pendiente" : o.receptionStatus === "IN_TRANSIT" ? "En tránsito" : "Recibido"}
                  </Badge>
                ),
                // Gap 2 — columna estado de pago
                pago: (
                  <Badge variant={o.paymentStatus === "PAGADO" ? "success" : "warning"} dot>
                    {o.paymentStatus === "PAGADO" ? "Pagado" : "Por pagar"}
                  </Badge>
                ),
                total: <span className="font-bold text-neutral-50 tracking-tight">{formatCurrency(o.total)}</span>,
                acciones: (
                   <div className="flex gap-2 justify-end">
                      {/* Gap 4 — botón Ver Detalle */}
                      <Button size="sm" variant="ghost" onClick={() => openOrderDetail(o)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Detalle
                      </Button>
                      {o.receptionStatus === "PENDING" && (
                           <Button size="sm" variant="ghost" className="border-neutral-700 hover:bg-brand-500/10 hover:text-brand-400" onClick={() => {
                               (apiClient.POST as any)(`/api/v1/purchases/${o.id}/dispatch`).then(() => fetchOrders());
                           }}>
                               <Truck className="h-4 w-4 mr-2" /> Despachar
                           </Button>
                      )}
                      {o.receptionStatus === "IN_TRANSIT" && (
                           <Button size="sm" variant="primary" onClick={() => receiveOrder(o.id)}>
                               <CheckCircle className="h-4 w-4 mr-2" /> Ingestar Stock
                           </Button>
                      )}
                      {/* Gap 2 — botón Registrar Pago */}
                      {o.receptionStatus === "RECEIVED_TOTAL" && o.paymentStatus === "POR_PAGAR" && (
                           <Button size="sm" variant="ghost" className="border-emerald-700/50 hover:bg-emerald-500/10 hover:text-emerald-400" onClick={() => registerPayment(o.id)}>
                               <CreditCard className="h-3.5 w-3.5 mr-1" /> Pagar
                           </Button>
                      )}
                      {o.receptionStatus === "RECEIVED_TOTAL" && o.paymentStatus === "PAGADO" && (
                           <div className="text-[10px] uppercase font-bold text-emerald-500 flex items-center pr-2"><CheckCircle className="h-3 w-3 mr-1"/>Completada</div>
                      )}
                   </div>
                )
              }))}
          />
        )}
      </Card>
    </>
  );

  // ----- RENDERIZADO DUAL-PANE POS-STYLE (Nueva Orden) ----- //
  const renderDualPaneOrder = () => (
    <main className="flex gap-8 flex-col lg:flex-row h-[82vh] animate-in fade-in zoom-in-95 duration-300">
        {/* PANEL IZQUIERDO: Búsqueda y Catálogo */}
        <div className="flex flex-[3] flex-col gap-5 min-w-0 bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 style={{ fontSize: "22px", fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>
                    MERCADO B2B
                  </h1>
                  <p style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "2px" }}>
                    Añade stock pactado a la orden
                  </p>
                </div>
                <div className="w-full md:w-72">
                    <Input
                        icon={<Search className="h-4 w-4 text-brand-500" />}
                        placeholder="Buscar material o SKU..."
                        value={searchTerm}
                        onChange={(e: any) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map(p => <ProductCatalogCard key={p.id} p={p} />)}
                </div>
                {filteredProducts.length === 0 && (
                   <EmptyState 
                       icon={<Search size={40} />}
                       title="Catálogo Vacío"
                       description="No se han encontrado productos base en tu sistema con esos términos."
                   />
                )}
            </div>
        </div>

        {/* PANEL DERECHO: Solicitud Borrador */}
        <div className="flex w-full lg:w-[480px] flex-col rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden relative">
            {/* Header: Metadatos de Orden */}
            <div className="flex flex-col gap-3 p-5 bg-neutral-900 border-b border-neutral-800 shadow-md z-10">
                <div className="flex justify-between items-center mb-1">
                    <h2 className="font-black text-neutral-100 uppercase tracking-tight flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-brand-500" /> Orden de Suministro
                    </h2>
                    {cart.length > 0 && (
                        <button className="text-[10px] uppercase font-black text-red-500/70 hover:text-red-400" onClick={clearCart}>Limpiar</button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Select
                        value={supplierId}
                        onChange={(val) => {
                            if (cart.length > 0 && confirm("Cambiar de proveedor vaciará los productos actuales en la solicitud. ¿Confirmas?")) {
                                setCart([]);
                                setSupplierId(val);
                            } else if (cart.length === 0) {
                                setSupplierId(val);
                            }
                        }}
                        options={[{ value: "", label: "TODOS LOS PROVEEDORES" }, ...suppliers.map(s => ({ value: String(s.id), label: s.nombre }))]}
                    />
                    <Select
                        value={branchId}
                        onChange={setBranchId}
                        options={[{ value: "", label: "DESTINO" }, ...branches.map(b => ({ value: String(b.id), label: b.nombre }))]}
                    />
                </div>
                {/* Gap 2 — plazo de pago + fecha estimada */}
                <div className="grid grid-cols-2 gap-3">
                   <Input
                        type="date"
                        value={estimatedArrival}
                        onChange={(e: any) => setEstimatedArrival(e.target.value)}
                        icon={<Calendar size={14} className="text-brand-500" />}
                    />
                    <Select
                        label="Plazo de pago"
                        value={paymentDueDays}
                        onChange={setPaymentDueDays}
                        options={[
                          { value: "0", label: "Pago inmediato" },
                          { value: "15", label: "15 días" },
                          { value: "30", label: "30 días" },
                          { value: "45", label: "45 días" },
                          { value: "60", label: "60 días" },
                          { value: "90", label: "90 días" },
                        ]}
                        icon={<Clock size={14} className="text-neutral-400" />}
                    />
                </div>
            </div>

            {/* Listado de Productos Negociados */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-neutral-950 flex flex-col gap-3">
                {cart.length > 0 ? (
                    cart.map(item => <PurchaseItemCard key={item.productId} item={item} />)
                ) : (
                    <div className="h-full flex items-center justify-center opacity-70">
                       <EmptyState 
                          icon={<ShoppingCart size={32} />}
                          title="Sin Ítems Logísticos"
                          description="Elige productos de la izquierda para conformar la solicitud al mayorista."
                       />
                    </div>
                )}
            </div>

            {/* Subtotal y Checkout Footer */}
            <div className="p-8 border-t border-neutral-800 bg-neutral-900 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] z-10 flex flex-col gap-6">
                <div>
                   <h3 style={{ fontSize: "11px", fontWeight: 900, color: "var(--neutral-400)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                      Resumen de <em>Inversión</em>
                   </h3>
                   <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-neutral-500">TOTAL ESTIMADO</span>
                      <span className="text-4xl font-black text-brand-400 tabular" style={{ textShadow: "0 0 30px var(--brand-glow)" }}>
                          {formatCurrency(financialSummary)}
                      </span>
                   </div>
                </div>

                <Button 
                    className="w-full h-16 text-[12px] font-black uppercase tracking-[0.2em] bg-brand-500 hover:bg-brand-400 text-white border-0 shadow-[0_15px_35px_rgba(217,99,79,0.3)] transition-all hover:-translate-y-1 active:translate-y-0"
                    variant="primary"
                    onClick={handleSubmitOrder}
                    loading={isSubmitting}
                >
                    Autorizar Solicitud <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    </main>
  );

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
        <PageHeader 
            title="Gestor de Abastecimiento"
            description="Control total B2B. Cada lote recibido reconstruye fiscalmente tu Costo Promedio Ponderado de inventario."
            actions={
                <div style={{ 
                  display: "flex", 
                  background: "var(--bg-base)", 
                  padding: "6px", 
                  borderRadius: "14px", 
                  border: "1px solid var(--neutral-700)",
                  gap: "6px",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)"
                }}>
                    <button
                        onClick={() => setActiveTab("history")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 20px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          background: activeTab === "history" ? "var(--neutral-600)" : "transparent",
                          color: activeTab === "history" ? "white" : "var(--neutral-400)",
                          border: "none"
                        }}
                    >
                        <TrendingUp size={14} /> Diario Histórico
                    </button>
                    <button
                        onClick={() => setActiveTab("new")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 20px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          background: activeTab === "new" ? "var(--brand-500)" : "transparent",
                          color: activeTab === "new" ? "white" : "var(--neutral-400)",
                          border: "none",
                          boxShadow: activeTab === "new" ? "0 4px 15px var(--brand-glow)" : "none"
                        }}
                    >
                        <ShoppingCart size={14} /> Nueva Negociación
                    </button>
                </div>
            }
        />

        {activeTab === "history" ? renderHistory() : renderDualPaneOrder()}

        {/* Gap 4 — Modal de Detalle de Orden */}
        {selectedOrder && (
          <div 
            style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", padding: "24px" }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}
          >
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "20px", width: "100%", maxWidth: "700px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }}>
              {/* Modal header */}
              <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "var(--neutral-50)" }}>
                    Orden #{String(selectedOrder.id).padStart(5, '0')}
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--neutral-500)", fontWeight: 600 }}>
                    {suppliers.find(s => s.id === selectedOrder.supplierId)?.nombre || "Proveedor N/A"}
                    {" "}→{" "}
                    {branches.find(b => b.id === selectedOrder.branchId)?.nombre || "Destino N/A"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Badge variant={selectedOrder.receptionStatus === "RECEIVED_TOTAL" ? "success" : selectedOrder.receptionStatus === "IN_TRANSIT" ? "info" : "warning"} dot>
                    {selectedOrder.receptionStatus === "PENDING" ? "Pendiente" : selectedOrder.receptionStatus === "IN_TRANSIT" ? "En tránsito" : "Recibido"}
                  </Badge>
                  <Badge variant={selectedOrder.paymentStatus === "PAGADO" ? "success" : "warning"} dot>
                    {selectedOrder.paymentStatus === "PAGADO" ? "Pagado" : "Por pagar"}
                  </Badge>
                  <button onClick={() => setSelectedOrder(null)} style={{ marginLeft: "8px", background: "none", border: "none", color: "var(--neutral-400)", cursor: "pointer", display: "flex", padding: "4px" }}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Info dates */}
              <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div><span style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase" }}>Solicitado</span><br/><span style={{ fontSize: "13px", fontWeight: 600 }}>{new Date(selectedOrder.requestDate).toLocaleDateString()}</span></div>
                <div><span style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase" }}>Estimado llegada</span><br/><span style={{ fontSize: "13px", fontWeight: 600 }}>{new Date(selectedOrder.estimatedArrivalDate).toLocaleDateString()}</span></div>
                {selectedOrder.actualArrivalDate && (<div><span style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase" }}>Llegada real</span><br/><span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brand-400)" }}>{new Date(selectedOrder.actualArrivalDate).toLocaleDateString()}</span></div>)}
              </div>

              {/* Items table */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
                {isLoadingDetail ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><Spinner size={32} /></div>
                ) : selectedOrder.details && selectedOrder.details.length > 0 ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                        {["Producto", "Cantidad", "P. Unitario", "Descuento", "Subtotal"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.details.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        const discPct = item.discountPct || 0;
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "12px", fontSize: "13px", fontWeight: 700 }}>{prod?.nombre || `Producto #${item.productId}`}<br/><span style={{ fontSize: "10px", color: "var(--neutral-500)" }}>{prod?.sku}</span></td>
                            <td style={{ padding: "12px", fontSize: "13px", color: "var(--neutral-300)" }}>{item.quantity}</td>
                            <td style={{ padding: "12px", fontSize: "13px" }}>{formatCurrency(item.unitPrice)}</td>
                            <td style={{ padding: "12px", fontSize: "13px", color: discPct > 0 ? "var(--brand-400)" : "var(--neutral-600)" }}>{discPct > 0 ? `-${discPct}%` : "—"}</td>
                            <td style={{ padding: "12px", fontSize: "14px", fontWeight: 800, color: "var(--neutral-50)" }}>{formatCurrency(item.subtotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "var(--neutral-500)", textAlign: "center", padding: "32px", fontSize: "13px" }}>Sin detalles disponibles</p>
                )}
              </div>

              {/* Footer con total y acciones */}
              <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase" }}>Total Orden</p>
                  <p style={{ margin: 0, fontSize: "26px", fontWeight: 900, color: "var(--brand-400)" }}>{formatCurrency(selectedOrder.total)}</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {selectedOrder.receptionStatus === "PENDING" && (
                    <Button size="sm" variant="ghost" onClick={() => { (apiClient.POST as any)(`/api/v1/purchases/${selectedOrder.id}/dispatch`).then(() => { fetchOrders(); setSelectedOrder(null); }); }}>
                      <Truck className="h-4 w-4 mr-1" /> Despachar
                    </Button>
                  )}
                  {selectedOrder.receptionStatus === "IN_TRANSIT" && (
                    <Button size="sm" variant="primary" onClick={() => { receiveOrder(selectedOrder.id); setSelectedOrder(null); }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Recibir Stock
                    </Button>
                  )}
                  {selectedOrder.receptionStatus === "RECEIVED_TOTAL" && selectedOrder.paymentStatus === "POR_PAGAR" && (
                    <Button size="sm" variant="primary" onClick={() => registerPayment(selectedOrder.id)}>
                      <CreditCard className="h-4 w-4 mr-1" /> Registrar Pago
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--neutral-800); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--neutral-700); }
        `}</style>
    </div>
  );
}
