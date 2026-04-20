"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession } from "@/api/auth";
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

import CreateUserModal from "@/components/users/CreateUserModal";
import EditUserModal from "@/components/users/EditUserModal";

// ── Main Page ──────────────────────────────────────────────
export default function UsersPage() {
    const router = useRouter();
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

    // ADMIN-only route guard
    useEffect(() => {
        const session = getSession();
        if (!session || session.rol !== "ADMIN") {
            router.replace("/dashboard");
        }
    }, [router]);

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
                    itemsPerPage={25}
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
