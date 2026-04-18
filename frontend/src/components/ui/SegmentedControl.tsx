"use client";

import React from "react";

interface SegmentedControlOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ 
  options, 
  value, 
  onChange,
  className = ""
}) => {
  return (
    <div className={`inline-flex bg-[#121212] p-1.5 rounded-[20px] border border-[var(--neutral-800)] shadow-inner ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-6 py-2.5 rounded-[16px] border-none cursor-pointer text-[14px] font-bold transition-all duration-300 ${
              isActive 
                ? "bg-[#e67e6e] text-white shadow-md shadow-[#e67e6e]/20" 
                : "bg-transparent text-[#555555] hover:text-[#888888]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
