"use client";

import { useEffect, useState, useTransition } from "react";
import { apiClient } from "@/api/client";
import { useToast } from "@/context/ToastContext";
import type { components } from "@/api/schema";
import { User, Mail, Lock, Shield, Building, Edit, Trash2 } from "lucide-react";

import Spinner    from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import Card       from "@/components/ui/Card";
import Badge      from "@/components/ui/Badge";
import Modal      from "@/components/ui/Modal";
import Button     from "@/components/ui/Button";
import Input      from "@/components/ui/Input";
import Select     from "@/components/ui/Select";
import DataTable, { Column } from "@/components/ui/DataTable";
import SearchFilter from "@/components/ui/SearchFilter";

// ── Types ──────────────────────────────────────────────────
type UserResponse   = components["schemas"]["UserResponse"];
type UserRequest    = components["schemas"]["UserRequest"];
type RoleResponse   = components["schemas"]["RoleResponse"];
type BranchResponse = components["schemas"]["BranchResponse"];

// ── Role Color Helper ──────────────────────────────────────
const getRoleStyle = (roleName?: string) => {
    const name = roleName?.toUpperCase() || "";
    switch (name) {
        case "ADMIN":
            return { variant: "danger" as const, iconColor: "var(--brand-500)" };
        case "MANAGER":
            return { variant: "warning" as const, iconColor: "var(--color-warning)" };
        case "SELLER":
            return { variant: "info" as const, iconColor: "var(--color-info)" };
        case "OPERADOR_INVENTARIO":
            return { variant: "success" as const, iconColor: "var(--color-success)" };
        default:
            return { variant: "neutral" as const, iconColor: "var(--neutral-400)" };
    }
};

// ── CreateUserModal ────────────────────────────────────────
function CreateUserModal({ open, onClose, roles, branches, onCreated }: {
    open: boolean;
    onClose: () => void;
    roles: RoleResponse[];
    branches: BranchResponse[];
    onCreated: (u: UserResponse) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [values, setValues] = useState<Partial<UserRequest>>({ rolId: 0, activo: true });
    const [serverError, setServerError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setValues({ rolId: roles[0]?.id || 0, activo: true, nombre: "", email: "", password: "" });
            setServerError(null);
        }
    }, [open, roles]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
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
        if (!values.password || values.password.length < 6) {
            setServerError("La contraseña debe tener un mínimo de 6 caracteres por seguridad.");
            return;
        }
        if (!values.rolId) {
            setServerError("El rol del sistema es obligatorio.");
            return;
        }
        // Validación obligatoria requerida por negocio: Seller obligatoriamente tiene sede (Igual Manager)
        if (Number(values.rolId) !== 1 && (!values.sucursalId || Number(values.sucursalId) === 0)) {
            setServerError("Es estrictamente obligatorio asignar una sucursal para Vendedores o Administradores Locales.");
            return;
        }
        // ------------------------------------------

        setServerError(null);
        startTransition(async () => {
            const { data, error } = await apiClient.POST("/api/users", {
                body: {
                    nombre: values.nombre!,
                    email: values.email!,
                    password: values.password!,
                    rolId: Number(values.rolId),
                    sucursalId: values.rolId !== 1 ? Number(values.sucursalId) : undefined, // Solo si no es ADMIN
                } as any
            });

            if (data) {
                showToast("Usuario creado correctamente.", "success", "Registro exitoso");
                onCreated(data);
                onClose();
            } else {
                showToast((error as any)?.message || "No se pudo crear el usuario.", "error", "Error");
                setServerError((error as any)?.message || "Error al crear usuario.");
            }
        });
    };

    const { showToast } = useToast();


    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Nuevo Usuario"
            description="Registra un nuevo colaborador y asigna sus permisos."
            footer={
                <>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>Cancelar</Button>
                    <Button size="sm" loading={isPending} onClick={handleSubmit as any}>Crear Usuario</Button>
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
                    placeholder="Ej. Juan Pérez"
                />
                <Input
                    label="Email"
                    value={values.email ?? ""}
                    onChange={e => setValues({...values, email: e.target.value})}
                    icon={<Mail size={15} />}
                    placeholder="juan@zeninventory.com"
                />
                <Input
                    label="Contraseña"
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
                          .filter(b => b.activa)
                          .map(b => ({ value: b.id!, label: b.nombre! }))
                        }
                        icon={<Building size={15} />}
                        placeholder="Seleccionar sede..."
                    />
                )}
            </form>
        </Modal>
    );
}

// ── EditUserModal ──────────────────────────────────────────
function EditUserModal({ open, onClose, user, roles, branches, onUpdated }: {
    open: boolean;
    onClose: () => void;
    user: UserResponse | null;
    roles: RoleResponse[];
    branches: BranchResponse[];
    onUpdated: (u: UserResponse) => void;
}) {
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
        // ------------------------------------------

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

    const { showToast } = useToast();


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

// ── Main Page ──────────────────────────────────────────────
export default function UsersPage() {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [roles, setRoles] = useState<RoleResponse[]>([]);
    const [branches, setBranches] = useState<BranchResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "nombre", direction: "asc" });

    const [, startTransition] = useTransition();
    const { showToast } = useToast();

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
        }));
    };

    const filteredAndSortedUsers = (users || []).filter(u => 
        u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        if (!sortConfig.key || !sortConfig.direction) return 0;
        
        // Handle nested or derived values
        let valA: any = (a as any)[sortConfig.key];
        let valB: any = (b as any)[sortConfig.key];

        if (sortConfig.key === "rolId") {
            valA = a.role?.nombre || "";
            valB = b.role?.nombre || "";
        } else if (sortConfig.key === "sucursalId") {
            valA = a.sucursalId ? (branches.find(b_ => b_.id === a.sucursalId)?.nombre || "") : "Acceso Global";
            valB = b.sucursalId ? (branches.find(b_ => b_.id === b.sucursalId)?.nombre || "") : "Acceso Global";
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    useEffect(() => {
        Promise.all([
            apiClient.GET("/api/users"),
            apiClient.GET("/api/roles"),
            apiClient.GET("/api/branches")
        ]).then(([uRes, rRes, bRes]) => {
            setUsers(uRes.data || []);
            setRoles(rRes.data || []);
            setBranches(bRes.data || []);
            setLoading(false);
        });
    }, []);

    const handleCreated = (u: UserResponse) => {
        setUsers(prev => [...prev, u]);
    };

    const handleUpdated = (u: UserResponse) => {
        setUsers(prev => prev.map(item => item.id === u.id ? u : item));
    };

    const handleDeactivate = (id: number) => {
        if (!confirm("¿Desactivar este usuario? Ya no podrá acceder al sistema.")) return;
        startTransition(async () => {
             const { error } = await apiClient.DELETE("/api/users/{id}", { params: { path: { id } } });
             if (!error) {
                 showToast("El usuario ha sido desactivado.", "success", "Usuario desactivado");
                 setUsers(prev => prev.map(u => u.id === id ? { ...u, activo: false } : u));
             } else {
                 showToast("Error al intentar desactivar el usuario.", "error");
             }
        });
    };

    const columns: Column<UserResponse>[] = [
        {
            header: "ID",
            key: "id",
            width: "60px",
            sortable: true,
            render: (user) => (
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--neutral-500)" }}>#{user.id}</span>
            )
        },
        {
            header: "Nombre / Email",
            key: "nombre",
            sortable: true,
            render: (user) => (
                <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--neutral-100)", marginBottom: "2px" }}>{user.nombre}</p>
                    <p style={{ fontSize: "12px", color: "var(--neutral-500)" }}>{user.email}</p>
                </div>
            )
        },
        {
            header: "Rol",
            key: "role",
            sortable: true,
            render: (user) => {
                const style = getRoleStyle(user.role?.nombre);
                return (
                    <Badge variant={style.variant}>
                        <Shield size={12} className="mr-1" style={{ color: style.iconColor }} />
                        {user.role?.nombre || "Sin rol"}
                    </Badge>
                );
            }
        },
        {
            header: "Sede",
            key: "sucursalId",
            sortable: true,
            render: (user) => {
                const branchName = user.sucursalId 
                    ? branches.find(b => b.id === user.sucursalId)?.nombre || `Sucursal #${user.sucursalId}`
                    : "Acceso Global";
                return <span style={{ fontSize: "13px", color: "var(--neutral-300)" }}>{branchName}</span>;
            }
        },
        {
            header: "Estado",
            key: "activo",
            sortable: true,
            render: (user) => (
                <Badge variant={user.activo ? "success" : "neutral"} dot>
                    {user.activo ? "Activo" : "Inactivo"}
                </Badge>
            )
        },
        {
            header: "Acciones",
            key: "actions",
            align: "right",
            width: "100px",
            render: (user) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button variant="ghost" size="sm" onClick={() => setEditingUser(user)} title="Editar usuario">
                        <Edit size={14} />
                    </Button>
                    {user.activo && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeactivate(user.id!)} title="Desactivar usuario">
                            <span style={{ color: "var(--brand-500)" }}><Trash2 size={14} /></span>
                        </Button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
             <PageHeader
                   title="Usuarios y Permisos"
                   description="Administra los accesos de tus colaboradores y sus roles en las sucursales."
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
                <div className="flex-1 max-w-md">
                    <SearchFilter 
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={setSearchTerm}
                        containerClassName="w-full"
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <Button onClick={() => setShowCreate(true)} style={{ marginTop: "4px" }}>Nuevo Usuario</Button>
                </div>
            </div>

            <Card style={{ padding: 0, overflow: "hidden" }}>
                <DataTable<UserResponse>
                    columns={columns}
                    data={filteredAndSortedUsers}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    isLoading={loading}
                    emptyState={{
                        title: "Sin usuarios",
                        description: "No hay otros usuarios registrados.",
                        icon: <User size={40} />
                    }}
                />
            </Card>

            <CreateUserModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                roles={roles}
                branches={branches}
                onCreated={handleCreated}
            />

            <EditUserModal
                open={editingUser !== null}
                onClose={() => setEditingUser(null)}
                user={editingUser}
                roles={roles}
                branches={branches}
                onUpdated={handleUpdated}
            />
        </div>
    );
}
