import React, { useMemo, useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Mail, 
  Building2, 
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Loader2,
  FilterX
} from "lucide-react";
import { FuelData } from "@/types";
import { useMachineSupplyAssignments } from "@/hooks/useMachineSupplyAssignments";
import { useContactsData } from "@/hooks/useContactsData";
import { toast } from "sonner";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";

interface MachineSupplyIndicatorsProps {
  fuel: FuelData[];
}

export const MachineSupplyIndicators = ({ fuel }: MachineSupplyIndicatorsProps) => {
  const { data: assignments = [], isLoading: loadingAssignments } = useMachineSupplyAssignments();
  const { getEmailsByGerencia } = useContactsData();
  const [searchTerm, setSearchTerm] = useState("");
  const [showPendingOnly, setShowPendingOnly] = useState(true);

  const stats = useMemo(() => {
    const maqFuel = fuel.filter(f => {
      const placa = String(f._placa || "").toUpperCase();
      return placa.startsWith("MAQ") || placa.startsWith("GER");
    });

    const total = maqFuel.length;
    const completed = maqFuel.filter(f => {
      const txId = String(f.COL_0 || "").trim();
      return assignments.some(a => a.transactionId === txId);
    }).length;

    const pending = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, percent, maqFuel };
  }, [fuel, assignments]);

  const unitStats = useMemo(() => {
    const units: Record<string, { total: number; completed: number; pending: number }> = {};
    
    stats.maqFuel.forEach(f => {
      const unit = String(f.COL_29 || "N/A").trim();
      if (!units[unit]) units[unit] = { total: 0, completed: 0, pending: 0 };
      
      units[unit].total++;
      const txId = String(f.COL_0 || "").trim();
      if (assignments.some(a => a.transactionId === txId)) {
        units[unit].completed++;
      } else {
        units[unit].pending++;
      }
    });

    return Object.entries(units)
      .map(([name, s]) => ({
        name,
        ...s,
        percent: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
      }))
      .filter(u => u.name.toUpperCase().includes(searchTerm.toUpperCase()))
      .filter(u => !showPendingOnly || u.pending > 0)
      .sort((a, b) => b.pending - a.pending);
  }, [stats.maqFuel, assignments, searchTerm, showPendingOnly]);

  const handleNotify = (unitName: string, pendingCount: number) => {
    const emails = getEmailsByGerencia(unitName);
    const cc = "gadmonitoramento@compesa.com.br; gadabastecimento@compesa.com.br";
    const subject = `PENDÊNCIA: Relatório de Abastecimento de Máquinas/Equipamentos - ${unitName}`;
    
    const body = `Prezado Gestor da Unidade (${unitName}),

Identificamos que sua unidade possui ${pendingCount} abastecimento(s) de máquinas ou equipamentos (placas MAQ/GER) sem o devido preenchimento das informações complementares no sistema Nexus Frota.

O preenchimento do "Destino do Maquinário", "Modelo" e "Tombamento" é obrigatório para fins de conformidade e auditoria de combustíveis.

Por favor, acesse o módulo "Abastecimento Máquinas" no portal Nexus Frota e complete as informações pendentes o mais breve possível.

Dúvidas podem ser sanadas diretamente com a CGF.

Atenciosamente,
Coordenação de Gestão de Frotas - CGF`;

    // Filter out CC from TO to avoid duplicates
    const ccList = ["gadmonitoramento@compesa.com.br", "gadabastecimento@compesa.com.br"];
    const filteredTo = emails.filter(e => !ccList.some(ccEmail => e.toLowerCase().includes(ccEmail.toLowerCase())));

    const mailto = `mailto:${filteredTo.join(";") || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
    window.open(mailto, '_blank');
    toast.success(`Notificação preparada para ${unitName}`);
  };

  const handleExport = () => {
    const data = unitStats.map(u => ({
      "Unidade": u.name,
      "Total Abastecimentos": u.total,
      "Preenchidos": u.completed,
      "Pendentes": u.pending,
      "Conformidade (%)": u.percent
    }));

    exportToExcelMultiSheet([{ data, sheetName: "Indicadores Maquinas" }], "Indicadores_Abastecimento_Maquinas");
    toast.success("Indicadores exportados!");
  };

  if (loadingAssignments) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analisando Conformidade de Máquinas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mini Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total MAQ/GER</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.total}</h4>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Building2 size={16} />
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preenchidos</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-emerald-600 leading-none">{stats.completed}</h4>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendentes</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-rose-600 leading-none">{stats.pending}</h4>
            <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle size={16} />
            </div>
          </div>
        </div>
        <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
          <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Conformidade</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-white leading-none">{stats.percent}%</h4>
            {stats.percent < 50 ? <TrendingDown size={24} className="text-indigo-300" /> : <TrendingUp size={24} className="text-indigo-300" />}
          </div>
        </div>
      </div>

      {/* Main Analysis */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Filtrar por unidade..." 
              className="pl-9 h-9 text-[10px] uppercase font-bold rounded-xl border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showPendingOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPendingOnly(!showPendingOnly)}
              className={`h-9 text-[9px] font-black uppercase rounded-xl transition-all ${showPendingOnly ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100' : 'border-slate-200 text-slate-400'}`}
            >
              Exibir Apenas Pendentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-9 text-[9px] font-black uppercase rounded-xl gap-2 border-slate-200"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" /> Exportar
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-4">Unidade / Lotação</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center text-emerald-600">Ok</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center text-rose-600">Pendentes</TableHead>
                <TableHead className="text-[10px] font-black uppercase min-w-[120px]">Progresso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitStats.map(u => (
                <TableRow key={u.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                    {u.name}
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-center text-slate-500">
                    {u.total}
                  </TableCell>
                  <TableCell className="text-[10px] font-black text-center text-emerald-500">
                    {u.completed}
                  </TableCell>
                  <TableCell className="text-[10px] font-black text-center text-rose-500">
                    {u.pending}
                  </TableCell>
                  <TableCell>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${u.percent === 100 ? 'bg-emerald-500' : u.percent > 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                        style={{ width: `${u.percent}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 mt-1 block">{u.percent}% Concluído</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.pending > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleNotify(u.name, u.pending)}
                        className="h-8 gap-2 text-[9px] font-black uppercase text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Mail size={14} /> Notificar
                      </Button>
                    )}
                    {u.pending === 0 && (
                      <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black uppercase h-6">
                        <CheckCircle2 size={12} className="mr-1" /> Completo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {unitStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center opacity-30">
                      <FilterX size={32} className="mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhuma pendência identificada</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
