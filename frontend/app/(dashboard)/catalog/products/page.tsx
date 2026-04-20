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
  const [productUnits, setProductUnits] = useState<any[]>([]);
  const [newUnitId, setNewUnitId] = useState<string>("");
  const [newUnitFactor, setNewUnitFactor] = useState<string>("1");

  // Form state
  const [formData, setFormData] = useState({
    sku: "",
    nombre: "",
    costoPromedio: "" as number | "",
    precioVenta: "" as number | "",
    unitId: 0,
    activo: true
  });
  const [selectedSuppliers, setSelectedSuppliers] = useState<{
    supplierId: number;
    negotiatedPrice: number;
    deliveryDays: number;
    preferred: boolean;
  }[]>([]);
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
      
      setSelectedSuppliers(
        (product as any).proveedores?.map((sp: any) => ({
          supplierId: Number(sp.id),
          negotiatedPrice: sp.precioPactado ?? 0,
          deliveryDays: sp.tiempoEntregaDias ?? 0,
          preferred: sp.preferido ?? false
        })) ?? []
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

      // Cargar unidades alternativas
      if (product.id) {
        try {
          const res = await apiClient.GET("/api/catalog/products/{productId}/units", {
            params: { path: { productId: product.id } }
          });
          setProductUnits(res.data ?? []);
        } catch (error) {
          console.error("Error fetching product units:", error);
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
      setSelectedSuppliers([]);
      setProductUnits([]);
      const defaults: Record<number, string> = {};
      priceLists.forEach(l => { defaults[l.id] = ""; });
      setPriceListValues(defaults);
      setShowPriceLists(true);
    }
    setNewUnitId("");
    setNewUnitFactor("1");
    setShowModal(true);
  };

  const handleAddProductUnit = async () => {
    if (!editingProduct?.id || !newUnitId) return;
    try {
      await apiClient.POST("/api/catalog/products/{productId}/units", {
        params: { path: { productId: editingProduct.id } },
        body: {
          productoId: editingProduct.id,
          unidadId: Number(newUnitId),
          factorConversion: Number(newUnitFactor),
          esBase: false
        } as any
      });
      showToast("Unidad asociada correctamente.", "success");
      
      // Refresh units
      const res = await apiClient.GET("/api/catalog/products/{productId}/units", {
        params: { path: { productId: editingProduct.id } }
      });
      setProductUnits(res.data ?? []);
      setNewUnitId("");
      setNewUnitFactor("1");
    } catch (error) {
      showToast("Error al asociar la unidad.", "error");
    }
  };

  const handleRemoveProductUnit = async (unitId: number) => {
    if (!editingProduct?.id) return;
    try {
      await apiClient.DELETE("/api/catalog/products/{productId}/units/{unitId}" as any, {
        params: { path: { productId: editingProduct.id, unitId } }
      });
      showToast("Asociación eliminada.", "success");
      
      // Refresh units
      const res = await apiClient.GET("/api/catalog/products/{productId}/units", {
        params: { path: { productId: editingProduct.id } }
      });
      setProductUnits(res.data ?? []);
    } catch (error) {
      showToast("Error al eliminar la asociación.", "error");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        let savedProductId: number | undefined = editingProduct?.id;

        if (selectedSuppliers.length === 0) {
          showToast("Debe asociar al menos un proveedor al producto.", "warning", "Validación requerida");
          return;
        }

        // Validar que haya al menos un preferido
        const hasPreferred = selectedSuppliers.some(s => s.preferred);
        if (!hasPreferred) {
          showToast("Debe marcar uno de los proveedores como preferido.", "warning", "Falta proveedor preferido");
          return;
        }

        const payload = {
          ...formData,
          sku: formData.sku.toUpperCase(),
          costoPromedio: Number(formData.costoPromedio) || 0,
          precioVenta: Number(formData.precioVenta) || 0,
          unitId: formData.unitId || (units[0]?.id ?? 0),
          activo: formData.activo,
          suppliers: selectedSuppliers.map(s => ({
            supplierId: s.supplierId,
            negotiatedPrice: Number(s.negotiatedPrice) || 0,
            deliveryDays: Number(s.deliveryDays) || 0,
            preferred: s.preferred
          }))
        };

        if (editingProduct) {
          await apiClient.PUT("/api/catalog/products/{id}", {
            params: { path: { id: editingProduct.id! } },
            body: payload,
          });
          showToast("Producto actualizado correctamente.", "success", "Cambios guardados");
        } else {
          const res = await apiClient.POST("/api/catalog/products", { 
            body: payload 
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
        showToast("Error al guardar el producto. Verifica el SKU o integridad.", "error");
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Desactivar este producto del catálogo maestro? Ya no se podrá usar en nuevas ventas o compras.")) return;
    try {
      await apiClient.DELETE("/api/catalog/products/{id}", { params: { path: { id } } });
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

  const handleAddSupplier = (val: string) => {
    if (!val) return;
    const id = Number(val);
    setSelectedSuppliers(prev => {
      if (prev.some(s => s.supplierId === id)) return prev;
      return [...prev, {
        supplierId: id,
        negotiatedPrice: 0,
        deliveryDays: 0,
        preferred: prev.length === 0 // El primero es preferido por defecto
      }];
    });
  };

  const handleRemoveSupplier = (id: number) => {
    setSelectedSuppliers(prev => {
      const filtered = prev.filter(s => s.supplierId !== id);
      // Si el que quitamos era el preferido y quedan otros, asignar preferido al primero
      if (prev.find(s => s.supplierId === id)?.preferred && filtered.length > 0) {
        filtered[0].preferred = true;
      }
      return filtered;
    });
  };

  const updateSupplierField = (id: number, field: string, value: any) => {
    setSelectedSuppliers(prev => prev.map(s => {
      if (s.supplierId !== id) {
        if (field === "preferred" && value === true) {
          return { ...s, preferred: false }; // Solo un preferido
        }
        return s;
      }
      return { ...s, [field]: value };
    }));
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
        const preferred = provs.find(s => s.preferido) || provs[0];
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--neutral-100)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
              {preferred.nombre}
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
          <button onClick={() => handleOpenModal(p)} style={{ background: "none", border: "none", color: "var(--neutral-400)", cursor: "pointer" }} title="Editar">
            <Edit size={16} />
          </button>
          {p.activo && (
            <button onClick={() => handleDelete(p.id!)} style={{ background: "none", border: "none", color: "var(--brand-500)", cursor: "pointer" }} title="Desactivar">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Catálogo Maestro"
        description="Gestiona los productos base y su red de proveedores."
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
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? "Editar Producto" : "Nuevo Producto"}
        description="Configura los detalles del producto y sus condiciones de compra."
        footer={
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} disabled={isPending}>Cancelar</Button>
            <Button size="sm" loading={isPending} onClick={handleSubmit as any}>Guardar Cambios</Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Input
              label="SKU"
              value={formData.sku}
              onChange={(e: any) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="Ej. B-001"
              required
            />
            <Input
              label="Nombre"
              value={formData.nombre}
              onChange={(e: any) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej. Cemento Gris"
              required
            />
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Input
              type="number"
              label="Costo Promedio"
              value={formData.costoPromedio}
              onChange={(e: any) => setFormData({ ...formData, costoPromedio: e.target.value })}
              icon={<DollarSign size={14} />}
            />
            <Input
              type="number"
              label="Precio Venta Base"
              value={formData.precioVenta}
              onChange={(e: any) => setFormData({ ...formData, precioVenta: e.target.value })}
              icon={<DollarSign size={14} />}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Select
              label="Unidad de Medida"
              value={formData.unitId.toString()}
              onChange={(val) => setFormData({ ...formData, unitId: Number(val) })}
              options={units.map(u => ({ value: u.id!.toString(), label: `${u.nombre} (${u.abreviatura})` }))}
            />
            <Select
              label="Estado del Catálogo"
              value={formData.activo ? "true" : "false"}
              onChange={(val) => setFormData({ ...formData, activo: val === "true" })}
              options={[
                { value: "true", label: "Activo" },
                { value: "false", label: "Inactivo (Descatalogado)" }
              ]}
            />
          </div>

          {/* ── Gestión de Proveedores (Tabla) ─────────────────────────── */}
          <div style={{ 
            marginTop: "10px", 
            padding: "16px", 
            background: "rgba(255,255,255,0.02)", 
            borderRadius: "12px",
            border: "1px solid var(--neutral-800)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--neutral-400)", textTransform: "uppercase" }}>
                Proveedores y Condiciones
              </h4>
              <Select
                value=""
                onChange={handleAddSupplier}
                placeholder="Añadir proveedor..."
                options={suppliers
                  .filter(s => !selectedSuppliers.some(ss => ss.supplierId === s.id))
                  .map(s => ({ value: s.id!.toString(), label: s.nombre ?? "" }))
                }
              />
            </div>

            {selectedSuppliers.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--neutral-800)" }}>
                      <th style={{ textAlign: "left", padding: "8px", fontSize: "11px", color: "var(--neutral-500)" }}>PROVEEDOR</th>
                      <th style={{ textAlign: "left", padding: "8px", fontSize: "11px", color: "var(--neutral-500)" }}>COSTO PACTADO</th>
                      <th style={{ textAlign: "left", padding: "8px", fontSize: "11px", color: "var(--neutral-500)" }}>DÍAS</th>
                      <th style={{ textAlign: "center", padding: "8px", fontSize: "11px", color: "var(--neutral-500)" }}>PREF.</th>
                      <th style={{ padding: "8px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSuppliers.map(s => {
                      const details = suppliers.find(sup => sup.id === s.supplierId);
                      return (
                        <tr key={s.supplierId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "8px", fontSize: "12px", color: "var(--neutral-100)" }}>{details?.nombre}</td>
                          <td style={{ padding: "8px", width: "120px" }}>
                            <input 
                              type="number"
                              value={s.negotiatedPrice}
                              onChange={(e) => updateSupplierField(s.supplierId, "negotiatedPrice", e.target.value)}
                              style={{ width: "100%", background: "var(--neutral-900)", border: "1px solid var(--neutral-700)", borderRadius: "4px", padding: "4px 8px", color: "white", fontSize: "12px" }}
                            />
                          </td>
                          <td style={{ padding: "8px", width: "70px" }}>
                            <input 
                              type="number"
                              value={s.deliveryDays}
                              onChange={(e) => updateSupplierField(s.supplierId, "deliveryDays", e.target.value)}
                              style={{ width: "100%", background: "var(--neutral-900)", border: "1px solid var(--neutral-700)", borderRadius: "4px", padding: "4px 8px", color: "white", fontSize: "12px" }}
                            />
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <input 
                              type="radio"
                              name="preferred-supplier"
                              checked={s.preferred}
                              onChange={() => updateSupplierField(s.supplierId, "preferred", true)}
                            />
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveSupplier(s.supplierId)}
                              style={{ background: "none", border: "none", color: "var(--neutral-600)", cursor: "pointer" }}
                            >
                              <XCircle size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: "12px", fontStyle: "italic", color: "var(--neutral-500)", textAlign: "center", padding: "10px" }}>
                Debes seleccionar al menos un proveedor para este producto.
              </p>
            )}
          </div>

          {priceLists.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--neutral-400)", marginBottom: "10px" }}>Precios Especiales</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {priceLists.map(lista => (
                  <Input
                    key={lista.id}
                    label={lista.nombre}
                    type="number"
                    value={priceListValues[lista.id] ?? ""}
                    onChange={(e: any) => setPriceListValues(prev => ({ ...prev, [lista.id]: e.target.value }))}
                    placeholder="Precio..."
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Gestión de Unidades Alternativas ────────────────────────── */}
          {editingProduct && (
            <div style={{ 
              marginTop: "10px", 
              padding: "16px", 
              background: "rgba(255,255,255,0.02)", 
              borderRadius: "12px",
              border: "1px solid var(--neutral-800)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--neutral-400)", textTransform: "uppercase" }}>
                  Unidades y Conversiones
                </h4>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: "8px", marginBottom: "16px", alignItems: "flex-end" }}>
                <Select
                  label="Asociar Unidad"
                  value={newUnitId}
                  onChange={setNewUnitId}
                  placeholder="Seleccionar..."
                  options={units
                    .filter(u => u.id !== formData.unitId && !productUnits.some(pu => pu.unidadId === u.id))
                    .map(u => ({ value: u.id!.toString(), label: u.nombre ?? "" }))
                  }
                />
                <Input
                  label="Factor de Conversión"
                  type="number"
                  value={newUnitFactor}
                  onChange={(e: any) => setNewUnitFactor(e.target.value)}
                  placeholder="Ej. 12"
                />
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleAddProductUnit} 
                  disabled={!newUnitId}
                >
                  Añadir
                </Button>
              </div>

              {productUnits.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--neutral-800)" }}>
                        <th style={{ textAlign: "left", padding: "8px", fontSize: "11px", color: "var(--neutral-500)" }}>UNIDAD</th>
                        <th style={{ textAlign: "left", padding: "8px", fontSize: "11px", color: "var(--neutral-500)" }}>EQUIVALE A</th>
                        <th style={{ textAlign: "right", padding: "8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productUnits.map(pu => (
                        <tr key={pu.unidadId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "8px", fontSize: "12px", color: "var(--neutral-100)" }}>
                            {pu.nombreUnidad} ({pu.abreviaturaUnidad})
                          </td>
                          <td style={{ padding: "8px", fontSize: "12px", color: "var(--neutral-400)" }}>
                            <span style={{ fontWeight: 600, color: "var(--brand-400)" }}>{pu.factorConversion}</span> {units.find(u => u.id === formData.unitId)?.abreviatura}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveProductUnit(pu.unidadId)}
                              style={{ background: "none", border: "none", color: "var(--neutral-600)", cursor: "pointer" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {productUnits.length === 0 && (
                <p style={{ fontSize: "12px", fontStyle: "italic", color: "var(--neutral-500)", textAlign: "center", padding: "5px" }}>
                  Sin unidades alternativas configuradas.
                </p>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}