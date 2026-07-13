import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricCard } from "../dashboard/MetricCard";
import { ChartCard } from "../dashboard/ChartCard";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, ClipboardList, AlertCircle, History, PackageOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, parseCurrency } from "@/lib/utils";

interface BacklogDashboardProps {
  data: any[];
}

const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1e3a8a', '#2563eb', '#1d4ed8'];

function parseDateString(dStr: string): Date | null {
  if (!dStr || dStr.trim() === "" || dStr === "-") return null;
  // If it's a number (Excel date)
  if (/^\d+(\.\d+)?$/.test(dStr)) {
    return new Date((parseFloat(dStr) - 25569) * 86400 * 1000);
  }
  // Try parsing DD/MM/YYYY
  const parts = dStr.split(/[\/\s-]/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  const parsed = Date.parse(dStr);
  return isNaN(parsed) ? null : new Date(parsed);
}

function getPlanoCumprimentoStatus(item: any): string {
  const dataPlStr = item.dataPlanejada;
  if (!dataPlStr || dataPlStr.trim() === "" || dataPlStr === "-") {
    return "Sem Data / Não Planejado";
  }
  
  // Case 1: It is a numeric value representing days directly (e.g. "35" or "10")
  const numericVal = parseInt(dataPlStr);
  if (!isNaN(numericVal) && !dataPlStr.includes("/") && !dataPlStr.includes("-") && numericVal < 1000) {
    if (numericVal > 30) {
      return "Atrasado (> 30 dias)";
    } else if (numericVal > 0) {
      return "Atrasado (≤ 30 dias)";
    } else {
      return "No Prazo / Planejado";
    }
  }
  
  // Case 2: It is a Date string
  const plannedDate = parseDateString(dataPlStr);
  if (!plannedDate) {
    return "Sem Data / Não Planejado";
  }
  
  const today = new Date("2026-07-13"); // Using current date from metadata
  const diffTime = today.getTime() - plannedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 30) {
    return "Atrasado (> 30 dias)";
  } else if (diffDays > 0) {
    return "Atrasado (≤ 30 dias)";
  } else {
    return "No Prazo / Planejado";
  }
}

export function BacklogDashboard({ data }: BacklogDashboardProps) {
  const [selectedDiretoria, setSelectedDiretoria] = useState("all");
  const [selectedGerencia, setSelectedGerencia] = useState("all");
  const [selectedCriticidade, setSelectedCriticidade] = useState("all");
  const [selectedTam, setSelectedTam] = useState("all");
  const [selectedDiasFilter, setSelectedDiasFilter] = useState("all");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filterOptions = useMemo(() => {
    const directorias = new Set<string>();
    const gerencias = new Set<string>();
    const criticidades = new Set<string>();
    const tams = new Set<string>();

    data.forEach(item => {
      if (item?.diretoria) directorias.add(item.diretoria);
      if (item?.gerencia) gerencias.add(item.gerencia);
      if (item?.criticidade) criticidades.add(item.criticidade);
      if (item?.tam) tams.add(item.tam);
    });

    return {
      directorias: Array.from(directorias).sort(),
      gerencias: Array.from(gerencias).sort(),
      criticidades: Array.from(criticidades).sort(),
      tams: Array.from(tams).sort()
    };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (!item) return false;
      const matchDiretoria = selectedDiretoria === "all" || item.diretoria === selectedDiretoria;
      const matchGerencia = selectedGerencia === "all" || item.gerencia === selectedGerencia;
      const matchCriticidade = selectedCriticidade === "all" || item.criticidade === selectedCriticidade;
      const matchTam = selectedTam === "all" || item.tam === selectedTam;
      
      let matchDias = true;
      if (selectedDiasFilter !== "all") {
        const dias = parseInt(item.diasEmAberto) || 0;
        if (selectedDiasFilter === "above30") {
          matchDias = dias > 30;
        } else if (selectedDiasFilter === "below30") {
          matchDias = dias < 30;
        }
      }
      
      return matchDiretoria && matchGerencia && matchCriticidade && matchTam && matchDias;
    });
  }, [data, selectedDiretoria, selectedGerencia, selectedCriticidade, selectedTam, selectedDiasFilter]);

  const stats = useMemo(() => {
    // Unique Orders Set
    const uniqueOrderIds = new Set(filteredData.map(item => item.numOrdem).filter(Boolean));
    const backlogCount = uniqueOrderIds.size;

    // Metrics based on unique orders
    let osSemOrcamentoCount = 0;
    let osAcima30DiasCount = 0;
    let custoTotal = 0;

    const processedBudgetIds = new Set<string>();
    const processedOrders = new Set<string>();
    const gerenciaOsMap: Record<string, Set<string>> = {};

    filteredData.forEach((item) => {
      if (!item) return;
      const orderId = (item.numOrdem || "").trim();
      const budgetId = (item.numOrcamento || "").trim();
      
      const rawCusto = String(item.custo || "0");
      const valorCusto = parseCurrency(rawCusto);
      const gerencia = item.gerencia || "N/A";

      if (orderId && !processedOrders.has(orderId)) {
        processedOrders.add(orderId);
        
        if (!budgetId) {
          osSemOrcamentoCount++;
        }

        const dias = parseInt(item.diasEmAberto) || 0;
        if (dias > 30) {
          osAcima30DiasCount++;
        }

        if (!gerenciaOsMap[gerencia]) gerenciaOsMap[gerencia] = new Set();
        gerenciaOsMap[gerencia].add(orderId);
      }
    });

    custoTotal = 0;
    const finalBudgetMap = new Map<string, number>();
    const ordersWithNoBudgetCosto = new Map<string, number>();

    filteredData.forEach(item => {
      if (!item) return;
      const bId = (item.numOrcamento || "").trim();
      const oId = (item.numOrdem || "").trim();
      const cost = parseCurrency(String(item.custo || "0"));

      if (bId) {
        if (!finalBudgetMap.has(bId)) finalBudgetMap.set(bId, cost);
      } else if (oId) {
        if (!ordersWithNoBudgetCosto.has(oId)) ordersWithNoBudgetCosto.set(oId, cost);
      }
    });

    for (const cost of finalBudgetMap.values()) custoTotal += cost;
    for (const cost of ordersWithNoBudgetCosto.values()) custoTotal += cost;

    const gerenciaData = Object.entries(gerenciaOsMap)
      .map(([name, set]) => ({ name, value: set.size }))
      .sort((a, b) => b.value - a.value);

    // OS por TAM
    const tamMap: Record<string, number> = {};
    // OS por Placa
    const placaMap: Record<string, number> = {};
    // OS por Criticidade
    const criticidadeMap: Record<string, number> = {};

    filteredData.forEach(item => {
      if (item.tam) tamMap[item.tam] = (tamMap[item.tam] || 0) + 1;
      if (item.placa) placaMap[item.placa] = (placaMap[item.placa] || 0) + 1;
      if (item.criticidade) criticidadeMap[item.criticidade] = (criticidadeMap[item.criticidade] || 0) + 1;
    });

    const tamData = Object.entries(tamMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const placaData = Object.entries(placaMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    const criticidadeData = Object.entries(criticidadeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // --- NOVOS INDICADORES DO PLANO DE MANUTENÇÃO ---
    // Coluna Nº MP (item.numMp) diferente de vazio
    const planoMaintenanceItems = filteredData.filter(item => item.numMp && item.numMp.trim() !== "");
    const planoAtividadesCount = planoMaintenanceItems.length;

    // Traga quantos são o nº OS, sem duplicatas, pelo TAM (Tipo de Atividade de Manutenção)
    const planoTamMap: Record<string, Set<string>> = {};
    planoMaintenanceItems.forEach(item => {
      if (item.tam && item.numOrdem) {
        const tamStr = String(item.tam).trim().toUpperCase();
        const osStr = String(item.numOrdem).trim();
        if (!planoTamMap[tamStr]) {
          planoTamMap[tamStr] = new Set();
        }
        planoTamMap[tamStr].add(osStr);
      }
    });

    const planoTamData = Object.entries(planoTamMap).map(([name, set]) => ({
      name,
      value: set.size
    })).sort((a, b) => b.value - a.value);

    // Qtd de OS do plano únicas (total)
    const planoOsUnicasSet = new Set(planoMaintenanceItems.map(item => item.numOrdem).filter(Boolean));
    const planoOsUnicasCount = planoOsUnicasSet.size;

    // Cumprimento do Plano de Manutenção
    const cumprimentoMap: Record<string, number> = {
      "Atrasado (> 30 dias)": 0,
      "Atrasado (≤ 30 dias)": 0,
      "No Prazo / Planejado": 0
    };

    planoMaintenanceItems.forEach(item => {
      const status = getPlanoCumprimentoStatus(item);
      if (cumprimentoMap[status] !== undefined) {
        cumprimentoMap[status]++;
      } else {
        if (status === "Sem Data / Não Planejado") {
          cumprimentoMap["Sem Data / Não Planejado"] = (cumprimentoMap["Sem Data / Não Planejado"] || 0) + 1;
        } else {
          cumprimentoMap[status] = (cumprimentoMap[status] || 0) + 1;
        }
      }
    });

    const planoCumprimentoData = Object.entries(cumprimentoMap)
      .map(([name, value]) => ({ name, value }))
      .filter(entry => entry.value > 0);

    return { 
      backlogCount, 
      osSemOrcamentoCount, 
      osAcima30DiasCount, 
      custoTotal,
      tamData, 
      placaData, 
      criticidadeData,
      gerenciaData,
      // Novos Indicadores mapeados
      planoAtividadesCount,
      planoOsUnicasCount,
      planoTamData,
      planoCumprimentoData
    };
  }, [filteredData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-none shadow-sm dark:bg-slate-900">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[150px]">
             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Diretoria</label>
             <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
               <SelectTrigger className="h-9 text-[11px] font-bold uppercase">
                 <SelectValue placeholder="Diretorias" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all" className="text-[11px] font-bold uppercase">Todas Diretorias</SelectItem>
                 {filterOptions.directorias.map(d => <SelectItem key={d} value={d} className="text-[11px] font-bold uppercase">{d}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Gerência</label>
             <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
               <SelectTrigger className="h-9 text-[11px] font-bold uppercase">
                 <SelectValue placeholder="Gerências" />
               </SelectTrigger>
               <SelectContent className="max-h-[300px]">
                 <SelectItem value="all" className="text-[11px] font-bold uppercase">Todas Gerências</SelectItem>
                 {filterOptions.gerencias.map(g => <SelectItem key={g} value={g} className="text-[11px] font-bold uppercase">{g}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
          <div className="flex-1 min-w-[120px]">
             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Criticidade</label>
             <Select value={selectedCriticidade} onValueChange={setSelectedCriticidade}>
               <SelectTrigger className="h-9 text-[11px] font-bold uppercase">
                 <SelectValue placeholder="Criticidade" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all" className="text-[11px] font-bold uppercase">Todas</SelectItem>
                 {filterOptions.criticidades.map(c => <SelectItem key={c} value={c} className="text-[11px] font-bold uppercase">{c}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
          <div className="flex-1 min-w-[100px]">
             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">TAM</label>
             <Select value={selectedTam} onValueChange={setSelectedTam}>
               <SelectTrigger className="h-9 text-[11px] font-bold uppercase">
                 <SelectValue placeholder="TAM" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all" className="text-[11px] font-bold uppercase">Todos</SelectItem>
                 {filterOptions.tams.map(t => <SelectItem key={t} value={t} className="text-[11px] font-bold uppercase">{t}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
          <div className="flex-1 min-w-[130px]">
             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Dias em Aberto</label>
             <Select value={selectedDiasFilter} onValueChange={setSelectedDiasFilter}>
               <SelectTrigger className="h-9 text-[11px] font-bold uppercase">
                 <SelectValue placeholder="Dias em Aberto" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all" className="text-[11px] font-bold uppercase">Todos os dias</SelectItem>
                 <SelectItem value="above30" className="text-[11px] font-bold uppercase">Acima de 30 dias</SelectItem>
                 <SelectItem value="below30" className="text-[11px] font-bold uppercase">Menor que 30 dias</SelectItem>
               </SelectContent>
             </Select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => {
              setSelectedDiretoria("all");
              setSelectedGerencia("all");
              setSelectedCriticidade("all");
              setSelectedTam("all");
              setSelectedDiasFilter("all");
            }} className="h-9 px-3 text-[10px] font-black uppercase">Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Principais Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Backlog Total" 
          value={stats.backlogCount} 
          description="Nº Ordem Únicos Pendentes"
          icon={<History className="h-4 w-4" />}
          colorScheme="primary"
          centered
        />
        <MetricCard 
          title="OS sem Orçamento" 
          value={stats.osSemOrcamentoCount} 
          description="Nº Ordens sem Nº Orçamento"
          icon={<ClipboardList className="h-4 w-4" />}
          centered
        />
        <MetricCard 
          title="OS acima de 30 dias" 
          value={stats.osAcima30DiasCount} 
          description="Ordens pendentes > 30 dias"
          icon={<AlertCircle className="h-4 w-4" />}
          colorScheme="danger"
          centered
        />
        <MetricCard 
          title="Custo Total" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.custoTotal)} 
          description="Soma do Custo das Ordens"
          icon={<PackageOpen className="h-4 w-4" />}
          centered
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* OS por TAM */}
        <ChartCard title="Ordens de Serviço por TAM" description="Distribuição de workload por TAM">
          <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.tamData} layout="vertical" margin={{ left: 50, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700 }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fontWeight: 900 }} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </ChartCard>

        {/* OS por Criticidade */}
        <ChartCard title="OS por Criticidade" description="Hierarquia de urgência">
          <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                  <Pie data={stats.criticidadeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                    {stats.criticidadeData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* OS por Placa (Top 10) */}
        <ChartCard title="Top 10 Veículos - OS Pendentes" description="Veículos com maior acúmulo de Ordens">
          <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.placaData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1d4ed8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </ChartCard>

        {/* QTD OS por Gerência */}
        <ChartCard 
          title="QTD OS por Gerência" 
          description="Volume de Ordens por unidade administrativa"
        >
          <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.gerenciaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: 700 }} 
                    width={120}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#6366f1" 
                    radius={[0, 4, 4, 0]} 
                    name="OS Únicas"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </ChartCard>
      </div>

      {/* Seção Plano de Manutenção */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Indicadores do Plano de Manutenção</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Análise de atividades vinculadas a planos de manutenção (coluna Nº MP preenchida)</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard 
            title="Atividades Planejadas" 
            value={stats.planoAtividadesCount} 
            description="Total de registros de plano (Nº MP preenchido)"
            icon={<ClipboardList className="h-4 w-4 text-emerald-600" />}
            colorScheme="success"
            centered
          />
          <MetricCard 
            title="OS de Plano Únicas" 
            value={stats.planoOsUnicasCount} 
            description="OS do plano de manutenção (sem duplicatas)"
            icon={<History className="h-4 w-4 text-emerald-600" />}
            colorScheme="success"
            centered
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* OS do Plano de Manutenção por TAM */}
          <ChartCard title="OS do Plano por TAM" description="Nº de OS únicas com Nº MP por TAM">
            <div className="w-full h-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.planoTamData} layout="vertical" margin={{ left: 50, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700 }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fontWeight: 900 }} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </ChartCard>

          {/* Cumprimento do Plano de Manutenção */}
          <ChartCard title="Cumprimento do Plano de Manutenção" description="Status baseado na Data Planejada (Coluna T)">
            <div className="w-full h-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie 
                      data={stats.planoCumprimentoData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value" 
                      isAnimationActive={false} 
                      label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.planoCumprimentoData.map((entry, index) => {
                        const colorsMap: Record<string, string> = {
                          "Atrasado (> 30 dias)": "#dc2626", // red
                          "Atrasado (≤ 30 dias)": "#f59e0b", // amber
                          "No Prazo / Planejado": "#10b981", // emerald
                          "Sem Data / Não Planejado": "#64748b" // slate
                        };
                        return <Cell key={`cell-${index}`} fill={colorsMap[entry.name] || COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
          </ChartCard>
        </div>
      </div>

      {/* Tabela Resumo das Ordens */}
      <Card className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-tighter">Resumo Detalhado das Ordens</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Acompanhamento completo de pendências (Página {currentPage} de {totalPages})</CardDescription>
          </div>
          <div className="flex gap-2">
             <Button 
               variant="outline" 
               size="sm" 
               disabled={currentPage === 1}
               onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
               className="h-8 w-8 p-0"
             >
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <div className="flex items-center px-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-black italic">
               {currentPage} / {totalPages}
             </div>
             <Button 
               variant="outline" 
               size="sm" 
               disabled={currentPage === totalPages}
               onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
               className="h-8 w-8 p-0"
             >
               <ChevronRight className="h-4 w-4" />
             </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto custom-scrollbar">
             <Table>
               <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-20 shadow-sm">
                 <TableRow>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center min-w-[90px]">Placa</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Tipo</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Nº Ordem</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Nº Orçamento</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">TAM</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Descrição Atividade</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Estabelecimento</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-right min-w-[120px]">Custo</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Dias</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {paginatedData.map((item, idx) => {
                   const rawCusto = String(item.custo || "0");
                   const cleaned = rawCusto.replace("R$", "").replace(/\s/g, "");
                   const valorCusto = cleaned.includes(",") 
                     ? (parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0)
                     : (parseFloat(cleaned) || 0);
                   const formattedCusto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorCusto);
                   
                   return (
                     <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-50 dark:border-slate-800">
                       <td className="px-4 py-3 text-[10px] font-black text-indigo-600 text-center">{item.placa}</td>
                       <td className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase text-center">{item.tipo}</td>
                       <td className="px-4 py-3 text-[10px] font-bold text-center">{item.numOrdem}</td>
                       <td className="px-4 py-3 text-[10px] font-bold text-center text-slate-400">{item.numOrcamento || "-"}</td>
                       <td className="px-4 py-3 text-[9px] font-medium text-slate-500 uppercase text-center">{item.tam}</td>
                       <td className="px-4 py-3 text-[10px] font-medium max-w-[200px] truncate">{item.descricaoAtividade}</td>
                       <td className="px-4 py-3 text-[10px] font-medium max-w-[150px] truncate uppercase">{item.estabelecimento}</td>
                       <td className="px-4 py-3 text-[10px] font-black text-right text-indigo-900 dark:text-indigo-200">
                          {valorCusto > 0 ? formattedCusto : "R$ 0,00"}
                       </td>
                       <td className="px-4 py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                            parseInt(item.diasEmAberto) > 30 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"
                          }`}>
                            {item.diasEmAberto}
                          </span>
                       </td>
                     </tr>
                   );
                 })}
               </TableBody>
             </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
