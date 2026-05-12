import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Mail,
  Search,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  Truck,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend as RechartsLegend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { toast } from "sonner";
import { useCNHData, calculateCNHStats, calculateStatsByGestor, CNHRecord } from "@/hooks/useCNHData";
import { useContactsData } from "@/hooks/useContactsData";
import { exportToExcel } from "@/lib/exportToExcel";
import { LoadingState } from "@/components/dashboard/LoadingState";

type StatusFilter = "all" | "vencida" | "30dias" | "60dias" | "90dias" | "regular";

export function DriversRelation() {
  const { data: cnhResult, isLoading } = useCNHData();
  const cnhRecords = (cnhResult as any)?.records || [];
  const { getEmailsByGerencia } = useContactsData();
  
  const [selectedGerencia, setSelectedGerencia] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailStatus, setDetailStatus] = useState<StatusFilter>("all");
  const [gestorSearchTerm, setGestorSearchTerm] = useState("");
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showOnlyVencidasInGestor, setShowOnlyVencidasInGestor] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTargetGerencia, setEmailTargetGerencia] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState("");

  const COLORS_CHART = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

  // Get unique gerencias
  const gerencias = useMemo(() => {
    const uniqueGerencias = [...new Set(cnhRecords.map((r: CNHRecord) => r.gerencia).filter(Boolean))];
    return uniqueGerencias.sort();
  }, [cnhRecords]);

  // Calculate overall stats
  const stats = useMemo(() => calculateCNHStats(cnhRecords), [cnhRecords]);

  // Calculate stats by gestor
  const gestorStats = useMemo(() => {
    return calculateStatsByGestor(cnhRecords);
  }, [cnhRecords]);

  // Filter gestorStats by search term
  const filteredGestorStats = useMemo(() => {
    let filtered = gestorStats;
    if (gestorSearchTerm) {
      const term = gestorSearchTerm.toLowerCase();
      filtered = filtered.filter(stat => 
        stat.gestor.toLowerCase().includes(term)
      );
    }
    if (showOnlyVencidasInGestor) {
      filtered = filtered.filter(stat => stat.vencidas > 0);
    }
    return filtered;
  }, [gestorStats, gestorSearchTerm, showOnlyVencidasInGestor]);

  // Data for Compesa vs Terceirizados chart
  const compesaVsTerceirizadosData = useMemo(() => {
    const compesa = cnhRecords.filter((r: CNHRecord) => r.matricula && r.matricula !== "N/A" && r.matricula.trim() !== "").length;
    const terceirizados = cnhRecords.length - compesa;
    const total = compesa + terceirizados;
    return {
      total,
      data: [
        { name: "Compesa", value: compesa },
        { name: "Terceirizados", value: terceirizados }
      ]
    };
  }, [cnhRecords]);

  // Data for Drivers by Gerência chart
  const driversByGerenciaData = useMemo(() => {
    return [...gestorStats]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // Top 8 gerencias for readability
  }, [gestorStats]);

  // Filter data
  const filteredData = useMemo(() => {
    return cnhRecords.filter((record: CNHRecord) => {
      const matchGerencia = selectedGerencia === "all" || record.gerencia === selectedGerencia;
      const matchStatus = selectedStatus === "all" || record.status === selectedStatus;
      
      let matchSearch = true;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        matchSearch = record.nome.toLowerCase().includes(term) ||
                     record.gerencia.toLowerCase().includes(term) ||
                     record.matricula.toLowerCase().includes(term) ||
                     record.codMotorista.toLowerCase().includes(term);
      }
      
      return matchGerencia && matchStatus && matchSearch;
    });
  }, [cnhRecords, selectedGerencia, selectedStatus, searchTerm]);

  // Get records for detail modal
  const detailRecords = useMemo(() => {
    if (detailStatus === "all") return cnhRecords;
    return cnhRecords.filter((r: CNHRecord) => r.status === detailStatus);
  }, [cnhRecords, detailStatus]);

  // Selection helpers
  const allVisibleSelected = useMemo(() => {
    if (filteredData.length === 0) return false;
    return filteredData.every((record: CNHRecord) => selectedRecords.has(record.codMotorista));
  }, [filteredData, selectedRecords]);

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      const newSet = new Set(selectedRecords);
      filteredData.forEach((record: CNHRecord) => newSet.delete(record.codMotorista));
      setSelectedRecords(newSet);
    } else {
      const newSet = new Set(selectedRecords);
      filteredData.forEach((record: CNHRecord) => newSet.add(record.codMotorista));
      setSelectedRecords(newSet);
    }
  };

  const handleSelectRecord = (codMotorista: string) => {
    const newSet = new Set(selectedRecords);
    if (newSet.has(codMotorista)) {
      newSet.delete(codMotorista);
    } else {
      newSet.add(codMotorista);
    }
    setSelectedRecords(newSet);
  };

  const handleOpenDetail = (status: StatusFilter) => {
    setDetailStatus(status);
    setDetailModalOpen(true);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((r: CNHRecord) => ({
      "Código": r.codMotorista,
      "Nome": r.nome,
      "Gerência": r.gerencia,
      "Vencimento": r.validadeStr,
      "Categoria": r.categoria,
      "Matrícula": r.matricula,
      "Status": getStatusLabel(r.status)
    }));
    
    exportToExcel(exportData, "relacao-condutores", "Condutores");
    toast.success("Excel exportado com sucesso!");
  };

  const getStatusLabel = (status: CNHRecord["status"]): string => {
    switch (status) {
      case "vencida": return "Vencida";
      case "30dias": return "Vence em 30 dias";
      case "60dias": return "Vence em 60 dias";
      case "90dias": return "Vence em 90 dias";
      case "regular": return "Regular";
    }
  };

  const handleSendEmail = () => {
    if (!emailTargetGerencia || !selectedRecipient) return;
    
    const stat = gestorStats.find(s => s.gestor === emailTargetGerencia);
    if (!stat) return;

    const gestorRecords = cnhRecords.filter((r: CNHRecord) => r.gerencia === emailTargetGerencia && r.status !== "regular");
    const totalVencidas = gestorRecords.filter(r => r.status === 'vencida').length;
    const subject = `Alerta de CNH - ${emailTargetGerencia} - ${gestorRecords.length} Pendentes (${totalVencidas} Vencidas)`;
    
    const recordsList = gestorRecords.map((r: CNHRecord, i: number) => {
      let diasStr = "";
      if (r.diasParaVencer !== null) {
        if (r.diasParaVencer < 0) {
          diasStr = `${Math.abs(r.diasParaVencer)} dias atrás`;
        } else {
          diasStr = `${r.diasParaVencer} dias`;
        }
      }

      return `${i + 1}. ${r.nome.toUpperCase()}\nCNH: ${r.codMotorista}\nValidade: ${r.validadeStr}\nStatus: ${getStatusLabel(r.status).toUpperCase()}\nDias: ${diasStr}\n`;
    }).join("\n");

    const body = `Prezado(a) Gestor(a),\n\nSolicitamos que envie a imagem das CNHs atualizadas.\n\nCaso não sejam enviados no prazo de dois dias úteis a permissão de condução do motorista será suspensa.\n\nDetalhamento:\n\n${recordsList}\n\nAtt,\nNexus BI Frota`;
    
    window.location.href = `mailto:${selectedRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=gadmonitoramento@compesa.com.br`;
    setEmailModalOpen(false);
  };

  const getStatusBadge = (status: CNHRecord["status"]) => {
    switch (status) {
      case "vencida":
        return <Badge className="bg-rose-700 font-black text-[10px] uppercase text-white border border-rose-400 shadow-sm">Vencida</Badge>;
      case "30dias":
        return <Badge className="bg-orange-500 hover:bg-orange-600 font-black text-[10px] uppercase text-white">30 dias</Badge>;
      case "60dias":
        return <Badge className="bg-amber-500 hover:bg-amber-600 font-black text-[10px] uppercase text-white">60 dias</Badge>;
      case "90dias":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black font-black text-[10px] uppercase">90 dias</Badge>;
      case "regular":
        return <Badge className="bg-green-500 hover:bg-green-600 font-black text-[10px] uppercase text-white">Regular</Badge>;
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all border-none bg-rose-50 dark:bg-rose-950/20 shadow-sm"
            onClick={() => handleOpenDetail("vencida")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center">
              <AlertTriangle className="h-6 w-6 text-rose-600 mb-2" />
              <p className="text-3xl font-black text-rose-700 leading-none">{stats.vencidas}</p>
              <p className="text-[10px] font-black uppercase text-rose-600 mt-2">Vencidas</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-all border-none bg-orange-50 dark:bg-orange-950/20 shadow-sm"
            onClick={() => handleOpenDetail("30dias")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Clock className="h-6 w-6 text-orange-600 mb-2" />
              <p className="text-3xl font-black text-orange-700 leading-none">{stats.em30dias}</p>
              <p className="text-[10px] font-black uppercase text-orange-600 mt-2">Próx. 30 dias</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-all border-none bg-amber-50 dark:bg-amber-950/20 shadow-sm"
            onClick={() => handleOpenDetail("60dias")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center">
              <AlertCircle className="h-6 w-6 text-amber-600 mb-2" />
              <p className="text-3xl font-black text-amber-700 leading-none">{stats.em60dias}</p>
              <p className="text-[10px] font-black uppercase text-amber-600 mt-2">Próx. 60 dias</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-all border-none bg-yellow-50 dark:bg-yellow-950/10 shadow-sm"
            onClick={() => handleOpenDetail("90dias")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Eye className="h-6 w-6 text-yellow-600 mb-2" />
              <p className="text-3xl font-black text-yellow-700 leading-none">{stats.em90dias}</p>
              <p className="text-[10px] font-black uppercase text-yellow-600 mt-2">Próx. 90 dias</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-all border-none bg-emerald-50 dark:bg-emerald-950/20 shadow-sm"
            onClick={() => handleOpenDetail("regular")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center">
              <CheckCircle className="h-6 w-6 text-emerald-600 mb-2" />
              <p className="text-3xl font-black text-emerald-700 leading-none">{stats.regulares}</p>
              <p className="text-[10px] font-black uppercase text-emerald-600 mt-2">Regulares</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vínculo Contratual</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 h-[100px] flex items-center gap-4">
             <div style={{ height: '100px', width: '50%', position: 'relative' }} className="flex items-center justify-center overflow-visible">
                <div className="w-full h-full">
                  {compesaVsTerceirizadosData.data.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%" debounce={1}>
                      <PieChart>
                        <Pie
                          data={compesaVsTerceirizadosData.data}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={40}
                          paddingAngle={5}
                          dataKey="value"
                          isAnimationActive={false}
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#10b981" />
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', color: '#000', fontSize: '10px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                       <span className="text-[8px] font-bold text-slate-500 uppercase">Sem Dados</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[8px] font-black uppercase text-slate-500 leading-none">Total</span>
                  <span className="text-sm font-black text-white">{compesaVsTerceirizadosData.total}</span>
                </div>
             </div>
             <div className="w-1/2 space-y-1">
                {compesaVsTerceirizadosData.data.map((d, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-slate-500 leading-none">{d.name}</span>
                    <span className="text-sm font-black leading-none">{d.value}</span>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quantidade por Gerência */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
              <Truck size={16} className="text-indigo-600" /> Condutores por Gerência
            </CardTitle>
            <CardDescription className="text-[10px] font-black uppercase text-slate-400">Distribuição quantitativa das dez maiores unidades</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div style={{ height: '300px', width: '100%' }} className="flex items-center justify-center overflow-visible">
              {driversByGerenciaData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <BarChart data={driversByGerenciaData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="gestor" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'black' }}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={25} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">Sem dados quantitativos</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notificações por Gerência */}
        <Card className="border-none shadow-sm flex flex-col">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Mail size={16} /> Resumo por Gerência
                </div>
                <div className="flex items-center gap-2">
                   <Label className="text-[9px] font-black uppercase cursor-pointer" htmlFor="show-vencidas">Somente Vencidas</Label>
                   <Checkbox id="show-vencidas" checked={showOnlyVencidasInGestor} onCheckedChange={(v) => setShowOnlyVencidasInGestor(!!v)} />
                </div>
             </CardTitle>
             <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="FILTRAR GESTOR..."
                  value={gestorSearchTerm}
                  onChange={(e) => setGestorSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-[10px] font-bold uppercase bg-slate-50 border-none"
                />
             </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
             <ScrollArea className="h-full max-h-[300px]">
                <div className="min-w-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest px-4">Gerência</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Alertas</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGestorStats.map((stat, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="px-4 py-3">
                             <p className="text-[10px] font-black uppercase leading-tight whitespace-normal break-words max-w-[150px]">{stat.gestor}</p>
                             <p className="text-[9px] font-bold text-slate-400">{stat.total} CONDUTORES</p>
                          </TableCell>
                          <TableCell className="py-3">
                             <div className="flex justify-center gap-1">
                                {stat.vencidas > 0 && <Badge className="h-5 px-1.5 font-black text-[9px] bg-rose-700 text-white border border-rose-400 shadow-sm">{stat.vencidas}</Badge>}
                                {stat.em30dias > 0 && <Badge className="h-5 px-1.5 font-black text-[9px] bg-orange-500 text-white">{stat.em30dias}</Badge>}
                                {stat.em60dias > 0 && <Badge className="h-5 px-1.5 font-black text-[9px] bg-amber-500 text-white">{stat.em60dias}</Badge>}
                             </div>
                          </TableCell>
                        <TableCell className="text-center py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 font-black uppercase text-[8px] gap-1.5 border-slate-200"
                            onClick={() => {
                              const emails = getEmailsByGerencia(stat.gestor);
                              setEmailTargetGerencia(stat.gestor);
                              // Priorizar o primeiro email se houver
                              setSelectedRecipient(emails[0] || "");
                              setEmailModalOpen(true);
                            }}
                          >
                            <Mail size={12} /> Notificar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
             </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento Completo */}
      <Card className="border-none shadow-sm min-h-[600px]">
           <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                 <CardTitle className="text-sm font-black uppercase tracking-tighter">Detalhamento de Condutores</CardTitle>
                 <CardDescription className="text-[10px] font-black uppercase text-slate-400">Lista completa e filtros de controle</CardDescription>
              </div>
              <Button onClick={handleExportExcel} variant="ghost" className="h-8 px-2 font-black uppercase text-[10px] gap-2">
                 <FileSpreadsheet size={16} className="text-emerald-600" /> Exportar
              </Button>
           </CardHeader>
           <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="NOME, MATRÍCULA OU CNH..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-[10px] font-bold uppercase bg-slate-50 border-none"
                    />
                 </div>
                 <div className="flex gap-2">
                    <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                      <SelectTrigger className="h-9 text-[10px] font-bold uppercase bg-slate-50 border-none">
                        <SelectValue placeholder="GERÊNCIA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-bold uppercase">TODAS GERÊNCIAS</SelectItem>
                        {gerencias.map(g => <SelectItem key={g} value={g} className="text-[10px] font-bold uppercase">{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as StatusFilter)}>
                      <SelectTrigger className="h-9 text-[10px] font-bold uppercase bg-slate-50 border-none">
                        <SelectValue placeholder="STATUS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-bold uppercase">TODOS STATUS</SelectItem>
                        <SelectItem value="vencida" className="text-[10px] font-bold uppercase">VENCIDA</SelectItem>
                        <SelectItem value="30dias" className="text-[10px] font-bold uppercase">30 DIAS</SelectItem>
                        <SelectItem value="60dias" className="text-[10px] font-bold uppercase">60 DIAS</SelectItem>
                        <SelectItem value="regular" className="text-[10px] font-bold uppercase">REGULAR</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              <ScrollArea className="h-[480px]">
                <Table>
                   <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[30px] px-2"><Checkbox checked={allVisibleSelected} onCheckedChange={handleSelectAll} /></TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Nome</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Gerência</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Vencimento</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Ação</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {filteredData.map((record: CNHRecord, idx: number) => (
                        <TableRow key={idx} className={selectedRecords.has(record.codMotorista) ? "bg-indigo-50/50" : ""}>
                           <TableCell className="px-2">
                              <Checkbox 
                                checked={selectedRecords.has(record.codMotorista)} 
                                onCheckedChange={() => handleSelectRecord(record.codMotorista)} 
                              />
                           </TableCell>
                           <TableCell className="py-2">
                              <p className="text-[11px] font-black uppercase leading-tight">{record.nome}</p>
                              <p className="text-[9px] font-bold text-slate-400">MAT: {record.matricula}</p>
                           </TableCell>
                           <TableCell className="text-[9px] font-black uppercase text-slate-500 py-2">
                              {record.gerencia}
                           </TableCell>
                           <TableCell className="text-center text-[10px] font-black py-2">
                              {record.validadeStr}
                           </TableCell>
                           <TableCell className="text-center py-2">
                              {getStatusBadge(record.status)}
                           </TableCell>
                           <TableCell className="text-center py-2">
                              {record.status !== "regular" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const emails = getEmailsByGerencia(record.gerencia);
                                    const subject = `Alerta de CNH - ${record.nome}`;
                                    const body = `Prezado(a) Gestor(a),\n\nIdentificamos que a CNH do condutor ${record.nome} está ${getStatusLabel(record.status).toUpperCase()}.\n\nValidade: ${record.validadeStr}\n\nFavor providenciar a regularização.\n\nAtt,\nNexus BI Frota`;
                                    window.location.href = `mailto:${emails.join(";")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=gadabastecimento@compesa.com.br;gadmonitoramento@compesa.com.br`;
                                  }}
                                >
                                  <Mail size={14} className="text-slate-400 group-hover:text-indigo-600" />
                                </Button>
                              )}
                           </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
              </ScrollArea>
           </CardContent>
        </Card>

      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
               {detailStatus === "vencida" && <AlertTriangle size={24} className="text-rose-500" />}
               {detailStatus === "all" ? "Todos os Condutores" : getStatusLabel(detailStatus)}
               <span className="text-slate-400 ml-auto text-sm font-bold tracking-normal">{detailRecords.length} REGISTROS</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-0">
             <ScrollArea className="h-[550px]">
                <Table>
                   <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Condutor</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Gerência</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Validade</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Dias</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {detailRecords.map((r: CNHRecord, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="px-6 py-3">
                             <p className="text-[11px] font-black uppercase">{r.nome}</p>
                             <p className="text-[9px] font-bold text-slate-400">MAT: {r.matricula}</p>
                          </TableCell>
                          <TableCell className="text-[10px] font-bold uppercase text-slate-600">{r.gerencia}</TableCell>
                          <TableCell className="text-center font-black text-[10px]">{r.validadeStr}</TableCell>
                          <TableCell className="text-center">
                             <span className={`text-[10px] font-black ${r.diasParaVencer !== null && r.diasParaVencer < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {r.diasParaVencer ?? "-"}
                             </span>
                          </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-md bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
               <Mail className="text-indigo-400" /> Disparar Alerta de CNH
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Gerência Destinatária</Label>
                <div className="p-3 bg-slate-50 rounded-xl font-black text-xs uppercase text-slate-700 border border-slate-100">
                   {emailTargetGerencia}
                </div>
             </div>
             
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Selecionar Destinatário</Label>
                <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                   <SelectTrigger className="w-full h-11 px-4 border-2 border-slate-100 rounded-xl font-bold uppercase text-[10px]">
                      <SelectValue placeholder="Selecione o email do gestor" />
                   </SelectTrigger>
                   <SelectContent>
                      {emailTargetGerencia && getEmailsByGerencia(emailTargetGerencia).map((email: string) => (
                         <SelectItem key={email} value={email} className="font-bold text-[10px] uppercase">
                            {email}
                         </SelectItem>
                      ))}
                      {(!emailTargetGerencia || getEmailsByGerencia(emailTargetGerencia || "").length === 0) && (
                         <SelectItem value="none" disabled className="text-[10px] font-bold uppercase">Nenhum email cadastrado</SelectItem>
                      )}
                   </SelectContent>
                </Select>
             </div>

             <div className="pt-4 flex gap-3">
                <Button variant="ghost" className="flex-1 h-11 rounded-xl font-black uppercase text-[10px]" onClick={() => setEmailModalOpen(false)}>Cancelar</Button>
                <Button className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px]" onClick={handleSendEmail} disabled={!selectedRecipient || selectedRecipient === "none"}>
                   Abrir E-mail
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
