import { useState, useMemo } from "react";
import { useJustificativasData } from "@/hooks/useJustificativasData";
import { useAssets } from "@/hooks/useFleetData";
import { useStatusJustificativaGAD } from "@/hooks/useStatusJustificativaGAD";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { AlertTriangle, CheckCircle, Clock, Download, FileText, ExternalLink, Fuel, Gauge, X, Info, Calendar as CalendarIcon, Settings2, Droplets, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/exportToExcel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Helper functions (same as in the snippet provided by the user)
const getTankCapacityFromAsset = (
  asset: any,
  tipoCombustivelAbastecido: string
): { capacidade: number; tipo: string } => {
  if (!asset) {
    return { capacidade: 0, tipo: "não encontrado" };
  }

  const normalize = (value: unknown): string =>
    String(value || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const combustivelAbastecidoNorm = normalize(tipoCombustivelAbastecido);
  const combustivelPadraoNorm = normalize(asset["COMBUSTÍVEL PADRÃO"] || asset["COMBUSTIVEL PADRAO"]);
  const combustivelSecundarioNorm = normalize(asset["COMBUSTÍVEL SECUNDÁRIO"] || asset["COMBUSTIVEL SECUNDARIO"]);

  const capacidadePrincipalRaw =
    asset["CAPACIDADE TANQUE (L)"] ?? asset["CAPACIDADE TANQUE"] ?? asset["CAPACIDADE DO TANQUE"];
  const capacidadeSecundariaRaw =
    asset["CAPACIDADE TANQUE SECUNDÁRIO"] ?? asset["CAPACIDADE COMBUSTÍVEL SECUNDÁRIO"];

  const toNumber = (v: unknown): number => {
    if (v === undefined || v === null) return 0;
    if (typeof v === "number") return v;
    const parsed = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  };

  const capacidadePrincipal = toNumber(capacidadePrincipalRaw);
  const capacidadeSecundaria = toNumber(capacidadeSecundariaRaw);

  const matches = (a: string, b: string) => a && b && (a.includes(b) || b.includes(a));

  let capacidade = 0;
  let tipo = "não informado";

  if (combustivelAbastecidoNorm && combustivelPadraoNorm && matches(combustivelAbastecidoNorm, combustivelPadraoNorm)) {
    capacidade = capacidadePrincipal;
    tipo = "principal";
  } else if (
    combustivelAbastecidoNorm &&
    combustivelSecundarioNorm &&
    matches(combustivelAbastecidoNorm, combustivelSecundarioNorm)
  ) {
    capacidade = capacidadeSecundaria;
    tipo = "secundário";
  } else {
    capacidade = capacidadePrincipal || capacidadeSecundaria;
    tipo = capacidade === capacidadePrincipal ? "principal" : capacidade > 0 ? "secundário" : "não informado";
  }

  return { capacidade, tipo };
};

const parseNivelTanqueInformado = (nivel: string | undefined): { percentual: number; tag: string } => {
  if (!nivel) return { percentual: -1, tag: "Não informado" };
  const nivelLower = nivel.toLowerCase().trim();
  if (nivelLower.includes("vazio") || nivelLower.includes("reserva")) return { percentual: 10, tag: "Vazio/Reserva" };
  if (nivelLower === "1/4") return { percentual: 25, tag: "1/4" };
  if (nivelLower === "1/2") return { percentual: 50, tag: "1/2" };
  if (nivelLower === "3/4") return { percentual: 75, tag: "3/4" };
  if (nivelLower.includes("cheio") || nivelLower === "1/1") return { percentual: 100, tag: "Cheio 1/1" };
  return { percentual: -1, tag: nivel || "N/A" };
};

const getAbastecimentoTag = (percentual: number): { tag: string; color: string } => {
  if (percentual <= 0) return { tag: "N/A", color: "bg-muted text-muted-foreground" };
  if (percentual <= 15) return { tag: "Vazio/Reserva", color: "bg-red-500/20 text-red-600" };
  if (percentual <= 35) return { tag: "1/4", color: "bg-orange-500/20 text-orange-600" };
  if (percentual <= 60) return { tag: "1/2", color: "bg-yellow-500/20 text-yellow-600" };
  if (percentual <= 85) return { tag: "3/4", color: "bg-blue-500/20 text-blue-600" };
  return { tag: "Cheio 1/1", color: "bg-green-500/20 text-green-600" };
};

const parseDateBR = (dateString?: string): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => parseInt(p, 10));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

const checkNivelDivergencia = (
  litros: number,
  capacidade: number,
  nivelInformado: { percentual: number; tag: string },
  tipoCombustivel: string
): { hasDivergencia: boolean; motivo: string; detalhe: string } => {
  if (capacidade <= 0 || litros <= 0) return { hasDivergencia: false, motivo: "", detalhe: "" };
  
  const percentualAbastecido = (litros / capacidade) * 100;
  
  // 1. Nível Incompatível: % Abastecido > 100% da capacidade do tanque
  if (percentualAbastecido > 100) {
    return {
      hasDivergencia: true,
      motivo: "Nível Incompatível",
      detalhe: `Abasteceu ${percentualAbastecido.toFixed(1)}% da capacidade (Tanque: ${capacidade}L).`,
    };
  }

  // 2. Abastecimento Insuficiente: Tanque ≤ 10% (Vazio/Reserva) E abasteceu < 20% da capacidade
  if (nivelInformado.percentual <= 10 && percentualAbastecido < 20) {
    return {
      hasDivergencia: true,
      motivo: "Abastecimento Insuficiente",
      detalhe: `Tanque ${nivelInformado.tag} (≤10%), mas abasteceu apenas ${percentualAbastecido.toFixed(1)}% da capacidade.`,
    };
  }

  return { hasDivergencia: false, motivo: "", detalhe: "" };
};

const calculateOdometerDisparity = (
  hodometroTicket: number | undefined,
  hodometroEnviado: number | undefined,
  kmMedio: number,
  dataTransacao?: string,
  dataRetorno?: string
): { hasDisparity: boolean; difference: number; kmEsperado: number; diasDiferenca: number } => {
  if (!hodometroTicket || !hodometroEnviado) return { hasDisparity: false, difference: 0, kmEsperado: 0, diasDiferenca: 0 };
  
  // 1. Calcular a diferença: |Hodômetro Ticket - Hodômetro Enviado|
  const difference = Math.abs(hodometroTicket - hodometroEnviado);

  // 3. Calcular dias entre Data Transação e Data Retorno
  let diasDiferenca = 0;
  const dateTransacao = parseDateBR(dataTransacao);
  const dateRetorno = parseDateBR(dataRetorno);
  if (dateTransacao && dateRetorno) {
    const diffTime = Math.abs(dateRetorno.getTime() - dateTransacao.getTime());
    diasDiferenca = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // 4. Km Esperado = Km Médio × (Dias de Diferença + 1)
  const kmEsperado = kmMedio * (diasDiferenca + 1);

  // 5. Divergente se: Diferença > Km Esperado
  const hasDisparity = kmMedio > 0 && difference > kmEsperado;

  return { hasDisparity, difference, kmEsperado, diasDiferenca };
};

export function FuelJustificationsTab() {
  const { data: justifications = [], isLoading } = useJustificativasData();
  const { data: assets = [] } = useAssets();
  const { data: statusGADMap = new Map<string, string>() } = useStatusJustificativaGAD();
  
  const [searchPlaca, setSearchPlaca] = useState("");
  const [filterRetorno, setFilterRetorno] = useState<string>("todos");
  const [filterDivergencia, setFilterDivergencia] = useState<boolean>(true);
  const [filterTipoDesvio, setFilterTipoDesvio] = useState<string>("todos");
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedDiretorias, setSelectedDiretorias] = useState<string[]>([]);
  const [selectedGerencias, setSelectedGerencias] = useState<string[]>([]);
  
  const [configOpen, setConfigOpen] = useState(false);
  const [kmMinimoVariacao, setKmMinimoVariacao] = useState(2);
  const [tempoMinimoHoras, setTempoMinimoHoras] = useState(2);
  const [modoAlerta, setModoAlerta] = useState<"informativo" | "critico">("critico");

  const assetsByPlaca = useMemo(() => {
    const map = new Map();
    assets.forEach(asset => {
      const placa = asset.PLACA || asset.placa;
      if (placa) map.set(String(placa).toUpperCase(), asset);
    });
    return map;
  }, [assets]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const kmMedioPorPlaca = useMemo(() => {
    const placaMap = new Map<string, { totalKm: number; count: number }>();
    justifications.forEach(t => {
      const placa = (t.Placa || "").toUpperCase();
      // Calcular Km Médio: Soma de todos Km Rodados ÷ Quantidade de abastecimentos
      const kmRodados = parseFloat(String(t["Km Rodados ou Horas Trabalhadas"] || 0).replace(',', '.'));
      if (placa && !isNaN(kmRodados)) {
        if (!placaMap.has(placa)) placaMap.set(placa, { totalKm: 0, count: 0 });
        const data = placaMap.get(placa)!;
        data.totalKm += kmRodados;
        data.count += 1;
      }
    });
    const result = new Map<string, number>();
    placaMap.forEach((data, placa) => result.set(placa, data.count > 0 ? data.totalKm / data.count : 0));
    return result;
  }, [justifications]);

  const diretorias = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset) => {
      const dir = asset.DIRETORIA || asset.diretoria;
      if (dir) set.add(dir);
    });
    return Array.from(set).sort();
  }, [assets]);

  const gerencias = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset) => {
      const dir = asset.DIRETORIA || asset.diretoria;
      const ger = asset.GERENCIA || asset.gerencia;
      const matchesDiretoria = selectedDiretorias.length === 0 || selectedDiretorias.includes(dir || "");
      if (matchesDiretoria && ger) set.add(ger);
    });
    return Array.from(set).sort();
  }, [assets, selectedDiretorias]);

  const processedTransactions = useMemo(() => {
    const sorted = [...justifications].sort((a, b) => {
      const placaA = (a.Placa || a[5] || "").toUpperCase();
      const placaB = (b.Placa || b[5] || "").toUpperCase();
      if (placaA !== placaB) return placaA.localeCompare(placaB);
      const dateA = parseDateBR(a["Data da Transação"] || a[1]);
      const dateB = parseDateBR(b["Data da Transação"] || b[1]);
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });
    
    const odometrosRepetidos = new Set<string>();
    const abastecimentosConsecutivos = new Set<string>();
    const odometrosRepetidosConsecutivos = new Set<string>();
    
    const transacoesPorPlaca = new Map<string, any[]>();
    sorted.forEach(t => {
      const placa = (t.Placa || t[5] || "").toUpperCase();
      if (!transacoesPorPlaca.has(placa)) transacoesPorPlaca.set(placa, []);
      transacoesPorPlaca.get(placa)!.push(t);
    });
    
    transacoesPorPlaca.forEach((transacoesPlaca) => {
      const sortedByDate = [...transacoesPlaca].sort((a, b) => {
        const dateA = parseDateBR(a["Data da Transação"] || a[1]);
        const dateB = parseDateBR(b["Data da Transação"] || b[1]);
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
      });

      const odometroValues = new Map<number, string[]>();

      for (let i = 0; i < sortedByDate.length; i++) {
        const current = sortedByDate[i];
        const hodometroCurrent = parseFloat(String(current["Hodometro ou Horimetro (TICKET)"] || current[9] || 0).replace(',', '.'));
        const codCurrent = current["Cód. Transação"] || current[4] || "";
        const tipoCombCurrent = (current["Tipo Combustível"] || current[7] || "").toUpperCase();
        const dateCurrent = parseDateBR(current["Data da Transação"] || current[1]);

        if (!isNaN(hodometroCurrent)) {
          if (!odometroValues.has(hodometroCurrent)) odometroValues.set(hodometroCurrent, []);
          odometroValues.get(hodometroCurrent)!.push(codCurrent);
        }

        if (i > 0) {
          const prev = sortedByDate[i - 1];
          const datePrev = parseDateBR(prev["Data da Transação"] || prev[1]);
          const tipoCombPrev = (prev["Tipo Combustível"] || prev[7] || "").toUpperCase();
          const codPrev = prev["Cód. Transação"] || prev[4] || "";
          
          if (dateCurrent && datePrev && tipoCombCurrent === tipoCombPrev && tipoCombCurrent !== "") {
            const diffHours = Math.abs(dateCurrent.getTime() - datePrev.getTime()) / (1000 * 60 * 60);
            if (diffHours <= 12) {
              abastecimentosConsecutivos.add(codCurrent);
              abastecimentosConsecutivos.add(codPrev);
            }
          }
        }
      }

      odometroValues.forEach((cods) => {
        if (cods.length > 1) {
          cods.forEach(c => odometrosRepetidos.add(c));
        }
      });
    });
    
    return justifications.map(t => {
      const placa = (t.Placa || t[5] || "").toUpperCase();
      const tipoCombustivel = t["Tipo Combustível"] || t[7] || "";
      const litros = parseFloat(String(t.Litros || t[8] || 0).replace(',', '.'));
      const hodometroTicket = parseFloat(String(t["Hodometro ou Horimetro (TICKET)"] || t[9] || 0).replace(',', '.'));
      const hodometroEnviado = parseFloat(String(t["Hodômetro Enviado (FOTO)"] || t[22] || 0).replace(',', '.'));
      const kmMedio = kmMedioPorPlaca.get(placa) || 0;
      const codigoTransacao = t["Cód. Transação"] || t[4] || "";
      const dateTransacao = t["Data da Transação"] || t[1];
      const dateRetorno = t["Carimbo de data/hora"] || t[21];
      const dataTransacaoDisplay = dateTransacao || "";
      const dataRetornoDisplay = dateRetorno || "";
      
      const odometerDisparity = calculateOdometerDisparity(hodometroTicket, hodometroEnviado, kmMedio, dateTransacao, dateRetorno);
      const asset = assetsByPlaca.get(placa);
      const tankInfo = getTankCapacityFromAsset(asset, tipoCombustivel);
      const nivelTanqueRaw = t["Nível Tanque (L) / (FOTO)"] || t[16];
      const nivelInformado = parseNivelTanqueInformado(nivelTanqueRaw);
      const percentualAbastecido = tankInfo.capacidade > 0 ? (litros / tankInfo.capacidade) * 100 : 0;
      const nivelDivergencia = checkNivelDivergencia(litros, tankInfo.capacidade, nivelInformado, tipoCombustivel);
      
      const tipoDesvio: string[] = [];
      if (odometerDisparity.hasDisparity) tipoDesvio.push("Hodômetro Divergente");
      if (nivelDivergencia.hasDivergencia) tipoDesvio.push(nivelDivergencia.motivo);
      if (odometrosRepetidos.has(codigoTransacao)) tipoDesvio.push("Odômetro Repetido");
      if (abastecimentosConsecutivos.has(codigoTransacao)) tipoDesvio.push("Abastecimento Consecutivo");
      
      const hasRetorno = (t["Retorno Unidade"] || t[18]) && String(t["Retorno Unidade"] || t[18]).toLowerCase().includes("respondido");
      const diretoria = asset?.DIRETORIA || asset?.diretoria || "OUTROS";
      const gerencia = asset?.GERENCIA || asset?.gerencia || "OUTROS";
      const condutor = t.Condutor || t[11] || "NÃO IDENTIFICADO";
      
      return {
        ...t,
        codigoTransacao,
        placa,
        diretoria,
        gerencia,
        condutor,
        dateTransacao,
        dateRetorno,
        dataTransacaoDisplay,
        dataRetornoDisplay,
        hodometroTicket: t["Hodometro ou Horimetro (TICKET)"] || t[9] || "",
        hodometroEnviado: t["Hodômetro Enviado (FOTO)"] || t[22] || "",
        kmMedio,
        odometerDisparity,
        capacidadeTanque: tankInfo.capacidade,
        tipoTanque: tankInfo.tipo,
        nivelInformado,
        percentualAbastecido,
        abastecimentoTag: getAbastecimentoTag(percentualAbastecido),
        nivelDivergencia,
        tipoDesvio,
        hasRetorno,
        hasDivergencia: odometerDisparity.hasDisparity || nivelDivergencia.hasDivergencia || tipoDesvio.length > 0,
        alertaCritico: odometrosRepetidosConsecutivos.has(codigoTransacao) || (odometrosRepetidos.has(codigoTransacao) && modoAlerta === "critico"),
      };
    });
  }, [justifications, kmMedioPorPlaca, assetsByPlaca, kmMinimoVariacao, tempoMinimoHoras, modoAlerta]);

  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter(t => {
      const matchesPlaca = !searchPlaca || t.placa.includes(searchPlaca.toUpperCase());
      const matchesRetorno = filterRetorno === "todos" || (filterRetorno === "respondido" && t.hasRetorno) || (filterRetorno === "pendente" && !t.hasRetorno);
      const matchesDivergencia = !filterDivergencia || t.hasDivergencia;
      const matchesTipoDesvio = filterTipoDesvio === "todos" || t.tipoDesvio.includes(filterTipoDesvio);
      const transDate = parseDateBR(t.dataTransacaoDisplay);
      let matchesDate = true;
      if (dateFrom && transDate) matchesDate = matchesDate && transDate >= new Date(dateFrom.setHours(0, 0, 0, 0));
      if (dateTo && transDate) matchesDate = matchesDate && transDate <= new Date(dateTo.setHours(23, 59, 59, 999));
      const matchesDiretoria = selectedDiretorias.length === 0 || selectedDiretorias.includes(t.diretoria);
      const matchesGerencia = selectedGerencias.length === 0 || selectedGerencias.includes(t.gerencia);
      return matchesPlaca && matchesRetorno && matchesDivergencia && matchesTipoDesvio && matchesDate && matchesDiretoria && matchesGerencia;
    });
  }, [processedTransactions, searchPlaca, filterRetorno, filterDivergencia, filterTipoDesvio, dateFrom, dateTo, selectedDiretorias, selectedGerencias]);

  const deviationSummary = useMemo(() => {
    const summary: Record<string, { total: number; gerencias: Record<string, number> }> = {};
    
    filteredTransactions.forEach(t => {
      t.tipoDesvio.forEach(desvio => {
        if (!summary[desvio]) summary[desvio] = { total: 0, gerencias: {} };
        summary[desvio].total++;
        if (!summary[desvio].gerencias[t.gerencia]) summary[desvio].gerencias[t.gerencia] = 0;
        summary[desvio].gerencias[t.gerencia]++;
      });
    });

    return Object.entries(summary).sort((a, b) => b[1].total - a[1].total);
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const data: any[] = [];
    deviationSummary.forEach(([type, info]) => {
      data.push({
        name: type,
        total: info.total
      });
    });
    return data;
  }, [deviationSummary]);

  const topPlates = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.tipoDesvio.length > 0) {
        counts[t.placa] = (counts[t.placa] || 0) + t.tipoDesvio.length;
      }
    });
    return Object.entries(counts)
      .map(([placa, count]) => ({ name: placa, total: count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredTransactions]);

  // No page-blocking loading screen to keep tabs accessible immediately

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Retorno das Gerências</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os retornos e analise divergências</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => {
            const dataToExport = filteredTransactions.map(t => ({
              "Cód. Transação": t.codigoTransacao,
              "Placa": t.placa,
              "Data Transação": t["Data da Transação"],
              "Data Retorno": t["Carimbo de data/hora"],
              "Combustível": t["Tipo Combustível"],
              "Litros": t.Litros,
              "Hodôm. Ticket": t.hodometroTicket,
              "Hodôm. Enviado": t.hodometroEnviado,
              "Km Médio": t.kmMedio?.toFixed(2),
              "Verif. Hodôm.": t.odometerDisparity.hasDisparity ? "Divergente" : "OK",
              "Nível Informado": t.nivelInformado.tag,
              "% Abastecido": t.percentualAbastecido?.toFixed(1) + "%",
              "Divergências": t.tipoDesvio.join(", "),
              "Status": t.hasRetorno ? "Respondido" : "Pendente",
              "Anexo - Justificativa GAD": t["Anexo - Justificativa GAD"] || t["Anexo Enviado"],
              "Justificativa GAD": t["Justificativa GAD"] || t["Retorno Unidade"]
            }));
            exportToExcel(dataToExport, `Retorno_Justificativas_${new Date().toISOString().split('T')[0]}`, "Retorno");
            toast.success("Exportação realizada!");
          }} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas / Dashboards */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          <MetricCard
            title="Retornos Pendentes"
            value={processedTransactions.filter(t => !t.hasRetorno).length}
            icon={<Clock className="h-5 w-5" />}
            colorScheme="warning"
            centered
          />
          <MetricCard
            title="Retornos Respondidos"
            value={processedTransactions.filter(t => t.hasRetorno).length}
            icon={<CheckCircle className="h-5 w-5" />}
            colorScheme="success"
            centered
          />
          
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Hodômetro Divergente"
                  value={processedTransactions.filter(t => t.tipoDesvio.includes("Hodômetro Divergente")).length}
                  icon={<Gauge className="h-5 w-5" />}
                  colorScheme="danger"
                  centered
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="font-bold">Lógica de Cálculo:</p>
              <ol className="text-xs list-decimal pl-4 space-y-1">
                <li>Diferença: |Hodômetro Ticket - Hodômetro Enviado|</li>
                <li>Km Médio: Soma de Km Rodados ÷ Abastecimentos</li>
                <li>Dias: Diferença entre Transação e Retorno</li>
                <li>Km Esperado = Km Médio × (Dias + 1)</li>
                <li><span className="font-bold text-red-500">Alerta se: Diferença {">"} Km Esperado</span></li>
              </ol>
            </TooltipContent>
          </UITooltip>

          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Nível Incompatível"
                  value={processedTransactions.filter(t => t.tipoDesvio.includes("Nível Incompatível")).length}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  colorScheme="danger"
                  centered
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="font-bold">Lógica de Cálculo:</p>
              <ol className="text-xs list-decimal pl-4 space-y-1">
                <li>Obtenção da capacidade do tanque via modelo do veículo</li>
                <li>% Abastecido = (Litros ÷ Capacidade) × 100</li>
                <li><span className="font-bold text-red-500">Alerta se: % Abastecido {">"} 100% da capacidade</span></li>
              </ol>
            </TooltipContent>
          </UITooltip>

          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Abastecimento Insuficiente"
                  value={processedTransactions.filter(t => t.tipoDesvio.includes("Abastecimento Insuficiente")).length}
                  icon={<Droplets className="h-5 w-5" />}
                  colorScheme="danger"
                  centered
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="font-bold">Critério:</p>
              <ul className="text-xs list-disc pl-4 space-y-1">
                <li>Tanque informado como Vazio/Reserva (≤10%)</li>
                <li>E abasteceu menos de 20% da capacidade total do tanque</li>
              </ul>
            </TooltipContent>
          </UITooltip>

          <MetricCard
            title="Sem Desvio"
            value={processedTransactions.filter(t => t.tipoDesvio.length === 0).length}
            icon={<CheckCircle className="h-5 w-5" />}
            colorScheme="primary"
            centered
          />

          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Odômetro Repetido"
                  value={processedTransactions.filter(t => t.tipoDesvio.includes("Odômetro Repetido")).length}
                  icon={<Activity className="h-5 w-5" />}
                  colorScheme="danger"
                  centered
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="font-bold">Critério:</p>
              <ul className="text-xs list-disc pl-4 space-y-1">
                <li>Mesmo valor de hodômetro/horímetro aparece mais de uma vez para a mesma placa</li>
              </ul>
            </TooltipContent>
          </UITooltip>

          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Abastecimento Consecutivo"
                  value={processedTransactions.filter(t => t.tipoDesvio.includes("Abastecimento Consecutivo")).length}
                  icon={<Fuel className="h-5 w-5" />}
                  colorScheme="danger"
                  centered
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="font-bold">Critério:</p>
              <ul className="text-xs list-disc pl-4 space-y-1">
                <li>Abastecimentos do mesmo tipo de combustível</li>
                <li>Intervalo entre transações consecutivas ≤ 12 horas</li>
              </ul>
            </TooltipContent>
          </UITooltip>
        </div>
      </TooltipProvider>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard title="Frequência de Desvios" className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
              />
              <Bar dataKey="total" fill="hsl(210, 100%, 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Resumo Geral de Desvios" className="h-[400px]">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 pt-2">
              {deviationSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground italic">
                  Nenhum desvio encontrado com os filtros atuais.
                </div>
              ) : deviationSummary.map(([type, info]) => (
                <div key={type} className="space-y-2 pb-2 border-b last:border-0 border-dashed">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{type}</span>
                    <Badge variant="destructive">{info.total} Ocorrências</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(info.gerencias).slice(0, 5).map(([ger, count]) => (
                      <Badge key={ger} variant="outline" className="text-[10px] bg-muted/30">
                        {ger}: {count}
                      </Badge>
                    ))}
                    {Object.keys(info.gerencias).length > 5 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        + {Object.keys(info.gerencias).length - 5} outras gerências
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </ChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard title="Legenda de Desvios" className="h-[350px]">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="w-4 h-4 p-0 rounded-full" />
                <span className="text-xs font-bold">Crítico:</span>
                <span className="text-[10px] text-muted-foreground">Hodômetro Divergente, Nível Incompatível, Odômetro Repetido, Abastecimento Consecutivo.</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-4 h-4 p-0 rounded-full bg-yellow-500/20" />
                <span className="text-xs font-bold">Alerta:</span>
                <span className="text-[10px] text-muted-foreground">Abastecimento Insuficiente.</span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-md italic">
              "Os dados são processados em tempo real com base no retorno das unidades e nas fotos enviadas via aplicativo."
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4 items-end">
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <Label className="text-xs">Buscar Placa</Label>
          <Input 
            placeholder="Ex: ABC1D23" 
            value={searchPlaca} 
            onChange={(e) => setSearchPlaca(e.target.value.toUpperCase())} 
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <Label className="text-xs">Status Retorno</Label>
          <Select value={filterRetorno} onValueChange={setFilterRetorno}>
            <SelectTrigger>
              <SelectValue placeholder="Retorno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="respondido">Respondidos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <Label className="text-xs">Tipo de Desvio</Label>
          <Select value={filterTipoDesvio} onValueChange={setFilterTipoDesvio}>
            <SelectTrigger>
              <SelectValue placeholder="Desvio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="Hodômetro Divergente">Hodômetro Divergente</SelectItem>
              <SelectItem value="Nível Incompatível">Nível Incompatível</SelectItem>
              <SelectItem value="Abastecimento Insuficiente">Abastecimento Insuficiente</SelectItem>
              <SelectItem value="Odômetro Repetido">Odômetro Repetido</SelectItem>
              <SelectItem value="Abastecimento Consecutivo">Abastecimento Consecutivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Data de:</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Até:</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <Label className="text-xs">Diretoria</Label>
          <Select value={selectedDiretorias[0] || "todos"} onValueChange={(val) => setSelectedDiretorias(val === "todos" ? [] : [val])}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {diretorias.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <Label className="text-xs">Gerência</Label>
          <Select value={selectedGerencias[0] || "todos"} onValueChange={(val) => setSelectedGerencias(val === "todos" ? [] : [val])}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {gerencias.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2 h-full pb-0.5">
          <Switch id="div-s" checked={filterDivergencia} onCheckedChange={setFilterDivergencia} />
          <Label htmlFor="div-s" className="text-sm">Apenas divergências</Label>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            setSearchPlaca("");
            setFilterRetorno("todos");
            setFilterTipoDesvio("todos");
            setFilterDivergencia(false);
            setDateFrom(undefined);
            setDateTo(undefined);
            setSelectedDiretorias([]);
            setSelectedGerencias([]);
          }}
          className="ml-auto"
        >
          Limpar Filtros
        </Button>
      </div>

      <ChartCard title={`TRANSAÇÕES (${filteredTransactions.length})`} className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Cód. Transação</TableHead>
                <TableHead className="whitespace-nowrap">Placa</TableHead>
                <TableHead className="whitespace-nowrap">Data Transação</TableHead>
                <TableHead className="whitespace-nowrap">Data Retorno</TableHead>
                <TableHead className="whitespace-nowrap">Combustível</TableHead>
                <TableHead className="whitespace-nowrap">Litros</TableHead>
                <TableHead className="whitespace-nowrap">Hodôm. Ticket</TableHead>
                <TableHead className="whitespace-nowrap">Hodôm. Enviado</TableHead>
                <TableHead className="whitespace-nowrap">Km Médio</TableHead>
                <TableHead className="whitespace-nowrap">Verif. Hodôm.</TableHead>
                <TableHead className="whitespace-nowrap">Nível Informado</TableHead>
                <TableHead className="whitespace-nowrap">% Abastecido</TableHead>
                <TableHead className="whitespace-nowrap">Divergências</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Anexo - Justificativa GAD</TableHead>
                <TableHead className="whitespace-nowrap">Justificativa GAD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((t, idx) => (
                <TableRow key={`${t.codigoTransacao}-${idx}`} className={t.hasDivergencia ? "bg-red-500/5 hover:bg-red-500/10" : ""}>
                  <TableCell className="font-mono text-[10px] opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {t.codigoTransacao}
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <div className="flex flex-col">
                      <span className="font-bold">{t.placa}</span>
                      <span className="text-[10px] text-muted-foreground uppercase truncate" title={t.gerencia}>
                        {t.gerencia}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-600 font-semibold">{t.dataTransacaoDisplay}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{t.codigoTransacao}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {t.dataRetornoDisplay || "-"}
                  </TableCell>
                  <TableCell className="text-[11px] max-w-[120px] truncate" title={t["Tipo Combustível"]}>
                    {t["Tipo Combustível"]}
                  </TableCell>
                  <TableCell className="font-medium text-right pr-4">{t.Litros}</TableCell>
                  <TableCell className="text-right pr-4">{t.hodometroTicket}</TableCell>
                  <TableCell className={cn("text-right pr-4", t.odometerDisparity.hasDisparity ? "text-red-600 font-bold" : "")}>
                    {t.hodometroEnviado}
                  </TableCell>
                  <TableCell className="text-xs text-right pr-4">{t.kmMedio?.toFixed(2)}</TableCell>
                  <TableCell>
                    {t.odometerDisparity.hasDisparity ? (
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive" className="cursor-help">Divergente</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <p>Diferença: {t.odometerDisparity.difference} km</p>
                            <p>Esperado: {t.odometerDisparity.kmEsperado.toFixed(1)} km</p>
                            <p>Dias: {t.odometerDisparity.diasDiferenca}</p>
                          </div>
                        </TooltipContent>
                      </UITooltip>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50/50">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] py-0", t.abastecimentoTag.color)}>{t.nivelInformado.tag}</Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-right">
                    {t.percentualAbastecido?.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {t.tipoDesvio.map((d, i) => (
                        <Badge key={i} variant="destructive" className="text-[9px] py-0 px-1 leading-tight">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.hasRetorno ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] py-0">Respondido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(t["Anexo - Justificativa GAD"] || t["Anexo Enviado"]) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={t["Anexo - Justificativa GAD"] || t["Anexo Enviado"]} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-[10px] opacity-80" title={t["Justificativa GAD"] || t["Retorno Unidade"]}>
                    {t["Justificativa GAD"] || t["Retorno Unidade"]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Paginação */}
        <div className="flex items-center justify-between p-4 border-t">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length} registros
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage * itemsPerPage >= filteredTransactions.length}
            >
              Próximo
            </Button>
          </div>
        </div>
      </ChartCard>

      {/* Modal de Configuração */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Configuração de Odômetro Repetido
            </DialogTitle>
            <DialogDescription>
              Ajuste os critérios para detecção de alertas de odômetros repetidos e abastecimentos consecutivos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Modo de Alerta</Label>
                <div className="flex bg-muted p-1 rounded-md">
                  <Button 
                    variant={modoAlerta === "informativo" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="h-8 px-3"
                    onClick={() => setModoAlerta("informativo")}
                  >
                    Informativo
                  </Button>
                  <Button 
                    variant={modoAlerta === "critico" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="h-8 px-3"
                    onClick={() => setModoAlerta("critico")}
                  >
                    Crítico
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Variação mínima de Km (km)</Label>
                  <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{kmMinimoVariacao} km</span>
                </div>
                <Slider 
                  value={[kmMinimoVariacao]} 
                  onValueChange={(vals) => setKmMinimoVariacao(vals[0])} 
                  max={50} 
                  step={1} 
                />
                <p className="text-[10px] text-muted-foreground">Diferença de odômetro abaixo deste valor gera alerta</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Intervalo mínimo de tempo (horas)</Label>
                  <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{tempoMinimoHoras}h</span>
                </div>
                <Slider 
                  value={[tempoMinimoHoras]} 
                  onValueChange={(vals) => setTempoMinimoHoras(vals[0])} 
                  max={24} 
                  step={0.5} 
                />
                <p className="text-[10px] text-muted-foreground">Eventos dentro deste intervalo são considerados suspeitos</p>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 space-y-2 border">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Info className="h-3 w-3" />
                Regra atual:
              </div>
              <p className="text-xs leading-relaxed">
                Gera alerta <span className={cn("font-bold uppercase", modoAlerta === "critico" ? "text-red-600" : "text-blue-600")}>{modoAlerta}</span> quando a diferença de odômetro for ≤ <span className="font-bold">{kmMinimoVariacao} km</span> e o intervalo entre eventos for ≤ <span className="font-bold">{tempoMinimoHoras} horas</span>.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => setConfigOpen(false)}>Concluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
