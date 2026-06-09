import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, CalendarIcon, LayoutGrid, List, Trash2, CalendarX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useIndicators } from "@/hooks/useIndicators";
import { useResponsibles } from "@/hooks/useResponsibles";
import { IndicatorDialog } from "@/components/IndicatorDialog";
import { IndicatorChart } from "@/components/IndicatorChart";
import { useKanbanData } from "@/hooks/useKanbanData";
import { PrintDashboard } from "@/components/PrintDashboard";
import { useIndicatorValues } from "@/hooks/useIndicatorValues";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GestaoVistaProps {
  onBack: () => void;
}

const GestaoVista = ({ onBack }: GestaoVistaProps) => {
  const { indicators, isLoading, deleteIndicator } = useIndicators();
  const { responsibles } = useResponsibles();
  const { tasks } = useKanbanData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  
  const formattedMonth = format(selectedMonth, "yyyy-MM-01");
  const { values: indicatorValues, deleteValue } = useIndicatorValues(undefined, formattedMonth);
  const { values: allIndicatorValues, deleteValue: deleteAnyValue } = useIndicatorValues();

  const handleDeleteValue = async (valueId: string, indicatorName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o lançamento de score do mês selecionado para o indicador "${indicatorName}"?`)) {
      return;
    }
    try {
      await deleteValue(valueId);
      toast.success("Lançamento mensal excluído com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir o lançamento do mês.");
    }
  };

  const handleDeleteHistoryValue = async (valueId: string, indicatorName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir este lançamento histórico do indicador "${indicatorName}"?`)) {
      return;
    }
    try {
      await deleteAnyValue(valueId);
      toast.success("Lançamento histórico excluído com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir lançamento histórico.");
    }
  };

  const handleDeleteIndicator = async (indicatorId: string, indicatorName: string) => {
    if (!window.confirm(`ATENÇÃO: Isso removerá o indicador "${indicatorName}" PERMANENTEMENTE das listagens e relatórios. Confirma?`)) {
      return;
    }
    try {
      await deleteIndicator(indicatorId);
      toast.success(`Indicador "${indicatorName}" removido permanentemente!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir cadastro do indicador.");
    }
  };

  const cgfLogo = "/src/assets/images/regenerated_image_1778593500523.png";

  const sections = [
    { id: "manutencao", name: "Manutenção", subsections: ["Próprios", "Locados"] },
    { id: "abastecimento", name: "Abastecimento" },
    { id: "regularizacao", name: "Regularização" },
    { id: "telemetria", name: "Telemetria" },
    { id: "pool", name: "Pool" },
    { id: "kanban", name: "Kanban de Atividades" },
    { id: "dashboard", name: "Dashboard Completo" },
  ];

  const indicatorsWithMonthValues = useMemo(() => {
    return indicators.map((indicator) => {
      const monthValue = indicatorValues.find((v) => v.indicator_id === indicator.id);
      return {
        ...indicator,
        current_value: monthValue ? monthValue.current_value : 0,
        target: monthValue ? monthValue.target : indicator.target,
        value_id: monthValue?.id,
      };
    });
  }, [indicators, indicatorValues]);

  const allEntries = useMemo(() => {
    return allIndicatorValues.map(val => {
      const indicator = indicators.find(i => i.id === val.indicator_id);
      if (!indicator) return null;
      return {
        ...indicator,
        ...val,
        value_id: val.id,
        id: indicator.id // When editing, we edit the indicator definition with the month context
      };
    }).filter(e => e !== null)
    .sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name));
  }, [allIndicatorValues, indicators]);

  const getIndicatorsBySection = (sectionId: string, subsection?: string) => {
    return indicatorsWithMonthValues.filter(
      (ind) =>
        ind.section === sectionId &&
        (subsection ? ind.subsection === subsection : !ind.subsection)
    );
  };

  const getKanbanStats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const progress = tasks.filter((t) => t.status === "progress").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const done = tasks.filter((t) => t.status === "done").length;

    return {
      total,
      todo,
      progress,
      review,
      done,
      completion: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [tasks]);

  const handleAddIndicator = (sectionId: string, subsection?: string) => {
    setEditingIndicator({ section: sectionId, subsection });
    setDialogOpen(true);
  };

  const handleEditIndicator = (indicator: any) => {
    setEditingIndicator(indicator);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-indigo-600 font-black uppercase tracking-widest animate-pulse italic">
          Carregando Gestão à Vista...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={onBack} 
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-900/20 rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest pl-2 pr-6 h-12 transition-all group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline">Voltar ao Início</span>
            </Button>
            <img 
              src={cgfLogo} 
              alt="Nexus BI Logo" 
              className="h-12 w-auto drop-shadow-sm" 
              onError={(e) => {
                e.currentTarget.src = "https://placehold.co/100x40/6366f1/ffffff?text=NEXUS+BI";
              }}
            />
            <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="hidden md:block">
              <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none text-slate-800 dark:text-white">
                Gestão à Vista
              </h1>
              <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">
                Monitoramento Estratégico Nexus Frota BI
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <Button 
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all", 
                  viewMode === "grid" ? "bg-indigo-600 shadow-lg text-white" : "text-slate-500 hover:text-indigo-600"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Painel Visual
              </Button>
              <Button 
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all", 
                  viewMode === "table" ? "bg-indigo-600 shadow-lg text-white" : "text-slate-500 hover:text-indigo-600"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Planilha (Gerenciar)
              </Button>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Referência:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black uppercase text-[10px] tracking-widest h-10 rounded-xl px-4 flex items-center gap-2 shadow-sm"
                >
                  <CalendarIcon className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                  {format(selectedMonth, "MMMM / yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl" align="end">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Tabs defaultValue="manutencao" className="space-y-8">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 h-12 rounded-2xl w-full flex overflow-x-auto gap-1 shadow-sm">
            {sections.map((section) => (
              <TabsTrigger 
                key={section.id} 
                value={section.id}
                className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap px-4"
              >
                {section.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="space-y-8 outline-none">
              {section.id === "dashboard" ? (
                <PrintDashboard
                  indicators={indicatorsWithMonthValues}
                  allIndicatorValues={allIndicatorValues}
                  tasks={tasks}
                  responsibles={responsibles}
                  selectedMonth={selectedMonth}
                  onEditIndicator={handleEditIndicator}
                />
              ) : section.id === "kanban" ? (
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                  <CardHeader className="p-8 border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-xl font-black uppercase text-slate-800 dark:text-white">Status Consolidado Kanban</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-slate-800 dark:text-white italic">{getKanbanStats.total}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Demandas</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-amber-500 italic">{getKanbanStats.todo}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">A Fazer</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-blue-500 italic">{getKanbanStats.progress}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Em Execução</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-indigo-500 italic">{getKanbanStats.review}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revisão</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-black text-emerald-500 italic">{getKanbanStats.done}</div>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Concluídas</div>
                      </div>
                    </div>
                    <div className="mt-12 space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Índice de Produtividade</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 italic">{getKanbanStats.completion}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-200 dark:border-white/5 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                          style={{ width: `${getKanbanStats.completion}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {viewMode === "table" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <div>
                            <h2 className="text-lg font-black uppercase text-slate-800 dark:text-white tracking-widest leading-none">
                              Planilha de Lançamento
                            </h2>
                            <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mt-1">
                              Referência: {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAddIndicator(section.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 font-black uppercase text-[10px] tracking-widest h-10 shadow-lg"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Indicador
                        </Button>
                      </div>

                      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow className="border-slate-100 dark:border-white/5">
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Indicador</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Responsável</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-600 py-4">Resultado Atual</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Meta</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 text-center">Status</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {indicatorsWithMonthValues
                              .filter(ind => ind.section === section.id)
                              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                              .map((indicator) => {
                                const isFilled = !!indicator.value_id;
                                const achieved = indicator.goal_type === "lower" 
                                  ? indicator.current_value <= indicator.target 
                                  : indicator.current_value >= indicator.target;
                                const responsible = responsibles.find(r => r.id === indicator.responsible_id);
                                
                                return (
                                  <TableRow key={indicator.id} className="border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                    <TableCell className="py-4">
                                      <div className="font-bold text-slate-800 dark:text-white uppercase text-xs">{indicator.name}</div>
                                      {indicator.subsection && (
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{indicator.subsection}</div>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-4">
                                      <div className="text-[10px] font-medium text-slate-500 uppercase">
                                        {responsible?.name || "Não definido"}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                      <div className={cn(
                                        "font-black italic text-sm",
                                        isFilled ? "text-indigo-600 dark:text-indigo-400" : "text-slate-300 dark:text-slate-700"
                                      )}>
                                        {indicator.current_value}{indicator.unit}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-4 font-bold text-slate-600 dark:text-slate-400">
                                      {indicator.target}{indicator.unit}
                                    </TableCell>
                                    <TableCell className="py-4 text-center">
                                      {isFilled ? (
                                        <div className={cn(
                                          "flex items-center justify-center gap-1.5 font-black text-[9px] uppercase",
                                          achieved ? "text-emerald-500" : "text-rose-500"
                                        )}>
                                          {achieved ? (
                                            <><div className="w-1 h-1 rounded-full bg-emerald-500" /> ✓ Dentro da Meta</>
                                          ) : (
                                            <><div className="w-1 h-1 rounded-full bg-rose-500" /> ✗ Fora da Meta</>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase text-slate-300">Pendente</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleEditIndicator(indicator)}
                                          className={cn(
                                            "h-8 px-3 font-black text-[9px] uppercase tracking-widest rounded-lg transition-all",
                                            isFilled 
                                              ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-white/5" 
                                              : "text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                          )}
                                        >
                                          {isFilled ? "Alterar" : "Lançar"}
                                        </Button>

                                        {isFilled && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteValue(indicator.value_id, indicator.name)}
                                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                            title="Excluir lançamento deste mês"
                                          >
                                            <CalendarX className="h-4 w-4" />
                                          </Button>
                                        )}

                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteIndicator(indicator.id, indicator.name)}
                                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 pr-1"
                                          title="Excluir indicador cadastrado"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </Card>

                      <div className="pt-8 border-t border-slate-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Histórico de LançamentosAnteriores</h3>
                        </div>
                        <Card className="bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
                          <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
                              <TableRow className="border-slate-100 dark:border-white/5">
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3">Mês/Ano</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3">Indicador</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3">Realizado</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 text-right">Ação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allEntries
                                .filter(e => e.section === section.id && e.month !== format(selectedMonth, "yyyy-MM"))
                                .slice(0, 10)
                                .map((entry) => (
                                  <TableRow key={entry.value_id} className="border-slate-100 dark:border-white/5 opacity-70 hover:opacity-100 transition-opacity group">
                                    <TableCell className="py-2">
                                      <span className="text-[9px] font-black uppercase text-slate-500">
                                        {format(new Date(entry.month + "T12:00:00Z"), "MMM / yy", { locale: ptBR })}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                      {entry.name}
                                    </TableCell>
                                    <TableCell className="py-2 text-[10px] font-black text-indigo-500 italic">
                                      {entry.current_value}{entry.unit}
                                    </TableCell>
                                    <TableCell className="py-2 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button 
                                          variant="ghost" 
                                          size="xs"
                                          onClick={() => {
                                            setSelectedMonth(new Date(entry.month + "T12:00:00Z"));
                                            handleEditIndicator(entry);
                                          }}
                                          className="h-6 text-[8px] font-black uppercase"
                                        >
                                          Ver
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteHistoryValue(entry.value_id, entry.name)}
                                          className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                          title="Excluir este lançamento histórico"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <>
                  {section.subsections ? (
                    section.subsections.map((subsection) => (
                      <div key={subsection} className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                          <h2 className="text-lg font-black uppercase text-slate-800 dark:text-white tracking-widest flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            {subsection}
                          </h2>
                          <Button
                            onClick={() => handleAddIndicator(section.id, subsection)}
                            className="bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest h-10 shadow-sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Indicador
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {getIndicatorsBySection(section.id, subsection).map(
                            (indicator) => (
                              <IndicatorChart
                                key={indicator.id}
                                indicator={indicator}
                                onEdit={handleEditIndicator}
                                responsibles={responsibles}
                                selectedMonth={selectedMonth}
                                historyValues={allIndicatorValues.filter(
                                  (v) => v.indicator_id === indicator.id
                                )}
                              />
                            )
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <h2 className="text-lg font-black uppercase text-slate-800 dark:text-white tracking-widest flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          {section.name}
                        </h2>
                        <Button
                          onClick={() => handleAddIndicator(section.id)}
                          className="bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest h-10 shadow-sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Indicador
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {getIndicatorsBySection(section.id).map((indicator) => (
                          <IndicatorChart
                            key={indicator.id}
                            indicator={indicator}
                            onEdit={handleEditIndicator}
                            responsibles={responsibles}
                            selectedMonth={selectedMonth}
                            historyValues={allIndicatorValues.filter(
                              (v) => v.indicator_id === indicator.id
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <IndicatorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          indicator={editingIndicator}
          selectedMonth={selectedMonth}
          onClose={() => {
            setDialogOpen(false);
            setEditingIndicator(null);
          }}
        />
      </div>
    </div>
  );
};

export default GestaoVista;
