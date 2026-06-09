import { useState, useMemo, useEffect } from "react";
import { ChartCard } from "../dashboard/ChartCard";
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from "recharts";
import { fetchRegularizacaoData, fetchFleetData, fetchTitulosDespesasData } from "../../services/fleetService";
import { exportToExcel } from "../../lib/exportToExcel";
import { Download, X, AlertTriangle, ShieldAlert, BarChart3, Filter, Calendar, Search, Users, FileText, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Blue color palette
const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'];
const BLUE_CHART_1 = '#3b82f6';
const BLUE_CHART_2 = '#2563eb';
const BLUE_CHART_3 = '#1d4ed8';

// Helper para normalizar strings removendo acentos
const normalizeString = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
};

const findTipoTituloKey = (keys: string[]): string | undefined => {
    const norm = (s: string) => normalizeString(s);
    const preferred = keys.find(k => {
      const nk = norm(k);
      return nk === 'TIPO DE TITULO' || nk === 'TIPO DE TÍTULO';
    });
    if (preferred) return preferred;
    const secondary = keys.find(k => {
      const nk = norm(k);
      return nk === 'TIPO TITULO' || nk === 'TIPO TÍTULO';
    });
    if (secondary) return secondary;
    return keys.find(k => {
      const nk = norm(k);
      return nk.includes('TIPO') && nk.includes('TITULO');
    });
};

export default function RegularizacaoDashboard() {
  const [activeSubmenu, setActiveSubmenu] = useState<"infracoes" | "despesas">("infracoes");
  const [regularizacaoData, setRegularizacaoData] = useState<any[]>([]);
  const [titulosDespesasData, setTitulosDespesasData] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [selectedPlaca, setSelectedPlaca] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedMesAno, setSelectedMesAno] = useState<string[]>([]);
  const [selectedTipoTitulo, setSelectedTipoTitulo] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  
  // Novos filtros conforme solicitação
  const [selectedTipoInfracao, setSelectedTipoInfracao] = useState("all");
  const [selectedGravidadeFilter, setSelectedGravidadeFilter] = useState("all");
  const [selectedDiretoria, setSelectedDiretoria] = useState("all");
  const [selectedGerenciaFilter, setSelectedGerenciaFilter] = useState("all");
  const [selectedPropriedadeFilter, setSelectedPropriedadeFilter] = useState("all");
  const [selectedStatusPrazo, setSelectedStatusPrazo] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [reg, test, ast] = await Promise.all([
        fetchRegularizacaoData(),
        fetchTitulosDespesasData(),
        fetchFleetData()
      ]);
      setRegularizacaoData(reg);
      setTitulosDespesasData(test);
      setAssets(ast);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filter options for INFRACOES
  const statusOptions = useMemo(() => {
    const statusSet = new Set<string>();
    regularizacaoData.forEach(item => {
      const status = String(item.__raw?.[21] || "").trim(); // Col V
      if (status && status !== "-") statusSet.add(status);
    });
    return Array.from(statusSet).sort();
  }, [regularizacaoData]);

  const infraFilterOptions = useMemo(() => {
    const types = new Set<string>();
    const gravs = new Set<string>();
    const dirs = new Set<string>();
    const gers = new Set<string>();
    const props = new Set<string>();
    const prazos = new Set<string>();

    regularizacaoData.forEach(item => {
      if (item.__raw?.[11]) types.add(String(item.__raw[11]).trim()); // Col L
      if (item.__raw?.[14]) gravs.add(String(item.__raw[14]).trim());  // Col O
      if (item.__raw?.[16]) dirs.add(String(item.__raw[16]).trim());   // Col Q
      if (item.__raw?.[17]) gers.add(String(item.__raw[17]).trim());   // Col R
      if (item.__raw?.[20]) props.add(String(item.__raw[20]).trim());  // Col U
      if (item.__raw?.[24]) prazos.add(String(item.__raw[24]).trim()); // Col Y
    });

    return {
      tipos: Array.from(types).sort(),
      gravidades: Array.from(gravs).sort(),
      diretorias: Array.from(dirs).sort(),
      gerencias: Array.from(gers).sort(),
      propriedades: Array.from(props).sort(),
      prazos: Array.from(prazos).sort()
    };
  }, [regularizacaoData]);

  // Filter options for DESPESAS
  const mesAnoOptions = useMemo(() => {
    const mesAnoSet = new Set<string>();
    titulosDespesasData.forEach(item => {
      const mesAno = String(item.__raw?.[56] || "").replace(/\.\//g, '/').trim(); // Column BE
      if (mesAno && mesAno !== "-") {
        mesAnoSet.add(mesAno);
      }
    });
    
    return Array.from(mesAnoSet).sort((a, b) => {
      const mesesOrdem: { [key: string]: number } = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      if (anoA !== anoB) return (anoA || "").localeCompare(anoB || "");
      return (mesesOrdem[mesA] || 0) - (mesesOrdem[mesB] || 0);
    });
  }, [titulosDespesasData]);

  const tipoTituloOptions = useMemo(() => {
    const tipoSet = new Set<string>();
    titulosDespesasData.forEach(item => {
      const tipo = String(item.__raw?.[58] || "").trim(); // Column BG
      if (tipo && tipo !== "-") tipoSet.add(tipo);
    });
    return Array.from(tipoSet).sort();
  }, [titulosDespesasData]);

  const categoriaOptions = useMemo(() => {
    const catSet = new Set<string>();
    titulosDespesasData.forEach(item => {
      const cat = String(item.__raw?.[57] || "").trim(); // Column BF
      if (cat && cat !== "-") catSet.add(cat);
    });
    return Array.from(catSet).sort();
  }, [titulosDespesasData]);

  // Filtered Data
  const filteredInfracoes = useMemo(() => {
    return regularizacaoData.filter(item => {
      const raw = item.__raw || [];
      const placa = String(raw[3] || "").toUpperCase(); // Col D
      const status = String(raw[21] || "").trim();      // Col V
      const tInfracao = String(raw[11] || "").trim();   // Col L
      const grav = String(raw[14] || "").trim();        // Col O
      const diretoria = String(raw[16] || "").trim();   // Col Q
      const gerencia = String(raw[17] || "").trim();    // Col R
      const propriedade = String(raw[20] || "").trim(); // Col U
      const sPrazo = String(raw[24] || "").trim();      // Col Y
      
      const placaMatch = selectedPlaca === "all" || placa.includes(selectedPlaca.toUpperCase());
      const statusMatch = selectedStatus.length === 0 || selectedStatus.includes(status);
      const tInfracaoMatch = selectedTipoInfracao === "all" || tInfracao === selectedTipoInfracao;
      const gravMatch = selectedGravidadeFilter === "all" || grav === selectedGravidadeFilter;
      const dirMatch = selectedDiretoria === "all" || diretoria === selectedDiretoria;
      const gerMatch = selectedGerenciaFilter === "all" || gerencia === selectedGerenciaFilter;
      const propMatch = selectedPropriedadeFilter === "all" || propriedade === selectedPropriedadeFilter;
      const prazoMatch = selectedStatusPrazo === "all" || sPrazo === selectedStatusPrazo;
      
      return placaMatch && statusMatch && tInfracaoMatch && gravMatch && dirMatch && gerMatch && propMatch && prazoMatch;
    });
  }, [
    regularizacaoData, selectedPlaca, selectedStatus, selectedTipoInfracao, 
    selectedGravidadeFilter, selectedDiretoria, selectedGerenciaFilter, 
    selectedPropriedadeFilter, selectedStatusPrazo
  ]);

  const filteredDespesas = useMemo(() => {
    return titulosDespesasData.filter(item => {
      const mesAno = String(item.__raw?.[56] || "").replace(/\.\//g, '/').trim(); // Column BE
      const tipo = String(item.__raw?.[58] || "").trim();      // Column BG
      const categoria = String(item.__raw?.[57] || "").trim(); // Column BF
      
      const mesAnoMatch = selectedMesAno.length === 0 || selectedMesAno.includes(mesAno);
      const tipoMatch = selectedTipoTitulo.length === 0 || selectedTipoTitulo.includes(tipo);
      const catMatch = selectedCategorias.length === 0 || selectedCategorias.includes(categoria);
      
      return mesAnoMatch && tipoMatch && catMatch;
    });
  }, [titulosDespesasData, selectedMesAno, selectedTipoTitulo, selectedCategorias]);

  // Charts for Infrações
  const multaPorGerencia = useMemo(() => {
    const grouped = filteredInfracoes.reduce((acc, item) => {
      const raw = item.__raw || [];
      const gerencia = String(raw[17] || "Não especificado").trim(); // Col R
      
      let valor = 0;
      const valorRaw = raw[22]; // Col W (VALOR MULTA) - assuming it follows the sheet structure
      if (valorRaw) {
        const cleanValue = String(valorRaw).replace(/R\$/gi, '').replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.');
        valor = parseFloat(cleanValue) || 0;
      }
      acc[gerencia] = (acc[gerencia] || 0) + valor;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([gerencia, valor]) => ({ gerencia: gerencia.slice(0, 15), valor: Number(valor) }))
      .filter(item => item.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filteredInfracoes]);

  const condutoresComMaioresInfracoes = useMemo(() => {
    const grouped = filteredInfracoes.reduce((acc, item) => {
      const condutor = String(item.__raw?.[20] || "N/A").trim(); // Col U
      if (condutor === "N/A" || condutor === "") return acc;
      acc[condutor] = (acc[condutor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredInfracoes]);

  const maioresTiposInfracoes = useMemo(() => {
    const grouped = filteredInfracoes.reduce((acc, item) => {
      const tipo = String(item.__raw?.[13] || "N/A").trim(); // Col N
      if (tipo === "N/A" || tipo === "") return acc;
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredInfracoes]);

  const statusNotificacoes = useMemo(() => {
    const grouped = filteredInfracoes.reduce((acc, item) => {
      let status = String(item.__raw?.[21] || "N/A").trim(); // Col V
      if (!status) status = "N/A";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [filteredInfracoes]);

  const timelineComparativaInfracoes = useMemo(() => {
    const monthGroup: Record<string, { current: number, previous: number }> = {};
    const today = new Date();
    const currentYear = today.getFullYear();
    const prevYear = currentYear - 1;

    filteredInfracoes.forEach(item => {
      const dateStr = String(item.__raw?.[8] || ""); // Col I
      if (!dateStr || dateStr === "-") return;
      
      try {
        const parts = dateStr.split('/');
        if (parts.length >= 3) {
          const m = parseInt(parts[1]);
          const y = parseInt(parts[2]);
          const monthLabel = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1];
          
          if (!monthGroup[monthLabel]) monthGroup[monthLabel] = { current: 0, previous: 0 };
          if (y === currentYear) monthGroup[monthLabel].current++;
          else if (y === prevYear) monthGroup[monthLabel].previous++;
        }
      } catch {}
    });

    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
      .map(m => ({
        month: m,
        atual: monthGroup[m]?.current || 0,
        anterior: monthGroup[m]?.previous || 0
      }));
  }, [filteredInfracoes]);

  // Charts for Despesas
  const valorPorTipoTitulo = useMemo(() => {
    const groupedData = filteredDespesas.reduce((acc, item) => {
      const tipo = String(item.__raw?.[58] || "Não especificado").trim(); // Column BG
      
      let valorTitulo = 0;
      const valorRaw = item.__raw?.[62]; // Column BK
      if (valorRaw) {
        const cleanValue = String(valorRaw).replace(/R\$/gi, '').replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.');
        valorTitulo = parseFloat(cleanValue) || 0;
      }
      
      if (!acc[tipo]) acc[tipo] = { quantidade: 0, valorTotal: 0 };
      acc[tipo].quantidade++;
      acc[tipo].valorTotal += valorTitulo;
      return acc;
    }, {} as Record<string, { quantidade: number; valorTotal: number }>);
    
    let entries = (Object.entries(groupedData) as [string, { quantidade: number, valorTotal: number }][])
      .map(([name, data]) => ({ 
        name, 
        value: data.quantidade, 
        valorTotal: data.valorTotal 
      }))
      .sort((a, b) => b.value - a.value);

    // Group small slices (limit to top 5)
    const limit = 5;
    if (entries.length > limit + 1) {
      const mainItems = entries.slice(0, limit);
      const others = entries.slice(limit);
      const otherQty = others.reduce((sum, e) => sum + e.value, 0);
      const otherValue = others.reduce((sum, e) => sum + e.valorTotal, 0);
      
      return [...mainItems, { name: 'Outros', value: otherQty, valorTotal: otherValue }];
    }
    
    return entries;
  }, [filteredDespesas]);

  const timelineValores = useMemo(() => {
    const grouped = filteredDespesas.reduce((acc, item) => {
      const mesAno = String(item.__raw?.[56] || "N/A").replace(/\.\//g, '/').trim(); // Column BE
      
      let valor = 0;
      const valorRaw = item.__raw?.[62]; // Column BK
      if (valorRaw) {
        const cleanValue = String(valorRaw).replace(/R\$/gi, '').replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.');
        valor = parseFloat(cleanValue) || 0;
      }
      acc[mesAno] = (acc[mesAno] || 0) + valor;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([mesAno, valor]) => ({ mesAno, valor }))
      .sort((a, b) => {
        const mesesOrdem: { [key: string]: number } = {
          'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
          'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
        };
        const [mesA, anoA] = a.mesAno.split('/');
        const [mesB, anoB] = b.mesAno.split('/');
        if (anoA !== anoB) return (anoA || "").localeCompare(anoB || "");
        return (mesesOrdem[mesA] || 0) - (mesesOrdem[mesB] || 0);
      });
  }, [filteredDespesas]);

  const handleExport = () => {
    const data = activeSubmenu === "infracoes" ? filteredInfracoes : filteredDespesas;
    const name = activeSubmenu === "infracoes" ? "Infrações" : "Despesas";
    exportToExcel(data, `Controle_${name}`, "Planilha");
  };

  if (loading) {
     return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">Sincronizando Controle de Infrações e Despesas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-12">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200/50">
          <AlertTriangle size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Falha na Sincronização</h2>
          <p className="text-slate-500 max-w-md mx-auto font-medium">Não conseguimos carregar os dados de regularização. Verifique sua conexão com a rede da Compesa.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl border-2 font-black uppercase tracking-widest text-xs h-12 px-8">
            Recarregar App
          </Button>
          <Button onClick={() => load()} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs h-12 px-8 shadow-xl shadow-slate-200 dark:shadow-none">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none italic">Infrações e Despesas</h1>
           <p className="text-slate-500 font-medium tracking-tight">Gestão administrativa de penalidades e títulos financeiros</p>
        </div>
        <button onClick={handleExport} className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200 dark:shadow-none">
          <Download className="h-4 w-4" />
          Extrair Relatório
        </button>
      </div>

      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubmenu("infracoes")}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeSubmenu === "infracoes" 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm shadow-slate-200' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldAlert size={16} />
          <span>Controle de Infrações</span>
        </button>
        <button
          onClick={() => setActiveSubmenu("despesas")}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeSubmenu === "despesas" 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm shadow-slate-200' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText size={16} />
          <span>Despesas com Títulos</span>
        </button>
      </div>

      {activeSubmenu === "infracoes" ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                <Filter size={18} strokeWidth={2.5} />
                <h3 className="text-xs font-black uppercase tracking-widest italic">Filtros de Infrações</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Buscar Placa</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Ex: ABC1234"
                          value={selectedPlaca === "all" ? "" : selectedPlaca}
                          onChange={(e) => setSelectedPlaca(e.target.value || "all")}
                        />
                      </div>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Status Geral</label>
                      <select 
                        value={selectedStatus[0] || "all"} 
                        onChange={(e) => setSelectedStatus(e.target.value === "all" ? [] : [e.target.value])}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todos os Status</option>
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Tipo de Infração (Col L)</label>
                      <select 
                        value={selectedTipoInfracao} 
                        onChange={(e) => setSelectedTipoInfracao(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todas as Infrações</option>
                        {infraFilterOptions.tipos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Gravidade (Col O)</label>
                      <select 
                        value={selectedGravidadeFilter} 
                        onChange={(e) => setSelectedGravidadeFilter(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todas as Gravidades</option>
                        {infraFilterOptions.gravidades.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Diretoria (Col Q)</label>
                      <select 
                        value={selectedDiretoria} 
                        onChange={(e) => setSelectedDiretoria(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todas as Diretorias</option>
                        {infraFilterOptions.diretorias.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Gerência (Col R)</label>
                      <select 
                        value={selectedGerenciaFilter} 
                        onChange={(e) => setSelectedGerenciaFilter(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todas as Gerências</option>
                        {infraFilterOptions.gerencias.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Propriedade (Col U)</label>
                      <select 
                        value={selectedPropriedadeFilter} 
                        onChange={(e) => setSelectedPropriedadeFilter(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todas as Propriedades</option>
                        {infraFilterOptions.propriedades.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Prazo Defesa (Col Y)</label>
                      <select 
                        value={selectedStatusPrazo} 
                        onChange={(e) => setSelectedStatusPrazo(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="all">Todos os Prazos</option>
                        {infraFilterOptions.prazos.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <ChartCard title="Timeline de Infrações (Comparativo)" description="Volume mensal: Ano Atual vs Ano Anterior (Coluna I)">
              <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineComparativaInfracoes} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} fontWeight={900} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={900} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" />
                    <Line name="Ano Atual" type="monotone" dataKey="atual" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                    <Line name="Ano Anterior" type="monotone" dataKey="anterior" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Valor de Multas por Gerência" description="Custo acumulado por unidade">
              <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={multaPorGerencia} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="gerencia" type="category" axisLine={false} tickLine={false} fontSize={10} fontWeight={900} />
                    <Tooltip formatter={(val) => `R$ ${Number(val).toLocaleString('pt-BR')}`} />
                    <Bar dataKey="valor" fill="#4f46e5" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Status das Notificações" description="Situação processual">
              <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusNotificacoes} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                      {statusNotificacoes.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Maiores Tipos de Infrações" description="Frequência por natureza da infração (Coluna N)">
              <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={maioresTiposInfracoes} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      fontSize={8} 
                      fontWeight={900} 
                      angle={-45} 
                      textAnchor="end"
                      interval={0}
                      height={80}
                    />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={900} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Condutores com Maiores Infrações" description="Ranking de volume por condutor (Coluna U)">
              <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={condutoresComMaioresInfracoes} layout="vertical" margin={{ left: 40 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} fontWeight={900} width={100} />
                     <Tooltip />
                     <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                 <div className="flex items-center space-x-3">
                   <ShieldAlert className="text-rose-500" size={20} />
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white italic underline decoration-rose-500/30">Detalhamento de Multas e Infrações</h3>
                 </div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    {filteredInfracoes.length} Ocorrências
                 </span>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-20 shadow-sm">
                    <tr>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Placa (Col D)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Condutor (Col U)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Data Notif. (Col I)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Infração (Col N)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Gravidade (Col O)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status (Col V)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Propriedade (Col T)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-bold">
                    {filteredInfracoes.map((item, index) => {
                      const raw = item.__raw || [];
                      const placa = String(raw[3] || "-");      // Coluna D
                      const condutor = String(raw[20] || "-");   // Coluna U
                      const dataNotif = String(raw[8] || "-");   // Coluna I
                      const infraDesc = String(raw[13] || "-");  // Coluna N
                      const gravidade = String(raw[14] || "-");  // Coluna O
                      const status = String(raw[21] || "-");     // Coluna V
                      const proprietario = String(raw[19] || "-"); // Coluna T

                      return (
                        <tr key={index} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                          <td className="px-6 py-4 font-mono font-black text-indigo-600 dark:text-indigo-400 break-words whitespace-normal min-w-[100px]">{placa}</td>
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-300 uppercase break-words whitespace-normal min-w-[150px]">{condutor}</td>
                          <td className="px-6 py-4 text-slate-500 text-center break-words whitespace-normal">{dataNotif}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400 uppercase break-words whitespace-normal min-w-[200px]">{infraDesc}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase break-words whitespace-normal ${
                              gravidade.toUpperCase().includes('GRAVISSIMA') ? 'bg-rose-100 text-rose-600' :
                              gravidade.toUpperCase().includes('GRAVE') ? 'bg-orange-100 text-orange-600' :
                              gravidade.toUpperCase().includes('MEDIA') ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {gravidade}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter break-words whitespace-normal ${
                              status.toUpperCase().includes('PAG') ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 uppercase text-[10px] break-words whitespace-normal">{proprietario}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                <Filter size={18} strokeWidth={2.5} />
                <h3 className="text-xs font-black uppercase tracking-widest italic">Filtros de Títulos Financeiros</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 font-bold">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Período de Referência (Mês/Ano)</label>
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "w-full justify-between h-10 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
                          )}
                        >
                          <span className="truncate">
                            {selectedMesAno.length > 0 ? `${selectedMesAno.length} períodos selecionados` : "Todos os períodos"}
                          </span>
                          <ChevronDown size={14} className="opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50">
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {mesAnoOptions.map(m => (
                              <div key={m} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`mes-${m}`} 
                                  checked={selectedMesAno.includes(m)}
                                  onCheckedChange={() => {
                                    setSelectedMesAno(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
                                  }}
                                />
                                <label htmlFor={`mes-${m}`} className="text-xs font-bold uppercase cursor-pointer select-none text-slate-700 dark:text-slate-300">{m}</label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                  </div>

                  <div className="space-y-1.5 font-bold">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Categoria do Título (Col BF)</label>
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "w-full justify-between h-10 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
                          )}
                        >
                          <span className="truncate">
                            {selectedCategorias.length > 0 ? `${selectedCategorias.length} categorias selecionadas` : "Todas as categorias"}
                          </span>
                          <ChevronDown size={14} className="opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50">
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {categoriaOptions.map(c => (
                              <div key={c} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`cat-${c}`} 
                                  checked={selectedCategorias.includes(c)}
                                  onCheckedChange={() => {
                                    setSelectedCategorias(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
                                  }}
                                />
                                <label htmlFor={`cat-${c}`} className="text-xs font-bold uppercase cursor-pointer select-none text-slate-700 dark:text-slate-300">{c}</label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                  </div>

                  <div className="space-y-1.5 font-bold">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">Tipo de Título (Col BG)</label>
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "w-full justify-between h-10 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
                          )}
                        >
                          <span className="truncate">
                            {selectedTipoTitulo.length > 0 ? `${selectedTipoTitulo.length} tipos selecionados` : "Todos os tipos"}
                          </span>
                          <ChevronDown size={14} className="opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50">
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {tipoTituloOptions.map(t => (
                              <div key={t} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`tipo-${t}`} 
                                  checked={selectedTipoTitulo.includes(t)}
                                  onCheckedChange={() => {
                                    setSelectedTipoTitulo(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
                                  }}
                                />
                                <label htmlFor={`tipo-${t}`} className="text-xs font-bold uppercase cursor-pointer select-none text-slate-700 dark:text-slate-300">{t}</label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Quantidade por Tipo de Título" description="Distribuição financeira por categoria">
              <div className="w-full h-full min-h-[350px]">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie 
                      data={valorPorTipoTitulo} 
                      cx="40%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={5} 
                      dataKey="value"
                      labelLine={false}
                      isAnimationActive={false}
                    >
                      {valorPorTipoTitulo.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl">
                              <p className="text-xs font-black uppercase text-slate-800 dark:text-white mb-1">{data.name}</p>
                              <p className="text-[10px] font-bold text-slate-500">Documentos: {data.value}</p>
                              <p className="text-xs font-black text-emerald-600 uppercase mt-2">Total: R$ {data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right"
                      wrapperStyle={{ paddingLeft: '10px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Timeline de Valores de Títulos" description="Investimento periódico detectado">
              <div className="w-full h-full min-h-[350px]">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={timelineValores} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="mesAno" axisLine={false} tickLine={false} fontSize={10} fontWeight={900} dy={10} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={900} />
                    <Tooltip 
                      formatter={(val) => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={4} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Relatório Consolidado de Gastos</h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                     <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Mês/Ano (Col BE)</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Tipo Despesa (Col BG)</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Centro de Custo (Col BH)</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Valor Líquido (Col BK)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                     {filteredDespesas.map((item, idx) => {
                        const mesAno = String(item.__raw?.[56] || "-").replace(/\.\//g, '/').trim(); // Column BE
                        const tipo = String(item.__raw?.[58] || "-");  // Column BG
                        const centroCusto = String(item.__raw?.[59] || "-");  // Column BH
                        const valor = String(item.__raw?.[62] || "0"); // Column BK

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-xs font-black text-slate-400 uppercase">{mesAno}</td>
                            <td className="px-6 py-4 text-xs font-black text-indigo-600 uppercase">{tipo}</td>
                            <td className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase truncate max-w-md">{centroCusto}</td>
                            <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">R$ {valor}</td>
                          </tr>
                        )
                     })}
                   </tbody>
                </table>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
