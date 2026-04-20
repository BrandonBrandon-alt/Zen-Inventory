"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/api/client";
import { User, Mail, Lock, Shield, Building } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { components } from "@/api/schema";

type UserResponse   = components["schemas"]["UserResponse"];
type UserRequest    = components["schemas"]["UserRequest"];
type RoleResponse   = components["schemas"]["RoleResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

export default function EditUserModal({ open, onClose, user, roles, branches, onUpdated }: {
    open: boolean;
    onClose: () => void;
    user: UserResponse | null;
    roles: RoleResponse[];
    branches: BranchResponse[];
    onUpdated: (u: UserResponse) => void;
}) {
    const { showToast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [values, setValues] = useState<Partial<UserRequest>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [serverError, setServerError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setValues({
                nombre: user.nombre,
                email: user.email,
                rolId: user.role?.id,
                sucursalId: user.sucursalId || undefined,
                activo: user.activo,
                password: ""
            });
            setErrors({});
            setServerError(null);
        }
    }, [user, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;
        const errs: Record<string, string> = {};
        
        // --- Validaciones Frontend ---
        if (!values.nombre || values.nombre.trim().length < 3) {
            errs.nombre = "El nombre debe tener al menos 3 caracteres.";
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!values.email || !emailRegex.test(values.email)) {
            errs.email = "Correo electrónico inválido.";
        }
        if (values.password && values.password.length < 6) {
            errs.password = "Mínimo 6 caracteres.";
        }
        if (!values.rolId) {
            errs.rolId = "Campo obligatorio.";
        }
        if (Number(values.rolId) !== 1 && (!values.sucursalId || Number(values.sucursalId) === 0)) {
            errs.sucursalId = "Requerido para este rol.";
        }

        setErrors(errs);
        if (Object.keys(errs).length > 0) return;

        setServerError(null);
        startTransition(async () => {
            const { data, error } = await apiClient.PUT("/api/users/{id}", {
                params: { path: { id: user.id! } },
                body: {
                    nombre: values.nombre!,
                    email: values.email!,
                    password: values.password || undefined,
                    rolId: Number(values.rolId),
                    sucursalId: values.rolId !== 1 ? Number(values.sucursalId) : undefined,
                    activo: values.activo
                } as any
            });

            if (data) {
                showToast("Los cambios se han guardado correctamente.", "success", "Usuario actualizado");
                onUpdated(data);
                onClose();
            } else {
                showToast((error as any)?.message || "No se pudo actualizar el usuario.", "error", "Error");
                setServerError((error as any)?.message || "Error al actualizar usuario.");
            }
        });
    };


    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Editar Usuario"
            description="Modifica los datos del usuario seleccionado."
            footer={
                <>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>Cancelar</Button>
                    <Button size="sm" loading={isPending} onClick={handleSubmit as any}>Guardar Cambios</Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {serverError && <div style={{ color: "var(--brand-500)", fontSize: "12px", background: "rgba(217,99,79,0.1)", padding: "8px", borderRadius: "var(--radius-sm)" }}>{serverError}</div>}
                <Input
                    label="Nombre completo"
                    value={values.nombre ?? ""}
                    onChange={e => { setValues({...values, nombre: e.target.value}); setErrors({...errors, nombre: ""}); }}
                    icon={<User size={15} />}
                    error={errors.nombre}
                />
                <Input
                    label="Email"
                    value={values.email ?? ""}
                    onChange={e => { setValues({...values, email: e.target.value}); setErrors({...errors, email: ""}); }}
                    icon={<Mail size={15} />}
                    error={errors.email}
                />
                <Input
                    label="Nueva contraseña (dejar en blanco para no cambiar)"
                    type="password"
                    value={values.password ?? ""}
                    onChange={e => { setValues({...values, password: e.target.value}); setErrors({...errors, password: ""}); }}
                    icon={<Lock size={15} />}
                    error={errors.password}
                />
                <Select
                    label="Rol del sistema"
                    value={values.rolId ?? ""}
                    onChange={val => { setValues({...values, rolId: Number(val)}); setErrors({...errors, rolId: ""}); }}
                    options={roles.map(r => ({ value: r.id!, label: r.nombre! }))}
                    icon={<Shield size={15} />}
                />
                {values.rolId && Number(values.rolId) !== 1 && (
                    <Select
                        label="Sucursal asignada"
                        value={values.sucursalId || ""}
                        onChange={val => { setValues({...values, sucursalId: Number(val)}); setErrors({...errors, sucursalId: ""}); }}
                        options={branches
                          .filter(b => b.activa || b.id === values.sucursalId)
                          .map(b => ({ value: b.id!, label: b.nombre! }))
                        }
                        icon={<Building size={15} />}
                        placeholder="Seleccionar sede..."
                        error={errors.sucursalId}
                    />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                   <input 
                      type="checkbox" 
                      checked={values.activo} 
                      onChange={e => setValues({...values, activo: e.target.checked})} 
                    />
                   <span style={{ fontSize: "14px" }}>Cuenta activa</span>
                </div>
            </form>
        </Modal>
    );
}
