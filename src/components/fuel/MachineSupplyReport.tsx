import React, { useState, useMemo, useEffect } from "react";
import { useFuelData, useAssets } from "@/hooks/useFleetData";
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
  Calendar as CalendarIcon,
  BarChart2,
  PieChart as PieIcon,
  CheckSquare,
  CreditCard
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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

const MachineSupplyReport = ({ onBack, isEmbedded = false }: { onBack?: () => void; isEmbedded?: boolean }) => {
  const { data: fuel = [], isLoading: loadingFuel } = useFuelData();
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { data: assignments = [], isLoading: loadingAssignments } = useMachineSupplyAssignments();
  const saveAssignment = useSaveMachineAssignment();
  
  // User Authentication & Profile
  const [userName, setUserName] = useState("");
  const [userUnit, setUserUnit] = useState("");
  const [userRole, setUserRole] = useState("Visualizador");
  const [isAccessGranted, setIsAccessGranted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    setCheckingAuth(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserName(currentUser.displayName || currentUser.email || "");
        
        try {
          const profileDoc = await getDoc(doc(db, "users", currentUser.uid));
          let role = "Visualizador";
          let unit = "";
          
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            unit = data.gerencia || data.unidade || data.lotacao || "";
            role = data.role || "Visualizador";
          }
          
          // Master email check override (ensure cgf.compesa@gmail.com is always Master)
          if (currentUser.email === "cgf.compesa@gmail.com") {
            role = "Master";
          }
          
          setUserUnit(unit);
          setUserRole(role);
          
          const roleLower = role.toLowerCase().trim();
          const isGM = roleLower === "master" || 
                       roleLower === "gestão" || 
                       roleLower === "gestao" || 
                       roleLower === "master_cgf" || 
                       roleLower === "coordenador" || 
                       roleLower === "admin";
                       
          if (isGM) {
            // Master / Management profiles bypass unit-locking and get immediate access
            setIsAccessGranted(true);
          } else if (unit) {
            // Regular user with a profile unit gets automatic access
            setIsAccessGranted(true);
          } else {
            // Fallback for custom user/viewer check in localStorage
            const savedUnit = localStorage.getItem("machine_report_unit");
            if (savedUnit) {
              setUserUnit(savedUnit);
              setIsAccessGranted(true);
            }
          }
        } catch (e) {
          console.error("Error fetching profile:", e);
          // Fallback if error occurs
          if (currentUser.email === "cgf.compesa@gmail.com") {
            setUserRole("Master");
            setIsAccessGranted(true);
          }
        }
      } else {
        setIsAccessGranted(false);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Filters State
  const [showCharts, setShowCharts] = useState(true);
  const [dbMetric, setDbMetric] = useState<"litros" | "custo" | "value">("litros");
  const [searchPlaca, setSearchPlaca] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const isGestaoOrMaster = useMemo(() => {
    const roleLower = (userRole || "").toLowerCase().trim();
    return roleLower === "master" || 
           roleLower === "gestão" || 
           roleLower === "gestao" || 
           roleLower === "master_cgf" || 
           roleLower === "coordenador" || 
           roleLower === "admin";
  }, [userRole]);

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
    if (isAccessGranted && userUnit && !isGestaoOrMaster) {
      return [userUnit];
    }
    const units = new Set<string>();
    
    // Use base de ativos (assets) where plate starts with MAQ or GER as requested!
    assets.forEach(a => {
      const placa = String(a.PLACA || "").toUpperCase().trim();
      const isMaqOrGer = placa.startsWith("MAQ") || placa.startsWith("GER");
      if (isMaqOrGer) {
        const u = String(a.GERENCIA || a["GERÊNCIA"] || "").trim();
        if (u && u !== "N/A" && u !== "null" && u !== "undefined") {
          units.add(u);
        }
      }
    });

    // Fallback if assets list is empty/loading
    if (units.size === 0) {
      fuel.forEach(f => {
        const placa = String(f._placa || f.COL_5 || "").toUpperCase().trim();
        const isMaqOrGer = placa.startsWith("MAQ") || placa.startsWith("GER");
        if (isMaqOrGer) {
          const u = String(f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit || "").trim();
          if (u && u !== "N/A" && u !== "null" && u !== "undefined") {
            units.add(u);
          }
        }
      });
    }

    return Array.from(units).sort();
  }, [assets, fuel, isAccessGranted, userUnit, isGestaoOrMaster]);

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

      // Filter by fixed User Unit (from login) - only if they are not GESTÃO/MASTER
      if (isAccessGranted && userUnit && !isGestaoOrMaster) {
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

  // Preenchimento Stats & Graficos
  const fillingStats = useMemo(() => {
    let totalSupply = filteredFuel.length;
    let filledCount = 0;
    let proprioCount = 0;
    let locadoCount = 0;
    
    // Aggregates for custom metric display
    const destinationMap: Record<string, { name: string; litros: number; custo: number; value: number }> = {};
    const propertyMap: Record<string, { name: string; litros: number; custo: number; value: number }> = {};
    const modelMap: Record<string, { name: string; litros: number; custo: number; value: number }> = {};
    const plateMap: Record<string, { name: string; litros: number; custo: number; value: number }> = {};
    const cardMap: Record<string, { name: string; litros: number; custo: number; value: number }> = {};

    filteredFuel.forEach(f => {
      const txId = String(f.COL_0 || f._txId || "");
      const a = assignments.find(as => as.transactionId === txId);
      
      const litres = Number(f._litros !== undefined && f._litros !== null ? f._litros : f.COL_14 || 0);
      const cost = Number(f.COL_19 !== undefined && f.COL_19 !== null && String(f.COL_19).trim() !== "" ? f.COL_19 : f._total || f["VALOR EMISSAO"] || f.VALOR || f.TOTAL || (Number(f.COL_14 || f._litros || 0) * Number(f.COL_15 || f._vlLitro || 0)) || 0);

      const hasAssignment = !!a;
      if (hasAssignment) {
        const hasDest = !!a.machineryDestination;
        const hasModel = !!a.model;
        const hasProperty = !!a.property;
        const hasTomb = !!a.tombamentoNumber;
        if (hasDest || hasModel || hasProperty || hasTomb) {
          filledCount++;
        }
      }

      // 1. Destino Maquinário
      const destString = a?.machineryDestination || "Não Informado";
      const dests = destString.split("; ").map(d => d.trim()).filter(Boolean);
      const weight = dests.length > 0 ? dests.length : 1;
      
      const destList = dests.length > 0 ? dests : ["Não Informado"];
      destList.forEach(dest => {
        const short = optShortener(dest);
        if (!destinationMap[short]) {
          destinationMap[short] = { name: short, litros: 0, custo: 0, value: 0 };
        }
        destinationMap[short].litros += litres / weight;
        destinationMap[short].custo += cost / weight;
        destinationMap[short].value += 1 / weight;
      });

      // 2. Propriedade
      const propString = a?.property || "Não Informado";
      const props = propString.split("; ").map(p => p.trim()).filter(Boolean);
      const propWeight = props.length > 0 ? props.length : 1;
      
      const propList = props.length > 0 ? props : ["Não Informado"];
      propList.forEach(p => {
        let normalized = p.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized === "PROPRIO") {
          normalized = "Próprio";
          proprioCount++;
        } else if (normalized === "LOCADO") {
          normalized = "Locado";
          locadoCount++;
        } else {
          normalized = "Não Informado";
        }

        if (!propertyMap[normalized]) {
          propertyMap[normalized] = { name: normalized, litros: 0, custo: 0, value: 0 };
        }
        propertyMap[normalized].litros += litres / propWeight;
        propertyMap[normalized].custo += cost / propWeight;
        propertyMap[normalized].value += 1 / propWeight;
      });

      // 3. Modelo
      const model = (a?.model || "Não Informado").trim().toUpperCase();
      if (!modelMap[model]) {
        modelMap[model] = { name: model, litros: 0, custo: 0, value: 0 };
      }
      modelMap[model].litros += litres;
      modelMap[model].custo += cost;
      modelMap[model].value += 1;

      // 4. Placa
      const placa = String(f._placa || f.COL_5 || "Desconhecido").toUpperCase().trim();
      if (!plateMap[placa]) {
        plateMap[placa] = { name: placa, litros: 0, custo: 0, value: 0 };
      }
      plateMap[placa].litros += litres;
      plateMap[placa].custo += cost;
      plateMap[placa].value += 1;

      // 5. Cartão MAQ
      const card = String(f.COL_35 || "Não Informado").trim();
      if (!cardMap[card]) {
        cardMap[card] = { name: card, litros: 0, custo: 0, value: 0 };
      }
      cardMap[card].litros += litres;
      cardMap[card].custo += cost;
      cardMap[card].value += 1;
    });

    function optShortener(text: string) {
      if (text.includes("GERADOR PEQUENO PORTE")) return "Gerador Pequeno";
      if (text.includes("GERADOR MÉDIO PORTE") || text.includes("GERADOR MEDIO PORTE")) return "Gerador Médio";
      if (text.includes("GERADOR GRANDE PORTE")) return "Gerador Grande";
      if (text.includes("ROÇADEIRA") || text.includes("ROCADEIRA")) return "Roçadeira";
      if (text.includes("BOMBA SUBMERSA")) return "Bomba Submersa";
      if (text.includes("COMPRESSOR")) return "Compressor";
      if (text.includes("MOTOSERRA")) return "Motoserra";
      if (text.includes("COMPACTADOR")) return "Compactador";
      if (text.includes("CORTADOR(ES) DE GRAMA") || text.includes("CORTADOR DE GRAMA")) return "Cortador de Grama";
      if (text.includes("TORRE DE ILUMINAÇÃO") || text.includes("TORRE DE ILUMINACAO")) return "Torre Iluminação";
      if (text.includes("SOPRADOR DE FOLHAS") || text.includes("SOPRADOR")) return "Soprador Folhas";
      return text;
    }

    const completenessPercentage = totalSupply > 0 ? Math.round((filledCount / totalSupply) * 100) : 0;

    return {
      totalSupply,
      filledCount,
      proprioCount,
      locadoCount,
      completenessPercentage,
      destinationMap,
      propertyMap,
      modelMap,
      plateMap,
      cardMap
    };
  }, [filteredFuel, assignments]);

  const activeDestinationChartData = useMemo(() => {
    return (Object.values(fillingStats.destinationMap || {}) as Array<{ name: string; litros: number; custo: number; value: number }>)
      .map(item => ({
        name: item.name,
        value: Math.round((item[dbMetric] || 0) * 100) / 100
      }))
      .sort((a, b) => b.value - a.value);
  }, [fillingStats, dbMetric]);

  const activeCardChartData = useMemo(() => {
    return (Object.values(fillingStats.cardMap || {}) as Array<{ name: string; litros: number; custo: number; value: number }>)
      .map(item => ({
        name: item.name,
        value: Math.round((item[dbMetric] || 0) * 100) / 100
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [fillingStats, dbMetric]);

  const activePropertyChartData = useMemo(() => {
    return (Object.values(fillingStats.propertyMap || {}) as Array<{ name: string; litros: number; custo: number; value: number }>)
      .map(item => ({
        name: item.name,
        value: Math.round((item[dbMetric] || 0) * 100) / 100
      }))
      .sort((a, b) => b.value - a.value);
  }, [fillingStats, dbMetric]);

  const activePlateChartData = useMemo(() => {
    return (Object.values(fillingStats.plateMap || {}) as Array<{ name: string; litros: number; custo: number; value: number }>)
      .map(item => ({
        name: item.name,
        value: Math.round((item[dbMetric] || 0) * 100) / 100
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [fillingStats, dbMetric]);

  const activeModelChartData = useMemo(() => {
    return (Object.values(fillingStats.modelMap || {}) as Array<{ name: string; litros: number; custo: number; value: number }>)
      .map(item => ({
        name: item.name || "NÃO INFORMADO",
        value: Math.round((item[dbMetric] || 0) * 100) / 100
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [fillingStats, dbMetric]);

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
            {onBack && (
              <div className="text-center pt-4">
                <button 
                  onClick={() => onBack?.()}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-2 mx-auto"
                >
                  <ArrowLeft className="w-3 h-3" /> Voltar ao Sistema
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "space-y-6" : "min-h-screen bg-white dark:bg-slate-950 flex flex-col"}>
      {/* Header */}
      <header className={isEmbedded ? "bg-slate-50/50 dark:bg-slate-900/40 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 z-10 shadow-none mb-6" : "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-50 shadow-sm"}>
        <div className="flex items-center gap-4">
          {!isEmbedded && onBack && (
            <Button onClick={() => onBack?.()} variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Cartões Máquinas e Equipamentos</h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-black uppercase">MAQ / GER</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
              Responsável: <span className="text-slate-600 dark:text-slate-300">{userName}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              Lotação Ativa: <span className="text-slate-600 dark:text-slate-300">{userUnit || "Todas (Master / Gestão)"}</span>
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
          
          {isGestaoOrMaster && (
            <Select 
              value={selectedUnits.length > 0 ? "filtered" : "all"} 
              onValueChange={(val) => val === "all" ? setSelectedUnits([]) : null}
            >
              <SelectTrigger className="h-9 w-[160px] text-xs font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800 border-none shrink-0 border-slate-200">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 opacity-50" />
                  <SelectValue placeholder="Gerência" />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">Todas Gerências</SelectItem>
                {unitOptions.map(u => (
                  <div key={u} className="flex items-center px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-medium" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedUnits.includes(u)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUnits([...selectedUnits, u]);
                        else setSelectedUnits(selectedUnits.filter(x => x !== u));
                      }}
                      className="mr-2 cursor-pointer"
                    />
                    {u}
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
          
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

          {isGestaoOrMaster && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowCharts(!showCharts)}
              className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest border-indigo-200 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-50 dark:bg-slate-850 dark:border-slate-800 dark:text-indigo-400"
            >
              {showCharts ? <PieIcon className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
              {showCharts ? "Ocultar Estatísticas" : "Estatísticas"}
            </Button>
          )}

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
      <main className={isEmbedded ? "space-y-6" : "flex-1 overflow-auto p-4 md:p-6 custom-scrollbar"}>
        {isGestaoOrMaster && showCharts && (
          <div className="mb-6 space-y-6">
            {/* Metric Selector Panel */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Métrica Ativa do Painel de Máquinas
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Selecione para alternar entre Litros, Valor em R$ e Quantidade de abastecimentos</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => setDbMetric("litros")}
                  variant={dbMetric === "litros" ? "default" : "outline"}
                  size="sm"
                  className={`rounded-lg text-[10px] font-black uppercase tracking-wider ${dbMetric === 'litros' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                >
                  Consumo (Litros)
                </Button>
                <Button 
                  onClick={() => setDbMetric("custo")}
                  variant={dbMetric === "custo" ? "default" : "outline"}
                  size="sm"
                  className={`rounded-lg text-[10px] font-black uppercase tracking-wider ${dbMetric === 'custo' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                >
                  Gasto (R$)
                </Button>
                <Button 
                  onClick={() => setDbMetric("value")}
                  variant={dbMetric === "value" ? "default" : "outline"}
                  size="sm"
                  className={`rounded-lg text-[10px] font-black uppercase tracking-wider ${dbMetric === 'value' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                >
                  Nº de Abastecimentos
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Abastecimentos</p>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{fillingStats.totalSupply}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Fuel className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fichas Preenchidas</p>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                      {fillingStats.filledCount} <span className="text-xs text-muted-foreground font-medium">({fillingStats.completenessPercentage}%)</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maquinário Próprio</p>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{fillingStats.proprioCount}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <span className="text-xs font-black">PRP</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maquinário Locado</p>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{fillingStats.locadoCount}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <span className="text-xs font-black">LOC</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart 1: Machinery Destinations */}
              <Card className="border border-slate-100 dark:border-slate-800 col-span-1 lg:col-span-2 bg-white dark:bg-slate-900">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-indigo-500" />
                      Maiores Consumos por Destino Maquinário (Tipos)
                    </span>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[10px] font-black uppercase">
                      Visualizando: {dbMetric === "custo" ? "R$" : dbMetric === "litros" ? "Litros" : "Nº Abastecimentos"}
                    </Badge>
                  </h4>
                  {activeDestinationChartData.length === 0 ? (
                    <div className="h-60 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados de "Destino Maquinário" preenchidos no período.
                    </div>
                  ) : (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activeDestinationChartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} opacity={0.1} />
                          <XAxis type="number" tick={{fontSize: 9}} />
                          <YAxis dataKey="name" type="category" tick={{fontSize: 9, width: 120}} width={120} />
                          <RechartsTooltip 
                            formatter={(v: any) => {
                              const val = Number(v);
                              if (dbMetric === "custo") {
                                return [val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Custo Total"];
                              }
                              if (dbMetric === "litros") {
                                return [`${val.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`, "Consumo Litros"];
                              }
                              return [`${Math.round(val).toLocaleString("pt-BR")} abs.`, "Qtd Abastecimentos"];
                            }}
                            contentStyle={{borderRadius: '12px', fontSize: '10px'}} 
                          />
                          <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={15} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart 2: Property Type */}
              <Card className="border border-slate-100 dark:border-slate-800 col-span-1 bg-white dark:bg-slate-900">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-amber-500" />
                      Tipo de Propriedade (Próprio vs Locado)
                    </span>
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] font-black uppercase">
                      {dbMetric === "custo" ? "R$" : dbMetric === "litros" ? "L" : "Qtd"}
                    </Badge>
                  </h4>
                  {activePropertyChartData.length === 0 ? (
                    <div className="h-60 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados de "Propriedade" vinculados no período.
                    </div>
                  ) : (
                    <div className="h-60 flex flex-col justify-between">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={activePropertyChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {activePropertyChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name === "Próprio" ? "#3b82f6" : "#f59e0b"} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(v: any) => {
                                const val = Number(v);
                                if (dbMetric === "custo") {
                                  return [val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Custo"];
                                }
                                if (dbMetric === "litros") {
                                  return [`${val.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`, "Consumo"];
                                }
                                return [`${Math.round(val).toLocaleString("pt-BR")} abs.`, "Quantidade"];
                              }}
                              contentStyle={{borderRadius: '12px', fontSize: '10px'}} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        {activePropertyChartData.map((item, idx) => (
                          <div key={item.name} className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.name === "Próprio" ? "#3b82f6" : "#f59e0b" }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="text-slate-600 dark:text-slate-300 font-bold">
                              {dbMetric === "custo" 
                                ? item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : dbMetric === "litros"
                                  ? `${item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`
                                  : `${Math.round(item.value).toLocaleString("pt-BR")} abs.`
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Second Charts Row Grid for GESTÃO/MASTER - Card MAQ and Machine Model */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart 3: Top Consumo por Cartão MAQ */}
              <Card className="border border-slate-100 dark:border-slate-800 col-span-1 lg:col-span-2 bg-white dark:bg-slate-900">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-violet-500" />
                      Maiores Consumos por Cartão MAQ
                    </span>
                    <Badge variant="outline" className="bg-violet-50 text-violet-600 border-violet-100 text-[10px] font-black uppercase">
                      Visualizando: {dbMetric === "custo" ? "R$" : dbMetric === "litros" ? "Litros" : "Nº Abastecimentos"}
                    </Badge>
                  </h4>
                  {activeCardChartData.length === 0 ? (
                    <div className="h-60 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados de "Cartão MAQ" preenchidos no período.
                    </div>
                  ) : (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activeCardChartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} opacity={0.1} />
                          <XAxis type="number" tick={{fontSize: 9}} />
                          <YAxis dataKey="name" type="category" tick={{fontSize: 9, width: 120}} width={120} />
                          <RechartsTooltip 
                            formatter={(v: any) => {
                              const val = Number(v);
                              if (dbMetric === "custo") {
                                return [val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Custo Total"];
                              }
                              if (dbMetric === "litros") {
                                return [`${val.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`, "Consumo Litros"];
                              }
                              return [`${Math.round(val).toLocaleString("pt-BR")} abs.`, "Qtd Abastecimentos"];
                            }}
                            contentStyle={{borderRadius: '12px', fontSize: '10px'}} 
                          />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={15} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart 4: Modelos de Máquinas */}
              <Card className="border border-slate-100 dark:border-slate-800 col-span-1 bg-white dark:bg-slate-900">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      Top Modelos de Máquinas
                    </span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-black uppercase">
                      {dbMetric === "custo" ? "R$" : dbMetric === "litros" ? "L" : "Qtd"}
                    </Badge>
                  </h4>
                  {activeModelChartData.length === 0 ? (
                    <div className="h-60 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados de "Modelo" preenchidos no período.
                    </div>
                  ) : (
                    <div className="h-60 flex flex-col justify-between">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={activeModelChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {activeModelChartData.map((entry, index) => {
                                const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(v: any) => {
                                const val = Number(v);
                                if (dbMetric === "custo") {
                                  return [val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Custo"];
                                }
                                if (dbMetric === "litros") {
                                  return [`${val.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`, "Consumo"];
                                }
                                return [`${Math.round(val).toLocaleString("pt-BR")} abs.`, "Quantidade"];
                              }}
                              contentStyle={{borderRadius: '12px', fontSize: '10px'}} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        {activeModelChartData.slice(0, 3).map((item, idx) => {
                          const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];
                          return (
                            <div key={item.name} className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider font-semibold">
                              <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                                <span className="truncate">{item.name}</span>
                              </div>
                              <span className="text-slate-600 dark:text-slate-300 font-bold">
                                {dbMetric === "custo" 
                                  ? item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                  : dbMetric === "litros"
                                    ? `${item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`
                                    : `${Math.round(item.value).toLocaleString("pt-BR")} abs.`
                                }
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top 5 Plates/Vehicles, Top Cartões MAQ & Models */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Plates */}
              <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-emerald-500" />
                      TOP 5 Equipamentos (Placa)
                    </span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-black uppercase">
                      Equipamento
                    </Badge>
                  </h4>
                  {activePlateChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados no período.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activePlateChartData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-black flex items-center justify-center text-slate-600 dark:text-slate-300">
                              {index + 1}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {dbMetric === "custo" 
                              ? item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : dbMetric === "litros"
                                ? `${item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`
                                : `${Math.round(item.value).toLocaleString("pt-BR")} abs.`
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Cartões MAQ */}
              <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-violet-500" />
                      TOP 5 Cartões MAQ por Consumo
                    </span>
                    <Badge variant="outline" className="bg-violet-50 text-violet-600 border-violet-100 text-[10px] font-black uppercase">
                      Cartão MAQ
                    </Badge>
                  </h4>
                  {activeCardChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados no período.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeCardChartData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-black flex items-center justify-center text-slate-600 dark:text-slate-300">
                              {index + 1}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                            {dbMetric === "custo" 
                              ? item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : dbMetric === "litros"
                                ? `${item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`
                                : `${Math.round(item.value).toLocaleString("pt-BR")} abs.`
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Models */}
              <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      Modelos de Máquinas (Top 5)
                    </span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-black uppercase">
                      Modelo
                    </Badge>
                  </h4>
                  {Object.keys(fillingStats.modelMap).length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      Sem dados no período.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(Object.values(fillingStats.modelMap) as Array<{ name: string; litros: number; custo: number; value: number }>)
                        .map(item => ({
                          name: item.name || "NÃO INFORMADO",
                          value: Math.round((item[dbMetric] || 0) * 100) / 100
                        }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5)
                        .map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-black flex items-center justify-center text-slate-600 dark:text-slate-300">
                                {index + 1}
                              </span>
                              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              {dbMetric === "custo" 
                                ? item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : dbMetric === "litros"
                                  ? `${item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`
                                  : `${Math.round(item.value).toLocaleString("pt-BR")} abs.`
                              }
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

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
      <footer className={isEmbedded ? "bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6" : "bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400"}>
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
