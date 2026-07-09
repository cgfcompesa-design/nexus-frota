import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RankingItem } from "./poolAnalytics";

interface UsuarioRankingProps {
  data: RankingItem[];
}

export const UsuarioRanking = ({ data }: UsuarioRankingProps) => {
  const top10 = data.slice(0, 10);
  const maxCost = top10.length > 0 ? top10[0].totalCost : 1;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Top Usuários por Custo de Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="space-y-4">
          {top10.map((item, idx) => {
            const percentage = (item.totalCost / maxCost) * 100;
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 truncate max-w-[200px] md:max-w-xs">
                    <span className="h-5 w-5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center justify-center font-black text-slate-500 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span>{formatCurrency(item.totalCost)} <span className="font-medium text-slate-400 dark:text-slate-500">({item.count} corridas)</span></span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500" 
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
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Nome do Usuário</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Qtd Corridas</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Custo Médio</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Custo Estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 15).map((item) => (
                <TableRow key={item.name} className="border-slate-100 dark:border-slate-800">
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 py-3">{item.name}</TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">{item.count}</TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">{formatCurrency(item.avgCost)}</TableCell>
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 text-right py-3">{formatCurrency(item.totalCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
