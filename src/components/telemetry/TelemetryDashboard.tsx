import { MetricCard } from "../dashboard/MetricCard";
import { ChartCard } from "../dashboard/ChartCard";
import { Navigation, Power, Navigation2, Search, Download, FileText, Activity, AlertTriangle, PieChart as PieIcon, BarChart3, ShieldAlert, Check, ChevronsUpDown, X, Users, Trophy } from "lucide-react";
import { exportToExcel } from "../../lib/exportToExcel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { TelemetryRealtimeData, NotificacaoTelemetriaData, Asset } from "../../types";
import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { TelemetryFilterBar } from "./TelemetryFilterBar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { auth } from "@/lib/firebase";
import { TelemetryWorkshopMap } from "./TelemetryWorkshopMap";
import { fetchTelemetryRealtime, fetchNotificacoes, fetchTelemetryHistory, fetchFleetData } from "../../services/fleetService";
import { useTelemetryRealtime, useNotificacoes, useTelemetryHistory } from "../../hooks/useTelemetryData";
import { useAssets } from "../../hooks/useFleetData";
import { useMachineOperators } from "../../hooks/useMachineOperators";
import { useContactsData } from "../../hooks/useContactsData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, HardHat, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { DriversRelation } from "./DriversRelation";
import RankingView from "./RankingView";
import { TelemetryLiveTab } from "./TelemetryLiveTab";

export default function TelemetryDashboard() {
  const [activeTab, setActiveTab] = useState<"notifications" | "drivers" | "performance" | "live">("notifications");
  const [timelineView, setTimelineView] = useState<"severity" | "type">("severity");
  
  const { data: realtimeData = [], isLoading: loadingRT, isError: isErrorRT, error: errorRT, refetch: refetchRT } = useTelemetryRealtime();
  const { data: notificacoes = [], isLoading: loadingNtf, isError: isErrorNtf, error: errorNtf, refetch: refetchNtf } = useNotificacoes();
  const { data: telemetryHistory = [], isLoading: loadingHist, isError: isErrorHist, error: errorHist, refetch: refetchHist } = useTelemetryHistory();
  const { data: assets = [], isLoading: loadingAssets, isError: isErrorAssets, error: errorAssets, refetch: refetchAssets } = useAssets();

  const loading = loadingRT || loadingNtf || loadingHist || loadingAssets;
  const isError = isErrorRT || isErrorNtf || isErrorHist || isErrorAssets;

  useEffect(() => {
    if (isErrorRT) console.error("Telemetry Realtime Query Error:", errorRT);
    if (isErrorNtf) console.error("Notificacoes Query Error:", errorNtf);
    if (isErrorHist) console.error("Telemetry History Query Error:", errorHist);
    if (isErrorAssets) console.error("Assets Query Error:", errorAssets);
  }, [isErrorRT, isErrorNtf, isErrorHist, isErrorAssets, errorRT, errorNtf, errorHist, errorAssets]);

  const refetchAll = () => {
    refetchRT();
    refetchNtf();
    refetchHist();
    refetchAssets();
  };

  // Filtros
  const [searchPlaca, setSearchPlaca] = useState("");
  const [debouncedSearchPlaca, setDebouncedSearchPlaca] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [groupingMode, setGroupingMode] = useState<"flat" | "type" | "severity">("flat");
  const itemsPerPage = 30;

  // Real data for Machine Operators
  const { data: operators = [], isLoading: loadingOperators } = useMachineOperators();
  const { getEmailsByGerencia } = useContactsData();
  const [operatorSearch, setOperatorSearch] = useState("");
  const [operatorStatusFilter, setOperatorStatusFilter] = useState<"all" | "pendente" | "regular">("all");

  const filteredOperators = useMemo(() => {
    return operators.filter(o => {
      const isPendente = !o.curso || String(o.curso).trim() === "" || String(o.curso).trim().toUpperCase() === "N/A" || String(o.curso).trim() === "-";
      const matchesStatus = operatorStatusFilter === "all" ||
        (operatorStatusFilter === "pendente" && isPendente) ||
        (operatorStatusFilter === "regular" && !isPendente);
      
      const term = operatorSearch.toLowerCase();
      const matchesSearch = !term ||
        o.nome.toLowerCase().includes(term) ||
        o.gerencia.toLowerCase().includes(term) ||
        o.maquina.toLowerCase().includes(term) ||
        o.matricula.toLowerCase().includes(term);
      
      return matchesStatus && matchesSearch;
    });
  }, [operators, operatorSearch, operatorStatusFilter]);

  const operatorStats = useMemo(() => {
    const total = operators.length;
    const pendentes = operators.filter(o => !o.curso || String(o.curso).trim() === "" || String(o.curso).trim().toUpperCase() === "N/A" || String(o.curso).trim() === "-").length;
    const regulares = total - pendentes;
    return { total, pendentes, regulares };
  }, [operators]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchPlaca(searchPlaca);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchPlaca]);

  const [realtimeFilter, setRealtimeFilter] = useState<"all" | "ligados" | "deslocamento" | "bateria" | "falha">("all");
  const [selectedUnidades, setSelectedUnidades] = useState<string[]>([]);
  const [showOnlyNearby, setShowOnlyNearby] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchPlaca, realtimeFilter]);

  // Estados para filtros de notificações
  const [selectedDiretorias, setSelectedDiretorias] = useState<string[]>([]);
  const [selectedGerencias, setSelectedGerencias] = useState<string[]>([]);
  const [selectedGravidades, setSelectedGravidades] = useState<string[]>([]);
  const [selectedSituacoes, setSelectedSituacoes] = useState<string[]>([]);
  const [selectedTiposNotificacao, setSelectedTiposNotificacao] = useState<string[]>([]);
  const [selectedMeses, setSelectedMeses] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState("");

  // Removido useEffect manual em favor do react-query

  const COLORS = ["#2563eb", "#059669", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563"];

  const todayStr = useMemo(() => format(new Date(), "dd/MM/yyyy"), []);

  const getMesAno = (dateStr: string) => {
    if (!dateStr || dateStr === "N/A") return "";
    try {
      const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split(' ')[0].split('-');
      if (parts.length < 3) return "";
      
      let mes, ano;
      if (dateStr.includes('/')) {
        mes = parseInt(parts[1]);
        ano = parts[2].substring(parts[2].length - 2); 
      } else {
        mes = parseInt(parts[1]);
        ano = parts[0].substring(parts[0].length - 2);
      }
      
      const mesesLabels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      const mesNome = mesesLabels[mes - 1];
      if (mesNome) return `${mesNome}/${ano}`;
      return "";
    } catch {
      return "";
    }
  };

  const diretorias = useMemo(() => Array.from(new Set(notificacoes.map(n => String(n._diretoria || n.DIRETORIA || "Geral").trim()).filter(Boolean))).sort(), [notificacoes]);
  const gerencias = useMemo(() => Array.from(new Set(notificacoes.map(n => String(n._gerencia || n["GERÊNCIA"] || n.GERENCIA || "Geral").trim()).filter(Boolean))).sort(), [notificacoes]);
  const gravidades = useMemo(() => Array.from(new Set(notificacoes.map(n => String(n._gravidade || n.GRAVIDADE || "Média").trim()).filter(Boolean))).sort(), [notificacoes]);
  const situacoes = useMemo(() => Array.from(new Set(notificacoes.map(n => String(n._situacao || n["SITUAÇÃO"] || n.SITUACAO || "Pendente").trim()).filter(Boolean))).sort(), [notificacoes]);
  const tiposNotificacao = useMemo(() => Array.from(new Set(notificacoes.map(n => String(n._tipo || n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || "Evento").trim()).filter(Boolean))).sort(), [notificacoes]);
  const condutoresList = useMemo(() => Array.from(new Set(notificacoes.map(n => String(n._condutor || n.CONDUTOR || "").trim()).filter(Boolean))).sort(), [notificacoes]);
  
  const meses = useMemo(() => {
    const set = new Set<string>();
    notificacoes.forEach(n => {
      const dataStr = String(n._data || n.DATA || "").trim();
      const ma = getMesAno(dataStr);
      if (ma) set.add(ma);
    });
    return Array.from(set).sort((a, b) => {
      const [mA, yA] = a.split('/');
      const [mB, yB] = b.split('/');
      if (yA !== yB) return yA.localeCompare(yB);
      const mesesOrdem: any = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
      return (mesesOrdem[mA] || 0) - (mesesOrdem[mB] || 0);
    });
  }, [notificacoes]);

  const filteredNotificacoes = useMemo(() => {
    const searchLow = debouncedSearchPlaca.toLowerCase().trim();
    const driverSearchLow = driverSearch.toLowerCase().trim();
    const hasSelectedMeses = selectedMeses.length > 0;
    const hasSelectedDiretorias = selectedDiretorias.length > 0;
    const hasSelectedGerencias = selectedGerencias.length > 0;
    const hasSelectedGravidades = selectedGravidades.length > 0;
    const hasSelectedSituacoes = selectedSituacoes.length > 0;
    const hasSelectedTipos = selectedTiposNotificacao.length > 0;

    return notificacoes.filter(n => {
      const placa = String(n._placa || n.PLACA || "").toLowerCase();
      if (searchLow && !placa.includes(searchLow)) return false;

      const condutor = String(n._condutor || n.CONDUTOR || "").toLowerCase();
      if (driverSearchLow && !condutor.includes(driverSearchLow)) return false;

      const dataStr = String(n._data || n.DATA || "").trim();
      const ma = getMesAno(dataStr);

      const d = String(n._diretoria || n.DIRETORIA || "Geral").trim();
      const g = String(n._gerencia || n["GERÊNCIA"] || n.GERENCIA || "Geral").trim();
      const gr = String(n._gravidade || n.GRAVIDADE || "Média").trim();
      const s = String(n._situacao || n["SITUAÇÃO"] || n.SITUACAO || "Pendente").trim();
      const t = String(n._tipo || n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || "Evento").trim();

      if (hasSelectedMeses && (!ma || !selectedMeses.includes(ma))) return false;
      if (hasSelectedDiretorias && !selectedDiretorias.includes(d)) return false;
      if (hasSelectedGerencias && !selectedGerencias.includes(g)) return false;
      if (hasSelectedGravidades && !selectedGravidades.includes(gr)) return false;
      if (hasSelectedSituacoes && !selectedSituacoes.includes(s)) return false;
      if (hasSelectedTipos && !selectedTiposNotificacao.includes(t)) return false;
      return true;
    });
  }, [notificacoes, selectedDiretorias, selectedGerencias, selectedGravidades, selectedSituacoes, selectedTiposNotificacao, selectedMeses, debouncedSearchPlaca, driverSearch]);

  // Insights de Notificações
  const topGerencias = useMemo(() => {
    const counts = filteredNotificacoes.reduce((acc, n) => {
      const g = String(n._gerencia || n["GERÊNCIA"] || n.GERENCIA || n.COL_1 || "N/A");
      if (g !== "N/A" && g !== "") acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => (b.value as number) - (a.value as number)).slice(0, 10);
  }, [filteredNotificacoes]);

  const topCondutores = useMemo(() => {
    const counts = filteredNotificacoes.reduce((acc, n) => {
      const c = String(n._condutor || n.CONDUTOR || n.COL_7 || "N/A");
      if (c !== "N/A" && c !== "") acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([nome, quantidade]) => ({ nome, quantidade })).sort((a,b) => (b.quantidade as number) - (a.quantidade as number)).slice(0, 10);
  }, [filteredNotificacoes]);

  const tiposNotificacaoChart = useMemo(() => {
    const counts = filteredNotificacoes.reduce((acc, n) => {
      const t = String(n._tipo || n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || n.COL_2 || "N/A");
      if (t !== "N/A" && t !== "") acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => (b.value as number) - (a.value as number));
  }, [filteredNotificacoes]);

  const timelineChartData = useMemo(() => {
    const dataByMonth: Record<string, any> = {};
    const topTiposData = tiposNotificacao.slice(0, 5);
    
    filteredNotificacoes.forEach(n => {
      const dataStr = String(n._data || n.DATA || n.COL_3 || "").trim();
      const ma = getMesAno(dataStr);
      if (!ma) return;
      
      if (!dataByMonth[ma]) {
        dataByMonth[ma] = { mesAno: ma, total: 0 };
        // Inicializar gravidades
        gravidades.forEach(g => { dataByMonth[ma][g] = 0; });
        // Inicializar tipos principais
        topTiposData.forEach(t => { dataByMonth[ma][t] = 0; });
      }
      
      dataByMonth[ma].total += 1;
      
      const grav = String(n._gravidade || n.GRAVIDADE || n.COL_9 || "").trim();
      if (grav) dataByMonth[ma][grav] = (dataByMonth[ma][grav] || 0) + 1;
      
      const tipo = String(n._tipo || n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || n.COL_2 || "").trim();
      if (topTiposData.includes(tipo)) {
        dataByMonth[ma][tipo] = (dataByMonth[ma][tipo] || 0) + 1;
      }
    });

    return Object.values(dataByMonth).sort((a: any, b: any) => {
      const mesesOrdem: { [key: string]: number } = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      const [mesA, anoA] = a.mesAno.split('/');
      const [mesB, anoB] = b.mesAno.split('/');
      if (anoA !== anoB) return anoA.localeCompare(anoB);
      return (mesesOrdem[mesA] || 0) - (mesesOrdem[mesB] || 0);
    });
  }, [filteredNotificacoes, gravidades, tiposNotificacao]);

  // Grouping logic
  const groupedNotificacoes = useMemo(() => {
    if (groupingMode === "flat") return [];
    
    const groups: Record<string, any[]> = {};
    filteredNotificacoes.forEach(n => {
      let key = "Outros";
      if (groupingMode === "type") {
        key = String(n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || "Não Especificado");
      } else if (groupingMode === "severity") {
        key = String(n.GRAVIDADE || "NÃO INFORMADA");
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredNotificacoes, groupingMode]);

  // Real-time metrics and derived data
  const veiculosMonitorados = realtimeData.length;
  const veiculosLigados = realtimeData.filter(v => ["LIGADA", "1", 1].includes(String(v.Ignicao || "").toUpperCase()) || v.Ignicao === 1).length;
  const veiculosEmMovimento = realtimeData.filter(v => Number(v.Velocidade || 0) > 0).length;
  const bateriaBaixa = realtimeData.filter(v => (v.Tensao === 0)).length;
  const falhaTransmissao = realtimeData.filter(v => {
    const dataHora = String(v["Data/Hora"] || "").trim();
    // Se a data/hora não começa com a data de hoje formatada, é falha
    return dataHora && !dataHora.startsWith(todayStr);
  }).length;

  const filteredRealtimeData = useMemo(() => {
    return realtimeData.filter(v => {
      // Filtro por Placa
      if (debouncedSearchPlaca && !String(v.Placa || "").toLowerCase().includes(debouncedSearchPlaca.toLowerCase())) {
        return false;
      }

      if (realtimeFilter === "ligados") return ["LIGADA", "1", 1].includes(String(v.Ignicao || "").toUpperCase()) || v.Ignicao === 1;
      if (realtimeFilter === "deslocamento") return Number(v.Velocidade || 0) > 0;
      if (realtimeFilter === "bateria") return v.Tensao === 0;
      if (realtimeFilter === "falha") {
        const dataHora = String(v["Data/Hora"] || "").trim();
        return dataHora && !dataHora.startsWith(todayStr);
      }
      return true;
    });
  }, [realtimeData, realtimeFilter, todayStr, debouncedSearchPlaca]);

  const allPlates = useMemo(() => {
    return Array.from(new Set(realtimeData.map(v => v.Placa).filter(Boolean))).sort();
  }, [realtimeData]);

  const paginatedRealtimeData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRealtimeData.slice(start, start + itemsPerPage);
  }, [filteredRealtimeData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRealtimeData.length / itemsPerPage);

  const handleExportRealtime = () => {
    const dataToExport = filteredRealtimeData.map(v => ({
      "Data/Hora": v["Data/Hora"],
      "Placa": v.Placa,
      "Unidade": v.Unidade,
      "Velocidade": v.Velocidade,
      "Odometro": v.Odometro,
      "Ignicao": v.Ignicao,
      "Antifurto": v.Antifurto,
      "Condutor": v.Condutor,
      "Tensao": v.Tensao
    }));
    exportToExcel(dataToExport, "Telemetria_Tempo_Real", "Tempo Real");
  };

  if (loading) {
     return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sincronizando Satélites...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-12 overflow-y-auto">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200/50 shrink-0">
          <AlertTriangle size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Erro de Conexão</h2>
          <p className="text-slate-500 max-w-md mx-auto font-medium">Ops! Não conseguimos conectar com os servidores de telemetria da Compesa. Isso pode ser um problema temporário na rede ou no servidor.</p>
        </div>
        
        {/* Diagnostic details */}
        <div className="max-w-xl w-full bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left space-y-2">
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Informações de Diagnóstico:</p>
          {isErrorRT && (
            <div className="text-xs">
              <span className="font-bold text-rose-600">Tempo Real:</span> <code className="font-mono bg-rose-50 dark:bg-rose-950/20 p-1 rounded">{errorRT instanceof Error ? errorRT.message : String(errorRT)}</code>
            </div>
          )}
          {isErrorNtf && (
            <div className="text-xs">
              <span className="font-bold text-rose-600">Notificações:</span> <code className="font-mono bg-rose-50 dark:bg-rose-950/20 p-1 rounded">{errorNtf instanceof Error ? errorNtf.message : String(errorNtf)}</code>
            </div>
          )}
          {isErrorHist && (
            <div className="text-xs">
              <span className="font-bold text-rose-600">Histórico/Deslocamento:</span> <code className="font-mono bg-rose-50 dark:bg-rose-950/20 p-1 rounded">{errorHist instanceof Error ? errorHist.message : String(errorHist)}</code>
            </div>
          )}
          {isErrorAssets && (
            <div className="text-xs">
              <span className="font-bold text-rose-600">Ativos da Frota:</span> <code className="font-mono bg-rose-50 dark:bg-rose-950/20 p-1 rounded">{errorAssets instanceof Error ? errorAssets.message : String(errorAssets)}</code>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl border-2 font-black uppercase tracking-widest text-xs h-12 px-8">
            Recarregar App
          </Button>
          <Button onClick={() => refetchAll()} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs h-12 px-8 shadow-xl shadow-slate-200 dark:shadow-none">
            Tentar Sincronizar
          </Button>
        </div>
      </div>
    );
  }

  const exportToPDF = () => {
    if (filteredNotificacoes.length === 0) {
      toast.error("Nenhuma notificação filtrada para exportar!");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const now = new Date();
    const formattedDate = now.toLocaleString("pt-BR");

    // Header principal
    doc.setFillColor(30, 64, 175); // Azul Royal / Compesa
    doc.rect(0, 0, 210, 15, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("COMPESA - GESTÃO DE FROTA E TELEMETRIA", 14, 10);

    // Título do Relatório
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text("Relatório Circunstanciado de Notificações - Resumo Executivo", 14, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${formattedDate} por ${auth?.currentUser?.email || "Usuário"}`, 14, 31);

    // Filtros Aplicados
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85);
    doc.text("Filtros Ativos", 14, 40);

    // Linha divisória
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    // Detalhamento dos filtros
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    const fPlaca = debouncedSearchPlaca ? debouncedSearchPlaca.toUpperCase() : "TODAS";
    const fCondutor = driverSearch ? driverSearch.toUpperCase() : "TODOS";
    const fDiretoria = selectedDiretorias.length ? selectedDiretorias.join(", ") : "TODAS";
    const fGerencia = selectedGerencias.length ? selectedGerencias.join(", ") : "TODAS";
    const fGravidade = selectedGravidades.length ? selectedGravidades.join(", ") : "TODAS";
    const fSituacao = selectedSituacoes.length ? selectedSituacoes.join(", ") : "TODAS";
    const fTipo = selectedTiposNotificacao.length ? selectedTiposNotificacao.join(", ") : "TODOS";
    const fMeses = selectedMeses.length ? selectedMeses.join(", ") : "TODOS";

    // Layout de 2 colunas para os filtros
    doc.setFont("helvetica", "bold");
    doc.text("Placa Pesquisada:", 14, 47);
    doc.setFont("helvetica", "normal");
    doc.text(fPlaca, 45, 47);

    doc.setFont("helvetica", "bold");
    doc.text("Condutor Pesquisado:", 14, 52);
    doc.setFont("helvetica", "normal");
    doc.text(fCondutor, 45, 52);

    doc.setFont("helvetica", "bold");
    doc.text("Diretorias:", 14, 57);
    doc.setFont("helvetica", "normal");
    doc.text(fDiretoria.length > 70 ? fDiretoria.substring(0, 67) + "..." : fDiretoria, 45, 57);

    doc.setFont("helvetica", "bold");
    doc.text("Gerências:", 14, 62);
    doc.setFont("helvetica", "normal");
    doc.text(fGerencia.length > 70 ? fGerencia.substring(0, 67) + "..." : fGerencia, 45, 62);

    // Coluna 2 dos filtros (x = 110)
    doc.setFont("helvetica", "bold");
    doc.text("Série Temporal / Meses:", 110, 47);
    doc.setFont("helvetica", "normal");
    doc.text(fMeses.length > 40 ? fMeses.substring(0, 37) + "..." : fMeses, 148, 47);

    doc.setFont("helvetica", "bold");
    doc.text("Tipos Notificação:", 110, 52);
    doc.setFont("helvetica", "normal");
    doc.text(fTipo.length > 40 ? fTipo.substring(0, 37) + "..." : fTipo, 148, 52);

    doc.setFont("helvetica", "bold");
    doc.text("Situações:", 110, 57);
    doc.setFont("helvetica", "normal");
    doc.text(fSituacao, 148, 57);

    doc.setFont("helvetica", "bold");
    doc.text("Gravidades:", 110, 62);
    doc.setFont("helvetica", "normal");
    doc.text(fGravidade, 148, 62);

    // Caixa de Indicadores Gerais
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 68, 182, 18, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, 68, 182, 18, "S");

    const totalCount = filteredNotificacoes.length;
    const altaCount = filteredNotificacoes.filter(n => {
      const g = String(n._gravidade || n.GRAVIDADE || "").toUpperCase();
      return g.includes("ALTA");
    }).length;
    const mediaCount = filteredNotificacoes.filter(n => {
      const g = String(n._gravidade || n.GRAVIDADE || "").toUpperCase();
      return g.includes("MED") || g.includes("MÉD");
    }).length;
    const baixaCount = totalCount - altaCount - mediaCount;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("TOTAL DE OCORRÊNCIAS", 18, 74);
    doc.text("GRAVIDADE ALTA (CRÍTICA)", 65, 74);
    doc.text("GRAVIDADE MÉDIA", 112, 74);
    doc.text("GRAVIDADE BAIXA", 158, 74);

    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(String(totalCount), 18, 81);
    doc.setTextColor(220, 38, 38);
    doc.text(String(altaCount), 65, 81);
    doc.setTextColor(217, 119, 6);
    doc.text(String(mediaCount), 112, 81);
    doc.setTextColor(75, 85, 99);
    doc.text(String(baixaCount), 158, 81);

    // Notificações por Tipo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text("Distribuição por Tipo de Notificação", 14, 94);

    const tipoTableRows = tiposNotificacaoChart.slice(0, 10).map(item => {
      const val = item.value as number;
      const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : "0.0";
      return [item.name || "N/A", String(val), `${pct}%`];
    });

    autoTable(doc, {
      startY: 97,
      head: [["Tipo de Notificação", "Ocorrências (Qtd)", "Percentual (%)"]],
      body: tipoTableRows,
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 102 },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 40, halign: "center" }
      },
      margin: { left: 14, right: 14 }
    });

    // Top 10 Condutores Críticos
    let lastY = (doc as any).lastAutoTable.finalY || 135;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text("Top 10 - Condutores Críticos", 14, lastY + 10);

    const condutorTableRows = topCondutores.slice(0, 10).map(item => {
      const val = item.quantidade as number;
      const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : "0.0";
      return [item.nome || "Não Identificado", String(val), `${pct}%`];
    });

    autoTable(doc, {
      startY: lastY + 13,
      head: [["Nome do Condutor", "Eventos Gerados (Qtd)", "Representatividade (%)"]],
      body: condutorTableRows,
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 8.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 102 },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 40, halign: "center" }
      },
      margin: { left: 14, right: 14 }
    });

    // Adiciona página 2 do Relatório (Distribuição por Gerência & Ocorrências Detalhadas)
    doc.addPage();
    
    // Header secundário da página 2
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("COMPESA - RELATÓRIO DE TELEMETRIA (NOTIFICAÇÕES DE RISCO) - PÁGINA 2", 14, 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text("Top 10 - Gerências com Maior Incidência", 14, 22);

    const gerenciaTableRows = topGerencias.slice(0, 10).map(item => {
      const val = item.value as number;
      const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : "0.0";
      return [item.name || "N/A", String(val), `${pct}%`];
    });

    autoTable(doc, {
      startY: 25,
      head: [["Gerência Responsável", "Ocorrências (Qtd)", "Proporção (%)"]],
      body: gerenciaTableRows,
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 102 },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 40, halign: "center" }
      },
      margin: { left: 14, right: 14 }
    });

    let currentY2 = (doc as any).lastAutoTable.finalY || 70;

    // Amostra de Ocorrências Filtradas (Até as primeiras 30 ocorrências)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Lista Amostral das Ocorrências Filtradas (Até 30 itens)`, 14, currentY2 + 10);

    const detailRows = filteredNotificacoes.slice(0, 30).map((n) => {
      const keys = Object.keys(n);
      const dataLabel = n.COL_3 || n[keys[3]] || "-";
      return [
        String(dataLabel),
        String(n.PLACA || "N/A"),
        String(n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || n._tipo || "N/A"),
        String(n.CONDUTOR || "N/A"),
        String(n["GERÊNCIA"] || n.GERENCIA || n._gerencia || "N/A"),
        String(n.GRAVIDADE || "MÉDIA")
      ];
    });

    autoTable(doc, {
      startY: currentY2 + 13,
      head: [["Data/Hora", "Placa", "Evento", "Condutor", "Gerência", "Gravidade"]],
      body: detailRows,
      theme: "grid",
      headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 15 },
        2: { cellWidth: 50 },
        3: { cellWidth: 38 },
        4: { cellWidth: 38 },
        5: { cellWidth: 16 }
      },
      margin: { left: 14, right: 14 }
    });

    // Rodapé de formalização / rodapé das páginas
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(115);
      doc.text(
        `COMPESA - Telemetria Veicular | Relatório Circunstanciado de Alertas | Página ${i} de ${totalPages}`,
        14,
        287
      );
    }

    doc.save(`COMPESA_Relatorio_Telemetria_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">Gestão de Telemetria</h1>
          <p className="text-slate-500 font-medium tracking-tight mt-1 uppercase text-[10px]">Monitoramento avançado de frota e condutores</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("notifications")}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "notifications" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <ShieldAlert size={14} /> Notificações
            </button>
            <button
              onClick={() => setActiveTab("drivers")}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "drivers" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Users size={14} /> Condutores
            </button>
            <button
              onClick={() => setActiveTab("performance")}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "performance" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Trophy size={14} /> Performance
            </button>
            <button
              onClick={() => setActiveTab("live")}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "live" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Activity size={14} /> Transmissões Live
            </button>
          </div>
          {activeTab !== "drivers" && activeTab !== "performance" && activeTab !== "live" && (
            <button 
              onClick={handleExportRealtime}
              className="flex items-center space-x-2 bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg font-black text-[10px] uppercase tracking-wider hover:bg-slate-800 transition-all active:scale-95"
            >
              <Download size={16} />
              <span>Extrair XLSX</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === "live" && <TelemetryLiveTab />}
      {activeTab === "performance" && <RankingView />}
      {activeTab === "drivers" && (
        <div className="space-y-8">
          <DriversRelation />
          
          {/* Card/Painel de Operadores de Máquinas */}
          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="pb-5 pt-6 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 rounded-md bg-indigo-500 text-white font-black text-[8px] uppercase tracking-wider leading-none block w-max animate-pulse">
                    NOVO
                  </span>
                  <CardTitle className="text-base font-black uppercase tracking-tighter flex items-center gap-2 text-slate-800 dark:text-white">
                    <HardHat size={18} className="text-indigo-500" /> Operadores de Máquina & Equipamentos
                  </CardTitle>
                </div>
                <CardDescription className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">
                  Controle, Alertas de Cursos Obrigatórios e Envio de E-mails ({operatorStats.pendentes} Pendentes de Curso)
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex bg-white dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-150 dark:border-slate-700/50 gap-4 px-4 shadow-sm">
                  <div className="text-center">
                    <p className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase">Total</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none mt-1">{operatorStats.total}</p>
                  </div>
                  <div className="text-center border-l border-slate-200 dark:border-slate-700 pl-4">
                    <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-black uppercase">Regular</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-none mt-1">{operatorStats.regulares}</p>
                  </div>
                  <div className="text-center border-l border-slate-200 dark:border-slate-700 pl-4">
                    <p className="text-[8px] text-rose-600 dark:text-rose-400 font-black uppercase">Pendente</p>
                    <p className="text-xs font-black text-rose-600 dark:text-rose-400 leading-none mt-1">{operatorStats.pendentes}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Filtrar operador, máquina, matrícula ou gerência..."
                    value={operatorSearch}
                    onChange={(e) => setOperatorSearch(e.target.value)}
                    className="pl-9 h-10 text-[10.5px] font-bold uppercase bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
                  />
                </div>
                <div>
                  <Select value={operatorStatusFilter} onValueChange={(v) => setOperatorStatusFilter(v as any)}>
                    <SelectTrigger className="h-10 text-[10px] font-black uppercase bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                      <SelectValue placeholder="Situação do Curso" />
                    </SelectTrigger>
                    <SelectContent className="border border-slate-100 dark:border-slate-800 rounded-xl">
                      <SelectItem value="all" className="text-[10px] font-black uppercase">TODAS AS SITUAÇÕES</SelectItem>
                      <SelectItem value="pendente" className="text-[10px] font-black uppercase text-rose-650 dark:text-rose-400">PENDENTE (NOME CURSO VAZIO)</SelectItem>
                      <SelectItem value="regular" className="text-[10px] font-black uppercase text-emerald-655 dark:text-emerald-400">REGULAR (CURSO CADASTRADO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
 
              <ScrollArea className="h-[350px] rounded-xl border border-slate-100 dark:border-slate-800/40 overflow-hidden">
                {loadingOperators ? (
                  <div className="flex flex-col items-center justify-center p-12 space-y-3 h-[348px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Banco de Dados...</p>
                  </div>
                ) : filteredOperators.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 h-[348px] bg-slate-50/10 dark:bg-slate-900/10">
                    <AlertCircle className="text-slate-300 dark:text-slate-700" size={36} />
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest">Nenhum operador encontrado com os filtros atuais</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-100 dark:border-slate-850">
                        <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-slate-500 dark:text-slate-400">Operador</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-slate-500 dark:text-slate-400">Gerência</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-slate-500 dark:text-slate-400">Máquina/Equipamento</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-slate-500 dark:text-slate-400">Curso Obrigatório (Col H)</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-center w-[100px] text-slate-500 dark:text-slate-400">Notificar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOperators.map((op, idx) => {
                        const isPendente = !op.curso || String(op.curso).trim() === "" || String(op.curso).trim().toUpperCase() === "N/A" || String(op.curso).trim() === "-";
                        return (
                          <TableRow key={idx} className={`border-b border-slate-50 dark:border-slate-850/50 transition-colors ${isPendente ? "bg-rose-50/20 hover:bg-rose-50/30 dark:bg-rose-950/5 dark:hover:bg-rose-950/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"}`}>
                            <TableCell className="py-3">
                              <p className="text-[11px] font-black uppercase leading-tight text-slate-800 dark:text-slate-100">{op.nome}</p>
                              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">MAT: {op.matricula || "N/A"}</p>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">{op.gerencia}</span>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">{op.maquina || "N/A"}</span>
                            </TableCell>
                            <TableCell className="py-3">
                              {isPendente ? (
                                <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 text-[8px] font-black uppercase tracking-wide">
                                  PENDENTE • HISTÓRICO VAZIO
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-650 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30 text-[8px] font-black uppercase tracking-wide max-w-[220px] truncate" title={op.curso}>
                                  {op.curso}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              {isPendente ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-3 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-700 dark:hover:text-rose-350 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 mx-auto"
                                  onClick={() => {
                                    const emails = getEmailsByGerencia(op.gerencia);
                                    const recipient = emails.join(",");
                                    const subject = `Alerta: Pendência de Curso - ${op.nome}`;
                                    const body = `Prezados(as) Gestores(as),\n\nSolicitamos, por gentileza, o preenchimento do formulário disponível no link abaixo e incluindo o envio do certificado do curso, para fins de levantamento e contabilização dos condutores que possuem cursos para operação de veículos e equipamentos pesados.\n\n\n\nLink: https://forms.gle/ha3Et4GLwHGGgY6Y9\n\nAtenciosamente,\n\nCGF – Coordenação de Gestão de Frotas\n`;
                                    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=gadmonitoramento@compesa.com.br`;
                                  }}
                                >
                                  <Mail size={12} className="text-rose-500" />
                                  <span>Notificar</span>
                                </Button>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
      
      {activeTab === "notifications" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Distribuição por Tipo de Notificação" description="Eventos críticos sincronizados">
              <div style={{ height: '350px', width: '100%', position: 'relative' }} className="flex items-center justify-center overflow-visible">
                {tiposNotificacaoChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" debounce={1}>
                    <PieChart>
                      <Pie
                        data={tiposNotificacaoChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {tiposNotificacaoChart.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/50 w-full h-[350px] rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <PieIcon className="text-slate-300 mb-2" size={40} />
                    <p className="text-[10px] font-black uppercase text-slate-400">Sem dados para exibição</p>
                  </div>
                )}
              </div>
            </ChartCard>

            <ChartCard 
              title="Evolução Temporal" 
              description="Análise dinâmica por tipo e gravidade"
            >
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit mb-4">
                <button
                  onClick={() => setTimelineView("severity")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timelineView === "severity" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Gravidade
                </button>
                <button
                  onClick={() => setTimelineView("type")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timelineView === "type" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Tipo
                </button>
              </div>

              <div style={{ height: '280px', width: '100%', position: 'relative' }} className="flex items-center justify-center overflow-visible">
                {timelineChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" debounce={1}>
                    <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        {COLORS.map((color, i) => (
                          <linearGradient key={`grad-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="mesAno" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }} />
                      {timelineView === "severity" ? (
                        gravidades.map((g, i) => (
                          <Area key={g} type="monotone" dataKey={g} stackId="1" stroke={COLORS[i % COLORS.length]} strokeWidth={3} fillOpacity={1} fill={`url(#color-${i % COLORS.length})`} isAnimationActive={false} />
                        ))
                      ) : (
                        tiposNotificacao.slice(0, 5).map((t, i) => (
                          <Area key={t} type="monotone" dataKey={t} stackId="1" stroke={COLORS[(i + 3) % COLORS.length]} strokeWidth={3} fillOpacity={1} fill={`url(#color-${(i + 3) % COLORS.length})`} isAnimationActive={false} />
                        ))
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <Activity size={40} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sem dados históricos</p>
                  </div>
                )}
              </div>
            </ChartCard>
          </div>



          <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2 mb-6">
              <ShieldAlert className="text-rose-500" size={24} />
              <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Análise de Segurança</h2>
            </div>

            <TelemetryFilterBar
              diretorias={diretorias}
              gerencias={gerencias}
              gravidades={gravidades}
              situacoes={situacoes}
              tiposNotificacao={tiposNotificacao}
              meses={meses}
              selectedDiretorias={selectedDiretorias}
              selectedGerencias={selectedGerencias}
              selectedGravidades={selectedGravidades}
              selectedSituacoes={selectedSituacoes}
              selectedTiposNotificacao={selectedTiposNotificacao}
              selectedMeses={selectedMeses}
              onDiretoriasChange={setSelectedDiretorias}
              onGerenciasChange={setSelectedGerencias}
              onGravidadesChange={setSelectedGravidades}
              onSituacoesChange={setSelectedSituacoes}
              onTiposNotificacaoChange={setSelectedTiposNotificacao}
              onMesesChange={setSelectedMeses}
              onClearFilters={() => {
                setSelectedDiretorias([]);
                setSelectedGerencias([]);
                setSelectedGravidades([]);
                setSelectedSituacoes([]);
                setSelectedTiposNotificacao([]);
                setSelectedMeses([]);
                setDriverSearch("");
              }}
              driverSearch={driverSearch}
              onDriverSearchChange={setDriverSearch}
              condutoresList={condutoresList}
            />

            <div className="grid gap-6 md:grid-cols-2 mt-6">
                <ChartCard title="Top 10 - Notificações por Gerência" description="Quantitativo de alertas gerados">
                 <div style={{ height: '400px', width: '100%', position: 'relative' }} className="flex items-center justify-center overflow-visible">
                   {topGerencias.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%" debounce={1}>
                       <BarChart data={topGerencias} layout="vertical" margin={{ left: 20 }}>
                           <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                           <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                           <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} width={120} />
                           <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={24} />
                           <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                         </BarChart>
                       </ResponsiveContainer>
                   ) : (
                     <div className="text-center">
                        <BarChart3 className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sem notificações por gerência</p>
                     </div>
                   )}
                   </div>
               </ChartCard>

               <ChartCard title="Top 10 - Condutores Críticos" description="Incidência de eventos de risco">
                 <div style={{ height: '400px', width: '100%', position: 'relative' }} className="flex items-center justify-center overflow-visible">
                   {topCondutores.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%" debounce={1}>
                       <BarChart data={topCondutores} layout="vertical" margin={{ left: 20 }}>
                           <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                           <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                           <YAxis dataKey="nome" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} width={120} />
                           <Bar dataKey="quantidade" fill="#dc2626" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={24} />
                           <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                         </BarChart>
                       </ResponsiveContainer>
                   ) : (
                     <div className="text-center">
                        <Users className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sem condutores críticos detectados</p>
                     </div>
                   )}
                   </div>
               </ChartCard>
             </div>

            <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Relatório Circunstanciado</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{filteredNotificacoes.length} Ocorrências Encontradas</p>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setGroupingMode("flat")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupingMode === "flat" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Lista
                  </button>
                  <button 
                    onClick={() => setGroupingMode("type")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupingMode === "type" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Por Tipo
                  </button>
                  <button 
                    onClick={() => setGroupingMode("severity")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupingMode === "severity" ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Por Gravidade
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                  <button 
                    onClick={() => {
                      const data = filteredNotificacoes.map(n => {
                        const keys = Object.keys(n);
                        return {
                          "Data": n[keys[3]],
                          "Placa": n.PLACA,
                          "Tipo": n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"],
                          "Condutor": n.CONDUTOR,
                          "Gerência": n["GERÊNCIA"] || n.GERENCIA,
                          "Gravidade": n.GRAVIDADE,
                          "Situação": n["SITUAÇÃO"] || n.SITUACAO
                        };
                      });
                      exportToExcel(data, "Notificacoes_Telemetria", "Alertas");
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl border border-indigo-200 font-black text-[10px] uppercase tracking-widest transition-all h-9 flex items-center justify-center leading-none"
                  >
                    <Download className="inline-block mr-2 h-3.5 w-3.5" />
                    Excel Detalhado
                  </button>

                  <button 
                    onClick={exportToPDF}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl border border-rose-200 font-black text-[10px] uppercase tracking-widest transition-all h-9 flex items-center justify-center leading-none"
                  >
                    <FileText className="inline-block mr-2 h-3.5 w-3.5" />
                    PDF Resumido
                  </button>
                </div>
              </div>

              {groupingMode === "flat" ? (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-20 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Data</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Placa</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Notificação</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Condutor</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Gravidade</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredNotificacoes.map((n, i) => {
                        const dataLabel = n.COL_3 || "-";
                        const situacao = String(n["SITUAÇÃO"] || n.SITUACAO || "PENDENTE").toUpperCase();
                        
                        return (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-[10px] font-bold text-slate-500 whitespace-nowrap">{String(dataLabel)}</td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{n.PLACA}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-white uppercase leading-tight max-w-[200px] truncate">
                              {n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"] || n.COL_2}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase truncate max-w-[150px]">{n.CONDUTOR}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                                String(n.GRAVIDADE || n.COL_9).includes('ALTA') ? 'bg-rose-100 text-rose-600' :
                                String(n.GRAVIDADE || n.COL_9).includes('MÉDIA') || String(n.GRAVIDADE || n.COL_9).includes('MEDIA') ? 'bg-amber-100 text-amber-600' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {String(n.GRAVIDADE || n.COL_9).charAt(0)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={situacao} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 space-y-6 max-h-[800px] overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                  {groupedNotificacoes.map(([groupName, items]) => (
                    <div key={groupName} className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-l-4 border-indigo-500 pl-3">
                          {groupName} <span className="ml-2 text-indigo-600/50">({items.length})</span>
                        </h4>
                      </div>
                      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                        {items.slice(0, 50).map((n, idx) => {
                          const keys = Object.keys(n);
                          const dataLabel = n[keys[3]] || "-";
                          const situacao = String(n["SITUAÇÃO"] || n.SITUACAO || "PENDENTE").toUpperCase();
                          
                          return (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              key={`${groupName}-${idx}`} 
                              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tighter">{n.PLACA}</span>
                                    <span className="text-[9px] font-bold text-slate-400">{dataLabel}</span>
                                  </div>
                                  <h5 className="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-tight group-hover:text-indigo-600 transition-colors">
                                    {groupingMode === "type" ? (n.GRAVIDADE || "NORMAL") : (n["TIPO NOTIFICAÇÃO"] || n["TIPO NOTIFICACAO"])}
                                  </h5>
                                </div>
                                <StatusBadge status={situacao} showLabel={false} />
                              </div>
                              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                                <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[200px]">
                                  {n.CONDUTOR || "NÃO IDENTIFICADO"}
                                </span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  String(n.GRAVIDADE).includes('ALTA') ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {n.GRAVIDADE}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                        {items.length > 50 && (
                          <div className="col-span-full py-4 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">+ {items.length - 50} itens não mostrados para otimizar performance</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, showLabel = true }: { status: string, showLabel?: boolean }) {
  const normalizedStatus = status.toUpperCase();
  
  let config = {
    color: 'bg-slate-100 text-slate-400 border-slate-200',
    icon: <X size={10} />,
    label: status
  };

  if (normalizedStatus.includes('ANALISADO') || normalizedStatus.includes('CONCLUÍDO')) {
    config = {
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: <Check size={10} />,
      label: 'Analisado'
    };
  } else if (normalizedStatus.includes('PENDENTE')) {
    config = {
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      icon: <Activity size={10} className="animate-pulse" />,
      label: 'Pendente'
    };
  } else if (normalizedStatus.includes('JUSTIFICADO')) {
    config = {
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      icon: <FileText size={10} />,
      label: 'Justificado'
    };
  } else if (normalizedStatus.includes('AUDITORIA')) {
    config = {
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      icon: <Search size={10} />,
      label: 'Em Auditoria'
    };
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${config.color}`}>
      {config.icon}
      {showLabel && <span className="text-[9px] font-black uppercase tracking-widest">{config.label}</span>}
    </div>
  );
}
