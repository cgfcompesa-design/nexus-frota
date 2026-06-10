import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FolderOpen, Video, FileText, Wrench, Shield, ArrowUpRight } from "lucide-react";

interface ManutencaoFrotaViewProps {
  onBack: () => void;
}

export default function ManutencaoFrotaView({ onBack }: ManutencaoFrotaViewProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section with back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <Button
            variant="outline"
            onClick={onBack}
            className="rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mb-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <ChevronLeft size={16} /> Voltar ao Drive
          </Button>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-md">
              <Wrench size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Manutenção da Frota
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sessão dedicada a aberturas de chamados, documentações e manuais operacionais.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left column: Abertura de Chamados (Frota Própria) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 px-2.5 py-1 bg-amber-500/10 rounded-full">
              Operações
            </span>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Chamados de Manutenção
            </h2>
          </div>

          <Card className="border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="h-2 bg-amber-500" />
            <CardHeader className="p-6">
              <CardTitle className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-500 shrink-0" />
                Abertura de Chamados Frota Própria
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2 font-medium">
                Assista ao vídeo tutorial de instruções para abertura de chamados e andamento na manutenção dos veículos da frota própria da Compesa.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Utilize o botão abaixo para assistir ao tutorial completo em vídeo de operação:
              </p>

              <div className="flex flex-col gap-3">
                <a
                  href="https://drive.google.com/file/d/1rscfPK_TJOsU32XA3fcogH0dt22ODF6e/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="outline" className="w-full rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 h-11">
                    <Video size={16} className="text-amber-500" /> Vídeo Tutorial
                    <ArrowUpRight size={14} className="opacity-60" />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Arquivos e Documentos Operacionais */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 px-2.5 py-1 bg-indigo-500/10 rounded-full">
              Documentação
            </span>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Arquivos e Documentos Operacionais
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Card 1: POP */}
            <Card className="border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
              <CardHeader className="p-5 pb-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-500 mb-3">
                  <Shield size={20} />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white">
                  Procedimento Operacional Padrão - POP
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                  Diretrizes normativas e procedimentos operacionais padronizados para garantir a conformidade e excelência na gestão.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <a
                  href="https://drive.google.com/drive/folders/18l1zzbV46DzYQ3Gk0oBPn009x6EtcGK_?usp=drive_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-left h-10">
                    <FolderOpen size={14} /> Acessar Pasta POP
                    <ArrowUpRight size={12} className="ml-auto" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Card 2: Manual de Operação e Uso */}
            <Card className="border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
              <CardHeader className="p-5 pb-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-500 mb-3">
                  <FileText size={20} />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white">
                  Manual de Operação e Uso
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                  Manuais de instruções, uso racional dos veículos e conservação de ativos para todos os condutores.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <a
                  href="https://drive.google.com/drive/folders/1YUqEOtWMKl6S5VMX5bjuOygKs31cGx9v?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-left h-10">
                    <FolderOpen size={14} /> Abrir Manuais
                    <ArrowUpRight size={12} className="ml-auto" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
