import React, { useState, useMemo } from "react";
import { useAssets, useFuelData } from "@/hooks/useFleetData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { 
  Car, 
  Fuel, 
  AlertTriangle, 
  Gauge, 
  Activity, 
  CheckCircle,
  RefreshCw,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// The 7 Pool plates explicitly listed (including SJD3G34, making exactly the 7 CGF/POOL plates)
const POOL_PLATES = ["PGO0878", "PCN9620", "PCN9300", "SJE0D66", "SJD3G72", "SJD3G34", "SJD3G64"];
const POOL_PLATES_SET = new Set(POOL_PLATES);

export function MonitoramentoFrotaPool() {
  const { data: assets = [], isLoading: isLoadingAssets, refetch: refetchAssets } = useAssets();
  const { data: fuel = [], isLoading: isLoadingFuel, refetch: refetchFuel } = useFuelData();

  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const isLoading = isLoadingAssets || isLoadingFuel;

  // Filter Assets for CGF/POOL plates
  const poolAssets = useMemo(() => {
    return assets.filter(a => {
      const p = String(a.PLACA || "").toUpperCase().trim();
      return POOL_PLATES_SET.has(p);
    });
  }, [assets]);

  // Get unique months/years sorted across fuel data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    fuel.forEach(f => { 
      if (f._monthYear) {
        months.add(f._monthYear); 
      }
    });
    
    return Array.from(months).sort((a, b) => {
      const partsA = a.split("/");
      const partsB = b.split("/");
      if (partsA.length < 2 || partsB.length < 2) return 0;
      const [m1, y1] = partsA.map(Number);
      const [m2, y2] = partsB.map(Number);
      if (y1 !== y2) return y1 - y2;
      return m1 - m2;
    });
  }, [fuel]);

  // Automatically select the latest month once loaded
  useMemo(() => {
    if (availableMonths.length > 0 && selectedMonth === "all" && fuel.length > 0) {
      const latest = availableMonths[availableMonths.length - 1];
      setSelectedMonth(latest);
    }
  }, [availableMonths, fuel, selectedMonth]);

  // Filter fuel data to only transactions of pool plates
  const poolFuel = useMemo(() => {
    return fuel.filter(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      const matchPlate = POOL_PLATES_SET.has(p);
      if (!matchPlate) return false;
      if (selectedMonth === "all") return true;
      return f._monthYear === selectedMonth;
    });
  }, [fuel, selectedMonth]);

  // Precalculate vehicle-specific stats
  const vehicleStats = useMemo(() => {
    const map = new Map<string, { totalLitros: number; totalGasto: number; txCount: number; kmTotal: number; kms: number[] }>();
    
    // Initialize with all 7 plates to guarantee they are monitored
    POOL_PLATES.forEach(p => {
      map.set(p, { totalLitros: 0, totalGasto: 0, txCount: 0, kmTotal: 0, kms: [] });
    });

    poolFuel.forEach(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      if (!p || !POOL_PLATES_SET.has(p)) return;
      
      const current = map.get(p) || { totalLitros: 0, totalGasto: 0, txCount: 0, kmTotal: 0, kms: [] };
      current.totalLitros += f._litros || 0;
      current.totalGasto += f._total || 0;
      current.txCount += 1;
      
      const km = f._kmRodados || 0;
      if (km > 0) {
        current.kmTotal += km;
        current.kms.push(km);
      }
      
      map.set(p, current);
    });

    return map;
  }, [poolFuel]);

  // Compute "Desvios" following standard models
  const desvios = useMemo(() => {
    const list: any[] = [];
    
    poolFuel.forEach(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      if (!p) return;

      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === p);
      if (!asset) return;

      const driver = String(f._driver || f.MOTORISTA || "NÃO IDENTIFICADO").trim().toUpperCase();

      // Desvio de Autonomia
      const autReal = f._autReal || 0;
      const autRef = asset.AUTONOMIA_PADRAO_VAL || 0;
      if (autReal > 0 && autRef > 0) {
        const diffPercent = Math.abs((autReal - autRef) / autRef) * 100;
        if (diffPercent > 30) {
          list.push({
            id: `aut-${f._txId || Math.random()}`,
            placa: p,
            modelo: asset.MODELO || f._vehicleModel || "N/A",
            tipo: "Autonomia",
            descricao: `Autonomia de ${autReal.toFixed(2)} Km/L destoa do padrão de ${autRef} Km/L (${autReal > autRef ? "+" : "-"}${diffPercent.toFixed(1)}%)`,
            data: f._date || f["DATA TRANSACAO"] || "N/A",
            valor: `${autReal.toFixed(2)} Km/L`,
            referencia: `${autRef} Km/L`,
            severity: diffPercent > 50 ? "high" : "medium",
            motorista: driver
          });
        }
      }

      // Desvio de Litros (Tanque estourado)
      const litros = f._litros || 0;
      const lim = asset.CAPACIDADE_TANQUE_VAL || 0;
      if (litros > 0 && lim > 0 && litros > lim) {
        const excesso = litros - lim;
        list.push({
          id: `lit-${f._txId || Math.random()}`,
          placa: p,
          modelo: asset.MODELO || f._vehicleModel || "N/A",
          tipo: "Litros/m³",
          descricao: `Litros abastecidos (${litros}L) superam a capacidade do tanque de (${lim}L) em +${excesso.toFixed(1)}L`,
          data: f._date || f["DATA TRANSACAO"] || "N/A",
          valor: `${litros}L`,
          referencia: `${lim}L`,
          severity: excesso > 15 ? "high" : "medium",
          motorista: driver
        });
      }

      // Desvio de KM/Hora (Odometro/delta)
      const km = f._kmRodados || 0;
      if (km <= 10 && km >= 0 && f._txId) {
        list.push({
          id: `km-${f._txId || Math.random()}`,
          placa: p,
          modelo: asset.MODELO || f._vehicleModel || "N/A",
          tipo: "KM/Hora",
          descricao: `KM percorrido irrisório de ${km} km para abastecimento. Possível cartão passado duplicado ou ociosidade.`,
          data: f._date || f["DATA TRANSACAO"] || "N/A",
          valor: `${km} km`,
          referencia: "> 10 km",
          severity: "high",
          motorista: driver
        });
      } else if (km > 0) {
        const vStat = vehicleStats.get(p);
        if (vStat && vStat.kms.length > 2) {
          const avgKm = vStat.kmTotal / vStat.kms.length;
          const diffPercent = Math.abs((km - avgKm) / avgKm) * 100;
          if (diffPercent > 40) {
            list.push({
              id: `km-dev-${f._txId || Math.random()}`,
              placa: p,
              modelo: asset.MODELO || f._vehicleModel || "N/A",
              tipo: "KM/Hora",
              descricao: `KM percorrido (${km} km) destoa em ${diffPercent.toFixed(1)}% da média histórica de (${avgKm.toFixed(0)} km) deste veículo`,
              data: f._date || f["DATA TRANSACAO"] || "N/A",
              valor: `${km} km`,
              referencia: `${avgKm.toFixed(0)} km`,
              severity: "medium",
              motorista: driver
            });
          }
        }
      }
    });

    return list;
  }, [poolFuel, poolAssets, vehicleStats]);

  // Rankings and Stats for Visual Management (Gestão à Vista)

  // 1. Ranking de Desvios por Veículo (Placa)
  const rankingDesviosVeiculo = useMemo(() => {
    const counts: Record<string, { total: number; high: number; medium: number }> = {};
    POOL_PLATES.forEach(p => {
      counts[p] = { total: 0, high: 0, medium: 0 };
    });

    desvios.forEach(d => {
      const p = String(d.placa).toUpperCase().trim();
      if (counts[p]) {
        counts[p].total += 1;
        if (d.severity === "high") {
          counts[p].high += 1;
        } else {
          counts[p].medium += 1;
        }
      }
    });

    return Object.entries(counts).map(([placa, stats]) => {
      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa);
      return {
        placa,
        modelo: asset?.MODELO || "Mobi",
        total: stats.total,
        high: stats.high,
        medium: stats.medium
      };
    }).sort((a, b) => b.total - a.total);
  }, [desvios, poolAssets]);

  // 2. Ranking de Maior Gasto por Veículo (Placa)
  const rankingGastoVeiculo = useMemo(() => {
    return Array.from(POOL_PLATES_SET).map(placa => {
      const stats = vehicleStats.get(placa) || { totalLitros: 0, totalGasto: 0, txCount: 0 };
      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa);
      return {
        placa,
        modelo: asset?.MODELO || "Mobi",
        totalGasto: stats.totalGasto,
        totalLitros: stats.totalLitros,
        txCount: stats.txCount
      };
    }).sort((a, b) => b.totalGasto - a.totalGasto);
  }, [vehicleStats, poolAssets]);

  // 3. Ranking de Desvios por Motorista
  const rankingDesviosMotorista = useMemo(() => {
    const counts: Record<string, { total: number; high: number; medium: number }> = {};

    desvios.forEach(d => {
      const driver = String(d.motorista || "NÃO IDENTIFICADO").trim().toUpperCase();
      if (!counts[driver]) {
        counts[driver] = { total: 0, high: 0, medium: 0 };
      }
      counts[driver].total += 1;
      if (d.severity === "high") {
        counts[driver].high += 1;
      } else {
        counts[driver].medium += 1;
      }
    });

    return Object.entries(counts).map(([motorista, stats]) => {
      return {
        motorista,
        total: stats.total,
        high: stats.high,
        medium: stats.medium
      };
    }).sort((a, b) => b.total - a.total);
  }, [desvios]);

  // Max Single Abastecimento transaction
  const maxSingleAbast = useMemo(() => {
    return poolFuel.reduce((max, f) => Math.max(max, f._total || 0), 0);
  }, [poolFuel]);

  // Charts data

  // Chart 1: Maior Consumo por Veículo (Litros)
  const rankingMaiorConsumoVeiculo = useMemo(() => {
    const list = Array.from(POOL_PLATES_SET).map(placa => {
      const stats = vehicleStats.get(placa) || { totalLitros: 0, totalGasto: 0, txCount: 0 };
      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa);
      return {
        placa,
        modelo: asset?.MODELO || "Mobi",
        totalLitros: stats.totalLitros,
        totalGasto: stats.totalGasto
      };
    });
    return list.sort((a, b) => b.totalLitros - a.totalLitros);
  }, [vehicleStats, poolAssets]);

  // Chart 2: Maior Gasto por Motorista (R$)
  const rankingMaiorGastoMotorista = useMemo(() => {
    const map = new Map<string, number>();
    poolFuel.forEach(f => {
      const driver = String(f._driver || f.MOTORISTA || "NÃO IDENTIFICADO").trim().toUpperCase();
      const current = map.get(driver) || 0;
      map.set(driver, current + (f._total || 0));
    });
    return Array.from(map.entries())
      .map(([motorista, totalGasto]) => ({ motorista, totalGasto }))
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 5); // top 5
  }, [poolFuel]);

  // Chart 3: Mais Usados (Abastecimentos Realizados)
  const rankingMaisUsados = useMemo(() => {
    const list = Array.from(POOL_PLATES_SET).map(placa => {
      const stats = vehicleStats.get(placa) || { totalLitros: 0, totalGasto: 0, txCount: 0 };
      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa);
      return {
        placa,
        modelo: asset?.MODELO || "Mobi",
        count: stats.txCount
      };
    });
    return list.sort((a, b) => b.count - a.count);
  }, [vehicleStats, poolAssets]);

  const statsCount = useMemo(() => {
    const desviosAut = desvios.filter(d => d.tipo === "Autonomia").length;
    const desviosLit = desvios.filter(d => d.tipo === "Litros/m³").length;
    const desviosKm = desvios.filter(d => d.tipo === "KM/Hora").length;

    const totalLitros = poolFuel.reduce((sum, f) => sum + (f._litros || 0), 0);
    const totalGasto = poolFuel.reduce((sum, f) => sum + (f._total || 0), 0);
    const totalAbast = poolFuel.length;

    const precoMedioLitro = totalLitros > 0 ? totalGasto / totalLitros : 0;
    const gastoMedioAbast = totalAbast > 0 ? totalGasto / totalAbast : 0;

    return {
      desviosAut,
      desviosLit,
      desviosKm,
      totalDesvios: desvios.length,
      totalLitros,
      totalGasto,
      veiculosAtivos: 7, // exactly the 7 pool plates monitored
      abastecimentosCount: totalAbast,
      precoMedioLitro,
      gastoMedioAbast
    };
  }, [desvios, poolFuel]);

  const handleSyncAll = () => {
    refetchAssets();
    refetchFuel();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  // Find max desvios vehicle to highlight in visual management
  const maxDesviosVehicle = rankingDesviosVeiculo[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Gauge className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Monitoramento Frota POOL
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Gestão operacional, auditoria de abastecimentos, verificação de conformidade e controle de consumo das 7 placas do POOL
          </p>
        </div>

        {/* Filters and Sync */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mr-1">Mês de Referência:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-36 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-8 text-xs font-bold text-slate-800 dark:text-slate-200">
                <SelectValue placeholder="Selecione o Mês" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs">
                <SelectItem value="all" className="font-bold">Todos os Meses</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m} className="font-bold">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button 
            onClick={handleSyncAll}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" /> Sincronizar Bases
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-indigo-600">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Veículos POOL</span>
              <span className="text-xl font-black text-slate-800 dark:text-white">{statsCount.veiculosAtivos}</span>
              <span className="text-[9px] font-medium text-slate-400 block">Ativos em CGF/POOL</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-600">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
              <Fuel className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Volume Abastecido</span>
              <span className="text-base font-black text-slate-800 dark:text-white">
                {statsCount.totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
              </span>
              <span className="text-[10px] font-bold text-slate-500 block">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(statsCount.totalGasto)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alertas de Desvio</span>
              <span className="text-xl font-black text-slate-800 dark:text-white">{statsCount.totalDesvios}</span>
              <span className="text-[9px] font-medium text-amber-600 block">
                {statsCount.desviosAut} Autonomia | {statsCount.desviosLit} Tanque
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-purple-600">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Abastecimentos</span>
              <span className="text-xl font-black text-slate-800 dark:text-white">{statsCount.abastecimentosCount}</span>
              <span className="text-[9px] font-medium text-slate-400 block">Transações do Período</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Visual Management Panel (Painel de Custos & Rankings) */}
      <div className="space-y-6">
        
        {/* Painel de Custos (Full width on desktop) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Painel de Custos e Consumo de Combustível (Frota POOL)
                </CardTitle>
                <CardDescription className="text-[11px] font-medium text-slate-500">
                  Resumo de custos consolidados, médias de preço por litro e detalhamento individual dos 7 veículos
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 w-fit">
                Gestão à Vista
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Costs Metrics Cards inside the panel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Preço Médio por Litro</span>
                <span className="text-lg font-black text-slate-800 dark:text-white mt-1">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(statsCount.precoMedioLitro)}
                </span>
                <span className="text-[9px] text-slate-500 mt-1">Média ponderada do Pool</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Méd. por Abastecimento</span>
                <span className="text-lg font-black text-slate-800 dark:text-white mt-1">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(statsCount.gastoMedioAbast)}
                </span>
                <span className="text-[9px] text-slate-500 mt-1">Ticket médio por transação</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Maior Abastecimento Único</span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(maxSingleAbast)}
                </span>
                <span className="text-[9px] text-slate-500 mt-1">Pico máximo registrado</span>
              </div>
            </div>

            {/* Cost table of the 7 plates */}
            <div>
              <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-3 tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Custos Detalhados por Placa Ativa
              </h4>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-lg">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-950">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider py-2.5">Placa</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider py-2.5">Modelo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider py-2.5 text-center">Transações</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider py-2.5 text-right">Volume (L)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider py-2.5 text-right">Custo Total</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider py-2.5 text-right">Preço Médio/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingGastoVeiculo.map((v) => {
                      const avgPrice = v.totalLitros > 0 ? v.totalGasto / v.totalLitros : 0;
                      return (
                        <TableRow key={v.placa} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/5 transition-colors">
                          <TableCell className="font-mono text-xs font-black py-2.5 text-slate-800 dark:text-slate-100">
                            {v.placa}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-bold py-2.5">
                            {v.modelo}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-bold py-2.5 text-center">
                            {v.txCount}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-medium py-2.5 text-right">
                            {v.totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
                          </TableCell>
                          <TableCell className="text-xs font-black py-2.5 text-slate-800 dark:text-slate-100 text-right">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v.totalGasto)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-semibold py-2.5 text-right">
                            {avgPrice > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(avgPrice) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rankings de Gestão à Vista (Horizontal layout) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-indigo-600" />
              Rankings de Gestão à Vista
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-slate-500">
              Identificação rápida de veículos e motoristas com maior incidência de desvios ou custos operacionais
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Ranking 1: Mais Desvios */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Mais Desvios / Alertas
                  </h4>
                </div>
                
                <div className="space-y-2">
                  {rankingDesviosVeiculo.map((item, index) => {
                    const maxTotal = rankingDesviosVeiculo[0]?.total || 1;
                    const percent = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
                    
                    return (
                      <div key={item.placa} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-800 dark:text-slate-200">{item.placa}</span>
                            <span className="text-[10px] text-slate-500">({item.modelo})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-black text-slate-800 dark:text-slate-100">{item.total}</span>
                            <span className="text-[10px] text-slate-400">alertas</span>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.total > 4 
                                ? "bg-rose-500" 
                                : item.total > 1 
                                ? "bg-amber-500" 
                                : item.total > 0
                                ? "bg-indigo-500"
                                : "bg-slate-300 dark:bg-slate-700"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ranking 2: Maior Gasto */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Maior Gasto (Custo Total)
                  </h4>
                </div>

                <div className="space-y-2">
                  {rankingGastoVeiculo.map((item, index) => {
                    const maxCost = rankingGastoVeiculo[0]?.totalGasto || 1;
                    const percent = maxCost > 0 ? (item.totalGasto / maxCost) * 100 : 0;

                    return (
                      <div key={item.placa} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-800 dark:text-slate-200">{item.placa}</span>
                            <span className="text-[10px] text-slate-500">({item.modelo})</span>
                          </div>
                          <span className="font-black text-slate-800 dark:text-slate-100">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(item.totalGasto)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ranking 3: Mais Desvios por Motorista */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                    <Users className="h-4 w-4 text-indigo-500" />
                    Mais Desvios por Motorista
                  </h4>
                </div>

                <div className="space-y-2">
                  {rankingDesviosMotorista.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">
                      Nenhum desvio registrado para motoristas
                    </div>
                  ) : (
                    rankingDesviosMotorista.slice(0, 7).map((item, index) => {
                      const maxTotal = rankingDesviosMotorista[0]?.total || 1;
                      const percent = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;

                      return (
                        <div key={item.motorista} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={item.motorista}>
                              {item.motorista}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="font-black text-slate-800 dark:text-slate-100">{item.total}</span>
                              <span className="text-[10px] text-slate-400">alertas</span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                item.total > 4 
                                  ? "bg-rose-500" 
                                  : item.total > 1 
                                  ? "bg-amber-500" 
                                  : "bg-indigo-500"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Maior Consumo por Veículo */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Fuel className="h-4 w-4 text-emerald-600" />
              Maior Consumo por Veículo
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-slate-500">
              Consumo acumulado das 7 placas do Pool (L)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-80">
            {rankingMaiorConsumoVeiculo.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum abastecimento registrado para os veículos Pool
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingMaiorConsumoVeiculo} margin={{ bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="placa" className="text-[9px] font-black text-slate-500" />
                  <YAxis className="text-[9px] font-bold text-slate-400" label={{ value: "Litros (L)", angle: -90, position: "insideLeft", offset: 0, style: { textAnchor: 'middle', fontSize: '9px', fontWeight: 'bold' } }} />
                  <Tooltip
                    formatter={(value: any) => [`${value.toLocaleString("pt-BR")} L`, "Volume"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                  />
                  <Bar dataKey="totalLitros" name="Volume Total (L)" fill="#059669" radius={[4, 4, 0, 0]}>
                    {rankingMaiorConsumoVeiculo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#047857" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Maior Gasto por Motorista */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Maior Gasto por Motorista
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-slate-500">
              Valor acumulado em abastecimentos do Pool por condutor (R$)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-80">
            {rankingMaiorGastoMotorista.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum gasto registrado para motoristas
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingMaiorGastoMotorista} margin={{ bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="motorista" className="text-[9px] font-black text-slate-500" tickFormatter={(v) => v.split(" ")[0]} />
                  <YAxis className="text-[9px] font-bold text-slate-400" label={{ value: "Valor (R$)", angle: -90, position: "insideLeft", offset: 0, style: { textAnchor: 'middle', fontSize: '9px', fontWeight: 'bold' } }} />
                  <Tooltip
                    formatter={(value: any) => [`${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}`, "Custo Total"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                  />
                  <Bar dataKey="totalGasto" name="Valor Total (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {rankingMaiorGastoMotorista.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#1d4ed8" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mais Usados */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              Mais Usados (Frequência)
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-slate-500">
              Veículos com maior quantidade de abastecimentos no período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-80">
            {rankingMaisUsados.filter(v => v.count > 0).length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhuma utilização cadastrada para veículos Pool
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingMaisUsados.filter(v => v.count > 0)} margin={{ bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="placa" className="text-[9px] font-black text-slate-500" />
                  <YAxis className="text-[9px] font-bold text-slate-400" label={{ value: "Frequência", angle: -90, position: "insideLeft", offset: 0, style: { textAnchor: 'middle', fontSize: '9px', fontWeight: 'bold' } }} />
                  <Tooltip
                    formatter={(value: any) => [value, "Frequência"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                  />
                  <Bar dataKey="count" name="Total Abastecimentos" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {rankingMaisUsados.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#6d28d9" : "#8b5cf6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monitoramento de Desvios List */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Desvios Identificados (Frota POOL)
              </CardTitle>
              <CardDescription className="text-[11px] font-medium text-slate-500">
                Inconsistências em tempo real de autonomia, capacidade volumétrica de tanque e saltos anômalos de KM
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 self-end">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider text-rose-500 border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20">
                {desvios.length} Alertas Ativos
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {desvios.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <span>Nenhum desvio ou anomalia operacional detectado no Pool de veículos! Tudo operacional.</span>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider w-24">Placa</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider w-36">Modelo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider w-24">Data</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider w-32">Tipo de Desvio</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Descrição Técnico-Comportamental</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-right w-24">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {desvios.map((d) => (
                    <TableRow key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      <TableCell className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">{d.placa}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-bold truncate max-w-[140px]" title={d.modelo}>{d.modelo}</TableCell>
                      <TableCell className="text-xs text-slate-500 font-medium">{d.data}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] font-black uppercase tracking-wider ${
                            d.tipo === "Autonomia" 
                              ? "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/20" 
                              : d.tipo === "Litros/m³" 
                              ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" 
                              : "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                          }`}
                        >
                          {d.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {d.descricao}
                      </TableCell>
                      <TableCell className="text-xs font-black text-slate-800 dark:text-slate-100 text-right">
                        {d.valor}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
