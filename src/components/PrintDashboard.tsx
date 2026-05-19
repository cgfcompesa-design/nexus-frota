import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IndicatorChart } from "./IndicatorChart";

interface PrintDashboardProps {
  indicators: any[];
  allIndicatorValues: any[];
  tasks: any[];
  responsibles: any[];
  selectedMonth: Date;
  onEditIndicator: (indicator: any) => void;
}

export const PrintDashboard = ({ indicators, tasks, selectedMonth, allIndicatorValues, responsibles, onEditIndicator }: PrintDashboardProps) => {
  return (
    <div className="space-y-6 pb-12">
      <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-900/40 to-slate-900 p-8 border-b border-white/5">
          <CardTitle className="text-2xl font-black uppercase text-white tracking-[0.2em] text-center italic">
            Dashboard Estratégico - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
          <p className="text-center text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-2">Visão Consolidada de Performance Nexus Frota</p>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Total Indicadores</p>
              <p className="text-4xl font-black text-white italic">{indicators.length}</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Metas Atingidas</p>
              <p className="text-4xl font-black text-emerald-500 italic">{indicators.filter(i => i.current_value >= i.target).length}</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Tarefas Concluídas</p>
              <p className="text-4xl font-black text-indigo-400 italic">{tasks.filter(t => t.status === 'done').length}</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Eficiência Global</p>
              <p className="text-4xl font-black text-amber-500 italic">
                {indicators.length > 0 ? Math.round((indicators.filter(i => i.current_value >= i.target).length / indicators.length) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {indicators.map((indicator) => (
              <IndicatorChart
                key={indicator.id}
                indicator={indicator}
                onEdit={onEditIndicator}
                responsibles={responsibles}
                selectedMonth={selectedMonth}
                historyValues={allIndicatorValues.filter(
                  (v) => v.indicator_id === indicator.id
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
