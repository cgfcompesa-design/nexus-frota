import React, { useState, useMemo, useEffect } from "react";
import { 
  Upload, 
  Activity, 
  FileText, 
  AlertTriangle, 
  Gauge, 
  MapPin, 
  CheckCircle2, 
  Download, 
  Search, 
  Calendar, 
  User, 
  Clock,
  Car,
  FileSpreadsheet,
  FileCode,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Info,
  Mail,
  Send,
  Users,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckSquare,
  Square,
  Trash2
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot, 
  query 
} from "firebase/firestore";
import { useContactsData } from "@/hooks/useContactsData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportToExcel";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// UTILITY FUNCTIONS TO MATCH THE VBA MACRO LOGIC

// 1. Clean Plate
function limparPlaca(txt: string): string {
  if (!txt) return "";
  return txt.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// 2. Clean Text
function limparTexto(txt: string): string {
  if (!txt) return "";
  return txt
    .replace(/[\u00a0\t\r\n]/g, "") // remove tabs, cr, lf, non-breaking space
    .trim();
}

// 3. Clean Driver
function limparMotorista(txt: string): string {
  const cleaned = limparTexto(txt).toUpperCase().replace(/\s/g, "");
  if (!cleaned ||
      cleaned === "-" ||
      cleaned === "--" ||
      cleaned === "---" ||
      cleaned === "N/A" ||
      cleaned === "NA" ||
      cleaned === "NULL" ||
      cleaned === "SEM" ||
      cleaned === "SEMMOTORISTA" ||
      cleaned === "0" ||
      cleaned.length <= 2) {
    return "";
  }
  return cleaned;
}

// 4. Address Compatibility (VBA rule)
function enderecoCompativel(end1: string, end2: string): boolean {
  if (!end1 || !end2) return true; // Se um campo for vazio, a macro considera compatível
  
  let e1 = end1.toUpperCase();
  let e2 = end2.toUpperCase();
  
  const termsToRemove = ["POSTO", "AUTO", "COMBUSTIVEIS", "COMBUSTÍVEIS", "LTDA"];
  termsToRemove.forEach(term => {
    e1 = e1.replaceAll(term, "");
    e2 = e2.replaceAll(term, "");
  });
  
  e1 = e1.replaceAll("-", " ").trim();
  e2 = e2.replaceAll("-", " ").trim();
  
  if (!e1 || !e2) return true;
  
  e1 = e1.replace(/\s+/g, " ");
  e2 = e2.replace(/\s+/g, " ");
  
  return e1.includes(e2) || e2.includes(e1);
}

// 5. Robust Full Date-Time Parser
export function parseFullDateTime(dateVal: any): Date | null {
  if (!dateVal) return null;
  
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }
  
  try {
    const str = String(dateVal).trim();
    
    // Check if it's an Excel serial number
    if (/^\d+(\.\d+)?$/.test(str)) {
      const num = parseFloat(str);
      const date = new Date((num - 25569) * 86400 * 1000);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() + tzOffset);
    }
    
    if (str.includes("T")) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    
    const parts = str.split(/[\s]+/);
    const datePart = parts[0];
    const timePart = parts[1] || "00:00:00";
    
    const dParts = datePart.split(/[\/\-]/);
    const tParts = timePart.split(":");
    
    if (dParts.length === 3) {
      let day = 1;
      let month = 0;
      let year = 2026;
      
      if (dParts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        day = parseInt(dParts[2], 10);
      } else {
        // DD/MM/YYYY
        day = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        year = parseInt(dParts[2], 10);
      }
      
      if (year < 100) year += 2000;
      
      const hours = parseInt(tParts[0] || "0", 10);
      const minutes = parseInt(tParts[1] || "0", 10);
      const seconds = parseInt(tParts[2] || "0", 10);
      
      const date = new Date(year, month, day, hours, minutes, seconds);
      return isNaN(date.getTime()) ? null : date;
    }
    
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

interface TelemetryRow {
  dataHoraStr: string;
  dataHora: Date | null;
  ig: string;
  endereco: string;
  vel: number;
  hod: number;
  hor: string;
  tx: string;
  motorista: string;
  lat: number;
  lng: number;
  motivoTx: string;
  contador: string;
  tensao: string;
  temp: string;
}

interface DeviationItem {
  placa: string;
  dataAbast: string;
  status: string;
  desvio: string;
  difMin: string | number;
  motoristaTelem: string;
  ignicao: string;
  obs: string;
  litros?: number;
  posto?: string;
  motoristaAbast?: string;
}

function formatDateToInputString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseTelemetryHtml(fileName: string, htmlText: string): {
  fileName: string;
  placa: string;
  periodo: string;
  rows: TelemetryRow[];
} | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // 1. Identify Placa from report head
  let filePlaca = "";
  const bTags = Array.from(doc.getElementsByTagName("b"));
  
  // Look for exact matches in bold tags
  for (const b of bTags) {
    const txt = b.textContent?.trim() || "";
    if (/^[A-Z]{3}\d[A-Z0-9]\d{2}$|^[A-Z]{3}\d{4}$/i.test(txt)) {
      filePlaca = txt.toUpperCase();
      break;
    }
  }
  
  if (!filePlaca) {
    const bodyText = doc.body.textContent || "";
    const match = bodyText.match(/Placa:\s*([A-Z]{3}[A-Z0-9]{4})/i) || bodyText.match(/PCA\d{4}|[A-Z]{3}-?\d{4}/i);
    if (match) {
      filePlaca = match[0].replace(/Placa:\s*/i, "").replace("-", "").toUpperCase().trim();
    }
  }

  // 2. Identify Period / Date
  let filePeriod = "";
  for (const b of bTags) {
    if (b.previousSibling && b.previousSibling.nodeValue && b.previousSibling.nodeValue.includes("Período:")) {
      filePeriod = b.textContent?.trim() || "";
      break;
    }
  }

  // 3. Parse positioning rows
  const trs = Array.from(doc.querySelectorAll("tr[id]"));
  const telemetryRows: TelemetryRow[] = [];

  trs.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length >= 10) {
      const dataHoraStr = tds[0]?.textContent?.trim() || "";
      const dataHora = parseFullDateTime(dataHoraStr);
      const ig = tds[1]?.textContent?.trim() || "";
      
      let endereco = "";
      const link = tds[2]?.querySelector("a");
      if (link) {
        endereco = link.getAttribute("title") || link.textContent?.trim() || tds[2]?.textContent?.trim() || "";
      } else {
        endereco = tds[2]?.textContent?.trim() || "";
      }

      const vel = parseFloat(tds[3]?.textContent?.replace(",", ".").trim() || "0") || 0;
      const hod = parseFloat(tds[4]?.textContent?.trim() || "0") || 0;
      const hor = tds[5]?.textContent?.trim() || "";
      const tx = tds[6]?.textContent?.trim() || "";
      const motorista = tds[7]?.textContent?.trim() || "";
      const lat = parseFloat(tds[8]?.textContent?.trim() || "0") || 0;
      const lng = parseFloat(tds[9]?.textContent?.trim() || "0") || 0;

      const motivoTx = tds[10]?.textContent?.trim() || "";
      const contador = tds[11]?.textContent?.trim() || "";
      const tensao = tds[12]?.textContent?.trim() || "";
      const temp = tds[13]?.textContent?.trim() || "";

      telemetryRows.push({
        dataHoraStr,
        dataHora,
        ig,
        endereco,
        vel,
        hod,
        hor,
        tx,
        motorista,
        lat,
        lng,
        motivoTx,
        contador,
        tensao,
        temp
      });
    }
  });

  if (telemetryRows.length === 0) {
    return null;
  }

  return {
    fileName,
    placa: filePlaca || "Não Identificada",
    periodo: filePeriod || "Não Informado",
    rows: telemetryRows
  };
}

export default function AbastTelemetriaTab({ fuel = [], assets = [] }: { fuel: any[], assets: any[] }) {
  const { getEmailsByGerencia } = useContactsData();

  const [selectedPlaca, setSelectedPlaca] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [strictDrivers, setStrictDrivers] = useState<boolean>(false);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // New Interactive Calendar and Asset Selection States
  const [selectedCalendarAssetType, setSelectedCalendarAssetType] = useState<string>("all");
  const [viewDate, setViewDate] = useState<Date>(() => new Date(2026, 4, 19)); // Maio de 2026

  // Realtime Calendar Selections State
  const [savedSelections, setSavedSelections] = useState<Record<string, string[]>>({});
  const [savingSelection, setSavingSelection] = useState<boolean>(false);

  // Handle local state edit of checked asset types during an active selection session
  const [localCheckedTypes, setLocalCheckedTypes] = useState<string[]>([]);

  // Calculate unique asset types across the actual fleet
  const allAssetTypes = useMemo(() => {
    const typesSet = new Set<string>();
    assets.forEach(a => {
      const t = String(a.TIPO || a.Tipo || a["TIPO VEICULO"] || "").trim().toUpperCase();
      if (t && t !== "N/A" && t !== "UNDEFINED") {
        typesSet.add(t);
      }
    });
    // Fallback static list if no assets exist yet or are empty
    if (typesSet.size === 0) {
      ["CAMINHÃO", "UTILITÁRIO", "LEVE", "PESADO", "MOTOCICLETA", "MÁQUINA/GERADOR"].forEach(t => typesSet.add(t));
    }
    return Array.from(typesSet).sort();
  }, [assets]);

  // Sync snapshot of calendar_selections collection
  useEffect(() => {
    const q = query(collection(db, "calendar_selections"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const selections: Record<string, string[]> = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date && Array.isArray(data.selectedTypes)) {
          selections[data.date] = data.selectedTypes;
        }
      });
      setSavedSelections(selections);
    }, (error) => {
      console.error("Erro ao carregar seleções do Firestore:", error);
    });
    return () => unsubscribe();
  }, []);

  // Sync local selection when active startDate changes OR when saved selections update
  useEffect(() => {
    if (startDate) {
      setLocalCheckedTypes(savedSelections[startDate] || []);
    } else {
      setLocalCheckedTypes([]);
    }
  }, [startDate, savedSelections]);

  const handleSaveSelection = async (dateStr: string, selectedTypes: string[]) => {
    if (!dateStr) return;
    setSavingSelection(true);
    try {
      const userEmail = auth.currentUser?.email || "cgf.compesa@gmail.com";
      const docRef = doc(db, "calendar_selections", dateStr);
      await setDoc(docRef, {
        date: dateStr,
        selectedTypes: selectedTypes,
        updatedBy: userEmail,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Tipos de ativo salvos com sucesso para a data ${new Date(dateStr + "T12:00:00").toLocaleDateString('pt-BR')}!`);
    } catch (err) {
      console.error("Erro ao salvar seleções:", err);
      toast.error("Não foi possível salvar os tipos de ativos. Verifique as permissões de gravação.");
    } finally {
      setSavingSelection(false);
    }
  };

  const handleClearSelectionForDate = async (dateStr: string) => {
    if (!dateStr) return;
    setSavingSelection(true);
    try {
      const docRef = doc(db, "calendar_selections", dateStr);
      await deleteDoc(docRef);
      setLocalCheckedTypes([]);
      toast.info(`Configurações de ativos removidas para ${new Date(dateStr + "T12:00:00").toLocaleDateString('pt-BR')}.`);
    } catch (err) {
      console.error("Erro ao excluir seleção:", err);
      toast.error("Erro ao apagar o registro do calendário.");
    } finally {
      setSavingSelection(false);
    }
  };

  const assetsByPlaca = useMemo(() => {
    const map = new Map<string, any>();
    assets.forEach(a => {
      const p = limparPlaca(a.PLACA || a.placa);
      if (p) map.set(p, a);
    });
    return map;
  }, [assets]);

  // Email Notification Modal States
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
  const [selectedRowForEmail, setSelectedRowForEmail] = useState<DeviationItem | null>(null);
  const [emailGerencia, setEmailGerencia] = useState<string>("");
  const [emailDestinatarios, setEmailDestinatarios] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");

  const handleOpenEmailModal = (row: DeviationItem, isStopAudit = false, stopEvent?: any) => {
    const cleanPlaca = limparPlaca(row.placa);
    const asset = assets.find(a => limparPlaca(a.PLACA || a.placa) === cleanPlaca);
    
    const gerenciaName = asset?.GERENCIA || asset?.gerencia || asset?.["GERÊNCIA"] || "FROTA CENTRAL";
    const marca = asset?.MARCA || asset?.marca || "N/A";
    const modelo = asset?.MODELO || asset?.modelo || "N/A";
    
    const emailsList = getEmailsByGerencia(gerenciaName);
    const emailsToUse = emailsList.join("; ");
    
    let subject = "";
    let bodyText = "";

    if (isStopAudit && stopEvent) {
      subject = `Notificação de Ocorrência - Auditoria de Parada - veículo ${row.placa}`;
      
      const motorista = stopEvent.initialRow?.motorista || "Não Informado";
      const local = stopEvent.address || "Não Informado";
      const data = stopEvent.startDateTime.toLocaleDateString('pt-BR');
      const horario = `${stopEvent.startDateTime.toLocaleTimeString('pt-BR')} até ${stopEvent.endDateTime.toLocaleTimeString('pt-BR')} (Duração: ${stopEvent.duration} min)`;
      const desvio = `Parada Prolongada não Autorizada em Local de Lazer/Comércio (${stopEvent.duration} min)`;

      bodyText = `Prezado(a) Gestor(a),

Ao analisarmos os relatórios e documentos em anexo (Relatório de Telemetria), identificamos ocorrência relacionada ao veículo de placa *${row.placa}*, que necessita de esclarecimentos.

A ocorrência apontada é a seguinte:

* Desvio identificado: *${desvio}*.
* Data da ocorrência: *${data}*.
* Horário: *${horario}*.
* Local: *${local}*.
* Condutor identificado: ${motorista}

Diante do exposto, solicitamos, por gentileza, o envio dos devidos esclarecimentos acerca da ocorrência identificada, informando, quando aplicável, se a situação possuía autorização prévia, se estava relacionada a alguma demanda emergencial ou excepcional da unidade ou se há outra justificativa pertinente.

Solicitamos que os esclarecimentos sejam encaminhados no prazo de até **2 (dois) dias úteis**, a fim de subsidiar as análises e eventuais providências administrativas.

Informamos que, em caso de ausência de manifestação dentro do prazo estabelecido, poderão ser adotadas as medidas administrativas cabíveis, inclusive o bloqueio do cartão de abastecimento, quando aplicável.

Contamos com a colaboração de todos para o cumprimento das diretrizes de utilização dos veículos da frota, contribuindo para a eficiência na gestão dos recursos, a segurança das operações e a adequada prestação dos serviços.

Atenciosamente,

Coordenação de Gestão de Frotas – CGF`;
    } else {
      subject = `Solicitação de Esclarecimentos - Inconsistências Identificadas em Relatório de Abastecimento x Telemetria, veículo ${row.placa}`;
      
      const desvioTxt = `Desvio identificado: ${row.desvio}
Data do Abastecimento: ${row.dataAbast}
Posto: ${row.posto || "N/A"}
Detalhe do Cruzamento: ${row.obs}`;

      bodyText = `Prezado(a) Gestor(a),

Ao analisarmos o relatório em anexo, identificamos inconsistência relacionada ao veículo de placa ${row.placa}, marca ${marca}, modelo ${modelo}, que necessita de esclarecimentos.

A ocorrência apontada é a seguinte:
- ${desvioTxt}

Diante do exposto, solicitamos, por gentileza, o envio dos devidos esclarecimentos acerca da ocorrência apresentada no relatório, no prazo de até 2 (dois) dias úteis.
Informamos que, em caso de ausência de retorno dentro do prazo estabelecido, o cartão de abastecimento poderá ser bloqueado.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;
    }

    setSelectedRowForEmail(row);
    setEmailGerencia(gerenciaName);
    setEmailDestinatarios(emailsToUse || "");
    setEmailSubject(subject);
    setEmailBody(bodyText);
    setEmailModalOpen(true);
  };

  const handleSendEmail = () => {
    const cc = "gadabastecimento@compesa.com.br;gadmonitoramento@compesa.com.br";
    const mailto = `mailto:${encodeURIComponent(emailDestinatarios)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}&cc=${encodeURIComponent(cc)}`;
    window.location.href = mailto;
    setEmailModalOpen(false);
    toast.success("Notificação enviada para o cliente de e-mail!");
  };
  
  // Telemetry parsed files state
  const [telemetryFiles, setTelemetryFiles] = useState<Array<{
    fileName: string;
    placa: string;
    periodo: string;
    rows: TelemetryRow[];
  }>>([]);

  // --- Stationary Vehicle Stop Detection & AI Classification States ---
  const [stationaryTimeThreshold, setStationaryTimeThreshold] = useState<number>(30);
  const [stationaryRadiusThreshold, setStationaryRadiusThreshold] = useState<number>(100);
  const [activeTabMode, setActiveTabMode] = useState<"auditoria" | "paradas">("auditoria");
  const [loadingStopIA, setLoadingStopIA] = useState<boolean>(false);
  const [aiStopClassifications, setAiStopClassifications] = useState<Record<string, {
    isLeisure: boolean;
    placeType: string;
    confidence: number;
    reasoning: string;
    placeNameDetected: string;
    criticality?: "Alta" | "Média" | "Baixa" | "Nenhuma";
  }>>({});

  // Memoized algorithm to scan for stops: starts on transition of Ig L -> D and lasts as long as remaining within radius & ign off (or until changed to L)
  const detectedStops = useMemo(() => {
    const stopsList: Array<{
      id: string;
      placa: string;
      startDateTime: Date;
      endDateTime: Date;
      duration: number;
      lat: number;
      lng: number;
      address: string;
      initialRow: TelemetryRow;
      finalRow: TelemetryRow;
    }> = [];

    // Helper: Haversine distance in meters
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3; // meters
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
      const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) *
          Math.cos(phi2) *
          Math.sin(deltaLambda / 2) *
          Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    };

    telemetryFiles.forEach(file => {
      const sortedRows = [...file.rows]
        .filter(r => r.dataHora !== null && !isNaN(r.dataHora.getTime()))
        .sort((a, b) => a.dataHora!.getTime() - b.dataHora!.getTime());

      if (sortedRows.length === 0) return;

      const n = sortedRows.length;
      let i = 0;
      while (i < n) {
        const row = sortedRows[i];
        
        // Audit rule: starts when Ig transitions from "L" (Ligada) to "D" (Desligada)
        const prevRow = i > 0 ? sortedRows[i - 1] : null;
        const isTransitionToD = row.ig?.toUpperCase().trim() === "D" && (prevRow === null || prevRow.ig?.toUpperCase().trim() === "L");

        if (isTransitionToD) {
          const startRow = row;
          const startLat = startRow.lat;
          const startLng = startRow.lng;
          
          let stopEndIndex = i;
          let j = i + 1;
          while (j < n) {
            const nextRow = sortedRows[j];
            const dist = calculateDistance(startLat, startLng, nextRow.lat, nextRow.lng);
            
            // Ig turns back to "L" or vehicle moves beyond the radius threshold -> stop breaks
            if (nextRow.ig?.toUpperCase().trim() === "L" || dist > stationaryRadiusThreshold) {
              break;
            }
            stopEndIndex = j;
            j++;
          }

          const endRow = sortedRows[stopEndIndex];
          const durationMs = endRow.dataHora!.getTime() - startRow.dataHora!.getTime();
          const durationMin = Math.round(durationMs / 60000);

          if (durationMin >= stationaryTimeThreshold) {
            stopsList.push({
              id: `${file.placa || "PlacaDesconhecida"}-${startRow.dataHora!.getTime()}`,
              placa: file.placa || "Sem Placa",
              startDateTime: startRow.dataHora!,
              endDateTime: endRow.dataHora!,
              duration: durationMin,
              lat: startLat,
              lng: startLng,
              address: startRow.endereco || endRow.endereco || `Ponto geográfico: ${startLat}, ${startLng}`,
              initialRow: startRow,
              finalRow: endRow,
            });
          }
          
          i = stopEndIndex + 1;
        } else {
          i++;
        }
      }
    });

    return stopsList;
  }, [telemetryFiles, stationaryTimeThreshold, stationaryRadiusThreshold]);

  // Auditoria IA (Gemini call)
  const runIAStopAnalysis = async () => {
    if (detectedStops.length === 0) {
      toast.error("Nenhuma parada detectada para analisar.");
      return;
    }
    
    setLoadingStopIA(true);
    toast.info("Processando auditoria inteligente das paradas com Gemini...");
    
    try {
      const stopsToClassify = detectedStops.map((stop, idx) => ({
        index: idx,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
        duration: stop.duration
      }));
      
      const res = await fetch("/api/classify-stops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ stops: stopsToClassify })
      });
      
      const result = await res.json();
      if (result.success) {
        const list = result.classifications;
        const newClassMap = { ...aiStopClassifications };
        
        list.forEach((item: any) => {
          const stopObj = detectedStops[item.index];
          if (stopObj) {
            newClassMap[stopObj.id] = {
              isLeisure: item.isLeisure,
              placeType: item.placeType,
              confidence: item.confidence,
              reasoning: item.reasoning,
              placeNameDetected: item.placeNameDetected || "Local Comercial",
              criticality: item.criticality || (item.isLeisure ? "Média" : "Nenhuma")
            };
          }
        });
        
        setAiStopClassifications(newClassMap);
        const leisureCount = Object.values(newClassMap).filter((c: any) => c.isLeisure).length;
        if (leisureCount > 0) {
          toast.warning(`Análise finalizada! Foram detectadas ${leisureCount} paradas em locais suspeitos de lazer/consumo.`);
        } else {
          toast.success("Análise concluída! Nenhuma parada em área de lazer foi identificada.");
        }
      } else {
        throw new Error(result.error || "Erro de resposta da IA");
      }
    } catch (err: any) {
      console.error("Erro na classificação IA de paradas:", err);
      toast.error(`Falha na IA (${err.message}). Ativando heurísticas de fallback...`);
      
      const fallbackMap = { ...aiStopClassifications };
      detectedStops.forEach(stop => {
        const addrLower = stop.address.toLowerCase();
        let isLeisure = true;
        let placeType = "Outros";
        let reasoning = "Classificado via análise local (Heurística de Fallback).";
        let placeNameDetected = "";
        let criticality: "Alta" | "Média" | "Baixa" | "Nenhuma" = "Média";

        // 1. HIGH CRITICALITY MATCHES (Alta - A)
        if (addrLower.includes("motel") || addrLower.includes("privé") || addrLower.includes("prive")) {
          placeType = "Hospedagem (Motel)";
          criticality = "Alta";
          reasoning = "Heurística: Identificado motel ou estabelecimento de hospedagem privado altamente sensível.";
          placeNameDetected = "Motel / Privé";
        } else if (addrLower.includes("praia") || addrLower.includes("beach") || addrLower.includes("orla") || addrLower.includes("marina") || addrLower.includes("píer") || addrLower.includes("pier") || addrLower.includes("balneário") || addrLower.includes("balneario") || addrLower.includes("parque aquático") || addrLower.includes("parque aquatico")) {
          placeType = "Lazer (Praia/Clube)";
          criticality = "Alta";
          reasoning = "Heurística: Local de lazer costeiro, beira-mar, praia ou turismo aquático.";
          placeNameDetected = "Área de Praia / Lazer Marítimo";
        } else if (addrLower.includes("hotel") || addrLower.includes("pousada") || addrLower.includes("hostel") || addrLower.includes("resort") || addrLower.includes("airbnb")) {
          placeType = "Hospedagem";
          criticality = "Alta";
          reasoning = "Heurística: Estabelecimento destinado a hospedagem turística ou comercial.";
          placeNameDetected = "Hotel / Pousada";
        } else if (addrLower.includes("bar ") || addrLower.includes(" bar") || addrLower.includes("pub") || addrLower.includes("boate") || addrLower.includes("nightclub") || addrLower.includes("casa noturna") || addrLower.includes("lounge") || addrLower.includes("adega") || addrLower.includes("cervejaria") || addrLower.includes("choperia")) {
          placeType = "Vida Noturna (Bar)";
          criticality = "Alta";
          reasoning = "Heurística: Estabelecimento de vida noturna, bar, pub, adega ou boate.";
          placeNameDetected = "Bar / Pub / Vida Noturna";
        } else if (addrLower.includes("condomínio") || addrLower.includes("condominio") || addrLower.includes("residência") || addrLower.includes("residencia") || addrLower.includes("chácara") || addrLower.includes("chacara") || addrLower.includes("sítio") || addrLower.includes("sitio") || addrLower.includes("fazenda") || addrLower.includes("casa de praia") || addrLower.includes("casa de campo") || addrLower.includes("apto") || addrLower.includes("residencial") || addrLower.includes("particular")) {
          placeType = "Residencial";
          criticality = "Alta";
          reasoning = "Heurística: Ponto localizado em condomínio habitacional ou residência particular privada.";
          placeNameDetected = "Área Residencial Particular";
        } else if (addrLower.includes("shopping") || addrLower.includes("mall") || addrLower.includes("center") || addrLower.includes("clube recreativo") || addrLower.includes("clube de campo") || addrLower.includes("parque de diversões") || addrLower.includes("parque de diver") || addrLower.includes("zoológico") || addrLower.includes("zoologico") || addrLower.includes("botânico") || addrLower.includes("botanico") || addrLower.includes("mirante")) {
          placeType = "Shopping / Clube";
          criticality = "Alta";
          reasoning = "Heurística: Grande polo comercial varejista de lazer ou clube recreativo de campo.";
          placeNameDetected = "Shopping Center ou Clube Recreativo";
        }
        // 2. MEDIUM CRITICALITY MATCHES (Média - B)
        else if (addrLower.includes("restaurante") || addrLower.includes("lanchonete") || addrLower.includes("fast-food") || addrLower.includes("fastfood") || addrLower.includes("churrascaria") || addrLower.includes("pizzaria") || addrLower.includes("food park")) {
          placeType = "Alimentação (Restaurante)";
          criticality = "Média";
          reasoning = "Heurística: Ponto voltado para refeições estruturadas, churrascaria ou praças de fast-food.";
          placeNameDetected = "Restaurante ou Lanchonete";
        } else if (addrLower.includes("supermercado") || addrLower.includes("hipermercado") || addrLower.includes("atacadista") || addrLower.includes("mercado público") || addrLower.includes("mercado publico") || addrLower.includes("centro comercial") || addrLower.includes("galeria comercial")) {
          placeType = "Compras (Mercado)";
          criticality = "Média";
          reasoning = "Heurística: Grande mercado varejista, atacadista ou galeria de lojas.";
          placeNameDetected = "Supermercado ou Atacadista";
        } else if (addrLower.includes("academia") || addrLower.includes("gym") || addrLower.includes("fitness") || addrLower.includes("crossfit") || addrLower.includes("estética") || addrLower.includes("estetica") || addrLower.includes("salão de beleza") || addrLower.includes("salao de beleza") || addrLower.includes("barbearia") || addrLower.includes("spa")) {
          placeType = "Estética & Fitness";
          criticality = "Média";
          reasoning = "Heurística: Academia, salão de beleza, barbearia ou centro de tratamento de estética.";
          placeNameDetected = "Academia / Salão de Beleza / SPA";
        } else if (addrLower.includes("escola") || addrLower.includes("colégio") || addrLower.includes("colegio") || addrLower.includes("creche") || addrLower.includes("universidade") || addrLower.includes("faculdade") || addrLower.includes("preparatório") || addrLower.includes("preparatorio") || addrLower.includes("idiomas")) {
          placeType = "Educação";
          criticality = "Média";
          reasoning = "Heurística: Estabelecimento de ensino infantil, superior, preparatório ou de idiomas.";
          placeNameDetected = "Instituição de Ensino";
        } else if (addrLower.includes("cinema") || addrLower.includes("teatro") || addrLower.includes("casa de shows") || addrLower.includes("estádio") || addrLower.includes("estadio") || addrLower.includes("arena") || addrLower.includes("ginásio") || addrLower.includes("ginasio") || addrLower.includes("quadra") || addrLower.includes("boliche") || addrLower.includes("kartódromo") || addrLower.includes("kartodromo")) {
          placeType = "Entretenimento & Esportes";
          criticality = "Média";
          reasoning = "Heurística: Local associado a atividades esportivas, boliche, cinema ou shows.";
          placeNameDetected = "Espaço Esportivo / Entretenimento";
        } else if (addrLower.includes("clínica") || addrLower.includes("clinica") || addrLower.includes("consultório") || addrLower.includes("consultorio") || addrLower.includes("hospital particular") || addrLower.includes("laboratório") || addrLower.includes("laboratorio")) {
          placeType = "Saúde Particular";
          criticality = "Média";
          reasoning = "Heurística: Clínica de consultas privadas ou hospital privado sem vínculo direto de salvamento/operacional.";
          placeNameDetected = "Clínica ou Laboratório Privado";
        } else if (addrLower.includes("igreja") || addrLower.includes("templo") || addrLower.includes("espírita") || addrLower.includes("espirita") || addrLower.includes("mesquita") || addrLower.includes("sinagoga")) {
          placeType = "Religioso";
          criticality = "Média";
          reasoning = "Heurística: Templo de cultos, igreja, centro de pregação ou sinagoga.";
          placeNameDetected = "Templo Comercial / Religioso";
        } else if (addrLower.includes("aeroporto") || addrLower.includes("rodoviária") || addrLower.includes("rodoviaria") || addrLower.includes("porto") || addrLower.includes("terminal marítimo") || addrLower.includes("terminal maritimo") || addrLower.includes("feiras livres") || addrLower.includes("casa de festas") || addrLower.includes("buffet") || addrLower.includes("convenções") || addrLower.includes("convencoes")) {
          placeType = "Logística & Eventos";
          criticality = "Média";
          reasoning = "Heurística: Aeroporto, rodoviária, terminal portuário ou centro privado de eventos.";
          placeNameDetected = "Terminal de Viagem / Convenções";
        }
        // 3. LOW CRITICALITY MATCHES (Baixa - C)
        else if (addrLower.includes("banco") || addrLower.includes("itau") || addrLower.includes("bradesco") || addrLower.includes("santander") || addrLower.includes("caixa econômica") || addrLower.includes("caixa economica") || addrLower.includes("câmbio") || addrLower.includes("cambio")) {
          placeType = "Serviço (Banco)";
          criticality = "Baixa";
          reasoning = "Heurística: Agência ou correspondente bancário para pagamentos e saques rápidos.";
          placeNameDetected = "Instituição Bancária / Agência";
        } else if (addrLower.includes("lotérica") || addrLower.includes("loterica")) {
          placeType = "Serviço (Lotérica)";
          criticality = "Baixa";
          reasoning = "Heurística: Casa lotérica para conveniências financeiras.";
          placeNameDetected = "Casa Lotérica / Caixa";
        } else if (addrLower.includes("padaria") || addrLower.includes("panificadora") || addrLower.includes("cafeteria") || addrLower.includes("café") || addrLower.includes("sorvete") || addrLower.includes("sorveteria")) {
          placeType = "Alimentação (Rápida)";
          criticality = "Baixa";
          reasoning = "Heurística: Alimentação ou consumo rápido em padaria, cafeteria ou sorveteria.";
          placeNameDetected = "Padaria / Cafeteria / Sorveteria";
        } else if (addrLower.includes("conveniência") || addrLower.includes("conveniencia") || addrLower.includes("posto de conveni")) {
          placeType = "Conveniência";
          criticality = "Baixa";
          reasoning = "Heurística: Loja de conveniência de postos ou minimercado de posto.";
          placeNameDetected = "Loja de Conveniência";
        } else if (addrLower.includes("lava-jato") || addrLower.includes("lavajato") || addrLower.includes("oficina") || addrLower.includes("borracharia") || addrLower.includes("estacionamento")) {
          placeType = "Serviços Automotivos";
          criticality = "Baixa";
          reasoning = "Heurística: Lavagem, serviços mecânicos de rotina rápidos ou estacionamento.";
          placeNameDetected = "Oficinas / Lava-Jato / Park";
        }
        // 4. OPERATIONAL AND SYSTEM RECOGNIZED DEFAULT LOCATIONS
        else {
          isLeisure = false;
          placeType = "Operacional/Institucional";
          criticality = "Nenhuma";
          reasoning = "Classificado como local corporativo de utilidade geral, operacional ou via pública padrão.";
          placeNameDetected = "Via Pública / Ponto Operacional";
        }

        fallbackMap[stop.id] = {
          isLeisure,
          placeType,
          confidence: 0.75,
          reasoning,
          placeNameDetected,
          criticality
        };
      });
      setAiStopClassifications(fallbackMap);
    } finally {
      setLoadingStopIA(false);
    }
  };

  // Dynamically initialize date range when fueling fuel list loads
  React.useEffect(() => {
    if (fuel && fuel.length > 0) {
      let minDate: Date | null = null;
      let maxDate: Date | null = null;
      
      fuel.forEach(f => {
        const d = parseFullDateTime(f["DATA TRANSACAO"] || f["DATA"]);
        if (d) {
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
      });
      
      if (minDate && maxDate) {
        setStartDate(formatDateToInputString(minDate));
        setEndDate(formatDateToInputString(maxDate));
      }
    }
  }, [fuel]);

  // Compute a consolidated virtual telemetryFile state for perfect backwards compatibility
  const telemetryFile = useMemo(() => {
    if (telemetryFiles.length === 0) return null;
    if (telemetryFiles.length === 1) return telemetryFiles[0];
    
    const uniquePlacas = Array.from(new Set(telemetryFiles.map(f => f.placa).filter(Boolean)));
    const samePeriod = telemetryFiles.every(f => f.periodo === telemetryFiles[0].periodo);
    
    return {
      fileName: `${telemetryFiles.length} arquivos carregados`,
      placa: uniquePlacas.length > 0 ? uniquePlacas.join(", ") : "Não Identificadas",
      periodo: samePeriod ? telemetryFiles[0].periodo : `${telemetryFiles.length} arquivos com períodos variados`,
      rows: telemetryFiles.flatMap(f => f.rows)
    };
  }, [telemetryFiles]);

  // Available Plates for Filter
  const availablePlates = useMemo(() => {
    const list = new Set<string>();
    fuel.forEach(f => {
      const p = limparPlaca(f["PLACA"]);
      if (p) list.add(p);
    });
    return Array.from(list).sort();
  }, [fuel]);

  // Handle uploaded HTML files parsing
  const handleHtmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoadingFile(true);
    let parsedCount = 0;
    const list: Array<{
      fileName: string;
      placa: string;
      periodo: string;
      rows: TelemetryRow[];
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
          reader.readAsText(file);
        });

        const parsed = parseTelemetryHtml(file.name, text);
        if (parsed) {
          list.push(parsed);
          parsedCount++;
        }
      } catch (err) {
        console.error(err);
        toast.error(`Erro ao processar o arquivo ${file.name}`);
      }
    }

    if (list.length > 0) {
      setTelemetryFiles(prev => {
        const existingNames = new Set(prev.map(f => f.fileName));
        const filteredNew = list.filter(nf => !existingNames.has(nf.fileName));
        if (filteredNew.length === 0) {
          toast.info("Todos os arquivos selecionados já foram importados anteriormente.");
          return prev;
        }
        
        const updated = [...prev, ...filteredNew];
        
        // Auto-select plate of first newly uploaded file
        const firstWithPlaca = filteredNew.find(f => limparPlaca(f.placa));
        if (firstWithPlaca) {
          const matchPlacaClean = limparPlaca(firstWithPlaca.placa);
          setSelectedPlaca(matchPlacaClean);
        }
        
        return updated;
      });
      toast.success(`${parsedCount} arquivo(s) importado(s) com sucesso!`);
    } else {
      toast.error("Nenhum arquivo HTML de posicionamento válido foi processado.");
    }
    setLoadingFile(false);
  };

  // LOAD SAMPLE REPORT DATA FOR INSTANT TESTING
  const loadSampleTelemetry = () => {
    toast.info("Processando dados demonstrativos para a placa PCA7094.");
    
    // We construct mockup data based directly on the user's uploaded HTML example.
    const mockRows: TelemetryRow[] = [];
    
    // Generates coordinates and addresses around Recife to Vitória de Santo Antão
    const baseDate = "19-05-2026";
    
    // Add stable parked rows morning
    for (let h = 0; h < 9; h++) {
      mockRows.push({
        dataHoraStr: `${baseDate} 0${h}:27:40`,
        dataHora: parseFullDateTime(`${baseDate} 0${h}:27:40`),
        ig: "D",
        endereco: "Avenida Cruz Cabugá 1387, Santo Amaro, Recife - PE",
        vel: 0,
        hod: 115290,
        hor: "118,311.0",
        tx: "G",
        motorista: "",
        lat: -8.042918,
        lng: -34.875431,
        motivoTx: "131",
        contador: String(290 + h),
        tensao: "12.0",
        temp: "81"
      });
    }

    // Active movement with Eduarda Maciel
    const routePoints = [
      { t: "09:26:25", ig: "L", v: 1, end: "Avenida Cruz Cabugá 1387, Santo Amaro, Recife" },
      { t: "09:27:25", ig: "L", v: 7, end: "Avenida Cruz Cabugá 1387, Santo Amaro, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:29:25", ig: "L", v: 0, end: "Avenida Cruz Cabugá 1387, Santo Amaro, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:30:25", ig: "L", v: 47, end: "Rua Taurino Batista 72, Santo Amaro, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:32:15", ig: "L", v: 21, end: "Avenida Governador Agamenon Magalhães 706, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:44:16", ig: "L", v: 18, end: "Avenida Governador Agamenon Magalhães 909, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:46:25", ig: "L", v: 9, end: "Rua Benfica 568, Madalena, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:47:50", ig: "L", v: 17, end: "Avenida Sport Clube do Recife, Recife", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "09:59:25", ig: "L", v: 94, end: "Rodovia BR-232, Recife - Curado", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "10:10:25", ig: "L", v: 102, end: "BR-232, Moreno - PE", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "10:20:25", ig: "L", v: 100, end: "BR-232, Vitória de Santo Antão", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" },
      { t: "10:30:25", ig: "L", v: 0, end: "Avenida Henrique de Holanda, Vitória de Santo Antão", driver: "473211-EDUARDA CAMILE DOS SANTOS MACIEL" }
    ];

    routePoints.forEach((pt, idx) => {
      mockRows.push({
        dataHoraStr: `${baseDate} ${pt.t}`,
        dataHora: parseFullDateTime(`${baseDate} ${pt.t}`),
        ig: pt.ig,
        endereco: pt.end,
        vel: pt.v,
        hod: 115290 + idx,
        hor: "118,320.0",
        tx: "G",
        motorista: pt.driver || "",
        lat: -8.05 + idx * 0.001,
        lng: -34.88 - idx * 0.001,
        motivoTx: "132",
        contador: String(300 + idx),
        tensao: "14.0",
        temp: "81"
      });
    });

    // Parked with Ignition ON (Ociosidade / Abastecimento Ligado)
    mockRows.push({
      dataHoraStr: `${baseDate} 10:31:33`,
      dataHora: parseFullDateTime(`${baseDate} 10:31:33`),
      ig: "L",
      endereco: "Auto Posto Picilau BR-232, Cajá, Vitória de Santo Antão", // Matches Posto PICHILAU
      vel: 0,
      hod: 115341,
      hor: "118,377.0",
      tx: "G",
      motorista: "473211-EDUARDA CAMILE DOS SANTOS MACIEL",
      lat: -8.115372,
      lng: -35.296305,
      motivoTx: "132",
      contador: "390",
      tensao: "13.0",
      temp: "81"
    });

    // Engine OFF while fueling
    mockRows.push({
      dataHoraStr: `${baseDate} 12:42:52`,
      dataHora: parseFullDateTime(`${baseDate} 12:42:52`),
      ig: "D",
      endereco: "Rua do Posto Medico 63, Vitória de Santo Antão",
      vel: 0,
      hod: 115343,
      hor: "118,386.0",
      tx: "G",
      motorista: "",
      lat: -8.109628,
      lng: -35.308398,
      motivoTx: "188",
      contador: "408",
      tensao: "12.0",
      temp: "81"
    });

    // Movement after 13:00 on the return trip
    for (let h = 13; h < 24; h++) {
      mockRows.push({
        dataHoraStr: `${baseDate} ${h}:59:29`,
        dataHora: parseFullDateTime(`${baseDate} ${h}:59:29`),
        ig: "D",
        endereco: "Avenida Cruz Cabuga 1387, Santo Amaro, Recife",
        vel: 0,
        hod: 115413,
        hor: "118,509.0",
        tx: "G",
        motorista: "",
        lat: -8.042712,
        lng: -34.875518,
        motivoTx: "131",
        contador: String(500 + h),
        tensao: "12.0",
        temp: "81"
      });
    }

    const sampleFile = {
      fileName: "demonstrativo_posicao_PCA7094.html",
      placa: "PCA7094",
      periodo: "19/05/2026 00:00 À 19/05/2026 23:59",
      rows: mockRows
    };

    setTelemetryFiles(prev => {
      // Evitar duplicados
      const filtered = prev.filter(f => f.fileName !== sampleFile.fileName);
      return [...filtered, sampleFile];
    });

    setSelectedPlaca("PCA7094");
    setStartDate("2026-05-19");
    setEndDate("2026-05-19");
    toast.success("Dados demonstrativos carregados com sucesso! Placa PCA7094 e data 19/05/2026 selecionadas.");
  };

  // DATA CROSSING ENGINE (CRUZAMENTO TELEMETRIA x ABASTECIMENTO)
  const crossDataResults = useMemo(() => {
    if (!telemetryFile) return [];

    // Filter fueling base on selected plate and date ranges
    const matchedFuel = fuel.filter(f => {
      const fuelPlaca = limparPlaca(f["PLACA"]);
      
      // Filter by selected Placa if specified
      if (selectedPlaca !== "all" && fuelPlaca !== selectedPlaca) return false;
      
      // If "all" is selected but telemetryFile represents a specific single/multiple loaded vehicles,
      // we only evaluate fuelings of plates that exist in our telemetryFiles
      if (selectedPlaca === "all") {
        const loadedPlacas = telemetryFiles.map(tf => limparPlaca(tf.placa)).filter(Boolean);
        if (loadedPlacas.length > 0 && !loadedPlacas.includes(fuelPlaca)) {
          return false;
        }
      }

      const date = parseFullDateTime(f["DATA TRANSACAO"] || f["DATA"]);
      if (!date) return false;

      // Filter by custom start/end dates
      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        if (date < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59");
        if (date > end) return false;
      }

      return true;
    });

    // Run the VBA Macro loops
    const deviations: DeviationItem[] = [];

    matchedFuel.forEach(f => {
      const placaA = limparPlaca(f["PLACA"]);
      const dataA = parseFullDateTime(f["DATA TRANSACAO"] || f["DATA"]);
      const rawDriverA = f["NOME MOTORISTA"] || "";
      const motoristaA = limparMotorista(rawDriverA);
      const postoA = String(f["NOME POSTO"] || f._posto || f["NOME ESTABELECIMENTO"] || "N/A").trim().toUpperCase();

      const rawRaw = (f as any).__raw || (f as any)._raw || [];
      const enderecoPosto = String(f["ENDERECO"] || f["ENDEREÇO"] || f._endereco || rawRaw[23] || "").trim();
      const bairroPosto = String(f["BAIRRO"] || f._bairro || rawRaw[24] || "").trim();
      const cidadePosto = String(f["CIDADE"] || f._cidade || rawRaw[25] || "").trim();

      // Concatenar informações do endereço para cruzamento
      const partesPosto = [enderecoPosto, bairroPosto, cidadePosto]
        .map(p => p.trim())
        .filter(p => p && p.toUpperCase() !== "N/A" && p.toUpperCase() !== "N_A" && p.toUpperCase() !== "NULL" && p !== "-");
      
      const enderecoCompletoPosto = partesPosto.join(", ").trim().toUpperCase();

      if (!dataA) return;

      let melhorDiff = 999999;
      let melhorTRow: TelemetryRow | null = null;

      // Find all telemetry files that match this specific vehicle plate. Fallback to all if none match exactly.
      const matchingFilesForPlaca = telemetryFiles.filter(tf => limparPlaca(tf.placa) === placaA);
      const rowsToSearch = matchingFilesForPlaca.length > 0
        ? matchingFilesForPlaca.flatMap(tf => tf.rows)
        : telemetryFile.rows;

      // Find nearest telemetry record within 10 minutes (TOLERÂNCIA DE 10 MINUTOS)
      rowsToSearch.forEach((tRow) => {
        if (!tRow.dataHora) return;
        
        // Difference in minutes
        const diffMs = Math.abs(dataA.getTime() - tRow.dataHora.getTime());
        const diffMin = diffMs / (1000 * 60);

        if (diffMin <= 10) {
          if (diffMin < melhorDiff) {
            melhorDiff = diffMin;
            melhorTRow = tRow;
          }
        }
      });

      // ENCONTROU MATCH?
      if (melhorTRow) {
        const matchedTR = melhorTRow;
        const vel = matchedTR.vel || 0;
        
        let ignicao = String(matchedTR.ig).trim().toUpperCase();
        if (["L", "ON", "LIGADO", "LIGADA", "TRUE", "SIM", "1", "IGN ON"].includes(ignicao)) {
          ignicao = "LIGADA";
        } else if (["D", "OFF", "DESLIGADO", "DESLIGADA", "FALSE", "NAO", "NÃO", "0", "IGN OFF"].includes(ignicao)) {
          ignicao = "DESLIGADA";
        }

        const enderecoT = String(matchedTR.endereco || "").trim().toUpperCase();
        const motoristaT = limparMotorista(matchedTR.motorista);

        let hasDeviations = false;

        // REGRA 1 - VEÍCULO EM MOVIMENTO
        if (vel > 5) {
          deviations.push({
            placa: placaA,
            dataAbast: dataA.toLocaleString('pt-BR'),
            status: "MATCH",
            desvio: "VEICULO EM MOVIMENTO",
            difMin: melhorDiff.toFixed(1),
            motoristaTelem: matchedTR.motorista || "N/A",
            ignicao,
            obs: "ABASTECIMENTO COM VEICULO EM DESLOCAMENTO",
            litros: f["LITROS"],
            posto: postoA,
            motoristaAbast: rawDriverA
          });
          hasDeviations = true;
        }

        // REGRA 2 - IGNIÇÃO LIGADA EM ABASTECIMENTO
        if (vel <= 5 && ignicao === "LIGADA") {
          deviations.push({
            placa: placaA,
            dataAbast: dataA.toLocaleString('pt-BR'),
            status: "MATCH",
            desvio: "IGNICAO LIGADA",
            difMin: melhorDiff.toFixed(1),
            motoristaTelem: matchedTR.motorista || "N/A",
            ignicao,
            obs: "VEICULO PARADO COM MOTOR LIGADO DURANTE O ABASTECIMENTO",
            litros: f["LITROS"],
            posto: postoA,
            motoristaAbast: rawDriverA
          });
          hasDeviations = true;
        }

        // REGRA 3 - DIVERGÊNCIA DE ENDEREÇO
        const localComparacao = enderecoCompletoPosto || postoA;
        if (!enderecoCompativel(enderecoT, localComparacao)) {
          deviations.push({
            placa: placaA,
            dataAbast: dataA.toLocaleString('pt-BR'),
            status: "MATCH",
            desvio: "DIVERGENCIA DE ENDERECO",
            difMin: melhorDiff.toFixed(1),
            motoristaTelem: matchedTR.motorista || "N/A",
            ignicao,
            obs: `TELEMETRIA EM: ${enderecoT} / POSTO EM: ${localComparacao}`,
            litros: f["LITROS"],
            posto: postoA,
            motoristaAbast: rawDriverA
          });
          hasDeviations = true;
        }

        // REGRA 6 - MOTORISTA DIFERENTE
        if (motoristaA && motoristaT) {
          let driversDiffer = false;
          if (strictDrivers) {
            driversDiffer = motoristaA !== motoristaT;
          } else {
            // Smart compare: check if one contains the other to avoid false positives with matricula ID
            const d1 = motoristaA.replace(/^\d+-?/, "").replace(/-?\d+$/, "");
            const d2 = motoristaT.replace(/^\d+-?/, "").replace(/-?\d+$/, "");
            driversDiffer = d1 !== d2 && !d1.includes(d2) && !d2.includes(d1);
          }

          if (driversDiffer) {
            deviations.push({
              placa: placaA,
              dataAbast: dataA.toLocaleString('pt-BR'),
              status: "MATCH",
              desvio: "MOTORISTA DIFERENTE",
              difMin: melhorDiff.toFixed(1),
              motoristaTelem: matchedTR.motorista,
              ignicao,
              obs: `DIVERGENCIA ENTRE ABASTECIMENTO COM (${rawDriverA}) E TELEMETRIA COM (${matchedTR.motorista})`,
              litros: f["LITROS"],
              posto: postoA,
              motoristaAbast: rawDriverA
            });
            hasDeviations = true;
          }
        }

        // Se deu match mas correu perfeitamente sem nenhuma regra de desvio acionada:
        if (!hasDeviations) {
          // Linha de controle verde livre de desvios
          deviations.push({
            placa: placaA,
            dataAbast: dataA.toLocaleString('pt-BR'),
            status: "OK",
            desvio: "NENHUM DESVIO DETECTADO",
            difMin: melhorDiff.toFixed(1),
            motoristaTelem: matchedTR.motorista || "N/A",
            ignicao,
            obs: `Abastecimento em conformidade no posto ${postoA}.`,
            litros: f["LITROS"],
            posto: postoA,
            motoristaAbast: rawDriverA
          });
        }

      } else {
        // SEM MATCH
        deviations.push({
          placa: placaA,
          dataAbast: dataA.toLocaleString('pt-BR'),
          status: "SEM MATCH",
          desvio: "SEM REGISTRO NA TELEMETRIA",
          difMin: "-",
          motoristaTelem: "-",
          ignicao: "-",
          obs: "NENHUM REGISTRO DE POSIÇÃO DA TELEMETRIA ENCONTRADO DENTRO DO INTERVALO DE 10 MINUTOS",
          litros: f["LITROS"],
          posto: postoA,
          motoristaAbast: rawDriverA
        });
      }
    });

    return deviations.map(d => {
      const cleanP = limparPlaca(d.placa);
      const asset = assetsByPlaca.get(cleanP);
      const tipoAtivo = (asset?.TIPO || asset?.Tipo || asset?.["TIPO VEICULO"] || "N/A").toUpperCase().trim();
      return {
        ...d,
        tipoAtivo
      };
    });
  }, [telemetryFile, telemetryFiles, fuel, selectedPlaca, startDate, endDate, strictDrivers, assetsByPlaca]);

  // General statistics from crossings
  const crossedStats = useMemo(() => {
    if (crossDataResults.length === 0) return null;
    const ok = crossDataResults.filter(r => r.status === "OK").length;
    const semMatch = crossDataResults.filter(r => r.status === "SEM MATCH").length;
    const desviosCount = crossDataResults.filter(r => r.status !== "OK" && r.status !== "SEM MATCH").length;
    
    return {
      total: crossDataResults.length,
      conformidade: ok,
      semMatch,
      desviosCount,
      taxaDesvio: ((desviosCount / crossDataResults.length) * 100).toFixed(1)
    };
  }, [crossDataResults]);

  // Filtered crossing list for table display
  const finalFilteredResults = useMemo(() => {
    let list = crossDataResults;

    // Filter by saved calendar selections if they exist for the selected day
    if (startDate && savedSelections[startDate] && savedSelections[startDate].length > 0) {
      const savedTypes = savedSelections[startDate].map((t: string) => t.toUpperCase().trim());
      list = list.filter(r => {
        const t = String(r.tipoAtivo || "").toUpperCase().trim();
        return savedTypes.includes(t);
      });
    }

    // Filter by selected active day's asset type
    if (selectedCalendarAssetType && selectedCalendarAssetType !== "all") {
      list = list.filter(r => {
        const t = String(r.tipoAtivo || "").toUpperCase().trim();
        return t === selectedCalendarAssetType.toUpperCase().trim();
      });
    }

    if (searchFilter) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(r => 
        r.placa.toLowerCase().includes(q) ||
        r.desvio.toLowerCase().includes(q) ||
        r.obs.toLowerCase().includes(q) ||
        r.motoristaAbast?.toLowerCase().includes(q) ||
        r.posto?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [crossDataResults, selectedCalendarAssetType, searchFilter, startDate, savedSelections]);

  // Calculate which days of the year have fueling transaction activity
  const activityDaysMap = useMemo(() => {
    const map = new Map<string, number>();
    fuel.forEach(f => {
      const d = parseFullDateTime(f["DATA TRANSACAO"] || f["DATA"]);
      if (d) {
        const dStr = formatDateToInputString(d);
        map.set(dStr, (map.get(dStr) || 0) + 1);
      }
    });
    return map;
  }, [fuel]);

  // Get list of asset types having fueling transactions on the selected day
  const activeAssetTypesForSelectedDay = useMemo(() => {
    if (!startDate) return [];
    
    // Filter fuelings of this exact day
    const dayFuel = fuel.filter(f => {
      const d = parseFullDateTime(f["DATA TRANSACAO"] || f["DATA"]);
      if (!d) return false;
      const dStr = formatDateToInputString(d);
      return dStr === startDate;
    });

    const typesMap = new Map<string, number>();
    dayFuel.forEach(f => {
      const p = limparPlaca(f["PLACA"]);
      const asset = assetsByPlaca.get(p);
      const tipo = (asset?.TIPO || asset?.Tipo || asset?.["TIPO VEICULO"] || "OUTROS").toUpperCase().trim();
      typesMap.set(tipo, (typesMap.get(tipo) || 0) + 1);
    });

    return Array.from(typesMap.entries()).map(([tipo, count]) => ({
      tipo,
      count
    })).sort((a, b) => b.count - a.count);
  }, [startDate, fuel, assetsByPlaca]);

  // Sync calendar view if startDate changes
  React.useEffect(() => {
    if (startDate) {
      const d = new Date(startDate + "T12:00:00");
      if (!isNaN(d.getTime())) {
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [startDate]);

  // EXPORTS
  const exportToExcelTab = () => {
    if (finalFilteredResults.length === 0) {
      toast.error("Nenhum dado disponível para exportação.");
      return;
    }

    const dataToExport = finalFilteredResults.map(r => ({
      "PLACA": r.placa,
      "DATA ABASTECIMENTO": r.dataAbast,
      "STATUS": r.status,
      "DESVIO IDENTIFICADO": r.desvio,
      "DIFERENÇA (MINUTOS)": r.difMin,
      "CONDUTOR TELEMETRIA": r.motoristaTelem,
      "IGNIÇÃO": r.ignicao,
      "OBSERVAÇÕES / ENDEREÇO": r.obs,
      "LITROS": r.litros || "-",
      "POSTO CREDENCIADO": r.posto || "-",
      "CONDUTOR ABASTECIMENTO": r.motoristaAbast || "-"
    }));

    exportToExcel(dataToExport, `Cruzamento_Telemetria_Abastecimento_${telemetryFile?.placa || "Geral"}`, "Cruzamento");
    toast.success("Excel gerado com sucesso!");
  };

  const exportToPdfTab = () => {
    if (finalFilteredResults.length === 0) {
      toast.error("Nenhum dado disponível para exportação.");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    const formattedDate = new Date().toLocaleDateString('pt-BR');

    // Header style COMPESA style
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("COMPESA - RELATÓRIO CONSOLIDADO DE AUDITORIA", 14, 12);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Arquivo: ${telemetryFile?.fileName || "Auditoria"}`, 14, 25);
    doc.text(`Placa Auditada: ${telemetryFile?.placa || "Todas"}`, 14, 30);
    doc.text(`Período do Relatório: ${telemetryFile?.periodo || "Não Informado"}`, 14, 35);
    doc.text(`Data da Emissão: ${formattedDate}`, 240, 25);

    const headers = [["PLACA", "DATA ABAST.", "STATUS", "DESVIO", "DIF_MIN", "MOTORISTA TELEMETRIA", "IGNICAO", "OBS"]];
    const body = finalFilteredResults.map(r => [
      r.placa,
      r.dataAbast,
      r.status,
      r.desvio,
      r.difMin,
      r.motoristaTelem || "-",
      r.ignicao || "-",
      r.obs
    ]);

    autoTable(doc, {
      startY: 42,
      theme: "striped",
      head: headers,
      body: body,
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        7: { cellWidth: 70 } // expand description col
      }
    });

    doc.save(`Auditoria_Telemetria_Abastecimento_${telemetryFile?.placa || "Relatorio"}.pdf`);
    toast.success("Relatório gerado em PDF!");
  };

  return (
    <div className="space-y-6">
      {/* Tab intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-bold uppercase tracking-tight">Abastecimento x Telemetria</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Realize auditorias precisas cruzando os tickets de abastecimento com registros físicos da telemetria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadSampleTelemetry} 
            className="flex items-center gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs uppercase tracking-wider"
          >
            <Sparkles className="h-4 w-4" />
            Usar Exemplo (PCA7094)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Filters Column */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b pb-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 leading-none">
                <Upload className="h-4 w-4 text-indigo-500" />
                Carregar Posicionamento
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Insira o relatório de posição HTML emitido pelo sistema de telemetria.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer relative bg-slate-50/30">
                <input 
                  type="file" 
                  accept=".html" 
                  multiple
                  onChange={handleHtmlUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileCode className="h-10 w-10 text-indigo-400 mx-auto mb-2" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Selecione arquivos HTML
                </span>
                <span className="text-[10px] text-slate-400 block font-bold">
                  Arraste e solte ou clique para selecionar múltiplos
                </span>
              </div>

              {telemetryFiles.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Arquivos Carregados ({telemetryFiles.length})
                    </span>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setTelemetryFiles([]);
                        toast.success("Todos os arquivos foram removidos!");
                      }}
                      className="h-auto p-0 text-[10px] font-black uppercase text-red-500 hover:text-red-700 hover:bg-transparent"
                    >
                      Limpar Todos
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {telemetryFiles.map((file, idx) => (
                      <div 
                        key={idx} 
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={file.fileName}>
                            {file.fileName}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="bg-emerald-50/50 border-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0">
                              {file.placa}
                            </Badge>
                            <span className="text-[9px] text-slate-400 font-bold">
                              • {file.rows.length} posições
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTelemetryFiles(prev => prev.filter((_, fIdx) => fIdx !== idx));
                            toast.success(`Arquivo ${file.fileName} removido.`);
                          }}
                          className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 rounded-full"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b pb-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 leading-none">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  Calendário de Atividades
                </CardTitle>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7 rounded-lg"
                  onClick={() => setViewDate(prev => {
                    const m = prev.getMonth();
                    const y = prev.getFullYear();
                    return m === 0 ? new Date(y - 1, 11, 1) : new Date(y, m - 1, 1);
                  })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 min-w-[70px] text-center">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7 rounded-lg"
                  onClick={() => setViewDate(prev => {
                    const m = prev.getMonth();
                    const y = prev.getFullYear();
                    return m === 11 ? new Date(y + 1, 0, 1) : new Date(y, m + 1, 1);
                  })}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, index) => (
                  <div key={index} className="py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {(() => {
                  const year = viewDate.getFullYear();
                  const month = viewDate.getMonth();

                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const startDayOfWeek = new Date(year, month, 1).getDay();

                  const cells: React.ReactNode[] = [];

                  // Previous month padding
                  const prevMonthDays = new Date(year, month, 0).getDate();
                  for (let i = startDayOfWeek - 1; i >= 0; i--) {
                    const dVal = prevMonthDays - i;
                    const prevMonth = month === 0 ? 11 : month - 1;
                    const prevYear = month === 0 ? year - 1 : year;
                    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dVal).padStart(2, '0')}`;
                    const hasFueling = activityDaysMap.get(dateStr) || 0;
                    const isSelected = startDate === dateStr;
                    const savedTypes = savedSelections[dateStr] || [];
                    const hasSaved = savedTypes.length > 0;
                    
                    cells.push(
                      <button
                        key={`prev-${dVal}`}
                        title={hasSaved ? `Tipos salvos: ${savedTypes.join(', ')}` : undefined}
                        onClick={() => {
                          setStartDate(dateStr);
                          setEndDate(dateStr);
                          setSelectedCalendarAssetType("all");
                        }}
                        className={`
                          relative p-2 text-xs rounded-xl flex flex-col items-center justify-center transition-all h-10 w-full opacity-35 hover:opacity-85
                          ${isSelected 
                            ? "bg-indigo-600 text-white font-black scale-105" 
                            : hasSaved 
                              ? "bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" 
                              : "text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                          }
                          ${hasFueling && !isSelected && !hasSaved ? "border border-dashed border-emerald-300" : ""}
                        `}
                      >
                        <span className="font-bold">{dVal}</span>
                        <div className="absolute bottom-1 flex gap-0.5 justify-center">
                          {hasFueling > 0 && <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-emerald-400"}`} />}
                          {hasSaved && <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-400"}`} />}
                        </div>
                      </button>
                    );
                  }

                  // Current month days
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const hasFueling = activityDaysMap.get(dateStr) || 0;
                    const isSelected = startDate === dateStr;
                    const savedTypes = savedSelections[dateStr] || [];
                    const hasSaved = savedTypes.length > 0;

                    cells.push(
                      <button
                        key={`curr-${d}`}
                        title={hasSaved ? `Ativos salvos: ${savedTypes.join(', ')}` : undefined}
                        onClick={() => {
                          setStartDate(dateStr);
                          setEndDate(dateStr);
                          setSelectedCalendarAssetType("all");
                          toast.info(`Data selecionada: ${d}/${viewDate.getMonth() + 1}/${viewDate.getFullYear()}`);
                        }}
                        className={`
                          relative p-2 text-xs rounded-xl flex flex-col items-center justify-center transition-all h-10 w-full font-bold
                          ${isSelected 
                            ? "bg-indigo-600 text-white font-black shadow-md scale-105 hover:bg-indigo-700" 
                            : hasSaved 
                              ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }
                          ${hasFueling && !isSelected && !hasSaved ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900" : ""}
                        `}
                      >
                        <span>{d}</span>
                        <div className="absolute bottom-1 flex gap-0.5 justify-center">
                          {hasFueling > 0 && (
                            <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500 animate-pulse"}`} />
                          )}
                          {hasSaved && (
                            <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-600"}`} />
                          )}
                        </div>
                      </button>
                    );
                  }

                  // Next month padding to complete the grid (multiples of 7)
                  const totalGridCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
                  const nextMonthPadding = totalGridCells - (startDayOfWeek + daysInMonth);
                  for (let i = 1; i <= nextMonthPadding; i++) {
                    const nextMonth = month === 11 ? 0 : month + 1;
                    const nextYear = month === 11 ? year + 1 : year;
                    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const hasFueling = activityDaysMap.get(dateStr) || 0;
                    const isSelected = startDate === dateStr;
                    const savedTypes = savedSelections[dateStr] || [];
                    const hasSaved = savedTypes.length > 0;

                    cells.push(
                      <button
                        key={`next-${i}`}
                        title={hasSaved ? `Tipos salvos: ${savedTypes.join(', ')}` : undefined}
                        onClick={() => {
                          setStartDate(dateStr);
                          setEndDate(dateStr);
                          setSelectedCalendarAssetType("all");
                        }}
                        className={`
                          relative p-2 text-xs rounded-xl flex flex-col items-center justify-center transition-all h-10 w-full opacity-35 hover:opacity-85
                          ${isSelected 
                            ? "bg-indigo-600 text-white font-black scale-105" 
                            : hasSaved 
                              ? "bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" 
                              : "text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                          }
                          ${hasFueling && !isSelected && !hasSaved ? "border border-dashed border-emerald-300" : ""}
                        `}
                      >
                        <span className="font-bold">{i}</span>
                        <div className="absolute bottom-1 flex gap-0.5 justify-center">
                          {hasFueling > 0 && <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-emerald-400"}`} />}
                          {hasSaved && <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-400"}`} />}
                        </div>
                      </button>
                    );
                  }

                  return cells;
                })()}
              </div>

              {/* Selected date header, local checkbox selection, save button, and filters */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Atividades em {startDate ? new Date(startDate + "T12:00:00").toLocaleDateString('pt-BR') : "Nenhum dia marcado"}
                  </span>
                </div>

                {!startDate ? null : (
                  <div className="space-y-4">
                    {/* EDITABLE SECTION: SAVE ACTIVITY ASSIGNMENT TO FIRESTORE */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                          Marcar Atividades Executadas (Salva no Banco):
                        </Label>
                        
                        {activeAssetTypesForSelectedDay.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => {
                              const autoCalculated = activeAssetTypesForSelectedDay.map(t => t.tipo);
                              setLocalCheckedTypes(prev => {
                                const combined = Array.from(new Set([...prev, ...autoCalculated]));
                                return combined;
                              });
                              toast.info("Sugestões do cruzamento copiadas! Clique em 'Salvar Atividades' para persistir.");
                            }}
                            className="h-6 text-[9px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 px-2 rounded-lg"
                          >
                            ⚡ Copiar do Cruzamento
                          </Button>
                        )}
                      </div>

                      {/* Pill style Checkbox List of all available asset types */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {allAssetTypes.map(tipo => {
                          const isChecked = localCheckedTypes.includes(tipo);
                          return (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => {
                                setLocalCheckedTypes(prev => 
                                  prev.includes(tipo) 
                                    ? prev.filter(t => t !== tipo) 
                                    : [...prev, tipo]
                                );
                              }}
                              className={`
                                h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 border
                                ${isChecked 
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                }
                              `}
                            >
                              {isChecked ? (
                                <CheckSquare className="h-3 w-3 shrink-0" />
                              ) : (
                                <Square className="h-3 w-3 shrink-0" />
                              )}
                              {tipo}
                            </button>
                          );
                        })}
                      </div>

                      {/* Save Buttons & Status Meta Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex-wrap gap-2">
                        {savedSelections[startDate] && savedSelections[startDate].length > 0 ? (
                          <div className="text-[9px] text-slate-400 font-medium">
                            Status: <span className="text-emerald-500 font-bold">Salvo</span> ({savedSelections[startDate].length} tipos)
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-400 font-medium italic">
                            Sem registro persistente nesta data
                          </div>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {savedSelections[startDate] && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={savingSelection}
                              onClick={() => handleClearSelectionForDate(startDate)}
                              className="h-8 text-[10px] font-bold px-3 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 border-slate-200 text-slate-500 dark:border-slate-800"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Limpar
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            disabled={savingSelection}
                            onClick={() => handleSaveSelection(startDate, localCheckedTypes)}
                            className="h-8 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0"
                          >
                            {savingSelection ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Salvar Atividades
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC FILTERING FROM Excel (PRESERVING CORE FUNCTIONALITY) */}
                    <div className="space-y-2 pt-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                        <SlidersHorizontal className="h-3 w-3 text-emerald-500" />
                        Filtro Rápido de Abastecimento (Do Relatório):
                      </label>
                      
                      {activeAssetTypesForSelectedDay.length === 0 ? (
                        <p className="text-[9px] text-slate-400 italic">Nenhum veículo abastecido no cruzamento deste dia.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            variant={selectedCalendarAssetType === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCalendarAssetType("all")}
                            className={`h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                              selectedCalendarAssetType === "all" 
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            Todos ({activeAssetTypesForSelectedDay.reduce((acc, curr) => acc + curr.count, 0)})
                          </Button>
                          
                          {activeAssetTypesForSelectedDay.map(({ tipo, count }) => (
                            <Button
                              key={tipo}
                              variant={selectedCalendarAssetType === tipo ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedCalendarAssetType(tipo);
                                toast.info(`Filtrando pelo Tipo de Ativo: ${tipo}`);
                              }}
                              className={`h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                                selectedCalendarAssetType === tipo 
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {tipo}
                              <span className={`ml-1 px-1 rounded text-[8px] ${
                                selectedCalendarAssetType === tipo ? "bg-emerald-800 text-emerald-100" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                              }`}>
                                {count}
                              </span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b pb-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 leading-none">
                <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
                Parâmetros do Cruzamento
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Ajuste os filtros de placa e data para o cruzamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Car size={12} className="text-indigo-500" />
                  Placa do Ativo
                </Label>
                <Select value={selectedPlaca} onValueChange={setSelectedPlaca}>
                  <SelectTrigger className="rounded-2xl h-11 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-xs">
                    <SelectValue placeholder="Selecione a Placa" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todas as Placas ({availablePlates.length})</SelectItem>
                    {availablePlates.map(placa => (
                      <SelectItem key={placa} value={placa}>{placa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" />
                    Data Inicial
                  </Label>
                  <Input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-2xl h-11 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-xs p-3"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" />
                    Data Final
                  </Label>
                  <Input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-2xl h-11 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-xs p-3"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <Label htmlFor="strict-drivers" className="text-xs font-bold text-slate-800 dark:text-slate-300">
                    Estrito sobre Motoristas
                  </Label>
                  <p className="text-[10px] leading-snug text-slate-400 font-medium">
                    Ative para exigir similaridade exata (incluindo números/matrículas).
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="strict-drivers"
                  checked={strictDrivers}
                  onChange={(e) => setStrictDrivers(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 space-y-6">
          {!telemetryFile ? (
            <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest italic mb-2">
                Aguardando Relatório de Telemetria
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider max-w-sm leading-normal">
                Carregue um arquivo de telemetria HTML de sua máquina ou clique em "Usar Exemplo (PCA7094)" no menu superior para testar a ferramenta instantaneamente.
              </p>
            </Card>
          ) : (
            <>
              {/* Tab Navigation Mode - Auditoria de Abastecimento vs Análise de Paradas */}
              <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-2xl max-w-md border border-slate-200/50 dark:border-slate-800">
                <button
                  onClick={() => setActiveTabMode("auditoria")}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                    activeTabMode === "auditoria"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20"
                      : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                  }`}
                >
                  Auditoria Abastecimento
                </button>
                <button
                  onClick={() => setActiveTabMode("paradas")}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5 ${
                    activeTabMode === "paradas"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20"
                      : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                  Auditoria de Paradas (Lazer/Lojas)
                </button>
              </div>

              {activeTabMode === "auditoria" ? (
                <>
                  {/* Summary Cards */}
                  {crossedStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Abastecimentos Cruzados</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{crossedStats.total}</p>
                  </div>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/20 p-5 rounded-3xl shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Conformes</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{crossedStats.conformidade}</p>
                  </div>
                  <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 p-5 rounded-3xl shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Com Desvios</p>
                    <p className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">{crossedStats.desviosCount}</p>
                  </div>
                  <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-950/20 p-5 rounded-3xl shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Sem Telemetria</p>
                    <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{crossedStats.semMatch}</p>
                  </div>
                </div>
              )}

              {/* Deviations Table Card */}
              <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 leading-none">
                      <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                      Resultado da Auditoria da Telemetria (Cruzamento)
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed mt-1">
                      Conforme a macro, confronta-se o ticket de abastecimento com as coordenadas registradas a menos de 10 min de tolerância.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportToExcelTab} className="h-9 gap-1 font-bold text-[10px] uppercase rounded-xl">
                      <Download className="h-3 w-3" /> EXCEL
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPdfTab} className="h-9 gap-1 font-bold text-[10px] uppercase rounded-xl">
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                  </div>
                </CardHeader>
                
                {/* Search Bar inside table header */}
                <div className="p-4 border-b bg-slate-50/20 dark:bg-slate-900/20 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Pesquisar placa, posto, condutor ou desvio..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="rounded-xl pl-9 h-10 border-slate-200 dark:border-slate-800 text-xs font-bold"
                    />
                  </div>
                </div>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                        <TableRow className="border-none">
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Placa</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Data Abast.</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Status</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Desvio</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto text-center">Dif (Min)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto text-center">Ignicação</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Observação do Cruzamento / Endereço</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto text-center">Notificar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {finalFilteredResults.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
                              Nenhum cruzamento encontrado para esta seleção.
                            </TableCell>
                          </TableRow>
                        ) : (
                          finalFilteredResults.map((row, idx) => {
                            let statusBadge = (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 text-[10px] font-bold">
                                {row.status}
                              </Badge>
                            );
                            if (row.status === "SEM MATCH") {
                              statusBadge = (
                                <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 text-[10px] font-bold">
                                  {row.status}
                                </Badge>
                              );
                            } else if (row.status === "SEM DADO") {
                              statusBadge = (
                                <Badge className="bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-100 text-[10px] font-bold">
                                  {row.status}
                                </Badge>
                              );
                            } else if (row.status === "MATCH" && row.desvio !== "NENHUM DESVIO DETECTADO") {
                              statusBadge = (
                                <Badge className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 text-[10px] font-bold">
                                  {row.status}
                                </Badge>
                              );
                            }

                            let desvioBadge = (
                              <span className="text-emerald-600 font-extrabold text-[10px] uppercase">
                                OK - Conformidade
                              </span>
                            );
                            if (row.desvio === "VEICULO EM MOVIMENTO") {
                              desvioBadge = (
                                <span className="text-rose-600 font-extrabold text-[10px] uppercase">
                                  ⚠️ Veículo em Movimento
                                </span>
                              );
                            } else if (row.desvio === "IGNICAO LIGADA") {
                              desvioBadge = (
                                <span className="text-rose-500 font-extrabold text-[10px] uppercase">
                                  ⚠️ Motor Ligado
                                </span>
                              );
                            } else if (row.desvio === "DIVERGENCIA DE ENDERECO") {
                              desvioBadge = (
                                <span className="text-amber-600 font-extrabold text-[10px] uppercase">
                                  📍 Divergência Endereço
                                </span>
                              );

                            } else if (row.desvio === "MOTORISTA DIFERENTE") {
                              desvioBadge = (
                                <span className="text-rose-700 font-extrabold text-[10px] uppercase">
                                  👤 Motorista Divergente
                                </span>
                              );
                            } else if (row.desvio === "SEM REGISTRO NA TELEMETRIA") {
                              desvioBadge = (
                                <span className="text-slate-400 font-semibold text-[10px] uppercase">
                                  Sem Sinal
                                </span>
                              );
                            }

                            return (
                              <TableRow key={idx} className="border-b last:border-none">
                                <TableCell className="font-extrabold text-xs text-slate-800 dark:text-slate-300">
                                  {row.placa}
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                                  {row.dataAbast}
                                </TableCell>
                                <TableCell>
                                  {statusBadge}
                                </TableCell>
                                <TableCell>
                                  {desvioBadge}
                                </TableCell>
                                <TableCell className="text-xs font-bold text-center">
                                  {row.difMin} {row.difMin !== "-" ? "min" : ""}
                                </TableCell>
                                <TableCell className="text-xs text-center font-bold">
                                  <Badge variant="outline" className={`font-semibold text-[10px] ${row.ignicao === "LIGADA" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                    {row.ignicao}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-slate-500 leading-snug max-w-[240px]">
                                  {row.obs}
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEmailModal(row)}
                                    className="h-8 w-8 p-0 border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-950/40 rounded-full"
                                    title="Notificar Responsável"
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Informative Help Alert */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-3xl flex gap-3">
                <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-400">Regulamentos de Conformidade & Auditoria GAD</h4>
                  <p className="text-[10px] leading-relaxed text-indigo-700 dark:text-indigo-300 font-medium">
                    A auditoria automatiza 6 regras operacionais fundamentais da COMPESA: (1) O veículo não deve se deslocar acima de 5 km/h durante a transação; (2) O motor deve permanecer desligado (Ig DESLIGADA) por segurança contra incêndio e risco ambiental; (3) Desvios de Posto/Credenciado geográficos são acusados por raio geográfico; (4) Crachá do motorista deve conferir com o portador real na telemetria.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* --- NEW VEHICLE STATIONARY STOPS ANALYZER LAYOUT --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Paradas Registradas</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{detectedStops.length}</p>
                </div>
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-950/20 p-5 rounded-3xl shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Classificadas com IA/Heurística</p>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                    {Object.keys(aiStopClassifications).length} / {detectedStops.length}
                  </p>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 p-5 rounded-3xl shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Inconformes (Lazer/Lojas)</p>
                  <p className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">
                    {Object.values(aiStopClassifications).filter((c: any) => c.isLeisure).length}
                  </p>
                </div>
              </div>

              {/* Adjustable Sliders Card & Gemini Run Button */}
              <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-indigo-50/10 dark:bg-slate-800/20 pb-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 leading-none text-indigo-600 dark:text-indigo-400">
                      <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
                      Critérios & Parâmetros de Detecção e Auditoria de Paradas
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed mt-1">
                      Ajuste dinamicamente o tempo mínimo de inatividade (ignição desligada) e o raio de tolerância de movimento GPS.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={runIAStopAnalysis}
                    disabled={detectedStops.length === 0 || loadingStopIA}
                    className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 text-xs font-black px-4 uppercase tracking-wider shadow-md shadow-indigo-500/15 disabled:opacity-50"
                  >
                    {loadingStopIA ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {loadingStopIA ? "Processando Auditoria..." : "Auditar com Gemini IA"}
                  </Button>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-500" />
                        Tempo Mínimo de Parada:
                      </span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-md px-2 py-0.5">{stationaryTimeThreshold} minutos</Badge>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="180"
                      step="5"
                      value={stationaryTimeThreshold}
                      onChange={(e) => setStationaryTimeThreshold(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 font-medium font-bold uppercase tracking-wider">
                      O contador de minutos inicia no momento exato em que a ignição sai de "L" (ligada) para "D" (desligada).
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        Raio de Tolerância Geográfica:
                      </span>
                      <Badge className="bg-blue-50 text-blue-700 border-none rounded-md px-2 py-0.5">{stationaryRadiusThreshold} metros</Badge>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="500"
                      step="10"
                      value={stationaryRadiusThreshold}
                      onChange={(e) => setStationaryRadiusThreshold(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 font-medium font-bold uppercase tracking-wider">
                      Define a distorção máxima permitida por satélites GPS enquanto o veículo permanecer stationary no mesmo local.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Stops Table List */}
              <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 leading-none">
                      <Activity className="h-4 w-4 text-indigo-500" />
                      Inconformidades de Parada em Horário Laboral Encontradas ({detectedStops.length})
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed mt-1">
                      Visualização de paradas prolongadas e auditoria automática do ponto de permanência em locais de lazer, praças, shoppings, academias ou mercados.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                        <TableRow className="border-none">
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3">Placa</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3">Hora Início</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3">Hora Fim</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 text-center">Duração</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3">Endereço Identificado</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 text-center">Classificação IA (Lazer?)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 text-center">Criticidade</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 text-center">Explicação / Detalhes Adicionais</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detectedStops.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
                              Nenhuma parada superior a {stationaryTimeThreshold} minutos detectada na telemetria ativa.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detectedStops.map((stop) => {
                            const classif = aiStopClassifications[stop.id];
                            
                            return (
                              <TableRow key={stop.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/30">
                                <TableCell className="font-extrabold text-xs text-slate-800 dark:text-slate-300">
                                  {stop.placa}
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                                  {stop.startDateTime.toLocaleTimeString('pt-BR')} ({stop.startDateTime.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})})
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                                  {stop.endDateTime.toLocaleTimeString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-xs font-bold text-center">
                                  <Badge className={stop.duration > 60 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}>
                                    {stop.duration} min
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-semibold text-slate-600 max-w-[200px] truncate" title={stop.address}>
                                  {stop.address}
                                </TableCell>
                                <TableCell className="text-center">
                                  {!classif ? (
                                    <Badge variant="outline" className="border-dashed border-slate-300 text-slate-400 text-[10px] font-bold">
                                      Pendente de IA
                                    </Badge>
                                  ) : classif.isLeisure ? (
                                    <Badge className="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black uppercase">
                                      🚨 {classif.placeType}
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase">
                                      ✅ {classif.placeType}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {!classif ? (
                                    <Badge variant="outline" className="border-dashed border-slate-300 text-slate-400 text-[10px] font-medium">-</Badge>
                                  ) : classif.criticality === "Alta" ? (
                                    <Badge className="bg-rose-500/10 text-rose-700 border border-rose-200 text-[10px] font-extrabold uppercase">
                                      🔴 ALTA (A)
                                    </Badge>
                                  ) : classif.criticality === "Média" || classif.criticality === "Medium" ? (
                                    <Badge className="bg-amber-500/10 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase">
                                      🟡 MÉDIA (B)
                                    </Badge>
                                  ) : classif.criticality === "Baixa" ? (
                                    <Badge className="bg-blue-500/10 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase">
                                      🔵 BAIXA (C)
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase">
                                      ⚪ NENHUMA
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs font-medium text-slate-500 leading-snug max-w-[240px]">
                                  {classif ? (
                                    <div className="space-y-1">
                                      {classif.placeNameDetected && <p className="font-black text-slate-700 dark:text-slate-300 text-[10px] uppercase">🏷️ {classif.placeNameDetected}</p>}
                                      <p className="text-[10px]">{classif.reasoning}</p>
                                    </div>
                                  ) : (
                                    <span className="italic text-slate-400">Clique em "Auditar com Gemini IA" no topo do painel para analisar esse local de parada.</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        window.open(`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`, "_blank", "noopener,noreferrer");
                                      }}
                                      className="h-8 w-8 p-0 border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-full"
                                      title="Ver no Google Maps"
                                    >
                                      <MapPin className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        // Quick notify modal
                                        const mockDevItem: DeviationItem = {
                                          placa: stop.placa,
                                          dataAbast: stop.startDateTime.toLocaleDateString('pt-BR'),
                                          status: "INCONFORMIDADE",
                                          desvio: `Parada Prolongada não Autorizada (${stop.duration} min)`,
                                          difMin: stop.duration,
                                          motoristaTelem: stop.initialRow.motorista || "-",
                                          ignicao: "DESLIGADA",
                                          obs: `O veículo permaneceu parado por ${stop.duration} min no endereço: ${stop.address}. ${classif ? `Classificação: ${classif.placeType}. Criticidade: ${classif.criticality || "Média"}. Relato: ${classif.reasoning}` : ""}`
                                        };
                                        handleOpenEmailModal(mockDevItem, true, stop);
                                      }}
                                      className="h-8 w-8 p-0 border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-full"
                                      title="Notificar Responsável"
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Informative Help Alert */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 p-4 rounded-3xl flex gap-3">
                <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-neutral-400">Instruções sobre Conformidade das Paradas Laborais</h4>
                  <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                    Conforme o regulamento de frotas, motoristas em serviço não devem permanecer estacionados por mais de 30 minutos em áreas de comércio de lazer ou recreação (shoppings, praças de alimentação, parques ou ginásios de esportes) sem justificativa da Ordem de Serviço (OS). Ao verificar suspeitas, use o botão de notificação rápida para obter explicações formais.
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}
        </div>
      </div>

      {/* Dialog para envio de e-mail ao gestor responsável */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-805">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Mail className="h-5 w-5" />
              <DialogTitle className="text-sm font-black uppercase tracking-wider">
                Enviar Notificação de Divergência
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 font-medium mt-1">
              Envie uma solicitação formal de esclarecimentos direto para a gerência responsável pelo ativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Placa do Veículo</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">{selectedRowForEmail?.placa}</span>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Gerência Responsável</span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{emailGerencia}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
                <span>E-mails dos Destinatários (separados por ponto e vírgula)</span>
                {emailDestinatarios ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[8px] font-bold py-0 h-4 uppercase">
                    Unidade Identificada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[8px] font-bold py-0 h-4 uppercase">
                    E-mail não cadastrado
                  </Badge>
                )}
              </Label>
              <Input
                type="text"
                value={emailDestinatarios}
                onChange={(e) => setEmailDestinatarios(e.target.value)}
                placeholder="Insira os e-mails separados por ponto e vírgula (;)"
                className="rounded-2xl h-11 border-slate-200 dark:border-slate-800 text-xs font-bold bg-slate-50 dark:bg-slate-950 p-3"
              />
              {!emailDestinatarios && (
                <p className="text-[10px] text-amber-500 font-semibold leading-relaxed">
                  ⚠️ Nenhum e-mail de gestor associado à gerência "{emailGerencia}". Por favor, digite manualmente acima.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assunto do E-mail</Label>
              <Input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="rounded-2xl h-11 border-slate-200 dark:border-slate-800 text-xs font-bold bg-slate-50 dark:bg-slate-950 p-3"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Corpo do E-mail</Label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={11}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-medium bg-slate-50 dark:bg-slate-950 p-4 focus:ring-2 focus:ring-indigo-550 focus:outline-none dark:text-slate-350 resize-y"
              />
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-dotted border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 font-medium">
              💡 <span className="font-bold">Nota de Cópia:</span> Este e-mail enviará automaticamente cópia oculta (CC) para as gerências de logística da COMPESA (<span className="font-bold">gadabastecimento</span> e <span className="font-bold">gadmonitoramento</span>).
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setEmailModalOpen(false)}
              className="rounded-2xl text-xs font-bold h-11 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendEmail}
              className="rounded-2xl text-xs font-black h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2 px-5 uppercase tracking-wide"
            >
              <Send className="h-4.5 w-4.5" /> Enviar E-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
