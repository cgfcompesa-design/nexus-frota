import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, TaskStatus } from "@/hooks/useKanbanData";
import { Plus, MoreVertical, Trash2, Pencil, Calendar, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

export const KanbanColumn = ({ status, title, tasks, onAddTask, onDeleteTask, onEditTask }: KanbanColumnProps) => {
  return (
    <div className={cn(
      "flex flex-col h-full min-h-[500px] border rounded-2xl p-4 transition-all shadow-lg",
      status === 'todo' && "bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30 border-t-rose-500 border-t-4",
      status === 'progress' && "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30 border-t-amber-500 border-t-4",
      status === 'review' && "bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/30 border-t-blue-500 border-t-4",
      status === 'done' && "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 border-t-emerald-500 border-t-4"
    )}>
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className={cn(
          "text-xs font-black uppercase tracking-widest",
          status === 'todo' && "text-rose-600 dark:text-rose-400",
          status === 'progress' && "text-amber-600 dark:text-amber-400",
          status === 'review' && "text-blue-600 dark:text-blue-400",
          status === 'done' && "text-emerald-600 dark:text-emerald-400"
        )}>{title}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            "px-2 h-5 text-[10px] bg-white/50 dark:bg-white/5",
            status === 'todo' && "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
            status === 'progress' && "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
            status === 'review' && "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
            status === 'done' && "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
          )}>{tasks.length}</Badge>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-white/50 dark:hover:bg-white/10"
            onClick={() => onAddTask(status)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-3 min-h-[100px]">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onDelete={onDeleteTask} 
            onEdit={onEditTask} 
          />
        ))}
      </div>
    </div>
  );
};

interface TaskCardProps {
  key?: string;
  task: Task;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export const TaskCard = ({ task, onDelete, onEdit }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-md hover:shadow-xl hover:border-indigo-500/50 transition-all duration-200",
        isDragging && "opacity-50 scale-95 border-indigo-500"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-white" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-300">
              <DropdownMenuItem onClick={() => onEdit(task)} className="gap-2 focus:bg-slate-800 focus:text-white">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="gap-2 text-rose-500 focus:bg-rose-500/10 focus:text-rose-400">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {task.deadline && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500">
            <Calendar className="h-3 w-3" />
            Prazo: {new Date(task.deadline).toLocaleDateString('pt-BR')}
          </div>
        )}

        {task.updates && task.updates.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <MessageSquare className="h-3 w-3" />
            {task.updates.length} atualização{task.updates.length > 1 ? 'ões' : ''}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {task.sector && (
            <Badge variant="outline" className="bg-blue-500/10 text-[9px] font-black uppercase text-blue-400 border-blue-500/20 px-1.5 h-4">
              {task.sector}
            </Badge>
          )}
          {task.activity_type && (
            <Badge variant="outline" className="bg-indigo-500/10 text-[9px] font-black uppercase text-indigo-400 border-indigo-500/20 px-1.5 h-4">
              {task.activity_type}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex -space-x-1.5">
            {task.responsibles?.slice(0, 3).map((resp, i) => (
              <div 
                key={i} 
                className="w-5 h-5 rounded-full bg-indigo-600 border border-slate-900 flex items-center justify-center text-[8px] font-black text-white"
                title={resp.name}
              >
                {resp.name.charAt(0)}
              </div>
            ))}
            {(task.responsibles?.length || 0) > 3 && (
              <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center text-[8px] font-black text-slate-400">
                +{(task.responsibles?.length || 0) - 3}
              </div>
            )}
          </div>
          
          {task.priority_color && task.priority_color !== 'all' && (
             <div 
               className={cn(
                 "w-2 h-2 rounded-full",
                 task.priority_color === 'red' && "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
                 task.priority_color === 'yellow' && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                 task.priority_color === 'green' && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                 task.priority_color === 'blue' && "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
               )}
             />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
