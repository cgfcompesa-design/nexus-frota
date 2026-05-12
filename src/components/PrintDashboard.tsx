import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrintDashboardProps {
  indicators: any[];
  tasks: any[];
  responsibles: any[];
  selectedMonth: Date;
}

export const PrintDashboard = ({ indicators, tasks, selectedMonth }: PrintDashboardProps) => {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase text-white tracking-widest text-center">
            Relatório Consolidado - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {indicators.map(ind => {
              const achieved = ind.current_value >= ind.target;
              return (
                <div key={ind.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">{ind.name}</p>
                    <p className="text-lg font-black text-white">{ind.current_value}{ind.unit}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${achieved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {achieved ? "Dentro" : "Fora"}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Total Tarefas</p>
              <p className="text-2xl font-black text-white">{tasks.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Concluídas</p>
              <p className="text-2xl font-black text-emerald-500">{tasks.filter(t => t.status === 'done').length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Pendentes</p>
              <p className="text-2xl font-black text-amber-500">{tasks.filter(t => t.status !== 'done').length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">% Evolução</p>
              <p className="text-2xl font-black text-indigo-400">{tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
