import { useMemo, useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Fuel, 
  AlertCircle, 
  Clock, 
  Truck, 
  Download, 
  Search, 
  History, 
  Calendar, 
  Filter, 
  Users, 
  Mail,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  TrendingDown,
  Send
} from "lucide-react";
import { Asset, FuelData } from "@/types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  LineChart,
  Line
} from "recharts";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";
import { format, parse, isValid, startOfDay, endOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useContactsData } from "@/hooks/useContactsData";
import { useSpecialHoursData } from "@/hooks/useFleetData";
import { CoringaCardsTable } from "./CoringaCardsTable";

interface SupplyPerformanceDashboardProps {
  fuel: FuelData[];
  assets: Asset[];
}

export function SupplyPerformanceDashboard({ fuel, assets }: SupplyPerformanceDashboardProps) {
  const { data: specialHours = [] } = useSpecialHoursData();
  const [searchTermUnknown, setSearchTermUnknown] = useState("");
  const [searchTermTime, setSearchTermTime] = useState("");
  const [selectedTimeRangeFilter, setSelectedTimeRangeFilter] = useState<string>("ALL");
  const [selectedPatternFilter, setSelectedPatternFilter] = useState<string>("ALL");
  const [currentPageUnknown, setCurrentPageUnknown] = useState(1);
  const [currentPageTime, setCurrentPageTime] = useState(1);
  const [currentPageInconsistency, setCurrentPageInconsistency] = useState(1);
  const [isGroupedByUnit, setIsGroupedByUnit] = useState(false);
  const [isInconsistencyGroupedByUnit, setIsInconsistencyGroupedByUnit] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const itemsPerPage = 20;

const rangeLabels: Record<string, string> = {
  "00:00 - 08:00": "Madrugada",
  "08:00 - 11:59": "Manhã",
  "12:00 - 13:00": "Almoço",
  "13:01 - 17:00": "Tarde",
  "17:01 - 23:59": "Noite"
};

  // Estados para o E-mail
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isJustifyDialogOpen, setIsJustifyDialogOpen] = useState(false);
  const [emailGerencia, setEmailGerencia] = useState("");
  const [justifyGerencia, setJustifyGerencia] = useState("");
  const [isInconsistencyEmailDialogOpen, setIsInconsistencyEmailDialogOpen] = useState(false);
  const [isGroupedInconsistencyEmailDialogOpen, setIsGroupedInconsistencyEmailDialogOpen] = useState(false);
  const [groupedInconsistencyGerencia, setGroupedInconsistencyGerencia] = useState("");
  const [inconsistencyGerencia, setInconsistencyGerencia] = useState("");
  const [selectedInconsistency, setSelectedInconsistency] = useState<any>(null);

  // Estados de busca para os seletores de gerência/unidade
  const [searchEmailGerencia, setSearchEmailGerencia] = useState("");
  const [searchJustifyGerencia, setSearchJustifyGerencia] = useState("");
  const [searchInconsistencyGerencia, setSearchInconsistencyGerencia] = useState("");
  const [searchGroupedInconsistencyGerencia, setSearchGroupedInconsistencyGerencia] = useState("");

  // Estados para a Tabela de Postos de Melhor Preço Não Utilizados
  const [unutilizedSelectedRegion, setUnutilizedSelectedRegion] = useState<string>("ALL");
  const [unutilizedSelectedCity, setUnutilizedSelectedCity] = useState<string>("ALL");
  const [unutilizedSelectedStation, setUnutilizedSelectedStation] = useState<string>("ALL");
  const [unutilizedSelectedGestao, setUnutilizedSelectedGestao] = useState<string>("ALL");
  const [unutilizedCurrentPage, setUnutilizedCurrentPage] = useState(1);
  
  const [isUnutilizedDialogOpen, setIsUnutilizedDialogOpen] = useState(false);
  const [selectedUnutilizedRow, setSelectedUnutilizedRow] = useState<any>(null);
  const [selectedUnutilizedGerencia, setSelectedUnutilizedGerencia] = useState<string>("");
  const [searchUnutilizedGerencia, setSearchUnutilizedGerencia] = useState<string>("");

  const { getEmailsByGerencia, contactsData, isLoading: isContactsLoading } = useContactsData();

  // Consolidação da lista de unidades (Ativos + Contatos) de forma normalizada
  const unitList = useMemo(() => {
    const normalize = (s: string) => String(s || "").toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
    const map = new Map<string, string>();
    
    // Prioridade para nomes do cadastro de ativos
    assets.forEach(a => {
      const name = a.GERENCIA || a["GERÊNCIA"];
      if (name) {
        const key = normalize(name);
        if (!map.has(key)) map.set(key, name);
      }
    });
    
    // Complementa com o que houver apenas nos contatos
    (contactsData as any[]).forEach(c => {
      if (c.gerencia) {
        const key = normalize(c.gerencia);
        if (!map.has(key)) map.set(key, c.gerencia);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [assets, contactsData]);

  const normalizeText = (text: string) => {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const filteredEmailUnits = useMemo(() => {
    return (unitList || []).filter(g => normalizeText(g).includes(normalizeText(searchEmailGerencia)));
  }, [unitList, searchEmailGerencia]);

  const filteredJustifyUnits = useMemo(() => {
    return (unitList || []).filter(g => normalizeText(g).includes(normalizeText(searchJustifyGerencia)));
  }, [unitList, searchJustifyGerencia]);

  const filteredInconsistencyUnits = useMemo(() => {
    return (unitList || []).filter(g => normalizeText(g).includes(normalizeText(searchInconsistencyGerencia)));
  }, [unitList, searchInconsistencyGerencia]);

  const filteredGroupedInconsistencyUnits = useMemo(() => {
    return (unitList || []).filter(g => normalizeText(g).includes(normalizeText(searchGroupedInconsistencyGerencia)));
  }, [unitList, searchGroupedInconsistencyGerencia]);

  const filteredUnutilizedUnits = useMemo(() => {
    return (unitList || []).filter(g => normalizeText(g).includes(normalizeText(searchUnutilizedGerencia)));
  }, [unitList, searchUnutilizedGerencia]);

  const getCCEmails = () => "gadabastecimento@compesa.com.br;gadmonitoramento@compesa.com.br";

  // Mapa de ativos OPERACIONAIS por placa para busca rápida
  const operationalAssetsMap = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach(a => {
      const status = (a["STATUS OPERACIONAL"] || "").toUpperCase().trim();
      const isOperational = status === "OPERACIONAL" || status.includes("OPERAC");
      const placa = String(a.PLACA || a.placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (placa && isOperational) map.set(placa, a);
    });
    return map;
  }, [assets]);

  // Mapa geral de ativos para buscar Propriedade mesmo se não operacional
  const allAssetsMap = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach(a => {
      const placa = String(a.PLACA || a.placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (placa) map.set(placa, a);
    });
    return map;
  }, [assets]);

  const parseDateRobust = (rawDate: any): Date => {
    if (rawDate instanceof Date) return rawDate;
    if (!rawDate) return new Date(0);
    
    if (typeof rawDate === 'number') {
      if (rawDate > 40000 && rawDate < 60000) {
        return new Date((rawDate - 25569) * 86400 * 1000);
      }
      return new Date(rawDate);
    }
    
    if (typeof rawDate === 'string') {
      const s = rawDate.trim();
      
      // Try YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        if (isValid(d)) return d;
      }

      const parts = s.split(/[\s/:-]/);
      // Search for a DD/MM/YYYY or YYYY/MM/DD pattern in the parts
      for (let i = 0; i <= parts.length - 3; i++) {
        const p1 = parts[i];
        const p2 = parts[i+1];
        const p3 = parts[i+2];

        // DD/MM/YYYY
        if (p1.length <= 2 && p2.length <= 2 && (p3.length === 4 || p3.length === 2)) {
          const day = parseInt(p1);
          const month = parseInt(p2) - 1;
          const year = p3.length === 2 ? 2000 + parseInt(p3) : parseInt(p3);
          const hour = parts[i+3] ? parseInt(parts[i+3]) : 0;
          const min = parts[i+4] ? parseInt(parts[i+4]) : 0;
          const date = new Date(year, month, day, hour, min);
          if (isValid(date) && date.getFullYear() > 2000 && date.getFullYear() < 2100) return date;
        }
        
        // YYYY/MM/DD
        if (p1.length === 4 && p2.length <= 2 && p3.length <= 2) {
          const year = parseInt(p1);
          const month = parseInt(p2) - 1;
          const day = parseInt(p3);
          const hour = parts[i+3] ? parseInt(parts[i+3]) : 0;
          const min = parts[i+4] ? parseInt(parts[i+4]) : 0;
          const date = new Date(year, month, day, hour, min);
          if (isValid(date)) return date;
        }
      }
    }
    
    const d = new Date(rawDate);
    return isValid(d) ? d : null;
  };

  // Processamento base de dados
  const filteredFuel = useMemo(() => {
    return fuel.filter(f => {
      const txDate = parseDateRobust(f._date);
      if (!txDate || !isValid(txDate)) return true;
      
      if (dateFrom && txDate < startOfDay(dateFrom)) return false;
      if (dateTo && txDate > endOfDay(dateTo)) return false;
      
      return true;
    });
  }, [fuel, dateFrom, dateTo]);

  // 3. Análise de Inconsistência de KM/Horímetro
  const inconsistencyAnalysis = useMemo(() => {
    const inconsistencies: any[] = [];
    const fuelByPlate: Record<string, any[]> = {};

    // Agrupar e garantir limpeza de dados
    filteredFuel.forEach(f => {
      const placa = String(f._placa || "").toUpperCase().trim();
      if (!placa) return;
      if (!fuelByPlate[placa]) fuelByPlate[placa] = [];
      
      const odometer = f._odometer || 0;
      const kmRodados = f._kmRodados || 0;
      
      const txDate = parseDateRobust(f._date);

      fuelByPlate[placa].push({ ...f, odometer, kmRodados, txDate });
    });

    // Analisar por placa
    Object.keys(fuelByPlate).forEach(placa => {
      const fuelings = fuelByPlate[placa].sort((a, b) => (a.txDate?.getTime() || 0) - (b.txDate?.getTime() || 0));

      fuelings.forEach((f, idx) => {
        let isInc = false;
        let reason = "";

        // Regra 1: KM Rodados Negativo
        if (f.kmRodados < 0) {
          isInc = true;
          reason = "KM Rodados Negativo";
        }

        // Regra 2: Salto > 30% no Hodômetro
        if (idx > 0) {
          const prev = fuelings[idx - 1];
          if (f.odometer > 0 && prev.odometer > 0) {
            const diff = f.odometer - prev.odometer;
            const threshold = prev.odometer * 0.3;
            if (diff > threshold) {
              isInc = true;
              reason = reason ? `${reason}; Salto > 30% Hodômetro` : "Salto > 30% Hodômetro";
            }
          }
        }

        if (isInc) {
          const asset = allAssetsMap.get(placa);
          inconsistencies.push({
            placa,
            transacao: f._txId || (f as any).COL_0 || "N/A",
            motorista: f._driver || "N/A",
            data: (f.txDate && isValid(f.txDate)) ? format(f.txDate, "dd/MM/yyyy") : "N/A",
            time: (f.txDate && isValid(f.txDate)) ? format(f.txDate, "HH:mm") : "",
            odometer: f.odometer,
            kmRodados: f.kmRodados,
            unidade: asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A",
            motivo: reason,
            prevOdometer: idx > 0 ? fuelings[idx - 1].odometer : null,
            historico: fuelings.slice(0, idx + 1).map(h => ({
              transacao: h._txId || (h as any).COL_0,
              data: h.txDate,
              odometer: h.odometer,
              kmRodados: h.kmRodados
            }))
          });
        }
      });
    });

    return inconsistencies.sort((a, b) => {
      const dA = (a.data && a.data !== "N/A") ? parse(a.data, "dd/MM/yyyy", new Date()) : new Date(0);
      const dB = (b.data && b.data !== "N/A") ? parse(b.data, "dd/MM/yyyy", new Date()) : new Date(0);
      if (!isValid(dA) || !isValid(dB)) return 0;
      return dB.getTime() - dA.getTime();
    });
  }, [filteredFuel, allAssetsMap]);

  // 1. Identificar abastecimentos Irregulares (NÃO ESTÃO NO CADASTRO DE ATIVOS)
  const irregularTransactions = useMemo(() => {
    const transactions: any[] = [];
    filteredFuel.forEach(f => {
      const normalizedPlaca = String(f._placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (!normalizedPlaca) return;

      // Irregular se NÃO estiver no mapa GERAL de ativos (pois "Correspondente" significa existência na base)
      if (!allAssetsMap.has(normalizedPlaca)) {
        transactions.push({
          transacao: f._txId || (f as any).COL_0 || "N/A",
          placaOrigino: normalizedPlaca,
          placa: normalizedPlaca,
          data: f._date || "N/A",
          litros: f._litros || 0,
          valor: f._total || 0,
          estabelecimento: f._establishment || "N/A",
          motorista: f._driver || "N/A",
          statusAtivo: "NÃO CADASTRADO",
          propriedade: "NÃO IDENTIFICADA"
        });
      } else {
        // Se estiver no cadastro mas NÃO for OPERACIONAL, o usuário pode querer ver aqui também?
        // Mas o título diz "Sem Ativo Correspondente". Se está no cadastro, TEM correspondente.
        // Se o usuário reclama que MNE0014 diz que não tem correspondência mas está na base, 
        // é porque o filtro antigo de status OPERACIONAL estava tirando ela do match.
      }
    });
    return transactions;
  }, [filteredFuel, allAssetsMap]);

  // 2. Análise de horários e Dias da Semana
  const timeAndDayAnalysis = useMemo(() => {
    const timeRanges = {
      "00:00 - 08:00": 0,
       "08:00 - 11:59": 0,
       "12:00 - 13:00": 0,
       "13:01 - 17:00": 0,
       "17:01 - 23:59": 0
    };

    const daysOfWeekCount: Record<string, number> = {
      "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0
    };
    const dayMapOrder = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const vehiclesInRanges: Record<string, any[]> = {
      "00:00 - 08:00": [],
      "08:00 - 11:59": [],
      "12:00 - 13:00": [],
      "13:01 - 17:00": [],
      "17:01 - 23:59": []
    };

    filteredFuel.forEach(f => {
      const raw = (f as any).__raw || [];
      const rawDate = raw[4] || f["DATA TRANSACAO"] || f["DATA"] || f["DATA TRANSACA\u00D5"] || f["Data Transação"];
      if (!rawDate) return;

      let txDate: Date | null = null;
      let hour = -1;
      let minute = 0;

      if (typeof rawDate === 'number') {
        txDate = new Date((rawDate - 25569) * 86400 * 1000);
        const fractionalDay = rawDate - Math.floor(rawDate);
        const totalSeconds = Math.round(fractionalDay * 86400);
        hour = Math.floor(totalSeconds / 3600);
        minute = Math.floor((totalSeconds % 3600) / 60);
      } else if (typeof rawDate === 'string') {
        const timeMatch = rawDate.match(/(\d{2}):(\d{2})/);
        if (timeMatch) {
          hour = parseInt(timeMatch[1]);
          minute = parseInt(timeMatch[2]);
        }
        const parts = rawDate.split(/[\s/:-]/);
        if (parts.length >= 3) {
          if (parts[0].length === 4) {
            txDate = new Date(rawDate);
          } else {
            txDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
        }
      }

      if (txDate && isValid(txDate)) {
        const dayOfWeek = txDate.getDay();
        const dayName = dayMapOrder[dayOfWeek];
        if (daysOfWeekCount[dayName] !== undefined) daysOfWeekCount[dayName]++;

        if (hour >= 0 && hour < 24) {
          const totalMinutes = hour * 60 + minute;
          let rangeKey = "";

          if (totalMinutes < 8 * 60) rangeKey = "00:00 - 08:00";
          else if (totalMinutes < 12 * 60) rangeKey = "08:00 - 11:59";
          else if (totalMinutes <= 13 * 60) rangeKey = "12:00 - 13:00";
          else if (totalMinutes <= 17 * 60) rangeKey = "13:01 - 17:00";
          else rangeKey = "17:01 - 23:59";

          if (rangeKey) {
            (timeRanges as any)[rangeKey]++;
            
            // Check if Out of Pattern: Fueling between 19h and 06h of the next day
            // After 06h and before 19h, it is NOT out of pattern.
            const isOutsideHours = hour >= 19 || hour < 6;
            
            const plateClean = String(f._placa || f.PLACA || f.Placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
            const asset = allAssetsMap.get(plateClean);
            const gerencia = asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A";
            const isSpecialPlate = specialHours.some(sh => sh.placa === plateClean) || (asset && (asset as any).OPERACAO_24H);
            const outOfPattern = isOutsideHours && !isSpecialPlate;

            vehiclesInRanges[rangeKey].push({
              placa: plateClean || "N/A",
              range: rangeKey,
              data: txDate,
              dataStr: (txDate && isValid(txDate)) ? format(txDate, "dd/MM/yyyy") : "N/A",
              horaStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
              motorista: raw[11] || "N/A",
              gerencia,
              outOfPattern
            });
          }
        }
      }
    });

    return {
      ranges: Object.entries(timeRanges).map(([name, value]) => ({ name, value })),
      days: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => ({ name: d, value: daysOfWeekCount[d] })),
      vehicles: Object.values(vehiclesInRanges).flat()
    };
  }, [filteredFuel]);

  // Filtros de busca e Paginação
  const paginatedInconsistency = inconsistencyAnalysis.slice((currentPageInconsistency - 1) * itemsPerPage, currentPageInconsistency * itemsPerPage);

  const groupedInconsistencies = useMemo(() => {
    if (!isInconsistencyGroupedByUnit) return [];
    const grouped: Record<string, any[]> = {};
    inconsistencyAnalysis.forEach(inc => {
      const unidade = inc.unidade || "N/A";
      if (!grouped[unidade]) grouped[unidade] = [];
      grouped[unidade].push(inc);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [inconsistencyAnalysis, isInconsistencyGroupedByUnit]);

  const filteredIrregular = irregularTransactions.filter(t => 
    t.placa.includes(searchTermUnknown.toUpperCase()) || 
    t.motorista.toUpperCase().includes(searchTermUnknown.toUpperCase())
  );
  const paginatedIrregular = filteredIrregular.slice((currentPageUnknown - 1) * itemsPerPage, currentPageUnknown * itemsPerPage);

  const filteredTimeVehicles = timeAndDayAnalysis.vehicles.filter(v => {
    const matchesSearch = v.placa.toUpperCase().includes(searchTermTime.toUpperCase()) || 
                         v.motorista.toUpperCase().includes(searchTermTime.toUpperCase()) ||
                         String(v.gerencia || "").toUpperCase().includes(searchTermTime.toUpperCase());
    const matchesTimeRange = selectedTimeRangeFilter === "ALL" || v.range === selectedTimeRangeFilter;
    const matchesPattern = selectedPatternFilter === "ALL" || 
                          (selectedPatternFilter === "OUT" && v.outOfPattern) ||
                          (selectedPatternFilter === "IN" && !v.outOfPattern);
    return matchesSearch && matchesTimeRange && matchesPattern;
  });

  const groupedTimeVehicles = useMemo(() => {
    if (!isGroupedByUnit) return [];
    const grouped: Record<string, any[]> = {};
    filteredTimeVehicles.forEach(v => {
      if (!grouped[v.gerencia]) grouped[v.gerencia] = [];
      grouped[v.gerencia].push(v);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTimeVehicles, isGroupedByUnit]);

  const paginatedTime = filteredTimeVehicles.slice((currentPageTime - 1) * itemsPerPage, currentPageTime * itemsPerPage);

  const handleSendEmail = () => {
    if (!emailGerencia) {
      toast.error("Por favor, selecione uma gerência");
      return;
    }

    const start = "Data Inicial";
    const end = "Data Final";
    
    // Agrupar placas e somar valores
    const placasUnicas = [...new Set(filteredIrregular.map(t => t.placa))].join(", ");
    const valorTotal = filteredIrregular.reduce((sum, t) => sum + t.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const subject = "Notificação de Abastecimento Indevido e Solicitação de Regularização";
    const body = `Prezado Gestor da Unidade (${emailGerencia}),

Identificamos que, no período de ${start} a ${end}, ocorreram abastecimentos vinculados à(s) placa(s) listada(s) abaixo que não pertencem à frota da COMPESA, tampouco aos contratos de locação geridos pela Nexus BI.

Placa(s): ${placasUnicas}

Informamos que já estamos providenciando o bloqueio do cartão envolvido, bem como solicitando a transferência do valor utilizado indevidamente, uma vez que não houve autorização para tais transações.

Ressaltamos que a não regularização por meio da transferência do valor indevido implicará na suspensão de futuras liberações de crédito extra ou do saldo mensal da unidade.

Dados para transferência:
ID do Projeto: S11046
Conta Contábil: 41120212
Valor para Transferência: R$ ${valorTotal}

(Consulte o relatório em anexo para o resumo das transações, contendo código da transação, datas e demais informações pertinentes)

Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;

    const cc = getCCEmails();
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toRaw = getEmailsByGerencia(emailGerencia);
    const toFiltered = toRaw.filter(e => !ccList.includes(e.trim().toLowerCase()));
    const to = toFiltered.join(";");
    
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setIsEmailDialogOpen(false);
    toast.success("E-mail preparado com sucesso!");
  };

  const handleSendJustification = () => {
    if (!justifyGerencia) {
      toast.error("Por favor, selecione uma gerência");
      return;
    }

    // Filtrar apenas veículos da gerência selecionada e que estejam fora do padrão
    const vehiclesForGerencia = filteredTimeVehicles.filter(v => {
      if (!v.outOfPattern) return false;
      const asset = allAssetsMap.get(v.placa.toUpperCase());
      const gerencia = asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A";
      return gerencia === justifyGerencia;
    });

    if (vehiclesForGerencia.length === 0) {
      toast.error("Nenhum veículo 'Fora do Padrão' encontrado para esta gerência.");
      return;
    }

    // Aglutinar por placa
    const groupedByPlate: Record<string, any[]> = {};
    vehiclesForGerencia.forEach(v => {
      const placa = v.placa.toUpperCase().trim();
      if (!groupedByPlate[placa]) groupedByPlate[placa] = [];
      groupedByPlate[placa].push(v);
    });

    const vehicleListText = Object.entries(groupedByPlate)
      .map(([placa, regs]) => {
        const sortedRegs = [...regs].sort((a,b) => (a.data?.getTime() || 0) - (b.data?.getTime() || 0));
        const lines = sortedRegs.map(r => `  - Data: ${r.dataStr} | Hora: ${r.horaStr} | Condutor: ${r.motorista}`).join("\n");
        return `* Placa: ${placa}\n${lines}`;
      })
      .join("\n\n");

    const subject = `Solicitação de justificativa de uso de veículos fora do padrão - ${justifyGerencia}`;
    const body = `Prezado Gestor da Unidade (${justifyGerencia}),

Com base no monitoramento do uso dos veículos corporativos, identificamos registros de utilização fora dos parâmetros estabelecidos para uso padrão, que compreende o período das 06h às 19h (abastecimentos fora desse intervalo, entre 19h e 06h do dia seguinte, são considerados fora do padrão).

Dessa forma, solicitamos a gentileza de encaminhar a devida justificativa para a utilização dos veículos listados abaixo, considerando os filtros aplicados de data e horário:

${vehicleListText}

Ressaltamos que os referidos veículos não estão enquadrados na relação de uso padrão, sendo necessário o devido esclarecimento para fins de controle e conformidade interna.

Solicitamos que as justificativas sejam encaminhadas no prazo de até 02 (dois) dias úteis a contar do recebimento deste e-mail.

Em caso de dúvidas, permanecemos à disposição.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;

    const cc = getCCEmails();
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toRaw = getEmailsByGerencia(justifyGerencia);
    const toFiltered = toRaw.filter(e => !ccList.includes(e.trim().toLowerCase()));
    const to = toFiltered.join(";");
    
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setIsJustifyDialogOpen(false);
    toast.success("E-mail de justificativa preparado!");
  };

  const handleSendInconsistencyEmail = () => {
    if (!inconsistencyGerencia) {
      toast.error("Por favor, selecione uma gerência");
      return;
    }

    const t = selectedInconsistency;
    if (!t) return;

    const subject = "Divergência de KM/Horímetro em abastecimento";
    const body = `Prezado Gestor,

Identificamos uma inconsistência no KM/Horímetro informado no momento do abastecimento, conforme anexo e detalhamento abaixo. Verificamos que o valor registrado está muito acima e/ou divergente em relação aos abastecimentos anteriores.

Detalhes da Divergência:
Placa: ${t.placa}
Condutor: ${t.motorista}
Cód. Transação: ${t.transacao}
Valor Informado: ${t.odometer}
KM Rodados Calculado: ${t.kmRodados}
Motivo: ${t.motivo}

Solicitamos, por gentileza, informar o valor correto, com o envio da papeleta e/ou relatório de telemetria, se possível, além da foto atual do painel do veículo/equipamento, a fim de confrontarmos as informações e realizarmos o devido ajuste no sistema.

Pedimos que o retorno seja realizado no prazo de 01 (um) dia útil para correção. Reforçamos também a importância de atenção no momento do abastecimento, para que o condutor realize corretamente o registro das informações no ato do abastecimento.

Caso não haja retorno dentro do prazo informado, o cartão de abastecimento poderá ser bloqueado.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;

    const cc = getCCEmails();
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toRaw = getEmailsByGerencia(inconsistencyGerencia);
    const toFiltered = toRaw.filter(e => !ccList.includes(e.trim().toLowerCase()));
    const to = toFiltered.join(";");

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setIsInconsistencyEmailDialogOpen(false);
    toast.success("E-mail de divergência preparado!");
  };

  const handleSendGroupedInconsistencyEmail = () => {
    if (!groupedInconsistencyGerencia) {
      toast.error("Por favor, selecione uma gerência");
      return;
    }

    const currentInconsistencies = inconsistencyAnalysis.filter(inc => {
      const unidade = inc.unidade || "N/A";
      return unidade === groupedInconsistencyGerencia;
    });

    if (currentInconsistencies.length === 0) {
      toast.error("Nenhuma divergência encontrada para esta gerência.");
      return;
    }

    const detailText = currentInconsistencies.map(inc => 
      `- Placa: ${inc.placa}\n  Data: ${inc.data} ${inc.time}\n  Cód. Transação: ${inc.transacao}\n  Valor Informado: ${inc.odometer}\n  KM Rodados: ${inc.kmRodados}\n  Motivo: ${inc.motivo}`
    ).join("\n\n");

    const subject = `Resumo de Divergências de KM/Horímetro - ${groupedInconsistencyGerencia}`;
    const body = `Prezado Gestor (${groupedInconsistencyGerencia}),

Identificamos as seguintes inconsistências no KM/Horímetro informados nos abastecimentos dos veículos vinculados à sua unidade:

${detailText}

Solicitamos, por gentileza, analisar as ocorrências acima e informar os valores corretos. Caso necessário, envie a papeleta ou foto do painel para fins de ajuste.

O prazo para retorno é de 01 (um) dia útil a contar deste e-mail. Ressaltamos que a falta de retorno poderá implicar no bloqueio dos cartões de abastecimento dos veículos envolvidos.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;

    const cc = getCCEmails();
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toRaw = getEmailsByGerencia(groupedInconsistencyGerencia);
    const toFiltered = toRaw.filter(e => !ccList.includes(e.trim().toLowerCase()));
    const to = toFiltered.join(";");

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setIsGroupedInconsistencyEmailDialogOpen(false);
    toast.success("E-mail de resumo de divergências preparado!");
  };

  const handleExportInconsistency = (item: any) => {
    const dataExport = item.historico.map((h: any) => ({
      "Cód. Transação": h.transacao,
      "Data": h.data,
      "Placa": item.placa,
      "Hodômetro/Horímetro": h.odometer,
      "KM Rodados/Horas": h.kmRodados,
      "Condutor": item.motorista,
      "Motivo Alerta": h.transacao === item.transacao ? item.motivo : ""
    }));
    
    exportToExcelMultiSheet([{ 
      data: dataExport, 
      sheetName: "Resumo Divergência" 
    }], `Divergencia_KM_${item.placa}_${item.transacao}`);
  };

  const handleExportIrregular = () => {
    // Usar os dados FILTRADOS pela busca/data para garantir que o resumo anexado seja o correto
    const dataExport = filteredIrregular.map(t => ({
      "Cód. Transação": t.transacao,
      "Placa": t.placaOrigino,
      "Propriedade": t.propriedade,
      "Status Ativo": t.statusAtivo,
      "Data/Hora": typeof t.data === 'string' ? t.data : (function() {
        const d = new Date((t.data - 25569) * 86400 * 1000);
        return isValid(d) ? format(d, 'dd/MM/yyyy HH:mm') : String(t.data);
      })(),
      "Litros": t.litros,
      "Valor": t.valor,
      "Posto": t.estabelecimento,
      "Motorista": t.motorista
    }));
    exportToExcelMultiSheet([{ data: dataExport, sheetName: "Resumo Transações Irregulares" }], "Resumo_Abastecimentos_Irregulares");
  };

  const handleExportTimeSummary = () => {
    const dataExport = filteredTimeVehicles.map(v => ({
      "Placa": v.placa,
      "Faixa Horária": v.range,
      "Data": v.dataStr || "N/A",
      "Hora": v.horaStr || "N/A",
      "Motorista": v.motorista,
      "Fora do Padrão": v.outOfPattern ? "SIM" : "NÃO"
    }));
    exportToExcelMultiSheet([{ data: dataExport, sheetName: "Resumo Uso Temporal" }], "Resumo_Uso_Veiculos_Horario");
  };

  const topUnitsWithAnomalies = useMemo(() => {
    const counts: Record<string, number> = {};

    // Count Time Pattern Anomalies
    timeAndDayAnalysis.vehicles.forEach(v => {
      if (v.outOfPattern && v.gerencia && v.gerencia !== "N/A") {
        counts[v.gerencia] = (counts[v.gerencia] || 0) + 1;
      }
    });

    // Count KM/Time Inconsistencies
    inconsistencyAnalysis.forEach(inc => {
      if (inc.unidade && inc.unidade !== "N/A") {
        counts[inc.unidade] = (counts[inc.unidade] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 units
  }, [timeAndDayAnalysis.vehicles, inconsistencyAnalysis]);

  const unutilizedStationsRaw = useMemo(() => {
    const PERNAMBUCO_REGIONS: Record<string, string[]> = {
      "RMR": ["RECIFE", "OLINDA", "JABOATAO", "PAULISTA", "CAMARAGIBE", "IGARASSU", "ABREU E LIMA", "SAO LOURENCO DA MATA", "ARACOIABA", "IPOJUCA", "MORENO", "ITAPISSUMA", "ITAMARACA", "CABO DE SANTO AGOSTINHO", "CABO"],
      "Agreste": ["CARUARU", "GARANHUNS", "ARCOVERDE", "SANTA CRUZ DO CAPIBARIBE", "BEZERROS", "GRAVATA", "PESQUEIRA", "SURUBIM", "BELO JARDIM", "BOM CONSELHO", "LAJEDO", "LIMOEIRO", "BUIQUE", "CUSTODIA", "PEDRA", "VENTUROSA", "SALOA", "CAETES", "SANTA MARIA DO CAMBUCA", "VERTENTES", "TAQUARITINGA", "TORITAMA", "AGRESTE"],
      "Mata Norte": ["GOIANA", "TIMBAUBA", "CARPINA", "PAUDALHO", "ALIANCA", "CONDADO", "NAZARE DA MATA", "VICENCIA", "MACAPARANA", "ITAMBE", "LAGOA DO CARRO", "TRACUNHAEM", "BUENOS AIRES"],
      "Mata Sul": ["PALMARES", "VITORIA DE SANTO ANTAO", "VITORIA", "SIRINHAEM", "BARREIROS", "CATENDE", "ESCADA", "RIBEIRAO", "RIO FORMOSO", "AGUA PRETA", "TAMANDARE", "QUIPAPA", "AMARAGI", "CORTES", "JOAQUIM NABUCO", "MARAIAL", "SAO BENEDITO DO SUL"],
      "Sertão": ["PETROLINA", "SALGUEIRO", "SERRA TALHADA", "ARARIPINA", "AFOGADOS DA INGAZEIRA", "CABROBO", "OURICURI", "TABIRA", "PETROLANDIA", "SAO JOSE DO EGITO", "FLORESTA", "BODOCO", "EXU", "PARNAMIRIM", "STALHADA", "S J DO EGITO", "TRIUNFO", "BELMONTE", "ITACURUBA", "SAO JOSE DO BELMONTE", "VERDEJANTE", "MIRANDIBA", "SERTAO", "TABIRA", "CUSTODIA", "BETANIA", "IBIMIRIM", "INAJA", "MANARI"]
    };

    const getPERegion = (entry: string): string => {
      if (!entry) return "Outras Regiões";
      const c = entry.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (c.includes("RMR") || c.includes("METROPOLITANA")) return "RMR";
      if (c.includes("AGRESTE")) return "Agreste";
      if (c.includes("MATA NORTE")) return "Mata Norte";
      if (c.includes("MATA SUL")) return "Mata Sul";
      if (c.includes("SERTAO")) return "Sertão";
      for (const [region, cities] of Object.entries(PERNAMBUCO_REGIONS)) {
        if (cities.some(item => c.includes(item))) return region;
      }
      return "Outras Regiões";
    };

    const getTimestamp = (f: FuelData) => {
      let data = f._timestamp || 0;
      if (data === 0 && f._monthYearBase && f._monthYearBase !== "N/A" && f._monthYearBase !== null) {
        const parts = f._monthYearBase.replace(/\./g, "").split('/');
        if (parts.length === 2) {
          const mes = parts[0].trim().charAt(0).toUpperCase() + parts[0].trim().slice(1).toLowerCase();
          const ano = parts[1].trim();
          const mesesMap: Record<string, number> = { "Jan": 0, "Fev": 1, "Mar": 2, "Abr": 3, "Mai": 4, "Jun": 5, "Jul": 6, "Ago": 7, "Set": 8, "Out": 9, "Nov": 10, "Dez": 11 };
          if (mesesMap[mes] !== undefined) {
             data = new Date(2000 + parseInt(ano), mesesMap[mes], 15).getTime();
          }
        }
      }
      return data;
    };

    const hasSpecificDateFilter = !!(dateFrom || dateTo);
    const maxTsInData = filteredFuel.reduce((max, f) => Math.max(max, getTimestamp(f)), 0);
    const windowStartTs = maxTsInData > 0 ? maxTsInData - (20 * 24 * 60 * 60 * 1000) : 0;

    // Group transactions by cidade and fuelType
    const groups: Record<string, any[]> = {};
    filteredFuel.forEach(f => {
      const cidade = String(f._cidade || f["CIDADE"] || "N/A").toUpperCase().trim();
      const tipo = String(f._fuelType || f["TIPO COMBUSTIVEL"] || "N/A").toUpperCase().trim();
      if (cidade === "N/A" || tipo === "N/A" || !cidade || !tipo) return;

      const preco = f._vlLitro || f["VALOR UNITARIO"] || f["VL/UNITARIO"] || 0;
      if (preco <= 0.5 || preco > 20.00) return;

      // Exclude specific benchmarks requested by user
      const postoNomeNorm = String(f._posto || f._establishment || f["NOME POSTO"] || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const enderecoNorm = String(f._endereco || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (postoNomeNorm.includes("PICHILAU")) return;
      if (postoNomeNorm.includes("ECO POSTO") && (postoNomeNorm.includes("VITORIA") || postoNomeNorm.includes("SANTO ANTAO"))) return;
      if (postoNomeNorm.includes("VIT") && postoNomeNorm.includes("VITORIA") && enderecoNorm.includes("BR-232")) return;

      const key = `${cidade}|${tipo}`;
      if (!groups[key]) groups[key] = [];
      
      const ts = getTimestamp(f);
      groups[key].push({ ...f, _dataWork: ts });
    });

    const results: any[] = [];

    Object.entries(groups).forEach(([key, txs]) => {
      const [cidade, tipo] = key.split("|");

      // Filter recent records using same logic as PriceAnalysis
      const recentRecords = (!hasSpecificDateFilter && windowStartTs > 0) ? txs.filter(f => f._dataWork >= windowStartTs) : txs;
      if (recentRecords.length === 0) return;

      // Sort recent records descending by date
      const sortedByDate = [...recentRecords].sort((a, b) => b._dataWork - a._dataWork);
      const focusGroup = sortedByDate.slice(0, 5);

      // Find best match in the focus group of last 5 transactions
      const bestMatch = focusGroup.reduce((best, curr) => {
        const fuelType = String(curr._fuelType || curr["TIPO COMBUSTIVEL"] || "").toUpperCase();
        const isGas = fuelType.includes("GASOLINA");
        const isDiesel = fuelType.includes("DIESEL");
        const isArla = fuelType.includes("ARLA");
        
        const price = curr._vlLitro || curr["VALOR UNITARIO"] || curr["VL/UNITARIO"] || 0;
        const bestPrice = best ? (best._vlLitro || best["VALOR UNITARIO"] || best["VL/UNITARIO"] || 0) : 0;

        if (!isArla) {
          if (isGas && (price < 4.00 || price > 8.50)) return best;
          if (isDiesel && (price < 4.00 || price > 8.00)) return best;
        } else {
          if (price > 15.00 || price < 2.00) return best;
        }
        
        if (price <= 0.5 || price > 100) return best;
        
        return (!best || bestPrice <= 0.5 || price < bestPrice) ? curr : best;
      }, focusGroup[0]);

      const finalMatch = (bestMatch && (bestMatch._vlLitro || bestMatch["VALOR UNITARIO"] || bestMatch["VL/UNITARIO"] || 0) < 0.5)
        ? sortedByDate.find(r => (r._vlLitro || r["VALOR UNITARIO"] || r["VL/UNITARIO"] || 0) > 2.0) || bestMatch
        : bestMatch;

      if (!finalMatch) return;

      const bestPrice = finalMatch._vlLitro || finalMatch["VALOR UNITARIO"] || finalMatch["VL/UNITARIO"] || 0;
      const bestStationName = String(finalMatch._posto || finalMatch["NOME POSTO"] || "N/A").toUpperCase().trim();
      if (bestPrice <= 0.5) return;

      let otherFuelingsCount = 0;
      let otherLitersPaid = 0;
      let otherCostPaid = 0;
      let bestStationFuelingsCount = 0;
      let bestStationLitersPaid = 0;

      const otherStationsUsed: Record<string, { count: number, liters: number, cost: number }> = {};
      const gestoesConfronted = new Set<string>();

      recentRecords.forEach(t => {
        const pName = String(t._posto || t["NOME POSTO"] || "N/A").toUpperCase().trim();
        const price = t._vlLitro || t["VALOR UNITARIO"] || t["VL/UNITARIO"] || 0;
        const litros = t._litros || t["LITROS"] || 0;
        const totalCost = t._total || t["VALOR EMISSAO"] || 0;

        const placa = String(t._placa || t.PLACA || t.Placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const asset = allAssetsMap.get(placa);
        const gerencia = asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A";

        if (pName === bestStationName) {
          bestStationFuelingsCount++;
          bestStationLitersPaid += litros;
        } else {
          // Compare with best price in this period
          if (price > bestPrice) {
            otherFuelingsCount++;
            otherLitersPaid += litros;
            otherCostPaid += totalCost;
            if (gerencia && gerencia !== "N/A" && gerencia !== "") {
              gestoesConfronted.add(gerencia);
            }
            if (!otherStationsUsed[pName]) {
              otherStationsUsed[pName] = { count: 0, liters: 0, cost: 0 };
            }
            otherStationsUsed[pName].count++;
            otherStationsUsed[pName].liters += litros;
            otherStationsUsed[pName].cost += totalCost;
          }
        }
      });

      if (otherFuelingsCount > 0) {
        const avgPricePaidOther = otherLitersPaid > 0 ? otherCostPaid / otherLitersPaid : 0;
        const priceDifference = avgPricePaidOther - bestPrice;
        const potentialSavings = priceDifference > 0 ? priceDifference * otherLitersPaid : 0;

        if (potentialSavings > 0) {
          results.push({
            regiao: getPERegion(cidade),
            cidade,
            tipo,
            bestStationName,
            bestPrice,
            bestStationFuelingsCount,
            bestStationLitersPaid,
            otherFuelingsCount,
            otherLitersPaid,
            otherCostPaid,
            avgPricePaidOther,
            priceDifference,
            potentialSavings,
            gestoes: Array.from(gestoesConfronted),
            otherStations: Object.keys(otherStationsUsed)
          });
        }
      }
    });

    return results.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }, [filteredFuel, allAssetsMap, dateFrom, dateTo]);

  const unutilizedStations = useMemo(() => {
    return unutilizedStationsRaw.filter(x => {
      if (unutilizedSelectedRegion !== "ALL" && x.regiao !== unutilizedSelectedRegion) return false;
      if (unutilizedSelectedCity !== "ALL" && x.cidade !== unutilizedSelectedCity) return false;
      if (unutilizedSelectedStation !== "ALL" && x.bestStationName !== unutilizedSelectedStation) return false;
      if (unutilizedSelectedGestao !== "ALL" && !x.gestoes.includes(unutilizedSelectedGestao)) return false;
      return true;
    });
  }, [unutilizedStationsRaw, unutilizedSelectedRegion, unutilizedSelectedCity, unutilizedSelectedStation, unutilizedSelectedGestao]);

  const unutilizedRegionOptions = useMemo(() => {
    return Array.from(new Set(unutilizedStationsRaw.map(x => x.regiao))).sort();
  }, [unutilizedStationsRaw]);

  const unutilizedCityOptions = useMemo(() => {
    return Array.from(new Set(unutilizedStationsRaw.map(x => x.cidade))).sort();
  }, [unutilizedStationsRaw]);

  const unutilizedStationOptions = useMemo(() => {
    return Array.from(new Set(unutilizedStationsRaw.map(x => x.bestStationName))).sort();
  }, [unutilizedStationsRaw]);

  const unutilizedGestaoOptions = useMemo(() => {
    const gest = new Set<string>();
    unutilizedStationsRaw.forEach(x => {
      x.gestoes.forEach((g: string) => gest.add(g));
    });
    return Array.from(gest).sort();
  }, [unutilizedStationsRaw]);

  const totalAvoidableCostSum = useMemo(() => {
    return unutilizedStations.reduce((sum, x) => sum + x.potentialSavings, 0);
  }, [unutilizedStations]);

  const handleSendUnutilizedNotification = () => {
    if (!selectedUnutilizedGerencia) {
      toast.error("Por favor, selecione uma gerência/gestão");
      return;
    }
    const row = selectedUnutilizedRow;
    if (!row) return;

    const subject = `Melhores Preços não Utilizados - Alerta de Desperdício e Otimização - COMPESA`;
    const body = `Prezado Gestor da Unidade (${selectedUnutilizedGerencia}),

A Coordenação de Gestão de Frotas (CGF) identificou uma importante oportunidade de economia que não está sendo aproveitada na sua unidade em relação ao direcionamento de abastecimento dos veículos corporativos.

Na tela de Análise de Preços da COMPESA, foi detectado o seguinte posto credenciado com o melhor preço para a sua localidade:

📍 Localidade: ${row.cidade} (${row.regiao})
Gasolina/Diesel: ${row.tipo}
⛽ Posto com Melhor Preço Credenciado: ${row.bestStationName}
💰 Valor de Melhor Preço: R$ ${row.bestPrice.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} / L

Pelo nosso levantamento mais recente, veículos sob a sua gestão realizaram abastecimentos em OUTROS postos de combustíveis na mesma cidade, pagando mais caro pelo mesmo tipo de combustível:

📊 Volume de Abastecimentos noutros postos: ${row.otherLitersPaid.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Litros
📈 Preço Médio Pago nos Outros Postos: R$ ${row.avgPricePaidOther.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} / L
📉 Impacto Financeiro (Desperdício) Evitável Mensurado: R$ ${row.potentialSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Ressaltamos que a COMPESA possui convênio direto e regras estritas para priorização dos postos de combustíveis de menor preço cadastrados no sistema Nexus BI, sendo estes os mais viáveis economicamente para as despesas públicas de nossa frota corporativa.

Solicitamos esclarecer por que os condutores sob sua gestão não estão efetuando os abastecimentos no posto indicado (${row.bestStationName}) e requeremos que os oriente a priorizar este posto credenciado em futuros abastecimentos, visando conter o desperdício identificado.

Contamos com sua colaboração urgente para regularizar o direcionamento de abastecimento da frota.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF
Companhia Pernambucana de Saneamento - COMPESA`;

    const cc = getCCEmails();
    const ccList = cc.split(";").map(e => e.trim().toLowerCase());
    const toRaw = getEmailsByGerencia(selectedUnutilizedGerencia);
    const toFiltered = toRaw.filter(e => !ccList.includes(e.trim().toLowerCase()));
    const to = toFiltered.join(";");

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setIsUnutilizedDialogOpen(false);
    toast.success("E-mail de recomendação e cobrança preparado!");
  };

  const handleExportUnutilizedSummary = () => {
    const dataExport = unutilizedStations.map(x => ({
      "Região": x.regiao,
      "Cidade": x.cidade,
      "Tipo Combustível": x.tipo,
      "Posto Credenciado Melhor Preço": x.bestStationName,
      "Melhor Preço Praticado": x.bestPrice,
      "Abastecimentos no Posto Econômico": x.bestStationFuelingsCount,
      "Volume no Posto Econômico (L)": x.bestStationLitersPaid,
      "Abastecimentos em Postos Caros": x.otherFuelingsCount,
      "Volume em Postos Caros (L)": x.otherLitersPaid,
      "Preço Médio nos Outros (R$/L)": x.avgPricePaidOther,
      "Diferença por Litro (R$)": x.priceDifference,
      "Economia Evitável Potencial (R$)": x.potentialSavings,
      "Gestões/Gerências Envolvidas": x.gestoes.join(", ")
    }));
    exportToExcelMultiSheet([{ data: dataExport, sheetName: "Oportunidades de Direcionamento" }], "Auditoria_Melhores_Precos_COMPESA");
  };

  const paginatedUnutilized = useMemo(() => {
    const start = (unutilizedCurrentPage - 1) * itemsPerPage;
    return unutilizedStations.slice(start, start + itemsPerPage);
  }, [unutilizedStations, unutilizedCurrentPage]);

  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f43f5e'];

  return (
    <div className="space-y-6">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Performance de Abastecimento</h2>
          <p className="text-sm text-slate-500 font-medium uppercase tracking-widest">Análise temporal e integridade de frotas operacionais</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 px-3">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Período:</span>
            </div>
            <Input 
              type="date" 
              className="h-8 w-32 text-[10px] bg-transparent border-none focus-visible:ring-0 uppercase font-bold" 
              value={dateFrom ? format(dateFrom, "yyyy-MM-dd") : ""}
              onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)}
            />
            <span className="text-slate-300">/</span>
            <Input 
              type="date" 
              className="h-8 w-32 text-[10px] bg-transparent border-none focus-visible:ring-0 uppercase font-bold"
              value={dateTo ? format(dateTo, "yyyy-MM-dd") : ""}
              onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value + "T23:59:59") : undefined)}
            />
          </div>
          <Button onClick={handleExportIrregular} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black shadow-lg shadow-indigo-200 dark:shadow-none h-11 px-6 rounded-xl">
            <Download className="h-4 w-4" /> EXPORTAR RELATÓRIO
          </Button>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                 <Clock className="h-4 w-4" />
               </div>
               <CardTitle className="text-xs font-black uppercase tracking-widest">Distribuição por Faixa Horária</CardTitle>
            </div>
            <CardDescription className="text-[9px] uppercase font-bold text-slate-400">Concentração de abastecimentos por períodos do dia</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={timeAndDayAnalysis.ranges}>
                  <XAxis dataKey="name" fontSize={8} fontWeight="900" tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', fontSize: '10px'}} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                    {timeAndDayAnalysis.ranges.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
               </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 transition-transform group-hover:scale-110">
                 <AlertTriangle className="h-4 w-4" />
               </div>
               <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Unidades com Mais Out of Pattern</CardTitle>
            </div>
            <CardDescription className="text-[9px] uppercase font-bold text-slate-400">Ranking de unidades com detectação de anomalias/desvios</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={topUnitsWithAnomalies} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    fontSize={8} 
                    fontWeight="900" 
                    tickLine={false} 
                    axisLine={false} 
                    width={80}
                  />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '12px', border: 'none', fontSize: '10px'}} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                    {topUnitsWithAnomalies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 10 ? '#e11d48' : '#f59e0b'} />
                    ))}
                  </Bar>
               </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                 <Calendar className="h-4 w-4" />
               </div>
               <CardTitle className="text-xs font-black uppercase tracking-widest">Abastecimentos por Dia da Semana</CardTitle>
            </div>
            <CardDescription className="text-[9px] uppercase font-bold text-slate-400">Freqüência de transações de Segunda a Domingo</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={timeAndDayAnalysis.days}>
                  <XAxis dataKey="name" fontSize={9} fontWeight="900" tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '12px', border: 'none', fontSize: '10px'}} />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
               </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* NEW SECTION: CORINGA CARDS ANALYSIS */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-t-4 border-t-amber-500 overflow-hidden">
        <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Abastecimento com Cartões Coringa</CardTitle>
              <CardDescription className="text-[9px] uppercase font-bold text-slate-400 italic">Confronto de transações com base de cartões de emergência GAD</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <CoringaCardsTable fuel={filteredFuel} assetsMap={allAssetsMap} />
        </CardContent>
      </Card>

      {/* SEÇÃO: POSTOS DE MELHORES PREÇOS NÃO UTILIZADOS (OPORTUNIDADES DE ECONOMIA) */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-t-4 border-t-emerald-500 overflow-hidden">
        <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Oportunidades de Economia: Melhores Preços Omitidos
                  </CardTitle>
                  <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-none font-black text-[10px] uppercase">
                    R$ {totalAvoidableCostSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Evitáveis
                  </Badge>
                </div>
                <CardDescription className="text-[9px] uppercase font-bold text-slate-400">
                  Auditoria de postos credenciados com melhores preços na localidade sendo subutilizados por veículos abastecendo em estabelecimentos mais caros
                </CardDescription>
              </div>
            </div>
            <div>
              <Button 
                onClick={handleExportUnutilizedSummary}
                disabled={unutilizedStations.length === 0}
                className="h-8 text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white border-none shrink-0"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Exportar Auditoria
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-4">
          {/* Filtros locais */}
          <div className="flex flex-wrap gap-3 items-end bg-slate-50/55 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="w-[180px]">
              <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Filtrar por Região</label>
              <Select value={unutilizedSelectedRegion} onValueChange={(val) => { setUnutilizedSelectedRegion(val); setUnutilizedCurrentPage(1); }}>
                <SelectTrigger className="h-8 text-[10px] font-bold uppercase border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Todas as Regiões" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-[10px] font-bold uppercase">Todas as Regiões</SelectItem>
                  {unutilizedRegionOptions.map(r => (
                    <SelectItem key={r} value={r} className="text-[10px] font-bold uppercase">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Filtrar por Cidade</label>
              <Select value={unutilizedSelectedCity} onValueChange={(val) => { setUnutilizedSelectedCity(val); setUnutilizedCurrentPage(1); }}>
                <SelectTrigger className="h-8 text-[10px] font-bold uppercase border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Todas as Cidades" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <SelectItem value="ALL" className="text-[10px] font-bold uppercase">Todas as Cidades</SelectItem>
                  {unutilizedCityOptions.map(c => (
                    <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[220px]">
              <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Melhor Preço Posto</label>
              <Select value={unutilizedSelectedStation} onValueChange={(val) => { setUnutilizedSelectedStation(val); setUnutilizedCurrentPage(1); }}>
                <SelectTrigger className="h-8 text-[10px] font-bold uppercase border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Todos os Postos" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <SelectItem value="ALL" className="text-[10px] font-bold uppercase">Todos os Postos</SelectItem>
                  {unutilizedStationOptions.map(s => (
                    <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[220px]">
              <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Gestão com Desvio</label>
              <Select value={unutilizedSelectedGestao} onValueChange={(val) => { setUnutilizedSelectedGestao(val); setUnutilizedCurrentPage(1); }}>
                <SelectTrigger className="h-8 text-[10px] font-bold uppercase border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Todas as Gestões" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <SelectItem value="ALL" className="text-[10px] font-bold uppercase">Todas as Gestões</SelectItem>
                  {unutilizedGestaoOptions.map(g => (
                    <SelectItem key={g} value={g} className="text-[10px] font-bold uppercase">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-end pb-0.5 ml-auto">
              {(unutilizedSelectedRegion !== "ALL" || unutilizedSelectedCity !== "ALL" || unutilizedSelectedStation !== "ALL" || unutilizedSelectedGestao !== "ALL") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[9px] font-black uppercase underline hover:bg-transparent text-slate-500"
                  onClick={() => {
                    setUnutilizedSelectedRegion("ALL");
                    setUnutilizedSelectedCity("ALL");
                    setUnutilizedSelectedStation("ALL");
                    setUnutilizedSelectedGestao("ALL");
                    setUnutilizedCurrentPage(1);
                  }}
                >
                  Limpar Filtros Locais
                </Button>
              )}
            </div>
          </div>

          {/* Tabela de resultados */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-x-auto">
            <ScrollArea className="w-full">
              <Table className="min-w-[1300px]">
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto">Região / Cidade</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto">Combustível</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto">Posto Melhor Preço (Foco)</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto text-center">Nosso Giro no Posto Foco</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto text-center">Desvios noutros Postos</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto text-right">Preço Médio nos Outros</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto text-center">Diferença / L</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto text-right text-emerald-600 dark:text-emerald-400 font-extrabold">Potencial Economia</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto">Gestões com Abastecimento Externo</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-3 h-auto text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUnutilized.length > 0 ? (
                    paginatedUnutilized.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-slate-50 dark:border-slate-800/50 transition-colors">
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase leading-none">{item.cidade}</span>
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-indigo-50/30 text-indigo-600 border-indigo-100 max-w-max py-0 leading-tight">
                              {item.regiao}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 border-slate-200">
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 max-w-[200px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase leading-tight truncate" title={item.bestStationName}>
                              {item.bestStationName}
                            </span>
                            <span className="text-[10px] font-black text-emerald-600 leading-tight">
                              R$ {item.bestPrice.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          {item.bestStationFuelingsCount > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                                {item.bestStationFuelingsCount}x
                              </span>
                              <span className="text-[8px] font-bold text-emerald-500">
                                ({item.bestStationLitersPaid.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L)
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium text-rose-500 italic uppercase">
                              Nenhum (0 L)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-rose-600">
                              {item.otherFuelingsCount}x
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">
                              ({item.otherLitersPaid.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L em {item.otherStations.length} postos)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            R$ {item.avgPricePaidOther.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          {item.priceDifference > 0 ? (
                            <span className="text-[10px] font-black text-rose-500">
                              +R$ {item.priceDifference.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right bg-emerald-50/10 dark:bg-emerald-950/5">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                            R$ {item.potentialSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {item.gestoes.slice(0, 3).map((g: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[8px] font-black uppercase text-slate-500 border-slate-200">
                                {g}
                              </Badge>
                            ))}
                            {item.gestoes.length > 3 && (
                              <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 border-slate-200">
                                +{item.gestoes.length - 3} UN
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <Select
                            onValueChange={(val) => {
                              setSelectedUnutilizedRow(item);
                              setSelectedUnutilizedGerencia(val);
                              setSearchUnutilizedGerencia("");
                              setIsUnutilizedDialogOpen(true);
                            }}
                          >
                            <SelectTrigger className="h-7 text-[9px] font-black uppercase border-emerald-200 dark:border-emerald-800 text-emerald-700 hover:bg-emerald-50 rounded-lg bg-emerald-50 hover:text-emerald-800 transition-all max-w-[140px] px-2.5">
                              <div className="flex items-center gap-1.5 justify-center">
                                <Send className="h-3 w-3 shrink-0" />
                                <span>Cobrar Unidade</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent className="max-h-[250px] overflow-y-auto">
                              <div className="p-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400">
                                SELECIONE A UNIDADE PARCEIRA DO DESVIO:
                              </div>
                              {item.gestoes.map((unit: string) => (
                                <SelectItem key={unit} value={unit} className="text-[10px] font-bold uppercase">
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-xs text-slate-400 uppercase font-black">
                        Nenhuma omissão ou desvio de preço identificado nos filtros vigentes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Paginação */}
          {unutilizedStations.length > itemsPerPage && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50">
              <span className="text-[8px] font-black text-slate-400 uppercase">
                Pág. {unutilizedCurrentPage} de {Math.ceil(unutilizedStations.length / itemsPerPage)} ({unutilizedStations.length} registros)
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  disabled={unutilizedCurrentPage === 1} 
                  onClick={() => setUnutilizedCurrentPage(p => p - 1)}
                >
                  <Filter className="h-3 w-3 rotate-90 text-slate-400" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  disabled={unutilizedCurrentPage >= Math.ceil(unutilizedStations.length / itemsPerPage)} 
                  onClick={() => setUnutilizedCurrentPage(p => p + 1)}
                >
                  <Filter className="h-3 w-3 -rotate-90 text-slate-400" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TABLES SECTION */}
      <div className="grid grid-cols-1 gap-6">
        {/* INCONSISTENCY ANALYSIS TABLE */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-t-4 border-t-amber-500">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-2">
                 <AlertTriangle className="h-5 w-5 text-amber-500" />
                 <div>
                   <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Divergências de KM / Horímetro</CardTitle>
                   <CardDescription className="text-[9px] uppercase font-bold text-slate-400">Detecção de saltos de Hodômetro {">"}30% ou KM Rodados negativos</CardDescription>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <Button 
                    variant={isInconsistencyGroupedByUnit ? "default" : "outline"}
                    onClick={() => setIsInconsistencyGroupedByUnit(!isInconsistencyGroupedByUnit)}
                    className={`h-7 text-[9px] font-black uppercase transition-all ${isInconsistencyGroupedByUnit ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' : 'border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  >
                    Unificar por Unidade
                  </Button>
                  <Button 
                    onClick={() => setIsGroupedInconsistencyEmailDialogOpen(true)} 
                    disabled={inconsistencyAnalysis.length === 0}
                    className="h-7 text-[9px] font-black uppercase bg-amber-600 hover:bg-amber-700 gap-1 text-white border-none"
                  >
                    <Mail className="h-3 w-3" /> Solicitar Justificativa
                  </Button>
               </div>
            </div>
          </CardHeader>
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-x-auto">
            <ScrollArea className="h-[450px] w-full">
              {!isInconsistencyGroupedByUnit ? (
                <div className="min-w-[1200px]">
                  <Table>
                    <TableHeader className="bg-amber-50/30 dark:bg-amber-900/10 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8">Placa</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8">Data / Hora</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8">Cód. Transação</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8">Motorista</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8 text-right">Hodômetro</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8 text-right">KM Rodados</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8">Motivo</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-amber-800/60 dark:text-amber-400 h-8 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInconsistency.map((t, i) => (
                        <TableRow key={i} className="border-slate-50 dark:border-slate-800 hover:bg-amber-50/10 transition-colors">
                          <TableCell className="py-2 text-[10px] font-black text-amber-600">{t.placa}</TableCell>
                          <TableCell className="py-2 text-[9px] font-bold text-slate-500 uppercase">{t.data} <span className="text-slate-400 font-medium ml-1">{t.time}</span></TableCell>
                          <TableCell className="py-2 text-[9px] font-bold text-slate-500 uppercase">{t.transacao}</TableCell>
                          <TableCell className="py-2 text-[9px] font-bold text-slate-500 uppercase truncate max-w-[100px]">{t.motorista}</TableCell>
                          <TableCell className="py-2 text-[10px] font-black text-slate-700 dark:text-slate-300 text-right">{t.odometer.toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-[10px] font-black text-slate-700 dark:text-slate-300 text-right">
                            <span className={t.kmRodados < 0 ? "text-rose-500" : ""}>{t.kmRodados.toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="py-2">
                             <Badge variant="outline" className="text-[8px] h-4 font-bold border-amber-200 text-amber-600 uppercase">{t.motivo}</Badge>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                             <div className="flex justify-end gap-1">
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                                 onClick={() => handleExportInconsistency(t)}
                                 title="Baixar histórico da divergência"
                               >
                                 <Download className="h-4 w-4" />
                               </Button>
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                 onClick={() => {
                                   setSelectedInconsistency(t);
                                   setInconsistencyGerencia(t.unidade !== "N/A" ? t.unidade : "");
                                   setIsInconsistencyEmailDialogOpen(true);
                                 }}
                                 title="Notificar Gestor"
                               >
                                 <Mail className="h-4 w-4" />
                               </Button>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedInconsistency.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-[10px] font-bold uppercase text-slate-300 italic">
                            Nenhuma divergência de hodômetro detectada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="space-y-4 p-4 text-left min-w-[800px]">
                  {groupedInconsistencies.map(([unidade, items]) => (
                    <div key={unidade} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-amber-500" />
                          <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-widest">{unidade}</span>
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] font-black">{items.length} {items.length === 1 ? 'Divergência' : 'Divergências'}</Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[9px] font-black uppercase text-amber-600 hover:bg-amber-50 gap-2"
                          onClick={() => {
                            setGroupedInconsistencyGerencia(unidade);
                            setIsGroupedInconsistencyEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="h-3 w-3" /> Notificar Unidade
                        </Button>
                      </div>
                      <Table>
                         <TableHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                           <TableRow className="hover:bg-transparent">
                             <TableHead className="text-[8px] font-black uppercase h-7">Placa</TableHead>
                             <TableHead className="text-[8px] font-black uppercase h-7">Data</TableHead>
                             <TableHead className="text-[8px] font-black uppercase h-7">Motivo</TableHead>
                             <TableHead className="text-[8px] font-black uppercase h-7 text-right">Hodômetro</TableHead>
                             <TableHead className="text-[8px] font-black uppercase h-7 text-right">Diff/KM</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {items.map((it, idx) => (
                             <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                               <TableCell className="py-1.5 text-[9px] font-black text-amber-600">{it.placa}</TableCell>
                               <TableCell className="py-1.5 text-[8px] font-bold text-slate-500 uppercase">{it.data} {it.time}</TableCell>
                               <TableCell className="py-1.5">
                                 <span className="text-[8px] font-bold text-slate-400 truncate max-w-[120px] block" title={it.motivo}>{it.motivo}</span>
                               </TableCell>
                               <TableCell className="py-1.5 text-right text-[9px] font-black text-slate-600 dark:text-slate-400">{it.odometer.toLocaleString()}</TableCell>
                               <TableCell className={`py-1.5 text-right text-[9px] font-black ${it.kmRodados < 0 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>{it.kmRodados.toLocaleString()}</TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
          <div className="flex items-center justify-between p-3 border-t bg-slate-50/30 rounded-b-xl">
             <span className="text-[8px] font-black text-slate-400 uppercase">Pág. {currentPageInconsistency} de {Math.ceil(inconsistencyAnalysis.length/itemsPerPage)}</span>
             <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPageInconsistency === 1} onClick={() => setCurrentPageInconsistency(p => p - 1)}><Filter className="h-3 w-3 rotate-90" /></Button>
               <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPageInconsistency >= Math.ceil(inconsistencyAnalysis.length/itemsPerPage)} onClick={() => setCurrentPageInconsistency(p => p + 1)}><Filter className="h-3 w-3 -rotate-90" /></Button>
             </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* TIME RANGE VEHICLES */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-2">
                 <History className="h-5 w-5 text-indigo-500" />
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Veículos por Faixa / Horário</CardTitle>
               </div>
               <div className="flex items-center gap-2">
                 <Button 
                   variant={isGroupedByUnit ? "default" : "outline"}
                   onClick={() => setIsGroupedByUnit(!isGroupedByUnit)}
                   className={`h-7 text-[9px] font-black uppercase transition-all ${isGroupedByUnit ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'border-slate-200 dark:border-slate-800 text-slate-500'}`}
                 >
                   Agrupar por Unidade
                 </Button>
                 <Button 
                   variant={selectedPatternFilter === "OUT" ? "default" : "outline"}
                   onClick={() => {
                     setSelectedPatternFilter(prev => prev === "OUT" ? "ALL" : "OUT");
                     setCurrentPageTime(1);
                   }}
                   className={`h-7 text-[9px] font-black uppercase gap-1 transition-all ${
                     selectedPatternFilter === "OUT" 
                       ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-md scale-105" 
                       : "border-slate-200 dark:border-slate-800 text-slate-500"
                   }`}
                 >
                   <AlertTriangle className="h-3 w-3" /> Fora do Padrão
                 </Button>
                 <Button 
                   onClick={() => setIsJustifyDialogOpen(true)} 
                   disabled={filteredTimeVehicles.length === 0}
                   className="h-7 text-[9px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 gap-1"
                 >
                   <Mail className="h-3 w-3" /> Solicitar Justificativa
                 </Button>
                 <Button 
                    variant="outline"
                    onClick={handleExportTimeSummary}
                    className="h-7 w-7 p-0 border-slate-200 dark:border-slate-800"
                    title="Exportar resumo de uso"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-500" />
                  </Button>
                 <Select value={selectedTimeRangeFilter} onValueChange={(v) => {
                   setSelectedTimeRangeFilter(v);
                   setCurrentPageTime(1);
                 }}>
                   <SelectTrigger className="h-7 text-[9px] w-32 uppercase font-black border-slate-200 dark:border-slate-700">
                     <SelectValue placeholder="Faixa" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="ALL" className="text-[10px] font-bold uppercase">Todas Faixas</SelectItem>
                     <SelectItem value="00:00 - 08:00" className="text-[10px] font-bold uppercase">Madrugada</SelectItem>
                     <SelectItem value="08:00 - 11:59" className="text-[10px] font-bold uppercase">Manhã</SelectItem>
                     <SelectItem value="12:00 - 13:00" className="text-[10px] font-bold uppercase">Almoço</SelectItem>
                     <SelectItem value="13:01 - 17:00" className="text-[10px] font-bold uppercase">Tarde</SelectItem>
                     <SelectItem value="17:01 - 23:59" className="text-[10px] font-bold uppercase">Noite</SelectItem>
                   </SelectContent>
                 </Select>
                 <div className="relative w-32">
                   <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                   <Input 
                     placeholder="Placa..." 
                     className="pl-8 h-7 text-[9px] uppercase border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500" 
                     value={searchTermTime}
                     onChange={(e) => {
                       setSearchTermTime(e.target.value);
                       setCurrentPageTime(1);
                     }}
                   />
                 </div>
               </div>
             </div>
          </CardHeader>
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-x-auto">
            <ScrollArea className="h-[450px] w-full">
              <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30 sticky top-0 z-10 transition-colors">
                <TableRow className="hover:bg-transparent border-none text-[9px] font-black uppercase text-slate-400">
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">Placa</TableHead>
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">Data Transação</TableHead>
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">Faixa Horária</TableHead>
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">Hora</TableHead>
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">Motorista</TableHead>
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 uppercase">Gerência/Unidade</TableHead>
                  <TableHead className="h-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isGroupedByUnit ? (
                  groupedTimeVehicles.map(([unit, vehicles]) => (
                    <Fragment key={unit}>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/20">
                        <TableCell colSpan={7} className="py-1.5 px-4 text-[10px] font-black text-indigo-600 uppercase border-y border-slate-100 dark:border-slate-800 sticky top-8 z-[5] bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-sm">
                           {unit} ({vehicles.length})
                        </TableCell>
                      </TableRow>
                      {vehicles.map((v, i) => (
                        <TableRow key={`${unit}-${i}`} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2 text-xs font-black text-slate-700 dark:text-slate-300 pl-6">{v.placa}</TableCell>
                          <TableCell className="py-2 text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{v.dataStr}</TableCell>
                          <TableCell className="py-2">
                             <Badge variant="outline" className="text-[8px] h-4 font-bold border-slate-200 text-slate-500 uppercase w-fit whitespace-nowrap">
                               {rangeLabels[v.range] || v.range}
                             </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-[10px] font-black text-indigo-600 whitespace-nowrap">{v.horaStr}</TableCell>
                          <TableCell className="py-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px]">{v.motorista}</TableCell>
                          <TableCell className="py-2 text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{v.gerencia}</TableCell>
                          <TableCell className="py-2 text-right">
                            {v.outOfPattern && (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[8px] font-black uppercase h-4 px-1.5 gap-1">
                                <AlertTriangle className="h-2 w-2" /> Fora Padrão
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))
                ) : (
                  paginatedTime.map((v, i) => (
                    <TableRow key={i} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-2 text-xs font-black text-indigo-600">{v.placa}</TableCell>
                      <TableCell className="py-2 text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{v.dataStr}</TableCell>
                      <TableCell className="py-2">
                         <Badge variant="outline" className="text-[8px] h-4 font-bold border-slate-200 text-slate-500 uppercase w-fit whitespace-nowrap">
                           {rangeLabels[v.range] || v.range}
                         </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-[10px] font-black text-indigo-600 whitespace-nowrap">{v.horaStr}</TableCell>
                      <TableCell className="py-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px]">{v.motorista}</TableCell>
                      <TableCell className="py-2 text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{v.gerencia}</TableCell>
                      <TableCell className="py-2 text-right">
                        {v.outOfPattern && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[8px] font-black uppercase h-4 px-1.5 gap-1">
                            <AlertTriangle className="h-2 w-2" /> Fora Padrão
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          </div>
          <div className="flex items-center justify-between p-3 border-t bg-slate-50/30 rounded-b-xl">
             <span className="text-[8px] font-black text-slate-400 uppercase">Pág. {currentPageTime} de {Math.ceil(filteredTimeVehicles.length/itemsPerPage)}</span>
             <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPageTime === 1} onClick={() => setCurrentPageTime(p => p - 1)}><Filter className="h-3 w-3 rotate-90" /></Button>
               <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPageTime >= Math.ceil(filteredTimeVehicles.length/itemsPerPage)} onClick={() => setCurrentPageTime(p => p + 1)}><Filter className="h-3 w-3 -rotate-90" /></Button>
             </div>
          </div>
        </Card>

        {/* IRREGULAR TRANSACTIONS */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-t-4 border-t-rose-500">
           <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <div className="flex items-center gap-2">
                   <AlertCircle className="h-5 w-5 text-rose-500" />
                   <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Abastecimentos sem Ativo Correspondente</CardTitle>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <Button 
                   onClick={handleExportIrregular} 
                   variant="outline"
                   className="h-7 w-7 p-0 border-slate-200 dark:border-slate-800"
                   title="Baixar resumo para anexo"
                 >
                   <FileSpreadsheet className="h-3.5 w-3.5 text-rose-500" />
                 </Button>
                 <Button 
                   onClick={() => setIsEmailDialogOpen(true)} 
                   disabled={filteredIrregular.length === 0}
                   className="h-7 text-[9px] font-black uppercase bg-rose-600 hover:bg-rose-700 gap-1"
                 >
                   <Mail className="h-3 w-3" /> Notificar Gestor
                 </Button>
                 <div className="relative w-32">
                   <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                   <Input 
                     placeholder="Buscar..." 
                     className="pl-8 h-7 text-[9px] uppercase border-slate-200 dark:border-slate-700 focus-visible:ring-rose-500" 
                     value={searchTermUnknown}
                     onChange={(e) => {
                       setSearchTermUnknown(e.target.value);
                       setCurrentPageUnknown(1);
                     }}
                   />
                 </div>
               </div>
             </div>
          </CardHeader>
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-x-auto">
            <ScrollArea className="h-[400px] w-full">
              <div className="relative w-full">
                <Table className="min-w-[1000px]">
                <TableHeader className="bg-rose-50/30 dark:bg-rose-900/10 sticky top-0 z-10 transition-colors">
                  <TableRow className="hover:bg-transparent border-none uppercase text-[9px] font-black text-rose-800/60 dark:text-rose-400">
                    <TableHead className="h-8 bg-rose-50/30 dark:bg-rose-900/10 border-b border-rose-100/10">Placa</TableHead>
                    <TableHead className="h-8 bg-rose-50/30 dark:bg-rose-900/10 border-b border-rose-100/10">Condutor</TableHead>
                    <TableHead className="h-8 bg-rose-50/30 dark:bg-rose-900/10 border-b border-rose-100/10">Data Transação</TableHead>
                    <TableHead className="h-8 bg-rose-50/30 dark:bg-rose-900/10 border-b border-rose-100/10 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedIrregular.map((t, i) => (
                    <TableRow key={i} className="border-slate-50 dark:border-slate-800 hover:bg-rose-50/10 transition-colors">
                      <TableCell className="py-2 text-[10px] font-black text-rose-600">{t.placa}</TableCell>
                      <TableCell className="py-2 text-[9px] font-bold text-slate-500 uppercase">{t.motorista}</TableCell>
                      <TableCell className="py-2 text-[9px] text-slate-500">
                        {typeof t.data === 'string' ? t.data : (function() {
                          const d = new Date((t.data - 25569) * 86400 * 1000);
                          return isValid(d) ? format(d, 'dd/MM/yyyy HH:mm') : String(t.data);
                        })()}
                      </TableCell>
                      <TableCell className="py-2 text-[9px] text-right font-black text-slate-700 dark:text-slate-300">R$ {t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                    </TableRow>
                  ))}
                  {paginatedIrregular.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-[10px] font-bold uppercase text-slate-300 italic">
                        Nenhuma irregularidade encontrada no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          </div>
          <div className="flex items-center justify-between p-3 border-t bg-slate-50/30 rounded-b-xl">
             <span className="text-[8px] font-black text-slate-400 uppercase">Pág. {currentPageUnknown} de {Math.ceil(filteredIrregular.length/itemsPerPage)}</span>
             <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPageUnknown === 1} onClick={() => setCurrentPageUnknown(p => p - 1)}><Filter className="h-3 w-3 rotate-90" /></Button>
               <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPageUnknown >= Math.ceil(filteredIrregular.length/itemsPerPage)} onClick={() => setCurrentPageUnknown(p => p + 1)}><Filter className="h-3 w-3 -rotate-90" /></Button>
             </div>
          </div>
        </Card>
      </div>
    </div>

      {/* UNUTILIZED BEST PRICE DIALOG */}
      <Dialog open={isUnutilizedDialogOpen} onOpenChange={setIsUnutilizedDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl">
          <DialogHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-emerald-600 uppercase font-black tracking-tighter text-sm">
              <Mail className="h-4 w-4" /> Cobrança de Otimização de Abastecimento
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400 leading-tight pt-1">
              Enviar justificativa de abastecimento fora da frota pelo posto de menor preço.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Unidade Selecionada</label>
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">
                {selectedUnutilizedGerencia || "Nenhuma unidade selecionada"}
              </div>
            </div>

            {selectedUnutilizedRow && (
              <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 text-[10px] space-y-2 uppercase font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Cidade / Região:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedUnutilizedRow.cidade} ({selectedUnutilizedRow.regiao})</span>
                </div>
                <div className="flex justify-between">
                  <span>Combustível / Posto Recom.:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedUnutilizedRow.tipo} - {selectedUnutilizedRow.bestStationName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Melhor Preço Praticado:</span>
                  <span className="font-black text-emerald-600">R$ {selectedUnutilizedRow.bestPrice.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Volume Abastecido em Outros:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedUnutilizedRow.otherLitersPaid.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</span>
                </div>
                <div className="flex justify-between border-t border-emerald-100/30 pt-2 text-[11px]">
                  <span className="font-black text-emerald-700 dark:text-emerald-400">Desperdício Estimado:</span>
                  <span className="font-black text-rose-500">R$ {selectedUnutilizedRow.potentialSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsUnutilizedDialogOpen(false)}
              className="h-9 rounded-xl text-[10px] font-black uppercase shadow-none border-slate-200 dark:border-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendUnutilizedNotification}
              className="h-9 rounded-xl text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm"
            >
              Enviar Notificação por E-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMAIL DIALOG */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 uppercase font-black tracking-tighter">
              <Mail className="h-5 w-5" /> Notificação de Abastecimento Indevido
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">
              Selecione a gerência destinatária para gerar o e-mail de regularização.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Gerência / Unidade</label>
              <Select value={emailGerencia} onValueChange={(val) => {
                setEmailGerencia(val);
                setSearchEmailGerencia("");
              }}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder={isContactsLoading ? "Carregando Contatos..." : "Selecione a Gerência..."} />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <Input 
                      placeholder="Pesquisar gerência..." 
                      className="h-8 text-[11px] focus-visible:ring-indigo-500 border-slate-200 dark:border-slate-800 uppercase"
                      value={searchEmailGerencia}
                      onChange={(e) => setSearchEmailGerencia(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredEmailUnits.map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                  {filteredEmailUnits.length === 0 && (
                    <div className="p-2 text-center text-xs text-slate-400 font-bold uppercase">Nenhum resultado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {emailGerencia && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Contatos Encontrados</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  {getEmailsByGerencia(emailGerencia).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getEmailsByGerencia(emailGerencia).map((email: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-[9px] font-medium lowercase">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-500">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">Nenhum e-mail cadastrado para esta unidade</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-800/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase">Resumo da Notificação</p>
                  <p className="text-[11px] font-bold text-rose-600/80 leading-relaxed italic">
                    O e-mail conterá as {filteredIrregular.length} transações irregulares identificadas no período, totalizando R$ {filteredIrregular.reduce((sum, t) => sum + t.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)} className="text-[10px] font-black uppercase">Cancelar</Button>
            <Button onClick={handleSendEmail} className="bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase shadow-lg shadow-rose-200 dark:shadow-none h-10 px-6">
              Gerar E-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JUSTIFICATION DIALOG */}
      <Dialog open={isJustifyDialogOpen} onOpenChange={setIsJustifyDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600 uppercase font-black tracking-tighter">
              <Clock className="h-5 w-5" /> Justificativa de Uso Fora do Padrão
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">
              Solicite explicações para o uso de veículos em horários não convencionais.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Unidade Responsável</label>
              <Select value={justifyGerencia} onValueChange={(val) => {
                setJustifyGerencia(val);
                setSearchJustifyGerencia("");
              }}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder={isContactsLoading ? "Carregando Contatos..." : "Selecione a Unidade..."} />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <Input 
                      placeholder="Pesquisar unidade..." 
                      className="h-8 text-[11px] focus-visible:ring-indigo-500 border-slate-200 dark:border-slate-800 uppercase"
                      value={searchJustifyGerencia}
                      onChange={(e) => setSearchJustifyGerencia(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredJustifyUnits.map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                  {filteredJustifyUnits.length === 0 && (
                    <div className="p-2 text-center text-xs text-slate-400 font-bold uppercase">Nenhum resultado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {justifyGerencia && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Contatos Encontrados</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  {getEmailsByGerencia(justifyGerencia).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getEmailsByGerencia(justifyGerencia).map((email: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-[9px] font-medium lowercase">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-500">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">Nenhum e-mail cadastrado para esta unidade</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <div className="flex items-start gap-3">
                <History className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">Parametrização</p>
                  <p className="text-[11px] font-bold text-indigo-600/80 leading-relaxed italic">
                    Serão listados os veículos agrupados por placa da gerência selecionada, solicitando justificativa para uso fora do intervalo permitido (abastecimentos entre 19h e 06h).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsJustifyDialogOpen(false)} className="text-[10px] font-black uppercase">Cancelar</Button>
            <Button onClick={handleSendJustification} className="bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black uppercase shadow-lg shadow-indigo-200 dark:shadow-none h-10 px-6">
              Gerar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INCONSISTENCY EMAIL DIALOG */}
      <Dialog open={isInconsistencyEmailDialogOpen} onOpenChange={setIsInconsistencyEmailDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 uppercase font-black tracking-tighter">
              <AlertTriangle className="h-5 w-5" /> Inconsistência de KM/Horímetro
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">
              Notifique o gestor sobre a divergência detectada no abastecimento.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Unidade Responsável</label>
              <Select value={inconsistencyGerencia} onValueChange={(val) => {
                setInconsistencyGerencia(val);
                setSearchInconsistencyGerencia("");
              }}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase text-left">
                  <div className="truncate pr-4">
                    <SelectValue placeholder={isContactsLoading ? "Carregando Contatos..." : "Selecione a Unidade..."} />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <Input 
                      placeholder="Pesquisar unidade..." 
                      className="h-8 text-[11px] focus-visible:ring-indigo-500 border-slate-200 dark:border-slate-800 uppercase"
                      value={searchInconsistencyGerencia}
                      onChange={(e) => setSearchInconsistencyGerencia(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredInconsistencyUnits.map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                  {filteredInconsistencyUnits.length === 0 && (
                    <div className="p-2 text-center text-xs text-slate-400 font-bold uppercase">Nenhum resultado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {inconsistencyGerencia && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Contatos Encontrados</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  {getEmailsByGerencia(inconsistencyGerencia).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getEmailsByGerencia(inconsistencyGerencia).map((email: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-[9px] font-medium lowercase">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-500">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">Nenhum e-mail cadastrado para esta unidade</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedInconsistency && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">Placa</span>
                    <span className="text-[10px] font-black text-slate-600 uppercase">{selectedInconsistency.placa}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">Motivo</span>
                    <span className="text-[9px] font-bold text-amber-600 uppercase italic">{selectedInconsistency.motivo}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsInconsistencyEmailDialogOpen(false)} className="text-[10px] font-black uppercase">Cancelar</Button>
            <Button onClick={handleSendInconsistencyEmail} className="bg-amber-600 hover:bg-amber-700 text-[10px] font-black uppercase shadow-lg h-10 px-6">
              Enviar E-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GROUPED INCONSISTENCY EMAIL DIALOG */}
      <Dialog open={isGroupedInconsistencyEmailDialogOpen} onOpenChange={setIsGroupedInconsistencyEmailDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 uppercase font-black tracking-tighter">
              <Building2 className="h-5 w-5" /> Resumo de Divergências por Unidade
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">
              Solicite justificativas para todas as divergências de uma unidade específica.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Unidade Responsável</label>
              <Select value={groupedInconsistencyGerencia} onValueChange={(val) => {
                setGroupedInconsistencyGerencia(val);
                setSearchGroupedInconsistencyGerencia("");
              }}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder={isContactsLoading ? "Carregando Contatos..." : "Selecione a Unidade..."} />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <Input 
                      placeholder="Pesquisar unidade..." 
                      className="h-8 text-[11px] focus-visible:ring-indigo-500 border-slate-200 dark:border-slate-800 uppercase"
                      value={searchGroupedInconsistencyGerencia}
                      onChange={(e) => setSearchGroupedInconsistencyGerencia(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredGroupedInconsistencyUnits.map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                  {filteredGroupedInconsistencyUnits.length === 0 && (
                    <div className="p-2 text-center text-xs text-slate-400 font-bold uppercase">Nenhum resultado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {groupedInconsistencyGerencia && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Contatos Encontrados</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  {getEmailsByGerencia(groupedInconsistencyGerencia).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getEmailsByGerencia(groupedInconsistencyGerencia).map((email: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-[9px] font-medium lowercase">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-500">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">Nenhum e-mail cadastrado para esta unidade</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">E-mail Unificado</p>
                  <p className="text-[11px] font-bold text-amber-600/80 leading-relaxed italic">
                    Este e-mail agrupará todas as inconsistências de KM/Horímetro detectadas para a unidade selecionada no período atual.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsGroupedInconsistencyEmailDialogOpen(false)} className="text-[10px] font-black uppercase">Cancelar</Button>
            <Button onClick={handleSendGroupedInconsistencyEmail} className="bg-amber-600 hover:bg-amber-700 text-[10px] font-black text-white uppercase shadow-lg h-10 px-6">
              Gerar Resumo Unificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
