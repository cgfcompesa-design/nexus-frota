import { 
  BarChart3, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Fuel, 
  Users, 
  Menu, 
  X,
  Sun,
  Cpu,
  Moon,
  ChevronDown,
  ChevronRight,
  Trophy,
  Wrench,
  FileText,
  PieChart,
  Activity,
  UserCheck,
  MapPin,
  Bell,
  Car,
  Truck,
  ClipboardList,
  History,
  Package,
  AlertTriangle,
  Gavel,
  Files,
  Home as HomeIcon,
  Share2,
  TrendingUp,
  Ticket
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useState, useEffect } from 'react';

import logoCgf from '../../assets/images/regenerated_image_1778593500523.png';
//
//
interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  user: any;
}

interface MenuItem {
  id: string;
  label: string;
  icon?: any;
  subItems?: MenuItem[];
}

export default function Sidebar({ currentView, setView, user }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'abastecimento': false,
    'manutencao': false,
    'regularizacao': false,
    'proprios': false
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const MASTER_EMAIL = "cgf.compesa@gmail.com";
  const userRole = user?.email === MASTER_EMAIL ? 'Master' : (user?.role || 'Visualizador');

  const rawMenuItems: MenuItem[] = [
    { id: 'resumo', label: 'Nexus Frota', icon: BarChart3 },
    { id: 'cco', label: 'Overview', icon: MapPin },
    { id: 'telemetria', label: 'Telemetria', icon: LayoutDashboard },
    { 
      id: 'abastecimento', 
      label: 'Abastecimento', 
      icon: Fuel,
      subItems: [
        { id: 'abast-dash', label: 'Dashboards', icon: PieChart },
        { id: 'abast-desvios', label: 'Monitoramento e Análise', icon: Activity },
        { id: 'abast-precos', label: 'Análise de Preços', icon: TrendingUp },
        { id: 'nexus-fuelcontrol', label: 'Nexus FuelControl', icon: Cpu },
      ]
    },


{
  id: 'pool',
  label: 'POOL - Vouchers',
  icon: Ticket,
},

{
  id: 'manutencao',
  label: 'Manutenção',
  icon: Wrench,

},
    { 
      id: 'manutencao', 
      label: 'Manutenção', 
      icon: Wrench,
      subItems: [
        { 
          id: 'proprios', 
          label: 'Próprios', 
          icon: Car,
          subItems: [
            { id: 'mnt-ctrl-op', label: 'Controle Operacional', icon: ClipboardList },
            { id: 'mnt-desemp', label: 'Desempenho &\nHistórico', icon: History },
          ]
        },
        { 
          id: 'locados-parent', 
          label: 'Locados', 
          icon: Truck,
          subItems: [
            { id: 'locados', label: 'Dashboard Locados', icon: BarChart3 },
            { id: 'cadastro-preventiva', label: 'Controle Preventiva', icon: ClipboardList },
          ]
        },
      ]
    },
    
    { 
      id: 'regularizacao', 
      label: 'Regularização', 
      icon: FileText,
      subItems: [
        { id: 'reg-infracoes', label: 'Infrações e Despesas', icon: AlertTriangle },
        { id: 'reg-taxas', label: 'Controle de Taxas\ne Inspeções', icon: Gavel },
      ]
    },
    { id: 'drive', label: 'Drive de Informações', icon: Share2 },
  ];

  const getFilteredItems = (): MenuItem[] => {
    if (userRole === 'LOCADORA') {
      return [{ id: 'cadastro-preventiva', label: 'Preventiva Locadora', icon: ClipboardList }];
    }

    const items = JSON.parse(JSON.stringify(rawMenuItems)) as MenuItem[];
    
    const iconMap: Record<string, any> = {
      'resumo': BarChart3,
      'cco': MapPin,
      'telemetria': LayoutDashboard,
      'abastecimento': Fuel,
      'abast-dash': PieChart,
      'abast-desvios': Activity,
      'abast-precos': TrendingUp,
      'nexus-fuelcontrol': Cpu,
      'manutencao': Wrench,
      'proprios': Car,
      'mnt-ctrl-op': ClipboardList,
      'mnt-desemp': History,
      'locados': BarChart3,
      'locados-parent': Truck,
      'regularizacao': FileText,
      'reg-infracoes': AlertTriangle,
      'reg-taxas': Gavel,
      'cadastro-preventiva': ClipboardList,
      'drive': Share2,
      'pool': Ticket,
    };

    const rebindIcons = (menuList: MenuItem[]) => {
      menuList.forEach(item => {
        item.icon = iconMap[item.id];
        if (item.subItems) {
          rebindIcons(item.subItems);
        }
      });
    };
    rebindIcons(items);

    if (userRole === 'Gestão') {

  const withNoRootPreventiva = items.filter(
    item => item.id !== 'cadastro-preventiva' && item.id !== 'users'
  );

  const pool = withNoRootPreventiva.find(item => item.id === 'pool');

  if (!pool) {
    withNoRootPreventiva.push({
      id: 'pool',
      label: 'POOL - Vouchers',
      icon: Ticket
    });
  }

  return withNoRootPreventiva;
}



      
      

    if (userRole === 'Visualizador') {
      const allowed = ['resumo', 'cco', 'abastecimento', 'manutencao', 'drive'];
      const filtered = items.filter(item => allowed.includes(item.id));
      
      const abast = filtered.find(item => item.id === 'abastecimento');
      if (abast && abast.subItems) {
        abast.subItems = abast.subItems.filter(si => si.id === 'abast-dash' || si.id === 'abast-precos');
      }
      
      const mnt = filtered.find(item => item.id === 'manutencao');
      if (mnt && mnt.subItems) {
        const proprios = mnt.subItems.find(si => si.id === 'proprios');
        if (proprios && proprios.subItems) {
          proprios.subItems = proprios.subItems.filter(ssi => ssi.id === 'mnt-ctrl-op');
        }
      }
      return filtered;
    }

    if (userRole === 'Master') {
  const abast = items.find(item => item.id === 'abastecimento');

  if (abast && abast.subItems) {
    abast.subItems = abast.subItems.filter(si => si.id !== 'abast-precos');
  }

  return items;
}

    return items;
  };

  const filteredMenuItems = getFilteredItems();

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasSubItems = item.subItems && item.subItems.length > 0
    const isExpanded = expandedMenus[item.id];
    const isSelected = currentView === item.id;

    return (
      <div key={item.id} className="w-full">
        <button
          onClick={() => {
            if (hasSubItems) {
              toggleMenu(item.id);
            } else {
              setView(item.id);
              if (window.innerWidth < 1024) {
                setIsOpen(false);
              }
            }
          }}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${
            depth > 0 ? 'mt-1' : ''
          } ${
            isSelected 
              ? 'bg-indigo-600 text-white shadow-md font-medium' 
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          style={{ paddingLeft: depth === 0 ? '1rem' : `${depth + 1}rem` }}
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            {item.icon && <item.icon size={depth === 0 ? 20 : 18} />}
            <span className={`text-sm ${item.label.includes('\n') ? 'whitespace-pre-line leading-tight text-left' : 'whitespace-nowrap truncate'}`}>
              {item.label}
            </span>
          </div>
          {hasSubItems && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </button>

        {hasSubItems && isExpanded && (
          <div className="overflow-hidden">
            <div className="ml-2 border-l border-slate-100 dark:border-slate-800 my-1">
              {item.subItems!.map(sub => renderMenuItem(sub, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl lg:shadow-none transition-all duration-300 ${isOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0'}`}
      >
        <div className="p-6 flex items-center space-x-3 mb-4 shrink-0 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Fuel size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-slate-800 dark:text-white whitespace-nowrap tracking-tighter leading-none italic">CGF</span>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mt-1">Nexus Frota</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenuItems.map(item => renderMenuItem(item))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsDarkMode(false)}
                className={`p-2 rounded-lg transition-colors ${!isDarkMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <Sun size={18} />
              </button>
              <button 
                onClick={() => setIsDarkMode(true)}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <Moon size={18} />
              </button>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="flex items-center space-x-2 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">{user?.displayName || 'Gestor'}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">{user?.email || 'Sem e-mail'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

