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

export default function CreateBranchModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (b: BranchResponse) => void;
}) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [values, setValues]   = useState<Partial<BranchRequest>>({ nombre: "", direccion: "", telefono: "", managerId: undefined });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValues({ nombre: "", direccion: "", telefono: "", managerId: undefined });
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
          managerId: values.managerId || undefined,
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
