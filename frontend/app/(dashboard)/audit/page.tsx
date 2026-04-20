"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import type { components } from "@/api/schema";
import { History, Search, MessageCircle, ShoppingBag, ShoppingCart, Repeat, Truck, AlertTriangle, CheckCircle, MinusCircle } from "lucide-react";

import Spinner from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable, { Column } from "@/components/ui/DataTable";
import { useToast } from "@/context/ToastContext";
import SearchFilter from "@/components/ui/SearchFilter";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

type InventoryMovement = components["schemas"]["InventoryMovement"];
type UserResponse = components["schemas"]["UserResponse"];

export default function AuditPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [movements, setMovements] = useState<any[]>([]);
  const [branches, setBranches] = useState<Map<number, string>>(new Map());
  const [products, setProducts] = useState<Map<number, components["schemas"]["ProductResponse"]>>(new Map());
  const [suppliers, setSuppliers] = useState<Map<number, string>>(new Map());
  const [users, setUsers] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "date", direction: "desc" });
  const [viewingObservation, setViewingObservation] = useState<any | null>(null);

  // ADMIN-only route guard
  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [movs, bras, pros, sups, usrs] = await Promise.all([
          (apiClient as any).GET("/api/v1/inventory/movements"),
          apiClient.GET("/api/branches"),
          apiClient.GET("/api/catalog/products"),
          apiClient.GET("/api/catalog/suppliers"),
          apiClient.GET("/api/users"),
        ]);

        setMovements(movs.data ?? []);
        setBranches(new Map((bras.data ?? []).map((b) => [b.id!, b.nombre!])));
        setProducts(new Map((pros.data ?? []).map((p) => [p.id!, p])));
        setSuppliers(new Map((sups.data ?? []).map((s) => [s.id!, s.nombre!])));
        setUsers(new Map((usrs.data as UserResponse[] ?? []).map((u) => [u.id!, u.nombre!])));
      } catch (err) {
        showToast("Error al cargar datos de auditoría", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [showToast]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const filteredAndSortedMovements = movements.filter(m => {
    const product = products.get(m.productId!);
    const productName = (product?.nombre || "").toLowerCase();
    const userName = (users.get(m.userId!) || "").toLowerCase();
    const reason = (m.reason || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    
    return productName.includes(term) || userName.includes(term) || reason.includes(term);
  }).sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    let valA: any = (a as any)[sortConfig.key];
    let valB: any = (b as any)[sortConfig.key];

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const columns: Column<any>[] = [
    {
      header: "Fecha",
      key: "date",
      width: "160px",
      sortable: true,
      render: (m) => (
        <span style={{ fontSize: "12px", color: "var(--neutral-400)" }}>
          {m.date ? new Date(m.date).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
      )
    },
    {
      header: "Tipo",
      key: "type",
      width: "100px",
      sortable: true,
      render: (m) => (
        <Badge variant={m.type === "INGRESO" ? "success" : "danger"} dot>
          {m.type}
        </Badge>
      )
    },
    {
      header: "Motivo",
      key: "reason",
      sortable: true,
      render: (m) => {
        const observations = m.observations;
        
        const reasonStyles: Record<string, { color: string, bg: string, icon: any }> = {
          COMPRA: { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", icon: <ShoppingBag size={12} /> },
          VENTA: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", icon: <ShoppingCart size={12} /> },
          DEVOLUCION: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)", icon: <Repeat size={12} /> },
          TRASLADO: { color: "#6366f1", bg: "rgba(99, 102, 241, 0.1)", icon: <Truck size={12} /> },
          MERMA: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.1)", icon: <AlertTriangle size={12} /> },
          AJUSTE_POSITIVO: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", icon: <CheckCircle size={12} /> },
          AJUSTE_NEGATIVO: { color: "#64748b", bg: "rgba(100, 116, 139, 0.1)", icon: <MinusCircle size={12} /> },
        };

        const style = reasonStyles[m.reason!] || { color: "var(--neutral-400)", bg: "var(--neutral-800)", icon: null };

        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col items-start gap-1">
              <span style={{ 
                fontSize: "10px", 
                fontWeight: 800, 
                padding: "2px 8px", 
                borderRadius: "6px",
                background: style.bg,
                color: style.color,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                border: `1px solid ${style.color}20`
              }}>
                {style.icon}
                {m.reason || "—"}
              </span>

              <div className="flex items-center gap-2">
                {m.subReason && (
                  <Badge variant="warning">
                    {m.subReason.replace("_", " ")}
                  </Badge>
                )}
                {observations && (
                  <button 
                    onClick={() => setViewingObservation(m)}
                    className="p-1 hover:bg-[var(--brand-500)]/10 text-[var(--brand-400)] rounded-md transition-all animate-pulse"
                    title="Leer motivo detallado"
                  >
                    <MessageCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: "Producto",
      key: "productId",
      sortable: true,
      render: (m) => <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--neutral-100)" }}>{products.get(m.productId!)?.nombre || m.productId}</span>
    },
    {
      header: "Sucursal",
      key: "branchId",
      render: (m) => <span style={{ fontSize: "12px", color: "var(--neutral-400)" }}>{branches.get(m.branchId!) || m.branchId}</span>
    },
    {
      header: "Cantidad",
      key: "quantity",
      align: "right",
      width: "110px",
      sortable: true,
      render: (m) => (
        <span style={{ 
          fontSize: "14px", 
          fontWeight: 700, 
          color: m.type === "INGRESO" ? "var(--color-success)" : "var(--color-danger)",
          fontFamily: "monospace" 
        }}>
          {m.type === "INGRESO" ? "+" : "-"}{m.quantity}
        </span>
      )
    },
    {
      header: "Cantidad Final",
      key: "finalBalance",
      align: "right",
      width: "120px",
      sortable: true,
      render: (m) => (
        <span style={{ fontWeight: 800, color: "var(--neutral-100)", fontSize: "14px" }}>
          {m.finalBalance} 
          <small style={{ color: "var(--neutral-500)", marginLeft: "4px", fontWeight: 500, fontSize: "10px", textTransform: "uppercase" }}>
            {products.get(m.productId!)?.unitAbbreviation || "UND"}
          </small>
        </span>
      )
    },
    {
      header: "Responsable",
      key: "userId",
      render: (m) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "var(--neutral-400)" }}>
            {(users.get(m.userId!)?.[0] || "U").toUpperCase()}
          </div>
          <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{users.get(m.userId!) || m.userId}</span>
        </div>
      )
    }
  ];

  if (loading) return <Spinner fullPage />;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Auditoría Global"
        description="Seguimiento detallado de todos los movimientos de stock realizados en la red Zen Inventory."
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
        <div className="flex-1 max-w-md">
          <SearchFilter 
            placeholder="Buscar por producto, motivo o usuario..."
            value={searchTerm}
            onChange={setSearchTerm}
            containerClassName="w-full"
          />
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <DataTable<any>
          itemsPerPage={25}
          columns={columns}
          data={filteredAndSortedMovements}
          sortConfig={sortConfig}
          onSort={handleSort}
          isLoading={loading}
          emptyState={{
            title: "Sin movimientos",
            description: "No se han registrado movimientos de inventario en el sistema.",
            icon: <History size={40} />
          }}
        />
      </Card>

      {/* MODAL PARA VER OBSERVACIÓN */}
      <Modal
        open={!!viewingObservation}
        onClose={() => setViewingObservation(null)}
        title="Detalle del Ajuste de Auditoría"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-[var(--brand-500)]/5 border border-[var(--brand-500)]/10">
            {viewingObservation?.subReason && (
              <div className="mb-2">
                <Badge variant="warning">{viewingObservation.subReason.replace("_", " ")}</Badge>
              </div>
            )}
            <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--brand-400)] mb-2">Justificación Registrada:</h4>
            <p className="text-[15px] text-[var(--neutral-100)] leading-relaxed font-medium">
              {viewingObservation?.observations || "Sin observaciones detalladas."}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--neutral-800)]">
              <span className="block text-[10px] text-[var(--neutral-500)] uppercase font-bold mb-1">Responsable</span>
              <span className="text-[12px] text-[var(--neutral-200)] font-semibold">{users.get(viewingObservation?.userId!) || "—"}</span>
            </div>
             <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--neutral-800)]">
              <span className="block text-[10px] text-[var(--neutral-500)] uppercase font-bold mb-1">Fecha</span>
              <span className="text-[12px] text-[var(--neutral-200)] font-semibold">
                {viewingObservation?.date ? new Date(viewingObservation.date).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>

          <Button 
            variant="primary" 
            fullWidth 
            onClick={() => setViewingObservation(null)}
            className="mt-4"
          >
            Entendido
          </Button>
        </div>
      </Modal>
    </div>
  );
}
