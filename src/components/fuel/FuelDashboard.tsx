import { useManagersData } from "@/hooks/useManagersData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { FuelFilterBar } from "./FuelFilterBar";
import { Fuel, DollarSign, Droplets, Download, Activity, ChevronDown, ChevronUp, Info, FileText, Mail, Send, AlertTriangle, Hash, TrendingUp, Layers, Calendar, Share2, MapPin, Tag, Building2, Brain, Sparkles, Cpu, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAlertaValeData } from "@/hooks/useAlertaValeData";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { Button } from "@/components/ui/button";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Scatter,
} from "recharts";
import { FuelJustificationsTab } from "./FuelJustificationsTab";
import { FuelAlertConfigTab } from "./FuelAlertConfigTab";
import AbastTelemetriaTab from "./AbastTelemetriaTab";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { FuelData, Asset, AutonomiaData, AutonomiaPadraoData, MaintenanceCostData, MaintenanceData } from "@/types";
import { useState, useMemo, useEffect, useRef } from "react";
import { getFuelAlertConfig } from "@/types/alertConfig";
import { analisarAbastecimento, FuelTransaction } from "@/lib/fuelAlertLogic";
import { useLocadosData } from "@/hooks/useLocadosData";
import { useContactsData } from "@/hooks/useContactsData";
import { getCCEmails } from "@/components/dashboards/ContactsManager";
import { EmailRecipientsEditor } from "@/components/dashboards/EmailRecipientsEditor";
import { buildDetalhesDesvios, buildDetalhesDesviosByType } from "@/lib/buildDetalhesDesvios";
import { buildDetailedAlertSheets } from "@/lib/buildDetailedAlertSheets";
import { deduplicateFuelTransactions } from "@/lib/fuelTransactionsDedup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

import { SupplyPerformanceDashboard } from './SupplyPerformanceDashboard';

import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

import { MachineSupplyIndicators } from './MachineSupplyIndicators';
import MachineSupplyReport from './MachineSupplyReport';

interface FuelDashboardProps {
  fuel: FuelData[];
  assets: Asset[];
  autonomia: AutonomiaData[];
  autonomiaPadrao: AutonomiaPadraoData[];
  maintenanceCost: MaintenanceCostData[];
  maintenance: MaintenanceData[];
  desviosOnly?: boolean;
  initialTab?: string;
  userRole?: string;
  isLoading?: boolean;
}

// Função auxiliar para parsear números brasileiros (trata separadores de milhar e decimal)
const parseBrazilianNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let s = String(val).trim().replace(/[R$\s]/g, '');
  
  // Se for uma string como "1.125,00"
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Apenas vírgula: "1234,56"
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    // Apenas ponto: pode ser milhar "1.234" ou decimal "1.234" (se for americano)
    // Na base Vale/Ticket Log, ponto geralmente é milhar se houver 3 dígitos após.
    const parts = s.split('.');
    if (parts[parts.length - 1].length === 3 && parts.length > 1) {
      s = s.replace(/\./g, '');
    }
  }
  
  return parseFloat(s) || 0;
};

// Função para converter Excel Serial Date para Date de JS
const excelDateToJSDate = (serial: number) => {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
};

// Função auxiliar para padronizar a data para AAAA-MM-DDTHH:mm:ss
const getFormattedDate = (dateString: any): string | null => {
  if (!dateString) return null;
  try {
    const toLocalISOString = (d: Date) => {
      if (!isValid(d)) return null;
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    if (dateString instanceof Date) return toLocalISOString(dateString);

    if (typeof dateString === 'number' && dateString > 40000 && dateString < 70000) {
      return toLocalISOString(excelDateToJSDate(dateString));
    }

    let s = String(dateString).trim();
    
    // Excel serial as string
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const num = parseFloat(s);
      if (num > 40000 && num < 70000) return toLocalISOString(excelDateToJSDate(num));
    }

    // YYYY-MM-DD
    const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})(T|\s+)?(\d{2}:\d{2}(:\d{2})?)?/);
    if (isoMatch) {
      if (!isoMatch[4]) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`;
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[5] || "00:00:00"}`;
    }

    // DD/MM/YYYY
    const dmyMatch = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(\s+(\d{1,2}):(\d{1,2})(:( \d{1,2}))?)?/);
    if (dmyMatch) {
      let day = dmyMatch[1].padStart(2, '0');
      let month = dmyMatch[2].padStart(2, '0');
      let year = dmyMatch[3];
      if (year.length === 2) year = '20' + year;
      let hour = dmyMatch[5] ? dmyMatch[5].padStart(2, '0') : "00";
      let min = dmyMatch[6] ? dmyMatch[6].padStart(2, '0') : "00";
      let sec = dmyMatch[8] ? dmyMatch[8].trim().padStart(2, '0') : "00";
      return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    }

    const ymdMatch = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(\s+(\d{1,2}):(\d{1,2})(:( \d{1,2}))?)?/);
    if (ymdMatch) {
      let year = ymdMatch[1];
      let month = ymdMatch[2].padStart(2, '0');
      let day = ymdMatch[3].padStart(2, '0');
      let hour = ymdMatch[5] ? ymdMatch[5].padStart(2, '0') : "00";
      let min = ymdMatch[6] ? ymdMatch[6].padStart(2, '0') : "00";
      let sec = ymdMatch[8] ? ymdMatch[8].trim().padStart(2, '0') : "00";
      return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    }

    // Fallback: tenta parsear com Date nativo
    const dateObj = new Date(dateString);
    if (!isNaN(dateObj.getTime())) {
      return toLocalISOString(dateObj);
    }

    return null;
  } catch (e) {
    return null;
  }
};

  // Função auxiliar para extrair mês/ano da data formatada (evita problemas de timezone)
  const getMonthYearFromFormattedDate = (formattedDate: string): { mes: string; ano: string; mesAno: string } | null => {
    const base = formattedDate?.slice(0, 10);
    if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) return null;
    const [yearStr, monthStr] = base.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    if (monthIndex < 0 || monthIndex > 11) return null;
    const mes = meses[monthIndex];
    const ano = yearStr.slice(-2);
    return { mes, ano, mesAno: `${mes}/${ano}` };
  };

  const normalizeMonthYear = (val: string): string => {
    if (!val || val === "N/A") return "N/A";
    const v = val.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Extract year if present, otherwise default to current year
    const yearMatch = val.match(/\d{2,4}$/);
    const yearPart = yearMatch ? yearMatch[0].slice(-2) : format(new Date(), 'yy');

    if (v.includes("janeiro") || v.includes("jan")) return `Jan/${yearPart}`;
    if (v.includes("fevereiro") || v.includes("fev")) return `Fev/${yearPart}`;
    if (v.includes("marco") || v.includes("mar")) return `Mar/${yearPart}`;
    if (v.includes("abril") || v.includes("abr")) return `Abr/${yearPart}`;
    if (v.includes("maio") || v.includes("mai")) return `Mai/${yearPart}`;
    if (v.includes("junho") || v.includes("jun")) return `Jun/${yearPart}`;
    if (v.includes("julho") || v.includes("jul")) return `Jul/${yearPart}`;
    if (v.includes("agosto") || v.includes("ago")) return `Ago/${yearPart}`;
    if (v.includes("setembro") || v.includes("set")) return `Set/${yearPart}`;
    if (v.includes("outubro") || v.includes("out")) return `Out/${yearPart}`;
    if (v.includes("novembro") || v.includes("nov")) return `Nov/${yearPart}`;
    if (v.includes("dezembro") || v.includes("dez")) return `Dez/${yearPart}`;

    const match = v.match(/(\d{1,2})\/(\d{2,4})/);
    if (match) {
      const m = parseInt(match[1]);
      const y = match[2].slice(-2);
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      if (m >= 1 && m <= 12) return `${meses[m-1]}/${y}`;
    }

    return val;
  };

// Função auxiliar para formatar data em pt-BR a partir da string formatada (evita problemas de timezone)
const formatDateToPtBR = (formattedDate: string): string => {
  const base = formattedDate?.slice(0, 10);
  if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) return '';
  const [year, month, day] = base.split('-');
  return `${day}/${month}/${year}`;
};

// Função auxiliar para formatar data + hora em pt-BR (DD/MM/AAAA HH:mm)
const formatDateTimePtBRLocal = (dateString: string | undefined, horaString?: string | undefined): string => {
  if (!dateString) return 'N/A';
  const str = String(dateString).trim();
  const hora = horaString ? String(horaString).trim() : '';

  let datePart = '';
  let timePart = '';

  if (/^\d{2}[/-]\d{2}[/-]\d{4}\s+\d{2}:\d{2}/.test(str)) {
    datePart = str.substring(0, 10).replace(/-/g, '/');
    timePart = str.substring(11, 16);
  } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(str)) {
    datePart = str.replace(/-/g, '/');
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
    const parts = str.substring(0, 10).split('-');
    datePart = `${parts[2]}/${parts[1]}/${parts[0]}`;
    timePart = str.substring(11, 16);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    datePart = `${parts[2]}/${parts[1]}/${parts[0]}`;
  } else {
    datePart = str;
  }

  if (hora && /\d{2}:\d{2}/.test(hora)) {
    timePart = hora.substring(0, 5);
  }

  return timePart ? `${datePart} ${timePart}` : datePart;
};

// Função auxiliar para padronizar o tipo de combustível
const standardizeFuelType = (fuelType: string | undefined): string => {
  if (!fuelType) return "N/A";
  const fuel = String(fuelType).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (fuel.includes("GASOLINA ADITIVADA")) return "GASOLINA ADITIVADA";
  if (fuel.includes("GASOLINA")) return "GASOLINA COMUM";
  if (fuel.includes("DIESEL S10") || fuel.includes("DIESEL S-10") || fuel.includes("S-10 COMUM")) return "DIESEL S10";
  if (fuel.includes("DIESEL")) return "DIESEL COMUM";
  if (fuel.includes("ETANOL") || fuel.includes("ALCOOL")) return "ETANOL";
  if (fuel.includes("GAS NATURAL") || fuel.includes("GNV")) return "GAS NATURAL";
  if (fuel.includes("ARLA")) return "ARLA 32";
  
  return fuelType;
};

export const FuelDashboard = ({ fuel, assets, autonomia, autonomiaPadrao, maintenanceCost, maintenance, desviosOnly = false, initialTab, userRole, isLoading }: FuelDashboardProps) => {
  // Hook para dados de locados (veículos em manutenção)
  const { data: locadosData = [] } = useLocadosData();
  
  // Hook para dados de contatos por gerência (Planilha externa)
  const { getManagerEmail, loading: managersLoading } = useManagersData();
  
  // Hook para dados de contatos por gerência (Base local)
  const { getEmailsByGerencia, contactsData } = useContactsData();
  
  // Hook para dados de Alerta Vale (da planilha separada)
  const { data: alertaValeData = [] } = useAlertaValeData();
  
  // Inicializar filtro de mês: vazio para desviosOnly (mostra linha do tempo completa), Dez/25 para dashboard geral
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [selectedVehicleModels, setSelectedVehicleModels] = useState<string[]>([]);
  const [searchPlaca, setSearchPlaca] = useState<string>("");
  const [selectedDirectorias, setSelectedDirectorias] = useState<string[]>([]);
  const [selectedGerencias, setSelectedGerencias] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedMonthsYears, setSelectedMonthsYears] = useState<string[]>([]);
  const [selectedRegioes, setSelectedRegioes] = useState<string[]>([]);
  const [selectedCidades, setSelectedCidades] = useState<string[]>([]);
  const [selectedPropriedades, setSelectedPropriedades] = useState<string[]>([]);
  const [selectedTitularidades, setSelectedTitularidades] = useState<string[]>([]);
  const [selectedAlerta, setSelectedAlerta] = useState<string[]>([]);
  const [selectedAlertaAutonomia, setSelectedAlertaAutonomia] = useState<string[]>([]);
  const [selectedAlertaKmHora, setSelectedAlertaKmHora] = useState<string[]>([]);
  const [selectedAlertaLitros, setSelectedAlertaLitros] = useState<string[]>([]);
  const [selectedAlertaItem, setSelectedAlertaItem] = useState<string[]>([]);
  const [selectedParecerNexus, setSelectedParecerNexus] = useState<string[]>([]);
  const [selectedTipoControleAutonomia, setSelectedTipoControleAutonomia] = useState<string[]>([]);
  const [selectedAlertaValorLitro, setSelectedAlertaValorLitro] = useState<string[]>([]);
  const [selectedAlertaVale, setSelectedAlertaVale] = useState<string[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showAllAlertCards, setShowAllAlertCards] = useState(false);
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [showAllCondutores, setShowAllCondutores] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<Date | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearchPlaca, setDebouncedSearchPlaca] = useState(searchPlaca);
  const [mlDriverSearch, setMlDriverSearch] = useState("");
  const [mlAnomalySearch, setMlAnomalySearch] = useState("");
  const [selectedRegressionPlaca, setSelectedRegressionPlaca] = useState<string>("");
  const [mlSubTab, setMlSubTab] = useState<"motoristas" | "regressao" | "alertas">("motoristas");

  // Pagination states for ML views
  const [mlEfficientPage, setMlEfficientPage] = useState(1);
  const [mlIntermediatePage, setMlIntermediatePage] = useState(1);
  const [mlHighPage, setMlHighPage] = useState(1);
  const [mlRegressionPage, setMlRegressionPage] = useState(1);
  const [mlAnomaliesPage, setMlAnomaliesPage] = useState(1);

  // Reset ML pages when search criteria change
  useEffect(() => {
    setMlEfficientPage(1);
    setMlIntermediatePage(1);
    setMlHighPage(1);
  }, [mlDriverSearch]);

  useEffect(() => {
    setMlAnomaliesPage(1);
  }, [mlAnomalySearch]);

  // Debounce search placa to avoid excessive re-render while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchPlaca(searchPlaca);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchPlaca]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFuelTypes, selectedVehicleModels, debouncedSearchPlaca, selectedDirectorias, selectedGerencias, selectedTipos, selectedMonthsYears]);

  const [selectedDesviosChart, setSelectedDesviosChart] = useState<string[]>([
    'Autonomia', 'KM/Hora', 'Litros/m³', 'Item Abastecido', 'Dias s/ Abastecer', 'Valor/Litro', 'Alerta Vale'
  ]);
  
  const isGestaoOrMaster = useMemo(() => {
    const roleLower = (userRole || "").toLowerCase().trim();
    return roleLower === "master" || 
           roleLower === "gestão" || 
           roleLower === "gestao" || 
           roleLower === "master_cgf" || 
           roleLower === "coordenador" || 
           roleLower === "admin";
  }, [userRole]);
  
  // Estado para o modo de agrupamento na seção Top 10 Placas
  const [top10GroupMode, setTop10GroupMode] = useState<'individual' | 'agrupado'>('individual');
  // New state for grouping ranking by unit
  const [rankingGroupByUnit, setRankingGroupByUnit] = useState(false);
  // Estados movidos do IIFE para o nível do componente (regra dos hooks)
  const [top10Mode, setTop10Mode] = useState<'maiores_desvios' | 'mais_desvios'>('mais_desvios');
  const [selectedTop10Placa, setSelectedTop10Placa] = useState<string | null>(null);
  const [selectedDesvioExplaining, setSelectedDesvioExplaining] = useState<any | null>(null);
  
  // Estado para o dialog de seleção de gerência (Top 10 Sem Abastecer)
  const [semAbastecerEmailDialogOpen, setSemAbastecerEmailDialogOpen] = useState(false);
  const [semAbastecerGerenciaSelecionada, setSemAbastecerGerenciaSelecionada] = useState<string>("");

  // E-mails dos destinatários (baseado na gerência filtrada, mas editável)
  const [editedRecipients, setEditedRecipients] = useState<string[]>([]);
  const [hasEditedRecipients, setHasEditedRecipients] = useState(false);
  
  // Atualizar destinatários automaticamente quando a gerência muda
  const autoLoadedRecipients = useMemo(() => {
    if (selectedGerencias.length === 1) {
      return getEmailsByGerencia(selectedGerencias[0]);
    }
    if (selectedGerencias.length > 1) {
      const allEmails: string[] = [];
      selectedGerencias.forEach(g => {
        const emails = getEmailsByGerencia(g);
        allEmails.push(...emails);
      });
      return [...new Set(allEmails)];
    }
    return [];
  }, [selectedGerencias, getEmailsByGerencia, contactsData]);
  
  // Quando gerência muda, resetar para os destinatários automáticos
  useEffect(() => {
    setEditedRecipients(autoLoadedRecipients);
    setHasEditedRecipients(false);
  }, [autoLoadedRecipients]);
  
  // Usar os editados se foram modificados, senão os automáticos
  const selectedEmailRecipients = hasEditedRecipients ? editedRecipients : autoLoadedRecipients;
  
  const handleRecipientsChange = (emails: string[]) => {
    setEditedRecipients(emails);
    setHasEditedRecipients(true);
  };
  
  const handleSendEmail = (gerencia: string, vehicles: any[]) => {
    // 1. Gerar e baixar planilha de apoio
    const placas = vehicles.map(v => v.placa);
    // Filtrar transações originais para estas placas
    const relevantTxs = filteredFuel.filter(f => placas.includes(String(f._placa || f.PLACA || f.Placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase()));
    // Filtrar desvios para estas placas
    const relevantDesvios = fuelAnalysis.desvios.filter(d => placas.includes(d.placa));

    const abastData = relevantTxs.map(f => {
      const raw = (f as any).__raw || [];
      return {
        "Cód. Transação": raw[0] || f._txId || f["CODIGO TRANSACAO"] || f["Nº TRANSACAO"] || f.COL_0 || "N/A",
        "Data Transação": f["DATA TRANSACAO"] || f._date || raw[4] || f.COL_4 || "N/A",
        "Placa": f._placa || f.PLACA || f.Placa || raw[5] || f.COL_5 || "N/A",
        "Modelo Veículo": f["MODELO VEICULO"] || raw[10] || f.COL_10 || f._vehicleModel || "N/A",
        "Nome Motorista": f["NOME MOTORISTA"] || raw[11] || f.COL_11 || f._driver || "N/A",
        "Serviço": f["SERVICO"] || f["SERVIÇO"] || raw[12] || f.COL_12 || "N/A",
        "Tipo Combustível": f._fuelType || f["TIPO COMBUSTIVEL"] || raw[13] || f.COL_13 || "N/A",
        "Litros": parseBrazilianNumber(f.LITROS || raw[14] || f.COL_14 || 0),
        "VL/Litro": parseBrazilianNumber(f["VALOR UNITARIO"] || f["VL/UNITARIO"] || raw[15] || f.COL_15 || f._vlLitro || 0),
        "Hodometro ou Horimetro": f["ODOMETRO/HORIMETRO"] || raw[20] || f.COL_20 || f._odometer || "N/A",
        "Km Rodados ou Horas Trabalhadas": parseBrazilianNumber(f["KM RODADOS OU HORAS TRABALHADAS"] || raw[39] || f.COL_39 || f._kmRodados || 0),
        "Valor Emissão": parseBrazilianNumber(f["VALOR EMISSAO"] || raw[17] || f.COL_17 || f._total || 0),
        "Nome Estabelecimento": f._establishment || f._posto || f["NOME ESTABELECIMENTO"] || f["NOME POSTO"] || raw[21] || f.COL_21 || "N/A",
        "Endereço": f._endereco || f["ENDERECO"] || f["ENDEREÇO"] || raw[23] || f.COL_23 || "N/A",
        "Bairro": f._bairro || f["BAIRRO"] || raw[24] || f.COL_24 || "N/A",
        "Cidade": f._cidade || f["CIDADE"] || raw[25] || f.COL_25 || "N/A",
        "Informação Adicional 1": raw[27] || f["INFORMACAO ADICIONAL 1"] || f["INFORMAÇÃO ADICIONAL 1"] || f.COL_27 || "N/A",
        "Informação Adicional 2": raw[28] || f["INFORMACAO ADICIONAL 2"] || f["INFORMAÇÃO ADICIONAL 2"] || f.COL_28 || "N/A",
        "Informação Adicional 3": raw[29] || f["INFORMACAO ADICIONAL 3"] || f["INFORMAÇÃO ADICIONAL 3"] || f.COL_29 || "N/A",
        "Número Cartão": raw[35] || f["NUMERO CARTAO"] || f["N CARTAO"] || f["CARTAO"] || f.COL_35 || "N/A"
      };
    });

    const analiseData = relevantDesvios.map(d => ({
      "Nome do Alerta": d.tipo,
      "C\u00F3d. Transa\u00E7\u00E3o": d.descricao.split('|')[0].replace('C\u00F3d. Transa\u00E7\u00E3o:', '').trim(),
      "An\u00E1lise": d.descricao
    }));

    const sheets = [
      { data: abastData, sheetName: `Abast - ${gerencia}` },
      { data: analiseData, sheetName: `Desvios - ${gerencia}` }
    ];

    exportToExcelMultiSheet(sheets, `Analise_Desvios_${gerencia.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}`);
    toast.success("Planilha excel gerada! Por favor, anexe o arquivo baixado ao e-mail.");

    // 2. Abrir Mailto
    const emails = getEmailsByGerencia(gerencia);
    const cc = "gadabastecimento@compesa.com.br;gadmonitoramento@compesa.com.br";
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toRaw = getEmailsByGerencia(gerencia);
    const toFiltered = toRaw.filter(e => !ccList.includes(e.trim().toLowerCase()));
    
    const subject = `Solicitação de Painéis - Análise de Desvios de Abastecimento - ${gerencia}`;
    
    const periodoFiltro = dateFrom && dateTo 
      ? `${format(dateFrom, "dd/MM/yy")} a ${format(dateTo, "dd/MM/yy")}` 
      : "Período Recente";

    const listaVeiculos = vehicles.map(v => `• Placa: ${v.placa} | Modelo: ${v.modelo} | Tipo: ${v.tipo} | Unidade: ${v.unidade}`).join("\n");

    const body = `Prezado(a) Gestor(a),
 
Considerando os abastecimentos registrados no período de ${periodoFiltro} e o relatório de desvios EM ANEXO (Planilha Excel), solicitamos o envio das fotos dos painéis atualizados dos veículos listados abaixo.
 
As imagens devem conter, de forma legível:
• Odômetro/Horímetro atual
• Quantitativo do nível do tanque (medidor de nível, localizado no painel do veículo)
• Indicador de nível GNV ( marcador de nível / relógio marcador GNV )
 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
${listaVeiculos}
 
Favor consultar a planilha em anexo para detalhes sobre os desvios identificados (Abas: Relatório Abastecimento e Análise de Desvios).
 
Informamos que o prazo para envio é de até 2 (dois) dias. Caso não haja resposta dentro desse período, o bloqueio será realizado.
 
Permanecemos à disposição para esclarecimentos.
 
Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;

    const mailto = `mailto:${encodeURIComponent(toFiltered.join(";"))}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success("E-mail gerado com sucesso para " + gerencia);
  };

  const handleSendAnomalyEmail = (a: any, alertItem: any) => {
    const asset = assetsByPlaca.get(a.placa);
    const gerencia = asset?.GERENCIA || asset?.["GERÊNCIA"] || "Gestão Geral";
    const modelo = asset?.MODELO || asset?.modelo || "Não especificado";
    const placa = a.placa;
    const motorista = a.driver || "Não cadastrado";
    const dataAlerta = String(a.date).split(" ")[0];
    
    const emails = getEmailsByGerencia(gerencia);
    const cc = "gadmonitoramento@compesa.com.br";
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toFiltered = emails.filter(e => !ccList.includes(e.trim().toLowerCase()));
    
    const subject = `[CGF Alerta] Solicitação de Justificativa - Veículo ${placa} - Gerência ${gerencia}`;
    
    const body = `Prezado(a) Gestor(a),

Identificamos um alerta avançado no Monitoramento de Frotas (CGF - Machine Learning) referente ao veículo abaixo, sob responsabilidade desta Gerência.

Dados do Veículo e da Ocorrência:
• Veículo (Placa): ${placa}
• Modelo: ${modelo}
• Motorista: ${motorista}
• Data da Ocorrência: ${dataAlerta}
• Alerta Identificado: ${alertItem.rule}
• Detalhamento Técnico: ${alertItem.explanation}

Ação Solicitada:
Solicitamos, por gentileza, que envie uma justificativa formal para este desvio e anexe uma FOTO ATUALIZADA DO ODÔMETRO/PAINEL do veículo correspondente.

Pedimos que responda a este e-mail no prazo máximo de 2 (dois) dias úteis com as informações e imagem solicitadas para evitar o bloqueio preventivo do cartão de abastecimento.

Agradecemos a colaboração.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF
Companhia Pernambucana de Saneamento`;

    const mailto = `mailto:${encodeURIComponent(toFiltered.join(";"))}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success(`E-mail de notificação gerado para ${gerencia}!`);
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    
    // --- CLUSTERING SECTION ---
    csvContent += "--- CLUSTERING DE MOTORISTAS (K-MEANS) ---\n";
    csvContent += "Motorista;Média de Autonomia (Km/L);Variabilidade (Desvio Padrão);Perfil Classificado\n";
    
    driverClustering.forEach(d => {
      csvContent += `"${d.driver.replace(/"/g, '""')}";${d.meanKmL.toFixed(2).replace('.', ',')};${d.stdDevKmL.toFixed(2).replace('.', ',')};"${d.cluster.toUpperCase()}"\n`;
    });
    
    csvContent += "\n\n";
    
    // --- REGRESSION SECTION ---
    csvContent += "--- MODELOS DE REGRESSÃO POR VEÍCULO ---\n";
    csvContent += "Placa;Consumo Estimado (L/Km);Ajuste Fixo (L);R² (Coeficiente de Determinação)\n";
    
    Array.from(regressionModels.models.entries()).forEach(([placa, model]) => {
      csvContent += `"${placa}";${model.slope.toFixed(4).replace('.', ',')};${model.intercept.toFixed(2).replace('.', ',')};${model.r2.toFixed(4).replace('.', ',')}\n`;
    });
    
    csvContent += "\n\n";
    csvContent += "--- TOP 10 MAIORES RESÍDUOS POSITIVOS (RECOMPENSA/AVALIAÇÃO DE EXCESSO) ---\n";
    csvContent += "Placa;Data;Motorista;KM Percorrido;Litros Reais;Previsto (Regressão);Resíduo (Excesso em Litros)\n";
    
    regressionModels.top10PositiveResiduals.forEach(r => {
      csvContent += `"${r.placa}";"${String(r.date).split(' ')[0]}";"${r.driver.replace(/"/g, '""')}";${r.km_percorrido};${r.litros.toFixed(1).replace('.', ',')};${r.predY.toFixed(1).replace('.', ',')};${r.residual.toFixed(1).replace('.', ',')}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Analise_Avancada_ML_CGF_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR');

    // Title Page/Header
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text("Relatório Analytics & Machine Learning - CGF", 14, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${formattedDate}`, 14, 27);
    doc.text(`Análise: Agrupamento K-Means de Motoristas & Modelos de Regressão Linear de Consumo`, 14, 32);

    // Section 1: Clustering
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("1. Segmentação de Motoristas via K-Means (K=3)", 14, 42);
    
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text("Identificação de perfis operacionais com base no Km/L médio e variabilidade operacional (desvio padrão).", 14, 47);

    const clusterRows = driverClustering.map(d => [
      d.driver.toUpperCase(),
      `${d.meanKmL.toFixed(2)} Km/L`,
      `±${d.stdDevKmL.toFixed(2)}`,
      d.cluster.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 51,
      head: [["Motorista", "Média Autonomia (Km/L)", "Variabilidade (Desvio Padrão)", "Perfil"]],
      body: clusterRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' }
      }
    });

    // Add Page for Regressions
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text("2. Modelos de Regressão Linear por Veículo", 14, 20);
    
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text("Modelagem estatística do consumo real em função da distância percorrida para veículos com histórico suficiente.", 14, 25);

    const regressionRows = Array.from(regressionModels.models.entries()).map(([placa, model]) => [
      placa,
      `Litros = ${model.slope.toFixed(4)} × Km + ${model.intercept.toFixed(1)}`,
      `${model.slope.toFixed(4)} L/Km`,
      `R² = ${model.r2.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 29,
      head: [["Placa", "Equação do Modelo", "Consumo Estimado (L/Km)", "Coef. Determinação (R²)"]],
      body: regressionRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;

    doc.setFontSize(12);
    doc.setTextColor(225, 29, 72); // Rose
    doc.text("3. Top Maiores Resíduos Positivos Detectados (Alertas de Excesso)", 14, finalY);
    
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text("Abastecimentos reais com consumo de litros significativamente superior ao estimado pela regressão linear.", 14, finalY + 5);

    const residualRows = regressionModels.top10PositiveResiduals.map(r => [
      r.placa,
      String(r.date).split(' ')[0],
      r.driver.toUpperCase(),
      `${r.km_percorrido} km`,
      `${r.litros.toFixed(1)} L`,
      `${r.predY.toFixed(1)} L`,
      `+${r.residual.toFixed(1)} L`
    ]);

    autoTable(doc, {
      startY: finalY + 9,
      head: [["Placa", "Data", "Motorista", "KM Rodado", "Litros Reais", "Previsto (Modelo)", "Resíduo (Excesso)"]],
      body: residualRows,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 25, halign: 'center' },
        6: { cellWidth: 25, halign: 'center' }
      }
    });

    doc.save(`Relatorio_CGF_Analytics_ML_${formattedDate.replace(/[/:\s]/g, '_')}.pdf`);
    toast.success("Relatório PDF gerado com sucesso!");
  };

  const notifiedDeviationsRef = useRef<Set<string>>(new Set());

  // Criar mapa de correlação Placa -> Asset
  const assetsByPlaca = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach((asset) => {
      const p = asset.PLACA || asset.placa;
      if (p) {
        const cleanPlaca = String(p).replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (cleanPlaca) map.set(cleanPlaca, asset);
      }
    });
    return map;
  }, [assets]);

  // Lista de gerências únicas dos assets
  const allGerencias = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset) => {
      const gerencia = asset.GERENCIA || asset["GERÊNCIA"];
      if (gerencia) set.add(String(gerencia));
    });
    return Array.from(set).sort();
  }, [assets]);

  // Criar mapa de correlação Placa -> Autonomia Padrão
  const autonomiaPadraoByPlaca = useMemo(() => {
    const map = new Map<string, number>();
    
    // Fonte 1: aba de Autonomia Padrão
    autonomiaPadrao.forEach((auto) => {
      const placa = auto.PLACA || auto.Placa;
      const autonomiaValue = auto["AUTONOMIA PADRÃO (KM/LITRO OU HORA/LITRO)"];
      
      if (placa && autonomiaValue !== undefined && autonomiaValue !== null) {
        map.set(String(placa).toUpperCase(), Number(autonomiaValue));
      }
    });
    
    // Fonte 2 (fallback): base de Ativos
    assets.forEach((asset) => {
      const placa = asset.PLACA || asset.placa;
      const candidates = [
        asset["AUTONOMIA PADRÃO (KM/LITRO OU HORA/LITRO)"],
        asset["AUTONOMIA PADRAO (KM/LITRO OU HORA/LITRO)"],
        asset["AUTONOMIA PADRÃO"],
        asset["AUTONOMIA PADRAO"],
      ];
      const autonomiaFromAsset = candidates.find((v) => v !== undefined && v !== null && v !== '');
      if (placa && autonomiaFromAsset !== undefined && autonomiaFromAsset !== null && !map.has(String(placa).toUpperCase())) {
        const num = Number(String(autonomiaFromAsset).replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          map.set(String(placa).toUpperCase(), num);
        }
      }
    });
    
    return map;
  }, [autonomiaPadrao, assets]);

  // Atualizar timestamp quando os dados de combustível são carregados
  useEffect(() => {
    if (fuel.length > 0) {
      setDataUpdatedAt(new Date());
    }
  }, [fuel.length]);

  // -------------------------------------------------------------------------
  // PERFORMANCE OPTIMIZATION: PRE-PROCESS FUEL DATA
  // -------------------------------------------------------------------------
  const preProcessedFuel = useMemo(() => {
    const parseNumLocal = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const s = String(val).replace(',', '.').trim();
      return parseFloat(s) || 0;
    };

    return fuel.map(f => {
      const raw = (f as any).__raw || [];
      const txId = String(f._txId || raw[0] || f["Nº TRANSACAO"] || "N/A").replace(/\./g, '').split(',')[0].trim();
      
      const formattedDate = f._date ? getFormattedDate(f._date) : null;
      const monthYearData = formattedDate ? getMonthYearFromFormattedDate(formattedDate) : null;
      
      const _monthYearBase = normalizeMonthYear(String(f._monthYear || raw[41] || monthYearData?.mesAno || "N/A"));
      
      const rawPlaca = f._placa || f.PLACA || f.Placa || (f as any).COL_2 || "";
      const _placa = String(rawPlaca).toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();

      const litersVal = f._litros !== undefined ? parseNumLocal(f._litros) : parseNumLocal(f.LITROS || f.VOLUME || (f as any).COL_14);
      const vlLitroVal = f._vlLitro !== undefined ? parseNumLocal(f._vlLitro) : parseNumLocal(f.VALOR_UNITARIO || f.PRECO_UNITARIO || (f as any).COL_15);
      const totalVal = f._total !== undefined ? parseNumLocal(f._total) : parseNumLocal(f.VALOR_TOTAL || f.VALOR_EMISSAO || (f as any).COL_19);

      return {
        ...f,
        _placa,
        _txId: txId,
        _formattedDate: formattedDate,
        _timestamp: formattedDate ? new Date(formattedDate).getTime() : 0,
        _monthYearBase,
        _monthYear: monthYearData?.mesAno || null,
        _fuelType: standardizeFuelType(String(f._fuelType || f["TIPO COMBUSTIVEL"] || f["TIPO COMBUSTÍVEL"] || raw[13] || "N/A")),
        _litros: litersVal,
        _vlLitro: vlLitroVal,
        _valR: totalVal || (vlLitroVal * litersVal) || 0,
        _itemDesc: String(f["SERVICO"] || f["SERVI\u00C7O"] || f["ITEM"] || raw[12] || "Abastecimento").trim(),
        _endereco: String(f._endereco || f["ENDERECO"] || f["ENDERE\u00C7O"] || raw[23] || raw[18] || "N/A").trim().toUpperCase(),
        _bairro: String(f._bairro || f["BAIRRO"] || raw[24] || raw[19] || "N/A").trim().toUpperCase(),
        _posto: String(f._posto || f._establishment || f["NOME ESTABELECIMENTO"] || f["NOME POSTO"] || f["ESTABELECIMENTO"] || raw[21] || raw[16] || "N/A").trim().toUpperCase(),
        _cidade: String(f._cidade || f["CIDADE"] || f["MUNICÍPIO"] || f["MUNICIPIO"] || raw[25] || raw[20] || raw[22] || "N/A").trim().toUpperCase(),
        _kmHoras: f._kmRodados || 0,
        _autReal: f._autReal || 0,
      };
    });
  }, [fuel]);

  // Aplicar filtros
  const filteredFuel = useMemo(() => {
    return preProcessedFuel.filter((f) => {
      const matchesFuelType =
        selectedFuelTypes.length === 0 || selectedFuelTypes.includes(f._fuelType || "");

      const matchesModel =
        selectedVehicleModels.length === 0 || 
        selectedVehicleModels.includes(f["MODELO VEICULO"] || f["MODELO"] || (f as any).MODELO_VEICULO || (f as any).MODELO || (f as any).__raw?.[10] || "");

      const matchesPlaca =
        !debouncedSearchPlaca || f._placa.toLowerCase().includes(debouncedSearchPlaca.replace(/[^A-Z0-9]/gi, "").toLowerCase());

      // Correlacionar com Asset pela Placa pre-normalizada para máximo desempenho
      const asset = f._placa ? assetsByPlaca.get(f._placa) : null;
      
      const matchesDiretoria =
        selectedDirectorias.length === 0 || 
        (asset && selectedDirectorias.includes(asset.DIRETORIA || asset["DIRETORIA"] || "")) ||
        (!asset && selectedDirectorias.includes("N/A"));

      const matchesGerencia =
        selectedGerencias.length === 0 || 
        (asset && selectedGerencias.includes(asset.GERENCIA || asset["GERÊNCIA"] || "")) ||
        (!asset && selectedGerencias.includes("N/A"));

      const matchesTipo =
        selectedTipos.length === 0 || 
        (asset && selectedTipos.includes(asset.TIPO || asset["TIPO"] || "")) ||
        (!asset && selectedTipos.includes("N/A"));

      const matchesPropriedade =
        selectedPropriedades.length === 0 ||
        (asset && selectedPropriedades.includes(asset.PROPRIEDADE || asset["PROPRIEDADE"] || "")) ||
        (!asset && selectedPropriedades.includes("N/A"));

      const matchesTitularidade =
        selectedTitularidades.length === 0 ||
        (asset && selectedTitularidades.includes(String(asset.TITULARIDADE || asset["TITULARIDADE"] || "").trim().toUpperCase())) ||
        (!asset && selectedTitularidades.includes("N/A"));

      const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate(), 0, 0, 0, 0).getTime() : null;
      const toTs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime() : null;

      let matchesDate = true;
      if (fromTs || toTs) {
        if (!f._timestamp) matchesDate = false;
        else {
          const transTime = f._timestamp;
          if (fromTs && transTime < fromTs) matchesDate = false;
          if (toTs && transTime > toTs) matchesDate = false;
        }
      }

      // Filtro por Mês/Ano (Baseado na coluna AP)
      const matchesMonthYear = 
        selectedMonthsYears.length === 0 || 
        selectedMonthsYears.includes(f._monthYearBase);

      const matchesRegiao = 
        selectedRegioes.length === 0 || 
        selectedRegioes.includes(getPERegion(f._cidade === "N/A" ? f._posto : f._cidade));

      const matchesCidade = 
        selectedCidades.length === 0 || 
        selectedCidades.includes(f._cidade);

      const matchesTipoControleAutonomia =
        selectedTipoControleAutonomia.length === 0 ||
        selectedTipoControleAutonomia.includes(f["TIPO CONTROLE AUTONOMIA"] || (f as any).TIPO_CONTROLE_AUTONOMIA || (f as any).__raw?.[27] || "");

      return matchesFuelType && matchesModel && matchesPlaca && matchesDiretoria && matchesGerencia && matchesTipo && matchesPropriedade && matchesTitularidade && matchesDate && matchesMonthYear && matchesTipoControleAutonomia && matchesRegiao && matchesCidade;
    }).sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0)); // Ordem decrescente de data por padrão
  }, [preProcessedFuel, assetsByPlaca, debouncedSearchPlaca, selectedFuelTypes, selectedVehicleModels, selectedDirectorias, selectedGerencias, selectedTipos, selectedPropriedades, selectedTitularidades, dateFrom, dateTo, selectedMonthsYears, selectedTipoControleAutonomia, selectedRegioes, selectedCidades]);

  // Metrics
  const totalLitros = useMemo(() => filteredFuel.reduce((sum, f) => sum + (Number(f._litros) || 0), 0), [filteredFuel]);
  const totalValor = useMemo(() => filteredFuel.reduce((sum, f) => sum + (Number(f._valR) || 0), 0), [filteredFuel]);
  const totalAbastecimentos = filteredFuel.length;
  const avgPrecoLitro = totalLitros > 0 ? totalValor / totalLitros : 0;

  const previousMonthMetrics = useMemo(() => {
    return { prevLitros: 0, prevValor: 0, prevAbast: 0, prevPrecoLitro: 0 };
  }, [fuel]);

  const internalLoading = false;

  const litrosChange = previousMonthMetrics.prevLitros > 0 ? ((totalLitros - previousMonthMetrics.prevLitros) / previousMonthMetrics.prevLitros) * 100 : 0;
  const valorChange = previousMonthMetrics.prevValor > 0 ? ((totalValor - previousMonthMetrics.prevValor) / previousMonthMetrics.prevValor) * 100 : 0;
  
  const avgAutonomiaReal = useMemo(() => {
    const validRecords = filteredFuel.filter(f => {
      const value = f._autReal || f["AUTONOMIA"] || f["Autonomia"] || f["autonomia"] || f["KM/LITRO OU LITROS/HORA"];
      const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
      return !isNaN(numValue) && numValue > 0;
    });
    if (validRecords.length === 0) return 0;
    const sum = validRecords.reduce((acc, f) => {
      const value = f._autReal || f["AUTONOMIA"] || f["Autonomia"] || f["autonomia"] || f["KM/LITRO OU LITROS/HORA"];
      const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
      return acc + numValue;
    }, 0);
    return sum / validRecords.length;
  }, [filteredFuel]);

  // Listas de opções para os filtros
  const fuelTypeOptions = useMemo(() => Array.from(new Set(fuel.map(f => standardizeFuelType(f["TIPO COMBUSTIVEL"] || f["TIPO COMBUSTÍVEL"] || (f.__raw && f.__raw[13]))).filter(Boolean))).sort() as string[], [fuel]);
  const modelOptions = useMemo(() => Array.from(new Set(assets.map(a => a.MODELO || a.modelo).filter(Boolean))).sort() as string[], [assets]);
  const diretoriaOptions = useMemo(() => Array.from(new Set(assets.map(a => a.DIRETORIA || a.diretoria).filter(Boolean))).sort() as string[], [assets]);
  const gerenciaOptions = useMemo(() => Array.from(new Set(assets.map(a => a.GERENCIA || a.gerencia || a["GERÊNCIA"]).filter(Boolean))).sort() as string[], [assets]);
  const tipoOptions = useMemo(() => Array.from(new Set(assets.map(a => a.TIPO || a.tipo).filter(Boolean))).sort() as string[], [assets]);
  const autoControleOptions = useMemo(() => Array.from(new Set(fuel.map(f => f["CONTROLE AUTO"] || f["CONTROLE AUTONOMIA"] || (f.__raw && f.__raw[27])).filter(Boolean))).sort() as string[], [fuel]);
  const monthYearOptions = useMemo(() => Array.from(new Set(preProcessedFuel.map(f => f._monthYearBase).filter(Boolean))).sort() as string[], [preProcessedFuel]);
  const regiaoOptions = ["RMR", "Agreste", "Mata Norte", "Mata Sul", "Sertão", "Outras Regiões"];
  const cidadeOptions = useMemo(() => Array.from(new Set(preProcessedFuel.map(f => f._cidade).filter(c => c && c !== "N/A"))).sort(), [preProcessedFuel]);

  const propriedadeOptions = useMemo(() => Array.from(new Set(assets.map(a => a.PROPRIEDADE || a.Propriedade || a["PROPRIEDADE"] || (a.__raw && a.__raw[10])).filter(Boolean))).sort() as string[], [assets]);
  const titularidadeOptions = useMemo(() => {
    const dynamic = assets.map(a => a.TITULARIDADE || a["TITULARIDADE"] || (a.__raw && a.__raw[27])).filter(Boolean).map(t => String(t).toUpperCase().trim());
    return Array.from(new Set(["TITULAR", "RESERVA", "N/A", ...dynamic])).filter(Boolean).sort() as string[];
  }, [assets]);

  const handleClearFilters = () => {
    setSelectedFuelTypes([]);
    setSelectedVehicleModels([]);
    setSearchPlaca("");
    setSelectedDirectorias([]);
    setSelectedGerencias([]);
    setSelectedTipos([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedMonthsYears([]);
    setSelectedRegioes([]);
    setSelectedCidades([]);
    setSelectedPropriedades([]);
    setSelectedTitularidades([]);
    setSelectedAlerta([]);
    setSelectedAlertaAutonomia([]);
    setSelectedAlertaKmHora([]);
    setSelectedAlertaLitros([]);
    setSelectedAlertaItem([]);
    setSelectedParecerNexus([]);
    setSelectedTipoControleAutonomia([]);
    setSelectedAlertaValorLitro([]);
    setSelectedAlertaVale([]);
    toast.success("Filtros limpos com sucesso");
  };

  // Price Analysis States and Logic
  const [priceSelectedRegions, setPriceSelectedRegions] = useState<string[]>([]);
  const [priceSelectedCities, setPriceSelectedCities] = useState<string[]>([]);
  const [priceSelectedFuel, setPriceSelectedFuel] = useState<string[]>([]);
  const [priceCurrentPage, setPriceCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const PERNAMBUCO_REGIONS: Record<string, string[]> = {
    "RMR": ["RECIFE", "OLINDA", "JABOATAO", "PAULISTA", "CAMARAGIBE", "IGARASSU", "ABREU E LIMA", "SAO LOURENCO DA MATA", "ARACOIABA", "IPOJUCA", "MORENO", "ITAPISSUMA", "ITAMARACA", "CABO DE SANTO AGOSTINHO", "CABO"],
    "Agreste": ["CARUARU", "GARANHUNS", "ARCOVERDE", "SANTA CRUZ DO CAPIBARIBE", "BEZERROS", "GRAVATA", "PESQUEIRA", "SURUBIM", "BELO JARDIM", "BOM CONSELHO", "LAJEDO", "LIMOEIRO", "BUIQUE", "CUSTODIA", "PEDRA", "VENTUROSA", "SALOA", "CAETES", "SANTA MARIA DO CAMBUCA", "VERTENTES", "TAQUARITINGA", "TORITAMA", "AGRESTE"],
    "Mata Norte": ["GOIANA", "TIMBAUBA", "CARPINA", "PAUDALHO", "ALIANCA", "CONDADO", "NAZARE DA MATA", "VICENCIA", "MACAPARANA", "ITAMBE", "LAGOA DO CARRO", "TRACUNHAEM", "BUENOS AIRES"],
    "Mata Sul": ["PALMARES", "VITORIA DE SANTO ANTAO", "VITORIA", "SIRINHAEM", "BARREIROS", "CATENDE", "ESCADA", "RIBEIRAO", "RIO FORMOSO", "AGUA PRETA", "TAMANDARE", "QUIPAPA", "AMARAGI", "CORTES", "JOAQUIM NABUCO", "MARAIAL", "SAO BENEDITO DO SUL"],
    "Sertão": ["PETROLINA", "SALGUEIRO", "SERRA TALHADA", "ARARIPINA", "AFOGADOS DA INGAZEIRA", "CABROBO", "OURICURI", "TABIRA", "PETROLANDIA", "SAO JOSE DO EGITO", "FLORESTA", "BODOCO", "EXU", "PARNAMIRIM", "STALHADA", "S J DO EGITO", "TRIUNFO", "BELMONTE", "ITACURUBA", "SAO JOSE DO BELMONTE", "VERDEJANTE", "MIRANDIBA", "SERTAO", "TABIRA", "CUSTODIA", "BETANIA", "IBIMIRIM", "INAJA", "MANARI"]
  };

  const getPERegion = (entry: string): string => {
    if (!entry) return "Outras Regiões";
    const c = entry.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Prioridade para menção direta à região
    if (c.includes("RMR") || c.includes("METROPOLITANA")) return "RMR";
    if (c.includes("AGRESTE")) return "Agreste";
    if (c.includes("MATA NORTE")) return "Mata Norte";
    if (c.includes("MATA SUL")) return "Mata Sul";
    if (c.includes("SERTAO")) return "Sertão";

    for (const [region, cities] of Object.entries(PERNAMBUCO_REGIONS)) {
      if (cities.some(item => c.includes(item))) return region;
    }
    return "Outras Regiões";
  };

  // Base analysis without table-specific filters to avoid circular dependency
  const basePriceAnalysis = useMemo(() => {
    // Usar filteredFuel para respeitar filtros de data (mês/ano) se aplicados, senão preProcessedFuel
    const sourceData = (selectedMonthsYears.length > 0 || dateFrom || dateTo) ? filteredFuel : preProcessedFuel;
    if (!sourceData.length) return [];
    
    // Encontrar a data mais recente no dataset filtrado para definir a janela de análise
    const maxTsInData = sourceData.reduce((max, f) => Math.max(max, f._timestamp || 0), 0);
    const windowStartTs = maxTsInData > 0 ? maxTsInData - (20 * 24 * 60 * 60 * 1000) : 0; 

    const pricesByGroup: Record<string, any[]> = {};

    sourceData.forEach(f => {
      let data = f._timestamp || 0;
      
      if (data === 0 && f._monthYearBase !== "N/A" && f._monthYearBase !== null) {
        const parts = f._monthYearBase.replace(/\./g, "").split('/');
        if (parts.length === 2) {
          const mes = parts[0].trim().charAt(0).toUpperCase() + parts[0].trim().slice(1).toLowerCase();
          const ano = parts[1].trim();
          const mesesMap: Record<string, number> = { "Jan": 0, "Fev": 1, "Mar": 2, "Abr": 3, "Mai": 4, "Jun": 5, "Jul": 6, "Ago": 7, "Set": 8, "Out": 9, "Nov": 10, "Dez": 11 };
          if (mesesMap[mes] !== undefined) {
             data = new Date(2000 + parseInt(ano), mesesMap[mes], 15).getTime();
          }
        }
      }

      const cidade = f._cidade || "N/A";
      const tipo = f._fuelType || "N/A";
      if (tipo === "N/A" || !tipo) return;
      
      const preco = f._vlLitro || 0;
      if (preco <= 0.5) return;

      // Exclusão de postos específicos solicitados (Filtro mais abrangente)
      const postoNomeNorm = String(f._posto || f._establishment || f["NOME POSTO"] || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const enderecoNorm = String(f._endereco || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // ECO POSTO VITÓRIA - Vitória de Santo Antão
      if (postoNomeNorm.includes("PICHILAU")) return;
      if (postoNomeNorm.includes("ECO POSTO") && (postoNomeNorm.includes("VITORIA") || postoNomeNorm.includes("SANTO ANTAO"))) return;
      if (postoNomeNorm.includes("VIT") && postoNomeNorm.includes("VITORIA") && enderecoNorm.includes("BR-232")) return;

      // EXTREME OUTLIER FILTER:
      // Users report values like 99.000, 120.000. These are clearly total bill amounts.
      // Maximum reasonable price for any fuel/ARLA is around 15.00/L.
      // Anything above 20.00 is almost certainly a data error or total amount.
      if (preco > 20.00) return;

      const key = `${cidade}|${tipo}`;
      if (!pricesByGroup[key]) pricesByGroup[key] = [];
      pricesByGroup[key].push({ ...f, _dataWork: data });
    });

    const finalResults: any[] = [];

    Object.keys(pricesByGroup).forEach(key => {
      const allRecords = pricesByGroup[key];
      // Se não houver filtro de data específico, aplica janela de 20 dias, senão usa todos os registros filtrados
      const hasSpecificDateFilter = (selectedMonthsYears.length > 0 || dateFrom || dateTo);
      const recentRecords = (!hasSpecificDateFilter && windowStartTs > 0) ? allRecords.filter(f => f._dataWork >= windowStartTs) : allRecords;
      
      const targetRecords = recentRecords;
      
      if (targetRecords.length > 0) {
        const sortedByDate = [...targetRecords].sort((a, b) => b._dataWork - a._dataWork);
        const focusGroup = sortedByDate.slice(0, 5);
        
        const bestMatch = focusGroup.reduce((best, curr) => {
          const fuelType = String(curr._fuelType).toUpperCase();
          const isGas = fuelType.includes("GASOLINA");
          const isDiesel = fuelType.includes("DIESEL");
          const isArla = fuelType.includes("ARLA");
          
          if (!isArla) {
            if (isGas && (curr._vlLitro < 4.00 || curr._vlLitro > 8.50)) return best;
            if (isDiesel && (curr._vlLitro < 4.00 || curr._vlLitro > 8.00)) return best;
          } else {
            // ARLA 32 usually costs per liter between R$ 3 and R$ 7. 
            // Values mentioned by user (R$ 99k, R$ 120k) are surely total batch amounts.
            // We cap ARLA unit price at R$ 15.00 to safely exclude these outliers.
            if (curr._vlLitro > 15.00 || curr._vlLitro < 2.00) return best;
          }
          
          if (curr._vlLitro <= 0.5 || curr._vlLitro > 100) return best;
          
          return (best._vlLitro <= 0.5 || curr._vlLitro < best._vlLitro) ? curr : best;
        }, focusGroup[0]);

         const finalMatch = (bestMatch._vlLitro < 0.5) ? sortedByDate.find(r => r._vlLitro > 2.0) || bestMatch : bestMatch;

         if (!hasSpecificDateFilter && windowStartTs > 0 && finalMatch._dataWork < windowStartTs) return;

         finalResults.push({
           regiao: getPERegion(finalMatch._cidade === "N/A" ? finalMatch._posto : finalMatch._cidade),
           cidade: finalMatch._cidade,
           tipo: finalMatch._fuelType,
           posto: finalMatch._posto,
           preco: finalMatch._vlLitro,
           data: finalMatch._dataWork,
           endereco: finalMatch._endereco,
           bairro: finalMatch._bairro
         });
      }
    });

    return finalResults;
  }, [preProcessedFuel, filteredFuel, selectedMonthsYears, dateFrom, dateTo]);

  const priceAnalysis = useMemo(() => {
    return basePriceAnalysis
      .filter(item => {
        if (priceSelectedRegions.length > 0 && !priceSelectedRegions.includes(item.regiao)) return false;
        if (priceSelectedCities.length > 0 && !priceSelectedCities.includes(item.cidade)) return false;
        if (priceSelectedFuel.length > 0 && !priceSelectedFuel.includes(item.tipo)) return false;
        return true;
      })
      .sort((a, b) => {
        const rOrder = ["RMR", "Mata Norte", "Mata Sul", "Agreste", "Sertão", "Outras Regiões"];
        const rA = rOrder.indexOf(a.regiao);
        const rB = rOrder.indexOf(b.regiao);
        if (rA !== rB) return rA - rB;
        if (a.cidade !== b.cidade) return a.cidade.localeCompare(b.cidade);
        return a.preco - b.preco;
      });
  }, [basePriceAnalysis, priceSelectedRegions, priceSelectedCities, priceSelectedFuel]);

  const priceAnalysisPaginated = useMemo(() => {
    const start = (priceCurrentPage - 1) * rowsPerPage;
    return priceAnalysis.slice(start, start + rowsPerPage);
  }, [priceAnalysis, priceCurrentPage]);

  // Opções para filtros de preço (fixo baseado na base sem filtros de preço)
  const priceCityOptions = useMemo(() => Array.from(new Set(basePriceAnalysis.map(p => p.cidade))).sort(), [basePriceAnalysis]);
  const priceFuelOptions = useMemo(() => Array.from(new Set(basePriceAnalysis.map(p => p.tipo))).sort(), [basePriceAnalysis]);

  const generateShareSummary = () => {
    const fuelTypes = selectedFuelTypes.length > 0 ? selectedFuelTypes.join(", ") : "Todos";
    const regionFilterText = selectedRegioes.length > 0 ? selectedRegioes.join(", ") : "Todas";
    const monthFilterText = selectedMonthsYears.length > 0 ? selectedMonthsYears.join(", ") : "Todo o período";

    let summary = `*RESUMO DE AUDITORIA DE COMBUSTÍVEL - COMPESA*\n`;
    summary += `📅 *Referência:* ${format(new Date(), "dd/MM/yyyy HH:mm")}\n`;
    summary += `📍 *Filtros:* ${fuelTypes} | Regional: ${regionFilterText} | Período: ${monthFilterText}\n\n`;
    
    if (priceAnalysis.length > 0) {
      summary += `*MELHORES PREÇOS IDENTIFICADOS POR LOCALIDADE:*\n`;
      
      // Group by locality
      const byLocality: Record<string, any[]> = {};
      priceAnalysis.forEach(p => {
        const key = `${p.cidade} (${p.regiao})`;
        if (!byLocality[key]) byLocality[key] = [];
        byLocality[key].push(p);
      });

      Object.entries(byLocality).forEach(([locality, items]) => {
        summary += `\n📍 *${locality.toUpperCase()}*\n`;
        items.forEach(item => {
          summary += `• ${item.tipo}: R$ ${item.preco.toFixed(3)} [${item.posto}]\n`;
        });
      });

      summary += `\n*Ação Recomendada:* Propomos que o abastecimento da frota local seja priorizado neste posto indicado para otimização de custos.\n`;
    }

    summary += `\n_Gerado em tempo real via Nexus Frotas - Auditoria e Inteligência de Custos_`;
    
    navigator.clipboard.writeText(summary);
    toast.success("Resumo detalhado copiado para a área de transferência!");
  };

  const priceComparison = useMemo(() => {
    const marketBenchmarks: Record<string, number> = {
      "DIESEL S10": 5.98,
      "DIESEL COMUM": 5.85,
      "GASOLINA COMUM": 6.12,
      "GASOLINA ADITIVADA": 6.35,
      "ETANOL": 4.15
    };
    const compesaAverages: Record<string, { sum: number; count: number }> = {};
    
    // Sempre basear os benchmarks no conjunto completo de dados processados para evitar cards vazios,
    // a menos que o usuário tenha um filtro de data/mês específico que queira comparar.
    const sourceFuel = (selectedMonthsYears.length > 0 || dateFrom || dateTo) ? filteredFuel : preProcessedFuel;

    sourceFuel.forEach(f => {
      const tipo = f._fuelType || "";
      const preco = f._vlLitro || 0;

      // Exclusão de postos específicos solicitados dos benchmarks
      const postoNomeNorm = String(f._posto || f._establishment || f["NOME POSTO"] || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (postoNomeNorm.includes("PICHILAU")) return;
      if (postoNomeNorm.includes("ECO POSTO") && (postoNomeNorm.includes("VITORIA") || postoNomeNorm.includes("SANTO ANTAO"))) return;
      
      if (preco > 0 && marketBenchmarks[tipo]) {
        if (!compesaAverages[tipo]) compesaAverages[tipo] = { sum: 0, count: 0 };
        compesaAverages[tipo].sum += preco;
        compesaAverages[tipo].count += 1;
      }
    });

    return Object.keys(marketBenchmarks).map(tipo => {
      const stats = compesaAverages[tipo];
      const avg = stats ? stats.sum / stats.count : 0;
      const market = marketBenchmarks[tipo];
      const diff = avg > 0 ? ((avg - market) / market) * 100 : 0;
      return { tipo, compesa: avg, market, diff };
    }).filter(item => item.compesa > 0) // Só mostrar o que tiver dados Compesa
      .sort((a, b) => b.compesa - a.compesa);
  }, [filteredFuel, preProcessedFuel, selectedMonthsYears, dateFrom, dateTo]);

  const handleShareWhatsApp = (item: any) => {
    const message = `*Informativo Gestão de Frota - COMPESA*\n\nIdentificamos a *melhor oferta* de combustível para sua unidade:\n\n📍 *Região:* ${item.regiao}\n🏙️ *Cidade:* ${item.cidade}\n⛽ *Tipo:* ${item.tipo}\n💰 *Preço:* R$ ${item.preco.toFixed(3)}\n🏢 *Posto:* ${item.posto}\n📍 *Endereço:* ${item.endereco || 'N/A'}\n🏠 *Bairro:* ${item.bairro || 'N/A'}\n📅 *Data da última consulta:* ${new Date(item.data).toLocaleDateString('pt-BR')}\n\n*Ação Recomendada:* Propomos que o abastecimento da frota local seja priorizado neste posto indicado para otimização de custos.\n\n_Equipe de Gestão de Frota_`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const CHART_COLORS = [
    "#3b82f6", // blue-500
    "#4f46e5", // indigo-600
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#a855f7", // purple-500
    "#d946ef", // fuchsia-500
    "#ec4899", // pink-500
  ];

  const handleExport = () => {
    toast.info("Exportação em processamento...");
    
    const baseData = filteredFuel.map(f => ({
      Placa: f._placa || f.PLACA || f.Placa || "N/A",
      Data: f["DATA TRANSACAO"] ? formatDateTimePtBRLocal(String(f["DATA TRANSACAO"])) : "N/A", // Use hourly format if available
      Litros: Number(f.LITROS).toFixed(2),
      "Valor Unitário": Number(f["VALOR UNITARIO"] || f["VL/UNITARIO"]).toFixed(2),
      "Valor Total": Number(f["VALOR EMISSAO"]).toFixed(2),
      "Tipo Combustível": f["TIPO COMBUSTIVEL"],
      "Posto": f["NOME POSTO"],
      "Odômetro": f["ODOMETRO/HORIMETRO"],
      "Autonomia Real": f["AUTONOMIA"]
    }));

    const sheets = [
      { data: baseData, sheetName: "Abastecimentos Filtrados" },
      { data: buildDetalhesDesvios(desviosFiltered), sheetName: "Desvios Identificados" },
      { data: buildDetalhesDesviosByType(fuelAnalysis.desvios, "Autonomia"), sheetName: "Analise Autonomia" },
      { data: buildDetalhesDesviosByType(fuelAnalysis.desvios, "Litros/m³"), sheetName: "Analise Capacidade" }
    ];
    
    exportToExcelMultiSheet(sheets, `Relatorio_Abastecimento_${new Date().toISOString().split('T')[0]}`);
  };

  const fuelAlertConfig = useMemo(() => getFuelAlertConfig(), [dataUpdatedAt]);

  // -------------------------------------------------------------------------
  // NOVO BLOCO: ANÁLISE DE DESVIOS (Baseado no snippet do usuário)
  // -------------------------------------------------------------------------
  
  // -------------------------------------------------------------------------
  // CONSOLIDATED ANALYSIS AND ENRICHMENT (SINGLE PASS) - OPTIMIZED
  // -------------------------------------------------------------------------
  const fuelSummary = useMemo(() => {
    if (!filteredFuel.length) {
      return { 
        desvios: [], 
        statistics: { autonomy: 0, kmHora: 0, litros: 0, item: 0, dias: 0, valorLitro: 0, vale: 0 },
        enrichedData: [],
        plaquesRanking: []
      };
    }

    const stats = { autonomy: 0, kmHora: 0, litros: 0, item: 0, dias: 0, valorLitro: 0, vale: 0 };
    const desvios: any[] = [];
    const vehicleMap = new Map<string, any>();
    const today = new Date().getTime();
    
    // Mapeamento de média de preço por tipo de combustível no conjunto de dados filtrado
    const fuelTypePricesMap = new Map<string, { sum: number, count: number }>();
    for (let i = 0; i < filteredFuel.length; i++) {
      const f = filteredFuel[i] as any;
      const fuelType = f._fuelType || "N/A";
      const price = f._vlLitro || 0;
      if (price > 0 && fuelType !== "ARLA 32" && fuelType !== "N/A") {
        const curr = fuelTypePricesMap.get(fuelType) || { sum: 0, count: 0 };
        curr.sum += price;
        curr.count++;
        fuelTypePricesMap.set(fuelType, curr);
      }
    }

    const fuelTypeAverages = new Map<string, number>();
    fuelTypePricesMap.forEach((val, key) => {
      fuelTypeAverages.set(key, val.sum / val.count);
    });
    
    // Auxiliar for number parsing
    const parseNum = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const s = String(val).replace(',', '.').trim();
      return parseFloat(s) || 0;
    };

    // First pass: group by vehicle and pre-calculate km/hora averages
    const assetAverages = new Map<string, { sum: number, count: number }>();
    
    for (let i = 0; i < filteredFuel.length; i++) {
      const f = filteredFuel[i] as any;
      const fuelType = f._fuelType;
      if (fuelType === "ARLA 32") continue;

      const placa = f._placa;
      
      // Momentaneamente excluir placas que começam com MAQ conforme solicitação do usuário
      if (placa.startsWith("MAQ")) continue;

      // Filtrar apenas veículos que possuam Controle Autonomia = "FROTA" (Coluna AR / Índice 43)
      const asset = assetsByPlaca.get(placa);
      if (!asset) continue;

      const tipoControleVal = asset["TIPO CONTROLE AUTONOMIA"] || 
                              asset["CONTROLE DE AUTONOMIA"] || 
                              asset["CONTROLE AUTONOMIA"] || 
                              asset.TIPO_CONTROLE_AUTONOMIA || 
                              (asset.__raw && asset.__raw[43]) || 
                              "";
      
      const tc = String(tipoControleVal).trim().toUpperCase();
      if (tc !== "FROTA" && tc !== "") continue;

      const valR = f._valR;
      
      if (valR > 0) {
        const curr = assetAverages.get(placa) || { sum: 0, count: 0 };
        curr.sum += valR;
        curr.count++;
        assetAverages.set(placa, curr);
      }

      if (!vehicleMap.has(placa)) {
        vehicleMap.set(placa, {
          placa,
          propriedade: asset?.PROPRIEDADE || "N/A",
          tipo: asset?.TIPO || "N/A",
          modelo: asset?.MODELO || "N/A",
          unidade: asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A",
          count: 0,
          totalLitros: 0,
          totalKm: 0,
          lastTimestamp: 0,
          lastFuelType: null,
          lastTxTimestamp: 0,
          autonomias: [],
          alerts: new Set<string>(),
          lastTx: null
        });
      }
      
      const v = vehicleMap.get(placa);
      const litros = f._litros;
      const timestamp = f._timestamp || 0;
      const currentFuelType = f._fuelType;
      
      v.count++;
      v.totalLitros += litros;
      
      if (timestamp > v.lastTimestamp) {
        v.lastTimestamp = timestamp;
        v.lastTx = f;
      }
      
      if (f._itemDesc !== "Abastecimento") {
        const d = { 
          placa, 
          tipo: 'Item Abastecido', 
          descricao: `Cód. Transação: ${f._txId} | Item: ${f._itemDesc}`, 
          data: f["DATA TRANSACAO"] || f._formattedDate || f._date
        };
        desvios.push(d);
        v.alerts.add('Item Abastecido');
        stats.item++;
      }

      // Alerta Vale: Trata como irregular se KM Rodados for entre 0 e 10 ou negativo, 
      // OU se o tempo de diferença do mesmo combustível for de menos de 4 horas.
      const kmHoras = f._kmHoras;
      const hasTimeCheck = v.lastTxTimestamp && v.lastTxTimestamp > 0 && timestamp > 0;
      const hoursBetween = hasTimeCheck ? (v.lastTxTimestamp - timestamp) / (1000 * 60 * 60) : Infinity;

      if (v.lastFuelType && currentFuelType === v.lastFuelType) {
        const isLowMvt = (kmHoras <= 10);
        const isShortInterval = (hoursBetween < 4);

        if (isLowMvt || isShortInterval) {
          let reason = "";
          if (isLowMvt && isShortInterval) {
            reason = `KM Irregular (${kmHoras} km) e Intervalo Curto (${hoursBetween.toFixed(1)}h)`;
          } else if (isLowMvt) {
            reason = `KM Irregular (Movimentação Mínima): ${kmHoras} km`;
          } else {
            reason = `Intervalo Curto: ${hoursBetween.toFixed(1)}h (< 4h)`;
          }

          const d = { 
            placa, 
            tipo: 'Alerta Vale', 
            descricao: `Cód. Transação: ${f._txId} | ${reason} | Combustível Repetido: ${currentFuelType}`, 
            data: f["DATA TRANSACAO"] || f._formattedDate || f._date
          };
          desvios.push(d);
          v.alerts.add('Alerta Vale');
          stats.vale++;
        }
      }

      // Atualiza o último combustível e timestamp para a próxima iteração
      v.lastFuelType = currentFuelType;
      v.lastTxTimestamp = timestamp;
    }

    // Pass 2: calculate specific alerts
    for (let i = 0; i < filteredFuel.length; i++) {
      const f = filteredFuel[i] as any;
      const fuelType = f._fuelType;
      if (fuelType === "ARLA 32") continue;
      
      const placa = f._placa;
      
      // Momentaneamente excluir placas que começam com MAQ conforme solicitação do usuário
      if (placa.startsWith("MAQ")) continue;

      const v = vehicleMap.get(placa);
      if (!v) continue;
      
      const asset = assetsByPlaca.get(placa);
      const litros = f._litros;
      const vlLitro = f._vlLitro;
      const valR = f._valR;
      const autReal = f._autReal;

      const avgRData = assetAverages.get(placa);
      if (avgRData && avgRData.count > 1 && valR > 0) {
          const avgR = avgRData.sum / avgRData.count;
          if (Math.abs(valR - avgR) / avgR > 0.30) {
            const perc = (Math.abs(valR - avgR) / avgR * 100).toFixed(1);
            const d = { 
              placa, 
              tipo: 'KM/Hora', 
              descricao: `Cód. Transação: ${f._txId} | KM/H: ${valR} vs Med: ${avgR.toFixed(1)} (${perc}%)`, 
              data: f["DATA TRANSACAO"] || f._formattedDate || f._date
            };
            desvios.push(d);
            v.alerts.add('KM/Hora');
            stats.kmHora++;
          }
        }

      if (asset) {
        const assetRaw = (asset as any).__raw || [];
        const fuelPadraoAtivo = standardizeFuelType(assetRaw[11]);
        const fuelSecAtivo = standardizeFuelType(assetRaw[32]);
        
        let limit = 0;
        if (fuelType === fuelPadraoAtivo) limit = parseBrazilianNumber(assetRaw[30]);
        else if (fuelType === fuelSecAtivo) limit = parseBrazilianNumber(assetRaw[34]);

        if (limit > 0 && litros > limit) {
          const excesso = (litros - limit).toFixed(1);
          const d = { 
            placa, 
            tipo: 'Litros/m³', 
            descricao: `Cód. Transação: ${f._txId} | Tanque: ${litros}L vs Lim: ${limit}L (+${excesso}L)`, 
            data: f["DATA TRANSACAO"] || f._formattedDate || f._date
          };
          desvios.push(d);
          v.alerts.add('Litros/m³');
          stats.litros++;
        }
      }

      if (asset && autReal > 0) {
        v.autonomias.push(autReal);
        const assetRaw = (asset as any).__raw || [];
        const fuelPadraoAtivo = standardizeFuelType(assetRaw[11]);
        const fuelSecAtivo = standardizeFuelType(assetRaw[32]);
        
        // Autonomia de referência (Km/L ou H/L)
        let autRef = 0;
        if (fuelType === fuelPadraoAtivo) autRef = parseBrazilianNumber(assetRaw[28]);
        else if (fuelType === fuelSecAtivo) autRef = parseBrazilianNumber(assetRaw[33]);

        if (autRef > 0 && Math.abs(autReal - autRef) / autRef * 100 > fuelAlertConfig.autonomyDeviationPercent) {
          const perDesvio = ((autReal - autRef) / autRef * 100).toFixed(1);
          const diff = (autReal - autRef).toFixed(2);
          const d = { 
            placa, 
            tipo: 'Autonomia', 
            descricao: `Cód. Transação: ${f._txId} | Aut: ${autReal.toFixed(1)} vs Pad: ${autRef} (${perDesvio}%)`, 
            data: f["DATA TRANSACAO"] || f._formattedDate || f._date
          };
          desvios.push(d);
          v.alerts.add('Autonomia');
          stats.autonomy++;
        }
      }

      const precoMedioParaComp = fuelTypeAverages.get(fuelType) || avgPrecoLitro;
      if (precoMedioParaComp > 0 && vlLitro > 0 && Math.abs(vlLitro - precoMedioParaComp) / precoMedioParaComp * 100 > fuelAlertConfig.valorLitroDeviationPercent) {
        const perc = (Math.abs(vlLitro - precoMedioParaComp) / precoMedioParaComp * 100).toFixed(1);
        const d = { 
          placa, 
          tipo: 'Valor/Litro', 
          descricao: `Cód. Transação: ${f._txId} | Preço: R$ ${vlLitro.toFixed(2)} vs Med Regional (${fuelType}): R$ ${precoMedioParaComp.toFixed(2)} (${perc}%)`, 
          data: f["DATA TRANSACAO"] || f._formattedDate || f._date
        };
        desvios.push(d);
        v.alerts.add('Valor/Litro');
        stats.valorLitro++;
      }
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const enrichedData = Array.from(vehicleMap.values()).map(v => {
      const asset = assetsByPlaca.get(v.placa);
      const assetRaw = (asset as any)?.__raw || [];
      const autPadrao = parseNum(assetRaw[28]);
      const autRealAvg = v.autonomias.length > 0 ? v.autonomias.reduce((a: any, b: any) => a + b, 0) / v.autonomias.length : 0;
      const desvAut = autPadrao > 0 ? ((autRealAvg - autPadrao) / autPadrao) * 100 : 0;
      const dias = v.lastTimestamp ? Math.floor((today - v.lastTimestamp) / msPerDay) : 999;
      
      if (dias > fuelAlertConfig.daysWithoutRefueling && v.lastTimestamp > 0) {
        const d = { 
          placa: v.placa, 
          tipo: 'Dias s/ Abastecer', 
          descricao: `Cód. Transação: ${v.lastTx?._txId} | ${dias} dias sem abastecer`, 
          data: v.lastTx?.["DATA TRANSACAO"] || v.lastTx?._formattedDate || v.lastTx?._date
        };
        desvios.push(d);
        v.alerts.add('Dias s/ Abastecer');
        stats.dias++;
      }

      return { ...v, autPadrao, autReal: autRealAvg, desvAut, dias, 
               ultimaData: v.lastTimestamp ? formatDateToPtBR(new Date(v.lastTimestamp).toISOString().split('T')[0]) : "N/A" };
    });

    const plaquesRanking = enrichedData
      .map(v => ({ ...v, totalAlerts: v.alerts.size }))
      .filter(v => v.totalAlerts > 0 && assetsByPlaca.has(v.placa))
      .sort((a, b) => b.totalAlerts - a.totalAlerts)
      .slice(0, 10);

    const condutoresRanking = Object.entries(
      filteredFuel.reduce((acc: Record<string, number>, f: any) => {
        const condutor = f._driver || f["NOME MOTORISTA"] || ((f as any).__raw && (f as any).__raw[11]) || "NÃO IDENTIFICADO";
        const placa = f._placa;
        
        if (placa.startsWith("MAQ")) return acc;
        
        const v = vehicleMap.get(placa);
        if (v && v.alerts.size > 0 && assetsByPlaca.has(placa)) {
          acc[condutor] = (acc[condutor] || 0) + v.alerts.size;
        }
        return acc;
      }, {})
    )
      .map(([name, total]) => ({ name, total: Number(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return { desvios, statistics: stats, enrichedData, plaquesRanking, condutoresRanking };
  }, [filteredFuel, assetsByPlaca, fuelAlertConfig, avgPrecoLitro]);

  const fuelAnalysis = { desvios: fuelSummary.desvios, statistics: fuelSummary.statistics };

  const enrichedVehicleFuelData = fuelSummary.enrichedData;
  const plaquesRanking = fuelSummary.plaquesRanking;
  const condutoresRanking = fuelSummary.condutoresRanking;

  const desviosFiltered = useMemo(() => {
    return fuelAnalysis.desvios
      .filter(d => selectedDesviosChart.includes(d.tipo))
      .sort((a, b) => {
        const dateA = getFormattedDate(a.data);
        const dateB = getFormattedDate(b.data);
        if (!dateA || !dateB) return 0;
        return (new Date(dateB).getTime()) - (new Date(dateA).getTime());
      });
  }, [fuelAnalysis.desvios, selectedDesviosChart]);

  const handleExportAll = () => {
    toast.info("Exportando dados consolidados...");
    const data = filteredFuel.map((f: any) => {
      const raw = f.__raw || [];
      return {
        "Cód. Transação": raw[0] || f._txId || f["CODIGO TRANSACAO"] || f["Nº TRANSACAO"] || f.COL_0 || "N/A",
        "Data Transação": f["DATA TRANSACAO"] || f._date || raw[4] || f.COL_4 || "N/A",
        "Placa": f._placa || f.PLACA || f.Placa || raw[5] || f.COL_5 || "N/A",
        "Modelo Veículo": f["MODELO VEICULO"] || raw[10] || f.COL_10 || f._vehicleModel || "N/A",
        "Nome Motorista": f["NOME MOTORISTA"] || raw[11] || f.COL_11 || f._driver || "N/A",
        "Serviço": f["SERVICO"] || f["SERVIÇO"] || raw[12] || f.COL_12 || "N/A",
        "Tipo Combustível": f._fuelType || f["TIPO COMBUSTIVEL"] || raw[13] || f.COL_13 || "N/A",
        "Litros": parseBrazilianNumber(f.LITROS || raw[14] || f.COL_14 || 0),
        "VL/Litro": parseBrazilianNumber(f["VALOR UNITARIO"] || f["VL/UNITARIO"] || raw[15] || f.COL_15 || f._vlLitro || 0),
        "Hodometro ou Horimetro": f["ODOMETRO/HORIMETRO"] || raw[20] || f.COL_20 || f._odometer || "N/A",
        "Km Rodados ou Horas Trabalhadas": parseBrazilianNumber(f["KM RODADOS OU HORAS TRABALHADAS"] || raw[39] || f.COL_39 || f._kmRodados || 0),
        "Valor Emissão": parseBrazilianNumber(f["VALOR EMISSAO"] || raw[17] || f.COL_17 || f._total || 0),
        "Nome Estabelecimento": f._establishment || f._posto || f["NOME ESTABELECIMENTO"] || f["NOME POSTO"] || raw[21] || f.COL_21 || "N/A",
        "Endereço": f._endereco || f["ENDERECO"] || f["ENDEREÇO"] || raw[23] || f.COL_23 || "N/A",
        "Bairro": f._bairro || f["BAIRRO"] || raw[24] || f.COL_24 || "N/A",
        "Cidade": f._cidade || f["CIDADE"] || raw[25] || f.COL_25 || "N/A",
        "Informação Adicional 1": raw[27] || f["INFORMACAO ADICIONAL 1"] || f["INFORMAÇÃO ADICIONAL 1"] || f.COL_27 || "N/A",
        "Informação Adicional 2": raw[28] || f["INFORMACAO ADICIONAL 2"] || f["INFORMAÇÃO ADICIONAL 2"] || f.COL_28 || "N/A",
        "Informação Adicional 3": raw[29] || f["INFORMACAO ADICIONAL 3"] || f["INFORMAÇÃO ADICIONAL 3"] || f.COL_29 || "N/A",
        "Número Cartão": raw[35] || f["NUMERO CARTAO"] || f["N CARTAO"] || f["CARTAO"] || f.COL_35 || "N/A"
      };
    });
    exportToExcelMultiSheet([{ data, sheetName: "Analise" }], "Consolidado_Abastecimento");
  };

  const chartDesviosData = useMemo(() => {
    const s = fuelAnalysis.statistics;
    return [
      { name: 'Autonomia', value: s.autonomy },
      { name: 'KM/Hora', value: s.kmHora },
      { name: 'Litros/m³', value: s.litros },
      { name: 'Item Abastecido', value: s.item },
      { name: 'Dias s/ Abastecer', value: s.dias },
      { name: 'Valor/Litro', value: s.valorLitro },
      { name: 'Alerta Vale', value: (s as any).vale || 0 },
    ].filter(d => d.value > 0);
  }, [fuelAnalysis.statistics]);

  // Ranking by Unit
  const alertsByUnit = useMemo(() => {
    const map = new Map<string, { unit: string; total: number; desvios: any[] }>();
    fuelAnalysis.desvios.forEach((d) => {
      if (!assetsByPlaca.has(d.placa)) return; // APENAS veículos frota!
      const asset = assetsByPlaca.get(d.placa);
      const unit = asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.Gerencia || "N/A";
      if (!map.has(unit)) {
        map.set(unit, { unit, total: 0, desvios: [] });
      }
      map.get(unit).total++;
      map.get(unit).desvios.push(d);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [fuelAnalysis.desvios, assetsByPlaca]);

  // -------------------------------------------------------------------------
  // ADVANCED MACHINE LEARNING & STATISTICAL ANALYTICS ENGINE
  // -------------------------------------------------------------------------

  // 1. Data Preprocessing & Cleansing
  const processedTransactions = useMemo(() => {
    const vehicleGroups = new Map<string, any[]>();
    filteredFuel.forEach((f: any) => {
      const placa = f._placa || "N/A";
      if (placa === "N/A" || placa.startsWith("MAQ")) return;
      if (!vehicleGroups.has(placa)) {
        vehicleGroups.set(placa, []);
      }
      vehicleGroups.get(placa)!.push(f);
    });

    const allProcessed: any[] = [];

    vehicleGroups.forEach((txs, placa) => {
      // Sort by date / timestamp ascending
      const sorted = [...txs].sort((a: any, b: any) => {
        const tA = a._timestamp || new Date(a._date || 0).getTime();
        const tB = b._timestamp || new Date(b._date || 0).getTime();
        return tA - tB;
      });

      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : null;

        let odometerDiff = 0;
        if (prev && curr._odometer > 0 && prev._odometer > 0) {
          odometerDiff = curr._odometer - prev._odometer;
        }

        const km_percorrido = odometerDiff > 0 ? odometerDiff : (curr._kmRodados || curr._kmHoras || 0);
        const litros = curr._litros || 0;

        const km_l = litros > 0 ? km_percorrido / litros : 0;
        const consumo_l_100km = km_percorrido > 0 ? (litros / km_percorrido) * 100 : 0;

        const isInvalid = km_percorrido <= 0 || litros <= 0;

        allProcessed.push({
          rawTx: curr,
          placa,
          driver: curr._driver || curr["NOME MOTORISTA"] || "NÃO IDENTIFICADO",
          date: curr["DATA TRANSACAO"] || curr._formattedDate || curr._date,
          odometer: curr._odometer || 0,
          litros,
          km_percorrido,
          km_l,
          consumo_l_100km,
          isInvalid,
          txId: curr._txId || curr["CODIGO TRANSACAO"] || "N/A",
          cost: curr._total || (litros * (curr._vlLitro || 0)) || 0,
          vlLitro: curr._vlLitro || 0
        });
      }
    });

    return allProcessed;
  }, [filteredFuel]);

  // 2. Operational Indicators
  const operationalIndicators = useMemo(() => {
    const validTxs = processedTransactions.filter(t => !t.isInvalid);

    // Vehicles
    const vehicleStatsMap = new Map<string, any>();
    validTxs.forEach(t => {
      if (!vehicleStatsMap.has(t.placa)) {
        vehicleStatsMap.set(t.placa, { placa: t.placa, kms: [], liters: [], kmLs: [], costs: [], txs: [] });
      }
      const v = vehicleStatsMap.get(t.placa)!;
      v.kms.push(t.km_percorrido);
      v.liters.push(t.litros);
      v.kmLs.push(t.km_l);
      v.costs.push(t.cost);
      v.txs.push(t);
    });

    const vehiclesStats = Array.from(vehicleStatsMap.values()).map(v => {
      const totalKm = v.kms.reduce((a: number, b: number) => a + b, 0);
      const totalLiters = v.liters.reduce((a: number, b: number) => a + b, 0);
      const totalCost = v.costs.reduce((a: number, b: number) => a + b, 0);

      const kmLs = [...v.kmLs].sort((a, b) => a - b);
      const count = kmLs.length;
      const meanKmL = totalLiters > 0 ? totalKm / totalLiters : 0;

      let medianKmL = 0;
      if (count > 0) {
        if (count % 2 === 0) {
          medianKmL = (kmLs[count / 2 - 1] + kmLs[count / 2]) / 2;
        } else {
          medianKmL = kmLs[Math.floor(count / 2)];
        }
      }

      const variance = count > 1 ? v.kmLs.reduce((acc: number, val: number) => acc + Math.pow(val - meanKmL, 2), 0) / (count - 1) : 0;
      const stdDevKmL = Math.sqrt(variance);

      return {
        placa: v.placa,
        meanKmL,
        medianKmL,
        stdDevKmL,
        totalKm,
        totalLiters,
        totalCost,
        costPerKm: totalKm > 0 ? totalCost / totalKm : 0,
        costPerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
        count,
        txs: v.txs
      };
    });

    // Drivers
    const driverStatsMap = new Map<string, any>();
    validTxs.forEach(t => {
      if (!driverStatsMap.has(t.driver)) {
        driverStatsMap.set(t.driver, { driver: t.driver, kms: [], liters: [], kmLs: [], costs: [], txs: [] });
      }
      const d = driverStatsMap.get(t.driver)!;
      d.kms.push(t.km_percorrido);
      d.liters.push(t.litros);
      d.kmLs.push(t.km_l);
      d.costs.push(t.cost);
      d.txs.push(t);
    });

    const driversStats = Array.from(driverStatsMap.values()).map(d => {
      const totalKm = d.kms.reduce((a: number, b: number) => a + b, 0);
      const totalLiters = d.liters.reduce((a: number, b: number) => a + b, 0);
      const totalCost = d.costs.reduce((a: number, b: number) => a + b, 0);

      const kmLs = [...d.kmLs].sort((a, b) => a - b);
      const count = kmLs.length;
      const meanKmL = totalLiters > 0 ? totalKm / totalLiters : 0;

      let medianKmL = 0;
      if (count > 0) {
        if (count % 2 === 0) {
          medianKmL = (kmLs[count / 2 - 1] + kmLs[count / 2]) / 2;
        } else {
          medianKmL = kmLs[Math.floor(count / 2)];
        }
      }

      const variance = count > 1 ? d.kmLs.reduce((acc: number, val: number) => acc + Math.pow(val - meanKmL, 2), 0) / (count - 1) : 0;
      const stdDevKmL = Math.sqrt(variance);

      return {
        driver: d.driver,
        meanKmL,
        medianKmL,
        stdDevKmL,
        totalKm,
        totalLiters,
        totalCost,
        costPerKm: totalKm > 0 ? totalCost / totalKm : 0,
        costPerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
        count,
        txs: d.txs
      };
    });

    return { vehiclesStats, driversStats };
  }, [processedTransactions]);

  // 3. Statistical Reference Percentiles
  const vehiclePercentiles = useMemo(() => {
    const map = new Map<string, { p5: number; p95: number }>();
    operationalIndicators.vehiclesStats.forEach(v => {
      const sortedKmLs = v.txs.map((t: any) => t.km_l).sort((a: number, b: number) => a - b);
      if (sortedKmLs.length >= 5) {
        const p5Idx = Math.floor(sortedKmLs.length * 0.05);
        const p95Idx = Math.floor(sortedKmLs.length * 0.95);
        map.set(v.placa, { p5: sortedKmLs[p5Idx], p95: sortedKmLs[p95Idx] });
      } else {
        map.set(v.placa, { p5: 0.5, p95: 35.0 });
      }
    });
    return map;
  }, [operationalIndicators]);

  // 4. Same-Day Double Refueling Maps
  const vehicleDateCounts = useMemo(() => {
    const map = new Map<string, number>();
    processedTransactions.forEach(t => {
      const dateStr = t.date ? String(t.date).split(" ")[0] : "N/A";
      const key = `${t.placa}_${dateStr}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [processedTransactions]);

  // 5. Linear Regression Models (liters vs km_percorrido)
  const regressionModels = useMemo(() => {
    const models = new Map<string, { slope: number; intercept: number; r2: number }>();
    const allResiduals: any[] = [];

    operationalIndicators.vehiclesStats.forEach(v => {
      if (v.count < 10) return;

      const txs = v.txs;
      const n = txs.length;
      let sumX = 0, sumY = 0;
      
      txs.forEach((t: any) => {
        sumX += t.km_percorrido;
        sumY += t.litros;
      });

      const meanX = sumX / n;
      const meanY = sumY / n;

      let num = 0;
      let den = 0;
      txs.forEach((t: any) => {
        const x = t.km_percorrido;
        const y = t.litros;
        num += (x - meanX) * (y - meanY);
        den += (x - meanX) * (x - meanX);
      });

      const slope = den !== 0 ? num / den : 0;
      const intercept = meanY - slope * meanX;

      let ssRes = 0;
      let ssTot = 0;
      txs.forEach((t: any) => {
        const x = t.km_percorrido;
        const y = t.litros;
        const predY = slope * x + intercept;
        ssRes += (y - predY) * (y - predY);
        ssTot += (y - meanY) * (y - meanY);
      });

      const r2 = ssTot !== 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
      models.set(v.placa, { slope, intercept, r2 });

      txs.forEach((t: any) => {
        const predY = slope * t.km_percorrido + intercept;
        const residual = t.litros - predY;
        allResiduals.push({
          ...t,
          predY,
          residual,
          r2,
          slope,
          intercept
        });
      });
    });

    const top10PositiveResiduals = [...allResiduals]
      .filter(r => r.residual > 0)
      .sort((a, b) => b.residual - a.residual)
      .slice(0, 10);

    return { models, allResiduals, top10PositiveResiduals };
  }, [operationalIndicators]);

  // 6. K-Means Driver Clustering (K = 3)
  const driverClustering = useMemo(() => {
    const drivers = operationalIndicators.driversStats.filter(d => d.count >= 2);
    if (drivers.length < 3) {
      return drivers.map(d => {
        let cluster: "eficiente" | "intermediário" | "alto consumo" = "intermediário";
        if (d.meanKmL > 6.5) cluster = "eficiente";
        else if (d.meanKmL < 4.5) cluster = "alto consumo";
        return { ...d, cluster, score: d.meanKmL };
      });
    }

    const means = drivers.map(d => d.meanKmL);
    const stds = drivers.map(d => d.stdDevKmL);

    const minMean = Math.min(...means);
    const maxMean = Math.max(...means);
    const rangeMean = maxMean - minMean || 1;

    const minStd = Math.min(...stds);
    const maxStd = Math.max(...stds);
    const rangeStd = maxStd - minStd || 1;

    const datapoints = drivers.map(d => {
      const normMean = (d.meanKmL - minMean) / rangeMean;
      const normStd = (d.stdDevKmL - minStd) / rangeStd;
      return { driver: d, x: normMean, y: normStd };
    });

    let centroids = [
      { x: 0.1, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.2 }
    ];

    let assignments = new Array(datapoints.length).fill(0);

    for (let iter = 0; iter < 10; iter++) {
      let changed = false;
      datapoints.forEach((dp, idx) => {
        let minDist = Infinity;
        let bestCluster = 0;
        centroids.forEach((c, cIdx) => {
          const dist = Math.pow(dp.x - c.x, 2) + Math.pow(dp.y - c.y, 2);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = cIdx;
          }
        });
        if (assignments[idx] !== bestCluster) {
          assignments[idx] = bestCluster;
          changed = true;
        }
      });

      if (!changed) break;

      const counts = [0, 0, 0];
      const sumsX = [0, 0, 0];
      const sumsY = [0, 0, 0];

      datapoints.forEach((dp, idx) => {
        const cIdx = assignments[idx];
        counts[cIdx]++;
        sumsX[cIdx] += dp.x;
        sumsY[cIdx] += dp.y;
      });

      centroids = centroids.map((c, cIdx) => {
        if (counts[cIdx] === 0) return c;
        return { x: sumsX[cIdx] / counts[cIdx], y: sumsY[cIdx] / counts[cIdx] };
      });
    }

    const clusterAverages = [0, 1, 2].map(cIdx => {
      const items = datapoints.filter((_, idx) => assignments[idx] === cIdx);
      if (items.length === 0) return 0;
      return items.reduce((acc, val) => acc + val.driver.meanKmL, 0) / items.length;
    });

    const sortedClusterIndices = [0, 1, 2].sort((a, b) => clusterAverages[a] - clusterAverages[b]);
    const labelMap = new Map<number, "eficiente" | "intermediário" | "alto consumo">();
    labelMap.set(sortedClusterIndices[0], "alto consumo");
    labelMap.set(sortedClusterIndices[1], "intermediário");
    labelMap.set(sortedClusterIndices[2], "eficiente");

    return datapoints.map((dp, idx) => {
      const clusterLabel = labelMap.get(assignments[idx]) || "intermediário";
      return {
        ...dp.driver,
        cluster: clusterLabel,
        score: dp.driver.meanKmL
      };
    });
  }, [operationalIndicators]);

  // 7. Advanced Anomaly Detection (Multiclass)
  const advancedAnomalies = useMemo(() => {
    const anomalies: any[] = [];
    const sortedByVehicle = new Map<string, any[]>();
    processedTransactions.forEach(t => {
      if (!sortedByVehicle.has(t.placa)) {
        sortedByVehicle.set(t.placa, []);
      }
      sortedByVehicle.get(t.placa)!.push(t);
    });

    sortedByVehicle.forEach((txs, placa) => {
      const sorted = [...txs].sort((a, b) => {
        const tA = a.rawTx._timestamp || new Date(a.date || 0).getTime();
        const tB = b.rawTx._timestamp || new Date(b.date || 0).getTime();
        return tA - tB;
      });

      const vStats = operationalIndicators.vehiclesStats.find(v => v.placa === placa);
      const pPercentiles = vehiclePercentiles.get(placa);

      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : null;
        const alerts: { rule: string; explanation: string; action: string; calculation?: string }[] = [];

        // Odômetro Regressivo
        if (prev && curr.odometer > 0 && prev.odometer > 0 && curr.odometer <= prev.odometer) {
          alerts.push({
            rule: "Odômetro Regressivo",
            explanation: `Odômetro atual (${curr.odometer} km) menor ou igual ao anterior (${prev.odometer} km)`,
            action: "Conferir leitura física do odômetro e reajustar digitação manual",
            calculation: `Cálculo: Odômetro Atual (${curr.odometer} km) <= Odômetro Anterior (${prev.odometer} km). Diferença: ${curr.odometer - prev.odometer} km.`
          });
        }

        // Abastecimento Duplo
        const dateStr = curr.date ? String(curr.date).split(" ")[0] : "N/A";
        const sameDayCount = vehicleDateCounts.get(`${placa}_${dateStr}`) || 0;
        if (sameDayCount > 1) {
          alerts.push({
            rule: "Abastecimento Duplo",
            explanation: `Registrados ${sameDayCount} abastecimentos do mesmo veículo no mesmo dia (${dateStr})`,
            action: "Verificar notas fiscais correspondentes e desconsiderar duplicatas",
            calculation: `Cálculo: Abastecimentos no mesmo dia para placa ${placa} = ${sameDayCount}. Abastecimentos permitidos por dia = 1.`
          });
        }

        // Excesso de Tanque (>110% capacidade)
        const asset = assetsByPlaca.get(placa);
        if (asset) {
          const assetRaw = (asset as any).__raw || [];
          const fuelPadraoAtivo = standardizeFuelType(assetRaw[11]);
          const fuelSecAtivo = standardizeFuelType(assetRaw[32]);
          const fuelType = curr.rawTx._fuelType;
          
          let limit = 0;
          if (fuelType === fuelPadraoAtivo) limit = parseBrazilianNumber(assetRaw[30]);
          else if (fuelType === fuelSecAtivo) limit = parseBrazilianNumber(assetRaw[34]);

          if (limit > 0 && curr.litros > 1.1 * limit) {
            alerts.push({
              rule: "Excesso de Tanque",
              explanation: `Volume abastecido (${curr.litros.toFixed(1)}L) excede 110% da capacidade nominal (${limit}L)`,
              action: "Verificar nota fiscal ou investigar possível abastecimento irregular fora do tanque",
              calculation: `Cálculo: Litros abastecidos (${curr.litros.toFixed(1)}L) > 1.1 * Capacidade Nominal (${limit}L) [${(limit * 1.1).toFixed(1)}L]. Diferença: +${(curr.litros - limit).toFixed(1)}L (${((curr.litros / limit - 1) * 100).toFixed(1)}%).`
            });
          }
        }

        // Regra Estatística de Autonomia (km/l < média - 2*desvio padrão)
        if (vStats && vStats.count >= 5 && vStats.stdDevKmL > 0 && curr.km_l > 0) {
          const minAcceptable = vStats.meanKmL - 2 * vStats.stdDevKmL;
          if (curr.km_l < minAcceptable) {
            alerts.push({
              rule: "Sub-Consumo Crítico",
              explanation: `Autonomia real de ${curr.km_l.toFixed(2)} Km/L abaixo do limite de desvio (-2 DP: ${minAcceptable.toFixed(2)})`,
              action: "Investigar padrão de condução do motorista ou possíveis vazamentos",
              calculation: `Cálculo: Autonomia de ${curr.km_l.toFixed(2)} Km/L < Média (${vStats.meanKmL.toFixed(2)} Km/L) - 2 * Desvio Padrão (${vStats.stdDevKmL.toFixed(2)} Km/L). Limite mínimo aceitável: ${minAcceptable.toFixed(2)} Km/L.`
            });
          }
        }

        // Fora do Percentil P5 - P95
        if (pPercentiles && pPercentiles.p5 > 0 && curr.km_l > 0) {
          if (curr.km_l < pPercentiles.p5 || curr.km_l > pPercentiles.p95) {
            const bound = curr.km_l < pPercentiles.p5 ? `P5 (${pPercentiles.p5.toFixed(2)})` : `P95 (${pPercentiles.p95.toFixed(2)})`;
            alerts.push({
              rule: "Percentil Extremo",
              explanation: `Eficiência de ${curr.km_l.toFixed(2)} Km/L fora do intervalo histórico P5-P95 (limite ${bound})`,
              action: "Verificar consistência da leitura do odômetro ou quantidade de combustível",
              calculation: `Cálculo: Autonomia de ${curr.km_l.toFixed(2)} Km/L fora da faixa permitida [P5: ${pPercentiles.p5.toFixed(2)} Km/L, P95: ${pPercentiles.p95.toFixed(2)} Km/L].`
            });
          }
        }

        if (alerts.length > 0) {
          anomalies.push({
            ...curr,
            alerts
          });
        }
      }
    });

    return anomalies.sort((a, b) => b.alerts.length - a.alerts.length);
  }, [processedTransactions, operationalIndicators, vehiclePercentiles, vehicleDateCounts, assetsByPlaca]);

  // 8. Advanced ML Render View
  const renderAdvancedMLMonitoramentoContent = () => {
    const CustomRegressionTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
          <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-lg shadow-xl text-xs text-slate-200 font-sans space-y-1.5 backdrop-blur-sm">
            <p className="font-black text-indigo-400 text-[10px] uppercase tracking-wider">Detalhamento do Abastecimento</p>
            <p><span className="text-slate-400 font-medium">Data:</span> <span className="font-semibold text-slate-100">{String(data.date).split(' ')[0]}</span></p>
            <p><span className="text-slate-400 font-medium">Motorista:</span> <span className="font-semibold text-slate-100 uppercase">{data.driver}</span></p>
            <p><span className="text-slate-400 font-medium">Distância Percorrida:</span> <span className="font-bold text-slate-150">{data.km_percorrido} km</span></p>
            <div className="border-t border-slate-800/80 my-1 pt-1 space-y-0.5">
              <p><span className="text-slate-400 font-medium">Litros Abastecidos:</span> <span className="font-bold text-rose-400">{data.litrosActual?.toFixed(1)} L</span></p>
              <p><span className="text-slate-400 font-medium">Previsão Regressão:</span> <span className="font-bold text-indigo-400">{data.litrosLine?.toFixed(1)} L</span></p>
              <p>
                <span className="text-slate-400 font-medium">Diferença (Resíduo):</span>{" "}
                <span className={`font-black ${data.residual > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {data.residual > 0 ? `+${data.residual.toFixed(1)}` : data.residual.toFixed(1)} L
                </span>
              </p>
            </div>
            {data.residual > 10 && (
              <div className="mt-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-wider text-center animate-pulse">
                Ponto Fora da Curva (Anomalia)
              </div>
            )}
          </div>
        );
      }
      return null;
    };

    const filteredDrivers = driverClustering.filter(d => 
      d.driver.toUpperCase().includes(mlDriverSearch.toUpperCase())
    );

    const filteredAnomalies = advancedAnomalies.filter(a => 
      a.placa.toUpperCase().includes(mlAnomalySearch.toUpperCase()) ||
      a.driver.toUpperCase().includes(mlAnomalySearch.toUpperCase()) ||
      a.alerts.some((al: any) => al.rule.toUpperCase().includes(mlAnomalySearch.toUpperCase()))
    );

    // Grouping by cluster
    const efficientDrivers = filteredDrivers.filter(d => d.cluster === "eficiente");
    const intermediateDrivers = filteredDrivers.filter(d => d.cluster === "intermediário");
    const highDrivers = filteredDrivers.filter(d => d.cluster === "alto consumo");

    const DRIVERS_PER_PAGE = 5;

    // Slices for K-Means columns
    const efficientTotalPages = Math.ceil(efficientDrivers.length / DRIVERS_PER_PAGE) || 1;
    const currentEfficientDrivers = efficientDrivers.slice((mlEfficientPage - 1) * DRIVERS_PER_PAGE, mlEfficientPage * DRIVERS_PER_PAGE);

    const intermediateTotalPages = Math.ceil(intermediateDrivers.length / DRIVERS_PER_PAGE) || 1;
    const currentIntermediateDrivers = intermediateDrivers.slice((mlIntermediatePage - 1) * DRIVERS_PER_PAGE, mlIntermediatePage * DRIVERS_PER_PAGE);

    const highTotalPages = Math.ceil(highDrivers.length / DRIVERS_PER_PAGE) || 1;
    const currentHighDrivers = highDrivers.slice((mlHighPage - 1) * DRIVERS_PER_PAGE, mlHighPage * DRIVERS_PER_PAGE);

    // Regression models paginated
    const regressionModelsArray = Array.from(regressionModels.models.entries());
    const REGRESSION_PER_PAGE = 8;
    const regressionTotalPages = Math.ceil(regressionModelsArray.length / REGRESSION_PER_PAGE) || 1;
    const currentRegressionModels = regressionModelsArray.slice((mlRegressionPage - 1) * REGRESSION_PER_PAGE, mlRegressionPage * REGRESSION_PER_PAGE);

    // Anomalies paginated
    const ANOMALIES_PER_PAGE = 10;
    const anomaliesTotalPages = Math.ceil(filteredAnomalies.length / ANOMALIES_PER_PAGE) || 1;
    const currentAnomalies = filteredAnomalies.slice((mlAnomaliesPage - 1) * ANOMALIES_PER_PAGE, mlAnomaliesPage * ANOMALIES_PER_PAGE);

    return (
      <TooltipProvider>
        <div id="ml-advanced-panel" className="space-y-6">
          {/* Banner de apresentação */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-800/40 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Cpu className="h-40 w-40 text-indigo-400 animate-pulse" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-400" />
                  <Badge variant="outline" className="border-indigo-400/50 text-indigo-300 font-bold uppercase text-[9px] tracking-widest bg-indigo-500/10">
                    Analytics & Machine Learning
                  </Badge>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">
                  Monitoramento e Análise de Desvios Avançado
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Utilize algoritmos estatísticos e computacionais avançados de regressão linear integrada e agrupamento <span className="font-bold text-indigo-300">K-Means (K=3)</span> para auditoria automatizada e detecção inteligente de faturamento fantasma ou anomalias operacionais.
                </p>
              </div>
              <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
                <Button
                  onClick={handleExportCSV}
                  className="flex-1 md:flex-none h-9 px-4 text-[10px] uppercase font-black tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5 shadow-md"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </Button>
                <Button
                  onClick={handleExportPDF}
                  className="flex-1 md:flex-none h-9 px-4 text-[10px] uppercase font-black tracking-wider bg-slate-850 hover:bg-slate-800 text-white border border-slate-700/60 gap-1.5 shadow-md"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Exportar PDF
                </Button>
              </div>
            </div>
          </div>

          {/* KPIs Grid */}
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard
              title="Ajustes de Regressão"
              value={`${regressionModels.models.size}`}
              icon={<TrendingUp className="h-4 w-4 text-indigo-400" />}
              description="Veículos com ≥ 10 abastecimentos"
            />
            <MetricCard
              title="Conformidade Operacional"
              value={`${(100 - (advancedAnomalies.length / (processedTransactions.length || 1) * 100)).toFixed(1)}%`}
              icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
              description="Livre de anomalias operacionais"
            />
            <MetricCard
              title="Alertas Multicamada"
              value={`${advancedAnomalies.length}`}
              icon={<AlertCircle className="h-4 w-4 text-rose-400" />}
              description={`De ${processedTransactions.filter(t => !t.isInvalid).length} registros válidos`}
            />
            <MetricCard
              title="Eficientes / Alto Consumo"
              value={`${driverClustering.filter(d => d.cluster === "eficiente").length} / ${driverClustering.filter(d => d.cluster === "alto consumo").length}`}
              icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
              description="Motoristas segmentados via K-Means"
            />
          </div>

          {/* Sub-tab navigation */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 pb-1 gap-2 overflow-x-auto scrollbar-none">
            <Button
              variant={mlSubTab === "motoristas" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMlSubTab("motoristas")}
              className="font-bold text-xs uppercase tracking-wider shrink-0"
            >
              <Brain className="mr-1.5 h-3.5 w-3.5" />
              1. Clustering de Motoristas (K-Means)
            </Button>
            <Button
              variant={mlSubTab === "regressao" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMlSubTab("regressao")}
              className="font-bold text-xs uppercase tracking-wider shrink-0"
            >
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
              2. Modelos de Regressão & Resíduos
            </Button>
            <Button
              variant={mlSubTab === "alertas" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMlSubTab("alertas")}
              className="font-bold text-xs uppercase tracking-wider shrink-0"
            >
              <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
              3. Alertas Avançados ({filteredAnomalies.length})
            </Button>
          </div>

          {/* Sub-tab content */}
          {mlSubTab === "motoristas" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Segmentação Estatística de Motoristas
                    </h3>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-400 hover:text-indigo-500 rounded-full shrink-0">
                          <Info className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md bg-slate-950 border border-slate-800 text-slate-200 p-4 rounded-xl shadow-2xl space-y-2 text-xs" side="bottom">
                        <p className="font-black text-indigo-400 text-[11px] uppercase tracking-wider">Como funciona o K-Means (K=3)?</p>
                        <p className="leading-relaxed">
                          O algoritmo K-Means é um método de agrupamento não supervisionado que particiona os motoristas em 3 perfis operacionais com base em suas variáveis de condução:
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Média da Autonomia (Km/L):</strong> Mede o rendimento médio do combustível por quilômetro rodado.
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Variabilidade Operacional (Desvio Padrão - DP):</strong> Representa a oscilação do condutor. Um DP baixo indica estabilidade e manutenção de velocidades constantes. Um DP elevado indica acelerações ou frenagens abruptas, rotas mistas agressivas ou possíveis inconsistências nos dados de abastecimento.
                        </p>
                        <p className="leading-relaxed text-slate-400 italic">
                          O algoritmo minimiza as distâncias euclidianas dos motoristas aos centroides representativos de cada faixa operacional.
                        </p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-450 max-w-2xl">
                    Agrupamento de motoristas através das métricas de <span className="font-semibold text-indigo-600 dark:text-indigo-400">Eficiência Média</span> e <span className="font-semibold text-indigo-600 dark:text-indigo-400">Desvio Padrão Histórico</span>.
                  </p>
                </div>
                <div className="relative w-full md:w-72 shrink-0">
                  <input
                    type="text"
                    placeholder="Filtrar motorista..."
                    value={mlDriverSearch}
                    onChange={(e) => setMlDriverSearch(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Clusters columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cluster Eficiente */}
                <div className="border border-emerald-150 dark:border-emerald-950/40 bg-emerald-50/5 dark:bg-emerald-950/5 rounded-2xl p-4 flex flex-col h-[520px] shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-100/40 dark:border-emerald-950/20 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="font-black text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                        Eficiente
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer text-emerald-600 dark:text-emerald-400"><Info className="h-3.5 w-3.5" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-950 border border-slate-800 p-3 rounded-lg text-[11px] leading-relaxed" side="top">
                            <p className="font-bold text-emerald-400">Perfil Eficiente</p>
                            Condutores com média de rendimento superior e alta estabilidade de condução (baixo desvio padrão). Recomendado para reconhecimento e compartilhamento de boas práticas.
                          </TooltipContent>
                        </UITooltip>
                      </h4>
                    </div>
                    <Badge variant="outline" className="bg-emerald-100/35 border-emerald-200/40 text-emerald-700 dark:text-emerald-400 font-bold text-[9px] uppercase">
                      {efficientDrivers.length} Motoristas
                    </Badge>
                  </div>
                  
                  <ScrollArea className="flex-1 pr-1">
                    <div className="space-y-2.5">
                      {currentEfficientDrivers.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhum motorista</div>
                      ) : (
                        currentEfficientDrivers.map((d, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-100 truncate flex-1">{d.driver}</p>
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] uppercase font-black py-0 px-1.5 shrink-0">EF</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100/50 dark:border-slate-800/40 text-[9px] font-bold uppercase text-slate-450 dark:text-slate-550">
                              <div>
                                <span>Média Autonomia</span>
                                <span className="block font-black text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">{d.meanKmL.toFixed(2)} Km/L</span>
                              </div>
                              <div>
                                <span>Variabilidade (DP)</span>
                                <span className="block font-black text-slate-700 dark:text-slate-300 text-xs mt-0.5">±{d.stdDevKmL.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Pagination Controls */}
                  {efficientTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlEfficientPage === 1}
                        onClick={() => setMlEfficientPage(prev => Math.max(1, prev - 1))}
                        className="h-7 px-2 text-[10px] font-bold gap-1 uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-3 w-3" /> Ant
                      </Button>
                      <span className="text-[9px] font-black text-slate-500 uppercase">
                        Pág {mlEfficientPage} de {efficientTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlEfficientPage >= efficientTotalPages}
                        onClick={() => setMlEfficientPage(prev => Math.min(efficientTotalPages, prev + 1))}
                        className="h-7 px-2 text-[10px] font-bold gap-1 uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Próx <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Cluster Intermediário */}
                <div className="border border-amber-150 dark:border-amber-950/40 bg-amber-50/5 dark:bg-amber-950/5 rounded-2xl p-4 flex flex-col h-[520px] shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-100/40 dark:border-amber-950/20 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <h4 className="font-black text-xs uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                        Intermediário
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer text-amber-600 dark:text-amber-400"><Info className="h-3.5 w-3.5" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-950 border border-slate-800 p-3 rounded-lg text-[11px] leading-relaxed" side="top">
                            <p className="font-bold text-amber-400">Perfil Intermediário</p>
                            Condutores operando na média esperada da frota, com variações normais de trajeto e carga. Desempenho dentro da conformidade padrão.
                          </TooltipContent>
                        </UITooltip>
                      </h4>
                    </div>
                    <Badge variant="outline" className="bg-amber-100/35 border-amber-200/40 text-amber-700 dark:text-amber-400 font-bold text-[9px] uppercase">
                      {intermediateDrivers.length} Motoristas
                    </Badge>
                  </div>
                  
                  <ScrollArea className="flex-1 pr-1">
                    <div className="space-y-2.5">
                      {currentIntermediateDrivers.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhum motorista</div>
                      ) : (
                        currentIntermediateDrivers.map((d, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800 transition-all">
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-100 truncate flex-1">{d.driver}</p>
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[8px] uppercase font-black py-0 px-1.5 shrink-0">INT</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100/50 dark:border-slate-800/40 text-[9px] font-bold uppercase text-slate-450 dark:text-slate-550">
                              <div>
                                <span>Média Autonomia</span>
                                <span className="block font-black text-amber-600 dark:text-amber-400 text-xs mt-0.5">{d.meanKmL.toFixed(2)} Km/L</span>
                              </div>
                              <div>
                                <span>Variabilidade (DP)</span>
                                <span className="block font-black text-slate-700 dark:text-slate-300 text-xs mt-0.5">±{d.stdDevKmL.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Pagination Controls */}
                  {intermediateTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlIntermediatePage === 1}
                        onClick={() => setMlIntermediatePage(prev => Math.max(1, prev - 1))}
                        className="h-7 px-2 text-[10px] font-bold gap-1 uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-3 w-3" /> Ant
                      </Button>
                      <span className="text-[9px] font-black text-slate-500 uppercase">
                        Pág {mlIntermediatePage} de {intermediateTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlIntermediatePage >= intermediateTotalPages}
                        onClick={() => setMlIntermediatePage(prev => Math.min(intermediateTotalPages, prev + 1))}
                        className="h-7 px-2 text-[10px] font-bold gap-1 uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Próx <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Cluster Alto Consumo */}
                <div className="border border-rose-150 dark:border-rose-950/40 bg-rose-50/5 dark:bg-rose-950/5 rounded-2xl p-4 flex flex-col h-[520px] shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-rose-100/40 dark:border-rose-950/20 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <h4 className="font-black text-xs uppercase tracking-wider text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                        Alto Consumo
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer text-rose-600 dark:text-rose-400"><Info className="h-3.5 w-3.5" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-950 border border-slate-800 p-3 rounded-lg text-[11px] leading-relaxed" side="top">
                            <p className="font-bold text-rose-400">Perfil de Alto Consumo</p>
                            Condutores com média de autonomia reduzida ou altíssima variabilidade. Sugere rotas agressivas, ociosidade prolongada em marcha lenta ou desvios de combustível.
                          </TooltipContent>
                        </UITooltip>
                      </h4>
                    </div>
                    <Badge variant="outline" className="bg-rose-100/35 border-rose-200/40 text-rose-700 dark:text-rose-400 font-bold text-[9px] uppercase">
                      {highDrivers.length} Motoristas
                    </Badge>
                  </div>
                  
                  <ScrollArea className="flex-1 pr-1">
                    <div className="space-y-2.5">
                      {currentHighDrivers.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhum motorista</div>
                      ) : (
                        currentHighDrivers.map((d, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-rose-300 dark:hover:border-rose-850 transition-all relative overflow-hidden">
                            <span className="absolute top-0 right-0 h-full w-1 bg-rose-500" />
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-100 truncate flex-1 pr-2">{d.driver}</p>
                              <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[8px] uppercase font-black py-0 px-1.5 shrink-0">AC</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100/50 dark:border-slate-800/40 text-[9px] font-bold uppercase text-slate-450 dark:text-slate-550">
                              <div>
                                <span>Média Autonomia</span>
                                <span className="block font-black text-rose-600 dark:text-rose-400 text-xs mt-0.5">{d.meanKmL.toFixed(2)} Km/L</span>
                              </div>
                              <div>
                                <span>Variabilidade (DP)</span>
                                <span className="block font-black text-rose-700 dark:text-rose-400 text-xs mt-0.5">±{d.stdDevKmL.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Pagination Controls */}
                  {highTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlHighPage === 1}
                        onClick={() => setMlHighPage(prev => Math.max(1, prev - 1))}
                        className="h-7 px-2 text-[10px] font-bold gap-1 uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-3 w-3" /> Ant
                      </Button>
                      <span className="text-[9px] font-black text-slate-500 uppercase">
                        Pág {mlHighPage} de {highTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlHighPage >= highTotalPages}
                        onClick={() => setMlHighPage(prev => Math.min(highTotalPages, prev + 1))}
                        className="h-7 px-2 text-[10px] font-bold gap-1 uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Próx <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {mlSubTab === "regressao" && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* Top 10 Positive Residuals Card */}
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-rose-50/20 dark:bg-rose-950/10 border-b border-rose-100/30">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-500" />
                      <CardTitle className="text-xs uppercase font-black tracking-wider text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                        Sinalização de Top 10 Maiores Resíduos Positivos (Superabastecimento / Erro)
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-rose-600 dark:text-rose-400 hover:bg-rose-100/30 rounded-full">
                              <Info className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-200 text-xs space-y-2 shadow-2xl" side="bottom">
                            <p className="font-black text-rose-400 text-[11px] uppercase tracking-wider">Como o Resíduo de Consumo é Calculado?</p>
                            <p className="leading-relaxed">
                              O <strong>Resíduo</strong> é a diferença entre os Litros Reais Abastecidos e os Litros Previstos pela Regressão Linear:
                            </p>
                            <p className="font-mono bg-slate-900 p-2 rounded text-center text-rose-300 font-bold my-1 text-[11px]">
                              Resíduo = Litros Real - (Slope × KM Percorrido + Intercept)
                            </p>
                            <p className="leading-relaxed">
                              • <strong>Previsão Estatística:</strong> O modelo calcula quantos litros o veículo deveria consumir baseado na distância rodada e na inclinação (Slope / L/Km) histórica do próprio veículo.
                            </p>
                            <p className="leading-relaxed">
                              • <strong>Sinalização Vermelha:</strong> Se um veículo rodou 100 Km e consome 0.1 L/Km, sua previsão é 10L. Se o abastecimento foi de 40L, temos um <strong>Resíduo Positivo de +30 Litros</strong>. Isso indica erro de digitação, vazamento físico ou faturamento fantasma.
                            </p>
                          </TooltipContent>
                        </UITooltip>
                      </CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-[10px] text-slate-500 dark:text-slate-450 mt-1">
                    Transações onde a quantidade de litros reais abastecidos superou significativamente a previsão matemática ajustada ao rendimento individual e quilometragem do veículo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-black text-center">Placa</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Data</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Motorista</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center">KM Percorrido</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center">Litros Reais</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center">Previsto (Regressão)</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center text-rose-600">Resíduo (Excesso)</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-right">Ação Recomendada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regressionModels.top10PositiveResiduals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Nenhum veículo com registros suficientes (≥ 10 abastecimentos) para ajuste de resíduos.
                          </TableCell>
                        </TableRow>
                      ) : (
                        regressionModels.top10PositiveResiduals.map((r, idx) => (
                          <TableRow key={idx} className="hover:bg-rose-50/5 dark:hover:bg-rose-950/5">
                            <TableCell className="text-center">
                              <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-black tracking-widest text-slate-800 dark:text-slate-200 uppercase relative overflow-hidden inline-flex items-center h-5">
                                <span className="absolute top-0 left-0 right-0 h-0.5 bg-blue-600" />
                                {r.placa}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{String(r.date).split(" ")[0]}</TableCell>
                            <TableCell className="text-xs font-semibold uppercase truncate max-w-[140px]" title={r.driver}>{r.driver}</TableCell>
                            <TableCell className="text-center text-xs font-medium">{r.km_percorrido} km</TableCell>
                            <TableCell className="text-center text-xs font-semibold">{r.litros.toFixed(1)} L</TableCell>
                            <TableCell className="text-center text-xs text-slate-400 font-medium">{(r.predY).toFixed(1)} L</TableCell>
                            <TableCell className="text-center text-xs font-black text-rose-600 dark:text-rose-400">+{r.residual.toFixed(1)} L</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Badge variant="outline" className="text-[8px] font-black bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 uppercase">
                                Verificar Nota Fiscal
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Gráfico Interativo de Regressão Linear & Resíduos */}
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-indigo-50/20 dark:bg-indigo-950/10 border-b border-indigo-100/30">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-indigo-500" />
                      <CardTitle className="text-xs uppercase font-black tracking-wider text-indigo-800 dark:text-indigo-400">
                        Análise Visual de Dispersão e Reta de Regressão por Veículo
                      </CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-[10px] text-slate-500 dark:text-slate-450 mt-1">
                    Selecione um veículo abaixo para analisar a dispersão dos abastecimentos reais (pontos) comparados à linha de consumo ideal de regressão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {regressionModelsArray.length === 0 ? (
                    <div className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Nenhum veículo com histórico suficiente (≥ 10 abastecimentos) para ajuste de regressão linear.
                    </div>
                  ) : (
                    (() => {
                      const activePlaca = selectedRegressionPlaca || regressionModelsArray[0]?.[0] || "";
                      const activeModel = regressionModels.models.get(activePlaca);
                      
                      const vehiclePoints = regressionModels.allResiduals
                        .filter(r => r.placa === activePlaca)
                        .map(r => ({
                          km_percorrido: r.km_percorrido,
                          litrosActual: r.litros,
                          litrosLine: activeModel ? (activeModel.slope * r.km_percorrido + activeModel.intercept) : 0,
                          residual: r.residual,
                          date: r.date,
                          driver: r.driver,
                        }))
                        .sort((a, b) => a.km_percorrido - b.km_percorrido);

                      const topDeviations = [...vehiclePoints]
                        .filter(pt => pt.residual > 0)
                        .sort((a, b) => b.residual - a.residual)
                        .slice(0, 3);

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Lado esquerdo: controles e estatisticas */}
                          <div className="lg:col-span-4 space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-500 tracking-widest block">Selecionar Veículo para Análise</label>
                              <select
                                value={activePlaca}
                                onChange={(e) => setSelectedRegressionPlaca(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-slate-50 dark:bg-slate-950 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800 dark:text-slate-200"
                              >
                                {regressionModelsArray.map(([placa]) => (
                                  <option key={placa} value={placa}>{placa}</option>
                                ))}
                              </select>
                            </div>

                            {activeModel && (
                              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800 pb-2">
                                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Métricas do Veículo</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${activeModel.r2 >= 0.7 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                    R²: {activeModel.r2.toFixed(3)}
                                  </span>
                                </div>

                                <div className="space-y-2 text-xs">
                                  <div>
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Equação Ajustada</span>
                                    <p className="font-mono font-black text-slate-800 dark:text-slate-100">
                                      Litros = {activeModel.slope.toFixed(4)} × Km {activeModel.intercept >= 0 ? `+ ${activeModel.intercept.toFixed(1)}` : `- ${Math.abs(activeModel.intercept).toFixed(1)}`}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Consumo Estimado (L/Km)</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">
                                      {activeModel.slope.toFixed(4)} L/Km (ou {(activeModel.slope * 100).toFixed(1)} Litros / 100 Km)
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Amostragem</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">
                                      {vehiclePoints.length} abastecimentos registrados
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {topDeviations.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-500 tracking-widest block">Top 3 Maiores Resíduos Reais</span>
                                <div className="space-y-1.5">
                                  {topDeviations.map((pt, idx) => (
                                    <div key={idx} className="bg-rose-50/20 dark:bg-rose-950/5 border border-rose-100/30 dark:border-rose-950/20 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
                                      <div className="space-y-0.5">
                                        <p className="font-semibold text-[10px] text-slate-500 dark:text-slate-400">{String(pt.date).split(' ')[0]} - {pt.km_percorrido} km</p>
                                        <p className="font-medium text-[9px] text-slate-400 uppercase truncate max-w-[150px]">{pt.driver}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-black text-rose-600 dark:text-rose-400">+{pt.residual.toFixed(1)} L</p>
                                        <p className="text-[8px] font-bold text-rose-400 uppercase">Resíduo</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Lado direito: Gráfico Scatter + Line */}
                          <div className="lg:col-span-8 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                            <div className="h-[300px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                  data={vehiclePoints}
                                  margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800/60" />
                                  <XAxis
                                    type="number"
                                    dataKey="km_percorrido"
                                    name="Distância"
                                    unit=" km"
                                    className="text-[10px] font-bold text-slate-450"
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                  />
                                  <YAxis
                                    type="number"
                                    dataKey="litrosActual"
                                    name="Litros"
                                    unit=" L"
                                    className="text-[10px] font-bold text-slate-450"
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                  />
                                  <Tooltip content={<CustomRegressionTooltip />} />
                                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                  
                                  <Scatter
                                    name="Consumo Real (L)"
                                    dataKey="litrosActual"
                                    fill="#6366f1"
                                    shape={(props: any) => {
                                      const { cx, cy, payload } = props;
                                      const isOutlier = payload && payload.residual > 10;
                                      return (
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={isOutlier ? 6 : 4}
                                          fill={isOutlier ? "#e11d48" : "#6366f1"}
                                          stroke={isOutlier ? "#fda4af" : "#c7d2fe"}
                                          strokeWidth={1.5}
                                          className="cursor-pointer hover:scale-125 transition-all"
                                        />
                                      );
                                    }}
                                  />
                                  
                                  <Line
                                    name="Linha de Regressão Esperada"
                                    dataKey="litrosLine"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={false}
                                  />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest pt-3 border-t border-slate-200/40 dark:border-slate-800 mt-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Abastecimento Histórico
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-600" /> Outlier / Desvio Elevado (&gt; 10L)
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Linha Estatística Ideal
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </CardContent>
              </Card>

              {/* Regression equations listing */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Ajuste Coeficientes Consumo Médio (L/KM) por Veículo
                  </h4>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-450 hover:text-indigo-500 rounded-full">
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-200 text-xs space-y-2 shadow-2xl" side="right">
                      <p className="font-black text-indigo-400 text-[11px] uppercase tracking-wider">Parâmetros de Ajuste de Regressão Linear por Veículo</p>
                      <p className="leading-relaxed">
                        • <strong>Equação de Regressão (Litros = Slope × Km + Intercept):</strong> A inclinação da reta (Slope) representa o consumo real marginal por quilômetro. O Intercept representa o consumo basal na partida.
                      </p>
                      <p className="leading-relaxed">
                        • <strong>R² (Coeficiente de Determinação):</strong> Mede a confiabilidade do modelo (de 0 a 1). Um R² &ge; 0.70 é considerado estatisticamente confiável e consistente. Valores baixos indicam alta aleatoriedade no padrão de consumo.
                      </p>
                      <p className="leading-relaxed">
                        • <strong>Amostras (pts):</strong> Indica a quantidade de pontos históricos válidos utilizados para calcular os coeficientes de regressão pelo método dos mínimos quadrados ordinários.
                      </p>
                    </TooltipContent>
                  </UITooltip>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {currentRegressionModels.length === 0 ? (
                    <div className="col-span-full bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/60 p-12 rounded-xl text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Nenhum modelo de regressão gerado (requer veículos com ≥ 10 transações históricas).
                    </div>
                  ) : (
                    currentRegressionModels.map(([placa, model], idx) => {
                      const reliable = model.r2 >= 0.70;
                      return (
                        <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/50 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 hover:shadow hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-black tracking-widest text-slate-800 dark:text-slate-200 uppercase relative overflow-hidden inline-flex items-center h-5">
                              <span className="absolute top-0 left-0 right-0 h-0.5 bg-blue-600" />
                              {placa}
                            </div>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <span className={`cursor-pointer px-2 py-0.5 rounded text-[9px] font-black tracking-wide border uppercase ${reliable ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}>
                                  R²: {model.r2.toFixed(2)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-slate-950 border border-slate-800 p-2 text-[10px]">
                                {reliable ? "Modelo altamente confiável (explica mais de 70% da variabilidade do consumo)." : "Modelo com moderada dispersão nos dados. Recomendado acumular mais amostras."}
                              </TooltipContent>
                            </UITooltip>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Equação Ajustada</span>
                            <p className="text-xs font-mono font-black text-indigo-650 dark:text-indigo-400">
                              Litros = {model.slope.toFixed(3)} &times; Km {model.intercept >= 0 ? `+ ${model.intercept.toFixed(1)}` : `- ${Math.abs(model.intercept).toFixed(1)}`}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase text-slate-450 border-t border-slate-100 dark:border-slate-800 pt-2">
                            <div>
                              <span>Consumo L/Km</span>
                              <span className="block text-slate-800 dark:text-slate-100 text-[10px] font-black mt-0.5">{(model.slope * 1000).toFixed(1)} L/kKm</span>
                            </div>
                            <div>
                              <span>Amostras</span>
                              <span className="block text-slate-800 dark:text-slate-100 text-[10px] font-black mt-0.5">
                                {operationalIndicators.vehiclesStats.find(v => v.placa === placa)?.count || 0} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Regression Grid Pagination Controls */}
                {regressionTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mlRegressionPage === 1}
                      onClick={() => setMlRegressionPage(prev => Math.max(1, prev - 1))}
                      className="h-8 gap-1.5 text-xs font-bold uppercase"
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <span className="text-xs font-black text-slate-500 uppercase px-3">
                      Página {mlRegressionPage} de {regressionTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mlRegressionPage >= regressionTotalPages}
                      onClick={() => setMlRegressionPage(prev => Math.min(regressionTotalPages, prev + 1))}
                      className="h-8 gap-1.5 text-xs font-bold uppercase"
                    >
                      Próxima <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {mlSubTab === "alertas" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Dossiê Completo de Anomalias (Detecção Multicamada)
                    </h3>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-400 hover:text-indigo-500 rounded-full">
                          <Info className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-200 text-xs space-y-2.5 shadow-2xl" side="bottom">
                        <p className="font-black text-indigo-400 text-[11px] uppercase tracking-wider">Como funciona o Dossiê de Anomalias?</p>
                        <p className="leading-relaxed">
                          O sistema cruza validações cruzadas matemáticas e físicas para emitir alertas com as seguintes origens estruturadas:
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Odômetro Regressivo:</strong> Apontamento de digitação errônea ou anomalia operacional no painel do veículo.
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Abastecimento Duplo:</strong> Registro de múltiplas transações no mesmo veículo no mesmo dia, sugerindo fraude de notas fiscais ou cupons falsos.
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Excesso de Tanque:</strong> Volume registrado excede fisicamente 110% da especificação nominal oficial do tanque do ativo correspondente.
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Sub-Consumo Crítico (Z-Score &le; -2.0):</strong> Autonomia em Km/L do abastecimento ficou mais de 2 desvios padrão abaixo da eficiência média de longo prazo do veículo.
                        </p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-450">
                    Auditoria inteligente cruzando dados do Nexus, telemetria física de tanques e regressão estatística integrada de resíduos.
                  </p>
                </div>
                <div className="relative w-full md:w-72 shrink-0">
                  <input
                    type="text"
                    placeholder="Buscar por placa, condutor ou alerta..."
                    value={mlAnomalySearch}
                    onChange={(e) => setMlAnomalySearch(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Anomalies Table */}
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                <CardContent className="p-0 flex flex-col">
                  <ScrollArea className="w-full overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-black text-center">Placa</TableHead>
                          <TableHead className="text-[10px] uppercase font-black">Data</TableHead>
                          <TableHead className="text-[10px] uppercase font-black">Motorista</TableHead>
                          <TableHead className="text-[10px] uppercase font-black">Métrica Alerta</TableHead>
                          <TableHead className="text-[10px] uppercase font-black">Explicação Técnica</TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-right">Ação Recomendada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentAnomalies.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-xs font-bold text-slate-400 uppercase tracking-widest">
                              Nenhuma anomalia encontrada com os termos buscados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          currentAnomalies.map((a, i) => (
                            <TableRow key={i} className="hover:bg-slate-50/5 dark:hover:bg-slate-900/5">
                              <TableCell className="text-center">
                                <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-black tracking-widest text-slate-800 dark:text-slate-200 uppercase relative overflow-hidden inline-flex items-center h-5">
                                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-blue-600" />
                                  {a.placa}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500 dark:text-slate-450 whitespace-nowrap">{String(a.date).split(" ")[0]}</TableCell>
                              <TableCell className="text-xs font-semibold uppercase truncate max-w-[120px]" title={a.driver}>{a.driver}</TableCell>
                              <TableCell className="space-y-1 py-2">
                                {a.alerts.map((al: any, idx: number) => (
                                  <Badge key={idx} variant="destructive" className="text-[8px] font-black uppercase tracking-wider block w-fit">
                                    {al.rule}
                                  </Badge>
                                ))}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-sm">
                                {a.alerts.map((al: any, idx: number) => (
                                  <span key={idx} className="block">
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <p className="leading-normal cursor-help hover:text-indigo-600 dark:hover:text-indigo-400 select-none">• {al.explanation}</p>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs leading-relaxed text-slate-200 shadow-2xl" side="top">
                                        <p className="font-bold text-indigo-400 uppercase text-[9px] tracking-wider mb-1">Memória de Cálculo (Placa {a.placa})</p>
                                        <p className="font-mono text-[10px] leading-normal break-words text-slate-350">{al.calculation || "Fórmula não disponível."}</p>
                                      </TooltipContent>
                                    </UITooltip>
                                  </span>
                                ))}
                              </TableCell>
                              <TableCell className="text-right text-xs py-2">
                                <div className="flex flex-col items-end gap-2.5 min-w-[150px]">
                                  {a.alerts.map((al: any, idx: number) => (
                                    <div key={idx} className="flex flex-col items-end gap-1">
                                      <p className="font-semibold text-indigo-650 dark:text-indigo-400 leading-normal block uppercase text-[10px] tracking-tight">{al.action}</p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSendAnomalyEmail(a, al)}
                                        className="h-6 px-2 text-[8px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1 mt-0.5"
                                      >
                                        <Mail className="h-2.5 w-2.5" />
                                        Solicitar Justificativa
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Anomalies Table Pagination Controls */}
                  {anomaliesTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlAnomaliesPage === 1}
                        onClick={() => setMlAnomaliesPage(prev => Math.max(1, prev - 1))}
                        className="h-8 gap-1.5 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-4 w-4" /> Anterior
                      </Button>
                      <span className="text-xs font-black text-slate-500 uppercase">
                        Mostrando {currentAnomalies.length} de {filteredAnomalies.length} alertas — Página {mlAnomaliesPage} de {anomaliesTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mlAnomaliesPage >= anomaliesTotalPages}
                        onClick={() => setMlAnomaliesPage(prev => Math.min(anomaliesTotalPages, prev + 1))}
                        className="h-8 gap-1.5 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Próxima <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  };

  const [activeTab, setActiveTab] = useState(initialTab || (desviosOnly ? "analise" : "analise"));

  // Sync internal state if needed, but Tabs handles its own.

  const renderMonitoramentoContent = () => (
    <div id="monitoramento-desvios" className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-2">
        <AlertTriangle className="h-5 w-5 text-rose-500" />
        <h2 className="text-lg font-bold uppercase tracking-tight">Monitoramento e Análise de Desvios</h2>
      </div>

      <FuelFilterBar
        fuel={fuel} assets={assets} autonomia={autonomia}
        selectedFuelTypes={selectedFuelTypes} selectedVehicleModels={selectedVehicleModels} searchPlaca={searchPlaca}
        selectedDirectorias={selectedDirectorias} selectedGerencias={selectedGerencias} selectedTipos={selectedTipos}
        selectedMonthsYears={selectedMonthsYears}
        selectedRegioes={selectedRegioes}
        selectedCidades={selectedCidades}
        selectedPropriedades={selectedPropriedades}
        onPropriedadesChange={setSelectedPropriedades}
        selectedTitularidades={selectedTitularidades}
        onTitularidadesChange={setSelectedTitularidades}
        dateFrom={dateFrom} dateTo={dateTo}
        onFuelTypesChange={setSelectedFuelTypes} onVehicleModelsChange={setSelectedVehicleModels} onSearchPlacaChange={setSearchPlaca}
        onDirectoriasChange={setSelectedDirectorias} onGerenciasChange={setSelectedGerencias} onTiposChange={setSelectedTipos}
        onMonthsYearsChange={setSelectedMonthsYears}
        onRegioesChange={setSelectedRegioes}
        onCidadesChange={setSelectedCidades}
        setDateFrom={setDateFrom} setDateTo={setDateTo}
        selectedAlerta={selectedAlerta} onAlertaChange={setSelectedAlerta}
        selectedAlertaAutonomia={selectedAlertaAutonomia} onAlertaAutonomiaChange={setSelectedAlertaAutonomia}
        selectedAlertaKmHora={selectedAlertaKmHora} onAlertaKmHoraChange={setSelectedAlertaKmHora}
        selectedAlertaLitros={selectedAlertaLitros} onAlertaLitrosChange={setSelectedAlertaLitros}
        selectedAlertaItem={selectedAlertaItem} onAlertaItemChange={setSelectedAlertaItem}
        selectedParecerNexus={selectedParecerNexus} onParecerNexusChange={setSelectedParecerNexus}
        selectedTipoControleAutonomia={selectedTipoControleAutonomia} onTipoControleAutonomiaChange={setSelectedTipoControleAutonomia}
        selectedAlertaValorLitro={selectedAlertaValorLitro} onAlertaValorLitroChange={setSelectedAlertaValorLitro}
        selectedAlertaVale={selectedAlertaVale} onAlertaValeChange={setSelectedAlertaVale}
        onClearFilters={handleClearFilters} dataUpdatedAt={dataUpdatedAt}
        fuelTypeOptions={fuelTypeOptions}
        modelOptions={modelOptions}
        diretoriaOptions={diretoriaOptions}
        gerenciaOptions={gerenciaOptions}
        tipoOptions={tipoOptions}
        monthYearOptions={monthYearOptions}
        autoControleOptions={autoControleOptions}
        regiaoOptions={regiaoOptions}
        cidadeOptions={cidadeOptions}
        propriedadeOptions={propriedadeOptions}
        titularidadeOptions={titularidadeOptions}
      />

      {!desviosOnly && (
        <>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="gap-2" onClick={() => toast.info("Exportando PDF...")}><FileText className="h-4 w-4" /> Exportar PDF</Button>
            <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" /> Exportar para Excel</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard title="Total de Combustível" value={`${totalLitros.toFixed(0)}L`} icon={<Fuel className="h-4 w-4" />} description={`${totalAbastecimentos} abastecimentos`} />
            <MetricCard title="Custo Total" value={`R$ ${totalValor.toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} />
            <MetricCard title="Preço Médio/Litro" value={`R$ ${avgPrecoLitro.toFixed(2)}`} icon={<Droplets className="h-4 w-4" />} />
            <MetricCard title="Autonomia Real" value={avgAutonomiaReal > 0 ? avgAutonomiaReal.toFixed(2) : 'N/A'} icon={<Activity className="h-4 w-4" />} />
          </div>
        </>
      )}

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Frequência de Desvios" className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDesviosData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} fontSize={10} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartDesviosData.map((entry, index) => {
                  const blueScale = ['#082f49', '#0c4a6e', '#075985', '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8'];
                  return <Cell key={`cell-${index}`} fill={blueScale[index % blueScale.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Condutores com Desvios" className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={condutoresRanking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} fontSize={9} />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(210, 60%, 60%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="h-[350px]">
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Últimos Desvios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[340px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black">Placa</TableHead>
                    <TableHead className="text-[10px] uppercase font-black">Tipo</TableHead>
                    <TableHead className="text-[10px] uppercase font-black text-right">Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {desviosFiltered.slice(0, 50).map((d, i) => (
                    <TableRow key={i} className="group hover:bg-muted/50">
                      <TableCell className="font-bold text-[10px]">{d.placa}</TableCell>
                      <TableCell className="text-[10px] font-medium">{d.tipo}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          onClick={() => setSelectedDesvioExplaining(d)}
                        >
                          <Info className="h-3 w-3 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Top Placas and Unit Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top 5 Placas com mais Desvios" className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plaquesRanking.slice(0, 5).map(p => ({ name: p.placa, total: p.totalAlerts }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} fontSize={12} fontStyle="bold" />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(210, 80%, 40%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Ranking of Units Card */}
        <Card className="h-[300px]">
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Top 5 Gerências Críticas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[290px]">
              <div className="px-4 space-y-2 pb-4">
                {alertsByUnit.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedGerencias([u.unit])}>
                      <span className="text-sm font-black text-slate-400">{i + 1}º</span>
                      <span className="text-xs font-bold truncate max-w-[150px]">{u.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[10px] h-5">{u.total} Alertas</Badge>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          const unitVehicles = enrichedVehicleFuelData.filter(v => v.unidade === u.unit && v.alerts.size > 0);
                          handleSendEmail(u.unit, unitVehicles);
                        }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Análise por Unidade e Ranking Detalhado</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className={`h-7 text-[9px] font-black uppercase tracking-widest ${rankingGroupByUnit ? 'bg-primary/10 border-primary' : 'border-primary/20'}`}
                onClick={() => setRankingGroupByUnit(!rankingGroupByUnit)}
              >
                Agrupar por Unidade
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-[9px] font-black uppercase tracking-widest gap-1.5 border-primary/20 hover:bg-primary/5"
                onClick={() => {
                  const byUnit: Record<string, any[]> = {};
                  plaquesRanking.forEach(p => {
                    if (!byUnit[p.unidade]) byUnit[p.unidade] = [];
                    byUnit[p.unidade].push(p);
                  });
                  Object.entries(byUnit).forEach(([unit, vehicles], idx) => {
                    setTimeout(() => handleSendEmail(unit, vehicles), idx * 1000);
                  });
                }}
              >
                <Mail className="h-3 w-3" /> Solicitar Tudo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rankingGroupByUnit ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const grouped: Record<string, any[]> = {};
                  plaquesRanking.forEach(p => {
                    if (!grouped[p.unidade]) grouped[p.unidade] = [];
                    grouped[p.unidade].push(p);
                  });
                  
                  return Object.entries(grouped).map(([unit, vehicles], idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden bg-muted/20">
                      <div className="bg-muted px-3 py-1.5 flex justify-between items-center text-[10px] font-black uppercase tracking-wider border-b">
                        <span className="truncate max-w-[200px]">{unit}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[9px] gap-1 hover:bg-primary/20 hover:text-primary transition-all font-bold border border-primary/20 rounded-full px-3"
                          onClick={() => handleSendEmail(unit, vehicles)}
                        >
                          <Mail className="h-3 w-3" /> Enviar Grupo (Nexus BI)
                        </Button>
                      </div>
                      <div className="p-1 space-y-1 bg-background">
                        {vehicles.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted/30 transition-colors group">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">{p.placa}</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{p.modelo}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 rounded">{p.totalAlerts} alertas</span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleSendEmail(p.unidade, [p])}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {plaquesRanking.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded bg-background hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{p.placa}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{p.modelo}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from(p.alerts as Set<string>).map((a, idx) => (
                          <div key={idx} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} title={a} />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 rounded ml-1">{p.totalAlerts}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleSendEmail(p.unidade, [p])}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Supply Analysis Table Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Análise Detalhada de Abastecimento</CardTitle>
              <CardDescription>Indicadores de performance e conformidade por veículo</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleExportAll}>
              <Download className="h-4 w-4" /> Exportar Planilha Completa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider">
                  <TableHead className="w-[100px]">Placa</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Abast.</TableHead>
                  <TableHead className="text-center">Dias Inativo</TableHead>
                  <TableHead className="text-center">Aut. Padrão</TableHead>
                  <TableHead className="text-center">Aut. Real</TableHead>
                  <TableHead className="text-center">Desvio %</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedVehicleFuelData.length === 0 ? (
                   <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum dado encontrado para os filtros selecionados.</TableCell></TableRow>
                ) : (
                  <>
                    {enrichedVehicleFuelData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((v) => {
                      const isCritical = Math.abs(v.desvAut || 0) > 30 || v.dias > 5;
                      return (
                        <TableRow key={v.placa} className={isCritical ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/50"}>
                          <TableCell className="font-bold text-xs">{v.placa}</TableCell>
                          <TableCell className="text-[10px] max-w-[150px] truncate">{v.unidade}</TableCell>
                          <TableCell className="text-center text-xs">{v.count}</TableCell>
                          <TableCell className={`text-center text-xs ${v.dias > 5 ? 'text-destructive font-bold' : ''}`}>{v.dias}d</TableCell>
                          <TableCell className="text-center text-xs">{(v.autPadrao || 0).toFixed(1)}</TableCell>
                          <TableCell className="text-center text-xs">{(v.autReal || 0).toFixed(1)}</TableCell>
                          <TableCell className={`text-center text-xs font-bold ${Math.abs(v.desvAut || 0) > 30 ? 'text-destructive' : 'text-success'}`}>
                            {(v.desvAut || 0) > 0 ? '+' : ''}{(v.desvAut || 0).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                              setSearchPlaca(v.placa);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              toast.success(`Filtro aplicado para a placa ${v.placa}`);
                            }}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
            {/* Paginação da Tabela Principal */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Página {currentPage} de {Math.ceil(enrichedVehicleFuelData.length / itemsPerPage)} ({enrichedVehicleFuelData.length} registros)
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[10px] font-black uppercase transition-all"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[10px] font-black uppercase transition-all"
                  disabled={currentPage >= Math.ceil(enrichedVehicleFuelData.length / itemsPerPage)}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md pb-2 -mx-4 px-4 md:-mx-8 md:px-8">
          <TabsList className="flex w-full justify-start gap-2 bg-transparent border-b border-slate-200 dark:border-slate-800 rounded-none h-11 p-0 mb-2 overflow-x-auto custom-scrollbar shadow-none">
            <TabsTrigger 
              value="analise" 
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
            >
              Monitoramento
            </TabsTrigger>
            <TabsTrigger 
              value="prices" 
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
            >
              Análise de Preços
            </TabsTrigger>
            <TabsTrigger 
              value="justificativas" 
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
            >
              Justificativas
            </TabsTrigger>
            <TabsTrigger 
              value="abast-perf" 
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
            >
              Performance de Abastecimento
            </TabsTrigger>
            <TabsTrigger 
              value="config" 
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
            >
              Configurações
            </TabsTrigger>
            <TabsTrigger 
              value="abast-telemetria" 
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
            >
              Abastecimento x Telemetria
            </TabsTrigger>
            {isGestaoOrMaster && (
              <TabsTrigger 
                value="maq-report" 
                className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent shadow-none font-bold text-xs uppercase tracking-widest transition-all h-full"
              >
                Relatório Máquinas
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="analise" className="space-y-6 mt-0">
          <Tabs defaultValue="parametros" className="w-full space-y-6">
            <div className="bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-xl inline-flex gap-1 border border-slate-200/40 dark:border-slate-800/40">
              <TabsList className="bg-transparent h-9 p-0 flex gap-1 border-none shadow-none">
                <TabsTrigger 
                  value="parametros"
                  className="px-4 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 rounded-lg bg-transparent font-bold text-xs uppercase tracking-wider transition-all h-full shadow-none"
                >
                  Análise por Parâmetros
                </TabsTrigger>
                <TabsTrigger 
                  value="ml"
                  className="px-4 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 rounded-lg bg-transparent font-bold text-xs uppercase tracking-wider transition-all h-full shadow-none"
                >
                  Analytics & Machine Learning
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="parametros" className="space-y-6 mt-0">
              {renderMonitoramentoContent()}
            </TabsContent>

            <TabsContent value="ml" className="space-y-6 mt-0">
              <div className="space-y-6">
                <FuelFilterBar
                  fuel={fuel} assets={assets} autonomia={autonomia}
                  selectedFuelTypes={selectedFuelTypes} selectedVehicleModels={selectedVehicleModels} searchPlaca={searchPlaca}
                  selectedDirectorias={selectedDirectorias} selectedGerencias={selectedGerencias} selectedTipos={selectedTipos}
                  selectedMonthsYears={selectedMonthsYears}
                  selectedRegioes={selectedRegioes}
                  selectedCidades={selectedCidades}
                  selectedPropriedades={selectedPropriedades}
                  onPropriedadesChange={setSelectedPropriedades}
                  selectedTitularidades={selectedTitularidades}
                  onTitularidadesChange={setSelectedTitularidades}
                  dateFrom={dateFrom} dateTo={dateTo}
                  onFuelTypesChange={setSelectedFuelTypes} onVehicleModelsChange={setSelectedVehicleModels} onSearchPlacaChange={setSearchPlaca}
                  onDirectoriasChange={setSelectedDirectorias} onGerenciasChange={setSelectedGerencias} onTiposChange={setSelectedTipos}
                  onMonthsYearsChange={setSelectedMonthsYears}
                  onRegioesChange={setSelectedRegioes}
                  onCidadesChange={setSelectedCidades}
                  setDateFrom={setDateFrom} setDateTo={setDateTo}
                  selectedAlerta={selectedAlerta} onAlertaChange={setSelectedAlerta}
                  selectedAlertaAutonomia={selectedAlertaAutonomia} onAlertaAutonomiaChange={setSelectedAlertaAutonomia}
                  selectedAlertaKmHora={selectedAlertaKmHora} onAlertaKmHoraChange={setSelectedAlertaKmHora}
                  selectedAlertaLitros={selectedAlertaLitros} onAlertaLitrosChange={setSelectedAlertaLitros}
                  selectedAlertaItem={selectedAlertaItem} onAlertaItemChange={setSelectedAlertaItem}
                  selectedParecerNexus={selectedParecerNexus} onParecerNexusChange={setSelectedParecerNexus}
                  selectedTipoControleAutonomia={selectedTipoControleAutonomia} onTipoControleAutonomiaChange={setSelectedTipoControleAutonomia}
                  selectedAlertaValorLitro={selectedAlertaValorLitro} onAlertaValorLitroChange={setSelectedAlertaValorLitro}
                  selectedAlertaVale={selectedAlertaVale} onAlertaValeChange={setSelectedAlertaVale}
                  onClearFilters={handleClearFilters} dataUpdatedAt={dataUpdatedAt}
                  fuelTypeOptions={fuelTypeOptions}
                  modelOptions={modelOptions}
                  diretoriaOptions={diretoriaOptions}
                  gerenciaOptions={gerenciaOptions}
                  tipoOptions={tipoOptions}
                  monthYearOptions={monthYearOptions}
                  autoControleOptions={autoControleOptions}
                  regiaoOptions={regiaoOptions}
                  cidadeOptions={cidadeOptions}
                  propriedadeOptions={propriedadeOptions}
                  titularidadeOptions={titularidadeOptions}
                />
                {renderAdvancedMLMonitoramentoContent()}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="abast-perf" className="space-y-6 mt-0">
          <SupplyPerformanceDashboard fuel={filteredFuel} assets={assets} />
        </TabsContent>

        <TabsContent value="prices" className="space-y-6 mt-0">
          <div id="analise-precos" className="space-y-12">
          {/* Dashboard Resumo de Preços */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Benchmarks de Mercado vs Compesa</h3>
              <Button size="sm" variant="outline" className="h-8 gap-2 font-bold" onClick={generateShareSummary}>
                <Share2 className="h-4 w-4" /> Copiar Resumo para Compartilhar
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {priceComparison.map((item, idx) => (
                <Card key={idx} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:shadow-md transition-all">
                  <CardHeader className="p-4 pb-0">
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-slate-400">
                      <Fuel className="h-3 w-3" /> {item.tipo}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex flex-col">
                      <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                        R$ {item.compesa.toFixed(3)}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Média Nexus</span>
                        <Badge variant={item.diff <= 0 ? "success" : "destructive"} className="text-[9px] h-4 font-black uppercase tracking-widest">
                          {item.diff > 0 ? "+" : ""}{item.diff.toFixed(1)}% vs Mkt
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-indigo-600" /> Melhores Preços por Localidade
                      </CardTitle>
                      <CardDescription className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">
                        Monitor de Preços da Rede Credenciada - Todas as Regiões
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest border-2 border-emerald-500/20 text-emerald-600 hover:bg-emerald-50">
                        <Download className="h-3 w-3 mr-1.5" /> Exportar Planilha
                      </Button>
                    </div>
                  </div>

                  {/* Filtros Internos da Aba de Preços */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/20 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <SearchableMultiSelect 
                      label="Região"
                      options={regiaoOptions}
                      selected={priceSelectedRegions}
                      onChange={setPriceSelectedRegions}
                      placeholder="Todas as Regiões"
                    />
                    <SearchableMultiSelect 
                      label="Cidade"
                      options={priceCityOptions}
                      selected={priceSelectedCities}
                      onChange={setPriceSelectedCities}
                      placeholder="Todas as Cidades"
                    />
                    <SearchableMultiSelect 
                      label="Combustível"
                      options={priceFuelOptions}
                      selected={priceSelectedFuel}
                      onChange={setPriceSelectedFuel}
                      placeholder="Todos os Tipos"
                    />
                    <div className="flex items-end pb-0.5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[9px] font-black uppercase underline hover:bg-transparent"
                        onClick={() => {
                          setPriceSelectedRegions([]);
                          setPriceSelectedCities([]);
                          setPriceSelectedFuel([]);
                          setPriceCurrentPage(1);
                        }}
                      >
                        Limpar Filtros Locais
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">Região</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">Cidade</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">Combustível</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">Posto Credenciado</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-right">Melhor Preço</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-center">Consultado</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceAnalysisPaginated.length > 0 ? (
                      priceAnalysisPaginated.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800 transition-colors group">
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="bg-indigo-50/50 text-indigo-600 border-indigo-100 text-[10px] font-black uppercase tracking-widest py-0">
                              {item.regiao}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{item.cidade}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${item.tipo.includes('DIESEL') ? 'bg-amber-500' : item.tipo.includes('GASOLINA') ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{item.tipo}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex flex-col max-w-[200px]">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-tight truncate">{item.posto}</span>
                              <span className="text-[8px] font-medium text-slate-400 uppercase truncate leading-tight">
                                {item.endereco || 'N/A'} - {item.bairro || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-sm font-black text-slate-800 dark:text-white tracking-tighter">R$ {item.preco.toFixed(3)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all opacity-0 group-hover:opacity-100"
                              onClick={() => handleShareWhatsApp(item)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Info className="h-8 w-8 text-slate-300" />
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhum registro de preço de mercado encontrado na base.</p>
                            <p className="text-[10px] text-slate-400">O monitor de mercado analisa todos os abastecimentos disponíveis para encontrar o menor preço por cidade.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
                
                {/* Paginação */}
                <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Página {priceCurrentPage} de {Math.ceil(priceAnalysis.length / rowsPerPage)} ({priceAnalysis.length} registros)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-[10px] font-bold uppercase"
                      disabled={priceCurrentPage === 1}
                      onClick={() => setPriceCurrentPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-[10px] font-bold uppercase"
                      disabled={priceCurrentPage >= Math.ceil(priceAnalysis.length / rowsPerPage)}
                      onClick={() => setPriceCurrentPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

        <TabsContent value="justificativas" className="space-y-6 mt-0">
          <div id="justificativas" className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Mail className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold uppercase tracking-tight">Retorno de Justificativas</h2>
            </div>
            <FuelJustificationsTab />
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-6 mt-0">
          <div id="config-alertas" className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Hash className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold uppercase tracking-tight">Configuração de Alertas de Auditoria</h2>
            </div>
            <FuelAlertConfigTab />
          </div>
        </TabsContent>

        <TabsContent value="abast-telemetria" className="space-y-6 mt-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <AbastTelemetriaTab fuel={fuel} assets={assets} />
          </div>
        </TabsContent>

        {isGestaoOrMaster && (
          <TabsContent value="maq-report" className="space-y-6 mt-0">
            <MachineSupplyReport isEmbedded={true} />
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase text-slate-800 dark:text-slate-100 italic">Auditoria e Conciliação de Comprovantes (MAQ/GER)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Visão complementar de controle físico de comprovantes anexados para a frota de maquinários</p>
              </div>
              <MachineSupplyIndicators fuel={fuel} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={semAbastecerEmailDialogOpen} onOpenChange={setSemAbastecerEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Selecionar Gerência</DialogTitle>
            <DialogDescription>Selecione a gerência para enviar o e-mail.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSemAbastecerEmailDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => setSemAbastecerEmailDialogOpen(false)}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDesvioExplaining} onOpenChange={() => setSelectedDesvioExplaining(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Info className="h-5 w-5" /> 
              Lógica do Desvio: {selectedDesvioExplaining?.tipo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/30 rounded-lg border border-primary/10">
              <h4 className="text-xs font-black uppercase text-primary mb-2">Mensagem do Sistema</h4>
              <p className="text-sm font-medium leading-relaxed">{selectedDesvioExplaining?.descricao}</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-foreground">Explicação da Lógica</h4>
              <div className="text-[13px] space-y-2 text-muted-foreground leading-relaxed">
                {selectedDesvioExplaining?.tipo === 'Alerta Vale' && (
                  <p>Este alerta é gerado quando o combustível abastecido é <strong>idêntico</strong> ao do abastecimento anterior E o valor da coluna <strong>AN (KM RODADOS OU HORAS TRABALHADAS)</strong> está entre 0 e 10, ou é negativo. Isso sugere que o cartão foi passado repetidamente sem o deslocamento real do veículo.</p>
                )}
                {selectedDesvioExplaining?.tipo === 'Autonomia' && (
                  <p>Este alerta é gerado quando a autonomia calculada no abastecimento (KM Percorridos / Litros) desvia significativamente do padrão técnico cadastrado para o veículo nas colunas <strong>AC (Principal)</strong> ou <strong>AH (Secundário)</strong> da base de ativos.</p>
                )}
                {selectedDesvioExplaining?.tipo === 'Litros/m³' && (
                  <p>Ocorre quando a quantidade abastecida é superior à capacidade total do tanque cadastrada nas colunas <strong>AE (Tanque Principal)</strong> ou <strong>AI (Tanque Secundário)</strong>. Isso pode indicar erro de digitação ou abastecimento em recipientes externos.</p>
                )}
                {selectedDesvioExplaining?.tipo === 'KM/Hora' && (
                  <p>Detecta discrepâncias onde o acréscimo de KM ou Horas entre abastecimentos está fora da média histórica deste veículo (limite de 30% de tolerância), indicando possíveis erros no registro do odômetro ou horímetro.</p>
                )}
                {selectedDesvioExplaining?.tipo === 'Valor/Litro' && (
                  <p>Identifica quando o preço por litro pago no posto diverge consideravelmente do preço médio regional apurado pela Compesa. Pode indicar seleção incorreta do combustível ou erro no posto.</p>
                )}
                {selectedDesvioExplaining?.tipo === 'Item Abastecido' && (
                  <p>Alerta gerado quando a descrição do item na transação é diferente de "Abastecimento" ou combustíveis padrão, sugerindo uso do cartão para outros fins não autorizados.</p>
                )}
                {selectedDesvioExplaining?.tipo === 'Dias s/ Abastecer' && (
                  <p>Indica que o veículo está sem registros de abastecimento há mais tempo que o limite de inatividade configurado (padrão 5 dias), o que pode sinalizar veículo parado por manutenção ou falta de uso.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-2 border rounded bg-slate-50 text-[10px]">
                <span className="block font-bold text-muted-foreground uppercase mb-1">Placa Analisada</span>
                <span className="font-bold text-slate-900">{selectedDesvioExplaining?.placa}</span>
              </div>
              <div className="p-2 border rounded bg-slate-50 text-[10px]">
                <span className="block font-bold text-muted-foreground uppercase mb-1">Data Transação</span>
                <span className="font-bold text-slate-900">{selectedDesvioExplaining?.data}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedDesvioExplaining(null)} className="w-full font-bold">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
