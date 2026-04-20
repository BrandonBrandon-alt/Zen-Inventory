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
            setServerError(null);
        }
    }, [user, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;
        
        // --- Validaciones Frontend Importantes ---
        if (!values.nombre || values.nombre.trim().length < 3) {
            setServerError("El nombre debe tener al menos 3 caracteres.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!values.email || !emailRegex.test(values.email)) {
            setServerError("Debes proporcionar un correo electrónico válido.");
            return;
        }
        if (values.password && values.password.length < 6) {
            setServerError("La nueva contraseña debe tener un mínimo de 6 caracteres por seguridad.");
            return;
        }
        if (!values.rolId) {
            setServerError("El rol del sistema es obligatorio.");
            return;
        }
        if (Number(values.rolId) !== 1 && (!values.sucursalId || Number(values.sucursalId) === 0)) {
            setServerError("Es estrictamente obligatorio asignar una sucursal para Vendedores o Administradores Locales.");
            return;
        }

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
                {serverError && <div style={{ color: "var(--brand-500)", fontSize: "13px" }}>{serverError}</div>}
                <Input
                    label="Nombre completo"
                    value={values.nombre ?? ""}
                    onChange={e => setValues({...values, nombre: e.target.value})}
                    icon={<User size={15} />}
                />
                <Input
                    label="Email"
                    value={values.email ?? ""}
                    onChange={e => setValues({...values, email: e.target.value})}
                    icon={<Mail size={15} />}
                />
                <Input
                    label="Nueva contraseña (dejar en blanco para no cambiar)"
                    type="password"
                    value={values.password ?? ""}
                    onChange={e => setValues({...values, password: e.target.value})}
                    icon={<Lock size={15} />}
                />
                <Select
                    label="Rol del sistema"
                    value={values.rolId ?? ""}
                    onChange={val => setValues({...values, rolId: Number(val)})}
                    options={roles.map(r => ({ value: r.id!, label: r.nombre! }))}
                    icon={<Shield size={15} />}
                />
                {values.rolId && Number(values.rolId) !== 1 && (
                    <Select
                        label="Sucursal asignada"
                        value={values.sucursalId || ""}
                        onChange={val => setValues({...values, sucursalId: Number(val)})}
                        options={branches
                          .filter(b => b.activa || b.id === values.sucursalId)
                          .map(b => ({ value: b.id!, label: b.nombre! }))
                        }
                        icon={<Building size={15} />}
                        placeholder="Seleccionar sede..."
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
