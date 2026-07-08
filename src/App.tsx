import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Settings, ShieldAlert, Share2, Fuel } from 'lucide-react';
import { Button } from './components/ui/button';
import LoginPage from './components/auth/LoginPage';
import Sidebar from './components/layout/Sidebar';
import Overview from './components/dashboard/Overview';
import TelemetryDashboard from './components/telemetry/TelemetryDashboard';
import FuelCompare from './components/telemetry/FuelCompare';
import RankingView from './components/telemetry/RankingView';
import RegularizacaoDashboard from './components/regularizacao/RegularizacaoDashboard';
import TaxasInspecoesDashboard from './components/taxas/TaxasInspecoesDashboard';
import RegularizacaoDocumentosPage from './components/regularizacao/RegularizacaoDocumentosPage';
import MaintenanceDashboardPage from './components/maintenance/MaintenanceDashboardPage';
import { MaintenanceHistoryDashboard } from './components/maintenance/MaintenanceHistoryDashboard';
import { LocadosDashboard } from './components/maintenance/LocadosDashboard';
import FuelDashboardsPage from './components/fuel/FuelDashboardsPage';
import MachineSupplyReport from './components/fuel/MachineSupplyReport';
import { FuelDashboard } from './components/fuel/FuelDashboard';
import { SupplyPerformanceDashboard } from './components/fuel/SupplyPerformanceDashboard';
import { CNHControlDashboard } from './components/fuel/CNHControlDashboard';
import CCODashboard from './components/cco/CCODashboard';
import Home from './components/home/Home';
import KanbanBoard from './components/kanban/KanbanBoard';
import GestaoVista from './components/gestao/GestaoVista';
import DrivePage from './components/drive/DrivePage';
import ActivityManagement from './components/config/ActivityManagement';
import PoolDashboard from './pages/Pool';
import ChecklistManutencaoPage from './components/maintenance/ChecklistManutencaoPage';
import ResponderChecklistPage from './components/maintenance/ResponderChecklistPage';
import CadastroPreventivaPage from './components/maintenance/CadastroPreventivaPage';
import { NexusFuelControlPage } from './components/fuel/NexusFuelControlPage';
import { checkAndSeedAllData } from './lib/initialSeeds';
import { useAssets, useFuelData, useAutonomiaData, useAutonomiaPadraoData, useMaintenanceData, useMaintenanceCostData } from './hooks/useFleetData';
import { LoadingState } from './components/dashboard/LoadingState';
import AlertConfig from './components/config/AlertConfig';
import UserManagement from './components/config/UserManagement';
import ManagementAlertsPopup from './components/dashboard/ManagementAlertsPopup';
import { Toaster, toast } from 'sonner';
import { ErrorBoundary } from 'react-error-boundary';

import logoCgf from './assets/images/regenerated_image_1778593500523.png';

// Logic hook to keep component lean////
function useAppLogic() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const viewQuery = searchParams.get('view');
    if (viewQuery) {
      return viewQuery;
    }
    const path = window.location.pathname;
    if (path === '/responder-checklist' || path.startsWith('/responder-checklist')) {
      return 'responder-checklist';
    }
    if (path === '/cadastro-preventiva' || path.startsWith('/cadastro-preventiva')) {
      return 'cadastro-preventiva';
    }
    if (path === '/checklist-manutencao') {
      return 'checklist-manutencao';
    }
    return 'home';
  });
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    checkAndSeedAllData();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setLoading(true);
      if (authUser) {
        setUser(authUser);
        let userRole: string | null = null;
        try {
          const docRef = doc(db, 'users', authUser.uid);
          const userDoc = await getDoc(docRef);
          if (userDoc.exists()) {
            const profile = userDoc.data();
            setUserProfile(profile);
            userRole = profile.role || 'Visualizador';
            
            // Cache profile in localStorage for offline fallback
            localStorage.setItem(`profile_${authUser.uid}`, JSON.stringify(profile));

            // Check for Master or Gestão role to show alerts
            if (profile.role === 'Master' || profile.role === 'Gestão' || authUser.email === 'cgf.compesa@gmail.com') {
              setShowAlerts(true);
            }
          } else {
            const role = authUser.email === 'cgf.compesa@gmail.com' ? 'Master' : 'Visualizador';
            const newProfile = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName || authUser.email?.split('@')[0],
              role,
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(docRef, newProfile);
              localStorage.setItem(`profile_${authUser.uid}`, JSON.stringify(newProfile));
            } catch (setErr) {
              console.warn("Erro ao salvar novo perfil no banco (possível offline):", setErr);
            }
            setUserProfile(newProfile);
            userRole = role;
            
            if (role === 'Master') setShowAlerts(true);
          }
        } catch (error) {
          console.error("Erro ao buscar perfil:", error);
          
          // Try loading from localStorage cache
          const cachedProfileStr = localStorage.getItem(`profile_${authUser.uid}`);
          if (cachedProfileStr) {
            try {
              const cachedProfile = JSON.parse(cachedProfileStr);
              setUserProfile(cachedProfile);
              userRole = cachedProfile.role || 'Visualizador';
              if (cachedProfile.role === 'Master' || cachedProfile.role === 'Gestão' || authUser.email === 'cgf.compesa@gmail.com') {
                setShowAlerts(true);
              }
              console.log("Perfil carregado do cache local (offline mode)");
            } catch (jsonErr) {
              // Ignore invalid cache
            }
          }

          if (!userRole) {
            const role = authUser.email === 'cgf.compesa@gmail.com' ? 'Master' : 'Visualizador';
            const fallbackProfile = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName || authUser.email?.split('@')[0],
              role,
              createdAt: new Date().toISOString()
            };
            setUserProfile(fallbackProfile);
            userRole = role;
            if (role === 'Master') setShowAlerts(true);
            console.log("Perfil fallback padrão aplicado (offline mode)");
          }
        }
        
        const searchParams = new URLSearchParams(window.location.search);
        const viewQuery = searchParams.get('view');
        const path = window.location.pathname;
        if (userRole === 'LOCADORA') {
          setCurrentView('cadastro-preventiva');
        } else if (viewQuery) {
          setCurrentView(viewQuery);
        } else if (path !== '/responder-checklist' && !path.startsWith('/responder-checklist') && path !== '/checklist-manutencao' && path !== '/cadastro-preventiva' && !path.startsWith('/cadastro-preventiva')) {
          setCurrentView('home');
        }
      } else {
        setUser(null);
        setUserProfile(null);
        const searchParams = new URLSearchParams(window.location.search);
        const viewQuery = searchParams.get('view');
        const path = window.location.pathname;
        if (viewQuery) {
          setCurrentView(viewQuery);
        } else if (path !== '/responder-checklist' && !path.startsWith('/responder-checklist') && path !== '/cadastro-preventiva' && !path.startsWith('/cadastro-preventiva')) {
          setCurrentView('home');
        }
        setShowAlerts(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, userProfile, currentView, setCurrentView, showAlerts, setShowAlerts };
}

// Separate components to keep App.tsx clean and avoid re-definition during render
function AbastDesviosView({ desviosOnly, userRole }: { desviosOnly: boolean, userRole: string }) {
  const { data: fuel = [], isLoading: loadingFuel } = useFuelData();
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { data: autonomia = [], isLoading: loadingAutonomia } = useAutonomiaData();
  const { data: autonomiaPadrao = [], isLoading: loadingAutonomiaPadrao } = useAutonomiaPadraoData();
  const { data: maintenanceCost = [], isLoading: loadingCost } = useMaintenanceCostData();
  const { data: maintenance = [], isLoading: loadingMaint } = useMaintenanceData();
  
  const isLoading = loadingFuel || loadingAssets || loadingAutonomia || loadingAutonomiaPadrao || loadingCost || loadingMaint;
  
  return (
    <FuelDashboard 
      fuel={fuel} 
      assets={assets} 
      autonomia={autonomia} 
      autonomiaPadrao={autonomiaPadrao} 
      maintenanceCost={maintenanceCost} 
      maintenance={maintenance} 
      desviosOnly={desviosOnly} 
      userRole={userRole}
      isLoading={isLoading}
    />
  );
}

function AbastPerformanceView({ userRole }: { userRole: string }) {
  const { data: fuel = [], isLoading: loadingFuel } = useFuelData();
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { data: autonomia = [], isLoading: loadingAutonomia } = useAutonomiaData();
  const { data: autonomiaPadrao = [], isLoading: loadingAutonomiaPadrao } = useAutonomiaPadraoData();
  const { data: maintenanceCost = [], isLoading: loadingCost } = useMaintenanceCostData();
  const { data: maintenance = [], isLoading: loadingMaint } = useMaintenanceData();
  
  const isLoading = loadingFuel || loadingAssets || loadingAutonomia || loadingAutonomiaPadrao || loadingCost || loadingMaint;
  
  return (
    <FuelDashboard 
      fuel={fuel} 
      assets={assets} 
      autonomia={autonomia} 
      autonomiaPadrao={autonomiaPadrao} 
      maintenanceCost={maintenanceCost} 
      maintenance={maintenance} 
      initialTab="abast-perf" 
      userRole={userRole}
      isLoading={isLoading}
    />
  );
}

function AbastPrecosView({ userRole }: { userRole: string }) {
  const { data: fuel = [], isLoading: loadingFuel } = useFuelData();
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { data: autonomia = [], isLoading: loadingAutonomia } = useAutonomiaData();
  const { data: autonomiaPadrao = [], isLoading: loadingAutonomiaPadrao } = useAutonomiaPadraoData();
  const { data: maintenanceCost = [], isLoading: loadingCost } = useMaintenanceCostData();
  const { data: maintenance = [], isLoading: loadingMaint } = useMaintenanceData();
  
  const isLoading = loadingFuel || loadingAssets || loadingAutonomia || loadingAutonomiaPadrao || loadingCost || loadingMaint;
  
  return (
    <FuelDashboard 
      fuel={fuel} 
      assets={assets} 
      autonomia={autonomia} 
      autonomiaPadrao={autonomiaPadrao} 
      maintenanceCost={maintenanceCost} 
      maintenance={maintenance} 
      initialTab="prices" 
      userRole={userRole}
      isLoading={isLoading}
    />
  );
}

function MaintenanceDesempenhoView() {
  const { data: maintenanceCost = [] } = useMaintenanceCostData();
  return <MaintenanceHistoryDashboard maintenanceCost={maintenanceCost} />;
}

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-rose-200 dark:border-rose-900/30 space-y-6">
      <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl flex items-center justify-center">
        <ShieldAlert size={32} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tighter">Ops! Algo deu errado</h2>
        <p className="text-slate-400 font-medium text-xs uppercase tracking-widest mt-1">Ocorreu um erro ao renderizar este módulo.</p>
        <pre className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] text-rose-500 font-mono overflow-auto max-w-md">
          {error.message}
        </pre>
      </div>
      <Button onClick={resetErrorBoundary} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest h-10 px-8 rounded-xl shadow-lg shadow-indigo-500/20">
        Tentar Novamente
      </Button>
    </div>
  );
}


export default function App() {
  const { user, loading, userProfile, currentView, setCurrentView, showAlerts, setShowAlerts } = useAppLogic();
  const location = useLocation();
  const navigate = useNavigate();

  const MASTER_EMAIL = "cgf.compesa@gmail.com";
  const effectiveRole = user?.email === MASTER_EMAIL ? 'Master' : (userProfile?.role || 'Visualizador');

  // 1. Sync React Router location changes with our state-driven views (backward/forward buttons)
  useEffect(() => {
    const path = location.pathname;
    if (path === '/responder-checklist' || path.startsWith('/responder-checklist')) {
      if (currentView !== 'responder-checklist') {
        setCurrentView('responder-checklist');
      }
    } else if (path === '/checklist-manutencao') {
      if (currentView !== 'checklist-manutencao') {
        setCurrentView('checklist-manutencao');
      }
    } else if (currentView === 'responder-checklist' || currentView === 'checklist-manutencao') {
      if (path === '/' || path === '/home') {
        setCurrentView('home');
      }
    }
  }, [location.pathname]);

  // 2. Sync state-driven views changes with React Router URL (programmatic redirects, link clicks)
  useEffect(() => {
    const path = location.pathname;
    if (currentView === 'responder-checklist') {
      if (!path.startsWith('/responder-checklist')) {
        navigate('/responder-checklist');
      }
    } else if (currentView === 'cadastro-preventiva') {
      if (!path.startsWith('/cadastro-preventiva')) {
        navigate('/cadastro-preventiva');
      }
    } else if (currentView === 'checklist-manutencao') {
      if (path !== '/checklist-manutencao') {
        navigate('/checklist-manutencao');
      }
    } else {
      if (path === '/checklist-manutencao' || path === '/responder-checklist' || path === '/cadastro-preventiva') {
        navigate('/');
      }
    }
  }, [currentView]);

  useEffect(() => {
    if (!loading && !user) {
      if (currentView === 'cadastro-preventiva') {
        toast.info("Acesso restrito. Por favor, faça login para preencher as preventivas.");
        setCurrentView('login');
        return;
      }
      const publicViews = ['home', 'abast-dash', 'mnt-ctrl-op', 'locados', 'cco', 'abast-maquinas', 'drive', 'login', 'responder-checklist', 'resumo', 'abast-precos'];
      if (!publicViews.includes(currentView)) {
        setCurrentView('home');
      }
    }
  }, [user, currentView, loading]);

  useEffect(() => {
    if (!loading && user && effectiveRole === 'Visualizador' && currentView === 'cadastro-preventiva') {
      toast.error("Acesso restrito. Esta página é de acesso exclusivo para as Locadoras credenciadas.");
      setCurrentView('home');
    }
  }, [loading, user, effectiveRole, currentView]);

  useEffect(() => {
    if (user && effectiveRole === 'LOCADORA' && currentView !== 'cadastro-preventiva') {
      setCurrentView('cadastro-preventiva');
    }
  }, [user, effectiveRole, currentView]);

  const renderView = () => {
    // Visitor protection
    if (!user) {
      const publicViews = ['home', 'abast-dash', 'mnt-ctrl-op', 'locados', 'cco', 'abast-maquinas', 'drive', 'responder-checklist', 'resumo', 'abast-precos'];
      if (!publicViews.includes(currentView)) {
        return <Home setView={setCurrentView} userRole="Visualizador" />;
      }
    }
//
    // Role based protection for Visualizadores PÚBLICO EM GERAL
    if (user && effectiveRole === 'Visualizador') {
      const allowedViews = ['home', 'cco', 'abast-dash', 'mnt-ctrl-op', 'locados', 'abast-maquinas', 'drive', 'responder-checklist', 'resumo', 'abast-precos'];
      if (!allowedViews.includes(currentView)) {
        return <Home setView={setCurrentView} userRole={effectiveRole} />;
      }
    }


//Quem pode visualizar o aba pool



// Role based protection for POOL
if (
  user &&
  currentView === 'pool' &&
  effectiveRole !== 'Master' &&
  effectiveRole !== 'Gestão'
) {
  toast.error("Acesso restrito ao módulo POOL.");
  return <Home setView={setCurrentView} userRole={effectiveRole} />;
}



    
    // Role based protection for LOCADORA
    if (user && effectiveRole === 'LOCADORA') {
      return <CadastroPreventivaPage hideBackButton={true} userProfile={userProfile} />;
    }

    switch (currentView) {
      case 'home': return <Home setView={setCurrentView} userRole={effectiveRole} />;
      case 'drive': return <DrivePage />;
      case 'cadastro-preventiva': return <CadastroPreventivaPage onBack={() => setCurrentView('locados')} userProfile={userProfile} />;
      case 'pool': return <PoolDashboard />;
      case 'resumo': return <Overview />;
      case 'telemetria': return <TelemetryDashboard />;
      case 'abast-dash': return <FuelDashboardsPage setView={setCurrentView} />;
      case 'nexus-fuelcontrol': return <NexusFuelControlPage userProfile={userProfile} onBack={() => setCurrentView('home')} />;
      case 'abast-maquinas': return <MachineSupplyReport onBack={() => setCurrentView('abast-dash')} />;
      case 'kanban': return <KanbanBoard onBack={() => setCurrentView('home')} />;
      case 'gestao-vista': return <GestaoVista onBack={() => setCurrentView('home')} />;
      case 'gerenciamento-atividades': return <ActivityManagement onBack={() => setCurrentView('home')} />;
      case 'checklist-manutencao': return <ChecklistManutencaoPage onBack={() => setCurrentView('gerenciamento-atividades')} userRole={effectiveRole} />;
      case 'responder-checklist': return <ResponderChecklistPage onBack={user ? () => setCurrentView('gerenciamento-atividades') : undefined} />;
      case 'abast-desvios': return <AbastDesviosView desviosOnly={true} userRole={effectiveRole} />;
      case 'abast-perf': return <AbastPerformanceView userRole={effectiveRole} />;
      case 'abast-precos': return <AbastPrecosView userRole={effectiveRole} />;
      case 'rankings': return <RankingView />;
      case 'reg-infracoes': return <RegularizacaoDashboard />;
      case 'reg-taxas': return <TaxasInspecoesDashboard />;
      case 'reg-docs': return <RegularizacaoDocumentosPage />;
      case 'mnt-ctrl-op': return <MaintenanceDashboardPage userRole={effectiveRole} />;
      case 'mnt-desemp': return <MaintenanceDesempenhoView />;
      case 'locados': return <LocadosDashboard />;
      case 'cco': return <CCODashboard setView={setCurrentView} />;
      case 'config': return <AlertConfig />;
      case 'abast-alertas': return <AlertConfig />;
      case 'users': return <UserManagement />;
      default: return <Overview />;
    }
  };

  const managementAlerts = (
    <ManagementAlertsPopup 
      isOpen={showAlerts} 
      onClose={() => setShowAlerts(false)} 
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Iniciando Nexus Frota...</div>
      </div>
    );
  }

  // Handle Fullscreen views (No Auth Required for Drive, Auth depends on component for others)
  if (currentView === 'drive' || currentView === 'abast-maquinas' || currentView === 'responder-checklist' || currentView === 'cadastro-preventiva') {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="min-h-screen">
          {currentView === 'drive' ? (
            <DrivePage onBack={() => setCurrentView('home')} />
          ) : currentView === 'abast-maquinas' ? (
            <MachineSupplyReport onBack={() => setCurrentView('abast-dash')} />
          ) : currentView === 'cadastro-preventiva' ? (
            <CadastroPreventivaPage onBack={() => setCurrentView('home')} hideBackButton={!user} userProfile={userProfile} />
          ) : (
            <ResponderChecklistPage onBack={user ? () => setCurrentView('gerenciamento-atividades') : undefined} />
          )}
          {managementAlerts}
          <Toaster position="top-right" />
        </div>
      </ErrorBoundary>
    );
  }

  // Visitor Access (Public BI)
  if (!user) {
    const publicViews = ['home', 'abast-dash', 'mnt-ctrl-op', 'locados', 'cco', 'abast-maquinas', 'drive', 'responder-checklist', 'resumo', 'abast-precos'];
    if (publicViews.includes(currentView)) {
      return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <Sidebar 
            currentView={currentView} 
            setView={setCurrentView} 
            user={{ displayName: 'Visitante', email: 'visitante@nexus.frota', role: 'Visualizador' }} 
          />
          <main className="flex-1 overflow-hidden flex flex-col h-screen">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pl-16 pr-4 py-3 lg:px-4 flex justify-between items-center shrink-0">
               <div className="flex items-center space-x-4">
                <div 
                  className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors"
                  onClick={() => setCurrentView('home')}
                >
                  <Fuel size={18} className="text-indigo-600" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 dark:text-white italic">CGF</span>
                </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">CGF FROTA | Conectado</span>
              </div>
            </div>
              <div className="flex items-center space-x-3">
                <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Modo Visitante</span>
                <Button onClick={() => setCurrentView('login')} variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600">Acesso Restrito</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50 dark:bg-slate-950/50">
              <div className="max-w-7xl mx-auto h-full min-h-[600px] flex flex-col">
                <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => setCurrentView('resumo')}>
                  {renderView()}
                </ErrorBoundary>
              </div>
            </div>
          </main>
          <Toaster position="top-right" />
        </div>
      );
    }
    
    if (currentView === 'login') return <LoginPage setView={setCurrentView} />;
    
    // Fallback loading or simple login
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Handle standalone pages (Home, Kanban, Gestao Vista)
  if (currentView === 'home' || currentView === 'kanban' || currentView === 'gestao-vista' || currentView === 'gerenciamento-atividades') {
    if (currentView === 'home') {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center space-x-4">
              <div 
                className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/10 px-4 py-2 rounded-2xl cursor-pointer hover:bg-indigo-100 transition-colors"
                onClick={() => setCurrentView('home')}
              >
                <Fuel size={22} className="text-indigo-600" />
                <span className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-white italic">CGF</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">CGF FROTA | Conectado</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setCurrentView('drive')}
                className="p-2 transition-all text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                title="Drive de Informações"
              >
                <Share2 size={18} />
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date().toLocaleDateString('pt-BR')}
              </div>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
              <button 
                onClick={() => auth.signOut()}
                className="text-rose-500 hover:text-rose-600 font-black text-[10px] uppercase tracking-widest"
              >
                Sair
              </button>
            </div>
          </div>
          <Home setView={setCurrentView} userRole={effectiveRole} />
          {managementAlerts}
          <Toaster position="top-right" />
        </div>
      );
    }
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => setCurrentView('home')}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          {renderView()}
          {managementAlerts}
          <Toaster position="top-right" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        user={{ ...user, ...userProfile }} 
      />
      
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar for visibility confirmation */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pl-16 pr-4 py-3 lg:px-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-4">
            <div 
              className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors"
              onClick={() => setCurrentView('home')}
            >
              <Fuel size={18} className="text-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 dark:text-white italic">CGF</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">CGF FROTA | Conectado</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setCurrentView('drive')}
              className="p-2 transition-all text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
              title="Drive de Informações"
            >
              <Share2 size={18} />
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
            <button 
              onClick={() => setCurrentView('home')}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
            >
              <Settings size={12} /> Menu Principal
            </button>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              {renderView() || <div className="text-center p-12 text-slate-400">Página não encontrada</div>}
            </ErrorBoundary>
          </div>
        </div>
      </main>
      {managementAlerts}
      <Toaster position="top-right" />
    </div>
  );
}
