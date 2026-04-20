import React from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import QuantitySelector from "@/components/ui/QuantitySelector";
import Spinner from "@/components/ui/Spinner";
import { 
  Package, Search, Plus, ShoppingCart, 
  Trash2, DollarSign, Percent, ArrowRight,
  Building2, Truck
} from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
};

const ProductCard = ({ product, onAdd }: { product: any; onAdd: (p: any) => void }) => (
  <Card
    onClick={() => onAdd(product)}
    className="p-5 cursor-pointer transition-all border-[var(--neutral-700)] bg-[var(--bg-card)] shadow-md hover:border-[var(--brand-500)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] group relative overflow-hidden"
  >
    {/* Hover action badge */}
    <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="bg-[var(--brand-500)] text-[var(--neutral-50)] p-1 rounded-bl-lg shadow-lg">
        <Plus className="h-4 w-4" />
      </div>
    </div>

    {/* Header: SKU chip */}
    <div className="flex justify-between items-start mb-4">
      <span className="text-[11px] font-mono text-[var(--neutral-400)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--neutral-800)]">
        {product.sku}
      </span>
    </div>

    {/* Product name */}
    <h3 className="font-bold text-[var(--neutral-100)] group-hover:text-[var(--brand-400)] transition-colors line-clamp-2 min-h-[3rem] text-lg uppercase tracking-tight">
      {product.nombre}
    </h3>

    {/* Price */}
    <div className="mt-6 flex items-baseline justify-between">
      <div className="flex flex-col">
        <p className="text-[10px] text-[var(--neutral-500)] uppercase font-black tracking-tighter">Costo ERP</p>
        <span className="text-xl font-black text-[var(--neutral-50)]">
          {formatCurrency(product.costoPromedio || 0)}
        </span>
      </div>
    </div>
  </Card>
);

const CartItemRow = ({ item, actions }: { item: any, actions: any }) => (
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
      <div className="w-[145px]">
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

interface NewPurchaseDraftProps {
  filteredProducts: any[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  cartActions: any;
  cart: any[];
  supplierId: string;
  setSupplierId: (v: string) => void;
  branchId: string;
  setBranchId: (v: string) => void;
  leadTimeDays: number;
  setLeadTimeDays: (v: number) => void;
  paymentDueDays: string;
  setPaymentDueDays: (v: string) => void;
  isSubmitting: boolean;
  handleSubmitOrder: () => void;
  financialSummary: number;
  suppliers: any[];
  branches: any[];
  branchDisabled?: boolean;
}

export default function NewPurchaseDraft({
  filteredProducts, searchTerm, setSearchTerm, cartActions, cart, 
  supplierId, setSupplierId, branchId, setBranchId, leadTimeDays, 
  setLeadTimeDays, paymentDueDays, setPaymentDueDays, 
  isSubmitting, handleSubmitOrder, financialSummary, suppliers, branches,
  branchDisabled = false
}: NewPurchaseDraftProps) {
  return (
    <main className="flex gap-8 flex-col lg:flex-row h-[82vh] animate-in fade-in zoom-in-95 duration-300 mt-8">
      {/* ── PANEL IZQUIERDO: CATÁLOGO ───────────────── */}
      <div className="flex flex-[3] flex-col gap-6 min-w-0 bg-[var(--bg-surface)] border border-[var(--neutral-800)] rounded-3xl p-8 shadow-2xl overflow-hidden">
        
        {/* Selection Strategy Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-[var(--neutral-800)]">
          <Select 
            label="Proveedor Estratégico" 
            value={supplierId} 
            onChange={setSupplierId} 
            options={[
              { value: "", label: "Seleccionar Proveedor" },
              ...suppliers.map(s => ({ value: String(s.id), label: s.nombre }))
            ]} 
          />
          <Select 
            label="Centro de Recepción" 
            value={branchId} 
            onChange={setBranchId} 
            disabled={branchDisabled}
            options={[
              { value: "", label: "Seleccionar Sucursal" },
              ...branches.map(b => ({ value: String(b.id), label: b.nombre }))
            ]} 
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h3 className="text-xl font-black text-[var(--neutral-50)] tracking-tight uppercase leading-none">Portafolio de Insumos</h3>
            <p className="text-[9px] text-[var(--neutral-500)] font-black uppercase tracking-[0.2em] mt-2">Disponibilidad contractual confirmada</p>
          </div>
          
          <div className="w-full md:w-72">
            <Input 
              icon={<Search className="h-4 w-4 text-[var(--brand-500)]" />} 
              placeholder="Buscar por SKU o Nombre..." 
              value={searchTerm} 
              onChange={(e: any) => setSearchTerm(e.target.value)} 
              disabled={!supplierId}
              className="bg-[var(--bg-base)] border-[var(--neutral-800)]" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pt-2">
          {!supplierId ? (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-[var(--bg-card)]/20 rounded-3xl border border-dashed border-[var(--neutral-800)]">
              <div className="w-16 h-16 bg-[var(--brand-500)]/10 rounded-full flex items-center justify-center mb-4 border border-[var(--brand-500)]/20">
                <Building2 className="h-8 w-8 text-[var(--brand-500)]" />
              </div>
              <h4 className="text-sm font-black text-[var(--neutral-100)] uppercase tracking-widest">Catálogo Restringido</h4>
              <p className="text-[11px] text-[var(--neutral-500)] font-medium mt-2 text-center max-w-[250px]">
                Selecciona un <span className="text-[var(--brand-400)] font-bold">socio comercial</span> para habilitar su portafolio de productos asociados.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={cartActions.addToCart} />)}
              </div>
              {filteredProducts.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                  <Package size={64} strokeWidth={1} className="mb-4 text-[var(--neutral-500)]" />
                  <p className="text-sm font-bold uppercase tracking-widest text-[var(--neutral-400)]">Sin resultados para este proveedor</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO: CHECKOUT ───────────────── */}
      <div className="flex w-full lg:w-[480px] flex-col rounded-3xl border border-[var(--neutral-800)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden relative">
        <div className="flex flex-col gap-4 border-b border-[var(--neutral-800)] px-6 py-5 bg-[var(--bg-card)]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[var(--brand-500)]/10 p-2.5 rounded-xl border border-[var(--brand-500)]/20">
                <ShoppingCart className="h-5 w-5 text-[var(--brand-500)]" />
              </div>
              <div>
                <h2 className="font-black text-[var(--neutral-50)] text-base tracking-tight uppercase">Resumen de Negociación</h2>
                {cart.length > 0 && (
                   <button 
                     className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black text-[var(--neutral-500)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-all uppercase tracking-widest border border-transparent hover:border-[var(--color-danger)]/20" 
                     onClick={cartActions.clearCart}
                     title="Vaciar todos los productos del borrador"
                   >
                     <Trash2 size={10} />
                     Vaciar Carrito
                   </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 custom-scrollbar bg-[var(--bg-card)]/20">
          {cart.map(item => (
            <CartItemRow key={item.productId} item={item} actions={cartActions} />
          ))}

          {cart.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-12">
              <Plus size={40} className="mb-4 text-[var(--neutral-500)]" />
              <p className="text-xs font-black text-center text-[var(--neutral-500)] uppercase tracking-widest">Carrito de Compras Vacío</p>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--neutral-800)] bg-[var(--bg-card)]/90 p-5 space-y-4 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] block">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest flex items-center gap-1.5 ml-1">
                <Truck size={12} className="text-[var(--brand-500)]" />
                Entrega (Días)
              </label>
              <Input 
                type="number" 
                min="1"
                placeholder="Plazo"
                value={leadTimeDays} 
                onChange={(e: any) => setLeadTimeDays(parseInt(e.target.value) || 0)} 
                className="bg-[var(--bg-base)] border-[var(--neutral-800)] h-11 text-[13px] font-bold"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest flex items-center gap-1.5 ml-1">
                <DollarSign size={12} className="text-[var(--brand-500)]" />
                Plazo de Pago
              </label>
              <Select
                placement="top" 
                value={paymentDueDays}
                onChange={setPaymentDueDays}
                options={[
                  { value: "0", label: "Contado" },
                  { value: "15", label: "15 Días" },
                  { value: "30", label: "30 Días" },
                  { value: "60", label: "60 Días" }
                ]}
              />
            </div>
          </div>

          <div className="flex justify-between items-end pt-2 border-t border-[var(--neutral-800)]/40 mt-2">
            <span className="text-[10px] font-black text-[var(--neutral-400)] uppercase tracking-widest">Valor Neto a Emitir</span>
            <span className="text-2xl font-black text-[var(--brand-400)] leading-none" style={{ textShadow: "0 0 20px var(--brand-glow)" }}>
              {formatCurrency(financialSummary)}
            </span>
          </div>
          
          <Button 
            className="w-full h-14 mt-4 font-black tracking-widest shadow-[0_10px_20px_rgba(217,99,79,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group border-none"
            style={{ backgroundImage: 'linear-gradient(45deg, var(--brand-600), var(--brand-400))' }}
            disabled={cart.length === 0 || isSubmitting || !supplierId || !branchId}
            onClick={handleSubmitOrder}
          >
            <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12 -translate-x-full" />
            {isSubmitting ? (
              <Spinner size={20} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm">NOTIFICAR ÓRDEN DE COMPRA</span>
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
