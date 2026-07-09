import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoolTrip } from "@/services/poolService";
import { parseDurationMinutes } from "./poolAnalytics";
import { useMemo } from "react";

interface TopKmProps {
  trips: PoolTrip[];
}

export const TopKm = ({ trips }: TopKmProps) => {
  const kmData = useMemo(() => {
    const groups: Record<string, { count: number; modelo: string; durationMinutes: number }> = {};
    
    trips.forEach(t => {
      if (!t.placa) return;
      const key = t.placa;
      if (!groups[key]) {
        groups[key] = { count: 0, modelo: t.modelo || "NÃO INFORMADO", durationMinutes: 0 };
      }
      groups[key].count++;
      groups[key].durationMinutes += parseDurationMinutes(t.hrInicial, t.hrFinal);
    });

    return Object.entries(groups)
      .map(([placa, data]) => {
        // Estimate Km: average speed of 35 km/h (35 / 60 = 0.583 km per minute)
        // If duration is 0, give a nominal 15 km per completed trip as fallback
        const estimatedKm = data.durationMinutes > 0 
          ? (data.durationMinutes * 35) / 60 
          : data.count * 15;

        return {
          placa,
          modelo: data.modelo,
          count: data.count,
          durationMinutes: data.durationMinutes,
          estimatedKm: Math.round(estimatedKm),
        };
      })
      .sort((a, b) => b.estimatedKm - a.estimatedKm);
  }, [trips]);

  const top10 = kmData.slice(0, 10);
  const maxKm = top10.length > 0 ? top10[0].estimatedKm : 1;

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Veículos com Maior Quilometragem Percorrida (Estimado)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="space-y-4">
          {top10.map((item, idx) => {
            const percentage = (item.estimatedKm / maxKm) * 100;
            return (
              <div key={item.placa} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-5 w-5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center justify-center font-black text-slate-500">
                      {idx + 1}
                    </span>
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">
                      {item.placa}
                    </span>
                    <span className="text-slate-500 font-medium truncate max-w-[120px] md:max-w-xs">{item.modelo}</span>
                  </span>
                  <span>{item.estimatedKm.toLocaleString()} KM <span className="font-medium text-slate-400 dark:text-slate-500">({item.count} corridas)</span></span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Placa</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Modelo</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Horas em Trânsito</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Qtd Corridas</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Quilometragem Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kmData.slice(0, 15).map((item) => (
                <TableRow key={item.placa} className="border-slate-100 dark:border-slate-800">
                  <TableCell className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs py-3">{item.placa}</TableCell>
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 py-3">{item.modelo}</TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">
                    {(item.durationMinutes / 60).toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">{item.count}</TableCell>
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 text-right py-3">
                    {item.estimatedKm.toLocaleString()} KM
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
