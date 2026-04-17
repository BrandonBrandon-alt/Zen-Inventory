"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession, type AuthSession } from "@/api/auth";
import { useToast } from "@/context/ToastContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import { Search, ShoppingCart, Tag, Trash2, Plus, Minus, Package, User, Store, CheckCircle, Printer, XCircle, Trash, DollarSign } from "lucide-react";
import SaleReceipt from "@/components/sales-history/SaleReceipt";
import type { SaleReceiptData } from "@/components/sales-history/SaleReceipt";
import EmptyState from "@/components/ui/EmptyState";
import InventoryItemCard from "@/components/inventory/InventoryItemCard";
import { usePrint } from "@/hooks/usePrint";

interface InventoryItem {
  id: number;
  productId: number;
  productoNombre: string;
  sku: string;
  stockActual: number;
  precioVenta: number;
}

interface CartItem {
  productId: number;
  nombre: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  stockAvailable: number;
}

export default function POSPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { print, isPrinting } = usePrint();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [loading, setLoading] = useState(true);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [selectedPriceList, setSelectedPriceList] = useState<number | null>(null);
  const [priceLists, setPriceLists] = useState<{id: number, nombre: string}[]>([]);
  const [listPrices, setListPrices] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [lastSaleData, setLastSaleData] = useState<SaleReceiptData | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Persistence logic: Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("zen_inventory_pos_state");
    if (savedState) {
      try {
        const { cart: savedCart, customerName: savedName, customerDocument: savedDoc, selectedPriceList: savedPList } = JSON.parse(savedState);
        if (savedCart && Array.isArray(savedCart)) setCart(savedCart);
        if (savedName) setCustomerName(savedName);
        if (savedDoc) setCustomerDocument(savedDoc);
        if (savedPList) setSelectedPriceList(savedPList);
      } catch (e) {
        console.error("Error parsing saved POS state:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Persistence logic: Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    const stateToSave = {
      cart,
      customerName,
      customerDocument,
      selectedPriceList
    };
    localStorage.setItem("zen_inventory_pos_state", JSON.stringify(stateToSave));
  }, [cart, customerName, customerDocument, selectedPriceList, isLoaded]);

  useEffect(() => {
    const sess = getSession();
    if (!sess) {
      router.push("/login");
      return;
    }
    setSession(sess);

    const fetchData = async () => {
      try {
        const [inventoryRes, priceListsRes] = await Promise.all([
          sess.sucursalId ? apiClient.GET("/api/v1/inventory/branches/{branchId}", {
            params: { path: { branchId: sess.sucursalId } }
          }) : Promise.resolve({ data: null }),
          fetch("http://localhost:8080/api/v1/price-lists", {
            headers: { Authorization: `Bearer ${localStorage.getItem("zen_inventory_token")}` }
          }).catch(() => ({ ok: false, json: () => [] }))
        ]);

        if (inventoryRes.data) {
          setInventory(inventoryRes.data as any[]);
        }
        
        if (priceListsRes instanceof Response && priceListsRes.ok) {
          const listData = await priceListsRes.json();
          setPriceLists(listData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        showToast("Error al cargar datos del POS.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, showToast]);

  // Fetch prices when selected list changes, and recalculate cart prices
  useEffect(() => {
    const fetchListPrices = async () => {
      if (!selectedPriceList) {
        setListPrices({});
        return;
      }
      try {
        const res = await fetch(`http://localhost:8080/api/v1/price-lists/${selectedPriceList}/prices`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("zen_inventory_token")}` }
        });
        if (res.ok) {
          const data = await res.json();
          const pMap: Record<number, number> = {};
          data.forEach((pp: any) => {
            pMap[pp.productoId] = pp.precio;
          });
          setListPrices(pMap);
        }
      } catch (error) {
        console.error("Error fetching list prices:", error);
      }
    };

    fetchListPrices();
  }, [selectedPriceList]);

  // Recalculate cart unit prices when list prices change or inventory loads
  useEffect(() => {
    if (cart.length > 0 && inventory.length > 0) {
      setCart(prevCart => prevCart.map(item => {
        const baseProduct = inventory.find(i => i.productId === item.productId);
        const basePrice = baseProduct ? baseProduct.precioVenta : item.unitPrice;
        const newPrice = (selectedPriceList && listPrices[item.productId]) ? listPrices[item.productId] : basePrice;
        
        return item.unitPrice !== newPrice ? { ...item, unitPrice: newPrice } : item;
      }));
    }
  }, [listPrices, selectedPriceList, inventory]); // Do NOT include cart as dependency to avoid loop

  const getPriceListVariant = (id: number | null): "info" | "success" | "warning" | "neutral" => {
    if (!id) return "neutral";
    const variants: ("info" | "success" | "warning")[] = ["info", "success", "warning"];
    return variants[(id - 1) % variants.length];
  };

  const filteredProducts = useMemo(() => {
    return inventory.filter(item => 
      item.productoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  const addToCart = (product: InventoryItem) => {
    if (product.stockActual <= 0) {
      showToast("Este producto no tiene stock disponible.", "error");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.productId);
      if (existing) {
        if (existing.quantity >= product.stockActual) {
          showToast(`Solo hay ${product.stockActual} unidades disponibles.`, "warning");
          return prev;
        }
        return prev.map(item => 
          item.productId === product.productId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      const listPrice = selectedPriceList ? listPrices[product.productId] : null;
      const newPrice = listPrice || product.precioVenta;

      return [...prev, {
        productId: product.productId,
        nombre: product.productoNombre,
        sku: product.sku,
        quantity: 1,
        unitPrice: newPrice,
        discountPercentage: 0,
        stockAvailable: product.stockActual
      }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("¿Estás seguro de vaciar el carrito?")) {
      setCart([]);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > item.stockAvailable) {
          showToast(`Límite de stock: ${item.stockAvailable} unidades.`, "warning");
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (productId: number, value: number) => {
    if (value < 1) return;
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        if (value > item.stockAvailable) {
          showToast(`Límite de stock: ${item.stockAvailable} unidades.`, "warning");
          return { ...item, quantity: item.stockAvailable };
        }
        return { ...item, quantity: value };
      }
      return item;
    }));
  };

  const updateDiscount = (productId: number, percentage: number) => {
    if (percentage < 0 || percentage > 100) return;
    setCart(prev => prev.map(item => 
      item.productId === productId ? { ...item, discountPercentage: percentage } : item
    ));
  };

  const financials = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    
    // Suma de totales de línea (ya con sus descuentos individuales)
    const lineTotalsSum = cart.reduce((acc, item) => {
      const base = item.unitPrice * item.quantity;
      const discount = base * (item.discountPercentage / 100);
      return acc + (base - discount);
    }, 0);

    // Aplicar descuento global sobre el total de líneas
    const globalDiscountAmount = lineTotalsSum * (globalDiscount / 100);
    const totalFinal = lineTotalsSum - globalDiscountAmount;
    const totalDiscount = subtotal - totalFinal;

    return { subtotal, totalDiscount, totalFinal, globalDiscountAmount };
  }, [cart, globalDiscount]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const payload = {
        branchId: session?.sucursalId,
        userId: session?.id,
        customerName: customerName.trim() || null,
        customerDocument: customerDocument.trim() || null,
        globalDiscountPercentage: globalDiscount,
        priceListId: selectedPriceList || null,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          discountPercentage: item.discountPercentage
        }))
      };

      const { data, error, response } = await apiClient.POST("/api/v1/sales", { body: payload as any });
      
      if (error) {
        if ((response as any)?.status === 422) {
          const errMsg = (error as any).message || "Stock insuficiente o venta inválida.";
          showToast(errMsg, "error");
        } else {
          showToast("Error al procesar la venta. Intente de nuevo.", "error");
        }
        setIsSubmitting(false);
        return;
      }

      const saleData = data as any;
      setLastSaleId(saleData.id);

      // Capturar los datos ANTES de limpiar el carrito
      setLastSaleData({
        id: saleData.id,
        date: saleData.date || new Date().toISOString(),
        subtotal: financials.subtotal,
        totalDiscount: financials.totalDiscount,
        totalFinal: financials.totalFinal,
        branchName: saleData.branchName ?? null,
        userName: session?.nombre ?? null,
        customerName: customerName.trim() || null,
        customerDocument: customerDocument.trim() || null,
        globalDiscountPercentage: globalDiscount,
        details: cart.map((item, idx) => ({
          id: idx,
          productId: item.productId,
          productName: item.nombre,
          quantity: item.quantity,
          unitPriceApplied: item.unitPrice,
          discountPercentage: item.discountPercentage,
          subtotalLine: item.unitPrice * item.quantity * (1 - item.discountPercentage / 100),
        }))
      });

      showToast("Venta procesada exitosamente.", "success");
      setCart([]);
      setCustomerName("");
      setCustomerDocument("");
      setGlobalDiscount(0);
      setShowSuccessModal(true);
      
      // Refresh inventory
      if (session?.sucursalId) {
        const { data } = await apiClient.GET("/api/v1/inventory/branches/{branchId}", {
          params: { path: { branchId: session.sucursalId } }
        });
        if (data) {
          setInventory(data as unknown as InventoryItem[]);
        }
      }
    } catch (error: any) {
      showToast(error.message || "Error al procesar la venta.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!lastSaleData) return;
    print(<SaleReceipt sale={lastSaleData} />);
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setLastSaleId(null);
    setLastSaleData(null);
  };



  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

  if (loading) return <div className="flex h-screen items-center justify-center bg-neutral-950"><Spinner size={48} /></div>;

  // ── Sub-componentes Locales ───────────────────────────────────

  const QuantitySelector = ({ value, onIncrease, onDecrease, onChange, max }: any) => (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      background: "var(--bg-surface)", 
      border: "1px solid var(--border-default)",
      borderRadius: "12px",
      overflow: "hidden",
      height: "36px"
    }}>
      <button 
        onClick={onDecrease}
        style={{ width: "32px", height: "100%", border: "none", background: "none", cursor: "pointer", color: "var(--neutral-400)", display: "flex", alignItems: "center", justifyContent: "center" }}
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
          width: "36px", 
          textAlign: "center", 
          border: "none", 
          background: "none", 
          color: "var(--neutral-50)", 
          fontSize: "13px", 
          fontWeight: 700,
          outline: "none",
          appearance: "none",
          margin: 0
        }}
      />
      <button 
        onClick={onIncrease}
        style={{ width: "32px", height: "100%", border: "none", background: "none", cursor: "pointer", color: "var(--neutral-400)", display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Plus size={14} />
      </button>
    </div>
  );

  const CartItemCard = ({ item }: { item: CartItem }) => (
    <div style={{ 
      padding: "16px",
      background: "var(--bg-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      position: "relative",
      animation: "fadeIn 0.3s ease-out"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-50)", margin: 0, lineHeight: 1.2 }}>{item.nombre}</h4>
          <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--brand-400)", fontFamily: "var(--font-mono)" }}>{item.sku}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
            <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--neutral-50)", margin: 0 }}>{formatCurrency(item.unitPrice * item.quantity)}</p>
            {selectedPriceList && listPrices[item.productId] ? (
               <Badge variant={getPriceListVariant(selectedPriceList)} dot>{priceLists.find(l => l.id === selectedPriceList)?.nombre?.toUpperCase() || "LISTA"}</Badge>
            ) : (
               <Badge variant="info" dot>MINORISTA</Badge>
            )}
          </div>
          {item.discountPercentage > 0 && (
            <Badge variant="success" dot>{item.discountPercentage}% Dto</Badge>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <QuantitySelector 
          value={item.quantity}
          onIncrease={() => updateQuantity(item.productId, 1)}
          onDecrease={() => updateQuantity(item.productId, -1)}
          onChange={(val: number) => setQuantity(item.productId, val)}
          max={item.stockAvailable}
        />
        
        <div style={{ 
          flex: 1, 
          display: "flex", 
          alignItems: "center", 
          background: "var(--bg-surface)", 
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
          padding: "0 10px",
          height: "36px",
          gap: "8px"
        }}>
          <Tag size={12} color="var(--color-success)" />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--neutral-500)", textTransform: "uppercase" }}>Dto</span>
          <input 
            type="number"
            value={item.discountPercentage}
            onChange={(e) => updateDiscount(item.productId, parseInt(e.target.value) || 0)}
            style={{ 
              flex: 1, 
              background: "none", 
              border: "none", 
              color: "var(--color-success)", 
              fontSize: "13px", 
              fontWeight: 800, 
              textAlign: "right", 
              outline: "none" 
            }}
          />
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--neutral-600)" }}>%</span>
        </div>

        <button 
          onClick={() => removeFromCart(item.productId)}
          style={{ 
            width: "36px", 
            height: "36px", 
            borderRadius: "10px", 
            border: "1px solid rgba(224,112,112,0.2)", 
            background: "rgba(224,112,112,0.05)", 
            color: "var(--color-danger)",
            cursor: "pointer",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-danger)", e.currentTarget.style.color = "white")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(224,112,112,0.05)", e.currentTarget.style.color = "var(--color-danger)")}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      
      <PageHeader 
        title="Punto de Venta (POS)"
        description="Registro ágil de transacciones, caja y facturación para clientes locales."
      />

      <main className="flex gap-8 flex-col lg:flex-row h-[82vh] animate-in fade-in zoom-in-95 duration-300 mt-8">
        {/* Panel Izquierdo: Catálogo */}
        <div className="flex flex-[3] flex-col gap-5 min-w-0 bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>
                Catálogo B2C
              </h1>
              <p style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "2px" }}>
                Añade stock local a la orden
              </p>
            </div>
            <div className="w-full md:w-72">
              <Input
                icon={<Search className="h-4 w-4 text-brand-500" />}
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((item) => (
                <InventoryItemCard 
                  key={item.id}
                  item={item}
                  onClick={addToCart}
                  mode="add"
                  priceOverride={selectedPriceList ? listPrices[item.productId] : null}
                  priceListName={selectedPriceList ? priceLists.find(l => l.id === selectedPriceList)?.nombre?.toUpperCase() : "MINORISTA"}
                  priceListVariant={selectedPriceList ? getPriceListVariant(selectedPriceList) : "info"}
                />
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <EmptyState 
                icon={<Package size={48} />}
                title="Búsqueda sin resultados"
                description="No hay productos que coincidan con los términos de búsqueda o no hay stock disponible."
              />
            )}
          </div>
        </div>

        {/* Panel Derecho: Carrito */}
        <div className="flex w-full lg:w-[480px] flex-col rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden relative">
          <div className="flex flex-col gap-4 border-b border-neutral-800 px-6 py-5 bg-neutral-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-brand-500/10 p-2 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-brand-500" />
                </div>
                <div>
                  <h2 className="font-black text-neutral-100 uppercase tracking-tight">Carrito de Venta</h2>
                  <button 
                    onClick={clearCart}
                    className="text-[10px] text-neutral-500 hover:text-red-400 font-bold uppercase transition-colors"
                  >
                    Vaciar Todo
                  </button>
                </div>
              </div>
              <Badge variant="neutral">{cart.length} productos</Badge>
            </div>
            
            {/* Lista de Precios Movida a la Cabecera */}
            {priceLists.length > 0 && (
              <div className="pt-2 text-sm">
                <Select
                  label="Lista de Precios a Aplicar"
                  value={selectedPriceList?.toString() || ""}
                  onChange={(val: string) => setSelectedPriceList(val ? Number(val) : null)}
                  options={[
                    { value: "", label: "Precio Minorista (Reglas Base)" },
                    ...priceLists.map(l => ({ value: l.id.toString(), label: `Precio ${l.nombre} (Descuentos en cascada)` }))
                  ]}
                  icon={<DollarSign size={14} />}
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {cart.map((item) => (
              <CartItemCard key={item.productId} item={item} />
            ))}

            {cart.length === 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EmptyState 
                  icon={<ShoppingCart size={40} />}
                  title="Carrito vacío"
                  description="Añade productos del catálogo para comenzar la venta."
                />
              </div>
            )}
          </div>

          <div className="border-t border-neutral-800 bg-neutral-900/90 p-6 space-y-4">
            {/* Información del Cliente */}
            <div className="grid grid-cols-2 gap-4 pb-2">
              <Input 
                label="Cliente (Opcional)"
                placeholder="Nombre"
                value={customerName}
                onChange={(e: any) => setCustomerName(e.target.value)}
                icon={<User size={14} />}
              />
              <Input 
                label="Documento"
                placeholder="NIT / CC"
                value={customerDocument}
                onChange={(e: any) => setCustomerDocument(e.target.value)}
                icon={<Tag size={14} />}
              />
            </div>

            <div className="flex items-center gap-4 py-2 border-y border-neutral-800/50">
               <div className="flex-1">
                 <Input 
                   label="Descuento Global %"
                   type="number"
                   min="0"
                   max="100"
                   value={globalDiscount}
                   onChange={(e: any) => setGlobalDiscount(Number(e.target.value))}
                   icon={<Tag size={14} className="text-brand-400" />}
                 />
               </div>
               <div className="text-right flex flex-col justify-end h-full pt-6">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">Ahorro Global</span>
                  <span className="text-sm font-black text-brand-400">-{formatCurrency(financials.globalDiscountAmount)}</span>
               </div>
            </div>

            <div className="flex justify-between text-sm font-bold text-neutral-400">
              <span>Subtotal</span>
              <span className="text-neutral-100">{formatCurrency(financials.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-emerald-500">
              <span className="flex items-center gap-2"><Tag className="h-4 w-4" /> Descuento Total</span>
              <span>- {formatCurrency(financials.totalDiscount)}</span>
            </div>
            <div 
              className="flex justify-between text-2xl font-black text-neutral-50 pt-5 border-t border-neutral-800"
              style={{ borderTopStyle: "dashed" }}
            >
              <span>TOTAL</span>
              <span style={{ 
                color: "var(--brand-400)", 
                textShadow: "0 0 20px var(--brand-glow)" 
              }}>
                {formatCurrency(financials.totalFinal)}
              </span>
            </div>
            
            <Button 
              className="mt-6 w-full h-14 text-lg font-black bg-brand-600 hover:bg-brand-500 shadow-[0_10px_20px_rgba(235,108,31,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCheckout}
            >
              {isSubmitting ? <Spinner size={20} /> : <div className="flex items-center gap-3"><ShoppingCart className="h-6 w-6" /> <span>PROCESAR VENTA</span></div>}
            </Button>
          </div>
        </div>
      </main>

      {/* Modal de Éxito con Recibo */}
      {showSuccessModal && lastSaleData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-2xl scale-in-center">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
                <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                    <div>
                        <h2 className="text-xl font-bold">¡Venta Exitosa!</h2>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">REF #{String(lastSaleData.id).padStart(6, "0")}</p>
                    </div>
                </div>
                <button onClick={handleCloseModal} className="text-neutral-500 hover:text-white transition-colors">
                    <XCircle className="h-6 w-6" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-neutral-900 custom-scrollbar">
                <p className="text-neutral-400 text-center text-sm mb-6">
                  Transacción registrada correctamente. ¿Deseas imprimir el comprobante fiscal?
                </p>
                {/* Receipt preview — now with real data from lastSaleData */}
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden p-4 mx-auto max-w-[320px]">
                    <SaleReceipt sale={lastSaleData} />
                </div>
            </div>

            <div className="p-6 border-t border-neutral-800 flex gap-4 bg-neutral-950/50">
                <Button 
                    variant="ghost"
                    className="flex-1"
                    onClick={handleCloseModal}
                >
                    Cerrar
                </Button>
                <Button 
                    variant="primary"
                    className="flex-1"
                    onClick={handlePrint}
                    loading={isPrinting}
                    leftIcon={<Printer className="h-4 w-4" />}
                >
                    {isPrinting ? "Preparando..." : "Imprimir Ticket"}
                </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--neutral-800);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--neutral-700);
        }
      `}</style>
    </div>
  );
}
