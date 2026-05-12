import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

export interface KanbanFiltersState {
  sector: string;
  priorityColor: string;
  searchTerm: string;
  responsible: string;
  activityType: string;
}

interface KanbanFiltersProps {
  filters: KanbanFiltersState;
  onFiltersChange: (filters: KanbanFiltersState) => void;
  sectors: string[];
  responsibles: string[];
}

export const KanbanFilters = ({ filters, onFiltersChange, sectors, responsibles }: KanbanFiltersProps) => {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Pesquisar atividades..." 
            className="pl-10 bg-slate-900/50 border-white/10 text-white"
            value={filters.searchTerm}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
          />
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <Select 
              value={filters.sector} 
              onValueChange={(val) => onFiltersChange({ ...filters, sector: val })}
            >
              <SelectTrigger className="bg-slate-900/50 border-white/10 text-white text-[10px] font-black uppercase">
                <SelectValue placeholder="SETOR" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                <SelectItem value="all">TODOS SETORES</SelectItem>
                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select 
              value={filters.responsible} 
              onValueChange={(val) => onFiltersChange({ ...filters, responsible: val })}
            >
              <SelectTrigger className="bg-slate-900/50 border-white/10 text-white text-[10px] font-black uppercase">
                <SelectValue placeholder="RESPONSÁVEL" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                <SelectItem value="all">TODOS RESPONSÁVEIS</SelectItem>
                {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select 
              value={filters.priorityColor} 
              onValueChange={(val) => onFiltersChange({ ...filters, priorityColor: val })}
            >
              <SelectTrigger className="bg-slate-900/50 border-white/10 text-white text-[10px] font-black uppercase">
                <SelectValue placeholder="URGÊNCIA" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                <SelectItem value="all">TODAS</SelectItem>
                <SelectItem value="red">🔴 CRÍTICA</SelectItem>
                <SelectItem value="yellow">🟡 MÉDIA</SelectItem>
                <SelectItem value="blue">🔵 NORMAL</SelectItem>
                <SelectItem value="green">🟢 BAIXA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
