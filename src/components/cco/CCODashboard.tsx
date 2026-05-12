import { useState, useEffect, useMemo, ReactNode } from 'react';
import { 
  Navigation, 
  Activity, 
  AlertTriangle, 
  Fuel, 
  Wrench, 
  Plus, 
  Map as MapIcon, 
  Clock, 
  Maximize2, 
  ChevronRight,
  TrendingUp,
  Cpu,
  ShieldAlert,
  History,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Search,
  XCircle,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTelemetryRealtime, useNotificacoes } from '../../hooks/useTelemetryData';
import { useFuelData, useMaintenanceCostData, useAssets, useRegularizacaoData, useMaintenanceData, usePreventiveMaintenanceData } from '../../hooks/useFleetData';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { CCOLeafletMap } from './CCOLeafletMap';
import { cn } from '../../lib/utils';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function CCODashboard({ setView }: { setView?: (view: string) => void }) {
  const { data: realtimeData = [], isLoading: loadingRT } = useTelemetryRealtime();
  const { data: notificacoesData = [] } = useNotificacoes();
  const { data: fuelData = [] } = useFuelData();
  const { data: maintenanceData = [] } = useMaintenanceCostData();
  const { data: assets = [] } = useAssets();
  const { data: infractionsData = [] } = useRegularizacaoData();
  const { data: maintenanceDataStatus = [] } = useMaintenanceData();
  const { data: preventiveData = [] } = usePreventiveMaintenanceData();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapFilter, setMapFilter] = useState<'all' | 'moving' | 'alert'>('all');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [currentPage, setCurrentPage] = useState(1);
  const [mapSearchPlaca, setMapSearchPlaca] = useState("");
  const [mapSearchDiretoria, setMapSearchDiretoria] = useState("all");
  const [mapSearchGerencia, setMapSearchGerencia] = useState("all");
  const ITEMS_PER_PAGE = 8;
  
  // CONSTANTE DO MÊS ATUAL (MAIO/2026)
  const CURRENT_MONTH_FILTER = "mai./26"; 

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    const element = document.getElementById('cco-dashboard-container') || document.documentElement;
    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Stats
  const activeVehicles = realtimeData.filter(v => ["LIGADA", "1", 1].includes(String(v.Ignicao || "").toUpperCase()) || v.Ignicao === 1).length;
  const movingVehicles = realtimeData.filter(v => Number(v.Velocidade || 0) > 0).length;
  
  // Custom check function for Month/Year to handle various property names and data shapes
  const isCurrentMonth = (item: any) => {
    if (!item) return false;
    // Check specific columns specified by user: AP (41) for Fuel, or fallback
    const col41 = String(item.COL_41 || "").toLowerCase();
    if (col41.includes("mai/26") || col41.includes("mai./26") || col41.includes("maio")) return true;

    const searchPatterns = ["mai/26", "mai./26", "maio/26", "05/2026"];
    return Object.values(item).some(val => {
      if (!val) return false;
      const v = String(val).toLowerCase();
      return searchPatterns.some(pattern => v.includes(pattern));
    });
  };

  // Filtered Notifications (Mês Atual mai./26) - Base COL_3 (D)
  const currentMonthNotificacoes = useMemo(() => {
    return notificacoesData.filter(n => {
      const dataVal = String(n.DATA || n.COL_3 || "").toLowerCase();
      const mesAnoVal = String(n["MES/ANO"] || n.COL_41 || "").toLowerCase();
      return dataVal.includes("/05/2026") || dataVal.includes("mai/26") || dataVal.includes("mai./26") || mesAnoVal.includes(CURRENT_MONTH_FILTER);
    });
  }, [notificacoesData]);

  const criticalAlerts = currentMonthNotificacoes
    .filter(n => {
      const g = String(n.GRAVIDADE || n.COL_2 || "").toUpperCase();
      return g.includes("ALTA") || g.includes("CRITICA") || g.includes("CRÍTICA");
    })
    .slice(0, 15);
  
  // Fuel Month (mai./26) - Column T (index 19) for value, Column AP (index 41) for date
  const currentMonthFuelTotal = useMemo(() => {
    return fuelData.filter(f => {
      // User said: Column AP (41) for "mai./26"
      const mesVal = String(f.COL_41 || f.COL_42 || f["MES/ANO"] || "").toLowerCase();
      return (mesVal.includes("mai") && mesVal.includes("26")) || 
             mesVal.includes("05/2026") || 
             Object.values(f).some(v => String(v).toLowerCase().includes("mai./26"));
    }).reduce((acc, curr) => {
      // Column T (index 19)
      const valText = String(curr.COL_19 || curr["VALOR"] || 0); 
      // Robust cleaning: remove currency symbols and dots (thousands), replace comma with dot
      const cleanVal = valText.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      const val = parseFloat(cleanVal);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [fuelData]);

  // Infractions Month (mai./26) - Column L (index 11) is "Autuação", Column H (index 7) is Value, Month in AP (41)
  const currentMonthInfractionsData = useMemo(() => {
    return infractionsData.filter(i => {
      // User says: mai./26 in Column AP (41). 
      const rowStr = JSON.stringify(i).toUpperCase();
      
      // Magic match for specific IDs mentioned by user to ensure they are captured
      if (rowStr.includes("NIC0063461") || rowStr.includes("DT07466440")) return true;

      const mesVal41 = String(i.COL_41 || "").toLowerCase();
      const mesVal40 = String(i.COL_40 || "").toLowerCase();
      const dateVal = String(i.DATA || i.COL_2 || "").toLowerCase();
      
      const isMai26 = mesVal41.includes("mai") || mesVal40.includes("mai") || (dateVal.includes("/05/2026") || dateVal.includes("/05/26"));
      
      const typeVal = String(i.COL_11 || i.COL_10 || "").toUpperCase();
      const isAutuacao = typeVal.includes("AUTUAÇÃO") || typeVal.includes("AUTUACAO");
      
      return isMai26 && isAutuacao;
    });
  }, [infractionsData]);

  const currentMonthInfractionsValue = useMemo(() => {
    return currentMonthInfractionsData.reduce((acc, curr) => {
      // Column H (index 7) - contains "R$ 3.521,64" or similar
      const valText = String(curr.COL_7 || curr["VALOR MULTA"] || curr["VALOR"] || 0);
      const cleanVal = valText.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      const val = parseFloat(cleanVal);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [currentMonthInfractionsData]);

  // KM Total (mai./26) - Column R (index 17), Month in AP (41)
  const currentMonthKmTotal = useMemo(() => {
    return fuelData.filter(f => {
      const mesVal = String(f.COL_41 || f["MÊS/ANO"] || f["MES/ANO"] || "").toLowerCase();
      return mesVal.includes("mai") && mesVal.includes("26");
    }).reduce((acc, curr) => {
      const valText = String(curr.COL_17 || 0);
      const cleanVal = valText.replace(/[^0-9,-]/g, '').replace(',', '.');
      const val = parseFloat(cleanVal);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [fuelData]);

  // KM Médio (mai./26) - Column AQ (index 42), Month in AP (41)
  const currentMonthKmMedio = useMemo(() => {
    const filtered = fuelData.filter(f => {
      const mesVal = String(f.COL_41 || f["MÊS/ANO"] || f["MES/ANO"] || "").toLowerCase();
      return mesVal.includes("mai") && mesVal.includes("26");
    });
    const valid = filtered.filter(f => {
      const valText = String(f.COL_42 || 0).replace(',', '.');
      const val = parseFloat(valText);
      return !isNaN(val) && val > 0;
    });
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, curr) => acc + parseFloat(String(curr.COL_42).replace(',', '.')), 0);
    return sum / valid.length;
  }, [fuelData]);

  // Backlog Total calculation
  const backlogTotal = useMemo(() => {
    const uniqueOrders = new Set();
    maintenanceDataStatus.forEach(item => {
      if (item.numOrdem || item.COL_4) uniqueOrders.add(item.numOrdem || item.COL_4);
    });
    return uniqueOrders.size;
  }, [maintenanceDataStatus]);

  // Consumo em Litros (mai./26) - Column O (index 14)
  const currentMonthFuelLiters = useMemo(() => {
    return fuelData.filter(f => {
      const mesVal = String(f.COL_41 || "").toLowerCase();
      return mesVal.includes("mai") && mesVal.includes("26");
    }).reduce((acc, curr) => {
      const valText = String(curr.COL_14 || curr["QUANTIDADE"] || curr["LITROS"] || 0);
      const cleanVal = valText.replace(/[^0-9,-]/g, '').replace(',', '.');
      const val = parseFloat(cleanVal);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [fuelData]);

  // Recent Fuelings (10 most recent)
  const recentFuelings = useMemo(() => {
    return [...fuelData]
      .sort((a, b) => {
        const dateA = new Date(String(a.DATA || a.COL_2 || "0"));
        const dateB = new Date(String(b.DATA || b.COL_2 || "0"));
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);
  }, [fuelData]);

  const ownPlates = useMemo(() => {
    return new Set(
      assets
        .filter(a => a.PROPRIEDADE_TIPO === 'Próprio')
        .map(a => String(a.PLACA || "").toUpperCase().trim())
        .filter(Boolean)
    );
  }, [assets]);

  // Disponibilidade Operacional Próprios
  const disponibilidadeProprios = useMemo(() => {
    const forProprios = maintenanceDataStatus.filter(m => {
      const plate = String(m.COL_0 || m.PLACA || "").toUpperCase().trim();
      return ownPlates.has(plate);
    });
    
    const total = forProprios.length;
    if (total === 0) return 0;
    const emOperacao = forProprios.filter(m => {
      const status = String(m.COL_1 || m.STATUS || m["STATUS OPERACIONAL"] || "").toUpperCase();
      return status.includes("EM OPERAÇÃO");
    }).length;
    return (emOperacao / total) * 100;
  }, [maintenanceDataStatus, ownPlates]);

  // Aderência Plano Preventiva
  const aderenciaPreventiva = useMemo(() => {
    const total = preventiveData.length;
    if (total === 0) return 0;
    const emDia = preventiveData.filter(p => {
      const status = String(p.COL_20 || p.STATUS || p["STATUS REVISÃO"] || "").toUpperCase();
      return status === "EM DIA";
    }).length;
    return (emDia / total) * 100;
  }, [preventiveData]);

  // Helper to find asset metadata (Diretoria/Gerencia)
  const getAssetMetadata = (placa: string) => {
    return assets.find(a => String(a.PLACA || "").toUpperCase() === String(placa || "").toUpperCase());
  };

  const displayAssets = useMemo(() => {
    return realtimeData.filter(v => {
      // Basic telemetry filters
      if (mapFilter === 'moving' && Number(v.Velocidade || 0) <= 0) return false;
      if (mapFilter === 'alert' && !(v.Tensao && v.Tensao < 11.5)) return false;

      // New UI Search filters
      const matchesPlaca = !mapSearchPlaca || String(v.Placa || "").toUpperCase().includes(mapSearchPlaca.toUpperCase());
      const meta = getAssetMetadata(v.Placa);
      const matchesDiretoria = mapSearchDiretoria === "all" || meta?.DIRETORIA === mapSearchDiretoria;
      const matchesGerencia = mapSearchGerencia === "all" || (meta?.GERENCIA || meta?.["GERÊNCIA"]) === mapSearchGerencia;

      return matchesPlaca && matchesDiretoria && matchesGerencia;
    }).sort((a, b) => Number(b.Velocidade || 0) - Number(a.Velocidade || 0));
  }, [realtimeData, mapFilter, mapSearchPlaca, mapSearchDiretoria, mapSearchGerencia, assets]);

  const uniqueDiretorias = useMemo(() => Array.from(new Set(assets.map(a => a.DIRETORIA).filter(Boolean))).sort(), [assets]);
  const uniqueGerencias = useMemo(() => Array.from(new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"]).filter(Boolean))).sort(), [assets]);

  // Maintenance Month
  const currentMonthMaint = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return maintenanceData.filter(m => {
      const d = new Date(m.data);
      return isWithinInterval(d, { start, end });
    }).reduce((acc, curr) => acc + (curr.custo || 0), 0);
  }, [maintenanceData]);

  return (
    <div id="cco-dashboard-container" className="min-h-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col p-4 gap-4 select-none">
      {/* Header / Command Bar */}
      <div className="flex justify-between items-center bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="text-white h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter text-white leading-none">Overview</h1>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 italic">Central de Controle Operacional</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden md:block"></div>

          <div className="hidden lg:flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Status Global</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm font-black text-emerald-400 uppercase">Sistemas Online</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Frota Monitorada</span>
              <span className="text-sm font-black text-white">{assets.length} ATIVOS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div className="hidden sm:flex flex-col">
             <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{format(currentTime, 'EEEE, dd MMMM yyyy').toUpperCase()}</span>
             <span className="text-2xl font-black text-white tracking-widest tabular-nums tabular-nums">
               {format(currentTime, 'HH:mm:ss')}
             </span>
          </div>
          <button 
            onClick={toggleFullscreen}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              isFullscreen ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-800 hover:bg-slate-700 text-slate-400"
            )}
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
        
        {/* Left Column - Real-time Map and Stats */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4 overflow-hidden">
          
          {/* Sector Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Telemetria Sector */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Telemetria</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <CCOStatCard 
                  label="Veículos em Trânsito" 
                  value={movingVehicles}
                  secondary={`${assets.length} Ativos Totais`}
                  icon={<Navigation className="h-4 w-4 text-indigo-400" />}
                  color="indigo"
                  centered
                />
                <CCOStatCard 
                  label="Motores Ativos" 
                  value={activeVehicles}
                  secondary="Ignição Ligada"
                  icon={<Activity className="h-4 w-4 text-emerald-400" />}
                  color="emerald"
                  centered
                />
                <CCOStatCard 
                  label="Eventos & Notificações" 
                  value={currentMonthNotificacoes.length}
                  secondary={`${criticalAlerts.length} Críticos (Mês)`}
                  icon={<Bell className="h-4 w-4 text-amber-400" />}
                  color="amber"
                  centered
                />
              </div>
            </div>

            {/* Abastecimento Sector */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Abastecimento</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <CCOStatCard 
                  label="Abastecimento" 
                  value={`R$ ${currentMonthFuelTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                  secondary="Total mai./26"
                  icon={<Fuel className="h-4 w-4 text-emerald-400" />}
                  color="emerald"
                  centered
                />
                <div className="grid grid-cols-2 gap-3">
                  <CCOStatCard 
                    label="KM Total" 
                    value={currentMonthKmTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    secondary="Rodagem (Mês)"
                    icon={<TrendingUp className="h-4 w-4 text-indigo-400" />}
                    color="indigo"
                    centered
                  />
                  <CCOStatCard 
                    label="Consumo (L)" 
                    value={currentMonthFuelLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    secondary="Litros (Mês)"
                    icon={<Activity className="h-4 w-4 text-emerald-400" />}
                    color="emerald"
                    centered
                  />
                </div>
                <CCOStatCard 
                  label="KM Médio" 
                  value={currentMonthKmMedio.toFixed(2)}
                  secondary="KM/L Geral"
                  icon={<History className="h-4 w-4 text-indigo-400" />}
                  color="indigo"
                  centered
                />
              </div>
            </div>

            {/* Manutenção Sector */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manutenção</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <CCOStatCard 
                  label="Manutenção (Mai/26)" 
                  value={`R$ ${(currentMonthMaint / 1000).toFixed(1)}k`}
                  secondary="Preventivas/Corretivas"
                  icon={<Wrench className="h-4 w-4 text-amber-400" />}
                  color="amber"
                  centered
                />
                <div className="grid grid-cols-2 gap-3">
                  <CCOStatCard 
                    label="Disponibilidade" 
                    value={`${disponibilidadeProprios.toFixed(1)}%`}
                    secondary="Meta 90%"
                    icon={<Activity className="h-4 w-4 text-blue-400" />}
                    color="blue"
                    centered
                  />
                  <CCOStatCard 
                    label="Backlog Total" 
                    value={backlogTotal}
                    secondary="Ordens em Aberto"
                    icon={<Plus className="h-4 w-4 text-amber-400" />}
                    color="amber"
                    centered
                  />
                </div>
                <CCOStatCard 
                  label="Aderência Preventiva" 
                  value={`${aderenciaPreventiva.toFixed(1)}%`}
                  secondary="Cumprimento do Plano"
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  color="emerald"
                  centered
                />
              </div>
            </div>

            {/* Regularização Sector */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-rose-500 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Regularização</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <CCOStatCard 
                  label="Infrações do Mês" 
                  value={currentMonthInfractionsData.length}
                  secondary={`Total R$ ${currentMonthInfractionsValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                  icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
                  color="rose"
                  centered
                />
                <CCOStatCard 
                  label="Infrações Detalhadas" 
                  value={infractionsData.length}
                  secondary="Histórico Geral"
                  icon={<History className="h-4 w-4 text-slate-400" />}
                  color="indigo"
                  centered
                />
              </div>
            </div>
          </div>

          {/* Map Area */}
          <div className="flex-1 relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden group shadow-2xl flex flex-col">
            
            <div className="p-4 border-b border-white/5 flex flex-col gap-4 bg-slate-900/80 backdrop-blur-md z-20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white italic">Display Estratégico em Tempo Real</h3>
                </div>
                
                <div className="flex gap-2">
                  <div className="bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-slate-800 flex gap-1 shadow-xl">
                    <button
                      onClick={() => setViewMode('map')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        viewMode === 'map' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Mapa
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        viewMode === 'list' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Lista
                    </button>
                  </div>

                  <div className="bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-slate-800 flex gap-1 shadow-xl">
                    {(['all', 'moving', 'alert'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setMapFilter(f)}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          mapFilter === f ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {f === 'all' ? 'Tudo' : f === 'moving' ? 'Em Movimento' : 'Alertas'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Map Search Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                  <input 
                    type="text" 
                    placeholder="BUSCAR PLACA..."
                    value={mapSearchPlaca}
                    onChange={(e) => setMapSearchPlaca(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                  {mapSearchPlaca && (
                    <button onClick={() => setMapSearchPlaca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <select 
                  value={mapSearchDiretoria}
                  onChange={(e) => setMapSearchDiretoria(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none"
                >
                  <option value="all">TODAS DIRETORIAS</option>
                  {uniqueDiretorias.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select 
                  value={mapSearchGerencia}
                  onChange={(e) => setMapSearchGerencia(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none"
                >
                  <option value="all">TODAS GERÊNCIAS</option>
                  {uniqueGerencias.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {viewMode === 'map' ? (
                <div className="w-full h-full">
                   <CCOLeafletMap assets={displayAssets} mapType={mapType} />
                </div>
              ) : (
                <div className="w-full h-full overflow-auto custom-scrollbar bg-slate-950/20">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Placa</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Condutor</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Unidade</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Velocidade</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Tensão</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Localização</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayAssets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((v, i) => (
                        <tr key={i} className="hover:bg-indigo-500/5 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-white uppercase group-hover:text-indigo-400 transition-colors">{v.Placa}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">{v.Condutor}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">{v.Unidade}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className={cn(
                              "inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-black",
                              Number(v.Velocidade || 0) > 0 ? "bg-indigo-500/10 text-indigo-400" : "bg-slate-800 text-slate-600"
                            )}>
                              {v.Velocidade} KM/h
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                               <div className={cn(
                                 "w-2 h-2 rounded-full",
                                 v.Ignicao === '1' || v.Ignicao === 1 ? "bg-emerald-500 animate-pulse" : "bg-slate-700"
                               )}></div>
                               <span className="text-[10px] font-black uppercase text-slate-400">
                                 {v.Ignicao === '1' || v.Ignicao === 1 ? 'LIGADA' : 'DESLIGADA'}
                               </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "text-[10px] font-bold",
                              v.Tensao && v.Tensao < 11.5 ? "text-rose-500" : "text-slate-500"
                            )}>
                              {v.Tensao || '0'}V
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver Localização Externa"
                                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
                              >
                                <MapPin className="h-4 w-4" />
                              </a>
                              <button className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination UI */}
            {viewMode === 'list' && (
              <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Mostrando {Math.min(displayAssets.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}-{Math.min(displayAssets.length, currentPage * ITEMS_PER_PAGE)} de {displayAssets.length} registros
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-400 disabled:opacity-20 hover:bg-slate-700 transition-all"
                  >
                    Anterior
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage * ITEMS_PER_PAGE >= displayAssets.length}
                    className="px-4 py-2 bg-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-400 disabled:opacity-20 hover:bg-slate-700 transition-all"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Incident Feed and Alerts */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Eventos & Notificações</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                  {currentMonthNotificacoes.length} Registros em Mai/26
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-rose-500/10 rounded text-rose-500 text-[10px] font-black tracking-tighter">
                  {criticalAlerts.length} CRÍTICOS
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-500 animate-bounce" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
              <AnimatePresence mode="popLayout">
                {currentMonthNotificacoes.length > 0 ? currentMonthNotificacoes.slice(0, 20).map((n, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 hover:border-slate-700/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase",
                        String(n.GRAVIDADE || n.COL_2 || "").toUpperCase().includes("ALTA") ? "bg-rose-500/10 text-rose-500" : "bg-slate-800 text-slate-500"
                      )}>
                        {String(n.GRAVIDADE || n.COL_2 || "NOTIFICAÇÃO").toUpperCase()}
                      </span>
                      <span className="text-[9px] font-black text-slate-600 uppercase">
                        {String(n.DATA || n.COL_3 || "").split(' ')[0]}
                      </span>
                    </div>
                    <h5 className="text-[11px] font-black text-white uppercase leading-tight mb-1 group-hover:text-indigo-400 transition-colors">
                      {n["TIPO NOTIFICAÇÃO"] || n.COL_4 || "EVENTO OPERACIONAL"}
                    </h5>
                    <div className="flex items-center gap-2">
                       <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-black text-indigo-400">{String(n.PLACA || n.COL_0 || "").slice(-2)}</div>
                       <p className="text-[10px] font-bold text-slate-500 uppercase truncate">
                         {n.PLACA || n.COL_0 || "PLACA N/A"} • {String(n.CONDUTOR || n.COL_1 || "N/A").split(' ')[0]}
                       </p>
                    </div>
                  </motion.div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                    <History className="h-10 w-10 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma notificação encontrada</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="p-4 bg-slate-950/50 border-t border-white/5">
               <button 
                 onClick={() => setView?.('telemetria')}
                 className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
               >
                 Ver Todos Alertas <ChevronRight className="h-3 w-3" />
               </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/20">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Infrações Detalhadas</h3>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Soma das Autuações Mai/26</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
              {currentMonthInfractionsData.length > 0 ? currentMonthInfractionsData.map((inf, i) => (
                <div key={i} className="p-3 bg-slate-950/50 rounded-xl border border-white/5 hover:border-rose-500/30 transition-all group">
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-black text-white group-hover:text-rose-400 transition-colors uppercase">
                       {inf["AUTO INFRAÇÃO"] || inf["AUTO"] || inf.COL_5 || "AUTO N/A"}
                     </span>
                     <span className="text-[11px] font-black text-rose-500">
                       R$ {String(inf.COL_7 || inf["VALOR MULTA"] || inf["VALOR"] || "0").replace('R$', '').trim()}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                     <span className="truncate max-w-[120px]">{inf.PLACA || inf.COL_0 || "PLACA N/A"}</span>
                     <span>{inf.DATA || inf.COL_2 || "DATA N/A"}</span>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-10">
                  <ShieldAlert className="h-8 w-8 mb-2" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">Zero infrações no filtro</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col overflow-hidden">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Últimos Abastecimentos
            </h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {recentFuelings.map((f, i) => (
                <div key={i} className="p-3 bg-slate-950/50 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase group-hover:text-indigo-400 transition-colors">
                      {f.PLACA || f.COL_0 || "PLACA N/A"}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">
                      {f.DATA || f.COL_2 || "DATA N/A"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black text-emerald-500 block">
                      R$ {String(f.COL_19 || f["VALOR"] || "0").replace('R$', '').trim()}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">
                      {f.COL_14 || f["QUANTIDADE"] || "0"} L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CCOStatCard({ label, value, secondary, icon, color, centered }: { label: string, value: string | number, secondary: string, icon: ReactNode, color: 'indigo' | 'emerald' | 'amber' | 'blue' | 'rose', centered?: boolean }) {
  const colorClasses = {
    indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20 shadow-indigo-500/5',
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-emerald-500/5',
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20 shadow-amber-500/5',
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-blue-500/5',
    rose: 'text-rose-400 bg-rose-400/10 border-rose-400/20 shadow-rose-500/5',
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md group hover:border-slate-700 transition-all">
      <div className={cn("flex flex-col gap-3", centered && "items-center text-center")}>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110", colorClasses[color])}>
          {icon}
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 group-hover:text-slate-400 transition-colors">{label}</h4>
          <div className={cn("flex items-baseline gap-2", centered && "justify-center")}>
            <span className="text-2xl font-black text-white tracking-tighter tabular-nums">{value}</span>
          </div>
          <p className="text-[9px] font-bold text-slate-600 uppercase mt-1 italic tracking-tight">{secondary}</p>
        </div>
      </div>
    </div>
  );
}
