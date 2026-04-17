"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import Input from "@/components/ui/Input";

export default function SalesHistoryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Persistence logic: Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("zen_inventory_history_state");
    if (savedState) {
      try {
        const { search } = JSON.parse(savedState);
        if (search) setSearchTerm(search);
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
    fetchSales();
  }, [router]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.GET("/api/v1/sales", {});
      if (data) {
        const sortedSales = [...(data as any[])].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setSales(sortedSales);
      }
    } catch (error: any) {
      showToast("Error al cargar el historial de ventas.", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter(sale => 
      sale.id.toString().includes(term) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(term)) ||
      (sale.branchName && sale.branchName.toLowerCase().includes(term)) ||
      (sale.userName && sale.userName.toLowerCase().includes(term))
    );
  }, [sales, searchTerm]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);

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
            <div className="flex items-center gap-3 pb-1">
                <button 
                  onClick={fetchSales}
                  disabled={loading}
                  className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-xl border border-neutral-700 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 h-10"
                >
                  <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Sincronizar
                </button>
            </div>
        </div>

        {/* Transaction Table Card – Matching Inventory Matrix style */}
        <Card style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-default)" }}>
          <HistoryFilters 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchSales}
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
        isAdmin={session?.rol === "ADMIN"}
        onSaleCanceled={fetchSales}
      />
    </div>
  );
}
