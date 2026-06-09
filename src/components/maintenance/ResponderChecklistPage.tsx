import React, { useState, useEffect, useRef } from "react";
import { useAssets } from "@/hooks/useFleetData";
import { db } from "../../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { 
  ClipboardCheck, 
  User, 
  MapPin, 
  Camera, 
  UploadCloud, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  AlertTriangle, 
  X, 
  Calendar, 
  AlertCircle, 
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  FileText,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Compress helper
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Downscale to max dimension of 600px for efficient Firestore storage
        const max_size = 600;
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // 60% quality JPEG is extremely lightweight (~40KB) yet sharp enough for verification
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        } else {
          reject(new Error("Canvas context is null"));
        }
      };
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

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

interface Answer {
  itemName: string;
  grupo: string;
  description?: string;
  response: 'ok' | 'nok' | null;
  photoUrl?: string;
  comments?: string;
}

interface ResponderChecklistPageProps {
  onBack?: () => void;
}

export default function ResponderChecklistPage({ onBack }: ResponderChecklistPageProps) {
  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();
  
  // Phase state: 'init' | 'evaluation' | 'success'
  const [phase, setPhase] = useState<'init' | 'evaluation' | 'success'>('init');
  
  // Templates state
  const [templates, setTemplates] = useState<Record<string, ChecklistItem[]>>({});
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showManualTemplateSelect, setShowManualTemplateSelect] = useState(false);

  // First Phase Inputs
  const [driverName, setDriverName] = useState("");
  const [selectedPlate, setSelectedPlate] = useState("");
  const [usageValue, setUsageValue] = useState("");
  const [usagePhotoBase64, setUsagePhotoBase64] = useState("");
  const [usagePhotoUploading, setUsagePhotoUploading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState("");

  // Search Filter for License Plate dropdown
  const [searchPlateText, setSearchPlateText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Evaluation Phase State
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = useState(false);
  
  // File uploading states for items
  const [itemUploading, setItemUploading] = useState<Record<string, boolean>>({});

  // Periodic Clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(now.toLocaleString('pt-BR'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch templates once on mount
  useEffect(() => {
    const fetchAllTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const res = await fetch("/api/checklist-templates");
        if (!res.ok) throw new Error("Falha ao obter templates");
        const data = await res.json();
        if (data.success && data.templates) {
          setTemplates(data.templates);
        }
      } catch (e) {
        console.error("Erro ao carregar os templates do servidor:", e);
        toast.error("Erro ao carregar dados do checklist. Recarregue a página.");
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchAllTemplates();
  }, []);

  // Outside click handler for Plate dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 100% Safe Plate status & types filters
  const operationalVehicles = assets.filter((asset: any) => {
    const status = String(asset["STATUS OPERACIONAL"] || asset["STATUS_OPERACIONAL"] || asset["STATUS"] || "").toUpperCase().trim();
    return status === "OPERACIONAL" || status === "ATIVO";
  });

  const filteredPlates = operationalVehicles.filter((asset: any) => {
    const p = String(asset["PLACA"] || asset["PLACA VEICULO"] || "").toUpperCase();
    const type = String(asset["TIPO"] || asset["TIPO VEICULO"] || "").toUpperCase();
    return p.includes(searchPlateText.toUpperCase()) || type.includes(searchPlateText.toUpperCase());
  });

  // Find selected vehicle details
  const selectedVehicle = operationalVehicles.find((asset: any) => {
    const p = String(asset["PLACA"] || asset["PLACA VEICULO"] || "").toUpperCase().trim();
    return p === selectedPlate.toUpperCase().trim();
  });
  // Match vehicle TIPO with one of the sheets keys
  useEffect(() => {
    if (selectedVehicle) {
      const vehicleTypeRaw = selectedVehicle["TIPO"] || selectedVehicle["TIPO VEICULO"] || "";
      
      // Helper function for ultra-normalization (standardized capitalization, no accents, no spacing/special chars)
      const ultraNormalize = (str: string) => {
        return String(str || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      };

      const normAssetType = ultraNormalize(vehicleTypeRaw);
      
      const matchedKey = Object.keys(templates).find(tk => {
        const normTk = ultraNormalize(tk);
        return normAssetType === normTk;
      });

      if (matchedKey) {
        setSelectedTemplateKey(matchedKey);
        setShowManualTemplateSelect(false);
      } else {
        // No exact match found in sheets tabs, try direct inclusion check
        const partialMatchedKey = Object.keys(templates).find(tk => {
          const normTk = ultraNormalize(tk);
          return normAssetType.includes(normTk) || normTk.includes(normAssetType);
        });

        if (partialMatchedKey) {
          setSelectedTemplateKey(partialMatchedKey);
          setShowManualTemplateSelect(false);
        } else {
          setSelectedTemplateKey("");
          setShowManualTemplateSelect(true); // Allow manual selection
        }
      }
    } else {
      setSelectedTemplateKey("");
      setShowManualTemplateSelect(false);
    }
  }, [selectedPlate, templates, selectedVehicle]);;

  // Handle KM Odometer photo upload
  const handleUsagePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUsagePhotoUploading(true);
    try {
      const dataUrl = await compressImage(files[0]);
      setUsagePhotoBase64(dataUrl);
      toast.success("Foto do hodômetro/horímetro importada com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao compactar imagem. Tente outra foto.");
    } finally {
      setUsagePhotoUploading(false);
    }
  };

  // Start checklist validation
  const handleStartEvaluation = () => {
    if (!driverName.trim()) {
      toast.error("Por favor, preencha o Nome do Condutor.");
      return;
    }
    if (!selectedPlate) {
      toast.error("Selecione a Placa do Ativo.");
      return;
    }
    if (!usageValue || isNaN(Number(usageValue)) || Number(usageValue) <= 0) {
      toast.error("Informe um KM/Horímetro Atual válido.");
      return;
    }
    if (!usagePhotoBase64) {
      toast.error("Foto comprovante do KM/Horímetro é OBRIGATÓRIA.");
      return;
    }
    if (!selectedTemplateKey) {
      toast.error("Selecione o modelo do checklist correspondente para continuar.");
      return;
    }

    // Initialize answers structure
    const targetItems = templates[selectedTemplateKey] || [];
    const initialAnswers: Record<string, Answer> = {};
    targetItems.forEach(item => {
      initialAnswers[item.nomeItem] = {
        itemName: item.nomeItem,
        grupo: item.grupo,
        description: item.descricao,
        response: null,
        comments: "",
        photoUrl: ""
      };
    });
    setAnswers(initialAnswers);
    setPhase('evaluation');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Set response for an individual item (OK or NOK)
  const handleResponseChange = (itemName: string, response: 'ok' | 'nok') => {
    setAnswers(prev => ({
      ...prev,
      [itemName]: {
        ...prev[itemName],
        response
      }
    }));
  };

  // Handle item comments
  const handleCommentChange = (itemName: string, comments: string) => {
    setAnswers(prev => ({
      ...prev,
      [itemName]: {
        ...prev[itemName],
        comments
      }
    }));
  };

  // Handle individual item evidence photo
  const handleItemPhotoChange = async (itemName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setItemUploading(prev => ({ ...prev, [itemName]: true }));
    try {
      const dataUrl = await compressImage(files[0]);
      setAnswers(prev => ({
        ...prev,
        [itemName]: {
          ...prev[itemName],
          photoUrl: dataUrl
        }
      }));
      toast.success("Foto de evidência anexada!");
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao compactar foto. Tente novamente.");
    } finally {
      setItemUploading(prev => ({ ...prev, [itemName]: false }));
    }
  };

  // Submit complete responses to Firestore
  const handleSubmitChecklist = async () => {
    const targetItems = templates[selectedTemplateKey] || [];
    
    // Validations
    for (const item of targetItems) {
      const ans = answers[item.nomeItem];
      // Check mandatory response
      if (item.itemObrigatorio && (!ans || ans.response === null)) {
        toast.error(`Responda o item obrigatório: "${item.nomeItem}" em [${item.grupo}]`);
        // Scroll to the element
        const element = document.getElementById(`item-card-${item.nomeItem.replace(/\s+/g, '-')}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      // Check mandatory photo
      if (item.fotoObrigatoria && ans?.response === 'nok' && !ans.photoUrl) {
        toast.error(`Anexo de foto é obrigatório para inconformidade no item: "${item.nomeItem}"`);
        const element = document.getElementById(`item-card-${item.nomeItem.replace(/\s+/g, '-')}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
    }

    setSubmitting(true);
    try {
      const submissionDoc = {
        driverName: driverName.trim(),
        currentUsage: Number(usageValue),
        usagePhotoUrl: usagePhotoBase64,
        plate: selectedPlate.toUpperCase().trim(),
        assetType: selectedTemplateKey,
        dateTime: new Date().toISOString(),
        responses: Object.values(answers),
        status: 'completed'
      };

      await addDoc(collection(db, "checklist_submissions"), submissionDoc);
      
      setPhase('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success("Checklist computado com sucesso! Obrigado pelo envio.");
    } catch (err: any) {
      console.error("Erro ao registrar submissão no Firebase:", err);
      toast.error("Erro de conexão ao salvar checklist. Tente submeter novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Group items of current template to display nicely
  const checklistItems = templates[selectedTemplateKey] || [];
  const groups = Array.from(new Set(checklistItems.map(i => i.grupo)));

  // Display Success Page
  if (phase === 'success') {
    const failedItems = (Object.values(answers) as Answer[]).filter(a => a.response === 'nok');
    const isApto = failedItems.length === 0;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-950">
          <div className="bg-gradient-to-br from-indigo-900 to-purple-950 p-8 text-center text-white relative">
            <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md animate-bounce">
              <Check className="h-8 w-8 text-white stroke-[3]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight">Inspeção Concluída!</h1>
            <p className="text-[10px] font-black tracking-widest uppercase opacity-75 mt-1">Formulário de Entrada CHM Recebido</p>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ativo Inspecionado</span>
                <span className="text-xs font-black uppercase text-slate-800 dark:text-white px-2 py-0.5 bg-white dark:bg-slate-800 border rounded">
                  {selectedPlate}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo de Equipamento</span>
                <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{selectedTemplateKey}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Condutor Declarado</span>
                <span className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">{driverName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">KM / Horas Declarados</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {Number(usageValue).toLocaleString()} {selectedTemplateKey.toUpperCase().includes("RETRO") || selectedTemplateKey.toUpperCase().includes("GERADOR") || selectedTemplateKey.toUpperCase().includes("MUNK") || selectedTemplateKey.toUpperCase().includes("RODOVI") ? "Horas" : "Km"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status Operacional</span>
                {isApto ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-250 font-black text-[9px] uppercase tracking-widest rounded-lg">
                    Apto Operacional
                  </Badge>
                ) : (
                  <Badge className="bg-amber-550 bg-amber-50 text-amber-700 border border-amber-250 font-black text-[9px] uppercase tracking-widest rounded-lg">
                    Apto com Observações
                  </Badge>
                )}
              </div>
            </div>

            {/* Checklist items warnings summary */}
            {!isApto && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl dark:bg-rose-950/10 dark:border-rose-900/20">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Alertas de Não-Conformidade Reportados:
                </h4>
                <ul className="text-[11px] font-semibold text-slate-705 text-slate-600 dark:text-slate-400 uppercase tracking-wide list-disc pl-4 space-y-1">
                  {failedItems.map((fi, i) => (
                    <li key={i}>
                      [{fi.grupo}] - {fi.itemName}
                      {fi.comments && <span className="text-[10px] lowercase italic text-slate-400"> ({fi.comments})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  setDriverName("");
                  setSelectedPlate("");
                  setUsageValue("");
                  setUsagePhotoBase64("");
                  setAnswers({});
                  setPhase('init');
                }}
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-purple-500/10"
              >
                Preencher Outro Checklist
              </button>
              
              {onBack && (
                <button 
                  onClick={onBack}
                  className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-650 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Sair do Coletor
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phase 2: Responses Form
  if (phase === 'evaluation') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-6 px-4">
        <div className="w-full max-w-4xl mx-auto space-y-6">
          
          {/* Header Progress bar */}
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600 rounded-xl text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">Formulário CHM - {selectedPlate}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedTemplateKey}</p>
              </div>
            </div>

            <div className="w-full sm:w-56 text-right space-y-1">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Progresso</span>
                <span>
                  {Math.round(((Object.values(answers) as Answer[]).filter(a => a.response !== null).length / checklistItems.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-600 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${((Object.values(answers) as Answer[]).filter(a => a.response !== null).length / checklistItems.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Core Questionnaire List */}
          <div className="space-y-6">
            {groups.map((groupName, groupIdx) => {
              const groupItems = checklistItems.filter(i => i.grupo === groupName);
              return (
                <div key={groupIdx} className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">
                    Grupo: {groupName}
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {groupItems.map((item, itemIdx) => {
                      const ans = answers[item.nomeItem];
                      const isSelectedOk = ans?.response === 'ok';
                      const isSelectedNok = ans?.response === 'nok';

                      return (
                        <div 
                          key={itemIdx} 
                          id={`item-card-${item.nomeItem.replace(/\s+/g, '-')}`}
                          className={`p-4 rounded-3xl border transition-all duration-200 bg-white dark:bg-slate-950 ${isSelectedNok ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'}`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-1 select-none flex-1">
                              <div className="flex items-start gap-1 pb-1">
                                <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 leading-snug">
                                  {item.nomeItem}
                                </h4>
                                {item.itemObrigatorio && (
                                  <span className="text-rose-500 font-bold text-xs" title="Campo Obrigatório">*</span>
                                )}
                              </div>
                              {item.descricao && (
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-relaxed">
                                  {item.descricao}
                                </p>
                              )}
                            </div>

                            {/* Response Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleResponseChange(item.nomeItem, 'ok')}
                                className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 h-11 ${isSelectedOk ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/15' : 'border-slate-200 hover:border-emerald-300 dark:border-slate-800 text-slate-400 hover:text-emerald-500'}`}
                              >
                                <Check className="h-4 w-4" />
                                Conforme
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResponseChange(item.nomeItem, 'nok')}
                                className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 h-11 ${isSelectedNok ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-500/15' : 'border-slate-200 hover:border-rose-300 dark:border-slate-800 text-slate-400 hover:text-rose-500'}`}
                              >
                                <AlertTriangle className="h-4 w-4" />
                                Não Ok
                              </button>
                            </div>
                          </div>

                          {/* Expansion Area on Item NOK */}
                          {isSelectedNok && (
                            <div className="mt-4 pt-4 border-t border-dashed border-red-200/50 space-y-4 animate-fadeIn">
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-red-500 dark:text-red-400">
                                  Descrição Detalhada do Problema
                                </Label>
                                <Textarea 
                                  placeholder="Descreva a falha ou não-conformidade observada para ajudar o setor de manutenção..."
                                  value={ans.comments || ""}
                                  onChange={(e) => handleCommentChange(item.nomeItem, e.target.value)}
                                  className="rounded-xl text-xs font-medium border border-slate-200 focus:border-red-400"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-red-500 dark:text-red-400 flex items-center gap-1">
                                  {item.fotoObrigatoria ? "Anexo de Foto Obrigatória (Evidência) *" : "Anexar Foto de Evidência (Opcional)"}
                                </Label>

                                <div className="flex items-center gap-3">
                                  <label className="cursor-pointer shrink-0">
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      capture="environment" // Auto opens mobile camera
                                      onChange={(e) => handleItemPhotoChange(item.nomeItem, e)}
                                      className="hidden" 
                                      disabled={itemUploading[item.nomeItem]}
                                    />
                                    <div className="px-5 h-11 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/35 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
                                      {itemUploading[item.nomeItem] ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Camera className="h-4 w-4" />
                                      )}
                                      {ans.photoUrl ? "Alterar Foto" : "Tirar Foto"}
                                    </div>
                                  </label>

                                  {ans.photoUrl && (
                                    <div className="h-11 w-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 relative group select-none">
                                      <img src={ans.photoUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                      <button 
                                        type="button"
                                        onClick={() => handleCommentChange(item.nomeItem, "")} 
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-black uppercase tracking-widest text-white"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Warning checklist */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-550 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">
              <Info className="h-4 w-4 text-purple-500 shrink-0" />
              <span>Certifique-se de que todos os itens em vermelho ou obrigatórios foram devidamente preenchidos.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                onClick={() => setPhase('init')}
                variant="outline"
                className="h-11 px-5 rounded-xl text-xs font-black uppercase tracking-widest"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleSubmitChecklist}
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest h-11 px-6 shadow-md shadow-purple-500/10 w-full sm:w-auto flex items-center gap-2"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 stroke-[3]" />
                )}
                {submitting ? "Alimentando..." : "Concluir Checklist"}
              </Button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Phase 1: Inputs and Metadata Setup
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-6 px-4 flex items-center justify-center">
      <Card className="w-full max-w-xl border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden bg-white dark:bg-slate-950">
        
        {/* Hub top section visual layout */}
        <div className="bg-gradient-to-br from-indigo-900 to-purple-950 p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
            <ClipboardCheck className="h-7 w-7 text-white stroke-[2]" />
          </div>
          <h1 className="text-lg font-black uppercase tracking-tight">NEXUS FROTA | COMPESA</h1>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mt-1">Inspeção e Checklist Periódico de Manutenção (CHM)</p>
        </div>

        <CardContent className="p-6 space-y-5">
          {templatesLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indexando base documental...</span>
            </div>
          ) : (
            <>
              {/* Nome Condutor */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome Completo do Condutor *</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <User className="h-4 w-4" />
                  </span>
                  <Input 
                    type="text" 
                    placeholder="Digite seu nome..." 
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="pl-9 h-11 text-xs font-bold uppercase placeholder:lowercase placeholder:font-normal rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Plate Search Selector */}
              <div className="space-y-1.5" ref={dropdownRef}>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Placa do Ativo Operacional *</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <Input 
                    type="text" 
                    placeholder={selectedPlate ? `Selecionado: ${selectedPlate}` : "Buscar placa (ex: KFT-1234)..."} 
                    value={searchPlateText}
                    onChange={(e) => {
                      setSearchPlateText(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    className="pl-9 h-11 text-xs font-black uppercase placeholder:lowercase placeholder:font-normal rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                  {/* Selected label indicator */}
                  {selectedPlate && (
                    <button 
                      onClick={() => {
                        setSelectedPlate("");
                        setSearchPlateText("");
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-rose-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown container */}
                {dropdownOpen && (
                  <div className="absolute z-50 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg mt-1 custom-scrollbar">
                    {filteredPlates.length === 0 ? (
                      <div className="p-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                        Nenhuma veículo operacional encontrado
                      </div>
                    ) : (
                      filteredPlates.map((asset: any, idx: number) => {
                        const p = String(asset["PLACA"] || asset["PLACA VEICULO"] || "").toUpperCase().trim();
                        const type = String(asset["TIPO"] || asset["TIPO VEICULO"] || "").toUpperCase().trim();
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedPlate(p);
                              setSearchPlateText("");
                              setDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-b-0"
                          >
                            <span className="text-xs font-black uppercase text-slate-850 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border">
                              {p}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 max-w-[200px] truncate">
                              {type}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Automatic Asset Type matching info */}
              {selectedPlate && selectedVehicle && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl dark:bg-slate-900/40 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Tipo Detectado Automático</span>
                    <span className="text-xs font-black uppercase text-slate-850 dark:text-white leading-tight">
                      {selectedVehicle["TIPO"] || selectedVehicle["TIPO VEICULO"] || "Não Definido"}
                    </span>
                  </div>
                  {showManualTemplateSelect ? (
                    <Badge className="bg-rose-50 text-rose-700 border border-rose-250 font-bold text-[9px] uppercase tracking-widest">Sem Modelo Padrão</Badge>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-750 border border-emerald-250 font-bold text-[9px] uppercase tracking-widest">Modelo Vinculado</Badge>
                  )}
                </div>
              )}

              {/* Backup Checklist Template selector if automatic matching doesn't find exact tab */}
              {showManualTemplateSelect && (
                <div className="space-y-1.5 p-4.5 bg-rose-50/20 border border-rose-200 dark:bg-rose-955/5 dark:border-rose-900/20 rounded-2xl animate-fadeIn space-y-2">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 block mt-0.5" />
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-450">Ajuste de Vinculação Requerido</h4>
                      <p className="text-[9px] text-slate-450 uppercase font-medium mt-0.5 tracking-wider leading-relaxed">Não encontramos uma aba de checklist específica para "{selectedVehicle?.[ "TIPO" ] || selectedVehicle?.["TIPO VEICULO"]}". Escolha o modelo que mais se aproxima abaixo:</p>
                    </div>
                  </div>

                  <select
                    value={selectedTemplateKey}
                    onChange={(e) => setSelectedTemplateKey(e.target.value)}
                    className="w-full h-11 px-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <option value="">-- Selecione o Modelo do Checklist --</option>
                    {Object.keys(templates).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Usage Odometer / Hourmeter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {selectedTemplateKey.toUpperCase().includes("RETRO") || selectedTemplateKey.toUpperCase().includes("GERADOR") || selectedTemplateKey.toUpperCase().includes("MUNK") || selectedTemplateKey.toUpperCase().includes("RODOVI") ? "Horímetro Atual (Hs) *" : "KM Atual (Painel) *"}
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                      <Clock className="h-4 w-4" />
                    </span>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={usageValue}
                      onChange={(e) => setUsageValue(e.target.value)}
                      className="pl-9 h-11 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data e Hora Coleta</Label>
                  <div className="bg-slate-50 dark:bg-slate-900 h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {currentDateTime.split(',')[0] || ""}
                    </span>
                    <span className="font-mono">{currentDateTime.split(',')[1] || ""}</span>
                  </div>
                </div>
              </div>

              {/* Mandatory Photos of Odometer/Panel */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comprovação Hodômetro / Horímetro (Tire Foto do Painel) *</Label>
                
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="cursor-pointer w-full sm:w-auto shrink-0">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" // Forces use of device cameras natively on touch phones
                      onChange={handleUsagePhotoChange}
                      className="hidden" 
                      disabled={usagePhotoUploading}
                    />
                    <div className="px-5 h-11 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-200 dark:border-purple-900/35 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
                      {usagePhotoUploading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {usagePhotoBase64 ? "Substituir Comprovante" : "Tirar Foto Painel"}
                    </div>
                  </label>

                  {usagePhotoBase64 && (
                    <div className="h-11 w-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-105 relative group shrink-0 select-none">
                      <img src={usagePhotoBase64} alt="Odom. Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        type="button"
                        onClick={() => setUsagePhotoBase64("")} 
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-black uppercase tracking-widest text-white"
                      >
                        Excluir
                      </button>
                    </div>
                  )}

                  {!usagePhotoBase64 && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center sm:text-left">
                      Anexo obrigatório para certificar preenchimento
                    </span>
                  )}
                </div>
              </div>

              {/* Start Checklist action */}
              <button
                type="button"
                onClick={handleStartEvaluation}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/10 flex items-center justify-center gap-1.5 pt-0.5 mt-2"
              >
                Próximo: Iniciar Avaliação do Veículo
                <ArrowRight className="h-4 w-4 stroke-[2]" />
              </button>
            </>
          )}

          {/* Admin bypass if logged in */}
          {onBack && (
            <div className="border-t border-slate-200/50 dark:border-slate-800 pt-4 flex justify-between items-center bg-white dark:bg-slate-950">
              <button 
                onClick={onBack}
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-purple-600 flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Painel Administrativo
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
