import React, { useMemo, useState, useEffect } from "react";
import Papa from "papaparse";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Mail, 
  Users, 
  Search, 
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Building2
} from "lucide-react";
import { FuelData, Asset } from "@/types";
import { toast } from "sonner";
import { useContactsData } from "@/hooks/useContactsData";
import { exportToExcelMultiSheet } from "@/lib/exportToExcel";

interface CoringaCardsTableProps {
  fuel: FuelData[];
  assetsMap: Map<string, Asset>;
}

const CORINGA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTNyx3mdkh9hF027_l61y7O7dwYr_gF5ofFwi0mzRY0eNQuKCu3KR3peiCn7Q_832YRjaxR3rqxQGaB/pub?gid=1764881763&single=true&output=csv";

export const CoringaCardsTable = ({ fuel, assetsMap }: CoringaCardsTableProps) => {
  const [coringaCards, setCoringaCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isGroupedByUnit, setIsGroupedByUnit] = useState(false);
  const { getEmailsByGerencia } = useContactsData();

  useEffect(() => {
    const fetchCoringaCards = async () => {
      try {
        const response = await fetch(CORINGA_CSV_URL);
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: false,
          complete: (results) => {
            const cards = results.data
              .map((row: any) => String(row[0] || "").trim())
              .filter(card => card.length >= 4);
            setCoringaCards(cards);
            setLoading(false);
          },
          error: (err) => {
            console.error("Error parsing Coringa CSV:", err);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Error fetching Coringa CSV:", error);
        setLoading(false);
      }
    };
    fetchCoringaCards();
  }, []);

  const coringaMatches = useMemo(() => {
    if (coringaCards.length === 0) return [];

    const coringaLast4 = new Set(coringaCards.map(c => c.slice(-4)));
    
    return fuel.filter(f => {
      const cardNum = String(f.COL_35 || "").trim();
      if (!cardNum || cardNum.length < 4) return false;
      const last4 = cardNum.slice(-4);
      return coringaLast4.has(last4);
    }).map(f => {
      const placa = String(f._placa || "").toUpperCase().trim();
      const asset = assetsMap.get(placa);
      const cardNum = String(f.COL_35 || "").trim();
      const coringaFull = coringaCards.find(c => c.endsWith(cardNum.slice(-4))) || cardNum;

      return {
        transacao: f.COL_0 || "N/A",
        data: f._date || "N/A",
        placa,
        gerencia: asset?.GERENCIA || asset?.["GERÊNCIA"] || f.COL_29 || "N/A",
        cartaoCoringa: coringaFull,
        motorista: f._driver || "N/A",
        valor: f._total || 0,
        litros: f._litros || 0
      };
    });
  }, [fuel, coringaCards, assetsMap]);

  const filteredMatches = useMemo(() => {
    return coringaMatches.filter(m => 
      m.placa.includes(searchTerm.toUpperCase()) || 
      m.motorista.toUpperCase().includes(searchTerm.toUpperCase()) ||
      m.gerencia.toUpperCase().includes(searchTerm.toUpperCase())
    );
  }, [coringaMatches, searchTerm]);

  const groupedMatches = useMemo(() => {
    if (!isGroupedByUnit) return [];
    const grouped: Record<string, any[]> = {};
    filteredMatches.forEach(m => {
      if (!grouped[m.gerencia]) grouped[m.gerencia] = [];
      grouped[m.gerencia].push(m);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredMatches, isGroupedByUnit]);

  const handleExport = () => {
    const dataExport = filteredMatches.map(m => ({
      "Cartão Coringa": m.cartaoCoringa,
      "Placa": m.placa,
      "Data Transação": m.data,
      "Gerência": m.gerencia,
      "Motorista": m.motorista,
      "Litros": m.litros,
      "Valor Total": m.valor,
      "Cód. Transação": m.transacao
    }));

    exportToExcelMultiSheet([{ 
      data: dataExport, 
      sheetName: "Abastecimento Coringa" 
    }], "Relatorio_Cartoes_Coringa");
    toast.success("Relatório exportado com sucesso!");
  };

  const handleSendEmail = (match?: any) => {
    const targets = match ? [match] : filteredMatches;
    if (targets.length === 0) {
      toast.error("Nenhum registro para notificar.");
      return;
    }

    // If multiple, grouped by unit for better emails
    const byUnit: Record<string, any[]> = {};
    targets.forEach(t => {
      if (!byUnit[t.gerencia]) byUnit[t.gerencia] = [];
      byUnit[t.gerencia].push(t);
    });

    Object.entries(byUnit).forEach(([gerencia, items]) => {
      const emails = getEmailsByGerencia(gerencia);
      const cc = "gadmonitoramento@compesa.com.br; gadabastecimento@compesa.com.br";
      const subject = `Justificativa de Abastecimento com Cartão Coringa - ${gerencia}`;
      
      const tableRows = items.map(i => 
        `- Placa: ${i.placa} | Data: ${i.data} | Cartão: ${i.cartaoCoringa} | Transação: ${i.transacao}`
      ).join("\n");

      const body = `Prezado Gestor da Unidade (${gerencia}),

Identificamos abastecimentos realizados com Cartão Coringa para os veículos sob sua responsabilidade:

${tableRows}

Solicitamos a gentileza de encaminhar a justificativa para o uso do cartão coringa em vez do cartão titular do veículo. 

Ressaltamos a orientação para que o abastecimento seja realizado preferencialmente com o cartão titular. Caso o veículo não possua o cartão ou este esteja danificado, favor providenciar a coleta do novo cartão titular na GAD (Gerência de Apoio ao Desempenho), localizada no prédio sede.

Em caso de dúvidas, permanecemos à disposição.

Atenciosamente,
Nexus BI Frota`;

      const mailto = `mailto:${emails.join(";") || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent(cc)}`;
      window.open(mailto, '_blank');
    });

    toast.success("Processo de notificação iniciado.");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 text-center animate-pulse">
          Sincronizando Base de Cartões Coringa...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-white">Abastecimento com Cartões Coringa</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monitoramento de cartões de emergência vs frota titular</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Buscar placa, motorista ou unidade..." 
              className="pl-9 h-9 text-[10px] uppercase font-bold border-slate-200 dark:border-slate-800 focus:ring-amber-500 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant={isGroupedByUnit ? "default" : "outline"} 
            size="sm"
            onClick={() => setIsGroupedByUnit(!isGroupedByUnit)}
            className={`h-9 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl transition-all ${isGroupedByUnit ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : 'border-slate-200 dark:border-slate-800'}`}
          >
            <Building2 size={14} /> Agrupar Unidade
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            className="h-9 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50"
          >
            <Download size={14} /> Resumo
          </Button>
          <Button 
            size="sm" 
            onClick={() => handleSendEmail()}
            className="h-9 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 dark:shadow-none"
          >
            <Mail size={14} /> Notificar Justificativas
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Cartão Coringa</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Placa</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Data Transação</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Gerência</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Motorista</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isGroupedByUnit ? (
              groupedMatches.map(([unit, items]) => (
                <React.Fragment key={unit}>
                  <TableRow className="bg-amber-50/20 dark:bg-amber-900/5">
                    <TableCell colSpan={6} className="py-2 font-black text-amber-600 text-[10px] uppercase tracking-widest flex items-center gap-2">
                       <Building2 size={12} /> {unit} ({items.length})
                    </TableCell>
                  </TableRow>
                  {items.map((item, idx) => (
                    <CoringaRow key={`${item.transacao}-${idx}`} item={item} onNotify={() => handleSendEmail(item)} />
                  ))}
                </React.Fragment>
              ))
            ) : (
              filteredMatches.map((item, idx) => (
                <CoringaRow key={`${item.transacao}-${idx}`} item={item} onNotify={() => handleSendEmail(item)} />
              ))
            )}
            {filteredMatches.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center opacity-30">
                    <AlertTriangle size={32} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma utilização de cartão coringa identificada</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

interface CoringaRowProps {
  item: any;
  onNotify: () => void;
  key?: React.Key;
}

const CoringaRow = ({ item, onNotify }: CoringaRowProps) => (
  <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
    <TableCell className="text-[11px] font-black font-mono text-amber-600">
      {item.cartaoCoringa}
    </TableCell>
    <TableCell className="text-xs font-black text-slate-700 dark:text-slate-200">
      {item.placa}
    </TableCell>
    <TableCell className="text-[10px] font-bold text-slate-500 uppercase">
      {item.data}
    </TableCell>
    <TableCell className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">
      {item.gerencia}
    </TableCell>
    <TableCell className="text-[10px] font-medium text-slate-500 uppercase truncate max-w-[120px]" title={item.motorista}>
      {item.motorista}
    </TableCell>
    <TableCell className="text-right">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onNotify}
        className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50 rounded-lg"
      >
        <Mail size={14} />
      </Button>
    </TableCell>
  </TableRow>
);
