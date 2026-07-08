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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FilterX,
  BellRing
} from "lucide-react";
import { FuelData } from "@/types";
import { useMachineSupplyAssignments } from "@/hooks/useMachineSupplyAssignments";
import { useContactsData } from "@/hooks/useContactsData";
import { toast } from "sonner";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";

interface MachineSupplyIndicatorsProps {
  fuel: FuelData[];
}

const normalizeTxId = (id: any): string => {
  if (id === undefined || id === null) return "";
  let str = String(id).trim();
  str = str.replace(/^R\$\s*/i, "");
  str = str.replace(/[,.]00$/, "");
  str = str.replace(/[,.]0$/, "");
  str = str.replace(/[.,\s\-_]/g, "");
  return str;
};

const getRecordMonthYear = (f: any): string => {
  if (!f) return "N/A";
  
  // 1. Prioritize f._monthYear if already in MM/YYYY format
  if (f._monthYear) {
    const m = String(f._monthYear).trim();
    if (/^\d{2}\/\d{4}$/.test(m)) {
      return m;
    }
  }

  // 2. Fallback to f.COL_41 or raw f._monthYear, and sanitize dots
  let m = "";
  if (f._monthYear) {
    m = String(f._monthYear).trim();
  } else if (f.COL_41) {
    m = String(f.COL_41).trim();
  }

  if (m && m !== "null" && m !== "undefined" && m !== "N/A") {
    // Sanitize by removing dots (e.g., "mai./26" -> "mai/26")
    const sanitized = m.replace(/\./g, '').toLowerCase();
    
    if (/^\d{2}\/\d{4}$/.test(sanitized)) {
      return sanitized;
    }

    const monthNames: Record<string, string> = { 
      'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06', 
      'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
      'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 
      'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 
      'novembro': '11', 'dezembro': '12'
    };

    const parts = sanitized.split(/[\/\s-]/);
    if (parts.length >= 2) {
      let month = "";
      let year = "";
      
      // Look for a direct match in monthNames
      if (monthNames[parts[0]]) {
        month = monthNames[parts[0]];
        year = parts[1];
      } else if (monthNames[parts[1]]) {
        month = monthNames[parts[1]];
        year = parts[0];
      } else {
        // Fallback startsWith check
        for (const [name, code] of Object.entries(monthNames)) {
          if (parts[0].startsWith(name)) {
            month = code;
            year = parts[1];
            break;
          } else if (parts[1].startsWith(name)) {
            month = code;
            year = parts[0];
            break;
          }
        }
      }

      if (!month) {
        if (/^\d{1,2}$/.test(parts[0])) {
          month = parts[0].padStart(2, '0');
          year = parts[1];
        }
      }
      
      if (month && year) {
        if (year.length === 2) year = '20' + year;
        return `${month}/${year}`;
      }
    }
  }

  // 3. Fallback to extracting from date (_date or COL_4)
  const rawDate = f._date || f.COL_4;
  if (rawDate) {
    if (rawDate instanceof Date) {
      const mm = (rawDate.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = rawDate.getFullYear().toString();
      return `${mm}/${yyyy}`;
    }
    
    // Check if it's an Excel number
    const str = String(rawDate).trim();
    if (/^\d+(\.\d+)?$/.test(str)) {
      const excelNum = parseFloat(str);
      const utcDate = new Date((excelNum - 25569) * 86400 * 1000);
      if (!isNaN(utcDate.getTime())) {
        const mm = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const yyyy = utcDate.getUTCFullYear().toString();
        return `${mm}/${yyyy}`;
      }
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length >= 3) {
      let month = "";
      let year = "";
      if (parts[0].length === 4) {
        month = parts[1];
        year = parts[0];
      } else {
        month = parts[1];
        year = parts[2].split(' ')[0];
      }
      month = month.padStart(2, '0');
      if (year.length === 2) year = '20' + year;
      if (month.length === 2 && year.length === 4) {
        return `${month}/${year}`;
      }
    }
  }

  return "N/A";
};

export const MachineSupplyIndicators = ({ fuel }: MachineSupplyIndicatorsProps) => {
  const { data: assignments = [], isLoading: loadingAssignments } = useMachineSupplyAssignments();
  const { getEmailsByGerencia } = useContactsData();
  const [searchTerm, setSearchTerm] = useState("");
  const [showPendingOnly, setShowPendingOnly] = useState(true);

  // Mês e ano para filtro
  const currentMonthIdx = new Date().getMonth(); // 0-11
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const currentYear = new Date().getFullYear();
  const prevMonthYear = currentMonthIdx === 0 ? currentYear - 1 : currentYear;

  const [selectedMonth, setSelectedMonth] = useState(String(prevMonthIdx + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(prevMonthYear));

  const monthOptions = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const yearOptions = [
    { value: String(currentYear), label: String(currentYear) },
    { value: String(currentYear - 1), label: String(currentYear - 1) },
  ];

  const filteredFuel = useMemo(() => {
    return fuel.filter(f => {
      const my = getRecordMonthYear(f);
      return my === `${selectedMonth}/${selectedYear}`;
    });
  }, [fuel, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const maqFuel = filteredFuel.filter(f => {
      const placa = String(f._placa || f.COL_5 || "").toUpperCase().trim();
      return placa.startsWith("MAQ") || placa.startsWith("GER");
    });

    const total = maqFuel.length;
    const completed = maqFuel.filter(f => {
      const txId = String(f.COL_0 || f._txId || "").trim();
      const normTxId = normalizeTxId(txId);
      return assignments.some(a => normalizeTxId(a.transactionId) === normTxId);
    }).length;

    const pending = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, percent, maqFuel };
  }, [filteredFuel, assignments]);

  const unitStats = useMemo(() => {
    const units: Record<string, { total: number; completed: number; pending: number }> = {};
    
    stats.maqFuel.forEach(f => {
      const unit = String(f.COL_29 || f.UNIDADE || f.GERÊNCIA || f.GERENCIA || f._unit || "N/A").trim();
      if (!units[unit]) units[unit] = { total: 0, completed: 0, pending: 0 };
      
      units[unit].total++;
      const txId = String(f.COL_0 || f._txId || "").trim();
      const normTxId = normalizeTxId(txId);
      if (assignments.some(a => normalizeTxId(a.transactionId) === normTxId)) {
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
    const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const subject = `PENDÊNCIA: Relatório de Abastecimento de Máquinas/Equipamentos - ${selectedMonthLabel}/${selectedYear} - ${unitName}`;
    
    const body = `Prezado Gestor da Unidade (${unitName}),

Identificamos que sua unidade possui ${pendingCount} abastecimento(s) de máquinas ou equipamentos (placas MAQ/GER) do mês de ${selectedMonthLabel} de ${selectedYear} sem o devido preenchimento das informações complementares no sistema Nexus Frota.

O preenchimento do "Destino do Maquinário", "Modelo" e "Tombamento" é obrigatório para fins de conformidade e auditoria de combustíveis.

Instruções para regularização:
1. Acesse o portal: https://nexusfrotabi.vercel.app/
2. Realize o login com suas credenciais;
3. Clique no menu "ABASTECIMENTO MÁQUINAS";
4. Localize e complete as informações das transações pendentes.

Prazo para Regularização: 03 dias úteis.

Ressaltamos que, caso não haja o preenchimento dentro deste prazo, a Coordenação de Gestão de Frotas (CGF) realizará o BLOQUEIO preventivo dos cartões MAQ/GER vinculados à unidade até a devida regularização.

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

  const handleNotifyPending = () => {
    const pendingUnits = unitStats.filter(u => u.pending > 0);
    if (pendingUnits.length === 0) {
      toast.info("Nenhuma pendência identificada para o período selecionado.");
      return;
    }

    toast.info(`Preparando notificações para ${pendingUnits.length} unidade(s)...`);
    
    // In a real email automation we'd batch this, here we can notify the user they should notify individually or we can provide a summary mail
    // But since it's mailto-based, we'll suggest notifying the top ones or handle it unit by unit.
    // For now, let's keep the individual notification as the primary action.
  };

  const handleExport = () => {
    const data = unitStats.map(u => ({
      "Unidade": u.name,
      "Total Abastecimentos": u.total,
      "Preenchidos": u.completed,
      "Pendentes": u.pending,
      "Conformidade (%)": u.percent,
      "Mês": selectedMonth,
      "Ano": selectedYear
    }));

    exportToExcelMultiSheet([{ data, sheetName: "Indicadores Maquinas" }], `Indicadores_Maquinas_${selectedMonth}_${selectedYear}`);
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
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <BellRing size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Compliance de Máquinas</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Justificativas Complementares</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-32 text-[10px] uppercase font-black rounded-xl border-slate-200">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value} className="text-[10px] uppercase font-black">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 w-24 text-[10px] uppercase font-black rounded-xl border-slate-200">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y.value} value={y.value} className="text-[10px] uppercase font-black">{y.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden md:block" />

          <Button
            size="sm"
            onClick={handleExport}
            className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-emerald-100 dark:shadow-none"
          >
            <FileSpreadsheet size={14} /> Exportar Indicadores
          </Button>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total MAQ/GER ({selectedMonth}/{selectedYear})</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.total}</h4>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Building2 size={16} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preenchidos</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-emerald-600 leading-none">{stats.completed}</h4>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendentes</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-rose-600 leading-none">{stats.pending}</h4>
            <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle size={16} />
            </div>
          </div>
        </div>
        <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all hover:scale-[1.02]">
          <p className="text-[9px] font-black text-indigo-100 uppercase tracking-widest mb-1">Conformidade Global</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-white leading-none">{stats.percent}%</h4>
            {stats.percent < 50 ? <TrendingDown size={24} className="text-indigo-200" /> : <TrendingUp size={24} className="text-indigo-200" />}
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
              {showPendingOnly ? "Exibindo Pendentes" : "Exibir Apenas Pendentes"}
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-5 px-6">Unidade / Lotação</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center w-24">Abast.</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center text-emerald-600 w-24">Ok</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center text-rose-600 w-24">Faltando</TableHead>
                <TableHead className="text-[10px] font-black uppercase min-w-[150px]">Conformidade</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right px-6">Notificar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitStats.map(u => (
                <TableRow key={u.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <TableCell className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase px-6">
                    {u.name}
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-center text-slate-500">
                    {u.total}
                  </TableCell>
                  <TableCell className="text-[10px] font-black text-center text-emerald-600 bg-emerald-50/30 dark:bg-emerald-900/10">
                    {u.completed}
                  </TableCell>
                  <TableCell className="text-[10px] font-black text-center text-rose-600 bg-rose-50/30 dark:bg-rose-900/10">
                    {u.pending}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-700 ${u.percent === 100 ? 'bg-emerald-500' : u.percent > 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                          style={{ width: `${u.percent}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-black w-8 text-right ${u.percent === 100 ? 'text-emerald-500' : u.percent > 50 ? 'text-slate-600 font-bold' : 'text-rose-500'}`}>{u.percent}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    {u.pending > 0 ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleNotify(u.name, u.pending)}
                        className="h-8 gap-2 text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-50 border border-slate-100 rounded-xl"
                      >
                        <Mail size={14} /> E-mail Gestor
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black uppercase h-7 px-3 rounded-full">
                        <CheckCircle2 size={12} className="mr-1" /> 100% OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {unitStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center opacity-30 py-8">
                      <FilterX size={48} className="mb-3 text-slate-300" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nenhuma pendência identificada para {monthOptions.find(m => m.value === selectedMonth)?.label}/{selectedYear}</p>
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

