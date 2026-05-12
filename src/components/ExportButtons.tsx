import { Button } from "@/components/ui/button";
import { Download, FileDown, Table as TableIcon } from "lucide-react";
import { Task } from "@/hooks/useKanbanData";

interface ExportButtonsProps {
  tasks: Task[];
}

export const ExportButtons = ({ tasks }: ExportButtonsProps) => {
  const exportToCSV = () => {
    if (tasks.length === 0) return;
    
    const headers = ["ID", "Título", "Status", "Setor", "Tipo", "Prioridade", "Responsáveis"];
    const rows = tasks.map(t => [
      t.id,
      t.title,
      t.status,
      t.sector || "",
      t.activity_type || "",
      t.priority_color || "",
      t.responsibles?.map(r => r.name).join(", ") || ""
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `kanban_atividades_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex justify-end gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={exportToCSV}
        className="h-8 bg-white/5 border-white/10 text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest gap-2"
      >
        <FileDown className="h-3 w-3" /> Exportar CSV
      </Button>
    </div>
  );
};
