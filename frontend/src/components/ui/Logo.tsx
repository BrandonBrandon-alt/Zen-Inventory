import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  color?: string;
  showText?: boolean;
}

export default function Logo({ 
  size = 48, 
  className = "", 
  color = "var(--brand-500)",
  showText = false
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Lotus flower SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* --- Outer back petals (wide, fanned) --- */}
        {/* Far left petal */}
        <path
          d="M60 75 Q20 60 15 30 Q35 45 60 75Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.7"
        />
        {/* Far right petal */}
        <path
          d="M60 75 Q100 60 105 30 Q85 45 60 75Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.7"
        />
        {/* Left outer petal */}
        <path
          d="M60 75 Q10 55 8 20 Q32 38 60 75Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.5"
        />
        {/* Right outer petal */}
        <path
          d="M60 75 Q110 55 112 20 Q88 38 60 75Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.5"
        />

        {/* --- Lower petals (base) --- */}
        <path
          d="M60 80 Q42 95 38 115 Q55 100 60 80Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.7"
        />
        <path
          d="M60 80 Q78 95 82 115 Q65 100 60 80Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.7"
        />
        <path
          d="M60 80 Q60 100 60 118 Q60 100 60 80Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.5"
        />

        {/* --- Middle layer petals --- */}
        {/* Left mid */}
        <path
          d="M60 70 Q28 58 22 28 Q44 46 60 70Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          opacity="0.85"
        />
        {/* Right mid */}
        <path
          d="M60 70 Q92 58 98 28 Q76 46 60 70Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          opacity="0.85"
        />
        {/* Center-left inner lines */}
        <path
          d="M60 72 Q40 60 42 35 Q53 52 60 72Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.9"
        />
        {/* Center-right inner lines */}
        <path
          d="M60 72 Q80 60 78 35 Q67 52 60 72Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* --- Tall center petals --- */}
        <path
          d="M60 72 Q50 40 60 8 Q70 40 60 72Z"
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        {/* Left of center */}
        <path
          d="M60 72 Q42 42 48 12 Q58 42 60 72Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
        />
        {/* Right of center */}
        <path
          d="M60 72 Q78 42 72 12 Q62 42 60 72Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
        />

        {/* Subtle radiating veins from center */}
        <line x1="60" y1="72" x2="60" y2="30" stroke={color} strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="72" x2="38" y2="42" stroke={color} strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="72" x2="82" y2="42" stroke={color} strokeWidth="0.8" opacity="0.3" />
      </svg>

      {showText && (
        <span style={{
          color: color,
          fontSize: "clamp(10px, 1.2vw, 14px)",
          fontWeight: 700,
          fontFamily: "var(--font-sans)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}>
          Zen Inventory
        </span>
      )}
    </div>
  );
}
