"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { usePersistence } from "@/hooks/usePersistence";
import QuantitySelector from "@/components/ui/QuantitySelector";
import CartItemCard from "@/components/sales-history/CartItemCard";
import NewSaleDraft from "@/components/sales/NewSaleDraft";

// ── Types & Interfaces ─────────────────────────────────────

interface InventoryItem {
  id: number;
  productId: number;
  productoNombre: string;
  sku: string;
  stockActual: number;
  precioVenta: number;
  activo?: boolean;
}

interface CartItem {
  productId: number;
  nombre: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  stockAvailable: number;
  priceListId: number | null;
}

// ── Main Page ──────────────────────────────────────────────
function POSContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { print, isPrinting } = usePrint();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [globalDiscount, setGlobalDiscount] = useState<number | "">("");
  const [priceLists, setPriceLists] = useState<{id: number, nombre: string}[]>([]);
  const [listPrices, setListPrices] = useState<Record<number, Record<number, number>>>({}); // listId -> productId -> price
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [lastSaleData, setLastSaleData] = useState<SaleReceiptData | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const searchParams = useSearchParams();
  const productIdPreselected = searchParams.get("productId");

  const [posState, setPosState, isLoaded] = usePersistence("zen_inventory_pos_state", {
    cart: [] as CartItem[],
    customerName: "",
    customerDocument: "",
    selectedPriceList: null as number | null
  });

  const cart = posState.cart;
  const customerName = posState.customerName;
  const customerDocument = posState.customerDocument;
  const selectedPriceList = posState.selectedPriceList;

  const setCart = (val: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setPosState(prev => ({ ...prev, cart: typeof val === 'function' ? val(prev.cart) : val }));
  };
  const setCustomerName = (val: string) => setPosState(prev => ({ ...prev, customerName: val }));
  const setCustomerDocument = (val: string) => setPosState(prev => ({ ...prev, customerDocument: val }));
  const setSelectedPriceList = (val: number | null) => setPosState(prev => ({ ...prev, selectedPriceList: val }));

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
          apiClient.GET("/api/v1/price-lists" as any, {}).catch(() => (null))
        ]);

        if (inventoryRes.data) {
          setInventory(inventoryRes.data as any[]);
        }
        
        if (priceListsRes && priceListsRes.data) {
          const listData = priceListsRes.data as any[];
          setPriceLists(listData);
          
          // Precarga masiva de precios para todas las listas para permitir cambio instantáneo
          const priceMaps: Record<number, Record<number, number>> = {};
          await Promise.all(listData.map(async (list: any) => {
            const res = await apiClient.GET("/api/v1/price-lists/{id}/prices" as any, {
              params: { path: { id: list.id } }
            });
            if (res.data) {
              const prices = res.data as any[];
              const pMap: Record<number, number> = {};
              prices.forEach((pp: any) => {
                pMap[pp.productoId] = pp.precio;
              });
              priceMaps[list.id] = pMap;
            }
          }));
          setListPrices(priceMaps);
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

  // Ya no necesitamos los efectos de actualización global de precios del carrito
  // ya que ahora la selección es individual y por "override".

  const getPriceListVariant = (id: number | null): "info" | "success" | "warning" | "neutral" => {
    if (!id) return "neutral";
    const variants: ("info" | "success" | "warning")[] = ["info", "success", "warning"];
    return variants[(id - 1) % variants.length];
  };

  const filteredProducts = useMemo(() => {
    return inventory.filter(item => 
      (item.activo !== false) && 
      (item.productoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
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
      const listPrice = (selectedPriceList && listPrices[selectedPriceList]) 
        ? listPrices[selectedPriceList][product.productId] 
        : null;
      const newPrice = listPrice || product.precioVenta;

      return [...prev, {
        productId: product.productId,
        nombre: product.productoNombre,
        sku: product.sku,
        quantity: 1,
        unitPrice: newPrice,
        discountPercentage: 0,
        stockAvailable: product.stockActual,
        priceListId: selectedPriceList
      }];
    });
  };

  useEffect(() => {
    if (productIdPreselected && inventory.length > 0) {
      const prodId = parseInt(productIdPreselected);
      const product = inventory.find(item => item.productId === prodId);
      if (product) {
        addToCart(product);
      }
    }
  }, [productIdPreselected, inventory]);

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

  const updateItemPriceList = (productId: number, listId: number | null) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const baseProduct = inventory.find(i => i.productId === productId);
        const basePrice = baseProduct ? baseProduct.precioVenta : item.unitPrice;
        
        const newListPrice = (listId && listPrices[listId]) 
          ? listPrices[listId][productId] 
          : null;
          
        const newPrice = newListPrice || basePrice;
        
        return { ...item, priceListId: listId, unitPrice: newPrice };
      }
      return item;
    }));
  };

  const financials = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    
    // Suma de totales de línea (ya con sus descuentos individuales)
    const lineTotalsSum = cart.reduce((acc, item) => {
      const base = item.unitPrice * item.quantity;
      const discount = base * (item.discountPercentage / 100);
      return acc + (base - discount);
    }, 0);

    // Aplicar descuento global sobre el total de líneas (tratar "" como 0)
    const discountVal = Number(globalDiscount) || 0;
    const globalDiscountAmount = lineTotalsSum * (discountVal / 100);
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
        globalDiscountPercentage: Number(globalDiscount) || 0,
        priceListId: selectedPriceList || null,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          discountPercentage: item.discountPercentage,
          priceListId: item.priceListId
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
        globalDiscountPercentage: Number(globalDiscount) || 0,
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
      setGlobalDiscount("");
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

  const cartActions = {
    addToCart,
    removeFromCart,
    clearCart,
    updateQuantity,
    setQuantity,
    updateDiscount,
    updateItemPriceList
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]"><Spinner size={48} /></div>;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      
      <PageHeader 
        title="Punto de Venta (POS)"
        description="Gestión ágil de facturación minorista y convenios de precios corporativos."
      />

      <NewSaleDraft 
        filteredProducts={filteredProducts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        cartActions={cartActions}
        cart={cart}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerDocument={customerDocument}
        setCustomerDocument={setCustomerDocument}
        selectedPriceList={selectedPriceList}
        setSelectedPriceList={setSelectedPriceList}
        globalDiscount={globalDiscount}
        setGlobalDiscount={setGlobalDiscount}
        financials={financials}
        isSubmitting={isSubmitting}
        handleCheckout={handleCheckout}
        priceLists={priceLists}
        listPrices={listPrices}
      />

      {/* Modal de Éxito con Recibo */}
      {showSuccessModal && lastSaleData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--neutral-900)]/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[var(--bg-card)] border border-[var(--neutral-800)] rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-2xl scale-in-center">
            <div className="p-6 border-b border-[var(--neutral-800)] flex items-center justify-between bg-[var(--bg-surface)]/50">
                <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-[var(--color-success)]" />
                    <div>
                        <h2 className="text-xl font-bold text-[var(--neutral-50)]">¡Venta Exitosa!</h2>
                        <p className="text-xs text-[var(--neutral-500)] font-mono mt-0.5">REF #{String(lastSaleData.id).padStart(6, "0")}</p>
                    </div>
                </div>
                <button onClick={handleCloseModal} className="text-[var(--neutral-500)] hover:text-[var(--neutral-50)] transition-colors">
                    <XCircle className="h-6 w-6" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-card)] custom-scrollbar">
                <p className="text-[var(--neutral-400)] text-center text-sm mb-6">
                  Transacción registrada correctamente. ¿Deseas imprimir el comprobante fiscal?
                </p>
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden p-4 mx-auto max-w-[320px]">
                    <SaleReceipt sale={lastSaleData} />
                </div>
            </div>

            <div className="p-6 border-t border-[var(--neutral-800)] flex gap-4 bg-[var(--bg-surface)]/50">
                <Button variant="ghost" className="flex-1" onClick={handleCloseModal}>Cerrar</Button>
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--neutral-800); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--neutral-700); }
      `}</style>
    </div>
  );
}

export default function POSPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[var(--bg-base)]"><Spinner size={48} /></div>}>
      <POSContent />
    </Suspense>
  );
}
