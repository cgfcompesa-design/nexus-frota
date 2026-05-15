import React from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const ChartCard = ({ title, description, children, className, headerAction }: ChartCardProps) => {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col ${className || ""}`}>
      <div className="p-5 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight text-sm">{title}</h3>
          {description && (
            <p className="text-xs text-slate-400 mt-1">{description}</p>
          )}
        </div>
        {headerAction && (
          <div className="flex-shrink-0">
            {headerAction}
          </div>
        )}
      </div>
      <div className="p-5 flex-1 min-h-[300px]">
        {children}
      </div>
    </div>
  );
};
