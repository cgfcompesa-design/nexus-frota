import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, CalendarIcon } from "lucide-react";
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
  Line,
  PieChart,
  Pie
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface IndicatorChartProps {
  key?: any;
  indicator: any;
  onEdit: (indicator: any) => void;
  responsibles: any[];
  historyValues: any[];
  selectedMonth: Date;
}

export const IndicatorChart = ({ indicator, onEdit, historyValues, selectedMonth }: IndicatorChartProps) => {
  const isGoalAchieved = indicator.current_value >= indicator.target;
  const statusColor = isGoalAchieved ? "#10b981" : "#f43f5e";
  const targetColor = "#6366f1";

  const data = [
    { name: "Real", value: indicator.current_value },
    { name: "Meta", value: indicator.target }
  ];

  const pieData = [
    { name: "Real", value: indicator.current_value, fill: statusColor },
    { name: "Restante", value: Math.max(0, indicator.target - indicator.current_value), fill: "#1e293b" }
  ];

  // For Gauge, we use a specialized PieChart or just a progress bar approach
  // Let's use a semi-circle PieChart for gauge
  const gaugeData = [
    { name: "Score", value: Math.min(indicator.current_value, indicator.target * 1.2), fill: statusColor },
    { name: "Remaining", value: Math.max(0, (indicator.target * 1.2) - indicator.current_value), fill: "#1e293b" }
  ];

  // Process history for line chart
  const lineData = historyValues.slice().reverse().map(v => ({
    month: format(new Date(v.month), "MMM/yy", { locale: ptBR }),
    value: v.current_value,
    target: v.target
  }));

  const renderChart = () => {
    switch (indicator.chart_type) {
      case "line":
        return (
          <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={statusColor} strokeWidth={3} dot={{ r: 4, fill: statusColor }} />
            <Line type="monotone" dataKey="target" stroke={targetColor} strokeDasharray="5 5" strokeWidth={2} dot={false} />
          </LineChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie
              data={pieData}
              innerRadius={40}
              outerRadius={65}
              paddingAngle={5}
              dataKey="value"
              startAngle={90}
              endAngle={450}
            />
            <Tooltip />
          </PieChart>
        );
      case "gauge":
        return (
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={0}
              dataKey="value"
            />
            <Tooltip />
            <text x="50%" y="70%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 dark:fill-white font-black text-xl italic">
              {indicator.current_value}{indicator.unit}
            </text>
          </PieChart>
        );
      case "number":
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-2">
            <span className="text-4xl font-black text-slate-800 dark:text-white italic tracking-tighter">
              {indicator.current_value}
              <span className="text-sm font-bold text-slate-400 not-italic ml-1">{indicator.unit}</span>
            </span>
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-black uppercase text-slate-500">Meta: {indicator.target}{indicator.unit}</div>
              <div className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", isGoalAchieved ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                {isGoalAchieved ? "ALCANÇADA" : "PENDENTE"}
              </div>
            </div>
          </div>
        );
      case "bar":
      default:
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? statusColor : targetColor} />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden group shadow-md hover:shadow-lg transition-shadow">
      <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3 text-indigo-500" />
          <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest italic">
            Ref: {format(selectedMonth, "MMM / yy", { locale: ptBR })}
          </span>
        </div>
        {indicator.chart_type && (
          <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">
            Mode: {indicator.chart_type}
          </span>
        )}
      </div>
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
            {renderChart()}
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
