import React, { useState, useMemo, useEffect } from 'react';
import { useControleDocumentosData, ControleDocumento } from '@/hooks/useControleDocumentos';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, ChevronLeft, Download, ExternalLink, Filter, CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ControleDocumentosViewProps {
  onBack: () => void;
}

export default function ControleDocumentosView({ onBack }: ControleDocumentosViewProps) {
  const { data: documents = [], isLoading, error } = useControleDocumentosData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [propriedadeFilter, setPropriedadeFilter] = useState("all");
  const [crlvYears, setCrlvYears] = useState<Record<string, string>>({});
  const [isRefreshingYears, setIsRefreshingYears] = useState(false);

  const fetchYearsMap = () => {
    setIsRefreshingYears(true);
    fetch("/api/crlv-years")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.years) {
          setCrlvYears(data.years);
        }
      })
      .catch(err => console.error("Error fetching CRLV years:", err))
      .finally(() => setIsRefreshingYears(false));
  };

  useEffect(() => {
    fetchYearsMap();
  }, []);

  const propriedades = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((doc) => {
      if (doc.propriedade) set.add(doc.propriedade.toUpperCase().trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const getDocYear = (doc: ControleDocumento) => {
    if (!doc.anexoCrlv || doc.anexoCrlv.trim().length <= 5) return null;
    if (doc.statusCrlv && doc.statusCrlv.trim().length > 0) {
      return doc.statusCrlv.trim();
    }
    const plate = doc.placa.trim().toUpperCase();
    if (crlvYears[plate]) return crlvYears[plate];
    
    // Prediction rules if cache isn't fully loaded yet
    const prop = String(doc.propriedade || "").trim().toUpperCase();
    if (prop.includes("COMPESA") || prop.includes("CS BRASIL")) {
      return "2026";
    }
    return "2025";
  };

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = 
        doc.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.gerencia.toLowerCase().includes(searchTerm.toLowerCase());
      
      const hasAnexo = !!(doc.anexoCrlv && doc.anexoCrlv.trim().length > 5);
      const docYear = getDocYear(doc);
      
      // LOGIC: OK/VIGENT if an attachment exists, PENDING/EXPIRED if no file is found.
      const isOkStatus = hasAnexo;
      
      let matchesStatus = true;
      if (statusFilter !== "all") {
        if (statusFilter === "OK") {
          matchesStatus = isOkStatus;
        } else if (statusFilter === "PENDENTE") {
          matchesStatus = !isOkStatus;
        }
      }

      let matchesYear = true;
      if (yearFilter !== "all") {
        if (yearFilter === "2026") {
          matchesYear = docYear === "2026";
        } else if (yearFilter === "2025") {
          matchesYear = docYear === "2025";
        } else if (yearFilter === "PENDENTE") {
          matchesYear = !hasAnexo;
        }
      }

      let matchesPropriedade = true;
      if (propriedadeFilter !== "all") {
        matchesPropriedade = String(doc.propriedade || "").toUpperCase().trim() === propriedadeFilter;
      }
      
      return matchesSearch && matchesStatus && matchesYear && matchesPropriedade;
    });
  }, [documents, searchTerm, statusFilter, yearFilter, crlvYears, propriedadeFilter]);

  const stats = useMemo(() => {
    const total = documents.length;
    // Lógica PENDENTE apenas para aqueles que não possuem nenhum arquivo encontrado
    const ok = documents.filter(d => !!(d.anexoCrlv && d.anexoCrlv.trim().length > 5)).length;
    const pendente = total - ok;
    return { total, ok, pendente };
  }, [documents]);

  const getStatusBadge = (doc: ControleDocumento, year: string | null) => {
    const hasAnexo = !!(doc.anexoCrlv && doc.anexoCrlv.trim().length > 5);
    
    if (!hasAnexo) {
      return (
        <span 
          title="PENDENTE (Nenhum arquivo encontrado)" 
          className="inline-flex items-center justify-center p-1 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 w-6 h-6"
        >
          <AlertCircle size={12} className="shrink-0" />
        </span>
      );
    }
    
    const displayYear = year || "2025";
    const is2026 = displayYear === "2026";
    
    return (
      <span 
        title={`OK / VIGENTE (${displayYear})`} 
        className={cn(
          "inline-flex items-center justify-center p-1 rounded-full border w-6 h-6",
          is2026 
            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50"
            : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/50"
        )}
      >
        <CheckCircle2 size={12} className="shrink-0" />
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-full hover:bg-white dark:hover:bg-slate-800 shrink-0"
          >
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
              Regularização - Documentos Obrigatórios
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">
              Controle de validade e anexos de documentos da frota
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchYearsMap} 
            disabled={isRefreshingYears}
            className="rounded-xl h-12 sm:h-10 border-slate-200 text-slate-700 dark:border-slate-800 text-xs font-bold w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isRefreshingYears && "animate-spin")} />
            Sincronizar Anos
          </Button>

          <div className="bg-white dark:bg-slate-900 px-6 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-around gap-4 md:gap-6 h-12 w-full sm:w-auto">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
              <p className="text-sm md:text-lg font-black text-indigo-600">{stats.total}</p>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vigentes</p>
              <p className="text-sm md:text-lg font-black text-emerald-500">{stats.ok}</p>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes</p>
              <p className="text-sm md:text-lg font-black text-rose-500">{stats.pendente}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-4 sm:p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <div className="relative group sm:col-span-2 md:col-span-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <Input 
                placeholder="BUSCAR PLACA / GERÊNCIA..." 
                className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-4 rounded-2xl">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <select 
                className="bg-transparent border-none w-full h-12 font-bold text-[10px] uppercase tracking-widest focus:ring-0 text-slate-700 dark:bg-slate-50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">TODOS OS STATUS</option>
                <option value="OK">OK / VIGENTE (Com Anexo)</option>
                <option value="PENDENTE">PENDENTE / VENCIDO (Sem Anexo)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-4 rounded-2xl">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <select 
                className="bg-transparent border-none w-full h-12 font-bold text-[10px] uppercase tracking-widest focus:ring-0 text-slate-700 dark:bg-slate-50"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="all">TODOS OS ANOS (2025/2026)</option>
                <option value="2026">FILTRAR APENAS 2026</option>
                <option value="2025">FILTRAR APENAS 2025</option>
                <option value="PENDENTE">FILTRAR APENAS PENDENTES</option>
              </select>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-4 rounded-2xl">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <select 
                className="bg-transparent border-none w-full h-12 font-bold text-[10px] uppercase tracking-widest focus:ring-0 text-slate-700 dark:bg-slate-50"
                value={propriedadeFilter}
                onChange={(e) => setPropriedadeFilter(e.target.value)}
              >
                <option value="all">TODAS PROPRIEDADES</option>
                {propriedades.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <Button className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest gap-2 w-full sm:col-span-2 md:col-span-1">
              <Download size={18} /> Exportar Relatório
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
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
                        {getStatusBadge(doc, getDocYear(doc))}
                      </TableCell>
                      <TableCell className="py-6 text-right">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                          {renderLink(doc.anexoCrlv, "CRLV")}
                          {renderLink(doc.anexoCsv, "CSV")}
                          {renderLink(doc.anexoTacografo, "TACO.")}
                          {renderLink(doc.anexoCivCipp, "CIV/CIPP")}
                          {renderLink(doc.anexoCarroceriaInmetro, "INMETRO")}
                          {renderLink(doc.anexoAet, "AET")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-5 animate-pulse space-y-4">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                  <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                </div>
              ))
            ) : filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold uppercase text-xs">
                Nenhum documento encontrado.
              </div>
            ) : (
              filteredDocs.map((doc, idx) => {
                const year = getDocYear(doc);
                const hasCrlv = !!(doc.anexoCrlv && doc.anexoCrlv.trim().length > 5);
                const renderMobileLink = (url: string | undefined, label: string) => {
                  const hasDoc = !!(url && url.trim().length > 5);
                  if (!hasDoc) {
                    return (
                      <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-400 font-bold text-[9px] uppercase border border-slate-100/30 dark:border-slate-800/30">
                        <AlertCircle size={10} className="text-slate-300 shrink-0" />
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  }
                  return (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-[9px] uppercase border border-indigo-100/30 dark:border-indigo-900/30 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <FileText size={10} className="shrink-0" />
                        {label}
                      </span>
                      <ExternalLink size={8} className="shrink-0 text-indigo-400" />
                    </a>
                  );
                };

                return (
                  <div key={`${doc.placa}-${idx}`} className="p-5 space-y-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Header: Placa & Status Indicator */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Veículo</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white tracking-tighter uppercase">
                          {doc.placa}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Status CRLV</span>
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(doc, year)}
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-tight",
                            hasCrlv 
                              ? (year === "2026" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400") 
                              : "text-rose-600 dark:text-rose-400"
                          )}>
                            {hasCrlv ? `OK (${year})` : "Pendente"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Localização & Propriedade */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Localização</span>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase block tracking-tight">
                          {doc.gerencia}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                          {doc.diretoria}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Propriedade</span>
                        <Badge variant="outline" className={cn(
                          "border-none font-black text-[10px] uppercase tracking-wide px-2.5 py-1 block w-fit",
                          doc.propriedade?.toUpperCase().includes("COMPESA")
                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                        )}>
                          {doc.propriedade || "—"}
                        </Badge>
                      </div>
                    </div>

                    {/* Anexos Grid */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Documentos Obrigatórios</span>
                      <div className="grid grid-cols-2 gap-2">
                        {renderMobileLink(doc.anexoCrlv, "CRLV")}
                        {renderMobileLink(doc.anexoCsv, "CSV")}
                        {renderMobileLink(doc.anexoTacografo, "Tacógrafo")}
                        {renderMobileLink(doc.anexoCivCipp, "CIV/CIPP")}
                        {renderMobileLink(doc.anexoCarroceriaInmetro, "Inmetro")}
                        {renderMobileLink(doc.anexoAet, "AET")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
