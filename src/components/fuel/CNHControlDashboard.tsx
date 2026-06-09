import React, { useState, useMemo } from "react";
import { useCNHData, calculateCNHStats, calculateStatsByGestor, CNHRecord } from "@/hooks/useCNHData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Mail, 
  Download,
  Filter,
  UserCheck
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";

export function CNHControlDashboard() {
  const { data: cnhResult, isLoading, error } = useCNHData();
  const cnhData = (cnhResult as any)?.records || [];
  const [search, setSearch] = useState("");
  const [selectedGestor, setSelectedGestor] = useState("all");

  const stats = useMemo(() => calculateCNHStats(cnhData), [cnhData]);
  const gestorStats = useMemo(() => calculateStatsByGestor(cnhData), [cnhData]);

  const gestores = useMemo(() => {
    const s = new Set<string>();
    cnhData.forEach((r: CNHRecord) => { if (r.gerencia) s.add(r.gerencia); });
    return Array.from(s).sort();
  }, [cnhData]);

  const filteredData = useMemo(() => {
    return cnhData.filter((r: CNHRecord) => {
      const matchesSearch = 
        r.nome.toLowerCase().includes(search.toLowerCase()) ||
        r.codMotorista.toLowerCase().includes(search.toLowerCase()) ||
        (r.matricula || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesGestor = selectedGestor === "all" || r.gerencia === selectedGestor;
      
      return matchesSearch && matchesGestor;
    });
  }, [cnhData, search, selectedGestor]);

  const handleExport = () => {
    const dataToExport = filteredData.map((r: CNHRecord) => ({
      "Código": r.codMotorista,
      "Nome": r.nome,
      "Matrícula": r.matricula,
      "Categoria": r.categoria,
      "Vencimento CNH": r.validadeStr,
      "Situação": r.status,
      "Gerência": r.gerencia
    }));

    exportToExcelMultiSheet([
      { data: dataToExport, sheetName: "Controle CNH" }
    ], "Controle_CNH_Nexus");
    
    toast.success("Excel gerado com sucesso!");
  };

  const handleSendEmail = (record: CNHRecord) => {
    const subject = `Vencimento de CNH - ${record.nome}`;
    const body = `Prezado(a) ${record.nome},\n\nIdentificamos em nosso sistema que sua CNH está com vencimento próximo ou vencida (${record.validadeStr}).\n\nFavor providenciar a renovação e enviar a cópia para a Coordenação de Gestão de Frotas - CGF.\n\nAtenciosamente,\nCoordenação de Gestão de Frotas - CGF`;
    const cc = "gadabastecimento@compesa.com.br;gadmonitoramento@compesa.com.br";
    const mailto = `mailto:?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.info(`E-mail preparado para ${record.nome}`);
  };

  // No page-blocking loading screen to keep tabs accessible immediately
  if (error) return (
    <div className="p-8 text-center text-destructive border rounded-lg bg-destructive/5">
      Erro ao carregar dados de CNH. Verifique a conexão com a planilha.
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-2">
            <UserCheck className="text-indigo-600" />
            Controle de CNH
          </h1>
          <p className="text-sm text-slate-500 font-medium italic">Monitoramento de validade e categorias de condutores.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 border-2 uppercase font-black text-xs tracking-widest">
          <Download size={16} />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard title="Total Condutores" value={stats.total} icon={<Users className="text-slate-500" />} centered />
        <MetricCard title="Regulares" value={stats.regulares} icon={<CheckCircle2 className="text-emerald-500" />} centered />
        <MetricCard title="Vencendo (30d)" value={stats.em30dias} icon={<Clock className="text-orange-500" />} centered />
        <MetricCard title="Vencendo (90d)" value={stats.em90dias} icon={<Clock className="text-blue-500" />} centered />
        <MetricCard title="Vencidos" value={stats.vencidas} icon={<AlertCircle className="text-rose-500" />} centered />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <ChartCard title="Filtros e Busca" className="lg:col-span-1">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buscar por Código/Nome</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Ex: 12345 ou João..." 
                  className="pl-9 h-10 rounded-xl"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por Gestor</label>
              <Select value={selectedGestor} onValueChange={setSelectedGestor}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Todos Gestores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Gestores</SelectItem>
                  {gestores.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Ranking por Gestor</div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {gestorStats.slice(0, 10).map((gs, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-800 dark:text-white truncate uppercase">{gs.gestor}</div>
                        <div className="text-[9px] text-slate-400 font-medium">Total: {gs.total}</div>
                      </div>
                      <div className="flex gap-1.5 ml-2">
                        {gs.vencidas > 0 && <Badge variant="destructive" className="h-4 text-[8px] px-1">{gs.vencidas}</Badge>}
                        {gs.em30dias > 0 && <Badge className="h-4 text-[8px] px-1 bg-orange-500">{gs.em30dias}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Listagem de Condutores" className="lg:col-span-3">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Código</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Nome</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Categoria</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Vencimento</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Situação</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((record: CNHRecord, idx: number) => {
                  const isVencido = record.status === "vencida";
                  const isVencendo = record.status === "30dias" || record.status === "60dias" || record.status === "90dias";
                  
                  return (
                    <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-indigo-600">{record.codMotorista}</TableCell>
                      <TableCell>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{record.nome}</div>
                        <div className="text-[9px] text-slate-400 font-medium truncate max-w-[150px]">{record.gerencia}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-black">{record.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">{record.validadeStr}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={isVencido ? "destructive" : isVencendo ? "outline" : "secondary"}
                          className={`text-[9px] font-black uppercase ${isVencendo ? "bg-amber-50 text-amber-600 border-amber-200" : ""}`}
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          onClick={() => handleSendEmail(record)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Mail size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </ChartCard>
      </div>
    </div>
  );
}
