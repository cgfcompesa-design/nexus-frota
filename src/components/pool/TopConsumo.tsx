import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoolTrip } from "@/services/poolService";
import { parseDurationMinutes } from "./poolAnalytics";
import { useMemo } from "react";

interface TopConsumoProps {
  trips: PoolTrip[];
}

export const TopConsumo = ({ trips }: TopConsumoProps) => {
  const consumptionData = useMemo(() => {
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
        // Estimate Km: average speed of 35 km/h
        const estimatedKm = data.durationMinutes > 0 
          ? (data.durationMinutes * 35) / 60 
          : data.count * 15;

        // Estimate Fuel Consumption: average 10 KM/L
        const estimatedLiters = estimatedKm / 10;

        return {
          placa,
          modelo: data.modelo,
          count: data.count,
          estimatedKm: Math.round(estimatedKm),
          estimatedLiters: parseFloat(estimatedLiters.toFixed(1)),
        };
      })
      .sort((a, b) => b.estimatedLiters - a.estimatedLiters);
  }, [trips]);

  const top10 = consumptionData.slice(0, 10);
  const maxLiters = top10.length > 0 ? top10[0].estimatedLiters : 1;

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Veículos com Maior Consumo de Combustível (Estimado)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="space-y-4">
          {top10.map((item, idx) => {
            const percentage = (item.estimatedLiters / maxLiters) * 100;
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
                  <span>{item.estimatedLiters.toLocaleString("pt-BR")} Litros <span className="font-medium text-slate-400 dark:text-slate-500">({item.estimatedKm} KM)</span></span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-500" 
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
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">KM Estimado</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Média Est.</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Consumo Est. (L)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptionData.slice(0, 15).map((item) => (
                <TableRow key={item.placa} className="border-slate-100 dark:border-slate-800">
                  <TableCell className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs py-3">{item.placa}</TableCell>
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 py-3">{item.modelo}</TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">{item.estimatedKm} KM</TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">10,0 km/L</TableCell>
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 text-right py-3">
                    {item.estimatedLiters.toLocaleString("pt-BR")} L
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
