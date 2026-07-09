import { useState, useMemo } from "react";
import { useTicketTelemetriaData, TicketTelemetriaRecord } from "@/hooks/useTicketTelemetriaData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { LoadingState } from "@/components/dashboard/LoadingState";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Search,
  Filter,
  User,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Grid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportToExcel";
import { cn } from "@/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

export function TicketTelemetriaAnalysisTab() {
  const { data: records = [], isLoading, error } = useTicketTelemetriaData();

  // Search & Filter State
  const [searchPlaca, setSearchPlaca] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterUnidade, setFilterUnidade] = useState<string>("todos");
  const [filterAnomalia, setFilterAnomalia] = useState<string>("todos");
  const [filterResponsavel, setFilterResponsavel] = useState<string>("todos");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Expanded Rows (ID or Placa-Index map)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper parser for DD/MM/YYYY date strings from CSV
  const parseDateBR = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const cleaned = String(dateStr).trim();
    if (!cleaned) return null;
    const parts = cleaned.split("/");
    if (parts.length < 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
  };

  const dateFromObj = useMemo(() => {
    if (!filterDateFrom) return null;
    const [year, month, day] = filterDateFrom.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, [filterDateFrom]);

  const dateToObj = useMemo(() => {
    if (!filterDateTo) return null;
    const [year, month, day] = filterDateTo.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }, [filterDateTo]);

  // Extract unique options for filters
  const filterOptions = useMemo(() => {
    const unidades = new Set<string>();
    const anomalias = new Set<string>();
    const responsaveis = new Set<string>();

    records.forEach((r) => {
      if (r.unidade) unidades.add(r.unidade);
      if (r.tipoAnomalia) {
        anomalias.add(r.tipoAnomalia);
      }
      if (r.responsavelAnalise) responsaveis.add(r.responsavelAnalise);
    });

    return {
      unidades: Array.from(unidades).sort(),
      anomalias: Array.from(anomalias).sort(),
      responsaveis: Array.from(responsaveis).sort(),
    };
  }, [records]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesPlaca = !searchPlaca || r.placa.includes(searchPlaca.toUpperCase().trim());
      
      const matchesStatus =
        filterStatus === "todos" ||
        (filterStatus === "finalizado" && String(r.status).toLowerCase().includes("finaliz")) ||
        (filterStatus === "pendente" && !String(r.status).toLowerCase().includes("finaliz"));

      const matchesUnidade = filterUnidade === "todos" || r.unidade === filterUnidade;
      const matchesAnomalia = filterAnomalia === "todos" || r.tipoAnomalia.includes(filterAnomalia);
      const matchesResponsavel = filterResponsavel === "todos" || r.responsavelAnalise === filterResponsavel;

      // Date Range Match
      let matchesDate = true;
      if (dateFromObj || dateToObj) {
        const recordDate = parseDateBR(r.dataOcorrencia);
        if (recordDate) {
          if (dateFromObj && recordDate < dateFromObj) matchesDate = false;
          if (dateToObj && recordDate > dateToObj) matchesDate = false;
        } else {
          matchesDate = false;
        }
      }

      return matchesPlaca && matchesStatus && matchesUnidade && matchesAnomalia && matchesResponsavel && matchesDate;
    });
  }, [records, searchPlaca, filterStatus, filterUnidade, filterAnomalia, filterResponsavel, dateFromObj, dateToObj]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const finalizados = filteredRecords.filter(r => String(r.status).toLowerCase().includes("finaliz")).length;
    const pendentes = total - finalizados;

    // Count specific types of anomalies inside filtered set
    let semMotorista = 0;
    let motoristaDif = 0;
    let emMovimento = 0;
    let divEndereco = 0;

    filteredRecords.forEach(r => {
      const norm = String(r.tipoAnomalia).toUpperCase();
      if (norm.includes("SEM MOTORISTA")) semMotorista++;
      if (norm.includes("MOTORISTA DIFERENTE")) motoristaDif++;
      if (norm.includes("MOVIMENTO")) emMovimento++;
      if (norm.includes("DIVERGÊNCIA") || norm.includes("DIVERGENCIA") || norm.includes("ENDEREÇO")) divEndereco++;
    });

    return {
      total,
      finalizados,
      pendentes,
      semMotorista,
      motoristaDif,
      emMovimento,
      divEndereco
    };
  }, [filteredRecords]);

  // Chart 1: Anomalies Count
  const anomalyChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const parts = r.tipoAnomalia.split("/").map(p => p.trim());
      parts.forEach(p => {
        if (p) counts[p] = (counts[p] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  // Chart 2: Occurrences by Unidade
  const unitChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      if (r.unidade) {
        counts[r.unidade] = (counts[r.unidade] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // top 10
  }, [filteredRecords]);

  // Chart 3: Status Breakdown
  const statusPieData = useMemo(() => {
    return [
      { name: "Finalizado", value: stats.finalizados },
      { name: "Pendente", value: stats.pendentes }
    ].filter(item => item.value > 0);
  }, [stats]);

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast.warning("Nenhum dado para exportar");
      return;
    }

    const dataToExport = filteredRecords.map((r) => ({
      "Data da Ocorrência": r.dataOcorrencia,
      "Unidade": r.unidade,
      "Placa": r.placa,
      "Marca / Modelo": r.marcaModelo,
      "Ano": r.ano,
      "Tipo de Anomalia": r.tipoAnomalia,
      "Descrição da Ocorrência": r.descricaoOcorrencia,
      "Responsável pela Análise": r.responsavelAnalise,
      "Anexo": r.anexo,
      "Status": r.status
    }));

    exportToExcel(
      dataToExport,
      `Analise_Ticket_X_Telemetria_${new Date().toISOString().split("T")[0]}`,
      "Análise Ticket x Telemetria"
    );
    toast.success("Dados de Ticket X Telemetria exportados com sucesso!");
  };

  const handleResetFilters = () => {
    setSearchPlaca("");
    setFilterStatus("todos");
    setFilterUnidade("todos");
    setFilterAnomalia("todos");
    setFilterResponsavel("todos");
    setFilterDateFrom("");
    setFilterDateTo("");
    setCurrentPage(1);
    toast.info("Filtros limpos!");
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-2xl bg-destructive/5 text-destructive text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h3 className="font-bold text-lg">Erro ao carregar dados</h3>
        <p className="text-sm opacity-80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise Ticket X Telemetria</h1>
          <p className="text-sm text-muted-foreground">
            Auditoria avançada de divergências entre transações e telemetria (localização, motoristas e movimentação)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2 font-bold uppercase text-xs tracking-wider">
            <Download className="h-4 w-4" /> Exportar Planilha
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard
          title="Total Auditorias"
          value={isLoading ? "..." : stats.total}
          icon={<Activity className="h-5 w-5" />}
          colorScheme="primary"
          centered
        />
        <MetricCard
          title="Auditorias Concluídas"
          value={isLoading ? "..." : stats.finalizados}
          icon={<CheckCircle className="h-5 w-5" />}
          colorScheme="success"
          centered
        />
        <MetricCard
          title="Auditorias Pendentes"
          value={isLoading ? "..." : stats.pendentes}
          icon={<Clock className="h-5 w-5" />}
          colorScheme="warning"
          centered
        />
        <MetricCard
          title="Sem Motorista"
          value={isLoading ? "..." : stats.semMotorista}
          icon={<User className="h-5 w-5 text-rose-500" />}
          colorScheme="danger"
          centered
        />
        <MetricCard
          title="Motorista Diferente"
          value={isLoading ? "..." : stats.motoristaDif}
          icon={<ShieldAlert className="h-5 w-5 text-rose-500" />}
          colorScheme="danger"
          centered
        />
        <MetricCard
          title="Veículo em Movimento"
          value={isLoading ? "..." : stats.emMovimento}
          icon={<Activity className="h-5 w-5 text-red-500" />}
          colorScheme="danger"
          centered
        />
        <MetricCard
          title="Divergência Local"
          value={isLoading ? "..." : stats.divEndereco}
          icon={<MapPin className="h-5 w-5 text-red-500" />}
          colorScheme="danger"
          centered
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Frequência de Anomalias (Expanded - Full Width to avoid label overlapping) */}
        <ChartCard title="Frequência de Anomalias" className="col-span-full h-[380px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground font-semibold">Carregando anomalias...</span>
            </div>
          ) : anomalyChartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs italic">
              Nenhuma anomalia a exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anomalyChartData} layout="vertical" margin={{ left: 20, right: 30, top: 15, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={240} 
                  tick={{ fontSize: 10, fontWeight: "bold", fill: "currentColor" }} 
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "white", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(var(--primary))", fontWeight: "bold" }}
                />
                <Bar dataKey="total" fill="hsl(210, 100%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top 10 Unidades Críticas (2 Columns Width) */}
        <ChartCard title="Top 10 Unidades Críticas" className="md:col-span-2 h-[350px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground font-semibold">Carregando unidades...</span>
            </div>
          ) : unitChartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs italic">
              Nenhum dado de unidades a exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitChartData} margin={{ left: 10, right: 10, top: 15, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: "600" }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip
                  contentStyle={{ backgroundColor: "white", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(var(--primary))", fontWeight: "bold" }}
                />
                <Bar dataKey="total" fill="hsl(15, 100%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Resumo Geral por Status (1 Column Width) */}
        <ChartCard title="Resumo Geral por Status" className="col-span-1 h-[350px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground font-semibold">Carregando status...</span>
            </div>
          ) : statusPieData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs italic">
              Nenhum dado por status
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === "Finalizado" ? "#10b981" : "#f59e0b"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Finalizado ({stats.finalizados})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pendente ({stats.pendentes})</span>
                </div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Filter panel */}
      <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4 items-end">
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <Label className="text-xs font-bold">Buscar Placa</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ex: PZH9661"
              value={searchPlaca}
              onChange={(e) => setSearchPlaca(e.target.value.toUpperCase())}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Date Filter (Início) */}
        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <Label className="text-xs font-bold">Data Início</Label>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Date Filter (Fim) */}
        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <Label className="text-xs font-bold">Data Fim</Label>
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <Label className="text-xs font-bold">Status Auditoria</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione o Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="finalizado">Finalizados</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <Label className="text-xs font-bold">Unidade</Label>
          <Select value={filterUnidade} onValueChange={setFilterUnidade}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione a Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Unidades</SelectItem>
              {filterOptions.unidades.map((uni) => (
                <SelectItem key={uni} value={uni}>
                  {uni}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <Label className="text-xs font-bold">Tipo de Anomalia</Label>
          <Select value={filterAnomalia} onValueChange={setFilterAnomalia}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione a Anomalia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="TELEMETRIA SEM MOTORISTA">TELEMETRIA SEM MOTORISTA</SelectItem>
              <SelectItem value="MOTORISTA DIFERENTE">MOTORISTA DIFERENTE</SelectItem>
              <SelectItem value="VEÍCULO EM MOVIMENTO">VEÍCULO EM MOVIMENTO</SelectItem>
              <SelectItem value="DIVERGÊNCIA DE ENDEREÇO">DIVERGÊNCIA DE ENDEREÇO</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <Label className="text-xs font-bold">Responsável Análise</Label>
          <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos os Analistas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Analistas</SelectItem>
              {filterOptions.responsaveis.map((resp) => (
                <SelectItem key={resp} value={resp}>
                  {resp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" onClick={handleResetFilters} className="ml-auto font-bold text-xs h-9">
          Limpar Filtros
        </Button>
      </div>

      {/* Main Table Card */}
      <ChartCard title={`Ocorrências de Auditoria (${filteredRecords.length})`} className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Data Ocorrência</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Placa</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Unidade / Regional</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Veículo</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Tipo de Anomalia</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Responsável</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Anexo</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-xs text-muted-foreground font-semibold">Carregando dados da telemetria...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground italic">
                    Nenhum registro de divergência encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((record, index) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + index;
                    const rowId = `${record.placa}-${globalIndex}`;
                    const isExpanded = !!expandedRows[rowId];
                    const isFinalizado = String(record.status).toLowerCase().includes("finaliz");

                    return (
                      <>
                        <TableRow
                          key={rowId}
                          onClick={() => toggleRow(rowId)}
                          className={cn(
                            "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                            isExpanded ? "bg-slate-50/50 dark:bg-slate-800/30" : "",
                            !isFinalizado ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-emerald-500"
                          )}
                        >
                          <TableCell className="p-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold whitespace-nowrap">
                            {record.dataOcorrencia}
                          </TableCell>
                          <TableCell className="font-bold font-mono tracking-wider">{record.placa}</TableCell>
                          <TableCell className="text-xs font-semibold">{record.unidade}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium text-[11px]">{record.marcaModelo}</span>
                              {record.ano && <span className="text-[10px] text-muted-foreground">Ano: {record.ano}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {record.tipoAnomalia.split("/").map((type, idx) => {
                                const trimType = type.trim();
                                let badgeVar: "destructive" | "secondary" | "outline" | "default" = "destructive";
                                if (trimType.includes("ENDEREÇO")) badgeVar = "secondary";
                                if (trimType.includes("MOVIMENTO")) badgeVar = "default";
                                return (
                                  <Badge key={idx} variant={badgeVar} className="text-[9px] uppercase font-black px-1.5 py-0.5">
                                    {trimType}
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{record.responsavelAnalise || "-"}</TableCell>
                          <TableCell>
                            {record.anexo && record.anexo !== "-" ? (
                              <a
                                href={record.anexo.startsWith("http") ? record.anexo : `https://${record.anexo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-bold"
                              >
                                <FileText className="h-3 w-3" /> Ver <ExternalLink className="h-2 w-2" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[10px] uppercase font-black tracking-wider px-2 py-0.5",
                                isFinalizado
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              )}
                            >
                              {record.status}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        {/* Collapsible Details Panel */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/20 dark:bg-slate-800/10">
                            <TableCell colSpan={9} className="p-4 border-t border-dashed">
                              <div className="grid gap-4 md:grid-cols-3 text-slate-700 dark:text-slate-300 text-xs">
                                <div className="space-y-1.5 md:col-span-2">
                                  <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                                    Descrição da Ocorrência & Log de Telemetria
                                  </h4>
                                  <div className="p-3 bg-white dark:bg-slate-900 border rounded-xl leading-relaxed max-h-[180px] overflow-y-auto whitespace-pre-wrap">
                                    {record.descricaoOcorrencia || "Nenhuma descrição informada na planilha."}
                                  </div>
                                </div>
                                <div className="space-y-3 bg-white dark:bg-slate-900 border p-3.5 rounded-xl">
                                  <div>
                                    <h5 className="font-bold text-[9px] text-slate-400 uppercase tracking-widest">Veículo Auditado</h5>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{record.marcaModelo}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">Placa: {record.placa} • Ano: {record.ano || "N/A"}</p>
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-[9px] text-slate-400 uppercase tracking-widest">Regional e Responsabilidade</h5>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{record.unidade}</p>
                                    <p className="text-[10px] text-muted-foreground">Analista: {record.responsavelAnalise || "Sem analista associado"}</p>
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-[9px] text-slate-400 uppercase tracking-widest">Carimbo e Status</h5>
                                    <div className="flex gap-2 items-center mt-1">
                                      <Badge variant="outline" className="font-mono text-[9px]">{record.dataOcorrencia}</Badge>
                                      <Badge className={isFinalizado ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
                                        {record.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Pagination controls */}
        {filteredRecords.length > itemsPerPage && (
          <div className="p-3 border-t bg-slate-50/50 dark:bg-slate-800/10 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Exibindo {(currentPage - 1) * itemsPerPage + 1} a{" "}
              {Math.min(currentPage * itemsPerPage, filteredRecords.length)} de {filteredRecords.length} ocorrências
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold uppercase"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => c - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold uppercase"
                disabled={currentPage >= Math.ceil(filteredRecords.length / itemsPerPage)}
                onClick={() => setCurrentPage((c) => c + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
