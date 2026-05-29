import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MaintenanceFilterBarProps {
  directorias: string[];
  gerencias: string[];
  gerenciasByDiretoria: Map<string, string[]>;
  tipos: string[];
  classificacoes: string[];
  statusOperacionais: string[];
  statusManutencoes: string[];
  statusRevisoes: string[];
  statusControles: string[];
  mesesAnos: string[];
  selectedDiretoria: string;
  selectedGerencia: string;
  selectedTipo: string;
  selectedClassificacao: string;
  selectedStatusOperacional: string;
  selectedStatusManutencao: string;
  selectedStatusRevisao: string;
  selectedStatusControle: string;
  selectedMesAno: string;
  selectedCriticidade: string;
  searchPlaca: string;
  onDiretoriaChange: (value: string) => void;
  onGerenciaChange: (value: string) => void;
  onTipoChange: (value: string) => void;
  onClassificacaoChange: (value: string) => void;
  onStatusOperacionalChange: (value: string) => void;
  onStatusManutencaoChange: (value: string) => void;
  onStatusRevisaoChange: (value: string) => void;
  onStatusControleChange: (value: string) => void;
  onMesAnoChange: (value: string) => void;
  onCriticidadeChange: (value: string) => void;
  onSearchPlacaChange: (value: string) => void;
  onClearFilters: () => void;
}

export const MaintenanceFilterBar = ({
  directorias,
  gerencias,
  gerenciasByDiretoria,
  tipos,
  classificacoes,
  statusOperacionais,
  statusManutencoes,
  statusRevisoes,
  statusControles,
  mesesAnos,
  selectedDiretoria,
  selectedGerencia,
  selectedTipo,
  selectedClassificacao,
  selectedStatusOperacional,
  selectedStatusManutencao,
  selectedStatusRevisao,
  selectedStatusControle,
  selectedMesAno,
  selectedCriticidade,
  searchPlaca,
  onDiretoriaChange,
  onGerenciaChange,
  onTipoChange,
  onClassificacaoChange,
  onStatusOperacionalChange,
  onStatusManutencaoChange,
  onStatusRevisaoChange,
  onStatusControleChange,
  onMesAnoChange,
  onCriticidadeChange,
  onSearchPlacaChange,
  onClearFilters,
}: MaintenanceFilterBarProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar por placa..."
            className="pl-10"
            value={searchPlaca}
            onChange={(e) => onSearchPlacaChange(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={onClearFilters} className="gap-2">
          <X size={16} />
          Limpar Filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Diretoria</label>
          <Select value={selectedDiretoria} onValueChange={onDiretoriaChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {directorias.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Gerência</label>
          <Select value={selectedGerencia} onValueChange={onGerenciaChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {selectedDiretoria !== "all" 
                ? (gerenciasByDiretoria.get(selectedDiretoria) || []).map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))
                : gerencias.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Tipo Veículo</label>
          <Select value={selectedTipo} onValueChange={onTipoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Classificação</label>
          <Select value={selectedClassificacao} onValueChange={onClassificacaoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {classificacoes.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Status Operacional</label>
          <Select value={selectedStatusOperacional} onValueChange={onStatusOperacionalChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusOperacionais.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Status Manutenção</label>
          <Select value={selectedStatusManutencao} onValueChange={onStatusManutencaoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusManutencoes.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Status Revisão</label>
          <Select value={selectedStatusRevisao} onValueChange={onStatusRevisaoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusRevisoes.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Mes/Ano Custo</label>
          <Select value={selectedMesAno} onValueChange={onMesAnoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {mesesAnos.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-400">Criticidade</label>
          <Select value={selectedCriticidade} onValueChange={onCriticidadeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
