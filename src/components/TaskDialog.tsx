import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Task, TaskStatus } from "@/hooks/useKanbanData";
import { Responsible } from "@/hooks/useResponsibles";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  defaultStatus: TaskStatus;
  editingTask: Task | null;
  responsibles: Responsible[];
}

export const TaskDialog = ({ open, onOpenChange, onSubmit, defaultStatus, editingTask, responsibles }: TaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [sector, setSector] = useState("");
  const [priorityColor, setPriorityColor] = useState("blue");
  const [activityType, setActivityType] = useState("operacional");
  const [selectedResponsibles, setSelectedResponsibles] = useState<Responsible[]>([]);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setStatus(editingTask.status);
      setSector(editingTask.sector || "");
      setPriorityColor(editingTask.priority_color || "blue");
      setActivityType(editingTask.activity_type || "operacional");
      
      // Sync responsibles from task to our local selection
      if (editingTask.responsibles && responsibles.length > 0) {
        const matched = responsibles.filter(r => 
          editingTask.responsibles?.some(tr => tr.id === r.id)
        );
        setSelectedResponsibles(matched);
      } else {
        setSelectedResponsibles([]);
      }
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setSector("");
      setPriorityColor("blue");
      setActivityType("operacional");
      setSelectedResponsibles([]);
    }
  }, [editingTask, defaultStatus, open, responsibles]);

  const handleSubmit = () => {
    if (!title) return;
    
    onSubmit({
      id: editingTask?.id,
      title,
      description,
      status,
      sector,
      priority_color: priorityColor,
      activity_type: activityType,
      responsibles: selectedResponsibles.map(r => ({ id: r.id, name: r.name }))
    });
    onOpenChange(false);
  };

  const toggleResponsible = (resp: Responsible) => {
    if (selectedResponsibles.find(r => r.id === resp.id)) {
      setSelectedResponsibles(selectedResponsibles.filter(r => r.id !== resp.id));
    } else {
      setSelectedResponsibles([...selectedResponsibles, resp]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tighter">
            {editingTask ? "Editar Atividade" : "Nova Atividade"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Título</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="bg-slate-800 border-slate-700 focus:border-indigo-500"
              placeholder="Digite o título da tarefa..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="bg-slate-800 border-slate-700 min-h-[100px]"
              placeholder="Descreva a atividade..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="progress">Em Andamento</SelectItem>
                  <SelectItem value="review">Revisão</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Setor</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                  <SelectItem value="Manutenção Próprios">Manutenção Próprios</SelectItem>
                  <SelectItem value="Manutenção Locados">Manutenção Locados</SelectItem>
                  <SelectItem value="Regularização">Regularização</SelectItem>
                  <SelectItem value="Abastecimento">Abastecimento</SelectItem>
                  <SelectItem value="Telemetria">Telemetria</SelectItem>
                  <SelectItem value="Pool">Pool</SelectItem>
                  <SelectItem value="Sistemas">Sistemas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Urgência</Label>
              <Select value={priorityColor} onValueChange={setPriorityColor}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                  <SelectItem value="red">🔴 Crítica</SelectItem>
                  <SelectItem value="yellow">🟡 Média</SelectItem>
                  <SelectItem value="blue">🔵 Normal</SelectItem>
                  <SelectItem value="green">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="projeto">Projeto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Responsáveis</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedResponsibles.map(r => (
                <Badge key={r.id} className="bg-indigo-600 text-white gap-1 py-1">
                  {r.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleResponsible(r)} />
                </Badge>
              ))}
            </div>
            <Select onValueChange={(val) => {
              const resp = responsibles.find(r => r.id === val);
              if (resp) toggleResponsible(resp);
            }}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Adicionar responsável..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                {responsibles?.map(resp => (
                  <SelectItem key={resp.id} value={resp.id}>{resp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest px-8">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
