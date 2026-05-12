import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ClipboardCheck, Fuel, Settings, Activity, Wrench, Gauge, Car, ChevronDown, ChevronRight, GitBranch, FileCheck, ClipboardList, ExternalLink, ArrowLeft, Download, FileSpreadsheet, Network } from "lucide-react";
import Organograma from "@/components/Organograma";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { cn } from "@/lib/utils";

const vehicles = [
  { marca: "FORD", ano: 2014, modelo: "CARGO 2423" },
  { marca: "VOLKSWAGEN", ano: 2018, modelo: "24.280" },
  { marca: "VOLKSWAGEN", ano: 2020, modelo: "19.330" },
  { marca: "FORD", ano: 2018, modelo: "CARGO 816" },
  { marca: "FORD", ano: 2012, modelo: "CARGO 816" },
  { marca: "FORD", ano: 2009, modelo: "F-350" },
  { marca: "IVECO", ano: 2014, modelo: "DAILY" },
  { marca: "MERCEDES BENZ", ano: 2002, modelo: "LS 1938" },
  { marca: "CHEVROLET", ano: 2016, modelo: "S10" },
  { marca: "CHEVROLET", ano: 2017, modelo: "S10" },
  { marca: "FORD", ano: 2017, modelo: "F4000" },
  { marca: "CHEVROLET", ano: 2013, modelo: "S10" },
  { marca: "TOYOTA", ano: 2014, modelo: "HILUX" },
  { marca: "CHEVROLET", ano: 2020, modelo: "MONTANA" },
  { marca: "CHEVROLET", ano: 2017, modelo: "MONTANA" },
  { marca: "FIAT", ano: 2012, modelo: "STRADA" },
  { marca: "VOLKSWAGEN", ano: 2002, modelo: "15.180" },
  { marca: "FORD", ano: 2011, modelo: "F-350" },
  { marca: "VOLKSWAGEN", ano: 2016, modelo: "26.280 6X4" },
  { marca: "FORD", ano: 2009, modelo: "CARGO 1722" },
  { marca: "FORD", ano: 2016, modelo: "CARGO 2629 6X4" },
  { marca: "FORD", ano: 2017, modelo: "CARGO 2629 6X4" },
  { marca: "FORD", ano: 2019, modelo: "CARGO 2629 6X4" },
  { marca: "FORD", ano: 2011, modelo: "CARGO 1722" },
  { marca: "FORD", ano: 2009, modelo: "CARGO 2622" },
  { marca: "MERCEDES BENZ", ano: 1982, modelo: "L 2216" },
  { marca: "FORD", ano: 2014, modelo: "CARGO 2629 6X4" },
  { marca: "FORD", ano: 2016, modelo: "CARGO 2429" },
  { marca: "VOLKSWAGEN", ano: 2014, modelo: "24.280" },
  { marca: "MERCEDES BENZ", ano: 2013, modelo: "ATEGO 2426" },
  { marca: "FORD", ano: 2006, modelo: "F-350" },
  { marca: "FORD", ano: 2019, modelo: "F4000" },
  { marca: "FORD", ano: 2013, modelo: "CARGO 2629 6X4" },
  { marca: "YAMAHA", ano: 2018, modelo: "XTZ" },
  { marca: "FORD", ano: 2016, modelo: "KA" },
  { marca: "FORD", ano: 2017, modelo: "KA" },
  { marca: "FIAT", ano: 2012, modelo: "DOBLO" },
  { marca: "FIAT", ano: 2012, modelo: "UNO" },
  { marca: "VOLKSWAGEN", ano: 2015, modelo: "23.230" },
  { marca: "VOLKSWAGEN", ano: 2018, modelo: "17.280" },
  { marca: "JCB", ano: 2015, modelo: "3C PLUS" },
  { marca: "JCB", ano: 2017, modelo: "3CX" },
  { marca: "JCB", ano: 2019, modelo: "3CX" },
  { marca: "VOLKSWAGEN", ano: 2013, modelo: "8.160" },
  { marca: "VOLKSWAGEN", ano: 2012, modelo: "8.160" },
  { marca: "FORD", ano: 2011, modelo: "CARGO 2622" },
  { marca: "TRUCKVAN", ano: 2021, modelo: "MC 2E" },
  { marca: "FIAT", ano: 2008, modelo: "DUCATO" },
  { marca: "MERCEDES BENZ", ano: 2014, modelo: "SPRINTER" },
  { marca: "FIAT", ano: 2012, modelo: "DUCATO" },
  { marca: "PEUGEOT", ano: 2013, modelo: "BOXER" },
  { marca: "ZOOMLION", ano: 2014, modelo: "QY30V" },
];

const uniqueMarcas = Array.from(new Set(vehicles.map((v) => v.marca)));

const atividadesPorSetor: Record<string, { atividade: string; tipo: string; nivel: string }[]> = {
  "PLANEJAMENTO DE MANUTENÇÃO - PRÓPRIOS": [
    { atividade: "Consulta hierarquia e lotação do ativo no sistema de gestão da manutenção", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Realizar planejamento/preparação de PM (Pedido de Manutenção) no sistema de gestão da manutenção", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Inclusão de orçamento no sistema de gestão atual", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Realiza cotações no sistema de gestão de orçamentos", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Realiza aprovações no sistema de gestão de orçamentos", tipo: "Método", nivel: "Básico" },
    { atividade: "Gerencia o controle de pendências de sua área", tipo: "Método", nivel: "Básico" },
    { atividade: "Gera ordens de plano de manutenção no sistema de gestão da manutenção", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Realiza o P1S, P2S, P1M, P3M, P6M e P1A", tipo: "Técnico", nivel: "Avançado" },
    { atividade: "Realiza solicitação de credenciamento de oficina", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta lista de peças do ativo no manual do fabricante", tipo: "Técnico", nivel: "Intermediário" },
    { atividade: "Realiza criação de Requisição de Material (RM)", tipo: "Método", nivel: "Básico" },
    { atividade: "Solicita o cadastro de material no sistema de gestão da manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta estoque de item no sistema de gestão da manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Consultar plano de ação no Kanban de Atividades", tipo: "Método", nivel: "Básico" },
  ],
  "PROGRAMAÇÃO DE MANUTENÇÃO - PRÓPRIOS": [
    { atividade: "Consulta os planos de manutenção no sistema de gestão da manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Acompanhamento das datas dos planos de manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Programa as ordens dos planos de manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Gera o plano de trabalho semanal da manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza apontamento de ordens de serviço no sistema de gestão da manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Insere saldo para aprovação no sistema ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta o saldo consumido e o previsto do mês no sistema Ticket", tipo: "Método", nivel: "Básico" },
  ],
  "CONTROLE DE MANUTENÇÃO EXECUÇÃO - PRÓPRIOS": [
    { atividade: "Acompanhamento de serviços em oficinas internas e externas", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Conferência de serviços executados conforme orçamento aprovado", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Validação de peças substituídas e serviços realizados", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Controle de prazos e status de manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Realização de checklists periódicos de manutenção", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Inspeção preventiva de itens críticos do veículo", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Identificação e registro de falhas recorrentes", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Apoia na abertura, acompanhamento e encerramento de ordens de serviço (OS)", tipo: "Método", nivel: "Básico" },
    { atividade: "Atualização de informações em sistema de gestão de frota", tipo: "Método", nivel: "Básico" },
    { atividade: "Conferência e análise técnica de orçamentos", tipo: "Técnico", nivel: "Intermediário" },
    { atividade: "Acompanhamento de custos de manutenção por veículo", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Verificação de qualidade e conformidade dos serviços", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Avaliação de segurança veicular pós-manutenção", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Elaboração de relatórios técnicos e monitoramento de indicadores de manutenção", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Acompanhamento da disponibilidade da frota", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Interface técnica com motoristas e operação", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Orientação básica de uso e condução preventiva", tipo: "Técnico", nivel: "Básico" },
    { atividade: "Cumprimento de procedimentos e padrões de manutenção", tipo: "Técnico", nivel: "Básico" },
  ],
  "PLANEJAMENTO DE MANUTENÇÃO - LOCADOS": [
    { atividade: "Consulta hierarquia e lotação do ativo no sistema de gestão da manutenção", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Gerencia o controle de pendências de sua área", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza o controle das solicitações e agendamento junto à locadora", tipo: "Método", nivel: "Básico" },
    { atividade: "Monitora as revisões da frota locada", tipo: "Método", nivel: "Básico" },
    { atividade: "Monitora as pendências de regularização da frota locada (CSV, Tacógrafo, etc)", tipo: "Método", nivel: "Básico" },
    { atividade: "Acompanha as renovações periódicas da frota locada, garantindo que as entregas estejam dentro do padrão solicitado no contrato", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza a planilha de descontos pelos dias inoperantes da frota locada para realização do Boletim de Medição", tipo: "Método", nivel: "Intermediário" },
  ],
  "REGULARIZAÇÃO": [
    { atividade: "Cria títulos de multas, taxas em geral no sistema Alpha", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta sistema do DETRAN acerca das irregularidades", tipo: "Método", nivel: "Básico" },
    { atividade: "Cria processo SEI para notificar gerência acerca de multas", tipo: "Método", nivel: "Avançado" },
    { atividade: "Realiza o download do documento CRLV do veículo no site do SENATRAN", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta os planos de manutenção referentes aos serviços de vistorias e tacógrafo", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Realiza a emissão de boletos de multas para pagamento", tipo: "Método", nivel: "Intermediário" },
    { atividade: "Monitora pendências de multas e taxas periódicas da frota própria e locada", tipo: "Método", nivel: "Básico" },
  ],
  "ABASTECIMENTO": [
    { atividade: "Realiza a transferência de saldo no sistema Ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Insere saldo extra no sistema Ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta saldo de cartão no sistema Ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza correção de odômetro no sistema Ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza cobranças de abastecimento de cartões MAQ", tipo: "Método", nivel: "Básico" },
    { atividade: "Consulta transações negadas no sistema Ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza as cobranças de divergências de autonomia real x autonomia padrão da frota", tipo: "Método", nivel: "Básico" },
  ],
  "POOL": [
    { atividade: "Emite voucher no sistema de Táxi", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza agendamento mediante disponibilidade do pool", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza cadastro de credenciados no sistema Ticket", tipo: "Método", nivel: "Básico" },
    { atividade: "Monitora a logística dos veículos do pool", tipo: "Método", nivel: "Básico" },
    { atividade: "Solicita manutenção para os veículos do pool (locados e próprios)", tipo: "Método", nivel: "Básico" },
  ],
  "TELEMETRIA": [
    { atividade: "Apoia o monitoramento da frota em geral por meio do sistema de telemetria", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza notificações via SEI de alertas e desvios do uso da frota", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza o credenciamento de condutores, tal como ajustes e liberação de tags de identificação", tipo: "Método", nivel: "Básico" },
    { atividade: "Monitora a instalação e desinstalação, tal como as manutenções no módulo de telemetria", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza sob necessidade o bloqueio e desbloqueio do antifurto do veículo", tipo: "Método", nivel: "Básico" },
  ],
  "GERENCIAMENTO DE SISTEMA DE FROTA": [
    { atividade: "Realiza a análise de desvios de parâmetros de uso da frota", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza o desenvolvimento e monitoramento de indicadores da frota", tipo: "Método", nivel: "Básico" },
    { atividade: "Apoia na elaboração de relatórios e dashboards de uso da frota", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza destraves de sistemas de abastecimento e manutenção", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza o cadastro e atualização dos ativos da frota", tipo: "Método", nivel: "Básico" },
    { atividade: "Realiza o acompanhamento das emissões das Notas Fiscais do sistema", tipo: "Método", nivel: "Básico" },
  ],
};

function DistribuicaoAtividades() {
  const [openSetores, setOpenSetores] = useState<Record<string, boolean>>({});

  const toggleSetor = (setor: string) => {
    setOpenSetores(prev => ({ ...prev, [setor]: !prev[setor] }));
  };

  const getNivelColor = (nivel: string) => {
    switch (nivel) {
      case "Básico":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300";
      case "Intermediário":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300";
      case "Avançado":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "Método":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "Técnico":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSetorIcon = (setor: string) => {
    if (setor.includes("PLANEJAMENTO")) return <FileCheck className="h-5 w-5" />;
    if (setor.includes("PROGRAMAÇÃO")) return <ClipboardList className="h-5 w-5" />;
    if (setor.includes("REGULARIZAÇÃO")) return <FileCheck className="h-5 w-5" />;
    if (setor.includes("ABASTECIMENTO")) return <Fuel className="h-5 w-5" />;
    if (setor.includes("POOL")) return <Car className="h-5 w-5" />;
    if (setor.includes("TELEMETRIA")) return <Gauge className="h-5 w-5" />;
    if (setor.includes("GERENCIAMENTO")) return <Settings className="h-5 w-5" />;
    if (setor.includes("CONTROLE") || setor.includes("EXECUÇÃO")) return <Wrench className="h-5 w-5" />;
    return <Activity className="h-5 w-5" />;
  };

  const getSetorColor = (setor: string) => {
    if (setor.includes("PLANEJAMENTO") && setor.includes("PRÓPRIOS")) return "border-l-blue-500";
    if (setor.includes("PROGRAMAÇÃO")) return "border-l-cyan-500";
    if (setor.includes("REGULARIZAÇÃO")) return "border-l-amber-500";
    if (setor.includes("ABASTECIMENTO")) return "border-l-green-500";
    if (setor.includes("POOL")) return "border-l-indigo-500";
    if (setor.includes("TELEMETRIA")) return "border-l-purple-500";
    if (setor.includes("GERENCIAMENTO")) return "border-l-slate-500";
    if (setor.includes("LOCADOS")) return "border-l-orange-500";
    if (setor.includes("CONTROLE") || setor.includes("EXECUÇÃO")) return "border-l-red-500";
    return "border-l-primary";
  };

  const totalAtividades = Object.values(atividadesPorSetor).flat().length;
  const atividadesMetodo = Object.values(atividadesPorSetor).flat().filter(a => a.tipo === "Método").length;
  const atividadesTecnico = Object.values(atividadesPorSetor).flat().filter(a => a.tipo === "Técnico").length;
  const nivelBasico = Object.values(atividadesPorSetor).flat().filter(a => a.nivel === "Básico").length;
  const nivelIntermediario = Object.values(atividadesPorSetor).flat().filter(a => a.nivel === "Intermediário").length;
  const nivelAvancado = Object.values(atividadesPorSetor).flat().filter(a => a.nivel === "Avançado").length;

  const exportToExcel = () => {
    const data: { Setor: string; Atividade: string; Tipo: string; Nível: string }[] = [];
    Object.entries(atividadesPorSetor).forEach(([setor, atividades]) => {
      atividades.forEach(atividade => {
        data.push({
          Setor: setor,
          Atividade: atividade.atividade,
          Tipo: atividade.tipo,
          Nível: atividade.nivel
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Distribuição de Atividades");
    
    ws['!cols'] = [
      { wch: 45 }, 
      { wch: 80 }, 
      { wch: 12 }, 
      { wch: 15 }, 
    ];
    
    XLSX.writeFile(wb, "distribuicao_atividades.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    
    doc.setFontSize(16);
    doc.text("Distribuição de Atividades por Setor", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Total: ${totalAtividades} atividades | Método: ${atividadesMetodo} | Técnico: ${atividadesTecnico}`, 14, 22);
    doc.text(`Básico: ${nivelBasico} | Intermediário: ${nivelIntermediario} | Avançado: ${nivelAvancado}`, 14, 27);
    
    let yPosition = 35;
    const pageHeight = 190;
    const lineHeight = 5;
    
    Object.entries(atividadesPorSetor).forEach(([setor, atividades]) => {
      if (yPosition + (atividades.length * lineHeight) + 15 > pageHeight) {
        doc.addPage();
        yPosition = 15;
      }
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(setor, 14, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      
      atividades.forEach((atividade) => {
        if (yPosition > pageHeight) {
          doc.addPage();
          yPosition = 15;
        }
        
        const atividadeText = atividade.atividade.length > 90 
          ? atividade.atividade.substring(0, 90) + "..." 
          : atividade.atividade;
        
        doc.text(`• ${atividadeText}`, 16, yPosition);
        doc.text(`[${atividade.tipo}]`, 230, yPosition);
        doc.text(`[${atividade.nivel}]`, 255, yPosition);
        yPosition += lineHeight;
      });
      
      yPosition += 4;
    });
    
    doc.save("distribuicao_atividades.pdf");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-500" />
                Distribuição de Atividades
              </CardTitle>
              <CardDescription>
                Resumo das atividades por setor, classificadas por tipo (Método/Técnico) e nível de complexidade
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-2">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">{totalAtividades}</div>
              <div className="text-xs text-muted-foreground">Total de Atividades</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{atividadesMetodo}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Método</div>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{atividadesTecnico}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Técnico</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center border-t-2 border-green-500">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{nivelBasico}</div>
              <div className="text-xs text-green-600 dark:text-green-400">Nível Básico</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center border-t-2 border-amber-500">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{nivelIntermediario}</div>
              <div className="text-xs text-amber-600 dark:text-amber-400">Nível Intermediário</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center border-t-2 border-red-500">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{nivelAvancado}</div>
              <div className="text-xs text-red-600 dark:text-red-400">Nível Avançado</div>
            </div>
            <div className="bg-slate-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{Object.keys(atividadesPorSetor).length}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Setores</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {Object.entries(atividadesPorSetor).map(([setor, atividades]) => (
          <Collapsible key={setor} open={openSetores[setor]} onOpenChange={() => toggleSetor(setor)}>
            <Card className={cn("border-l-4", getSetorColor(setor))}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {getSetorIcon(setor)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{setor}</CardTitle>
                        <CardDescription className="text-sm">
                          {atividades.length} atividades • 
                          {atividades.filter(a => a.tipo === "Método").length} Método • 
                          {atividades.filter(a => a.tipo === "Técnico").length} Técnico
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden sm:flex gap-1">
                        {atividades.filter(a => a.nivel === "Básico").length > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            {atividades.filter(a => a.nivel === "Básico").length} Básico
                          </span>
                        )}
                        {atividades.filter(a => a.nivel === "Intermediário").length > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {atividades.filter(a => a.nivel === "Intermediário").length} Interm.
                          </span>
                        )}
                        {atividades.filter(a => a.nivel === "Avançado").length > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {atividades.filter(a => a.nivel === "Avançado").length} Avançado
                          </span>
                        )}
                      </div>
                      {openSetores[setor] ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[60%] font-black uppercase text-[10px]">Atividade</TableHead>
                          <TableHead className="w-[20%] text-center font-black uppercase text-[10px]">Tipo</TableHead>
                          <TableHead className="w-[20%] text-center font-black uppercase text-[10px]">Nível</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {atividades.map((atividade, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell className="text-xs font-medium">{atividade.atividade}</TableCell>
                            <TableCell className="text-center">
                              <span className={cn(
                                "inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                                getTipoColor(atividade.tipo)
                              )}>
                                {atividade.tipo}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={cn(
                                "inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border",
                                getNivelColor(atividade.nivel)
                              )}>
                                {atividade.nivel}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function PropriosMenu({ vehicles, uniqueMarcas }: { vehicles: { marca: string; ano: number; modelo: string }[]; uniqueMarcas: string[] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    fluxo: false,
    analise: false,
    checklist: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-4">
      <Collapsible open={openSections.fluxo} onOpenChange={() => toggleSection('fluxo')}>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                    <GitBranch className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-black uppercase tracking-tight">Fluxo de Processos</CardTitle>
                    <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Planejamento e Programação de OS
                    </CardDescription>
                  </div>
                </div>
                {openSections.fluxo ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              <div className="grid gap-6">
                <Card className="border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Fluxograma: Planejamento de OS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Activity size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">SLA Geral Planejamento</span>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-white/20 px-3 py-1 rounded-full">Máx. 24h</span>
                    </div>
                    {/* Simplified process visual */}
                    <div className="space-y-3">
                       {[
                         { id: "I", title: "Abertura PM", role: "Gestor", time: "Imediato", color: "blue" },
                         { id: "II", title: "Classificação Ativo", role: "PPCM", time: "2h", color: "amber" },
                         { id: "III", title: "Verificações / Filtros", role: "PPCM", time: "4h", color: "purple" },
                         { id: "IV", title: "Orçamento Prévio", role: "Oficina", time: "8h", color: "green" },
                         { id: "V", title: "Geração PDF / Envio", role: "PPCM", time: "4h", color: "cyan" }
                       ].map((step, idx) => (
                         <div key={idx} className="flex items-center gap-4 group">
                           <div className={`w-8 h-8 rounded-full bg-${step.color}-500 text-white flex items-center justify-center font-black text-xs shrink-0`}>
                             {step.id}
                           </div>
                           <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex justify-between items-center group-hover:border-indigo-500 transition-colors">
                             <div>
                               <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{step.title}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{step.role}</p>
                             </div>
                             <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{step.time}</span>
                           </div>
                         </div>
                       ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200 dark:border-slate-800 overflow-hidden" onClick={() => window.location.href = '/analise-modo-falha'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base font-black uppercase tracking-tight">Análise de Modo e Falha</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">Metodologia A3 / 5W2H</CardDescription>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10 shadow-sm">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-xl text-white">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-black uppercase tracking-tight">Checklist Manutenção (CHM)</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestão de Itens por Ativo</CardDescription>
              </div>
            </div>
            <Link to="/checklist-manutencao">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                Gerenciar
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function GerenciamentoAtividades({ onBack }: { onBack: () => void }) {
  const cgfLogo = "/src/assets/images/regenerated_image_1778593500523.png";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack} 
            className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-900/20 rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest pl-2 pr-6 h-12 transition-all group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Voltar ao Início</span>
          </Button>
          <img 
            src={cgfLogo} 
            alt="Nexus BI Logo" 
            className="h-10 w-auto drop-shadow-sm" 
            onError={(e) => {
              e.currentTarget.src = "https://placehold.co/100x40/6366f1/ffffff?text=NEXUS+BI";
            }}
          />
          <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="hidden md:block">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none italic">Gerenciamento de Atividades</h1>
            <p className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mt-1">SLA, Distribuição e Fluxos Nexus BI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sistema Operacional Online</span>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8 max-w-7xl">
        <Tabs defaultValue="ativos" className="space-y-8">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl h-12 shadow-sm flex overflow-x-auto gap-1">
            {['ativos', 'abastecimento', 'manutencao', 'regularizacao', 'telemetria', 'pool', 'distribuicao'].map((tab) => (
              <TabsTrigger 
                key={tab}
                value={tab} 
                className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all px-6"
              >
                {tab === 'distribuicao' ? 'Distribuição' : tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="ativos" className="outline-none">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
              <CardHeader className="p-8 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><Car className="h-6 w-6 text-indigo-600" /></div>
                  Gestão de Ativos
                </CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Visão Geral de Frota e Equipamentos</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid md:grid-cols-3 gap-8">
                   <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-3">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto"><ClipboardCheck size={24} /></div>
                      <h3 className="font-black uppercase text-xs text-slate-800 dark:text-white">Inventário BI</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Controle detalhado de cada ativo, marca e modelo no sistema compesa.</p>
                   </div>
                   {/* More placeholder cards */}
                   <div className="md:col-span-2 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
                      <div className="max-w-xs space-y-4">
                         <div className="text-slate-300 dark:text-slate-700 font-black text-6xl italic">PRO</div>
                         <h4 className="text-sm font-black uppercase text-slate-600 dark:text-slate-400">Integração em Andamento</h4>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aguardando sincronização de parâmetros técnicos do Alpha.</p>
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="abastecimento">
             <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
               {/* Simplified content */}
               <CardHeader className="p-8">
                  <CardTitle className="flex items-center gap-3 text-xl font-black uppercase text-slate-800 dark:text-white">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><Fuel className="h-6 w-6 text-emerald-600" /></div>
                    Controle de Abastecimento
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 text-center border-t border-slate-100 dark:border-slate-800">
                  <p className="text-slate-400 font-black uppercase text-xs italic">Módulo sincronizado através do dashboard de Supply Performance.</p>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="manutencao" className="space-y-6 outline-none">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
              <CardHeader className="p-8 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><Wrench className="h-6 w-6 text-rose-600" /></div>
                  Gestão de Manutenção
                </CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">SLA e Fluxo de Ordens de Serviço</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <Tabs defaultValue="proprios" className="space-y-8">
                  <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-10 rounded-xl">
                    <TabsTrigger value="proprios" className="text-[10px] font-black uppercase tracking-widest px-8">Próprios</TabsTrigger>
                    <TabsTrigger value="locados" className="text-[10px] font-black uppercase tracking-widest px-8">Locados</TabsTrigger>
                  </TabsList>

                  <TabsContent value="proprios" className="outline-none">
                    <PropriosMenu vehicles={vehicles} uniqueMarcas={uniqueMarcas} />
                  </TabsContent>

                  <TabsContent value="locados">
                     <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50 dark:bg-slate-900/30">
                        <h3 className="text-lg font-black uppercase text-slate-400 mb-2">Painel de Manutenção Locados</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clique no dashboard de Locados na tela principal para gerir este módulo.</p>
                     </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribuicao" className="outline-none">
            <Tabs defaultValue="detalhada" className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-9">
                  <TabsTrigger value="detalhada" className="text-[9px] font-black uppercase tracking-widest px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">Distribuição de Atividades</TabsTrigger>
                  <TabsTrigger value="organograma" className="text-[9px] font-black uppercase tracking-widest px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">Organograma</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="detalhada" className="outline-none">
                <DistribuicaoAtividades />
              </TabsContent>

              <TabsContent value="organograma" className="outline-none">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8">
                   <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                     <Network className="h-6 w-6 text-indigo-500" />
                     Estrutura Organizacional Nexus BI
                   </h2>
                   <Organograma />
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          {/* Other tabs simplified or placeholder */}
          {['regularizacao', 'telemetria', 'pool'].map(tab => (
            <TabsContent key={tab} value={tab} className="outline-none">
               <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-12 text-center">
                  <div className="max-w-xs mx-auto space-y-4">
                     <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                        <Activity size={32} />
                     </div>
                     <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white">Módulo em Mapeamento</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        Este módulo de {tab} está em fase de estruturação técnica para exibição.
                     </p>
                  </div>
               </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
