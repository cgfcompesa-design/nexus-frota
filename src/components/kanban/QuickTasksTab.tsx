import React, { useState, useMemo } from "react";
import { useQuickTasks, useQuickTaskLogs, QuickTask, QuickTaskStatus } from "@/hooks/useQuickTasks";
import { useResponsibles } from "@/hooks/useResponsibles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ClipboardCheck, 
  Trash2, 
  Plus, 
  Share2, 
  Check, 
  Clock, 
  User, 
  Calendar, 
  MessageCircle, 
  Copy, 
  ExternalLink, 
  Edit, 
  Filter, 
  Search,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  History
} from "lucide-react";
import { toast } from "sonner";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Cell,
  CartesianGrid
} from "recharts";

export const SECTORS = [
  "Manutenção Próprios",
  "Manutenção Locados",
  "Regularização",
  "Abastecimento",
  "Telemetria",
  "Pool",
  "Sistemas"
];

export const QuickTasksTab = () => {
  const { quickTasks, isLoading, createQuickTask, updateQuickTask, deleteQuickTask } = useQuickTasks();
  const { logs, isLoadingLogs } = useQuickTaskLogs();
  const { responsibles, isLoading: loadingResp } = useResponsibles();

  // Form states
  const [description, setDescription] = useState("");
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [sector, setSector] = useState("Manutenção Próprios");
  const [status, setStatus] = useState<QuickTaskStatus>("A Fazer");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deadline, setDeadline] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filter and Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [respFilter, setRespFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const counts = {
      "A Fazer": 0,
      "Em Andamento": 0,
      "Em Revisão": 0,
      "Concluído": 0,
    };
    quickTasks.forEach((task) => {
      if (counts[task.status] !== undefined) {
        counts[task.status]++;
      }
    });

    const chartData = [
      { name: "A Fazer", quantidade: counts["A Fazer"], color: "#ef4444" }, // Red
      { name: "Em Andamento", quantidade: counts["Em Andamento"], color: "#f59e0b" }, // Amber
      { name: "Em Revisão", quantidade: counts["Em Revisão"], color: "#8b5cf6" }, // Purple
      { name: "Concluído", quantidade: counts["Concluído"], color: "#10b981" }, // Emerald
    ];

    const total = quickTasks.length;
    const completed = counts["Concluído"];
    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { counts, chartData, total, completed, completionPercentage };
  }, [quickTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Por favor, preencha a descrição da pendência!");
      return;
    }
    if (!sector) {
      toast.error("Por favor, selecione um setor!");
      return;
    }
    if (selectedResponsibles.length === 0) {
      toast.error("Por favor, selecione pelo menos um responsável!");
      return;
    }
    if (!deadline) {
      toast.error("Por favor, estipule um prazo de entrega!");
      return;
    }

    try {
      const responsibleString = selectedResponsibles.join(", ");
      if (editingId) {
        await updateQuickTask({
          id: editingId,
          description,
          responsible: responsibleString,
          sector,
          status,
          date,
          deadline,
        });
        toast.success("Pendência updated com sucesso!");
        setEditingId(null);
      } else {
        await createQuickTask({
          description,
          responsible: responsibleString,
          sector,
          status,
          date,
          deadline,
        });
      }

      // Reset
      setDescription("");
      setSelectedResponsibles([]);
      setSector("Manutenção Próprios");
      setStatus("A Fazer");
      setDeadline("");
      setIsFormOpen(false);
    } catch (err) {
      toast.error("Erro ao salvar pendência.");
    }
  };

  const startEdit = (task: QuickTask) => {
    setEditingId(task.id);
    setDescription(task.description);
    const names = task.responsible ? task.responsible.split(", ").map(n => n.trim()).filter(Boolean) : [];
    setSelectedResponsibles(names);
    setSector(task.sector || "Manutenção Próprios");
    setStatus(task.status);
    setDate(task.date);
    setDeadline(task.deadline);
    setIsFormOpen(true);
    // Scroll to form on mobile
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription("");
    setSelectedResponsibles([]);
    setSector("Manutenção Próprios");
    setStatus("A Fazer");
    setDate(new Date().toISOString().split("T")[0]);
    setDeadline("");
    setIsFormOpen(false);
  };

  // Helper date formatter
  const formatDateBr = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return quickTasks.filter((task) => {
      const matchSearch = task.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          task.responsible.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (task.sector || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "all" || task.status === statusFilter;
      const matchResp = respFilter === "all" || (task.responsible || "").split(", ").map(r => r.trim()).includes(respFilter);
      const matchSector = sectorFilter === "all" || task.sector === sectorFilter;
      return matchSearch && matchStatus && matchResp && matchSector;
    });
  }, [quickTasks, searchTerm, statusFilter, respFilter, sectorFilter]);

  // Unique responsibles from tasks to populate filters if needed
  const taskResponsibles = useMemo(() => {
    const list: string[] = [];
    quickTasks.forEach(t => {
      if (t.responsible) {
        t.responsible.split(", ").forEach(name => {
          const trimmed = name.trim();
          if (trimmed && !list.includes(trimmed)) {
            list.push(trimmed);
          }
        });
      }
    });
    return list.sort();
  }, [quickTasks]);

  // WhatsApp formatted string generator
  const getWhatsAppMessage = () => {
    const todayStr = new Date().toLocaleDateString("pt-BR");
    let msg = `*📋 NEXUS BI - PENDÊNCIAS RÁPIDAS DO DIA (${todayStr})*\n`;
    msg += `_Urgências e demandas prioritárias acompanhadas diariamente_\n\n`;

    const statusGroups: Record<QuickTaskStatus, { emoji: string; label: string }> = {
      "A Fazer": { emoji: "🔴", label: "A FAZER (Aguardando início)" },
      "Em Andamento": { emoji: "🟡", label: "EM ANDAMENTO" },
      "Em Revisão": { emoji: "🔵", label: "EM REVISÃO (Validação)" },
      "Concluído": { emoji: "🟢", label: "CONCLUÍDO (Pronto)" }
    };

    let hasItems = false;
    (Object.keys(statusGroups) as QuickTaskStatus[]).forEach((st) => {
      const groupTasks = quickTasks.filter(t => t.status === st);
      if (groupTasks.length > 0) {
        hasItems = true;
        msg += `${statusGroups[st].emoji} *${statusGroups[st].label}*\n`;
        groupTasks.forEach(t => {
          msg += `• [*${t.sector || "Geral"}*] *Prazo: ${formatDateBr(t.deadline)}* - ${t.description} _(Resp: ${t.responsible})_\n`;
        });
        msg += `\n`;
      }
    });

    if (!hasItems) {
      msg += `_Nenhuma pendência prioritária ativa hoje! Parabéns equipe!_ 🌟\n\n`;
    }

    const shareUrl = window.location.origin + "?view=kanban&tab=quick_tasks";
    msg += `🔗 *Atualizar On-line:* ${shareUrl}`;
    return msg;
  };

  const copyShareLink = () => {
    const shareUrl = window.location.origin + "?view=kanban&tab=quick_tasks";
    navigator.clipboard.writeText(shareUrl)
      .then(() => toast.success("Link externo copiado para a área de transferência!"))
      .catch(() => toast.error("Falha ao copiar o link."));
  };

  const copyWhatsAppSummary = () => {
    const text = getWhatsAppMessage();
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Resumo de WhatsApp copiado! Prontinho para colar nos grupos."))
      .catch(() => toast.error("Falha ao copiar resumo."));
  };

  const shareToWhatsAppDirectly = () => {
    const text = getWhatsAppMessage();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const getStatusBadgeStyles = (st: QuickTaskStatus) => {
    switch (st) {
      case "A Fazer":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50";
      case "Em Andamento":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50";
      case "Em Revisão":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/50";
      case "Concluído":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50";
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "Agora mesmo";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6">
      {/* Dashboard de Status - Recharts Widget & Informações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Summary Panel */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/55 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white">Indicadores de Status</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo real-time das pendências</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Ativos</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white italic mt-1">{stats.total}</p>
              </div>
              <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Concluídos</p>
                <p className="text-2xl font-black text-emerald-500 italic mt-1">{stats.completed}</p>
              </div>
            </div>

            <div className="space-y-2 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-805 shadow-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">Taxa de Conclusão</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 italic">{stats.completionPercentage}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.completionPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recharts BarChart Status */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white">Distribuição por Status</CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contagem quantitativa de pendências</CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide text-slate-400">
              <TrendingUp className="h-3 w-3 text-indigo-500" />
              Atualizado
            </div>
          </CardHeader>
          <CardContent className="h-44 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.chartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-850" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }}
                />
                <YAxis 
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }}
                />
                <RechartsTooltip 
                  cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
                  contentStyle={{
                    backgroundColor: "rgba(30, 41, 59, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: "12px"
                  }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "10px", textTransform: 'uppercase', fontWeight: "bold" }}
                />
                <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Overview, WhatsApp sharing & History Log panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50/55 to-slate-50 dark:from-indigo-950/15 dark:to-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-2xl text-white">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">Lista de Pendências</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Urgências e demandas do dia a dia</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crie rapidamente pendências e compartilhe resumos estruturados no WhatsApp. O link externo abre diretamente esta aba para fácil atualização.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button 
                onClick={() => setIsFormOpen(!isFormOpen)} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] uppercase font-black tracking-wider px-4 py-2 flex items-center gap-1 leading-none shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {editingId ? "Editando..." : "Nova Pendência"}
              </Button>
              <Button 
                onClick={copyShareLink} 
                variant="outline"
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 text-[10px] uppercase font-black tracking-wider px-4 py-2 flex items-center gap-1 leading-none"
              >
                <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sharing in WhatsApp groups */}
        <Card className="bg-gradient-to-br from-emerald-50/50 to-slate-50 dark:from-emerald-950/10 dark:to-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-2xl text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">Enviar p/ WhatsApp</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Integração e informes com um clique</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Otimize a comunicação gerando relatórios diários de status perfeitos formatados para grupos do WhatsApp.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Button 
                onClick={copyWhatsAppSummary} 
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] uppercase font-black tracking-wider px-4 py-2 flex items-center justify-center gap-1 leading-none transition-transform active:scale-95"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar Texto
              </Button>
              <Button 
                onClick={shareToWhatsAppDirectly} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] uppercase font-black tracking-wider px-4 py-2 flex items-center justify-center gap-1 leading-none transition-transform active:scale-95 shadow-md shadow-emerald-100 dark:shadow-none"
              >
                <Share2 className="h-3.5 w-3.5" />
                Enviar Direto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log / Change History Card */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between h-auto lg:h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500 rounded-2xl text-white">
                <History className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white truncate">Histórico de Logs</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Ações por usuário em tempo real</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[170px] scrollbar-thin">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs font-semibold py-4">
                Carregando registros...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-xs font-medium">
                Nenhum log registrado ainda.
              </div>
            ) : (
              logs.map((log) => {
                let borderCol = "border-l-indigo-500";
                if (log.actionType === "create") {
                  borderCol = "border-l-emerald-500";
                } else if (log.actionType === "delete") {
                  borderCol = "border-l-rose-500";
                }

                return (
                  <div 
                    key={log.id} 
                    className={`p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 border-l-4 ${borderCol} text-[11px] leading-relaxed transition-all hover:bg-white dark:hover:bg-slate-900`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                        {log.userName}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 shrink-0 select-none">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium font-sans antialiased text-[11px] break-words">
                      {log.details}
                    </p>
                    {log.taskDescription && (
                      <div className="mt-1 text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400/90 truncate bg-indigo-50/40 dark:bg-indigo-950/10 px-1.5 py-0.5 rounded-md inline-block max-w-full">
                        {log.taskDescription}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Card (Collapsible) */}
      {isFormOpen && (
        <Card className="border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 shadow-md rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4" />
                {editingId ? "Editar Detalhes da Pendência" : "Cadastrar Nova Demanda Urgente"}
              </CardTitle>
              {editingId && (
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                  Cancelar Edição
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Description - 12 columns on mobile, 6 on desktop */}
                <div className="md:col-span-6 space-y-1.5">
                  <Label htmlFor="description" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Descrição Detalhada</Label>
                  <Input 
                    id="description"
                    placeholder="Ex: Resolver vazamento de óleo no caminhão Ford Cargo..."
                    className="rounded-xl h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 text-slate-800 dark:text-white"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Responsible selection */}
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Responsáveis ({selectedResponsibles.length})
                  </Label>
                  {loadingResp ? (
                    <div className="rounded-xl h-24 bg-slate-100 animate-pulse" />
                  ) : (
                    <div className="w-full rounded-xl h-24 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-850 overflow-y-auto p-2.5 space-y-1">
                      {responsibles.map((resp) => {
                        const isChecked = selectedResponsibles.includes(resp.name);
                        return (
                          <label 
                            key={resp.id} 
                            className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedResponsibles(selectedResponsibles.filter(name => name !== resp.name));
                                } else {
                                  setSelectedResponsibles([...selectedResponsibles, resp.name]);
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>{resp.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Status Selection */}
                <div className="md:col-span-3 space-y-1.5">
                  <Label htmlFor="status" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status</Label>
                  <select 
                    id="status"
                    className="w-full rounded-xl h-10 border border-slate-200 bg-white px-3 text-xs leading-tight text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as QuickTaskStatus)}
                  >
                    <option value="A Fazer">A Fazer</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Em Revisão">Em Revisão</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Sector Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="sector" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Setor</Label>
                  <select 
                    id="sector"
                    className="w-full rounded-xl h-10 border border-slate-200 bg-white px-3 text-xs leading-tight text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Inclusion Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Data de Entrada</Label>
                  <Input 
                    id="date"
                    type="date"
                    className="rounded-xl h-10 border-slate-200 focus:border-indigo-500 dark:border-slate-700 text-slate-800 dark:text-white"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                {/* Deadline */}
                <div className="space-y-1.5">
                  <Label htmlFor="deadline" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Prazo Final (Deadline)</Label>
                  <Input 
                    id="deadline"
                    type="date"
                    className="rounded-xl h-10 border-slate-200 focus:border-indigo-500 dark:border-slate-700 text-slate-800 dark:text-white"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={cancelEdit} className="rounded-xl text-[10px] font-black uppercase px-6">
                    Mudar p/ Cadastro
                  </Button>
                )}
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase px-8">
                  {editingId ? "Salvar Alterações" : "Adicionar à Lista"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter and Query Engine */}
      <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Pesquisar por descrição ou responsável..."
                className="pl-10 rounded-xl h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Sector Filter */}
              <select
                className="rounded-xl h-10 border border-slate-200 bg-slate-50/50 px-3 text-xs leading-tight text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="all">Filtrar por Setor</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Status filter selection */}
              <select
                className="rounded-xl h-10 border border-slate-200 bg-slate-50/50 px-3 text-xs leading-tight text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Filtrar por Status</option>
                <option value="A Fazer">🔴 A Fazer</option>
                <option value="Em Andamento">🟡 Em Andamento</option>
                <option value="Em Revisão">🔵 Em Revisão</option>
                <option value="Concluído">🟢 Concluído</option>
              </select>

              {/* Responsible filter selection */}
              <select
                className="rounded-xl h-10 border border-slate-200 bg-slate-50/50 px-3 text-xs leading-tight text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                value={respFilter}
                onChange={(e) => setRespFilter(e.target.value)}
              >
                <option value="all">Filtrar por Responsável</option>
                {taskResponsibles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {(searchTerm || statusFilter !== "all" || respFilter !== "all" || sectorFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setRespFilter("all");
                    setSectorFilter("all");
                  }} 
                  className="text-[9px] uppercase font-black text-slate-400 hover:text-indigo-500 h-10 rounded-xl"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main List & Responsive Mobile view */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando pendências rápidas...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center bg-slate-50/50 dark:bg-slate-900/10">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-black uppercase text-slate-600 dark:text-slate-400">Nenhuma pendência encontrada</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1">Experimente mudar o filtro de buscas ou adicione uma nova demanda no botão acima!</p>
        </Card>
      ) : (
        <>
          {/* Desktop view: Table */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-800">
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4">Data Registro</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4">Setor</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4">Descrição da Demanda</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4">Responsável</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4 text-center">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4 text-center">Prazo Final</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-wider py-4 text-right pr-6">Ações Rápidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-55/20 transition-colors">
                    <TableCell className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-4">{formatDateBr(task.date)}</TableCell>
                    <TableCell className="text-xs font-black text-indigo-900 dark:text-indigo-200 py-4 uppercase tracking-tighter">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px]">
                        {task.sector || "Geral"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-100 py-4 max-w-sm font-sans tracking-tight">
                      {task.description}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {task.responsible ? (
                          task.responsible.split(", ").map((name, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 text-[10px] font-black uppercase px-2 py-0.5 rounded-md"
                            >
                              <User className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic font-medium">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="inline-flex justify-center">
                        <select
                          className={`rounded-full px-4 py-1 text-[10px] font-black uppercase border leading-none focus:outline-none shadow-sm transition-all cursor-pointer ${getStatusBadgeStyles(task.status)}`}
                          value={task.status}
                          onChange={(e) => updateQuickTask({ id: task.id, status: e.target.value as QuickTaskStatus })}
                        >
                          <option value="A Fazer">🔴 A Fazer</option>
                          <option value="Em Andamento">🟡 Em Andamento</option>
                          <option value="Em Revisão">🔵 Em Revisão</option>
                          <option value="Concluído">🟢 Concluído</option>
                        </select>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-black text-center py-4 uppercase">
                      <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-600 dark:text-slate-400">
                        {formatDateBr(task.deadline)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          onClick={() => startEdit(task)} 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => {
                            if (window.confirm("Deseja realmente deletar esta pendência?")) {
                              deleteQuickTask(task.id);
                            }
                          }} 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile view: beautiful cards formatted for easy single-hand updates */}
          <div className="lg:hidden space-y-4">
            {filteredTasks.map((task) => (
              <Card 
                key={task.id} 
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm hover:border-slate-350 active:scale-[0.99] transition-transform"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full uppercase">
                      Inserção: {formatDateBr(task.date)}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${getStatusBadgeStyles(task.status)}`}>
                      {task.status === "A Fazer" && "● A Fazer"}
                      {task.status === "Em Andamento" && "● Em Andamento"}
                      {task.status === "Em Revisão" && "● Em Revisão"}
                      {task.status === "Concluído" && "✔ Concluído"}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-extrabold px-1.5 py-0.5 rounded mr-1.5 uppercase">
                      {task.sector || "Geral"}
                    </span>
                    {task.description}
                  </p>

                  <div className="flex items-center gap-2 border-t border-b border-slate-100 dark:border-slate-800 py-2.5 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsáveis</div>
                      <div className="flex flex-wrap gap-1">
                        {task.responsible ? (
                          task.responsible.split(", ").map((name, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-md"
                            >
                              <User className="h-2.5 w-2.5 shrink-0" />
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Prazo Final</div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                        {formatDateBr(task.deadline)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Fast Status Picker on Mobile */}
                    <div className="flex-1">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mudar Status</div>
                      <select
                        className="w-full text-xs h-9 border border-slate-200 dark:border-slate-800 rounded-lg px-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        value={task.status}
                        onChange={(e) => updateQuickTask({ id: task.id, status: e.target.value as QuickTaskStatus })}
                      >
                        <option value="A Fazer">🔴 A Fazer</option>
                        <option value="Em Andamento">🟡 Em Andamento</option>
                        <option value="Em Revisão">🔵 Em Revisão</option>
                        <option value="Concluído">🟢 Concluído</option>
                      </select>
                    </div>

                    <div className="flex items-end gap-1 shrink-0 self-end">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => startEdit(task)} 
                        className="h-9 w-9 p-0 rounded-lg text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/30"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          if (window.confirm("Excluir esta pendência?")) {
                            deleteQuickTask(task.id);
                          }
                        }} 
                        className="h-9 w-9 p-0 rounded-lg text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
