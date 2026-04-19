"use client";

import { useEffect, useState, useTransition } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getSession } from "@/api/auth";
import { useRouter } from "next/navigation";
import { Ruler, Plus, Edit, Trash2, Tag, Type } from "lucide-react";

import Badge from "@/components/ui/Badge";
import { useToast } from "@/context/ToastContext";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";

type UnitOfMeasureResponse = components["schemas"]["UnitOfMeasureResponse"];

export default function MasterUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<UnitOfMeasureResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasureResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    nombre: "",
    abreviatura: "",
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
      const res = await apiClient.GET("/api/catalog/units");
      setUnits(res.data ?? []);
    } catch (error) {
      console.error("Error fetching units:", error);
      showToast("Error al cargar las unidades de medida.", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (unit?: UnitOfMeasureResponse) => {
    if (unit) {
      setEditingUnit(unit);
      setFormData({
        nombre: unit.nombre ?? "",
        abreviatura: unit.abreviatura ?? "",
      });
    } else {
      setEditingUnit(null);
      setFormData({
        nombre: "",
        abreviatura: "",
      });
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (editingUnit) {
          await apiClient.PUT("/api/catalog/units/{id}", {
            params: { path: { id: editingUnit.id! } },
            body: formData as any,
          });
          showToast("Unidad actualizada correctamente.", "success", "Cambios guardados");
        } else {
          await apiClient.POST("/api/catalog/units", {
            body: formData as any,
          });
          showToast("Nueva unidad de medida registrada.", "success", "Registro exitoso");
        }
        setShowModal(false);
        fetchData();
      } catch (error) {
        showToast("Error al guardar la unidad de medida.", "error");
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar esta unidad de medida?")) return;
    try {
      await apiClient.DELETE("/api/catalog/units/{id}", {
        params: { path: { id } },
      });
      showToast("La unidad ha sido eliminada.", "success");
      fetchData();
    } catch (error) {
      showToast("No se puede eliminar: está en uso por productos.", "error");
    }
  };

  const columns: Column<UnitOfMeasureResponse>[] = [
    {
      header: "Nombre Completo",
      key: "nombre",
      render: (u: UnitOfMeasureResponse) => (
        <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--neutral-100)" }}>{u.nombre}</span>
      )
    },
    {
      header: "Abreviatura",
      key: "abreviatura",
      width: "150px",
      render: (u: UnitOfMeasureResponse) => (
        <Badge variant="neutral">
          <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>{u.abreviatura}</span>
        </Badge>
      )
    },
    {
      header: "Acciones",
      key: "actions",
      align: "right",
      width: "100px",
      render: (u: UnitOfMeasureResponse) => (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(u)} title="Editar unidad">
            <Edit size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id!)} title="Eliminar unidad">
            <span style={{ color: "var(--brand-500)" }}><Trash2 size={14} /></span>
          </Button>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        title="Unidades de Medida"
        description="Estandariza las unidades (Kg, Unidades, Litros) válidas para todo el sistema."
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
            Nueva Unidad
          </Button>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <DataTable<UnitOfMeasureResponse>
          itemsPerPage={25}
          columns={columns}
          data={units}
          isLoading={loading}
          minWidth="100%"
          emptyState={{
            title: "Sin unidades",
            description: "No hay unidades de medida registradas en el catálogo.",
            icon: <Ruler size={40} />,
            action: (
              <Button size="sm" onClick={() => handleOpenModal()} leftIcon={<Plus size={13} />}>
                Crear primera unidad
              </Button>
            )
          }}
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingUnit ? "Editar Unidad" : "Nueva Unidad"}
        description="Define cómo se medirá este tipo de producto."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} disabled={isPending}>Cancelar</Button>
            <Button size="sm" loading={isPending} onClick={handleSubmit as any}>Guardar Unidad</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input
            label="Nombre Completo"
            value={formData.nombre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nombre: e.target.value })}
            icon={<Type size={15} />}
            placeholder="Ej. Kilogramos"
            required
          />
          <Input
            label="Abreviatura"
            value={formData.abreviatura}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, abreviatura: e.target.value })}
            icon={<Tag size={15} />}
            placeholder="Ej. Kg"
            required
          />
        </form>
      </Modal>
    </div>
  );
}
