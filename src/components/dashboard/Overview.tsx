import { MetricCard } from "./MetricCard";
import { ChartCard } from "./ChartCard";
import { OverviewFilterBar } from "./OverviewFilterBar";
import { Truck, Fuel, Activity, TrendingUp, Download, DollarSign, Wrench, Users, ShieldAlert, Eye, X, ImageIcon, Monitor, Info, Settings as SettingsIcon } from "lucide-react";
import { exportToExcel } from "../../lib/exportToExcel";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell 
} from "recharts";
import { Asset, TelemetryData, FuelData, MaintenanceData, MaintenanceCostData } from "../../types";
import { useState, useMemo } from "react";
import { useAssets, useMaintenanceData } from "../../hooks/useFleetData";
import { motion, AnimatePresence } from "motion/react";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function Overview() {
  const assetsQuery = useAssets();
  const maintenanceQuery = useMaintenanceData();
  const assets = (assetsQuery.data as Asset[]) || [];
  const maintenanceData = (maintenanceQuery.data as any[]) || [];
  const loadingFetch = assetsQuery.isLoading || maintenanceQuery.isLoading;
  const isError = assetsQuery.isError || maintenanceQuery.isError;
  
  // Calcular Backlog Total
  const backlogTotal = useMemo(() => {
    // Deduplicate by numOrdem as done in BacklogDashboard
    const uniqueOrders = new Set();
    maintenanceData.forEach(item => {
      if (item.numOrdem) uniqueOrders.add(item.numOrdem);
    });
    return uniqueOrders.size;
  }, [maintenanceData]);

  const telemetry = [] as TelemetryData[];
  const fuel = [] as FuelData[];
  const maintenance = [] as MaintenanceData[];
  const maintenanceCost = [] as MaintenanceCostData[];

  const [searchPlaca, setSearchPlaca] = useState<string>("");
  const [selectedTipo, setSelectedTipo] = useState<string>("all");
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("all");
  const [selectedGerencia, setSelectedGerencia] = useState<string>("all");
  const [selectedCriticidade, setSelectedCriticidade] = useState<string>("all");
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Helper for Google Drive thumbnails
  const formatGoogleDriveLink = (link: string) => {
    if (!link) return null;
    if (link.includes('drive.google.com')) {
      const fileIdMatch = link.match(/\/file\/d\/([^\/\?]+)/) || link.match(/\/d\/([^\/\?]+)/) || link.match(/[?&]id=([^&]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w800`;
      }
    }
    return link;
  };

  // Obter mês/ano atual
  const currentMonthYear = useMemo(() => {
    const now = new Date();
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${meses[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
  }, []);

  // Filtrar dados baseado nos filtros de busca
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Regra Global: Somente veículos OPERACIONAIS
      // Valor já normalizado no fleetService
      const statusStr = (asset.STATUS_OPERACIONAL || "").toUpperCase().trim();
      if (statusStr !== 'OPERACIONAL') return false;

      const placa = String(asset.PLACA || asset.placa || "").toUpperCase();
      const matchesPlaca = !searchPlaca || placa.includes(searchPlaca.toUpperCase());
      const matchesTipo = selectedTipo === "all" || asset.TIPO === selectedTipo;
      const matchesDiretoria = selectedDiretoria === "all" || asset.DIRETORIA === selectedDiretoria;
      const matchesGerencia = selectedGerencia === "all" || (asset.GERENCIA || asset["GERÊNCIA"]) === selectedGerencia;
      const matchesCriticidade = selectedCriticidade === "all" || (asset.CRITICIDADE || asset.criticidade) === selectedCriticidade;
      
      return matchesPlaca && matchesTipo && matchesDiretoria && matchesGerencia && matchesCriticidade;
    });
  }, [assets, searchPlaca, selectedTipo, selectedDiretoria, selectedGerencia, selectedCriticidade]);

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchPlaca, selectedTipo, selectedDiretoria, selectedGerencia, selectedCriticidade]);

  const totalAssets = filteredAssets.length;
  const ativosProprios = filteredAssets.filter(a => a.PROPRIEDADE_TIPO === 'Próprio').length;
  const ativosLocados = filteredAssets.filter(a => a.PROPRIEDADE_TIPO === 'Locado').length;
  
  const criticalityData = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0 };
    filteredAssets.forEach(asset => {
      const crit = (asset.CRITICIDADE || asset.criticidade)?.toUpperCase();
      if (crit === 'A') counts.A++;
      else if (crit === 'B') counts.B++;
      else if (crit === 'C') counts.C++;
    });
    return [
      { name: 'Nível A (Crítico)', value: counts.A, fill: '#ef4444' },
      { name: 'Nível B (Médio)', value: counts.B, fill: '#f59e0b' },
      { name: 'Nível C (Normal)', value: counts.C, fill: '#10b981' },
    ];
  }, [filteredAssets]);
  
  const assetsByType = filteredAssets.reduce((acc, asset) => {
    const type = asset.TIPO || "N/A";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const waterfallData = Object.entries(assetsByType)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5)
    .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));

  const handleClearFilters = () => {
    setSearchPlaca("");
    setSelectedTipo("all");
    setSelectedDiretoria("all");
    setSelectedGerencia("all");
    setSelectedCriticidade("all");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const dataToExport = filteredAssets.map((asset) => ({
      "Placa": asset.PLACA || "N/A",
      "Tipo": asset.TIPO || "N/A",
      "Propriedade": asset.PROPRIEDADE_TIPO || "N/A",
      "Origem": asset.PROPRIEDADE || "N/A",
      "Modelo": asset.MODELO || "N/A",
      "Status": asset["STATUS OPERACIONAL"] || "N/A",
    }));
    exportToExcel(dataToExport, "Frota_Nexus_Auditada", "Consolidado");
  };

  if (loadingFetch && assets.length === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-slate-800 dark:text-white font-black uppercase tracking-tighter text-xl">Nexus Frota BI</p>
          <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-[10px] mt-2 italic">Sincronizando Base de Dados Auditada...</p>
        </div>
      </div>
    );
  }

  const CHART_COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#f43f5e',
    info: '#0ea5e9',
    muted: '#475569'
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="space-y-1">
          <h1 className="text-5xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-[0.8] italic">
            Dashboard{"\n"}Executivo
          </h1>
          <p className="text-slate-500 font-bold tracking-[0.3em] uppercase text-[9px] flex items-center gap-2 pt-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Intelligence & Audit System Nexus
          </p>
        </div>
        
        <OverviewFilterBar 
          assets={assets}
          searchPlaca={searchPlaca}
          selectedTipo={selectedTipo}
          selectedDiretoria={selectedDiretoria}
          selectedGerencia={selectedGerencia}
          selectedCriticidade={selectedCriticidade}
          onSearchPlacaChange={setSearchPlaca}
          onTipoChange={setSelectedTipo}
          onDiretoriaChange={setSelectedDiretoria}
          onGerenciaChange={setSelectedGerencia}
          onCriticidadeChange={setSelectedCriticidade}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <MetricCard 
          title="Frota Total" 
          value={totalAssets} 
          description="Ativos auditados"
          icon={<Truck className="text-indigo-600" size={24} />}
          colorScheme="primary"
          centered
        />
        <MetricCard 
          title="Gestão Própria" 
          value={ativosProprios} 
          description="Viatura Compesa/IPA"
          icon={<ShieldAlert className="text-emerald-500" size={24} />}
          colorScheme="success"
          centered
        />
        <MetricCard 
          title="Frota Locada" 
          value={ativosLocados} 
          description="Terceirização ativa"
          icon={<Users className="text-sky-500" size={24} />}
          colorScheme="primary"
          centered
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard 
          title="Matriz de Criticidade" 
          description="Impacto na continuidade do serviço operacional"
        >
          <div className="h-[350px] w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={criticalityData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                   dataKey="name"
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 900 }}
                   interval={0}
                />
                <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: 'none', 
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                    padding: '16px'
                  }}
                  itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 900 }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[10, 10, 0, 0]} 
                  barSize={70}
                  label={{ position: 'top', fill: '#475569', fontSize: 12, fontWeight: 900 }}
                >
                  {criticalityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard 
          title="Composição da Frota" 
          description="Top 5 categorias predominantes no sistema"
        >
          <div className="h-[350px] w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                   type="number" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: CHART_COLORS.muted, fontSize: 11, fontWeight: 900 }}
                />
                <YAxis 
                   dataKey="name" 
                   type="category" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: CHART_COLORS.muted, fontSize: 11, fontWeight: 900 }}
                   width={100}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: 'none', 
                    borderRadius: '16px',
                    padding: '16px'
                  }}
                  itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 900 }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 20, 20, 0]} 
                  barSize={40}
                >
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Asset List Integration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Detalhes da Frota</h2>
            <p className="text-xs text-slate-500 font-medium tracking-tight uppercase">Catálogo completo e auditado ({filteredAssets.length})</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Placa</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo/Modelo</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Propriedade</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Gerência</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Criticidade</th>
                  <th className="px-6 py-4 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded text-sm select-all">
                        {item.PLACA || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700 dark:text-white uppercase leading-none">{item.TIPO}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{item.MODELO}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${
                        item.PROPRIEDADE_TIPO === 'Próprio' 
                          ? 'bg-emerald-100 text-emerald-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {item.PROPRIEDADE_TIPO}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          {item.STATUS_OPERACIONAL || item["STATUS OPERACIONAL"] || "OPERACIONAL"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase truncate max-w-[150px]">
                      {item.GERENCIA || item["GERÊNCIA"] || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full font-black text-[10px] ${
                        (item.CRITICIDADE || item.criticidade) === 'A' ? 'bg-rose-100 text-rose-600' :
                        (item.CRITICIDADE || item.criticidade) === 'B' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {item.CRITICIDADE || item.criticidade || 'C'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedAsset(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Mostrando {Math.min(filteredAssets.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}-{Math.min(filteredAssets.length, currentPage * ITEMS_PER_PAGE)} de {filteredAssets.length} ativos
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-400 disabled:opacity-20 hover:bg-slate-50 transition-all shadow-sm"
              >
                Anterior
              </button>
              <button 
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage * ITEMS_PER_PAGE >= filteredAssets.length}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-400 disabled:opacity-20 hover:bg-slate-50 transition-all shadow-sm"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Details Modal Integration */}
      <AnimatePresence>
        {isModalOpen && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg">
                    <Truck size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Ficha Técnica do Ativo</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedAsset.PLACA}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="relative group">
                      <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center border-4 border-white dark:border-slate-800">
                        {selectedAsset["LINK IMAGEM ATIVO"] ? (
                          <img 
                            src={formatGoogleDriveLink(String(selectedAsset["LINK IMAGEM ATIVO"])) || ""} 
                            alt="Visual do Ativo"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => (e.currentTarget.src = "https://picsum.photos/seed/truck/800/600")}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-center">
                            <ImageIcon className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={48} />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Imagem não disponível</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-800/30">
                      <div className="flex items-center space-x-2 mb-4">
                        <Monitor size={18} className="text-indigo-600" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-100">INFORMAÇÕES DO EQUIPAMENTO</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Combustível</p>
                          <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">{selectedAsset["COMBUSTÍVEL"] || selectedAsset.COMBUSTIVEL || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Marca/Modelo</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{selectedAsset.MARCA} {selectedAsset.MODELO}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center space-x-2 mb-4 opacity-50">
                        <Info size={16} />
                        <h4 className="text-xs font-black uppercase tracking-widest">Atribuição & Localização</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Diretoria</span>
                          <span className="text-sm font-black text-slate-800 dark:text-white uppercase">{selectedAsset.DIRETORIA || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Gerência</span>
                          <span className="text-sm font-black text-slate-800 dark:text-white uppercase truncate ml-4 text-right">{selectedAsset.GERENCIA || selectedAsset["GERÊNCIA"] || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Propriedade</span>
                          <span className="text-sm font-black text-slate-800 dark:text-white uppercase text-right">{selectedAsset.PROPRIEDADE || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 leading-none">Status Operacional</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                          {selectedAsset["STATUS OPERACIONAL"]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center bg-slate-50/50 dark:bg-slate-800/20">
                <button onClick={() => setIsModalOpen(false)} className="text-xs font-black text-white uppercase bg-indigo-600 px-8 py-3 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none">Fechar Ficha</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
