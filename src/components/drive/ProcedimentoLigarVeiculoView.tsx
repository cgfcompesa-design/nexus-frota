import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, Video, Play, FolderOpen } from "lucide-react";

const DRIVE_URL =
  "https://drive.google.com/drive/folders/1xEdR9G8mC8f8Mvwoo2ilRTuF5JYZjuNO?usp=drive_link";

const VIDEOS = [
  {
    title: "Vídeo de Orientação 1",
    url: "https://drive.google.com/file/d/1Zw7lx7do8U_nKGIBuhDnA6mrBEMhZYVS/view?usp=drive_link",
    embedUrl: "https://drive.google.com/file/d/1Zw7lx7do8U_nKGIBuhDnA6mrBEMhZYVS/preview",
    description: "Procedimento inicial para ativação do sistema de telemetria no veículo.",
  },
  {
    title: "Vídeo de Orientação 2",
    url: "https://drive.google.com/file/d/11OwERkY3Mj2LOe2bTWAss9LOuOGxI50D/view?usp=drive_link",
    embedUrl: "https://drive.google.com/file/d/11OwERkY3Mj2LOe2bTWAss9LOuOGxI50D/preview",
    description: "Orientações complementares sobre o uso correto do sistema embarcado.",
  },
];

interface ProcedimentoLigarVeiculoViewProps {
  onBack: () => void;
}

export default function ProcedimentoLigarVeiculoView({ onBack }: ProcedimentoLigarVeiculoViewProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Procedimento para Ligar o Veículo - Nexus BI";
    return () => {
      document.title = prevTitle;
    };
  }, []);

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
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
              Procedimento para Ligar o Veículo
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Telemetria: Instruções detalhadas para ativação e uso correto
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-2.5 ring-1 ring-slate-100 dark:ring-slate-800">
            <Video className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Vídeos de Orientações</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Assista aos vídeos com orientações sobre o procedimento correto.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {VIDEOS.map((video, idx) => (
            <Card key={idx} className="overflow-hidden border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem]">
              <div className="relative bg-slate-100 dark:bg-slate-800">
                <iframe
                  src={video.embedUrl}
                  className="w-full aspect-video"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={video.title}
                  loading="lazy"
                />
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Play className="h-4 w-4 text-indigo-600" />
                    {video.title}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed">{video.description}</p>
                </div>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 bg-slate-50 border-none shadow-inner">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Google Drive
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-indigo-600 dark:bg-indigo-900 rounded-[2.5rem] overflow-hidden text-white">
        <CardHeader className="p-8">
          <div className="flex items-start gap-6">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <FolderOpen className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 space-y-2">
              <CardTitle className="text-xl font-black uppercase tracking-tight">
                Material de Referência – Telemetria
              </CardTitle>
              <CardDescription className="text-white/70 text-sm font-medium leading-relaxed">
                Acesse a pasta no Google Drive com todos os documentos,
                imagens e vídeos sobre o procedimento correto para ligar o
                veículo com telemetria.
              </CardDescription>
              <div className="pt-4">
                <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-white text-indigo-600 hover:bg-white/90 rounded-2xl font-black uppercase tracking-widest gap-2 h-12 px-8 shadow-2xl shadow-indigo-900/50">
                    <ExternalLink className="h-4 w-4" />
                    Abrir pasta completa
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
