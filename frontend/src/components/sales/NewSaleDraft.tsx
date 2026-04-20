import React from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import QuantitySelector from "@/components/ui/QuantitySelector";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { 
  Package, Search, Plus, ShoppingCart, 
  Trash2, DollarSign, Tag, ArrowRight,
  User, CheckCircle
} from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
};

const InventoryItemCard = ({ item, onAdd, priceOverride, priceListName, priceListVariant }: { 
  item: any; 
  onAdd: (p: any) => void;
  priceOverride?: number | null;
  priceListName?: string;
  priceListVariant?: any;
}) => (
  <Card
    onClick={() => onAdd(item)}
    className="p-5 cursor-pointer transition-all border-[var(--neutral-700)] bg-[var(--bg-card)] shadow-md hover:border-[var(--brand-400)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] group relative overflow-hidden flex flex-col h-full"
  >
    {/* Hover action badge */}
    <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="bg-[var(--brand-500)] text-[var(--neutral-50)] p-1 rounded-bl-lg shadow-lg">
        <Plus className="h-4 w-4" />
      </div>
    </div>

    {/* Header: SKU chip */}
    <div className="flex justify-between items-start mb-3">
      <span className="text-[10px] font-mono text-[var(--neutral-400)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--neutral-800)] uppercase">
        {item.sku}
      </span>
      <Badge variant={item.stockActual > 5 ? "success" : "warning"}>{item.stockActual} DISP.</Badge>
    </div>

    {/* Product name */}
    <h3 className="font-bold text-[var(--neutral-100)] group-hover:text-[var(--brand-400)] transition-colors line-clamp-2 min-h-[2.5rem] text-[15px] uppercase tracking-tight leading-tight">
      {item.productoNombre}
    </h3>

    {/* Price Area */}
    <div className="mt-auto pt-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-[var(--brand-500)] uppercase tracking-widest">{priceListName || "BÁSICO"}</span>
        {priceOverride && <div className="h-1 w-1 rounded-full bg-[var(--neutral-700)]" />}
      </div>
      <span className="text-xl font-black text-[var(--neutral-50)]">
        {formatCurrency(priceOverride || item.precioVenta)}
      </span>
      {priceOverride && (
        <span className="text-[10px] text-[var(--neutral-500)] line-through">
          {formatCurrency(item.precioVenta)}
        </span>
      )}
    </div>
  </Card>
);

const CartItemRow = ({ item, actions }: { item: any, actions: any }) => (
  <div className="p-4 bg-[var(--bg-card)] border border-[var(--neutral-800)] rounded-2xl flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-right-2">
    <div className="flex justify-between items-start gap-3">
      <div className="flex-1">
        <h4 className="text-[13px] font-black text-[var(--neutral-50)] leading-tight uppercase tracking-tight">{item.nombre}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-mono text-[var(--brand-500)] font-bold tracking-tight uppercase">SKU: {item.sku}</span>
          {item.priceListId && <Badge variant="info">LISTA #{item.priceListId}</Badge>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-[14px] font-black text-[var(--neutral-50)]">{formatCurrency(item.unitPrice * item.quantity * (1 - item.discountPercentage / 100))}</p>
        <p className="text-[10px] text-[var(--neutral-500)] font-bold">{formatCurrency(item.unitPrice)} un.</p>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="w-36">
        <QuantitySelector 
          value={item.quantity} 
          onIncrease={() => actions.updateQuantity(item.productId, 1)} 
          onDecrease={() => actions.updateQuantity(item.productId, -1)} 
          onChange={(val: number) => actions.setQuantity(item.productId, val)}
          size="sm"
        />
      </div>
      
      <div className="flex-1 flex items-center bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-xl px-2 h-9">
        <Tag size={12} className="text-[var(--brand-400)] mr-1" />
        <input 
          type="number" min="0" max="100" step="0.5" value={item.discountPercentage} 
          onChange={(e) => actions.updateDiscount(item.productId, e.target.value === "" ? 0 : parseFloat(e.target.value))}
          placeholder="0%"
          className="w-full bg-transparent border-none text-[12px] font-black focus:outline-none text-right placeholder-[var(--neutral-600)]"
        />
        <span className="text-[10px] font-black text-[var(--neutral-500)] ml-1">%</span>
      </div>

      <button 
        onClick={() => actions.removeFromCart(item.productId)}
        className="w-9 h-9 flex items-center justify-center text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-xl transition-all"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
);

interface NewSaleDraftProps {
  filteredProducts: any[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  cartActions: any;
  cart: any[];
  customerName: string;
  setCustomerName: (v: string) => void;
  customerDocument: string;
  setCustomerDocument: (v: string) => void;
  selectedPriceList: number | null;
  setSelectedPriceList: (v: number | null) => void;
  globalDiscount: number | "";
  setGlobalDiscount: (v: number | "") => void;
  financials: any;
  isSubmitting: boolean;
  handleCheckout: () => void;
  priceLists: any[];
  listPrices: any;
}

export default function NewSaleDraft({
  filteredProducts, searchTerm, setSearchTerm, cartActions, cart, 
  customerName, setCustomerName, customerDocument, setCustomerDocument,
  selectedPriceList, setSelectedPriceList, globalDiscount, setGlobalDiscount,
  financials, isSubmitting, handleCheckout, priceLists, listPrices
}: NewSaleDraftProps) {
  return (
    <main className="flex gap-8 flex-col lg:flex-row h-[82vh] animate-in fade-in zoom-in-95 duration-300 mt-8">
      {/* ── PANEL IZQUIERDO: CATÁLOGO ───────────────── */}
      <div className="flex flex-[3] flex-col gap-6 min-w-0 bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-3xl p-8 shadow-2xl overflow-hidden">
        
        {/* Selection Strategy Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-[var(--neutral-800)]">
          <Select 
            label="Lista de Precios Base" 
            value={selectedPriceList?.toString() || ""} 
            onChange={(val) => setSelectedPriceList(val ? Number(val) : null)} 
            options={[
              { value: "", label: "Precio General (Básico)" },
              ...priceLists.map(l => ({ value: String(l.id), label: `Tarifa: ${l.nombre}` }))
            ]} 
            icon={<DollarSign size={14} className="text-[var(--brand-500)]" />}
          />
          <div className="flex items-center gap-3 bg-[var(--bg-card)] px-4 rounded-xl border border-[var(--neutral-800)]">
             <div className="w-10 h-10 bg-[var(--brand-500)]/10 rounded-full flex items-center justify-center text-[var(--brand-400)] border border-[var(--brand-500)]/20 shadow-inner">
                <ShoppingCart size={18} />
             </div>
             <div>
                <span className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-[0.2em] block">Sede de Venta Activa</span>
                <span className="text-[12px] font-black text-[var(--neutral-100)] uppercase tracking-tight">Caja Principal / POS #1</span>
             </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h3 className="text-xl font-black text-[var(--neutral-50)] tracking-tight uppercase leading-none">Inventario Disponible</h3>
            <p className="text-[9px] text-[var(--neutral-500)] font-black uppercase tracking-[0.2em] mt-2">Sincronización en tiempo real con bodega</p>
          </div>
          
          <div className="w-full md:w-72">
            <Input 
              icon={<Search className="h-4 w-4 text-[var(--brand-500)]" />} 
              placeholder="Escanear SKU o nombre..." 
              value={searchTerm} 
              onChange={(e: any) => setSearchTerm(e.target.value)} 
              className="bg-[var(--bg-base)] border-[var(--neutral-800)]" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {filteredProducts.map(item => {
               const listPrice = (selectedPriceList && listPrices[selectedPriceList]) 
                  ? listPrices[selectedPriceList][item.productId] 
                  : null;
               return (
                 <InventoryItemCard 
                    key={item.id} 
                    item={item} 
                    onAdd={cartActions.addToCart} 
                    priceOverride={listPrice}
                    priceListName={selectedPriceList ? priceLists.find(l => l.id === selectedPriceList)?.nombre?.toUpperCase() : undefined}
                 />
               );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
              <Package size={64} strokeWidth={1} className="mb-4 text-[var(--neutral-500)]" />
              <p className="text-sm font-bold uppercase tracking-widest text-[var(--neutral-400)]">Sin existencias encontradas</p>
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO: CHECKOUT ───────────────── */}
      <div className="flex w-full lg:w-[480px] flex-col rounded-3xl border border-[var(--neutral-800)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden relative">
        <div className="flex flex-col gap-4 border-b border-[var(--neutral-800)] px-6 py-5 bg-[var(--bg-card)]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[var(--brand-500)]/10 p-2.5 rounded-xl border border-[var(--brand-500)]/20 shadow-inner">
                <CheckCircle className="h-5 w-5 text-[var(--brand-500)]" />
              </div>
              <div>
                <h2 className="font-black text-[var(--neutral-50)] text-base tracking-tight uppercase leading-tight">Módulo de Facturación</h2>
                <div className="flex items-center gap-2">
                   <button 
                     className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black text-[var(--neutral-500)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-all uppercase tracking-widest border border-transparent hover:border-[var(--color-danger)]/20" 
                     onClick={cartActions.clearCart}
                     title="Vaciar todos los productos del carrito"
                   >
                     <Trash2 size={10} />
                     Vaciar Carrito
                   </button>
                   <div className="w-1 h-1 rounded-full bg-[var(--neutral-700)]" />
                   <span className="text-[10px] font-black text-[var(--brand-400)] uppercase tracking-widest">{cart.length} ITEMS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 custom-scrollbar bg-[var(--bg-card)]/10">
          {cart.map(item => (
            <CartItemRow key={item.productId} item={item} actions={cartActions} />
          ))}

          {cart.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-12">
              <ShoppingCart size={40} className="mb-4 text-[var(--neutral-500)]" />
              <p className="text-xs font-black text-center text-[var(--neutral-500)] uppercase tracking-widest leading-loose">
                Punto de Venta Disponible<br/>
                <span className="text-[10px] opacity-60">Añade productos para generar factura</span>
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--neutral-800)] bg-[var(--bg-card)]/90 p-6 space-y-5 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] block">
          
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-widest flex items-center gap-1.5 ml-1">
                   <User size={10} className="text-[var(--brand-500)]" /> Cliente
                </label>
                <Input 
                  placeholder="Consumidor Final" 
                  value={customerName} 
                  onChange={(e: any) => setCustomerName(e.target.value)}
                  className="bg-[var(--bg-base)] border-[var(--neutral-800)] h-10 text-[12px] font-bold"
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-widest flex items-center gap-1.5 ml-1">
                   <Tag size={10} className="text-[var(--brand-500)]" /> Documento
                </label>
                <Input 
                  placeholder="NIT / CC" 
                  value={customerDocument} 
                  onChange={(e: any) => setCustomerDocument(e.target.value)}
                  className="bg-[var(--bg-base)] border-[var(--neutral-800)] h-10 text-[12px] font-bold"
                />
             </div>
          </div>

          {/* Global Discount */}
          <div className="flex items-center gap-4 py-3 border-y border-[var(--neutral-800)]/50">
             <div className="flex-1">
                <label className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-widest flex items-center gap-1.5 ml-1 mb-2">
                   <Percent size={10} className="text-[var(--brand-400)]" /> Desc. Global
                </label>
                <Input 
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={globalDiscount}
                  onChange={(e: any) => setGlobalDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-[var(--bg-base)] border-[var(--neutral-800)] h-10 text-[13px] font-black text-center"
                />
             </div>
             <div className="text-right flex flex-col justify-end">
                <span className="text-[9px] font-black text-[var(--neutral-500)] uppercase tracking-widest">Ahorro Aplicado</span>
                <span className="text-base font-black text-[var(--brand-400)] leading-none mt-1">
                   -{formatCurrency(financials.globalDiscountAmount)}
                </span>
             </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-[var(--neutral-400)] uppercase tracking-tighter">
               <span>Subtotal Bruto</span>
               <span>{formatCurrency(financials.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-black text-[var(--brand-400)] uppercase tracking-tighter">
               <span>Descuentos (Art. + Global)</span>
               <span>-{formatCurrency(financials.totalDiscount)}</span>
            </div>
            <div className="flex justify-between items-end pt-4 border-t border-[var(--neutral-800)] border-dashed mt-2">
              <span className="text-[10px] font-black text-[var(--neutral-100)] uppercase tracking-widest">Total a Facturar</span>
              <span className="text-3xl font-black text-[var(--neutral-50)] leading-none tabular" style={{ textShadow: "0 0 30px var(--brand-glow)" }}>
                {formatCurrency(financials.totalFinal)}
              </span>
            </div>
          </div>
          
          <Button 
            className="w-full h-14 mt-4 font-black tracking-widest shadow-[0_10px_30px_rgba(217,99,79,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group border-none"
            style={{ backgroundImage: 'linear-gradient(45deg, var(--brand-600), var(--brand-400))' }}
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCheckout}
          >
            <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12 -translate-x-full" />
            {isSubmitting ? (
              <Spinner size={24} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-base">REGISTRAR Y FACTURAR VENTA</span>
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

// Inline helper components
const Percent = ({ size, className }: { size?: number, className?: string }) => (
  <svg width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="19" y1="5" x2="5" y2="19"></line>
    <circle cx="6.5" cy="6.5" r="2.5"></circle>
    <circle cx="17.5" cy="17.5" r="2.5"></circle>
  </svg>
);
