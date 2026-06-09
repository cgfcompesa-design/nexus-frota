import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, Search, Filter, Download, X, Wrench, Package, 
  DollarSign, ChevronLeft, ChevronRight, ChevronDown, 
  Clock, Activity, Info, TrendingUp, TrendingDown, 
  CheckCircle2, Timer, Gauge, Calculator, FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parse, isValid, isWithinInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel, exportToExcelMultiSheet } from "@/lib/exportToExcel";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine 
} from "recharts";
import { useAssets, useHistoricoManutencao, useOrcamentos, useCustosDetalhes } from "@/hooks/useFleetData";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MaintenanceCostData } from "@/types";

// Função auxiliar simplificada para conversão de data
const getFormattedDateLocal = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (match) {
    let y = match[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return null;
};

interface MaintenanceHistoryDashboardProps {
  maintenanceCost: MaintenanceCostData[];
}

interface MaintenanceHistoryItem {
  ordemServico: string;
  placa: string;
  estabelecimento: string;
  grupoPeca: string;
  peca: string;
  maoDeObra: string;
  pecaQuantidade: string;
  pecaValorUnit: string;
  pecaTotal: string;
  maoDeObraQuantidade: string;
  maoDeObraValorUnit: string;
  maoDeObraTotal: string;
  total: string;
  dataConclusaoOS: string;
  dataEntradaOficina: string;
  dataEnvioOS: string;
  dataAprovacaoOS: string;
  dataRetiradaOficina: string;
  tam: string;
  mesAno: string;
}

interface OrcamentoData {
  orcamento: string;
  estabelecimento: string;
  dataEntradaOficina: string;
  dataEnvioOS: string;
  dataAprovacaoOS: string;
  dataRetiradaOficina: string;
  tam: string; 
  mesAno: string;
}

const METAS = {
  MTTR: 7,
  MTBF: 30,
  MTTA: 2,
  DISPONIBILIDADE: 90,
};

const TAM_DESCRIPTIONS: Record<string, string> = {
  MCP: "Manutenção Corretiva Planejada",
  MCE: "Manutenção Corretiva Emergencial",
  TAC: "Tacógrafo",
  GNV: "Inspeção GNV",
  MPV: "Manutenção Preventiva",
  MCI: "Manutenção Corretiva Inspeção",
  CIV: "Vistoria CIV",
  VCI: "Vistoria Carroceria Inmetro",
  CHM: "Checklist Manutenção",
  AET: "AET Guindaste",
  MPD: "Manutenção Preditiva",
};

// Based on user: "desconsiderando manutenções programadas (preventivas/planejadas)"
const PROGRAMMED_TAMS = ["MPV", "MCP", "TAC", "GNV", "CIV", "VCI", "CHM", "AET", "MCI", "MPD"];
const PREVENTIVE_TAMS = ["MPV", "TAC", "GNV", "CIV", "VCI", "CHM", "AET", "MPD"];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4de6c', '#d0ed57'];

const ITEMS_PER_PAGE = 50;

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
  for (const fmt of formats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  return null;
};

interface CustoItem {
  placa: string;
  tipo: string;
  custo: number;
  mesAno: string;
  tam: string;
  custoOrcado: number;
  custoReal: number;
  gerencia: string;
  diretoria: string;
  nOrcamento: string;
  descricao: string;
  ordemServico: string;
}

interface IndicatorSourceItem {
  placa: string;
  ordemServico: string;
  mesAno: string;
  tam: string;
  dataEntradaOficina: string;
  dataRetiradaOficina: string;
  dataEnvioOS: string;
  dataAprovacaoOS: string;
  dataConclusao: string;
  diretoria: string;
  gerencia: string;
  tipoAtivo: string;
}

export const MaintenanceHistoryDashboard = ({ maintenanceCost }: MaintenanceHistoryDashboardProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTam, setSelectedTam] = useState<string>("ALL");
  const [selectedTamsCharts, setSelectedTamsCharts] = useState<string[]>([]);
  const [searchPlaca, setSearchPlaca] = useState("");
  const [selectedGrupoPeca, setSelectedGrupoPeca] = useState("all");
  const [selectedPeca, setSelectedPeca] = useState("all");
  const [selectedDiretoria, setSelectedDiretoria] = useState("all");
  const [selectedGerencia, setSelectedGerencia] = useState("all");
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [cpmvCurrentPage, setCpmvCurrentPage] = useState(1);
  const cpmvItemsPerPage = 15;
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedMesAnoIndicadores, setSelectedMesAnoIndicadores] = useState("all");
  const [selectedCycleStatus, setSelectedCycleStatus] = useState<string>("all");

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();
  const { data: historicoRows = [], isLoading: isLoadingHistorico } = useHistoricoManutencao();
  const { data: orcamentosRows = [], isLoading: isLoadingOrcamentos } = useOrcamentos();
  const { data: custosDetalhesRows = [], isLoading: isLoadingCustos } = useCustosDetalhes();

  const isLoading = isLoadingAssets || isLoadingHistorico || isLoadingOrcamentos || isLoadingCustos;

  const orcamentosMap = useMemo(() => {
    const map = new Map<string, OrcamentoData>();
    if (!orcamentosRows.length) return map;

    for (let i = 2; i < orcamentosRows.length; i++) {
      const row = orcamentosRows[i];
      if (!row || row.length < 65) continue;
      
      const orcamento = row[49]?.trim() || "";
      const mesAnoRaw = row[54]?.trim() || "";
      const estabelecimento = row[59]?.trim() || "";
      const dataEntrada = row[60]?.trim() || "";
      const dataRetirada = row[61]?.trim() || "";
      const dataEnvioOS = row[62]?.trim() || "";
      const dataAprovacaoOS = row[63]?.trim() || "";
      const tam = row[64]?.trim() || "";
      const mesAno = mesAnoRaw.replace(/\./g, '').replace(/-/g, '/');
      
      if (orcamento) {
        map.set(orcamento, {
          orcamento, estabelecimento, dataEntradaOficina: dataEntrada,
          dataEnvioOS, dataAprovacaoOS, dataRetiradaOficina: dataRetirada,
          tam, mesAno,
        });
      }
    }
    return map;
  }, [orcamentosRows]);

  const data = useMemo(() => {
    if (!historicoRows.length) return [];
    const parsed: MaintenanceHistoryItem[] = [];
    for (let i = 1; i < historicoRows.length; i++) {
        const row = historicoRows[i];
        if (!row || row.length < 21) continue;
        const ordemServico = row[0] || "";
        const orcamentoData = orcamentosMap.get(ordemServico);
        parsed.push({
            ordemServico,
            placa: row[1] || "",
            estabelecimento: row[26] || orcamentoData?.estabelecimento || "",
            grupoPeca: row[8] || "",
            peca: row[9] || "",
            maoDeObra: row[10] || "",
            pecaQuantidade: row[14] || "",
            pecaValorUnit: row[15] || "",
            pecaTotal: row[16] || "",
            maoDeObraQuantidade: row[17] || "",
            maoDeObraValorUnit: row[18] || "",
            maoDeObraTotal: row[19] || "",
            total: row[20] || "",
            dataConclusaoOS: row[7] || "",
            dataEntradaOficina: orcamentoData?.dataEntradaOficina || "",
            dataEnvioOS: orcamentoData?.dataEnvioOS || "",
            dataAprovacaoOS: orcamentoData?.dataAprovacaoOS || "",
            dataRetiradaOficina: orcamentoData?.dataRetiradaOficina || "",
            tam: orcamentoData?.tam || "",
            mesAno: orcamentoData?.mesAno || "",
        });
    }
    return parsed;
  }, [historicoRows, orcamentosMap]);

  const { custosData, indicatorSource } = useMemo(() => {
    const parsedCustos: CustoItem[] = [];
    const indicatorItems: IndicatorSourceItem[] = [];
    const seenIndicatorKeys = new Set<string>();

    const parseCurrency = (raw: string) => {
      const str = (raw || "").replace(/R\$\s*/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
      return parseFloat(str) || 0;
    };

    const normalizePlate = (p: string) => (p || "").toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (custosDetalhesRows.length > 0) {
        for (let i = 1; i < custosDetalhesRows.length; i++) {
          const row = custosDetalhesRows[i];
          if (!row || row.length < 40) continue;
          
          const diretoria = row[36]?.trim() || "";
          const gerencia = row[37]?.trim() || "";
          const tipoManutencao = row[38]?.trim() || ""; // Column AM
          const mesAnoRaw = row[42]?.trim() || ""; // Column AQ
          const tam = row[45]?.trim() || ""; // Column AT
          const custoOrcado = parseCurrency(row[46]); // Column AU
          const custoReal = parseCurrency(row[47]); // Column AV
          const custoGeral = parseCurrency(row[40]); // Column AO
          const mesAno = mesAnoRaw.replace(/\./g, '').replace(/-/g, '/');

          const placa = normalizePlate(row[35]?.trim() || row[1]?.trim() || "");
          const nOrcamento = row[44]?.trim() || "";
          const ordemServico = row[1]?.trim() || "";
          const dedupeKey = nOrcamento || ordemServico || `row-${i}`;
          const descricao = row[53]?.trim() || ""; // Column BB is index 53

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

  const assetLookup = useMemo(() => {
    const map = new Map<string, { diretoria: string; gerencia: string; tipo: string }>();
    assets.forEach(asset => {
      const placa = (asset.PLACA || asset.placa || "").toUpperCase();
      if (placa) {
        map.set(placa, {
          diretoria: asset.DIRETORIA || asset["GERÊNCIA"] || "",
          gerencia: asset.GERENCIA || asset["GERÊNCIA"] || "",
          tipo: asset.TIPO || ""
        });
      }
    });
    return map;
  }, [assets]);

  const { diretorias, gerencias, tipos } = useMemo(() => {
    const placasInData = new Set(data.map(item => item.placa.toUpperCase()));
    const diretoriasSet = new Set<string>();
    const gerenciasSet = new Set<string>();
    const tiposSet = new Set<string>();
    
    assets.forEach(asset => {
      const placa = (asset.PLACA || asset.placa || "").toUpperCase();
      if (placasInData.has(placa)) {
        if (asset.DIRETORIA) diretoriasSet.add(asset.DIRETORIA);
        else if (asset["GERÊNCIA"]) diretoriasSet.add(asset["GERÊNCIA"]);
        
        if (asset.GERENCIA) gerenciasSet.add(asset.GERENCIA);
        else if (asset["GERÊNCIA"]) gerenciasSet.add(asset["GERÊNCIA"]);
        
        if (asset.TIPO) tiposSet.add(asset.TIPO);
      }
    });
    
    return {
      diretorias: Array.from(diretoriasSet).sort(),
      gerencias: Array.from(gerenciasSet).sort(),
      tipos: Array.from(tiposSet).sort()
    };
  }, [assets, data]);

  const availableTams = useMemo(() => {
    return Array.from(new Set(indicatorSource.map(item => item.tam).filter(Boolean))).sort();
  }, [indicatorSource]);

  const mesesAnosDisponiveis = useMemo(() => {
    const values = indicatorSource.map(item => item.mesAno).filter(Boolean);
    const monthsRef: Record<string, number> = {
      jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
      jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
    };
    return Array.from(new Set(values)).sort((a: string, b: string) => {
      if (!a.includes('/') || !b.includes('/')) return 0;
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      const numAnoA = parseInt(anoA) || 0;
      const numAnoB = parseInt(anoB) || 0;
      if (numAnoA !== numAnoB) return numAnoA - numAnoB;
      return (monthsRef[mesA.toLowerCase()] || 0) - (monthsRef[mesB.toLowerCase()] || 0);
    });
  }, [indicatorSource]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const placaUpper = item.placa.toUpperCase();
      const assetInfo = assetLookup.get(placaUpper);
      const matchPlaca = searchPlaca === "" || placaUpper.includes(searchPlaca.toUpperCase());
      const matchGrupoPeca = selectedGrupoPeca === "all" || item.grupoPeca === selectedGrupoPeca;
      const matchPeca = selectedPeca === "all" || item.peca === selectedPeca;
      const matchDiretoria = selectedDiretoria === "all" || assetInfo?.diretoria === selectedDiretoria;
      const matchGerencia = selectedGerencia === "all" || assetInfo?.gerencia === selectedGerencia;
      const matchTipo = selectedTipos.length === 0 || (assetInfo?.tipo && selectedTipos.includes(assetInfo.tipo));
      let matchDate = true;
      if (startDate || endDate) {
        const d = parseDate(item.dataConclusaoOS);
        if (d) {
          if (startDate && endDate) matchDate = isWithinInterval(d, { start: startDate, end: endDate });
          else if (startDate) matchDate = d >= startDate;
          else if (endDate) matchDate = d <= endDate;
        } else matchDate = false;
      }
      return matchPlaca && matchGrupoPeca && matchPeca && matchDiretoria && matchGerencia && matchTipo && matchDate;
    });
  }, [data, searchPlaca, selectedGrupoPeca, selectedPeca, selectedDiretoria, selectedGerencia, selectedTipos, startDate, endDate, assetLookup]);

  // Reset pagination on filter change
  useEffect(() => {
    setCpmvCurrentPage(1);
  }, [selectedDiretoria, selectedGerencia]);

  const compesaAssetsCPMV = useMemo(() => {
    const filtered = assets.filter(a => {
      const prop = (a.PROPRIEDADE || "").toUpperCase().trim();
      const status = (a["STATUS OPERACIONAL"] || "").toUpperCase().trim();
      
      const isCompesa = prop.includes("COMPESA");
      const isOperacional = status === "OPERACIONAL" || status.includes("OPERAC");
      
      if (!isCompesa || !isOperacional) return false;
      
      if (selectedDiretoria !== "all") {
        const dirVal = (a.DIRETORIA || a["GERÊNCIA"] || "").trim().toUpperCase();
        if (!dirVal.includes(selectedDiretoria.toUpperCase())) return false;
      }
      if (selectedGerencia !== "all") {
        const gerVal = (a.GERENCIA || a["GERÊNCIA"] || "").trim().toUpperCase();
        if (!gerVal.includes(selectedGerencia.toUpperCase())) return false;
      }

      // NOVO: Filtro de Ciclo de Vida
      if (selectedCycleStatus !== "all") {
        const raw = (a as any).__raw || [];
        const totalMaint = costsByPlacaLocal.get(a.PLACA?.toUpperCase()?.replace(/[^A-Z0-9]/g, '') || '') || 0;
        const valorAquisicao = parseFloat(String(raw[24] || a["VALOR AQUISIÇÃO"] || 0).replace(/[R$\s.]/g, '').replace(',', '.'));
        const cpmv = valorAquisicao > 0 ? (totalMaint / valorAquisicao) * 100 : 0;
        
        let status = "NORMAL";
        if (cpmv > 70) status = "RENOVACAO";
        else if (cpmv > 40) status = "MONITORAMENTO";
        else status = "OK";

        if (selectedCycleStatus === "RENOVACAO" && status !== "RENOVACAO") return false;
        if (selectedCycleStatus === "MONITORAMENTO" && status !== "MONITORAMENTO") return false;
        if (selectedCycleStatus === "NORMAL" && status !== "OK") return false;
      }

      return true;
    });

    const costsByPlacaLocal = new Map<string, number>();
    custosData.forEach(item => {
      if (item.placa) {
        costsByPlacaLocal.set(item.placa, (costsByPlacaLocal.get(item.placa) || 0) + item.custo);
      }
    });

    const excelDateToJSDateLocal = (serial: number) => {
      return new Date((serial - 25569) * 86400 * 1000);
    };

    return filtered.map(a => {
      const raw = (a as any).__raw || [];
      const placa = (a.PLACA || a.placa || "").toString().toUpperCase();
      const normalizedPlaca = placa.replace(/[^A-Z0-9]/g, '');
      
      const valorAquisicao = parseFloat(String(raw[24] || a["VALOR AQUISIÇÃO"] || a["VALOR DE COMPRA"] || 0).replace(/[R$\s.]/g, '').replace(',', '.'));
      const totalMaint = costsByPlacaLocal.get(normalizedPlaca) || 0;
      const cpmv = valorAquisicao > 0 ? (totalMaint / valorAquisicao) * 100 : 0;
      
      let age = 5; 
      const rawAcqDate = raw[25];
      if (rawAcqDate) {
        const dateStr = getFormattedDateLocal(rawAcqDate);
        const acqDate = dateStr ? new Date(dateStr) : null;
        if (acqDate && !isNaN(acqDate.getTime())) {
          age = 2026 - acqDate.getFullYear();
        } else if (typeof rawAcqDate === 'number') {
          const d = excelDateToJSDateLocal(rawAcqDate);
          if (!isNaN(d.getTime())) age = 2026 - d.getFullYear();
        }
      } else {
        const anoStr = String(a.ANO || "2020");
        const ano = parseInt(anoStr.substring(0,4));
        age = 2026 - (isNaN(ano) ? 2020 : ano);
      }

      return { placa, modelo: a.MODELO || a.DESCRICAO || "N/A", age, valorAquisicao, totalMaint, cpmv };
    })
    .filter(x => x.valorAquisicao > 0 || x.totalMaint > 0)
    .sort((a, b) => b.cpmv - a.cpmv);
  }, [assets, custosData, selectedDiretoria, selectedGerencia]);

  const paginatedCPMV = useMemo(() => {
    return compesaAssetsCPMV.slice(
      (cpmvCurrentPage - 1) * cpmvItemsPerPage,
      cpmvCurrentPage * cpmvItemsPerPage
    );
  }, [compesaAssetsCPMV, cpmvCurrentPage]);

  const indicatorData = useMemo(() => {
    let res = indicatorSource;
    if (selectedMesAnoIndicadores !== "all") res = res.filter(i => i.mesAno === selectedMesAnoIndicadores);
    if (selectedDiretoria !== "all") res = res.filter(i => i.diretoria === selectedDiretoria);
    if (selectedGerencia !== "all") res = res.filter(i => i.gerencia === selectedGerencia);
    if (selectedTam && selectedTam !== "ALL") res = res.filter(i => i.tam === selectedTam);
    return res;
  }, [indicatorSource, selectedTam, selectedMesAnoIndicadores, selectedDiretoria, selectedGerencia]);

  const mceFilteredData = useMemo(() => {
    let res = indicatorSource;
    if (selectedMesAnoIndicadores !== "all") res = res.filter(i => i.mesAno === selectedMesAnoIndicadores);
    if (selectedDiretoria !== "all") res = res.filter(i => i.diretoria === selectedDiretoria);
    if (selectedGerencia !== "all") res = res.filter(i => i.gerencia === selectedGerencia);
    return res.filter(i => i.tam === "MCE");
  }, [indicatorSource, selectedMesAnoIndicadores, selectedDiretoria, selectedGerencia]);

  const filteredCustosData = useMemo(() => {
    let res = custosData;
    if (selectedMesAnoIndicadores !== "all") res = res.filter(c => c.mesAno === selectedMesAnoIndicadores);
    if (selectedDiretoria !== "all") res = res.filter(c => c.diretoria === selectedDiretoria);
    if (selectedGerencia !== "all") res = res.filter(c => c.gerencia === selectedGerencia);
    if (selectedTam && selectedTam !== "ALL") res = res.filter(c => c.tam === selectedTam);
    if (searchPlaca) {
      const sp = searchPlaca.toUpperCase().replace(/[^A-Z0-9]/g, '');
      res = res.filter(c => c.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(sp));
    }
    return res;
  }, [custosData, selectedMesAnoIndicadores, selectedDiretoria, selectedGerencia, selectedTam, searchPlaca]);

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

  const temporalTamData = useMemo(() => {
    const monthsRef: Record<string, number> = {
      jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
      jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
    };

    const grouped = new Map<string, Record<string, number>>();
    indicatorSource.forEach(item => {
      const mesAno = item.mesAno.replace(/\./g, '').toLowerCase();
      if (!mesAno) return;
      if (!grouped.has(mesAno)) grouped.set(mesAno, {});
      const monthObj = grouped.get(mesAno)!;
      monthObj[item.tam] = (monthObj[item.tam] || 0) + 1;
    });

    const sortedMonthKeys = Array.from(grouped.keys()).sort((a, b) => {
      const partsA = a.split('/');
      const partsB = b.split('/');
      if (partsA.length < 2 || partsB.length < 2) return 0;
      const [mesA, anoA] = partsA;
      const [mesB, anoB] = partsB;
      const numAnoA = parseInt(anoA) || 0;
      const numAnoB = parseInt(anoB) || 0;
      if (numAnoA !== numAnoB) return numAnoA - numAnoB;
      return (monthsRef[mesA] || 0) - (monthsRef[mesB] || 0);
    });

    return sortedMonthKeys.map(mesAno => ({
      mesAno,
      ...grouped.get(mesAno)
    }));
  }, [indicatorSource]);

  const mttrData = useMemo(() => {
    const seenEvents = new Set<string>();
    const items = mceFilteredData.filter(i => {
      if (seenEvents.has(i.ordemServico)) return false;
      seenEvents.add(i.ordemServico);
      return operationalPlates.has(i.placa) && i.dataEntradaOficina && i.dataRetiradaOficina;
    });
    let total = 0, count = 0;
    items.forEach(i => {
      const e = parseDate(i.dataEntradaOficina), s = parseDate(i.dataRetiradaOficina);
      if (e && s && differenceInDays(s, e) >= 0) { total += differenceInDays(s, e); count++; }
    });
    return { averageDays: count > 0 ? total / count : 0, count };
  }, [mceFilteredData, operationalPlates]);

  const mtbfData = useMemo(() => {
    // Calculo solicitado: (Uptime Base - Tempo Manutenção MCE) / Qtd de Manutenções MCE
    // Consideramos uma base de 30 dias (ou 30 * n_meses se "Todas" selecionado)
    const plateStats = new Map<string, { downtime: number; count: number }>();
    
    mceFilteredData.forEach(i => {
      const e = parseDate(i.dataEntradaOficina);
      const r = parseDate(i.dataRetiradaOficina);
      const days = (e && r) ? Math.max(0, differenceInDays(r, e)) : 0;
      
      const stats = plateStats.get(i.placa) || { downtime: 0, count: 0 };
      stats.downtime += days;
      stats.count += 1;
      plateStats.set(i.placa, stats);
    });

    if (plateStats.size === 0) return { averageDays: 0, count: 0 };

    const numMonths = selectedMesAnoIndicadores === "all" 
      ? (new Set(indicatorSource.map(i => i.mesAno)).size || 1)
      : 1;
    const daysBaseTotal = 30 * numMonths;
    
    let totalMtbfVal = 0;
    plateStats.forEach((stats) => {
      // MTBF_v = (Base Dias - Dias Parado) / Falhas
      const vMtbf = (daysBaseTotal - stats.downtime) / stats.count;
      totalMtbfVal += Math.max(0, vMtbf);
    });

    return { averageDays: totalMtbfVal / plateStats.size, count: mceFilteredData.length };
  }, [mceFilteredData, selectedMesAnoIndicadores, indicatorSource]);

  const mttaData = useMemo(() => {
    const seenEvents = new Set<string>();
    const items = indicatorData.filter(i => {
      if (seenEvents.has(i.ordemServico)) return false;
      seenEvents.add(i.ordemServico);
      return operationalPlates.has(i.placa) && i.dataEnvioOS && i.dataAprovacaoOS;
    });
    let total = 0, count = 0;
    items.forEach(i => {
      const env = parseDate(i.dataEnvioOS), apr = parseDate(i.dataAprovacaoOS);
      if (env && apr && differenceInDays(apr, env) >= 0) { total += differenceInDays(apr, env); count++; }
    });
    return { averageDays: count > 0 ? total / count : 0, count };
  }, [indicatorData, operationalPlates]);

  const costsByTipo = useMemo(() => {
    const map: Record<string, { value: number; plates: Set<string> }> = {};
    filteredCustosData.forEach(c => {
      const name = c.tipo || "Não Especificado";
      if (!map[name]) map[name] = { value: 0, plates: new Set<string>() };
      map[name].value += c.custo;
      if (c.placa) {
        map[name].plates.add(String(c.placa).toUpperCase().trim());
      }
    });
    return Object.entries(map)
      .map(([name, item]) => ({
        name,
        value: item.value,
        numAssets: item.plates.size
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredCustosData]);

  const costsByPeriod = useMemo(() => {
    const map: Record<string, { mesAno: string; real: number; orcado: number; count: number }> = {};
    filteredCustosData.forEach(c => {
      if (!map[c.mesAno]) map[c.mesAno] = { mesAno: c.mesAno, real: 0, orcado: 0, count: 0 };
      map[c.mesAno].real += c.custoReal;
      map[c.mesAno].orcado += c.custoOrcado;
      map[c.mesAno].count += 1;
    });
    
    const monthsRef: Record<string, number> = {
      jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
      jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
    };

    return Object.values(map)
      .map(item => ({
        ...item,
        real: item.real / (item.count || 1),
        orcado: item.orcado / (item.count || 1)
      }))
      .sort((a, b) => {
        const partsA = a.mesAno.split('/');
        const partsB = b.mesAno.split('/');
        if (partsA.length < 2 || partsB.length < 2) return 0;
        const numAnoA = parseInt(partsA[1]) || 0;
        const numAnoB = parseInt(partsB[1]) || 0;
        if (numAnoA !== numAnoB) return numAnoA - numAnoB;
        return (monthsRef[partsA[0].toLowerCase()] || 0) - (monthsRef[partsB[0].toLowerCase()] || 0);
      });
  }, [filteredCustosData]);

  const costsByTam = useMemo(() => {
    const map: Record<string, { custo: number; count: number }> = {};
    filteredCustosData.forEach(c => {
      const tam = c.tam || "S/D";
      if (!map[tam]) map[tam] = { custo: 0, count: 0 };
      map[tam].custo += c.custo;
      map[tam].count += 1;
    });
    return Object.entries(map)
      .map(([tam, item]) => ({
        tam,
        custo: item.custo,
        count: item.count
      }))
      .sort((a, b) => b.custo - a.custo);
  }, [filteredCustosData]);

  const costsByPlate = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCustosData.forEach(c => {
      const placa = c.placa || "S/D";
      map[placa] = (map[placa] || 0) + c.custo;
    });
    return Object.entries(map)
      .map(([placa, custo]) => ({ placa, custo }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10);
  }, [filteredCustosData]);

  const costsByGerencia = useMemo(() => {
    const map: Record<string, { custo: number; plates: Set<string> }> = {};
    filteredCustosData.forEach(c => {
      const g = c.gerencia || "S/D";
      if (!map[g]) map[g] = { custo: 0, plates: new Set<string>() };
      map[g].custo += c.custo;
      if (c.placa) {
        map[g].plates.add(String(c.placa).toUpperCase().trim());
      }
    });
    return Object.entries(map)
      .map(([gerencia, item]) => ({
        gerencia,
        custo: item.custo,
        numAssets: item.plates.size
      }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10);
  }, [filteredCustosData]);

  const osCountByPlacaMonth = useMemo(() => {
    const map = new Map<string, Set<string>>();
    custosDetalhesRows.slice(1).forEach((row) => {
      if (!row || row.length < 5) return;
      const rawPlate = row[35]?.trim() || row[1]?.trim() || "";
      const placa = rawPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const mesAnoRaw = row[42]?.trim() || "";
      const mesAno = mesAnoRaw.replace(/\./g, '').replace(/-/g, '/');
      const os = row[1]?.trim();
      if (placa && mesAno && os) {
        const key = `${placa}_${mesAno}`;
        if (!map.has(key)) map.set(key, new Set<string>());
        map.get(key)!.add(os);
      }
    });

    const counts = new Map<string, number>();
    map.forEach((osSet, key) => {
      counts.set(key, osSet.size);
    });
    return counts;
  }, [custosDetalhesRows]);

  const top10AssetsServices = useMemo(() => {
    const topPlatesArray = costsByPlate.map(c => c.placa);
    if (topPlatesArray.length === 0) return [];

    const services = filteredCustosData.filter(c => topPlatesArray.includes(c.placa));

    return services.sort((a, b) => {
      const idxA = topPlatesArray.indexOf(a.placa);
      const idxB = topPlatesArray.indexOf(b.placa);
      if (idxA !== idxB) return idxA - idxB;
      return b.custo - a.custo;
    });
  }, [costsByPlate, filteredCustosData]);

  const qtdOsPorPlacaFiltrada = useMemo(() => {
    const map = new Map<string, number>();
    filteredCustosData.forEach(c => {
      const p = (c.placa || "").toUpperCase().trim();
      if (p) {
        const hasASData = c.nOrcamento && c.nOrcamento.trim() !== "";
        if (hasASData) {
          map.set(p, (map.get(p) || 0) + 1);
        }
      }
    });
    return Array.from(map.entries())
      .map(([placa, count]) => ({
        placa,
        qtdOS: count
      }))
      .sort((a, b) => b.qtdOS - a.qtdOS);
  }, [filteredCustosData]);

  const countsByTipoAtivo = useMemo(() => {
    const map: Record<string, number> = {};
    indicatorData.forEach(i => {
      map[i.tipoAtivo] = (map[i.tipoAtivo] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [indicatorData]);

  const countsByOS = useMemo(() => {
    const map: Record<string, number> = {};
    indicatorData.forEach(i => {
      map[i.tam] = (map[i.tam] || 0) + 1;
    });
    return Object.entries(map).map(([tam, value]) => ({ tam, value })).sort((a, b) => b.value - a.value);
  }, [indicatorData]);

  const countsByUnidade = useMemo(() => {
    const map: Record<string, number> = {};
    indicatorData.forEach(i => {
      map[i.gerencia] = (map[i.gerencia] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [indicatorData]);

  const diretoriaOptions = useMemo(() => Array.from(new Set(custosDetalhesRows.slice(1).map(r => r[36]?.trim()).filter(Boolean))), [custosDetalhesRows]);
  const gerenciaOptions = useMemo(() => {
    let filtered = custosDetalhesRows.slice(1);
    if (selectedDiretoria !== "all") filtered = filtered.filter(r => r[36]?.trim() === selectedDiretoria);
    return Array.from(new Set(filtered.map(r => r[37]?.trim()).filter(Boolean)));
  }, [custosDetalhesRows, selectedDiretoria]);

  const disponibilidadeOperacional = useMemo(() => {
    const mttr = mttrData.averageDays;
    const mtbf = mtbfData.averageDays;
    if (mtbf <= 0 || (mtbf + mttr) <= 0) return 0;
    return (mtbf / (mtbf + mttr)) * 100;
  }, [mttrData, mtbfData]);

  const formatCurrency = (val: string | number) => {
    const n = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(n) ? "R$ 0,00" : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleExport = () => {
    const parseNum = (val: string | number) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const clean = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    const exportData = filteredData.map(i => ({
      OS: i.ordemServico, Placa: i.placa, Estabelecimento: i.estabelecimento, Grupo: i.grupoPeca, Peça: i.peca, MO: i.maoDeObra,
      'Peça Qtd': parseNum(i.pecaQuantidade), 
      'Peça R$': parseNum(i.pecaTotal), 
      'MO Qtd': parseNum(i.maoDeObraQuantidade), 
      'MO R$': parseNum(i.maoDeObraTotal),
      Total: parseNum(i.total), 
      'Data Conclusão': i.dataConclusaoOS
    }));
    exportToExcel(exportData, `Historico_Manutencao_${format(new Date(), 'yyyyMMdd')}`, 'Histórico');
  };

  const handleGenerateHistoryPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const now = new Date();
    const formattedDate = now.toLocaleString("pt-BR");

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text("Relatório CGF - Histórico & Custos de Manutenção", 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Atualizado em: ${formattedDate}`, 14, 28);
    
    const fillStr = `Filtros: Diretoria: ${selectedDiretoria === "all" ? "Todas" : selectedDiretoria} | Gerência: ${selectedGerencia === "all" ? "Todas" : selectedGerencia} | Mês/Ano: ${selectedMesAnoIndicadores === "all" ? "Todos" : selectedMesAnoIndicadores} | TAM: ${selectedTam === "ALL" ? "Todos" : selectedTam}`;
    doc.text(fillStr, 14, 33);

    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Resumo Financeiro Consolidado", 14, 43);

    const totalInvestido = filteredCustosData.reduce((acc, c) => acc + c.custo, 0);
    const orcadoAcumulado = filteredCustosData.reduce((acc, c) => acc + c.custoOrcado, 0);
    const mediaPorOS = filteredCustosData.length > 0 ? totalInvestido / filteredCustosData.length : 0;

    autoTable(doc, {
      startY: 47,
      head: [["Indicador Financeiro", "Valor"]],
      body: [
        ["Montante Investido em Manutenção", formatCurrency(totalInvestido)],
        ["Média Financeira por OS", formatCurrency(mediaPorOS)],
        ["Custo Orçado Acumulado", formatCurrency(orcadoAcumulado)],
        ["Qtd. Orçamentos", String(orcamentosMap.size)],
      ],
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      bodyStyles: { fontSize: 9 },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // Helper for inline chart drawing
    const drawPdfHorizontalChart = (title: string, data: any[], valueKey: string, labelKey: string, startY: number) => {
      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text(title, 14, startY);
      
      const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
      let currentDrawY = startY + 5;
      
      data.slice(0, 5).forEach((item, index) => {
        const val = item[valueKey] || 0;
        const label = item[labelKey] || "N/A";
        // Calculate scaled width (max 100mm)
        const barWidth = (val / maxVal) * 100;
        
        doc.setFontSize(7.5);
        doc.setTextColor(60);
        // Map label to long description if it's a TAM key
        const displayLabel = labelKey === "tam" ? `${label} - ${TAM_DESCRIPTIONS[label] || 'Outros'}` : label;
        const finalLabel = displayLabel.length > 38 ? displayLabel.substring(0, 35) + "..." : displayLabel;
        doc.text(`${finalLabel}:`, 14, currentDrawY + 3);
        
        // Background grey bar
        doc.setFillColor(243, 244, 246);
        doc.rect(65, currentDrawY, 100, 4, "F");
        
        // Colored bar - alternating color
        const colors = [
          [59, 130, 246],  // Blue
          [16, 185, 129],  // Emerald
          [245, 158, 11],  // Amber
          [239, 68, 68],   // Red
          [99, 102, 241],  // Indigo
        ];
        const col = colors[index % colors.length];
        doc.setFillColor(col[0], col[1], col[2]);
        doc.rect(65, currentDrawY, Math.max(barWidth, 1), 4, "F");
        
        // Value
        doc.setFontSize(7.5);
        doc.setTextColor(80);
        doc.text(formatCurrency(val), 170, currentDrawY + 3);
        
        currentDrawY += 8;
      });
      
      return currentDrawY + 4;
    };

    // Table: Custo de Manutenção por Tipo
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Custo de Manutenção por Tipo", 14, currentY);

    const tipoTableData = costsByTipo.map(item => [
      item.name || "Não Especificado",
      String((item as any).numAssets || 0),
      formatCurrency(item.value)
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Tipo de Custo", "Quantidade de Ativos", "Valor Total Gasto"]],
      body: tipoTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    // Table: Gerências com Maior Custo
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Top 10 - Gerências com Maior Custo", 14, currentY);

    const gerenciaTableData = costsByGerencia.map((item, idx) => [
      `${idx + 1}º`,
      item.gerencia,
      String((item as any).numAssets || 0),
      formatCurrency(item.custo),
      totalInvestido > 0 ? `${((item.custo / totalInvestido) * 100).toFixed(1)}%` : "0%"
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Posição", "Unidade (Gerência)", "Quantidade de Ativos", "Custo Total Gasto", "% do Total"]],
      body: gerenciaTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    // Table: Custo Real vs Orçado por Período (Média)
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Comparativo de Custo Real vs Orçado por Período (Média Mensal)", 14, currentY);

    const monthlyTotalMap: Record<string, { mesAno: string; real: number; orcado: number; count: number }> = {};
    filteredCustosData.forEach(c => {
      if (!monthlyTotalMap[c.mesAno]) monthlyTotalMap[c.mesAno] = { mesAno: c.mesAno, real: 0, orcado: 0, count: 0 };
      monthlyTotalMap[c.mesAno].real += c.custoReal;
      monthlyTotalMap[c.mesAno].orcado += c.custoOrcado;
      monthlyTotalMap[c.mesAno].count += 1;
    });

    const monthsRef: Record<string, number> = {
      jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
      jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
    };

    const monthlyTotalsList = Object.values(monthlyTotalMap)
      .map(item => ({
        mesAno: item.mesAno,
        real: item.real / (item.count || 1),
        orcado: item.orcado / (item.count || 1)
      }))
      .sort((a, b) => {
        const partsA = a.mesAno.split('/');
        const partsB = b.mesAno.split('/');
        if (partsA.length < 2 || partsB.length < 2) return 0;
        const numAnoA = parseInt(partsA[1]) || 0;
        const numAnoB = parseInt(partsB[1]) || 0;
        if (numAnoA !== numAnoB) return numAnoA - numAnoB;
        return (monthsRef[partsA[0].toLowerCase()] || 0) - (monthsRef[partsB[0].toLowerCase()] || 0);
      });

    const periodTableData = monthlyTotalsList.map(item => {
      const desvio = item.real - item.orcado;
      const desvioPercent = item.orcado > 0 ? `${((desvio / item.orcado) * 100).toFixed(1)}%` : "0.0%";
      return [
        item.mesAno,
        formatCurrency(item.orcado),
        formatCurrency(item.real),
        formatCurrency(desvio),
        desvioPercent
      ];
    });

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Mês/Ano", "Custo Orçado", "Custo Realizado", "Desvio (R$)", "Desvio (%)"]],
      body: periodTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    // Table: Custo Consolidado por Atividade (TAM)
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Custo Consolidado por Tipo de Atividade de Manutenção (TAM)", 14, currentY);

    const tamTableData = costsByTam.map(item => [
      item.tam,
      TAM_DESCRIPTIONS[item.tam] || "Outros",
      String((item as any).count || 0),
      formatCurrency(item.custo)
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Sigla TAM", "Descrição da Atividade", "Quantidade de Manutenções (Col. AT)", "Custo Total"]],
      body: tamTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Table: TOP 10 Maiores Gastos por Ativo - Serviços Realizados
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Top 10 - Maiores Gastos por Ativo (Serviços Realizados)", 14, currentY);

    const top10PdfTableData = top10AssetsServices.map(service => {
      const uniqueKey = `${service.placa}_${service.mesAno}`; 
      const osCount = osCountByPlacaMonth.get(uniqueKey) || 0;
      return [
        service.placa,
        `${service.tam || "S/D"} - ${TAM_DESCRIPTIONS[service.tam] || "Outros"}`,
        formatCurrency(service.custo),
        service.nOrcamento || "N/A",
        service.descricao || "N/A",
        String(osCount)
      ];
    });

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Placa", "Atividade (TAM)", "Custo", "Nº Orçamento", "Descrição", "QTD OS's"]],
      body: top10PdfTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 42 },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 65 },
        5: { cellWidth: 15 }
      }
    });

    // NESTED CHART PAGE (Visual Representation of Charts - requested "tanto excel quanto PDF")
    doc.addPage();
    currentY = 20;
    
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text("Vistas Gráficas de Custos e Desempenho", 14, currentY);
    
    // Draw horizontal bar chart 1: Custo por Tipo
    currentY = drawPdfHorizontalChart("Custos por Tipo de Manutenção", costsByTipo, "value", "name", currentY + 8);
    
    if (currentY > 180) {
      doc.addPage();
      currentY = 20;
    }
    
    // Draw horizontal bar chart 2: Custo por TAM
    currentY = drawPdfHorizontalChart("Custos Consolidados por Atividade (TAM)", costsByTam.slice(0, 8), "custo", "tam", currentY + 10);

    if (currentY > 180) {
      doc.addPage();
      currentY = 20;
    }

    // Draw horizontal bar chart 3: Top 10 Placas de Maiores Custos
    currentY = drawPdfHorizontalChart("Top 5 Ativos de Maiores Custos (Placa)", costsByPlate.slice(0, 5), "custo", "placa", currentY + 10);

    // NEW PAGE: Table QTD de OS's por Placa (TABELA À PARTE)
    doc.addPage();
    currentY = 20;

    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Quantidade de Serviços (OS) por Veículo (Placa) no Período", 14, currentY);

    const qstPlacaPdfData = qtdOsPorPlacaFiltrada.slice(0, 40).map(item => [
      item.placa,
      String(item.qtdOS)
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Placa", "Quantidade de Ordens de Serviço (OS)"]],
      body: qstPlacaPdfData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80, halign: 'center' },
        1: { cellWidth: 80, halign: 'center' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    // Table: Registros de Manutenção (Histórico) - com TAM estendido
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Registros de Manutenção - Histórico (Top 30)", 14, currentY);

    const mntTableData = filteredData.slice(0, 30).map(item => [
      item.ordemServico,
      item.placa,
      item.estabelecimento || "N/A",
      `${item.tam || "S/D"} - ${TAM_DESCRIPTIONS[item.tam] || "Outros"}`,
      formatCurrency(parseFloat(item.total) || 0),
      item.dataConclusaoOS
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Ordem Serv.", "Placa", "Local / Oficina", "Atividade (TAM)", "Total Gasto", "Data Conclusão"]],
      body: mntTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    // Table: Registros de Custos Detalhados - com TAM estendido
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Registros de Custos Detalhados (Top 30)", 14, currentY);

    const costTableData = filteredCustosData.slice(0, 30).map(c => [
      c.placa,
      c.tipo,
      c.mesAno,
      `${c.tam || "S/D"} - ${TAM_DESCRIPTIONS[c.tam] || "Outros"}`,
      formatCurrency(c.custo),
      c.gerencia,
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Placa", "Tipo Manut.", "Mês/Ano", "Atividade (TAM)", "Custo Total", "Gerência"]],
      body: costTableData,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
    });

    doc.save(`Relatorio_Custos_Manutencao_${now.toISOString().split("T")[0]}.pdf`);
    toast.success("PDF de custos gerado com sucesso!");
  };

  const handleExportEverythingExcel = () => {
    const totalInvestido = filteredCustosData.reduce((acc, c) => acc + c.custo, 0);
    const orcadoAcumulado = filteredCustosData.reduce((acc, c) => acc + c.custoOrcado, 0);
    const mediaPorOS = filteredCustosData.length > 0 ? totalInvestido / filteredCustosData.length : 0;

    // Helper to generate the text-based bar charts (Gráficos no Excel)
    const getExcelBar = (value: number, max: number) => {
      if (!max || max <= 0 || !value || value <= 0) return "░░░░░░░░░░";
      const filled = Math.min(10, Math.round((value / max) * 10));
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    // Sheet 1: Resumo Financeiro
    const resumoData = [
      { "Indicador Financeiro": "Montante Investido em Manutenção", "Valor": totalInvestido },
      { "Indicador Financeiro": "Média Financeira por OS", "Valor": mediaPorOS },
      { "Indicador Financeiro": "Custo Orçado Acumulado", "Valor": orcadoAcumulado },
      { "Indicador Financeiro": "Qtd. Orçamentos", "Valor": orcamentosMap.size }
    ];

    // Sheet 2: Custo por Tipo (com Gráfico de Proporção)
    const maxCustoTipo = Math.max(...costsByTipo.map(item => item.value || 0), 1);
    const custoTipoData = costsByTipo.map(item => ({
      "Tipo de Custo": item.name || "Não Especificado",
      "Quantidade de Ativos": item.numAssets || 0,
      "Valor Total Gasto": item.value || 0,
      "Gráfico (Proporção)": getExcelBar(item.value, maxCustoTipo)
    }));

    // Sheet 3: Unidades com Maior Custo (com Gráfico de Proporção)
    const maxCustoGerencia = Math.max(...costsByGerencia.map(item => item.custo || 0), 1);
    const gerenciaTableData = costsByGerencia.map((item, idx) => ({
      "Posição": `${idx + 1}º`,
      "Unidade (Gerência)": item.gerencia,
      "Quantidade de Ativos": item.numAssets || 0,
      "Custo Total Gasto": item.custo || 0,
      "% do Total": totalInvestido > 0 ? `${((item.custo / totalInvestido) * 100).toFixed(1)}%` : "0%",
      "Gráfico (Proporção)": getExcelBar(item.custo, maxCustoGerencia)
    }));

    // Sheet 4: Comparativo Mensal (Real vs Orçado)
    const monthlyTotalMap: Record<string, { mesAno: string; real: number; orcado: number; count: number }> = {};
    filteredCustosData.forEach(c => {
      if (!monthlyTotalMap[c.mesAno]) monthlyTotalMap[c.mesAno] = { mesAno: c.mesAno, real: 0, orcado: 0, count: 0 };
      monthlyTotalMap[c.mesAno].real += c.custoReal;
      monthlyTotalMap[c.mesAno].orcado += c.custoOrcado;
      monthlyTotalMap[c.mesAno].count += 1;
    });

    const monthsRef: Record<string, number> = {
      jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
      jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
    };

    const monthlyTotalsList = Object.values(monthlyTotalMap)
      .map(item => ({
        mesAno: item.mesAno,
        real: item.real / (item.count || 1),
        orcado: item.orcado / (item.count || 1)
      }))
      .sort((a, b) => {
        const partsA = a.mesAno.split('/');
        const partsB = b.mesAno.split('/');
        if (partsA.length < 2 || partsB.length < 2) return 0;
        const numAnoA = parseInt(partsA[1]) || 0;
        const numAnoB = parseInt(partsB[1]) || 0;
        if (numAnoA !== numAnoB) return numAnoA - numAnoB;
        return (monthsRef[partsA[0].toLowerCase()] || 0) - (monthsRef[partsB[0].toLowerCase()] || 0);
      });

    const periodTableData = monthlyTotalsList.map(item => {
      const desvio = item.real - item.orcado;
      const desvioPercent = item.orcado > 0 ? `${((desvio / item.orcado) * 100).toFixed(1)}%` : "0.0%";
      return {
        "Mês/Ano": item.mesAno,
        "Custo Orçado": item.orcado,
        "Custo Realizado": item.real,
        "Desvio (R$)": desvio,
        "Desvio (%)": desvioPercent
      };
    });

    // Sheet 5: Custo Consolidado por Atividade (TAM) (com Gráfico de Proporção)
    const maxCustoTam = Math.max(...costsByTam.map(item => item.custo || 0), 1);
    const tamTableData = costsByTam.map(item => ({
      "Sigla TAM": item.tam,
      "Descrição da Atividade": TAM_DESCRIPTIONS[item.tam] || "Outros",
      "Quantidade de Manutenções (Col. AT)": item.count || 0,
      "Custo Total": item.custo || 0,
      "Gráfico (Proporção)": getExcelBar(item.custo, maxCustoTam)
    }));

    // Sheet 6: TOP 10 Veículos de Maiores Custos (Serviços)
    const top10ExcelData = top10AssetsServices.map(service => {
      const uniqueKey = `${service.placa}_${service.mesAno}`; 
      const osCount = osCountByPlacaMonth.get(uniqueKey) || 0;
      return {
        "Placa": service.placa,
        "TAM (Tipo Atividade de Manutenção)": `${service.tam || "S/D"} - ${TAM_DESCRIPTIONS[service.tam] || "Outros"}`,
        "Custo": service.custo || 0,
        "Nº Orçamento": service.nOrcamento || "N/A",
        "Descrição": service.descricao || "N/A",
        "QTD de OS's (Mês/Ano)": osCount
      };
    });

    // Sheet 7: QTD de OS's por Placa (TABELA À PARTE)
    const maxQtdOS = Math.max(...qtdOsPorPlacaFiltrada.map(item => item.qtdOS || 0), 1);
    const qtdOsExcelData = qtdOsPorPlacaFiltrada.map(item => ({
      "Placa": item.placa,
      "Quantidade de OS's (Período)": item.qtdOS,
      "Gráfico (Proporção)": getExcelBar(item.qtdOS, maxQtdOS)
    }));

    // Sheet 8: Registros de Manutenção (Histórico Completo)
    const mntFullData = filteredData.map(item => {
      const parseNum = (val: string | number) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const clean = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      };
      return {
        "Ordem Serv.": item.ordemServico,
        "Placa": item.placa,
        "Local / Oficina": item.estabelecimento || "N/A",
        "TAM": `${item.tam || "S/D"} - ${TAM_DESCRIPTIONS[item.tam] || "Outros"}`,
        "Total Gasto": parseNum(item.total),
        "Data Conclusão": item.dataConclusaoOS
      };
    });

    // Sheet 9: Registros de Custos Detalhados (Completo)
    const costsDetailsFullData = filteredCustosData.map(c => ({
      "Placa": c.placa,
      "Tipo Manut.": c.tipo,
      "Mês/Ano": c.mesAno,
      "TAM": `${c.tam || "S/D"} - ${TAM_DESCRIPTIONS[c.tam] || "Outros"}`,
      "Custo Total": c.custo || 0,
      "Gerência": c.gerencia,
      "Diretoria": c.diretoria,
      "Nº Orçamento": c.nOrcamento || "N/A",
      "Descrição (Coluna BB)": c.descricao || "N/A"
    }));

    exportToExcelMultiSheet([
      { data: resumoData, sheetName: "Resumo Financeiro" },
      { data: custoTipoData, sheetName: "Custo por Tipo" },
      { data: gerenciaTableData, sheetName: "Custo por Gerência" },
      { data: periodTableData, sheetName: "Comparativo Mensal" },
      { data: tamTableData, sheetName: "Custo por TAM" },
      { data: top10ExcelData, sheetName: "TOP 10 Ativos Serviços" },
      { data: qtdOsExcelData, sheetName: "QTD OS por Placa" },
      { data: mntFullData, sheetName: "Histórico de Manutenções" },
      { data: costsDetailsFullData, sheetName: "Custos Detalhados Completos" }
    ], `Painel_Custos_Manutencao_Completo_${format(new Date(), 'yyyyMMdd')}`);

    toast.success("Excel consolidado gerado com sucesso!");
  };

  // No blocking LoadingState here to keep other tabs accessible and visible instantly.

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5" /> Filtros Avançados</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-1"><Label className="text-xs">Placa</Label><Input placeholder="ABC-1234" value={searchPlaca} onChange={e => setSearchPlaca(e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Mês/Ano Indicadores</Label>
              <Select value={selectedMesAnoIndicadores} onValueChange={setSelectedMesAnoIndicadores}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {mesesAnosDisponiveis.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Diretoria</Label>
              <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {diretoriaOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gerência</Label>
              <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {gerenciaOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TAM</Label>
              <Select value={selectedTam} onValueChange={setSelectedTam}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os TAMs</SelectItem>
                  {availableTams.map(t => <SelectItem key={t} value={t} className="text-xs">{t} - {TAM_DESCRIPTIONS[t] || ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-black text-rose-500">Ciclo de Renovação</Label>
              <Select value={selectedCycleStatus} onValueChange={setSelectedCycleStatus}>
                <SelectTrigger className="text-xs h-9 border-rose-100 bg-rose-50/50"><SelectValue placeholder="Seleção de Ciclo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Frotas (Geral)</SelectItem>
                  <SelectItem value="RENOVACAO">♻️ Sugestão Renovação (CPMV &gt; 70%)</SelectItem>
                  <SelectItem value="MONITORAMENTO">⚠️ Monitoramento (CPMV 40-70%)</SelectItem>
                  <SelectItem value="NORMAL">✅ Normal / Baixo Custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button variant="outline" size="sm" className="h-9 w-full" onClick={() => { setSearchPlaca(""); setSelectedMesAnoIndicadores("all"); setSelectedTam("ALL"); setSelectedDiretoria("all"); setSelectedGerencia("all"); setSelectedCycleStatus("all"); }}><X className="h-4 w-4 mr-2" /> Limpar</Button></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="indicadores" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="h-auto p-1 bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="indicadores" className="py-2 px-4 text-xs font-bold uppercase transition-all">Indicadores de Desempenho</TabsTrigger>
            <TabsTrigger value="historico" className="py-2 px-4 text-xs font-bold uppercase transition-all">Histórico de Manutenção</TabsTrigger>
            <TabsTrigger value="custo" className="py-2 px-4 text-xs font-bold uppercase transition-all">Custo de Manutenção</TabsTrigger>
            <TabsTrigger value="lcc" className="py-2 px-4 text-xs font-bold uppercase transition-all">LCC - Ciclo de Vida</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2 animate-fade-in">
            <Button onClick={handleGenerateHistoryPDF} variant="outline" size="sm" className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 flex items-center font-bold text-xs uppercase h-9">
              <FileText className="h-4 w-4 mr-2" /> Exportar para PDF
            </Button>
            <Button onClick={handleExportEverythingExcel} variant="outline" size="sm" className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 flex items-center font-bold text-xs uppercase h-9">
              <Download className="h-4 w-4 mr-2" /> Exportar para Excel
            </Button>
          </div>
        </div>

        <TabsContent value="lcc" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  📌 📊 RESUMO GERAL DE PARÂMETROS LCC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-indigo-50/50">
                        <TableHead className="text-[10px] font-bold uppercase">Tipo</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-center">Depreciação</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-center">Vida útil</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-center">Residual</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-center">Reposição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { t: "Veículos leves", d: "20%", v: "5 anos", r: "20%", rep: "5%", desc: "Hatch, Picape (Média/Compacta), Furgão" },
                        { t: "Caminhões", d: "10%–20%", v: "5–10 anos", r: "10–20%", rep: "5%", desc: "Basculante, Baú, Cavalo, Simples/Suplem." },
                        { t: "Máquinas", d: "10%", v: "10 anos", r: "10%", rep: "5–7%", desc: "Retroescavadeiras" },
                        { t: "Equip. especiais", d: "10–12,5%", v: "8–10 anos", r: "10%", rep: "5–6%", desc: "Pipa, Guindaste, Munck, Roots, Reboque, Combinado" },
                        { t: "Motos", d: "20–25%", v: "4–5 anos", r: "10–20%", rep: "5%", desc: "Motocicleta Trail" },
                        { t: "Utilitários", d: "20%", v: "6 anos", r: "15%", rep: "5%", desc: "Vans e utilitários de serviço" }
                      ].map((row, i) => (
                        <TableRow key={i} className="hover:bg-indigo-50/30">
                          <TableCell className="text-xs font-medium">
                            <div className="flex flex-col">
                              <span>{row.t}</span>
                              <span className="text-[9px] text-slate-400 font-normal leading-tight">{row.desc}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-center">{row.d}</TableCell>
                          <TableCell className="text-xs text-center">{row.v}</TableCell>
                          <TableCell className="text-xs text-center">{row.r}</TableCell>
                          <TableCell className="text-xs text-center">{row.rep}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-slate-900 border-none shadow-sm relative overflow-hidden group">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">
                  <Calculator className="h-4 w-4" />
                  Indicador CPMV Médio
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-60 italic">Análise de Viabilidade Econômica da Frota</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pt-2 pb-6">
                <div className="relative">
                  <div className="text-6xl font-black text-indigo-950 dark:text-white tabular-nums tracking-tighter">
                    {(compesaAssetsCPMV.reduce((acc, curr) => acc + curr.cpmv, 0) / (compesaAssetsCPMV.length || 1)).toFixed(1)}%
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-4 w-full">
                  <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-xl border border-indigo-100 dark:border-indigo-800/30 text-center">
                    <p className="text-[8px] font-black uppercase text-indigo-400 mb-1">Fórmula LCC</p>
                    <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-200">Σ Custo / Σ Aquisição</p>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-xl border border-indigo-100 dark:border-indigo-800/30 text-center">
                    <p className="text-[8px] font-black uppercase text-indigo-400 mb-1">Status Geral</p>
                    <p className={cn(
                      "text-[10px] font-black",
                      (compesaAssetsCPMV.reduce((acc, curr) => acc + curr.cpmv, 0) / (compesaAssetsCPMV.length || 1)) > 60 ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {(compesaAssetsCPMV.reduce((acc, curr) => acc + curr.cpmv, 0) / (compesaAssetsCPMV.length || 1)) > 60 ? "CRÍTICO" : "ESTÁVEL"}
                    </p>
                  </div>
                </div>
                
                <p className="mt-4 text-[9px] text-indigo-600/60 uppercase tracking-widest font-black text-center max-w-[200px]">
                  Limiar de Renovação Ideal: 40% a 60%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Análise Weibull - Projeção de Falhas" description="Probabilidade de Falha Acumulada vs Idade (Anos)">
               <div className="h-[300px] relative group">
                 <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-6 w-6 rounded-full bg-white/80 border-indigo-200">
                             <Info className="h-3 w-3 text-indigo-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[320px] text-[10px] leading-relaxed p-4 bg-indigo-950 text-white border-none shadow-2xl">
                          <p className="font-bold mb-2 text-indigo-300 uppercase tracking-wider">Cálculo de Confiabilidade (Weibull)</p>
                          <p className="mb-2">A curva é calculada pela fórmula: <code className="bg-white/10 px-1 rounded">F(t) = 1 - e^(- (t/η)^β)</code></p>
                          <ul className="space-y-1 list-disc pl-4">
                            <li><span className="font-bold text-indigo-200">Beta (β):</span> Fator de Forma. β &gt; 1 indica desgaste por idade. Atualmente estimado em 2.5 (elevado).</li>
                            <li><span className="font-bold text-indigo-200">Eta (η):</span> Fator de Escala (Vida Característica). Idade onde 63% da frota falha.</li>
                            <li><span className="font-bold text-indigo-200">Dinâmica:</span> A curva se ajusta conforme a idade média da frota selecionada nos filtros.</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                 </div>
                 <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(() => {
                      const fleetFiltered = assets.filter(a => {
                        const prop = (a.PROPRIEDADE || "").toUpperCase().trim();
                        const isCompesa = prop.includes("COMPESA");
                        const isIpa = prop.includes("IPA");
                        
                        if (selectedDiretoria !== "all" && !((a.DIRETORIA || a["GERÊNCIA"] || "").toString().toUpperCase().includes(selectedDiretoria.toUpperCase()))) return false;
                        if (selectedGerencia !== "all" && !((a.GERENCIA || a["GERÊNCIA"] || "").toString().toUpperCase().includes(selectedGerencia.toUpperCase()))) return false;
                        
                        return isCompesa || isIpa;
                      });

                      const compesaFiltered = fleetFiltered.filter(a => (a.PROPRIEDADE || "").toUpperCase().includes("COMPESA"));
                      const ipaFiltered = fleetFiltered.filter(a => (a.PROPRIEDADE || "").toUpperCase().includes("IPA"));

                      const getAvgAge = (fleet: any[]) => {
                        if (fleet.length === 0) return 6;
                        const sum = fleet.reduce((acc, curr) => {
                          const ano = parseInt(String(curr.ANO || "2020").substring(0,4));
                          return acc + (2026 - (isNaN(ano) ? 2020 : ano));
                        }, 0);
                        return sum / fleet.length;
                      };

                      const avgCompesa = getAvgAge(compesaFiltered);
                      const avgIpa = getAvgAge(ipaFiltered);

                      // Ajustar fatores Weibull dinamicamente com base nos filtros de custo
                      const totalCustoFiltrado = custosData.reduce((acc, c) => acc + c.custo, 0);
                      const custoMedioPorVeiculo = fleetFiltered.length > 0 ? totalCustoFiltrado / fleetFiltered.length : 0;
                      const desgasteAdicional = Math.min(1.5, custoMedioPorVeiculo / 50000); 

                      const data = [];
                      for(let t = 0; t <= 12; t += 0.5) {
                        const etaCompesa = Math.max(4, 9.5 - (avgCompesa / 8) - desgasteAdicional);
                        const etaIpa = Math.max(3, 7.5 - (avgIpa / 8) - desgasteAdicional);
                        
                        const f_compesa = 1 - Math.exp(-Math.pow(t/etaCompesa, 2.5));
                        const f_ipa = 1 - Math.exp(-Math.pow(t/etaIpa, 2.8));
                        
                        data.push({ 
                          name: `${t}y`, 
                          COMPESA: parseFloat((f_compesa * 100).toFixed(1)), 
                          "COMPESA - IPA": parseFloat((f_ipa * 100).toFixed(1)) 
                        });
                      }
                      return data;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} unit="%" />
                      <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      <Line type="monotone" dataKey="COMPESA" stroke="#4f46e5" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="COMPESA - IPA" stroke="#ef4444" strokeWidth={3} dot={false} />
                    </LineChart>
                 </ResponsiveContainer>
               </div>
            </ChartCard>

            <ChartCard title="Curva da Banheira (Bathtub Curve)" description="Taxa de Falha do Ciclo de Vida">
               <div className="h-[300px] relative group">
                 <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-6 w-6 rounded-full bg-white/80 border-indigo-200">
                             <Info className="h-3 w-3 text-indigo-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[320px] text-[10px] leading-relaxed p-4 bg-indigo-950 text-white border-none shadow-2xl">
                          <p className="font-bold mb-2 text-indigo-300 uppercase tracking-wider">Metodologia Trimodal de Falha</p>
                          <p className="mb-2">Representa a taxa de falha (hazard rate) ao longo do tempo:</p>
                          <ol className="space-y-1 list-decimal pl-4">
                            <li><span className="font-bold text-indigo-200">Mortalidade Infantil:</span> Falhas de "ajuste" ou fabricação. Diminui com o tempo.</li>
                            <li><span className="font-bold text-indigo-200">Vida Útil:</span> Período estável com falhas aleatórias. Taxa constante.</li>
                            <li><span className="font-bold text-indigo-200">Desgaste:</span> Envelhecimento dos componentes. Aumenta exponencialmente.</li>
                          </ol>
                          <p className="mt-2 text-indigo-100 italic">O gráfico interage com os filtros refletindo a densidade de Ativos em cada fase do ciclo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                 </div>
                 <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(() => {
                      const fleet = assets.filter(a => {
                        const dirVal = (a.DIRETORIA || a["GERÊNCIA"] || "").toString().toUpperCase();
                        const gerVal = (a.GERENCIA || a["GERÊNCIA"] || "").toString().toUpperCase();
                        if (selectedDiretoria !== "all" && !dirVal.includes(selectedDiretoria.toUpperCase())) return false;
                        if (selectedGerencia !== "all" && !gerVal.includes(selectedGerencia.toUpperCase())) return false;
                        return true;
                      });

                      const sumAges = fleet.reduce((acc, curr) => {
                        const ano = parseInt(String(curr.ANO || "2020").substring(0,4));
                        return acc + (2026 - (isNaN(ano) ? 2020 : ano));
                      }, 0);
                      const avgAge = fleet.length > 0 ? sumAges / fleet.length : 5;
                      
                      const data = [];
                      for(let t = 0.5; t <= 12; t += 0.5) {
                        const early = 8 / Math.pow(t, 0.9);
                        const useful = 1.2;
                        // O fator de desgaste aumenta se a frota média selecionada for velha
                        const wearFactor = 3.5 - (avgAge / 10);
                        const wear = Math.pow(t / (wearFactor > 1 ? wearFactor : 1), 3.5) * 1.5;
                        
                        data.push({ 
                          name: `${t}y`, 
                          "Mortalidade Infantil": parseFloat(early.toFixed(2)),
                          "Vida Útil": parseFloat(useful.toFixed(2)),
                          "Desgaste": parseFloat(wear.toFixed(2)),
                          "Taxa Falha Total": parseFloat((early + useful + wear).toFixed(2))
                        });
                      }
                      return data;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <RechartsTooltip />
                      <Legend verticalAlign="top" align="right" height={36} />
                      <Line type="monotone" dataKey="Taxa Falha Total" stroke="#1e293b" strokeWidth={4} dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="Mortalidade Infantil" stroke="#94a3b8" strokeWidth={1} dot={false} opacity={0.5} />
                      <Line type="monotone" dataKey="Vida Útil" stroke="#94a3b8" strokeWidth={1} dot={false} opacity={0.5} />
                      <Line type="monotone" dataKey="Desgaste" stroke="#94a3b8" strokeWidth={1} dot={false} opacity={0.5} />
                    </LineChart>
                 </ResponsiveContainer>
               </div>
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Veículos COMPESA Propriedade / Operacionais - Análise de CPMV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-[10px] font-black uppercase text-center">Placa</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Modelo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Idade</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Valor Aquisição</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Custo Acumulado</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">CPMV %</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Análise de Ciclo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCPMV.map((item, idx) => (
                      <TableRow key={idx} className={cn("hover:bg-slate-50 transition-colors", item.cpmv > 70 ? "bg-red-50/30" : item.cpmv > 40 ? "bg-amber-50/30" : "")}>
                        <TableCell className="font-black text-[11px] text-center">{item.placa}</TableCell>
                        <TableCell className="text-[10px] font-bold uppercase text-center max-w-[180px] truncate">{item.modelo}</TableCell>
                        <TableCell className="text-center text-[11px] font-bold">{item.age} <span className="text-[9px] opacity-50">ANOS</span></TableCell>
                        <TableCell className="text-center text-[11px] font-medium">R$ {item.valorAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-center text-[11px] font-black text-indigo-700">R$ {item.totalMaint.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={item.cpmv > 70 ? "destructive" : item.cpmv > 40 ? "warning" : "default"} className="font-black text-[10px] h-5 min-w-[50px] justify-center">
                            {item.cpmv.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                           <div className="flex items-center justify-center gap-1.5">
                             {item.cpmv > 70 ? (
                               <Badge className="bg-rose-600 text-white border-none shadow-sm text-[9px] font-black h-5 uppercase px-2">RENOVAÇÃO</Badge>
                             ) : item.cpmv > 40 ? (
                               <Badge className="bg-amber-500 text-white border-none shadow-sm text-[9px] font-black h-5 uppercase px-2">MONITORAR</Badge>
                             ) : (
                               <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 text-[9px] font-black h-5 uppercase px-2">ESTÁVEL</Badge>
                             )}
                             
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <Info className="h-3 w-3 text-slate-400 cursor-help" />
                                 </TooltipTrigger>
                                 <TooltipContent side="left" className="text-[10px] max-w-[220px] bg-slate-900 text-white border-none">
                                   <p className="font-bold mb-1">Raciocínio LCC:</p>
                                   <p>Análise cruza a <span className="text-indigo-300 font-bold">Curva Weibull</span> (probabilidade de falha pela idade) com o <span className="text-indigo-300 font-bold">CPMV</span> (custo vs aquisição). Quando o custo acumulado supera 55% do valor do bem, a manutenção corretiva torna-se antieconômica.</p>
                                 </TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                           </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedCPMV.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-xs uppercase font-bold">
                          Nenhum veículo identificado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação CPMV */}
              {compesaAssetsCPMV.length > cpmvItemsPerPage && (
                <div className="flex items-center justify-between p-4 border-t bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Página {cpmvCurrentPage} de {Math.ceil(compesaAssetsCPMV.length / cpmvItemsPerPage)} ({compesaAssetsCPMV.length} veículos)
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] font-black uppercase"
                      disabled={cpmvCurrentPage === 1}
                      onClick={() => setCpmvCurrentPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] font-black uppercase"
                      disabled={cpmvCurrentPage >= Math.ceil(compesaAssetsCPMV.length / cpmvItemsPerPage)}
                      onClick={() => setCpmvCurrentPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="indicadores" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    "p-4 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 border-none shadow-sm hover:shadow-md transition-all cursor-help w-full rounded-lg"
                  )}
                >
                  <Clock className="h-10 w-10 text-blue-500 mb-2 opacity-80" />
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">MTTR</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">{(mttrData?.averageDays || 0).toFixed(1)}</h3>
                  <p className="text-[11px] font-bold mt-1 text-slate-500">dias</p>
                  <div className={cn("mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold", mttrData.averageDays <= METAS.MTTR ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>Meta: ≤ {METAS.MTTR}d</div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-bold mb-1 border-b pb-1">MTTR - Mean Time To Repair</p>
                  <p className="text-xs">Média de dias que um veículo permanece na oficina para manutenções MCE.</p>
                  <p className="text-[10px] mt-2 italic font-medium opacity-80">Fórmula: (Data Retirada - Data Entrada) / Total de Manutenções</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    "p-4 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 border-none shadow-sm hover:shadow-md transition-all cursor-help w-full rounded-lg"
                  )}
                >
                  <Activity className="h-10 w-10 text-purple-500 mb-2 opacity-80" />
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">MTBF</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">{(mtbfData?.averageDays || 0).toFixed(1)}</h3>
                  <p className="text-[11px] font-bold mt-1 text-slate-500">dias</p>
                  <div className={cn("mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold", mtbfData.averageDays >= METAS.MTBF ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>Meta: ≥ {METAS.MTBF}d</div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-bold mb-1 border-b pb-1">MTBF - Mean Time Between Failures</p>
                  <p className="text-xs">Média de dias que um veículo opera entre falhas (MCE), baseada no período operacional de 30 dias por mês.</p>
                  <p className="text-[10px] mt-2 italic font-medium opacity-80">Fórmula: (Período Operacional - Total Dias Manutenção MCE) / Quantidade de Manutenções MCE</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    "p-4 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 border-none shadow-sm hover:shadow-md transition-all cursor-help w-full rounded-lg"
                  )}
                >
                  <Timer className="h-10 w-10 text-orange-500 mb-2 opacity-80" />
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">MTTA</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">{(mttaData?.averageDays || 0).toFixed(1)}</h3>
                  <p className="text-[11px] font-bold mt-1 text-slate-500">dias</p>
                  <div className={cn("mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold", mttaData.averageDays <= METAS.MTTA ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>Meta: ≤ {METAS.MTTA}d</div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-bold mb-1 border-b pb-1">MTTA - Mean Time To Acknowledge</p>
                  <p className="text-xs">Média de dias entre o envio da OS e sua aprovação.</p>
                  <p className="text-[10px] mt-2 italic font-medium opacity-80">Fórmula: (Data Aprovação - Data Envio) / Total de OS</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    "p-4 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 border-none shadow-sm hover:shadow-md transition-all cursor-help w-full rounded-lg"
                  )}
                >
                  <Gauge className="h-10 w-10 text-emerald-500 mb-2 opacity-80" />
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Disponibilidade Inerente</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">{disponibilidadeOperacional.toFixed(1)}%</h3>
                  <p className="text-[11px] font-bold mt-1 text-slate-500">percentual</p>
                  <div className={cn("mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold", disponibilidadeOperacional >= METAS.DISPONIBILIDADE ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>Meta: ≥ {METAS.DISPONIBILIDADE}%</div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-bold mb-1 border-b pb-1">Disponibilidade Inerente</p>
                  <p className="text-xs">Percentual de tempo que a frota está disponível, considerando apenas falhas funcionais (MCE).</p>
                  <p className="text-[10px] mt-2 italic font-medium opacity-80">Fórmula: MTBF / (MTBF + MTTR) × 100</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="TAM por Tipo de Ativo" description="Distribuição de registros por tipo de veículo">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={countsByTipoAtivo} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={100} />
                  <RechartsTooltip cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} />
                  <Bar dataKey="value" name="Registros" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#64748b' }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="TAM por Qtd de OS" description="Quantidade de ordens de serviço por TAM">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={countsByOS}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="tam" tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis tick={{fontSize: 9}} />
                  <RechartsTooltip cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} />
                  <Bar dataKey="value" name="Qtd OS" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="TAM por Unidade" description="Quantidade de ordens de serviço por Gerência (AL)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={countsByUnidade}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} />
                <YAxis tick={{fontSize: 9}} />
                <RechartsTooltip cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} />
                <Bar dataKey="value" name="Qtd OS" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Frequência Temporal por TAM" description="Quantidade de atendimentos por mês e tipo de atividade">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={temporalTamData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="mesAno" tick={{fontSize: 10, fontWeight: 'bold'}} />
                <YAxis tick={{fontSize: 9}} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                {availableTams.map((tam, idx) => (
                  <Line 
                    key={tam} 
                    type="monotone" 
                    dataKey={tam} 
                    name={tam} 
                    stroke={COLORS[idx % COLORS.length]} 
                    strokeWidth={2} 
                    dot={{r: 3}} 
                    activeDot={{r: 5}}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          
          <Card className="bg-slate-50 dark:bg-slate-900/50 border-dashed border-2">
            <CardHeader className="py-3"><CardTitle className="text-xs uppercase tracking-tight opacity-70">Informação Técnica: TAM (Tipo de Atividade de Manutenção)</CardTitle></CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(TAM_DESCRIPTIONS).map(([k,v]) => (
                  <div key={k} className="p-2 border rounded-xl text-[10px] bg-white dark:bg-slate-800 shadow-sm flex flex-col">
                    <span className="font-black text-blue-600 dark:text-blue-400 mb-1">{k}</span>
                    <span className="text-muted-foreground font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] mt-4 text-muted-foreground italic">* Os cálculos de indicadores excluem TAM MPV conforme regra de negócio.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">Registros de Manutenção</CardTitle>
                <p className="text-xs text-muted-foreground">Listagem detalhada das ordens de serviço executadas</p>
              </div>
              <Button onClick={handleExport} size="sm" variant="outline" className="h-8 text-xs"><Download className="h-3 w-3 mr-2" /> Exportar Relatório</Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px] border-t">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase text-center w-32">O.S.</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-center w-28">Placa</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-center">Local / Oficina</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-center w-24">TAM</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-center w-32">Total Gasto</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-center w-32">Data Conclusão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(0, 200).map((i, idx) => (
                      <TableRow key={`${i.ordemServico}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <TableCell className="text-center font-black text-xs">{i.ordemServico}</TableCell>
                        <TableCell className="text-center font-bold text-xs">{i.placa}</TableCell>
                        <TableCell className="text-[11px] font-medium opacity-80">{i.estabelecimento}</TableCell>
                        <TableCell className="text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-full font-black text-[10px]">{i.tam}</span></TableCell>
                        <TableCell className="text-center font-black text-xs text-green-600 dark:text-green-400">{formatCurrency(i.total)}</TableCell>
                        <TableCell className="text-center text-[10px] font-bold opacity-60">{i.dataConclusaoOS}</TableCell>
                      </TableRow>
                    ))}
                    {filteredData.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground font-medium italic">Nenhum registro encontrado para os filtros aplicados.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="p-3 border-t bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground">Mostrando até 200 de {filteredData.length} registros</p>
                 <p className="text-[10px] font-black uppercase text-indigo-600">Total Filtrado: {formatCurrency(filteredData.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0))}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custo" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Custo de Manutenção por Tipo" description="Distribuição financeira por categoria de custo">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costsByTipo} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={120} />
                  <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="value" name="Custo" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: any) => `R$${(v/1000).toFixed(1)}k` }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Custo Real vs Orçado por Período" description="Comparativo mensal de investimentos">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costsByPeriod}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="mesAno" tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis tick={{fontSize: 9}} tickFormatter={v => `R$${(v/1000)}k`} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={v => [formatCurrency(Number(v)), '']} 
                  />
                  <Legend />
                  <Bar name="Realizado" dataKey="real" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar name="Orçado" dataKey="orcado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Custo Consolidado por Tipo de Atividade de Manutenção" description="Distribuição financeira por tipo de atividade">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costsByTam}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="tam" tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis tick={{fontSize: 9}} tickFormatter={v => `R$${(v/1000)}k`} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={v => [formatCurrency(Number(v)), 'Custo']} 
                  />
                  <Bar dataKey="custo" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Ativos com Maior Consumo por Placa" description="Os 10 veículos com maiores gastos acumulados em manutenção">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costsByPlate} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="placa" type="category" tick={{fontSize: 10, fontWeight: 'bold'}} width={85} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={v => [formatCurrency(Number(v)), 'Custo']} 
                  />
                  <Bar dataKey="custo" fill="#e11d48" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Lista detalhada dos serviços realizados no Top 10 Ativos + Tabela de QTD OS's por Placa */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <CardHeader className="py-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-rose-500" />
                  Serviços Realizados - TOP 10 Ativos com Maiores Gastos
                </CardTitle>
                <p className="text-xs text-muted-foreground">Lista detalhada de serviços realizados nos 10 veículos de maiores custos com base nos filtros aplicados</p>
              </CardHeader>
              <CardContent className="p-0 overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">Placa</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">Tipo Atividade de Manutenção (TAM)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">Custo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">Nº Orçamento</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top10AssetsServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground font-semibold">
                          Nenhum serviço encontrado para os ativos do Top 10 com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      top10AssetsServices.map((service, idx) => {
                        return (
                          <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100 text-center">{service.placa}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-350 text-center">{service.tam} - {TAM_DESCRIPTIONS[service.tam] || 'Outros'}</TableCell>
                            <TableCell className="text-xs font-black text-rose-600 dark:text-rose-400 text-center">{formatCurrency(service.custo)}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-400 text-center">{service.nOrcamento || 'N/A'}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-350 max-w-[250px] truncate text-center mx-auto" title={service.descricao}>{service.descricao || 'N/A'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <CardHeader className="py-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold text-indigo-800 dark:text-indigo-450 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  QTD de OS's por Placa (Período)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Serviços por veículo no intervalo selecionado</p>
              </CardHeader>
              <CardContent className="p-0 overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">Placa</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 py-3 text-center">QTD de OS's (Mês/Ano)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qtdOsPorPlacaFiltrada.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-8 text-center text-xs text-muted-foreground font-semibold">
                          Não há serviços registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      qtdOsPorPlacaFiltrada.slice(0, 50).map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100 text-center">{row.placa}</TableCell>
                          <TableCell className="text-xs font-black text-indigo-600 dark:text-indigo-450 text-center">{row.qtdOS}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Top 10 - Maiores Custos por Unidade (Gerência)" description="Unidades (Gerências - Coluna AL) com maiores gastos acumulados (Coluna AO)">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costsByGerencia} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="gerencia" type="category" tick={{fontSize: 9, fontWeight: 'bold'}} width={110} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(99, 102, 241, 0.1)'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={v => [formatCurrency(Number(v)), 'Custo']} 
                  />
                  <Bar dataKey="custo" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Comparativo Mensal - Real vs Orçado</CardTitle>
                <p className="text-xs text-muted-foreground">Tabela com médias mensais de custo e desvio financeiro</p>
              </CardHeader>
              <CardContent className="p-0 overflow-auto max-h-[290px]">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase text-center py-2">Mês/Ano</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center py-2">Orçado (Média)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center py-2">Realizado (Média)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center py-2">Desvio (R$)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center py-2">Desvio (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const monthlyTotalMap: Record<string, { mesAno: string; real: number; orcado: number; count: number }> = {};
                      filteredCustosData.forEach(c => {
                        if (!monthlyTotalMap[c.mesAno]) monthlyTotalMap[c.mesAno] = { mesAno: c.mesAno, real: 0, orcado: 0, count: 0 };
                        monthlyTotalMap[c.mesAno].real += c.custoReal;
                        monthlyTotalMap[c.mesAno].orcado += c.custoOrcado;
                        monthlyTotalMap[c.mesAno].count += 1;
                      });

                      const monthsRef: Record<string, number> = {
                        jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
                        jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
                      };

                      const sorted = Object.values(monthlyTotalMap)
                        .map(item => ({
                          mesAno: item.mesAno,
                          real: item.real / (item.count || 1),
                          orcado: item.orcado / (item.count || 1)
                        }))
                        .sort((a, b) => {
                          const partsA = a.mesAno.split('/');
                          const partsB = b.mesAno.split('/');
                          if (partsA.length < 2 || partsB.length < 2) return 0;
                          const numAnoA = parseInt(partsA[1]) || 0;
                          const numAnoB = parseInt(partsB[1]) || 0;
                          if (numAnoA !== numAnoB) return numAnoA - numAnoB;
                          return (monthsRef[partsA[0].toLowerCase()] || 0) - (monthsRef[partsB[0].toLowerCase()] || 0);
                        });

                      if (sorted.length === 0) {
                        return <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">Nenhum dado financeiro para o período</TableCell></TableRow>;
                      }

                      return sorted.map((row, idx) => {
                        const desvio = row.real - row.orcado;
                        const desvioPercent = row.orcado > 0 ? (desvio / row.orcado) * 100 : 0;
                        return (
                          <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <TableCell className="text-center text-xs font-black py-2.5">{row.mesAno}</TableCell>
                            <TableCell className="text-center text-xs py-2.5">{formatCurrency(row.orcado)}</TableCell>
                            <TableCell className="text-center text-xs font-bold py-2.5">{formatCurrency(row.real)}</TableCell>
                            <TableCell className={`text-center text-xs font-black py-2.5 ${desvio > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {desvio > 0 ? `+${formatCurrency(desvio)}` : formatCurrency(desvio)}
                            </TableCell>
                            <TableCell className={`text-center text-xs font-black py-2.5 ${desvio > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {desvio > 0 ? `+${desvioPercent.toFixed(1)}%` : `${desvioPercent.toFixed(1)}%`}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-slate-900 border-none shadow-sm flex flex-col justify-between">
               <div>
                 <Label className="text-[10px] font-black uppercase opacity-50 mb-1 block">Montante Investido</Label>
                 <h4 className="text-xl font-black text-green-600">{formatCurrency(filteredCustosData.reduce((acc, c) => acc + c.custo, 0))}</h4>
               </div>
               <DollarSign className="h-4 w-4 text-green-500 opacity-30 self-end" />
            </Card>
            <Card className="p-4 bg-white dark:bg-slate-900 border-none shadow-sm flex flex-col justify-between">
               <div>
                 <Label className="text-[10px] font-black uppercase opacity-50 mb-1 block">Total Orçamentos</Label>
                 <h4 className="text-xl font-black text-slate-800 dark:text-white">{orcamentosMap.size}</h4>
               </div>
               <Package className="h-4 w-4 text-blue-500 opacity-30 self-end" />
            </Card>
            <Card className="p-4 bg-white dark:bg-slate-900 border-none shadow-sm flex flex-col justify-between">
               <div>
                 <Label className="text-[10px] font-black uppercase opacity-50 mb-1 block">Média por OS</Label>
                 <h4 className="text-xl font-black text-slate-800 dark:text-white">
                   {formatCurrency(filteredCustosData.length > 0 ? filteredCustosData.reduce((acc, c) => acc + c.custo, 0) / filteredCustosData.length : 0)}
                 </h4>
               </div>
               <TrendingUp className="h-4 w-4 text-orange-500 opacity-30 self-end" />
            </Card>
            <Card className="p-4 bg-white dark:bg-slate-900 border-none shadow-sm flex flex-col justify-between">
               <div>
                 <Label className="text-[10px] font-black uppercase opacity-50 mb-1 block">Custo Orçado Acumulado</Label>
                 <h4 className="text-xl font-black text-slate-800 dark:text-white">{formatCurrency(filteredCustosData.reduce((acc, c) => acc + c.custoOrcado, 0))}</h4>
               </div>
               <CheckCircle2 className="h-4 w-4 text-green-500 opacity-30 self-end" />
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
