import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useKanbanData, Task, TaskStatus } from "@/hooks/useKanbanData";
import { useResponsibles, Responsible } from "@/hooks/useResponsibles";
import { KanbanColumn } from "@/components/KanbanColumn";
import { TaskCard } from "@/components/KanbanColumn"; // Re-using TaskCard from here
import { TaskDialog } from "@/components/TaskDialog";
import { ResponsibleDialog } from "@/components/ResponsibleDialog";
import { ExportButtons } from "@/components/ExportButtons";
import { KanbanFilters, KanbanFiltersState } from "@/components/KanbanFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, List, Pencil, Trash2, UserPlus, Kanban } from "lucide-react";

interface KanbanBoardProps {
  onBack: () => void;
}

const KanbanBoard = ({ onBack }: KanbanBoardProps) => {
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useKanbanData();
  const { responsibles, isLoading: loadingResponsibles, createResponsible, updateResponsible, deleteResponsible } = useResponsibles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [responsibleDialogOpen, setResponsibleDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingResponsible, setEditingResponsible] = useState<Responsible | null>(null);
  const [filters, setFilters] = useState<KanbanFiltersState>({
    sector: "all",
    priorityColor: "all",
    searchTerm: "",
    responsible: "all",
    activityType: "all",
  });

  const cgfLogo = "/src/assets/images/regenerated_image_1778593500523.png";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const validStatuses: TaskStatus[] = ["todo", "progress", "review", "done"];

    let newStatus: TaskStatus | null = null;
    if (validStatuses.includes(overId as TaskStatus)) {
      newStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (task && newStatus && task.status !== newStatus) {
      updateTask({ id: taskId, status: newStatus });
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSubmitTask = (taskData: any) => {
    if (taskData.id) {
      updateTask(taskData);
    } else {
      createTask(taskData);
    }
  };

  const handleAddResponsible = () => {
    setEditingResponsible(null);
    setResponsibleDialogOpen(true);
  };

  const handleEditResponsible = (responsible: Responsible) => {
    setEditingResponsible(responsible);
    setResponsibleDialogOpen(true);
  };

  const handleSubmitResponsible = (responsibleData: any) => {
    if (responsibleData.id) {
      updateResponsible(responsibleData);
    } else {
      createResponsible(responsibleData);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.searchTerm && !task.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) && !task.description?.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
      if (filters.sector && filters.sector !== "all" && task.sector !== filters.sector) return false;
      if (filters.priorityColor !== "all" && task.priority_color !== filters.priorityColor) return false;
      if (filters.activityType !== "all" && (task.activity_type || "operacional") !== filters.activityType) return false;
      if (filters.responsible && filters.responsible !== "all") {
        const hasResponsible = task.responsibles?.some((r) => r.name === filters.responsible);
        if (!hasResponsible) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter((task) => task.status === status);
  };

  const uniqueSectors = useMemo(() => {
    const sectors = tasks.map((task) => task.sector).filter((sector): sector is string => !!sector);
    return Array.from(new Set(sectors));
  }, [tasks]);

  const uniqueResponsibles = useMemo(() => {
    const respNames = tasks.flatMap((task) => task.responsibles?.map((r) => r.name) || []);
    return Array.from(new Set(respNames));
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-4">
           <Skeleton className="h-12 w-48 mx-auto" />
           <div className="flex gap-4">
              <Skeleton className="h-[400px] w-64" />
              <Skeleton className="h-[400px] w-64" />
              <Skeleton className="h-[400px] w-64" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <Button 
              variant="ghost" 
              onClick={onBack} 
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-900/20 rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest pl-2 pr-6 h-12 transition-all group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                <ArrowLeft className="h-4 w-4" />
              </div>
              Voltar ao Início
            </Button>
            <img 
              src={cgfLogo} 
              alt="Nexus BI Logo" 
              className="h-14 w-auto drop-shadow-sm" 
              onError={(e) => {
                e.currentTarget.src = "https://placehold.co/100x40/6366f1/ffffff?text=NEXUS+BI";
              }}
            />
            <div className="hidden md:flex flex-col items-end">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Sistema Conectado</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-1 leading-none italic">
              Quadro Kanban
            </h1>
            <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">
              Gestão de Atividades e Demandas Nexus BI
            </p>
          </div>
        </header>

        <Tabs defaultValue="kanban" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 h-11 rounded-2xl shadow-sm">
               <TabsTrigger value="kanban" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl px-6 font-black uppercase text-[10px] tracking-widest transition-all">Kanban</TabsTrigger>
               <TabsTrigger value="responsibles" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl px-6 font-black uppercase text-[10px] tracking-widest transition-all">Responsáveis</TabsTrigger>
             </TabsList>
             
             {tasks.length > 0 && <ExportButtons tasks={tasks} />}
          </div>

          <TabsContent value="kanban" className="space-y-6 outline-none">
            <KanbanFilters
              filters={filters}
              onFiltersChange={setFilters}
              sectors={uniqueSectors}
              responsibles={uniqueResponsibles}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KanbanColumn
                  status="todo"
                  title="A Fazer"
                  tasks={getTasksByStatus("todo")}
                  onAddTask={handleAddTask}
                  onDeleteTask={deleteTask}
                  onEditTask={handleEditTask}
                />
                <KanbanColumn
                  status="progress"
                  title="Em Andamento"
                  tasks={getTasksByStatus("progress")}
                  onAddTask={handleAddTask}
                  onDeleteTask={deleteTask}
                  onEditTask={handleEditTask}
                />
                <KanbanColumn
                  status="review"
                  title="Em Revisão"
                  tasks={getTasksByStatus("review")}
                  onAddTask={handleAddTask}
                  onDeleteTask={deleteTask}
                  onEditTask={handleEditTask}
                />
                <KanbanColumn
                  status="done"
                  title="Concluído"
                  tasks={getTasksByStatus("done")}
                  onAddTask={handleAddTask}
                  onDeleteTask={deleteTask}
                  onEditTask={handleEditTask}
                />
              </div>

              <DragOverlay>
                {activeTask ? (
                  <div className="rotate-3 scale-105 pointer-events-none cursor-grabbing">
                    <TaskCard task={activeTask} onDelete={() => {}} onEdit={() => {}} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          <TabsContent value="responsibles" className="outline-none">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Equipe de Responsáveis</CardTitle>
                  <Button onClick={handleAddResponsible} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-indigo-500/20">
                    <UserPlus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingResponsibles ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : responsibles.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum responsável cadastrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest pl-6">Nome</TableHead>
                        <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest">E-mail</TableHead>
                        <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest text-center">WhatsApp</TableHead>
                        <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest text-right pr-6">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responsibles.map((responsible) => (
                        <TableRow key={responsible.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                          <TableCell className="font-black text-slate-800 dark:text-white text-[11px] uppercase tracking-tighter pl-6">{responsible.name}</TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-xs font-medium">{responsible.email || "-"}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-indigo-600 dark:text-indigo-400">{responsible.whatsapp || "-"}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditResponsible(responsible)}
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/10 rounded-lg"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteResponsible(responsible.id)}
                                className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmitTask}
          defaultStatus={defaultStatus}
          editingTask={editingTask}
          responsibles={responsibles}
        />

        <ResponsibleDialog
          open={responsibleDialogOpen}
          onOpenChange={setResponsibleDialogOpen}
          onSubmit={handleSubmitResponsible}
          editingResponsible={editingResponsible}
        />
      </div>
    </div>
  );
};

export default KanbanBoard;
