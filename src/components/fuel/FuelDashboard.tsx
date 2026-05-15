import { useManagersData } from "@/hooks/useManagersData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { FuelFilterBar } from "./FuelFilterBar";
import { Fuel, DollarSign, Droplets, Download, Activity, ChevronDown, ChevronUp, Info, FileText, Mail, Send, AlertTriangle, Hash, TrendingUp, Layers, Calendar, Share2, MapPin, Tag } from "lucide-react";
import { useAlertaValeData } from "@/hooks/useAlertaValeData";
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
} from "recharts";
import { FuelJustificationsTab } from "./FuelJustificationsTab";
import { FuelAlertConfigTab } from "./FuelAlertConfigTab";
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

interface FuelDashboardProps {
  fuel: FuelData[];
  assets: Asset[];
  autonomia: AutonomiaData[];
  autonomiaPadrao: AutonomiaPadraoData[];
  maintenanceCost: MaintenanceCostData[];
  maintenance: MaintenanceData[];
  desviosOnly?: boolean;
  initialTab?: string;
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

export const FuelDashboard = ({ fuel, assets, autonomia, autonomiaPadrao, maintenanceCost, maintenance, desviosOnly = false, initialTab }: FuelDashboardProps) => {
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
    const relevantTxs = filteredFuel.filter(f => placas.includes(String(f.PLACA || f.Placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase()));
    // Filtrar desvios para estas placas
    const relevantDesvios = fuelAnalysis.desvios.filter(d => placas.includes(d.placa));

    const abastData = relevantTxs.map(f => {
      const raw = (f as any).__raw || [];
      return {
        "CODIGO TRANSACAO": raw[0] || f["N\u00BA TRANSACAO"] || f._txId || "N/A",
        "DATA TRANSACAO": f["DATA TRANSACAO"] || raw[4] || "N/A",
        "PLACA": f.PLACA || f.Placa || raw[5] || "N/A",
        "TIPO FROTA": raw[6] || f["TIPO FROTA"] || "N/A",
        "MODELO VEICULO": f["MODELO VEICULO"] || raw[10] || "N/A",
        "NOME MOTORISTA": f["NOME MOTORISTA"] || raw[11] || "N/A",
        "SERVICO": f["SERVICO"] || f["SERVI\u00C7O"] || raw[12] || "N/A",
        "TIPO COMBUSTIVEL": f["TIPO COMBUSTIVEL"] || raw[13] || "N/A",
        "LITROS": parseBrazilianNumber(f.LITROS || raw[14]),
        "VL/LITRO": parseBrazilianNumber(f["VALOR UNITARIO"] || f["VL/UNITARIO"] || raw[15]),
        "HODOMETRO OU HORIMETRO": f["ODOMETRO/HORIMETRO"] || raw[20] || "N/A",
        "KM RODADOS OU HORAS TRABALHADAS": parseBrazilianNumber(f["KM RODADOS OU HORAS TRABALHADAS"] || raw[39]),
        "VALOR EMISSAO": parseBrazilianNumber(f["VALOR EMISSAO"] || raw[17]),
        "NOME ESTABELECIMENTO": f["NOME POSTO"] || raw[16] || "N/A",
        "ENDERECO": f["ENDERECO"] || f["ENDERE\u00C7O"] || raw[18] || "N/A",
        "BAIRRO": f["BAIRRO"] || raw[19] || "N/A",
        "CIDADE": f["CIDADE"] || raw[21] || "N/A",
        "INFORMACAO ADICIONAL 1": raw[27] || f["INFORMA\u00C7\u00C3O ADICIONAL 1"] || "N/A",
        "INFORMACAO ADICIONAL 2": raw[28] || f["INFORMA\u00C7\u00C3O ADICIONAL 2"] || "N/A",
        "INFORMACAO ADICIONAL 3": raw[29] || f["INFORMA\u00C7\u00C3O ADICIONAL 3"] || "N/A"
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
Nexus BI Frota`;

    const mailto = `mailto:${emails.join(";")}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success("E-mail gerado com sucesso para " + gerencia);
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
    return fuel.map(f => {
      const raw = (f as any).__raw || [];
      const txId = String(f._txId || raw[0] || f["Nº TRANSACAO"] || "N/A").replace(/\./g, '').split(',')[0].trim();
      
      const formattedDate = f._date ? getFormattedDate(f._date) : null;
      const monthYearData = formattedDate ? getMonthYearFromFormattedDate(formattedDate) : null;
      
      const _monthYearBase = normalizeMonthYear(String(f._monthYear || raw[41] || monthYearData?.mesAno || "N/A"));
      const _placa = f._placa || "";
      
      return {
        ...f,
        _placa,
        _txId: txId,
        _formattedDate: formattedDate,
        _timestamp: formattedDate ? new Date(formattedDate).getTime() : 0,
        _monthYearBase,
        _monthYear: monthYearData?.mesAno || null,
        _fuelType: standardizeFuelType(String(f._fuelType || "N/A")),
        _litros: f._litros || 0,
        _vlLitro: f._vlLitro || 0,
        _valR: f._total || (f._vlLitro * f._litros) || 0,
        _itemDesc: String(f["SERVICO"] || f["SERVI\u00C7O"] || f["ITEM"] || raw[12] || "Abastecimento").trim(),
        _endereco: String(f["ENDERECO"] || f["ENDERE\u00C7O"] || raw[23] || raw[18] || "N/A").trim().toUpperCase(),
        _bairro: String(f["BAIRRO"] || raw[24] || raw[19] || "N/A").trim().toUpperCase(),
        _posto: String(f["NOME POSTO"] || f["ESTABELECIMENTO"] || raw[21] || raw[16] || "N/A").trim().toUpperCase(),
        _cidade: String(f["CIDADE"] || f["MUNICÍPIO"] || f["MUNICIPIO"] || raw[20] || raw[22] || "N/A").trim().toUpperCase(),
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
        !debouncedSearchPlaca || f._placa.toLowerCase().includes(debouncedSearchPlaca.toLowerCase());

      // Correlacionar com Asset pela Placa
      const asset = f._placa ? assetsByPlaca.get(f._placa.replace(/[^A-Z0-9]/gi, "")) : null;
      
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

      // Filtro por M\u00EAs/Ano (Baseado na coluna AP)
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

      return matchesFuelType && matchesModel && matchesPlaca && matchesDiretoria && matchesGerencia && matchesTipo && matchesDate && matchesMonthYear && matchesTipoControleAutonomia && matchesRegiao && matchesCidade;
    }).sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0)); // Ordem decrescente de data por padrão
  }, [preProcessedFuel, assetsByPlaca, debouncedSearchPlaca, selectedFuelTypes, selectedVehicleModels, selectedDirectorias, selectedGerencias, selectedTipos, dateFrom, dateTo, selectedMonthsYears, selectedTipoControleAutonomia, selectedRegioes, selectedCidades]);

  // Metrics
  const totalLitros = useMemo(() => filteredFuel.reduce((sum, f) => sum + (Number(f._litros) || 0), 0), [filteredFuel]);
  const totalValor = useMemo(() => filteredFuel.reduce((sum, f) => sum + (Number(f._valR) || 0), 0), [filteredFuel]);
  const totalAbastecimentos = filteredFuel.length;
  const avgPrecoLitro = totalLitros > 0 ? totalValor / totalLitros : 0;

  const previousMonthMetrics = useMemo(() => {
    return { prevLitros: 0, prevValor: 0, prevAbast: 0, prevPrecoLitro: 0 };
  }, [fuel]);

  const [internalLoading, setInternalLoading] = useState(false);
  
  useEffect(() => {
    if (fuel.length > 0) {
      setInternalLoading(true);
      const timer = setTimeout(() => setInternalLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [fuel.length, selectedFuelTypes, selectedVehicleModels, debouncedSearchPlaca, selectedDirectorias, selectedGerencias, selectedTipos, selectedMonthsYears, dateFrom, dateTo]);

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
      if (f._vlLitro <= 0) return;

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
      Placa: f.PLACA || f.Placa || "N/A",
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

      const placaRaw = f.PLACA || f.Placa || "";
      const placa = String(placaRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      
      // Momentaneamente excluir placas que começam com MAQ conforme solicitação do usuário
      if (placa.startsWith("MAQ")) continue;

      const valR = f._valR;
      
      if (valR > 0) {
        const curr = assetAverages.get(placa) || { sum: 0, count: 0 };
        curr.sum += valR;
        curr.count++;
        assetAverages.set(placa, curr);
      }

      if (!vehicleMap.has(placa)) {
        const asset = assetsByPlaca.get(placa);
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
          data: f["DATA TRANSACAO"] 
        };
        desvios.push(d);
        v.alerts.add('Item Abastecido');
        stats.item++;
      }

      // Alerta Vale: Trata como irregular se KM Rodados for entre 0 e 10 ou negativo, 
      // E o combustível for o mesmo do abastecimento anterior
      const kmHoras = f._kmHoras;
      if ((kmHoras <= 10) && v.lastFuelType && currentFuelType === v.lastFuelType) {
        const d = { 
          placa, 
          tipo: 'Alerta Vale', 
          descricao: `Cód. Transação: ${f._txId} | KM Irregular: ${kmHoras} | Combustível Repetido: ${currentFuelType}`, 
          data: f["DATA TRANSACAO"] 
        };
        desvios.push(d);
        v.alerts.add('Alerta Vale');
        stats.vale++;
      }

      // Atualiza o último combustível para a próxima iteração
      v.lastFuelType = currentFuelType;
    }

    // Pass 2: calculate specific alerts
    for (let i = 0; i < filteredFuel.length; i++) {
      const f = filteredFuel[i] as any;
      const fuelType = f._fuelType;
      if (fuelType === "ARLA 32") continue;
      
      const placaRaw = f.PLACA || f.Placa || "";
      const placa = String(placaRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      
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
              data: f["DATA TRANSACAO"] 
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
            data: f["DATA TRANSACAO"] 
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
            data: f["DATA TRANSACAO"] 
          };
          desvios.push(d);
          v.alerts.add('Autonomia');
          stats.autonomy++;
        }
      }

      if (avgPrecoLitro > 0 && vlLitro > 0 && Math.abs(vlLitro - avgPrecoLitro) / avgPrecoLitro * 100 > fuelAlertConfig.valorLitroDeviationPercent) {
        const perc = (Math.abs(vlLitro - avgPrecoLitro) / avgPrecoLitro * 100).toFixed(1);
        const d = { 
          placa, 
          tipo: 'Valor/Litro', 
          descricao: `Cód. Transação: ${f._txId} | Preço: R$ ${vlLitro.toFixed(2)} vs Med: R$ ${avgPrecoLitro.toFixed(2)} (${perc}%)`, 
          data: f["DATA TRANSACAO"] 
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
          data: v.lastTx?.["DATA TRANSACAO"] 
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
      .filter(v => v.totalAlerts > 0)
      .sort((a, b) => b.totalAlerts - a.totalAlerts)
      .slice(0, 10);

    const condutoresRanking = Object.entries(
      filteredFuel.reduce((acc: Record<string, number>, f: any) => {
        const condutor = f["NOME MOTORISTA"] || ((f as any).__raw && (f as any).__raw[11]) || "NÃO IDENTIFICADO";
        const placaRaw = f.PLACA || f.Placa || "";
        const placa = String(placaRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase();
        
        if (placa.startsWith("MAQ")) return acc;
        
        const v = vehicleMap.get(placa);
        if (v && v.alerts.size > 0) {
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
    const data = enrichedVehicleFuelData.map(v => ({
      Placa: v.placa,
      Modelo: v.modelo,
      Unidade: v.unidade,
      "Abastecimentos": v.count,
      "Dias s/ Abast.": v.dias,
      "Aut. Padrão": (v.autPadrao || 0).toFixed(2),
      "Aut. Real": (v.autReal || 0).toFixed(2),
      "Desvio %": (v.desvAut || 0).toFixed(1) + "%",
      "Alertas": Array.from(v.alerts).join(", ")
    }));
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
    const map = new Map<string, any>();
    fuelAnalysis.desvios.forEach(d => {
      const asset = assetsByPlaca.get(d.placa);
      const unit = asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A";
      if (!map.has(unit)) {
        map.set(unit, { unit, total: 0, desvios: [] });
      }
      map.get(unit).total++;
      map.get(unit).desvios.push(d);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [fuelAnalysis.desvios, assetsByPlaca]);

  const [activeTab, setActiveTab] = useState(initialTab || (desviosOnly ? "analise" : "analise"));

  // Sync internal state if needed, but Tabs handles its own.

  return (
    <div className="space-y-6">
      {internalLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center p-8 bg-card border rounded-3xl shadow-2xl space-y-4 animate-in fade-in zoom-in duration-300">
            <Activity className="h-12 w-12 text-primary animate-pulse" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800">Processando Análise de Desvios...</h3>
              <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos dependendo do volume de dados.</p>
            </div>
          </div>
        </div>
      )}
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
          </TabsList>
        </div>

        <TabsContent value="analise" className="space-y-6 mt-0">
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
                  const blues = ['#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43'];
                  // Better blue scale as requested:
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
