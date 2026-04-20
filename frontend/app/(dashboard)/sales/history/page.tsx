"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { apiClient } from "@/api/client";
import { getSession, type AuthSession } from "@/api/auth";
import { useToast } from "@/context/ToastContext";
import Spinner    from "@/components/ui/Spinner";
import Card       from "@/components/ui/Card";
import HistoryFilters from "@/components/sales-history/HistoryFilters";
import HistoryTable   from "@/components/sales-history/HistoryTable";
import { Search, RefreshCcw, History, ClipboardList, Info } from "lucide-react";
import SaleDetailModal from "@/components/sales-history/SaleDetailModal";
import PageHeader from "@/components/ui/PageHeader";
import SummaryCards from "@/components/sales-history/SummaryCards";

// Helper for currency formatting - defined outside to avoid TDZ issues during SSR/Prerendering
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);


// Main logic component that uses useSearchParams
function SalesHistoryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Derive branchId from URL
  const branchIdParam = searchParams.get("branch");
  const selectedBranchId = branchIdParam ? parseInt(branchIdParam) : 0;

  // Persistence logic: Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("zen_inventory_history_state");
    if (savedState) {
      try {
        const { search, sort } = JSON.parse(savedState);
        if (search) setSearchTerm(search);
        if (sort) setSortOrder(sort);
      } catch (e) {
        console.error("Error parsing saved History state:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Persistence logic: Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    const stateToSave = {
      search: searchTerm,
      sort: sortOrder,
    };
    localStorage.setItem("zen_inventory_history_state", JSON.stringify(stateToSave));
  }, [searchTerm, isLoaded]);

  useEffect(() => {
    const sess = getSession();
    if (!sess) {
      router.push("/login");
      return;
    }
    setSession(sess);

    // Initial data fetch: Branches (if admin)
    if (sess.rol === "ADMIN") {
      apiClient.GET("/api/branches").then(res => {
        setBranches(res.data || []);
      });
    }
  }, [router]);

  // Load sales when session is ready OR when branchId in URL changes
  useEffect(() => {
    if (session) {
      fetchSales(session, selectedBranchId || undefined);
    }
  }, [session, selectedBranchId]);

  const fetchSales = async (currentSession?: AuthSession | null, branchId?: number) => {
    const authSess = currentSession || session;
    const targetBranchId = branchId !== undefined ? branchId : (selectedBranchId || undefined);
    
    setLoading(true);
    // Security enforcement: If manager or seller, always use their sucursalId
    const effectiveBranchId = (authSess?.rol === "MANAGER" || authSess?.rol === "SELLER") ? authSess.sucursalId : targetBranchId;

    try {
      const { data } = await apiClient.GET("/api/v1/sales", {
        params: { query: { branchId: effectiveBranchId } }
      });
      if (data) {
        setSales(data as any[]);
      }
    } catch (error: any) {
      showToast("Error al cargar el historial de ventas.", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    let result = [...sales];
    
    // 1. Filter by seller if role is SELLER
    if (session?.rol === "SELLER") {
      result = result.filter(s => s.userName === session.nombre);
    }

    // 2. Search filtering
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(sale => 
        sale.id.toString().includes(term) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(term)) ||
        (sale.branchName && sale.branchName.toLowerCase().includes(term)) ||
        (sale.userName && sale.userName.toLowerCase().includes(term))
      );
    }

    // 3. Sorting
    result.sort((a, b) => {
      // Primary sort: Date
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      const dateDiff = sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      
      if (dateDiff !== 0) return dateDiff;
      
      // Secondary sort: ID (fixed orientation)
      return b.id - a.id;
    });

    return result;
  }, [sales, searchTerm, sortOrder, session]);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Last 7 days (including today)
    const sevenDaysAgo = todayStart - (6 * 24 * 60 * 60 * 1000);
    
    // Last 30 days (including today)
    const thirtyDaysAgo = todayStart - (29 * 24 * 60 * 60 * 1000);

    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    let total = 0;

    sales.forEach(sale => {
      if (sale.status !== 'COMPLETED') return;
      
      const saleDate = new Date(sale.date).getTime();
      const amount = sale.totalFinal || 0;
      total += amount;

      if (saleDate >= todayStart) {
        daily += amount;
      }
      if (saleDate >= sevenDaysAgo) {
        weekly += amount;
      }
      if (saleDate >= thirtyDaysAgo) {
        monthly += amount;
      }
    });

    return {
      daily: formatCurrency(daily),
      weekly: formatCurrency(weekly),
      monthly: formatCurrency(monthly),
      total: formatCurrency(total)
    };
  }, [sales]);

  const handleBranchChange = (id: string | number) => {
    const params = new URLSearchParams(searchParams);
    if (id && id !== "0" && id !== "all") {
      params.set("branch", id.toString());
    } else {
      params.delete("branch");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const openDetail = (sale: any) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  if (loading && sales.length === 0) {
    return <Spinner fullPage />;
  }

  return (
    <div style={{ padding: "var(--page-padding)", maxWidth: "1400px", margin: "0 auto" }}>
      <div className="animate-fade-in">
        
        <PageHeader 
          title="Historial de Ventas"
          description="Gestión y auditoría de transacciones registradas en el sistema POS."
        />

        {(session?.rol === "ADMIN" || session?.rol === "MANAGER") && (
          <SummaryCards 
            daily={metrics.daily}
            weekly={metrics.weekly}
            monthly={metrics.monthly}
            total={metrics.total}
          />
        )}

        {/* Transaction Table Card – Matching Inventory Matrix style */}
        <Card style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-default)" }}>
          <HistoryFilters 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            isAdmin={session?.rol === "ADMIN"}
            branches={branches}
            selectedBranchId={(session?.rol === "MANAGER" || session?.rol === "SELLER" || session?.rol === "OPERADOR_INVENTARIO") ? session.sucursalId! : (selectedBranchId || "all")}
            onBranchChange={handleBranchChange}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />

          <HistoryTable 
            sales={filteredSales}
            onOpenDetail={openDetail}
            formatCurrency={formatCurrency}
            onRefresh={fetchSales}
          />
        </Card>
      </div>

      <SaleDetailModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sale={selectedSale}
        canCancel={session?.rol === "ADMIN" || session?.rol === "MANAGER"}
        onSaleCanceled={fetchSales}
      />
    </div>
  );
}

// Wrapper component to provide Suspense boundary for useSearchParams
export default function SalesHistoryPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner />
        </div>
      }
    >
      <SalesHistoryContent />
    </Suspense>
  );
}
