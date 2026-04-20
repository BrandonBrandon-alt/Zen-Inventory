"use client";

import { useEffect, useState, useTransition } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { Package, Plus, Edit, Trash2, Search, Tag, Truck, DollarSign, ChevronDown, ChevronUp, RefreshCw, XCircle } from "lucide-react";

import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Toolbar from "@/components/ui/Toolbar";
import { useToast } from "@/context/ToastContext";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import SearchFilter from "@/components/ui/SearchFilter";

// Types from schema
type ProductResponse = components["schemas"]["ProductResponse"] & { 
  proveedores?: any[];
  activo?: boolean;
};
type SupplierResponse = components["schemas"]["SupplierResponse"];
type UnitOfMeasureResponse = components["schemas"]["UnitOfMeasureResponse"];

interface PriceList { id: number; nombre: string; descripcion: string; }
interface ProductPriceResponse { id: number; listaId: number; productoId: number; precio: number; }

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

export default function MasterProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [units, setUnits] = useState<UnitOfMeasureResponse[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "nombre", direction: "asc" });
  const [isPending, startTransition] = useTransition();

  // Price list state (por lista: { [listaId]: precio })
  const [priceListValues, setPriceListValues] = useState<Record<number, string>>({});
  const [priceListLoading, setPriceListLoading] = useState(false);
  const [showPriceLists, setShowPriceLists] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    sku: "",
    nombre: "",
    costoPromedio: "" as number | "",
    precioVenta: "" as number | "",
    unitId: 0,
    activo: true
  });
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [router]);

  async function fetchData() {
    setLoading(true);
    try {
      const [prodRes, suppRes, unitRes, listRes] = await Promise.all([
        apiClient.GET("/api/catalog/products"),
        apiClient.GET("/api/catalog/suppliers"),
        apiClient.GET("/api/catalog/units"),
        apiClient.GET("/api/v1/price-lists" as any, {}).then(r => r.data),
      ]);
      setProducts(prodRes.data ?? []);
      setSuppliers(suppRes.data ?? []);
      setUnits(unitRes.data ?? []);
      setPriceLists(listRes ?? []);
    } catch (error) {
      console.error("Error fetching master data:", error);
      showToast("Error al cargar los datos del catálogo.", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = async (product?: ProductResponse) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku ?? "",
        nombre: product.nombre ?? "",
        costoPromedio: product.costoPromedio ?? "",
        precioVenta: product.precioVenta ?? "",
        unitId: product.unitId ?? 0,
        activo: product.activo ?? true
      });
      // FIX: Normalizar IDs a número al cargar desde el producto
      setSelectedSupplierIds(
        (product as any).proveedores?.map((sp: any) => Number(sp.id)) ?? []
      );

      // Cargar precios por lista existentes para este producto
      if (product.id && priceLists.length > 0) {
        setPriceListLoading(true);
        try {
          const priceMap: Record<number, string> = {};
          await Promise.all(priceLists.map(async (lista) => {
            const res = await apiClient.GET("/api/v1/price-lists/{id}/products/{productId}/price" as any, {
              params: { path: { id: lista.id, productId: product.id } }
            });
            const data = (res.data ?? {}) as any;
            if (data.fromList && data.precio != null) {
              priceMap[lista.id] = data.precio.toString();
            } else {
              priceMap[lista.id] = "";
            }
          }));
          setPriceListValues(priceMap);
        } finally {
          setPriceListLoading(false);
        }
      }
      setShowPriceLists(true);
    } else {
      setEditingProduct(null);
      setFormData({ 
        sku: "", 
        nombre: "", 
        costoPromedio: "", 
        precioVenta: "", 
        unitId: units[0]?.id ?? 0,
        activo: true
      });
      setSelectedSupplierIds([]);
      const defaults: Record<number, string> = {};
      priceLists.forEach(l => { defaults[l.id] = ""; });
      setPriceListValues(defaults);
      setShowPriceLists(false);
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        let savedProductId: number | undefined = editingProduct?.id;

        if (selectedSupplierIds.length === 0) {
          showToast("Debe asociar al menos un proveedor al producto.", "warning", "Validación requerida");
          return;
        }

        if (editingProduct) {
          await apiClient.PUT("/api/catalog/products/{id}", {
            params: { path: { id: editingProduct.id! } },
            body: {
              ...formData,
              costoPromedio: Number(formData.costoPromedio) || 0,
              precioVenta: Number(formData.precioVenta) || 0,
              supplierIds: selectedSupplierIds,
              activo: formData.activo
            } as any,
          });
          showToast("Producto actualizado correctamente.", "success", "Cambios guardados");
        } else {
          const res = await apiClient.POST("/api/catalog/products", { 
            body: {
              ...formData,
              costoPromedio: Number(formData.costoPromedio) || 0,
              precioVenta: Number(formData.precioVenta) || 0,
              supplierIds: selectedSupplierIds
            } as any 
          });
          savedProductId = (res.data as any)?.id;
          showToast("Nuevo producto registrado en el catálogo.", "success", "Registro exitoso");
        }

        // Guardar/eliminar precios por lista
        if (savedProductId) {
          await Promise.all(priceLists.map(async (lista) => {
            const rawVal = priceListValues[lista.id];
            const precio = parseFloat(rawVal);
            if (rawVal && !isNaN(precio) && precio > 0) {
              await apiClient.PUT("/api/v1/price-lists/{id}/products/{productId}/price" as any, {
                params: { path: { id: lista.id, productId: savedProductId } },
                body: { precio }
              });
            } else if (!rawVal || rawVal === "") {
              await apiClient.DELETE("/api/v1/price-lists/{id}/products/{productId}/price" as any, {
                params: { path: { id: lista.id, productId: savedProductId } }
              }).catch(() => {});
            }
          }));
        }

        setShowModal(false);
        fetchData();
      } catch (error) {
        showToast("Error al guardar el producto. Verifica el SKU.", "error");
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Desactivar este producto del catálogo maestro? Ya no se podrá usar en nuevas ventas o compras.")) return;
    try {
      console.log("[DEBUG] Deactivating Product ID:", id);
      const res = await apiClient.DELETE("/api/catalog/products/{id}", { params: { path: { id } } });
      console.log("[DEBUG] DELETE Response:", res);
      showToast("El producto ha sido desactivado.", "success", "Producto desactivado");
      fetchData();
    } catch (error) {
      showToast("No se pudo desactivar el producto.", "error");
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const filteredAndSortedProducts = (products || []).filter(p => {
    const term = searchTerm.toLowerCase();
    const unit = (p.unitAbbreviation || "").toLowerCase();
    const price = (p.precioVenta ?? 0).toString();

    return (
      p.nombre?.toLowerCase().includes(term) || 
      p.sku?.toLowerCase().includes(term) ||
      unit.includes(term) ||
      price.includes(term)
    );
  }).sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    let valA: any = (a as any)[sortConfig.key];
    let valB: any = (b as any)[sortConfig.key];
    
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // FIX: Helper para agregar proveedor con normalización de tipo
  const handleAddSupplier = (val: string) => {
    if (!val) return;
    const id = Number(val);
    setSelectedSupplierIds(prev => {
      const normalized = prev.map(Number);
      if (normalized.includes(id)) return prev;
      return [...prev, id];
    });
  };

  // FIX: Helper para eliminar proveedor con normalización de tipo
  const handleRemoveSupplier = (id: number) => {
    setSelectedSupplierIds(prev => prev.filter(sid => Number(sid) !== Number(id)));
  };

  const columns: Column<ProductResponse>[] = [
    {
      header: "SKU",
      key: "sku",
      width: "120px",
      sortable: true,
      render: (p: ProductResponse) => <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 600, color: "var(--brand-400)" }}>{p.sku}</span>
    },
    {
      header: "Nombre",
      key: "nombre",
      sortable: true,
      render: (p: ProductResponse) => <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--neutral-100)" }}>{p.nombre}</span>
    },
    {
      header: "Unidad",
      key: "unitAbbreviation",
      width: "100px",
      sortable: true,
      render: (p: ProductResponse) => <Badge variant="neutral">{p.unitAbbreviation || "N/A"}</Badge>
    },
    {
      header: "Estado",
      key: "activo",
      width: "100px",
      sortable: true,
      render: (p: ProductResponse) => (
        <Badge variant={p.activo ? "success" : "neutral"} dot>
          {p.activo ? "Activo" : "Inactivo"}
        </Badge>
      )
    },
    {
      header: "Proveedor",
      key: "proveedores",
      width: "220px",
      render: (p: ProductResponse) => {
        const provs = p.proveedores || [];
        if (provs.length === 0) return (
          <div className="flex items-center gap-1.5 text-[var(--color-danger)] animate-pulse">
            <XCircle size={12} />
            <span style={{ fontStyle: "italic", fontSize: "11px", fontWeight: 700 }}>SIN PROVEEDOR</span>
          </div>
        );
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--neutral-100)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
              {provs[0].nombre}
            </span>
            {provs.length > 1 && (
              <span style={{
                background: "rgba(111,114,242,0.1)",
                color: "var(--brand-400)",
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontWeight: 900,
                border: "1px solid rgba(111,114,242,0.2)",
                fontFamily: "var(--font-primary)"
              }}>
                +{provs.length - 1}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: "Precio Base",
      key: "precioVenta",
      align: "right",
      sortable: true,
      render: (p: ProductResponse) => (
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-200)" }}>
          {formatCurrency(p.precioVenta ?? 0)}
        </span>
      )
    },
    {
      header: "Acciones",
      key: "actions",
      align: "right",
      width: "100px",
      render: (p: ProductResponse) => (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(p)} title="Editar producto">
            <Edit size={14} />
          </Button>
          {p.activo && (
            <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id!)} title="Desactivar producto">
              <span style={{ color: "var(--brand-500)" }}><Trash2 size={14} /></span>
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Catálogo Maestro"
        description="Gestiona los productos base que se replican en todas las sucursales del sistema."
      />

      <Toolbar
        left={
          <SearchFilter 
            placeholder="Buscar por SKU o nombre..."
            value={searchTerm}
            onChange={setSearchTerm}
            containerClassName="w-[450px]"
          />
        }
        right={
          <Button leftIcon={<Plus size={15} />} onClick={() => handleOpenModal()} className="mt-1">
            Nuevo Producto
          </Button>
        }
      />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <DataTable<ProductResponse>
          itemsPerPage={25}
          columns={columns}
          data={filteredAndSortedProducts}
          sortConfig={sortConfig}
          onSort={handleSort}
          isLoading={loading}
          emptyState={{
            title: "Catálogo vacío",
            description: "No hay productos registrados en el catálogo maestro.",
            icon: <Package size={40} />,
            action: (
              <Button size="sm" onClick={() => handleOpenModal()} leftIcon={<Plus size={13} />}>
                Crear primer producto
              </Button>
            )
          }}
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? "Editar Producto" : "Nuevo Producto"}
        description="Define las características globales del producto."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} disabled={isPending}>Cancelar</Button>
            <Button size="sm" loading={isPending} onClick={handleSubmit as any}>Guardar Producto</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input
            label="SKU (Identificador Único)"
            value={formData.sku}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, sku: e.target.value })}
            icon={<Tag size={15} />}
            placeholder="Ej. OPT-001"
            required
          />
          <Input
            label="Nombre del Producto"
            value={formData.nombre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nombre: e.target.value })}
            icon={<Package size={15} />}
            placeholder="Ej. Gafas de Sol Clásicas"
            required
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Input
              type="number"
              label="Costo Promedio"
              value={formData.costoPromedio}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, costoPromedio: e.target.value === "" ? "" : Number(e.target.value) })}
              icon={<span style={{ fontSize: "12px", fontWeight: 700 }}>$</span>}
              placeholder="0"
            />
            <Input
              type="number"
              label="Precio Venta Base (Fallback)"
              value={formData.precioVenta}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, precioVenta: e.target.value === "" ? "" : Number(e.target.value) })}
              icon={<span style={{ fontSize: "12px", fontWeight: 700 }}>$</span>}
              placeholder="0"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Select
              label="Unidad de Medida"
              value={formData.unitId.toString()}
              onChange={(val: string) => setFormData({ ...formData, unitId: Number(val) })}
              icon={<Search size={15} />}
              options={[
                { value: "0", label: "Selecciona unidad" },
                ...units.map(u => ({ value: u.id!.toString(), label: `${u.nombre} (${u.abreviatura})` }))
              ]}
            />
          </div>

          {/* ── Gestión Multi-Proveedor ─────────────────────────────────── */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "10px", 
            padding: "16px", 
            background: "rgba(255,255,255,0.02)", 
            border: "1px solid var(--neutral-800)", 
            borderRadius: "16px" 
          }}>
            <div style={{ display: "flex", justifyContent: "between", alignItems: "center" }}>
              <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--neutral-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Red de Suministro (Proveedores)
              </label>
              {selectedSupplierIds.length === 0 && (
                <Badge variant="warning">OBLIGATORIO</Badge>
              )}
            </div>

            {/* FIX: Usar handleAddSupplier y filtrar con Number() para evitar type mismatch */}
            <Select
              value=""
              onChange={handleAddSupplier}
              placeholder="Asociar otro proveedor..."
              icon={<Truck size={15} />}
              options={suppliers
                .filter(s => !selectedSupplierIds.map(Number).includes(Number(s.id)))
                .map(s => ({ value: s.id!.toString(), label: s.nombre ?? "" }))
              }
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
              {selectedSupplierIds.map(id => {
                const s = suppliers.find(sup => Number(sup.id) === Number(id));
                return (
                  <div 
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--neutral-700)",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--neutral-100)",
                      transition: "all 0.2s"
                    }}
                  >
                    <Truck size={12} className="text-[var(--brand-400)]" />
                    {s?.nombre}
                    {/* FIX: Usar handleRemoveSupplier con forma funcional */}
                    <button 
                      type="button"
                      onClick={() => handleRemoveSupplier(id)}
                      style={{
                        marginLeft: "4px",
                        padding: "2px",
                        color: "var(--neutral-500)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex"
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {selectedSupplierIds.length === 0 && (
                <p style={{ fontSize: "12px", fontStyle: "italic", color: "var(--neutral-500)", padding: "4px" }}>
                  No hay proveedores asociados. Use el selector arriba para añadir.
                </p>
              )}
            </div>
          </div>

          {/* ── Control de Activación (Solo en edición) ─────────────────── */}
          {editingProduct && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: "12px",
              border: "1px solid var(--neutral-700)",
              marginTop: "4px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: formData.activo ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: formData.activo ? "var(--color-success)" : "var(--brand-500)",
                  transition: "all 0.3s ease"
                }}>
                  <RefreshCw size={18} className={!formData.activo ? "animate-spin-slow" : ""} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-100)" }}>
                    {formData.activo ? "Producto Activo" : "Producto Inactivo"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--neutral-400)" }}>
                    {formData.activo 
                      ? "Disponible en todas las operaciones del sistema." 
                      : "Restringido en POS, Compras y Traslados."}
                  </div>
                </div>
              </div>
              
              <div 
                onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                style={{
                  width: "48px",
                  height: "26px",
                  borderRadius: "999px",
                  background: formData.activo ? "var(--color-success)" : "var(--neutral-600)",
                  padding: "3px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: formData.activo ? "flex-end" : "flex-start"
                }}
              >
                <div style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                }} />
              </div>
            </div>
          )}

          {/* ── Sección de Listas de Precios ─────────────────────────────── */}
          {priceLists.length > 0 && (
            <div style={{
              borderRadius: "10px",
              border: "1px solid var(--neutral-700)",
              overflow: "hidden",
              marginTop: "4px",
            }}>
              <button
                type="button"
                onClick={() => setShowPriceLists(!showPriceLists)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--neutral-800)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--neutral-100)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600 }}>
                  <DollarSign size={14} style={{ color: "var(--brand-400)" }} />
                  Precios por Lista
                  <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--neutral-400)" }}>
                    (opcional — si está vacío se usa el Precio Base)
                  </span>
                </span>
                {showPriceLists ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showPriceLists && (
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "var(--neutral-900)" }}>
                  {priceListLoading ? (
                    <div style={{ textAlign: "center", padding: "12px" }}>
                      <Spinner size={20} />
                    </div>
                  ) : (
                    priceLists.map(lista => (
                      <div key={lista.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: "0 0 130px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-200)" }}>{lista.nombre}</span>
                          <div style={{ fontSize: "11px", color: "var(--neutral-500)", marginTop: "2px" }}>{lista.descripcion}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Input
                            type="number"
                            placeholder={`Precio ${lista.nombre} (vacío = usa precio base)`}
                            value={priceListValues[lista.id] ?? ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setPriceListValues(prev => ({ ...prev, [lista.id]: e.target.value }))
                            }
                            icon={<DollarSign size={13} />}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}