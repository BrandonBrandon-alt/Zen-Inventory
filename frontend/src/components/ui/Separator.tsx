"use client";

import React from "react";

interface SeparatorProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export default function Separator({ className = "", orientation = "horizontal" }: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <div 
        className={`w-px h-full bg-[var(--neutral-800)] opacity-50 ${className}`} 
        aria-hidden="true" 
      />
    );
  }

  return (
    <div 
      className={`h-px w-full bg-[var(--neutral-700)] ${className}`} 
      aria-hidden="true" 
    />
  );
}
