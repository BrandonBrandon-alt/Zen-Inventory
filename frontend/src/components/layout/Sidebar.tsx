"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import Logo from "@/components/ui/Logo";
import { logout, getSession, type AuthSession } from "@/api/auth";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";

type BranchResponse = components["schemas"]["BranchResponse"];

const navItems = [
  {
    href: "/dashboard",
    label: "Panel",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventario",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    href: "/alerts",
    label: "Alertas",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: "/transfers",
    label: "Traslados",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M16 3h5v5" />
        <path d="M4 20L21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15l6 6" />
        <path d="M4 4l5 5" />
      </svg>
    ),
  },
  {
    href: "/purchases",
    label: "Compras",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: "/sales/pos",
    label: "Ventas",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 7h-9" />
        <path d="M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
    ),
  },
  {
    href: "/sales/history",
    label: "Historial Ventas",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="9" />
        <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
      </svg>
    ),
  },
  {
    href: "/returns",
    label: "Devoluciones",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
        <path d="M12 8v4l-3 2" />
        <path d="M21 12H15" />
      </svg>
    ),
  },
];

const adminItems = [
  {
    href: "/branches",
    label: "Sucursales",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/users",
    label: "Usuarios",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },

  {
    href: "/audit",
    label: "Auditoría Global",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

const masterItems = [
  {
    href: "/catalog/products",
    label: "Catálogo Productos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 8V21H3V8" />
        <path d="M1 3H23V8H1V3Z" />
        <path d="M10 12H14" />
      </svg>
    ),
  },
  {
    href: "/catalog/units",
    label: "Unidades Medida",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3V21" />
        <path d="M17 5H7" />
        <path d="M17 10H7" />
        <path d="M17 15H7" />
      </svg>
    ),
  },
  {
    href: "/catalog/suppliers",
    label: "Proveedores",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [branchName, setBranchName] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  useEffect(() => {
    setSession(getSession());
    
    // Restore scroll position
    const savedScroll = sessionStorage.getItem("sidebar-scroll");
    if (savedScroll && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    async function fetchBranchAndAlerts() {
      try {
        // 1. Fetch Branch Name
        if (session?.rol === "ADMIN") {
          setBranchName("Gestión Global");
        } else if (session?.sucursalId) {
          const { data: branch } = await apiClient.GET("/api/branches/{id}", {
            params: { path: { id: session.sucursalId } }
          });
          if (branch) setBranchName(branch.nombre || null);
        }

        // 2. Fetch Alerts
        let count = 0;
        if (session?.rol === "ADMIN") {
          const { data: branches } = await apiClient.GET("/api/branches");
          if (branches) {
            const results = await Promise.all(
              branches.map((b) =>
                apiClient.GET("/api/v1/alerts", { params: { query: { branchId: b.id! } } })
              )
            );
            count = results.reduce((acc, r) => acc + (r.data?.filter(a => !a.resolved).length ?? 0), 0);
          }
        } else if (session?.sucursalId) {
          const { data: alerts } = await apiClient.GET("/api/v1/alerts", { 
            params: { query: { branchId: session.sucursalId } } 
          });
          count = alerts?.filter(a => !a.resolved).length ?? 0;
        }
        setAlertCount(count);
      } catch (e) {
        console.error("Error fetching data for sidebar", e);
      }
    }

    fetchBranchAndAlerts();
  }, [session]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem("sidebar-scroll", e.currentTarget.scrollTop.toString());
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isSeller = session?.rol === "SELLER";
  const isInventory = session?.rol === "OPERADOR_INVENTARIO";

  // Definir qué roles ven qué items base
  const visibleNavItems = navItems.filter(item => {
    if (isAdmin) {
      return item.label !== "Terminal POS";
    }
    if (isSeller) {
      // SELLER: POS as main screen + read-only inventory + own sales history
      return item.label === "Terminal POS" || item.label === "Inventario" || item.label === "Historial Ventas";
    }
    if (isInventory) {
      // OPERADOR_INVENTARIO: Panel + physical inventory + transfers + sales + purchases + returns
      return ["Panel", "Inventario", "Traslados", "Ventas", "Historial Ventas", "Compras", "Devoluciones"].includes(item.label);
    }
    if (isSeller) {
      // SELLERS: POS + Inventory + Sales History + Returns
      return item.label === "Terminal POS" || item.label === "Inventario" || item.label === "Historial Ventas" || item.label === "Devoluciones";
    }
    // Managers see everything in base navItems
    return true;
  });

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
    const isActive = pathname === href;
    return (
      <a
        key={href}
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "9px 10px",
          borderRadius: "var(--radius-md)",
          fontSize: "14px",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--neutral-50)" : "var(--neutral-200)",
          background: isActive ? "var(--bg-card)" : "transparent",
          border: isActive ? "1px solid var(--border-default)" : "1px solid transparent",
          textDecoration: "none",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = "var(--neutral-50)";
            e.currentTarget.style.background = "var(--bg-hover)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = "var(--neutral-200)";
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <span style={{ color: isActive ? "var(--brand-500)" : "currentColor", display: "flex" }}>
          {icon}
        </span>
        {label}
        {label === "Alertas" && alertCount > 0 && (
          <span
            style={{
              marginLeft: "auto",
              background: "var(--brand-500)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "20px",
              padding: "1px 6px",
              minWidth: "18px",
              textAlign: "center",
            }}
          >
            {alertCount}
          </span>
        )}
      </a>
    );
  };

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 1999,
          }}
          className="show-mobile"
        />
      )}

      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          height: "100dvh",
          position: "sticky",
          top: 0,
          background: "var(--bg-base)",
          borderRight: "1px solid var(--border-default)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          zIndex: 2000,
          transition: "transform 0.3s ease",
          // Estilos responsivos dinámicos
          ...((typeof window !== "undefined" && window.innerWidth <= 768) ? {
            position: "fixed",
            transform: isOpen ? "translateX(0)" : "translateX(-100%)",
            boxShadow: "20px 0 50px rgba(0,0,0,0.5)",
          } : {})
        }}
        // Usar variables CSS para mejor manejo de media queries si es posible, 
        // pero aquí usaremos inline con una pequeña "trampa" de clase para el CSS global
        className="sidebar-responsive"
      >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 20px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Logo size={40} />
        </div>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--neutral-50)",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-sans)",
          }}
        >
          Zen Inventory
        </span>
      </div>

      {/* Navigation */}
      <nav 
        ref={scrollRef as any}
        onScroll={handleScroll}
        style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          gap: "2px", 
          padding: "0 12px",
          overflowY: "auto",
          scrollbarWidth: "none", // For Firefox
        }}
      >
        <p style={{
          fontSize: "10.5px",
          fontWeight: 600,
          color: "var(--neutral-500)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "0 8px",
          marginBottom: "8px",
        }}>Menú</p>
        
        {visibleNavItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {(isAdmin || isManager) && (
          <NavLink 
            href="/analytics" 
            label={isAdmin ? "Análisis Global" : "Análisis de Sede"} 
            icon={(
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            )}
          />
        )}

        {isAdmin && (
          <>
            <p style={{
              fontSize: "10.5px",
              fontWeight: 600,
              color: "var(--neutral-500)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0 8px",
              marginTop: "24px",
              marginBottom: "8px",
            }}>Administración</p>
            {adminItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}

            <p style={{
              fontSize: "10.5px",
              fontWeight: 600,
              color: "var(--neutral-500)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0 8px",
              marginTop: "24px",
              marginBottom: "8px",
            }}>Configuración Maestra</p>
            {masterItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* Profile & Logout */}
        <div style={{ padding: "16px 12px 12px", borderTop: "1px solid var(--border-default)", marginTop: "8px" }}>
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "9px 10px",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--neutral-400)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              marginBottom: "8px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "var(--neutral-100)";
              e.currentTarget.style.borderColor = "var(--brand-500)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "var(--neutral-400)";
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isDark
                ? <Sun size={15} style={{ color: "var(--brand-400)" }} />
                : <Moon size={15} style={{ color: "var(--brand-400)" }} />
              }
              {isDark ? "Modo Claro" : "Modo Oscuro"}
            </span>
            {/* Toggle pill */}
            <div style={{
              width: "34px",
              height: "18px",
              borderRadius: "9px",
              background: isDark ? "var(--neutral-700)" : "var(--brand-500)",
              position: "relative",
              transition: "background 0.25s ease",
              flexShrink: 0,
            }}>
              <div style={{
                position: "absolute",
                top: "2px",
                left: isDark ? "2px" : "16px",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "white",
                transition: "left 0.25s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </div>
          </button>
        {session && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px", 
            padding: "10px", 
            background: "var(--bg-card)", 
            borderRadius: "var(--radius-lg)", 
            border: "1px solid var(--border-subtle)",
            marginBottom: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand-500), #eab308)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.2)"
            }}>
              {session.nombre ? session.nombre.substring(0, 2).toUpperCase() : "U"}
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--neutral-50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.2" }}>
                {session.nombre}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ 
                  fontSize: "9.5px", 
                  fontWeight: 800, 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em", 
                  color: session.rol === "ADMIN" ? "var(--brand-400)" : 
                         session.rol === "MANAGER" ? "#10b981" : 
                         session.rol === "OPERADOR_INVENTARIO" ? "#f59e0b" :
                         session.rol === "SELLER" ? "#3b82f6" : "var(--neutral-400)"
                }}>
                  {session.rol === "OPERADOR_INVENTARIO" ? "OPERADOR" : session.rol}
                </span>
              </div>
              {branchName && (
                <p style={{ 
                  fontSize: "11px", 
                  color: "var(--neutral-400)", 
                  whiteSpace: "nowrap", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis",
                  fontWeight: 500,
                  marginTop: "3px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <MapPin size={11} /> {branchName}
                </p>
              )}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 10px",
            borderRadius: "var(--radius-md)",
            fontSize: "14px",
            color: "var(--neutral-400)",
            background: "transparent",
            border: "1px solid transparent",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-danger)";
            e.currentTarget.style.background = "rgba(224,112,112,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--neutral-400)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
    </>
  );
}
