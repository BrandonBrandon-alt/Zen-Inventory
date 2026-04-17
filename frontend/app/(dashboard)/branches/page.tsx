"use client";

import { useEffect, useState, useTransition } from "react";
import { apiClient } from "@/api/client";
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

// ── Types ──────────────────────────────────────────────────
type BranchResponse = components["schemas"]["BranchResponse"];
type BranchRequest  = components["schemas"]["BranchRequest"];

// ── Form state / validation ────────────────────────────────
type FormErrors = Partial<Record<keyof BranchRequest, string>>;

function validate(v: Partial<BranchRequest>): FormErrors {
  const e: FormErrors = {};
  if (!v.nombre?.trim())    e.nombre    = "El nombre es requerido.";
  if (!v.direccion?.trim()) e.direccion = "La dirección es requerida.";
  return e;
}

// ── Create Modal Form ──────────────────────────────────────
function CreateBranchModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (b: BranchResponse) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues]   = useState<Partial<BranchRequest>>({ nombre: "", direccion: "", telefono: "" });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValues({ nombre: "", direccion: "", telefono: "" });
      setErrors({});
      setTouched({});
      setServerError(null);
    }
  }, [open]);

  const handleChange = (field: keyof BranchRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
    setServerError(null);
  };

  const handleBlur = (field: keyof BranchRequest) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ nombre: true, direccion: true });
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      const { data, error } = await apiClient.POST("/api/branches", {
        body: {
          nombre:    values.nombre!,
          direccion: values.direccion!,
          telefono:  values.telefono || undefined,
        },
      });

      if (error || !data) {
        setServerError("No se pudo crear la sucursal. Verifica tu sesión.");
        showToast("Error al crear la sucursal.", "error");
        return;
      }
      onCreated(data);
      showToast("Sucursal creada exitosamente.", "success", "Registro exitoso");
      onClose();
    });
  };

  const { showToast } = useToast();


  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva sucursal"
      description="Completa los datos para registrar una sede en el sistema."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as never}>
            Crear sucursal
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {serverError && (
          <div style={{ background: "rgba(217,99,79,0.08)", border: "1px solid rgba(217,99,79,0.25)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: "13px", color: "var(--brand-500)" }}>
            {serverError}
          </div>
        )}
        <Input
          id="branch-nombre"
          label="Nombre de la sucursal"
          placeholder="Ej. Sede Central Bogotá"
          value={values.nombre ?? ""}
          onChange={handleChange("nombre")}
          onBlur={handleBlur("nombre")}
          error={touched.nombre ? errors.nombre : undefined}
          icon={<Building size={15} />}
        />
        <Input
          id="branch-direccion"
          label="Dirección"
          placeholder="Ej. Carrera 15 # 45-20, Bogotá"
          value={values.direccion ?? ""}
          onChange={handleChange("direccion")}
          onBlur={handleBlur("direccion")}
          error={touched.direccion ? errors.direccion : undefined}
          icon={<MapPin size={15} />}
        />
        <Input
          id="branch-telefono"
          label="Teléfono (opcional)"
          placeholder="Ej. 6015551234"
          value={values.telefono ?? ""}
          onChange={handleChange("telefono")}
          icon={<Phone size={15} />}
        />
      </form>
    </Modal>
  );
}

// ── Edit Modal Form ────────────────────────────────────────
function EditBranchModal({
  branch,
  open,
  onClose,
  onUpdated,
}: {
  branch: BranchResponse | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (b: BranchResponse) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues]   = useState<Partial<BranchRequest>>({ nombre: "", direccion: "", telefono: "" });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (branch) {
      setValues({
        nombre:    branch.nombre,
        direccion: branch.direccion,
        telefono:  branch.telefono || "",
      });
      setErrors({});
      setTouched({});
      setServerError(null);
    }
  }, [branch, open]);

  const handleChange = (field: keyof BranchRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
    setServerError(null);
  };

  const handleBlur = (field: keyof BranchRequest) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch?.id) return;

    setTouched({ nombre: true, direccion: true });
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      const { data, error } = await apiClient.PUT("/api/branches/{id}", {
        params: { path: { id: branch.id! } },
        body: {
          nombre:    values.nombre!,
          direccion: values.direccion!,
          telefono:  values.telefono || undefined,
        },
      });

      if (error || !data) {
        setServerError("No se pudo actualizar la sucursal.");
        showToast("Error al actualizar la sucursal.", "error");
        return;
      }
      onUpdated(data);
      showToast("Sucursal actualizada correctamente.", "success", "Cambios guardados");
      onClose();
    });
  };

  const { showToast } = useToast();


  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar sucursal"
      description="Actualiza la información de la sede seleccionada."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as never}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {serverError && (
          <div style={{ background: "rgba(217,99,79,0.08)", border: "1px solid rgba(217,99,79,0.25)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: "13px", color: "var(--brand-500)" }}>
            {serverError}
          </div>
        )}
        <Input
          id="edit-branch-nombre"
          label="Nombre"
          value={values.nombre ?? ""}
          onChange={handleChange("nombre")}
          onBlur={handleBlur("nombre")}
          error={touched.nombre ? errors.nombre : undefined}
          icon={<Building size={15} />}
        />
        <Input
          id="edit-branch-direccion"
          label="Dirección"
          value={values.direccion ?? ""}
          onChange={handleChange("direccion")}
          onBlur={handleBlur("direccion")}
          error={touched.direccion ? errors.direccion : undefined}
          icon={<MapPin size={15} />}
        />
        <Input
          id="edit-branch-telefono"
          label="Teléfono"
          value={values.telefono ?? ""}
          onChange={handleChange("telefono")}
          icon={<Phone size={15} />}
        />
      </form>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function BranchesPage() {
  const [branches, setBranches]   = useState<BranchResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch]     = useState<BranchResponse | null>(null);
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

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

  const columns: Column<BranchResponse>[] = [
    {
      header: "#",
      key: "id",
      width: "60px",
      render: (branch: BranchResponse) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--neutral-500)" }}>#{branch.id}</span>
      )
    },
    {
      header: "Nombre / Teléfono",
      key: "nombre",
      render: (branch: BranchResponse) => (
        <div>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--neutral-100)", marginBottom: "2px" }}>{branch.nombre}</p>
          {branch.telefono && <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>📞 {branch.telefono}</p>}
        </div>
      )
    },
    {
      header: "Dirección",
      key: "direccion",
      render: (branch: BranchResponse) => <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{branch.direccion}</span>
    },
    {
      header: "Estado",
      key: "activa",
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
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}></div>
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
          columns={columns}
          data={branches}
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
