import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Wrench, FileCheck, Radio, ArrowUpRight, Share2, Calculator, ChevronLeft } from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import ExtraCreditEstimation from "./ExtraCreditEstimation";
import ControleDocumentosView from "./ControleDocumentosView";
import FuelStationsView from "./FuelStationsView";
import ProcedimentoLigarVeiculoView from "./ProcedimentoLigarVeiculoView";

const sections = [
  {
    id: "postos",
    title: "Relação de Postos",
    description: "Consulte e localize postos de combustível no mapa",
    icon: MapPin,
    available: true,
  },
  {
    id: "manutencao",
    title: "Manutenção da Frota",
    description: "Informações sobre manutenção e cuidados com os veículos",
    icon: Wrench,
    href: "#",
    available: false,
  },
  {
    id: "regularizacao",
    title: "Regularização - Documentos Obrigatórios",
    description: "Documentação necessária e processos de regularização",
    icon: FileCheck,
    href: "#regularizacao",
    available: true,
  },
  {
    id: "telemetria",
    title: "Telemetria - Procedimento para Ligar o Veículo",
    description: "Instruções para ativação e uso do sistema de telemetria",
    icon: Radio,
    available: true,
  },
  {
    id: "estimativa-credito",
    title: "Estimativa Crédito Extra",
    description: "Cálculo de crédito adicional baseado em deslocamento e autonomia",
    icon: Calculator,
    href: "#estimativa",
    available: true,
  },
];

export default function DrivePage({ onBack }: { onBack?: () => void }) {
  const [activeSubview, setActiveSubview] = useState<string | null>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Drive de Informações - Nexus BI";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  if (activeSubview === "estimativa-credito") {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="mx-auto max-w-7xl">
          <ExtraCreditEstimation onBack={() => setActiveSubview(null)} />
        </div>
      </main>
    );
  }

  if (activeSubview === "regularizacao") {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="mx-auto max-w-7xl">
          <ControleDocumentosView onBack={() => setActiveSubview(null)} />
        </div>
      </main>
    );
  }

  if (activeSubview === "postos") {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="mx-auto max-w-7xl">
          <FuelStationsView onBack={() => setActiveSubview(null)} />
        </div>
      </main>
    );
  }

  if (activeSubview === "telemetria") {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="mx-auto max-w-7xl">
          <ProcedimentoLigarVeiculoView onBack={() => setActiveSubview(null)} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
        
        <div className="relative mx-auto max-w-6xl px-4 py-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-200 dark:shadow-none">
                <Share2 className="text-white h-8 w-8" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-1">
                  Portal de Acesso Rápido
                </div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
                  Drive de Informações - Nexus BI
                </h1>
              </div>
            </div>
            
            <div className="absolute top-8 right-8">
               <Button 
                variant="outline" 
                onClick={onBack || (() => window.location.href = window.location.origin)}
                className="rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white/50 backdrop-blur-md border-slate-200"
              >
                <ChevronLeft size={16} /> Voltar ao Sistema
              </Button>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-2xl">
              Acesse rapidamente materiais, procedimentos e consultas essenciais da Nexus BI Frota através deste portal centralizado.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Atalhos Disponíveis</h2>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
              Selecione uma categoria para abrir o conteúdo correspondente.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;

            const handleSectionClick = (e: React.MouseEvent) => {
              if (!section.available) return;
              const subviews = ["estimativa-credito", "regularizacao", "postos", "telemetria"];
              if (subviews.includes(section.id)) {
                e.preventDefault();
                setActiveSubview(section.id);
              }
            };

            const CardInner = (
              <Card
                onClick={handleSectionClick}
                className={cn(
                  "group relative overflow-hidden transition-all duration-300 border-slate-200 dark:border-slate-800",
                  section.available
                    ? "hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer bg-white dark:bg-slate-900"
                    : "opacity-60 bg-slate-100 dark:bg-slate-900/50 cursor-not-allowed"
                )}
              >
                <CardHeader className="p-6">
                  <div className="flex items-start gap-5">
                    <div className={cn(
                      "rounded-2xl p-4 transition-colors",
                      section.available 
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white" 
                        : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                    )}>
                      <Icon className="h-7 w-7" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">
                          {section.title}
                        </CardTitle>
                        {section.available ? (
                          <ArrowUpRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-indigo-500 shrink-0" />
                        ) : (
                          <span className="shrink-0 rounded-lg bg-slate-200 dark:bg-slate-800 px-2 py-1 text-[8px] font-black uppercase text-slate-500">
                            Em breve
                          </span>
                        )}
                      </div>

                      <CardDescription className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                        {section.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );

            if (section.available && !["estimativa-credito", "regularizacao", "postos", "telemetria"].includes(section.id)) {
              return (
                <Link
                  key={section.title}
                  to={section.href}
                  className="block no-underline"
                >
                  {CardInner}
                </Link>
              );
            }

            return (
              <div key={section.title}>
                {CardInner}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-8 bg-white dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            Copyright © {new Date().getFullYear()} Nexus BI Frota. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}

