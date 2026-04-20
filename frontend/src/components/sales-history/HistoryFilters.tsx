import React from "react";
import SearchFilter from "@/components/ui/SearchFilter";
import Separator from "@/components/ui/Separator";
import Select from "@/components/ui/Select";
import { Building, CheckCircle } from "lucide-react";

interface HistoryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  branches?: { id?: number; nombre?: string }[];
  selectedBranchId: string | number | null;
  onBranchChange: (value: string | number) => void;
  isAdmin: boolean;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
}

export default function HistoryFilters({ 
  searchTerm, 
  onSearchChange,
  branches = [],
  selectedBranchId,
  onBranchChange,
  isAdmin,
  sortOrder,
  onSortOrderChange
}: HistoryFiltersProps) {
  return (
    <div className="p-8 flex flex-col gap-8 bg-[var(--bg-surface)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 flex flex-col md:flex-row gap-6 items-end">
          {isAdmin && (
            <div className="w-full md:w-80">
              <Select
                label="Sucursal de Auditoría"
                value={selectedBranchId || "all"}
                onChange={(val) => onBranchChange(val === "all" ? 0 : val)}
                options={[
                  { value: "all", label: "Todas las Sedes / Consolidado" },
                  ...branches.map(b => ({ value: b.id!, label: b.nombre! }))
                ]}
                icon={<Building size={14} className="text-[var(--brand-500)]" />}
              />
            </div>
          )}

          <div className="w-full md:w-96">
            <SearchFilter 
              label="Localizador de Transacción"
              placeholder="Ej: #1024, Juan Perez, Sede Norte..."
              value={searchTerm}
              onChange={onSearchChange}
              containerClassName="w-full"
              className="h-11 shadow-inner bg-[var(--bg-card)] border-[var(--neutral-800)]"
            />
          </div>

          <div className="w-full md:w-60">
            <Select
              label="Orden Cronológico"
              value={sortOrder}
              onChange={(val) => onSortOrderChange(val as "asc" | "desc")}
              options={[
                { value: "desc", label: "Recientes primero" },
                { value: "asc", label: "Antiguos primero" }
              ]}
              icon={<Building size={14} className="text-[var(--brand-500)]" />} // Reusing icon or change to something like Calendar
            />
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 px-6 border-l border-[var(--neutral-800)]">
           <div className="text-right">
              <span className="text-[10px] font-black text-[var(--neutral-500)] uppercase tracking-widest block">Registro de Caja</span>
              <span className="text-[12px] font-black text-[var(--neutral-100)] uppercase tracking-tight">Cruce de Inventarios Ok</span>
           </div>
           <div className="w-10 h-10 bg-[var(--color-success)]/10 rounded-full flex items-center justify-center text-[var(--color-success)] border border-[var(--color-success)]/20 shadow-inner">
              <CheckCircle size={18} />
           </div>
        </div>
      </div>
      
      <Separator className="opacity-40" />
    </div>
  );
}
