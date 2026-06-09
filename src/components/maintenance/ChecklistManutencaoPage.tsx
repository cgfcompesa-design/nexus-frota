import React, { useState, useEffect } from "react";
import { useAssets } from "@/hooks/useFleetData";
import { db, handleFirestoreError } from "../../lib/firebase";
import { collection, getDocs, query, orderBy, deleteDoc, doc, setDoc, where } from "firebase/firestore";
import { 
  ClipboardCheck, 
  Search, 
  MapPin, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  Trash2, 
  Link, 
  Copy, 
  Check, 
  QrCode, 
  RefreshCw, 
  ChevronRight, 
  User, 
  Calendar, 
  Map, 
  ArrowLeft,
  Settings,
  X,
  FileText,
  Clock,
  Printer,
  Upload,
  PlusCircle,
  FileSpreadsheet,
  Trash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ChecklistItem {
  grupo: string;
  nomeItem: string;
  descricao: string;
  escopo: string;
  tipoResposta: string;
  ordem: number;
  fotoObrigatoria: boolean;
  itemObrigatorio: boolean;
}

interface SubmittedChecklist {
  id: string;
  driverName: string;
  currentUsage: number;
  usagePhotoUrl: string;
  plate: string;
  assetType: string;
  dateTime: string;
  responses: Array<{
    itemName: string;
    grupo: string;
    description?: string;
    response: 'ok' | 'nok';
    photoUrl?: string;
    comments?: string;
  }>;
  status: 'completed';
}

interface ChecklistManutencaoPageProps {
  onBack: () => void;
  userRole?: string;
}

export default function ChecklistManutencaoPage({ onBack, userRole = 'Visualizador' }: ChecklistManutencaoPageProps) {
  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();
  const [submissions, setSubmissions] = useState<SubmittedChecklist[]>([]);
  const [templates, setTemplates] = useState<Record<string, ChecklistItem[]>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [activeTab, setActiveTab] = useState("historico");
  const [selectedTemplateTab, setSelectedTemplateTab] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all', 'nok', 'ok'
  const [selectedSubmission, setSelectedSubmission] = useState<SubmittedChecklist | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Custom templates / Bulk import state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkTemplateName, setBulkTemplateName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ChecklistItem[]>([]);
  const [customTemplatesList, setCustomTemplatesList] = useState<string[]>([]);

  // Derived shareable checkin link
  const shareableUrl = `${window.location.origin}/?view=responder-checklist`;

  // Fetch submissions from Firestore
  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const q = query(collection(db, "checklist_submissions"), orderBy("dateTime", "desc"));
      const snapshot = await getDocs(q);
      const list: SubmittedChecklist[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as SubmittedChecklist);
      });
      setSubmissions(list);
    } catch (e: any) {
      console.error("Erro ao buscar submissões do checklist:", e);
      toast.error("Erro ao carregar histórico de envios.");
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Fetch templates from proxy Excel endpoint + Firestore custom templates
  const fetchTemplates = async (forceRefresh = false) => {
    setLoadingTemplates(true);
    let mergedTemplates: Record<string, ChecklistItem[]> = {};
    
    // 1. Fetch spreadsheet templates from proxy local Endpoint
    try {
      const url = forceRefresh ? "/api/checklist-templates?force=true" : "/api/checklist-templates";
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("API de checklist da planilha retornou status:", res.status);
      } else {
        const data = await res.json();
        if (data.success && data.templates) {
          mergedTemplates = { ...data.templates };
        }
      }
    } catch (e: any) {
      console.error("Erro ao obter modelos de checklist da planilha:", e);
    }

    // 2. Fetch custom templates from Firestore
    const customKeys: string[] = [];
    try {
      const customSnap = await getDocs(collection(db, "checklist_custom_templates"));
      customSnap.forEach(docSnap => {
        const docData = docSnap.data();
        if (docData.templateName && Array.isArray(docData.items)) {
          mergedTemplates[docData.templateName] = docData.items as ChecklistItem[];
          customKeys.push(docData.templateName);
        }
      });
    } catch (fbErr: any) {
      console.error("Erro ao obter modelos customizados do Firestore:", fbErr);
    }

    setCustomTemplatesList(customKeys);
    setTemplates(mergedTemplates);
    
    const keys = Object.keys(mergedTemplates);
    if (keys.length > 0) {
      if (!selectedTemplateTab || !keys.includes(selectedTemplateTab)) {
        setSelectedTemplateTab(keys[0]);
      }
    }
    setLoadingTemplates(false);
  };

  useEffect(() => {
    fetchSubmissions();
    fetchTemplates();
  }, []);

  const handleDeleteSubmission = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja realmente excluir permanentemente este envio? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "checklist_submissions", id));
      toast.success("Envio de checklist removido com sucesso!");
      fetchSubmissions();
    } catch (err: any) {
      console.error("Erro ao excluir envio:", err);
      toast.error("Não foi possível excluir o checklist.");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    toast.success("Link compartilhado copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse pasted clipboard tab-separated values from Excel
  const parseBulkText = (text: string) => {
    if (!text) {
      setParsedPreview([]);
      return;
    }

    const lines = text.split(/\r?\n/);
    const parsed: ChecklistItem[] = [];
    let orderCounter = 1;

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const cells = line.split("\t").map(c => c.trim());
      
      const firstCellUpper = cells[0]?.toUpperCase() || "";
      if (firstCellUpper.includes("GRUPO") || firstCellUpper.includes("SEÇÃO") || firstCellUpper.includes("CATEGORIA")) {
        continue;
      }
      
      const grupo = cells[0] || "Geral";
      const nomeItem = cells[1] || "";
      if (!nomeItem) continue;

      const descricao = cells[2] || "";
      const fotoObrRaw = (cells[3] || "").toLowerCase();
      const itemObrRaw = (cells[4] || "").toLowerCase();

      const fotoObrigatoria = fotoObrRaw === "sim" || fotoObrRaw === "s" || fotoObrRaw === "true" || fotoObrRaw === "1";
      const itemObrigatorio = itemObrRaw === "sim" || itemObrRaw === "s" || itemObrRaw === "true" || itemObrRaw === "1" || cells[4] === undefined || cells[4] === ""; 

      parsed.push({
        grupo,
        nomeItem,
        descricao,
        escopo: "veiculo",
        tipoResposta: "ok_nok",
        ordem: orderCounter++,
        fotoObrigatoria,
        itemObrigatorio
      });
    }

    setParsedPreview(parsed);
  };

  useEffect(() => {
    parseBulkText(bulkText);
  }, [bulkText]);

  const handleSaveBulkImport = async () => {
    if (!bulkTemplateName.trim()) {
      toast.error("Por favor, informe o nome do tipo de ativo (modelo).");
      return;
    }
    if (parsedPreview.length === 0) {
      toast.error("Nenhum item válido para importação. Verifique se copiou e colou as colunas corretas.");
      return;
    }

    const docId = bulkTemplateName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    try {
      await setDoc(doc(db, "checklist_custom_templates", docId), {
        templateName: bulkTemplateName.trim(),
        items: parsedPreview,
        updatedAt: new Date().toISOString(),
        updatedBy: "Gestão"
      });

      toast.success(`Modelo "${bulkTemplateName}" importado/atualizado com ${parsedPreview.length} itens no Firestore!`);
      setBulkImportOpen(false);
      setBulkText("");
      setParsedPreview([]);
      fetchTemplates(true);
    } catch (err: any) {
      console.error("Erro ao salvar modelo customizado:", err);
      try {
        handleFirestoreError(err, 'write', `checklist_custom_templates/${docId}`);
      } catch (formattedErr: any) {
        toast.error(`Falha ao salvar no Firebase: ${formattedErr.message}`);
        return;
      }
      toast.error(`Falha ao salvar no Firebase: ${err.message}`);
    }
  };

  const handleDeleteCustomTemplate = async (templateName: string) => {
    if (!window.confirm(`Deseja realmente remover a customização de "${templateName}"? Isso restaurará a versão original da planilha para este modelo.`)) {
      return;
    }
    const docId = templateName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    try {
      await deleteDoc(doc(db, "checklist_custom_templates", docId));
      toast.success(`Customização de "${templateName}" removida com sucesso!`);
      fetchTemplates(true);
    } catch (err: any) {
      console.error("Erro ao remover customização:", err);
      try {
        handleFirestoreError(err, 'delete', `checklist_custom_templates/${docId}`);
      } catch (formattedErr: any) {
        toast.error(`Não foi possível remover: ${formattedErr.message}`);
        return;
      }
      toast.error(`Não foi possível remover: ${err.message}`);
    }
  };

  const hasNonConformity = (sub: SubmittedChecklist) => {
    return sub.responses.some(r => r.response === 'nok');
  };

  // Filtered submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.assetType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const containsNok = hasNonConformity(sub);
    if (filterType === 'nok') return matchesSearch && containsNok;
    if (filterType === 'ok') return matchesSearch && !containsNok;
    
    return matchesSearch;
  });

  // Calculate metrics
  const totalSubmissions = submissions.length;
  const submissionsWithNok = submissions.filter(hasNonConformity).length;
  const submissionsOk = totalSubmissions - submissionsWithNok;
  
  // Unique vehicle plates from assets with status OPERACIONAL
  const operationalAssetsCount = assets.filter(
    (a: any) => String(a.STATUS_OPERACIONAL).toUpperCase() === 'OPERACIONAL'
  ).length;

  return (
    <div className="space-y-6" id="chm-dashboard">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-purple-600" />
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Checklist Manutenção (CHM)
              </h1>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">
              Gericiamento de Atividades e Verificação por Ativo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={handleCopyLink}
            variant="outline" 
            className="border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/10 text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 h-10 rounded-xl transition-all flex items-center gap-2"
          >
            {copied ? <Check className="h-3 w-3" /> : <Link className="h-3 w-3" />}
            {copied ? "Copiado!" : "Copiar Link de Resposta"}
          </Button>

          <Button 
            onClick={() => {
              fetchSubmissions();
              fetchTemplates(true);
              toast.success("Dados sincronizados com a planilha de controle!");
            }}
            variant="outline"
            className="h-10 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
          >
            <RefreshCw className="h-3 w-3 mr-2 animate-spin-hover" />
            Sincronizar Planilha
          </Button>

          <button 
            onClick={() => window.open(shareableUrl, '_blank')}
            className="px-4 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            Abrir Formulário Publico
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Envios</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{totalSubmissions}</span>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wider">Acumulado</Badge>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2">Checklists concluídos recebidos no sistema</p>
          </CardContent>
        </Card>

        <Card className="border border-red-100 dark:border-red-950/20 bg-red-50/5 dark:bg-red-950/5 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-red-500 dark:text-red-400">Não-Conformidades Detectadas</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-red-600 dark:text-red-400 tabular-nums">{submissionsWithNok}</span>
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Atenção
              </Badge>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2">Checklists contendo pelo menos 1 item 'NÃO OK'</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-100 dark:border-emerald-950/20 bg-emerald-50/5 dark:bg-emerald-950/5 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Aprovados Sem Alerta (OK)</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{submissionsOk}</span>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Seguro
              </Badge>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2">Equipamentos totalmente operacionais certificados</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ativos Operacionais (Frota)</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{operationalAssetsCount}</span>
              <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-wider">Habilitados</Badge>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2">Placas ativas elegíveis para preenchimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs switcher */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto flex flex-col sm:flex-row h-auto gap-1 mb-4">
          <TabsTrigger 
            value="historico" 
            className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm w-full sm:w-auto"
          >
            Histórico de Envios
          </TabsTrigger>
          <TabsTrigger 
            value="modelos" 
            className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm w-full sm:w-auto"
          >
            Tipos e Modelos de Checklist
          </TabsTrigger>
          <TabsTrigger 
            value="compartilhar" 
            className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm w-full sm:w-auto"
          >
            Link Coletor
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Submissions Log History */}
        <TabsContent value="historico" className="mt-0">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">Envios Consolidados</CardTitle>
                <CardDescription className="text-xs uppercase font-medium tracking-widest text-slate-400">Consulte aqui todos os checklists preenchidos pelos condutores</CardDescription>
              </div>

              {/* Filters Area */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <Search className="h-4 w-4" />
                  </span>
                  <Input 
                    type="text" 
                    placeholder="Filtrar por nome, placa ou ativo..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <button 
                    onClick={() => setFilterType("all")} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setFilterType("nok")} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${filterType === 'nok' ? 'bg-red-550 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'text-slate-400 hover:text-rose-500'}`}
                  >
                    Com Não-Conformidade {(submissionsWithNok > 0) && `(${submissionsWithNok})`}
                  </button>
                  <button 
                    onClick={() => setFilterType("ok")} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'ok' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'text-slate-400 hover:text-emerald-500'}`}
                  >
                    Sem Alertas
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingSubmissions ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-4">
                  <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Carregando submissões...</span>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center">
                  <ClipboardCheck className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhum envio de checklist encontrado</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Tente trocar os filtros de busca ou sincronizar os dados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ativo / Tipo</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condutor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">KM / Horímetro</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data e Hora</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Diagnóstico</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubmissions.map((sub) => {
                        const hasNok = hasNonConformity(sub);
                        return (
                          <TableRow 
                            key={sub.id} 
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setDialogOpen(true);
                            }}
                            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                                  {sub.plate}
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">{sub.assetType}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                              {sub.driverName}
                            </TableCell>
                            <TableCell className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                              {sub.currentUsage.toLocaleString()} {sub.assetType.toUpperCase().includes("RETRO") || sub.assetType.toUpperCase().includes("GERADOR") || sub.assetType.toUpperCase().includes("MUNK") || sub.assetType.toUpperCase().includes("RODOVI") ? "Hs" : "Km"}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 font-medium">
                              {new Date(sub.dateTime).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              {hasNok ? (
                                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 dark:bg-rose-950/30 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30 font-bold text-[9px] uppercase tracking-widest rounded-lg flex items-center gap-1 w-fit">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Não-Conformidade Detetada
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/30 font-bold text-[9px] uppercase tracking-widest rounded-lg flex items-center gap-1 w-fit">
                                  <CheckCircle className="h-2.5 w-2.5" /> Apto Operacional
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg" 
                                  onClick={() => {
                                    setSelectedSubmission(sub);
                                    setDialogOpen(true);
                                  }}
                                  title="Ver Ficha Detalhada"
                                >
                                  <Eye className="h-4 w-4 text-slate-500 hover:text-purple-600" />
                                </Button>
                                {(userRole === 'Master' || userRole === 'Gestão') && (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-600"
                                    onClick={(e) => handleDeleteSubmission(sub.id, e)}
                                    title="Remover Registro"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
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
        </TabsContent>

        {/* Tab 2: Templates Inspection */}
        <TabsContent value="modelos" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* Sidebar with Sheet (Type) Names */}
            <Card className="lg:col-span-1 border border-slate-200 dark:border-slate-800 shadow-sm p-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Tipos de Ativos</h3>
              {loadingTemplates ? (
                <div className="space-y-2">
                  <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {Object.keys(templates).map((typeName) => (
                    <button
                      key={typeName}
                      onClick={() => setSelectedTemplateTab(typeName)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all tracking-wider flex items-center justify-between ${selectedTemplateTab === typeName ? 'bg-purple-600 text-white shadow-md shadow-purple-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'}`}
                    >
                      <span className="truncate pr-2">{typeName}</span>
                      <span className="text-[9px] font-mono opacity-80 shrink-0 select-none">({templates[typeName].length} itens)</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Checklist items list */}
            <Card className="lg:col-span-3 border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">
                      {selectedTemplateTab || "Selecione um Ativo"}
                    </CardTitle>
                    {customTemplatesList.includes(selectedTemplateTab) && (
                      <Badge className="bg-purple-150 text-purple-750 dark:bg-purple-950/40 dark:text-purple-400 font-bold text-[9px] uppercase tracking-widest border border-purple-200">
                        Gerenciado no Firebase
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs uppercase font-medium tracking-widest text-slate-400">Configurações e itens contidos no checklist deste tipo de veículo</CardDescription>
                </div>

                {(userRole === 'Master' || userRole === 'Gestão') && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setBulkTemplateName(selectedTemplateTab || "");
                        setBulkText("");
                        setBulkImportOpen(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest h-9 rounded-xl shadow-lg shadow-purple-500/10 flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Importar em Massa
                    </Button>

                    {customTemplatesList.includes(selectedTemplateTab) && (
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteCustomTemplate(selectedTemplateTab)}
                        className="border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 text-xs font-black uppercase tracking-widest h-9 rounded-xl flex items-center gap-1.5 dark:border-red-950/20 dark:hover:bg-red-950/10"
                        title="Restaurar versão original do Google Sheets"
                      >
                        <Trash className="h-3.5 w-3.5" />
                        Restaurar Original
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {!selectedTemplateTab || loadingTemplates ? (
                  <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Aguarde...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/20">
                        <TableRow>
                          <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">#</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grupo</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Item</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição / Critério</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Foto Obrigatória</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Obrigatório</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates[selectedTemplateTab]?.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-[10px] font-black text-center text-slate-400 tabular-nums">
                              {item.ordem || idx + 1}
                            </TableCell>
                            <TableCell className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              <Badge className="bg-slate-100 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] uppercase tracking-widest rounded-lg">
                                {item.grupo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-800 dark:text-white uppercase">
                              {item.nomeItem}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 font-medium max-w-xs truncate" title={item.descricao}>
                              {item.descricao || <span className="italic text-slate-300">Nenhuma descrição</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.fotoObrigatoria ? (
                                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 font-bold text-[9px] uppercase tracking-wider rounded-lg">Sim</Badge>
                              ) : (
                                <Badge className="bg-slate-50 text-slate-400 hover:bg-slate-50 dark:bg-slate-900/20 dark:text-slate-500 border border-slate-200 dark:border-slate-800 font-bold text-[9px] uppercase tracking-wider rounded-lg">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.itemObrigatorio ? (
                                <Badge className="bg-purple-100 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-250 font-bold text-[9px] uppercase tracking-wider rounded-lg">Sim</Badge>
                              ) : (
                                <Badge className="bg-slate-50 text-slate-400 hover:bg-slate-50 dark:bg-slate-900/20 dark:text-slate-500 border border-slate-200 dark:border-slate-800 font-bold text-[9px] uppercase tracking-wider rounded-lg">Não</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Share QR Code & links */}
        <TabsContent value="compartilhar" className="mt-0">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <span className="px-3 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-850 rounded-full text-[10px] font-black uppercase tracking-widest block w-fit">Disponibilização Pública</span>
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Acesso sem Login para Condutores</h2>
                <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-wider">
                  Os motoristas e condutores NÃO precisam de credenciais de login no sistema para realizar a conferência periódica. 
                  Basta escanear o QR Code, colar o link público no navegador ou disponibilizar no painel ou tablet da garagem de ativos.
                </p>

                <div className="space-y-2 pt-2">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="truncate pr-4">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Endereço Público do Hub de Resposta</span>
                      <a href={shareableUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline hover:opacity-85 truncate">
                        {shareableUrl}
                      </a>
                    </div>
                    <Button 
                      onClick={handleCopyLink}
                      variant="ghost" 
                      className="hover:bg-slate-100 rounded-xl"
                      size="icon"
                      title="Copiar endereço"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-400" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => window.print()} variant="outline" className="border-slate-200 shadow-sm hover:bg-slate-50 font-black text-xs uppercase tracking-widest rounded-xl transition-all h-10 px-5 flex items-center gap-2">
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir Voucher Instrução
                  </Button>
                </div>
              </div>

              {/* QR Code Graphic Mockup */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 relative select-none">
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 aspect-square flex items-center justify-center relative">
                  {/* Real responsive CSS Canvas QR Code */}
                  <div className="w-40 h-40 bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-2 rounded text-center">
                    <QrCode className="h-28 w-28 text-slate-800" />
                    <span className="text-[8px] font-mono text-slate-500 uppercase font-black leading-tight mt-1">CHECKLIST CHM COMPESA</span>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">QR Code Informativo</h4>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Aponte a câmera para responder no celular</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Dialog for detail view of single submission */}
      {selectedSubmission && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600 rounded-2xl text-white">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      Ficha de Inspeção Periódica ({selectedSubmission.plate})
                    </h2>
                    {hasNonConformity(selectedSubmission) ? (
                      <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 font-bold text-[9px] uppercase tracking-widest border border-rose-200">
                        Não-Conformidades
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-450 font-bold text-[9px] uppercase tracking-widest border border-emerald-250">
                        100% OK
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ativo correspondente: {selectedSubmission.assetType}</p>
                </div>
              </div>
              <button 
                onClick={() => setDialogOpen(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[75vh] custom-scrollbar grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* left sidebar: Driver details */}
              <div className="md:col-span-1 space-y-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">Metadados e Preenchimento</h3>
                
                <div className="space-y-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <User className="h-3 w-3 text-purple-500" /> Condutor Responsável
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase block leading-tight">
                      {selectedSubmission.driverName}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-purple-500" /> Data e Hora de Envio
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {new Date(selectedSubmission.dateTime).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-purple-500" /> KM / Horímetro Declardo
                    </span>
                    <span className="text-xs font-mono font-black text-indigo-650 text-slate-800 dark:text-white block tabular-nums">
                      {selectedSubmission.currentUsage.toLocaleString()} {selectedSubmission.assetType.toUpperCase().includes("RETRO") || selectedSubmission.assetType.toUpperCase().includes("GERADOR") || selectedSubmission.assetType.toUpperCase().includes("MUNK") || selectedSubmission.assetType.toUpperCase().includes("RODOVI") ? "Hs" : "Km"}
                    </span>
                  </div>
                </div>

                {/* KM Image Display */}
                {selectedSubmission.usagePhotoUrl && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">Comprovante de Odom./Horímetro</span>
                    <div 
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden aspect-video bg-slate-100 hover:opacity-90 cursor-zoom-in relative group transition-all"
                      onClick={() => setSelectedImage(selectedSubmission.usagePhotoUrl)}
                    >
                      <img 
                        src={selectedSubmission.usagePhotoUrl} 
                        alt="Comprovante de KM/Horímetro" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] uppercase font-black tracking-widest">
                        Visualizar Foto
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* right sidebar: responses list */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">Inspeção Detalhada de Itens</h3>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedSubmission.responses.map((itemResp, index) => (
                    <div 
                      key={index}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${itemResp.response === 'nok' ? 'bg-rose-50/20 border-rose-200/50 text-rose-950 dark:bg-rose-950/5 dark:border-rose-900/20' : 'bg-slate-50/50 border-slate-150 text-slate-800 dark:bg-slate-900/10 dark:border-slate-800'}`}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-100 hover:bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-wider text-slate-500 rounded-lg">
                            {itemResp.grupo}
                          </Badge>
                          <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">{itemResp.itemName}</span>
                        </div>
                        {itemResp.description && (
                          <p className="text-[10px] text-slate-400 font-medium bg-white/40 dark:bg-black/10 py-0.5 px-1.5 rounded w-fit leading-relaxed uppercase tracking-wider">
                            {itemResp.description}
                          </p>
                        )}
                        {itemResp.comments && (
                          <div className="text-[10px] bg-amber-50/30 border border-amber-100 dark:bg-amber-955/5 dark:border-amber-900/30 p-2 rounded-xl mt-2 italic font-medium">
                            <span className="font-bold uppercase text-amber-600 block text-[8px] tracking-wider mb-0.5">Observação Condutor:</span>
                            "{itemResp.comments}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Response tag */}
                        {itemResp.response === 'ok' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-450 border border-emerald-200 font-black text-[9px] uppercase tracking-widest rounded-lg flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Conforme (OK)
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-450 border border-rose-200 font-black text-[9px] uppercase tracking-widest rounded-lg flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Não Ok (NOK)
                          </Badge>
                        )}

                        {/* Attached item image if any */}
                        {itemResp.photoUrl && (
                          <button 
                            onClick={() => setSelectedImage(itemResp.photoUrl!)}
                            className="h-9 w-9 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white flex items-center justify-center hover:shadow-sm"
                            title="Ver Foto do Item"
                          >
                            <img 
                              src={itemResp.photoUrl} 
                              alt={itemResp.itemName} 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button onClick={() => setDialogOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-xs h-10 px-6">
                Fechar Ficha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image zoom modal */}
      {selectedImage && (
        <Dialog open={true} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl p-1 bg-black overflow-hidden border-none flex items-center justify-center rounded-3xl relative">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full z-50 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
            <img 
              src={selectedImage} 
              alt="Zoom" 
              className="max-h-[85vh] max-w-full object-contain rounded-2xl" 
              referrerPolicy="no-referrer"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog for Bulk import checklist items */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="sm:max-w-5xl w-[95vw] md:w-[92vw] lg:w-[85vw] p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600 rounded-2xl text-white">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Importação de Checklist em Massa (Excel)
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Copie e cole dados tabulares diretamente do Excel ou Google Sheets</p>
              </div>
            </div>
            <button 
              onClick={() => setBulkImportOpen(false)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Template type name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Nome do Tipo de Ativo (Checklist Modelo)</label>
              <Input
                value={bulkTemplateName}
                onChange={(e) => setBulkTemplateName(e.target.value)}
                placeholder="Ex: PICAPE MÉDIA ou RETROESCAVADEIRA"
                className="h-11 font-black uppercase text-xs rounded-xl border border-slate-200 dark:border-slate-800"
              />
              <p className="text-[9px] text-slate-400 uppercase font-medium tracking-wider">Atenção: Use exatamente o nome do tipo do ativo cadastrado na frota (ex: "PICAPE MÉDIA") para vinculação automática direta de placas.</p>
            </div>

            {/* Excel Paste Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Área de Colagem de Células (Do Excel)</label>
                <Badge variant="outline" className="text-[9px] rounded-lg border-purple-200 text-purple-600 font-bold uppercase tracking-wider">Tabulado / TSV</Badge>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Copie as linhas no Excel e cole aqui..."
                className="w-full h-44 p-4 text-xs font-mono rounded-2xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50 dark:bg-slate-900/30"
              />
              
              {/* Columns instruction */}
              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/20 rounded-2xl">
                <h4 className="text-[10px] font-black text-purple-850 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Instruções de Formato de Coluna no Excel</h4>
                <p className="text-[9.5px] text-slate-500 font-medium leading-relaxed uppercase tracking-wider mt-1.5">
                  Copie 5 colunas inteiras do seu Excel ou Planilha na seguinte ordem para melhor detecção:
                </p>
                <div className="grid grid-cols-5 gap-2 mt-2 font-mono text-[9px] font-bold text-center uppercase tracking-widest select-none">
                  <div className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded text-indigo-750 dark:bg-indigo-950/20">1. Grupo</div>
                  <div className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded text-indigo-750 dark:bg-indigo-950/20">2. Item</div>
                  <div className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded text-indigo-750 dark:bg-indigo-950/20 col-span-1">3. Descrição</div>
                  <div className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded text-indigo-750 dark:bg-indigo-950/20">4. Foto?(Sim)</div>
                  <div className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded text-indigo-750 dark:bg-indigo-950/20">5. Obrig?(Sim)</div>
                </div>
                <p className="text-[8.5px] text-slate-450 uppercase font-medium tracking-wider mt-1.5">A primeira linha que contiver palavras do tipo "Grupo" ou "Item" será automaticamente ignorada como cabeçalho.</p>
              </div>
            </div>

            {/* Preview Section */}
            {parsedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><CheckCircle className="h-4 w-4 text-emerald-500" /> Pré-Visualização de Importação ({parsedPreview.length} itens detectados)</h3>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-slate-50/55 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-10 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">#</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Grupo</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nome do Item</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Descrição</TableHead>
                        <TableHead className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Foto</TableHead>
                        <TableHead className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Obrigatório</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPreview.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                          <TableCell className="text-center font-mono text-[9px] text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="text-[10px] font-black text-purple-700 uppercase">{item.grupo}</TableCell>
                          <TableCell className="text-[10px] font-bold text-slate-850 dark:text-slate-200 uppercase">{item.nomeItem}</TableCell>
                          <TableCell className="text-[10px] text-slate-500 truncate max-w-[150px] uppercase">{item.descricao || "-"}</TableCell>
                          <TableCell className="text-center">
                            {item.fotoObrigatoria ? <Badge className="bg-rose-50 border border-rose-100 text-rose-700 font-bold text-[8px] uppercase tracking-wider rounded-lg">Sim</Badge> : <Badge className="bg-slate-100 text-slate-400 font-bold text-[8px] uppercase tracking-wider rounded-lg border border-slate-150">Não</Badge>}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.itemObrigatorio ? <Badge className="bg-purple-150 border border-purple-200 text-purple-750 font-bold text-[8px] uppercase tracking-wider rounded-lg">Sim</Badge> : <Badge className="bg-slate-100 text-slate-400 font-bold text-[8px] uppercase tracking-wider rounded-lg border border-slate-150">Não</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <Button onClick={() => setBulkImportOpen(false)} variant="ghost" className="rounded-xl font-bold uppercase tracking-widest text-xs h-10 px-5">
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveBulkImport} 
              disabled={parsedPreview.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase tracking-widest text-xs h-10 px-6 shadow-md shadow-purple-500/10"
            >
              Salvar Modelo no Firebase
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
