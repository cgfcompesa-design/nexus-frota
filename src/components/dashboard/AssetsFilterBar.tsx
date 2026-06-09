import React from "react";
import { Search, XCircle, Filter } from "lucide-react";
import { Asset } from "../../types";

interface AssetsFilterBarProps {
  assets: Asset[];
  searchTerm: string;
  selectedDiretoria: string;
  selectedGerencia: string;
  selectedTipo: string;
  selectedCriticidade: string;
  onSearchChange: (value: string) => void;
  onDiretoriaChange: (value: string) => void;
  onGerenciaChange: (value: string) => void;
  onTipoChange: (value: string) => void;
  onCriticidadeChange: (value: string) => void;
  onClearFilters: () => void;
}

export const AssetsFilterBar = ({
  assets,
  searchTerm,
  selectedDiretoria,
  selectedGerencia,
  selectedTipo,
  selectedCriticidade,
  onSearchChange,
  onDiretoriaChange,
  onGerenciaChange,
  onTipoChange,
  onCriticidadeChange,
  onClearFilters,
}: AssetsFilterBarProps) => {
  const diretorias = Array.from(new Set(assets.map(a => a.DIRETORIA).filter(Boolean)));
  const gerencias = Array.from(new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"]).filter(Boolean)));
  const tipos = Array.from(new Set(assets.map(a => a.TIPO).filter(Boolean)));
  const criticidades = Array.from(new Set(assets.map(a => a.CRITICIDADE || a.criticidade).filter(Boolean)));

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar em todos os campos..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button
          onClick={onClearFilters}
          className="flex items-center justify-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold"
        >
          <XCircle size={18} />
          <span>Limpar</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Diretoria</label>
          <select
            value={selectedDiretoria}
            onChange={(e) => onDiretoriaChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todas</option>
            {diretorias.map(d => <option key={d} value={d!}>{d}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gerência</label>
          <select
            value={selectedGerencia}
            onChange={(e) => onGerenciaChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todas</option>
            {gerencias.map(g => <option key={g} value={g!}>{g}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo</label>
          <select
            value={selectedTipo}
            onChange={(e) => onTipoChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todos</option>
            {tipos.map(t => <option key={t} value={t!}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Criticidade</label>
          <select
            value={selectedCriticidade}
            onChange={(e) => onCriticidadeChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todas</option>
            {criticidades.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};
