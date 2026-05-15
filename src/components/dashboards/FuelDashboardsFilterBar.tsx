import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Calendar as CalendarIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

export const FuelDashboardsFilterBar = ({ 
  onClearFilters, 
  searchPlaca, 
  onSearchPlacaChange, 
  selectedGerencias, 
  onGerenciasChange, 
  assets = [],
  fuel = [],
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  selectedFuelTypes,
  onFuelTypesChange,
  selectedVehicleModels,
  onVehicleModelsChange,
  selectedDirectorias,
  onDirectoriasChange,
  selectedTipos,
  onTiposChange,
  selectedMonthsYears,
  onMonthsYearsChange,
  selectedRegioes,
  onRegioesChange,
  selectedCidades,
  onCidadesChange,
  selectedTipoControleAutonomia,
  onTipoControleAutonomiaChange,
  selectedAlerta,
  onAlertaChange,
  selectedAlertaAutonomia,
  onAlertaAutonomiaChange,
  selectedAlertaKmHora,
  onAlertaKmHoraChange,
  selectedAlertaLitros,
  onAlertaLitrosChange,
  selectedAlertaItem,
  onAlertaItemChange,
  selectedParecerNexus,
  onParecerNexusChange,
  selectedAlertaValorLitro,
  onAlertaValorLitroChange,
  selectedAlertaVale,
  onAlertaValeChange,
  fuelTypeOptions = [],
  modelOptions = [],
  diretoriaOptions = [],
  gerenciaOptions = [],
  tipoOptions = [],
  monthYearOptions = [],
  autoControleOptions = [],
  regiaoOptions = [],
  cidadeOptions = []
}: any) => {

  const handleMultiSelect = (current: string[], onChange: (val: string[]) => void, val: string) => {
    if (val && !current.includes(val)) {
      onChange([...current, val]);
    }
  };

  const removeFilter = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.filter(x => x !== item));
  };

  const hasAlertFilters = (selectedAlerta?.length > 0 || selectedAlertaAutonomia?.length > 0 || selectedAlertaKmHora?.length > 0 || selectedAlertaLitros?.length > 0 || selectedAlertaItem?.length > 0 || selectedParecerNexus?.length > 0 || selectedAlertaValorLitro?.length > 0 || selectedAlertaVale?.length > 0);

  return (
    <Card className="p-4 space-y-4 shadow-md bg-white/50 backdrop-blur-sm border-primary/10">
      <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-full">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Filtros Inteligentes</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onClearFilters} className="font-bold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all">
          <X className="h-4 w-4 mr-2" /> Limpar Tudo
        </Button>
      </div>
      
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {/* Row 1: Identificação e Localização */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1 font-mono tracking-tight text-primary/80">Placa do Veículo</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Ex: ABC1234"
              className="pl-9 h-9 border-primary/20 focus:border-primary text-xs font-bold uppercase transition-all duration-200 bg-white/50"
              value={searchPlaca}
              onChange={(e) => onSearchPlacaChange(e.target.value)}
            />
          </div>
        </div>

        <SearchableMultiSelect 
          label="Diretoria"
          options={diretoriaOptions}
          selected={selectedDirectorias || []}
          onChange={onDirectoriasChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="Gerência"
          options={gerenciaOptions}
          selected={selectedGerencias || []}
          onChange={onGerenciasChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="Região"
          options={regiaoOptions}
          selected={selectedRegioes || []}
          onChange={onRegioesChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="Cidade"
          options={cidadeOptions}
          selected={selectedCidades || []}
          onChange={onCidadesChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="MÊS/ANO"
          options={monthYearOptions}
          selected={selectedMonthsYears || []}
          onChange={onMonthsYearsChange}
          placeholder="Selecionar..."
        />

        <div className="space-y-1 md:col-span-1 lg:col-span-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1 font-mono tracking-tight text-primary/80">Período Selecionado</label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full justify-start text-left font-normal h-9 px-3 text-xs bg-white/50 border-primary/20 hover:bg-primary/5",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data Inicial"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <span className="text-xs text-muted-foreground font-bold">até</span>
            <div className="flex-1">
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full justify-start text-left font-normal h-9 px-3 text-xs bg-white/50 border-primary/20 hover:bg-primary/5",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data Final"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Row 2: Características Técnicas */}
        <SearchableMultiSelect 
          label="Combustível"
          options={fuelTypeOptions}
          selected={selectedFuelTypes || []}
          onChange={onFuelTypesChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="Modelo"
          options={modelOptions}
          selected={selectedVehicleModels || []}
          onChange={onVehicleModelsChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="Tipo de Ativo"
          options={tipoOptions}
          selected={selectedTipos || []}
          onChange={onTiposChange}
          placeholder="Selecionar..."
        />

        <SearchableMultiSelect 
          label="Controle Autonomia"
          options={autoControleOptions}
          selected={selectedTipoControleAutonomia || []}
          onChange={onTipoControleAutonomiaChange}
          placeholder="Selecionar..."
        />
      </div>

      {/* Filtros de Alerta (Exclusivo para Análise de Desvios) */}
      {onAlertaAutonomiaChange && (
        <div className="pt-4 border-t border-dashed border-primary/20">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 px-1">Filtros de Desvios e Conformidade</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Desvio Autonomia</label>
              <Select onValueChange={(val: string) => handleMultiSelect(selectedAlertaAutonomia, onAlertaAutonomiaChange, val)}>
                <SelectTrigger className="h-9 text-[10px] bg-primary/5">
                  <SelectValue placeholder="Filtrar Alerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALERTA" className="text-xs font-bold text-destructive">Com Alerta</SelectItem>
                  <SelectItem value="OK" className="text-xs font-bold text-success">OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Alerta Capacidade</label>
              <Select onValueChange={(val: string) => handleMultiSelect(selectedAlertaLitros, onAlertaLitrosChange, val)}>
                <SelectTrigger className="h-9 text-[10px] bg-primary/5">
                  <SelectValue placeholder="Filtrar Alerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALERTA" className="text-xs font-bold text-destructive">Excedido</SelectItem>
                  <SelectItem value="OK" className="text-xs font-bold text-success">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Valor/Litro</label>
              <Select onValueChange={(val: string) => handleMultiSelect(selectedAlertaValorLitro, onAlertaValorLitroChange, val)}>
                <SelectTrigger className="h-9 text-[10px] bg-primary/5">
                  <SelectValue placeholder="Filtrar Alerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALERTA" className="text-xs font-bold text-destructive">Desvio Preço</SelectItem>
                  <SelectItem value="OK" className="text-xs font-bold text-success">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Dias Inativo</label>
              <Select onValueChange={(val: string) => handleMultiSelect(selectedAlertaVale, onAlertaValeChange, val)}>
                <SelectTrigger className="h-9 text-[10px] bg-primary/5">
                  <SelectValue placeholder="Filtrar Alerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALERTA" className="text-xs font-bold text-destructive">+5 Dias</SelectItem>
                  <SelectItem value="OK" className="text-xs font-bold text-success">Ativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Item Abast.</label>
              <Select onValueChange={(val: string) => handleMultiSelect(selectedAlertaItem, onAlertaItemChange, val)}>
                <SelectTrigger className="h-9 text-[10px] bg-primary/5">
                  <SelectValue placeholder="Filtrar Alerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Outros" className="text-xs font-bold text-destructive">Diferente</SelectItem>
                  <SelectItem value="Abastecimento" className="text-xs font-bold text-success">Padrão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Análise Nexus BI</label>
              <Select onValueChange={(val: string) => handleMultiSelect(selectedParecerNexus, onParecerNexusChange, val)}>
                <SelectTrigger className="h-9 text-[10px] bg-primary/5">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Analisado" className="text-xs">Analisado</SelectItem>
                  <SelectItem value="Pendente" className="text-xs">Pendente</SelectItem>
                  <SelectItem value="Justificado" className="text-xs">Justificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Badges para filtros ativos */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        {selectedGerencias?.map((g: string) => (
          <Badge key={g} variant="secondary" className="gap-1 px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
            Gerência: {g}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedGerencias, onGerenciasChange, g)} />
          </Badge>
        ))}
        {selectedFuelTypes?.map((t: string) => (
          <Badge key={t} variant="secondary" className="gap-1 px-3 py-1 bg-slate-100 text-slate-700">
            Comb: {t}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedFuelTypes, onFuelTypesChange, t)} />
          </Badge>
        ))}
        {selectedDirectorias?.map((d: string) => (
          <Badge key={d} variant="secondary" className="gap-1 px-3 py-1 bg-slate-100 text-slate-700">
            Dir: {d}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedDirectorias, onDirectoriasChange, d)} />
          </Badge>
        ))}
        {selectedVehicleModels?.map((m: string) => (
          <Badge key={m} variant="secondary" className="gap-1 px-3 py-1 bg-slate-100 text-slate-700">
            Mod: {m}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedVehicleModels, onVehicleModelsChange, m)} />
          </Badge>
        ))}
        {selectedTipos?.map((t: string) => (
          <Badge key={t} variant="secondary" className="gap-1 px-3 py-1 bg-slate-100 text-slate-700">
            Tipo: {t}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedTipos, onTiposChange, t)} />
          </Badge>
        ))}
        {selectedMonthsYears?.map((m: string) => (
          <Badge key={m} variant="secondary" className="gap-1 px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
            MÊS: {m}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedMonthsYears, onMonthsYearsChange, m)} />
          </Badge>
        ))}
        {selectedRegioes?.map((r: string) => (
          <Badge key={r} variant="secondary" className="gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-200">
            Região: {r}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedRegioes, onRegioesChange, r)} />
          </Badge>
        ))}
        {selectedCidades?.map((c: string) => (
          <Badge key={c} variant="secondary" className="gap-1 px-3 py-1 bg-teal-50 text-teal-700 border-teal-200">
            Cidade: {c}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedCidades, onCidadesChange, c)} />
          </Badge>
        ))}
        {selectedTipoControleAutonomia?.map((c: string) => (
          <Badge key={c} variant="secondary" className="gap-1 px-3 py-1 bg-slate-100 text-slate-700">
            Auto: {c}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedTipoControleAutonomia, onTipoControleAutonomiaChange, c)} />
          </Badge>
        ))}
        {selectedAlertaAutonomia?.length > 0 && selectedAlertaAutonomia.map((v: string) => (
          <Badge key={v} variant="destructive" className="gap-1 px-3 py-1">
            Alerta Aut.: {v}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedAlertaAutonomia, onAlertaAutonomiaChange, v)} />
          </Badge>
        ))}
        {selectedAlertaLitros?.length > 0 && selectedAlertaLitros.map((v: string) => (
          <Badge key={v} variant="destructive" className="gap-1 px-3 py-1">
            Alerta Cap.: {v}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedAlertaLitros, onAlertaLitrosChange, v)} />
          </Badge>
        ))}
        {selectedAlertaValorLitro?.length > 0 && selectedAlertaValorLitro.map((v: string) => (
          <Badge key={v} variant="destructive" className="gap-1 px-3 py-1">
            Preço: {v}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedAlertaValorLitro, onAlertaValorLitroChange, v)} />
          </Badge>
        ))}
        {selectedAlertaItem?.length > 0 && selectedAlertaItem.map((v: string) => (
          <Badge key={v} variant="outline" className="gap-1 px-3 py-1 border-destructive text-destructive">
            Item: {v}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedAlertaItem, onAlertaItemChange, v)} />
          </Badge>
        ))}
        {selectedParecerNexus?.length > 0 && selectedParecerNexus.map((v: string) => (
          <Badge key={v} variant="outline" className="gap-1 px-3 py-1 border-primary text-primary">
            Nexus: {v}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(selectedParecerNexus, onParecerNexusChange, v)} />
          </Badge>
        ))}
        {(dateFrom || dateTo) && (
          <Badge variant="secondary" className="gap-1 px-3 py-1 bg-amber-50 text-amber-700 border-amber-200">
            Período: {dateFrom ? format(dateFrom, "dd/MM") : "?"} até {dateTo ? format(dateTo, "dd/MM") : "?"}
            <X className="h-3 w-3 cursor-pointer" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} />
          </Badge>
        )}
      </div>
    </Card>
  );
};
