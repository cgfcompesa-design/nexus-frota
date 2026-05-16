
import React, { useState, useMemo, useRef } from "react";
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

      return true;
    });
  }, [fuel, assetsByPlaca, dateFrom, dateTo, searchPlaca, selectedGerencias, selectedFuelTypes, selectedVehicleModels, selectedDirectorias, selectedTipos, selectedTipoControleAutonomia, selectedMonthsYears]);

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
        return statusOp === 'OPERACIONAL';
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
  }, [fuel, assets, assetsByPlaca]);

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
        return statusOp === 'OPERACIONAL';
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
  }, [filteredFuel, assets]);

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

  // 8. Tabela de Detalhamento por Veículo (Placa, Tipo, Modelo, Titularidade, Ano, Mês 1, Mês 2, Mês 3, Último Odômetro)
  const displayMonths = useMemo(() => {
    if (monthYearOptions.length > 0) return monthYearOptions.slice(-6);
    return [];
  }, [monthYearOptions]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);

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
        fuelTypeOptions={fuelTypeOptions}
        modelOptions={modelOptions}
        diretoriaOptions={diretoriaOptions}
        gerenciaOptions={gerenciaOptions}
        tipoOptions={tipoOptions}
        monthYearOptions={monthYearOptions}
        autoControleOptions={autoControleOptions}
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
        </div>
      </div>

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
