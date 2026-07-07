import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, CalendarIcon, LayoutGrid, List, Trash2, CalendarX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useIndicators } from "@/hooks/useIndicators";
import { useResponsibles } from "@/hooks/useResponsibles";
import { IndicatorDialog } from "@/components/IndicatorDialog";
import { IndicatorChart } from "@/components/IndicatorChart";
import { useKanbanData } from "@/hooks/useKanbanData";
import { PrintDashboard } from "@/components/PrintDashboard";
import { useIndicatorValues } from "@/hooks/useIndicatorValues";
import { format, parse, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAssets, useHistoricoManutencao, useOrcamentos, useCustosDetalhes, useFuelData, useRegularizacaoData, useMaintenanceCostData } from "@/hooks/useFleetData";
import { useLocadosData } from "@/hooks/useLocadosData";
import { useVeiculosLocadosDisponiveis } from "@/hooks/useDisponibilidadeLocados";
import { useControleDocumentosData } from "@/hooks/useControleDocumentos";
import { useCNHData, calculateCNHStats } from "@/hooks/useCNHData";
import { useNotificacoes } from "@/hooks/useTelemetryData";
import { useMachineSupplyAssignments } from "@/hooks/useMachineSupplyAssignments";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const standardizeFuelType = (fuelType: string | undefined): string => {
  if (!fuelType) return "N/A";
  const fuel = String(fuelType).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (fuel.includes("GASOLINA ADITIVADA")) return "GASOLINA ADITIVADA";
  if (fuel.includes("GASOLINA")) return "GASOLINA COMUM";
  if (fuel.includes("DIESEL B S10") || fuel.includes("S10")) return "OLEO DIESEL S10";
  if (fuel.includes("DIESEL COMUM") || fuel.includes("DIESEL") || fuel.includes("S500")) return "OLEO DIESEL S500";
  if (fuel.includes("ETANOL") || fuel.includes("ALCOOL")) return "ETANOL";
  if (fuel.includes("ARLA")) return "ARLA 32";
  return fuel;
};

const parseBrazilianNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim().replace(/\s/g, "");
  if (!str || str === "-") return 0;
  const replaced = str.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(replaced);
  return isNaN(parsed) ? 0 : parsed;
};

const getFuelAlertConfig = () => {
  const DEFAULT_FUEL_ALERT_CONFIG = {
    autonomyDeviationPercent: 30,
    valorLitroDeviationPercent: 30,
    minCapacityPercent: 20,
    maxCapacityPercent: 110,
    averageCapacityPercent: 2,
    daysWithoutRefueling: 5
  };
  const saved = localStorage.getItem("fuel_alert_config");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_FUEL_ALERT_CONFIG;
    }
  }
  return DEFAULT_FUEL_ALERT_CONFIG;
};

const parseMonthStr = (monthStr: any): Date => {
  if (!monthStr) return new Date();
  
  if (monthStr instanceof Date) {
    return isNaN(monthStr.getTime()) ? new Date() : monthStr;
  }
  
  // If it's a Firestore Timestamp or object with seconds/nanoseconds
  if (typeof monthStr === 'object' && monthStr.seconds) {
    const d = new Date(monthStr.seconds * 1000);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  
  const str = String(monthStr).trim();
  
  // If it's already YYYY-MM-DD format (like "2026-07-01")
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str + "T12:00:00Z");
    if (!isNaN(d.getTime())) return d;
  }
  
  // If it's YYYY-MM format (like "2026-07")
  if (/^\d{4}-\d{2}$/.test(str)) {
    const d = new Date(str + "-01T12:00:00Z");
    if (!isNaN(d.getTime())) return d;
  }

  // If it's MM/YYYY format
  if (/^\d{2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const d = new Date(`${parts[1]}-${parts[0]}-01T12:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to direct parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return new Date();
};

const getMonthStr = (month: any): string => {
  if (!month) return "";
  if (typeof month === 'string') return month;
  try {
    const d = parseMonthStr(month);
    return format(d, "yyyy-MM-01");
  } catch {
    return "";
  }
};

const AUTO_INDICATORS_SPECS = [
  {
    name: "Custo de Manutenção",
    section: "manutencao",
    subsection: "Próprios",
    unit: " R$",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 1,
    is_auto: true,
    description: "Custo de manutenção corretiva e geral realizada no mês."
  },
  {
    name: "MTTR",
    section: "manutencao",
    subsection: "Próprios",
    unit: " dias",
    target: 7,
    goal_type: "lower",
    chart_type: "bar",
    order: 2,
    is_auto: true,
    description: "Mean Time To Repair (Tempo Médio de Reparo)."
  },
  {
    name: "MTBF",
    section: "manutencao",
    subsection: "Próprios",
    unit: " dias",
    target: 30,
    goal_type: "higher",
    chart_type: "line",
    order: 3,
    is_auto: true,
    description: "Mean Time Between Failures (Tempo Médio Entre Falhas)."
  },
  {
    name: "MTTA",
    section: "manutencao",
    subsection: "Próprios",
    unit: " dias",
    target: 2,
    goal_type: "lower",
    chart_type: "bar",
    order: 4,
    is_auto: true,
    description: "Mean Time To Approve (Tempo Médio para Aprovação de O.S.)."
  },
  {
    name: "Disponibilidade Inerente",
    section: "manutencao",
    subsection: "Próprios",
    unit: "%",
    target: 90,
    goal_type: "higher",
    chart_type: "gauge",
    order: 5,
    is_auto: true,
    description: "Porcentagem de tempo em que a frota própria esteve disponível."
  },
  {
    name: "Dias de Indisponibilidade",
    section: "manutencao",
    subsection: "Locados",
    unit: " dias",
    target: 5,
    goal_type: "lower",
    chart_type: "bar",
    order: 6,
    is_auto: true,
    description: "Total de dias de inoperância/indisponibilidade acumulados por veículos locados no mês."
  },
  {
    name: "Litros abastecidos",
    section: "abastecimento",
    subsection: "",
    unit: " L",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 1,
    is_auto: true,
    description: "Total de litros abastecidos no mês."
  },
  {
    name: "Valor abastecido",
    section: "abastecimento",
    subsection: "",
    unit: " R$",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 2,
    is_auto: true,
    description: "Custo total dos abastecimentos no mês."
  },
  {
    name: "Preço Médio/Litro",
    section: "abastecimento",
    subsection: "",
    unit: " R$",
    target: 0,
    goal_type: "lower",
    chart_type: "line",
    order: 3,
    is_auto: true,
    description: "Preço médio do litro de combustível no mês."
  },
  {
    name: "Autonomia Real Média",
    section: "abastecimento",
    subsection: "",
    unit: " km/L",
    target: 10,
    goal_type: "higher",
    chart_type: "line",
    order: 4,
    is_auto: true,
    description: "Autonomia média real da frota no mês (km/L)."
  },
  {
    name: "KM Médio",
    section: "abastecimento",
    subsection: "",
    unit: " km",
    target: 0,
    goal_type: "higher",
    chart_type: "line",
    order: 5,
    is_auto: true,
    description: "Média de KM rodados por abastecimento no mês."
  },
  {
    name: "Infrações Recebidas no Mês",
    section: "regularizacao",
    subsection: "",
    unit: " uni",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 1,
    is_auto: true,
    description: "Quantidade total de infrações recebidas no mês."
  },
  {
    name: "Desvio de Consumo vs. Padrão",
    section: "abastecimento",
    subsection: "",
    unit: " desvios",
    target: 5,
    goal_type: "lower",
    chart_type: "bar",
    order: 6,
    is_auto: true,
    description: "Quantidade de desvios de consumo/autonomia vs. padrão no mês."
  },
  {
    name: "% de Abastecimentos Irregulares (MAQ)",
    section: "abastecimento",
    subsection: "",
    unit: "%",
    target: 10,
    goal_type: "lower",
    chart_type: "bar",
    order: 7,
    is_auto: true,
    description: "Percentual de abastecimentos de máquinas onde o Destino Maquinário é OUTROS."
  },
  {
    name: "Disponibilidade Locados",
    section: "manutencao",
    subsection: "Locados",
    unit: "%",
    target: 95,
    goal_type: "higher",
    chart_type: "gauge",
    order: 7,
    is_auto: true,
    description: "Percentual de disponibilidade da frota de veículos locados no mês."
  },
  {
    name: "CNH Vencida",
    section: "telemetria",
    subsection: "",
    unit: " mot",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 1,
    is_auto: true,
    description: "Quantidade de condutores com CNH vencida atualmente."
  },
  {
    name: "Notificações Enviadas via SEI",
    section: "telemetria",
    subsection: "",
    unit: " ntf",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 2,
    is_auto: true,
    description: "Quantidade de notificações enviadas via SEI no mês."
  },
  {
    name: "Multas Pagas (Centro de Custo)",
    section: "regularizacao",
    subsection: "",
    unit: " R$",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 2,
    is_auto: true,
    description: "Soma do valor líquido das multas pagas (Despesas com Títulos)."
  },
  {
    name: "CRLV Vencidos",
    section: "regularizacao",
    subsection: "",
    unit: " uni",
    target: 0,
    goal_type: "lower",
    chart_type: "bar",
    order: 3,
    is_auto: true,
    description: "Quantidade de CRLVs vencidos (não vigentes em 2026)."
  }
];

interface GestaoVistaProps {
  onBack: () => void;
}

const GestaoVista = ({ onBack }: GestaoVistaProps) => {
  const { indicators, isLoading: isLoadingIndicators, deleteIndicator } = useIndicators();
  const { responsibles } = useResponsibles();
  const { tasks } = useKanbanData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const safeSelectedMonth = useMemo(() => {
    if (selectedMonth && !isNaN(selectedMonth.getTime())) {
      return selectedMonth;
    }
    return new Date();
  }, [selectedMonth]);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();
  const { data: orcamentosRows = [], isLoading: isLoadingOrcamentos } = useOrcamentos();
  const { data: custosDetalhesRows = [], isLoading: isLoadingCustos } = useCustosDetalhes();
  const { data: locados = [], isLoading: isLoadingLocados } = useLocadosData();
  const { data: veiculosDisponiveisData, isLoading: isLoadingVeiculosDisponiveis } = useVeiculosLocadosDisponiveis();
  const { data: fuelData = [], isLoading: isLoadingFuel } = useFuelData();
  const { data: regularizacaoData = [], isLoading: isLoadingRegularizacao } = useRegularizacaoData();
  const { data: titulosDespesasData = [], isLoading: isLoadingTitulos } = useMaintenanceCostData();
  const { data: controleDocumentos = [], isLoading: isLoadingControleDocs } = useControleDocumentosData();
  const { data: cnhResult, isLoading: isLoadingCNH } = useCNHData();
  const { data: notificacoes = [], isLoading: isLoadingNotificacoes } = useNotificacoes();
  const { data: machineAssignments = [], isLoading: isLoadingMachineAssignments } = useMachineSupplyAssignments();

  const [crlvYears, setCrlvYears] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/crlv-years")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.years) {
          setCrlvYears(data.years);
        }
      })
      .catch(err => console.error("Error fetching CRLV years:", err));
  }, []);

  const isLoading = isLoadingIndicators || isLoadingAssets || isLoadingOrcamentos || isLoadingCustos || isLoadingLocados || isLoadingVeiculosDisponiveis || isLoadingFuel || isLoadingRegularizacao || isLoadingTitulos || isLoadingControleDocs || isLoadingCNH || isLoadingNotificacoes || isLoadingMachineAssignments;
  
  const formattedMonth = format(safeSelectedMonth, "yyyy-MM-01");
  const { values: indicatorValues, deleteValue } = useIndicatorValues(undefined, formattedMonth);
  const { values: allIndicatorValues, deleteValue: deleteAnyValue } = useIndicatorValues();

  const handleDeleteValue = async (valueId: string, indicatorName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o lançamento de score do mês selecionado para o indicador "${indicatorName}"?`)) {
      return;
    }
    try {
      await deleteValue(valueId);
      toast.success("Lançamento mensal excluído com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir o lançamento do mês.");
    }
  };

  const handleDeleteHistoryValue = async (valueId: string, indicatorName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir este lançamento histórico do indicador "${indicatorName}"?`)) {
      return;
    }
    try {
      await deleteAnyValue(valueId);
      toast.success("Lançamento histórico excluído com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir lançamento histórico.");
    }
  };

  const handleDeleteIndicator = async (indicatorId: string, indicatorName: string) => {
    if (!window.confirm(`ATENÇÃO: Isso removerá o indicador "${indicatorName}" PERMANENTEMENTE das listagens e relatórios. Confirma?`)) {
      return;
    }
    try {
      await deleteIndicator(indicatorId);
      toast.success(`Indicador "${indicatorName}" removido permanentemente!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir cadastro do indicador.");
    }
  };

  const cgfLogo = "/src/assets/images/regenerated_image_1778593500523.png";

  const sections = [
    { id: "manutencao", name: "Manutenção", subsections: ["Próprios", "Locados"] },
    { id: "abastecimento", name: "Abastecimento" },
    { id: "regularizacao", name: "Regularização" },
    { id: "telemetria", name: "Telemetria" },
    { id: "pool", name: "Pool" },
    { id: "kanban", name: "Kanban de Atividades" },
    { id: "dashboard", name: "Dashboard Completo" },
  ];

  const parseCurrency = (raw: string) => {
    const str = (raw || "").replace(/R\$\s*/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(str) || 0;
  };

  const normalizePlate = (p: string) => (p || "").toUpperCase().replace(/[^A-Z0-9]/g, '');

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
    for (const fmt of formats) {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
    return null;
  };

  const { custosData, indicatorSource } = useMemo(() => {
    const parsedCustos: any[] = [];
    const indicatorItems: any[] = [];

    if (custosDetalhesRows.length > 0) {
        for (let i = 1; i < custosDetalhesRows.length; i++) {
          const row = custosDetalhesRows[i];
          if (!row || row.length < 40) continue;
          
          const diretoria = row[36]?.trim() || "";
          const gerencia = row[37]?.trim() || "";
          const tipoManutencao = row[38]?.trim() || "";
          const mesAnoRaw = row[42]?.trim() || "";
          const tam = row[45]?.trim() || "";
          const custoOrcado = parseCurrency(row[46]);
          const custoReal = parseCurrency(row[47]);
          const custoGeral = parseCurrency(row[40]);
          const mesAno = mesAnoRaw.replace(/\./g, '').replace(/-/g, '/');

          const placa = normalizePlate(row[35]?.trim() || row[1]?.trim() || "");
          const nOrcamento = row[44]?.trim() || "";
          const ordemServico = row[1]?.trim() || "";
          const dedupeKey = nOrcamento || ordemServico || `row-${i}`;
          const descricao = row[53]?.trim() || "";

          if (placa) {
            parsedCustos.push({ 
              placa,
              tipo: tipoManutencao, 
              custo: custoGeral, 
              mesAno, 
              tam, 
              custoOrcado, 
              custoReal, 
              gerencia, 
              diretoria,
              nOrcamento,
              descricao,
              ordemServico
            });
            
            if (mesAno && tam) {
              indicatorItems.push({
                placa, ordemServico: dedupeKey, mesAno, tam,
                dataEntradaOficina: row[48]?.trim() || "",
                dataRetiradaOficina: row[49]?.trim() || "",
                dataEnvioOS: row[50]?.trim() || "",
                dataAprovacaoOS: row[51]?.trim() || "",
                dataConclusao: row[52]?.trim() || "",
                diretoria,
                gerencia,
                tipoAtivo: tipoManutencao,
              });
            }
          }
        }
    }
    return { custosData: parsedCustos, indicatorSource: indicatorItems };
  }, [custosDetalhesRows]);

  const operationalPlates = useMemo(() => {
    const normalize = (p: string) => (p || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
    return new Set(
      assets
        .filter(a => {
          const status = (a.SITUACAO || a["SITUAÇÃO"] || a.STATUS || "OPERACIONAL").toUpperCase();
          return ["OPERACIONAL", "ATIVO", "EM OPERAÇÃO", "DISPONÍVEL", "DISPONIVEL"].includes(status);
        })
        .map(a => normalize(a.PLACA || a.placa || ""))
        .filter(Boolean)
    );
  }, [assets]);

  const combinedIndicators = useMemo(() => {
    const list = [...indicators];
    
    AUTO_INDICATORS_SPECS.forEach(spec => {
      const exists = list.find(ind => 
        ind.name.trim().toLowerCase() === spec.name.trim().toLowerCase() &&
        ind.section === spec.section &&
        ind.subsection === spec.subsection
      );
      
      if (exists) {
        exists.is_auto = true;
        exists.unit = spec.unit;
        exists.target = exists.target || spec.target;
        exists.goal_type = spec.goal_type;
        exists.description = spec.description;
      } else {
        list.push({
          id: `auto-${spec.name.toLowerCase().replace(/\s+/g, '-')}`,
          ...spec
        });
      }
    });
    
    return list;
  }, [indicators]);

  const sanitizedFuelData = useMemo(() => {
    return fuelData.map((f: any) => {
      // Litros
      let litros = f._litros;
      if (typeof litros === "string") {
        litros = parseFloat(String(litros).replace(/\./g, "").replace(",", "."));
      }
      litros = Number(litros) || 0;

      // Total (Custo R$)
      let total = f._total;
      if (typeof total === "string") {
        total = parseFloat(String(total).replace(/\./g, "").replace(",", "."));
      }
      total = Number(total) || 0;

      // Autonomia
      let autReal = f._autReal;
      if (typeof autReal === "string") {
        autReal = parseFloat(String(autReal).replace(/\./g, "").replace(",", "."));
      }
      autReal = Number(autReal) || 0;

      // KM Rodados
      let kmRodados = f._kmRodados;
      if (typeof kmRodados === "string") {
        kmRodados = parseFloat(String(kmRodados).replace(/\./g, "").replace(",", "."));
      }
      kmRodados = Number(kmRodados) || 0;

      // Preço por litro
      let vlLitro = f._vlLitro;
      if (typeof vlLitro === "string") {
        vlLitro = parseFloat(String(vlLitro).replace(/\./g, "").replace(",", "."));
      }
      vlLitro = Number(vlLitro) || 0;

      // Date parsing
      const rawDate = f._dateParsed || f._date || f["DATA TRANSACAO"] || f["DATA"] || "";
      let d: Date | null = null;
      if (rawDate instanceof Date) d = rawDate;
      else if (rawDate) {
        const s = String(rawDate).trim();
        const parts = s.split(/[\s/:\-]/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
          d = new Date(year, month, day);
        }
      }

      // Mes/Ano
      let mesAno = f._monthYear || f["MES/ANO"] || f["M\u00CAS/ANO"] || f["MES ANO"] || f.COL_41 || "";
      if (!mesAno || mesAno === "N/A" || mesAno === "undefined") {
        if (d) {
          const m = (d.getMonth() + 1).toString().padStart(2, '0');
          const y = d.getFullYear().toString();
          mesAno = `${m}/${y}`;
        } else {
          mesAno = "N/A";
        }
      } else {
        const my = mesAno.toLowerCase();
        const monthNames: Record<string, string> = { 
          'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06', 
          'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
          'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 
          'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 
          'novembro': '11', 'dezembro': '12'
        };
        const parts = my.split(/[\/\s-]/);
        if (parts.length >= 2) {
          let month = "";
          let year = "";
          for (const [name, code] of Object.entries(monthNames)) {
            if (parts[0].startsWith(name)) { month = code; break; }
          }
          if (!month && /^\d+$/.test(parts[0])) {
            month = parts[0].padStart(2, '0');
          }
          if (/^\d+$/.test(parts[parts.length - 1])) {
            year = parts[parts.length - 1];
            if (year.length === 2) year = "20" + year;
          }
          if (month && year) {
            mesAno = `${month}/${year}`;
          }
        }
      }

      return {
        ...f,
        _litros: litros,
        _total: total,
        _autReal: autReal,
        _kmRodados: kmRodados,
        _vlLitro: vlLitro,
        _dateParsed: d,
        _monthYear: mesAno,
      };
    });
  }, [fuelData]);

  const allAvailableMonths = useMemo(() => {
    const months = new Set<string>();
    const ptMonths = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    
    const extractAndAdd = (itemMesAno: string) => {
      if (!itemMesAno) return;
      const cleanItem = itemMesAno.toLowerCase().replace(/\s/g, '').replace(/\./g, '').replace(/-/g, '/');
      const parts = cleanItem.split('/');
      if (parts.length < 2) return;
      const [mRaw, yRaw] = parts;
      let itemYear = parseInt(yRaw);
      if (isNaN(itemYear)) return;
      if (itemYear < 100) itemYear += 2000;
      
      const cleanMRaw = mRaw.replace(/[^a-z0-9]/g, '');
      const monthNum = parseInt(cleanMRaw);
      let monthIndex = -1;
      if (!isNaN(monthNum)) {
        monthIndex = monthNum - 1;
      } else {
        const itemMonthName = cleanMRaw.substring(0, 3);
        monthIndex = ptMonths.indexOf(itemMonthName);
      }
      if (monthIndex >= 0 && monthIndex < 12) {
        const monthStr = String(monthIndex + 1).padStart(2, '0');
        months.add(`${itemYear}-${monthStr}-01`);
      }
    };

    custosData.forEach(c => extractAndAdd(c.mesAno));
    indicatorSource.forEach(i => extractAndAdd(i.mesAno));
    locados.forEach(l => extractAndAdd(l.mesAno));
    sanitizedFuelData.forEach(f => extractAndAdd(f._monthYear));
    regularizacaoData.forEach(r => {
      const dateStr = String(r.__raw?.[8] || "");
      if (dateStr && dateStr !== "-") {
        const parts = dateStr.split('/');
        if (parts.length >= 3) {
          extractAndAdd(`${parts[1]}/${parts[2]}`);
        }
      }
    });

    // Also include current month
    const curYear = new Date().getFullYear();
    const curMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    months.add(`${curYear}-${curMonthStr}-01`);

    return Array.from(months).sort();
  }, [custosData, indicatorSource, locados, sanitizedFuelData, regularizacaoData]);

  const allCalculatedAutoValues = useMemo(() => {
    const ptMonths = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const results: Record<string, Record<string, number>> = {};

    const titularPlatesSet = new Set(veiculosDisponiveisData?.plates || []);

    allAvailableMonths.forEach(monthKey => {
      const dateParts = monthKey.split('-');
      const yVal = parseInt(dateParts[0]);
      const mIndex = parseInt(dateParts[1]) - 1;
      const valuesMap: Record<string, number> = {};

      const matchMonthYear = (itemMesAno: string) => {
        if (!itemMesAno) return false;
        const cleanItem = itemMesAno.toLowerCase().replace(/\s/g, '').replace(/\./g, '').replace(/-/g, '/');
        const parts = cleanItem.split('/');
        if (parts.length < 2) return false;
        const [mRaw, yRaw] = parts;
        
        let itemYear = parseInt(yRaw);
        if (isNaN(itemYear)) return false;
        if (itemYear < 100) itemYear += 2000;
        if (itemYear !== yVal) return false;

        const cleanMRaw = mRaw.replace(/[^a-z0-9]/g, '');
        const monthNum = parseInt(cleanMRaw);
        if (!isNaN(monthNum)) {
          return monthNum === (mIndex + 1);
        } else {
          const itemMonthName = cleanMRaw.substring(0, 3);
          return itemMonthName === ptMonths[mIndex];
        }
      };

      // 1. Custo de Manutenção
      const targetCustos = custosData.filter(c => matchMonthYear(c.mesAno));
      const validCustos = targetCustos.map(c => c.custoReal || 0).filter(v => v > 0);
      const avgCustoRealizado = validCustos.length > 0
        ? validCustos.reduce((sum, v) => sum + v, 0) / validCustos.length
        : 0;
      valuesMap["Custo de Manutenção"] = parseFloat(avgCustoRealizado.toFixed(2));

      // 2. MTTR, MTBF, MTTA, Disponibilidade Inerente
      const mceFilteredData = indicatorSource.filter(i => i.tam === "MCE");
      const targetMce = mceFilteredData.filter(i => matchMonthYear(i.mesAno));

      const mceEvents = new Set<string>();
      const mesMceItems = targetMce.filter(i => {
        if (mceEvents.has(i.ordemServico)) return false;
        mceEvents.add(i.ordemServico);
        return operationalPlates.has(i.placa) && i.dataEntradaOficina && i.dataRetiradaOficina;
      });

      let totalDowntime = 0, countMce = 0;
      mesMceItems.forEach(i => {
        const e = parseDate(i.dataEntradaOficina), s = parseDate(i.dataRetiradaOficina);
        if (e && s && differenceInDays(s, e) >= 0) {
          totalDowntime += differenceInDays(s, e);
          countMce++;
        }
      });
      const mttr = countMce > 0 ? (totalDowntime / countMce) : 0;
      valuesMap["MTTR"] = parseFloat(mttr.toFixed(1));

      // MTBF
      const mesMceFiltered = mceFilteredData.filter(i => matchMonthYear(i.mesAno));
      const plateStats = new Map<string, { downtime: number; count: number }>();
      mesMceFiltered.forEach(i => {
        const e = parseDate(i.dataEntradaOficina);
        const r = parseDate(i.dataRetiradaOficina);
        const days = (e && r) ? Math.max(0, differenceInDays(r, e)) : 0;
        
        const stats = plateStats.get(i.placa) || { downtime: 0, count: 0 };
        stats.downtime += days;
        stats.count += 1;
        plateStats.set(i.placa, stats);
      });

      let mtbf = 0;
      if (plateStats.size > 0) {
        let totalMtbfVal = 0;
        plateStats.forEach((stats) => {
          const vMtbf = (30 - stats.downtime) / stats.count;
          totalMtbfVal += Math.max(0, vMtbf);
        });
        mtbf = totalMtbfVal / plateStats.size;
      }
      valuesMap["MTBF"] = parseFloat(mtbf.toFixed(1));

      // MTTA
      const ttaEvents = new Set<string>();
      const mesIndicatorItems = indicatorSource.filter(i => {
        if (!matchMonthYear(i.mesAno)) return false;
        if (ttaEvents.has(i.ordemServico)) return false;
        ttaEvents.add(i.ordemServico);
        return operationalPlates.has(i.placa) && i.dataEnvioOS && i.dataAprovacaoOS;
      });

      let totalTta = 0, countTta = 0;
      mesIndicatorItems.forEach(i => {
        const env = parseDate(i.dataEnvioOS), apr = parseDate(i.dataAprovacaoOS);
        if (env && apr && differenceInDays(apr, env) >= 0) {
          totalTta += differenceInDays(apr, env);
          countTta++;
        }
      });
      const mtta = countTta > 0 ? (totalTta / countTta) : 0;
      valuesMap["MTTA"] = parseFloat(mtta.toFixed(1));

      // Disponibilidade Inerente
      const dispInerente = (mtbf <= 0 || (mtbf + mttr) <= 0) ? 0 : (mtbf / (mtbf + mttr)) * 100;
      valuesMap["Disponibilidade Inerente"] = parseFloat(dispInerente.toFixed(1));

      // 3. Dias de Indisponibilidade (Locados)
      const targetLocados = locados.filter(item => matchMonthYear(item.mesAno));
      let totalDiasIndisponibilidade = 0;
      targetLocados.forEach(item => {
        const cleanPlaca = String(item.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (cleanPlaca.length === 7 && titularPlatesSet.has(cleanPlaca)) {
          totalDiasIndisponibilidade += (item.diasParados || 0);
        }
      });
      valuesMap["Dias de Indisponibilidade"] = totalDiasIndisponibilidade;

      // 4. Abastecimento Indicators
      const targetMonthYearStr = `${String(mIndex + 1).padStart(2, "0")}/${yVal}`;
      const targetFuel = sanitizedFuelData.filter(f => f._monthYear === targetMonthYearStr);

      const totalCombustivel = targetFuel.reduce((sum, f) => sum + (f._litros || 0), 0);
      const custoTotal = targetFuel.reduce((sum, f) => sum + (f._total || 0), 0);

      const autonomiaRecords = targetFuel.map(f => f._autReal || 0).filter(v => v > 0);
      const avgAutonomiaReal = autonomiaRecords.length > 0 
        ? autonomiaRecords.reduce((a, b) => a + b, 0) / autonomiaRecords.length 
        : 0;

      const kmRecords = targetFuel.map(f => f._kmRodados || 0).filter(v => v > 0);
      const avgKmMedio = kmRecords.length > 0 
        ? kmRecords.reduce((a, b) => a + b, 0) / kmRecords.length 
        : 0;

      const precoRecords = targetFuel.map(f => f._vlLitro || 0).filter(v => v > 0);
      const avgPrecoLitro = precoRecords.length > 0 
        ? precoRecords.reduce((a, b) => a + b, 0) / precoRecords.length 
        : 0;

      valuesMap["Litros abastecidos"] = parseFloat(totalCombustivel.toFixed(1));
      valuesMap["Valor abastecido"] = parseFloat(custoTotal.toFixed(2));
      valuesMap["Preço Médio/Litro"] = parseFloat(avgPrecoLitro.toFixed(3));
      valuesMap["Autonomia Real Média"] = parseFloat(avgAutonomiaReal.toFixed(2));
      valuesMap["KM Médio"] = parseFloat(avgKmMedio.toFixed(1));

      // 4.1 Desvio de Consumo vs. Padrão
      const fuelAlertConfig = getFuelAlertConfig();
      const assetsByPlaca = new Map<string, any>();
      assets.forEach(a => {
        const p = String(a.PLACA || a.placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (p) assetsByPlaca.set(p, a);
      });

      let desviosAutonomiaCount = 0;
      targetFuel.forEach(f => {
        const placa = String(f._placa || f.PLACA || f.Placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (placa.startsWith("MAQ")) return;

        const asset = assetsByPlaca.get(placa);
        if (!asset) return;

        const tipoControleVal = asset["TIPO CONTROLE AUTONOMIA"] || 
                                asset["CONTROLE DE AUTONOMIA"] || 
                                asset["CONTROLE AUTONOMIA"] || 
                                asset.TIPO_CONTROLE_AUTONOMIA || 
                                (asset.__raw && asset.__raw[43]) || 
                                "";
        const tc = String(tipoControleVal).trim().toUpperCase();
        if (tc !== "FROTA" && tc !== "") return;

        const autReal = f._autReal || 0;
        const fuelType = f._fuelType || f["TIPO COMBUSTIVEL"] || f["TIPO COMBUSTÍVEL"] || "";
        
        if (autReal > 0) {
          const assetRaw = asset.__raw || [];
          const fuelPadraoAtivo = standardizeFuelType(assetRaw[11]);
          const fuelSecAtivo = standardizeFuelType(assetRaw[32]);
          
          let autRef = 0;
          const stdFuelType = standardizeFuelType(fuelType);
          if (stdFuelType === fuelPadraoAtivo) autRef = parseBrazilianNumber(assetRaw[28]);
          else if (stdFuelType === fuelSecAtivo) autRef = parseBrazilianNumber(assetRaw[33]);

          if (autRef > 0 && Math.abs(autReal - autRef) / autRef * 100 > fuelAlertConfig.autonomyDeviationPercent) {
            desviosAutonomiaCount++;
          }
        }
      });

      valuesMap["Desvio de Consumo vs. Padrão"] = desviosAutonomiaCount;

      // 5. Regularização - Infrações Recebidas no Mês
      let infractionsCount = 0;
      regularizacaoData.forEach(item => {
        const dateStr = String(item.__raw?.[8] || "");
        if (!dateStr || dateStr === "-") return;
        try {
          const parts = dateStr.split("/");
          if (parts.length >= 3) {
            const m = parseInt(parts[1]);
            const y = parseInt(parts[2]);
            if (m === (mIndex + 1) && y === yVal) {
              infractionsCount++;
            }
          }
        } catch {}
      });
      valuesMap["Infrações Recebidas no Mês"] = infractionsCount;

      // 5.1 Multas Pagas (Centro de Custo)
      const targetTitulos = titulosDespesasData.filter(item => {
        const mesAno = String(item.__raw?.[56] || "").replace(/\.\//g, "/").trim();
        const tipo = String(item.__raw?.[58] || "").trim().toUpperCase();
        return matchMonthYear(mesAno) && tipo === "MULTA";
      });
      
      const totalMultasPagas = targetTitulos.reduce((sum, item) => {
        const valorRaw = item.__raw?.[62];
        let valorTitulo = 0;
        if (valorRaw) {
          const cleanValue = String(valorRaw).replace(/R\$/gi, "").replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".");
          valorTitulo = parseFloat(cleanValue) || 0;
        }
        return sum + valorTitulo;
      }, 0);
      
      valuesMap["Multas Pagas (Centro de Custo)"] = parseFloat(totalMultasPagas.toFixed(2));

      // 5.2 CRLV Vencidos
      let crlvVencidosCount = 0;
      controleDocumentos.forEach(doc => {
        const hasAnexo = !!(doc.anexoCrlv && doc.anexoCrlv.trim().length > 5);
        if (!hasAnexo) {
          crlvVencidosCount++;
          return;
        }
        
        let docYear = "2025";
        if (doc.statusCrlv && doc.statusCrlv.trim().length > 0) {
          docYear = doc.statusCrlv.trim();
        } else {
          const plate = doc.placa.trim().toUpperCase();
          if (crlvYears[plate]) {
            docYear = crlvYears[plate];
          } else {
            const prop = String(doc.propriedade || "").trim().toUpperCase();
            if (prop.includes("COMPESA") || prop.includes("CS BRASIL")) {
              docYear = "2026";
            }
          }
        }
        
        if (docYear !== "2026") {
          crlvVencidosCount++;
        }
      });
      
      valuesMap["CRLV Vencidos"] = crlvVencidosCount;

      results[monthKey] = valuesMap;
    });

    return results;
  }, [allAvailableMonths, custosData, indicatorSource, operationalPlates, locados, veiculosDisponiveisData, sanitizedFuelData, regularizacaoData, titulosDespesasData, controleDocumentos, crlvYears]);

  const combinedIndicatorValues = useMemo(() => {
    let list = [...allIndicatorValues];

    AUTO_INDICATORS_SPECS.forEach(spec => {
      const ind = combinedIndicators.find(i => 
        i.name.trim().toLowerCase() === spec.name.trim().toLowerCase() &&
        i.section === spec.section &&
        i.subsection === spec.subsection
      );
      if (!ind) return;

      const customValsForThisInd = list.filter(v => v.indicator_id === ind.id);
      list = list.filter(v => v.indicator_id !== ind.id);
      
      allAvailableMonths.forEach(monthKey => {
        const val = allCalculatedAutoValues[monthKey]?.[spec.name] ?? 0;
        const customVal = customValsForThisInd.find(v => v.month === monthKey);
        const targetVal = customVal && customVal.target !== undefined ? customVal.target : ind.target;

        list.push({
          id: customVal?.id || `auto-val-${ind.id}-${monthKey}`,
          indicator_id: ind.id,
          month: monthKey,
          current_value: val,
          target: targetVal
        });
      });
    });

    return list;
  }, [allIndicatorValues, combinedIndicators, allAvailableMonths, allCalculatedAutoValues]);

  const indicatorValuesForMonth = useMemo(() => {
    const targetMonthStr = format(safeSelectedMonth, "yyyy-MM-01");
    return combinedIndicatorValues.filter(v => v.month === targetMonthStr);
  }, [combinedIndicatorValues, safeSelectedMonth]);

  const indicatorsWithMonthValues = useMemo(() => {
    return combinedIndicators.map((indicator) => {
      const monthValue = indicatorValuesForMonth.find((v) => v.indicator_id === indicator.id);
      return {
        ...indicator,
        current_value: monthValue ? monthValue.current_value : 0,
        target: monthValue ? monthValue.target : indicator.target,
        value_id: monthValue?.id,
      };
    });
  }, [combinedIndicators, indicatorValuesForMonth]);

  const allEntries = useMemo(() => {
    return combinedIndicatorValues.map(val => {
      const indicator = combinedIndicators.find(i => i.id === val.indicator_id);
      if (!indicator) return null;
      return {
        ...indicator,
        ...val,
        value_id: val.id,
        id: indicator.id
      };
    }).filter(e => e !== null)
    .sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name));
  }, [combinedIndicatorValues, combinedIndicators]);

  const getIndicatorsBySection = (sectionId: string, subsection?: string) => {
    return indicatorsWithMonthValues.filter(
      (ind) =>
        ind.section === sectionId &&
        (subsection ? ind.subsection === subsection : !ind.subsection)
    );
  };

  const getKanbanStats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const progress = tasks.filter((t) => t.status === "progress").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const done = tasks.filter((t) => t.status === "done").length;

    return {
      total,
      todo,
      progress,
      review,
      done,
      completion: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [tasks]);

  const handleAddIndicator = (sectionId: string, subsection?: string) => {
    setEditingIndicator({ section: sectionId, subsection });
    setDialogOpen(true);
  };

  const handleEditIndicator = (indicator: any) => {
    setEditingIndicator(indicator);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-indigo-600 font-black uppercase tracking-widest animate-pulse italic">
          Carregando Gestão à Vista...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={onBack} 
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-900/20 rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest pl-2 pr-6 h-12 transition-all group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline">Voltar ao Início</span>
            </Button>
            <img 
              src={cgfLogo} 
              alt="Nexus BI Logo" 
              className="h-12 w-auto drop-shadow-sm" 
              onError={(e) => {
                e.currentTarget.src = "https://placehold.co/100x40/6366f1/ffffff?text=NEXUS+BI";
              }}
            />
            <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="hidden md:block">
              <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none text-slate-800 dark:text-white">
                Gestão à Vista
              </h1>
              <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">
                Monitoramento Estratégico Nexus Frota BI
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <Button 
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all", 
                  viewMode === "grid" ? "bg-indigo-600 shadow-lg text-white" : "text-slate-500 hover:text-indigo-600"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Painel Visual
              </Button>
              <Button 
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all", 
                  viewMode === "table" ? "bg-indigo-600 shadow-lg text-white" : "text-slate-500 hover:text-indigo-600"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Planilha (Gerenciar)
              </Button>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Referência:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black uppercase text-[10px] tracking-widest h-10 rounded-xl px-4 flex items-center gap-2 shadow-sm"
                >
                  <CalendarIcon className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                  {format(safeSelectedMonth, "MMMM / yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl" align="end">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Tabs defaultValue="manutencao" className="space-y-8">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 h-12 rounded-2xl w-full flex overflow-x-auto gap-1 shadow-sm">
            {sections.map((section) => (
              <TabsTrigger 
                key={section.id} 
                value={section.id}
                className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap px-4"
              >
                {section.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="space-y-8 outline-none">
              {section.id === "dashboard" ? (
                <PrintDashboard
                  indicators={indicatorsWithMonthValues}
                  allIndicatorValues={allIndicatorValues}
                  tasks={tasks}
                  responsibles={responsibles}
                  selectedMonth={selectedMonth}
                  onEditIndicator={handleEditIndicator}
                />
              ) : section.id === "kanban" ? (
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                  <CardHeader className="p-8 border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-xl font-black uppercase text-slate-800 dark:text-white">Status Consolidado Kanban</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-slate-800 dark:text-white italic">{getKanbanStats.total}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Demandas</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-amber-500 italic">{getKanbanStats.todo}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">A Fazer</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-blue-500 italic">{getKanbanStats.progress}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Em Execução</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-indigo-500 italic">{getKanbanStats.review}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revisão</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-emerald-500 italic">{getKanbanStats.done}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Concluídas</div>
                      </div>
                    </div>
                    <div className="mt-12 space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Índice de Produtividade</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 italic">{getKanbanStats.completion}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-200 dark:border-white/5 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                          style={{ width: `${getKanbanStats.completion}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {viewMode === "table" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <div>
                            <h2 className="text-lg font-black uppercase text-slate-800 dark:text-white tracking-widest leading-none">
                              Planilha de Lançamento
                            </h2>
                            <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mt-1">
                              Referência: {format(safeSelectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAddIndicator(section.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 font-black uppercase text-[10px] tracking-widest h-10 shadow-lg"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Indicador
                        </Button>
                      </div>

                      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow className="border-slate-100 dark:border-white/5">
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Indicador</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Responsável</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-600 py-4">Resultado Atual</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Meta</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 text-center">Status</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {indicatorsWithMonthValues
                              .filter(ind => ind.section === section.id)
                              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                              .map((indicator) => {
                                const isFilled = !!indicator.value_id;
                                const achieved = indicator.goal_type === "lower" 
                                  ? indicator.current_value <= indicator.target 
                                  : indicator.current_value >= indicator.target;
                                const responsible = responsibles.find(r => r.id === indicator.responsible_id);
                                
                                return (
                                  <TableRow key={indicator.id} className="border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                    <TableCell className="py-4">
                                      <div className="font-bold text-slate-800 dark:text-white uppercase text-xs">{indicator.name}</div>
                                      {indicator.subsection && (
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{indicator.subsection}</div>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-4">
                                      <div className="text-[10px] font-medium text-slate-500 uppercase">
                                        {responsible?.name || "Não definido"}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                      <div className={cn(
                                        "font-black italic text-sm",
                                        isFilled ? "text-indigo-600 dark:text-indigo-400" : "text-slate-300 dark:text-slate-700"
                                      )}>
                                        {indicator.current_value}{indicator.unit}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-4 font-bold text-slate-600 dark:text-slate-400">
                                      {indicator.target}{indicator.unit}
                                    </TableCell>
                                    <TableCell className="py-4 text-center">
                                      {isFilled ? (
                                        <div className={cn(
                                          "flex items-center justify-center gap-1.5 font-black text-[9px] uppercase",
                                          achieved ? "text-emerald-500" : "text-rose-500"
                                        )}>
                                          {achieved ? (
                                            <><div className="w-1 h-1 rounded-full bg-emerald-500" /> ✓ Dentro da Meta</>
                                          ) : (
                                            <><div className="w-1 h-1 rounded-full bg-rose-500" /> ✗ Fora da Meta</>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase text-slate-300">Pendente</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {indicator.is_auto ? (
                                          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none font-black text-[8px] uppercase tracking-wider py-1 px-2.5 rounded-lg">
                                            Automático
                                          </Badge>
                                        ) : (
                                          <>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => handleEditIndicator(indicator)}
                                              className={cn(
                                                "h-8 px-3 font-black text-[9px] uppercase tracking-widest rounded-lg transition-all",
                                                isFilled 
                                                  ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-white/5" 
                                                  : "text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                              )}
                                            >
                                              {isFilled ? "Alterar" : "Lançar"}
                                            </Button>

                                            {isFilled && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteValue(indicator.value_id, indicator.name)}
                                                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                                title="Excluir lançamento deste mês"
                                              >
                                                <CalendarX className="h-4 w-4" />
                                              </Button>
                                            )}

                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteIndicator(indicator.id, indicator.name)}
                                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 pr-1"
                                              title="Excluir indicador cadastrado"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </Card>

                      <div className="pt-8 border-t border-slate-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Histórico de LançamentosAnteriores</h3>
                        </div>
                        <Card className="bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
                          <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
                              <TableRow className="border-slate-100 dark:border-white/5">
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3">Mês/Ano</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3">Indicador</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3">Realizado</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 text-right">Ação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                               {allEntries
                                .filter(e => e.section === section.id && getMonthStr(e.month).substring(0, 7) !== format(safeSelectedMonth, "yyyy-MM"))
                                .slice(0, 10)
                                .map((entry) => (
                                  <TableRow key={entry.value_id} className="border-slate-100 dark:border-white/5 opacity-70 hover:opacity-100 transition-opacity group">
                                    <TableCell className="py-2">
                                      <span className="text-[9px] font-black uppercase text-slate-500">
                                        {format(parseMonthStr(entry.month), "MMM / yy", { locale: ptBR })}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                      {entry.name}
                                    </TableCell>
                                    <TableCell className="py-2 text-[10px] font-black text-indigo-500 italic">
                                      {entry.current_value}{entry.unit}
                                    </TableCell>
                                    <TableCell className="py-2 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {entry.is_auto ? (
                                          <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Auto</span>
                                        ) : (
                                          <>
                                            <Button 
                                              variant="ghost" 
                                              size="xs"
                                              onClick={() => {
                                                setSelectedMonth(parseMonthStr(entry.month));
                                                handleEditIndicator(entry);
                                              }}
                                              className="h-6 text-[8px] font-black uppercase"
                                            >
                                              Ver
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteHistoryValue(entry.value_id, entry.name)}
                                              className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                              title="Excluir este lançamento histórico"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <>
                  {section.subsections ? (
                    section.subsections.map((subsection) => (
                      <div key={subsection} className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                          <h2 className="text-lg font-black uppercase text-slate-800 dark:text-white tracking-widest flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            {subsection}
                          </h2>
                          <Button
                            onClick={() => handleAddIndicator(section.id, subsection)}
                            className="bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest h-10 shadow-sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Indicador
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {getIndicatorsBySection(section.id, subsection).map(
                            (indicator) => (
                              <IndicatorChart
                                key={indicator.id}
                                indicator={indicator}
                                onEdit={handleEditIndicator}
                                responsibles={responsibles}
                                selectedMonth={selectedMonth}
                                historyValues={allIndicatorValues.filter(
                                  (v) => v.indicator_id === indicator.id
                                )}
                              />
                            )
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <h2 className="text-lg font-black uppercase text-slate-800 dark:text-white tracking-widest flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          {section.name}
                        </h2>
                        <Button
                          onClick={() => handleAddIndicator(section.id)}
                          className="bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest h-10 shadow-sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Indicador
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {getIndicatorsBySection(section.id).map((indicator) => (
                          <IndicatorChart
                            key={indicator.id}
                            indicator={indicator}
                            onEdit={handleEditIndicator}
                            responsibles={responsibles}
                            selectedMonth={selectedMonth}
                            historyValues={allIndicatorValues.filter(
                              (v) => v.indicator_id === indicator.id
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <IndicatorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          indicator={editingIndicator}
          selectedMonth={selectedMonth}
          onClose={() => {
            setDialogOpen(false);
            setEditingIndicator(null);
          }}
        />
      </div>
    </div>
  );
};

export default GestaoVista;
