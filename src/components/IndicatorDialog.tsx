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

export const IndicatorDialog = ({ open, onOpenChange, indicator, selectedMonth, onClose }: IndicatorDialogProps) => {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    if (indicator?.id) {
      setName(indicator.name || "");
      setTarget(indicator.target?.toString() || "");
      setCurrentValue(indicator.current_value?.toString() || "");
      setUnit(indicator.unit || "");
    } else {
      setName("");
      setTarget("");
      setCurrentValue("");
      setUnit("");
    }
  }, [indicator, open]);

  const handleSubmit = async () => {
    if (!name) return;

    const monthStr = format(selectedMonth, "yyyy-MM-01");
    const data = {
      name,
      section: indicator.section,
      subsection: indicator.subsection || null,
      unit,
      target: parseFloat(target),
      current_value: parseFloat(currentValue),
      updatedAt: serverTimestamp()
    };

    try {
      if (indicator?.id) {
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
          target: parseFloat(target),
          current_value: parseFloat(currentValue),
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
          createdAt: serverTimestamp()
        });
        
        await addDoc(collection(db, "indicator_values"), {
          indicator_id: newDoc.id,
          month: monthStr,
          target: parseFloat(target),
          current_value: parseFloat(currentValue),
          updatedAt: serverTimestamp()
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving indicator:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>{indicator?.id ? "Editar Indicador" : "Novo Indicador"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500">Nome do Indicador</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-800 border-slate-700" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Meta</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Realizado</Label>
              <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className="bg-slate-800 border-slate-700" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500">Unidade (ex: %, R$, Km)</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-slate-800 border-slate-700" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
