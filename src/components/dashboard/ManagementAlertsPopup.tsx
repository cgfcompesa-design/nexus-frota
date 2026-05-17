
import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, Share2, Mail, CheckCircle2, Copy } from "lucide-react";
import { 
  useMaintenanceData, 
  useControleOperacional, 
  useAssets,
  usePreventiveMaintenanceData
} from "@/hooks/useFleetData";
import { useQuery } from "@tanstack/react-query";
import { 
  processMaintenanceAlerts, 
  processTaxAlerts, 
  formatWhatsAppMessage,
  AlertItem
} from "@/lib/alertsLogic";
import { toast } from "sonner";

// APIs for Taxes
const TAXA_CARROCERIA_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=807131603&single=true&output=csv";
const INSPECAO_TACOGRAFO_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=1553195011&single=true&output=csv";
const VISTORIA_CIV_CIPP_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=1527811172&single=true&output=csv";
const INSPECAO_CSV_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=1469835888&single=true&output=csv";

const fetchCSV = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.split('\n').map(line => line.split(','));
  return lines;
};

// Helper for tax data parsing
const parseTaxCsv = (lines: string[][], tipo: string, validadeIdx: number) => {
  if (lines.length < 4) return [];
  const headers = lines[3];
  return lines.slice(4).map(row => {
    const obj: any = { __tipo: tipo, __validadeKey: "Validade" };
    row.forEach((val, i) => {
      obj[`COL_${i}`] = val;
    });
    obj.Placa = row[0];
    obj.Validade = row[validadeIdx];
    return obj;
  });
};

export default function ManagementAlertsPopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: maintenance = [] } = usePreventiveMaintenanceData();
  const { data: controle = [] } = useControleOperacional();
  const { data: assets = [] } = useAssets();

  const { data: taxData = [] } = useQuery({
    queryKey: ['tax-alerts-data'],
    queryFn: async () => {
      const [carroceria, tacografo, civcipp, csv] = await Promise.all([
        fetchCSV(TAXA_CARROCERIA_API),
        fetchCSV(INSPECAO_TACOGRAFO_API),
        fetchCSV(VISTORIA_CIV_CIPP_API),
        fetchCSV(INSPECAO_CSV_API)
      ]);

      return [
        ...parseTaxCsv(carroceria, "Taxa Carroceria Inmetro", 10),
        ...parseTaxCsv(tacografo, "Inspeção Tacógrafo", 10),
        ...parseTaxCsv(civcipp, "Vistoria CIV/CIPP", 9),
        ...parseTaxCsv(csv, "Inspeção CSV", 8)
      ];
    },
    enabled: isOpen
  });

  const alerts = useMemo(() => {
    if (!isOpen) return [];
    const mntAlers = processMaintenanceAlerts(maintenance, controle, assets);
    const taxAlerts = processTaxAlerts(taxData, assets);
    return [...mntAlers, ...taxAlerts].sort((a, b) => {
      if (a.tipo === b.tipo) return a.dias - b.dias;
      return a.tipo === 'Vencido' ? -1 : 1;
    });
  }, [maintenance, controle, assets, taxData, isOpen]);

  const proprios = useMemo(() => alerts.filter(a => a.propriedade === 'Próprio'), [alerts]);
  const locados = useMemo(() => alerts.filter(a => a.propriedade === 'Locado'), [alerts]);

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('proprios');

  const handleCopyWhatsApp = () => {
    try {
      const alertsToShare = activeTab === 'proprios' ? proprios : locados;
      if (alertsToShare.length === 0) {
        toast.error("Nenhum alerta para copiar.");
        return;
      }
      const message = formatWhatsAppMessage(alertsToShare);
      navigator.clipboard.writeText(message);
      toast.success("Resumo copiado com sucesso!");
    } catch (err) {
      toast.error("Erro ao copiar para área de transferência.");
    }
  };

  const handleShareWhatsApp = () => {
    try {
      const alertsToShare = activeTab === 'proprios' ? proprios : locados;
      if (alertsToShare.length === 0) {
        toast.error("Nenhum alerta para compartilhar.");
        return;
      }
      const message = formatWhatsAppMessage(alertsToShare);
      navigator.clipboard.writeText(message);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err) {
      toast.error("Erro ao iniciar compartilhamento.");
    }
  };

  const handleSendEmail = async () => {
    if (isSendingEmail) return;
    
    const alertsToReport = activeTab === 'proprios' ? proprios : locados;
    if (!alertsToReport || alertsToReport.length === 0) {
      toast.error("Não há alertas para enviar nesta categoria.");
      return;
    }

    setIsSendingEmail(true);
    const vehicleType = activeTab === 'proprios' ? 'Próprio' : 'Locado';
    const targetEmail = activeTab === 'proprios' ? 'gadveiculos@compesa.com.br' : 'gadlocados@compesa.com.br';

    try {
      const response = await fetch('/api/send-management-report', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          alerts: alertsToReport, 
          vehicleType,
          targetEmail
        })
      });
      
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("O servidor retornou uma resposta vazia.");
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("JSON Parse Error. Server response:", responseText);
        throw new Error("O servidor enviou um formato inválido. Tente novamente mais tarde.");
      }
      
      if (response.ok && data.success) {
        toast.success(data.message || "Relatório enviado com sucesso!");
      } else {
        toast.error(data.error || "Erro ao processar envio no servidor.");
      }
    } catch (error: any) {
      console.error("Email send fatal error:", error);
      toast.error(error.message || "Falha na conexão com o servidor de e-mail.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen && alerts.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] h-[90vh] overflow-hidden flex flex-col p-0 bg-slate-50 dark:bg-slate-950 border-white/10">
        <DialogHeader className="p-6 pb-2 shrink-0 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">
                  Alertas de Gestão
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                  Resumo de Pendências Próprias e Locadas
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyWhatsApp}
                className="h-8 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 transition-all"
              >
                <Copy className="w-3 h-3 mr-2" /> Copiar Texto
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShareWhatsApp}
                className="h-8 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
              >
                <Share2 className="w-3 h-3 mr-2" /> WhatsApp Web
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="h-8 text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all font-sans"
              >
                <Mail className="w-3 h-3 mr-2" /> {isSendingEmail ? "Enviando..." : "Email"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col px-6 bg-slate-50 dark:bg-slate-950/50">
          <Tabs defaultValue="proprios" onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between py-4 shrink-0">
              <TabsList className="bg-slate-200/50 dark:bg-slate-900/50 p-1">
                <TabsTrigger value="proprios" className="text-[10px] uppercase font-black px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-none">
                  Próprios ({proprios.length})
                </TabsTrigger>
                <TabsTrigger value="locados" className="text-[10px] uppercase font-black px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-none">
                  Locados ({locados.length})
                </TabsTrigger>
              </TabsList>
              
              <div className="flex items-center space-x-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" /> Vencidos</div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" /> Próximos</div>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <TabsContent value="proprios" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=active]:flex">
                <AlertList alerts={proprios} />
              </TabsContent>
              <TabsContent value="locados" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=active]:flex">
                <AlertList alerts={locados} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="p-4 shrink-0 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950">
          <div className="flex w-full items-center justify-between">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
              Relatório automatizado: 09h e 14h
            </div>
            <Button onClick={onClose} variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
              Fechar Alertas
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlertList({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
        <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Tudo em dia!</p>
        <p className="text-slate-500 text-[11px] mt-1">Não há alertas pendentes nesta categoria.</p>
      </div>
    );
  }

  // Sort: Criticality first, then Vencidos, then by days
  const sorted = [...alerts].sort((a, b) => {
    const getScore = (c?: string) => {
      const crit = String(c || "").toUpperCase().trim();
      if (crit === 'ALTA' || crit === 'A') return 0;
      if (crit === 'MÉDIA' || crit === 'MEDIA' || crit === 'B') return 1;
      if (crit === 'BAIXA' || crit === 'C') return 2;
      return 3;
    };
    const scoreA = getScore(a.criticidade);
    const scoreB = getScore(b.criticidade);
    if (scoreA !== scoreB) return scoreA - scoreB;
    if (a.tipo !== b.tipo) return a.tipo === 'Vencido' ? -1 : 1;
    return a.dias - b.dias;
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ScrollArea className="flex-1 w-full h-[calc(90vh-220px)]">
        <div className="space-y-3 pr-4 pb-20">
          {sorted.map((alert) => (
            <div 
              key={alert.id}
              className={`p-4 bg-white dark:bg-slate-900 border ${alert.tipo === 'Vencido' ? 'border-rose-500/20 shadow-sm shadow-rose-500/5' : 'border-slate-200 dark:border-white/5'} rounded-2xl hover:border-slate-300 dark:hover:border-white/20 transition-all group`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                      {alert.placa}
                    </span>
                    <Badge variant="outline" className="text-[8px] font-black bg-slate-50 dark:bg-slate-800 border-none px-1.5 py-0.5 text-slate-500 uppercase tracking-widest">
                      {alert.categoria}
                    </Badge>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                      alert.criticidade === 'ALTA' ? 'bg-rose-500 text-white' : 
                      alert.criticidade === 'MÉDIA' || alert.criticidade === 'MEDIA' ? 'bg-amber-500 text-white' : 
                      'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {alert.criticidade}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                    {alert.gerencia}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${alert.tipo === 'Vencido' ? 'text-rose-500' : 'text-amber-500'}`}>
                    {alert.tipo === 'Vencido' ? `Vencido há ${alert.dias} dias` : `Vence em ${alert.dias} dias`}
                  </div>
                  <div className="flex items-center justify-end mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <Clock className="w-2.5 h-2.5 mr-1" /> {alert.vencimento}
                  </div>
                </div>
              </div>
              
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-white/5">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed capitalize">
                  {alert.descricao.toLowerCase()}
                </p>
                {alert.infoAdicional && (
                  <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-widest truncate">
                    Obs: {alert.infoAdicional}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

