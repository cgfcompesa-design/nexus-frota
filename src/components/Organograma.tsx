import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Users, User, GitBranch, Edit3, Trash2, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MemberType = 'COMPESA' | 'SERVITIUM' | 'ESTAGIARIO' | 'LEENE';

interface Member {
  name: string;
  role: string;
  type: MemberType;
}

interface Sector {
  title: string;
  members: Member[];
}

const Organograma = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [admin, setAdmin] = useState({ name: "RENATA RODRIGUES", role: "Gerente" });
  const [leaders, setLeaders] = useState([
    { name: "VITOR LEONARDO", role: "Coordenador" },
    { name: "DIEGO CORTIZO", role: "Gestor de Contrato" }
  ]);

  const [adminSectors, setAdminSectors] = useState<Sector[]>([
    {
      title: "GERENCIAMENTO DE SISTEMA DE FROTA",
      members: [
        { name: "JORDAN MESSIAS", role: "APOIO ADM – GESTÃO SISTEMA FROTA", type: "SERVITIUM" },
        { name: "NAYARA CABRAL", role: "ESTAGIÁRIO TI – GESTÃO SISTEMA FROTA", type: "ESTAGIARIO" }
      ]
    },
    {
      title: "ABASTECIMENTO",
      members: [
        { name: "LUCAS AUGUSTO", role: "APOIO ADM – ABASTECIMENTO", type: "SERVITIUM" }
      ]
    },
    {
      title: "MANUTENÇÃO ADMINISTRATIVA",
      members: [
        { name: "LUÍS HENRIQUE", role: "APOIO ADM – MANUTENÇÃO PRÓPRIOS", type: "SERVITIUM" },
        { name: "MONIQUE SANTOS", role: "APOIO ADM – MANUTENÇÃO PRÓPRIOS", type: "SERVITIUM" },
        { name: "CARLOS HEITOR", role: "APOIO ADM – MANUTENÇÃO LOCADOS", type: "SERVITIUM" },
        { name: "ÍRIS MARANHÃO", role: "ESTAGIÁRIO ENG. MEC. – FROTA", type: "ESTAGIARIO" }
      ]
    },
    {
      title: "REGULARIZAÇÃO",
      members: [
        { name: "JULIO CEZAR", role: "ASSISTENTE DE GESTÃO", type: "COMPESA" },
        { name: "GABRIEL FARIAS", role: "APOIO ADM", type: "SERVITIUM" }
      ]
    },
    {
      title: "POOL",
      members: [
        { name: "GIDALTI VIEIRA", role: "ASSISTENTE DE GESTÃO", type: "COMPESA" }
      ]
    },
    {
      title: "TELEMETRIA",
      members: [
        { name: "GUILHERME SOUZA", role: "APOIO ADM", type: "SERVITIUM" }
      ]
    }
  ]);

  const [execMembers, setExecMembers] = useState<Member[]>([
    { name: "JOÃO PEDRO", role: "TÉCNICO DE MANUTENÇÃO – RMR", type: "LEENE" },
    { name: "EDUARDA SANTOS", role: "TÉCNICO DE MANUTENÇÃO – MATA SUL", type: "LEENE" },
    { name: "VAGA ABERTA 01", role: "TÉCNICO DE MANUTENÇÃO – AGRESTE", type: "LEENE" },
    { name: "VAGA ABERTA 02", role: "TÉCNICO DE MANUTENÇÃO – ALTO PAJEÚ", type: "LEENE" },
    { name: "VAGA ABERTA 03", role: "TÉCNICO DE MANUTENÇÃO – PETROLINA", type: "LEENE" }
  ]);

  const MemberCard = ({ member, compact = false }: { member: Member, compact?: boolean, key?: any }) => {
    const bgColor = {
      COMPESA: "bg-emerald-100 border-emerald-500 text-emerald-800",
      SERVITIUM: "bg-slate-100 border-slate-400 text-slate-800",
      ESTAGIARIO: "bg-amber-100 border-amber-400 text-amber-800",
      LEENE: "bg-blue-100 border-blue-400 text-blue-800"
    }[member.type];

    return (
      <div className={cn(
        "p-2 rounded-lg border-2 text-center transition-all hover:scale-105",
        bgColor,
        compact ? "py-1 px-2" : "py-2 px-3 w-44"
      )}>
        <p className="font-black text-[10px] uppercase leading-none mb-1">{member.name}</p>
        <p className="text-[8px] font-bold opacity-70 uppercase tracking-tight leading-tight">{member.role}</p>
      </div>
    );
  };

  return (
    <div className="p-8 bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
      <div className="flex justify-end mb-6">
        <Button 
          variant={isEditing ? "default" : "outline"} 
          onClick={() => setIsEditing(!isEditing)}
          className="gap-2 font-black uppercase text-[10px] tracking-widest rounded-xl"
        >
          {isEditing ? <Info className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          {isEditing ? "Visualizar" : "Modo Edição"}
        </Button>
      </div>

      <div className="min-w-[1200px] flex flex-col items-center">
        {/* Title */}
        <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-12 text-center">
          ORGANOGRAMA – NEXUS BI FROTA
        </h1>

        {/* Gerente */}
        <div className="relative mb-20 flex flex-col items-center">
          <div className="w-56 bg-slate-800 text-white rounded-xl p-4 text-center shadow-xl">
             <p className="font-black text-xs uppercase mb-1">{admin.name}</p>
             <p className="text-[10px] font-bold text-slate-400 uppercase">Gerente</p>
          </div>
          <div className="absolute top-full h-12 w-px bg-slate-300 dark:bg-slate-700"></div>
        </div>

        {/* Coordenadores Row */}
        <div className="relative w-full flex justify-center mb-20">
          <div className="absolute top-0 h-px w-[60%] bg-slate-300 dark:bg-slate-700"></div>
          
          <div className="flex gap-40 pt-12 relative">
            <div className="absolute top-0 left-0 h-12 w-px bg-slate-300 dark:bg-slate-700"></div>
            <div className="absolute top-0 right-0 h-12 w-px bg-slate-300 dark:bg-slate-700"></div>

            {leaders.map((leader, i) => (
              <div key={i} className="relative flex flex-col items-center">
                 <div className="w-56 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-lg">
                    <p className="font-black text-xs uppercase mb-1">{leader.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{leader.role}</p>
                 </div>
                 <div className="absolute top-full h-12 w-px bg-slate-300 dark:bg-slate-700"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin and Exec Sections */}
        <div className="flex gap-12 w-full justify-center items-start">
          
          {/* GESTÃO ADMINISTRATIVA */}
          <div className="flex flex-col items-center">
            <div className="w-64 bg-indigo-600 text-white p-3 rounded-xl text-center font-black uppercase text-xs tracking-widest shadow-lg mb-12 relative">
               GESTÃO ADMINISTRATIVA
               <div className="absolute top-full left-1/2 -translate-x-1/2 h-12 w-px bg-slate-300 dark:bg-slate-700"></div>
            </div>

            <div className="relative pt-12">
               <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 dark:bg-slate-700"></div>
               
               <div className="flex gap-4 relative">
                  {adminSectors.map((sector, i) => (
                    <div key={i} className="flex flex-col items-center relative pt-8">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 w-px bg-slate-300 dark:bg-slate-700"></div>
                       
                       <div className="w-36 bg-slate-700 text-white p-2 rounded-lg text-center font-black uppercase text-[8px] tracking-tight mb-4 min-h-[40px] flex items-center justify-center">
                          {sector.title}
                       </div>
                       
                       <div className="space-y-2">
                          {sector.members.map((member, mi) => (
                            <MemberCard key={mi} member={member} />
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* GESTÃO EXECUÇÃO */}
          <div className="flex flex-col items-center">
             <div className="w-64 bg-indigo-600 text-white p-3 rounded-xl text-center font-black uppercase text-xs tracking-widest shadow-lg mb-12 relative">
                GESTÃO EXECUÇÃO
                <div className="absolute top-full left-1/2 -translate-x-1/2 h-12 w-px bg-slate-300 dark:bg-slate-700"></div>
             </div>

             <div className="pt-12 flex flex-col gap-2 w-64">
                {execMembers.map((member, i) => (
                  <div key={i} className="w-full">
                    <MemberCard member={member} compact />
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-20 flex gap-6 items-center justify-center border-t border-slate-100 dark:border-slate-800 pt-8 w-full">
          <p className="font-black uppercase text-[10px] text-slate-400">Legenda:</p>
          <div className="flex gap-4">
             {[
               { label: "COMPESA", type: "COMPESA" as MemberType },
               { label: "TERCEIRIZADO – SERVITIUM", type: "SERVITIUM" as MemberType },
               { label: "ESTAGIÁRIO", type: "ESTAGIARIO" as MemberType },
               { label: "TERCEIRIZADO – LEENE", type: "LEENE" as MemberType }
             ].map((leg, i) => {
                const bgColor = {
                  COMPESA: "bg-emerald-100 border-emerald-500 text-emerald-800",
                  SERVITIUM: "bg-slate-100 border-slate-400 text-slate-800",
                  ESTAGIARIO: "bg-amber-100 border-amber-400 text-amber-800",
                  LEENE: "bg-blue-100 border-blue-400 text-blue-800"
                }[leg.type];
                return (
                  <div key={i} className={cn("px-4 py-1.5 rounded-lg border-2 font-black uppercase text-[9px]", bgColor)}>
                    {leg.label}
                  </div>
                )
             })}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6 text-[9px] font-bold text-slate-400 uppercase italic">
           <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 rounded flex items-center justify-center text-[7px]">💡</div> Clique duplo para editar nomes</div>
           <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 rounded flex items-center justify-center text-[7px]">+</div> Clique no modo edição para reordenar</div>
        </div>
      </div>
    </div>
  );
};

export default Organograma;
