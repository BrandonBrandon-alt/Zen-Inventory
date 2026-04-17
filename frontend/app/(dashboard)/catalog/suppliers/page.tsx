"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

type SupplierResponse = components["schemas"]["SupplierResponse"];

export default function MasterSuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierResponse | null>(null);
  
  // Nuevo estado para el catálogo
  const [products, setProducts] = useState<any[]>([]);
  const [viewCatalogSupplier, setViewCatalogSupplier] = useState<SupplierResponse | null>(null);

  const [formData, setFormData] = useState({
    nombre: "",
    contacto: "",
    tiempoEntregaDias: 3,
  });

  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [router]);

  async function fetchData() {
    try {
      const [supRes, prodRes] = await Promise.all([
        apiClient.GET("/api/catalog/suppliers"),
        (apiClient.GET as any)("/api/catalog/products", {})
      ]);
      setSuppliers(supRes.data ?? []);
      if (prodRes.data) setProducts(prodRes.data as any[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (supplier?: SupplierResponse) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        nombre: supplier.nombre ?? "",
        contacto: supplier.contacto ?? "",
        tiempoEntregaDias: supplier.tiempoEntregaDias ?? 3,
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        nombre: "",
        contacto: "",
        tiempoEntregaDias: 3,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await apiClient.PUT("/api/catalog/suppliers/{id}", {
          params: { path: { id: editingSupplier.id! } },
          body: formData,
        });
      } else {
        await apiClient.POST("/api/catalog/suppliers", {
          body: formData,
        });
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      alert("Error al guardar el proveedor.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este proveedor?")) return;
    try {
      await apiClient.DELETE("/api/catalog/suppliers/{id}", {
        params: { path: { id } },
      });
      fetchData();
    } catch (error) {
      alert("No se puede eliminar el proveedor. Probablemente tenga productos asociados.");
    }
  };

  if (loading) return <div style={{ padding: "40px", color: "var(--neutral-400)" }}>Cargando directorio de proveedores...</div>;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Directorio de Proveedores"
        description="Gestiona los proveedores centralizados que surten a toda la red de sucursales."
      />

      <div style={{ 
        display: "flex", 
        flexDirection: "row", 
        flexWrap: "wrap",
        justifyContent: "space-between", 
        alignItems: "flex-end", 
        marginBottom: "32px", 
        gap: "24px" 
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Button leftIcon={<Plus size={15} />} onClick={() => handleOpenModal()} style={{ marginTop: "4px" }}>
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
        {suppliers.map((s) => (
          <div key={s.id} style={{ background: "var(--bg-card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--neutral-50)", marginBottom: "8px" }}>{s.nombre}</h3>
            <p style={{ fontSize: "14px", color: "var(--neutral-400)", marginBottom: "16px" }}>{s.contacto}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: "1px solid var(--border-default)" }}>
              <span style={{ fontSize: "12px", color: "var(--neutral-500)" }}>
                Entrega: <span style={{ color: "var(--brand-400)", fontWeight: 600 }}>{s.tiempoEntregaDias} días</span>
              </span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={() => setViewCatalogSupplier(s)} style={{ background: "rgba(235,108,31,0.1)", border: "1px solid var(--brand-500)", color: "var(--brand-400)", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Catálogo</button>
                <button onClick={() => handleOpenModal(s)} style={{ background: "none", border: "none", color: "var(--brand-500)", cursor: "pointer", fontSize: "13px" }}>Editar</button>
                <button onClick={() => handleDelete(s.id!)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "13px" }}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card)", padding: "32px", borderRadius: "16px", width: "100%", maxWidth: "450px", border: "1px solid var(--border-default)" }}>
            <h2 style={{ marginBottom: "24px", color: "var(--neutral-50)" }}>{editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--neutral-400)" }}>Nombre/Empresa</label>
                <input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "white" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--neutral-400)" }}>Contacto (Email/Tel/Dir)</label>
                <input
                  value={formData.contacto}
                  onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "white" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--neutral-400)" }}>Tiempo de Entrega Est. (Días)</label>
                <input
                  type="number"
                  value={formData.tiempoEntregaDias}
                  onChange={(e) => setFormData({ ...formData, tiempoEntregaDias: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "white" }}
                  min={1}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: "none", border: "1px solid var(--border-default)", color: "white", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ background: "var(--brand-500)", border: "none", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Catálogo del Proveedor */}
      {viewCatalogSupplier && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", padding: "32px", borderRadius: "16px", width: "100%", maxWidth: "600px", border: "1px solid var(--border-default)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
               <div>
                  <h2 style={{ color: "white", fontSize: "20px", fontWeight: "bold", margin: 0 }}>Catálogo Asociado</h2>
                  <p style={{ color: "var(--brand-400)", fontSize: "14px", fontWeight: "bold", marginTop: "4px" }}>{viewCatalogSupplier.nombre}</p>
               </div>
               <button onClick={() => setViewCatalogSupplier(null)} style={{ background: "none", border: "none", color: "var(--neutral-400)", cursor: "pointer", fontSize: "18px" }}>✖</button>
            </div>
            
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "8px" }}>
               {products.filter(p => p.proveedorId === viewCatalogSupplier.id).length === 0 ? (
                  <p style={{ color: "var(--neutral-400)", textAlign: "center", padding: "40px" }}>Aún no hay productos comprados o registrados a este proveedor.</p>
               ) : (
                  products.filter(p => p.proveedorId === viewCatalogSupplier.id).map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--neutral-900)", border: "1px solid var(--border-default)", borderRadius: "8px" }}>
                        <div>
                            <p style={{ color: "white", fontWeight: "bold", fontSize: "14px", margin: 0 }}>{p.nombre}</p>
                            <span style={{ fontSize: "11px", color: "var(--neutral-500)", fontFamily: "var(--font-mono)" }}>REF: {p.sku}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "10px", color: "var(--neutral-500)", display: "block", fontWeight: "bold" }}>COSTO REF.</span>
                            <span style={{ color: "var(--brand-400)", fontWeight: "bold", fontSize: "16px" }}>${p.costoPromedio?.toLocaleString("es-CO")}</span>
                        </div>
                    </div>
                  ))
               )}
            </div>

            <div style={{ marginTop: "24px", textAlign: "right" }}>
                <button onClick={() => setViewCatalogSupplier(null)} style={{ background: "var(--neutral-800)", border: "none", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Cerrar Portafolio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
