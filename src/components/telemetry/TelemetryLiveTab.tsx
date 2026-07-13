import { useState, useMemo } from "react";
import { 
  Activity, 
  Power, 
  Navigation, 
  Search, 
  RefreshCw, 
  MapPin, 
  User, 
  Calendar, 
  Battery, 
  Gauge, 
  ExternalLink, 
  FileSpreadsheet, 
  AlertCircle, 
  Filter,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Hash
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTelemetryRealtime } from "../../hooks/useTelemetryData";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "../../lib/exportToExcel";
import { toast } from "sonner";

export function TelemetryLiveTab() {
  const { data: rawRealtimeData = [], isLoading, isError, refetch } = useTelemetryRealtime();
  
  // Local state for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [ignitionFilter, setIgnitionFilter] = useState<"all" | "on" | "off">("all");
  const [motionFilter, setMotionFilter] = useState<"all" | "moving" | "stopped">("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [expandedPlaca, setExpandedPlaca] = useState<string | null>(null);

  // Extract unique sectors/units for the select filter
  const sectors = useMemo(() => {
    const list = new Set<string>();
    rawRealtimeData.forEach(item => {
      if (item.Unidade) list.add(item.Unidade);
      if (item.setor) list.add(item.setor);
    });
    return Array.from(list).filter(Boolean).sort();
  }, [rawRealtimeData]);

  // Map and filter raw data
  const filteredData = useMemo(() => {
    return rawRealtimeData.filter((item: any) => {
      // 1. Search filter
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term ||
        (item.Placa || "").toLowerCase().includes(term) ||
        (item.Condutor || "").toLowerCase().includes(term) ||
        (item.modelo || "").toLowerCase().includes(term) ||
        (item.marca || "").toLowerCase().includes(term) ||
        (item.tipo || "").toLowerCase().includes(term) ||
        (item.Unidade || "").toLowerCase().includes(term) ||
        (item.setor || "").toLowerCase().includes(term);

      // 2. Ignition filter
      const isIgnOn = ["LIGADA", "1", 1].includes(item.Ignicao) || String(item.Ignicao) === "1";
      const matchesIgnition = ignitionFilter === "all" ||
        (ignitionFilter === "on" && isIgnOn) ||
        (ignitionFilter === "off" && !isIgnOn);

      // 3. Motion filter
      const isMoving = Number(item.Velocidade || 0) > 0;
      const matchesMotion = motionFilter === "all" ||
        (motionFilter === "moving" && isMoving) ||
        (motionFilter === "stopped" && !isMoving);

      // 4. Sector filter
      const matchesSector = sectorFilter === "all" ||
        item.Unidade === sectorFilter ||
        item.setor === sectorFilter;

      return matchesSearch && matchesIgnition && matchesMotion && matchesSector;
    });
  }, [rawRealtimeData, searchTerm, ignitionFilter, motionFilter, sectorFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = rawRealtimeData.length;
    let motorsOn = 0;
    let moving = 0;
    let lowBattery = 0;
    let alerts = 0;

    rawRealtimeData.forEach((item: any) => {
      const isOn = ["LIGADA", "1", 1].includes(item.Ignicao) || String(item.Ignicao) === "1";
      const speed = Number(item.Velocidade || 0);
      const voltage = Number(item.Tensao || 0);

      if (isOn) motorsOn++;
      if (speed > 0) moving++;
      if (voltage > 0 && voltage < 11.5) lowBattery++;
      if (speed > 80 || (isOn && voltage < 11.5)) alerts++;
    });

    return { total, motorsOn, moving, lowBattery, alerts };
  }, [rawRealtimeData]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      toast.error("Nenhum dado filtrado para exportar!");
      return;
    }

    const dataToExport = filteredData.map((item: any) => ({
      "Placa": item.Placa,
      "Marca/Modelo": `${item.marca || ""} ${item.modelo || ""}`.trim() || "-",
      "Ano": item.ano || "-",
      "Tipo de Ativo": item.tipo || "-",
      "Condutor": item.Condutor || "N/A",
      "Matrícula": item.matricula || "-",
      "E-mail": item.email || "-",
      "Unidade/Cliente": item.Unidade || "-",
      "Setor": item.setor || "-",
      "Última Transmissão": item["Data/Hora"] || "-",
      "Ignição": (["LIGADA", "1", 1].includes(item.Ignicao) || String(item.Ignicao) === "1") ? "LIGADA" : "DESLIGADA",
      "Velocidade (km/h)": item.Velocidade,
      "Odômetro (km)": item.Odometro,
      "Tensão (V)": item.Tensao,
      "Latitude": item.latitude,
      "Longitude": item.longitude
    }));

    exportToExcel(dataToExport, `Transmissoes_Live_Telemetria_${new Date().toISOString().split("T")[0]}`, "Transmissões");
    toast.success("Excel gerado com sucesso!");
  };

  const toggleExpandRow = (placa: string) => {
    if (expandedPlaca === placa) {
      setExpandedPlaca(null);
    } else {
      setExpandedPlaca(placa);
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Header card indicating live API connection */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-2xl translate-y-12 -translate-x-12 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black uppercase text-[8px] tracking-widest px-2.5 py-0.5">
                API Live Ativa
              </Badge>
              <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-black uppercase text-[8px] tracking-widest px-2.5 py-0.5">
                AutoVision Integration
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Cpu className="text-indigo-400 animate-pulse" size={24} />
              Transmissões em Tempo Real
            </h2>
            <p className="text-xs text-indigo-200/80 font-semibold uppercase tracking-tight max-w-2xl leading-relaxed">
              Consumo direto do barramento de telemetria COMPESA. Últimas posições, telemetria analítica de ignição, velocidade, odômetro acumulado e tensão de bateria.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              onClick={refetch}
              disabled={isLoading}
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl h-11 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw size={14} className={`${isLoading ? "animate-spin text-emerald-400" : "text-white"}`} />
              <span>{isLoading ? "Sincronizando..." : "Sincronizar"}</span>
            </Button>
            <Button
              onClick={handleExport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/10 border border-indigo-500/30 w-full md:w-auto"
            >
              <FileSpreadsheet size={14} />
              <span>Exportar XLSX</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Tracked Card */}
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Veículos Ativos</p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none mt-1 font-mono">
                {isLoading ? "..." : stats.total}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Motors On Card */}
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Power size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ignição Ligada</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none mt-1 font-mono">
                {isLoading ? "..." : stats.motorsOn}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* In Movement Card */}
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Navigation size={20} className="animate-bounce" style={{ animationDuration: "3s" }} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Em Deslocamento</p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none mt-1 font-mono">
                {isLoading ? "..." : stats.moving}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Low Battery Card */}
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl text-rose-600 dark:text-rose-400">
              <Battery size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tensão Crítica (&lt;11.5V)</p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none mt-1 font-mono">
                {isLoading ? "..." : stats.lowBattery}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Card */}
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-amber-600 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alertas Operacionais</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none mt-1 font-mono">
                {isLoading ? "..." : stats.alerts}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Filter size={14} className="text-slate-400" />
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtros e Consultas Diretas</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar placa, condutor, modelo, setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 text-[11px] font-bold uppercase bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl placeholder:text-slate-400"
              />
            </div>

            {/* Ignition Filter */}
            <div>
              <Select value={ignitionFilter} onValueChange={(v: any) => setIgnitionFilter(v)}>
                <SelectTrigger className="h-11 text-[10px] font-black uppercase bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <SelectValue placeholder="Status Ignição" />
                </SelectTrigger>
                <SelectContent className="border border-slate-100 dark:border-slate-800 rounded-xl">
                  <SelectItem value="all" className="text-[10px] font-black uppercase">TODAS AS IGNIÇÕES</SelectItem>
                  <SelectItem value="on" className="text-[10px] font-black uppercase text-emerald-600">IG. LIGADA (MOTOR OPERANDO)</SelectItem>
                  <SelectItem value="off" className="text-[10px] font-black uppercase text-slate-400">IG. DESLIGADA (PARADO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Motion Filter */}
            <div>
              <Select value={motionFilter} onValueChange={(v: any) => setMotionFilter(v)}>
                <SelectTrigger className="h-11 text-[10px] font-black uppercase bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <SelectValue placeholder="Estado de Movimento" />
                </SelectTrigger>
                <SelectContent className="border border-slate-100 dark:border-slate-800 rounded-xl">
                  <SelectItem value="all" className="text-[10px] font-black uppercase">TODOS OS ESTADOS</SelectItem>
                  <SelectItem value="moving" className="text-[10px] font-black uppercase text-indigo-600">EM MOVIMENTO (&gt;0 km/h)</SelectItem>
                  <SelectItem value="stopped" className="text-[10px] font-black uppercase text-slate-400">PARADO (0 km/h)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sector / Unit Filter */}
            <div>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="h-11 text-[10px] font-black uppercase bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <SelectValue placeholder="Unidade / Regional" />
                </SelectTrigger>
                <SelectContent className="border border-slate-100 dark:border-slate-800 rounded-xl max-h-[250px]">
                  <SelectItem value="all" className="text-[10px] font-black uppercase">TODAS AS UNIDADES</SelectItem>
                  {sectors.map((sect, idx) => (
                    <SelectItem key={idx} value={sect} className="text-[10px] font-black uppercase">
                      {sect}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Grid of Realtime Transmissions */}
      <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/40 dark:bg-slate-800/5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold font-mono px-2 py-0.5 border-slate-200 text-[10px]">
                {filteredData.length} registros
              </Badge>
              {searchTerm || ignitionFilter !== "all" || motionFilter !== "all" || sectorFilter !== "all" ? (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setIgnitionFilter("all");
                    setMotionFilter("all");
                    setSectorFilter("all");
                  }}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-bold uppercase tracking-tight"
                >
                  Limpar Filtros
                </button>
              ) : null}
            </div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Clique em uma linha para ver detalhes e dados brutos
            </p>
          </div>

          <ScrollArea className="h-[600px] w-full overflow-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-24 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-xs font-black uppercase text-slate-400 tracking-widest animate-pulse">Sincronizando com Barramento de Telemetria...</p>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
                <AlertCircle className="text-rose-500 animate-bounce" size={48} />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Erro de Sincronização</h4>
                  <p className="text-xs text-slate-400 mt-1">Não foi possível recuperar dados da API AutoVision.</p>
                </div>
                <Button onClick={refetch} className="bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-wider text-[10px] rounded-xl px-4 py-2">
                  Tentar Novamente
                </Button>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
                <Search className="text-slate-300 dark:text-slate-700" size={48} />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Nenhum Veículo Localizado</h4>
                  <p className="text-xs text-slate-400 mt-1">Não existem resultados compatíveis com os filtros de busca aplicados.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-100 dark:border-slate-850">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5 pl-6">Ativo / Identificação</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5">Unidade / Setor</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5">Última Transmissão</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5 text-center">Ignição</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5 text-center">Velocidade</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5 text-right">Odômetro</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5 text-center">Bateria</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-500 py-3.5 text-center pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item: any, idx: number) => {
                    const isIgnOn = ["LIGADA", "1", 1].includes(item.Ignicao) || String(item.Ignicao) === "1";
                    const isMoving = Number(item.Velocidade || 0) > 0;
                    const isLowBattery = Number(item.Tensao || 0) > 0 && Number(item.Tensao || 0) < 11.5;
                    const isExpanded = expandedPlaca === item.Placa;

                    return (
                      <>
                        <TableRow 
                          key={idx} 
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/20 cursor-pointer border-b border-slate-50 dark:border-slate-850/50 transition-all ${isExpanded ? "bg-indigo-50/10 dark:bg-indigo-950/5" : ""}`}
                          onClick={() => toggleExpandRow(item.Placa)}
                        >
                          {/* Placa + Vehicle description */}
                          <TableCell className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl border ${isIgnOn ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400" : "bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700/50"}`}>
                                <Navigation size={16} className={`${isMoving ? "animate-pulse" : ""}`} style={{ transform: `rotate(${isMoving ? '45deg' : '0deg'})` }} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-xs uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-xs">
                                    {item.Placa}
                                  </span>
                                  {item.tipo && (
                                    <Badge variant="outline" className="text-[7.5px] font-black uppercase tracking-wide bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-slate-200 dark:border-slate-700">
                                      {item.tipo}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-none">
                                  {item.marca && item.modelo ? `${item.marca} ${item.modelo}` : "Veículo COMPESA"}
                                  {item.ano ? ` (${item.ano})` : ""}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Unit / Sector */}
                          <TableCell className="py-4">
                            <p className="text-[10.5px] font-black text-slate-700 dark:text-slate-200 uppercase leading-snug">{item.Unidade || "COMPESA"}</p>
                            {item.setor && <p className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">{item.setor}</p>}
                          </TableCell>

                          {/* Last Transmission Date */}
                          <TableCell className="py-4 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-slate-400" />
                              <span>{item["Data/Hora"]}</span>
                            </div>
                          </TableCell>

                          {/* Ignition Badge */}
                          <TableCell className="py-4 text-center">
                            <div className="flex justify-center">
                              {isIgnOn ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <Power size={10} className="text-emerald-500" />
                                  <span>Ligada</span>
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <Power size={10} />
                                  <span>Desligada</span>
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Speed Badge */}
                          <TableCell className="py-4 text-center">
                            <div className="flex justify-center">
                              {isMoving ? (
                                <Badge className={`text-[9px] font-black font-mono tracking-wider ${Number(item.Velocidade) > 80 ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"}`}>
                                  <Gauge size={10} className="mr-1 inline-block" />
                                  {item.Velocidade} km/h
                                </Badge>
                              ) : (
                                <span className="font-mono text-[10px] font-black text-slate-300 dark:text-slate-700">0 km/h</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Odometer */}
                          <TableCell className="py-4 text-right font-mono text-[11px] font-black text-slate-700 dark:text-slate-300">
                            {item.Odometro !== "-" ? `${Number(item.Odometro).toLocaleString("pt-BR")} km` : "-"}
                          </TableCell>

                          {/* Battery Voltage */}
                          <TableCell className="py-4 text-center">
                            <div className="flex justify-center items-center gap-1 font-mono text-[10px] font-bold">
                              <Battery size={12} className={isLowBattery ? "text-rose-500 animate-pulse" : "text-slate-400"} />
                              <span className={isLowBattery ? "text-rose-600 dark:text-rose-400 font-black animate-pulse" : "text-slate-600 dark:text-slate-400"}>
                                {item.Tensao ? `${item.Tensao} V` : "-"}
                              </span>
                            </div>
                          </TableCell>

                          {/* Action Link to External Map */}
                          <TableCell className="py-4 text-center pr-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              {item.latitude && item.longitude ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-500 hover:text-indigo-600 rounded-lg"
                                  title="Ver no Google Maps"
                                  onClick={() => {
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`, "_blank");
                                  }}
                                >
                                  <MapPin size={14} />
                                </Button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Collapsible details row */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <TableRow className="bg-slate-50/30 dark:bg-slate-850/10 border-b border-slate-100 dark:border-slate-850">
                              <TableCell colSpan={8} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-slate-800 dark:text-slate-100 pl-16">
                                    {/* Left: Driver / Operator Info */}
                                    <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
                                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <User size={14} className="text-indigo-500" />
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Operador Vinculado</h4>
                                      </div>
                                      <div className="space-y-1.5">
                                        <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">
                                          {item.Condutor && item.Condutor !== "N/A" ? item.Condutor : "Nenhum condutor identificado"}
                                        </p>
                                        {item.matricula && (
                                          <p className="text-[10px] font-bold text-slate-500 uppercase">
                                            Matrícula: <span className="font-mono">{item.matricula}</span>
                                          </p>
                                        )}
                                        {item.email && (
                                          <p className="text-[10px] font-bold text-slate-500 lowercase">
                                            E-mail: <span>{item.email}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Middle: Asset Specs */}
                                    <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
                                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <Cpu size={14} className="text-indigo-500" />
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Especificações do Ativo</h4>
                                      </div>
                                      <div className="space-y-1.5 grid grid-cols-2 gap-x-2 text-[10px]">
                                        <div>
                                          <p className="font-bold text-slate-400 uppercase">Marca / Modelo</p>
                                          <p className="font-black text-slate-700 dark:text-slate-200 uppercase">{item.marca || "-"} / {item.modelo || "-"}</p>
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-400 uppercase">Ano Fabricação</p>
                                          <p className="font-black text-slate-700 dark:text-slate-200 font-mono">{item.ano || "-"}</p>
                                        </div>
                                        <div className="mt-2">
                                          <p className="font-bold text-slate-400 uppercase">Tipo</p>
                                          <p className="font-black text-slate-700 dark:text-slate-200 uppercase">{item.tipo || "-"}</p>
                                        </div>
                                        <div className="mt-2">
                                          <p className="font-bold text-slate-400 uppercase">Setor</p>
                                          <p className="font-black text-slate-700 dark:text-slate-200 uppercase">{item.setor || "-"}</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: GPS / Geolocation and RAW JSON */}
                                    <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
                                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <MapPin size={14} className="text-indigo-500" />
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Coordenadas e Satélite</h4>
                                      </div>
                                      <div className="space-y-1.5 text-[10px]">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg font-mono">
                                          <span className="text-slate-400 font-bold">LAT: {item.latitude || "-"}</span>
                                          <span className="text-slate-400 font-bold">LNG: {item.longitude || "-"}</span>
                                        </div>
                                        {item.latitude && item.longitude && (
                                          <Button
                                            size="sm"
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-wider h-8 flex items-center gap-1 justify-center mt-2"
                                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`, "_blank")}
                                          >
                                            <ExternalLink size={10} />
                                            <span>Abrir no Google Maps Satélite</span>
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
