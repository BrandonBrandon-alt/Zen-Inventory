"use client";

import React from "react";
import { Search } from "lucide-react";
import Input from "./Input";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  containerClassName?: string;
}

/**
 * Reusable Search Filter component based on the Inventory design.
 * Features a large, premium-styled input with a search icon.
 */
const SearchFilter: React.FC<SearchFilterProps> = ({
  value,
  onChange,
  placeholder = "Buscar...",
  label,
  className = "",
  containerClassName = "max-w-xl",
}) => {
  return (
    <div className={containerClassName}>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        icon={<Search size={18} className="text-[var(--neutral-500)]" />}
        className={`bg-[var(--bg-card)] border-[var(--border-default)] focus:border-[var(--brand-500)]/50 transition-all rounded-2xl h-12 ${className}`}
      />
    </div>
  );
};

export default SearchFilter;
