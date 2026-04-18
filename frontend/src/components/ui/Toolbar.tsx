"use client";

import React, { ReactNode } from "react";

interface ToolbarProps {
  /**
   * Actions or elements on the left side (Selects, Tabs, etc.)
   */
  left?: ReactNode;
  /**
   * Actions or elements on the right side (Buttons, View toggles)
   */
  right?: ReactNode;
  /**
   * Main content area, usually for search bars or additional filter rows
   */
  children?: ReactNode;
  /**
   * Optional custom classes for the container
   */
  className?: string;
  /**
   * If true, reduces margins for smaller sections
   */
  compact?: boolean;
}

/**
 * A reusable Toolbar component that follows the app's minimalist and elegant aesthetic.
 * It provides standardized spacing and layout for dashboard actions and filters.
 */
const Toolbar: React.FC<ToolbarProps> = ({ 
  left, 
  right, 
  children, 
  className = "", 
  compact = false 
}) => {
  return (
    <div className={`flex flex-col ${compact ? "gap-4 mb-6" : "gap-8 mb-10"} ${className}`}>
      {/* Upper Row: Left and Right Actions */}
      {(left || right) && (
        <div className="flex flex-row flex-wrap justify-between items-end gap-6">
          {left && (
            <div className={`flex flex-wrap items-end ${compact ? "gap-6" : "gap-10"}`}>
              {left}
            </div>
          )}
          
          {right && (
            <div className={`flex items-center ${compact ? "gap-3" : "gap-4"}`}>
              {right}
            </div>
          )}
        </div>
      )}

      {/* Lower area: Usually for search bars or secondary toolbars */}
      {children && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
