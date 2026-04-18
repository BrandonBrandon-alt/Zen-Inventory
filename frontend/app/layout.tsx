import type { Metadata } from "next";
import { Inter, Lora, Geist } from "next/font/google";
import { ToastProvider } from "@/context/ToastContext";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const lora  = Lora({ subsets: ["latin"], variable: "--font-serif", display: "swap", style: ["normal"] });

export const metadata: Metadata = {
  title: "Zen Inventory – Sistema de Inventario",
  description: "Plataforma de gestión de inventario multi-sucursal para Zen Inventory.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("h-full", lora.variable, "font-sans", geist.variable)}>
      <body className="min-h-full bg-[var(--bg-base)] text-[var(--neutral-100)] antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
