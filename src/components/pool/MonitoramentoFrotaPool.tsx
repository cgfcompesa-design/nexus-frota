import React, { useState, useMemo } from "react";
import { useAssets, useFuelData } from "@/hooks/useFleetData";
import { usePoolData } from "@/services/poolService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { 
  Car, 
  Fuel, 
  AlertTriangle, 
  Search, 
  ArrowRight, 
  Gauge, 
  TrendingUp, 
  Activity, 
  Layers, 
  CheckCircle,
  FileSpreadsheet,
  AlertOctagon,
  RefreshCw,
  HelpCircle,
  Calendar
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function MonitoramentoFrotaPool() {
  const { data: assets = [], isLoading: isLoadingAssets, refetch: refetchAssets } = useAssets();
  const { data: fuel = [], isLoading: isLoadingFuel, refetch: refetchFuel } = useFuelData();
  const { data: trips = [], isLoading: isLoadingTrips, refetch: refetchTrips } = usePoolData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "desvio" | "regular" | "inconsistente">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const isLoading = isLoadingAssets || isLoadingFuel || isLoadingTrips;

  // 1. Filter Assets for CGF/POOL (column F COORDENACAO contains "CGF/POOL")
  const poolAssets = useMemo(() => {
    return assets.filter(a => {
      const coord = String(
        a.COORDENACAO || 
        a["COORDENAÇÃO"] || 
        a.COORDENACAO_FROTAS || 
        (a.__raw && a.__raw[5]) || 
        ""
      ).toUpperCase();
      return coord.includes("CGF/POOL") || coord.includes("CGF-POOL");
    });
  }, [assets]);

  // Set of pool asset plates
  const poolAssetPlates = useMemo(() => {
    return new Set(poolAssets.map(a => String(a.PLACA || "").toUpperCase().trim()).filter(Boolean));
  }, [poolAssets]);

  // Get unique months/years sorted across both trips and fuel
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    trips.forEach(t => { if (t.monthYear) months.add(t.monthYear); });
    fuel.forEach(f => { if (f._monthYear) months.add(f._monthYear); });
    
    return Array.from(months).sort((a, b) => {
      const partsA = a.split("/");
      const partsB = b.split("/");
      if (partsA.length < 2 || partsB.length < 2) return 0;
      const [m1, y1] = partsA.map(Number);
      const [m2, y2] = partsB.map(Number);
      if (y1 !== y2) return y1 - y2;
      return m1 - m2;
    });
  }, [trips, fuel]);

  // Automatically select the latest month once loaded
  useMemo(() => {
    if (availableMonths.length > 0 && selectedMonth === "all" && (trips.length > 0 || fuel.length > 0)) {
      const latest = availableMonths[availableMonths.length - 1];
      setSelectedMonth(latest);
    }
  }, [availableMonths, trips, fuel]);

  // 2. Filter fuel data to only transactions of CGF/POOL plates
  const poolFuel = useMemo(() => {
    return fuel.filter(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      const matchPlate = poolAssetPlates.has(p);
      if (!matchPlate) return false;
      if (selectedMonth === "all") return true;
      return f._monthYear === selectedMonth;
    });
  }, [fuel, poolAssetPlates, selectedMonth]);

  // 3. Filter trips/corridas to only those belonging to pool plates (column O)
  const poolTrips = useMemo(() => {
    return trips.filter(t => {
      const p = String(t.placa || "").toUpperCase().trim();
      const matchPlate = poolAssetPlates.has(p);
      if (!matchPlate) return false;
      if (selectedMonth === "all") return true;
      return t.monthYear === selectedMonth;
    });
  }, [trips, poolAssetPlates, selectedMonth]);

  // 4. Precalculate vehicle-specific stats
  const vehicleStats = useMemo(() => {
    const map = new Map<string, { totalLitros: number; totalGasto: number; txCount: number; kmTotal: number; kms: number[] }>();
    
    poolFuel.forEach(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      if (!p) return;
      
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

  // 5. Compute "Desvios" following standard models
  const desvios = useMemo(() => {
    const list: any[] = [];
    
    poolFuel.forEach(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      if (!p) return;

      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === p);
      if (!asset) return;

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
            severity: diffPercent > 50 ? "high" : "medium"
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
          severity: excesso > 15 ? "high" : "medium"
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
          severity: "high"
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
              severity: "medium"
            });
          }
        }
      }
    });

    return list;
  }, [poolFuel, poolAssets, vehicleStats]);

  // 6. Auditoria / Comparação de Placas: Relatório_corrida (Trips) vs Base Abastecimento
  const platesComparison = useMemo(() => {
    // Collect all plates that are in assets, trips or fuel
    const allUniquePlates = new Set<string>();
    
    poolAssets.forEach(a => {
      const p = String(a.PLACA || "").toUpperCase().trim();
      if (p) allUniquePlates.add(p);
    });

    const activeTrips = selectedMonth === "all" ? trips : trips.filter(t => t.monthYear === selectedMonth);
    const activeFuel = selectedMonth === "all" ? fuel : fuel.filter(f => f._monthYear === selectedMonth);

    activeTrips.forEach(t => {
      const p = String(t.placa || "").toUpperCase().trim();
      if (p) allUniquePlates.add(p);
    });

    activeFuel.forEach(f => {
      const p = String(f._placa || f.PLACA || "").toUpperCase().trim();
      if (p) allUniquePlates.add(p);
    });

    const list: any[] = [];

    allUniquePlates.forEach(p => {
      const asset = assets.find(a => String(a.PLACA || "").toUpperCase().trim() === p);
      const isCgfPoolAsset = poolAssets.some(a => String(a.PLACA || "").toUpperCase().trim() === p);
      
      const tripCount = activeTrips.filter(t => String(t.placa || "").toUpperCase().trim() === p).length;
      
      const fuelTxs = activeFuel.filter(f => String(f._placa || f.PLACA || "").toUpperCase().trim() === p);
      const fuelCount = fuelTxs.length;
      const totalLitros = fuelTxs.reduce((sum, f) => sum + (f._litros || 0), 0);
      const totalCostFuel = fuelTxs.reduce((sum, f) => sum + (f._total || 0), 0);
      
      // Skip non-pool plates that had no activity in this period to keep lists clean
      if (!isCgfPoolAsset && tripCount === 0 && fuelCount === 0) {
        return;
      }

      let status: "regular" | "desvio" | "inconsistente" = "regular";
      const alerts: string[] = [];

      // Logic rules for audit
      if (tripCount > 0 && fuelCount === 0 && isCgfPoolAsset) {
        status = "desvio";
        alerts.push("Corrida s/ Abastecimento registrado");
      }
      if (fuelCount > 0 && tripCount === 0 && isCgfPoolAsset) {
        status = "inconsistente";
        alerts.push("Abastecimento s/ Corrida cadastrada");
      }
      if (tripCount > 0 && asset && !isCgfPoolAsset) {
        status = "inconsistente";
        alerts.push("Veículo de outra coordenação rodando no Pool");
      }

      const hasDirectDesvio = desvios.some(d => d.placa === p);
      if (hasDirectDesvio && status === "regular") {
        status = "desvio";
        alerts.push("Possui desvios técnicos (autonomia, litros ou km)");
      }

      list.push({
        placa: p,
        modelo: asset?.MODELO || (isCgfPoolAsset ? "Pool Vehicle" : "Voucher/Táxi"),
        coordenacao: asset ? (asset.COORDENACAO || asset["COORDENAÇÃO"] || asset.GERENCIA || "Cadastrado") : "VOUCHER/TÁXI",
        tripCount,
        fuelCount,
        totalLitros,
        totalCostFuel,
        status,
        alerts
      });
    });

    return list;
  }, [poolAssets, assets, trips, fuel, desvios, selectedMonth]);

  // Filter and search logic
  const filteredComparison = useMemo(() => {
    return platesComparison.filter(item => {
      const matchSearch = 
        item.placa.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.coordenacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.alerts.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));

      if (filterType === "all") return matchSearch;
      return matchSearch && item.status === filterType;
    });
  }, [platesComparison, searchTerm, filterType]);

  // Rankings data
  const rankingMaiorGastoLitros = useMemo(() => {
    const list = Array.from(vehicleStats.entries()).map(([placa, stats]) => {
      const asset = poolAssets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa);
      return {
        placa,
        modelo: asset?.MODELO || "Pool Vehicle",
        totalLitros: stats.totalLitros,
        totalGasto: stats.totalGasto
      };
    });
    return list.sort((a, b) => b.totalLitros - a.totalLitros).slice(0, 7);
  }, [vehicleStats, poolAssets]);

  const rankingMaisUsados = useMemo(() => {
    const list = platesComparison.map(item => ({
      placa: item.placa,
      modelo: item.modelo,
      tripCount: item.tripCount,
      fuelCount: item.fuelCount
    }));
    return list.sort((a, b) => b.tripCount - a.tripCount).slice(0, 7);
  }, [platesComparison]);

  const statsCount = useMemo(() => {
    const desviosAut = desvios.filter(d => d.tipo === "Autonomia").length;
    const desviosLit = desvios.filter(d => d.tipo === "Litros/m³").length;
    const desviosKm = desvios.filter(d => d.tipo === "KM/Hora").length;

    const totalLitros = poolFuel.reduce((sum, f) => sum + (f._litros || 0), 0);
    const totalGasto = poolFuel.reduce((sum, f) => sum + (f._total || 0), 0);

    return {
      desviosAut,
      desviosLit,
      desviosKm,
      totalDesvios: desvios.length,
      totalLitros,
      totalGasto,
      veiculosAtivos: poolAssets.length,
      abastecimentosCount: poolFuel.length,
      corridasCount: poolTrips.length
    };
  }, [desvios, poolFuel, poolAssets, poolTrips]);

  const handleSyncAll = () => {
    refetchAssets();
    refetchFuel();
    refetchTrips();
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

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
            Gestão operacional, auditoria de abastecimentos, verificação de conformidade e cruzamento de dados com corridas
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
        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Veículos POOL</span>
              <span className="text-xl font-black text-slate-800 dark:text-white">{statsCount.veiculosAtivos}</span>
              <span className="text-[9px] font-medium text-slate-400 block">Cadastrados em CGF/POOL</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
              <Fuel className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Litros / Custo</span>
              <span className="text-base font-black text-slate-800 dark:text-white">
                {statsCount.totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
              </span>
              <span className="text-[10px] font-bold text-slate-500 block">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(statsCount.totalGasto)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Desvios de Abastecimento</span>
              <span className="text-xl font-black text-slate-800 dark:text-white">{statsCount.totalDesvios}</span>
              <span className="text-[9px] font-medium text-amber-600 block">
                {statsCount.desviosAut} Autonomia | {statsCount.desviosLit} Tanque
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Corridas do Mês</span>
              <span className="text-xl font-black text-slate-800 dark:text-white">{statsCount.corridasCount}</span>
              <span className="text-[9px] font-medium text-slate-400 block">Registradas no Relatório</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ranking de Maior Gasto de Litros */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Ranking de Maior Gasto de Litros (Maior Litragem)
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-slate-500">
              Veículos POOL com maior consumo acumulado de combustível no período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-80">
            {rankingMaiorGastoLitros.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum abastecimento registrado para veículos Pool
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingMaiorGastoLitros} margin={{ bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="placa" className="text-[10px] font-black text-slate-500" />
                  <YAxis className="text-[10px] font-bold text-slate-400" label={{ value: "Litros (L)", angle: -90, position: "insideLeft", offset: 0, style: { textAnchor: 'middle', fontSize: '10px', fontWeight: 'bold' } }} />
                  <Tooltip
                    formatter={(value: any) => [`${value.toLocaleString("pt-BR")} L`, "Volume"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                  />
                  <Bar dataKey="totalLitros" name="Volume Total (L)" fill="#059669" radius={[4, 4, 0, 0]}>
                    {rankingMaiorGastoLitros.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#047857" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mais Usados (Total de Corridas) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Mais Usados (Corridas Realizadas)
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-slate-500">
              Veículos POOL com maior frequência de agendamentos de corrida executados
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-80">
            {rankingMaisUsados.filter(v => v.tripCount > 0).length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhuma corrida registrada para veículos Pool
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingMaisUsados.filter(v => v.tripCount > 0)} margin={{ bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="placa" className="text-[10px] font-black text-slate-500" />
                  <YAxis className="text-[10px] font-bold text-slate-400" label={{ value: "Nº Corridas", angle: -90, position: "insideLeft", offset: 0, style: { textAnchor: 'middle', fontSize: '10px', fontWeight: 'bold' } }} />
                  <Tooltip
                    formatter={(value: any) => [value, "Corridas"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                  />
                  <Bar dataKey="tripCount" name="Total Corridas" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                    {rankingMaisUsados.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#3730a3" : "#6366f1"} />
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

      {/* Auditoria Cruzada - Placas de Relatório Corrida x Base Abastecimento */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                Auditoria Cruzada (Relatório Corrida vs Abastecimentos)
              </CardTitle>
              <CardDescription className="text-[11px] font-medium text-slate-500">
                Auditoria e comparação das placas registradas na Coluna O do Relatório de Corridas contra a Base de Abastecimentos dos ativos CGF/POOL
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Filtrar placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs h-9 w-full rounded-lg"
                />
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <Button 
                  variant={filterType === "all" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilterType("all")}
                  className="text-[10px] font-bold uppercase tracking-wider h-8 px-2.5 rounded-md"
                >
                  Todos
                </Button>
                <Button 
                  variant={filterType === "regular" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilterType("regular")}
                  className="text-[10px] font-bold uppercase tracking-wider h-8 px-2.5 rounded-md text-emerald-600"
                >
                  Sem Inconsistência
                </Button>
                <Button 
                  variant={filterType === "desvio" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilterType("desvio")}
                  className="text-[10px] font-bold uppercase tracking-wider h-8 px-2.5 rounded-md text-amber-600"
                >
                  Alertas
                </Button>
                <Button 
                  variant={filterType === "inconsistente" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilterType("inconsistente")}
                  className="text-[10px] font-bold uppercase tracking-wider h-8 px-2.5 rounded-md text-rose-600"
                >
                  Irregularidades
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider w-24">Placa</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider w-32">Modelo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider w-36">Coordenação / Setor</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider text-center w-24">Qtd Corridas</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider text-center w-28">Qtd Abastecimentos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider text-right w-24">Vol Abast.</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider text-right w-28">Total Combustível</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-wider w-40">Status Auditoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComparison.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center p-8 text-xs text-slate-400">
                      Nenhum registro encontrado correspondente aos filtros de auditoria cruzada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComparison.map((item) => (
                    <TableRow key={item.placa} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      <TableCell className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">{item.placa}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-bold truncate max-w-[140px]">{item.modelo}</TableCell>
                      <TableCell className="text-xs text-slate-500 font-medium truncate max-w-[150px]" title={item.coordenacao}>{item.coordenacao}</TableCell>
                      <TableCell className="text-center font-bold text-xs">{item.tripCount}</TableCell>
                      <TableCell className="text-center font-bold text-xs">{item.fuelCount}</TableCell>
                      <TableCell className="text-right text-xs font-bold">{item.totalLitros.toFixed(1)} L</TableCell>
                      <TableCell className="text-right text-xs font-black text-slate-800 dark:text-slate-100">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.totalCostFuel)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] font-black uppercase tracking-wider w-fit ${
                              item.status === "regular" 
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" 
                                : item.status === "desvio" 
                                ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" 
                                : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/20"
                            }`}
                          >
                            {item.status === "regular" ? "Regular" : item.status === "desvio" ? "Alerta" : "Irregularidade"}
                          </Badge>
                          {item.alerts.map((alert: string, idx: number) => (
                            <span key={idx} className="text-[9px] font-bold text-rose-500 dark:text-rose-400 block leading-tight">
                              • {alert}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
