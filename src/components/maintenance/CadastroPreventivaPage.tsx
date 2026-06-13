import { useState, useMemo, useEffect } from "react";
import { useAssets, useFuelData } from "@/hooks/useFleetData";
import { usePreventiveLocadosData } from "@/hooks/usePreventiveLocadosData";
import { useFirebasePreventivas, FirebasePreventiveData } from "@/hooks/useFirebasePreventivas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wrench, Search, Save, Check, Fuel, ArrowLeft, RefreshCw, AlertCircle, Sparkles, LogOut } from "lucide-react";
import { auth } from "../../lib/firebase";
import { toast } from "sonner";

interface CadastroPreventivaPageProps {
  onBack?: () => void;
  hideBackButton?: boolean;
}

const LOCADORAS = [
  "CS BRASIL",
  "LOCSERV",
  "LOCADORA CAXANGA",
  "LOCAVEL",
  "PBF GRAFICA"
];

const REVISAO_OPCOES = [1000, 5000, 10000];

export default function CadastroPreventivaPage({ onBack, hideBackButton = false }: CadastroPreventivaPageProps) {
  const [selectedLocadora, setSelectedLocadora] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();
  const { data: fuel = [], isLoading: isLoadingFuel } = useFuelData();
  const { data: sheetPreventivas = [] } = usePreventiveLocadosData();
  const { data: rawFirebasePreventivas = {}, save, refetch: refetchFirebase } = useFirebasePreventivas();
  const firebasePreventivas = useMemo(() => rawFirebasePreventivas as Record<string, FirebasePreventiveData>, [rawFirebasePreventivas]);

  // Local editing states to avoid updating Firestore on every key stroke
  const [editedRows, setEditedRows] = useState<Record<string, {
    odometroRevisao: string;
    revisaoPrevista: string;
    dataRevisao: string;
  }>>({});

  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  // Get active vehicle odometers
  const latestOdometersMap = useMemo(() => {
    const map = new Map<string, number>();
    const platesInFuelWithoutDate = new Map<string, any[]>();
    
    fuel.forEach(f => {
      const placa = String(f.PLACA || f.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      if (placa) {
        if (!platesInFuelWithoutDate.has(placa)) {
          platesInFuelWithoutDate.set(placa, []);
        }
        platesInFuelWithoutDate.get(placa)!.push(f);
      }
    });

    platesInFuelWithoutDate.forEach((transactions, placa) => {
      let lastOdo = 0;
      let lastDateForOdo: Date | null = null;
      transactions.forEach(f => {
        let d: Date | null = null;
        if (f._date) {
          if (f._date instanceof Date) {
            d = f._date;
          } else {
            const parsed = new Date(f._date);
            if (!isNaN(parsed.getTime())) d = parsed;
          }
        }
        const odo = Number(f._odometer || 0);
        if (odo > 0) {
          if (!lastDateForOdo || (d && d > lastDateForOdo)) {
            if (d) lastDateForOdo = d;
            lastOdo = odo;
          }
        }
      });

      if (lastOdo === 0 && transactions.length > 0) {
        lastOdo = Math.max(...transactions.map(f => Number(f._odometer || 0)));
      }

      map.set(placa, lastOdo);
    });

    return map;
  }, [fuel]);

  // Combine locados list matching locadora and titularity (TITULAR/RESERVA)
  const locadoraVehicles = useMemo(() => {
    if (!selectedLocadora) return [];

    return assets.filter(asset => {
      const prop = String(asset.PROPRIEDADE || asset.propriedade || "").toUpperCase().trim();
      const target = selectedLocadora.toUpperCase().trim();
      
      const isPropMatch = prop === target || prop.includes(target) || target.includes(prop);
      if (!isPropMatch) return false;

      const tit = String(asset.TITULARIDADE || asset.titularidade || "").toUpperCase().trim();
      const isTitleMatch = tit === "TITULAR" || tit === "RESERVA";

      return isTitleMatch;
    });
  }, [assets, selectedLocadora]);

  // Initialize editedRows with firebase values or original sheet data
  useEffect(() => {
    if (locadoraVehicles.length === 0) return;

    const initialRows: typeof editedRows = {};
    locadoraVehicles.forEach(vehicle => {
      const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      
      const firebaseRecord = firebasePreventivas[placa];
      const sheetRecord = sheetPreventivas.find(p => p.placa.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim() === placa);

      const savedOdo = firebaseRecord ? String(firebaseRecord.odometroRevisao) : (sheetRecord ? String(sheetRecord.odometroRevisao) : "");
      const savedPrev = firebaseRecord ? String(firebaseRecord.revisaoPrevista) : (sheetRecord ? String(sheetRecord.revisaoPrevista) : "10000");
      const savedDate = firebaseRecord ? firebaseRecord.dataRevisao : (sheetRecord ? sheetRecord.dataRevisao : "");

      // Date conversion helper if sheet dates are dd/mm/yyyy
      let formattedDate = savedDate;
      if (savedDate && savedDate.includes("/")) {
        const parts = savedDate.split("/");
        if (parts.length === 3) {
          // Format from DD/MM/YYYY to YYYY-MM-DD
          formattedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      initialRows[placa] = {
        odometroRevisao: savedOdo,
        revisaoPrevista: savedPrev,
        dataRevisao: formattedDate,
      };
    });

    setEditedRows(initialRows);
  }, [locadoraVehicles, firebasePreventivas, sheetPreventivas]);

  // Handle cell changes
  const handleCellChange = (placa: string, field: "odometroRevisao" | "revisaoPrevista" | "dataRevisao", value: string) => {
    setEditedRows(prev => ({
      ...prev,
      [placa]: {
        ...(prev[placa] || { odometroRevisao: "", revisaoPrevista: "10000", dataRevisao: "" }),
        [field]: value
      }
    }));
  };

  // Save single row
  const handleSaveRow = async (placa: string) => {
    const row = editedRows[placa];
    if (!row) return;

    const odoRev = Number(row.odometroRevisao);
    const revPrev = Number(row.revisaoPrevista);
    const dataRev = row.dataRevisao;

    if (!row.odometroRevisao || isNaN(odoRev) || odoRev < 0) {
      toast.error(`Por favor, preencha o Odômetro da Revisão corretamente para a placa ${placa}.`);
      return;
    }

    if (!row.dataRevisao) {
      toast.error(`Por favor, selecione a Data da Revisão para a placa ${placa}.`);
      return;
    }

    setSavingRows(prev => ({ ...prev, [placa]: true }));

    try {
      await save({
        placa,
        odometroRevisao: odoRev,
        revisaoPrevista: revPrev,
        dataRevisao: dataRev,
        locadora: selectedLocadora,
      });
      toast.success(`Dados da placa ${placa} salvos com sucesso!`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao salvar dados da placa ${placa}.`);
    } finally {
      setSavingRows(prev => ({ ...prev, [placa]: false }));
    }
  };

  // Save all changed rows
  const handleSaveAll = async () => {
    const promises = Object.entries(editedRows).map(async ([placa, rawRow]) => {
      const row = rawRow as { odometroRevisao: string; revisaoPrevista: string; dataRevisao: string; };
      const odoRev = Number(row.odometroRevisao);
      const revPrev = Number(row.revisaoPrevista);
      const dataRev = row.dataRevisao;

      // Skip rows that haven't been completely filled out or matched
      if (!row.odometroRevisao || isNaN(odoRev) || !row.dataRevisao) {
        return;
      }

      // Check if it is different from already saved in Firestore to save writes
      const currentFirebase = firebasePreventivas[placa];
      if (
        currentFirebase &&
        currentFirebase.odometroRevisao === odoRev &&
        currentFirebase.revisaoPrevista === revPrev &&
        currentFirebase.dataRevisao === dataRev
      ) {
        return;
      }

      try {
        await save({
          placa,
          odometroRevisao: odoRev,
          revisaoPrevista: revPrev,
          dataRevisao: dataRev,
          locadora: selectedLocadora,
        });
      } catch (err) {
        console.error(`Erro ao salvar placa ${placa}:`, err);
      }
    });

    toast.promise(Promise.all(promises), {
      loading: "Salvando todos os registros...",
      success: "Revisões salvas com sucesso!",
      error: "Erro parcial ao salvar alguns registros.",
    });
  };

  // Filter vehicles by search term
  const filteredVehicles = useMemo(() => {
    return locadoraVehicles.filter(v => {
      const placa = String(v.PLACA || v.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
      const cleanSearch = searchTerm.toUpperCase().replace(/[^A-Z0-9]/gi, "");
      return placa.includes(cleanSearch);
    });
  }, [locadoraVehicles, searchTerm]);

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-950/20 min-h-screen py-8 px-4 md:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Wrench size={18} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
              Controle Preventivo Locadoras
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Preenchimento de odômetros de revisão e agendamento preventivo de frotas locadas.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchFirebase()}
            className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-indigo-600 bg-white"
          >
            <RefreshCw size={14} className="mr-1.5" /> Atualizar
          </Button>

          {onBack && !hideBackButton && (
            <Button
              onClick={onBack}
              variant="outline"
              size="sm"
              className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
            >
              <ArrowLeft size={14} className="mr-1.5" /> Voltar
            </Button>
          )}

          {auth.currentUser && (
            <Button
              onClick={() => auth.signOut()}
              variant="outline"
              size="sm"
              className="text-[10px] uppercase font-black tracking-widest text-rose-500 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:hover:bg-rose-950/20"
            >
              <LogOut size={14} className="mr-1.5" /> Sair
            </Button>
          )}
        </div>
      </div>

      {/* Select Locadora Card */}
      <Card className="border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Acesso Locadora
          </CardTitle>
          <CardDescription className="text-xs">
            Selecione a locadora para exibir e preencher os dados preventivos da sua respectiva frota.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-md">
            <Select value={selectedLocadora} onValueChange={setSelectedLocadora}>
              <SelectTrigger className="w-full text-sm font-medium">
                <SelectValue placeholder="Selecione sua Locadora..." />
              </SelectTrigger>
              <SelectContent>
                {LOCADORAS.map((locadora) => (
                  <SelectItem key={locadora} value={locadora}>
                    {locadora}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table Card */}
      {selectedLocadora ? (
        <Card className="border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between py-6 gap-4">
            <div>
              <CardTitle className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Fé de Veículos - {selectedLocadora}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Lançamento das revisões da frota de titularidade <strong className="text-indigo-600">TITULAR</strong> ou <strong className="text-indigo-600">RESERVA</strong>.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar Placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Button
                onClick={handleSaveAll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center transition-all h-9"
              >
                <Save size={16} className="mr-1.5" /> Salvar Tudo
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoadingAssets || isLoadingFuel ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Carregando frota de veículos...</p>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                <AlertCircle className="w-12 h-12 text-slate-300" />
                <p className="font-extrabold uppercase text-sm">Nenhum veículo encontrado</p>
                <p className="text-xs text-slate-400">Revise o termo de busca ou verifique se há veículos cadastrados para esta locadora.</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] w-full">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[140px]">Placa</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Data Revisão</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[140px]">Odômetro Revisão</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[140px]">Revisão Prevista</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[150px]">Odo Próxima Revisão</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Odo Atual</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Odo Restante</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[100px]">Status</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Diretoria / Gerência</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Modelo / Marca</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[80px]">Salvar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle) => {
                      const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
                      const state = editedRows[placa] || { odometroRevisao: "", revisaoPrevista: "10000", dataRevisao: "" };
                      
                      // Calculate reactive fields
                      const odometroRevisaoNum = Number(state.odometroRevisao || 0);
                      const revisaoPrevistaNum = Number(state.revisaoPrevista || 10000);
                      const odometroProximaRevisao = odometroRevisaoNum + revisaoPrevistaNum;
                      
                      const odometroAtual = latestOdometersMap.get(placa) || 0;
                      const odometroRestante = state.odometroRevisao ? (odometroProximaRevisao - odometroAtual) : 0;
                      
                      const isOverdue = odometroRestante < 0;
                      const status = state.odometroRevisao ? (isOverdue ? "Pendente" : "Em Dia") : "Não Iniciada";

                      // Vehicle details
                      const model = String(vehicle.MODELO || vehicle.modelo || "N/A").trim();
                      const brand = String(vehicle.MARCA || vehicle.marca || "N/A").trim();
                      const dir = String(vehicle.DIRETORIA || vehicle.diretoria || "N/A").trim();
                      const ger = String(vehicle.GERENCIA || vehicle["GERÊNCIA"] || vehicle.gerencia || "N/A").trim();

                      return (
                        <TableRow key={placa} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                          {/* Placa */}
                          <TableCell className="text-center font-black text-xs text-slate-800 dark:text-slate-200">
                            <span className="bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded text-indigo-600 border border-indigo-100 dark:border-indigo-900/30 font-mono">
                              {placa}
                            </span>
                          </TableCell>

                          {/* Data Revisão */}
                          <TableCell className="text-center">
                            <Input
                              type="date"
                              value={state.dataRevisao}
                              onChange={(e) => handleCellChange(placa, "dataRevisao", e.target.value)}
                              className="h-8 py-1 px-1.5 text-xs text-center font-medium placeholder-slate-300"
                            />
                          </TableCell>

                          {/* Odômetro Revisão */}
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0"
                              placeholder="Último Odo"
                              value={state.odometroRevisao}
                              onChange={(e) => handleCellChange(placa, "odometroRevisao", e.target.value)}
                              className="h-8 py-1 px-2 text-xs text-center font-bold"
                            />
                          </TableCell>

                          {/* Revisão Prevista */}
                          <TableCell className="text-center">
                            <Select
                              value={state.revisaoPrevista}
                              onValueChange={(val) => handleCellChange(placa, "revisaoPrevista", val)}
                            >
                              <SelectTrigger className="h-8 text-xs font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {REVISAO_OPCOES.map(op => (
                                  <SelectItem key={op} value={String(op)}>
                                    {op.toLocaleString()} km
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Odômetro Próxima Revisão */}
                          <TableCell className="text-center font-extrabold text-xs text-slate-700 dark:text-slate-300">
                            {state.odometroRevisao ? odometroProximaRevisao.toLocaleString() : "-"}
                          </TableCell>

                          {/* Odômetro Atual */}
                          <TableCell className="text-center font-bold text-xs text-slate-600 dark:text-slate-400">
                            {odometroAtual > 0 ? odometroAtual.toLocaleString() : "0"}
                          </TableCell>

                          {/* Odômetro Restante */}
                          <TableCell className={`text-center font-extrabold text-xs ${isOverdue ? "text-rose-500" : "text-emerald-500"}`}>
                            {state.odometroRevisao 
                              ? `${odometroRestante > 0 ? "+" : ""}${odometroRestante.toLocaleString()}`
                              : "-"
                            }
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center">
                            {state.odometroRevisao ? (
                              <Badge variant={isOverdue ? "destructive" : "success"} className="text-[10px] font-black uppercase text-center">
                                {status}
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-400 text-white hover:bg-slate-400 text-[10px] font-black uppercase text-center">
                                Pendente Dados
                              </Badge>
                            )}
                          </TableCell>

                          {/* Diretoria / Gerência */}
                          <TableCell className="text-xs truncate max-w-[200px]">
                            <p className="font-extrabold text-slate-700 dark:text-slate-300 truncate uppercase leading-tight">{dir}</p>
                            <p className="text-[10px] text-slate-400 truncate uppercase mt-0.5">{ger}</p>
                          </TableCell>

                          {/* Modelo / Marca */}
                          <TableCell className="text-xs truncate max-w-[150px]">
                            <p className="font-extrabold text-slate-700 dark:text-slate-300 truncate uppercase leading-tight">{model}</p>
                            <p className="text-[10px] text-slate-400 truncate uppercase mt-0.5">{brand}</p>
                          </TableCell>

                          {/* Acciones */}
                          <TableCell className="text-center">
                            <Button
                              onClick={() => handleSaveRow(placa)}
                              disabled={savingRows[placa]}
                              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1.5 h-7 w-7 rounded-lg transition-all"
                            >
                              {savingRows[placa] ? (
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Check size={14} />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
            <Sparkles size={32} />
          </div>
          <p className="font-black uppercase text-slate-600 dark:text-slate-200">Aguardando Seleção de Locadora</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Selecione uma locadora no menu acima para gerenciar, editar, agendar e atualizar as revisões preventiva da frota correspondente.
          </p>
        </div>
      )}
    </div>
  );
}
