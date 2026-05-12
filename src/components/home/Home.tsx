import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, KanbanSquare, Eye, ExternalLink, Settings, Share2, Home as HomeIcon } from "lucide-react";

const cgfLogo = "/src/assets/images/regenerated_image_1778593500523.png";

interface HomeProps {
  setView: (view: string) => void;
}

const Home = ({ setView }: HomeProps) => {
  const menuItems = [
    {
      title: "Nexus Frota BI",
      icon: BarChart3,
      onClick: () => setView('resumo'), // Redirect to main dashboard (Ativos/Resumo)
      external: false,
    },
    {
      title: "Kanban de Atividades",
      icon: KanbanSquare,
      onClick: () => {
        // This would navigate to a route if using react-router-dom properly,
        // but the app seems to use an internal 'view' state.
        // For now, if the view doesn't exist, we show the "Módulo em Integração"
        setView('kanban');
      },
      external: false,
    },
    {
      title: "Quadro Gestão à Vista",
      icon: Eye,
      onClick: () => setView('gestao-vista'),
      external: false,
    },
    {
      title: "Gerenciamento de Atividades",
      icon: Settings,
      onClick: () => setView('gerenciamento-atividades'),
      external: false,
    },
    {
      title: "Drive de Informações",
      icon: Share2,
      onClick: () => setView('drive'),
      external: true,
    },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-6xl w-full mx-auto">
        <header className="text-center mb-12 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
          <img 
            src={cgfLogo} 
            alt="Nexus BI Logo" 
            className="w-48 h-auto mx-auto mb-6 transition-transform hover:scale-105" 
            onError={(e) => {
              e.currentTarget.src = "https://placehold.co/200x200/6366f1/ffffff?text=NEXUS+BI";
            }}
          />
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tighter italic">
            NEXUS BI | Frota Digital
          </h1>
          <p className="text-indigo-600 dark:text-indigo-400 text-lg font-black uppercase tracking-widest italic">
            Gestão Estratégica de Ativos
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {menuItems.map((item) => (
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
