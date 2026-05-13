import React, { useState, useMemo } from 'react';
import { useAssets, useFuelData } from '@/hooks/useFleetData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Calculator, FileText, Download, ChevronLeft, Building2, UserCircle, MapPin, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { exportToExcel } from "@/lib/exportToExcel";
import { toast } from "sonner";

interface EstimationState {
  [placa: string]: string;
}

export default function ExtraCreditEstimation({ onBack }: { onBack: () => void }) {
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { data: fuelItems = [], isLoading: loadingFuel } = useFuelData();

  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("all");
  const [selectedGerencia, setSelectedGerencia] = useState<string>("all");
  const [selectedCities, setSelectedCities] = useState<Record<string, string>>({});
  const [estimations, setEstimations] = useState<EstimationState>({});

  // Helper functions from FuelDashboardsPage patterns
  const parseNum = (val: any) => {
    if (val === null || val === undefined || String(val).trim() === "") return 0;
    const cleaned = String(val).replace(/[^\d.,-]/g, '').replace(',', '.');
    const res = parseFloat(cleaned);
    return isNaN(res) ? 0 : res;
  };

  const getValByIndex = (obj: any, index: number) => {
    if (obj.__raw && Array.isArray(obj.__raw)) return obj.__raw[index];
    return obj[`COL_${index}`];
  };

  const normalizeMonthYear = (val: string): string => {
    if (!val) return "N/A";
    const v = val.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (v.includes("jan")) return "Jan/26";
    if (v.includes("fev")) return "Fev/26";
    if (v.includes("mar")) return "Mar/26";
    if (v.includes("abr")) return "Abr/26";
    if (v.includes("mai")) return "Mai/26";
    if (v.includes("jun")) return "Jun/26";
    if (v.includes("jul")) return "Jul/26";
    if (v.includes("ago")) return "Ago/26";
    if (v.includes("set")) return "Set/26";
    if (v.includes("out")) return "Out/26";
    if (v.includes("nov")) return "Nov/26";
    if (v.includes("dez")) return "Dez/26";
    return val.toUpperCase();
  };

  // 1. Get unique filters
  const diretorias = useMemo(() => 
    Array.from(new Set(assets.map(a => a.DIRETORIA || "N/A"))).sort()
  , [assets]);

  const gerencias = useMemo(() => 
    Array.from(new Set(assets
      .filter(a => selectedDiretoria === "all" || (a.DIRETORIA || "N/A") === selectedDiretoria)
      .map(a => a.GERENCIA || a["GERÊNCIA"] || "N/A")
    )).sort()
  , [assets, selectedDiretoria]);

  const allCities = useMemo(() => {
    const c = fuelItems.map(f => String(f["CIDADE"] || f["MUNICIPIO"] || getValByIndex(f, 20) || getValByIndex(f, 22) || "N/A")).filter(v => v !== "N/A");
    return Array.from(new Set(c.map(v => v.toUpperCase()))).sort();
  }, [fuelItems]);

  // Price analysis per city
  const pricesByCityAndType = useMemo(() => {
    const cityMap: Record<string, Record<string, { total: number; count: number }>> = {};
    
    fuelItems.forEach(f => {
      const city = String(f["CIDADE"] || f["MUNICIPIO"] || getValByIndex(f, 20) || getValByIndex(f, 22) || "N/A").toUpperCase();
      if (city === "N/A") return;

      const type = String(f["TIPO COMBUSTIVEL"] || getValByIndex(f, 13) || "OUTROS").toUpperCase();
      const val = parseNum(f["VALOR UNITARIO"] || f["VL/UNITARIO"] || getValByIndex(f, 15));
      
      if (val > 0) {
        if (!cityMap[city]) cityMap[city] = {};
        if (!cityMap[city][type]) cityMap[city][type] = { total: 0, count: 0 };
        cityMap[city][type].total += val;
        cityMap[city][type].count += 1;
      }
    });

    const result: Record<string, Record<string, number>> = {};
    Object.entries(cityMap).forEach(([city, types]) => {
      result[city] = {};
      Object.entries(types).forEach(([type, data]) => {
        result[city][type] = data.total / data.count;
      });
    });
    return result;
  }, [fuelItems]);

  // Global fallbacks for when a city doesn't have a specific fuel type price
  const avgPricesByType = useMemo(() => {
    const prices: Record<string, { total: number; count: number }> = {};
    fuelItems.forEach(f => {
      const type = String(f["TIPO COMBUSTIVEL"] || getValByIndex(f, 13) || "OUTROS").toUpperCase();
      const val = parseNum(f["VALOR UNITARIO"] || f["VL/UNITARIO"] || getValByIndex(f, 15));
      if (val > 0) {
        if (!prices[type]) prices[type] = { total: 0, count: 0 };
        prices[type].total += val;
        prices[type].count += 1;
      }
    });
    const result: Record<string, number> = {};
    Object.entries(prices).forEach(([type, data]) => {
      result[type] = data.total / data.count;
    });
    return result;
  }, [fuelItems]);

  // 2. Identify last 3 months (Relative to May/26)
  const monthOrder = ["Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26", "Jul/26", "Ago/26", "Set/26", "Out/26", "Nov/26", "Dez/26"];
  
  const monthYearOptions = useMemo(() => {
    const months = fuelItems.map(f => normalizeMonthYear(String(f["MÊS/ANO"] || getValByIndex(f, 41) || ""))).filter(m => m !== "N/A");
    const unique = Array.from(new Set(months));
    // Filter out future months (based on metadata May 2026)
    return unique.filter(m => monthOrder.indexOf(m) <= monthOrder.indexOf("Mai/26")).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
  }, [fuelItems]);

  const last3Months = useMemo(() => {
    // We want the 3 months BEFORE the current month (Mai/26) -> Abr, Mar, Fev
    const currentIdx = monthOrder.indexOf("Mai/26");
    if (currentIdx < 3) return monthYearOptions.slice(0, 3);
    const targetMonths = [monthOrder[currentIdx - 1], monthOrder[currentIdx - 2], monthOrder[currentIdx - 3]];
    return targetMonths.reverse().filter(m => monthYearOptions.includes(m));
  }, [monthYearOptions]);

  const globalAvgPrice = useMemo(() => {
    const values = Object.values(avgPricesByType) as number[];
    if (values.length === 0) return 5.50; // Fallback
    return values.reduce((a: number, b: number) => a + b, 0) / values.length;
  }, [avgPricesByType]);

  const pricePeriod = useMemo(() => {
    if (fuelItems.length === 0) return null;
    const dates = fuelItems.map(f => {
      const dStr = f.DATA || f["DATA ABASTECIMENTO"] || getValByIndex(f, 3);
      if (!dStr) return null;
      // Try to parse DD/MM/YYYY
      const parts = String(dStr).split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
      }
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? null : d.getTime();
    }).filter(d => d !== null) as number[];
    
    if (dates.length === 0) return null;
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    return {
      start: min.toLocaleDateString('pt-BR'),
      end: max.toLocaleDateString('pt-BR')
    };
  }, [fuelItems]);

  // 4. Data for the table
  const filteredAssetsData = useMemo(() => {
    if (selectedDiretoria === "all" && selectedGerencia === "all") return [];

    return assets
      .filter(a => {
        const matchesDir = selectedDiretoria === "all" || (a.DIRETORIA || "N/A") === selectedDiretoria;
        const matchesGer = selectedGerencia === "all" || (a.GERENCIA || a["GERÊNCIA"] || "N/A") === selectedGerencia;
        return matchesDir && matchesGer;
      })
      .map(a => {
        const placa = (a.PLACA || "").toUpperCase();
        const assetFuel = fuelItems.filter(f => (f.PLACA || getValByIndex(f, 5) || "").toString().toUpperCase() === placa);
        
        const monthSums: Record<string, number> = {};
        last3Months.forEach(m => {
          const monthTransactions = assetFuel.filter(f => normalizeMonthYear(String(f["MÊS/ANO"] || getValByIndex(f, 41) || "")) === m);
          monthSums[m] = monthTransactions.reduce((sum, f) => sum + parseNum(f["KM RODADOS OU HORAS TRABALHADAS"] || getValByIndex(f, 17)), 0);
        });

        // Autonomies
        const autonomiaPadrao = parseNum(a["AUTONOMIA PADRÃO (KM/LITRO OU HORA/LITRO)"] || a["AUTONOMIA PADRAO"] || getValByIndex(a, 28));
        const autonomiaSecundaria = parseNum(a["AUTONOMIA SECUNDÁRIA"] || a["AUTONOMIA SECUNDARIA"] || getValByIndex(a, 32));
        
        // Fuel Types - Improved extraction
        let combustivelPadrao = String(a["COMBUSTIVEL PRINCIPAL"] || a["COMBUSTIVEL PADRAO"] || a["COMBUSTÍVEL PADRÃO"] || getValByIndex(a, 27) || "N/A").toUpperCase();
        let combustivelSecundario = String(a["COMBUSTIVEL SECUNDARIO"] || a["COMBUSTÍVEL SECUNDÁRIO"] || getValByIndex(a, 31) || "N/A").toUpperCase();

        // If not found in asset, check most recent fuel transaction
        if (combustivelPadrao === "N/A" && assetFuel.length > 0) {
          const lastFuel = assetFuel[assetFuel.length - 1];
          combustivelPadrao = String(lastFuel["TIPO COMBUSTIVEL"] || getValByIndex(lastFuel, 13) || "N/A").toUpperCase();
        }

        return {
          placa,
          diretoria: a.DIRETORIA || "N/A",
          gerencia: a.GERENCIA || a["GERÊNCIA"] || "N/A",
          tipo: a.TIPO || "N/A",
          titularidade: a.TITULARIDADE || a.PROPRIEDADE || "N/A",
          modelo: a.MODELO || "N/A",
          autonomia: autonomiaPadrao,
          autonomiaSecundaria,
          combustivelPadrao,
          combustivelSecundario,
          monthSums
        };
      });
  }, [assets, fuelItems, selectedDiretoria, selectedGerencia, last3Months]);

  const handleInputChange = (placa: string, value: string) => {
    setEstimations(prev => ({ ...prev, [placa]: value }));
  };

  const handleCityChange = (placa: string, city: string) => {
    setSelectedCities(prev => ({ ...prev, [placa]: city }));
  };

  const handleExport = () => {
    const exportData = filteredAssetsData.map(v => {
      const city = selectedCities[v.placa];
      const cityPrices = city ? pricesByCityAndType[city] : null;
      
      const pricePadrao = cityPrices?.[v.combustivelPadrao] || avgPricesByType[v.combustivelPadrao] || globalAvgPrice;
      const sFuel = v.combustivelPadrao === "GNV" ? "ETANOL" : v.combustivelSecundario;
      const priceSecundario = cityPrices?.[sFuel] || avgPricesByType[sFuel] || globalAvgPrice;

      const estimative = parseNum(estimations[v.placa]);
      let estimatedValue = 0;
      
      if (v.combustivelPadrao === "GNV") {
        const costGNV = v.autonomia > 0 ? (estimative / v.autonomia) * pricePadrao : 0;
        const effectiveSecAut = v.autonomiaSecundaria > 0 ? v.autonomiaSecundaria : (v.autonomia * 0.7);
        const costEtanol = effectiveSecAut > 0 ? (estimative / effectiveSecAut) * priceSecundario : 0;
        estimatedValue = costGNV + costEtanol;
      } else {
        estimatedValue = v.autonomia > 0 ? (estimative / v.autonomia) * pricePadrao : 0;
      }
      
      const row: any = {
        "Placa": v.placa,
        "Diretoria": v.diretoria,
        "Gerência": v.gerencia,
        "Cidade de Lotação": city || "Não Selecionada",
        "Tipo": v.tipo,
        "Titularidade": v.titularidade,
        "Modelo": v.modelo,
        "Combustível Padrão": v.combustivelPadrao,
        "Autonomia Padrão": v.autonomia,
        "Combustível Secundário": v.combustivelSecundario,
        "Autonomia Secundária": v.autonomiaSecundaria,
        "Est. Deslocamento/Horas": estimative,
        "Valor Estimado (R$)": estimatedValue.toFixed(2)
      };

      last3Months.forEach(m => {
        row[`Desloc. ${m}`] = v.monthSums[m];
      });

      return row;
    });

    exportToExcel(exportData, `Estimativa_Credito_Extra_${selectedGerencia.replace(/\//g, '_')}`, "Estimativa");
    toast.success("Estimativa exportada com sucesso!");
  };

  if (loadingAssets || loadingFuel) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 italic">Sincronizando Dados da Frota...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="ghost" size="icon" className="rounded-2xl hover:bg-white transition-all shadow-sm border border-slate-200">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
              Estimativa de Crédito Extra
            </h1>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Cálculo baseado em autonomia e histórico de deslocamento
              </p>
              {pricePeriod && (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Base de Preços: {pricePeriod.start} até {pricePeriod.end}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {filteredAssetsData.length > 0 && (
          <Button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-100">
            <Download className="h-4 w-4" />
            Exportar Estimativa
          </Button>
        )}
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Building2 size={12} className="text-indigo-500" />
                Diretoria
              </Label>
              <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
                <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-none shadow-inner font-bold text-slate-700">
                  <SelectValue placeholder="Selecione a Diretoria" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="all">Todas as Diretorias</SelectItem>
                  {diretorias.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <UserCircle size={12} className="text-indigo-500" />
                Gerência
              </Label>
              <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-none shadow-inner font-bold text-slate-700">
                  <SelectValue placeholder="Selecione a Gerência" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="all">Todas as Gerências</SelectItem>
                  {gerencias.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {(selectedDiretoria === "all" && selectedGerencia === "all") ? (
            <div className="p-20 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                  <Search className="w-10 h-10 text-slate-300" />
                </div>
              </div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Inicie sua estimativa</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Selecione uma Diretoria ou Gerência para visualizar a lista de ativos
              </p>
            </div>
          ) : filteredAssetsData.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum ativo encontrado para os filtros selecionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 px-6">Ativo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Cidade de Lotação</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Especificações & Combustível</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-center bg-indigo-50/30">Histo. Deslocamento (Últ. 3 Meses)</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-center bg-amber-50/30">Estimativa Manual</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-right px-6 bg-slate-100/30 font-black">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-end gap-2 cursor-help">
                              Cálculo Estimado
                              <Info size={12} className="text-slate-400" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-none p-6 rounded-[2rem] shadow-2xl max-w-sm">
                            <div className="space-y-4 text-[10px]">
                              <p className="font-black uppercase tracking-widest border-b border-white/10 pb-2 mb-3 text-indigo-400 text-xs">Metodologia de Cálculo CGF</p>
                              
                              <div className="space-y-2">
                                <p className="font-bold uppercase tracking-tight text-white/90">Sistemas Flex/Diesel/Gasolina:</p>
                                <p className="leading-relaxed opacity-80">Calculamos o consumo dividindo o <span className="text-amber-400">Deslocamento Estimado</span> pela <span className="text-indigo-400">Autonomia Padrão</span> do Ativo. O resultado é multiplicado pelo <span className="text-emerald-400">Preço Médio</span> do combustível principal na data/cidade selecionada.</p>
                                <div className="bg-white/5 p-3 rounded-xl font-mono text-[9px] border border-white/10 italic text-center">
                                  Custo = (Distância / Autonomia) × Preço
                                </div>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-white/10">
                                <p className="font-bold uppercase tracking-tight text-amber-400">Sistemas com Kit GNV:</p>
                                <p className="leading-relaxed opacity-80">Para veículos GNV, somamos o consumo de GNV + Etanol (70% da autonomia do GNV) para garantir a partida e lubrificação do sistema, conforme normas técnicas.</p>
                                <div className="bg-white/5 p-3 rounded-xl font-mono text-[9px] border border-white/10 italic text-center">
                                  Custo Total = (Gasto GNV) + (Gasto Etanol)
                                </div>
                              </div>

                              <p className="text-[9px] font-bold text-slate-500 pt-2 italic">
                                * Os preços são baseados na consulta mais recente do histórico de abastecimentos da Compesa.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssetsData.map(v => {
                    const estimativeValue = estimations[v.placa] || "";
                    const estimativeNum = parseNum(estimativeValue);
                    
                    const city = selectedCities[v.placa];
                    const cityPrices = city ? pricesByCityAndType[city] : null;

                    const pricePadrao = cityPrices?.[v.combustivelPadrao] || avgPricesByType[v.combustivelPadrao] || globalAvgPrice;
                    
                    // For GNV logic, explicitly determine ethanol price if needed
                    const secondaryFuel = v.combustivelPadrao === "GNV" ? "ETANOL" : v.combustivelSecundario;
                    const priceSecundario = cityPrices?.[secondaryFuel] || avgPricesByType[secondaryFuel] || globalAvgPrice;

                    let calculatedBRL = 0;
                    let formulaLabel = "";

                    if (v.combustivelPadrao === "GNV") {
                      // Sum GNV cost + ETANOL cost as requested
                      const costGNV = v.autonomia > 0 ? (estimativeNum / v.autonomia) * pricePadrao : 0;
                      // Use autonomiaSecundaria for ethanol if available, else same as autonomia or some default
                      const effectiveSecAutonomia = v.autonomiaSecundaria > 0 ? v.autonomiaSecundaria : (v.autonomia * 0.7); // Fallback estimate if not provided
                      const costEtanol = effectiveSecAutonomia > 0 ? (estimativeNum / effectiveSecAutonomia) * priceSecundario : 0;
                      
                      calculatedBRL = costGNV + costEtanol;
                      formulaLabel = `(GNV: R$ ${costGNV.toFixed(2)} + ETANOL: R$ ${costEtanol.toFixed(2)})`;
                    } else {
                      calculatedBRL = v.autonomia > 0 ? (estimativeNum / v.autonomia) * pricePadrao : 0;
                    }

                    return (
                      <TableRow key={v.placa} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                        <TableCell className="py-6 px-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-lg font-black tracking-tighter text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">
                              {v.placa}
                            </span>
                            <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-widest border-slate-200 text-slate-400">
                              {v.titularidade}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="py-6">
                          <Select 
                            value={selectedCities[v.placa] || ""} 
                            onValueChange={(val) => handleCityChange(v.placa, val)}
                          >
                            <SelectTrigger className="w-[180px] rounded-xl h-10 font-bold text-[10px] bg-slate-50 border-slate-100 shadow-sm">
                              <SelectValue placeholder="Selecione a Cidade" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {allCities.map(c => (
                                <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        
                        <TableCell className="py-6">
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{v.modelo}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 w-fit">
                                  Principal: {v.combustivelPadrao}
                                </Badge>
                                <span className="text-[8px] font-bold text-slate-400">Autonomia: {v.autonomia}</span>
                              </div>
                              {v.combustivelSecundario !== "N/A" && (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="secondary" className="text-[8px] font-black uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 w-fit">
                                    Secundário: {v.combustivelSecundario}
                                  </Badge>
                                  <span className="text-[8px] font-bold text-slate-400">Autonomia Sec.: {v.autonomiaSecundaria}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-6 bg-indigo-50/10">
                          <div className="flex justify-center gap-3">
                            {last3Months.map(m => (
                              <div key={m} className="flex flex-col items-center gap-1 min-w-[70px]">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m}</span>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {v.monthSums[m].toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[8px] opacity-50">km</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell className="py-6 bg-amber-50/10">
                          <div className="flex flex-col items-center gap-2 max-w-[120px] mx-auto">
                            <div className="relative group/input">
                              <Input
                                value={estimativeValue}
                                onChange={(e) => handleInputChange(v.placa, e.target.value)}
                                placeholder="0.00"
                                className="h-10 rounded-xl text-center font-black border-2 border-amber-100 focus:border-amber-400 bg-white transition-all shadow-sm"
                              />
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-500/70">Desloc/Hrs Est.</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-6 px-6 text-right bg-slate-50/20">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 text-xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400">
                              <span className="text-[10px] mt-1">R$</span>
                              {calculatedBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="flex flex-col items-end">
                               {formulaLabel && <span className="text-[7px] font-black text-amber-600 uppercase mb-0.5">{formulaLabel}</span>}
                               <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 italic">
                                  Preço base ({v.combustivelPadrao}): {pricePadrao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                <Calculator size={10} className="text-slate-300" />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {filteredAssetsData.length > 0 && (
        <div className="flex justify-end gap-8 p-8 bg-indigo-600 rounded-[2rem] text-white shadow-2xl shadow-indigo-200 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Geral Estimativo</span>
            <span className="text-sm font-bold opacity-60">Soma de todos os ativos filtrados</span>
          </div>
          <div className="text-4xl font-black tracking-tighter flex items-center gap-2 italic">
            <span className="text-xl mt-2 not-italic">R$</span>
            {filteredAssetsData.reduce((sum, v) => {
              const estimativeValue = estimations[v.placa] || "0";
              const estimativeNum = parseNum(estimativeValue);
              
              const city = selectedCities[v.placa];
              const cityPrices = city ? pricesByCityAndType[city] : null;
              const pPadrao = cityPrices?.[v.combustivelPadrao] || avgPricesByType[v.combustivelPadrao] || globalAvgPrice;
              
              const sFuel = v.combustivelPadrao === "GNV" ? "ETANOL" : v.combustivelSecundario;
              const pSecundario = cityPrices?.[sFuel] || avgPricesByType[sFuel] || globalAvgPrice;

              let val = 0;
              if (v.combustivelPadrao === "GNV") {
                const costGNV = v.autonomia > 0 ? (estimativeNum / v.autonomia) * pPadrao : 0;
                const effectiveSecAut = v.autonomiaSecundaria > 0 ? v.autonomiaSecundaria : (v.autonomia * 0.7);
                const costEtanol = effectiveSecAut > 0 ? (estimativeNum / effectiveSecAut) * pSecundario : 0;
                val = costGNV + costEtanol;
              } else {
                val = v.autonomia > 0 ? (estimativeNum / v.autonomia) * pPadrao : 0;
              }
              
              return sum + val;
            }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </div>

  );
}
