
import React, { useState, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { useAssets, useFuelData, useAutonomiaData, useAutonomiaPadraoData } from "@/hooks/useFleetData";
import { useTelemetryHistory } from "@/hooks/useTelemetryData";
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
 'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
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
  if (dateString instanceof Date) {
    if (isNaN(dateString.getTime())) return null;
    let y = dateString.getFullYear();
    if (y < 100) y += 2000;
    return new Date(y, dateString.getMonth(), dateString.getDate());
  }
  try {
    if (typeof dateString === 'number') {
      const utcDate = new Date((dateString - 25569) * 86400 * 1000);
      if (isNaN(utcDate.getTime())) return null;
      let y = utcDate.getUTCFullYear();
      if (y < 100) y += 2000;
      return new Date(y, utcDate.getUTCMonth(), utcDate.getUTCDate());
    }
    
    const str = String(dateString).trim();
    if (/^\d+(\.\d+)?$/.test(str)) {
      const excelNum = parseFloat(str);
      const utcDate = new Date((excelNum - 25569) * 86400 * 1000);
      if (isNaN(utcDate.getTime())) return null;
      let y = utcDate.getUTCFullYear();
      if (y < 100) y += 2000;
      return new Date(y, utcDate.getUTCMonth(), utcDate.getUTCDate());
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      let day = 1;
      let month = 0;
      let year = 2026;
      
      if (parts[0].length === 4) {
        // ISO format YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2].split(' ')[0], 10);
      } else {
        // BR format DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        const yearPart = parts[2].split(' ')[0];
        year = parseInt(yearPart, 10);
      }
      
      if (year < 100) year += 2000;
      const localD = new Date(year, month, day);
      if (!isNaN(localD.getTime())) return localD;
    }

    const testDate = new Date(str);
    if (!isNaN(testDate.getTime())) {
      let y = testDate.getFullYear();
      if (y < 100) y += 2000;
      return new Date(y, testDate.getMonth(), testDate.getDate());
    }
    return null;
  } catch { return null; }
};

const normalizeTelemetryMonthYear = (str: string): string => {
  if (!str) return "N/A";
  const normalizedStr = str.toLowerCase().trim();
  
  // If it's already in MM/YYYY format
  if (/^\d{2}\/\d{4}$/.test(normalizedStr)) {
    return normalizedStr;
  }
  
  const monthNames: Record<string, string> = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05',
    'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };
  
  const cleaned = normalizedStr.replace(/\./g, '');
  const parts = cleaned.split(/[\/\s-]/);
  if (parts.length >= 2) {
    let month = "";
    let year = "";
    
    for (const [name, code] of Object.entries(monthNames)) {
      if (parts[0].startsWith(name)) {
        month = code;
        break;
      }
    }
    
    if (!month) {
      for (const [name, code] of Object.entries(monthNames)) {
        if (parts[1].startsWith(name)) {
          month = code;
          break;
        }
      }
    }
    
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      year = lastPart;
      if (year.length === 2) {
        year = "20" + year;
      }
    }
    
    if (month && year) {
      return `${month}/${year}`;
    }
  }
  
  const match = normalizedStr.match(/(\d{1,2})[\/\s-](\d{2,4})/);
  if (match) {
    const month = match[1].padStart(2, '0');
    let year = match[2];
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${month}/${year}`;
  }
  
  return "N/A";
};

const FuelDashboardsPage = ({ setView }: { setView?: (view: string) => void }) => {
  const { data: fuel = [], isLoading: loadingFuel, isError: isErrorFuel, refetch: refetchFuel } = useFuelData();
  const { data: assets = [], isLoading: loadingAssets, isError: isErrorAssets, refetch: refetchAssets } = useAssets();
  const { data: telemetryHistory = [] } = useTelemetryHistory();
  
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
  const [driverChartMetric, setDriverChartMetric] = useState<"liters" | "cost">("liters");
  const [assetChartMetric, setAssetChartMetric] = useState<"liters" | "cost">("liters");
  const [locationChartTab, setLocationChartTab] = useState<"city" | "posto" | "bairro">("city");
  const [locationChartMetric, setLocationChartMetric] = useState<"liters" | "cost">("liters");
 
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

  // Sanitized Fuel Data to enforce correct columns consistently across pages
  const sanitizedFuelData = useMemo(() => {
    return fuel.map((f) => {
      // 1. Litros (Column O, index 14 is primary. Fallback if not found)
      const litros = parseNum(f.COL_14 !== undefined && f.COL_14 !== null && String(f.COL_14).trim() !== "" ? f.COL_14 : f._litros || f.LITROS || f.VOLUME || f.QUANTIDADE || 0);
      
      // 2. Custo / Valor Emissão (Column T, index 19 is primary)
      const total = parseNum(f.COL_19 !== undefined && f.COL_19 !== null && String(f.COL_19).trim() !== "" ? f.COL_19 : f._total || f["VALOR EMISSAO"] || f.VALOR || f.TOTAL || 0);

      // 3. Tipo Combustível (Column N, index 13 is primary)
      const rawFuelType = f.COL_13 !== undefined && f.COL_13 !== null && String(f.COL_13).trim() !== "" ? f.COL_13 : f._fuelType || f.COMBUSTIVEL || "N/A";
      const fuelType = String(rawFuelType).trim().toUpperCase();

      // 4. Parse Date (Column E / COL_4 is the primary date column)
      const d = getFormattedDate(f._date || f.COL_4);

      // 5. Month/Year calculation and normalization
      let mesAno = String(f._monthYear || f.COL_41 || "").trim();
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
        const monthNames = { 
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
        _fuelType: fuelType,
        _dateParsed: d,
        _monthYear: mesAno,
      };
    });
  }, [fuel]);

  const filteredFuel = useMemo(() => {
    return sanitizedFuelData.filter((f) => {
      // Basic data extraction with fallbacks
      const pRaw = f._placa || f.PLACA || (f.__raw && f.__raw[5]) || "";
      if (!pRaw) return false;
      const placa = String(pRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      
      const asset = assetsByPlaca.get(placa);
      
      // Metadata extraction
      const fuelType = f._fuelType || "N/A";
      const vlLitro = f._vlLitro || 0;
      
      const model = asset?.MODELO || asset?.Modelo || f._vehicleModel || "N/A";
      const diretoria = asset?.DIRETORIA || asset?.Diretoria || "N/A";
      const gerencia = asset?.GERENCIA || asset?.["GER\u00CANCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || f._unit || "N/A";
      const tipo = asset?.TIPO || asset?.Tipo || asset?.["TIPO VEICULO"] || f._assetType || "N/A";
      const mesAno = f._monthYear;
      
      const controleAuto = asset?.["CONTROLE DE AUTONOMIA"] || asset?.["CONTROLE AUTONOMIA"] || (f as any).COL_43 || "";
      const propriedade = asset?.PROPRIEDADE || asset?.Propriedade || asset?.["PROPRIEDADE"] || (asset?.__raw && asset?.__raw[10]) || "N/A";
      const cidade = f._cidade || f.COL_25 || f.CIDADE || f.MUNICÍPIO || f.MUNICIPIO || "N/A";
      const titularidade = asset?.TITULARIDADE || asset?.["TITULARIDADE"] || (asset?.__raw && asset?.__raw[27]) || "N/A";

      // Transaction Date Filter - Pure Date Comparison
      if (dateFrom || dateTo) {
        const d = f._dateParsed;
        if (!d) return false;
        
        const cleanD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (dateFrom) {
          const cleanFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
          if (cleanD < cleanFrom) return false;
        }
        if (dateTo) {
          const cleanTo = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
          if (cleanD > cleanTo) return false;
        }
      }
      
      // Applying active filters
      if (searchPlaca && !placa.includes(searchPlaca.toUpperCase().trim())) return false;
      if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(String(gerencia).trim())) return false;
      if (selectedFuelTypes.length > 0 && !selectedFuelTypes.map(ft => String(ft).trim().toUpperCase()).includes(String(fuelType).trim().toUpperCase())) return false;
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
  }, [sanitizedFuelData, assetsByPlaca, dateFrom, dateTo, searchPlaca, selectedGerencias, selectedFuelTypes, selectedVehicleModels, selectedDirectorias, selectedTipos, selectedTipoControleAutonomia, selectedMonthsYears, selectedPropriedades, selectedCidades, selectedTitularidades]);

  const fuelFilteredWithoutDate = useMemo(() => {
    return sanitizedFuelData.filter((f) => {
      const pRaw = f._placa || f.PLACA || (f.__raw && f.__raw[5]) || "";
      if (!pRaw) return false;
      const placa = String(pRaw).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      
      const asset = assetsByPlaca.get(placa);
      
      const fuelType = f._fuelType || "N/A";
      const model = asset?.MODELO || asset?.Modelo || f._vehicleModel || "N/A";
      const diretoria = asset?.DIRETORIA || asset?.Diretoria || "N/A";
      const gerencia = asset?.GERENCIA || asset?.["GER\u00CANCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || f._unit || "N/A";
      const tipo = asset?.TIPO || asset?.Tipo || asset?.["TIPO VEICULO"] || f._assetType || "N/A";

      const controleAuto = asset?.["CONTROLE DE AUTONOMIA"] || asset?.["CONTROLE AUTONOMIA"] || (f as any).COL_43 || "";
      const propriedade = asset?.PROPRIEDADE || asset?.Propriedade || asset?.["PROPRIEDADE"] || (asset?.__raw && asset?.__raw[10]) || "N/A";
      const cidade = f._cidade || f.COL_25 || f.CIDADE || f.MUNICÍPIO || f.MUNICIPIO || "N/A";
      const titularidade = asset?.TITULARIDADE || asset?.["TITULARIDADE"] || (asset?.__raw && asset?.__raw[27]) || "N/A";

      if (searchPlaca && !placa.includes(searchPlaca.toUpperCase().trim())) return false;
      if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(String(gerencia).trim())) return false;
      if (selectedFuelTypes.length > 0 && !selectedFuelTypes.map(ft => String(ft).trim().toUpperCase()).includes(String(fuelType).trim().toUpperCase())) return false;
      if (selectedVehicleModels.length > 0 && !selectedVehicleModels.map(m => String(m).trim()).includes(String(model).trim())) return false;
      if (selectedDirectorias.length > 0 && !selectedDirectorias.map(d => String(d).trim()).includes(String(diretoria).trim())) return false;
      if (selectedTipos.length > 0 && !selectedTipos.map(t => String(t).trim()).includes(String(tipo).trim())) return false;
      if (selectedTipoControleAutonomia.length > 0 && !selectedTipoControleAutonomia.map(c => String(c).trim()).includes(String(controleAuto).trim())) return false;
      if (selectedPropriedades.length > 0 && !selectedPropriedades.map(p => String(p).trim().toUpperCase()).includes(String(propriedade).trim().toUpperCase())) return false;
      if (selectedCidades.length > 0 && !selectedCidades.map(c => String(c).trim().toUpperCase()).includes(String(cidade).trim().toUpperCase())) return false;
      if (selectedTitularidades.length > 0 && !selectedTitularidades.map(t => String(t).trim().toUpperCase()).includes(String(titularidade).trim().toUpperCase())) return false;

      return true;
    });
  }, [sanitizedFuelData, assetsByPlaca, searchPlaca, selectedGerencias, selectedFuelTypes, selectedVehicleModels, selectedDirectorias, selectedTipos, selectedTipoControleAutonomia, selectedPropriedades, selectedCidades, selectedTitularidades]);

  const platesInFuelWithoutDate = useMemo(() => {
    const map = new Map<string, any[]>();
    fuelFilteredWithoutDate.forEach(f => {
      const p = String(f._placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
      if (p) {
        if (!map.has(p)) map.set(p, []);
        map.get(p)?.push(f);
      }
    });
    return map;
  }, [fuelFilteredWithoutDate]);

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
  const fuelTypeOptions = useMemo(() => Array.from(new Set(sanitizedFuelData.map(f => f._fuelType).filter(Boolean))).sort() as string[], [sanitizedFuelData]);
  const monthYearOptions = useMemo(() => {
    const set = new Set<string>();
    sanitizedFuelData.forEach(f => {
      const mesAno = f._monthYear;
      if (mesAno && mesAno !== "N/A") {
        set.add(String(mesAno).trim());
      }
    });
    return Array.from(set).sort((a, b) => parseMonthYear(a).getTime() - parseMonthYear(b).getTime());
  }, [sanitizedFuelData]);
  const autoControleOptions = useMemo(() => Array.from(new Set(sanitizedFuelData.map(f => f["TIPO CONTROLE AUTONOMIA"] || (f as any).COL_43).filter(Boolean))).sort() as string[], [sanitizedFuelData]);
  
  const modelOptions = useMemo(() => Array.from(new Set(assets.map(a => a.MODELO || a.Modelo).filter(Boolean))).sort() as string[], [assets]);
  const diretoriaOptions = useMemo(() => Array.from(new Set(assets.map(a => a.DIRETORIA || a.Diretoria).filter(Boolean))).sort() as string[], [assets]);
  const gerenciaOptions = useMemo(() => Array.from(new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"] || a.Gerencia).filter(Boolean))).sort() as string[], [assets]);
  const tipoOptions = useMemo(() => Array.from(new Set(assets.map(a => a.TIPO || a.Tipo).filter(Boolean))).sort() as string[], [assets]);
  
  const propriedadeOptions = useMemo(() => Array.from(new Set(assets.map(a => a.PROPRIEDADE || a.Propriedade || a["PROPRIEDADE"] || (a.__raw && a.__raw[10])).filter(Boolean))).sort() as string[], [assets]);
  const cidadeOptions = useMemo(() => {
    return Array.from(new Set(sanitizedFuelData.map(f => {
      const c = f._cidade || f.COL_25 || f.CIDADE || f.MUNICÍPIO || f.MUNICIPIO || "";
      return String(c).trim().toUpperCase();
    }).filter(c => c && c !== "N/A"))).sort() as string[];
  }, [sanitizedFuelData]);
  const titularidadeOptions = useMemo(() => {
    const dynamic = assets.map(a => a.TITULARIDADE || a["TITULARIDADE"] || (a.__raw && a.__raw[27])).filter(Boolean).map(t => String(t).toUpperCase().trim());
    return Array.from(new Set(["TITULAR", "RESERVA", "N/A", ...dynamic])).filter(Boolean).sort() as string[];
  }, [assets]);

  // Lookup map of telemetry data by plate and month
  const telemetryByPlateAndMonth = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    telemetryHistory.forEach(row => {
      const placa = String(row["Placa"] || row["placa"] || row._placa || row.PLACA || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      if (!placa) return;

      const rawMonth = row["Mês/Ano"] || row["Mês/ano"] || row["mês/ano"] || row._mesAno || row["MÊS/ANO"] || row["MES/ANO"];
      const normalizedMonth = normalizeTelemetryMonthYear(rawMonth);
      const displacement = parseNum(row["Distância (Km)"] || row["Distancia (Km)"] || row["Distância"] || row["Distancia"] || row._deslocamento || row["DESLOCAMENTO_TELEMETRIA"] || row["Deslocamento Telemetria"] || row["DESLOCAMENTO"]);

      if (!map.has(placa)) {
        map.set(placa, {});
      }
      const plateMap = map.get(placa)!;
      plateMap[normalizedMonth] = (plateMap[normalizedMonth] || 0) + displacement;
    });
    return map;
  }, [telemetryHistory]);

  const getTelemetryDisplacementForPlate = (placa: string, months?: string[]): number => {
    const p = String(placa).toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
    const plateMap = telemetryByPlateAndMonth.get(p);
    if (!plateMap) return 0;

    if (months && months.length > 0) {
      return months.reduce((sum: number, m: string) => sum + (plateMap[m] || 0), 0);
    }

    return (Object.values(plateMap) as any[]).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
  };

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
    const groups: Record<string, Record<string, { liters: number, cost: number, count: number, model: string, kms: number, litersByFuel: Record<string, number> }>> = {};
    const driversByTipo: Record<string, Record<string, number>> = {};
    
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
      const kmTrip = f._kmRodados || f.KM_RODADOS || 0;
      
      if (!groups[tipo]) groups[tipo] = {};
      if (!groups[tipo][placa]) {
        groups[tipo][placa] = { liters: 0, cost: 0, count: 0, model, kms: 0, litersByFuel: {} };
      }
      
      groups[tipo][placa].liters += litros;
      groups[tipo][placa].cost += custo;
      groups[tipo][placa].count += 1;
      groups[tipo][placa].kms += kmTrip;

      const rawType = String(f._fuelType || f["TIPO COMBUSTIVEL"] || f["TIPO COMBUSTÍVEL"] || f["PRODUTO"] || "Outros").trim().toUpperCase();
      let stdType = rawType;
      if (rawType.includes("ARLA 32") || rawType.includes("ARLA")) {
        stdType = "Arla 32";
      } else if (rawType.includes("DIESEL S10") || rawType.includes("DIESEL S-10") || rawType.includes("S-10 COMUM") || rawType.includes("S10")) {
        stdType = "DIESEL S-10";
      } else if (rawType.includes("DIESEL COMUM") || rawType.includes("DIESEL S500") || rawType.includes("S500") || (rawType.includes("DIESEL") && !rawType.includes("S10"))) {
        stdType = "DIESEL COMUM";
      } else if (rawType.includes("GASOLINA ADITIVADA")) {
        stdType = "GASOLINA ADIT.";
      } else if (rawType.includes("GASOLINA")) {
        stdType = "GASOLINA COMUM";
      } else if (rawType.includes("ETANOL") || rawType.includes("ALCOOL")) {
        stdType = "ETANOL";
      } else if (rawType.includes("GAS NATURAL") || rawType.includes("GNV")) {
        stdType = "GNV";
      } else {
        stdType = rawType.replace(/_/g, " ");
      }
      groups[tipo][placa].litersByFuel[stdType] = (groups[tipo][placa].litersByFuel[stdType] || 0) + litros;

      // Group drivers by type of active based on Column L (f.COL_11 or _driver)
      const driver = String(f.COL_11 || f._driver || f.CONDUTOR || f["NOME MOTORISTA"] || "").trim().toUpperCase();
      if (driver && driver !== "N/A" && driver !== "NOME MOTORISTA" && driver !== "CONDUTOR" && driver !== "") {
        if (!driversByTipo[tipo]) driversByTipo[tipo] = {};
        driversByTipo[tipo][driver] = (driversByTipo[tipo][driver] || 0) + litros;
      }
    });

    const result: Array<{
      tipo: string;
      placa: string;
      model: string;
      liters: number;
      cost: number;
      count: number;
      kmsTicket: number;
      kmsTelemetry: number;
      diretoria: string;
      gerencia: string;
      driverMaisAbasteceu: string;
      litersByFuel: Record<string, number>;
    }> = [];

    Object.keys(groups).forEach(tipo => {
      let maxPlaca = "";
      let maxStats = { liters: 0, cost: 0, count: 0, model: "N/A", kms: 0, litersByFuel: {} as Record<string, number> };
      
      Object.keys(groups[tipo]).forEach(placa => {
        if (groups[tipo][placa].liters > maxStats.liters) {
          maxPlaca = placa;
          maxStats = groups[tipo][placa];
        }
      });

      if (maxPlaca && maxStats.liters > 0) {
        const asset = assetsByPlaca.get(maxPlaca);
        
        let topDriver = "Sem dados";
        let maxDriverL = 0;
        if (driversByTipo[tipo]) {
          Object.entries(driversByTipo[tipo]).forEach(([dr, totalL]) => {
            if (totalL > maxDriverL) {
              topDriver = dr;
              maxDriverL = totalL;
            }
          });
        }

        result.push({
          tipo,
          placa: maxPlaca,
          model: maxStats.model,
          liters: maxStats.liters,
          cost: maxStats.cost,
          count: maxStats.count,
          kmsTicket: maxStats.kms,
          kmsTelemetry: getTelemetryDisplacementForPlate(maxPlaca, selectedMonthsYears),
          diretoria: asset?.DIRETORIA || asset?.Diretoria || "N/A",
          gerencia: asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || "N/A",
          driverMaisAbasteceu: topDriver,
          litersByFuel: maxStats.litersByFuel || {}
        });
      }
    });

    return result.sort((a, b) => b.liters - a.liters);
  }, [filteredFuel, assetsByPlaca, selectedMonthsYears, getTelemetryDisplacementForPlate]);

  // 2. Top 10 - Consumo por Ativo (Liters and Cost)
  const top10ByAsset = useMemo(() => {
    const map: Record<string, { placa: string; liters: number; cost: number; diretoria: string; gerencia: string; litersByFuel: Record<string, number> }> = {};
    filteredFuel.forEach(f => {
      const placaStr = String(f._placa || "N/A").toUpperCase();
      const placaNorm = placaStr.replace(/[^A-Z0-9]/gi, "").trim();
      const asset = assetsByPlaca.get(placaNorm);
      const diretoria = asset?.DIRETORIA || asset?.Diretoria || "N/A";
      const gerencia = asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || "N/A";

      if (!map[placaStr]) {
        map[placaStr] = { 
          placa: placaStr, 
          liters: 0, 
          cost: 0, 
          diretoria, 
          gerencia,
          litersByFuel: {}
        };
      }
      map[placaStr].liters += f._litros || 0;
      map[placaStr].cost += f._total || 0;

      const rawType = String(f._fuelType || "Outros").trim().toUpperCase();
      let stdType = rawType;
      if (rawType.includes("ARLA 32") || rawType.includes("ARLA")) {
        stdType = "Arla 32";
      } else if (rawType.includes("DIESEL S10") || rawType.includes("DIESEL S-10") || rawType.includes("S-10 COMUM") || rawType.includes("S10")) {
        stdType = "DIESEL S-10";
      } else if (rawType.includes("DIESEL COMUM") || rawType.includes("DIESEL S500") || rawType.includes("S500") || (rawType.includes("DIESEL") && !rawType.includes("S10"))) {
        stdType = "DIESEL COMUM";
      } else if (rawType.includes("GASOLINA ADITIVADA")) {
        stdType = "GASOLINA ADIT.";
      } else if (rawType.includes("GASOLINA")) {
        stdType = "GASOLINA COMUM";
      } else if (rawType.includes("ETANOL") || rawType.includes("ALCOOL")) {
        stdType = "ETANOL";
      } else if (rawType.includes("GAS NATURAL") || rawType.includes("GNV")) {
        stdType = "GNV";
      } else {
        stdType = rawType.replace(/_/g, " ");
      }
      map[placaStr].litersByFuel[stdType] = (map[placaStr].litersByFuel[stdType] || 0) + (f._litros || 0);
    });
    return Object.values(map).sort((a, b) => b.liters - a.liters).slice(0, 10);
  }, [filteredFuel, assetsByPlaca]);

  const top10ByAssetSorted = useMemo(() => {
    const map: Record<string, { placa: string; liters: number; cost: number; diretoria: string; gerencia: string; litersByFuel: Record<string, number> }> = {};
    filteredFuel.forEach(f => {
      const placaStr = String(f._placa || "N/A").toUpperCase();
      const placaNorm = placaStr.replace(/[^A-Z0-9]/gi, "").trim();
      const asset = assetsByPlaca.get(placaNorm);
      const diretoria = asset?.DIRETORIA || asset?.Diretoria || "N/A";
      const gerencia = asset?.GERENCIA || asset?.["GER\u00CANCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || "N/A";

      if (!map[placaStr]) {
        map[placaStr] = { 
          placa: placaStr, 
          liters: 0, 
          cost: 0, 
          diretoria, 
          gerencia,
          litersByFuel: {}
        };
      }
      map[placaStr].liters += f._litros || 0;
      map[placaStr].cost += f._total || 0;

      const rawType = String(f._fuelType || "Outros").trim().toUpperCase();
      let stdType = rawType;
      if (rawType.includes("ARLA 32") || rawType.includes("ARLA")) {
        stdType = "Arla 32";
      } else if (rawType.includes("DIESEL S10") || rawType.includes("DIESEL S-10") || rawType.includes("S-10 COMUM") || rawType.includes("S10")) {
        stdType = "DIESEL S-10";
      } else if (rawType.includes("DIESEL COMUM") || rawType.includes("DIESEL S500") || rawType.includes("S500") || (rawType.includes("DIESEL") && !rawType.includes("S10"))) {
        stdType = "DIESEL COMUM";
      } else if (rawType.includes("GASOLINA ADITIVADA")) {
        stdType = "GASOLINA ADIT.";
      } else if (rawType.includes("GASOLINA")) {
        stdType = "GASOLINA COMUM";
      } else if (rawType.includes("ETANOL") || rawType.includes("ALCOOL")) {
        stdType = "ETANOL";
      } else if (rawType.includes("GAS NATURAL") || rawType.includes("GNV")) {
        stdType = "GNV";
      } else {
        stdType = rawType.replace(/_/g, " ");
      }
      map[placaStr].litersByFuel[stdType] = (map[placaStr].litersByFuel[stdType] || 0) + (f._litros || 0);
    });
    const list = Object.values(map);
    if (assetChartMetric === "liters") {
      return [...list].sort((a, b) => b.liters - a.liters).slice(0, 10);
    } else {
      return [...list].sort((a, b) => b.cost - a.cost).slice(0, 10);
    }
  }, [filteredFuel, assetsByPlaca, assetChartMetric]);

  // 3. Top 10 - Custo por Unidade (Gerência)
  const top10ByUnit = useMemo(() => {
    const map: Record<string, { unit: string; cost: number; vehicles: Set<string> }> = {};
    filteredFuel.forEach(f => {
      const placa = (f._placa || f.PLACA || f.COL_5 || "").toString().toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const asset = assetsByPlaca.get(placa);
      if (!asset) return; // Correlacionados com o cadastro geral de ativos

      const controleAuto = String(asset?.["CONTROLE DE AUTONOMIA"] || asset?.["CONTROLE AUTONOMIA"] || asset?.["TIPO CONTROLE AUTONOMIA"] || (f as any).COL_43 || "").toUpperCase().trim();
      if (controleAuto !== "FROTA" && controleAuto !== "") return; // Filtrados pela coluna de tipo de controle de autonomia correspondente a "FROTA"

      const unit = asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.Gerencia || "N/A";
      if (!unit) return;
      if (!map[unit]) map[unit] = { unit, cost: 0, vehicles: new Set<string>() };
      map[unit].cost += f._total || 0;
      if (placa && placa !== "N/A" && placa !== "") {
        map[unit].vehicles.add(placa);
      }
    });
    return Object.values(map)
      .map(item => ({
        unit: item.unit,
        cost: item.cost,
        numVehicles: item.vehicles.size
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [filteredFuel, assetsByPlaca]);

  // 4. Top 10 - Veículos Há Mais Tempo Sem Abastecer
  const longTimeNoFuel = useMemo(() => {
    const lastFueling: Record<string, Date> = {};
    
    // Compile last fueling dates from matching filtered fuel transactions
    filteredFuel.forEach(f => {
      const placa = (f._placa || f.PLACA || "").toString().replace(/[^A-Z0-9]/gi, "").toUpperCase().trim();
      const date = f._dateParsed;
      if (placa && date) {
        if (!lastFueling[placa] || date > lastFueling[placa]) {
          lastFueling[placa] = date;
        }
      }
    });

    const activeFuelFilters = selectedFuelTypes.length > 0 || selectedCidades.length > 0 || selectedMonthsYears.length > 0 || dateFrom !== undefined || dateTo !== undefined || selectedTipoControleAutonomia.length > 0;

    const now = new Date();
    return assets
      .filter(a => {
        const statusOp = String(a.STATUS_OPERACIONAL || a["STATUS OPERACIONAL"] || "").toUpperCase().trim();
        if (statusOp !== 'OPERACIONAL' && statusOp !== 'ATIVO') return false;

        const placaRaw = String(a.PLACA || a.placa || "").toUpperCase();
        const placaNormalized = placaRaw.replace(/[^A-Z0-9]/gi, "");
        
        // If fuel/transaction filters are active, only show assets that are present in the filtered transactions
        if (activeFuelFilters && !lastFueling[placaNormalized]) {
          return false;
        }

        const model = String(a.MODELO || a.Modelo || "N/A").trim();
        const diretoria = String(a.DIRETORIA || a.Diretoria || "N/A").trim();
        const gerencia = String(a.GERENCIA || a["GERÊNCIA"] || a.Gerencia || "N/A").trim();
        const tipo = String(a.TIPO || a.Type || a.Tipo || "N/A").trim();
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
          titularidade: asset?.TITULARIDADE || (asset as any)?.COL_27 || "N/A",
          gerencia: asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.["GERENCIA"] || asset?.Gerencia || "N/A"
        };
      }).sort((a, b) => b.days - a.days).slice(0, 10);
  }, [filteredFuel, assets, assetsByPlaca, searchPlaca, selectedDirectorias, selectedGerencias, selectedTipos, selectedVehicleModels, selectedPropriedades, selectedTitularidades, selectedFuelTypes, selectedCidades, selectedMonthsYears, dateFrom, dateTo, selectedTipoControleAutonomia]);

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
          titularidade: a["TITULARIDADE"] || (a as any).COL_27 || "N/A",
          gerencia: a.GERENCIA || a["GERÊNCIA"] || a["GERENCIA"] || a.Gerencia || "N/A"
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

  // 6.2. Consumo por Localização (Cidades, Bairros e Estabelecimentos)
  const top10ByLocation = useMemo(() => {
    const map: Record<string, { 
      name: string; 
      liters: number; 
      cost: number; 
      cidade: string; 
      bairro: string; 
    }> = {};

    filteredFuel.forEach(f => {
      let key = "N/A";
      const cidade = String(f._cidade || f.COL_25 || f.CIDADE || f.MUNICÍPIO || f.MUNICIPIO || "N/A").trim();
      const bairro = String(f._bairro || f.COL_24 || f.BAIRRO || "N/A").trim();
      const posto = String(f._posto || f._establishment || f.COL_21 || f.POSTO || "N/A").trim();

      if (locationChartTab === "city") {
        key = cidade;
      } else if (locationChartTab === "bairro") {
        key = bairro;
      } else {
        key = posto;
      }

      if (!key || key.toUpperCase() === "N/A" || key === "") {
        key = "N/A";
      }

      if (!map[key]) {
        map[key] = {
          name: key,
          liters: 0,
          cost: 0,
          cidade: cidade,
          bairro: bairro
        };
      }

      map[key].liters += f._litros || 0;
      map[key].cost += f._total || 0;
    });

    const list = Object.values(map).filter(item => item.name !== "N/A" && item.name !== "");
    
    if (locationChartMetric === "liters") {
      return [...list].sort((a, b) => b.liters - a.liters).slice(0, 10);
    } else {
      return [...list].sort((a, b) => b.cost - a.cost).slice(0, 10);
    }
  }, [filteredFuel, locationChartTab, locationChartMetric]);

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

  // Top Condutores (por Litros e por Custo)
  const topDriversData = useMemo(() => {
    const map: Record<string, { name: string; liters: number; cost: number; count: number; diretoria: string; gerencia: string }> = {};
    filteredFuel.forEach(f => {
      const name = String(f.COL_11 || f._driver || f.CONDUTOR || f["NOME MOTORISTA"] || "").trim().toUpperCase();
      if (!name || name === "N/A" || name === "NOME MOTORISTA" || name === "CONDUTOR" || name === "NULL" || name === "UNDEFINED" || name === "") return;

      const liters = f._litros || 0;
      const cost = f._total || 0;

      const placa = String(f._placa || "").toUpperCase();
      const asset = assetsByPlaca.get(placa);
      const diretoria = String(f.COL_28 || asset?.DIRETORIA || asset?.Diretoria || "").trim();
      const gerencia = String(f.COL_29 || asset?.GERENCIA || asset?.["GERÊNCIA"] || asset?.Gerencia || "").trim();

      if (!map[name]) {
        map[name] = { name, liters: 0, cost: 0, count: 0, diretoria: "", gerencia: "" };
      }
      map[name].liters += liters;
      map[name].cost += cost;
      map[name].count += 1;
      
      if (diretoria && (!map[name].diretoria || map[name].diretoria === "N/A")) {
        map[name].diretoria = diretoria;
      }
      if (gerencia && (!map[name].gerencia || map[name].gerencia === "N/A")) {
        map[name].gerencia = gerencia;
      }
    });

    const list = Object.values(map);
    return {
      byLiters: [...list].sort((a, b) => b.liters - a.liters).slice(0, 10),
      byCost: [...list].sort((a, b) => b.cost - a.cost).slice(0, 10)
    };
  }, [filteredFuel, assetsByPlaca]);

  // 8. Tabela de Detalhamento por Veículo Abas como resumo por veículo(Placa, Tipo, Modelo, Titularidade, Ano, Mês 1, Mês 2, Mês 3, Último Odômetro)
 const displayMonths = useMemo(() => {
  // Usar todos os meses do range selecionado, não apenas os últimos 6 COMO ERA FEITO ANTES
  if (monthYearOptions.length > 0) {
    // Se há filtro de datas, usar apenas meses dentro do filtro
    if (selectedMonthsYears.length > 0) {
      return selectedMonthsYears.sort((a, b) => parseMonthYear(a).getTime() - parseMonthYear(b).getTime());
    }
    // Caso contrário, usar todos os meses disponíveis (não limitar a 6)
    return monthYearOptions;
  }
  return [];
}, [monthYearOptions, selectedMonthsYears]);


  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const chartsContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(1500);

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

      const topTipoBody = topConsumidoresPorTipo.map(item => {
        let volStr = `${item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
        if (item.litersByFuel && Object.keys(item.litersByFuel).length > 0) {
          const parts = Object.entries(item.litersByFuel).map(([k, v]) => `${k}: ${(v as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L`);
          volStr += `\n(${parts.join(' / ')})`;
        }
        return [
          item.tipo,
          item.placa,
          item.model,
          item.diretoria,
          item.gerencia,
          item.driverMaisAbasteceu || "Sem dados",
          `${item.count} abast.`,
          item.kmsTicket > 0 ? `${item.kmsTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : "-",
          item.kmsTelemetry > 0 ? `${item.kmsTelemetry.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : "-",
          volStr,
          `R$ ${item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        ];
      });

      autoTable(doc, {
        startY: 30,
        theme: "grid",
        head: [["Tipo de Ativo", "Placa", "Modelo", "Diretoria", "Gerência", "Condutor Principal", "Abast.", "Desloc. Ticket", "Desloc. Telem.", "Vol. Abastecido", "Custo Total"]],
        body: topTipoBody,
        headStyles: { fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 5.5 }, // slightly smaller font to fit additional columns beautifully in landscape/portrait
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

      const top10Body = top10ByAsset.map((item, idx) => {
        let volStr = `${item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
        if (item.litersByFuel && Object.keys(item.litersByFuel).length > 0) {
          const parts = Object.entries(item.litersByFuel).map(([k, v]) => `${k}: ${(v as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L`);
          volStr += `\n(${parts.join(' / ')})`;
        }
        return [
          `#${idx + 1}`,
          item.placa,
          item.diretoria || "N/A",
          item.gerencia || "N/A",
          volStr,
          `R$ ${item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: 30,
        theme: "striped",
        head: [["Posição", "Placa do Ativo", "Diretoria", "Gerência", "Total de Volume", "Investimento Total"]],
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
        String((item as any).numVehicles || 0),
        `R$ ${item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: finalY + 16,
        theme: "striped",
        head: [["Posição", "Unidade / Gerência", "Qtd Veículos (Placa)", "Despesa Total"]],
        body: topUnitBody,
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8.5 },
      });

      // Page 4: Consolidated comparative data (YoY and Fuel Type) as requested
      doc.addPage();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("COMPESA - DADOS CONSOLIDADOS DOS DEMONSTRATIVOS", 14, 10);

      // Section A: Comparação Mês a Mês Ano a Ano
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Comparativo Mensal de Abastecimentos: ${compYearA} vs ${compYearB}`, 14, 25);

      const compBody = comparativeData.map(item => [
        item.monthFullName,
        `${item.litersA.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
        `R$ ${item.costA.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${item.litersB.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
        `R$ ${item.costB.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: 30,
        theme: "grid",
        head: [[
          "Mês", 
          `Volume ${compYearA}`, 
          `Custo ${compYearA}`, 
          `Volume ${compYearB}`, 
          `Custo ${compYearB}`
        ]],
        body: compBody,
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8, cellPadding: 2 },
        didParseCell: (data) => {
          if (data.row.section === 'body') {
            const firstCellText = data.row.raw && (data.row.raw as any)[0];
            if (firstCellText === 'Julho') {
              data.cell.styles.textColor = [220, 38, 38]; // Dynamic red color for Julho (Current Month)
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      const finalYPage4 = (doc as any).lastAutoTable.finalY || 135;

      // Section B: Consumo por Tipo de Combustível
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Consumo Consolidado por Tipo de Combustível", 14, finalYPage4 + 10);

      const fuelTypeBody = fuelTypeConsumptionData.map(item => {
        const avg = item.liters > 0 ? (item.cost / item.liters) : 0;
        return [
          item.type,
          `${item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
          `R$ ${item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
        ];
      });

      autoTable(doc, {
        startY: finalYPage4 + 14,
        theme: "grid",
        head: [["Tipo de Combustível", "Volume Abastecido", "Custo Total", "Preço Médio / Litro"]],
        body: fuelTypeBody,
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
      });

      // Page 5: Dedicated Page for Drivers ranking
      doc.addPage();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("COMPESA - RANKING DE CONDUTORES (TOP 10)", 14, 10);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.text("Os 10 Condutores com Maior Consumo e Investimento", 14, 25);

      const driversBody = topDriversData.byLiters.map((item, idx) => [
        `#${idx + 1}`,
        item.name,
        item.diretoria || "Não Especificada",
        item.gerencia || "Não Especificada",
        `${item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
        `R$ ${item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${item.count} abast.`
      ]);

      autoTable(doc, {
        startY: 30,
        theme: "striped",
        head: [[
          "Posição", 
          "Nome do Condutor (Coluna L)", 
          "Diretoria (Col. AC)", 
          "Gerência (Col. AD)", 
          "Volume (Litros - Coluna O)", 
          "Custo Total (R$ - Coluna T)", 
          "Qtd de Abastecimentos"
        ]],
        body: driversBody,
        headStyles: { fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 8.0, cellPadding: 2.0 },
      });

      // Page 6: Landscape - Resumo de Abastecimento por Veículo Mês a Mês
      doc.addPage("a4", "l");
      const pageWidthL = doc.internal.pageSize.getWidth();
      
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidthL, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("COMPESA - RESUMO DE ABASTECIMENTO POR VEÍCULO", 14, 10);
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.text("Histórico Analítico Mensal de Desempenho por Ativo (Volume, Custo, Km Ticket e Telemetria)", 14, 25);

      const vehicleSummaryHeaders = [
        "Placa", 
        "Diretoria", 
        "Gerência", 
        "Tipo", 
        "Modelo", 
        "Titularidade", 
        "Últ. Odo.", 
        ...displayMonths.map(m => formatMonthLabel(m)),
        "Total Período"
      ];

      const vehicleSummaryBody = vehicleSummaryData.map(row => {
        const totalLines = [];
        if (row.totalTicketKms > 0) totalLines.push(`${row.totalTicketKms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km(Tkt)`);
        if (row.totalTelemetryKms > 0) totalLines.push(`${row.totalTelemetryKms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km(Tel)`);
        
        if (row.totalFuelLiters > 0 || row.totalArlaLiters > 0) {
          let litStr = "";
          if (row.totalFuelLiters > 0) {
            litStr += `${row.totalFuelLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L (Comb)`;
          }
          if (row.totalArlaLiters > 0) {
            if (litStr) litStr += "\n";
            litStr += `${row.totalArlaLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L (Arla)`;
          }
          totalLines.push(litStr);
        }
        if (row.totalCost > 0) totalLines.push(`R$ ${row.totalCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);

        return [
          row.placa,
          row.diretoria,
          row.gerencia,
          row.tipo,
          row.modelo,
          row.titularidade,
          row.lastOdo > 0 ? row.lastOdo.toLocaleString('pt-BR') : "-",
          ...displayMonths.map(m => {
            const stats = row.monthStats?.[m] || { kms: 0, telemetryKms: 0, liters: 0, cost: 0, litersByFuel: {} };
            const lines = [];
            if (stats.kms > 0) lines.push(`${stats.kms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km(Tkt)`);
            if (stats.telemetryKms > 0) lines.push(`${stats.telemetryKms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km(Tel)`);
            if (stats.liters > 0) {
              let litStr = `${stats.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
              if (stats.litersByFuel && Object.keys(stats.litersByFuel).length > 0) {
                const parts = Object.entries(stats.litersByFuel).map(([k, v]) => `${k}: ${(v as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L`);
                litStr += `\n(${parts.join(' / ')})`;
              }
              lines.push(litStr);
            }
            if (stats.cost > 0) lines.push(`R$ ${stats.cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);
            return lines.join("\n") || "-";
          }),
          totalLines.join("\n") || "-"
        ];
      });

      const colStyles: any = {
        0: { fontStyle: 'bold', halign: 'center' }, // Placa
        1: { halign: 'left' }, // Diretoria
        2: { halign: 'left' }, // Gerencia
        3: { halign: 'center' }, // Tipo
        4: { halign: 'left' }, // Modelo
        5: { halign: 'center' }, // Titularidade
      };
      colStyles[7 + displayMonths.length] = { fontStyle: 'bold', fillColor: [240, 244, 255], halign: 'center' }; // Slate-blue tint for Period Totals

      autoTable(doc, {
        startY: 30,
        theme: "grid",
        head: [vehicleSummaryHeaders],
        body: vehicleSummaryBody,
        headStyles: { fillColor: [51, 65, 85], halign: 'center', valign: 'middle', fontSize: 7 },
        styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
        columnStyles: colStyles
      });

      // Page 7: Visual charts fallback image handler (back to portrait)
      if (chartsContainerRef.current) {
        try {
          const canvas = await html2canvas(chartsContainerRef.current, {
            scale: 1.2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
          });

          doc.addPage("a4", "p");
          
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
    if (tableContainerRef.current && tableContainerRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
      tableContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (topScrollRef.current && topScrollRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
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
        
        // Correlated with general asset register
        const asset = assetsByPlaca.get(placa);
        if (!asset) return false;

        // Tipo de controle de autonomia (para corresponder a "FROTA")
        const controleAuto = String(asset["CONTROLE DE AUTONOMIA"] || asset["CONTROLE AUTONOMIA"] || asset["TIPO CONTROLE AUTONOMIA"] || "").toUpperCase().trim();
        if (controleAuto !== "FROTA" && controleAuto !== "") return false;
        
        // Frotal Operacional Filter: Strict OPERACIONAL as requested
        const statusOp = String(asset.STATUS_OPERACIONAL || "").toUpperCase().trim();
        if (statusOp !== 'OPERACIONAL') return false;

        // Metadata filters
        const gerencia = String(asset.GERENCIA || asset["GERÊNCIA"] || asset["GERENCIA"] || asset.Gerencia || "N/A").trim();
        const diretoria = String(asset.DIRETORIA || asset.Diretoria || "N/A").trim();
        const modelo = String(asset.MODELO || asset.Modelo || "N/A").trim();
        const comb = String(asset["COMBUSTÍVEL"] || asset["COMBUSTIVEL"] || "N/A").trim();
        const tipo = String(asset["TIPO"] || asset["TIPO VEICULO"] || "N/A").trim();

        if (searchPlaca && !placa.includes(searchPlaca.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim())) return false;
        if (selectedGerencias.length > 0 && !selectedGerencias.map(g => String(g).trim()).includes(gerencia)) return false;
        if (selectedDirectorias.length > 0 && !selectedDirectorias.map(d => String(d).trim()).includes(diretoria)) return false;
        if (selectedVehicleModels.length > 0 && !selectedVehicleModels.map(m => String(m).trim()).includes(modelo)) return false;
        if (selectedFuelTypes.length > 0 && !selectedFuelTypes.map(f => String(f).trim()).includes(comb)) return false;
        if (selectedTipos.length > 0 && !selectedTipos.map(t => String(t).trim()).includes(tipo)) return false;
        if (selectedTipoControleAutonomia.length > 0 && !selectedTipoControleAutonomia.map(c => String(c).trim().toUpperCase()).includes(controleAuto)) return false;

        // Ensure this row has data in the CURRENT filtered set
        return platesInFilteredFuel.has(placa);
      })
      .map(a => {
        const placa = String(a.PLACA || a.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
        const assetFuel = platesInFuelWithoutDate.get(placa) || [];
        
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

        // Calculate stats for each month
        const monthStats: Record<string, { kms: number, telemetryKms: number, liters: number, cost: number, litersByFuel: Record<string, number> }> = {};
        displayMonths.forEach(m => {
          const mTransactions = assetFuel.filter(f => String(f._monthYear || "").trim() === String(m).trim());
          const kms = mTransactions.reduce((sum, f) => sum + (f._kmRodados || f.KM_RODADOS || 0), 0);
          const liters = mTransactions.reduce((sum, f) => sum + (f._litros || 0), 0);
          const cost = mTransactions.reduce((sum, f) => sum + (f._total || 0), 0);

          const litersByFuel: Record<string, number> = {};
          mTransactions.forEach(f => {
            const rawType = String(f._fuelType || f["TIPO COMBUSTIVEL"] || f["TIPO COMBUSTÍVEL"] || f["PRODUTO"] || "Outros").trim().toUpperCase();
            let stdType = rawType;
            if (rawType.includes("ARLA 32") || rawType.includes("ARLA")) {
              stdType = "Arla 32";
            } else if (rawType.includes("DIESEL S10") || rawType.includes("DIESEL S-10") || rawType.includes("S-10 COMUM") || rawType.includes("S10")) {
              stdType = "DIESEL S-10";
            } else if (rawType.includes("DIESEL COMUM") || rawType.includes("DIESEL S500") || rawType.includes("S500") || (rawType.includes("DIESEL") && !rawType.includes("S10"))) {
              stdType = "DIESEL COMUM";
            } else if (rawType.includes("GASOLINA ADITIVADA")) {
              stdType = "GASOLINA ADIT.";
            } else if (rawType.includes("GASOLINA")) {
              stdType = "GASOLINA COMUM";
            } else if (rawType.includes("ETANOL") || rawType.includes("ALCOOL")) {
              stdType = "ETANOL";
            } else if (rawType.includes("GAS NATURAL") || rawType.includes("GNV")) {
              stdType = "GNV";
            } else {
              stdType = rawType.replace(/_/g, " ");
            }
            litersByFuel[stdType] = (litersByFuel[stdType] || 0) + (f._litros || 0);
          });

          // Fetch telemetry kms for this month 'm' and plate 'placa'
          const p = String(placa).toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
          const plateMap = telemetryByPlateAndMonth.get(p);
          const telemetryKms = plateMap ? (plateMap[m] || 0) : 0;

          monthStats[m] = { kms, telemetryKms, liters, cost, litersByFuel };
        });

        const lastMonth = displayMonths.length > 0 ? displayMonths[displayMonths.length - 1] : "";
        const currentMonthStats = lastMonth 
          ? (monthStats[lastMonth] || { kms: 0, telemetryKms: 0, liters: 0, cost: 0, litersByFuel: {} }) 
          : { kms: 0, telemetryKms: 0, liters: 0, cost: 0, litersByFuel: {} };

        // Calculate totals across all displayMonths (the filtered months)
        let totalFuelLiters = 0;
        let totalArlaLiters = 0;
        let totalTicketKms = 0;
        let totalTelemetryKms = 0;
        let totalCost = 0;

        displayMonths.forEach(m => {
          const stats = monthStats[m] || { kms: 0, telemetryKms: 0, liters: 0, cost: 0, litersByFuel: {} };
          totalTicketKms += stats.kms;
          totalTelemetryKms += stats.telemetryKms;
          totalCost += stats.cost;
          if (stats.litersByFuel) {
            Object.entries(stats.litersByFuel).forEach(([fType, fLiters]) => {
              if (fType === "Arla 32") {
                totalArlaLiters += (fLiters as number);
              } else {
                totalFuelLiters += (fLiters as number);
              }
            });
          }
        });

        return {
          ...a,
          placa,
          tipo: a.TIPO || a.Tipo || (a as any).COL_16 || "N/A",
          modelo: a.MODELO || a.Modelo || "N/A",
          titularidade: a.TITULARIDADE || (a as any).COL_27 || "N/A",
          ano: a.ANO || (a as any).COL_8 || "N/A",
          diretoria: a.DIRETORIA || a.Diretoria || (a as any).COL_3 || "N/A",
          gerencia: a.GERENCIA || a["GERÊNCIA"] || a["GERENCIA"] || a.Gerencia || (a as any).COL_4 || "N/A",
          monthStats,
          currentMonthLiters: currentMonthStats.liters,
          currentMonthLitersByFuel: currentMonthStats.litersByFuel || {},
          currentMonthCost: currentMonthStats.cost,
          lastOdo,
          totalFuelLiters,
          totalArlaLiters,
          totalTicketKms,
          totalTelemetryKms,
          totalCost
        };
      });
  }, [assets, fuel, filteredFuel, platesInFuelWithoutDate, displayMonths, searchPlaca, selectedGerencias, selectedDirectorias, selectedFuelTypes, selectedVehicleModels, selectedTipos, selectedTipoControleAutonomia, selectedMonthsYears, telemetryByPlateAndMonth]);

  React.useEffect(() => {
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };

    // Run layout measurements
    updateWidth();
    window.addEventListener("resize", updateWidth);

    // Dynamic observer for content shifts
    const observer = new ResizeObserver(updateWidth);
    if (tableContainerRef.current) {
      observer.observe(tableContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateWidth);
      observer.disconnect();
    };
  }, [vehicleSummaryData]);

  const ChartEmptyState = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
      <Droplets size={40} className="opacity-20 animate-pulse" />
      <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      <span className="text-[8px] font-bold uppercase tracking-tighter opacity-50">Sem dados para os filtros selecionados</span>
    </div>
  );

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
        "Diretoria": row.diretoria || "N/A",
        "Gerência": row.gerencia || "N/A",
        "Tipo": row.tipo,
        "Modelo": row.modelo,
        "Titularidade": row.titularidade,
        "Ano": row.ano,
        "Último Odômetro": row.lastOdo,
      };
      displayMonths.forEach(m => {
        const stats = row.monthStats?.[m] || { kms: 0, telemetryKms: 0, liters: 0, cost: 0, litersByFuel: {} };
        item[`Km Ticket ${formatMonthLabel(m)}`] = stats.kms;
        item[`Km Telemetria ${formatMonthLabel(m)}`] = stats.telemetryKms;
        item[`L ${formatMonthLabel(m)}`] = stats.liters;
        if (stats.litersByFuel && Object.keys(stats.litersByFuel).length > 0) {
          item[`Detalhamento L ${formatMonthLabel(m)}`] = Object.entries(stats.litersByFuel)
            .map(([k, v]) => `${k}: ${(v as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L`)
            .join(' / ');
        } else {
          item[`Detalhamento L ${formatMonthLabel(m)}`] = "";
        }
        item[`Custo R$ ${formatMonthLabel(m)}`] = stats.cost;
      });
      // Add Totals for the filtered period
      item[`Km Ticket Total`] = row.totalTicketKms;
      item[`Km Telemetria Total`] = row.totalTelemetryKms;
      item[`Volume Total Combustível (L)`] = row.totalFuelLiters;
      item[`Volume Total Arla 32 (L)`] = row.totalArlaLiters;
      item[`Custo Total (R$)`] = row.totalCost;
      return item;
    });

    exportToExcelMultiSheet([
      { data: mainData, sheetName: "Abastecimentos Filtrados" },
      { data: summaryData, sheetName: "Resumo por Veículo" }
    ], "Relatorio_Fuel_Dashboard");
  };

  const activeDriversData = driverChartMetric === "liters" ? topDriversData.byLiters : topDriversData.byCost;

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
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 py-2.5">Tipo de Ativo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-center py-2.5">Placa</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 py-2.5">Modelo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 py-2.5">Diretoria</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 py-2.5">Gerência</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-500 py-2.5">Condutor que Mais Abasteceu</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-center py-2.5">Abastecimentos</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-right py-2.5">Desloc. Ticket</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-right py-2.5">Desloc. Telemetria</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-right py-2.5">Litros</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-right py-2.5">Custo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topConsumidoresPorTipo.map((item) => (
                    <TableRow key={item.tipo} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      <TableCell className="font-semibold text-xs py-2 text-slate-800 dark:text-slate-200 max-w-[150px] truncate" title={item.tipo}>
                        {item.tipo}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-center py-2 font-mono text-slate-900 dark:text-slate-100">
                        {item.placa}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 py-2 truncate max-w-[160px]" title={item.model}>
                        {item.model}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-semibold whitespace-nowrap">
                          {item.diretoria}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 max-w-[180px] truncate" title={item.gerencia}>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-semibold">
                          {item.gerencia}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 max-w-[180px] truncate text-xs font-bold text-indigo-600 dark:text-indigo-400" title={item.driverMaisAbasteceu}>
                        {item.driverMaisAbasteceu}
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900 font-bold text-[11px] px-2 py-0">
                          {item.count} abast.
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono text-xs text-slate-600 py-2">
                        {item.kmsTicket > 0 ? `${item.kmsTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono text-xs text-indigo-600 py-2">
                        {item.kmsTelemetry > 0 ? `${item.kmsTelemetry.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono text-xs text-blue-600 py-2">
                        <div className="flex flex-col items-end justify-center">
                          <span>{item.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</span>
                          {item.litersByFuel && Object.keys(item.litersByFuel).length > 0 && (
                            <div className="text-[7.5px] font-mono leading-none tracking-tighter flex flex-col items-end ml-1 space-y-0.5 text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-1 rounded max-w-[130px]">
                              {Object.entries(item.litersByFuel).map(([fType, fLiters]) => (
                                <span key={fType}>
                                  {fType}: <span className="font-bold text-blue-500">{(fLiters as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black font-mono text-xs text-emerald-600 py-2">
                        R$ {item.cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Dashboard: Consumo por Tipo de Combustível */}
        <ChartCard 
          title="Consumo por Tipo de Combustível" 
          description="Volume em litros (coluna O) contra o custo total em reais (coluna T) por tipo"
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

        {/* Dashboard: Condutores que mais Abastecem */}
        <ChartCard 
          title="Top 10 - Condutores que mais Abastecem" 
          description={`Classificação por ${driverChartMetric === "liters" ? "Volume (Litros - Coluna O)" : "Custo Total (Reais - Coluna T)"}`}
          className="min-h-[380px]"
          headerAction={
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/50 dark:border-slate-700/50" id="driver-metric-toggle-container">
              <button
                id="btn-metric-liters-toggle"
                onClick={() => setDriverChartMetric("liters")}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                  driverChartMetric === "liters"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                LITROS
              </button>
              <button
                id="btn-metric-cost-toggle"
                onClick={() => setDriverChartMetric("cost")}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                  driverChartMetric === "cost"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                CUSTO (R$)
              </button>
            </div>
          }
        >
          {activeDriversData.length === 0 ? (
            <ChartEmptyState title="Dados de Condutores" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={activeDriversData} 
                layout="vertical" 
                margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={130} 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={8} 
                  className="font-bold text-slate-600 dark:text-slate-400 truncate"
                  tickFormatter={(val) => val.length > 20 ? `${val.substring(0, 18)}...` : val}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(val: number) => {
                    if (driverChartMetric === "liters") {
                      return [`${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`, "Volume"];
                    } else {
                      return [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Custo"];
                    }
                  }}
                />
                <Bar 
                  dataKey={driverChartMetric === "liters" ? "liters" : "cost"} 
                  name={driverChartMetric === "liters" ? "Volume (L)" : "Custo (R$)"}
                  fill={driverChartMetric === "liters" ? "#3b82f6" : "#10b981"} 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                >
                  {activeDriversData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={driverChartMetric === "liters" ? "#3b82f6" : "#10b981"} fillOpacity={1 - index * 0.05} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Dashboard: Veículos que mais Abastecem */}
        <ChartCard 
          title="Top 10 - Veículos que mais Abastecem" 
          description={`Classificação por ${assetChartMetric === "liters" ? "Volume (Litros - Coluna O)" : "Custo Total (Reais - Coluna T)"}`}
          className="min-h-[380px]"
          headerAction={
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/50 dark:border-slate-700/50" id="asset-metric-toggle-container">
              <button
                id="btn-asset-metric-liters"
                onClick={() => setAssetChartMetric("liters")}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                  assetChartMetric === "liters"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                LITROS
              </button>
              <button
                id="btn-asset-metric-cost"
                onClick={() => setAssetChartMetric("cost")}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                  assetChartMetric === "cost"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                CUSTO (R$)
              </button>
            </div>
          }
        >
          {top10ByAssetSorted.length === 0 ? (
            <ChartEmptyState title="Dados de Veículos" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={top10ByAssetSorted} 
                layout="vertical" 
                margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="placa" 
                  type="category" 
                  width={90} 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={10} 
                  className="font-bold text-slate-600 dark:text-slate-400"
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(val: number) => {
                    if (assetChartMetric === "liters") {
                      return [`${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`, "Volume"];
                    } else {
                      return [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Custo"];
                    }
                  }}
                />
                <Bar 
                  dataKey={assetChartMetric === "liters" ? "liters" : "cost"} 
                  name={assetChartMetric === "liters" ? "Volume (L)" : "Custo (R$)"}
                  fill={assetChartMetric === "liters" ? "#3b82f6" : "#10b981"} 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                >
                  {top10ByAssetSorted.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={assetChartMetric === "liters" ? "#3b82f6" : "#10b981"} fillOpacity={1 - index * 0.05} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Dashboard: Top 10 - Gerências por Custo */}
        <ChartCard title="Top 10 - Gerências por Custo" description="Unidades com maiores gastos (R$)" className="min-h-[380px]">
          {top10ByUnit.length === 0 ? (
            <ChartEmptyState title="Gastos por Gerência" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={top10ByUnit} layout="vertical" margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                <XAxis type="number" hide />
                <YAxis dataKey="unit" type="category" width={140} axisLine={false} tickLine={false} fontSize={9} className="font-bold text-slate-600 dark:text-slate-400" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} 
                />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {top10ByUnit.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SHADES_OF_BLUE[index % SHADES_OF_BLUE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Dashboard: Custo por Tipo de Ativo (Top 10) */}
        <ChartCard title="Custo por Tipo de Ativo (Top 10)" description="Maiores gastos por categoria" className="min-h-[380px]">
          {costByType.length === 0 ? (
            <ChartEmptyState title="Custo por Tipo" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={costByType.slice(0, 10)} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} className="font-bold text-slate-600" />
                <YAxis axisLine={false} tickLine={false} fontSize={10} />
                <Tooltip 
                  cursor={{fill: 'rgba(59, 130, 246, 0.05)'}} 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} 
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={45}>
                  {costByType.slice(0, 10).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SHADES_OF_BLUE[index % SHADES_OF_BLUE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Dashboard: Consumo por Localização (Cidades, Bairros e Estabelecimentos) */}
        <ChartCard 
          title={`Top 10 - Consumo por ${locationChartTab === "city" ? "Cidade" : locationChartTab === "bairro" ? "Bairro" : "Estabelecimento"}`} 
          description={`Classificação por ${locationChartMetric === "liters" ? "Volume (Litros)" : "Custo Total (R$)"}`}
          className="min-h-[380px]"
          headerAction={
            <div className="flex flex-wrap items-center gap-1.5" id="location-selectors-group">
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/50 dark:border-slate-700/50" id="location-tab-toggle-container">
                <button
                  id="btn-location-tab-city"
                  onClick={() => setLocationChartTab("city")}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                    locationChartTab === "city"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  CIDADES
                </button>
                <button
                  id="btn-location-tab-bairro"
                  onClick={() => setLocationChartTab("bairro")}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                    locationChartTab === "bairro"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  BAIRROS
                </button>
                <button
                  id="btn-location-tab-posto"
                  onClick={() => setLocationChartTab("posto")}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                    locationChartTab === "posto"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  ESTAB.
                </button>
              </div>

              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/50 dark:border-slate-700/50" id="location-metric-toggle-container">
                <button
                  id="btn-location-metric-liters"
                  onClick={() => setLocationChartMetric("liters")}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                    locationChartMetric === "liters"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  LITROS
                </button>
                <button
                  id="btn-location-metric-cost"
                  onClick={() => setLocationChartMetric("cost")}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all duration-200 cursor-pointer ${
                    locationChartMetric === "cost"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  CUSTO
                </button>
              </div>
            </div>
          }
        >
          {top10ByLocation.length === 0 ? (
            <ChartEmptyState title="Dados de Consumo por Localização" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={top10ByLocation} 
                layout="vertical" 
                margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120} 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={9} 
                  className="font-bold text-slate-600 dark:text-slate-400"
                  tickFormatter={(val: string) => val.length > 22 ? `${val.substring(0, 20).trim()}...` : val}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-[11px] text-white">
                          <p className="font-extrabold uppercase mb-1 border-b border-white/10 pb-1 text-indigo-400 max-w-[250px] break-words">
                            {data.name}
                          </p>
                          <p className="font-bold flex justify-between gap-4 mb-1">
                            <span className="text-slate-400 font-medium font-bold uppercase tracking-widest text-[8px]">Consumo:</span>
                            <span className="font-mono text-emerald-400">
                              {locationChartMetric === "liters" 
                                ? `${data.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`
                                : `R$ ${data.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              }
                            </span>
                          </p>
                          {data.cidade && data.cidade !== "N/A" && (
                            <p className="font-bold flex justify-between gap-4 text-slate-300">
                              <span className="text-slate-400 font-medium font-bold uppercase tracking-widest text-[8px]">Cidade (Z):</span>
                              <span>{data.cidade}</span>
                            </p>
                          )}
                          {data.bairro && data.bairro !== "N/A" && (
                            <p className="font-bold flex justify-between gap-4 text-slate-300">
                              <span className="text-slate-400 font-medium font-bold uppercase tracking-widest text-[8px]">Bairro (Y):</span>
                              <span>{data.bairro}</span>
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey={locationChartMetric === "liters" ? "liters" : "cost"} 
                  fill={locationChartMetric === "liters" ? "#9333ea" : "#0891b2"} 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                >
                  {top10ByLocation.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={locationChartMetric === "liters" ? "#9333ea" : "#0891b2"} fillOpacity={1 - index * 0.05} />
                  ))}
                </Bar>
              </BarChart>
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
                  <TableHead className="text-center">Gerência</TableHead>
                  <TableHead className="text-center">Titularidade</TableHead>
                  <TableHead className="text-center">Último Abast.</TableHead>
                  <TableHead className="text-center">Dias Parado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {longTimeNoFuel.map((v) => (
                  <TableRow key={v.placa}>
                    <TableCell className="font-medium text-center">{v.placa}</TableCell>
                    <TableCell className="text-center text-xs text-slate-500 font-medium max-w-[120px] truncate" title={v.gerencia}>
                      {v.gerencia}
                    </TableCell>
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
                  <TableHead className="text-center">Gerência</TableHead>
                  <TableHead className="text-center">Titularidade</TableHead>
                  <TableHead className="text-center">KM Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowKmAssets.map((v) => (
                  <TableRow key={v.placa}>
                    <TableCell className="font-medium text-center">{v.placa}</TableCell>
                    <TableCell className="text-center text-xs text-slate-500 font-medium max-w-[120px] truncate" title={v.gerencia}>
                      {v.gerencia}
                    </TableCell>
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
            <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
          </div>
          
          <div 
            ref={tableContainerRef}
            onScroll={handleTableScroll}
            className="max-h-[500px] overflow-auto custom-scrollbar"
          >
            <Table className="min-w-[1450px] border-separate border-spacing-0">
              <TableHeader className="sticky top-0 bg-background z-30">
                <TableRow>
                  <TableHead className="w-[85px] text-center sticky left-0 bg-background z-40 border-b border-r text-[10px] font-bold" rowSpan={2}>Placa</TableHead>
                  <TableHead className="text-center border-b px-2 py-1 select-none text-[10px] font-bold" rowSpan={2}>Diretoria</TableHead>
                  <TableHead className="text-center border-b px-2 py-1 select-none text-[10px] font-bold" rowSpan={2}>Gerência</TableHead>
                  <TableHead className="text-center border-b px-1 py-1 select-none text-[10px] font-bold" rowSpan={2}>Tipo</TableHead>
                  <TableHead className="text-center border-b px-2 py-1 select-none text-[10px] font-bold" rowSpan={2}>Modelo</TableHead>
                  <TableHead className="text-center border-b px-1 py-1 select-none text-[10px] font-bold whitespace-nowrap" rowSpan={2}>Titularidade</TableHead>
                  <TableHead className="text-center border-b px-1 py-1 select-none text-[10px] font-bold" rowSpan={2}>Ano</TableHead>
                  <TableHead className="text-center bg-slate-50 dark:bg-slate-900/50 border-x border-b text-[10px] font-black uppercase tracking-widest text-primary py-1" colSpan={displayMonths.length + 1}>
                    Desempenho por Período (Km / L / R$)
                  </TableHead>
                  <TableHead className="text-center border-b px-1 py-1 text-[10px] font-bold leading-tight" rowSpan={2}>Último<br/>Odômetro</TableHead>
                  <TableHead className="text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-bold border-b text-[10px] uppercase py-1 px-2 leading-tight" rowSpan={2}>Volume Litros<br/>(Mês Atual)</TableHead>
                  <TableHead className="text-center bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold border-b text-[10px] uppercase py-1 px-2 leading-tight" rowSpan={2}>Custo Reais<br/>(Mês Atual)</TableHead>
                </TableRow>
                <TableRow>
                  {displayMonths.map((m, idx) => (
                    <TableHead key={m} className="text-center border-x border-b text-[10px] py-1">
                      {formatMonthLabel(m)}
                      {idx === displayMonths.length - 1 && (
                        <span className="block text-[8px] text-indigo-500 font-black">Mês Atual</span>
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="text-center border-x border-b text-[10px] py-1 font-extrabold uppercase tracking-widest bg-violet-50/70 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300">
                    Soma Período
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleSummaryData.map((row) => (
                  <TableRow key={row.placa}>
                    <TableCell className="font-bold text-center sticky left-0 bg-white dark:bg-slate-950 z-10 border-r">{row.placa}</TableCell>
                    <TableCell className="text-center p-1 px-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 whitespace-pre-wrap leading-tight block max-w-[90px] mx-auto">{row.diretoria}</span>
                    </TableCell>
                    <TableCell className="text-center p-1 px-2 text-xs font-semibold max-w-[125px] whitespace-pre-wrap leading-tight" title={row.gerencia}>
                      {row.gerencia}
                    </TableCell>
                    <TableCell className="text-center p-1 px-1 text-[10px] max-w-[80px] whitespace-pre-wrap leading-tight">{row.tipo}</TableCell>
                    <TableCell className="text-center p-1 px-2 text-[10px] max-w-[110px] whitespace-pre-wrap leading-tight" title={row.modelo}>{row.modelo}</TableCell>
                    <TableCell className="text-center p-1 px-1 max-w-[90px] whitespace-pre-wrap leading-tight">
                      <Badge variant="outline" className="font-normal text-[9px] px-1 py-0 whitespace-normal text-center mx-auto block leading-tight">{row.titularidade}</Badge>
                    </TableCell>
                    <TableCell className="text-center p-1 text-[10px]">{row.ano}</TableCell>
                    {displayMonths.map(m => {
                      const stats = row.monthStats?.[m] || { kms: 0, telemetryKms: 0, liters: 0, cost: 0 };
                      return (
                        <TableCell key={m} className="text-center py-1.5 px-2 border-x whitespace-pre-wrap">
                          <div className="flex flex-col space-y-0.5 items-center justify-center text-[10px] leading-tight">
                            {stats.kms > 0 ? (
                              <span className="font-bold text-slate-700 dark:text-slate-300" title="Deslocamento Ticket">
                                {stats.kms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km (Tkt)
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                            {stats.telemetryKms > 0 ? (
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400" title="Deslocamento Telemetria">
                                {stats.telemetryKms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km (Tel)
                              </span>
                            ) : (
                              <span className="text-indigo-400/60" title="Deslocamento Telemetria">- (Tel)</span>
                            )}
                            {stats.liters > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {stats.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                                </span>
                                {stats.litersByFuel && Object.keys(stats.litersByFuel).length > 0 && (
                                  <div className="text-[7.5px] font-mono leading-none tracking-tighter flex flex-col items-center mt-1 space-y-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-1 rounded max-w-[115px] w-full text-center">
                                    {Object.entries(stats.litersByFuel).map(([fType, fLiters]) => (
                                      <span key={fType} className="truncate max-w-full text-slate-500 dark:text-slate-400">
                                        {fType}: <span className="font-bold text-blue-500">{(fLiters as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                            {stats.cost > 0 ? (
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                R$ {stats.cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center py-1.5 px-2 border-x whitespace-pre-wrap bg-violet-50/15 dark:bg-violet-950/5 font-semibold">
                      <div className="flex flex-col space-y-0.5 items-center justify-center text-[10px] leading-tight">
                        {row.totalTicketKms > 0 ? (
                          <span className="font-bold text-slate-850 dark:text-slate-200" title="Total Deslocamento Ticket">
                            {row.totalTicketKms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km (Tkt)
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        {row.totalTelemetryKms > 0 ? (
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400" title="Total Deslocamento Telemetria">
                            {row.totalTelemetryKms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km (Tel)
                          </span>
                        ) : (
                          <span className="text-indigo-400/60" title="Total Deslocamento Telemetria">- (Tel)</span>
                        )}
                        {(row.totalFuelLiters > 0 || row.totalArlaLiters > 0) ? (
                          <div className="flex flex-col items-center">
                            {row.totalFuelLiters > 0 && (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {row.totalFuelLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                              </span>
                            )}
                            {row.totalArlaLiters > 0 && (
                              <div className="text-[7.5px] font-mono leading-none tracking-tighter flex flex-col items-center mt-1 space-y-0.5 bg-purple-50/55 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50 p-1 rounded max-w-[115px] w-full text-center">
                                <span className="truncate max-w-full text-purple-600 dark:text-purple-400">
                                  Arla: <span className="font-bold">{row.totalArlaLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L</span>
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        {row.totalCost > 0 ? (
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            R$ {row.totalCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono py-1 px-2 text-[10px]">
                      {row.lastOdo > 0 ? row.lastOdo.toLocaleString('pt-BR') : "-"}
                    </TableCell>
                    <TableCell className="text-center font-semibold font-mono text-blue-600 bg-blue-50/10 dark:bg-blue-950/5 py-1 px-2 text-[10px]">
                      {row.currentMonthLiters > 0 ? (
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <span>{row.currentMonthLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</span>
                          {row.currentMonthLitersByFuel && Object.keys(row.currentMonthLitersByFuel).length > 0 && (
                            <div className="text-[7.5px] font-mono leading-none tracking-tighter flex flex-col items-center space-y-0.5 bg-blue-50/30 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/50 p-1 rounded max-w-[115px] w-full text-center text-slate-500">
                              {Object.entries(row.currentMonthLitersByFuel).map(([fType, fLiters]) => (
                                <span key={fType} className="truncate max-w-full">
                                  {fType}: <span className="font-bold text-blue-600 dark:text-blue-400">{(fLiters as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-center font-bold font-mono text-emerald-600 bg-emerald-50/10 dark:bg-emerald-950/5 py-1 px-2 text-[10px]">
                      {row.currentMonthCost > 0 ? `R$ ${row.currentMonthCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : "-"}
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
