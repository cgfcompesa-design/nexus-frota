import { useState, useMemo } from "react";
import { useLocadosData, LocadoData } from "@/hooks/useLocadosData";
import { useVeiculosLocadosDisponiveis, useDisponibilidadeLocados } from "@/hooks/useDisponibilidadeLocados";
import { usePreventiveLocadosData } from "@/hooks/usePreventiveLocadosData";
import { useAssets } from "@/hooks/useFleetData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Search, X, Download, Clock, Car, TrendingUp, TrendingDown, Target, Minus, Wrench, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell } from "recharts";

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", 
  "#FFBB28", "#FF8042", "#0088FE", "#00C49F", "#FFBB28"
];

const STATUS_COLORS: Record<string, string> = {
  "Em Dia": "hsl(var(--success))",
  "A Vencer": "hsl(var(--warning))",
  "Vencido": "hsl(var(--destructive))",
};

export const LocadosDashboard = () => {
  const { data: rawLocados = [], isLoading, isError, refetch } = useLocadosData();
  const { data: veiculosDisponiveisData, isLoading: isLoadingVeiculos, isError: isErrorVeiculos } = useVeiculosLocadosDisponiveis();
  
  const titularPlatesSet = useMemo(() => {
    return new Set(veiculosDisponiveisData?.plates || []);
  }, [veiculosDisponiveisData]);

  // Filter locados by TITULAR (only plates present in titularPlatesSet)
  const locados = useMemo(() => {
    return rawLocados.filter(item => {
      const rawPlaca = String(item.placa || "").trim();
      const cleanPlaca = rawPlaca.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return titularPlatesSet.has(cleanPlaca);
    });
  }, [rawLocados, titularPlatesSet]);

  const { disponibilidade: globalDisp, totalDiasParados: globalDiasParados } = useDisponibilidadeLocados();
  const { data: preventiveLocados = [], isLoading: isLoadingPreventive, isError: isErrorPreventive } = usePreventiveLocadosData();
  const { data: assets = [], isLoading: isLoadingAssets, isError: isErrorAssets } = useAssets();

  // Active tab state
  const [activeTab, setActiveTab] = useState("disponibilidade");

  const hasError = isError || isErrorVeiculos || isErrorPreventive || isErrorAssets;

  // Filter states for Disponibilidade
  const [searchPlaca, setSearchPlaca] = useState("");
  const [selectedDiretoria, setSelectedDiretoria] = useState("all");
  const [selectedGerencia, setSelectedGerencia] = useState("all");
  const [selectedModelo, setSelectedModelo] = useState("all");
  const [selectedPropriedade, setSelectedPropriedade] = useState("all");
  const [selectedMesAno, setSelectedMesAno] = useState("all");

  // Filter states for Preventiva
  const [searchPlacaPreventiva, setSearchPlacaPreventiva] = useState("");
  const [selectedStatusPreventiva, setSelectedStatusPreventiva] = useState("all");
  const [selectedDiretoriaPreventiva, setSelectedDiretoriaPreventiva] = useState("all");
  const [selectedGerenciaPreventiva, setSelectedGerenciaPreventiva] = useState("all");
  const [selectedPropriedadePreventiva, setSelectedPropriedadePreventiva] = useState("all");

  // Create a map from placa to asset info for quick lookups
  const assetInfoMap = useMemo(() => {
    const map = new Map<string, { diretoria: string; gerencia: string; propriedade: string }>();
    assets.forEach(asset => {
      const placa = asset.PLACA || asset.placa || "";
      if (placa) {
        map.set(placa.toUpperCase().replace(/[^A-Z0-9]/g, "").trim(), {
          diretoria: asset.DIRETORIA || "",
          gerencia: asset.GERENCIA || "",
          propriedade: asset.PROPRIEDADE || "",
        });
      }
    });
    return map;
  }, [assets]);

  // Dynamically calculate operational vehicles count based on filters for Disponibilidade
  const veiculosDisponiveisCount = useMemo(() => {
    const rawCount = veiculosDisponiveisData?.count ?? 0;
    if (selectedDiretoria === "all" && selectedGerencia === "all" && selectedPropriedade === "all") {
      return rawCount;
    }
    if (!veiculosDisponiveisData || !veiculosDisponiveisData.plates) return 0;
    
    let count = 0;
    veiculosDisponiveisData.plates.forEach(placaStr => {
      const cleanPlaca = String(placaStr || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
      const asset = assetInfoMap.get(cleanPlaca);
      
      const diretoria = asset?.diretoria || "N/A";
      const gerencia = asset?.gerencia || "N/A";
      const propriedade = asset?.propriedade || "N/A";
      
      const matchDiretoria = selectedDiretoria === "all" || diretoria.toUpperCase() === selectedDiretoria.toUpperCase();
      const matchGerencia = selectedGerencia === "all" || gerencia.toUpperCase() === selectedGerencia.toUpperCase();
      const matchPropriedade = selectedPropriedade === "all" || propriedade.toUpperCase() === selectedPropriedade.toUpperCase();
      
      if (matchDiretoria && matchGerencia && matchPropriedade) {
        count++;
      }
    });
    return count;
  }, [veiculosDisponiveisData, assetInfoMap, selectedDiretoria, selectedGerencia, selectedPropriedade]);

  // Extract unique values for filters
  const diretorias = useMemo(() => {
    const values = locados
      .map(l => l.diretoria)
      .filter(v => v && v !== "N/A");
    return Array.from(new Set(values)).sort();
  }, [locados]);

  const gerencias = useMemo(() => {
    let filtered = locados;
    if (selectedDiretoria !== "all") {
      filtered = filtered.filter(l => l.diretoria === selectedDiretoria);
    }
    const values = filtered
      .map(l => l.gerencia)
      .filter(v => v && v !== "N/A");
    return Array.from(new Set(values)).sort();
  }, [locados, selectedDiretoria]);

  const modelos = useMemo(() => {
    const values = locados
      .map(l => l.modelo)
      .filter(v => v && v !== "N/A");
    return Array.from(new Set(values)).sort();
  }, [locados]);

  const propriedades = useMemo(() => {
    const values = locados
      .map(l => l.propriedade)
      .filter(v => v && v !== "N/A");
    return Array.from(new Set(values)).sort();
  }, [locados]);

  const mesesAnos = useMemo(() => {
    const values = locados.map(l => l.mesAno).filter(Boolean);
    const uniqueValues = Array.from(new Set(values));
    
    // Sort by date
    return uniqueValues.sort((a, b) => {
      const mesesMap: Record<string, number> = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      
      const [mesA, anoA] = (a as string).toLowerCase().split('/');
      const [mesB, anoB] = (b as string).toLowerCase().split('/');
      
      if (!mesA || !anoA || !mesB || !anoB) return 0;
      
      const dateA = new Date(2000 + parseInt(anoA), mesesMap[mesA] || 0);
      const dateB = new Date(2000 + parseInt(anoB), mesesMap[mesB] || 0);
      
      return dateA.getTime() - dateB.getTime();
    });
  }, [locados]);

  // Filter data
  const filteredData = useMemo(() => {
    return locados.filter(item => {
      const matchPlaca = searchPlaca === "" || item.placa.toUpperCase().includes(searchPlaca.toUpperCase());
      const matchDiretoria = selectedDiretoria === "all" || item.diretoria === selectedDiretoria;
      const matchGerencia = selectedGerencia === "all" || item.gerencia === selectedGerencia;
      const matchModelo = selectedModelo === "all" || item.modelo === selectedModelo;
      const matchPropriedade = selectedPropriedade === "all" || item.propriedade === selectedPropriedade;
      const matchMesAno = selectedMesAno === "all" || item.mesAno === selectedMesAno;
      
      return matchPlaca && matchDiretoria && matchGerencia && matchModelo && matchPropriedade && matchMesAno;
    });
  }, [locados, searchPlaca, selectedDiretoria, selectedGerencia, selectedModelo, selectedPropriedade, selectedMesAno]);

  // Metrics calculations with trend comparison
  const metrics = useMemo(() => {
    const totalDiasParados = filteredData.reduce((sum, item) => sum + item.diasParados, 0);
    const totalVeiculos = filteredData.length;
    const mediaDiasParados = totalVeiculos > 0 ? (totalDiasParados / totalVeiculos).toFixed(1) : "0";
    
    // Alinhando com a lógica descrita pelo usuário:
    // Todos os veículos da planilha de ativos têm direito a 30 dias de disponibilidade por mês.
    // Reduzimos o total de dias de indisponibilidade deste total potencial do período.
    const uniqueFilteredMonths = new Set(filteredData.map(item => String(item.mesAno).trim().toLowerCase()).filter(Boolean));
    const monthsCount = selectedMesAno !== "all" ? 1 : Math.max(1, uniqueFilteredMonths.size);
    
    const totalPotentialDays = veiculosDisponiveisCount * 30 * monthsCount;
    
    const disponibilidade = totalPotentialDays > 0 
      ? ((totalPotentialDays - totalDiasParados) / totalPotentialDays) * 100 
      : 0;
    const disponibilidadeFinal = Math.max(0, disponibilidade);
    const metaAtingida = disponibilidadeFinal >= 100;

    // Calcular disponibilidade do período anterior para tendência
    let disponibilidadeAnterior: number | null = null;
    let tendencia: "up" | "down" | "neutral" = "neutral";
    let variacaoPercentual = 0;

    if (selectedMesAno !== "all") {
      // Se um mês específico está selecionado, comparar com o mês anterior
      const mesesMap: Record<string, number> = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      const mesesReverso = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      
      const [mesAtual, anoAtual] = selectedMesAno.toLowerCase().split('/');
      const mesIndex = mesesMap[mesAtual];
      const anoNum = parseInt(anoAtual);
      
      // Calcular mês anterior
      const mesAnteriorIndex = mesIndex === 0 ? 11 : mesIndex - 1;
      const anoAnterior = mesIndex === 0 ? anoNum - 1 : anoNum;
      const mesAnteriorStr = `${mesesReverso[mesAnteriorIndex]}/${anoAnterior.toString().padStart(2, '0')}`;
      
      // Filtrar dados do período anterior com os mesmos filtros
      const dadosAnterior = locados.filter(item => {
        const matchPlaca = searchPlaca === "" || item.placa.toUpperCase().includes(searchPlaca.toUpperCase());
        const matchDiretoria = selectedDiretoria === "all" || item.diretoria === selectedDiretoria;
        const matchGerencia = selectedGerencia === "all" || item.gerencia === selectedGerencia;
        const matchModelo = selectedModelo === "all" || item.modelo === selectedModelo;
        const matchPropriedade = selectedPropriedade === "all" || item.propriedade === selectedPropriedade;
        const matchMesAno = item.mesAno?.toLowerCase() === mesAnteriorStr;
        
        return matchPlaca && matchDiretoria && matchGerencia && matchModelo && matchPropriedade && matchMesAno;
      });
      
      if (dadosAnterior.length > 0) {
        const diasParadosAnterior = dadosAnterior.reduce((sum, item) => sum + item.diasParados, 0);
        const capacidadeMensal = veiculosDisponiveisCount * 30;
        
        disponibilidadeAnterior = capacidadeMensal > 0 
          ? Math.max(0, ((capacidadeMensal - diasParadosAnterior) / capacidadeMensal) * 100)
          : 0;
        
        variacaoPercentual = disponibilidadeFinal - (disponibilidadeAnterior || 0);
        tendencia = variacaoPercentual > 0.1 ? "up" : variacaoPercentual < -0.1 ? "down" : "neutral";
      }
    } else if (mesesAnos.length >= 2) {
      // Se "Todos Meses" está selecionado, comparar os dois últimos meses
      const ultimoMes = mesesAnos[mesesAnos.length - 1];
      const penultimoMes = mesesAnos[mesesAnos.length - 2];
      
      const dadosUltimoMes = locados.filter(item => {
        const matchPlaca = searchPlaca === "" || item.placa.toUpperCase().includes(searchPlaca.toUpperCase());
        const matchDiretoria = selectedDiretoria === "all" || item.diretoria === selectedDiretoria;
        const matchGerencia = selectedGerencia === "all" || item.gerencia === selectedGerencia;
        const matchModelo = selectedModelo === "all" || item.modelo === selectedModelo;
        const matchPropriedade = selectedPropriedade === "all" || item.propriedade === selectedPropriedade;
        return matchPlaca && matchDiretoria && matchGerencia && matchModelo && matchPropriedade && item.mesAno === ultimoMes;
      });
      
      const dadosPenultimoMes = locados.filter(item => {
        const matchPlaca = searchPlaca === "" || item.placa.toUpperCase().includes(searchPlaca.toUpperCase());
        const matchDiretoria = selectedDiretoria === "all" || item.diretoria === selectedDiretoria;
        const matchGerencia = selectedGerencia === "all" || item.gerencia === selectedGerencia;
        const matchModelo = selectedModelo === "all" || item.modelo === selectedModelo;
        const matchPropriedade = selectedPropriedade === "all" || item.propriedade === selectedPropriedade;
        return matchPlaca && matchDiretoria && matchGerencia && matchModelo && matchPropriedade && item.mesAno === penultimoMes;
      });
      
      if (dadosUltimoMes.length > 0 && dadosPenultimoMes.length > 0) {
        const diasParadosUltimo = dadosUltimoMes.reduce((sum, item) => sum + item.diasParados, 0);
        const diasParadosPenultimo = dadosPenultimoMes.reduce((sum, item) => sum + item.diasParados, 0);
        const capacidadeMensal = veiculosDisponiveisCount * 30;
        
        const dispUltimo = capacidadeMensal > 0 
          ? Math.max(0, ((capacidadeMensal - diasParadosUltimo) / capacidadeMensal) * 100)
          : 0;
        disponibilidadeAnterior = capacidadeMensal > 0 
          ? Math.max(0, ((capacidadeMensal - diasParadosPenultimo) / capacidadeMensal) * 100)
          : 0;
        
        variacaoPercentual = dispUltimo - (disponibilidadeAnterior || 0);
        tendencia = variacaoPercentual > 0.1 ? "up" : variacaoPercentual < -0.1 ? "down" : "neutral";
      }
    }
    
    return {
      totalDiasParados,
      totalVeiculos,
      mediaDiasParados,
      disponibilidade: disponibilidadeFinal,
      metaAtingida,
      tendencia,
      variacaoPercentual,
      disponibilidadeAnterior,
    };
  }, [filteredData, veiculosDisponiveisCount, locados, searchPlaca, selectedDiretoria, selectedGerencia, selectedModelo, selectedPropriedade, selectedMesAno, mesesAnos]);

  // Timeline data by Gerência - uses filteredData to respect filters
  const timelineByGerencia = useMemo(() => {
    // Get meses from filtered data
    const mesesFromFiltered = Array.from(new Set(filteredData.map(l => l.mesAno).filter(Boolean)));
    
    // Sort months
    const mesesFiltrados = mesesFromFiltered.sort((a, b) => {
      const mesesMap: Record<string, number> = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      const [mesA, anoA] = (a as string).toLowerCase().split('/');
      const [mesB, anoB] = (b as string).toLowerCase().split('/');
      if (!mesA || !anoA || !mesB || !anoB) return 0;
      const dateA = new Date(2000 + parseInt(anoA), mesesMap[mesA] || 0);
      const dateB = new Date(2000 + parseInt(anoB), mesesMap[mesB] || 0);
      return dateA.getTime() - dateB.getTime();
    });

    // Get unique gerencias from filtered data (excluding N/A)
    const gerenciasUnicas = Array.from(new Set(
      filteredData.filter(l => l.gerencia && l.gerencia !== "N/A").map(l => l.gerencia)
    )).sort();

    // Build timeline data
    const timelineData = mesesFiltrados.map(mesAno => {
      const dataPoint: Record<string, any> = { mesAno };
      
      gerenciasUnicas.forEach(gerencia => {
        const diasParados = filteredData
          .filter(l => l.mesAno === mesAno && l.gerencia === gerencia)
          .reduce((sum, item) => sum + item.diasParados, 0);
        dataPoint[gerencia as string] = diasParados;
      });
      
      return dataPoint;
    });

    return { data: timelineData, gerencias: gerenciasUnicas };
  }, [filteredData]);

  // Timeline data by Propriedade - uses filteredData to respect filters
  const timelineByPropriedade = useMemo(() => {
    // Get meses from filtered data
    const mesesFromFiltered = Array.from(new Set(filteredData.map(l => l.mesAno).filter(Boolean)));
    
    // Sort months
    const mesesFiltrados = mesesFromFiltered.sort((a, b) => {
      const mesesMap: Record<string, number> = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      const [mesA, anoA] = (a as string).toLowerCase().split('/');
      const [mesB, anoB] = (b as string).toLowerCase().split('/');
      if (!mesA || !anoA || !mesB || !anoB) return 0;
      const dateA = new Date(2000 + parseInt(anoA), mesesMap[mesA] || 0);
      const dateB = new Date(2000 + parseInt(anoB), mesesMap[mesB] || 0);
      return dateA.getTime() - dateB.getTime();
    });

    // Get unique propriedades from filtered data (excluding N/A)
    const propriedadesUnicas = Array.from(new Set(
      filteredData.filter(l => l.propriedade && l.propriedade !== "N/A").map(l => l.propriedade)
    )).sort();

    // Build timeline data
    const timelineData = mesesFiltrados.map(mesAno => {
      const dataPoint: Record<string, any> = { mesAno };
      
      propriedadesUnicas.forEach(propriedade => {
        const diasParados = filteredData
          .filter(l => l.mesAno === mesAno && l.propriedade === propriedade)
          .reduce((sum, item) => sum + item.diasParados, 0);
        dataPoint[propriedade as string] = diasParados;
      });
      
      return dataPoint;
    });

    return { data: timelineData, propriedades: propriedadesUnicas };
  }, [filteredData]);

  // Timeline da disponibilidade ao longo dos meses (Comparação Ano a Ano / Mês a Mês)
  const disponibilidadeTimeline = useMemo(() => {
    const mesesMap: Record<string, number> = {
      'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
      'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    };
    const mesesNomesAbreviados = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesesNomesExibicao = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const parseDateForTimeline = (val: any) => {
      if (!val || typeof val !== 'string') return new Date(0);
      const parts = val.toLowerCase().trim().split('/');
      if (parts.length < 2) return new Date(0);
      const [mesRaw, ano] = parts;
      const mes = mesRaw.replace(/[^a-z]/g, "");
      let year = parseInt(ano);
      if (isNaN(year)) return new Date(0);
      if (year < 100) year += 2000;
      return new Date(year, mesesMap[mes] ?? 0);
    };

    // Obter todos os meses da base geral de locados (não filtrada) para determinar o range
    const allMesesFromBase = Array.from(new Set(locados.map(l => l.mesAno).filter(Boolean)));
    
    if (allMesesFromBase.length === 0) {
      return { data: [], years: [2025, 2026] };
    }
    
    // Ordenar para encontrar primeiro e último mês
    const sortedMeses = allMesesFromBase.sort((a, b) => {
      const dateA = parseDateForTimeline(a);
      const dateB = parseDateForTimeline(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Obter todos os anos presentes no dataset
    const uniqueYears = Array.from(new Set(
      locados.map(l => {
        if (!l.mesAno || typeof l.mesAno !== 'string') return null;
        const parts = l.mesAno.split('/');
        if (parts.length < 2) return null;
        let yearNum = parseInt(parts[1]);
        if (isNaN(yearNum)) return null;
        if (yearNum < 100) yearNum += 2000;
        return yearNum;
      }).filter((y): y is number => y !== null)
    )).sort() as number[];

    if (uniqueYears.length === 0) {
      uniqueYears.push(2025, 2026);
    }

    // Para o gráfico de evolução, vamos filtrar por todos os filtros selecionados
    const dataForTimeline = locados.filter(item => {
      const matchPlaca = !searchPlaca || item.placa.toUpperCase().includes(searchPlaca.toUpperCase());
      const matchDiretoria = selectedDiretoria === "all" || item.diretoria === selectedDiretoria;
      const matchGerencia = selectedGerencia === "all" || item.gerencia === selectedGerencia;
      const matchModelo = selectedModelo === "all" || item.modelo === selectedModelo;
      const matchPropriedade = selectedPropriedade === "all" || item.propriedade === selectedPropriedade;
      
      return matchPlaca && matchDiretoria && matchGerencia && matchModelo && matchPropriedade;
    });

    const data = mesesNomesExibicao.map((mesNome, index) => {
      const mesAbrev = mesesNomesAbreviados[index];
      const dataPoint: Record<string, any> = {
        mes: mesNome,
        mesIndex: index,
      };

      // Para cada ano, calculamos a disponibilidade neste mês específico
      uniqueYears.forEach(year => {
        const dadosDoMesAno = dataForTimeline.filter(l => {
          if (!l.mesAno || typeof l.mesAno !== 'string') return false;
          const parts = l.mesAno.toLowerCase().trim().split('/');
          if (parts.length < 2) return false;
          const m = parts[0].replace(/[^a-z]/g, "");
          let y = parseInt(parts[1]);
          if (isNaN(y)) return false;
          if (y < 100) y += 2000;
          return m === mesAbrev && y === year;
        });

        const diasParados = dadosDoMesAno.reduce((sum, item) => sum + (item.diasParados || 0), 0);
        const capacidadeMensal = veiculosDisponiveisCount * 30;
        const disponibilidade = capacidadeMensal > 0
          ? Math.max(0, ((capacidadeMensal - diasParados) / capacidadeMensal) * 100)
          : 100;

        // Limitar se o mês-ano está além do limite máximo de dados disponíveis no banco (para não mostrar linhas flat no futuro)
        const latestYearMonthLimit = sortedMeses[sortedMeses.length - 1];
        const limitDate = parseDateForTimeline(latestYearMonthLimit);
        const currentMonthDate = new Date(year, index);

        if (currentMonthDate <= limitDate) {
          dataPoint[`disp_${year}`] = Number(disponibilidade.toFixed(1));
          dataPoint[`diasParados_${year}`] = diasParados;
        }
      });

      return dataPoint;
    });

    return { data, years: uniqueYears };
  }, [locados, veiculosDisponiveisCount, searchPlaca, selectedDiretoria, selectedGerencia, selectedModelo, selectedPropriedade]);

  // Preventiva data processing
  const statusPreventiva = useMemo(() => {
    const statuses = preventiveLocados
      .map(p => p.statusRevisao)
      .filter(s => s && s.trim() !== "");
    return Array.from(new Set(statuses)).sort();
  }, [preventiveLocados]);

  // Extract unique diretorias, gerencias, propriedades from assets based on placas in preventiveLocados
  const preventivaFilterOptions = useMemo(() => {
    const diretorias = new Set<string>();
    const gerencias = new Set<string>();
    const propriedades = new Set<string>();

    preventiveLocados.forEach(p => {
      const assetInfo = assetInfoMap.get(p.placa.toUpperCase());
      if (assetInfo) {
        if (assetInfo.diretoria) diretorias.add(assetInfo.diretoria);
        if (assetInfo.gerencia) gerencias.add(assetInfo.gerencia);
        if (assetInfo.propriedade) propriedades.add(assetInfo.propriedade);
      }
    });

    return {
      diretorias: Array.from(diretorias).sort(),
      gerencias: Array.from(gerencias).sort(),
      propriedades: Array.from(propriedades).sort(),
    };
  }, [preventiveLocados, assetInfoMap]);

  // Filter gerencias based on selected diretoria for preventiva
  const gerenciasPreventiva = useMemo(() => {
    if (selectedDiretoriaPreventiva === "all") {
      return preventivaFilterOptions.gerencias;
    }
    const gerenciasSet = new Set<string>();
    preventiveLocados.forEach(p => {
      const assetInfo = assetInfoMap.get(p.placa.toUpperCase());
      if (assetInfo && assetInfo.diretoria === selectedDiretoriaPreventiva && assetInfo.gerencia) {
        gerenciasSet.add(assetInfo.gerencia);
      }
    });
    return Array.from(gerenciasSet).sort();
  }, [preventiveLocados, assetInfoMap, selectedDiretoriaPreventiva, preventivaFilterOptions.gerencias]);

  const filteredPreventiva = useMemo(() => {
    return preventiveLocados.filter(item => {
      const matchPlaca = searchPlacaPreventiva === "" || 
        item.placa.toUpperCase().includes(searchPlacaPreventiva.toUpperCase());
      const matchStatus = selectedStatusPreventiva === "all" || 
        item.statusRevisao === selectedStatusPreventiva;

      // Get asset info for diretoria/gerencia/propriedade filtering
      const assetInfo = assetInfoMap.get(item.placa.toUpperCase());
      const matchDiretoria = selectedDiretoriaPreventiva === "all" || 
        assetInfo?.diretoria === selectedDiretoriaPreventiva;
      const matchGerencia = selectedGerenciaPreventiva === "all" || 
        assetInfo?.gerencia === selectedGerenciaPreventiva;
      const matchPropriedade = selectedPropriedadePreventiva === "all" || 
        assetInfo?.propriedade === selectedPropriedadePreventiva;

      return matchPlaca && matchStatus && matchDiretoria && matchGerencia && matchPropriedade;
    });
  }, [preventiveLocados, searchPlacaPreventiva, selectedStatusPreventiva, selectedDiretoriaPreventiva, selectedGerenciaPreventiva, selectedPropriedadePreventiva, assetInfoMap]);

  const preventivaMetrics = useMemo(() => {
    const total = filteredPreventiva.length;
    const emDia = filteredPreventiva.filter(p => p.statusRevisao?.toLowerCase().includes("em dia")).length;
    const aVencer = filteredPreventiva.filter(p => p.statusRevisao?.toLowerCase().includes("vencer")).length;
    const vencido = filteredPreventiva.filter(p => p.statusRevisao?.toLowerCase().includes("vencid")).length;
    const percentualEmDia = total > 0 ? (emDia / total) * 100 : 0;
    const metaAtingida = percentualEmDia >= 90;

    return { total, emDia, aVencer, vencido, percentualEmDia, metaAtingida };
  }, [filteredPreventiva]);

  const preventivaChartData = useMemo(() => {
    const statusCount: Record<string, number> = {};
    filteredPreventiva.forEach(p => {
      const status = p.statusRevisao || "Sem Status";
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
  }, [filteredPreventiva]);

  const handleClearFilters = () => {
    setSearchPlaca("");
    setSelectedDiretoria("all");
    setSelectedGerencia("all");
    setSelectedModelo("all");
    setSelectedPropriedade("all");
    setSelectedMesAno("all");
  };

  const handleClearPreventivaFilters = () => {
    setSearchPlacaPreventiva("");
    setSelectedStatusPreventiva("all");
    setSelectedDiretoriaPreventiva("all");
    setSelectedGerenciaPreventiva("all");
    setSelectedPropriedadePreventiva("all");
  };

  const hasActiveFilters = searchPlaca !== "" || selectedDiretoria !== "all" || selectedGerencia !== "all" || 
    selectedModelo !== "all" || selectedPropriedade !== "all" || selectedMesAno !== "all";

  const hasActivePreventivaFilters = searchPlacaPreventiva !== "" || selectedStatusPreventiva !== "all" || 
    selectedDiretoriaPreventiva !== "all" || selectedGerenciaPreventiva !== "all" || selectedPropriedadePreventiva !== "all";

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => ({
      "Diretoria": item.diretoria,
      "Gerência": item.gerencia,
      "Placa": item.placa,
      "Marca": item.marca,
      "Modelo": item.modelo,
      "Propriedade": item.propriedade,
      "Dias Parados": item.diasParados,
      "Mês/Ano": item.mesAno,
    }));

    exportToExcel(dataToExport, `Veiculos_Locados_${new Date().toISOString().split('T')[0]}`, "Locados");
    toast.success("Dados exportados com sucesso!");
  };

  const handleExportPreventivaExcel = () => {
    const dataToExport = filteredPreventiva.map(item => ({
      "Placa": item.placa,
      "Odômetro Revisão": item.odometroRevisao,
      "Revisão Prevista": item.revisaoPrevista,
      "Data Revisão": item.dataRevisao,
      "Odômetro Atual": item.odometroAtual,
      "Status Revisão": item.statusRevisao,
    }));

    exportToExcel(dataToExport, `Preventiva_Locados_${new Date().toISOString().split('T')[0]}`, "Preventiva");
    toast.success("Dados exportados com sucesso!");
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("em dia")) return "default";
    if (statusLower.includes("vencer")) return "secondary";
    if (statusLower.includes("vencid")) return "destructive";
    return "outline";
  };

  // No page-blocking loading screen to keep tabs accessible immediately

  if (hasError) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-12">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200/50">
          <AlertTriangle size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Falha na Sincronização</h2>
          <p className="text-slate-500 max-w-md mx-auto font-medium">Ops! Não conseguimos conectar com os servidores de dados da Compesa. Verifique sua conexão ou tente novamente.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl border-2 font-black uppercase tracking-widest text-xs h-12 px-8">
            Recarregar App
          </Button>
          <Button onClick={() => refetch()} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs h-12 px-8 shadow-xl shadow-slate-200 dark:shadow-none">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="disponibilidade">Histórico de Disponibilidade</TabsTrigger>
        <TabsTrigger value="preventiva">Controle Preventiva</TabsTrigger>
      </TabsList>

      {/* Tab: Histórico de Disponibilidade */}
      <TabsContent value="disponibilidade" className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Dias Parados"
          value={metrics.totalDiasParados.toLocaleString('pt-BR')}
          icon={<Clock className="h-5 w-5" />}
          description="Soma total de dias parados"
          centered={true}
        />
        <MetricCard
          title="Média por Registro"
          value={`${metrics.mediaDiasParados} dias`}
          icon={<TrendingUp className="h-5 w-5" />}
          description="Média de dias parados por registro"
          centered={true}
        />
        <MetricCard
          title="Total de Registros"
          value={metrics.totalVeiculos.toString()}
          icon={<Car className="h-5 w-5" />}
          description="Registros de indisponibilidade"
          centered={true}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className={`shadow-card hover:shadow-card-hover transition-shadow duration-200 cursor-help ${metrics.metaAtingida ? 'bg-gradient-to-br from-success/10 to-success/5 border-success/20' : 'bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="w-full flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2">
                      <Target className={`h-4 w-4 ${metrics.metaAtingida ? 'text-success' : 'text-destructive'}`} />
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Disponibilidade Locados
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col justify-center items-center min-h-[120px] text-center">
                  <div className={`text-4xl font-black ${metrics.metaAtingida ? 'text-success' : 'text-destructive'}`}>
                    {(metrics.disponibilidade || 0).toFixed(1)}%
                  </div>
                  <div className="flex flex-col items-center gap-1 mt-3">
                    {metrics.disponibilidadeAnterior !== null && (
                      <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-full border border-border/50">
                        {metrics.tendencia === "up" && <TrendingUp className="h-3 w-3 text-success" />}
                        {metrics.tendencia === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
                        {metrics.tendencia === "neutral" && <Minus className="h-3 w-3 text-muted-foreground" />}
                        <span className={`text-[10px] font-bold ${
                          metrics.tendencia === "up" ? "text-success" : 
                          metrics.tendencia === "down" ? "text-destructive" : 
                          "text-muted-foreground"
                        }`}>
                          {(metrics.variacaoPercentual || 0) > 0 ? "+" : ""}{(metrics.variacaoPercentual || 0).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">Meta: 100%</span>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-1 text-sm">
                <p><strong>Cálculo Realizado conforme solicitado:</strong></p>
                <p>Veículos Ativos Operacionais: <strong>{veiculosDisponiveisCount}</strong></p>
                <p>Dias Parados Acumulados: <strong>{metrics.totalDiasParados}</strong></p>
                <p>Capacidade Potencial (Dias): <strong>{veiculosDisponiveisCount * 30 * (selectedMesAno !== "all" ? 1 : Math.max(1, new Set(filteredData.map(i => i.mesAno).filter(Boolean)).size))}</strong></p>
                <p className="text-xs text-muted-foreground mt-2">
                  ((Veículos × 30 × Meses) - Dias Parados) / (Veículos × 30 × Meses) × 100
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Search Placa */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar Placa..."
                value={searchPlaca}
                onChange={(e) => setSearchPlaca(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Diretoria */}
            <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
              <SelectTrigger>
                <SelectValue placeholder="Diretoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Diretorias</SelectItem>
                {diretorias.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Gerência */}
            <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
              <SelectTrigger>
                <SelectValue placeholder="Gerência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Gerências</SelectItem>
                {gerencias.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Modelo */}
            <Select value={selectedModelo} onValueChange={setSelectedModelo}>
              <SelectTrigger>
                <SelectValue placeholder="Modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Modelos</SelectItem>
                {modelos.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Propriedade */}
            <Select value={selectedPropriedade} onValueChange={setSelectedPropriedade}>
              <SelectTrigger>
                <SelectValue placeholder="Propriedade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Propriedades</SelectItem>
                {propriedades.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mês/Ano */}
            <Select value={selectedMesAno} onValueChange={setSelectedMesAno}>
              <SelectTrigger>
                <SelectValue placeholder="Mês/Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Meses</SelectItem>
                {mesesAnos.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disponibilidade Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução da Disponibilidade dos Locados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={disponibilidadeTimeline.data}>
                <defs>
                  {disponibilidadeTimeline.years.map((year) => {
                    const color = year === 2026 ? "#10b981" : (year === 2025 ? "#3b82f6" : "#f59e0b");
                    return (
                      <linearGradient key={year} id={`gradient_${year}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} className="fill-muted-foreground" />
                <YAxis 
                  fontSize={11} 
                  domain={[dataMin => Math.max(0, Math.min(80, Math.floor(dataMin - 5))), 105]} 
                  tickFormatter={(v) => `${v}%`} 
                  className="fill-muted-foreground" 
                />
                <RechartsTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wider">{label}</p>
                          <div className="space-y-1.5">
                            {payload.map((p) => {
                              const yearStr = p.dataKey?.replace('disp_', '');
                              const colorStr = p.color;
                              const val = p.value;
                              const diasParadosStr = p.payload[`diasParados_${yearStr}`];
                              return (
                                <div key={p.dataKey} className="flex flex-col border-t border-slate-100 dark:border-white/5 pt-1.5 first:border-0 first:pt-0">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorStr }} />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ano {yearStr}:</span>
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">{val}%</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground pl-4">
                                    Dias Parados: {diasParadosStr !== undefined ? diasParadosStr : 0} dias
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={100} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Meta 100%', fill: 'hsl(var(--destructive))', fontSize: 10, position: 'top' }} />
                
                {disponibilidadeTimeline.years.map((year) => {
                  const color = year === 2026 ? "#10b981" : (year === 2025 ? "#3b82f6" : "#f59e0b");
                  return (
                    <Area
                      key={year}
                      type="monotone"
                      name={`Ano 20${String(year).slice(-2)}`}
                      dataKey={`disp_${year}`}
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#gradient_${year})`}
                      connectNulls={true}
                      dot={{ r: 3, fill: color }}
                      activeDot={{ r: 5 }}
                    />
                  );
                })}
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart by Gerência */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dias Parados por Gerência (Linha Temporal)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={timelineByGerencia.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mesAno" fontSize={12} />
                  <YAxis fontSize={12} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {timelineByGerencia.gerencias.map((gerencia, index) => (
                    <Line
                      key={gerencia}
                      type="monotone"
                      dataKey={gerencia}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart by Propriedade */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dias Parados por Propriedade (Linha Temporal)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={timelineByPropriedade.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mesAno" fontSize={12} />
                  <YAxis fontSize={12} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {timelineByPropriedade.propriedades.map((propriedade, index) => (
                    <Line
                      key={propriedade}
                      type="monotone"
                      dataKey={propriedade}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            Indisponibilidade de Veículos Locados ({filteredData.length} registros)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Diretoria</TableHead>
                  <TableHead className="text-center">Gerência</TableHead>
                  <TableHead className="text-center">Placa</TableHead>
                  <TableHead className="text-center">Marca</TableHead>
                  <TableHead className="text-center">Modelo</TableHead>
                  <TableHead className="text-center">Propriedade</TableHead>
                  <TableHead className="text-center">Dias Parados</TableHead>
                  <TableHead className="text-center">Mês/Ano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, index) => (
                    <TableRow 
                      key={`${item.placa}-${item.mesAno}-${index}`}
                      className={item.diasParados > 15 ? "bg-destructive/10" : ""}
                    >
                      <TableCell className="text-center">{item.diretoria || "N/A"}</TableCell>
                      <TableCell className="text-center">{item.gerencia || "N/A"}</TableCell>
                      <TableCell className="text-center font-medium">{item.placa}</TableCell>
                      <TableCell className="text-center">{item.marca || "N/A"}</TableCell>
                      <TableCell className="text-center">{item.modelo || "N/A"}</TableCell>
                      <TableCell className="text-center">{item.propriedade || "N/A"}</TableCell>
                      <TableCell className={`text-center font-semibold ${item.diasParados > 15 ? "text-destructive" : ""}`}>
                        {item.diasParados}
                      </TableCell>
                      <TableCell className="text-center">{item.mesAno}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      </TabsContent>

      {/* Tab: Controle Preventiva */}
      <TabsContent value="preventiva" className="space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total de Veículos"
            value={preventivaMetrics.total.toString()}
            icon={<Car className="h-5 w-5" />}
            description="Veículos no controle preventivo"
            centered={true}
          />
          <MetricCard
            title="Em Dia"
            value={preventivaMetrics.emDia.toString()}
            icon={<CheckCircle2 className="h-5 w-5 text-success" />}
            description="Revisões em dia"
            centered={true}
          />
          <MetricCard
            title="A Vencer"
            value={preventivaMetrics.aVencer.toString()}
            icon={<AlertTriangle className="h-5 w-5 text-warning" />}
            description="Revisões a vencer"
            centered={true}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className={`shadow-card hover:shadow-card-hover transition-shadow duration-200 cursor-help ${preventivaMetrics.metaAtingida ? 'bg-gradient-to-br from-success/10 to-success/5 border-success/20' : 'bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20'}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="w-full flex flex-col items-center">
                      <div className="flex items-center justify-center gap-2">
                        <Wrench className={`h-4 w-4 ${preventivaMetrics.metaAtingida ? 'text-success' : 'text-destructive'}`} />
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Cumprimento Preventiva
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col justify-center items-center min-h-[120px] text-center">
                    <div className={`text-4xl font-black ${preventivaMetrics.metaAtingida ? 'text-success' : 'text-destructive'}`}>
                      {preventivaMetrics.percentualEmDia.toFixed(1)}%
                    </div>
                    <div className="flex flex-col items-center gap-1 mt-3">
                      <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">Meta: 90%</span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1 text-sm">
                  <p><strong>Cálculo:</strong></p>
                  <p>Em Dia: <strong>{preventivaMetrics.emDia}</strong></p>
                  <p>Total: <strong>{preventivaMetrics.total}</strong></p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ({preventivaMetrics.emDia} / {preventivaMetrics.total}) × 100
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Search Placa */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar Placa..."
                  value={searchPlacaPreventiva}
                  onChange={(e) => setSearchPlacaPreventiva(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Diretoria */}
              <Select value={selectedDiretoriaPreventiva} onValueChange={(v) => {
                setSelectedDiretoriaPreventiva(v);
                setSelectedGerenciaPreventiva("all"); // Reset gerencia when diretoria changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Diretoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Diretorias</SelectItem>
                  {preventivaFilterOptions.diretorias.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Gerência */}
              <Select value={selectedGerenciaPreventiva} onValueChange={setSelectedGerenciaPreventiva}>
                <SelectTrigger>
                  <SelectValue placeholder="Gerência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Gerências</SelectItem>
                  {gerenciasPreventiva.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Propriedade */}
              <Select value={selectedPropriedadePreventiva} onValueChange={setSelectedPropriedadePreventiva}>
                <SelectTrigger>
                  <SelectValue placeholder="Propriedade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Propriedades</SelectItem>
                  {preventivaFilterOptions.propriedades.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Revisão */}
              <Select value={selectedStatusPreventiva} onValueChange={setSelectedStatusPreventiva}>
                <SelectTrigger>
                  <SelectValue placeholder="Status Revisão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  {statusPreventiva.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActivePreventivaFilters && (
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={handleClearPreventivaFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart: Status Revisão */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status de Revisão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                  <Pie
                    data={preventivaChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {preventivaChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Controle de Manutenção Preventiva ({filteredPreventiva.length} registros)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportPreventivaExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Placa</TableHead>
                    <TableHead className="text-center">Odômetro Revisão</TableHead>
                    <TableHead className="text-center">Revisão Prevista</TableHead>
                    <TableHead className="text-center">Data Revisão</TableHead>
                    <TableHead className="text-center">Odômetro Atual</TableHead>
                    <TableHead className="text-center">Status Revisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPreventiva.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPreventiva.map((item, index) => (
                      <TableRow key={`${item.placa}-${index}`}>
                        <TableCell className="text-center font-medium">{item.placa}</TableCell>
                        <TableCell className="text-center">{item.odometroRevisao || "-"}</TableCell>
                        <TableCell className="text-center">{item.revisaoPrevista || "-"}</TableCell>
                        <TableCell className="text-center">{item.dataRevisao || "-"}</TableCell>
                        <TableCell className="text-center">{item.odometroAtual || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getStatusBadgeVariant(item.statusRevisao)}>
                            {item.statusRevisao || "Sem Status"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
