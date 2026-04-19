"use client";

import { useEffect, useState, useTransition } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { Package, Plus, Edit, Trash2, Search, Tag, Truck, DollarSign, ChevronDown, ChevronUp } from "lucide-react";

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
type ProductResponse = components["schemas"]["ProductResponse"];
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
    proveedorId: 0,
    unitId: 0,
  });
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
        proveedorId: product.proveedorId ?? 0,
        unitId: product.unitId ?? 0,
      });

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
        proveedorId: suppliers[0]?.id ?? 0, 
        unitId: units[0]?.id ?? 0 
      });
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

        if (editingProduct) {
          await apiClient.PUT("/api/catalog/products/{id}", {
            params: { path: { id: editingProduct.id! } },
            body: {
              ...formData,
              costoPromedio: Number(formData.costoPromedio) || 0,
              precioVenta: Number(formData.precioVenta) || 0,
            } as any,
          });
          showToast("Producto actualizado correctamente.", "success", "Cambios guardados");
        } else {
          const res = await apiClient.POST("/api/catalog/products", { 
            body: {
              ...formData,
              costoPromedio: Number(formData.costoPromedio) || 0,
              precioVenta: Number(formData.precioVenta) || 0,
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
              // Si se borra el campo, eliminar precio de la lista (fallback a precio base)
              await apiClient.DELETE("/api/v1/price-lists/{id}/products/{productId}/price" as any, {
                params: { path: { id: lista.id, productId: savedProductId } }
              }).catch(() => {}); // Ignorar error si no existía
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
    if (!confirm("¿Estás seguro de eliminar este producto del catálogo maestro?")) return;
    try {
      await apiClient.DELETE("/api/catalog/products/{id}", { params: { path: { id } } });
      showToast("El producto ha sido eliminado del catálogo.", "success");
      fetchData();
    } catch (error) {
      showToast("No se puede eliminar: tiene movimientos asociados.", "error");
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
    const supplierName = suppliers.find(s => s.id === p.proveedorId)?.nombre?.toLowerCase() || "";
    const unit = (p.unitAbbreviation || "").toLowerCase();
    const price = (p.precioVenta ?? 0).toString();

    return (
      p.nombre?.toLowerCase().includes(term) || 
      p.sku?.toLowerCase().includes(term) ||
      supplierName.includes(term) ||
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
      header: "Proveedor",
      key: "proveedorId",
      sortable: true,
      render: (p: ProductResponse) => (
        <span style={{ fontSize: "13px", color: "var(--neutral-400)" }}>
          {suppliers.find(s => s.id === p.proveedorId)?.nombre ?? "N/A"}
        </span>
      )
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
          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id!)} title="Eliminar producto">
            <span style={{ color: "var(--brand-500)" }}><Trash2 size={14} /></span>
          </Button>
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
            <Select
              label="Proveedor"
              value={formData.proveedorId.toString()}
              onChange={(val: string) => setFormData({ ...formData, proveedorId: Number(val) })}
              icon={<Truck size={15} />}
              options={[
                { value: "0", label: "Selecciona proveedor" },
                ...suppliers.map(s => ({ value: s.id!.toString(), label: s.nombre! }))
              ]}
            />
          </div>

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
