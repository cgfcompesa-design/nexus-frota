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
  FileSpreadsheet
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
import { toast } from "sonner";
import { useContactsData } from "@/hooks/useContactsData";
import { useSpecialHoursData } from "@/hooks/useFleetData";

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
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const itemsPerPage = 20;

  // Estados para o E-mail
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isJustifyDialogOpen, setIsJustifyDialogOpen] = useState(false);
  const [emailGerencia, setEmailGerencia] = useState("");
  const [justifyGerencia, setJustifyGerencia] = useState("");
  const [isInconsistencyEmailDialogOpen, setIsInconsistencyEmailDialogOpen] = useState(false);
  const [inconsistencyGerencia, setInconsistencyGerencia] = useState("");
  const [selectedInconsistency, setSelectedInconsistency] = useState<any>(null);

  const { getEmailsByGerencia } = useContactsData();

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
            
            // Check if Out of Pattern: Weekend OR (Mon-Fri and outside 08:00-17:00)
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isOutsideHours = hour < 8 || hour >= 17;
            
            const plateClean = String(f._placa || f.PLACA || f.Placa || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
            const asset = allAssetsMap.get(plateClean);
            const gerencia = asset?.GERENCIA || asset?.["GERÊNCIA"] || "N/A";
            const isSpecialPlate = specialHours.some(sh => sh.placa === plateClean) || (asset && (asset as any).OPERACAO_24H);
            const outOfPattern = (isWeekend || isOutsideHours) && !isSpecialPlate;

            vehiclesInRanges[rangeKey].push({
              placa: plateClean || "N/A",
              range: rangeKey,
              data: rawDate,
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

  const filteredIrregular = irregularTransactions.filter(t => 
    t.placa.includes(searchTermUnknown.toUpperCase()) || 
    t.motorista.toUpperCase().includes(searchTermUnknown.toUpperCase())
  );
  const paginatedIrregular = filteredIrregular.slice((currentPageUnknown - 1) * itemsPerPage, currentPageUnknown * itemsPerPage);

  const filteredTimeVehicles = timeAndDayAnalysis.vehicles.filter(v => {
    const matchesSearch = v.placa.toUpperCase().includes(searchTermTime.toUpperCase()) || 
                         v.motorista.toUpperCase().includes(searchTermTime.toUpperCase());
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
Nexus BI Frota`;

    const to = getEmailsByGerencia(emailGerencia).join(";");
    const cc = getCCEmails();
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

Com base no monitoramento do uso dos veículos corporativos, identificamos registros de utilização fora dos parâmetros estabelecidos para uso padrão, que compreende o período de segunda a sexta-feira, das 08h às 17h, com tolerância de 01 (uma) hora para mais ou para menos.

Dessa forma, solicitamos a gentileza de encaminhar a devida justificativa para a utilização dos veículos listados abaixo, considerando os filtros aplicados de data e horário:

${vehicleListText}

Ressaltamos que os referidos veículos não estão enquadrados na relação de uso padrão, sendo necessário o devido esclarecimento para fins de controle e conformidade interna.

Solicitamos que as justificativas sejam encaminhadas no prazo de até 02 (dois) dias úteis a contar do recebimento deste e-mail.

Em caso de dúvidas, permanecemos à disposição.

Atenciosamente,
Nexus BI Frota`;

    const to = getEmailsByGerencia(justifyGerencia).join(";");
    const cc = getCCEmails();
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
Nexus BI Frota`;

    const to = getEmailsByGerencia(inconsistencyGerencia).join(";");
    const cc = getCCEmails();
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setIsInconsistencyEmailDialogOpen(false);
    toast.success("E-mail de divergência preparado!");
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            </div>
          </CardHeader>
          <div className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-amber-50/30 dark:bg-amber-900/10">
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
                    <TableCell colSpan={7} className="h-24 text-center text-[10px] font-bold uppercase text-slate-300 italic">
                      Nenhuma divergência de hodômetro detectada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Veículos por Faixa Horária</CardTitle>
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
          <div className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[9px] font-black uppercase text-slate-400 h-8">Placa</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-slate-400 h-8">Data Transação</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-slate-400 h-8">Faixa</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-slate-400 h-8">Motorista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isGroupedByUnit ? (
                  groupedTimeVehicles.map(([unit, vehicles]) => (
                    <Fragment key={unit}>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/20">
                        <TableCell colSpan={5} className="py-1 px-4 text-[10px] font-black text-indigo-600 uppercase border-y border-slate-100 dark:border-slate-800">
                           {unit} ({vehicles.length})
                        </TableCell>
                      </TableRow>
                      {vehicles.map((v, i) => (
                        <TableRow key={`${unit}-${i}`} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2 text-xs font-black text-slate-700 dark:text-slate-300 pl-6">{v.placa}</TableCell>
                          <TableCell className="py-2 text-[10px] font-bold text-slate-500 uppercase">{v.dataStr} {v.horaStr}</TableCell>
                          <TableCell className="py-2">
                             <Badge variant="outline" className="text-[8px] h-4 font-bold border-slate-200 text-slate-500 uppercase">{v.range}</Badge>
                          </TableCell>
                          <TableCell className="py-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px]">{v.motorista}</TableCell>
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
                      <TableCell className="py-2 text-[10px] font-bold text-slate-500 uppercase">{v.dataStr} {v.horaStr}</TableCell>
                      <TableCell className="py-2">
                         <Badge variant="outline" className="text-[8px] h-4 font-bold border-slate-200 text-slate-500 uppercase">{v.range}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px]">{v.motorista}</TableCell>
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
          <div className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-rose-50/30 dark:bg-rose-900/10">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[9px] font-black uppercase text-rose-800/60 dark:text-rose-400 h-8">Placa</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-rose-800/60 dark:text-rose-400 h-8">Condutor</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-rose-800/60 dark:text-rose-400 h-8">Data</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-rose-800/60 dark:text-rose-400 h-8 text-right">Valor</TableHead>
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
              <Select value={emailGerencia} onValueChange={setEmailGerencia}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder="Selecione a Gerência..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {[...new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"]).filter(Boolean))].sort().map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Select value={justifyGerencia} onValueChange={setJustifyGerencia}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder="Selecione a Unidade..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {[...new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"]).filter(Boolean))].sort().map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <div className="flex items-start gap-3">
                <History className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">Parametrização</p>
                  <p className="text-[11px] font-bold text-indigo-600/80 leading-relaxed italic">
                    Serão listados os veículos agrupados por placa da gerência selecionada, solicitando justificativa para uso fora do intervalo 08h-17h (seg-sex).
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
              <Select value={inconsistencyGerencia} onValueChange={setInconsistencyGerencia}>
                <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase text-left">
                  <div className="truncate pr-4">
                    <SelectValue placeholder="Selecione a Unidade..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {[...new Set(assets.map(a => a.GERENCIA || a["GERÊNCIA"]).filter(Boolean))].sort().map(g => (
                    <SelectItem key={g} value={g} className="text-xs uppercase font-bold">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
    </div>
  );
}
