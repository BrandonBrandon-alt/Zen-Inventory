"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
import { useToast } from "@/context/ToastContext";
import type { components } from "@/api/schema";
import { Building, MapPin, Phone, Edit, Trash2, Plus } from "lucide-react";

import Spinner    from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import Card       from "@/components/ui/Card";
import Badge      from "@/components/ui/Badge";
import Modal      from "@/components/ui/Modal";
import Button     from "@/components/ui/Button";
import Input      from "@/components/ui/Input";
import DataTable, { Column } from "@/components/ui/DataTable";
import SearchFilter from "@/components/ui/SearchFilter";
import Select from "@/components/ui/Select";
import { UserCheck } from "lucide-react";

// ── Types ──────────────────────────────────────────────────
import CreateBranchModal from "@/components/branches/CreateBranchModal";
import EditBranchModal from "@/components/branches/EditBranchModal";

// ── Types ──────────────────────────────────────────────────
type BranchResponse = components["schemas"]["BranchResponse"];

// ── Main Page ──────────────────────────────────────────────
export default function BranchesPage() {
  const router = useRouter();
  const [branches, setBranches]   = useState<BranchResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch]     = useState<BranchResponse | null>(null);
  const [searchTerm, setSearchTerm]           = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "nombre", direction: "asc" });
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  // ADMIN-only route guard
  useEffect(() => {
    const session = getSession();
    if (!session || session.rol !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    apiClient.GET("/api/branches").then(({ data }) => {
      setBranches(data ?? []);
      setLoading(false);
    });
  }, []);

  const handleCreated = (newBranch: BranchResponse) => {
    setBranches((prev) => [...prev, newBranch]);
  };

  const handleUpdated = (updated: BranchResponse) => {
    setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDelete = (id: number) => {
    if (!confirm("¿Estás seguro de que deseas desactivar esta sucursal? No podrá ser usada para ventas o inventario mientras esté inactiva.")) return;

    startTransition(async () => {
      const { error } = await apiClient.DELETE("/api/branches/{id}", {
        params: { path: { id } },
      });
      
      if (!error) {
        setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, activa: false } : b)));
        showToast("La sucursal ha sido desactivada.", "success", "Sucursal de baja");
      } else {
        showToast("No se pudo desactivar la sucursal.", "error");
      }
    });
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const filteredAndSortedBranches = (branches || []).filter(b => 
    b.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.direccion?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    let valA: any = (a as any)[sortConfig.key];
    let valB: any = (b as any)[sortConfig.key];

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const columns: Column<BranchResponse>[] = [
    {
      header: "#",
      key: "id",
      width: "60px",
      sortable: true,
      render: (branch: BranchResponse) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--neutral-500)" }}>#{branch.id}</span>
      )
    },
    {
      header: "Nombre / Teléfono",
      key: "nombre",
      sortable: true,
      render: (branch: BranchResponse) => (
        <div>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--neutral-100)", marginBottom: "2px" }}>{branch.nombre}</p>
          {branch.telefono && <p style={{ fontSize: "12px", color: "var(--neutral-500)", display: "flex", gap: "6px", alignItems: "center" }}><Phone size={12} /> {branch.telefono}</p>}
        </div>
      )
    },
    {
      header: "Dirección",
      key: "direccion",
      sortable: true,
      render: (branch: BranchResponse) => <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{branch.direccion}</span>
    },
    {
      header: "Estado",
      key: "activa",
      sortable: true,
      render: (branch: BranchResponse) => (
        <Badge variant={branch.activa ? "success" : "neutral"} dot>
          {branch.activa ? "Activa" : "Inactiva"}
        </Badge>
      )
    },
    {
      header: "Acciones",
      key: "actions",
      align: "right",
      width: "100px",
      render: (branch: BranchResponse) => (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setEditingBranch(branch)} title="Editar sucursal">
            <Edit size={14} />
          </Button>
          {branch.activa && (
            <Button variant="ghost" size="sm" onClick={() => handleDelete(branch.id!)} title="Desactivar sucursal">
              <span style={{ color: "var(--brand-500)" }}><Trash2 size={14} /></span>
            </Button>
          )}
        </div>
      )
    }
  ];

  const active   = branches.filter((b) => b.activa).length;
  const inactive = branches.filter((b) => !b.activa).length;

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Sucursales"
        description="Administra las sedes de Zen Inventory en toda la red."
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
             placeholder="Buscar sucursal por nombre o dirección..."
             value={searchTerm}
             onChange={setSearchTerm}
             containerClassName="w-full"
           />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Button
            leftIcon={<Plus size={15} />}
            onClick={() => setShowCreateModal(true)}
            style={{ marginTop: "4px", flexShrink: 0 }}
          >
            Nueva sucursal
          </Button>
        </div>
      </div>


      {/* Summary badges */}
      {branches.length > 0 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", animation: "fadeInUp 0.35s ease 0.05s both" }}>
          <Badge variant="neutral">{branches.length} sedes totales</Badge>
          {active   > 0 && <Badge variant="success">{active} activas</Badge>}
          {inactive > 0 && <Badge variant="warning">{inactive} inactivas</Badge>}
        </div>
      )}

      {/* Table Card */}
      <Card delay="0.1s" style={{ padding: 0, overflow: "hidden" }}>
        <DataTable<BranchResponse>
          itemsPerPage={25}
          columns={columns}
          data={filteredAndSortedBranches}
          sortConfig={sortConfig}
          onSort={handleSort}
          isLoading={loading}
          minWidth="100%"
          emptyState={{
            title: "No hay sucursales registradas",
            description: "Crea la primera sede para comenzar a gestionar el inventario.",
            icon: <Building size={40} />,
            action: (
              <Button size="sm" onClick={() => setShowCreateModal(true)} leftIcon={<Plus size={13} />}>
                Crear primera sucursal
              </Button>
            )
          }}
        />

        {/* Footer */}
        {branches.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "12px", color: "var(--neutral-600)" }}>
              {branches.length} {branches.length === 1 ? "sucursal registrada" : "sucursales registradas"} en el sistema
            </span>
          </div>
        )}
      </Card>

      <CreateBranchModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />

      <EditBranchModal
        branch={editingBranch}
        open={editingBranch !== null}
        onClose={() => setEditingBranch(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
