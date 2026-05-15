import React from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(({ title, description, children, className, headerAction }, ref) => {
  return (
    <div ref={ref} className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col ${className || ""}`}>
      <div className="p-2.5 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/20">
        <div>
          <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">{title}</h3>
          {description && (
            <p className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase">{description}</p>
          )}
        </div>
        {headerAction && (
          <div className="flex-shrink-0">
            {headerAction}
          </div>
        )}
      </div>
      <div className="p-3 flex-1 min-h-[250px]">
        {children}
      </div>
    </div>
  );
});

ChartCard.displayName = "ChartCard";
