import { useState, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, Trash2, FileWarning, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  query, 
  where,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GestaoMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicators: any[];
  responsibles: any[];
}

export const GestaoMaintenanceDialog = ({ open, onOpenChange, indicators, responsibles }: GestaoMaintenanceDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const cleanNumericValue = (val: string): number => {
    if (!val) return 0;
    // Extract first numeric group (handles "70% (319/457)" -> 70, "R$ 1.234,56" -> 1234.56)
    // Remove dots (thousands separator) and replace comma with dot
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const handleDownloadTemplate = () => {
    const headers = ["Indicador", "Responsável", "Resultado Atual", "Meta", "Status", "Mês/Ano"];
    const currentMonth = format(new Date(), "MM/yyyy");
    
    // Create some rows with existing indicators to help the user
    const rows = indicators.length > 0 
      ? indicators.map(ind => {
          const resp = responsibles.find(r => r.id === ind.responsible_id);
          return [ind.name, resp?.name || "", ind.current_value || 0, ind.target || 0, "", currentMonth];
        })
      : [["Exemplo: Cumprimento de Preventivas", "José Jr", "70", "100", "", currentMonth]];

    const csvContent = Papa.unparse({
      fields: headers,
      data: rows
    });

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `modelo_indicadores_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Modelo baixado com sucesso!");
  };

  const handleDeleteAllValues = async () => {
    if (!confirm("TEM CERTEZA? Isso excluirá TODOS os lançamentos (resultados) de todos os meses. Os indicadores (nomes/metas padrão) serão mantidos.")) return;

    setIsProcessing(true);
    try {
      const q = collection(db, "indicator_values");
      const snapshot = await getDocs(q);
      
      const batchSize = 500;
      const chunks = [];
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        chunks.push(snapshot.docs.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      toast.success(`${snapshot.docs.length} registros excluídos com sucesso!`);
    } catch (error: any) {
      console.error("Error deleting values:", error);
      toast.error("Erro ao excluir registros: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          let count = 0;
          let createdIndicators = 0;

          // We'll process in a map to reuse indicators
          const existingIndicatorsMap = new Map(indicators.map(i => [i.name.toLowerCase().trim(), i]));

          for (const row of data) {
            const indicatorName = row["Indicador"]?.trim();
            if (!indicatorName) continue;

            const responsibleName = row["Responsável"]?.trim();
            const currentValue = cleanNumericValue(row["Resultado Atual"]);
            const target = cleanNumericValue(row["Meta"]);
            const monthRaw = row["Mês/Ano"]?.trim();
            
            let monthStr = format(new Date(), "yyyy-MM-01");
            if (monthRaw) {
              try {
                // Try format MM/YYYY or YYYY-MM
                let parsedDate;
                if (monthRaw.includes("/")) {
                  parsedDate = parse(monthRaw, "MM/yyyy", new Date());
                } else if (monthRaw.includes("-")) {
                  parsedDate = parse(monthRaw, "yyyy-MM", new Date());
                }
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                  monthStr = format(parsedDate, "yyyy-MM-01");
                }
              } catch (e) {
                console.warn("Invalid date format in CSV:", monthRaw);
              }
            }

            let indicator = existingIndicatorsMap.get(indicatorName.toLowerCase());
            
            if (!indicator) {
              // Create new indicator definition
              const newIndData = {
                name: indicatorName,
                section: "manutencao",
                unit: row["Resultado Atual"]?.includes("%") ? "%" : "",
                target: target,
                current_value: currentValue,
                chart_type: "bar",
                order: Date.now() + count,
                createdAt: serverTimestamp()
              };
              const newDoc = await addDoc(collection(db, "indicators"), newIndData);
              indicator = { id: newDoc.id, ...newIndData };
              existingIndicatorsMap.set(indicatorName.toLowerCase(), indicator);
              createdIndicators++;
            }

            // Add value for the month
            // Check if already exists for this indicator/month
            const q = query(
              collection(db, "indicator_values"),
              where("indicator_id", "==", indicator.id),
              where("month", "==", monthStr)
            );
            const valSnapshot = await getDocs(q);

            const valueData = {
              indicator_id: indicator.id,
              month: monthStr,
              target: target,
              current_value: currentValue,
              updatedAt: serverTimestamp()
            };

            if (!valSnapshot.empty) {
              const batch = writeBatch(db);
              batch.update(doc(db, "indicator_values", valSnapshot.docs[0].id), valueData);
              await batch.commit();
            } else {
              await addDoc(collection(db, "indicator_values"), valueData);
            }
            count++;
          }

          toast.success(`Importação concluída: ${count} registros processados (${createdIndicators} novos indicadores).`);
          onOpenChange(false);
        } catch (error: any) {
          console.error("Error during import:", error);
          toast.error("Erro na importação: " + error.message);
        } finally {
          setIsProcessing(false);
          // Clear input
          e.target.value = "";
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        toast.error("Erro ao ler o arquivo CSV.");
        setIsProcessing(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="text-indigo-400 h-5 w-5" />
            Manutenção de Indicadores
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Gerencie lançamentos em massa e configurações do painel de gestão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Importação / Exportação</h4>
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                onClick={handleDownloadTemplate}
                className="bg-slate-800 border-slate-700 text-white justify-start gap-3 h-12 rounded-xl"
                disabled={isProcessing}
              >
                <Download className="h-4 w-4 text-emerald-500" />
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase leading-none">Baixar Modelo CSV</p>
                  <p className="text-[8px] font-bold text-slate-500">Planilha base para preenchimento</p>
                </div>
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="csv-upload"
                  onChange={handleImportCSV}
                  disabled={isProcessing}
                />
                <Button 
                  asChild
                  variant="outline" 
                  className="bg-slate-800 border-slate-700 text-white justify-start gap-3 h-12 w-full rounded-xl cursor-pointer"
                >
                  <label htmlFor="csv-upload">
                    <Upload className="h-4 w-4 text-indigo-500" />
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase leading-none">Importar Planilha</p>
                      <p className="text-[8px] font-bold text-slate-500">Atualizar dados em massa via CSV</p>
                    </div>
                  </label>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2">
              <FileWarning className="h-3 w-3" /> Zona de Perigo
            </h4>
            <Button 
              variant="outline" 
              onClick={handleDeleteAllValues}
              className="bg-rose-950/20 border-rose-900/50 text-rose-400 hover:bg-rose-900/40 hover:text-rose-100 justify-start gap-3 h-12 w-full rounded-xl transition-all"
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase leading-none">Limpar Todos os Lançamentos</p>
                <p className="text-[8px] font-bold text-rose-400/60 uppercase">Excluir resultados de todos os meses</p>
              </div>
            </Button>
          </div>
        </div>

        <DialogFooter className="bg-slate-950/50 p-4 -m-6 mt-2 rounded-b-xl">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 text-[10px] font-black uppercase tracking-widest" disabled={isProcessing}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
