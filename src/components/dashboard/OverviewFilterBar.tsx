import React from "react";
import { Search, XCircle } from "lucide-react";
import { Asset } from "../../types";

interface OverviewFilterBarProps {
  assets: Asset[];
  searchPlaca: string;
  selectedTipo: string;
  selectedDiretoria: string;
  selectedGerencia: string;
  selectedCriticidade: string;
  onSearchPlacaChange: (value: string) => void;
  onTipoChange: (value: string) => void;
  onDiretoriaChange: (value: string) => void;
  onGerenciaChange: (value: string) => void;
  onCriticidadeChange: (value: string) => void;
  onClearFilters: () => void;
}

export const OverviewFilterBar = ({
  assets,
  searchPlaca,
  selectedTipo,
  selectedDiretoria,
  selectedGerencia,
  selectedCriticidade,
  onSearchPlacaChange,
  onTipoChange,
  onDiretoriaChange,
  onGerenciaChange,
  onCriticidadeChange,
  onClearFilters,
}: OverviewFilterBarProps) => {
  const tipos = Array.from(new Set(assets.map(a => a.TIPO).filter(Boolean))).sort();
  const diretorias = Array.from(new Set(assets.map(a => a.DIRETORIA).filter(Boolean))).sort();
  const gerencias = Array.from(new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"]).filter(Boolean))).sort();
  const criticidades = ["A", "B", "C"];

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchPlaca}
            onChange={(e) => onSearchPlacaChange(e.target.value)}
            placeholder="Buscar por placa..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <button
          onClick={onClearFilters}
          className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 transition-colors text-sm font-medium px-2"
        >
          <XCircle size={18} />
          <span className="whitespace-nowrap">Limpar Filtros</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Tipo</label>
          <select
            value={selectedTipo}
            onChange={(e) => onTipoChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todos os tipos</option>
            {tipos.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Diretoria</label>
          <select
            value={selectedDiretoria}
            onChange={(e) => onDiretoriaChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todas Diretorias</option>
            {diretorias.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Gerência</label>
          <select
            value={selectedGerencia}
            onChange={(e) => onGerenciaChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todas Gerências</option>
            {gerencias.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Criticidade</label>
          <select
            value={selectedCriticidade}
            onChange={(e) => onCriticidadeChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Todas Criticidades</option>
            {criticidades.map((c) => (
              <option key={c} value={c}>Nível {c}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
