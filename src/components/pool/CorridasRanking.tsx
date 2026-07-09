import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PoolTrip } from "@/services/poolService";
import { parseDurationMinutes } from "./poolAnalytics";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CorridasRankingProps {
  trips: PoolTrip[];
}

export const CorridasRanking = ({ trips }: CorridasRankingProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"valorTotal" | "espera" | "duracao">("valorTotal");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const processedTrips = useMemo(() => {
    let result = trips.map(t => ({
      ...t,
      duracao: parseDurationMinutes(t.hrInicial, t.hrFinal),
    }));

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.usuario.toLowerCase().includes(lower) || 
        t.motorista.toLowerCase().includes(lower) || 
        t.origem.toLowerCase().includes(lower) || 
        t.destino.toLowerCase().includes(lower) || 
        t.placa.toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(t => t.status.toUpperCase() === statusFilter.toUpperCase());
    }

    if (sortBy === "valorTotal") {
      result.sort((a, b) => b.valorTotal - a.valorTotal);
    } else if (sortBy === "espera") {
      result.sort((a, b) => b.tempoMedioEspera - a.tempoMedioEspera);
    } else if (sortBy === "duracao") {
      result.sort((a, b) => b.duracao - a.duracao);
    }

    return result;
  }, [trips, searchTerm, statusFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(processedTrips.length / itemsPerPage);
  const paginatedTrips = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedTrips.slice(startIndex, startIndex + itemsPerPage);
  }, [processedTrips, currentPage]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set(trips.map(t => t.status.toUpperCase()));
    return Array.from(set).filter(Boolean);
  }, [trips]);

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Lista e Auditoria de Corridas
          </CardTitle>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Visualize, filtre e ordene as corridas individuais do Pool de veículos
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant={sortBy === "valorTotal" ? "default" : "outline"} 
            size="sm"
            className="text-[10px] font-black uppercase tracking-widest h-8"
            onClick={() => { setSortBy("valorTotal"); setCurrentPage(1); }}
          >
            Maior Valor
          </Button>
          <Button 
            variant={sortBy === "espera" ? "default" : "outline"} 
            size="sm"
            className="text-[10px] font-black uppercase tracking-widest h-8"
            onClick={() => { setSortBy("espera"); setCurrentPage(1); }}
          >
            Maior Espera
          </Button>
          <Button 
            variant={sortBy === "duracao" ? "default" : "outline"} 
            size="sm"
            className="text-[10px] font-black uppercase tracking-widest h-8"
            onClick={() => { setSortBy("duracao"); setCurrentPage(1); }}
          >
            Maior Duração
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Filters bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input 
            placeholder="Buscar por usuário, motorista, placa, origem..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs h-9"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs h-9 px-3 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Todos os Status</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-end">
            Mostrando {processedTrips.length} de {trips.length} registros
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Abertura / OS</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Usuário</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Motorista / Placa</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Rota (Origem → Destino)</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Espera</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Duração</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Valor Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTrips.map((trip, idx) => (
                <TableRow key={trip.os + idx} className="border-slate-100 dark:border-slate-800">
                  <TableCell className="py-3">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{trip.abertura}</span>
                    <span className="block text-[9px] font-mono font-bold text-slate-400">OS: {trip.os}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={trip.usuario}>
                      {trip.usuario}
                    </span>
                    <span className="block text-[9px] font-medium text-slate-400">{trip.centroCusto}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">{trip.motorista}</span>
                    <span className="inline-block text-[9px] font-mono font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded leading-none mt-0.5">
                      {trip.placa || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 max-w-[200px]">
                    <span className="block text-xs text-slate-600 dark:text-slate-400 truncate" title={trip.origem}>
                      <strong className="text-slate-400">De:</strong> {trip.origem || "Não informado"}
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400 truncate" title={trip.destino}>
                      <strong className="text-slate-400">Para:</strong> {trip.destino || "Não informado"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">
                    {trip.tempoMedioEspera > 0 ? `${trip.tempoMedioEspera}m` : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-right py-3">
                    {trip.duracao > 0 ? `${trip.duracao}m` : "-"}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200 text-right py-3">
                    {formatCurrency(trip.valorTotal)}
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <Badge className={`border-none font-black text-[8px] uppercase tracking-wider py-1 px-2 rounded-lg ${
                      trip.status.toUpperCase() === "CONCLUÍDA" 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {trip.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}

              {paginatedTrips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs font-bold">
                    Nenhuma corrida encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1}
                className="h-8 text-xs font-bold"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages}
                className="h-8 text-xs font-bold"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
