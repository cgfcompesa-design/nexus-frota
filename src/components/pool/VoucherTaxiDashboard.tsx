import { usePoolData } from "@/services/poolService";
import { getDashboardCards, getUnidadeRanking, getUsuarioRanking, getVehicleRanking, AnalyticsSummary, RankingItem, VehicleRankingItem } from "./poolAnalytics";
import { DashboardCards } from "./DashboardCards";
import { UnidadeRanking } from "./UnidadeRanking";
import { UsuarioRanking } from "./UsuarioRanking";
import { TopCusto } from "./TopCusto";
import { TopKm } from "./TopKm";
import { TopConsumo } from "./TopConsumo";
import { CorridasRanking } from "./CorridasRanking";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import { Calendar, RefreshCw, BarChart3, Users, Car, Map, Fuel, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function VoucherTaxiDashboard() {
  const { data: trips = [], isLoading, isError, refetch } = usePoolData();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Get unique months/years sorted
  const availableMonths = useMemo(() => {
    const months = new Set(trips.map(t => t.monthYear).filter(Boolean));
    return Array.from(months).sort((a, b) => {
      const [m1, y1] = a.split("/").map(Number);
      const [m2, y2] = b.split("/").map(Number);
      if (y1 !== y2) return y1 - y2;
      return m1 - m2;
    });
  }, [trips]);

  // Automatically select the latest month once loaded
  useMemo(() => {
    if (availableMonths.length > 0 && selectedMonth === "all" && trips.length > 0) {
      // Find the last month/year in the list
      const latest = availableMonths[availableMonths.length - 1];
      setSelectedMonth(latest);
    }
  }, [availableMonths, trips]);

  // Filter trips by month
  const filteredTrips = useMemo(() => {
    if (selectedMonth === "all") return trips;
    return trips.filter(t => t.monthYear === selectedMonth);
  }, [trips, selectedMonth]);

  // Compute analytics summaries
  const summary: AnalyticsSummary = useMemo(() => {
    return getDashboardCards(filteredTrips);
  }, [filteredTrips]);

  const unidadeRanking: RankingItem[] = useMemo(() => {
    return getUnidadeRanking(filteredTrips);
  }, [filteredTrips]);

  const usuarioRanking: RankingItem[] = useMemo(() => {
    return getUsuarioRanking(filteredTrips);
  }, [filteredTrips]);

  const vehicleCostRanking: VehicleRankingItem[] = useMemo(() => {
    return getVehicleRanking(filteredTrips);
  }, [filteredTrips]);

  // Trend data grouped by month
  const trendData = useMemo(() => {
    const monthlyGroups: Record<string, { monthYear: string; totalCost: number; tripsCount: number }> = {};
    
    // Sort months chronologically
    availableMonths.forEach(m => {
      monthlyGroups[m] = { monthYear: m, totalCost: 0, tripsCount: 0 };
    });

    trips.forEach(t => {
      const m = t.monthYear;
      if (m && monthlyGroups[m]) {
        monthlyGroups[m].totalCost += t.valorTotal;
        monthlyGroups[m].tripsCount++;
      }
    });

    return Object.values(monthlyGroups);
  }, [trips, availableMonths]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-[350px] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-12 text-center space-y-4">
        <HelpCircle className="h-16 w-16 text-rose-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">Erro ao carregar dados do VOUCHER/TÁXI</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Não conseguimos obter a planilha de corridas do pool. Verifique sua conexão ou tente recarregar os dados.
        </p>
        <button 
          onClick={() => refetch()} 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" /> Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Car className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Voucher / Táxi (Pool de Veículos)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Análise de agendamentos de corridas, custos operacionais e rankings de utilização de Voucher/Táxi
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
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
            onClick={() => refetch()}
            title="Sincronizar dados"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <DashboardCards summary={summary} />

      {/* Primary views and rankings tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl flex flex-wrap h-auto gap-1 border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="unidades" className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Rankings
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5" /> Custos Veículos
          </TabsTrigger>
          <TabsTrigger value="km" className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5">
            <Map className="h-3.5 w-3.5" /> Quilometragem
          </TabsTrigger>
          <TabsTrigger value="consumo" className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5">
            <Fuel className="h-3.5 w-3.5" /> Consumo
          </TabsTrigger>
          <TabsTrigger value="corridas" className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5" /> Lista de Corridas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          {/* Trend Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Evolução Mensal de Custos (R$)
                </CardTitle>
                <CardDescription className="text-[11px] font-medium text-slate-500">
                  Total de despesas de Voucher/Táxi acumuladas mês a mês
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="monthYear" className="text-[10px] font-bold text-slate-400" />
                    <YAxis 
                      className="text-[10px] font-bold text-slate-400"
                      tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} 
                    />
                    <Tooltip 
                      formatter={(value: any) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value), "Custo Total"]}
                      contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                    />
                    <Legend className="text-[10px] font-bold" />
                    <Area type="monotone" dataKey="totalCost" name="Custo Total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Evolução Mensal de Corridas (Qtd)
                </CardTitle>
                <CardDescription className="text-[11px] font-medium text-slate-500">
                  Quantidade total de corridas de Voucher/Táxi agendadas e efetuadas por mês
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="monthYear" className="text-[10px] font-bold text-slate-400" />
                    <YAxis className="text-[10px] font-bold text-slate-400" />
                    <Tooltip 
                      formatter={(value: any) => [value, "Corridas"]}
                      contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: "8px" }}
                    />
                    <Legend className="text-[10px] font-bold" />
                    <Bar dataKey="tripsCount" name="Total de Corridas" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Unidades com Maior Custo do Mês (Voucher)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {unidadeRanking.slice(0, 5).map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 w-4">{idx + 1}.</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800 dark:text-white block">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.totalCost)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 block">{item.count} corridas</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Usuários de Maior Ocupação no Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {usuarioRanking.slice(0, 5).map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 w-4">{idx + 1}.</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800 dark:text-white block">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.totalCost)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 block">{item.count} corridas</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="unidades" className="grid grid-cols-1 md:grid-cols-2 gap-6 outline-none">
          <UnidadeRanking data={unidadeRanking} />
          <UsuarioRanking data={usuarioRanking} />
        </TabsContent>

        <TabsContent value="veiculos" className="outline-none">
          <TopCusto data={vehicleCostRanking} />
        </TabsContent>

        <TabsContent value="km" className="outline-none">
          <TopKm trips={filteredTrips} />
        </TabsContent>

        <TabsContent value="consumo" className="outline-none">
          <TopConsumo trips={filteredTrips} />
        </TabsContent>

        <TabsContent value="corridas" className="outline-none">
          <CorridasRanking trips={filteredTrips} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
