import React from "react";
import { cn } from "../../lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: "up" | "down";
  colorScheme?: "primary" | "success" | "warning" | "danger" | "default";
  onClick?: () => void;
  isActive?: boolean;
  centered?: boolean;
}

export const MetricCard = ({ 
  title, 
  value, 
  icon, 
  description, 
  trend,
  colorScheme = "default",
  onClick,
  isActive,
  centered = false
}: MetricCardProps) => {
  const getSchemeClasses = () => {
    if (isActive) {
      switch (colorScheme) {
        case "primary": return "bg-blue-600 text-white shadow-md";
        case "success": return "bg-emerald-600 text-white shadow-md";
        case "warning": return "bg-amber-600 text-white shadow-md";
        case "danger": return "bg-rose-600 text-white shadow-md";
        default: return "bg-indigo-600 text-white shadow-md";
      }
    }
    switch (colorScheme) {
      case "primary": return "bg-blue-50 dark:bg-blue-900/20 text-blue-600";
      case "success": return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600";
      case "warning": return "bg-amber-50 dark:bg-amber-900/20 text-amber-600";
      case "danger": return "bg-rose-50 dark:bg-rose-900/20 text-rose-600";
      default: return "bg-slate-50 dark:bg-slate-800/50 text-slate-600";
    }
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-2.5 rounded-xl border shadow-sm transition-all cursor-pointer flex flex-col",
        centered && "items-center justify-center text-center",
        isActive 
          ? "bg-slate-50 dark:bg-slate-800 border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20" 
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
      )}
    >
      <div className={cn("flex mb-1.5 w-full", centered ? "justify-center" : "justify-between items-start")}>
        <div className={cn("p-1.5 rounded-lg transition-colors", getSchemeClasses())}>
          {icon}
        </div>
        {!centered && trend && (
          <div className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            trend === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend === "up" ? "↑" : "↓"}
          </div>
        )}
      </div>
      <p className={cn("text-[10px] font-black uppercase tracking-widest text-slate-400 ml-0.5", centered && "mx-auto")}>{title}</p>
      <h3 className={cn("text-xl font-black text-slate-800 dark:text-white mt-0.5", centered && "mx-auto")}>{value}</h3>
      {description && (
        <p className={cn("text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-tight", centered && "mx-auto")}>{description}</p>
      )}
    </div>
  );
};
