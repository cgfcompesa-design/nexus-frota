import React, { useState, useMemo, useEffect } from "react";
import { useFuelData } from "@/hooks/useFleetData";
import { useMachineSupplyAssignments, useSaveMachineAssignment } from "@/hooks/useMachineSupplyAssignments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Fuel, 
  ArrowLeft, 
  Search, 
  User, 
  Building2, 
  CheckCircle2, 
  Loader2,
  FilterX,
  ChevronDown,
  Calendar as CalendarIcon
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { exportToExcel } from "@/lib/exportToExcel";

const MACHINERY_OPTIONS = [
  "GERADOR PEQUENO PORTE (ATÉ 15 KVA)",
  "GERADOR MÉDIO PORTE (DE 15 ATÉ 75 KVA)",
  "GERADOR GRANDE PORTE (75 ATÉ 500 KVA)",
  "ROÇADEIRA(S)",
  "BOMBA SUBMERSA",
  "COMPRESSOR(ES)",
  "MOTOSERRA(S)",
  "COMPACTADOR(ES)",
  "CORTADOR(ES) DE GRAMA",
  "TORRE DE ILUMINAÇÃO",
  "SOPRADOR DE FOLHAS"
];

const PROPERTY_OPTIONS = ["PRÓPRIO", "LOCADO"];

const MachineSupplyReport = ({ onBack }: { onBack: () => void }) => {
  const { data: fuel = [], isLoading: loadingFuel } = useFuelData();
  const { data: assignments = [], isLoading: loadingAssignments } = useMachineSupplyAssignments();
  const saveAssignment = useSaveMachineAssignment();
  
  // User Authentication & Profile
  const [userName, setUserName] = useState("");
  const [userUnit, setUserUnit] = useState("");
  const [userRole, setUserRole] = useState("Visualizador");
  const [isAccessGranted, setIsAccessGranted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      setCheckingAuth(true);
      const currentUser = auth.currentUser;
      if (currentUser) {
        setUserName(currentUser.displayName || currentUser.email || "");
        
        // Try to fetch unit from profile
        try {
          const profileDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            const unit = data.gerencia || data.unidade || data.lotacao || "";
            const role = data.role || 'Visualizador';
            
            setUserUnit(unit);
            setUserRole(role);
            
            // If user has a unit in profile and is not Master, lock them to it
            if (unit && role !== 'Master') {
              setIsAccessGranted(true);
            }
          } else {
            // Check localStorage for previously saved unit if no profile doc (fallback)
            const savedUnit = localStorage.getItem("machine_report_unit");
            if (savedUnit) {
               setUserUnit(savedUnit);
               setIsAccessGranted(true);
            }
          }
        } catch (e) {
          console.error("Error fetching profile:", e);
        }
      }
      setCheckingAuth(false);
    };
    fetchUserProfile();
  }, []);

  // Filters State
  const [searchPlaca, setSearchPlaca] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const handleAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userUnit) {
      toast.error("Por favor, informe seu nome e unidade.");
      return;
    }
    localStorage.setItem("machine_report_unit", userUnit);
    setIsAccessGranted(true);
    toast.success(`Bem-vindo, ${userName}!`);
  };

  const unitOptions = useMemo(() => {
    if (isAccessGranted && userUnit && userRole !== 'Master') {
      return [userUnit];
    }
    const units = new Set<string>();
    fuel.forEach(f => {
      const u = String(f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit || "").trim();
      if (u && u !== "N/A") units.add(u);
    });
    return Array.from(units).sort();
  }, [fuel, isAccessGranted, userUnit, userRole]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    fuel.forEach(f => {
      const m = String(f.COL_41 || "").trim();
      if (m) months.add(m);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [fuel]);

  const filteredFuel = useMemo(() => {
    // If not matching any MAQ/GER first, return empty to speed up
    return fuel.filter(f => {
      const placa = String(f._placa || f.COL_5 || "").toUpperCase();
      const isMaqOrGer = placa.startsWith("MAQ") || placa.startsWith("GER");
      if (!isMaqOrGer) return false;

      // Filter by fixed User Unit (from login)
      if (isAccessGranted && userUnit) {
        const lotacao = String(f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit || "").trim();
        if (lotacao !== userUnit) return false;
      }

      // Apply UI filters
      if (searchPlaca && !placa.includes(searchPlaca.toUpperCase())) return false;
      
      const unit = String(f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit || "").trim();
      if (selectedUnits.length > 0 && !selectedUnits.includes(unit)) return false;

      const mesAno = String(f.COL_41 || "").trim();
      if (selectedMonths.length > 0 && !selectedMonths.includes(mesAno)) return false;

      const txId = String(f.COL_0 || f._txId || "");
      const assignment = assignments.find(a => a.transactionId === txId);

      if (selectedDestinations.length > 0) {
        if (!assignment || !selectedDestinations.some(d => (assignment.machineryDestination || "").includes(d))) return false;
      }

      if (selectedProperties.length > 0) {
        if (!assignment || !selectedProperties.some(p => (assignment.property || "").includes(p))) return false;
      }

      return true;
    });
  }, [fuel, searchPlaca, selectedUnits, selectedDestinations, selectedProperties, selectedMonths, assignments, userUnit, isAccessGranted]);

  const handleExport = () => {
    try {
      const dataToExport = filteredFuel.map(f => {
        const txId = String(f.COL_0 || f._txId || "");
        const a = assignments.find(as => as.transactionId === txId);
        return {
          'Transação': txId,
          'Data': f._date || f.COL_4,
          'Placa': String(f._placa || f.COL_5).toUpperCase(),
          'Motorista': f._driver || f.COL_11,
          'Combustível': f._fuelType || f.COL_13,
          'Litros': Number(f._litros || f.COL_14),
          'VL/L': Number(f._vlLitro || f.COL_15),
          'Estabelecimento': f._posto || f._establishment || f.COL_21,
          'Endereço': f._endereco || f.COL_23,
          'Bairro': f._bairro || f.COL_24,
          'Cidade': f._cidade || f.COL_25,
          'Lotação': f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit || '',
          'Cartão': f.COL_35,
          'Mês/Ano': f.COL_41,
          'Destino Maquinário': a?.machineryDestination || '',
          'Modelo': a?.model || '',
          'Propriedade': a?.property || '',
          'Tombamento': a?.tombamentoNumber || '',
          'Preenchido Por': a?.userName || '',
          'Unidade Usuário': a?.userUnit || ''
        };
      });

      const fileName = `Relatorio_Maquinas_${new Date().toISOString().split('T')[0]}`;
      exportToExcel(dataToExport, fileName, "Maquinas_Equipamentos");
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar relatório.");
    }
  };

  const handleSave = async (transactionId: string, data: any) => {
    try {
      // Clean up the data to avoid undefined values which Firestore doesn't like
      const sanitizedData = Object.entries(data).reduce((acc: any, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      }, {});

      await saveAssignment.mutateAsync({
        transactionId,
        userName: userName || "Visitante",
        userUnit: userUnit || "Unidade Não Informada",
        updatedBy: userName || "Visitante",
        ...sanitizedData
      });
      toast.success("Dados salvos!");
    } catch (error: any) {
      console.error("Erro ao salvar atribuição:", error);
      const errorMessage = error?.message || "Erro desconhecido";
      toast.error(`Erro ao salvar: ${errorMessage.includes('permission-denied') ? 'Sem permissão no banco' : errorMessage}`);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAccessGranted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center">
            <Fuel className="w-16 h-16 text-white mx-auto mb-4" />
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">Acesso Relatório</h1>
            <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-2">Maquinário e Equipamentos</p>
          </div>
          <CardContent className="p-8 space-y-6">
            <form onSubmit={handleAccessSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Seu nome" 
                    value={userName} 
                    onChange={(e) => setUserName(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Unidade / Lotação</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                  <Select value={userUnit} onValueChange={setUserUnit} disabled={loadingFuel}>
                    <SelectTrigger className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium text-xs">
                      <SelectValue placeholder={loadingFuel ? "Carregando unidades..." : "Selecione sua lotação"} />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.length > 0 ? (
                        unitOptions.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase italic">
                          {loadingFuel ? "Buscando dados..." : "Nenhuma unidade encontrada"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 transition-all">
                Acessar Relatório
              </Button>
            </form>
            <div className="text-center pt-4">
              <button 
                onClick={onBack}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" /> Voltar ao Sistema
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Cartões Máquinas e Equipamentos</h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-black uppercase">MAQ / GER</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
              Responsável: <span className="text-slate-600 dark:text-slate-300">{userName}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              Lotação Ativa: <span className="text-slate-600 dark:text-slate-300">{userUnit}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48 lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input 
              placeholder="Buscar Placa..." 
              value={searchPlaca}
              onChange={(e) => setSearchPlaca(e.target.value)}
              className="pl-8 h-9 text-xs rounded-lg border-slate-200 dark:bg-slate-800"
            />
          </div>
          
          <Select 
            value={selectedMonths.length > 0 ? "filtered" : "all"} 
            onValueChange={(val) => val === "all" ? setSelectedMonths([]) : null}
          >
            <SelectTrigger className="h-9 w-[130px] text-xs font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800 border-none shrink-0 border-slate-200">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-3.5 h-3.5 opacity-50" />
                <SelectValue placeholder="Mês/Ano" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Meses</SelectItem>
              {monthOptions.map(m => (
                <div key={m} className="flex items-center px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-medium" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedMonths.includes(m)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedMonths([...selectedMonths, m]);
                      else setSelectedMonths(selectedMonths.filter(x => x !== m));
                    }}
                    className="mr-2"
                  />
                  {m}
                </div>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setSearchPlaca("");
              setSelectedUnits([]);
              setSelectedDestinations([]);
              setSelectedProperties([]);
              setSelectedMonths([]);
            }}
            className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest border-slate-200"
          >
            <FilterX className="w-3.5 h-3.5" /> Limpar
          </Button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>
          
          <Button 
            onClick={handleExport}
            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] rounded-lg shadow-sm"
          >
            Baixar Planilha
          </Button>
        </div>
      </header>

      {/* Main Table */}
      <main className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto">
          {loadingFuel || loadingAssignments ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando dados...</p>
            </div>
          ) : (
            <Table className="min-w-[1800px]">
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 border-b border-r sticky left-0 z-20 bg-slate-50 dark:bg-slate-800">Cód. Transação</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Data</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Placa</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Motorista</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Combustível</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b text-right">LITROS</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b text-right">VL/L</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b min-w-[200px]">Estabelecimento</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b min-w-[300px]">Endereço / Bairro / Cidade</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Lotação</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Cartão</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b">Mês/Ano</TableHead>
                  
                  {/* Inputs */}
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b bg-indigo-50/50 dark:bg-indigo-900/10 min-w-[250px]">Destino Maquinário</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b bg-indigo-50/50 dark:bg-indigo-900/10 min-w-[150px]">Modelo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b bg-indigo-50/50 dark:bg-indigo-900/10 w-[120px]">Propriedade</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b bg-indigo-50/50 dark:bg-indigo-100/10 min-w-[150px]">Tombamento</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest border-b bg-indigo-50/50 dark:bg-indigo-100/10 text-center w-[60px]">Ok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFuel.map((f, idx) => {
                  const txId = String(f.COL_0 || f._txId || "");
                  const assignment = assignments.find(a => a.transactionId === txId);
                  
                  return (
                    <TableRow key={`${txId}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-[11px] sticky left-0 z-10 bg-white dark:bg-slate-900 border-r">{txId}</TableCell>
                      <TableCell className="text-[10px] whitespace-nowrap">{f._date || f.COL_4}</TableCell>
                      <TableCell className="text-[10px] font-black underline decoration-indigo-200">
                        {String(f._placa || f.COL_5).toUpperCase()}
                      </TableCell>
                      <TableCell className="text-[10px] font-medium truncate max-w-[120px]" title={f._driver || f.COL_11}>{f._driver || f.COL_11}</TableCell>
                      <TableCell className="text-[10px] uppercase font-bold">{f._fuelType || f.COL_13}</TableCell>
                      <TableCell className="text-[10px] font-black text-right">{Number(f._litros || f.COL_14).toLocaleString('pt-BR')}L</TableCell>
                      <TableCell className="text-[10px] font-black text-right">R$ {Number(f._vlLitro || f.COL_15).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                      <TableCell className="text-[10px] truncate max-w-[180px]" title={f._posto || f._establishment || f.COL_21}>{f._posto || f._establishment || f.COL_21}</TableCell>
                      <TableCell className="text-[10px] truncate max-w-[250px]" title={`${f._endereco || f.COL_23 || ''} - ${f._bairro || f.COL_24 || ''} - ${f._cidade || f.COL_25 || ''}`}>
                        {f._endereco || f.COL_23} / {f._bairro || f.COL_24} / {f._cidade || f.COL_25}
                      </TableCell>
                      <TableCell className="text-[10px] uppercase font-bold">{f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit}</TableCell>
                      <TableCell className="text-[10px] font-mono text-slate-400">{f.COL_35 || 'N/A'}</TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-500">{f.COL_41}</TableCell>

                      <TableCell className="bg-indigo-50/20 dark:bg-indigo-900/5">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8 px-2 text-[10px] justify-between font-medium border-slate-200">
                              <span className="truncate">
                                {assignment?.machineryDestination || "Selecionar..."}
                              </span>
                              <ChevronDown className="w-3 h-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-2" align="start">
                            <div className="space-y-1">
                              {MACHINERY_OPTIONS.map(opt => {
                                const currentList = (assignment?.machineryDestination || "").split("; ").filter(Boolean);
                                const isChecked = currentList.includes(opt);
                                return (
                                  <div key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded" onClick={(e) => {
                                    e.stopPropagation();
                                    const newList = isChecked 
                                      ? currentList.filter(x => x !== opt)
                                      : [...currentList, opt];
                                    handleSave(txId, { machineryDestination: newList.join("; ") });
                                  }}>
                                    <Checkbox checked={isChecked} />
                                    <span className="text-[10px] font-medium leading-none">{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="bg-indigo-50/20 dark:bg-indigo-900/5">
                        <Input 
                          defaultValue={assignment?.model}
                          onBlur={(e) => {
                            if (e.target.value !== (assignment?.model || "")) {
                              handleSave(txId, { model: e.target.value });
                            }
                          }}
                          placeholder="Modelo..."
                          className="h-8 text-[10px] rounded-lg border-slate-200"
                        />
                      </TableCell>
                      <TableCell className="bg-indigo-50/20 dark:bg-indigo-900/5">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8 px-2 text-[10px] justify-between font-medium border-slate-200">
                              <span className="truncate">
                                {assignment?.property || "Tipo"}
                              </span>
                              <ChevronDown className="w-3 h-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[150px] p-2" align="start">
                            <div className="space-y-1">
                              {PROPERTY_OPTIONS.map(opt => {
                                const currentList = (assignment?.property || "").split("; ").filter(Boolean);
                                const isChecked = currentList.includes(opt);
                                return (
                                  <div key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded" onClick={(e) => {
                                    e.stopPropagation();
                                    const newList = isChecked 
                                      ? currentList.filter(x => x !== opt)
                                      : [...currentList, opt];
                                    handleSave(txId, { property: newList.join("; ") });
                                  }}>
                                    <Checkbox checked={isChecked} />
                                    <span className="text-[10px] font-medium leading-none">{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="bg-indigo-50/20 dark:bg-indigo-900/5">
                        <Input 
                          defaultValue={assignment?.tombamentoNumber}
                          onBlur={(e) => {
                            const val = e.target.value.toUpperCase();
                            if (val !== (assignment?.tombamentoNumber || "")) {
                              handleSave(txId, { tombamentoNumber: val });
                            }
                          }}
                          placeholder="Número ou SEM TOMBAMENTO"
                          className="h-8 text-[10px] rounded-lg border-slate-200"
                        />
                      </TableCell>
                      <TableCell className="bg-indigo-50/20 dark:bg-indigo-900/5 text-center">
                        {assignment ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-200 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!loadingFuel && filteredFuel.length === 0 && (
            <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
              <Fuel className="w-12 h-12 text-slate-300" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Nenhum abastecimento de MAQ/GER disponível para esta lotação.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <div className="flex items-center gap-4">
          <span>Total: {filteredFuel.length}</span>
          <span className="w-px h-3 bg-slate-300"></span>
          <span>Preenchidos: {assignments.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black">Sistema CGF</Badge>
          <span>Nexus Frota - Maquinário</span>
        </div>
      </footer>
    </div>
  );
};

export default MachineSupplyReport;
