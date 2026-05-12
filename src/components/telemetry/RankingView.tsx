import { Trophy, Medal, AlertCircle, TrendingUp, User, Search, Download, Calendar, ShieldAlert, Info, AlertTriangle, Scale, Eye, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import { fetchNotificacoes, fetchRegularizacaoData } from '../../services/fleetService';
import { NotificacaoTelemetriaData } from '../../types';
import { exportToExcel } from '../../lib/exportToExcel';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export default function RankingView() {
  const [notificacoes, setNotificacoes] = useState<NotificacaoTelemetriaData[]>([]);
  const [infracoesData, setInfracoesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesInicio, setSelectedMesInicio] = useState<string>("all");
  const [selectedMesFim, setSelectedMesFim] = useState<string>("all");
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<any | null>(null);
  const [isTerceirizado, setIsTerceirizado] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [notif, infracoes] = await Promise.all([
          fetchNotificacoes(),
          fetchRegularizacaoData()
        ]);
        setNotificacoes(notif);
        setInfracoesData(infracoes);
      } catch (err) {
        console.error("Erro ao carregar dados do ranking:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getMesAno = (dateStr: string) => {
    if (!dateStr || dateStr === "N/A") return "";
    try {
      const parts = dateStr.split(' ')[0].split('/');
      if (parts.length === 3) {
        const mes = parts[1];
        const ano = parts[2].slice(-2);
        const mesesNomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        const mesNome = mesesNomes[parseInt(mes) - 1];
        if (mesNome) return `${mesNome}/${ano}`;
      }
      return "";
    } catch {
      return "";
    }
  };

  const meses = useMemo(() => {
    const set = new Set<string>();
    notificacoes.forEach(n => {
      const dataStr = String(n.__raw?.[8] || n.DATA_HORA || "").trim();
      const ma = getMesAno(dataStr);
      if (ma) set.add(ma);
    });
    infracoesData.forEach(i => {
      const dataStr = String(i.__raw?.[8] || "").trim();
      const ma = getMesAno(dataStr);
      if (ma) set.add(ma);
    });
    
    return Array.from(set).sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      const mesesNomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      const valA = parseInt(anoA) * 100 + mesesNomes.indexOf(mesA);
      const valB = parseInt(anoB) * 100 + mesesNomes.indexOf(mesB);
      return valA - valB;
    });
  }, [notificacoes, infracoesData]);

  const filteredNotificacoes = useMemo(() => {
    let result = notificacoes;
    if (selectedMesInicio !== "all" || selectedMesFim !== "all") {
      result = result.filter(n => {
        const dataStr = String(n.__raw?.[8] || n.DATA_HORA || "").trim();
        const ma = getMesAno(dataStr);
        if (!ma) return false;
        
        const maIndex = meses.indexOf(ma);
        const inicioIndex = selectedMesInicio === "all" ? 0 : meses.indexOf(selectedMesInicio);
        const fimIndex = selectedMesFim === "all" ? meses.length - 1 : meses.indexOf(selectedMesFim);
        
        return maIndex >= inicioIndex && maIndex <= fimIndex;
      });
    }
    return result;
  }, [notificacoes, selectedMesInicio, selectedMesFim, meses]);

  const filteredInfracoes = useMemo(() => {
    let result = infracoesData;
    if (selectedMesInicio !== "all" || selectedMesFim !== "all") {
      result = result.filter(i => {
        const dataStr = String(i.__raw?.[8] || "").trim(); // Col I
        const ma = getMesAno(dataStr);
        if (!ma) return false;

        const maIndex = meses.indexOf(ma);
        const inicioIndex = selectedMesInicio === "all" ? 0 : meses.indexOf(selectedMesInicio);
        const fimIndex = selectedMesFim === "all" ? meses.length - 1 : meses.indexOf(selectedMesFim);

        return maIndex >= inicioIndex && maIndex <= fimIndex;
      });
    }
    return result;
  }, [infracoesData, selectedMesInicio, selectedMesFim, meses]);

  const unifiedRanking = useMemo(() => {
    const penaltyMap: Record<string, { 
      driver: string, 
      score: number, 
      teleCount: number, 
      infraCount: number, 
      totalAlerts: number, 
      details: { type: 'telemetria' | 'ctb', desc: string, date: string, severity: string, points: number, sei: string }[] 
    }> = {};

    // 1. Processar Telemetria (GAD-NI-003-01: Advertência até o 3º registro)
    filteredNotificacoes.forEach(n => {
      const driverRaw = String(n.CONDUTOR || "N/A").trim();
      const driverNormalized = driverRaw.toUpperCase();
      
      // Filtro robusto para condutores inválidos
      if (!driverRaw || 
          driverNormalized === "N/A" || 
          driverNormalized === "NA" || 
          driverNormalized === "NULL" || 
          driverNormalized === "N / A" || 
          driverNormalized === "0" || 
          driverNormalized === "-" ||
          driverNormalized.startsWith("NA ") ||
          driverNormalized.includes("PÁTIO")
      ) return;

      if (!penaltyMap[driverRaw]) {
        penaltyMap[driverRaw] = { driver: driverRaw, score: 0, teleCount: 0, infraCount: 0, totalAlerts: 0, details: [] };
      }

      const keys = Object.keys(n);
      const dateStr = String(n[keys[3]] || n.DATA_HORA || "-");
      const desc = String(n.EVENTO || n[keys[5]] || "Alerta de Telemetria");
      const sei = String(n.__raw?.[0] || n.SEI || n["Nº SEI"] || "-");
      
      // Telemetria é Advertência base. Se passar de 3, ganha mais pontos
      let points = 5; 
      if (penaltyMap[driverRaw].teleCount >= 3) points = 15; // Escalona para Suspensão

      penaltyMap[driverRaw].score += points;
      penaltyMap[driverRaw].teleCount += 1;
      penaltyMap[driverRaw].totalAlerts += 1;
      penaltyMap[driverRaw].details.push({ 
        type: 'telemetria', 
        desc,
        sei,
        date: dateStr, 
        severity: 'ADVERTÊNCIA', 
        points 
      });
    });

    // 2. Processar Infrações CTB (GAD-NI-003-01: Classificação por Gravidade)
    filteredInfracoes.forEach(i => {
      const raw = i.__raw || [];
      const driverRaw = String(raw[20] || "N/A").trim(); // Coluna U
      const driverNormalized = driverRaw.toUpperCase();

      if (!driverRaw || 
          driverNormalized === "N/A" || 
          driverNormalized === "NA" || 
          driverNormalized === "NULL" || 
          driverNormalized === "N / A" || 
          driverNormalized === "0" || 
          driverNormalized === "-" ||
          driverNormalized.startsWith("NA ") ||
          driverNormalized.includes("PÁTIO")
      ) return;

      if (!penaltyMap[driverRaw]) {
        penaltyMap[driverRaw] = { driver: driverRaw, score: 0, teleCount: 0, infraCount: 0, totalAlerts: 0, details: [] };
      }

      const dateStr = String(raw[8] || "-"); // Coluna I
      const desc = String(raw[13] || "Infração de Trânsito"); // Coluna N
      const sei = String(raw[15] || "-"); // Coluna P (Nº SEI)
      const gravInput = String(raw[14] || "").toUpperCase(); // Coluna O
      
      let points = 5;
      let severityLabel = 'ADVERTÊNCIA';
      
      if (gravInput.includes("GRAVISSIMA")) {
        points = 40; // Suspensão Definitiva
        severityLabel = 'GRAVÍSSIMA';
      } else if (gravInput.includes("GRAVE")) {
        points = 20; // Suspensão Temporária
        severityLabel = 'GRAVE';
      } else if (gravInput.includes("MEDIA") || gravInput.includes("MÉDIA")) {
        points = 7;
        severityLabel = 'MÉDIA';
      } else if (gravInput.includes("LEVE")) {
        points = 5;
        severityLabel = 'LEVE';
      }

      penaltyMap[driverRaw].score += points;
      penaltyMap[driverRaw].infraCount += 1;
      penaltyMap[driverRaw].totalAlerts += 1;
      penaltyMap[driverRaw].details.push({ 
        type: 'ctb', 
        desc,
        sei,
        date: dateStr, 
        severity: severityLabel, 
        points 
      });
    });

    // Finalizar cálculos de Situação
    return Object.values(penaltyMap).map(r => {
      const hasGravissima = r.details.some(d => d.severity === 'GRAVÍSSIMA');
      const hasGrave = r.details.some(d => d.severity === 'GRAVE');
      
      let situation = "Advertência";
      let situationColor = "text-amber-500";
      let bgClass = "bg-amber-50";

      if (hasGravissima) {
        situation = "Suspensão Definitiva";
        situationColor = "text-rose-700";
        bgClass = "bg-rose-100";
      } else if (hasGrave || r.teleCount > 3) {
        situation = "Suspensão Temporária";
        situationColor = "text-rose-500";
        bgClass = "bg-rose-50";
      } else if (r.totalAlerts === 0) {
        situation = "Regular";
        situationColor = "text-emerald-500";
        bgClass = "bg-emerald-50";
      }

      return { ...r, situation, situationColor, bgClass };
    }).sort((a, b) => b.score - a.score);
  }, [filteredNotificacoes, filteredInfracoes]);

  if (loading) {
     return (
      <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Unificando Rankings GAD-NI-003-01...</p>
      </div>
    );
  }

  const generateFormalText = (driver: any, type: 'compesa' | 'terceirizado' = 'compesa') => {
    const { situation, details, score } = driver;
    const driverName = driver.driver;
    const date = new Date().toLocaleDateString('pt-BR');
    
    // Resumo dos eventos para o texto
    const detailsList = details || [];
    const teleEvents = detailsList.filter((d: any) => d.type === 'telemetria').length;
    const infraEvents = detailsList.filter((d: any) => d.type === 'ctb');
    const gravissima = infraEvents.find((d: any) => d.severity === 'GRAVÍSSIMA');
    const grave = infraEvents.find((d: any) => d.severity === 'GRAVE');
    const lastEvent = detailsList[detailsList.length - 1] || { severity: 'N/A', desc: 'N/A', sei: '____' };
    
    // Gerar texto do histórico (SEIs e descrições)
    const historicoText = detailsList
      .map((d: any) => `${d.desc}${d.sei !== '-' ? ` [SEI ${d.sei}]` : ''}`)
      .join('; ');

    let baseText = "";

    if (situation === "Suspensão Definitiva") {
      const title = "NOTIFICAÇÃO DE INFRAÇÃO CRÍTICA E ORIENTAÇÃO DE SUSPENSÃO DEFINITIVA";
      const justification = gravissima 
        ? `a ocorrência de infração de natureza GRAVÍSSIMA (${gravissima.desc}), vinculada ao SEI ${gravissima.sei || "mencionado em sistema"}`
        : `o acúmulo crítico de pontuação (${score} pontos) e reincidência de comportamentos de risco extremo`;
      
      baseText = `${title}\n\nPrezado(a) Gestor(a) da Unidade,\n\nInformamos que o colaborador ${driverName}, sob sua coordenação, registrou uma ocorrência de extrema gravidade em sua condução, fundamentada em ${justification}.\n\nConsiderando o estrito cumprimento da Norma Interna GAD-NI-003-01 e visando preservar a segurança operacional e a integridade do patrimônio da Companhia, orientamos a aplicação da SUSPENSÃO DEFINITIVA do direito de condução de veículos da frota para este colaborador.\n\nHistórico consolidado do condutor: ${historicoText}.\n\nSolicitamos que o colaborador seja formalmente comunicado e orientado a devolver chaves e documentos de veículos sob sua responsabilidade imediatamente.\n\nreforça-se a necessidade de tal medida para fins de correção de conduta e registro na pasta do funcionário, com o devido encaminhamento da advertência pelo SEI à gestão de recursos humanos da empresa (CAP).\n\nAtenciosamente,\nCoordenação de Gestão de Frotas – CGF\n\nDATA: ${date}`;
    } else if (situation === "Suspensão Temporária") {
      const title = "NOTIFICAÇÃO DE INFRAÇÃO E ORIENTAÇÃO DE SUSPENSÃO TEMPORÁRIA";
      const justification = grave 
        ? `a ocorrência de infração de natureza GRAVE (${grave.desc})${grave.sei !== '-' ? ` vinculada ao SEI ${grave.sei}` : ''}` 
        : `o acúmulo de ${teleEvents} notificações de telemetria, excedendo o limite de tolerância previsto`;
      
      baseText = `${title}\n\nPrezado(a) Gestor(a) da Unidade,\n\nComunicamos que o colaborador ${driverName} registrou intercorrência(s) relevante(s) na condução de vehicle, sendo motivada por ${justification}.\n\nConforme a Norma Interna GAD-NI-003-01, orientamos a aplicação de SUSPENSÃO TEMPORÁRIA do direito de dirigir veículos a serviço da COMPESA, devendo o condutor ser encaminhado para processo de reorientação sobre segurança viária.\n\nHistórico do condutor: ${historicoText}.\n\nFavor formalizar a medida e realizar os registros funcionais pertinentes.\n\nreforça-se a necessidade de tal medida para fins de correção de conduta e posterior descontos das infrações no BM do contrato.\n\nAtenciosamente,\nCoordenação de Gestão de Frotas – CGF\n\nDATA: ${date}`;
    } else {
      // ADVERTÊNCIA FORMAL - NOVOS TEMPLATES (EXATAMENTE COMO SOLICITADO)
      if (type === 'compesa') {
        baseText = `1. ADVERTÊNCIA FORMAL p EMPREGADOS COMPESA\n\nTítulo:\nNOTIFICAÇÃO DE INFRAÇÃO E ORIENTAÇÃO DE ADVERTÊNCIA FORMAL\n\nTexto:\nPrezado(a) Gestor(a) da Unidade,\n\nInformamos que foi registrado em sistema um evento de natureza [${lastEvent.severity}] para o colaborador ${driverName}, referente à infração ${lastEvent.desc}, conforme processo SEI nº ${lastEvent.sei !== '-' ? lastEvent.sei : '____'}.\n\nNos termos da Norma Interna GAD-NI-003-01, orientamos a realização de ADVERTÊNCIA FORMAL ao colaborador, reforçando a importância da observância rigorosa ao Código de Trânsito Brasileiro e às diretrizes de segurança da COMPESA.\n\nConsiderando o histórico do condutor ([${historicoText}]), reforça-se a necessidade da medida para fins de correção de conduta e registro na pasta do funcionário, com o devido encaminhamento da advertência pelo SEI à gestão de recursos humanos da empresa (CAP).\n\nAtenciosamente,\nCoordenação de Gestão de Frotas – CGF\n\nDATA: ${date}`;
      } else {
        baseText = `2. ADVERTÊNCIA FORMAL P TERCEIRIZADOS\n\nTítulo:\nNOTIFICAÇÃO DE INFRAÇÃO E ORIENTAÇÃO DE ADVERTÊNCIA FORMAL\n\nTexto:\nPrezado(a) Gestor(a) da Unidade,\n\nInformamos que foi registrado em sistema um evento de natureza [${lastEvent.severity}] para o colaborador TERCEIRIZADO ${driverName}, referente à infração ${lastEvent.desc}, conforme processo SEI nº ${lastEvent.sei !== '-' ? lastEvent.sei : '____'}.\n\nNos termos da Norma Interna GAD-NI-003-01, orientamos a realização de ADVERTÊNCIA FORMAL à empresa tercerizada para que a mesma notifique o colaborador, reforçando a importância da observância rigorosa ao Código de Trânsito Brasileiro e às diretrizes de segurança da COMPESA.\n\nConsiderando o histórico do condutor ([${historicoText}]), reforça-se a necessidade da medida para fins de correção de conduta e posterior descontos das infrações no BM do contrato.\n\nAtenciosamente,\nCoordenação de Gestão de Frotas – CGF\n\nDATA: ${date}`;
      }
    }

    return baseText;
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none italic">Ranking de Performance Geral</h1>
          <p className="text-slate-500 font-medium tracking-tight">Consolidação Telemetria & Infrações (GAD-NI-003-01)</p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 shadow-sm">
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <select
                value={selectedMesInicio}
                onChange={(e) => setSelectedMesInicio(e.target.value)}
                className="pl-7 pr-4 py-1.5 bg-transparent text-[10px] font-black uppercase appearance-none focus:outline-none"
              >
                <option value="all">Início</option>
                {meses.map(m => <option key={`start-${m}`} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="w-2 h-[1px] bg-slate-300"></div>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <select
                value={selectedMesFim}
                onChange={(e) => setSelectedMesFim(e.target.value)}
                className="pl-7 pr-4 py-1.5 bg-transparent text-[10px] font-black uppercase appearance-none focus:outline-none"
              >
                <option value="all">Fim</option>
                {meses.map(m => <option key={`end-${m}`} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <button 
            onClick={() => {
              const data = unifiedRanking.map((r, i) => ({
                "Posição": i + 1,
                "Condutor": r.driver,
                "Score GAD": r.score,
                "Situação": r.situation,
                "Alertas Telemetria": r.teleCount,
                "Infrações CTB": r.infraCount,
                "Total Eventos": r.totalAlerts
              }));
              exportToExcel(data, `Ranking_Performance_Unificado`, "Ranking");
            }}
            className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Informativo da Norma GAD-NI-003-01 */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Scale size={80} />
        </div>
        <div className="flex items-center space-x-3 mb-6">
           <Scale className="text-indigo-600" size={20} />
           <h2 className="text-sm font-black uppercase tracking-widest italic text-slate-800 dark:text-white underline decoration-indigo-500/30">Diretrizes Norma Interna GAD-NI-003-01</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-blue-600 uppercase mb-2 flex items-center">
              <Info size={12} className="mr-1" /> 1. Advertência
            </p>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">Aplicável a infrações de leve a média gravidade e telemetria. **Limite: 03 ocorrências**.</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-orange-600 uppercase mb-2 flex items-center">
              <AlertTriangle size={12} className="mr-1" /> 2. Suspensão Temporária
            </p>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">Aplicada em infrações **GRAVES** ou ao extrapolar tolerâncias de advertência.</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-rose-600 uppercase mb-2 flex items-center">
              <ShieldAlert size={12} className="mr-1" /> 3. Suspensão Definitiva
            </p>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">Infrações **GRAVÍSSIMAS**, riscos críticos ou descumprimento de ética e segurança.</p>
          </div>
        </div>
      </div>

      <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="flex items-center text-sm font-black uppercase tracking-widest text-rose-500 italic">
            <TrendingUp className="mr-2" size={18} /> Perfis de Risco (Consolidado)
          </h3>
          <div className="space-y-4">
            {unifiedRanking.slice(0, 3).map((r, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: idx * 0.1 }}
                key={r.driver} 
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 ${r.bgClass} opacity-40 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${
                    idx === 0 ? 'bg-rose-600 text-white' : 
                    idx === 1 ? 'bg-orange-500 text-white' : 
                    'bg-amber-500 text-white'
                  }`}>
                    {idx + 1}º
                  </div>
                  <div className="text-right z-10">
                    <p className={`text-2xl font-black ${r.situationColor} leading-none`}>{r.score}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Score Total</p>
                  </div>
                </div>
                <div className="space-y-1 relative z-10">
                  <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{r.driver}</p>
                  <div className="flex items-center space-x-2">
                     <span className={`text-[10px] font-black uppercase tracking-widest ${r.situationColor}`}>{r.situation}</span>
                     {r.teleCount > 3 && <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">Excesso Tolerância</span>}
                  </div>
                  <div className="flex items-center space-x-3 mt-3">
                    <span className="flex items-center text-[9px] font-black uppercase text-indigo-500">
                      <AlertCircle size={10} className="mr-1" /> T: {r.teleCount}
                    </span>
                    <span className="flex items-center text-[9px] font-black uppercase text-rose-500">
                      <ShieldAlert size={10} className="mr-1" /> I: {r.infraCount}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="flex items-center text-sm font-black uppercase tracking-widest text-slate-400 italic">
            <User className="mr-2" size={18} /> Painel Analítico Geral
          </h3>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Rank</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Condutor</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <span>Score</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info size={10} className="text-slate-300" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 border-slate-800 text-white p-3 max-w-xs">
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest border-b border-white/10 pb-1">Regras de Pontuação (GAD)</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                                <span className="text-rose-400 font-bold">Gravíssima:</span> <span className="font-mono">40 pts</span>
                                <span className="text-orange-400 font-bold">Grave:</span> <span className="font-mono">20 pts</span>
                                <span className="text-amber-400 font-bold">Média:</span> <span className="font-mono">7 pts</span>
                                <span className="text-blue-400 font-bold">Leve:</span> <span className="font-mono">5 pts</span>
                                <span className="text-indigo-400 font-bold">Telemetria (Base):</span> <span className="font-mono">5 pts</span>
                                <span className="text-indigo-600 font-bold">Telemetria (&gt;3):</span> <span className="font-mono">15 pts</span>
                              </div>
                              <p className="text-[8px] text-slate-400 italic mt-1 leading-tight">O somatório define a situação do condutor conforme limites da norma GAD-NI-003-01.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Situação Norma</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Registros (T|I)</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Último Vínculo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {unifiedRanking.map((r, i) => {
                    const lastO = r.details[r.details.length - 1];
                    const lastDate = lastO?.date || "-";
                    const lastDesc = lastO?.desc || "N/A";
                    const lastType = lastO?.type;

                    return (
                      <tr key={r.driver} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group/row">
                         <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${
                            i < 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight">{r.driver}</p>
                          <div className="flex items-center space-x-1.5 mt-1">
                             {lastType === 'telemetria' ? (
                               <AlertCircle size={10} className="text-indigo-400" />
                             ) : (
                               <ShieldAlert size={10} className="text-rose-400" />
                             )}
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[200px]" title={String(lastDesc)}>
                                {String(lastDesc)}
                             </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-rose-600 text-sm">{r.score}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${r.bgClass} ${r.situationColor} border border-current opacity-80`}>
                             {r.situation}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center justify-center space-x-2">
                             <div className="text-center">
                               <p className="text-[10px] font-black text-indigo-500">{r.teleCount}</p>
                               <p className="text-[8px] font-black text-slate-300 uppercase">T</p>
                             </div>
                             <div className="w-[1px] h-6 bg-slate-100 dark:bg-slate-800"></div>
                             <div className="text-center">
                               <p className="text-[10px] font-black text-rose-500">{r.infraCount}</p>
                               <p className="text-[8px] font-black text-slate-300 uppercase">I</p>
                             </div>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 whitespace-nowrap">{String(lastDate)}</td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => setSelectedDriverDetails(r)}
                            className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mx-auto"
                            title="Ver Detalhes e Gerar Notificação"
                          >
                            <FileText size={16} />
                            <span className="ml-1 text-[8px] font-black uppercase">Ficha</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedDriverDetails} onOpenChange={(open) => !open && setSelectedDriverDetails(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden">
          {selectedDriverDetails && (
            <>
              <DialogHeader className="p-8 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className={`${selectedDriverDetails.bgClass} ${selectedDriverDetails.situationColor} border-current mb-2`}>
                      {selectedDriverDetails.situation}
                    </Badge>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                      {selectedDriverDetails.driver}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">
                      Painel Detalhado de Notificações SEI / GAD-NI-003-01
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <p className={`text-4xl font-black ${selectedDriverDetails.situationColor}`}>{selectedDriverDetails.score}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Unificado</p>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[500px] p-8">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
                      <p className="text-[9px] font-black uppercase text-indigo-600 mb-1">Telemetria</p>
                      <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{selectedDriverDetails.teleCount}</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20">
                      <p className="text-[9px] font-black uppercase text-rose-600 mb-1">Infrações CTB</p>
                      <p className="text-2xl font-black text-rose-700 dark:text-rose-400">{selectedDriverDetails.infraCount}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center">
                      <FileText size={12} className="mr-1" /> Cronologia de Eventos
                    </h4>
                  <div className="space-y-6">
                    {/* Eventos de Telemetria */}
                    {selectedDriverDetails.details.some((d: any) => d.type === 'telemetria') && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center">
                          <AlertCircle size={12} className="mr-1" /> Eventos de Telemetria
                        </h4>
                        <div className="space-y-2">
                          {selectedDriverDetails.details
                            .filter((d: any) => d.type === 'telemetria')
                            .map((detail: any, idx: number) => (
                              <div key={`tele-${idx}`} className="flex gap-4 p-4 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 transition-all hover:bg-indigo-50">
                                <div className="mt-1 h-2 w-2 rounded-full flex-shrink-0 bg-indigo-500" />
                                <div className="flex-1 space-y-1">
                                  <div className="flex justify-between items-start">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                                      {detail.date}
                                    </p>
                                    <Badge variant="secondary" className="text-[8px] h-4 bg-indigo-100 text-indigo-600">+{detail.points} pts</Badge>
                                  </div>
                                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase leading-snug">
                                    {detail.desc}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-slate-200 text-slate-600">
                                      {detail.severity}
                                    </span>
                                    {detail.sei !== '-' && (
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-indigo-600 text-white flex items-center">
                                        SEI: {detail.sei}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {/* Infrações CTB */}
                    {selectedDriverDetails.details.some((d: any) => d.type === 'ctb') && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center">
                          <ShieldAlert size={12} className="mr-1" /> Infrações CTB (Multas)
                        </h4>
                        <div className="space-y-2">
                          {selectedDriverDetails.details
                            .filter((d: any) => d.type === 'ctb')
                            .map((detail: any, idx: number) => (
                              <div key={`infra-${idx}`} className="flex gap-4 p-4 bg-rose-50/30 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 transition-all hover:bg-rose-50">
                                <div className="mt-1 h-2 w-2 rounded-full flex-shrink-0 bg-rose-500" />
                                <div className="flex-1 space-y-1">
                                  <div className="flex justify-between items-start">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">
                                      {detail.date}
                                    </p>
                                    <Badge variant="secondary" className="text-[8px] h-4 bg-rose-100 text-rose-600">+{detail.points} pts</Badge>
                                  </div>
                                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase leading-snug">
                                    {detail.desc}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                      detail.severity === 'GRAVÍSSIMA' ? 'bg-rose-600 text-white' : 
                                      detail.severity === 'GRAVE' ? 'bg-rose-200 text-rose-700' : 
                                      'bg-slate-200 text-slate-600'
                                    }`}>
                                      {detail.severity}
                                    </span>
                                    {detail.sei !== '-' && (
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-rose-600 text-white flex items-center">
                                        SEI: {detail.sei}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                  </div>

                  {/* Minuta de Notificação Formal */}
                  <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center">
                        <FileText size={12} className="mr-2" /> Minuta de Notificação Formal (GAD-NI-003-01)
                      </h4>
                      {selectedDriverDetails.situation === "Advertência" && (
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => setIsTerceirizado(false)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${!isTerceirizado ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                          >
                            Empregado Compesa
                          </button>
                          <button 
                            onClick={() => setIsTerceirizado(true)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${isTerceirizado ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                          >
                            Terceirizado
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Scale size={48} className="text-white" />
                      </div>
                      <pre className="text-[11px] font-medium text-slate-300 whitespace-pre-wrap font-sans leading-relaxed relative z-10">
                        {generateFormalText(selectedDriverDetails, isTerceirizado ? 'terceirizado' : 'compesa')}
                      </pre>
                      <button 
                        onClick={() => {
                          const text = generateFormalText(selectedDriverDetails, isTerceirizado ? 'terceirizado' : 'compesa');
                          navigator.clipboard.writeText(text);
                          alert("Texto copiado para a área de transferência!");
                        }}
                        className="mt-6 flex items-center bg-white/10 hover:bg-white/20 transition-colors text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        <Download size={14} className="mr-2" /> Copiar Texto para o SEI
                      </button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end px-8">
                <button 
                  onClick={() => setSelectedDriverDetails(null)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest"
                >
                  Fechar Painel
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </TooltipProvider>
    </div>
  );
}
