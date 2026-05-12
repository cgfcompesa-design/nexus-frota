import React from "react";
import { Filter, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TelemetryFilterBarProps {
  diretorias: string[];
  gerencias: string[];
  gravidades: string[];
  situacoes: string[];
  tiposNotificacao: string[];
  meses: string[];
  selectedDiretorias: string[];
  selectedGerencias: string[];
  selectedGravidades: string[];
  selectedSituacoes: string[];
  selectedTiposNotificacao: string[];
  selectedMeses: string[];
  onDiretoriasChange: (values: string[]) => void;
  onGerenciasChange: (values: string[]) => void;
  onGravidadesChange: (values: string[]) => void;
  onSituacoesChange: (values: string[]) => void;
  onTiposNotificacaoChange: (values: string[]) => void;
  onMesesChange: (values: string[]) => void;
  onClearFilters: () => void;
}

export const TelemetryFilterBar = ({
  diretorias,
  gerencias,
  gravidades,
  situacoes,
  tiposNotificacao,
  meses,
  selectedDiretorias,
  selectedGerencias,
  selectedGravidades,
  selectedSituacoes,
  selectedTiposNotificacao,
  selectedMeses,
  onDiretoriasChange,
  onGerenciasChange,
  onGravidadesChange,
  onSituacoesChange,
  onTiposNotificacaoChange,
  onMesesChange,
  onClearFilters,
}: TelemetryFilterBarProps) => {

  const FilterGroup = ({ label, options, selected, onChange, idPrefix }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; idPrefix: string }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between h-10 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold"
          )}
        >
          <span className="truncate">
            {selected.length > 0 ? `${selected.length} itens` : "Todos"}
          </span>
          <ChevronDown size={14} className="opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50">
          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {options.map(opt => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox 
                  id={`${idPrefix}-${opt}`} 
                  checked={selected.includes(opt)}
                  onCheckedChange={() => {
                    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);
                  }}
                />
                <label htmlFor={`${idPrefix}-${opt}`} className="text-xs font-bold uppercase cursor-pointer select-none text-slate-700 dark:text-slate-300 truncate flex-1">{opt}</label>
              </div>
            ))}
            {options.length === 0 && <p className="text-[10px] text-slate-400 uppercase font-black text-center py-4">Sem opções disponíveis</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter size={18} className="text-indigo-600" />
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white">Filtros Avançados de Alertas</h3>
        </div>
        <button onClick={onClearFilters} className="text-xs font-black uppercase text-rose-500 hover:underline tracking-widest">Limpar Todos</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <FilterGroup 
          label="Mês/Ano" 
          options={meses} 
          selected={selectedMeses} 
          onChange={onMesesChange} 
          idPrefix="mes" 
        />
        <FilterGroup 
          label="Diretoria" 
          options={diretorias} 
          selected={selectedDiretorias} 
          onChange={onDiretoriasChange} 
          idPrefix="dir" 
        />
        <FilterGroup 
          label="Gerência" 
          options={gerencias} 
          selected={selectedGerencias} 
          onChange={onGerenciasChange} 
          idPrefix="ger" 
        />
        <FilterGroup 
          label="Gravidade" 
          options={gravidades} 
          selected={selectedGravidades} 
          onChange={onGravidadesChange} 
          idPrefix="grav" 
        />
        <FilterGroup 
          label="Situação" 
          options={situacoes} 
          selected={selectedSituacoes} 
          onChange={onSituacoesChange} 
          idPrefix="sit" 
        />
        <FilterGroup 
          label="Tipo Notificação" 
          options={tiposNotificacao} 
          selected={selectedTiposNotificacao} 
          onChange={onTiposNotificacaoChange} 
          idPrefix="tipo" 
        />
      </div>
    </div>
  );
};
