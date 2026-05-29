import { useAssets, useMaintenanceData, useMaintenanceCostData, usePreventiveMaintenanceData, useFuelData, useControleOperacional } from "@/hooks/useFleetData";
import { MaintenanceDashboard } from "./MaintenanceDashboard";
import { BacklogDashboard } from "./BacklogDashboard";
import { LoadingState } from "../dashboard/LoadingState";
import { AlertTriangle, ClipboardList, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MaintenanceDashboardPageProps {
  userRole?: string;
}

export default function MaintenanceDashboardPage({ userRole = 'Visualizador' }: MaintenanceDashboardPageProps) {
  const { data: assets = [], isLoading: isLoadingAssets, isError: isErrorAssets, refetch: refetchAssets } = useAssets();
  const { data: maintenance = [], isLoading: isLoadingMnt, isError: isErrorMnt, refetch: refetchMnt } = useMaintenanceData();
  const { data: maintenanceCost = [], isLoading: isLoadingCost, isError: isErrorCost, refetch: refetchCost } = useMaintenanceCostData();
  const { data: preventiveMaintenance = [], isLoading: isLoadingPrev, isError: isErrorPrev, refetch: refetchPrev } = usePreventiveMaintenanceData();
  const { data: fuel = [], isLoading: isLoadingFuel, isError: isErrorFuel, refetch: refetchFuel } = useFuelData();
  const { data: controleOperacional = [], isLoading: isLoadingCO, isError: isErrorCO, refetch: refetchCO } = useControleOperacional();

  const isLoading = (isLoadingMnt || isLoadingAssets || isLoadingCost || isLoadingPrev || isLoadingFuel || isLoadingCO) && maintenance.length === 0;
  const isError = isErrorMnt || isErrorAssets || isErrorCost || isErrorPrev || isErrorFuel || isErrorCO;

  const refetchAll = () => {
    refetchAssets();
    refetchMnt();
    refetchCost();
    refetchPrev();
    refetchFuel();
    refetchCO();
  };

  // No page-blocking loading screen to keep tabs accessible immediately

  if (isError && maintenance.length === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-12">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200/50">
          <AlertTriangle size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Falha na Sincronização</h2>
          <p className="text-slate-500 max-w-md mx-auto font-medium">Ops! Não conseguimos conectar com os servidores de manutenção da Compesa. Verifique sua conexão ou tente novamente.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl border-2 font-black uppercase tracking-widest text-xs h-12 px-8">
            Recarregar App
          </Button>
          <Button onClick={() => refetchAll()} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs h-12 px-8 shadow-xl shadow-slate-200 dark:shadow-none">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 items-center flex justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-[0.9] whitespace-pre-line">
            Controle{"\n"}Operacional
          </h1>
          <p className="text-slate-500 font-medium tracking-tight mt-2 uppercase text-[10px] font-black">Gestão centralizada de frota e manutenção</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-800">
              <p className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 leading-none">Status do Sistema</p>
              <div className="flex items-center gap-1.5 mt-1">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                 <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Sincronizado</p>
              </div>
           </div>
        </div>
      </div>

      <MaintenanceDashboard 
        maintenance={maintenance}
        maintenanceCost={maintenanceCost}
        preventiveMaintenance={preventiveMaintenance}
        fuel={fuel}
        assets={assets}
        controleOperacional={controleOperacional}
        userRole={userRole}
      />
    </div>
  );
}
