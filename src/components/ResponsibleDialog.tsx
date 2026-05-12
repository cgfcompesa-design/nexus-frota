import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Responsible } from "@/hooks/useResponsibles";

interface ResponsibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  editingResponsible: Responsible | null;
}

export const ResponsibleDialog = ({ open, onOpenChange, onSubmit, editingResponsible }: ResponsibleDialogProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (editingResponsible) {
      setName(editingResponsible.name);
      setEmail(editingResponsible.email || "");
      setWhatsapp(editingResponsible.whatsapp || "");
    } else {
      setName("");
      setEmail("");
      setWhatsapp("");
    }
  }, [editingResponsible, open]);

  const handleSubmit = () => {
    if (!name) return;
    
    onSubmit({
      id: editingResponsible?.id,
      name,
      email,
      whatsapp
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tighter">
            {editingResponsible ? "Editar Responsável" : "Novo Responsável"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="bg-slate-800 border-slate-700 focus:border-indigo-500"
              placeholder="Digite o nome completo..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail</Label>
            <Input 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="bg-slate-800 border-slate-700"
              placeholder="email@compesa.com.br"
              type="email"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">WhatsApp</Label>
            <Input 
              value={whatsapp} 
              onChange={(e) => setWhatsapp(e.target.value)} 
              className="bg-slate-800 border-slate-700 font-mono"
              placeholder="(81) 9...."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest px-8">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
