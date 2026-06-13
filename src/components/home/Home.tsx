import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, KanbanSquare, Eye, ExternalLink, Settings, Share2, Home as HomeIcon, Fuel, Trophy, UserCheck, ClipboardList } from "lucide-react";

import logoCgf from "../../assets/images/regenerated_image_1778593500523.png";

interface HomeProps {
  setView: (view: string) => void;
  userRole?: string;
}

const Home = ({ setView, userRole = 'Visualizador' }: HomeProps) => {
  const isMaster = userRole === 'Master';
  const isGestao = userRole === 'Gestão';
  const isPrivileged = isMaster || isGestao;

  const menuItems = [
    {
      title: "Nexus Frota BI",
      id: 'nexus-bi',
      icon: BarChart3,
      onClick: () => setView('resumo'),
      external: false,
      restricted: false,
    },
    {
      title: "Kanban de Atividades",
      id: 'kanban',
      icon: KanbanSquare,
      onClick: () => setView('kanban'),
      external: false,
      restricted: true,
    },
    {
      title: "Quadro Gestão à Vista",
      id: 'gestao-vista',
      icon: Eye,
      onClick: () => setView('gestao-vista'),
      external: false,
      restricted: true,
    },
    {
      title: "Gerenciamento de Atividades",
      id: 'config',
      icon: Settings,
      onClick: () => setView('gerenciamento-atividades'),
      external: false,
      restricted: true,
    },
    {
      title: "Drive de Informações",
      id: 'drive',
      icon: Share2,
      onClick: () => setView('drive'),
      external: true,
      restricted: false,
    },
    {
      title: "Abastecimento Máquinas",
      id: 'abast-maquinas',
      icon: Fuel,
      onClick: () => setView('abast-maquinas'),
      external: false,
      restricted: false,
      hideForGestao: true,
    },
    {
      title: "Dashboard Operacional",
      id: 'cco',
      icon: Trophy,
      onClick: () => setView('cco'),
      external: false,
      restricted: false,
      hideForGestao: true,
    },
    {
      title: "Gerenciamento de Usuários",
      id: 'users',
      icon: UserCheck,
      onClick: () => setView('users'),
      external: false,
      restricted: true,
    },
    {
      title: "Controle Preventiva Locadora",
      id: 'cadastro-preventiva',
      icon: ClipboardList,
      onClick: () => setView('cadastro-preventiva'),
      external: false,
      restricted: false,
      onlyForRoles: ['Master', 'Gestão', 'LOCADORA'],
    },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.restricted && !isPrivileged) return false;
    if (item.hideForGestao && isPrivileged) return false;
    if (item.onlyForRoles && !item.onlyForRoles.includes(userRole)) return false;
    return true;
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-6xl w-full mx-auto">
        <header className="text-center mb-12 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 mx-auto mb-6 transition-transform hover:scale-105">
            <Fuel size={48} />
          </div>
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tighter italic">
            CGF | Nexus Frota
          </h1>
          <p className="text-indigo-600 dark:text-indigo-400 text-lg font-black uppercase tracking-widest italic">
            Gestão Estratégica de Frotas
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 justify-center max-w-4xl mx-auto">
          {filteredMenuItems.map((item) => (
            <Card
              key={item.title}
              className="hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-500/50 group bg-white dark:bg-slate-900 rounded-3xl"
              onClick={item.onClick}
            >
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                  <item.icon className="h-12 w-12 text-indigo-600 group-hover:text-white" />
                </div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-tight">
                  {item.title}
                </h2>
                {item.external && (
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
