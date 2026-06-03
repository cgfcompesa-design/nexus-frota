import React, { useState, useMemo } from 'react';
import { useControleDocumentosData, ControleDocumento } from '@/hooks/useControleDocumentos';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, ChevronLeft, Download, ExternalLink, Filter, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface ControleDocumentosViewProps {
  onBack: () => void;
}

export default function ControleDocumentosView({ onBack }: ControleDocumentosViewProps) {
  const { data: documents = [], isLoading, error } = useControleDocumentosData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = 
        doc.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.gerencia.toLowerCase().includes(searchTerm.toLowerCase());
      
      const hasAnexo = !!(doc.anexoCrlv && doc.anexoCrlv.trim().length > 5);
      const isOkStatus = doc.statusCrlv.toUpperCase().includes('OK') || doc.statusCrlv.toUpperCase().includes('VIGENTE') || hasAnexo;
      
      let matchesStatus = true;
      if (statusFilter !== "all") {
        if (statusFilter === "OK") {
          matchesStatus = isOkStatus;
        } else if (statusFilter === "PENDENTE") {
          matchesStatus = !isOkStatus;
        } else {
          matchesStatus = doc.statusCrlv.toLowerCase().includes(statusFilter.toLowerCase());
        }
      }
      
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = documents.length;
    const ok = documents.filter(d => {
      const s = d.statusCrlv.toUpperCase();
      const hasAnexo = !!(d.anexoCrlv && d.anexoCrlv.trim().length > 5);
      return s.includes('OK') || s.includes('VIGENTE') || hasAnexo;
    }).length;
    const pendente = total - ok;
    return { total, ok, pendente };
  }, [documents]);

  const getStatusBadge = (status: string, hasAnexo: boolean = false) => {
    let s = (status || "").toUpperCase();
    let displayStatus = status || "SEM CONTROLE";
    if (hasAnexo && !s.includes('OK') && !s.includes('VIGENTE')) {
      s = 'OK';
      displayStatus = 'OK (Anexo)';
    }
    
    if (s.includes('OK') || s.includes('VIGENTE')) {
      return (
        <span 
          title={displayStatus} 
          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-600 font-bold hover:scale-110 transition-transform cursor-help"
        >
          <CheckCircle2 size={13} />
        </span>
      );
    }
    if (s.includes('PENDENTE') || s.includes('VENCIDO') || s.includes('ATRASO')) {
      return (
        <span 
          title={displayStatus} 
          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-500/15 text-rose-600 font-bold hover:scale-110 transition-transform cursor-help"
        >
          <AlertCircle size={13} />
        </span>
      );
    }
    return (
      <span 
        title={displayStatus} 
        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-600 font-bold hover:scale-110 transition-transform cursor-help"
      >
        <Clock size={13} />
      </span>
    );
  };

  const renderLink = (url: string, label: string) => {
    if (!url || url.length < 5) return <span className="text-slate-300">-</span>;
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline font-bold text-[10px]"
      >
        <FileText size={12} />
        {label}
        <ExternalLink size={10} />
      </a>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-full hover:bg-white dark:hover:bg-slate-800"
          >
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
              Regularização - Documentos Obrigatórios
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Controle de validade e anexos de documentos da frota
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-white dark:bg-slate-900 px-6 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
              <p className="text-lg font-black text-indigo-600">{stats.total}</p>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vigentes</p>
              <p className="text-lg font-black text-emerald-500">{stats.ok}</p>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes</p>
              <p className="text-lg font-black text-rose-500">{stats.pendente}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <Input 
                placeholder="BUSCAR POR PLACA OU GERÊNCIA..." 
                className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-4 rounded-2xl">
              <Filter size={16} className="text-slate-400" />
              <select 
                className="bg-transparent border-none w-full h-12 font-bold text-[10px] uppercase tracking-widest focus:ring-0"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">TODOS OS STATUS</option>
                <option value="OK">OK / VIGENTE</option>
                <option value="PENDENTE">PENDENTE / VENCIDO</option>
              </select>
            </div>

            <Button className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest gap-2">
              <Download size={18} /> Exportar Relatório
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 px-8">Ativo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Localização</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Propriedade</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Status CRLV</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-center">Anexos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="h-16 animate-pulse bg-slate-50/50" />
                    </TableRow>
                  ))
                ) : filteredDocs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 font-bold uppercase text-xs">
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocs.map((doc) => (
                    <TableRow key={doc.placa} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 transition-colors">
                      <TableCell className="py-6 px-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800 dark:text-white tracking-tighter">{doc.placa}</span>
                          <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{doc.propriedade}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{doc.gerencia}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{doc.diretoria}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{doc.propriedade}</span>
                      </TableCell>
                      <TableCell className="py-6">
                        {getStatusBadge(doc.statusCrlv, !!(doc.anexoCrlv && doc.anexoCrlv.trim().length > 5))}
                      </TableCell>
                      <TableCell className="py-6 text-right">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {renderLink(doc.anexoCrlv, "CRLV")}
                          {renderLink(doc.anexoCsv, "CSV")}
                          {renderLink(doc.anexoTacografo, "TACO.")}
                          {renderLink(doc.anexoCivCipp, "CIV/CIPP")}
                          {renderLink(doc.anexoCarroceriaInmetro, "INMETRO")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
