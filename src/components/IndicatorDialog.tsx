import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";

interface IndicatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: any;
  selectedMonth: Date;
  onClose: () => void;
}

import { toast } from "sonner";

export const IndicatorDialog = ({ open, onOpenChange, indicator, selectedMonth, onClose }: IndicatorDialogProps) => {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [month, setMonth] = useState("");
  const [section, setSection] = useState("manutencao");
  const [subsection, setSubsection] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [goalType, setGoalType] = useState<"higher" | "lower">("higher");

  const isAuto = !!(indicator?.is_auto || (indicator?.id && String(indicator.id).startsWith("auto-")));

  useEffect(() => {
    if (indicator) {
      setName(indicator.name || "");
      setTarget(indicator.target?.toString() || "");
      setCurrentValue(isAuto ? "0" : (indicator.current_value?.toString() || ""));
      setUnit(indicator.unit || "");
      setChartType(indicator.chart_type || "bar");
      setMonth(format(selectedMonth, "yyyy-MM"));
      setSection(indicator.section || "manutencao");
      setSubsection(indicator.subsection || "");
      setGoalType(indicator.goal_type || "higher");
    } else {
      setName("");
      setTarget("");
      setCurrentValue("");
      setUnit("");
      setChartType("bar");
      setMonth(format(selectedMonth, "yyyy-MM"));
      setSection("manutencao");
      setSubsection("");
      setGoalType("higher");
    }
  }, [indicator, open, selectedMonth, isAuto]);

  const handleSubmit = async () => {
    if (!name || !month) return;

    const monthStr = `${month}-01`;
    setIsSaving(true);
    
    const data: any = {
      name,
      section,
      subsection: (subsection === "none" || !subsection) ? null : subsection,
      unit,
      target: isNaN(parseFloat(target)) ? 0 : parseFloat(target),
      current_value: isAuto ? 0 : (isNaN(parseFloat(currentValue)) ? 0 : parseFloat(currentValue)),
      chart_type: chartType,
      goal_type: goalType,
      is_auto: isAuto,
      updatedAt: serverTimestamp()
    };

    try {
      if (indicator?.id && !String(indicator.id).startsWith("auto-")) {
        // Update indicator definition
        await updateDoc(doc(db, "indicators", indicator.id), data);
        
        // Upsert month value
        const q = query(
          collection(db, "indicator_values"), 
          where("indicator_id", "==", indicator.id),
          where("month", "==", monthStr)
        );
        const snapshot = await getDocs(q);
        
        const valueData = {
          indicator_id: indicator.id,
          month: monthStr,
          target: isNaN(parseFloat(target)) ? 0 : parseFloat(target),
          current_value: isAuto ? 0 : (isNaN(parseFloat(currentValue)) ? 0 : parseFloat(currentValue)),
          updatedAt: serverTimestamp()
        };

        if (!snapshot.empty) {
          await updateDoc(doc(db, "indicator_values", snapshot.docs[0].id), valueData);
        } else {
          await addDoc(collection(db, "indicator_values"), valueData);
        }
      } else {
        // Create new
        const newDoc = await addDoc(collection(db, "indicators"), {
          ...data,
          order: Date.now(),
          createdAt: serverTimestamp()
        });
        
        await addDoc(collection(db, "indicator_values"), {
          indicator_id: newDoc.id,
          month: monthStr,
          target: isNaN(parseFloat(target)) ? 0 : parseFloat(target),
          current_value: isAuto ? 0 : (isNaN(parseFloat(currentValue)) ? 0 : parseFloat(currentValue)),
          updatedAt: serverTimestamp()
        });
      }
      toast.success("Indicador salvo com sucesso!");
      onClose();
    } catch (error: any) {
      console.error("Error saving indicator:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>{indicator?.id ? (isAuto ? "Editar Meta de Indicador Automático" : "Editar Indicador") : "Novo Indicador"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Seção</Label>
              <Select value={section} onValueChange={setSection} disabled={isAuto}>
                <SelectTrigger className="bg-slate-800 border-slate-700 h-10">
                  <SelectValue placeholder="Seção" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="abastecimento">Abastecimento</SelectItem>
                  <SelectItem value="regularizacao">Regularização</SelectItem>
                  <SelectItem value="telemetria">Telemetria</SelectItem>
                  <SelectItem value="pool">Pool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {section === "manutencao" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Subseção</Label>
                <Select value={subsection} onValueChange={setSubsection} disabled={isAuto}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 h-10">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="Próprios">Próprios</SelectItem>
                    <SelectItem value="Locados">Locados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Mês de Referência</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-slate-800 border-slate-700 h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Tipo de Gráfico</Label>
              <Select value={chartType} onValueChange={setChartType} disabled={isAuto}>
                <SelectTrigger className="bg-slate-800 border-slate-700 h-10">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="bar">Barra</SelectItem>
                  <SelectItem value="line">Linha</SelectItem>
                  <SelectItem value="pie">Pizza</SelectItem>
                  <SelectItem value="gauge">Medidor</SelectItem>
                  <SelectItem value="number">Card (Número)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Nome do Indicador</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-800 border-slate-700 h-10" placeholder="Ex: Eficiência de Combustível" disabled={isAuto} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Meta ({unit || "-"})</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="bg-slate-800 border-slate-700 h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Realizado ({unit || "-"})</Label>
              <Input 
                type="text" 
                value={isAuto ? "Auto" : currentValue} 
                onChange={(e) => setCurrentValue(e.target.value)} 
                className="bg-slate-800 border-slate-700 h-10 font-medium text-amber-400" 
                disabled={isAuto}
                placeholder={isAuto ? "Cálculo Automático" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Unidade (ex: %, R$, Km, L)</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-slate-800 border-slate-700 h-10" disabled={isAuto} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest leading-none">Lógica do Indicador (Meta)</Label>
            <Select value={goalType} onValueChange={(val: any) => setGoalType(val)} disabled={isAuto}>
              <SelectTrigger className="bg-slate-800 border-slate-700 h-10 text-white">
                <SelectValue placeholder="Selecione o critério" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="higher">Maior ou igual à meta é "Dentro da Meta"</SelectItem>
                <SelectItem value="lower">Menor ou igual à meta é "Dentro da Meta"</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400" disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
