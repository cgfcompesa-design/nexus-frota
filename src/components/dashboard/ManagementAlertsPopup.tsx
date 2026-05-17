
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
import { AlertTriangle, Clock, Share2, Mail, CheckCircle2 } from "lucide-react";
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
    const mntAlers = processMaintenanceAlerts(maintenance, controle);
    const taxAlerts = processTaxAlerts(taxData, assets);
    return [...mntAlers, ...taxAlerts].sort((a, b) => {
      if (a.tipo === b.tipo) return a.dias - b.dias;
      return a.tipo === 'Vencido' ? -1 : 1;
    });
  }, [maintenance, controle, assets, taxData, isOpen]);

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleShareWhatsApp = () => {
    const message = formatWhatsAppMessage(alerts);
    navigator.clipboard.writeText(message);
    toast.success("Resumo copiado para a área de transferência!");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-management-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts })
      });
      
      if (response.ok) {
        toast.success("Relatório enviado com sucesso para gadveiculos@compesa.com.br");
      } else {
        toast.error("Erro ao enviar o relatório por e-mail.");
      }
    } catch (error) {
      toast.error("Falha na conexão com o servidor.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (alerts.length === 0 && !isOpen) return null;

  const vencidos = alerts.filter(a => a.tipo === 'Vencido');
  const aVencer = alerts.filter(a => a.tipo === 'A Vencer');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0 bg-slate-50 dark:bg-slate-950 border-white/10">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-rose-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">
                Alertas de Gestão
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                Manutenções e Taxas Pendentes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 pb-6">
          <Tabs defaultValue="all" className="h-full flex flex-col">
            <TabsList className="justify-start bg-slate-200/50 dark:bg-slate-900/50 p-1 mb-4">
              <TabsTrigger value="all" className="text-[10px] uppercase font-black px-4">Todos ({alerts.length})</TabsTrigger>
              <TabsTrigger value="vencidos" className="text-[10px] uppercase font-black px-4 text-rose-500">Vencidos ({vencidos.length})</TabsTrigger>
              <TabsTrigger value="avencer" className="text-[10px] uppercase font-black px-4 text-amber-500">A Vencer ({aVencer.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="flex-1 overflow-hidden mt-0">
              <AlertList alerts={alerts} />
            </TabsContent>
            <TabsContent value="vencidos" className="flex-1 overflow-hidden mt-0">
              <AlertList alerts={vencidos} />
            </TabsContent>
            <TabsContent value="avencer" className="flex-1 overflow-hidden mt-0">
              <AlertList alerts={aVencer} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/30">
          <div className="flex w-full items-center justify-between">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShareWhatsApp}
                className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
              >
                <Share2 className="w-3 h-3 mr-2" /> Copiar WhatsApp
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-50"
              >
                <Mail className="w-3 h-3 mr-2" /> {isSendingEmail ? "Enviando..." : "Enviar E-mail"}
              </Button>
            </div>
            <Button onClick={onClose} variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Ignorar por enquanto
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
      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Tudo em dia!</p>
        <p className="text-slate-500 text-xs mt-1">Não há alertas pendentes nesta categoria.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl hover:border-slate-300 dark:hover:border-white/20 transition-all group"
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                  {alert.placa}
                </span>
                <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-widest">
                  {alert.categoria}
                </span>
              </div>
              <Badge variant={alert.tipo === 'Vencido' ? "destructive" : "warning" as any} className="text-[9px] uppercase font-black px-2 py-0">
                {alert.tipo === 'Vencido' ? `Vencido (${alert.dias} dias)` : `${alert.dias} dias`}
              </Badge>
            </div>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 line-clamp-1">
              {alert.descricao}
            </p>
            <div className="flex items-center mt-2 space-x-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex items-center">
                <Clock className="w-2.5 h-2.5 mr-1" /> {alert.vencimento}
              </div>
              {alert.infoAdicional && (
                <div className="truncate max-w-[200px]">
                  {alert.infoAdicional}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
