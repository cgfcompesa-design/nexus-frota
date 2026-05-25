import { useState, useMemo } from "react";
import { MaintenanceData, MaintenanceCostData, PreventiveMaintenanceData, FuelData, Asset, ControleOperacionalData } from "../../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "../dashboard/MetricCard";
import { ChartCard } from "../dashboard/ChartCard";
import { MaintenanceFilterBar } from "./MaintenanceFilterBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, AlertCircle, CheckCircle, Download, Copy, FileText, Clock, Building2, ClipboardList, ShieldAlert, Truck, MessageCircle, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VehiclesInWorkshopModal } from "./VehiclesInWorkshopModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportToExcel";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BacklogDashboard } from "./BacklogDashboard";

interface MaintenanceDashboardProps {
  maintenance: MaintenanceData[];
  maintenanceCost: MaintenanceCostData[];
  preventiveMaintenance: PreventiveMaintenanceData[];
  fuel?: FuelData[];
  assets?: Asset[];
  controleOperacional?: any[];
  userRole?: string;
}

export const MaintenanceDashboard = ({ maintenance, maintenanceCost, preventiveMaintenance, fuel = [], assets = [], controleOperacional = [], userRole = 'Visualizador' }: MaintenanceDashboardProps) => {
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("all");
  const [selectedGerencia, setSelectedGerencia] = useState<string>("all");
  const [selectedTipo, setSelectedTipo] = useState<string>("all");
  const [selectedClassificacao, setSelectedClassificacao] = useState<string>("all");
  const [selectedStatusOperacional, setSelectedStatusOperacional] = useState<string>("all");
  const [selectedStatusManutencao, setSelectedStatusManutencao] = useState<string>("all");
  const [searchPlaca, setSearchPlaca] = useState<string>("");
  const [selectedMesAno, setSelectedMesAno] = useState<string>("all");
  const [selectedStatusRevisao, setSelectedStatusRevisao] = useState<string>("all");
  const [selectedStatusControle, setSelectedStatusControle] = useState<string>("all");
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);

  // Criar mapa de classificação por placa
  const classificacaoMap = useMemo(() => {
    const map = new Map<string, string>();
    assets.forEach((asset) => {
      const placa = (asset.PLACA || "").toString().toUpperCase().trim();
      const classificacao = asset["CLASSIFICAÇÃO"] || asset["Classificação"] || asset["CLASSIFICACAO"] || "";
      if (placa && classificacao) {
        map.set(placa, classificacao);
      }
    });
    return map;
  }, [assets]);

  // Extrair valores únicos para filtros
  const directorias = useMemo(() => {
    const values = (maintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[7]?.toString() || "").trim().toUpperCase();
    }).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [maintenance]);

  const gerencias = useMemo(() => {
    const values = (maintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[8]?.toString() || "").trim().toUpperCase();
    }).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [maintenance]);

  const tipos = useMemo(() => {
    const values = (maintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[9]?.toString() || "").trim().toUpperCase();
    }).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [maintenance]);

  const statusOperacionais = useMemo(() => {
    const values = (maintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[1]?.toString() || "").trim().toUpperCase();
    }).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [maintenance]);

  const statusManutencoes = useMemo(() => {
    const values = (maintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[2]?.toString() || "").trim().toUpperCase();
    }).filter(v => v && v !== "N/A");
    return Array.from(new Set(values)).sort();
  }, [maintenance]);

  const statusRevisoes = useMemo(() => {
    const values = (preventiveMaintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[20]?.toString() || "").trim().toUpperCase();
    }).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [preventiveMaintenance]);

  const statusControles = useMemo(() => {
    const values = (maintenance || []).map(m => {
      const vals = m?.__raw || [];
      return (vals[11]?.toString() || "").trim().toUpperCase();
    }).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [maintenance]);

  const classificacoes = useMemo(() => {
    const values = Array.from(classificacaoMap.values()).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [classificacaoMap]);

  const gerenciasByDiretoria = useMemo(() => {
    const map = new Map<string, string[]>();
    (maintenance || []).forEach(m => {
      const vals = m.__raw || [];
      const diretoria = vals[7]?.toString() || "";
      const gerencia = vals[8]?.toString() || "";
      
      if (diretoria && gerencia) {
        if (!map.has(diretoria)) {
          map.set(diretoria, []);
        }
        const gList = map.get(diretoria)!;
        if (!gList.includes(gerencia)) {
          gList.push(gerencia);
        }
      }
    });
    map.forEach((gList) => gList.sort());
    return map;
  }, [maintenance]);

  const mesesAnos = useMemo(() => {
    const values = maintenanceCost.map(item => {
      const mesAno = (item['MÊS/ANO'] || '').toString();
      return mesAno.replace(/\./g, '');
    }).filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      if (!mesA || !anoA || !mesB || !anoB) return 0;
      const mesesMap: Record<string, number> = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      const dateA = new Date(2000 + parseInt(anoA), mesesMap[mesA.toLowerCase()] || 0);
      const dateB = new Date(2000 + parseInt(anoB), mesesMap[mesB.toLowerCase()] || 0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [maintenanceCost]);

  const filteredMaintenance = useMemo(() => {
    return (maintenance || []).filter(item => {
      const vals = item?.__raw || [];
      const placa = vals[0]?.toString().toUpperCase().trim() || "";
      const statusOperacional = (vals[1]?.toString() || "").trim().toUpperCase();
      const statusManutencao = (vals[2]?.toString() || "").trim().toUpperCase();
      const diretoria = (vals[7]?.toString() || "").trim().toUpperCase();
      const gerencia = (vals[8]?.toString() || "").trim().toUpperCase();
      const tipo = (vals[9]?.toString() || "").trim().toUpperCase();
      const statusControle = (vals[11]?.toString() || "").trim().toUpperCase();
      const classificacao = (classificacaoMap.get(placa) || "").trim().toUpperCase();
      
      if (!placa) return false;
      const matchPlaca = searchPlaca === "" || placa.includes(searchPlaca.toUpperCase());
      const matchDiretoria = selectedDiretoria === "all" || diretoria === selectedDiretoria;
      const matchGerencia = selectedGerencia === "all" || gerencia === selectedGerencia;
      const matchTipo = selectedTipo === "all" || tipo === selectedTipo;
      const matchClassificacao = selectedClassificacao === "all" || classificacao === selectedClassificacao;
      const matchStatusOperacional = selectedStatusOperacional === "all" || statusOperacional === selectedStatusOperacional;
      const matchStatusManutencao = selectedStatusManutencao === "all" || statusManutencao === selectedStatusManutencao;
      const matchStatusControle = selectedStatusControle === "all" || statusControle === selectedStatusControle;
      return matchPlaca && matchDiretoria && matchGerencia && matchTipo && matchClassificacao && matchStatusOperacional && matchStatusManutencao && matchStatusControle;
    });
  }, [maintenance, searchPlaca, selectedDiretoria, selectedGerencia, selectedTipo, selectedClassificacao, selectedStatusOperacional, selectedStatusManutencao, selectedStatusControle, classificacaoMap]);

  const vehicleInfoMap = useMemo(() => {
    const map = new Map<string, { diretoria: string; gerencia: string; tipo: string }>();
    (maintenance || []).forEach(item => {
      const vals = item?.__raw || [];
      const placa = vals[0]?.toString().toUpperCase().trim() || "";
      const diretoria = (vals[7]?.toString() || "").trim().toUpperCase();
      const gerencia = (vals[8]?.toString() || "").trim().toUpperCase();
      const tipo = (vals[9]?.toString() || "").trim().toUpperCase();
      if (placa && !map.has(placa)) {
         map.set(placa, { diretoria, gerencia, tipo });
      }
    });
    return map;
  }, [maintenance]);

  const filteredPreventiveMaintenance = useMemo(() => {
    return (preventiveMaintenance || []).filter(item => {
      const vals = item?.__raw || [];
      const placa = vals[0]?.toString().toUpperCase().trim() || "";
      const statusRevisao = (vals[20]?.toString() || "").trim().toUpperCase(); 
      const vehicleInfo = vehicleInfoMap.get(placa);
      const matchPlaca = searchPlaca === "" || placa.includes(searchPlaca.toUpperCase());
      const matchDiretoria = selectedDiretoria === "all" || vehicleInfo?.diretoria === selectedDiretoria;
      const matchGerencia = selectedGerencia === "all" || vehicleInfo?.gerencia === selectedGerencia;
      const matchTipo = selectedTipo === "all" || vehicleInfo?.tipo === selectedTipo;
      const matchStatusRevisao = selectedStatusRevisao === "all" || statusRevisao === selectedStatusRevisao;
      return matchPlaca && matchDiretoria && matchGerencia && matchTipo && matchStatusRevisao;
    });
  }, [preventiveMaintenance, searchPlaca, selectedDiretoria, selectedGerencia, selectedTipo, selectedStatusRevisao, vehicleInfoMap]);

  const metrics = useMemo(() => {
    const total = filteredMaintenance.length;
    const emOperacao = filteredMaintenance.filter((m) => {
      const vals = m.__raw || [];
      const statusOp = vals[1]?.toString().toUpperCase() || "";
      return statusOp.includes("EM OPERAÇÃO") || statusOp === "EM OPERAÇÃO";
    }).length;
    const operacionais = filteredMaintenance.filter((m) => {
      const vals = m.__raw || [];
      const statusOp = vals[1]?.toString().toUpperCase().trim() || "";
      return statusOp === "EM OPERAÇÃO";
    }).length;
    const emManutencao = (filteredMaintenance || []).filter((m) => {
      const vals = m.__raw || [];
      const statusMan = vals[2]?.toString().trim() || "";
      return statusMan !== "" && statusMan !== "N/A";
    }).length;
    
    // Backlog count from controleOperacional
    const uniqueOrders = new Set();
    (controleOperacional || []).forEach(item => {
      if (item?.numOrdem) uniqueOrders.add(item.numOrdem);
    });
    
    const accessibility = total > 0 ? (emOperacao / total) * 100 : 0;
    const emManutencaoNum = (filteredMaintenance || []).filter((m) => {
      const v = m.__raw || [];
      const statusM = v[2]?.toString().trim() || "";
      return statusM !== "" && statusM !== "N/A";
    }).length;

    return { 
      total: total || 0, 
      emOperacao: emOperacao || 0, 
      operacionais: operacionais || 0, 
      emManutencao: emManutencaoNum || 0, 
      disponibilidade: (accessibility || 0).toFixed(1),
      backlogTotal: (uniqueOrders.size) || 0
    };
  }, [filteredMaintenance, controleOperacional]);

  const statusOperacionalResumo = useMemo(() => {
    let operacionais = 0;
    let naoOperacionais = 0;
    filteredMaintenance.forEach((item) => {
      const vals = item.__raw || [];
      const statusOp = vals[1]?.toString().toUpperCase() || "";
      if (statusOp.includes("EM OPERAÇÃO")) { operacionais += 1; } else { naoOperacionais += 1; }
    });
    return { operacionais, naoOperacionais };
  }, [filteredMaintenance]);

  const statusManutencaoData = useMemo(() => {
    const statusMap = new Map<string, number>();
    filteredMaintenance.forEach((item) => {
      const vals = item.__raw || [];
      const statusManutencao = vals[2]?.toString().trim() || "N/A";
      if (statusManutencao && statusManutencao !== "") {
        statusMap.set(statusManutencao, (statusMap.get(statusManutencao) || 0) + 1);
      }
    });
    return Array.from(statusMap.entries()).map(([status, count]) => ({ name: status, value: count })).sort((a, b) => b.value - a.value);
  }, [filteredMaintenance]);

  const statusRevisaoData = useMemo(() => {
    const statusMap = new Map<string, number>();
    filteredPreventiveMaintenance.forEach((item) => {
      const vals = item.__raw || [];
      const statusRevisao = vals[20]?.toString().trim() || "N/A";
      if (statusRevisao) { statusMap.set(statusRevisao, (statusMap.get(statusRevisao) || 0) + 1); }
    });
    const total = filteredPreventiveMaintenance.length;
    return Array.from(statusMap.entries()).map(([status, count]) => ({ name: status, value: count, percentage: total > 0 ? ((count / total) * 100).toFixed(1) : "0" })).sort((a, b) => b.value - a.value);
  }, [filteredPreventiveMaintenance]);

  const preventivaMetrics = useMemo(() => {
    const total = filteredPreventiveMaintenance.length;
    const emDia = filteredPreventiveMaintenance.filter(item => {
      const vals = item.__raw || [];
      const statusRevisao = vals[20]?.toString().trim().toUpperCase() || "";
      return statusRevisao === "EM DIA";
    }).length;
    const percentual = total > 0 ? (emDia / total) * 100 : 0;
    return { total, emDia, percentual: percentual.toFixed(1) };
  }, [filteredPreventiveMaintenance]);

  const preventivaResumo = useMemo(() => {
    let vencidas = 0;
    let aVencer = 0;
    let emDia = 0;
    filteredPreventiveMaintenance.forEach((item) => {
      const vals = item.__raw || [];
      const status = (vals[20]?.toString() || "").toUpperCase();
      if (status.includes("ATRASO") || status.includes("VENCIDA")) { vencidas += 1; } 
      else if (status.includes("A VENCER") || status.includes("PRÓXIMA")) { aVencer += 1; } 
      else if (status.includes("EM DIA") || status.includes("NO PRAZO")) { emDia += 1; }
    });
    return { vencidas, aVencer, emDia };
  }, [filteredPreventiveMaintenance]);

  const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#1e3a8a', '#2563eb'];

  const handleClearFilters = () => {
    setSelectedDiretoria("all");
    setSelectedGerencia("all");
    setSelectedTipo("all");
    setSelectedClassificacao("all");
    setSelectedStatusOperacional("all");
    setSelectedStatusManutencao("all");
    setSelectedStatusRevisao("all");
    setSearchPlaca("");
    setSelectedMesAno("all");
  };

  const handleDiretoriaChange = (value: string) => {
    setSelectedDiretoria(value);
    if (value !== "all") {
      const validGerencias = gerenciasByDiretoria.get(value) || [];
      if (selectedGerencia !== "all" && !validGerencias.includes(selectedGerencia)) {
        setSelectedGerencia("all");
      }
    }
  };

  const handleShareWhatsApp = () => {
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR');
    const gerenciaInfo = selectedGerencia !== "all" ? selectedGerencia : (selectedDiretoria !== "all" ? selectedDiretoria : "Geral");
    
    let message = `☑ *Relatório CGF - Status Operacional*\n`;
    message += `📅 Atualizado em: *${formattedDate}*\n`;
    message += `🏢 Unidade: *${gerenciaInfo}*\n\n`;

    const operacionaisList: string[] = [];
    const naoOperacionaisList: string[] = [];
    const parcialList: string[] = [];

    filteredMaintenance.forEach(item => {
      const v = item.__raw || [];
      const placa = String(v[0] || "");
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(placa)) return;

      const tipo = String(v[9] || "");
      const statusOp = String(v[1] || "");
      const statusMan = String(v[2] || "");
      const local = String(v[3] || "");
      const prazo = String(v[4] || "");
      const descricao = String(v[5] || "");

      message += `*Placa:* ${placa}\n`;
      message += `*Tipo:* ${tipo}\n`;
      message += `*Status Operacional:* ${statusOp}\n`;
      message += `*Status Manutenção:* ${statusMan}\n`;
      message += `*Local:* ${local}\n`;
      message += `*Prazo:* ${prazo}\n`;
      message += `*Descrição:* ${descricao}\n\n`;

      if (statusOp.toUpperCase().includes("EM OPERAÇÃO")) {
        operacionaisList.push(placa);
      } else if (statusOp.toUpperCase().includes("PARCIAL")) {
        parcialList.push(placa);
      } else {
        naoOperacionaisList.push(placa);
      }
    });

    const total = operacionaisList.length + naoOperacionaisList.length + parcialList.length;
    const perc = total > 0 ? ((operacionaisList.length / total) * 100).toFixed(1) : "0";

    message += `📊 *Resumo Geral*\n`;
    message += `Total: ${total} | 🟢 Operacionais: ${operacionaisList.length} (${perc}%) | 🔴 Não Operacionais: ${naoOperacionaisList.length}\n\n`;
    
    if (operacionaisList.length > 0) message += `🟢 *Operacionais:* ${operacionaisList.join(", ")}\n`;
    if (naoOperacionaisList.length > 0) message += `🔴 *Não Operacionais:* ${naoOperacionaisList.join(", ")}\n`;
    if (parcialList.length > 0) message += `🔵 *Parcial – Jato:* ${parcialList.join(", ")}\n`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleGenerateReportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR');
    const gerenciaInfo = selectedGerencia !== "all" ? selectedGerencia : (selectedDiretoria !== "all" ? selectedDiretoria : "Geral");

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text("Relatório CGF - Status Operacional", 14, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Atualizado em: ${formattedDate}`, 14, 28);
    doc.text(`Unidade: ${gerenciaInfo}`, 14, 33);

    const tableData = filteredMaintenance.map(item => {
      const v = item.__raw || [];
      return [
        String(v[0] || ""),
        String(v[9] || ""),
        String(v[1] || ""),
        String(v[2] || ""),
        String(v[3] || ""),
        String(v[4] || ""),
        String(v[5] || "")
      ];
    }).filter(row => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(row[0]));

    autoTable(doc, {
      startY: 40,
      head: [["Placa", "Tipo", "Status Op.", "Status Man.", "Local", "Prazo", "Descrição"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        6: { cellWidth: 50 } // Descrição column width
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text("Resumo Geral", 14, finalY);
    
    const operacionais = filteredMaintenance.filter(m => (m.__raw?.[1] || "").toUpperCase().includes("EM OPERAÇÃO")).length;
    const naoOperacionais = filteredMaintenance.length - operacionais;
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total: ${tableData.length} | Operacionais: ${operacionais} | Não Operacionais: ${naoOperacionais}`, 14, finalY + 7);
    
    doc.save(`Relatorio_CGF_Status_${formattedDate.replace(/[/:\s]/g, '_')}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <MaintenanceFilterBar
        directorias={directorias}
        gerencias={gerencias}
        gerenciasByDiretoria={gerenciasByDiretoria}
        tipos={tipos}
        classificacoes={classificacoes}
        statusOperacionais={statusOperacionais}
        statusManutencoes={statusManutencoes}
        statusRevisoes={statusRevisoes}
        statusControles={statusControles}
        mesesAnos={mesesAnos}
        selectedDiretoria={selectedDiretoria}
        selectedGerencia={selectedGerencia}
        selectedTipo={selectedTipo}
        selectedClassificacao={selectedClassificacao}
        selectedStatusOperacional={selectedStatusOperacional}
        selectedStatusManutencao={selectedStatusManutencao}
        selectedStatusRevisao={selectedStatusRevisao}
        selectedStatusControle={selectedStatusControle}
        selectedMesAno={selectedMesAno}
        searchPlaca={searchPlaca}
        onDiretoriaChange={handleDiretoriaChange}
        onGerenciaChange={setSelectedGerencia}
        onTipoChange={setSelectedTipo}
        onClassificacaoChange={setSelectedClassificacao}
        onStatusOperacionalChange={setSelectedStatusOperacional}
        onStatusManutencaoChange={setSelectedStatusManutencao}
        onStatusRevisaoChange={setSelectedStatusRevisao}
        onStatusControleChange={setSelectedStatusControle}
        onMesAnoChange={setSelectedMesAno}
        onSearchPlacaChange={setSearchPlaca}
        onClearFilters={handleClearFilters}
      />

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex gap-2">
          <Button 
            onClick={handleShareWhatsApp}
            variant="outline" 
            className="gap-2 font-black uppercase text-[10px] h-9 border-emerald-200 hover:bg-emerald-50 text-emerald-700 dark:border-emerald-800/30 dark:hover:bg-emerald-900/10"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button 
            onClick={handleGenerateReportPDF}
            variant="outline" 
            className="gap-2 font-black uppercase text-[10px] h-9 border-indigo-200 hover:bg-indigo-50 text-indigo-700 dark:border-indigo-800/30 dark:hover:bg-indigo-900/10"
          >
            <FileText className="h-4 w-4" /> PDF Status
          </Button>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              const data = filteredMaintenance.map(item => {
                const v = Object.values(item);
                return { "Placa": v[0], "Status Operacional": v[1], "Status Manutenção": v[2], "Diretoria": v[7], "Gerência": v[8], "Tipo": v[9] };
              });
              exportToExcel(data, "Manutencao", "Manutenção");
              toast.success("Dados exportados!");
            }} 
            variant="outline" className="gap-2 font-black uppercase text-[10px] h-9"
          >
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      <VehiclesInWorkshopModal open={showWorkshopModal} onOpenChange={setShowWorkshopModal} />

      <Tabs defaultValue="disponibilidade" className="space-y-6">
        <TabsList className="bg-slate-50 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="disponibilidade" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 shadow-sm">Disponibilidade Operacional</TabsTrigger>
          <TabsTrigger value="preventiva" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 shadow-sm">Cumprimento de Plano Preventivo</TabsTrigger>
          {(userRole === 'Master' || userRole === 'Gestão') && (
            <TabsTrigger value="backlog" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 shadow-sm">Gestão Backlog</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="disponibilidade" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <MetricCard 
              title="Disponibilidade Frota" 
              value={`${metrics.disponibilidade}%`} 
              description={`${metrics.emOperacao} de ${metrics.total} ativos ativos`}
              icon={<ShieldAlert className="text-indigo-600" size={24} />}
              colorScheme={parseFloat(metrics.disponibilidade) >= 80 ? "success" : "danger"}
              centered
            />
            <MetricCard 
              title="Frota Auditada" 
              value={metrics.total} 
              description="Monitoramento constante"
              icon={<Truck className="text-slate-400" size={24} />} 
              centered 
            />
            <MetricCard 
              title="Operacionais" 
              value={metrics.operacionais} 
              description="Ativos em trânsito"
              icon={<CheckCircle className="text-emerald-500" size={24} />} 
              centered 
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <ChartCard 
              title="Distribuição de Manutenção" 
              description="Volume de ativos por categoria de status"
            >
              <div className="h-[350px] w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={statusManutencaoData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius="60%"
                      outerRadius="85%"
                      paddingAngle={5}
                      dataKey="value"
                      animationDuration={1500}
                    >
                      {statusManutencaoData.length > 0 ? statusManutencaoData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                      )) : <Cell fill="#e2e8f0" />}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: 'none', 
                        borderRadius: '12px',
                        padding: '12px',
                        zIndex: 1000
                      }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}
                    />
                     <Legend 
                      iconSize={10} 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right"
                      wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <Card>
              <CardHeader><CardTitle>Resumo por Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success/5 p-3">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-xs font-semibold text-success uppercase">Em operação</p>
                    <p className="text-xl font-bold">{statusOperacionalResumo.operacionais}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <Wrench className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-xs font-semibold text-destructive uppercase">Não operacionais</p>
                    <p className="text-xl font-bold">{statusOperacionalResumo.naoOperacionais}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Frota Própria - Status Detalhado</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Placa</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-center">Status Operacional</TableHead>
                      <TableHead className="text-center">Local</TableHead>
                      <TableHead className="text-center">Prazo</TableHead>
                      <TableHead className="text-center">Status Controle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaintenance.map((item, idx) => {
                      const v = item.__raw || [];
                      const placa = String(v[0] || "");
                      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(placa)) return null;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-center">{placa}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[9] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[1] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[3] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[4] || "")}</TableCell>
                          <TableCell className="text-xs font-bold text-indigo-600 text-center">{String(v[11] || "")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preventiva" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard 
              title="Cumprimento da Preventiva" 
              value={`${preventivaMetrics.percentual}%`} 
              description={`${preventivaMetrics.emDia} de ${preventivaMetrics.total} em dia (Meta: 90%)`}
              icon={<CheckCircle className="h-4 w-4" />}
              colorScheme={parseFloat(preventivaMetrics.percentual) >= 90 ? "success" : "danger"}
              centered
            />
            <div className="grid grid-cols-3 gap-2">
               <div className="bg-destructive/5 border border-destructive/20 p-3 rounded-xl text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase font-bold text-destructive">Vencidas</p>
                  <p className="text-lg font-black">{preventivaResumo.vencidas}</p>
               </div>
               <div className="bg-warning/5 border border-warning/20 p-3 rounded-xl text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase font-bold text-warning-foreground">A Vencer</p>
                  <p className="text-lg font-black">{preventivaResumo.aVencer}</p>
               </div>
               <div className="bg-success/5 border border-success/20 p-3 rounded-xl text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase font-bold text-success">Em Dia</p>
                  <p className="text-lg font-black">{preventivaResumo.emDia}</p>
               </div>
            </div>
          </div>

          <ChartCard title="Status Revisão Preventiva" description="Distribuição por status">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusRevisaoData} cx="50%" cy="50%" labelLine={false} label={({ name, percentage }: any) => `${name}: ${percentage}%`} outerRadius={80} dataKey="value">
                  {statusRevisaoData.map((_entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <Card>
            <CardHeader><CardTitle>Controle Detalhado - Preventiva</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Placa</TableHead>
                      <TableHead className="text-center">Odômetro</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-center">Tipo Preventiva</TableHead>
                      <TableHead className="text-center">Próxima Revisão</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPreventiveMaintenance.map((item, idx) => {
                      const v = item.__raw || [];
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-center">{String(v[0] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[1] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[8] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[2] || "")}</TableCell>
                          <TableCell className="text-xs text-center">{String(v[14] || "")}</TableCell>
                          <TableCell className="text-xs font-bold text-center">{String(v[20] || "")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {(userRole === 'Master' || userRole === 'Gestão') && (
          <TabsContent value="backlog" className="space-y-6 animate-in fade-in-50 duration-200">
            <BacklogDashboard data={controleOperacional} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
