"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/api/client";
import { Building, MapPin, Phone } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { components } from "@/api/schema";

type BranchResponse = components["schemas"]["BranchResponse"];
type BranchRequest = components["schemas"]["BranchRequest"];

type FormErrors = Partial<Record<keyof BranchRequest, string>>;

function validate(v: Partial<BranchRequest>): FormErrors {
  const e: FormErrors = {};
  if (!v.nombre?.trim())    e.nombre    = "El nombre es requerido.";
  if (!v.direccion?.trim()) e.direccion = "La dirección es requerida.";
  return e;
}

export default function EditBranchModal({
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
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [values, setValues]   = useState<Partial<BranchRequest>>({ nombre: "", direccion: "", telefono: "", managerId: undefined });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (branch) {
      setValues({
        nombre:    branch.nombre,
        direccion: branch.direccion,
        telefono:  branch.telefono || "",
        managerId: branch.managerId || undefined,
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
          managerId: values.managerId || undefined,
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
