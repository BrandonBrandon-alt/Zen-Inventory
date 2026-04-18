import React from "react";
import SearchFilter from "@/components/ui/SearchFilter";
import Separator from "@/components/ui/Separator";
import Select from "@/components/ui/Select";
import { Building } from "lucide-react";

interface HistoryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  branches?: { id?: number; nombre?: string }[];
  selectedBranchId: string | number | null;
  onBranchChange: (value: string | number) => void;
  isAdmin: boolean;
}

export default function HistoryFilters({ 
  searchTerm, 
  onSearchChange,
  branches = [],
  selectedBranchId,
  onBranchChange,
  isAdmin
}: HistoryFiltersProps) {
  return (
    <div className="p-6 flex flex-col gap-6 bg-[var(--bg-surface)]">
      <div className="flex flex-row flex-wrap items-end gap-6">
        {isAdmin && (
          <div className="w-full max-w-[280px]">
            <Select
              label="Sucursal"
              value={selectedBranchId || "all"}
              onChange={(val) => onBranchChange(val === "all" ? 0 : val)}
              options={[
                { value: "all", label: "Todas las Sedes" },
                ...branches.map(b => ({ value: b.id!, label: b.nombre! }))
              ]}
              icon={<Building size={14} className="text-[var(--brand-400)]" />}
            />
          </div>
        )}

        <div className="flex-1 max-w-[450px]">
          <SearchFilter 
            label="Búsqueda de Auditoría"
            placeholder="ID venta, sucursal o cliente..."
            value={searchTerm}
            onChange={onSearchChange}
            containerClassName="w-full"
            className="h-11 shadow-sm"
          />
        </div>
      </div>
      
      <Separator />
    </div>
  );
}
