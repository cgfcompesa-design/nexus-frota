import React, { useState, useMemo } from "react";
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
  Info
} from "lucide-react";
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
  const [selectedPlaca, setSelectedPlaca] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [strictDrivers, setStrictDrivers] = useState<boolean>(false);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  
  // Telemetry parsed files state
  const [telemetryFiles, setTelemetryFiles] = useState<Array<{
    fileName: string;
    placa: string;
    periodo: string;
    rows: TelemetryRow[];
  }>>([]);

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

        // REGRA 4 - IGNIÇÃO DESLIGADA
        if (ignicao === "DESLIGADA") {
          deviations.push({
            placa: placaA,
            dataAbast: dataA.toLocaleString('pt-BR'),
            status: "MATCH",
            desvio: "IGNICAO DESLIGADA",
            difMin: melhorDiff.toFixed(1),
            motoristaTelem: matchedTR.motorista || "N/A",
            ignicao,
            obs: "ABASTECIMENTO COM MOTOR DESLIGADO (PARÂMETRO PADRÃO REGULAMENTAR)",
            litros: f["LITROS"],
            posto: postoA,
            motoristaAbast: rawDriverA
          });
          hasDeviations = true;
        }

        // REGRA 5 - TELEMETRIA SEM MOTORISTA
        if (!motoristaT) {
          deviations.push({
            placa: placaA,
            dataAbast: dataA.toLocaleString('pt-BR'),
            status: "SEM DADO",
            desvio: "TELEMETRIA SEM MOTORISTA",
            difMin: melhorDiff.toFixed(1),
            motoristaTelem: matchedTR.motorista || "NÃO IDENTIFICADO",
            ignicao,
            obs: "TELEMETRIA REGISTROU PASSAGEM DO CARTÃO SEM RECONHECIMENTO DO MOTORISTA",
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

    return deviations;
  }, [telemetryFile, telemetryFiles, fuel, selectedPlaca, startDate, endDate, strictDrivers]);

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
  }, [crossDataResults, searchFilter]);

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
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Dif (Min)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Ignicação</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3 h-auto">Observação do Cruzamento / Endereço</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {finalFilteredResults.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
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
                            } else if (row.desvio === "TELEMETRIA SEM MOTORISTA") {
                              desvioBadge = (
                                <span className="text-purple-600 font-extrabold text-[10px] uppercase">
                                  🔑 Sem Motorista
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
          )}
        </div>
      </div>
    </div>
  );
}
