"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Sun, Moon, ChevronLeft, ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import Logo from "@/components/ui/Logo";
import { logout } from "@/api/auth";
import { useSidebarData } from "@/hooks/useSidebarData";

const navItems = [
  {
    href: "/dashboard",
    label: "Panel",
    icon: <LayoutDashboard size={18} strokeWidth={1.8} />,
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
    label: "Productos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 8V21H3V8" />
        <path d="M1 3H23V8H1V3Z" />
        <path d="M10 12H14" />
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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, alertCount, branchName } = useSidebarData();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("sidebar-scroll");
    if (savedScroll && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(savedScroll, 10);
    }
    
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed === "true") setIsCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem("sidebar-scroll", e.currentTarget.scrollTop.toString());
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAdmin = session?.rol === "ADMIN";
  const isManager = session?.rol === "MANAGER";
  const isInventory = session?.rol === "OPERADOR_INVENTARIO";

  const visibleNavItems = navItems.filter(item => {
    if (isAdmin) return true;
    if (isInventory) {
      return ["Panel", "Inventario", "Traslados", "Ventas", "Historial Ventas", "Compras", "Devoluciones"].includes(item.label);
    }
    return true; 
  });

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
    const isActive = pathname === href;
    return (
      <a
        key={href}
        href={href}
        title={isCollapsed ? label : ""}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: isCollapsed ? "12px" : "10px 12px",
          borderRadius: "var(--radius-md)",
          fontSize: "14px",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--neutral-50)" : "var(--neutral-200)",
          background: isActive ? "var(--bg-card)" : "transparent",
          position: "relative",
          textDecoration: "none",
          transition: "var(--sidebar-transition)",
          justifyContent: isCollapsed ? "center" : "flex-start",
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
        className="sidebar-link"
      >
        {/* Active Indicator */}
        {isActive && (
          <div style={{
            position: "absolute",
            left: 0,
            top: "20%",
            height: "60%",
            width: "3px",
            background: "var(--brand-500)",
            borderRadius: "0 4px 4px 0",
            boxShadow: "0 0 10px var(--brand-500)",
          }} />
        )}
        
        <span style={{ 
          color: isActive ? "var(--brand-500)" : "currentColor", 
          display: "flex",
          transition: "transform 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67)",
        }}
        className="sidebar-icon"
        >
          {icon}
        </span>
        
        {!isCollapsed && (
          <span style={{ 
            opacity: 1, 
            transition: "opacity 0.2s",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}>
            {label}
          </span>
        )}

        {label === "Alertas" && alertCount > 0 && (
          <span
            className={alertCount > 0 ? "animate-pulse-soft" : ""}
            style={{
              position: isCollapsed ? "absolute" : "relative",
              top: isCollapsed ? "4px" : "auto",
              right: isCollapsed ? "4px" : "auto",
              marginLeft: isCollapsed ? 0 : "auto",
              background: "var(--brand-500)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 800,
              borderRadius: "20px",
              padding: "1px 6px",
              minWidth: "18px",
              textAlign: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
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

      <aside
        style={{
          width: isCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
          flexShrink: 0,
          height: "100dvh",
          position: "sticky",
          top: 0,
          background: "var(--bg-base)",
          borderRight: "1px solid var(--border-default)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          zIndex: 2000,
          transition: "var(--sidebar-transition)",
        }}
      >
        {/* Toggle Collapse Button (Desktop) */}
        <button 
          onClick={toggleCollapse}
          style={{
            position: "absolute",
            right: "-12px",
            top: "32px",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            color: "var(--neutral-400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 20px",
          marginBottom: "40px",
          justifyContent: isCollapsed ? "center" : "flex-start",
        }}>
          <Logo size={isCollapsed ? 32 : 40} />
          {!isCollapsed && (
            <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--neutral-50)", letterSpacing: "-0.02em" }}>
              Zen Inventory
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav 
          ref={scrollRef as any}
          onScroll={handleScroll}
          style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            gap: "4px", 
            padding: "0 12px",
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
          className="custom-scrollbar"
        >
          <header style={{
            fontSize: "10px",
            fontWeight: 800,
            color: "var(--neutral-600)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            padding: isCollapsed ? "0" : "0 12px",
            marginBottom: "12px",
            textAlign: isCollapsed ? "center" : "left"
          }}>{isCollapsed ? "—" : "Navegación"}</header>
          
          {visibleNavItems.map(item => <NavLink key={item.href} {...item} />)}

          {isAdmin && (
            <>
              <header style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "var(--neutral-600)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: isCollapsed ? "0" : "0 12px",
                marginTop: "24px",
                marginBottom: "12px",
                textAlign: isCollapsed ? "center" : "left"
              }}>{isCollapsed ? "—" : "Admin"}</header>
              {adminItems.map(item => <NavLink key={item.href} {...item} />)}
              
              {!isCollapsed && (
                 <header style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "var(--neutral-600)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  padding: "0 12px",
                  marginTop: "24px",
                  marginBottom: "12px",
                }}>Maestros</header>
              )}
              {masterItems.map(item => <NavLink key={item.href} {...item} />)}
            </>
          )}
        </nav>

        {/* Footer actions */}
        <div style={{ padding: "16px 12px 10px", borderTop: "1px solid var(--border-default)", marginTop: "8px" }}>
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isCollapsed ? (isDark ? "Modo Claro" : "Modo Oscuro") : ""}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: isCollapsed ? "center" : "space-between",
              padding: "10px",
              borderRadius: "var(--radius-md)",
              color: "var(--neutral-400)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              cursor: "pointer",
              marginBottom: "12px",
              transition: "all 0.2s"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {isDark ? <Sun size={16} color="var(--brand-400)" /> : <Moon size={16} color="var(--brand-500)" />}
              {!isCollapsed && <span style={{ fontSize: "13px" }}>{isDark ? "Modo Claro" : "Modo Oscuro"}</span>}
            </div>
            {!isCollapsed && (
              <div style={{ width: "30px", height: "16px", borderRadius: "10px", background: isDark ? "var(--neutral-700)" : "var(--brand-500)", position: "relative" }}>
                 <div style={{ position: "absolute", top: "2px", left: isDark ? "2px" : "16px", width: "12px", height: "12px", borderRadius: "50%", background: "white", transition: "0.2s" }} />
              </div>
            )}
          </button>

          {/* Profile */}
          {session && !isCollapsed && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              padding: "12px", 
              background: "var(--bg-card)", 
              borderRadius: "var(--radius-lg)", 
              border: "1px solid var(--border-subtle)",
              marginBottom: "12px",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, var(--brand-500), #eab308)",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 900, flexShrink: 0
              }}>
                {session.nombre ? session.nombre.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--neutral-50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {session.nombre}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                  <MapPin size={10} color="var(--neutral-500)" />
                  <span style={{ fontSize: "10px", color: "var(--neutral-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {branchName || "Zen Inventory"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              color: "var(--neutral-400)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              justifyContent: isCollapsed ? "center" : "flex-start",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--color-danger)"; e.currentTarget.style.background = "rgba(224,112,112,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--neutral-400)"; e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut size={18} />
            {!isCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <style jsx global>{`
        .sidebar-link:hover .sidebar-icon {
          transform: translateX(3px);
        }
      `}</style>
    </>
  );
}
