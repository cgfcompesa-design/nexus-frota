import { Card, CardContent } from "@/components/ui/card";
import { Car, DollarSign, Clock, ShieldCheck } from "lucide-react";
import { AnalyticsSummary } from "./poolAnalytics";

interface DashboardCardsProps {
  summary: AnalyticsSummary;
}

export const DashboardCards = ({ summary }: DashboardCardsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative group hover:shadow-md transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block">Total de Corridas</span>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{summary.totalTrips}</h3>
            <span className="text-[9px] text-slate-500 font-medium block mt-1">
              <span className="text-emerald-500 font-bold">{summary.completedTrips}</span> concluídas • <span className="text-rose-500 font-bold">{summary.cancelledTrips}</span> canc.
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Car className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative group hover:shadow-md transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block">Custo Total</span>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{formatCurrency(summary.totalCost)}</h3>
            <span className="text-[9px] text-slate-500 font-medium block mt-1">
              Base: {formatCurrency(summary.baseCost)}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative group hover:shadow-md transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block">Pedágio + Estac.</span>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {formatCurrency(summary.tollCost + summary.parkingCost)}
            </h3>
            <span className="text-[9px] text-slate-500 font-medium block mt-1">
              Ped: {formatCurrency(summary.tollCost)} • Est: {formatCurrency(summary.parkingCost)}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative group hover:shadow-md transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block">Média de Espera</span>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {summary.avgWaitTime.toFixed(1)} min
            </h3>
            <span className="text-[9px] text-slate-500 font-medium block mt-1">
              Custo méd/corrida: {formatCurrency(summary.avgTripCost)}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Clock className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
