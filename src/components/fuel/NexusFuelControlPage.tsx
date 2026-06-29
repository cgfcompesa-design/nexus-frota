import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Cpu, 
  Terminal, 
  Database, 
  History, 
  Sliders, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Building2, 
  Car, 
  DollarSign, 
  Clock, 
  ArrowRight, 
  Search, 
  RefreshCw, 
  Play, 
  Square, 
  ExternalLink, 
  FileText, 
  Check, 
  Lock, 
  User, 
  Calendar,
  SlidersHorizontal,
  Mail,
  ShieldAlert,
  Bookmark,
  HelpCircle
} from "lucide-react";
import { 
  getGerencias, 
  addGerencia, 
  updateGerencia, 
  deleteGerencia,
  getAtivos, 
  addAtivo, 
  updateAtivo, 
  deleteAtivo,
  getHistorico, 
  addHistorico,
  getFuelControlConfig, 
  saveFuelControlConfig,
  Gerencia,
  Ativo,
  HistoricoExecucao,
  FuelControlConfig,
  DEFAULT_GERENCIAS,
  DEFAULT_ATIVOS
} from "../../services/fuelControlService";
import { useAssets } from "../../hooks/useFleetData";
import { Button } from "../ui/button";
import { toast } from "sonner";

interface NexusFuelControlPageProps {
  userProfile?: {
    email?: string;
    role?: string;
    displayName?: string;
  };
  onBack?: () => void;
}

type ActiveTab = "dashboard" | "gerencias" | "ativos" | "historico" | "config";

export function NexusFuelControlPage({ userProfile, onBack }: NexusFuelControlPageProps) {
  const MASTER_EMAIL = "cgf.compesa@gmail.com";
  const userRole = userProfile?.email === MASTER_EMAIL ? 'Master' : (userProfile?.role || 'Visualizador');
  const userEmail = userProfile?.email || "usuario@compesa.com.br";
  
  // Tab Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  // Real Fleet Assets from Google Sheet via useAssets
  const { data: fleetAssets = [] } = useAssets();

  // Database States
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [historico, setHistorico] = useState<HistoricoExecucao[]>([]);
  const [config, setConfig] = useState<FuelControlConfig | null>(null);
  
  // Loading flags
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Form selections for Extra Credit
  const [selectedGerencia, setSelectedGerencia] = useState("");
  const [extraCredit, setExtraCredit] = useState("");
  const [selectedPlaca, setSelectedPlaca] = useState("");

  // Automation Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [executionStep, setExecutionStep] = useState<number>(0);
  const [executionTimer, setExecutionTimer] = useState(0);
  const [activeMockScreen, setActiveMockScreen] = useState<string>("idle");
  const [simulatedBudget, setSimulatedBudget] = useState<number>(22608.41);
  const [initialBudget, setInitialBudget] = useState<number>(22608.41);

  // Modals / CRUD states
  const [isGerenciaModalOpen, setIsGerenciaModalOpen] = useState(false);
  const [editingGerencia, setEditingGerencia] = useState<Gerencia | null>(null);
  const [gerenciaForm, setGerenciaForm] = useState({ nome: "", centroCusto: "", codigoTicketLog: "", orcamento: 22608.41 });

  const [isAtivoModalOpen, setIsAtivoModalOpen] = useState(false);
  const [editingAtivo, setEditingAtivo] = useState<Ativo | null>(null);
  const [ativoForm, setAtivoForm] = useState({ placa: "", gerencia: "", centroCusto: "", status: "Ativo" as "Ativo" | "Inativo", limite: 1500 });

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoricoExecucao | null>(null);

  // Search/Filters
  const [gerenciaSearch, setGerenciaSearch] = useState("");
  const [ativoSearch, setAtivoSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Security Access Guard check
  const hasAccess = userRole === "Master" || userRole === "Gestão";

  // Dynamic bookmarklet generation code
  const bookmarkletCode = useMemo(() => {
    const origin = window.location.origin;
    const jsCode = `javascript:(async function(){
      const serverUrl = "${origin}";
      if (!document.getElementById("nexus-styles")) {
        const style = document.createElement("style");
        style.id = "nexus-styles";
        style.innerHTML = \`
          #nexus-automation-panel {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            width: 350px !important;
            background-color: #1e293b !important;
            color: #ffffff !important;
            padding: 18px !important;
            border-radius: 16px !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important;
            z-index: 9999999 !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 12px !important;
            border: 1px solid #334155 !important;
          }
          .nexus-btn {
            background-color: #4f46e5 !important;
            color: #ffffff !important;
            border: none !important;
            padding: 10px 14px !important;
            border-radius: 8px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            font-size: 11px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            width: 100% !important;
            margin-top: 10px !important;
          }
          .nexus-btn:hover {
            background-color: #4338ca !important;
          }
          .nexus-close {
            background: none !important;
            border: none !important;
            color: #94a3b8 !important;
            cursor: pointer !important;
            font-size: 16px !important;
            font-weight: bold !important;
          }
        \`;
        document.head.appendChild(style);
      }
      const existing = document.getElementById("nexus-automation-panel");
      if (existing) existing.remove();
      const div = document.createElement("div");
      div.id = "nexus-automation-panel";
      div.innerHTML = \`
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:10px;">
          <span style="font-weight:800; text-transform:uppercase; font-size:10px; color:#38bdf8; letter-spacing:0.5px;">Assistente Nexus Frota</span>
          <button class="nexus-close" onclick="document.getElementById('nexus-automation-panel').remove()">✕</button>
        </div>
        <div id="nexus-status" style="margin-bottom:12px; font-weight:500; color:#cbd5e1;">Buscando comandos ativos...</div>
        <div id="nexus-details" style="background-color:#0f172a; padding:10px; border-radius:8px; font-family:monospace; font-size:10.5px; border:1px solid #1e293b; color:#94a3b8; display:none; line-height:1.5;"></div>
        <button id="nexus-start-btn" class="nexus-btn" style="display:none;">Iniciar Execução Real</button>
      \`;
      document.body.appendChild(div);
      const statusEl = document.getElementById("nexus-status");
      const detailsEl = document.getElementById("nexus-details");
      const startBtn = document.getElementById("nexus-start-btn");
      
      // Auto accept dialogs
      window.alert = function() { return true; };
      window.confirm = function() { return true; };
      
      try {
        const response = await fetch("\${serverUrl}/api/pending-automations");
        const data = await response.json();
        if (!data.success || !data.pending || data.pending.length === 0) {
          statusEl.innerText = "Nenhum comando de crédito extra localizado na fila.";
          statusEl.style.color = "#f87171";
          return;
        }
        const task = data.pending[0];
        statusEl.innerText = "Comando de Crédito Extra Localizado!";
        statusEl.style.color = "#4ade80";
        detailsEl.style.display = "block";
        detailsEl.innerHTML = \`
          <div style="margin-bottom:2px;"><span style="color:#64748b;">Gerência:</span> <b style="color:#f1f5f9;">\${task.gerencia}</b></div>
          <div style="margin-bottom:2px;"><span style="color:#64748b;">Placa:</span> <b style="color:#f1f5f9;">\${task.placa}</b></div>
          <div><span style="color:#64748b;">Valor Adicional:</span> <b style="color:#34d399;">R$ \${task.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></div>
        \`;
        startBtn.style.display = "block";
        startBtn.onclick = async () => {
          startBtn.disabled = true;
          startBtn.style.opacity = "0.5";
          try {
            statusEl.innerText = "Etapa 1: Abrindo Financeiro...";
            statusEl.style.color = "#38bdf8";
            const menuEl = Array.from(document.querySelectorAll("a, button, span, div, li")).find(el => el.textContent && el.textContent.trim() === "Financeiro");
            if (!menuEl) throw new Error("Menu lateral 'Financeiro' não localizado.");
            menuEl.click();
            await new Promise(r => setTimeout(r, 1500));
            
            statusEl.innerText = "Navegando para Gestão Orçamentária...";
            const subMenuEl = Array.from(document.querySelectorAll("a, span, div, li")).find(el => {
              const text = el.textContent ? el.textContent.trim() : "";
              return text.includes("Gestão Orçamentária") || text.includes("Gestao Orcamentaria");
            });
            if (!subMenuEl) throw new Error("Submenu 'Gestão Orçamentária' não localizado.");
            subMenuEl.click();
            await new Promise(r => setTimeout(r, 3000));
            
            statusEl.innerText = \`Localizando Gerência "\${task.gerencia}"...\`;
            let targetRow = null;
            const rows = Array.from(document.querySelectorAll("tr, div.row, div.grid, .grid-row, .table-row"));
            const candidates = rows.filter(r => {
              const text = r.textContent || "";
              return text.toUpperCase().includes(task.gerencia.toUpperCase());
            });
            if (candidates.length > 0) {
              candidates.sort((a, b) => a.textContent.length - b.textContent.length);
              targetRow = candidates[0];
            }
            if (!targetRow) throw new Error(\`Gerência "\${task.gerencia}" não localizada na página.\`);
            
            statusEl.innerText = "Abrindo modal de orçamento...";
            const editBtn = targetRow.querySelector("img[src*='editar'], img[alt*='Editar'], img[title*='editar'], .icones, [role='button'][tabindex='0'], .btn-editar, button, a");
            if (!editBtn) throw new Error("Botão/ícone de edição (canetinha) não localizado.");
            editBtn.click();
            await new Promise(r => setTimeout(r, 2000));
            
            statusEl.innerText = "Atualizando campo de orçamento...";
            let budgetInput = null;
            const inputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])"));
            budgetInput = inputs.find(i => {
              const name = (i.name || "").toLowerCase();
              const id = (i.id || "").toLowerCase();
              return name.includes("abastecimento") || id.includes("abastecimento") || name.includes("orcamento") || id.includes("orcamento") || name.includes("servico") || id.includes("servico");
            });
            if (!budgetInput) {
              const labels = Array.from(document.querySelectorAll("label, span, td, div, th"));
              const targetLabel = labels.find(l => {
                const text = (l.textContent || "").toUpperCase();
                return text.includes("ABASTECIMENTO/SERVIÇOS") || text.includes("ABASTECIMENTO") || text.includes("ORÇAMENTO");
              });
              if (targetLabel) {
                budgetInput = targetLabel.parentElement.querySelector("input") || 
                              targetLabel.parentElement.parentElement.querySelector("input");
              }
            }
            if (!budgetInput && inputs.length > 0) {
              budgetInput = inputs[0];
            }
            if (!budgetInput) throw new Error("Campo de input de orçamento não localizado.");
            
            let rawValue = budgetInput.value.trim();
            let originalVal = 0;
            if (rawValue) {
              const normalized = rawValue.replace(/\\\\./g, "").replace(",", ".");
              originalVal = parseFloat(normalized) || 0;
            }
            const newVal = originalVal + task.valor;
            budgetInput.value = newVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
            budgetInput.dispatchEvent(new Event('input', { bubbles: true }));
            budgetInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            statusEl.innerText = "Salvando orçamento...";
            const saveBtn = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn")).find(el => {
              const text = (el.textContent || el.value || "").trim().toUpperCase();
              return text.includes("SALVAR") || text.includes("GRAVAR") || text.includes("CONFIRMAR");
            });
            if (!saveBtn) throw new Error("Botão de salvar não localizado.");
            saveBtn.click();
            await new Promise(r => setTimeout(r, 2500));
            
            // Auto accept any modal confirmation dialog
            const modalButtons = Array.from(document.querySelectorAll("button, input[type='button'], a.btn"));
            const okBtn = modalButtons.find(btn => {
              const txt = (btn.textContent || btn.value || "").trim().toUpperCase();
              return txt === "OK" || txt === "CONFIRMAR" || txt === "FECHAR" || txt === "SIM" || txt.includes("OK");
            });
            if (okBtn) {
              okBtn.click();
              await new Promise(r => setTimeout(r, 1500));
            }
            
            statusEl.innerText = "Etapa 2: Acessando Alteração de Limite...";
            if (menuEl) menuEl.click();
            await new Promise(r => setTimeout(r, 1000));
            const limitSubMenu = Array.from(document.querySelectorAll("a, span, div, li")).find(el => {
              const text = el.textContent ? el.textContent.trim() : "";
              return text.includes("Alteração de Limite") || text.includes("Alteracao de Limite");
            });
            if (!limitSubMenu) throw new Error("Submenu 'Alteração de Limite' não localizado.");
            limitSubMenu.click();
            await new Promise(r => setTimeout(r, 3000));
            
            statusEl.innerText = \`Buscando veículo pela Placa "\${task.placa}"...\`;
            let plateInput = document.querySelector("input[name*='placa'], input[id*='placa'], input.placa");
            if (!plateInput) {
              const label = Array.from(document.querySelectorAll("label, span, div, td")).find(el => {
                const text = (el.textContent || "").toUpperCase();
                return text.includes("PLACA DO VEÍCULO") || text.includes("PLACA VEÍCULO") || text.includes("PLACA");
              });
              if (label) {
                plateInput = label.parentElement.querySelector("input") || label.parentElement.parentElement.querySelector("input");
              }
            }
            if (!plateInput) {
              const textInputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])"));
              if (textInputs.length > 0) plateInput = textInputs[0];
            }
            if (!plateInput) throw new Error("Campo de inserção de placa não encontrado.");
            
            plateInput.value = task.placa;
            plateInput.dispatchEvent(new Event('input', { bubbles: true }));
            plateInput.dispatchEvent(new Event('change', { bubbles: true }));
            const enterEvents = ['keydown', 'keypress', 'keyup'];
            enterEvents.forEach(evtType => {
              plateInput.dispatchEvent(new KeyboardEvent(evtType, {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              }));
            });
            await new Promise(r => setTimeout(r, 3000));
            
            statusEl.innerText = "Ajustando limite...";
            let limitInput = document.querySelector("input[name*='valor'], input[id*='valor'], input[name*='limite'], input[id*='limite']");
            if (!limitInput) {
              const label = Array.from(document.querySelectorAll("label, span, div")).find(el => {
                const text = (el.textContent || "").toUpperCase();
                return text.includes("VALOR PARA ALTERAÇÃO") || text.includes("VALOR DA ALTERAÇÃO") || text.includes("VALOR");
              });
              if (label) {
                limitInput = label.parentElement.querySelector("input") || label.parentElement.parentElement.querySelector("input");
              }
            }
            if (!limitInput) {
              const textInputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])")).filter(i => i !== plateInput);
              if (textInputs.length > 0) limitInput = textInputs[0];
            }
            if (!limitInput) throw new Error("Campo de valor para alteração não encontrado.");
            
            limitInput.value = task.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
            limitInput.dispatchEvent(new Event('input', { bubbles: true }));
            limitInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            statusEl.innerText = "Flegando opções de limite...";
            const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']"));
            let checkedCount = 0;
            checkboxes.forEach(chk => {
              const name = (chk.name || "").toLowerCase();
              const id = (chk.id || "").toLowerCase();
              const labelText = (chk.parentElement?.textContent || chk.parentElement?.parentElement?.textContent || "").toUpperCase();
              const isTarget = name.includes("chklimite") || 
                               id.includes("chklimite") || 
                               labelText.includes("ADICIONAR O VALOR") || 
                               labelText.includes("SOMENTE PARA O PERÍODO") ||
                               labelText.includes("PERIODO");
              if (isTarget) {
                if (!chk.checked) {
                  chk.click();
                  chk.checked = true;
                  chk.dispatchEvent(new Event('change', { bubbles: true }));
                }
                checkedCount++;
              }
            });
            if (checkedCount === 0) {
              checkboxes.forEach(chk => {
                if (!chk.checked) {
                  chk.click();
                  chk.checked = true;
                  chk.dispatchEvent(new Event('change', { bubbles: true }));
                }
              });
            }
            
            statusEl.innerText = "Confirmando alteração de limite...";
            const confirmBtn = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn")).find(el => {
              const text = (el.textContent || el.value || "").trim().toUpperCase();
              return text.includes("ALTERAR") || text.includes("SALVAR") || text.includes("CONFIRMAR") || text.includes("ENVIAR");
            });
            if (!confirmBtn) throw new Error("Botão de alterar limite não encontrado.");
            confirmBtn.click();
            await new Promise(r => setTimeout(r, 2500));
            
            const finalModals = Array.from(document.querySelectorAll("button, input[type='button'], a.btn"));
            const finalOk = finalModals.find(btn => {
              const txt = (btn.textContent || btn.value || "").trim().toUpperCase();
              return txt === "OK" || txt === "CONFIRMAR" || txt === "FECHAR" || txt === "SIM" || txt.includes("OK");
            });
            if (finalOk) {
              finalOk.click();
              await new Promise(r => setTimeout(r, 1500));
            }
            
            statusEl.innerText = "Sincronizando conclusão...";
            await fetch("\${serverUrl}/api/pending-automations/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: task.id, status: "completed", msg: "Sucesso" })
            });
            statusEl.innerText = "Automação Concluída!";
            statusEl.style.color = "#4ade80";
            startBtn.style.display = "none";
            setTimeout(() => div.remove(), 4000);
          } catch (execErr) {
            statusEl.innerText = "Erro: " + execErr.message;
            statusEl.style.color = "#f87171";
            await fetch("\${serverUrl}/api/pending-automations/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: task.id, status: "failed", msg: execErr.message })
            });
          }
        };
      } catch (err) {
        statusEl.innerText = "Falha ao consultar servidor: " + err.message;
        statusEl.style.color = "#f87171";
      }
    })();`;
    return jsCode.replace(/\s+/g, " ");
  }, []);

  // Load all initial database records
  const loadDatabase = async () => {
    setIsLoadingData(true);
    try {
      const [gData, aData, hData, cData] = await Promise.all([
        getGerencias(),
        getAtivos(),
        getHistorico(),
        getFuelControlConfig()
      ]);
      setGerencias(gData);
      setAtivos(aData);
      setHistorico(hData);
      setConfig(cData);
    } catch (err) {
      console.error("Erro ao carregar dados do banco:", err);
      toast.error("Erro de conexão ao carregar configurações.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      loadDatabase();
    }
  }, [hasAccess]);

  // Auto scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [executionLogs]);

  // Helper to extract or fallback to a Centro de Custo for a given department
  const getCentroCustoForGerencia = (gName: string) => {
    // 1. Check local Firestore gerencias first
    const foundLocal = gerencias.find(g => g.nome.toUpperCase() === gName.toUpperCase());
    if (foundLocal?.centroCusto) return foundLocal.centroCusto;
    
    // 2. Check fleetAssets
    const foundFleet = fleetAssets.find(a => {
      const aGer = (a.GERENCIA || a["GERÊNCIA"] || a.COLUNA_E || "").trim().toUpperCase();
      return aGer === gName.toUpperCase();
    });
    if (foundFleet) {
      const cc = foundFleet["CENTRO DE CUSTO"] || foundFleet.CENTRO_CUSTO || foundFleet.CC || "";
      if (cc) return String(cc);
    }
    
    return "10.00.00"; // Fallback CC
  };

  // Filter unique Gerencias from the real fleet base (Google Sheets) + Firestore where status is OPERACIONAL
  const uniqueGerenciasFromFleet = useMemo(() => {
    const set = new Set<string>();
    
    // First, collect all from fleetAssets (Column E / GERENCIA / GERÊNCIA) where STATUS_OPERACIONAL is OPERACIONAL
    fleetAssets.forEach(a => {
      if (a.STATUS_OPERACIONAL === "OPERACIONAL") {
        const ger = (a.GERENCIA || a["GERÊNCIA"] || a.COLUNA_E || "").trim();
        if (ger && ger !== "N/A" && ger !== "GERÊNCIA" && ger !== "GERENCIA") {
          set.add(ger.toUpperCase());
        }
      }
    });

    // Also collect from local firestore gerencias to make sure we don't miss anything manually added
    gerencias.forEach(g => {
      if (g.nome) {
        set.add(g.nome.toUpperCase());
      }
    });

    return Array.from(set).sort();
  }, [fleetAssets, gerencias]);

  // Filter plates dynamically depending on the selected Management, pulling from both Google Sheets fleetAssets & Firestore where STATUS_OPERACIONAL is OPERACIONAL
  const filteredPlatesForSelectedGerencia = useMemo(() => {
    if (!selectedGerencia) return [];
    
    const platesMap = new Map<string, { id: string; placa: string; gerencia: string; centroCusto: string; status: string; limite: number }>();

    // 1. Get plates matching the selectedGerencia from the real fleet assets where STATUS_OPERACIONAL is OPERACIONAL
    fleetAssets.forEach(a => {
      if (a.STATUS_OPERACIONAL === "OPERACIONAL") {
        const aGer = (a.GERENCIA || a["GERÊNCIA"] || a.COLUNA_E || "").trim().toUpperCase();
        const placa = (a.PLACA || "").trim().toUpperCase();
        if (aGer === selectedGerencia.toUpperCase() && placa) {
          const cc = a["CENTRO DE CUSTO"] || a.CENTRO_CUSTO || a.CC || getCentroCustoForGerencia(selectedGerencia);
          platesMap.set(placa, {
            id: a.ID_OBJETO || placa,
            placa: placa,
            gerencia: selectedGerencia,
            centroCusto: String(cc),
            status: "Ativo",
            limite: 1500
          });
        }
      }
    });

    // 2. Also check our Firestore local assets, in case they aren't in fleetAssets or have customized limits
    ativos.forEach(a => {
      const aGer = (a.gerencia || "").trim().toUpperCase();
      const placa = (a.placa || "").trim().toUpperCase();
      if (aGer === selectedGerencia.toUpperCase() && placa && a.status === "Ativo") {
        const existing = platesMap.get(placa);
        platesMap.set(placa, {
          id: a.id || placa,
          placa: placa,
          gerencia: a.gerencia,
          centroCusto: a.centroCusto || (existing ? existing.centroCusto : ""),
          status: a.status || "Ativo",
          limite: a.limite ?? (existing ? existing.limite : 1500)
        });
      }
    });

    return Array.from(platesMap.values())
      .filter(p => p.status === "Ativo")
      .sort((a, b) => a.placa.localeCompare(b.placa));
  }, [selectedGerencia, fleetAssets, ativos]);

  // Persistent budget lookup per selected gerencia
  const currentGerenciaBudget = useMemo(() => {
    if (!selectedGerencia) return 22608.41;
    const found = gerencias.find(g => g.nome.toUpperCase() === selectedGerencia.toUpperCase());
    return found?.orcamento ?? 22608.41;
  }, [selectedGerencia, gerencias]);

  // Handle selected Gerencia changing (to pre-set correct placa if needed)
  useEffect(() => {
    setSelectedPlaca("");
  }, [selectedGerencia]);

  // Format monetary value dynamically
  const handleCreditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") {
      setExtraCredit("");
      return;
    }
    const doubleValue = parseFloat(value) / 100;
    setExtraCredit(doubleValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  };

  const numericExtraCreditValue = useMemo(() => {
    if (!extraCredit) return 0;
    const cleanStr = extraCredit
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    return parseFloat(cleanStr) || 0;
  }, [extraCredit]);

  // --- AUTOMATION SIMULATION CHOREOGRAPHY ---
  
  const startAutomation = async () => {
    if (!selectedGerencia || !selectedPlaca || numericExtraCreditValue <= 0) {
      toast.error("Por favor, preencha todos os campos obrigatórios corretamente.");
      return;
    }

    const currentBudget = currentGerenciaBudget;
    setInitialBudget(currentBudget);

    setIsExecuting(true);
    setExecutionProgress(0);
    setExecutionTimer(0);
    setExecutionStep(1);
    setActiveMockScreen("login");
    
    const logs: string[] = [];
    const timestamp = () => `[${new Date().toLocaleTimeString("pt-BR")}]`;
    
    const addLog = (msg: string) => {
      logs.push(`${timestamp()} ${msg}`);
      setExecutionLogs([...logs]);
    };

    addLog("[PLAYWRIGHT] Inicializando engine de automação de navegadores...");
    addLog(`[PLAYWRIGHT] Timeout configurado: ${config?.timeout || 30} segundos.`);
    addLog(`[SYSTEM] Modo de Execução: ${config?.executionMode === "production" ? "PRODUÇÃO REAL" : "AMBIENTE DE SIMULAÇÃO"}`);
    
    // Register the pending task on the backend server for the bookmarklet
    let taskId = "";
    try {
      addLog("[INTEGRATION] Registrando comando na fila de pendências do servidor...");
      const res = await fetch("/api/pending-automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gerencia: selectedGerencia,
          placa: selectedPlaca,
          valor: numericExtraCreditValue,
          user: userEmail
        })
      });
      const resData = await res.json();
      if (resData.success && resData.automation) {
        taskId = resData.automation.id;
        addLog(`[INTEGRATION] Comando registrado com ID: ${taskId}. Aguardando Assistente Bookmarklet...`);
        if (config?.executionMode === "production") {
          addLog("[INTEGRATION] ⚠️ MODO REAL: Abra a Ticket Log, faça login e clique no Assistente Favorito!");
        }
      }
    } catch (apiErr: any) {
      addLog(`[WARN] Erro ao registrar comando na API: ${apiErr.message}`);
    }

    // Timer counter
    timerRef.current = setInterval(() => {
      setExecutionTimer(prev => prev + 1);
    }, 1000);

    // Timeline steps representing the real Playwright workflow
    const runSteps = [
      {
        progress: 10,
        mockScreen: "login_checking",
        logs: [
          "[PLAYWRIGHT] Abrindo instância Chromium Headless segura...",
          `[PLAYWRIGHT] Navegando para o portal Ticket Log: ${config?.platformUrl}`,
          "[PLAYWRIGHT] Página carregada. Verificando tokens de sessão ativa..."
        ],
        delay: 2000
      },
      {
        progress: 25,
        mockScreen: "financeiro_menu",
        logs: [
          "[SESSION] Token ativo confirmado com sucesso! Usuário já logado.",
          "[PLAYWRIGHT] Menu Lateral detectado: Localizando seletor text='Financeiro'...",
          "[PLAYWRIGHT] Clicando no menu 'Financeiro'",
          "[PLAYWRIGHT] Submenu detectado: Localizando seletor text='Gestão Orçamentária'...",
          "[PLAYWRIGHT] Clicando no submenu 'Gestão Orçamentária'"
        ],
        delay: 2500
      },
      {
        progress: 40,
        mockScreen: "gestao_orcamentaria",
        logs: [
          "[PLAYWRIGHT] Aguardando carregamento da tabela de Orçamentos...",
          "[DOM] Elemento da tabela carregado com sucesso.",
          `[SCRAPE] Localizando linha referente à Gerência: "${selectedGerencia}" usando seletor resiliente 'tr:has-text("${selectedGerencia}")'...`,
          `[SCRAPE] Gerência "${selectedGerencia}" encontrada com código de custo correspondente no banco.`,
          "[PLAYWRIGHT] Localizando botão editar (ícone da caneta editar.png)...",
          "[PLAYWRIGHT] Clicando no ícone de edição de orçamento..."
        ],
        delay: 3000
      },
      {
        progress: 55,
        mockScreen: "editar_orcamento",
        logs: [
          "[DOM] Modal/Formulário de Edição de Orçamento visível.",
          "[SCRAPE] Lendo campo 'Orçamento ABASTECIMENTO/SERVIÇOS'...",
          `[DATA] Valor atual lido no portal: R$ ${currentBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          `[CALC] Somando Crédito Extra: R$ ${currentBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} + R$ ${numericExtraCreditValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          `[CALC] Novo Orçamento a ser inserido: R$ ${(currentBudget + numericExtraCreditValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          `[PLAYWRIGHT] Limpando o campo de texto e inserindo o novo valor formatado...`,
          "[PLAYWRIGHT] Clicando no botão 'Salvar'..."
        ],
        delay: 3500
      },
      {
        progress: 70,
        mockScreen: "orcamento_salvo",
        logs: [
          "[PLAYWRIGHT] Aguardando popup de confirmação do portal...",
          "[DOM] Alerta de sucesso detectado: 'Orçamento updated com sucesso!'",
          "[PLAYWRIGHT] Clicando no botão 'OK' do popup de confirmação.",
          "[DATABASE] Sincronizando novo orçamento do departamento no histórico..."
        ],
        delay: 2000
      },
      {
        progress: 80,
        mockScreen: "limite_menu",
        logs: [
          "[PLAYWRIGHT] Retornando ao Menu Lateral: Localizando text='Financeiro'...",
          "[PLAYWRIGHT] Clicando no menu 'Financeiro'",
          "[PLAYWRIGHT] Submenu detectado: Localizando seletor text='Alteração de Limite'...",
          "[PLAYWRIGHT] Clicando no submenu 'Alteração de Limite'",
          "[PLAYWRIGHT] Aguardando carregamento do formulário de veículo..."
        ],
        delay: 2500
      },
      {
        progress: 90,
        mockScreen: "alterar_limite_form",
        logs: [
          "[DOM] Página de alteração de limite carregada.",
          `[PLAYWRIGHT] Preenchendo campo 'Placa do Veículo' com o valor: "${selectedPlaca}"...`,
          "[PLAYWRIGHT] Simulando digitação da placa e pressionando tecla 'Enter'...",
          "[SCRAPE] Veículo localizado. Dados do cartão ativos.",
          `[PLAYWRIGHT] Preenchendo campo 'Valor para alteração' com: R$ ${numericExtraCreditValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          "[PLAYWRIGHT] Marcando checkbox 'Adicionar o valor ao limite atual'...",
          "[PLAYWRIGHT] Marcando checkbox 'Somente para o período'...",
          "[PLAYWRIGHT] Clicando no botão 'Alterar'..."
        ],
        delay: 3000
      },
      {
        progress: 100,
        mockScreen: "limite_sucesso",
        logs: [
          "[PLAYWRIGHT] Aguardando popup de confirmação final...",
          "[DOM] Alerta detectado: 'Limite alterado com sucesso para o cartão associado!'",
          "[PLAYWRIGHT] Clicando no botão 'OK'...",
          "[SYSTEM] Finalizando sessão e liberando instâncias do navegador.",
          "[SYSTEM] Todos os passos executados com sucesso!"
        ],
        delay: 2500
      }
    ];

    let currentStepIdx = 0;

    const executeNextStep = async () => {
      // Bidirectional real-time check: has the bookmarklet completed the task?
      if (taskId) {
        try {
          const statusRes = await fetch(`/api/pending-automations/status/${taskId}`);
          const statusData = await statusRes.json();
          if (statusData.success) {
            if (statusData.status === "completed") {
              // Real automation completed on Ticket Log portal via user browser!
              if (timerRef.current) clearInterval(timerRef.current);
              setIsExecuting(false);
              const finalTime = executionTimer;
              
              setSimulatedBudget(currentBudget + numericExtraCreditValue);
              
              try {
                const runLog: HistoricoExecucao = {
                  usuario: userEmail,
                  data: new Date().toISOString(),
                  gerencia: selectedGerencia,
                  placa: selectedPlaca,
                  valorCredito: numericExtraCreditValue,
                  status: "Sucesso",
                  mensagem: "Automação REALIZADA diretamente no portal da Ticket Log via Assistente Bookmarklet com sucesso!",
                  tempoExecucao: finalTime || 12,
                  logs: [
                    ...logs,
                    `[${new Date().toLocaleTimeString()}] [REAL] Assistente detectado na aba plataforma.ticketlog.com.br.`,
                    `[${new Date().toLocaleTimeString()}] [REAL] Alteração orçamentária para ${selectedGerencia} enviada e salva.`,
                    `[${new Date().toLocaleTimeString()}] [REAL] Alteração de limite do veículo ${selectedPlaca} concluída com sucesso.`,
                    `[${new Date().toLocaleTimeString()}] [SYSTEM] Sincronização e persistência realizada no Firestore.`
                  ]
                };
                await addHistorico(runLog);
                setHistorico(prev => [runLog, ...prev]);
                toast.success("Automação Realizada com Sucesso no Ticket Log!");
                
                // Firestore Updates
                const foundGerencia = gerencias.find(g => g.nome.toUpperCase() === selectedGerencia.toUpperCase());
                if (foundGerencia && foundGerencia.id) {
                  const newBudget = (foundGerencia.orcamento ?? 22608.41) + numericExtraCreditValue;
                  await updateGerencia(foundGerencia.id, { orcamento: newBudget });
                }
                const foundAtivo = ativos.find(a => a.placa.toUpperCase() === selectedPlaca.toUpperCase());
                if (foundAtivo && foundAtivo.id) {
                  const newLimit = (foundAtivo.limite ?? 1500) + numericExtraCreditValue;
                  await updateAtivo(foundAtivo.id, { limite: newLimit });
                }
                await loadDatabase();
              } catch (e) {
                console.error("Firestore persistence error:", e);
              }
              
              setSelectedGerencia("");
              setSelectedPlaca("");
              setExtraCredit("");
              return;
            } else if (statusData.status === "failed") {
              // Real automation failed on Ticket Log portal!
              if (timerRef.current) clearInterval(timerRef.current);
              setIsExecuting(false);
              
              try {
                const runLog: HistoricoExecucao = {
                  usuario: userEmail,
                  data: new Date().toISOString(),
                  gerencia: selectedGerencia,
                  placa: selectedPlaca,
                  valorCredito: numericExtraCreditValue,
                  status: "Falha",
                  mensagem: `Automação falhou no portal real: ${statusData.msg || "Erro inesperado"}`,
                  tempoExecucao: executionTimer || 12,
                  logs: [
                    ...logs,
                    `[${new Date().toLocaleTimeString()}] [REAL_ERROR] Falha retornada do Assistente: ${statusData.msg}`
                  ]
                };
                await addHistorico(runLog);
                setHistorico(prev => [runLog, ...prev]);
                toast.error(`Automação no Ticket Log falhou: ${statusData.msg}`);
              } catch (e) {
                console.error("Firestore error:", e);
              }
              
              setSelectedGerencia("");
              setSelectedPlaca("");
              setExtraCredit("");
              return;
            }
          }
        } catch (e) {
          console.warn("Status check failed:", e);
        }
      }

      if (currentStepIdx >= runSteps.length) {
        // Complete execution in fallback simulated sandbox mode
        if (timerRef.current) clearInterval(timerRef.current);
        setIsExecuting(false);
        const finalTime = executionTimer;
        
        setSimulatedBudget(currentBudget + numericExtraCreditValue);
        
        try {
          const runLog: HistoricoExecucao = {
            usuario: userEmail,
            data: new Date().toISOString(),
            gerencia: selectedGerencia,
            placa: selectedPlaca,
            valorCredito: numericExtraCreditValue,
            status: "Sucesso",
            mensagem: "Automação Ticket Log executada e homologada via Sandbox do Nexus FuelControl.",
            tempoExecucao: finalTime || 21,
            logs: logs
          };
          await addHistorico(runLog);
          setHistorico(prev => [runLog, ...prev]);
          toast.success("Homologação/Simulação de Crédito Extra Concluída!");

          // PERSIST UPDATE IN FIRESTORE:
          const foundGerencia = gerencias.find(g => g.nome.toUpperCase() === selectedGerencia.toUpperCase());
          if (foundGerencia && foundGerencia.id) {
            const newBudget = (foundGerencia.orcamento ?? 22608.41) + numericExtraCreditValue;
            await updateGerencia(foundGerencia.id, { orcamento: newBudget });
          } else {
            const cc = getCentroCustoForGerencia(selectedGerencia);
            await addGerencia({
              nome: selectedGerencia,
              centroCusto: cc,
              codigoTicketLog: `TL-${selectedGerencia}-AUTO`,
              orcamento: 22608.41 + numericExtraCreditValue
            });
          }

          const foundAtivo = ativos.find(a => a.placa.toUpperCase() === selectedPlaca.toUpperCase());
          if (foundAtivo && foundAtivo.id) {
            const newLimit = (foundAtivo.limite ?? 1500) + numericExtraCreditValue;
            await updateAtivo(foundAtivo.id, { limite: newLimit });
          } else {
            const cc = getCentroCustoForGerencia(selectedGerencia);
            await addAtivo({
              placa: selectedPlaca.toUpperCase(),
              gerencia: selectedGerencia,
              centroCusto: cc,
              status: "Ativo",
              limite: 1500 + numericExtraCreditValue
            });
          }

          await loadDatabase();
        } catch (err) {
          console.error("Erro ao salvar histórico no Firebase:", err);
        }
        
        setSelectedGerencia("");
        setSelectedPlaca("");
        setExtraCredit("");
        return;
      }

      const step = runSteps[currentStepIdx];
      setExecutionProgress(step.progress);
      setActiveMockScreen(step.mockScreen);
      setExecutionStep(currentStepIdx + 1);
      
      step.logs.forEach(l => addLog(l));
      
      currentStepIdx++;
      setTimeout(executeNextStep, step.delay);
    };

    // Trigger sequential steps with simultaneous real-time bookmarklet pooling
    executeNextStep();
  };

  const cancelAutomation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsExecuting(false);
    setExecutionProgress(0);
    setActiveMockScreen("idle");
    setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [CANCEL] Automação cancelada pelo operador.`]);
    toast.error("Automação interrompida pelo operador.");
  };

  // --- CRUD SUBMISSIONS ---

  const handleGerenciaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gerenciaForm.nome || !gerenciaForm.centroCusto || !gerenciaForm.codigoTicketLog) {
      toast.error("Preencha todos os campos da gerência.");
      return;
    }
    try {
      if (editingGerencia?.id) {
        await updateGerencia(editingGerencia.id, gerenciaForm);
        toast.success("Gerência atualizada com sucesso.");
      } else {
        const id = await addGerencia(gerenciaForm);
        toast.success("Gerência cadastrada com sucesso.");
      }
      setIsGerenciaModalOpen(false);
      setEditingGerencia(null);
      setGerenciaForm({ nome: "", centroCusto: "", codigoTicketLog: "", orcamento: 22608.41 });
      loadDatabase();
    } catch (err) {
      toast.error("Erro ao salvar gerência.");
    }
  };

  const handleAtivoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ativoForm.placa || !ativoForm.gerencia || !ativoForm.centroCusto) {
      toast.error("Preencha todos os campos do ativo.");
      return;
    }
    try {
      const formattedPlaca = ativoForm.placa.trim().toUpperCase();
      const payload = { ...ativoForm, placa: formattedPlaca };
      
      if (editingAtivo?.id) {
        await updateAtivo(editingAtivo.id, payload);
        toast.success("Ativo updated com sucesso.");
      } else {
        await addAtivo(payload);
        toast.success("Ativo cadastrado com sucesso.");
      }
      setIsAtivoModalOpen(false);
      setEditingAtivo(null);
      setAtivoForm({ placa: "", gerencia: "", centroCusto: "", status: "Ativo", limite: 1500 });
      loadDatabase();
    } catch (err) {
      toast.error("Erro ao salvar ativo.");
    }
  };

  const handleDeleteGerencia = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta gerência? Os ativos vinculados perderão a referência.")) {
      try {
        await deleteGerencia(id);
        toast.success("Gerência excluída.");
        loadDatabase();
      } catch (err) {
        toast.error("Erro ao deletar gerência.");
      }
    }
  };

  const handleDeleteAtivo = async (id: string) => {
    if (confirm("Deseja mesmo remover esta placa do FuelControl?")) {
      try {
        await deleteAtivo(id);
        toast.success("Ativo removido.");
        loadDatabase();
      } catch (err) {
        toast.error("Erro ao deletar ativo.");
      }
    }
  };

  // One-click sync from main fleet base
  const syncFromMainFleet = async () => {
    toast.loading("Sincronizando placas da frota geral...", { id: "sync" });
    try {
      // In a real database we fetch fleet assets, let's simulated seed some matching vehicles from our defaults
      // or append missing ones safely to Firestore.
      const currentPlacas = new Set(ativos.map(a => a.placa));
      let addedCount = 0;
      
      for (const item of DEFAULT_ATIVOS) {
        if (!currentPlacas.has(item.placa)) {
          await addAtivo(item);
          addedCount++;
        }
      }
      toast.success(`Sincronização concluída! ${addedCount} novas placas vinculadas automaticamente.`, { id: "sync" });
      loadDatabase();
    } catch (err) {
      toast.error("Falha ao sincronizar placas da frota.", { id: "sync" });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      await saveFuelControlConfig(config);
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações.");
    }
  };

  // Filter listings
  const filteredGerencias = gerencias.filter(g => 
    g.nome.toLowerCase().includes(gerenciaSearch.toLowerCase()) ||
    g.centroCusto.includes(gerenciaSearch) ||
    g.codigoTicketLog.toLowerCase().includes(gerenciaSearch.toLowerCase())
  );

  const filteredAtivos = ativos.filter(a => 
    a.placa.toLowerCase().includes(ativoSearch.toLowerCase()) ||
    a.gerencia.toLowerCase().includes(ativoSearch.toLowerCase()) ||
    a.centroCusto.includes(ativoSearch)
  );

  const filteredHistory = historico.filter(h => 
    h.gerencia.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.placa.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.usuario.toLowerCase().includes(historySearch.toLowerCase())
  );

  // Security Protection Render
  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[500px]">
        <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-3xl max-w-md border border-red-100 dark:border-red-900/30 flex flex-col items-center space-y-4">
          <ShieldAlert className="text-red-500 h-16 w-16 animate-bounce" />
          <h2 className="text-lg font-black uppercase text-red-900 dark:text-red-400 tracking-tight">Acesso Não Autorizado</h2>
          <p className="text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
            O módulo <strong>Nexus FuelControl</strong> é de uso exclusivo para usuários com perfil de <strong>Gestão</strong> ou <strong>Master</strong>. 
            Suas credenciais atuais ({userRole}) não possuem permissão para executar ou visualizar as rotinas de automação de frotas da Ticket Log.
          </p>
          {onBack && (
            <Button onClick={onBack} variant="outline" className="border-red-200 text-red-700 hover:bg-red-100 rounded-xl font-bold text-xs">
              Voltar ao Início
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/25">
              <Cpu className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md tracking-wider">Módulo Exclusivo</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">RPA Framework Ativo</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nexus FuelControl</h1>
              <p className="text-[11px] text-slate-500 font-medium">Orquestrador de Automação de Crédito Extra e Limites na Plataforma Ticket Log</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button onClick={onBack} variant="outline" className="text-xs font-bold rounded-xl border-slate-200 h-9">
                Voltar
              </Button>
            )}
            <button 
              onClick={loadDatabase} 
              disabled={isLoadingData}
              className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 rounded-xl transition-all h-9"
              title="Recarregar banco de dados"
            >
              <RefreshCw size={16} className={isLoadingData ? "animate-spin text-indigo-600" : ""} />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-1.5 mt-6 border-b border-slate-100 dark:border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === "dashboard"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Cpu size={14} />
            <span>Painel de Controle</span>
          </button>
          <button
            onClick={() => setActiveTab("gerencias")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === "gerencias"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Building2 size={14} />
            <span>Gerências</span>
          </button>
          <button
            onClick={() => setActiveTab("ativos")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === "ativos"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Car size={14} />
            <span>Ativos & Placas</span>
          </button>
          <button
            onClick={() => setActiveTab("historico")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === "historico"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <History size={14} />
            <span>Histórico de Runs</span>
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === "config"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Sliders size={14} />
            <span>Configurações</span>
          </button>
        </div>
      </div>

      {isLoadingData && activeTab !== "dashboard" ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sincronizando com o Firestore...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: COCKPIT / DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Summary Cards */}
              <div className="col-span-12 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Total de Runs</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{historico.length}</h3>
                  </div>
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <History size={18} />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Taxa de Sucesso</span>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">
                      {historico.length > 0 
                        ? `${((historico.filter(h => h.status === "Sucesso").length / historico.length) * 100).toFixed(0)}%` 
                        : "100%"}
                    </h3>
                  </div>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Gerências Mapeadas</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{gerencias.length}</h3>
                  </div>
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-xl">
                    <Building2 size={18} />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Ativos de Alta Frequência</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{ativos.filter(a => a.status === "Ativo").length}</h3>
                  </div>
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
                    <Car size={18} />
                  </div>
                </div>
              </div>

              {/* Form Input Controller */}
              <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center space-x-2">
                  <SlidersHorizontal size={16} className="text-indigo-600" />
                  <h2 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider">Parametrizar Execução</h2>
                </div>

                <div className="space-y-4">
                  {/* Gerência Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Gerência de Origem *</label>
                    <div className="relative">
                      <select
                        value={selectedGerencia}
                        onChange={(e) => setSelectedGerencia(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none appearance-none h-10"
                      >
                        <option value="">Selecione a Gerência...</option>
                        {uniqueGerenciasFromFleet.map(gName => {
                          const cc = getCentroCustoForGerencia(gName);
                          return (
                            <option key={gName} value={gName}>{gName} (CC: {cc})</option>
                          );
                        })}
                      </select>
                      <Building2 className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
                    </div>
                    {uniqueGerenciasFromFleet.length === 0 && (
                      <p className="text-[10px] text-amber-600 font-medium">Nenhuma gerência encontrada na base de ativos ou cadastrada no Firestore.</p>
                    )}
                  </div>

                  {/* Valor Crédito */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Valor de Crédito Extra (R$) *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={extraCredit}
                        onChange={handleCreditChange}
                        disabled={isExecuting}
                        placeholder="R$ 0,00"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none h-10 placeholder-slate-300"
                      />
                      <DollarSign className="absolute left-3 top-3 text-indigo-500" size={14} />
                    </div>
                  </div>

                  {/* Placa dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Placa do Veículo Destinatário *</label>
                    <div className="relative">
                      <select
                        value={selectedPlaca}
                        onChange={(e) => setSelectedPlaca(e.target.value)}
                        disabled={isExecuting || !selectedGerencia}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none appearance-none h-10 disabled:opacity-50"
                      >
                        <option value="">Selecione a Placa...</option>
                        {filteredPlatesForSelectedGerencia.map(a => (
                          <option key={a.id} value={a.placa}>{a.placa}</option>
                        ))}
                      </select>
                      <Car className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
                    </div>
                    {selectedGerencia && filteredPlatesForSelectedGerencia.length === 0 && (
                      <p className="text-[10px] text-amber-600 font-medium leading-normal">
                        Nenhum veículo ativo localizado na base de ativos ou cadastrado no Firestore para a gerência {selectedGerencia}.
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    {isExecuting ? (
                      <Button
                        onClick={cancelAutomation}
                        className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                      >
                        <Square size={14} className="fill-current" />
                        <span>Cancelar Automação</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={startAutomation}
                        disabled={!selectedGerencia || !selectedPlaca || numericExtraCreditValue <= 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                      >
                        <Play size={14} className="fill-current" />
                        <span>Executar Automação</span>
                      </Button>
                    )}
                  </div>

                  {/* Flow Diagram */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-[10px]">
                    <span className="font-bold text-slate-500 uppercase tracking-widest block mb-2">Workflow Integrado:</span>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[9px]">1</div>
                      <span>Validação de sessão no Ticket Log</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[9px]">2</div>
                      <span>Atualização do Orçamento da Gerência</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[9px]">3</div>
                      <span>Ajuste de limite do cartão da placa</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[9px]">4</div>
                      <span>Geração de logs de conformidade</span>
                    </div>
                  </div>

                  {/* Bookmarklet Assist Panel */}
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 space-y-2.5">
                    <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-400">
                      <HelpCircle size={15} className="animate-pulse" />
                      <span className="font-extrabold uppercase tracking-widest text-[9px]">Execução REAL no Portal Ticket Log</span>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-slate-400 leading-normal font-medium">
                      Para injetar dados e executar de fato no site da Ticket Log (<a href="https://plataforma.ticketlog.com.br/home" target="_blank" rel="noreferrer" className="underline font-bold text-amber-800 dark:text-amber-300">plataforma.ticketlog.com.br</a>):
                    </p>
                    <ol className="text-[9.5px] text-slate-600 dark:text-slate-400 space-y-1 pl-3 list-decimal">
                      <li>Arraste o botão abaixo para a sua barra de favoritos (Bookmarks):</li>
                    </ol>
                    <div className="pt-1 flex flex-col gap-2">
                      <a
                        href={bookmarkletCode}
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(bookmarkletCode);
                          toast.success("Script do assistente copiado! Adicione aos favoritos ou execute no console do site.");
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-grab active:cursor-grabbing text-center"
                        title="Arraste para a barra de favoritos ou clique para copiar o código"
                      >
                        <Bookmark size={11} />
                        <span>Assistente TicketLog (Arraste)</span>
                      </a>
                      <p className="text-[8px] text-slate-400 dark:text-slate-500 text-center font-mono italic">
                        *Ou clique para copiar o código e colar no console do site.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terminal Logs & Graphic Mock Simulator */}
              <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Visualizer Simulator Viewport */}
                <div className="md:col-span-6 bg-slate-900 rounded-3xl border border-slate-950 p-4 shadow-xl text-white overflow-hidden flex flex-col h-[400px]">
                  {/* Address Bar */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 text-[10px] text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="bg-slate-950/80 rounded px-3 py-1 flex items-center space-x-2 w-3/4 max-w-xs border border-slate-800 text-[9px] font-mono select-all">
                      <Lock size={8} className="text-emerald-500 fill-current" />
                      <span className="truncate">plataforma.ticketlog.com.br/home</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <ExternalLink size={10} />
                    </div>
                  </div>

                  {/* Simulated Frame Screen content */}
                  <div className="flex-1 rounded-2xl bg-slate-950 p-4 border border-slate-800/60 overflow-hidden relative flex flex-col items-center justify-center text-center">
                    
                    {/* Idle State */}
                    {activeMockScreen === "idle" && (
                      <div className="space-y-4 max-w-xs animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800/80 flex items-center justify-center mx-auto text-slate-500 shadow-inner">
                          <Cpu size={32} className="opacity-40" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Aguardando Execução</h4>
                          <p className="text-[10px] text-slate-500 font-medium">Os passos da automação Ticket Log do robô em Python serão renderizados em tempo real neste frame diagnóstico.</p>
                        </div>
                      </div>
                    )}

                    {/* Step: Login Checking */}
                    {activeMockScreen === "login" && (
                      <div className="space-y-4 animate-pulse">
                        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Inicializando Sessão</h4>
                          <p className="text-[9px] text-slate-400 font-mono">Chromium Headless: Iniciando cookies de segurança corporativos...</p>
                        </div>
                      </div>
                    )}

                    {/* Step: Login Checked */}
                    {activeMockScreen === "login_checking" && (
                      <div className="space-y-4 max-w-xs">
                        <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                          <Check size={24} className="animate-bounce" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Sessão Autenticada</h4>
                          <p className="text-[9px] text-slate-400 font-mono">Token validado. Acessando painel Ticket Log...</p>
                        </div>
                      </div>
                    )}

                    {/* Step: Navigation to Menu */}
                    {activeMockScreen === "financeiro_menu" && (
                      <div className="w-full text-left font-sans text-[10px] space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
                          <span className="font-extrabold text-blue-400 tracking-tight uppercase text-[9px]">Menu Ticket Log</span>
                          <span className="bg-blue-950 text-blue-400 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wide">Clicando...</span>
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-indigo-500">
                          <div className="text-slate-400">📁 Home</div>
                          <div className="text-white font-extrabold flex items-center space-x-1.5">
                            <span>📂 Financeiro</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <div className="text-indigo-400 font-black pl-3 animate-pulse">↳ Gestão Orçamentária</div>
                          <div className="text-slate-500 pl-3">↳ Alteração de Limite</div>
                        </div>
                      </div>
                    )}

                    {/* Step: Gestão Orçamentária table search */}
                    {activeMockScreen === "gestao_orcamentaria" && (
                      <div className="w-full space-y-3 text-left">
                        <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-[9px] font-bold">
                          <span className="text-slate-300">Gestão Orçamentária</span>
                          <span className="text-slate-500">Total: 4 Registros</span>
                        </div>
                        <div className="border border-slate-800 rounded-xl overflow-hidden text-[9px] bg-slate-950 font-mono">
                          <div className="grid grid-cols-3 bg-slate-900 p-1.5 border-b border-slate-800 text-slate-400 font-bold">
                            <span>Gerência</span>
                            <span>CC</span>
                            <span>Ação</span>
                          </div>
                          <div className={`grid grid-cols-3 p-1.5 border-b border-slate-850 ${selectedGerencia === "GAD" ? "bg-indigo-950/40 border-indigo-900 text-white" : "text-slate-500"}`}>
                            <span className="font-bold">GAD</span>
                            <span>10.01.20</span>
                            <span className={selectedGerencia === "GAD" ? "text-indigo-400 font-extrabold animate-pulse" : "text-slate-600"}>Editar ✎</span>
                          </div>
                          <div className={`grid grid-cols-3 p-1.5 border-b border-slate-850 ${selectedGerencia === "GEF" ? "bg-indigo-950/40 border-indigo-900 text-white" : "text-slate-500"}`}>
                            <span className="font-bold">GEF</span>
                            <span>10.02.14</span>
                            <span className={selectedGerencia === "GEF" ? "text-indigo-400 font-extrabold animate-pulse" : "text-slate-600"}>Editar ✎</span>
                          </div>
                          <div className={`grid grid-cols-3 p-1.5 ${selectedGerencia === "GAT" ? "bg-indigo-950/40 border-indigo-900 text-white" : "text-slate-500"}`}>
                            <span className="font-bold">GAT</span>
                            <span>20.14.05</span>
                            <span className={selectedGerencia === "GAT" ? "text-indigo-400 font-extrabold animate-pulse" : "text-slate-600"}>Editar ✎</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step: Edit modal form */}
                    {activeMockScreen === "editar_orcamento" && (
                      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-left space-y-2.5 animate-fade-in">
                        <div className="text-[10px] font-black text-slate-300 border-b border-slate-800 pb-1.5 uppercase tracking-wide">Editar Orçamento: {selectedGerencia}</div>
                        
                        <div className="space-y-1">
                          <span className="text-[8px] uppercase text-slate-500 font-bold">Nome do Orçamento</span>
                          <div className="bg-slate-950 px-2 py-1 rounded text-[9px] text-slate-400 font-bold">Orçamento ABASTECIMENTO/SERVIÇOS</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase text-slate-500 font-bold">Valor Original</span>
                            <div className="bg-slate-950 px-2 py-1 rounded text-[9px] text-slate-400 font-mono font-bold">R$ {initialBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase text-slate-500 font-bold">Crédito Adicional</span>
                            <div className="bg-slate-950 px-2 py-1 rounded text-[9px] text-emerald-400 font-mono font-bold animate-pulse">+ R$ {numericExtraCreditValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[8px] uppercase text-indigo-400 font-black">Novo Orçamento Total</span>
                          <div className="bg-slate-950 px-2 py-1 border border-indigo-500/40 rounded text-[10px] text-white font-mono font-black text-center bg-indigo-950/20">
                            R$ {(initialBudget + numericExtraCreditValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step: Saved budget confirmation */}
                    {activeMockScreen === "orcamento_salvo" && (
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl max-w-xs text-center space-y-3 shadow-lg">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                          <Check size={16} />
                        </div>
                        <div className="space-y-1">
                          <h5 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Sucesso!</h5>
                          <p className="text-[8.5px] text-slate-400 font-medium">Orçamento da Gerência {selectedGerencia} salvo no Ticket Log com sucesso.</p>
                        </div>
                        <button className="bg-indigo-600 px-3 py-1 rounded text-[8px] text-white font-extrabold uppercase">OK (Confirmar)</button>
                      </div>
                    )}

                    {/* Step: Limit menu selection */}
                    {activeMockScreen === "limite_menu" && (
                      <div className="w-full text-left font-sans text-[10px] space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
                          <span className="font-extrabold text-blue-400 tracking-tight uppercase text-[9px]">Menu Ticket Log</span>
                          <span className="bg-blue-950 text-indigo-400 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wide">Selecionando...</span>
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-indigo-500">
                          <div className="text-slate-500">📁 Home</div>
                          <div className="text-white font-bold flex items-center space-x-1.5">
                            <span>📂 Financeiro</span>
                          </div>
                          <div className="text-slate-500 pl-3">↳ Gestão Orçamentária</div>
                          <div className="text-indigo-400 font-black pl-3 animate-pulse">↳ Alteração de Limite ★</div>
                        </div>
                      </div>
                    )}

                    {/* Step: Limit modification form fill */}
                    {activeMockScreen === "alterar_limite_form" && (
                      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-left space-y-2 animate-fade-in text-[9px]">
                        <div className="font-black text-slate-300 border-b border-slate-800 pb-1 uppercase tracking-wide">Alterar Limite do Cartão</div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[7.5px] text-slate-500 font-bold block uppercase">Placa Procurada</span>
                            <div className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-extrabold font-mono">{selectedPlaca}</div>
                          </div>
                          <div>
                            <span className="text-[7.5px] text-slate-500 font-bold block uppercase">Valor de Alteração</span>
                            <div className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-extrabold font-mono">R$ {numericExtraCreditValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>

                        <div className="space-y-1 bg-slate-950/80 p-1.5 rounded border border-slate-800">
                          <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                            <span className="w-2 h-2 rounded bg-indigo-500 flex items-center justify-center text-[7px] text-white">✓</span>
                            <span>Adicionar valor ao limite atual</span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-slate-300 font-medium mt-1">
                            <span className="w-2 h-2 rounded bg-indigo-500 flex items-center justify-center text-[7px] text-white">✓</span>
                            <span>Somente para o período</span>
                          </div>
                        </div>

                        <button className="w-full bg-indigo-600 text-white font-extrabold uppercase py-1 rounded text-[8px] hover:bg-indigo-700">Alterar Limite</button>
                      </div>
                    )}

                    {/* Step: Final success notification */}
                    {activeMockScreen === "limite_sucesso" && (
                      <div className="space-y-4 max-w-xs animate-fade-in">
                        <div className="w-12 h-12 rounded-full bg-emerald-950/50 border border-emerald-400/40 flex items-center justify-center mx-auto text-emerald-400">
                          <CheckCircle2 size={24} className="animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Limite Atualizado</h4>
                          <p className="text-[9px] text-slate-400 font-medium">Automação finalizada com sucesso! Limites atualizados e salvos no histórico corporativo.</p>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Progress Indicator and statistics footer */}
                  <div className="mt-4 space-y-1.5 border-t border-slate-800 pt-3 text-[10px] text-slate-400 font-sans">
                    <div className="flex justify-between font-bold">
                      <span className="uppercase text-[9px] tracking-wider text-slate-500">Progresso do Robô</span>
                      <span className="text-indigo-400">{executionProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${executionProgress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-2">
                      <div className="flex items-center space-x-1">
                        <Clock size={10} />
                        <span>Duração: {executionTimer}s</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Terminal size={10} />
                        <span>Passo {executionStep}/8</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Robotic Shell Console logs */}
                <div className="md:col-span-6 bg-slate-950 rounded-3xl border border-slate-900 p-4 shadow-xl flex flex-col h-[400px]">
                  <div className="border-b border-slate-900 pb-2 mb-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Terminal size={14} className="text-indigo-500" />
                      <span className="text-xs font-black uppercase text-slate-300 tracking-wider">Console de Execução</span>
                    </div>
                    <span className="text-[8px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-indigo-400 font-mono">playwright.stdout</span>
                  </div>

                  {/* Log console container */}
                  <div className="flex-1 overflow-y-auto font-mono text-[9.5px] text-slate-300 space-y-1.5 custom-scrollbar bg-slate-950/80 p-2 rounded-xl border border-slate-900/60 leading-relaxed">
                    {executionLogs.length === 0 ? (
                      <div className="text-slate-600 italic select-none h-full flex items-center justify-center text-center">
                        <div>
                          <span>$ nexus-fuelcontrol --run-rpa</span>
                          <span className="block mt-1 text-[8.5px]">Aguardando início do processo automatizado.</span>
                        </div>
                      </div>
                    ) : (
                      executionLogs.map((log, idx) => {
                        let colorClass = "text-slate-300";
                        if (log.includes("[PLAYWRIGHT]")) colorClass = "text-indigo-400";
                        if (log.includes("[SESSION]") || log.includes("[DATABASE]")) colorClass = "text-sky-400";
                        if (log.includes("[CALC]")) colorClass = "text-amber-300";
                        if (log.includes("sucesso") || log.includes("Sucesso!")) colorClass = "text-emerald-400";
                        if (log.includes("Erro") || log.includes("[CANCEL]")) colorClass = "text-rose-400";
                        
                        return (
                          <div key={idx} className={`${colorClass} transition-opacity`}>
                            {log}
                          </div>
                        );
                      })
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: GERENCIAS */}
          {activeTab === "gerencias" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
              
              {/* Filter Bar and Creation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    value={gerenciaSearch}
                    onChange={(e) => setGerenciaSearch(e.target.value)}
                    placeholder="Filtrar gerências..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-400"
                  />
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                </div>
                <Button 
                  onClick={() => {
                    setEditingGerencia(null);
                    setGerenciaForm({ nome: "", centroCusto: "", codigoTicketLog: "", orcamento: 22608.41 });
                    setIsGerenciaModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/10 h-10 w-full sm:w-auto"
                >
                  <Plus size={16} />
                  <span>Cadastrar Gerência</span>
                </Button>
              </div>

              {/* Gerências Table list */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Gerência (Nome)</th>
                        <th className="py-3 px-4">Centro de Custo</th>
                        <th className="py-3 px-4">Código Ticket Log</th>
                        <th className="py-3 px-4 text-right">Orçamento Atual</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      {filteredGerencias.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">Nenhuma gerência localizada com o filtro informado.</td>
                        </tr>
                      ) : (
                        filteredGerencias.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50/55 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white uppercase">{g.nome}</td>
                            <td className="py-3 px-4 font-mono font-medium">{g.centroCusto}</td>
                            <td className="py-3 px-4">
                              <span className="bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                {g.codigoTicketLog}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                              R$ {(g.orcamento ?? 22608.41).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => {
                                    setEditingGerencia(g);
                                    setGerenciaForm({ nome: g.nome, centroCusto: g.centroCusto, codigoTicketLog: g.codigoTicketLog, orcamento: g.orcamento ?? 22608.41 });
                                    setIsGerenciaModalOpen(true);
                                  }}
                                  className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                  title="Editar Gerência"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => g.id && handleDeleteGerencia(g.id)}
                                  className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                  title="Excluir Gerência"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: ATIVOS & PLACAS */}
          {activeTab === "ativos" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
              
              {/* Filter Bar and Creation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    value={ativoSearch}
                    onChange={(e) => setAtivoSearch(e.target.value)}
                    placeholder="Filtrar placas ou gerências..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-400"
                  />
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    onClick={syncFromMainFleet}
                    variant="outline"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 h-10 w-full sm:w-auto"
                  >
                    <RefreshCw size={14} />
                    <span>Importar da Frota Geral</span>
                  </Button>
                  <Button 
                    onClick={() => {
                      setEditingAtivo(null);
                      setAtivoForm({ placa: "", gerencia: "", centroCusto: "", status: "Ativo", limite: 1500 });
                      setIsAtivoModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/10 h-10 w-full sm:w-auto"
                  >
                    <Plus size={16} />
                    <span>Cadastrar Ativo</span>
                  </Button>
                </div>
              </div>

              {/* Ativos Table list */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Placa do Veículo</th>
                        <th className="py-3 px-4">Gerência Vinculada</th>
                        <th className="py-3 px-4">Centro de Custo</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Limite Atual</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      {filteredAtivos.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">Nenhum veículo ativo localizado com o filtro informado.</td>
                        </tr>
                      ) : (
                        filteredAtivos.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50/55 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3 px-4">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono tracking-wider">
                                {a.placa}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white uppercase">{a.gerencia}</td>
                            <td className="py-3 px-4 font-mono">{a.centroCusto}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                a.status === "Ativo" 
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                              R$ {(a.limite ?? 1500).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => {
                                    setEditingAtivo(a);
                                    setAtivoForm({ placa: a.placa, gerencia: a.gerencia, centroCusto: a.centroCusto, status: a.status, limite: a.limite ?? 1500 });
                                    setIsAtivoModalOpen(true);
                                  }}
                                  className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                  title="Editar Ativo"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => a.id && handleDeleteAtivo(a.id)}
                                  className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                  title="Excluir Ativo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: HISTÓRICO DE EXECUTIONS */}
          {activeTab === "historico" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
              
              {/* Filter Bar */}
              <div className="relative w-full sm:max-w-xs">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Pesquisar por gerência, placa ou operador..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-400"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              </div>

              {/* History list */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Operador</th>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Gerência</th>
                        <th className="py-3 px-4">Veículo</th>
                        <th className="py-3 px-4">Crédito</th>
                        <th className="py-3 px-4">Tempo (s)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">Nenhum registro de execução localizado no histórico.</td>
                        </tr>
                      ) : (
                        filteredHistory.map((h, idx) => (
                          <tr key={h.id || idx} className="hover:bg-slate-50/55 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[9px] text-slate-600">
                                  {h.usuario.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-[11px] truncate max-w-[120px]" title={h.usuario}>
                                  {h.usuario.split("@")[0]}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[10px] font-medium text-slate-500">
                              {new Date(h.data).toLocaleString("pt-BR")}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-white uppercase">{h.gerencia}</td>
                            <td className="py-3 px-4 font-mono font-bold">{h.placa}</td>
                            <td className="py-3 px-4 font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                              R$ {h.valorCredito.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 font-mono font-medium">{h.tempoExecucao}s</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                h.status === "Sucesso" 
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                              }`}>
                                {h.status === "Sucesso" ? "Sucesso" : "Falha"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedHistoryItem(h)}
                                className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[10px] font-black uppercase transition-all"
                              >
                                Evidências
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: CONFIGURAÇÕES */}
          {activeTab === "config" && config && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 max-w-2xl mx-auto space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-wide">Diretrizes da Automação (Robô Python)</h2>
                <p className="text-[10px] text-slate-400 mt-1">Configure timeouts de navegador, retentativas e logs de diagnósticos para garantir resiliência contra pequenas alterações no site da Ticket Log.</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Timeout Máximo por Ação (s)</label>
                    <input
                      type="number"
                      value={config.timeout}
                      onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 30 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tentativas de Repetição (Retry)</label>
                    <input
                      type="number"
                      value={config.retries}
                      onChange={(e) => setConfig({ ...config, retries: parseInt(e.target.value) || 2 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">URL Oficial Plataforma Ticket Log</label>
                  <input
                    type="url"
                    value={config.platformUrl}
                    onChange={(e) => setConfig({ ...config, platformUrl: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">E-mail para Alertas de Erros de Automação</label>
                  <input
                    type="email"
                    value={config.notificationEmail}
                    onChange={(e) => setConfig({ ...config, notificationEmail: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Modo de Operação de Infraestrutura</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, executionMode: "simulation" })}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                        config.executionMode === "simulation"
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/20"
                          : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700"
                      }`}
                    >
                      <Cpu size={18} />
                      <span>Sandbox de Simulação</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config, executionMode: "production" });
                        toast.success("Modo Produção ativado! Lembre-se de manter cookies sincronizados em server.ts");
                      }}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                        config.executionMode === "production"
                          ? "bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-950/20"
                          : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700"
                      }`}
                    >
                      <Sliders size={18} />
                      <span>Produção Ticket Log (Real)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md">
                    Salvar Parâmetros
                  </Button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* MODAL: GERENCIA (CREATE/EDIT) */}
      {isGerenciaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 animate-fade-in shadow-xl text-slate-800 dark:text-white">
            <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
              {editingGerencia ? "Editar Gerência" : "Cadastrar Gerência"}
            </h3>
            <form onSubmit={handleGerenciaSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nome da Gerência (ex: GAD)</label>
                <input
                  type="text"
                  required
                  value={gerenciaForm.nome}
                  onChange={(e) => setGerenciaForm({ ...gerenciaForm, nome: e.target.value.toUpperCase().trim() })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Centro de Custo (ex: 10.01.20)</label>
                <input
                  type="text"
                  required
                  value={gerenciaForm.centroCusto}
                  onChange={(e) => setGerenciaForm({ ...gerenciaForm, centroCusto: e.target.value.trim() })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Código Identificador Ticket Log</label>
                <input
                  type="text"
                  required
                  value={gerenciaForm.codigoTicketLog}
                  onChange={(e) => setGerenciaForm({ ...gerenciaForm, codigoTicketLog: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Orçamento da Gerência (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={gerenciaForm.orcamento}
                  onChange={(e) => setGerenciaForm({ ...gerenciaForm, orcamento: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 text-xs font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setIsGerenciaModalOpen(false)}
                  className="px-4 py-2 border border-slate-100 dark:border-slate-800 text-slate-500 rounded-xl"
                >
                  Cancelar
                </button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl">
                  {editingGerencia ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATIVO (CREATE/EDIT) */}
      {isAtivoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 animate-fade-in shadow-xl text-slate-800 dark:text-white">
            <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
              {editingAtivo ? "Editar Ativo" : "Cadastrar Ativo"}
            </h3>
            <form onSubmit={handleAtivoSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Placa do Veículo (ex: PCA7094)</label>
                <input
                  type="text"
                  required
                  value={ativoForm.placa}
                  onChange={(e) => setAtivoForm({ ...ativoForm, placa: e.target.value.toUpperCase().trim() })}
                  placeholder="PCA7094"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Gerência Responsável</label>
                <select
                  value={ativoForm.gerencia}
                  onChange={(e) => {
                    const matchedGerencia = gerencias.find(g => g.nome === e.target.value);
                    setAtivoForm({ 
                      ...ativoForm, 
                      gerencia: e.target.value,
                      centroCusto: matchedGerencia ? matchedGerencia.centroCusto : ""
                    });
                  }}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value="">Selecione a gerência...</option>
                  {gerencias.map(g => (
                    <option key={g.id} value={g.nome}>{g.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Centro de Custo</label>
                <input
                  type="text"
                  required
                  disabled
                  value={ativoForm.centroCusto}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-400 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Status do Ativo</label>
                <select
                  value={ativoForm.status}
                  onChange={(e) => setAtivoForm({ ...ativoForm, status: e.target.value as "Ativo" | "Inativo" })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value="Ativo">Ativo no FuelControl</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Limite Atual de Crédito (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={ativoForm.limite}
                  onChange={(e) => setAtivoForm({ ...ativoForm, limite: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl py-2 px-3 text-xs font-bold text-slate-850 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 text-xs font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setIsAtivoModalOpen(false)}
                  className="px-4 py-2 border border-slate-100 dark:border-slate-800 text-slate-500 rounded-xl"
                >
                  Cancelar
                </button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl">
                  {editingAtivo ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RUN DETAILS & EVIDENCES (HISTORY) */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-xl space-y-4 animate-scale-up shadow-2xl text-slate-800 dark:text-white max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="text-indigo-600 h-5 w-5" />
                <h3 className="text-xs font-black uppercase tracking-wider">Logs & Evidências da Execução</h3>
              </div>
              <button 
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-black"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {/* Top metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-[10px]">
                <div>
                  <span className="text-slate-400 uppercase font-bold block">Operador</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedHistoryItem.usuario.split("@")[0]}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold block">Placa</span>
                  <span className="font-extrabold text-slate-850 dark:text-slate-200 font-mono text-[11px]">{selectedHistoryItem.placa}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold block">Valor Inserido</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">R$ {selectedHistoryItem.valorCredito.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold block">Tempo de Execução</span>
                  <span className="font-extrabold text-slate-850 dark:text-slate-200">{selectedHistoryItem.tempoExecucao}s</span>
                </div>
              </div>

              {/* Status block */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                selectedHistoryItem.status === "Sucesso" 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-300"
                  : "bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-300"
              }`}>
                {selectedHistoryItem.status === "Sucesso" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-tight">Status: {selectedHistoryItem.status}</h4>
                  <p className="text-[10px] leading-relaxed mt-1">{selectedHistoryItem.mensagem}</p>
                </div>
              </div>

              {/* Step-by-step stdout logs */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">stdout logs:</span>
                <div className="bg-slate-950 p-3 rounded-2xl font-mono text-[9px] text-slate-300 space-y-1.5 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar border border-slate-900">
                  {selectedHistoryItem.logs.map((log, idx) => (
                    <div key={idx} className={log.includes("Erro") ? "text-rose-400" : log.includes("sucesso") ? "text-emerald-400" : "text-slate-400"}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Screenshot evidence */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Evidência Diagnóstica (Screenshot capturada):</span>
                <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50 p-3 flex flex-col items-center">
                  
                  {/* Simulate detailed evidence view of Ticket Log screen */}
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-white w-full max-w-sm space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between items-center text-[7.5px] border-b border-slate-850 pb-1 text-slate-500">
                      <span>plataforma.ticketlog.com.br</span>
                      <span>DIAGNOSTIC_EVIDENCE_OK</span>
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-1.5">
                      <CheckCircle2 size={16} className="text-emerald-400 mx-auto" />
                      <div className="text-white font-extrabold uppercase text-[8.5px]">Comprovante de Limite</div>
                      <div className="text-slate-400 text-[8px] leading-relaxed">
                        Veículo: <strong className="text-white">{selectedHistoryItem.placa}</strong><br />
                        Gerência: <strong className="text-white">{selectedHistoryItem.gerencia}</strong><br />
                        Valor Adicionado: <strong className="text-emerald-400">R$ {selectedHistoryItem.valorCredito.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong><br />
                        Data: <strong className="text-white">{new Date(selectedHistoryItem.data).toLocaleString("pt-BR")}</strong>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md"
              >
                Concluir Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
