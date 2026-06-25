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
import { 
  Wrench, 
  Search, 
  Save, 
  Check, 
  Fuel, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  LogOut,
  FileText,
  TrendingUp,
  Layers,
  Clock,
  History,
  Bell,
  Mail,
  Settings,
  AlertTriangle,
  X,
  Copy
} from "lucide-react";
import { useContactsData } from "@/hooks/useContactsData";
import { auth, db } from "../../lib/firebase";
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { UserProfile } from "../../types";
import { toast } from "sonner";

interface CadastroPreventivaPageProps {
  onBack?: () => void;
  hideBackButton?: boolean;
  userProfile?: UserProfile | null;
}

const LOCADORAS = [
  "CS BRASIL",
  "LOCSERV",
  "LOCADORA CAXANGA",
  "LOCAVEL",
  "PBF GRAFICA"
];

const LOCADORA_EMAILS_MAP: Record<string, string> = {
  "LOCAVEL": "patricio@grupolocavel.com.br; carloseduardo@locavel.com.br",
  "LOCADORA CAXANGA": "operacionalpe@locadora.net.br; agendamento@locadora.net.br; manutencaope@locadora.net.br",
  "LOCSERV": "operacionalpe@locadora.net.br; agendamento@locadora.net.br; manutencaope@locadora.net.br",
  "CS BRASIL": "atendimento.pernambuco@csbrasilservicos.com.br",
  "PBF GRAFICA": "frota@pbfgraficatextil.com.br",
};

const getLocadoraEmails = (locadoraName: string): string => {
  if (!locadoraName) return "gadlocados@compesa.com.br";
  const normalizedKey = locadoraName.toUpperCase().trim();
  const emails = LOCADORA_EMAILS_MAP[normalizedKey] || "";
  return emails ? `gadlocados@compesa.com.br; ${emails}` : "gadlocados@compesa.com.br";
};

const REVISAO_OPCOES = [1000, 5000, 10000, 15000, 20000, 40000];

export default function CadastroPreventivaPage({ onBack, hideBackButton = false, userProfile }: CadastroPreventivaPageProps) {
  const [selectedLocadora, setSelectedLocadora] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedModelo, setSelectedModelo] = useState<string>("TODOS");
  const [selectedMarca, setSelectedMarca] = useState<string>("TODOS");
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("TODOS");
  const [selectedGerencia, setSelectedGerencia] = useState<string>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [selectedTipo, setSelectedTipo] = useState<string>("TODOS");

  useEffect(() => {
    setSelectedModelo("TODOS");
    setSelectedMarca("TODOS");
    setSelectedDiretoria("TODOS");
    setSelectedGerencia("TODOS");
    setSelectedStatus("TODOS");
    setSelectedTipo("TODOS");
    setSearchTerm("");
  }, [selectedLocadora]);

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();
  const { data: fuel = [], isLoading: isLoadingFuel } = useFuelData();
  const { data: sheetPreventivas = [] } = usePreventiveLocadosData();
  const { data: rawFirebasePreventivas = {}, save, refetch: refetchFirebase } = useFirebasePreventivas();
  const firebasePreventivas = useMemo(() => rawFirebasePreventivas as Record<string, FirebasePreventiveData>, [rawFirebasePreventivas]);

  const allowedLocadoras = useMemo(() => {
    if (userProfile?.role === 'LOCADORA') {
      return userProfile.locadoras || [];
    }
    return LOCADORAS;
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.role === 'LOCADORA') {
      const allowed = userProfile.locadoras || [];
      if (allowed.length > 0 && !allowed.includes(selectedLocadora)) {
        setSelectedLocadora(allowed[0]);
      }
    }
  }, [userProfile, selectedLocadora]);

  // Local editing states to avoid updating Firestore on every key stroke
  const [editedRows, setEditedRows] = useState<Record<string, {
    odometroRevisao: string;
    revisaoPrevista: string;
    dataRevisao: string;
  }>>({});

  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  interface ActivityLog {
    id: string;
    placa: string;
    odometroRevisao: number;
    revisaoPrevista: number;
    dataRevisao: string;
    locadora: string;
    usuarioEmail: string;
    usuarioNome: string;
    timestamp: any;
    tipo: "individual" | "lote";
  }

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // States for Email Configuration and Scheduled Notification Logs
  const [emailConfig, setEmailConfig] = useState<{
    active: boolean;
    emails: string;
    frequencia: "imediato" | "diario" | "semanal";
    horario: string;
  }>({
    active: false,
    emails: "gestaofrota@compesa.com.br, gadlocados@compesa.com.br",
    frequencia: "imediato",
    horario: "08:00"
  });
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  interface ScheduledEmailLog {
    id: string;
    placa: string;
    modelo: string;
    odometroAtual: number;
    odometroRevisao: number;
    revisaoPrevista: number;
    odometroProximaRevisao: number;
    porcentagemUso: number;
    destinatarios: string[];
    frequencia: string;
    envioAgendadoPara: string;
    status: "Agendado" | "Enviado";
    locadora: string;
    createdAt: any;
    subject: string;
    body: string;
  }
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailLog[]>([]);
  const [isLoadingScheduledEmails, setIsLoadingScheduledEmails] = useState(false);

  // States and functions for manual notification email generator modal for overdue (vencida) preventivas
  const { getEmailsByGerencia, contactsData = [], isLoading: isContactsLoading } = useContactsData();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedVehicleForEmail, setSelectedVehicleForEmail] = useState<any>(null);
  const [emailSelectedUnidade, setEmailSelectedUnidade] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");
  const [emailTo, setEmailTo] = useState<string>("");
  const [emailCc, setEmailCc] = useState<string>("gadlocados@compesa.com.br");

  // Group by Unit states for consolidated notifications
  const [isGroupEmailModalOpen, setIsGroupEmailModalOpen] = useState(false);
  const [selectedGroupUnit, setSelectedGroupUnit] = useState<string>("");
  const [groupEmailSubject, setGroupEmailSubject] = useState<string>("");
  const [groupEmailBody, setGroupEmailBody] = useState<string>("");
  const [groupEmailTo, setGroupEmailTo] = useState<string>("");
  const [groupEmailCc, setGroupEmailCc] = useState<string>("gadlocados@compesa.com.br");

  const handleOpenEmailModal = (vehicle: any, state: any, odometroAtual: number, odometroProximaRevisao: number, odometroRestante: number) => {
    setSelectedVehicleForEmail(vehicle);
    
    // Find initial matching unit if possible by matching vehicle.GERENCIA
    const vGer = String(vehicle.GERENCIA || vehicle["GERÊNCIA"] || vehicle.gerencia || "").toUpperCase().trim();
    
    // Attempt to map to contactsData unit names
    const matchingUnit = (contactsData as any[]).find(c => {
      const normalize = (s: string) => String(s || "").toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
      return normalize(c.gerencia) === normalize(vGer);
    });

    const initUnidade = matchingUnit ? matchingUnit.gerencia : "";
    setEmailSelectedUnidade(initUnidade);

    const destEmails = matchingUnit ? getEmailsByGerencia(initUnidade).join(", ") : "";
    setEmailTo(destEmails);

    const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
    const modelo = String(vehicle.MODELO || vehicle.modelo || "N/A").trim();
    const marca = String(vehicle.MARCA || vehicle.marca || "N/A").trim();
    const propriedade = String(vehicle.PROPRIEDADE || vehicle.propriedade || vehicle.PROPRIEDADE_TIPO || "Locado").trim();
    const ano = String(vehicle.ANO || vehicle.ano || vehicle.MODELO_ANO || vehicle.modelo_ano || "N/A").trim();

    // Preventiva anterior details
    const odoRev = Number(state.odometroRevisao || 0);
    const dataRev = state.dataRevisao ? new Date(state.dataRevisao).toLocaleDateString("pt-BR") : "Não registrada";
    const revPrev = Number(state.revisaoPrevista || 10000);

    const subjectText = `[Nexus Frota - Alerta Preventiva] Veículo Placa ${placa} com Preventiva Vencida`;
    
    const bodyText = `Prezado(a) Gestor(a),

Identificamos que o veículo abaixo está com a preventiva vencida:

• Veículo Placa: ${placa}
• Modelo: ${modelo} (${marca})
• Propriedade: ${propriedade}
• Ano: ${ano}
• Unidade: ${initUnidade || vGer || "N/A"}

Histórico / Detalhes da Preventiva:
- KM Anterior de Revisão: ${odoRev.toLocaleString('pt-BR')} KM
- Data da Revisão Anterior: ${dataRev}
- Intervalo de Revisão Configurado: ${revPrev.toLocaleString('pt-BR')} KM
- KM Limite para Próxima Revisão: ${odometroProximaRevisao.toLocaleString('pt-BR')} KM
- KM de Leitura Atual: ${odometroAtual.toLocaleString('pt-BR')} KM
- KM Excedente: ${Math.abs(odometroRestante).toLocaleString('pt-BR')} KM

Solicitamos o agendamento urgente da manutenção do veículo junto à locadora competente de modo a mitigar o risco de quebras mecânicas e desvio contratual.

Atenciosamente,
Coordenação de Gestão de Frotas (CGF) - COMPESA`;

    setEmailSubject(subjectText);
    setEmailBody(bodyText);
    setEmailCc(getLocadoraEmails(selectedLocadora));
    setIsEmailModalOpen(true);
  };

  const handleEmailUnidadeChange = (unidade: string) => {
    setEmailSelectedUnidade(unidade);
    const dests = getEmailsByGerencia(unidade);
    setEmailTo(dests.join(", "));

    if (selectedVehicleForEmail) {
      const v = selectedVehicleForEmail;
      const vGer = String(v.GERENCIA || v["GERÊNCIA"] || v.gerencia || "").toUpperCase().trim();
      const placa = String(v.PLACA || v.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const modelo = String(v.MODELO || v.modelo || "N/A").trim();
      const marca = String(v.MARCA || v.marca || "N/A").trim();
      const propriedade = String(v.PROPRIEDADE || v.propriedade || v.PROPRIEDADE_TIPO || "Locado").trim();
      const ano = String(v.ANO || v.ano || v.MODELO_ANO || v.modelo_ano || "N/A").trim();

      const state = editedRows[placa] || { odometroRevisao: "", revisaoPrevista: "10000", dataRevisao: "" };
      const odoRev = Number(state.odometroRevisao || 0);
      const dataRev = state.dataRevisao ? new Date(state.dataRevisao).toLocaleDateString("pt-BR") : "Não registrada";
      const revPrev = Number(state.revisaoPrevista || 10000);
      const odometroProximaRevisao = odoRev + revPrev;
      const odometroAtual = latestOdometersMap.get(placa) || 0;
      const odometroRestante = odometroProximaRevisao - odometroAtual;

      const bodyText = `Prezado(a) Gestor(a),

Identificamos que o veículo abaixo está com a preventiva vencida:

• Veículo Placa: ${placa}
• Modelo: ${modelo} (${marca})
• Propriedade: ${propriedade}
• Ano: ${ano}
• Unidade: ${unidade}

Histórico / Detalhes da Preventiva:
- KM Anterior de Revisão: ${odoRev.toLocaleString('pt-BR')} KM
- Data da Revisão Anterior: ${dataRev}
- Intervalo de Revisão Configurado: ${revPrev.toLocaleString('pt-BR')} KM
- KM Limite para Próxima Revisão: ${odometroProximaRevisao.toLocaleString('pt-BR')} KM
- KM de Leitura Atual: ${odometroAtual.toLocaleString('pt-BR')} KM
- KM Excedente: ${Math.abs(odometroRestante).toLocaleString('pt-BR')} KM

Solicitamos o agendamento urgente da manutenção do veículo junto à locadora competente de modo a mitigar o risco de quebras mecânicas e desvio contratual.

Atenciosamente,
Coordenação de Gestão de Frotas (CGF) - COMPESA`;

      setEmailBody(bodyText);
    }
  };

  const handleSendManualEmail = () => {
    if (!emailTo) {
      toast.warning("Não há destinatários mapeados para esta Unidade. Você pode digitar um destinatário manualmente.");
    }
    const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}&cc=${encodeURIComponent(emailCc)}`;
    window.location.href = mailtoUrl;
    setIsEmailModalOpen(false);
    toast.success("E-mail disparado para o gerenciador!");
  };

  const fetchEmailConfigAndLogs = async () => {
    if (!selectedLocadora) return;
    setIsLoadingConfig(true);
    setIsLoadingScheduledEmails(true);
    try {
      const configDocRef = doc(db, "preventiva_email_configs", selectedLocadora.toUpperCase().trim());
      const docSnap = await getDoc(configDocRef);
      if (docSnap.exists()) {
        const d = docSnap.data();
        setEmailConfig({
          active: d.active ?? false,
          emails: d.emails || "gestaofrota@compesa.com.br, gadlocados@compesa.com.br",
          frequencia: d.frequencia || "imediato",
          horario: d.horario || "08:00",
        });
      } else {
        setEmailConfig({
          active: false,
          emails: "gestaofrota@compesa.com.br, gadlocados@compesa.com.br",
          frequencia: "imediato",
          horario: "08:00"
        });
      }

      const q = query(
        collection(db, "preventiva_scheduled_emails"),
        where("locadora", "==", selectedLocadora.toUpperCase().trim())
      );
      const querySnapshot = await getDocs(q);
      const list: ScheduledEmailLog[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        list.push({
          id: doc.id,
          placa: d.placa || "",
          modelo: d.modelo || "",
          odometroAtual: Number(d.odometroAtual || 0),
          odometroRevisao: Number(d.odometroRevisao || 0),
          revisaoPrevista: Number(d.revisaoPrevista || 10000),
          odometroProximaRevisao: Number(d.odometroProximaRevisao || 0),
          porcentagemUso: Number(d.porcentagemUso || 0),
          destinatarios: d.destinatarios || [],
          frequencia: d.frequencia || "imediato",
          envioAgendadoPara: d.envioAgendadoPara || "",
          status: d.status || "Agendado",
          locadora: d.locadora || "",
          createdAt: d.createdAt,
          subject: d.subject || "",
          body: d.body || ""
        });
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return timeB - timeA;
      });
      setScheduledEmails(list.slice(0, 50));
    } catch (err) {
      console.error("Erro ao carregar configurações de e-mail:", err);
    } finally {
      setIsLoadingConfig(false);
      setIsLoadingScheduledEmails(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    if (!selectedLocadora) return;
    setIsSavingConfig(true);
    try {
      const configDocRef = doc(db, "preventiva_email_configs", selectedLocadora.toUpperCase().trim());
      await setDoc(configDocRef, {
        locadora: selectedLocadora.toUpperCase().trim(),
        active: emailConfig.active,
        emails: emailConfig.emails,
        frequencia: emailConfig.frequencia,
        horario: emailConfig.horario,
        updatedBy: auth.currentUser?.email || "anonimo@compesa.com.br",
        updatedAt: serverTimestamp()
      });
      toast.success("Configuração de alertas de e-mail atualizada com sucesso!");
      fetchEmailConfigAndLogs();
    } catch (err) {
      console.error("Erro ao salvar configuração de e-mail:", err);
      toast.error("Erro ao atualizar configuração de e-mail.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const logActivity = async (
    placa: string,
    odoRev: number,
    revPrev: number,
    dataRev: string,
    tipo: "individual" | "lote"
  ) => {
    try {
      await addDoc(collection(db, "preventiva_locadora_logs"), {
        placa,
        odometroRevisao: Number(odoRev),
        revisaoPrevista: Number(revPrev),
        dataRevisao: dataRev,
        locadora: selectedLocadora.toUpperCase().trim(),
        usuarioEmail: auth.currentUser?.email || "anonimo@compesa.com.br",
        usuarioNome: auth.currentUser?.displayName || "Usuário",
        timestamp: serverTimestamp(),
        tipo
      });
    } catch (err) {
      console.error("Erro ao registrar log de atividade:", err);
    }
  };

  const fetchActivityLogs = async () => {
    if (!selectedLocadora) return;
    setIsLoadingLogs(true);
    try {
      const q = query(
        collection(db, "preventiva_locadora_logs"),
        where("locadora", "==", selectedLocadora.toUpperCase().trim())
      );
      const querySnapshot = await getDocs(q);
      const logsList: ActivityLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logsList.push({
          id: doc.id,
          placa: data.placa || "",
          odometroRevisao: Number(data.odometroRevisao || 0),
          revisaoPrevista: Number(data.revisaoPrevista || 10000),
          dataRevisao: data.dataRevisao || "",
          locadora: data.locadora || "",
          usuarioEmail: data.usuarioEmail || "",
          usuarioNome: data.usuarioNome || "Usuário",
          timestamp: data.timestamp,
          tipo: data.tipo || "individual",
        });
      });
      // Sort client-side desc avoiding compound index prerequisite
      logsList.sort((a, b) => {
        const timeA = a.timestamp?.seconds || (a.timestamp instanceof Date ? a.timestamp.getTime() / 1000 : 0);
        const timeB = b.timestamp?.seconds || (b.timestamp instanceof Date ? b.timestamp.getTime() / 1000 : 0);
        return timeB - timeA;
      });
      setActivityLogs(logsList.slice(0, 20));
    } catch (error) {
      console.error("Erro ao carregar histórico de atividades:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (selectedLocadora) {
      fetchActivityLogs();
      fetchEmailConfigAndLogs();
    }
  }, [selectedLocadora]);

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

    // Security check: LOCADORA users can only load datasets of locadoras they own
    if (userProfile?.role === 'LOCADORA') {
      const allowed = userProfile.locadoras || [];
      if (!allowed.includes(selectedLocadora)) {
        return [];
      }
    }

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

  // Check if saved odometer creates "Pendente" status and schedule notification e-mail
  const checkAndScheduleEmail = async (placa: string, odoRev: number, revPrev: number, dataRev: string) => {
    if (!emailConfig.active || !selectedLocadora) return;
    
    // Find vehicle info
    const vehicle = locadoraVehicles.find(v => {
      const p = String(v.PLACA || v.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      return p === placa;
    });
    
    const odometroAtual = latestOdometersMap.get(placa) || 0;
    const odometroProximaRevisao = odoRev + revPrev;
    const odometroRestante = odometroProximaRevisao - odometroAtual;
    const isOverdue = odometroRestante < 0;
    
    // Only schedule if status is 'Pendente'
    if (isOverdue) {
      const parsedEmails = emailConfig.emails.split(",").map(e => e.trim()).filter(Boolean);
      if (parsedEmails.length === 0) return;

      const percentUso = revPrev > 0 ? ((odometroAtual - odoRev) / revPrev) * 100 : 100;
      
      // Calculate scheduled date based on selected frequency
      const scheduledDate = new Date();
      if (emailConfig.frequencia === 'diario') {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
        const [h, m] = emailConfig.horario.split(":");
        scheduledDate.setHours(Number(h || 8), Number(m || 0), 0, 0);
      } else if (emailConfig.frequencia === 'semanal') {
        const day = scheduledDate.getDay();
        const dist = (7 - day + 1) % 7; // Distance to next Monday
        scheduledDate.setDate(scheduledDate.getDate() + (dist === 0 ? 7 : dist));
        const [h, m] = emailConfig.horario.split(":");
        scheduledDate.setHours(Number(h || 8), Number(m || 0), 0, 0);
      }

      const modelo = vehicle ? String(vehicle.MODELO || vehicle.modelo || "N/A").trim() : "N/A";
      const subject = `[Nexus Frota - Alerta Preventiva] Veículo Placa ${placa} com Odômetro Pendente (${Math.round(percentUso)}% Consumido)`;
      const body = `Olá Gestão Nexus Frota,\n\nA locadora ${selectedLocadora} registrou uma atualização de manutenção para o veículo de placa ${placa} e o status foi classificado como PENDENTE (Excedeu KM).\n\nDetalhes do veículo:\n- Modelo: ${modelo}\n- Marca: ${vehicle ? String(vehicle.MARCA || vehicle.marca || "N/A").trim() : "N/A"}\n- Diretoria: ${vehicle ? String(vehicle.DIRETORIA || vehicle.diretoria || "N/A").trim() : "N/A"}\n\nMétricas da Revisão:\n- Odômetro Atual: ${odometroAtual.toLocaleString()} KM\n- Última Revisão Registrada: ${odoRev.toLocaleString()} KM\n- Intervalo Configurado: ${revPrev.toLocaleString()} KM\n- KM de Próxima Revisão: ${odometroProximaRevisao.toLocaleString()} KM\n- KM de Atraso: ${Math.abs(odometroRestante).toLocaleString()} KM\n- Percentual de Consumo: ${Math.round(percentUso)}%\n\nEsta é uma notificação automática agendada com frequência "${emailConfig.frequencia.toUpperCase()}" para envio em ${scheduledDate.toLocaleString("pt-BR")}.\n\nAtenciosamente,\nHub Nexus Frota`;

      try {
        await addDoc(collection(db, "preventiva_scheduled_emails"), {
          placa,
          modelo,
          odometroAtual,
          odometroRevisao: odoRev,
          revisaoPrevista: revPrev,
          odometroProximaRevisao,
          porcentagemUso: Math.round(percentUso),
          destinatarios: parsedEmails,
          frequencia: emailConfig.frequencia,
          envioAgendadoPara: scheduledDate.toISOString(),
          status: "Agendado",
          locadora: selectedLocadora.toUpperCase().trim(),
          createdAt: serverTimestamp(),
          subject,
          body
        });
        
        toast.info(`Email de notificação para a placa ${placa} agendado para ${scheduledDate.toLocaleDateString("pt-BR")} às ${emailConfig.horario}!`);
        fetchEmailConfigAndLogs();
      } catch (err) {
        console.error("Erro ao agendar e-mail de notificação:", err);
      }
    }
  };

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
      await logActivity(placa, odoRev, revPrev, dataRev, "individual");
      await checkAndScheduleEmail(placa, odoRev, revPrev, dataRev);
      fetchActivityLogs();
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
        await logActivity(placa, odoRev, revPrev, dataRev, "lote");
        await checkAndScheduleEmail(placa, odoRev, revPrev, dataRev);
      } catch (err) {
        console.error(`Erro ao salvar placa ${placa}:`, err);
      }
    });

    const savePromise = Promise.all(promises).then(() => {
      fetchActivityLogs();
    });

    toast.promise(savePromise, {
      loading: "Salvando todos os registros...",
      success: "Revisões salvas com sucesso!",
      error: "Erro parcial ao salvar alguns registros.",
    });
  };

  // Filter vehicle option lists based on locadoraVehicles
  const modeloOptions = useMemo(() => {
    const set = new Set<string>();
    locadoraVehicles.forEach(v => {
      const model = String(v.MODELO || v.modelo || "").trim();
      if (model) set.add(model);
    });
    return ["TODOS", ...Array.from(set).sort()];
  }, [locadoraVehicles]);

  const marcaOptions = useMemo(() => {
    const set = new Set<string>();
    locadoraVehicles.forEach(v => {
      const brand = String(v.MARCA || v.marca || "").trim();
      if (brand) set.add(brand);
    });
    return ["TODOS", ...Array.from(set).sort()];
  }, [locadoraVehicles]);

  const diretoriaOptions = useMemo(() => {
    const set = new Set<string>();
    locadoraVehicles.forEach(v => {
      const dir = String(v.DIRETORIA || v.diretoria || "").trim();
      if (dir) set.add(dir);
    });
    return ["TODOS", ...Array.from(set).sort()];
  }, [locadoraVehicles]);

  const gerenciaOptions = useMemo(() => {
    const set = new Set<string>();
    locadoraVehicles.forEach(v => {
      const ger = String(v.GERENCIA || v["GERÊNCIA"] || v.gerencia || "").trim();
      if (ger) set.add(ger);
    });
    return ["TODOS", ...Array.from(set).sort()];
  }, [locadoraVehicles]);

  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    locadoraVehicles.forEach(v => {
      const tipo = String(v.TIPO || v.Tipo || v["TIPO VEICULO"] || "").trim();
      if (tipo) set.add(tipo);
    });
    return ["TODOS", ...Array.from(set).sort()];
  }, [locadoraVehicles]);

  const statusOptions = ["TODOS", "EM DIA", "PENDENTE", "NÃO INICIADA"];

  // Filter vehicles by search term and dropdown selections
  const filteredVehicles = useMemo(() => {
    return locadoraVehicles.filter(v => {
      // 1. Placa / SearchTerm
      const placa = String(v.PLACA || v.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      if (searchTerm) {
        const cleanSearch = searchTerm.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
        if (!placa.includes(cleanSearch)) return false;
      }

      // 2. Modelo
      if (selectedModelo !== "TODOS") {
        const model = String(v.MODELO || v.modelo || "").trim();
        if (model !== selectedModelo) return false;
      }

      // 3. Marca
      if (selectedMarca !== "TODOS") {
        const brand = String(v.MARCA || v.marca || "").trim();
        if (brand !== selectedMarca) return false;
      }

      // 4. Diretoria
      if (selectedDiretoria !== "TODOS") {
        const dir = String(v.DIRETORIA || v.diretoria || "").trim();
        if (dir !== selectedDiretoria) return false;
      }

      // 5. Gerência
      if (selectedGerencia !== "TODOS") {
        const ger = String(v.GERENCIA || v["GERÊNCIA"] || v.gerencia || "").trim();
        if (ger !== selectedGerencia) return false;
      }

      // 6. Tipo
      if (selectedTipo !== "TODOS") {
        const tipo = String(v.TIPO || v.Tipo || v["TIPO VEICULO"] || "").trim();
        if (tipo !== selectedTipo) return false;
      }

      // 7. Status
      if (selectedStatus !== "TODOS") {
        const state = editedRows[placa];
        const odometroRevisaoNum = state ? Number(state.odometroRevisao || 0) : 0;
        const revisaoPrevistaNum = state ? Number(state.revisaoPrevista || 10000) : 10000;
        const odometroProximaRevisao = odometroRevisaoNum + revisaoPrevistaNum;
        const odometroAtual = latestOdometersMap.get(placa) || 0;
        const odometroRestante = (state && state.odometroRevisao) ? (odometroProximaRevisao - odometroAtual) : 0;
        
        const isOverdue = odometroRestante < 0;
        const status = (state && state.odometroRevisao) ? (isOverdue ? "Pendente" : "Em Dia") : "Não Iniciada";
        
        if (selectedStatus === "PENDENTE" && status !== "Pendente") return false;
        if (selectedStatus === "EM DIA" && status !== "Em Dia") return false;
        if (selectedStatus === "NÃO INICIADA" && status !== "Não Iniciada") return false;
      }

      return true;
    });
  }, [
    locadoraVehicles,
    searchTerm,
    selectedModelo,
    selectedMarca,
    selectedDiretoria,
    selectedGerencia,
    selectedTipo,
    selectedStatus,
    editedRows,
    latestOdometersMap
  ]);

  // Calculate stats for Meu Desempenho
  const stats = useMemo(() => {
    if (!selectedLocadora || locadoraVehicles.length === 0) {
      return { total: 0, cadastrado: 0, pendenteDados: 0, emDia: 0, pendenteKM: 0, percent: 0 };
    }

    let total = locadoraVehicles.length;
    let cadastrado = 0;
    let emDia = 0;
    let pendenteKM = 0;

    locadoraVehicles.forEach(vehicle => {
      const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const state = editedRows[placa];
      if (state && state.odometroRevisao) {
        cadastrado++;
        const odometroRevisaoNum = Number(state.odometroRevisao || 0);
        const revisaoPrevistaNum = Number(state.revisaoPrevista || 10000);
        const odometroProximaRevisao = odometroRevisaoNum + revisaoPrevistaNum;
        const odometroAtual = latestOdometersMap.get(placa) || 0;
        const odometroRestante = odometroProximaRevisao - odometroAtual;
        if (odometroRestante < 0) {
          pendenteKM++;
        } else {
          emDia++;
        }
      }
    });

    const pendenteDados = total - cadastrado;
    const percent = total > 0 ? Math.round((cadastrado / total) * 100) : 0;

    return { total, cadastrado, pendenteDados, emDia, pendenteKM, percent };
  }, [locadoraVehicles, editedRows, latestOdometersMap, selectedLocadora]);

  // Notifications for LOCADORA users when a vehicle reaches 80% or more of its revision limit
  const alertNotifications = useMemo(() => {
    if (!selectedLocadora || locadoraVehicles.length === 0) return [];
    
    return locadoraVehicles.map(vehicle => {
      const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const state = editedRows[placa];
      const modelo = vehicle.MODELO || vehicle.modelo || "Não especificado";
      
      if (!state || !state.odometroRevisao) {
        return null;
      }
      
      const odometroRevisaoNum = Number(state.odometroRevisao || 0);
      const revisaoPrevistaNum = Number(state.revisaoPrevista || 10000);
      const odometroProximaRevisao = odometroRevisaoNum + revisaoPrevistaNum;
      const odometroAtual = latestOdometersMap.get(placa) || 0;
      
      const kmTrajetos = odometroAtual - odometroRevisaoNum;
      const porcentagemUso = revisaoPrevistaNum > 0 ? (kmTrajetos / revisaoPrevistaNum) * 100 : 0;
      
      if (porcentagemUso >= 80) {
        const kmRestantes = odometroProximaRevisao - odometroAtual;
        return {
          placa,
          modelo,
          odometroAtual,
          odometroRevisao: odometroRevisaoNum,
          revisaoPrevista: revisaoPrevistaNum,
          odometroProximaRevisao,
          porcentagemUso: Math.round(porcentagemUso),
          kmRestantes,
          status: porcentagemUso >= 100 ? ("excedido" as const) : ("alerta" as const)
        };
      }
      return null;
    }).filter(Boolean) as {
      placa: string;
      modelo: string;
      odometroAtual: number;
      odometroRevisao: number;
      revisaoPrevista: number;
      odometroProximaRevisao: number;
      porcentagemUso: number;
      kmRestantes: number;
      status: "excedido" | "alerta";
    }[];
  }, [locadoraVehicles, editedRows, latestOdometersMap, selectedLocadora]);

  // Compute group pendings by unit
  const groupedPendingsByUnit = useMemo(() => {
    const groups: Record<string, any[]> = {};
    if (!locadoraVehicles) return groups;
    
    locadoraVehicles.forEach(vehicle => {
      const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const state = editedRows[placa];
      if (state && state.odometroRevisao) {
        const odometroRevisaoNum = Number(state.odometroRevisao || 0);
        const revisaoPrevistaNum = Number(state.revisaoPrevista || 10000);
        const odometroProximaRevisao = odometroRevisaoNum + revisaoPrevistaNum;
        const odometroAtual = latestOdometersMap.get(placa) || 0;
        const odometroRestante = odometroProximaRevisao - odometroAtual;
        
        if (odometroRestante < 0) {
          // This vehicle has pending/overdue revision
          const ger = String(vehicle.GERENCIA || vehicle["GERÊNCIA"] || vehicle.gerencia || "N/A").trim().toUpperCase();
          if (!groups[ger]) {
            groups[ger] = [];
          }
          groups[ger].push({
            vehicle,
            state,
            odometroAtual,
            odometroProximaRevisao,
            odometroRestante
          });
        }
      }
    });
    
    return groups;
  }, [locadoraVehicles, editedRows, latestOdometersMap]);

  const generateGroupBodyText = (unitName: string, items: any[]) => {
    const platesListStr = items.map((item, idx) => {
      const v = item.vehicle;
      const placa = String(v.PLACA || v.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const model = String(v.MODELO || v.modelo || "N/A").trim();
      const brand = String(v.MARCA || v.marca || "N/A").trim();
      const st = item.state;
      const odoRev = Number(st.odometroRevisao || 0);
      const odometroProximaRevisao = item.odometroProximaRevisao;
      const odometroAtual = item.odometroAtual;
      const odometroRestante = item.odometroRestante;
      
      return `${idx + 1}. Placa: ${placa} | Modelo: ${model} (${brand})
   - KM Última Revisão: ${odoRev.toLocaleString('pt-BR')} KM
   - Limite Próxima Revisão: ${odometroProximaRevisao.toLocaleString('pt-BR')} KM
   - Leitura Atual (KM): ${odometroAtual.toLocaleString('pt-BR')} KM
   - KM Excedido: ${Math.abs(odometroRestante).toLocaleString('pt-BR')} KM`;
    }).join("\n\n");

    return `Prezado(a) Gestor(a),

Identificamos que a sua unidade possui veículos com a manutenção preventiva (revisão) vencida. Solicitamos o agendamento urgente das revisões junto à locadora competente de modo a mitigar o risco de quebras mecânicas e desvio contratual.

Abaixo segue a lista dos veículos pendentes para agendamento:

${platesListStr}

Prezada Locadora, por gentileza, realizar os agendamentos, respondendo a este e-mail informando as datas dos agendamentos.

Atenciosamente,
Coordenação de Gestão de Frotas (CGF) - COMPESA`;
  };

  // Handler to open and initialize the Group Email modal
  const handleOpenGroupEmailModal = () => {
    const availableUnits = Object.keys(groupedPendingsByUnit);
    if (availableUnits.length === 0) {
      toast.info("Não há nenhum veículo com manutenção preventiva vencida (Pendente) para esta locadora no momento!");
      return;
    }

    const initialUnit = availableUnits[0];
    setSelectedGroupUnit(initialUnit);

    const dests = getEmailsByGerencia(initialUnit);
    setGroupEmailTo(dests.join(", "));

    // Dynamic CC with locadora emails
    const locadoraCC = getLocadoraEmails(selectedLocadora);
    setGroupEmailCc(locadoraCC);

    const items = groupedPendingsByUnit[initialUnit] || [];
    const subjectText = `[Nexus Frota - Alerta Preventiva] Revisões Preventivas Vencidas - Unidade ${initialUnit}`;
    const bodyText = generateGroupBodyText(initialUnit, items);

    setGroupEmailSubject(subjectText);
    setGroupEmailBody(bodyText);
    setIsGroupEmailModalOpen(true);
  };

  // When selected unit changes in the group modal
  const handleGroupUnitChange = (unidade: string) => {
    setSelectedGroupUnit(unidade);
    const dests = getEmailsByGerencia(unidade);
    setGroupEmailTo(dests.join(", "));

    const items = groupedPendingsByUnit[unidade] || [];
    const subjectText = `[Nexus Frota - Alerta Preventiva] Revisões Preventivas Vencidas - Unidade ${unidade}`;
    const bodyText = generateGroupBodyText(unidade, items);

    setGroupEmailSubject(subjectText);
    setGroupEmailBody(bodyText);
  };

  const handleSendGroupEmail = () => {
    if (!groupEmailTo) {
      toast.warning("Não há destinatários mapeados para esta Unidade. Você pode digitar um destinatário manualmente.");
    }
    const mailtoUrl = `mailto:${encodeURIComponent(groupEmailTo)}?subject=${encodeURIComponent(groupEmailSubject)}&body=${encodeURIComponent(groupEmailBody)}&cc=${encodeURIComponent(groupEmailCc)}`;
    window.location.href = mailtoUrl;
    setIsGroupEmailModalOpen(false);
    toast.success("E-mail conjunto gerado para envio!");
  };

  // PDF report exporter
  const handleExportPDF = () => {
    if (!selectedLocadora) {
      toast.error("Por favor, selecione uma locadora para exportar o relatório.");
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      toast.error("Não foi possível gerar a visualização para impressão.");
      return;
    }

    const total = locadoraVehicles.length;
    let emDiaCount = 0;
    let pendenteCount = 0;
    let naoIniciadaCount = 0;

    const rowsHtml = locadoraVehicles.map(vehicle => {
      const placa = String(vehicle.PLACA || vehicle.placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const state = editedRows[placa] || { odometroRevisao: "", revisaoPrevista: "10000", dataRevisao: "" };
      const odometroRevisaoNum = Number(state.odometroRevisao || 0);
      const revisaoPrevistaNum = Number(state.revisaoPrevista || 10000);
      const odometroProximaRevisao = odometroRevisaoNum + revisaoPrevistaNum;
      const odometroAtual = latestOdometersMap.get(placa) || 0;
      const odometroRestante = state.odometroRevisao ? (odometroProximaRevisao - odometroAtual) : 0;
      const isOverdue = odometroRestante < 0;
      const status = state.odometroRevisao ? (isOverdue ? "Pendente" : "Em Dia") : "Não Iniciada";

      if (state.odometroRevisao) {
        if (isOverdue) pendenteCount++;
        else emDiaCount++;
      } else {
        naoIniciadaCount++;
      }

      const model = String(vehicle.MODELO || vehicle.modelo || "N/A").trim();
      const brand = String(vehicle.MARCA || vehicle.marca || "N/A").trim();
      const dir = String(vehicle.DIRETORIA || vehicle.diretoria || "N/A").trim();
      const ger = String(vehicle.GERENCIA || vehicle["GERÊNCIA"] || vehicle.gerencia || "N/A").trim();
      const titularidade = String(vehicle.TITULARIDADE || vehicle.titularidade || "N/A").trim().toUpperCase();

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold; font-family: monospace; font-size: 13px;">${placa}</td>
          <td style="padding: 10px;">${state.dataRevisao ? new Date(state.dataRevisao + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
          <td style="padding: 10px; text-align: right;">${state.odometroRevisao ? odometroRevisaoNum.toLocaleString('pt-BR') + ' km' : '-'}</td>
          <td style="padding: 10px; text-align: right;">${revisaoPrevistaNum.toLocaleString('pt-BR')} km</td>
          <td style="padding: 10px; text-align: right; font-weight: bold;">${state.odometroRevisao ? odometroProximaRevisao.toLocaleString('pt-BR') + ' km' : '-'}</td>
          <td style="padding: 10px; text-align: right;">${odometroAtual.toLocaleString('pt-BR')} km</td>
          <td style="padding: 10px; text-align: right; font-weight: bold; color: ${isOverdue ? '#e11d48' : '#10b981'}">
            ${state.odometroRevisao ? (odometroRestante > 0 ? '+' : '') + odometroRestante.toLocaleString('pt-BR') + ' km' : '-'}
          </td>
          <td style="padding: 10px; text-align: center;">
            <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;
              background-color: ${status === 'Em Dia' ? '#ecfdf5' : status === 'Pendente' ? '#fff1f2' : '#f1f5f9'};
              color: ${status === 'Em Dia' ? '#059669' : status === 'Pendente' ? '#be123c' : '#475569'};">
              ${status}
            </span>
          </td>
          <td style="padding: 10px; font-size: 11px;">${model} / ${brand}</td>
          <td style="padding: 10px; text-align: center; font-size: 11px; font-weight: bold; text-transform: uppercase;">${titularidade}</td>
          <td style="padding: 10px; font-size: 11px;">${dir} (${ger})</td>
        </tr>
      `;
    }).join("");

    const timestamp = new Date().toLocaleString("pt-BR");

    iframeDoc.write(`
      <html>
        <head>
          <title>Relatorio_Preventiva_${selectedLocadora}</title>
          <style>
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 30px; }
            h1 { font-size: 22px; font-weight: 950; text-transform: uppercase; letter-spacing: -0.5px; margin: 0; color: #1e1b4b; }
            h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 5px 0 20px 0; color: #4338ca; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .stats-container { display: flex; gap: 15px; margin-bottom: 30px; }
            .stat-card { flex: 1; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; }
            .stat-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
            .stat-value { font-size: 20px; font-weight: 955; color: #1e293b; }
            table.main-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            table.main-table th { background-color: #f1f5f9; padding: 10px; font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: left; border-bottom: 2px solid #cbd5e1; }
            table.main-table td { font-size: 12px; border-bottom: 1px solid #e2e8f0; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
             <table class="header-table">
            <tr>
              <td>
                <h1>Controle Preventiva</h1>
                <h2>Relatório de Frota - ${selectedLocadora}</h2>
              </td>
              <td style="text-align: right; font-size: 11px; color: #64748b; line-height: 1.5;">
                <strong>Gerado em:</strong> ${timestamp}<br>
                <strong>Total da Frota:</strong> ${total} veículos
              </td>
            </tr>
          </table>
 
          <div style="display: flex; gap: 15px; margin-bottom: 30px;">
            <div class="stat-card">
              <div class="stat-title">Total de Veículos</div>
              <div class="stat-value">${total}</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #10b981;">
              <div class="stat-title" style="color: #059669;">Em Dia (Odo Cadastrado)</div>
              <div class="stat-value" style="color: #059669;">${emDiaCount}</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #e11d48;">
              <div class="stat-title" style="color: #be123c;">Pendente (Excedeu KM)</div>
              <div class="stat-value" style="color: #be123c;">${pendenteCount}</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #64748b;">
              <div class="stat-title">Pendente Dados</div>
              <div class="stat-value">${naoIniciadaCount}</div>
            </div>
          </div>

          <table class="main-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Última Revisão</th>
                <th style="padding: 10px; text-align: right;">Odo Revisão</th>
                <th style="padding: 10px; text-align: right;">Revisão Prevista</th>
                <th style="padding: 10px; text-align: right;">Próxima Revisão</th>
                <th style="padding: 10px; text-align: right;">Odo Atual</th>
                <th style="padding: 10px; text-align: right;">Odo Restante</th>
                <th style="padding: 10px; text-align: center;">Status</th>
                <th>Modelo / Marca</th>
                <th style="padding: 10px; text-align: center;">Titularidade</th>
                <th>Uso / Diretoria</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            NEXUS FROTA — Sistema Integrado de Gestão Preventiva de Frotas de Veículos Comissionados / Locados.<br>
            Compesa — Central de Gestão de Frotas (CGF).
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                if (window.frameElement) {
                  window.frameElement.remove();
                }
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);

    iframeDoc.close();
  };

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
            {allowedLocadoras.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-100/10 border-2 border-amber-200/50 dark:border-amber-900/30 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300">
                <AlertCircle className="shrink-0 h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-bold uppercase tracking-tight">Nenhuma locadora vinculada ao seu usuário. Por favor, solicite a vinculação ao administrador.</p>
              </div>
            ) : (
              <Select value={selectedLocadora} onValueChange={setSelectedLocadora}>
                <SelectTrigger className="w-full text-sm font-medium">
                  <SelectValue placeholder="Selecione sua Locadora..." />
                </SelectTrigger>
                <SelectContent>
                  {allowedLocadoras.map((locadora) => (
                    <SelectItem key={locadora} value={locadora}>
                      {locadora}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>
 
      {/* Meu Desempenho & Histórico Panels for LOCADORA profile */}
      {userProfile?.role === 'LOCADORA' && selectedLocadora && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-2 border-indigo-150 dark:border-indigo-950/40 rounded-3xl shadow-lg bg-white dark:bg-slate-900/60 overflow-hidden h-full">
                <CardHeader className="bg-indigo-50/40 dark:bg-indigo-900/15 border-b border-indigo-100/60 dark:border-indigo-950/20 py-4 px-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                      <TrendingUp size={14} className="text-indigo-600 dark:text-indigo-400" /> Painel Meu Desempenho — {selectedLocadora}
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                      Métricas de frota e visão consolidada das preventivas enviadas
                    </CardDescription>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-200/50 dark:border-indigo-900/40">
                      {stats.percent}% Concluído
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Stat 1: Total Frota */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                      <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                        <Layers size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Frota sob Gestão</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-1">{stats.total}</p>
                      </div>
                    </div>

                    {/* Stat 2: Cadastrados */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                      <div className="rounded-xl p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Preventivas Enviadas</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-1">
                          {stats.cadastrado} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
                        </p>
                      </div>
                    </div>

                    {/* Stat 3: Preventivas Em Dia */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                      <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400">
                        <Check size={20} className="stroke-[3]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400">Revisões Em Dia</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-1">{stats.emDia}</p>
                      </div>
                    </div>

                    {/* Stat 4: Preventivas Vencidas (Excederam KM) */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                      <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-extrabold text-rose-600 dark:text-rose-400">Revisões Excedidas</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-1 text-rose-600 dark:text-rose-400">{stats.pendenteKM}</p>
                      </div>
                    </div>

                  </div>

                  {/* Progress Bar of overall coverage */}
                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold uppercase text-slate-500 dark:text-slate-400">Status Geral do Preenchimento</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400">{stats.cadastrado} de {stats.total} veículos preenchidos ({stats.percent}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/60">
                      <div 
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500 animate-pulse" 
                        style={{ width: `${stats.percent}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-lg bg-white dark:bg-slate-900/60 overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-slate-50/40 dark:bg-slate-950/15 border-b border-indigo-100/60 dark:border-indigo-950/20 py-4 px-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Clock size={14} className="text-indigo-600 dark:text-indigo-400" /> Histórico de Atividades
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                      Logs de auditoria em tempo real
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={fetchActivityLogs}
                    disabled={isLoadingLogs}
                    className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
                  >
                    <RefreshCw size={14} className={isLoadingLogs ? "animate-spin" : ""} />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col min-h-[280px]">
                  {isLoadingLogs ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                      <RefreshCw size={16} className="animate-spin mr-2" /> Carregando logs...
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <History size={24} className="text-slate-300 mb-2" />
                      <p className="text-[10px] uppercase font-black tracking-wider">Nenhuma alteração recente</p>
                      <p className="text-[9px] mt-1 uppercase font-semibold text-slate-400 text-center leading-normal">Os logs aparecerão à medida que você atualizar os dados da frota.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px] pr-2">
                      <div className="space-y-3">
                        {activityLogs.map((log) => {
                          const formattedDate = log.timestamp
                            ? new Date(log.timestamp.seconds * 1000).toLocaleString("pt-BR")
                            : new Date().toLocaleString("pt-BR");
                          return (
                            <div 
                              key={log.id} 
                              className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100/60 dark:border-slate-800 text-xs transition-all hover:bg-slate-100/50"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded text-[10px]">
                                  {log.placa}
                                </span>
                                <span className="text-[9px] text-slate-400 font-semibold">{formattedDate}</span>
                              </div>
                              <div className="space-y-0.5 text-[11px]">
                                <p className="text-slate-700 dark:text-slate-300">
                                  Odômetro: <strong className="font-extrabold text-slate-900 dark:text-white">{log.odometroRevisao.toLocaleString()} km</strong>
                                </p>
                                <p className="text-slate-500 text-[10px]">
                                  Revisão Prevista: {log.revisaoPrevista.toLocaleString()} km
                                </p>
                                <p className="text-slate-500 text-[10px]">
                                  Data Ref: {log.dataRevisao ? new Date(log.dataRevisao + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                                </p>
                              </div>
                              <div className="mt-2 pt-1.5 border-t border-dashed border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-400">
                                <span className="truncate max-w-[120px] font-medium italic" title={log.usuarioEmail}>
                                  Por: {log.usuarioEmail.split("@")[0]}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded-full font-bold text-[9px] uppercase ${log.tipo === "lote" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600" : "bg-blue-100 dark:bg-blue-950/40 text-blue-600"}`}>
                                  {log.tipo}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Central de Notificações */}
          <Card className="border-2 border-amber-150 dark:border-amber-950/40 rounded-3xl shadow-lg bg-white dark:bg-slate-900/60 overflow-hidden">
            <CardHeader className="bg-amber-50/40 dark:bg-amber-950/15 border-b border-amber-100/60 dark:border-amber-950/20 py-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl relative">
                  <Bell className="animate-bounce" size={16} />
                  {alertNotifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white font-mono font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                      {alertNotifications.length}
                    </span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">
                    Central de Notificações — Alertas Preventivos
                  </CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                    Veículos com ≥ 80% do intervalo de revisão preventiva consumido
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {alertNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-6 text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center mb-3">
                    <Check size={24} className="stroke-[3]" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Nenhum veículo em alerta</p>
                  <p className="text-[10px] mt-1 font-semibold text-slate-400 uppercase tracking-tight">Todas as revisões sob gestão da locadora estão reguladas e em dia!</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {alertNotifications.map((alert) => (
                      <div 
                        key={alert.placa}
                        onClick={() => {
                          setSearchTerm(alert.placa);
                          toast.info(`Filtrando tabela para placa: ${alert.placa}`);
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
                          alert.status === "excedido"
                            ? "bg-red-50/20 dark:bg-red-950/10 border-red-200/60 dark:border-red-900/40 hover:border-red-400"
                            : "bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/40 hover:border-amber-400"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Badge className={`font-mono text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md ${
                              alert.status === "excedido"
                                ? "bg-red-500 text-white"
                                : "bg-amber-500 text-white"
                            }`}>
                              {alert.placa}
                            </Badge>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              alert.status === "excedido"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                            }`}>
                              {alert.porcentagemUso}% utilizado
                            </span>
                          </div>
                          
                          <h4 className="text-xs font-extrabold text-slate-850 dark:text-white mt-3 truncate uppercase tracking-tight">
                            {alert.modelo}
                          </h4>
                          
                          <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex justify-between">
                              <span>Odômetro Atual:</span>
                              <strong className="text-slate-900 dark:text-white font-extrabold">{alert.odometroAtual.toLocaleString()} km</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Última Revisão:</span>
                              <span className="font-semibold">{alert.odometroRevisao.toLocaleString()} km</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Próxima Revisão:</span>
                              <span className="font-semibold">{alert.odometroProximaRevisao.toLocaleString()} km</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-2.5 border-t border-dashed border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[10px]">
                          <span className={`font-black uppercase tracking-tight ${
                            alert.status === "excedido" ? "text-red-600 dark:text-red-450" : "text-amber-600 dark:text-amber-400"
                          }`}>
                            {alert.status === "excedido"
                              ? `Excedido por ${Math.abs(alert.kmRestantes).toLocaleString()} km`
                              : `Falta ${alert.kmRestantes.toLocaleString()} km`
                            }
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center hover:underline whitespace-nowrap">
                            Preencher na Tabela →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* E-mail Notification Control - New Section requested by USER */}
      {userProfile?.role !== 'LOCADORA' && selectedLocadora && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Side: Email Settings Card */}
            <div className="lg:col-span-1">
              <Card className="border-2 border-indigo-150 dark:border-indigo-950/40 rounded-3xl shadow-lg bg-white dark:bg-slate-900/60 overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-indigo-50/40 dark:bg-indigo-950/15 border-b border-indigo-100/60 dark:border-indigo-950/20 py-4 px-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                      <Settings size={14} className="text-indigo-600 dark:text-indigo-400" /> Configuração de Alertas
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                      Agendar notificações automáticas para a gestão
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {isLoadingConfig ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-bold uppercase tracking-wider py-8">
                      <RefreshCw size={16} className="animate-spin mr-2" /> Carregando configurações...
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1">
                      
                      {/* Active Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/20 dark:bg-indigo-900/10 border border-indigo-100/40 dark:border-indigo-900/25">
                        <div>
                          <p className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300">Notificações Ativas</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Disparar ao registrar status Pendente</p>
                        </div>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary h-6 w-11 rounded-full bg-slate-200 checked:bg-indigo-600 cursor-pointer appearance-none relative before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-5 before:h-5 before:bg-white before:rounded-full before:transition-all checked:before:translate-x-5 border border-slate-350 dark:border-slate-700"
                          checked={emailConfig.active}
                          onChange={(e) => setEmailConfig(prev => ({ ...prev, active: e.target.checked }))}
                        />
                      </div>

                      {/* Emails list input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Destinatários (Emails separados por vírgula)</label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
                          <Input
                            className="pl-9 h-10 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
                            placeholder="gestao@compesa.com.br, gerente@compesa.com.br"
                            value={emailConfig.emails}
                            onChange={(e) => setEmailConfig(prev => ({ ...prev, emails: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Frequency selection */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Frequência do Agendamento</label>
                        <Select 
                          value={emailConfig.frequencia} 
                          onValueChange={(val: any) => setEmailConfig(prev => ({ ...prev, frequencia: val }))}
                        >
                          <SelectTrigger className="text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10">
                            <SelectValue placeholder="Selecione a frequência" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="imediato">Instantâneo (Enviar no ato do registro)</SelectItem>
                            <SelectItem value="diario">Diário (Consolida e envia no dia seguinte)</SelectItem>
                            <SelectItem value="semanal">Semanal (Consolida e envia na segunda-feira)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Schedule time input */}
                      {emailConfig.frequencia !== 'imediato' && (
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Horário de Envio Programado</label>
                          <Input
                            type="time"
                            className="h-10 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            value={emailConfig.horario}
                            onChange={(e) => setEmailConfig(prev => ({ ...prev, horario: e.target.value }))}
                          />
                        </div>
                      )}

                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                    <Button
                      onClick={handleSaveEmailConfig}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider py-2.5 flex items-center justify-center gap-2 shadow"
                      disabled={isSavingConfig || isLoadingConfig}
                    >
                      {isSavingConfig ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Salvar Configuração
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side: Scheduled Logs List Card */}
            <div className="lg:col-span-2">
              <Card className="border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-lg bg-white dark:bg-slate-900/60 overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-slate-50/40 dark:bg-slate-950/15 border-b border-indigo-100/60 dark:border-indigo-950/20 py-4 px-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Mail size={14} className="text-indigo-600 dark:text-indigo-400" /> Fila e Histórico de Alertas Agendados
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                      Controle de e-mails em fila de processamento ou disparados
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={fetchEmailConfigAndLogs}
                    disabled={isLoadingScheduledEmails}
                    className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
                  >
                    <RefreshCw size={14} className={isLoadingScheduledEmails ? "animate-spin" : ""} />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col min-h-[300px]">
                  {isLoadingScheduledEmails ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                      <RefreshCw size={16} className="animate-spin mr-2" /> Carregando registros de e-mail...
                    </div>
                  ) : scheduledEmails.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <Mail size={32} className="text-slate-250 mb-3" />
                      <p className="text-[10px] uppercase font-black tracking-wider text-slate-600 dark:text-slate-400">Nenhum e-mail agendado na fila</p>
                      <p className="text-[9px] mt-1.5 uppercase font-semibold text-slate-450 leading-normal max-w-[320px]">
                        Os e-mails serão gerados e agendados automaticamente sempre que um novo odômetro for salvo com status "Pendente" com as notificações ativas.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] pr-2">
                      <div className="space-y-3">
                        {scheduledEmails.map((email) => {
                          const dateCreated = email.createdAt
                            ? new Date(email.createdAt.seconds * 1000).toLocaleString("pt-BR")
                            : new Date().toLocaleString("pt-BR");
                          const dateScheduled = email.envioAgendadoPara 
                            ? new Date(email.envioAgendadoPara).toLocaleString("pt-BR")
                            : "-";
                          
                          return (
                            <div 
                              key={email.id} 
                              className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/80 dark:border-slate-800 text-xs transition-all hover:bg-slate-100/50"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[10px] border border-indigo-100/55">
                                    {email.placa}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                    {email.modelo}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge className="font-bold text-[8px] tracking-wider uppercase px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300">
                                    {email.frequencia}
                                  </Badge>
                                  <Badge className={`font-mono font-black text-[9px] tracking-wider uppercase px-2 py-0.2 rounded-full ${
                                    email.status === "Enviado" 
                                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/40" 
                                      : "bg-blue-100 dark:bg-blue-950/40 text-blue-600 border border-blue-200/40 animate-pulse"
                                  }`}>
                                    {email.status}
                                  </Badge>
                                </div>
                              </div>

                              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-200/50 dark:border-slate-800 pb-2.5">
                                <p className="text-slate-800 dark:text-slate-200 truncate">
                                  <strong className="font-black text-slate-450 uppercase text-[9px] mr-1">Assunto:</strong>{email.subject}
                                </p>
                                <p className="text-slate-500 text-[10px] truncate">
                                  <strong className="font-black text-slate-450 uppercase text-[9px] mr-1">Para:</strong>{email.destinatarios.join(", ")}
                                </p>
                              </div>

                              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase font-bold text-slate-400">Gerado Em:</span>
                                  <span className="font-semibold text-slate-650 dark:text-slate-350">{dateCreated}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[9px] uppercase font-bold text-slate-400">Programado Para:</span>
                                  <span className="font-extrabold text-indigo-600 dark:text-indigo-405">{dateScheduled}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      )}
 
      {/* Vehicles Table Card */}
      {selectedLocadora ? (
        <Card className="border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between py-6 gap-4">
            <div>
              <CardTitle className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Lista de Veículos - {selectedLocadora}
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

              {userProfile?.role === "LOCADORA" && (
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="bg-white hover:bg-slate-50 border-rose-200 hover:border-rose-300 text-rose-600 dark:bg-slate-900 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center transition-all h-9"
                >
                  <FileText size={16} className="mr-1.5 text-rose-500" /> Exportar Relatório
                </Button>
              )}

              {userProfile?.role !== "LOCADORA" && (
                <Button
                  onClick={handleOpenGroupEmailModal}
                  variant="outline"
                  className="bg-amber-50 hover:bg-amber-100 border-amber-200 hover:border-amber-300 text-amber-700 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center transition-all h-9"
                  title="Agrupar veículos pendentes por unidade e preparar e-mail de agendamento"
                >
                  <Mail size={16} className="mr-1.5 text-amber-600" /> Agrupar por Unidade
                </Button>
              )}

              <Button
                onClick={handleSaveAll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center transition-all h-9"
              >
                <Save size={16} className="mr-1.5" /> Salvar Tudo
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Interactive Search & Multi-Criteria Filters Bar */}
            {selectedLocadora && !isLoadingAssets && !isLoadingFuel && (
              <div className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 p-4 gap-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 items-end">
                {/* Filter Modelo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Modelo</label>
                  <Select value={selectedModelo} onValueChange={setSelectedModelo}>
                    <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-950 uppercase border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {modeloOptions.map(m => (
                        <SelectItem key={m} value={m} className="text-xs uppercase font-bold">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Marca */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Marca</label>
                  <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                    <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-950 uppercase border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {marcaOptions.map(brand => (
                        <SelectItem key={brand} value={brand} className="text-xs uppercase font-bold">
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Diretoria */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Diretoria</label>
                  <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
                    <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-950 uppercase border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {diretoriaOptions.map(dir => (
                        <SelectItem key={dir} value={dir} className="text-xs uppercase font-bold">
                          {dir}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Gerência */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Gerência</label>
                  <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                    <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-950 uppercase border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {gerenciaOptions.map(ger => (
                        <SelectItem key={ger} value={ger} className="text-xs uppercase font-bold">
                          {ger}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Tipo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Tipo (Ativo)</label>
                  <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                    <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-950 uppercase border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {tipoOptions.map(tipo => (
                        <SelectItem key={tipo} value={tipo} className="text-xs uppercase font-bold">
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-950 uppercase border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(status => (
                        <SelectItem key={status} value={status} className="text-xs uppercase font-bold">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

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
              <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                <ScrollArea className="h-[600px] w-full min-w-[1400px]">
                  <Table className="w-full">
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
                      <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Titularidade</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] w-[90px]">Notificar</TableHead>
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
                      const titularidade = String(vehicle.TITULARIDADE || vehicle.titularidade || "N/A").trim().toUpperCase();

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
                              disabled={userProfile?.role === "LOCADORA"}
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

                          {/* Titularidade */}
                          <TableCell className="text-center font-bold text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase border ${
                              titularidade === "TITULAR"
                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/40"
                                : titularidade === "RESERVA"
                                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/40"
                                  : "bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 border-slate-200/40"
                            }`}>
                              {titularidade}
                            </span>
                          </TableCell>

                          {/* Notificar manual action */}
                          <TableCell className="text-center">
                            {isOverdue ? (
                              <Button
                                onClick={() => handleOpenEmailModal(vehicle, state, odometroAtual, odometroProximaRevisao, odometroRestante)}
                                className="bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white p-1.5 h-7 w-7 rounded-lg transition-all flex items-center justify-center mx-auto"
                                title="Notificar gestor por e-mail"
                              >
                                <Mail size={13} />
                              </Button>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 font-bold text-xs">-</span>
                            )}
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
              </div>
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

      {/* Manual Notification Email Dialog */}
      {isEmailModalOpen && selectedVehicleForEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Notificar Preventiva Vencida</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Veículo Placa: {String(selectedVehicleForEmail.PLACA || selectedVehicleForEmail.placa || "").toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content section */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {/* Select Unidade */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Selecione a Unidade do Veículo</label>
                <Select
                  value={emailSelectedUnidade}
                  onValueChange={handleEmailUnidadeChange}
                >
                  <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                    <SelectValue placeholder={isContactsLoading ? "Carregando Contatos..." : "Selecione a Unidade/Gerência..."} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px] overflow-y-auto">
                    {(contactsData as any[]).map((contact, idx) => (
                      <SelectItem key={idx} value={contact.gerencia} className="text-xs font-bold uppercase">
                        {contact.gerencia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To (Para) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Para (E-mails da Unidade)</label>
                <Input
                  type="text"
                  placeholder="Selecione uma unidade ou digite os e-mails separados por vírgula"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="font-medium text-xs h-10"
                />
              </div>

              {/* CC (Cópia) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Cópia (CC)</label>
                  {emailCc && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        navigator.clipboard.writeText(emailCc);
                        toast.success("E-mails de cópia copiados!");
                      }} 
                      className="h-5 text-[9px] font-black uppercase px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      Copiar
                    </Button>
                  )}
                </div>
                <Input
                  type="text"
                  readOnly
                  value={emailCc}
                  className="font-medium text-xs bg-slate-50 dark:bg-slate-900 h-10 text-slate-600 dark:text-slate-300 cursor-text"
                />
              </div>

              {/* Subject (Assunto) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Assunto do E-mail</label>
                <Input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="font-extrabold text-xs h-10"
                />
              </div>

              {/* Body (Corpo) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Corpo do E-mail</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsEmailModalOpen(false)}
                className="text-xs font-bold uppercase h-10 px-4"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendManualEmail}
                className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-black uppercase tracking-tight h-10 px-5 flex items-center gap-2 rounded-xl"
              >
                <Mail size={14} /> Gerar e Enviar E-mail
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual GROUP Notification Email Dialog */}
      {isGroupEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Notificar Pendentes por Unidade</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Notificação Consolidada de Agendamento</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGroupEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content section */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {/* Select Unidade */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Selecione a Unidade (Apenas com Pendências)</label>
                <Select
                  value={selectedGroupUnit}
                  onValueChange={handleGroupUnitChange}
                >
                  <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 h-10 text-xs font-bold uppercase">
                    <SelectValue placeholder="Selecione a Unidade..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px] overflow-y-auto">
                    {Object.keys(groupedPendingsByUnit).map((unitName) => (
                      <SelectItem key={unitName} value={unitName} className="text-xs font-bold uppercase">
                        {unitName} ({groupedPendingsByUnit[unitName]?.length || 0} frotas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To (Para) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Para (E-mails dos Gestores da Unidade)</label>
                <Input
                  type="text"
                  placeholder="E-mails dos gestores separados por vírgula"
                  value={groupEmailTo}
                  onChange={(e) => setGroupEmailTo(e.target.value)}
                  className="font-medium text-xs h-10"
                />
              </div>

              {/* CC (Cópia) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Cópia (CC)</label>
                  {groupEmailCc && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        navigator.clipboard.writeText(groupEmailCc);
                        toast.success("E-mails de cópia copiados!");
                      }} 
                      className="h-5 text-[9px] font-black uppercase px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      Copiar
                    </Button>
                  )}
                </div>
                <Input
                  type="text"
                  readOnly
                  value={groupEmailCc}
                  className="font-medium text-xs bg-slate-50 dark:bg-slate-900 h-10 text-slate-600 dark:text-slate-300 cursor-text"
                />
              </div>

              {/* Subject (Assunto) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Assunto do E-mail</label>
                <Input
                  type="text"
                  value={groupEmailSubject}
                  onChange={(e) => setGroupEmailSubject(e.target.value)}
                  className="font-extrabold text-xs h-10"
                />
              </div>

              {/* Body (Corpo) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Corpo do E-mail</label>
                  <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md">
                    {groupedPendingsByUnit[selectedGroupUnit]?.length || 0} frotas listadas
                  </span>
                </div>
                <textarea
                  value={groupEmailBody}
                  onChange={(e) => setGroupEmailBody(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsGroupEmailModalOpen(false)}
                className="text-xs font-bold uppercase h-10 px-4"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendGroupEmail}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-tight h-10 px-5 flex items-center gap-2 rounded-xl"
              >
                <Mail size={14} /> Gerar e Enviar E-mail Agrupado
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
