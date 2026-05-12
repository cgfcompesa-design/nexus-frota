import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell,
  LineChart,
  Line
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IndicatorChartProps {
  key?: any;
  indicator: any;
  onEdit: (indicator: any) => void;
  responsibles: any[];
  historyValues: any[];
}

export const IndicatorChart = ({ indicator, onEdit, historyValues }: IndicatorChartProps) => {
  const isGoalAchieved = indicator.current_value >= indicator.target;
  const statusColor = isGoalAchieved ? "#10b981" : "#f43f5e";

  const data = [
    { name: "Real", value: indicator.current_value },
    { name: "Meta", value: indicator.target }
  ];

  // Process history for line chart if needed
  const chartData = historyValues.slice().reverse().map(v => ({
    month: format(new Date(v.month), "MMM/yy", { locale: ptBR }),
    value: v.current_value,
    target: v.target
  }));

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden group shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 border-b border-slate-100 dark:border-white/5">
        <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white leading-tight">
          {indicator.name}
        </CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onEdit(indicator)}
          className="h-8 w-8 text-slate-400 hover:text-indigo-600 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" dark:stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#1e293b' }}
                className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? statusColor : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between items-end pt-2 border-t border-slate-100 dark:border-white/5">
          <div className="space-y-1">
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Realizado</p>
             <p className="text-xl font-black text-slate-800 dark:text-white italic">{indicator.current_value}{indicator.unit}</p>
          </div>
          <div className="text-right space-y-1">
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Meta</p>
             <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{indicator.target}{indicator.unit}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
