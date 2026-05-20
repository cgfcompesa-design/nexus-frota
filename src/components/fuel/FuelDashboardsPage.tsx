
import React, { useState, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { useAssets, useFuelData, useAutonomiaData, useAutonomiaPadraoData } from "@/hooks/useFleetData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { FuelDashboardsFilterBar } from "@/components/dashboards/FuelDashboardsFilterBar";
import { Fuel, DollarSign, Droplets, Download, Activity, Gauge, FileText, TrendingUp, Users, Calendar, Tag, Milestone, AlertTriangle, Share2, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";
import { toast } from "sonner";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { FuelData, Asset } from "@/types";
import { LoadingState } from "@/components/dashboard/LoadingState";

const THEME_COLORS = [
  "#3b82f6", // blue-500
  "#336aea", // slightly darker blue
  "#2563eb", // blue-600
  "#1d4ed8", // blue-700
  "#1e40af", // blue-800
  "#1e3a8a", // blue-900
];

const SHADES_OF_BLUE = [
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#4f46e5", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef"
];

const MONTH_ORDER: Record<string, number> = {
  'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
  'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
};

const parseMonthYear = (my: string) => {
  if (!my || typeof my !== 'string' || !my.includes('/')) return new Date(0);
  const parts = my.trim().split('/');
  if (parts.length < 2) return new Date(0);
  
  const part0 = parts[0].toLowerCase().replace('.', '').trim();
  const part1 = parts[1].trim();
  
  let month = 0;
  let year = 2000;

  // Handle formats like "05/2026" or "05/26"
  if (/^\d+$/.test(part0)) {
    month = (parseInt(part0) - 1) || 0;
    year = part1.length === 4 ? parseInt(part1) : 2000 + parseInt(part1);
  } else {
    // Handle formats like "jan/26" or "maio/2026"
    month = MONTH_ORDER[part0.substring(0, 3)] ?? 0;
    year = part1.length === 4 ? parseInt(part1) : 2000 + parseInt(part1);
  }

  return new Date(year, month);
};

const parseNum = (val: any) => {
  if (val === null || val === undefined || String(val).trim() === "") return 0;
  // Standardize Brazilian format: 1.234,56 -> 1234.56 or just "1,23" -> "1.23"
  let cleaned = String(val).replace(/R\$/g, '').trim();
  
  // If there's a comma, it's likely decimal-comma format
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const res = parseFloat(cleaned);
  return isNaN(res) ? 0 : res;
};

const getValByIndex = (obj: any, index: number) => {
  if (!obj) return undefined;
  const raw = (obj as any).__raw;
  if (Array.isArray(raw)) return raw[index];
  const values = Object.values(obj);
  return values[index];
};

const getFormattedDate = (dateString: any): Date | null => {
  if (!dateString) return null;
  try {
    if (typeof dateString === 'number') {
      return new Date((dateString - 25569) * 86400 * 1000);
    }
    if (typeof dateString === 'string') {
      // Check if it's a numeric string (Excel date)
      if (/^\d+(\.\d+)?$/.test(dateString)) {
        return new Date((parseFloat(dateString) - 25569) * 86400 * 1000);
      }
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const d = new Date(`${parts[2].split(' ')[0]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
};

const FuelDashboardsPage = ({ setView }: { setView?: (view: string) => void }) => {
  const { data: fuel = [], isLoading: loadingFuel, isError: isErrorFuel, refetch: refetchFuel } = useFuelData();
  const { data: assets = [], isLoading: loadingAssets, isError: isErrorAssets, refetch: refetchAssets } = useAssets();
  
  // Filter States
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [searchPlaca, setSearchPlaca] = useState<string>("");
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [selectedVehicleModels, setSelectedVehicleModels] = useState<string[]>([]);
  const [selectedDirectorias, setSelectedDirectorias] = useState<string[]>([]);
  const [selectedGerencias, setSelectedGerencias] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [selectedTipoControleAutonomia, setSelectedTipoControleAutonomia] = useState<string[]>([]);
  const [selectedMonthsYears, setSelectedMonthsYears] = useState<string[]>([]);
  const [selectedPropriedades, setSelectedPropriedades] = useState<string[]>([]);
  const [selectedCidades, setSelectedCidades] = useState<string[]>([]);
  const [selectedTitularidades, setSelectedTitularidades] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("dashboards");
 
  const isLoading = loadingFuel || loadingAssets;
  const hasError = isErrorFuel || isErrorAssets;

  const refetchAll = () => {
    refetchFuel();
    refetchAssets();
  };

  const assetsByPlaca = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach((a) => { 
      // Normalizar placa para garantir matching (remover hífens, espaços, etc)
      const p = (a.PLACA || a.Placa || "").toString().replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (p) map.set(p, a); 
    });
    return map;
  }, [assets]);

  const filteredFuel = useMemo(() => {
    return fuel.filter((f) => {
      // Basic data extraction with fallbacks
      const pRaw = f._placa || f.PLACA || (f.__raw && f.__raw[5]) || "";
      if (!pRaw) return false;
      const placa = String(pRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      
      const asset = assetsByPlaca.get(placa);
      
      // Filter by Operational Status
      const statusOp = (asset?.STATUS_OPERACIONAL || asset?.["STATUS OPERACIONAL"] || "").toUpperCase().trim();
      if (statusOp && statusOp !== 'OPERACIONAL' && statusOp !== 'ATIVO') return false;

      // Metadata extraction
      const fuelType = f._fuelType || "N/A";
      const vlLitro = f._vlLitro || 0;

      // Filter extreme price outliers (batch amounts incorrectly reported as unit price)
      if (vlLitro > 0) {
        const ftUpper = String(fuelType).toUpperCase();
        if (ftUpper.includes("ARLA") && (vlLitro > 15 || vlLitro < 2)) return false;
        if (!ftUpper.includes("ARLA") && (vlLitro > 15 || vlLitro < 3)) return false;
      }
      
      const model = asset?.MODELO || asset?.Modelo || f._vehicleModel || "N/A";
      const diretoria = asset?.DIRETORIA || asset?.Diretoria || "N/A";
      const gerencia = asset?.GERENCIA || asset?.["GER\u00CANCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || f._unit || "N/A";
      const tipo = asset?.TIPO || asset?.Tipo || asset?.["TIPO VEICULO"] || f._assetType || "N/A";
      const mesAno = String(f._monthYear || "N/A").trim();
      const controleAuto = asset?.["CONTROLE DE AUTONOMIA"] || asset?.["CONTROLE AUTONOMIA"] || (f as any).COL_43 || "";
      const propriedade = asset?.PROPRIEDADE || asset?.Propriedade || asset?.["PROPRIEDADE"] || (asset?.__raw && asset?.__raw[10]) || "N/A";
      const cidade = f._cidade || f.COL_25 || f.CIDADE || f.MUNICÍPIO || f.MUNICIPIO || "N/A";
      const titularidade = asset?.TITULARIDADE || asset?.["TITULARIDADE"] || (asset?.__raw && asset?.__raw[27]) || "N/A";

      // Transaction Date Filter
      if (dateFrom || dateTo) {
        const dStr = f._date;
        const d = getFormattedDate(dStr);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      
      // Applying active filters
      if (searchPlaca && !placa.includes(searchPlaca.toUpperCase().trim())) return false;
      if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(String(gerencia).trim())) return false;
      if (selectedFuelTypes.length > 0 && !selectedFuelTypes.map(f => String(f).trim()).includes(String(fuelType).trim())) return false;
      if (selectedVehicleModels.length > 0 && !selectedVehicleModels.map(m => String(m).trim()).includes(String(model).trim())) return false;
      if (selectedDirectorias.length > 0 && !selectedDirectorias.map(d => String(d).trim()).includes(String(diretoria).trim())) return false;
      if (selectedTipos.length > 0 && !selectedTipos.map(t => String(t).trim()).includes(String(tipo).trim())) return false;
      if (selectedTipoControleAutonomia.length > 0 && !selectedTipoControleAutonomia.map(c => String(c).trim()).includes(String(controleAuto).trim())) return false;
      if (selectedMonthsYears.length > 0 && !selectedMonthsYears.map(m => String(m).trim()).includes(mesAno.trim())) return false;
      if (selectedPropriedades.length > 0 && !selectedPropriedades.map(p => String(p).trim().toUpperCase()).includes(String(propriedade).trim().toUpperCase())) return false;
      if (selectedCidades.length > 0 && !selectedCidades.map(c => String(c).trim().toUpperCase()).includes(String(cidade).trim().toUpperCase())) return false;
      if (selectedTitularidades.length > 0 && !selectedTitularidades.map(t => String(t).trim().toUpperCase()).includes(String(titularidade).trim().toUpperCase())) return false;

      return true;
    });
  }, [fuel, assetsByPlaca, dateFrom, dateTo, searchPlaca, selectedGerencias, selectedFuelTypes, selectedVehicleModels, selectedDirectorias, selectedTipos, selectedTipoControleAutonomia, selectedMonthsYears, selectedPropriedades, selectedCidades, selectedTitularidades]);

  const formatMonthLabel = (m: string) => {
    if (!m || !m.includes('/')) return m;
    const [month, year] = m.split('/');
    const months: Record<string, string> = {
      '01': 'jan', '02': 'fev', '03': 'mar', '04': 'abr',
      '05': 'mai', '06': 'jun', '07': 'jul', '08': 'ago',
      '09': 'set', '10': 'out', '11': 'nov', '12': 'dez'
    };
    return `${months[month] || month}/${year.slice(-2)}`;
  };

  // Filter Options
  const fuelTypeOptions = useMemo(() => Array.from(new Set(fuel.map(f => f._fuelType).filter(Boolean))).sort() as string[], [fuel]);
  const monthYearOptions = useMemo(() => {
    const set = new Set<string>();
    fuel.forEach(f => {
      const mesAno = f._monthYear || "";
      if (mesAno) {
        set.add(String(mesAno).trim());
      } else if (f._date) {
        const d = getFormattedDate(f._date);
        if (d) {
          const m = (d.getMonth() + 1).toString().padStart(2, '0');
          const y = d.getFullYear().toString();
          set.add(`${m}/${y}`);
        }
      }
    });
    return Array.from(set).sort((a, b) => parseMonthYear(a).getTime() - parseMonthYear(b).getTime());
  }, [fuel]);
  const autoControleOptions = useMemo(() => Array.from(new Set(fuel.map(f => f["TIPO CONTROLE AUTONOMIA"] || (f as any).COL_43).filter(Boolean))).sort() as string[], [fuel]);
  
  const modelOptions = useMemo(() => Array.from(new Set(assets.map(a => a.MODELO || a.Modelo).filter(Boolean))).sort() as string[], [assets]);
  const diretoriaOptions = useMemo(() => Array.from(new Set(assets.map(a => a.DIRETORIA || a.Diretoria).filter(Boolean))).sort() as string[], [assets]);
  const gerenciaOptions = useMemo(() => Array.from(new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"] || a.Gerencia).filter(Boolean))).sort() as string[], [assets]);
  const tipoOptions = useMemo(() => Array.from(new Set(assets.map(a => a.TIPO || a.Tipo).filter(Boolean))).sort() as string[], [assets]);
  
  const propriedadeOptions = useMemo(() => Array.from(new Set(assets.map(a => a.PROPRIEDADE || a.Propriedade || a["PROPRIEDADE"] || (a.__raw && a.__raw[10])).filter(Boolean))).sort() as string[], [assets]);
  const cidadeOptions = useMemo(() => {
    return Array.from(new Set(fuel.map(f => {
      const c = f._cidade || f.COL_25 || f.CIDADE || f.MUNICÍPIO || f.MUNICIPIO || "";
      return String(c).trim().toUpperCase();
    }).filter(c => c && c !== "N/A"))).sort() as string[];
  }, [fuel]);
  const titularidadeOptions = useMemo(() => {
    const dynamic = assets.map(a => a.TITULARIDADE || a["TITULARIDADE"] || (a.__raw && a.__raw[27])).filter(Boolean).map(t => String(t).toUpperCase().trim());
    return Array.from(new Set(["TITULAR", "RESERVA", "N/A", ...dynamic])).filter(Boolean).sort() as string[];
  }, [assets]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCombustivel = filteredFuel.reduce((sum, f) => sum + (f._litros || 0), 0);
    const custoTotal = filteredFuel.reduce((sum, f) => sum + (f._total || 0), 0);
    
    // Autonomia Real: col AQ index 42
    const autonomiaRecords = filteredFuel.map(f => f._autReal || 0).filter(v => v > 0);
    const avgAutonomiaReal = autonomiaRecords.length > 0 ? autonomiaRecords.reduce((a, b) => a + b, 0) / autonomiaRecords.length : 0;
    
    // KM Médio: col R index 17 or _kmRodados
    const kmRecords = filteredFuel.map(f => f._kmRodados || 0).filter(v => v > 0);
    const avgKmMedio = kmRecords.length > 0 ? kmRecords.reduce((a, b) => a + b, 0) / kmRecords.length : 0;

    // Preço Médio/Litro
    const precoRecords = filteredFuel.map(f => f._vlLitro || 0).filter(v => v > 0);
    const avgPrecoLitro = precoRecords.length > 0 ? precoRecords.reduce((a, b) => a + b, 0) / precoRecords.length : 0;

    return { totalCombustivel, custoTotal, avgAutonomiaReal, avgKmMedio, avgPrecoLitro };
  }, [filteredFuel]);

  // Charts Logic

  // Year-on-Year Comparative Chart State & Computations
  const [compMetricMode, setCompMetricMode] = useState<'liters' | 'cost'>('liters');
  const [compYearA, setCompYearA] = useState<number>(2025);
  const [compYearB, setCompYearB] = useState<number>(2026);

  const getMonthYearFromRow = (f: any) => {
    const col41 = f.COL_41 || f._monthYear || "";
    if (col41) {
      const s = String(col41).trim();
      const parts = s.split("/");
      if (parts.length >= 2) {
        const part0 = parts[0].trim().toLowerCase();
        const part1 = parts[1].trim();
        
        let month = -1;
        let year = -1;
        
        if (/^\d+$/.test(part0)) {
          month = parseInt(part0) - 1;
        } else {
          const mStr = part0.substring(0, 3).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const map: Record<string, number> = {
            jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
            jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
          };
          month = map[mStr] ?? -1;
        }
        
        if (/^\d+$/.test(part1)) {
          year = part1.length === 2 ? 2000 + parseInt(part1) : parseInt(part1);
        }
        
        if (month >= 0 && month <= 11 && year > 1900) {
          return { month, year };
        }
      }
    }
    
    if (f._date) {
      const d = getFormattedDate(f._date);
      if (d) {
        return { month: d.getMonth(), year: d.getFullYear() };
      }
    }
    return null;
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    filteredFuel.forEach(f => {
      const my = getMonthYearFromRow(f);
      if (my && !isNaN(my.year) && my.year > 2000 && my.year < 2100) {
        years.add(my.year);
      }
    });
    const list = Array.from(years).filter(y => !isNaN(y)).sort();
    if (!list.includes(2025)) list.push(2025);
    if (!list.includes(2026)) list.push(2026);
    return list.sort();
  }, [filteredFuel]);

  const comparativeData = useMemo(() => {
    const MONTHS_COMPARE = [
      { name: "Janeiro", shortName: "Jan", index: 0 },
      { name: "Fevereiro", shortName: "Fev", index: 1 },
      { name: "Março", shortName: "Mar", index: 2 },
      { name: "Abril", shortName: "Abr", index: 3 },
      { name: "Maio", shortName: "Mai", index: 4 },
      { name: "Junho", shortName: "Jun", index: 5 },
      { name: "Julho", shortName: "Jul", index: 6 },
      { name: "Agosto", shortName: "Ago", index: 7 },
      { name: "Setembro", shortName: "Set", index: 8 },
      { name: "Outubro", shortName: "Out", index: 9 },
      { name: "Novembro", shortName: "Nov", index: 10 },
      { name: "Dezembro", shortName: "Dez", index: 11 }
    ];

    const result = MONTHS_COMPARE.map(m => ({
      monthIndex: m.index,
      monthLabel: m.shortName,
      monthFullName: m.name,
      
      litersA: 0,
      costA: 0,
      countA: 0,
      uniquePlatesA: new Set<string>(),
      
      litersB: 0,
      costB: 0,
      countB: 0,
      uniquePlatesB: new Set<string>(),
    }));
    
    filteredFuel.forEach(f => {
      const my = getMonthYearFromRow(f);
      if (!my) return;
      
      const litros = typeof f._litros === 'number' ? f._litros : parseNum(f.COL_14 || f.LITROS || f.VOLUME || f.QUANTIDADE || 0);
      const custo = typeof f._total === 'number' ? f._total : parseNum(f.COL_19 || f["VALOR EMISSAO"] || f._total || f.VALOR || f.TOTAL || 0);
      const placa = String(f.PLACA || f._placa || f.COL_5 || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      
      if (my.year === compYearA) {
        const idx = my.month;
        if (idx >= 0 && idx < 12) {
          result[idx].litersA += litros;
          result[idx].costA += custo;
          result[idx].countA += 1;
          if (placa) {
            result[idx].uniquePlatesA.add(placa);
          }
        }
      } else if (my.year === compYearB) {
        const idx = my.month;
        if (idx >= 0 && idx < 12) {
          result[idx].litersB += litros;
          result[idx].costB += custo;
          result[idx].countB += 1;
          if (placa) {
            result[idx].uniquePlatesB.add(placa);
          }
        }
      }
    });
    
    return result.map(m => ({
      monthIndex: m.monthIndex,
      monthLabel: m.monthLabel,
      monthFullName: m.monthFullName,
      litersA: m.litersA,
      costA: m.costA,
      countA: m.countA,
      platesA: m.uniquePlatesA.size,
      litersB: m.litersB,
      costB: m.costB,
      countB: m.countB,
      platesB: m.uniquePlatesB.size,
    }));
  }, [filteredFuel, compYearA, compYearB]);

  // 1. Histórico de Abastecimentos (Liters and Value by Month/Year)
  const [chartViewMode, setChartViewMode] = useState<'liters' | 'cost'>('liters');

  const timelineData = useMemo(() => {
    if (!filteredFuel.length) return [];
    
    const timeline: Record<string, any> = {};
    const allTypes = Array.from(new Set(filteredFuel.map(f => String(f._fuelType || "Outros"))));
    
    filteredFuel.forEach(f => {
      const monthYearRaw = String(f._monthYear || "Desconhecido");
      const monthYear = formatMonthLabel(monthYearRaw);
      const type = String(f._fuelType || "Outros");
      const liters = parseNum(f._litros);
      const cost = parseNum(f._total);

      if (!timeline[monthYear]) {
        timeline[monthYear] = { 
          monthYear, 
          sortDate: parseMonthYear(monthYearRaw),
          totalL: 0,
          totalV: 0
        };
        allTypes.forEach(t => {
          timeline[monthYear][`${t}_L`] = 0;
          timeline[monthYear][`${t}_V`] = 0;
        });
      }
      timeline[monthYear][`${type}_L`] = (timeline[monthYear][`${type}_L`] || 0) + liters;
      timeline[monthYear][`${type}_V`] = (timeline[monthYear][`${type}_V`] || 0) + cost;
      timeline[monthYear].totalL += liters;
      timeline[monthYear].totalV += cost;
    });

    return Object.values(timeline)
      .filter(d => !isNaN(d.sortDate.getTime()))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
  }, [filteredFuel]);

  const fuelTypes = useMemo(() => {
    const set = new Set<string>();
    filteredFuel.forEach(f => set.add(f._fuelType || "Outros"));
    return Array.from(set);
  }, [filteredFuel]);

  // Veículo com maior consumo por tipo
  const topConsumidoresPorTipo = useMemo(() => {
    const groups: Record<string, Record<string, { liters: number, cost: number, count: number, model: string }>> = {};
    
    filteredFuel.forEach(f => {
      const pRaw = f._placa || f.PLACA || "";
      if (!pRaw) return;
      const placa = String(pRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase().trim();
      if (!placa) return;
      
      const asset = assetsByPlaca.get(placa);
      const tipo = (asset?.TIPO || asset?.Tipo || asset?.["TIPO VEICULO"] || f._assetType || "Outros").trim().toUpperCase();
      const model = asset?.MODELO || asset?.Modelo || f._vehicleModel || "N/A";
      
      const litros = f._litros || 0;
      const custo = f._total || 0;
      
      if (!groups[tipo]) groups[tipo] = {};
      if (!groups[tipo][placa]) {
        groups[tipo][placa] = { liters: 0, cost: 0, count: 0, model };
      }
      
      groups[tipo][placa].liters += litros;
      groups[tipo][placa].cost += custo;
      groups[tipo][placa].count += 1;
    });

    const result: Array<{
      tipo: string;
      placa: string;
      model: string;
      liters: number;
      cost: number;
      count: number;
      diretoria: string;
      gerencia: string;
    }> = [];

    Object.keys(groups).forEach(tipo => {
      let maxPlaca = "";
      let maxStats = { liters: 0, cost: 0, count: 0, model: "N/A" };
      
      Object.keys(groups[tipo]).forEach(placa => {
        if (groups[tipo][placa].liters > maxStats.liters) {
          maxPlaca = placa;
          maxStats = groups[tipo][placa];
        }
      });

      if (maxPlaca && maxStats.liters > 0) {
        const asset = assetsByPlaca.get(maxPlaca);
        result.push({
          tipo,
          placa: maxPlaca,
          model: maxStats.model,
          liters: maxStats.liters,
          cost: maxStats.cost,
          count: maxStats.count,
          diretoria: asset?.DIRETORIA || asset?.Diretoria || "N/A",
          gerencia: asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || "N/A"
        });
      }
    });

    return result.sort((a, b) => b.liters - a.liters);
  }, [filteredFuel, assetsByPlaca]);

  // 2. Top 10 - Consumo por Ativo (Liters and Cost)
  const top10ByAsset = useMemo(() => {
    const map: Record<string, { placa: string; liters: number; cost: number }> = {};
    filteredFuel.forEach(f => {
      const placa = (f._placa || "N/A").toUpperCase();
      if (!map[placa]) map[placa] = { placa, liters: 0, cost: 0 };
      map[placa].liters += f._litros || 0;
      map[placa].cost += f._total || 0;
    });
    return Object.values(map).sort((a, b) => b.liters - a.liters).slice(0, 10);
  }, [filteredFuel]);

  // 3. Top 10 - Custo por Unidade (Gerência)
  const top10ByUnit = useMemo(() => {
    const map: Record<string, { unit: string; cost: number }> = {};
    filteredFuel.forEach(f => {
      const placa = (f._placa || "").toUpperCase();
      const asset = assetsByPlaca.get(placa);
      const unit = asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.Gerencia || "N/A";
      if (!unit) return;
      if (!map[unit]) map[unit] = { unit, cost: 0 };
      map[unit].cost += f._total || 0;
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost).slice(0, 10);
  }, [filteredFuel, assetsByPlaca]);

  // 4. Top 10 - Veículos Há Mais Tempo Sem Abastecer
  const longTimeNoFuel = useMemo(() => {
    const lastFueling: Record<string, Date> = {};
    fuel.forEach(f => {
      const placa = (f._placa || "").toUpperCase();
      const dateStr = f._date;
      const date = getFormattedDate(dateStr);
      if (placa && date) {
        if (!lastFueling[placa] || date > lastFueling[placa]) lastFueling[placa] = date;
      }
    });

    const now = new Date();
    return assets
      .filter(a => {
        const statusOp = String(a.STATUS_OPERACIONAL || a["STATUS OPERACIONAL"] || "").toUpperCase().trim();
        if (statusOp !== 'OPERACIONAL' && statusOp !== 'ATIVO') return false;

        const placaRaw = String(a.PLACA || a.placa || "").toUpperCase();
        const placaNormalized = placaRaw.replace(/[^A-Z0-9]/gi, "");
        const model = String(a.MODELO || a.Modelo || "N/A").trim();
        const diretoria = String(a.DIRETORIA || a.Diretoria || "N/A").trim();
        const gerencia = String(a.GERENCIA || a["GERÊNCIA"] || a.Gerencia || "N/A").trim();
        const tipo = String(a.TIPO || a.Tipo || "N/A").trim();
        const propriedade = String(a.PROPRIEDADE || a["PROPRIEDADE"] || (a.__raw && a.__raw[10]) || "N/A").trim().toUpperCase();
        const titularidade = String(a.TITULARIDADE || a["TITULARIDADE"] || (a.__raw && a.__raw[27]) || "N/A").trim().toUpperCase();

        if (searchPlaca && !placaNormalized.includes(searchPlaca.toUpperCase().trim())) return false;
        if (selectedDirectorias.length > 0 && !selectedDirectorias.map(d => String(d).trim()).includes(diretoria)) return false;
        if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(gerencia)) return false;
        if (selectedTipos.length > 0 && !selectedTipos.map(t => String(t).trim()).includes(tipo)) return false;
        if (selectedVehicleModels.length > 0 && !selectedVehicleModels.map(m => String(m).trim()).includes(model)) return false;
        if (selectedPropriedades.length > 0 && !selectedPropriedades.map(p => String(p).trim().toUpperCase()).includes(propriedade)) return false;
        if (selectedTitularidades.length > 0 && !selectedTitularidades.map(t => String(t).trim().toUpperCase()).includes(titularidade)) return false;

        return true;
      })
      .map(a => {
        const placa = String(a.PLACA || a.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
        const asset = assetsByPlaca.get(placa);
        const last = lastFueling[placa];
        const days = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        return { 
          placa, 
          days, 
          lastDate: last?.toLocaleDateString('pt-BR') || 'Nunca',
          titularidade: asset?.TITULARIDADE || (asset as any)?.COL_27 || "N/A"
        };
      }).sort((a, b) => b.days - a.days).slice(0, 10);
  }, [fuel, assets, assetsByPlaca, searchPlaca, selectedDirectorias, selectedGerencias, selectedTipos, selectedVehicleModels, selectedPropriedades, selectedTitularidades]);

  // 5. Top 10 - Veículos com Menor KM Médio
  const lowKmAssets = useMemo(() => {
    const kmSum: Record<string, { total: number; count: number }> = {};
    filteredFuel.forEach(f => {
      const placa = f._placa || "";
      const km = f._kmRodados || 0;
      if (placa && km > 0) {
        if (!kmSum[placa]) kmSum[placa] = { total: 0, count: 0 };
        kmSum[placa].total += km;
        kmSum[placa].count += 1;
      }
    });

    return assets
      .filter(a => {
        const statusOp = String(a.STATUS_OPERACIONAL || a["STATUS OPERACIONAL"] || "").toUpperCase().trim();
        if (statusOp !== 'OPERACIONAL' && statusOp !== 'ATIVO') return false;

        const placaRaw = String(a.PLACA || a.placa || "").toUpperCase();
        const placaNormalized = placaRaw.replace(/[^A-Z0-9]/gi, "");
        const model = String(a.MODELO || a.Modelo || "N/A").trim();
        const diretoria = String(a.DIRETORIA || a.Diretoria || "N/A").trim();
        const gerencia = String(a.GERENCIA || a["GERÊNCIA"] || a.Gerencia || "N/A").trim();
        const tipo = String(a.TIPO || a.Tipo || "N/A").trim();
        const propriedade = String(a.PROPRIEDADE || a["PROPRIEDADE"] || (a.__raw && a.__raw[10]) || "N/A").trim().toUpperCase();
        const titularidade = String(a.TITULARIDADE || a["TITULARIDADE"] || (a.__raw && a.__raw[27]) || "N/A").trim().toUpperCase();

        if (searchPlaca && !placaNormalized.includes(searchPlaca.toUpperCase().trim())) return false;
        if (selectedDirectorias.length > 0 && !selectedDirectorias.map(d => String(d).trim()).includes(diretoria)) return false;
        if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(gerencia)) return false;
        if (selectedTipos.length > 0 && !selectedTipos.map(t => String(t).trim()).includes(tipo)) return false;
        if (selectedVehicleModels.length > 0 && !selectedVehicleModels.map(m => String(m).trim()).includes(model)) return false;
        if (selectedPropriedades.length > 0 && !selectedPropriedades.map(p => String(p).trim().toUpperCase()).includes(propriedade)) return false;
        if (selectedTitularidades.length > 0 && !selectedTitularidades.map(t => String(t).trim().toUpperCase()).includes(titularidade)) return false;

        return true;
      })
      .map(a => {
        const placa = String(a.PLACA || a.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
        const stats = kmSum[placa];
        const avg = stats ? stats.total / stats.count : 0;
        return { 
          placa, 
          avg: Math.round(avg), 
          titularidade: a["TITULARIDADE"] || (a as any).COL_27 || "N/A"
        };
      }).filter(a => a.avg > 0).sort((a, b) => a.avg - b.avg).slice(0, 10);
  }, [filteredFuel, assets, searchPlaca, selectedDirectorias, selectedGerencias, selectedTipos, selectedVehicleModels, selectedPropriedades, selectedTitularidades]);

  // 6. Custo por Tipo de Ativo
  const costByType = useMemo(() => {
    const map: Record<string, number> = {};
    filteredFuel.forEach(f => {
      const placa = f._placa || "";
      const asset = assetsByPlaca.get(placa);
      const type = asset?.TIPO || asset?.Tipo || (asset as any)?.COL_16 || "N/A";
      const cost = f._total || 0;
      map[type] = (map[type] || 0) + cost;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredFuel, assetsByPlaca]);

  // 7. Custo por Tipo de Combustível
  const costByFuelType = useMemo(() => {
    const map: Record<string, number> = {};
    filteredFuel.forEach(f => {
      const type = f._fuelType || "Outros";
      const cost = f._total || 0;
      map[type] = (map[type] || 0) + cost;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredFuel]);

  // Consumo Geral por Tipo de Combustível (Litros e Custo)
  const fuelTypeConsumptionData = useMemo(() => {
    const map: Record<string, { type: string; liters: number; cost: number }> = {};
    filteredFuel.forEach(f => {
      const type = String(f._fuelType || "Outros").trim().toUpperCase();
      const liters = f._litros || 0;
      const cost = f._total || 0;
      if (!map[type]) {
        map[type] = { type, liters: 0, cost: 0 };
      }
      map[type].liters += liters;
      map[type].cost += cost;
    });
    return Object.values(map).sort((a, b) => b.liters - a.liters);
  }, [filteredFuel]);

  // 8. Tabela de Detalhamento por Veículo (Placa, Tipo, Modelo, Titularidade, Ano, Mês 1, Mês 2, Mês 3, Último Odômetro)
  const displayMonths = useMemo(() => {
    if (monthYearOptions.length > 0) return monthYearOptions.slice(-6);
    return [];
  }, [monthYearOptions]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const chartsContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    const toastId = toast.loading("Gerando relatório PDF de qualidade...");
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Top Header bar design (COMPESA deep corporate dark blue)
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, pageWidth, 40, "F");

      // Title Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("COMPESA - GESTÃO DE FROTAS", 14, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Relatório Executivo de Abastecimentos e Consumo", 14, 25);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);

      // Section: Active Filters
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("Filtros Ativos do Relatório", 14, 48);

      const activeFiltersText = [
        `Placa de Busca: ${searchPlaca || "Todas"}`,
        `Diretoria Selecionada: ${selectedDirectorias.length > 0 ? selectedDirectorias.join(", ") : "Todas"}`,
        `Gerência Selecionada: ${selectedGerencias.length > 0 ? selectedGerencias.join(", ") : "Todas"}`,
        `Propriedade: ${selectedPropriedades.length > 0 ? selectedPropriedades.join(", ") : "Todas"}`,
        `Cidade de Abastecimento: ${selectedCidades.length > 0 ? selectedCidades.join(", ") : "Todas"}`,
        `Titularidade: ${selectedTitularidades.length > 0 ? selectedTitularidades.join(", ") : "Todas"}`,
        `Tipo de Ativo: ${selectedTipos.length > 0 ? selectedTipos.join(", ") : "Todos"}`,
        `Período Selecionado: ${dateFrom ? dateFrom.toLocaleDateString('pt-BR') : "Início"} até ${dateTo ? dateTo.toLocaleDateString('pt-BR') : "Fim"}`
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      
      let filterY = 54;
      activeFiltersText.forEach(filter => {
        doc.text(`• ${filter}`, 18, filterY);
        filterY += 5;
      });

      // Section: Key metrics summary table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("Indicadores de Consumo Consolidados", 14, 98);

      autoTable(doc, {
        startY: 103,
        theme: "striped",
        head: [["Indicador de Performance", "Resultado Obtido"]],
        body: [
          ["Total de Volume Abastecido (Litros)", `${metrics.totalCombustivel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`],
          ["Investimento Total em Combustível", `R$ ${metrics.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
          ["Preço Médio Unitário do Litro", `R$ ${metrics.avgPrecoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
          ["Autonomia Real Média da Categoria", `${metrics.avgAutonomiaReal > 0 ? metrics.avgAutonomiaReal.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + " km/L" : "N/A"}`],
          ["Média de Deslocamento Registrado", `${metrics.avgKmMedio > 0 ? metrics.avgKmMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + " km" : "N/A"}`],
          ["Quantidade de Abastecimentos Computados", `${filteredFuel.length} registros`]
        ],
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9, cellPadding: 2.5 },
      });

      // Page 2: Table of category leaders
      doc.addPage();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("COMPESA - RELATÓRIO DE CONSUMO POR CATEGORIA", 14, 10);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.text("Veículo com Maior Consumo por Tipo de Ativo", 14, 25);

      const topTipoBody = topConsumidoresPorTipo.map(item => [
        item.tipo,
        item.placa,
        item.model,
        item.diretoria,
        item.gerencia,
        `${item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
        `R$ ${item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        `${item.count} abast.`
      ]);

      autoTable(doc, {
        startY: 30,
        theme: "grid",
        head: [["Tipo de Ativo", "Placa", "Modelo", "Diretoria", "Gerência", "Vol. Abastecido", "Custo Total", "Abastecimentos"]],
        body: topTipoBody,
        headStyles: { fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 7.5 }, // slightly smaller font to fit additional columns beautifully
      });

      // Page 3: Rankings Top list
      doc.addPage();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("COMPESA - TOP 10 RANKING DE CONSUMO E CUSTOS", 14, 10);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.text("Top 10 Ativos com Maior Consumo (litros)", 14, 25);

      const top10Body = top10ByAsset.map((item, idx) => [
        `#${idx + 1}`,
        item.placa,
        `${item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
        `R$ ${item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: 30,
        theme: "striped",
        head: [["Posição", "Placa do Ativo", "Total de Volume", "Investimento Total"]],
        body: top10Body,
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8.5 },
      });

      // Next table on the same page: Top 10 by unit
      const finalY = (doc as any).lastAutoTable.finalY || 135;
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text("Top 10 Unidades/Gerências por Custo Total de Abastecimento", 14, finalY + 12);

      const topUnitBody = top10ByUnit.map((item, idx) => [
        `#${idx + 1}`,
        item.unit,
        `R$ ${item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: finalY + 16,
        theme: "striped",
        head: [["Posição", "Unidade / Gerência", "Despesa Total"]],
        body: topUnitBody,
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8.5 },
      });

      // Page 4: Visual charts fallback image handler
      if (chartsContainerRef.current) {
        try {
          const canvas = await html2canvas(chartsContainerRef.current, {
            scale: 1.2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
          });

          doc.addPage();
          
          doc.setFillColor(30, 41, 59);
          doc.rect(0, 0, pageWidth, 15, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("COMPESA - DEMONSTRATIVOS GRÁFICOS", 14, 10);

          doc.setTextColor(30, 41, 59);
          doc.setFontSize(11);
          doc.text("Análise Visual de Abastecimentos & Tendências", 14, 25);

          const imgData = canvas.toDataURL("image/jpeg", 0.9);
          const imgWidth = 180;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          doc.addImage(imgData, "JPEG", 15, 30, imgWidth, Math.min(imgHeight, 240));
        } catch (canvasErr) {
          console.warn("Mapeamento gráfico indisponível devido a regras de sandbox do navegador.", canvasErr);
        }
      }

      doc.save(`Relatorio_Abastecimento_Compesa_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Relatório executivo PDF baixado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("Erro na geração do PDF:", err);
      toast.error("Ocorreu um erro ao gerar o PDF. Tente novamente.", { id: toastId });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const vehicleSummaryData = useMemo(() => {
    if (!fuel || fuel.length === 0) return [];

    // Map to quickly access filtered fuel by plate
    const platesInFilteredFuel = new Map<string, any[]>();
    filteredFuel.forEach(f => {
      const p = String(f._placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
      if (p) {
        if (!platesInFilteredFuel.has(p)) platesInFilteredFuel.set(p, []);
        platesInFilteredFuel.get(p)?.push(f);
      }
    });

    // If metadata assets list is empty, we must at least show vehicles from fuel data
    const baseAssets: any[] = assets.length > 0 ? assets : Array.from(platesInFilteredFuel.keys()).map(p => ({ PLACA: p }));

    return baseAssets
      .filter(a => {
        const placa = String(a.PLACA || a.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
        if (!placa) return false;
        
        // Frotal Operacional Filter: Strict OPERACIONAL as requested
        const statusOp = String(a.STATUS_OPERACIONAL || "").toUpperCase().trim();
        if (statusOp !== 'OPERACIONAL') return false;

        // Metadata filters
        const gerencia = String(a.GERENCIA || a["GER\u00CANCIA"] || a["GERENCIA"] || a.Gerencia || "N/A").trim();
        const diretoria = String(a.DIRETORIA || a.Diretoria || "N/A").trim();
        const modelo = String(a.MODELO || a.Modelo || "N/A").trim();
        const comb = String(a["COMBUST\u00CDVEL"] || a["COMBUSTIVEL"] || "N/A").trim();
        const tipo = String(a["TIPO"] || a["TIPO VEICULO"] || "N/A").trim();
        const propTipo = String(a.PROPRIEDADE_TIPO || (a.PROPRIEDADE === 'COMPESA' ? 'Pr\u00F3prio' : 'Locado') || "N/A").trim();

        if (searchPlaca && !placa.includes(searchPlaca.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim())) return false;
        if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(gerencia)) return false;
        if (selectedDirectorias.length > 0 && !selectedDirectorias.map(d => String(d).trim()).includes(diretoria)) return false;
        if (selectedVehicleModels.length > 0 && !selectedVehicleModels.map(m => String(m).trim()).includes(modelo)) return false;
        if (selectedFuelTypes.length > 0 && !selectedFuelTypes.map(f => String(f).trim()).includes(comb)) return false;
        if (selectedTipos.length > 0 && !selectedTipos.map(t => String(t).trim()).includes(tipo)) return false;
        if (selectedTipoControleAutonomia.length > 0 && !selectedTipoControleAutonomia.map(c => String(c).trim()).includes(propTipo)) return false;

        // Ensure this row has data in the CURRENT filtered set
        return platesInFilteredFuel.has(placa);
      })
      .map(a => {
        const placa = String(a.PLACA || a.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
        const assetFuel = platesInFilteredFuel.get(placa) || [];
        
        // Get last odometer from filtered data
        let lastOdo = 0;
        let lastDateForOdo: Date | null = null;
        
        assetFuel.forEach(f => {
          const d = getFormattedDate(f._date);
          const odo = f._odometer || 0;
          if (d && (!lastDateForOdo || d > lastDateForOdo)) {
            lastDateForOdo = d;
            lastOdo = odo;
          }
        });

        // Calculate SUM for last months
        const monthSumKms: Record<string, number> = {};
        displayMonths.forEach(m => {
          const mTransactions = assetFuel.filter(f => String(f._monthYear || "").trim() === String(m).trim());
          monthSumKms[m] = mTransactions.reduce((sum, f) => sum + (f._total || 0), 0); // User likely wants values in currency here or KM? Summing _total (value) for detailed view
        });

        return {
          ...a,
          placa,
          tipo: a.TIPO || a.Tipo || (a as any).COL_16 || "N/A",
          modelo: a.MODELO || a.Modelo || "N/A",
          titularidade: a.TITULARIDADE || (a as any).COL_27 || "N/A",
          ano: a.ANO || (a as any).COL_8 || "N/A",
          monthSumKms,
          lastOdo
        };
      });
  }, [assets, fuel, filteredFuel, displayMonths, searchPlaca, selectedGerencias, selectedDirectorias, selectedFuelTypes, selectedVehicleModels, selectedTipos, selectedTipoControleAutonomia, selectedMonthsYears]);

  const ChartEmptyState = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
      <Droplets size={40} className="opacity-20 animate-pulse" />
      <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      <span className="text-[8px] font-bold uppercase tracking-tighter opacity-50">Sem dados para os filtros selecionados</span>
    </div>
  );

  if (isLoading) return <LoadingState />;

  if (hasError) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-12">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200/50">
          <AlertTriangle size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Falha na Sincronização</h2>
          <p className="text-slate-500 max-w-md mx-auto font-medium">Ops! Não conseguimos conectar com os servidores de combustível da Compesa. Verifique sua conexão ou tente novamente.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl border-2 font-black uppercase tracking-widest text-xs h-12 px-8">
            Recarregar App
          </Button>
          <Button onClick={() => refetchAll()} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs h-12 px-8 shadow-xl shadow-slate-200 dark:shadow-none">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  const handleClearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchPlaca("");
    setSelectedFuelTypes([]);
    setSelectedVehicleModels([]);
    setSelectedDirectorias([]);
    setSelectedGerencias([]);
    setSelectedTipos([]);
    setSelectedTipoControleAutonomia([]);
    setSelectedMonthsYears([]);
    setSelectedPropriedades([]);
    setSelectedCidades([]);
    setSelectedTitularidades([]);
  };

  const handleExport = () => {
    toast.success("Exportando dados...");
    
    // 1. Detailed records sheet
    const mainData = filteredFuel.map(f => {
      const placa = (f.PLACA || f.Placa || getValByIndex(f, 5) || "").toString();
      const asset = assetsByPlaca.get(placa.toUpperCase());
      return {
        "Data Transação": f["DATA TRANSACAO"] || getValByIndex(f, 4),
        "Mês/Ano": f["MÊS/ANO"] || getValByIndex(f, 41),
        "Placa": placa,
        "Tipo de Ativo": asset?.TIPO || getValByIndex(asset || {}, 16) || "N/A",
        "Modelo": asset?.MODELO || asset?.Modelo || "N/A",
        "Combustível": f["TIPO COMBUSTIVEL"] || getValByIndex(f, 13),
        "Litros": parseNum(f.LITROS || getValByIndex(f, 14)),
        "Preço/Litro": parseNum(f["PREÇO/L"] || getValByIndex(f, 15)),
        "Valor Total": parseNum(f["VALOR TOTAL"] || getValByIndex(f, 19)),
        "KM/Horas": parseNum(f["KM RODADOS OU HORAS TRABALHADAS"] || getValByIndex(f, 17)),
        "Último Odômetro": parseNum(f["ÚLTIMO ODÔMETRO"] || getValByIndex(f, 16)),
        "Autonomia Real": parseNum(f["AUTONOMIA REAL"] || getValByIndex(f, 42)),
        "Controle Autonomia": f["TIPO CONTROLE AUTONOMIA"] || getValByIndex(f, 43),
        "Diretoria": asset?.DIRETORIA || asset?.Diretoria || "N/A",
        "Gerência": asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A",
      };
    });

    // 2. Summary sheet (exactly what is shown in the summary table)
    const summaryData = vehicleSummaryData.map(row => {
      const item: any = {
        "Placa": row.placa,
        "Tipo": row.tipo,
        "Modelo": row.modelo,
        "Titularidade": row.titularidade,
        "Ano": row.ano,
        "Último Odômetro": row.lastOdo,
      };
      displayMonths.forEach(m => {
        item[`Soma KM ${formatMonthLabel(m)}`] = row.monthSumKms[m];
      });
      return item;
    });

    exportToExcelMultiSheet([
      { data: mainData, sheetName: "Abastecimentos Filtrados" },
      { data: summaryData, sheetName: "Resumo por Veículo" }
    ], "Relatorio_Fuel_Dashboard");
  };

  return (
    <div className="space-y-6">
      <FuelDashboardsFilterBar
        onClearFilters={handleClearFilters}
        searchPlaca={searchPlaca}
        onSearchPlacaChange={setSearchPlaca}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        selectedFuelTypes={selectedFuelTypes}
        onFuelTypesChange={setSelectedFuelTypes}
        selectedVehicleModels={selectedVehicleModels}
        onVehicleModelsChange={setSelectedVehicleModels}
        selectedDirectorias={selectedDirectorias}
        onDirectoriasChange={setSelectedDirectorias}
        selectedGerencias={selectedGerencias}
        onGerenciasChange={setSelectedGerencias}
        selectedTipos={selectedTipos}
        onTiposChange={setSelectedTipos}
        selectedTipoControleAutonomia={selectedTipoControleAutonomia}
        onTipoControleAutonomiaChange={setSelectedTipoControleAutonomia}
        selectedMonthsYears={selectedMonthsYears}
        onMonthsYearsChange={setSelectedMonthsYears}
        selectedPropriedades={selectedPropriedades}
        onPropriedadesChange={setSelectedPropriedades}
        selectedCidades={selectedCidades}
        onCidadesChange={setSelectedCidades}
        selectedTitularidades={selectedTitularidades}
        onTitularidadesChange={setSelectedTitularidades}
        fuelTypeOptions={fuelTypeOptions}
        modelOptions={modelOptions}
        diretoriaOptions={diretoriaOptions}
        gerenciaOptions={gerenciaOptions}
        tipoOptions={tipoOptions}
        monthYearOptions={monthYearOptions}
        autoControleOptions={autoControleOptions}
        propriedadeOptions={propriedadeOptions}
        cidadeOptions={cidadeOptions}
        titularidadeOptions={titularidadeOptions}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fuel className="h-6 w-6 text-primary" />
          Dashboard de Abastecimento
        </h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => setView?.('abast-maquinas')} 
            variant="outline" 
            className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <ClipboardList className="h-4 w-4" />
            Relatório Cartões Máquinas e Equipamentos
          </Button>
          <Button onClick={handleExport} variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText className="h-4 w-4" />
            Exportar para Excel (Filtrado)
          </Button>
          <Button 
            onClick={handleExportPDF} 
            disabled={isExportingPDF}
            variant="outline" 
            className="gap-2 border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:text-slate-300"
          >
            <FileText className="h-4 w-4 text-indigo-500" />
            {isExportingPDF ? "Exportando..." : "Exportar Relatório PDF"}
          </Button>
        </div>
      </div>

      <div ref={chartsContainerRef} className="space-y-6">
        <div className="grid gap-3 md:grid-cols-5">
        <MetricCard title="Total de Combustível" value={`${metrics.totalCombustivel.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}L`} icon={<Droplets className="h-4 w-4" />} centered />
        <MetricCard title="Custo Total" value={`R$ ${metrics.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<DollarSign className="h-4 w-4" />} centered />
        <MetricCard title="Preço Médio/Litro" value={`R$ ${metrics.avgPrecoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`} icon={<Tag className="h-4 w-4" />} centered />
        <MetricCard title="Autonomia Real Média" value={metrics.avgAutonomiaReal > 0 ? `${metrics.avgAutonomiaReal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km/L` : "N/A"} icon={<Activity className="h-4 w-4" />} centered />
        <MetricCard title="KM Médio" value={metrics.avgKmMedio > 0 ? `${metrics.avgKmMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : "N/A"} icon={<Gauge className="h-4 w-4" />} centered />
      </div>

      <ChartCard 
        title="Histórico de Abastecimentos" 
        description={chartViewMode === 'liters' ? "Consumo mensal (L) por tipo de combustível" : "Custo mensal (R$) por tipo de combustível"}
        headerAction={
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <Button 
              variant={chartViewMode === 'liters' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setChartViewMode('liters')}
              className="h-7 text-[10px] font-black uppercase px-3"
            >
              Litros (L)
            </Button>
            <Button 
              variant={chartViewMode === 'cost' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setChartViewMode('cost')}
              className="h-7 text-[10px] font-black uppercase px-3"
            >
              Custo (R$)
            </Button>
          </div>
        }
      >
        {timelineData.length === 0 ? (
          <ChartEmptyState title="Histórico de Abastecimentos" />
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis 
                  dataKey="monthYear" 
                  tick={{ fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  label={{ 
                    value: chartViewMode === 'liters' ? 'Litros (L)' : 'Valor (R$)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    style: { textAnchor: 'middle', fontSize: 10, fill: '#94a3b8' } 
                  }} 
                />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                   itemStyle={{ color: '#fff' }}
                   formatter={(value: number) => chartViewMode === 'liters' ? value.toLocaleString('pt-BR') + ' L' : 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                {fuelTypes.map((type, i) => (
                  <Line 
                    key={String(type)} 
                    type="monotone" 
                    dataKey={chartViewMode === 'liters' ? `${String(type)}_L` : `${String(type)}_V`} 
                    name={String(type)} 
                    stroke={SHADES_OF_BLUE[i % SHADES_OF_BLUE.length]} 
                    strokeWidth={3}
                    dot={{ r: 4, fill: SHADES_OF_BLUE[i % SHADES_OF_BLUE.length], strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
                <Line 
                    type="monotone" 
                    dataKey={chartViewMode === 'liters' ? "totalL" : "totalV"} 
                    name="TOTAL" 
                    stroke="#000" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard 
        title="Comparação Mês a Mês Ano a Ano" 
        description={`Comparativo mensal de ${compMetricMode === 'liters' ? "abastecimento em Litros (L)" : "Custo total em Reais (R$)"} entre os anos ${compYearA} e ${compYearB}`}
        headerAction={
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <span>Anos:</span>
              <select 
                value={compYearA} 
                onChange={(e) => setCompYearA(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                {availableYears.map(y => (
                  <option key={`a-${y}`} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-slate-400">vs</span>
              <select 
                value={compYearB} 
                onChange={(e) => setCompYearB(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                {availableYears.map(y => (
                  <option key={`b-${y}`} value={y}>{y}</option>
                ))}
              </select>
            </div>
            
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <Button 
                variant={compMetricMode === 'liters' ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setCompMetricMode('liters')}
                className="h-7 text-[10px] font-black uppercase px-3"
              >
                Litros (L)
              </Button>
              <Button 
                variant={compMetricMode === 'cost' ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setCompMetricMode('cost')}
                className="h-7 text-[10px] font-black uppercase px-3"
              >
                Custo (R$)
              </Button>
            </div>
          </div>
        }
      >
        {comparativeData.length === 0 ? (
          <ChartEmptyState title="Comparativo Ano a Ano" />
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={comparativeData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 10 }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                axisLine={{ stroke: '#e2e8f0' }}
                label={{ 
                  value: compMetricMode === 'liters' ? 'Volume (Litros)' : 'Valor (R$)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { textAnchor: 'middle', fontSize: 10, fill: '#94a3b8' } 
                }} 
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white shadow-xl space-y-3 min-w-[240px]">
                        <div className="font-bold border-b border-slate-800 pb-1.5 text-xs text-slate-400 font-mono tracking-wider uppercase">
                          Mês: {data.monthFullName}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="flex items-center gap-1.5 font-bold text-indigo-400">
                              <span className="h-2 w-2 rounded-full bg-indigo-500" />
                              Ano {compYearA}
                            </span>
                            <span className="font-mono text-slate-200">
                              {compMetricMode === 'liters' 
                                ? `${data.litersA.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`
                                : `R$ ${data.costA.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              }
                            </span>
                          </div>
                          <div className="pl-3.5 flex justify-between text-[11px] text-slate-400">
                            <span>Abastecimentos:</span>
                            <span className="font-mono text-slate-300 font-bold">{data.countA}</span>
                          </div>
                          <div className="pl-3.5 flex justify-between text-[11px] text-slate-400">
                            <span>Ativos Abastecidos:</span>
                            <span className="font-mono text-slate-300 font-bold">{data.platesA}</span>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1.5 border-t border-dashed border-slate-800">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="flex items-center gap-1.5 font-bold text-teal-400">
                              <span className="h-2 w-2 rounded-full bg-teal-500" />
                              Ano {compYearB}
                            </span>
                            <span className="font-mono text-slate-200">
                              {compMetricMode === 'liters' 
                                ? `${data.litersB.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`
                                : `R$ ${data.costB.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              }
                            </span>
                          </div>
                          <div className="pl-3.5 flex justify-between text-[11px] text-slate-400">
                            <span>Abastecimentos:</span>
                            <span className="font-mono text-slate-300 font-bold">{data.countB}</span>
                          </div>
                          <div className="pl-3.5 flex justify-between text-[11px] text-slate-400">
                            <span>Ativos Abastecidos:</span>
                            <span className="font-mono text-slate-300 font-bold">{data.platesB}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              <Line 
                type="monotone" 
                dataKey={compMetricMode === 'liters' ? "litersA" : "costA"} 
                name={`Ano ${compYearA}`} 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
              <Line 
                type="monotone" 
                dataKey={compMetricMode === 'liters' ? "litersB" : "costB"} 
                name={`Ano ${compYearB}`} 
                stroke="#14b8a6" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Dashboard: Veículo com Maior Consumo por Tipo */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Veículos com Maior Consumo por Tipo de Ativo
            </h2>
            <p className="text-xs text-slate-500 font-medium">Líderes de consumo de combustível agrupados por categoria de veículo</p>
          </div>
          <Badge variant="outline" className="border-indigo-200 text-indigo-600 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
            {topConsumidoresPorTipo.length} Categorias
          </Badge>
        </div>

        {topConsumidoresPorTipo.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-2">
            <span className="text-xs font-bold text-slate-400">Nenhum dado de consumo por tipo disponível</span>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {topConsumidoresPorTipo.map((item) => (
              <Card key={item.tipo} className="overflow-hidden shadow-sm hover:shadow-md border-slate-200 hover:border-indigo-200 dark:border-slate-800 transition-all duration-200 flex flex-col justify-between">
                <div className="bg-slate-50 border-b border-slate-100 dark:bg-slate-900 py-2 px-2.5 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 truncate max-w-[140px]" title={item.tipo}>
                    {item.tipo}
                  </span>
                  <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[8px] px-1.5 py-0 font-black hover:bg-indigo-100">
                    {item.count} ab.
                  </Badge>
                </div>
                <CardContent className="p-2.5 space-y-1.5">
                  <div>
                    <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight leading-tight">
                      {item.placa}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold truncate">
                      {item.model}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="text-[8px] px-1 py-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-semibold">
                        {item.diretoria}
                      </span>
                      <span className="text-[8px] px-1 py-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-semibold truncate max-w-[100px]" title={item.gerencia}>
                        {item.gerencia}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 border-dashed">
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-400 block leading-tight">Litros</span>
                      <div className="text-xs font-black text-blue-600 font-mono">
                        {item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                      </div>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-400 block leading-tight">Custo</span>
                      <div className="text-xs font-black text-emerald-600 font-mono">
                        R$ {item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dashboard: Consumo por Tipo de Combustível */}
      <ChartCard 
        title="Consumo por Tipo de Combustível" 
        description="Volume abastecido em litros (coluna O) contra o custo total em reais (coluna T) por combustível"
        className="min-h-[380px]"
      >
        {fuelTypeConsumptionData.length === 0 ? (
          <ChartEmptyState title="Consumo por Tipo de Combustível" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={fuelTypeConsumptionData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="type" axisLine={false} tickLine={false} fontSize={10} className="font-bold text-slate-600" />
              <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" axisLine={false} tickLine={false} fontSize={10} label={{ value: 'Volume (L)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#3b82f6', fontWeight: 'bold' } }} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" axisLine={false} tickLine={false} fontSize={10} label={{ value: 'Custo (R$)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 10, fill: '#10b981', fontWeight: 'bold' } }} />
              <Tooltip 
                cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }} 
                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                itemStyle={{ color: '#fff' }}
                formatter={(val: number, name: string) => {
                  if (name === "liters") return [`${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`, "Volume (Litros)"];
                  if (name === "cost") return [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Custo Total (R$)"];
                  return [val.toLocaleString('pt-BR'), name];
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar yAxisId="left" dataKey="liters" name="Volume (Litros)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={45} />
              <Bar yAxisId="right" dataKey="cost" name="Custo (R$)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Top 10 - Consumo por Ativo (L)" description="Veículos com maior volume abastecido" className="h-[350px]">
          {top10ByAsset.length === 0 ? (
            <ChartEmptyState title="Consumo por Ativo" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10ByAsset} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="placa" type="category" width={80} axisLine={false} tickLine={false} fontSize={9} />
                  <Tooltip formatter={(val: number) => `${val.toLocaleString('pt-BR')} L`} />
                  <Bar dataKey="liters" radius={[0, 4, 4, 0]}>
                    {top10ByAsset.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SHADES_OF_BLUE[index % SHADES_OF_BLUE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 10 - Gerências por Custo" description="Unidades com maiores gastos (R$)" className="h-[350px]">
          {top10ByUnit.length === 0 ? (
            <ChartEmptyState title="Gastos por Gerência" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10ByUnit} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="unit" type="category" width={100} axisLine={false} tickLine={false} fontSize={8} />
                  <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                    {top10ByUnit.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SHADES_OF_BLUE[index % SHADES_OF_BLUE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Custo por Tipo de Ativo (Top 10)" description="Maiores gastos por categoria" className="h-[350px]">
          {costByType.length === 0 ? (
            <ChartEmptyState title="Custo por Tipo" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costByType.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip cursor={{fill: 'rgba(59, 130, 246, 0.05)'}} formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {costByType.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SHADES_OF_BLUE[index % SHADES_OF_BLUE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Custo por Tipo de Combustível" description="Total gasto por categoria" className="h-[350px]">
          {costByFuelType.length === 0 ? (
            <ChartEmptyState title="Custo por Combustível" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                  <Pie
                    data={costByFuelType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    style={{ fontSize: '8px', fontWeight: 'bold' }}
                  >
                    {costByFuelType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SHADES_OF_BLUE[index % SHADES_OF_BLUE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-3 shadow-none border-slate-200">
          <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-destructive" />
            Top 10 - Mais Tempo Sem Abastecer
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Placa</TableHead>
                  <TableHead className="text-center">Titularidade</TableHead>
                  <TableHead className="text-center">Último Abast.</TableHead>
                  <TableHead className="text-center">Dias Parado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {longTimeNoFuel.map((v) => (
                  <TableRow key={v.placa}>
                    <TableCell className="font-medium text-center">{v.placa}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-normal uppercase">
                        {v.titularidade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{v.lastDate}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={v.days > 15 ? "destructive" : "secondary"}>
                        {v.days} dias
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-warning" />
            Top 10 - Menor KM Médio
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Placa</TableHead>
                  <TableHead className="text-center">Titularidade</TableHead>
                  <TableHead className="text-center">KM Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowKmAssets.map((v) => (
                  <TableRow key={v.placa}>
                    <TableCell className="font-medium text-center">{v.placa}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{v.titularidade}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{v.avg} km</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
      </div>

      <Card className="p-3 shadow-none border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Milestone className="h-5 w-5 text-primary" />
            Resumo de Abastecimento por Veículo
          </h3>
          <Badge variant="secondary">{vehicleSummaryData.length} veículos</Badge>
        </div>
        <div className="rounded-md border overflow-hidden flex flex-col">
          {/* Top Scrollbar Mirror */}
          <div 
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-50 dark:bg-slate-900 border-b"
          >
            <div style={{ width: '1200px', height: '1px' }} />
          </div>
          
          <div 
            ref={tableContainerRef}
            onScroll={handleTableScroll}
            className="max-h-[500px] overflow-auto custom-scrollbar"
          >
            <Table className="min-w-[1200px] border-separate border-spacing-0">
              <TableHeader className="sticky top-0 bg-background z-30">
                <TableRow>
                  <TableHead className="w-[100px] text-center sticky left-0 bg-background z-40 border-b border-r" rowSpan={2}>Placa</TableHead>
                  <TableHead className="text-center border-b" rowSpan={2}>Tipo</TableHead>
                  <TableHead className="text-center border-b" rowSpan={2}>Modelo</TableHead>
                  <TableHead className="text-center border-b" rowSpan={2}>Titularidade</TableHead>
                  <TableHead className="text-center border-b" rowSpan={2}>Ano</TableHead>
                  <TableHead className="text-center bg-slate-50 dark:bg-slate-900/50 border-x border-b text-[10px] font-black uppercase tracking-widest text-primary py-1" colSpan={displayMonths.length}>
                    Deslocamento Últimos 04 Meses
                  </TableHead>
                  <TableHead className="text-center border-b" rowSpan={2}>Último Odômetro</TableHead>
                </TableRow>
                <TableRow>
                  {displayMonths.map((m, idx) => (
                    <TableHead key={m} className="text-center border-x border-b">
                      {formatMonthLabel(m)}
                      {idx === displayMonths.length - 1 && (
                        <span className="block text-[8px] text-indigo-500 font-black">Mês Atual</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleSummaryData.map((row) => (
                  <TableRow key={row.placa}>
                    <TableCell className="font-bold text-center sticky left-0 bg-white dark:bg-slate-950 z-10 border-r">{row.placa}</TableCell>
                    <TableCell className="text-center text-xs">{row.tipo}</TableCell>
                    <TableCell className="text-center text-xs truncate max-w-[150px]">{row.modelo}</TableCell>
                    <TableCell className="text-center text-xs">
                      <Badge variant="outline" className="font-normal">{row.titularidade}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">{row.ano}</TableCell>
                    {displayMonths.map(m => (
                      <TableCell key={m} className="text-center">
                        {row.monthSumKms[m] > 0 ? `${row.monthSumKms[m].toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : "-"}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-mono">
                      {row.lastOdo > 0 ? row.lastOdo.toLocaleString('pt-BR') : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FuelDashboardsPage;
