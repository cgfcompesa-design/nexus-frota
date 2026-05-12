import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { Fuel, AlertTriangle, TrendingDown, Target } from 'lucide-react';

const compareData = [
  { vehicle: 'ABC-1234', actual: 12.5, target: 14.0, diff: -1.5 },
  { vehicle: 'XYZ-5678', actual: 11.2, target: 10.5, diff: 0.7 },
  { vehicle: 'DEF-9012', actual: 13.8, target: 14.0, diff: -0.2 },
  { vehicle: 'GHI-3456', actual: 9.8, target: 11.5, diff: -1.7 },
  { vehicle: 'JKL-7890', actual: 14.5, target: 13.0, diff: 1.5 },
];

export default function FuelCompare() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">Comparativo de Combustível</h1>
          <p className="text-slate-500 text-sm">Performance Real vs. Meta por Veículo</p>
        </div>
        <div className="flex space-x-2">
          <button className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300">Exportar PDF</button>
          <button className="bg-indigo-600 px-4 py-2 rounded-lg text-sm font-semibold text-white">Novo Benchmark</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
              <Target className="mr-2 text-indigo-500" size={20} />
              Eficiência por Veículo (Km/l)
            </h3>
            <div className="flex items-center space-x-4 text-xs font-medium">
              <div className="flex items-center"><div className="w-3 h-3 bg-indigo-500 rounded-full mr-1"></div> Real</div>
              <div className="flex items-center"><div className="w-3 h-3 bg-slate-300 rounded-full mr-1"></div> Meta</div>
            </div>
          </div>
          <div style={{ height: '400px', width: '100%', position: 'relative' }} className="overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis dataKey="vehicle" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }} width={80} />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="target" fill="#E2E8F0" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false} />
                <Bar dataKey="actual" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30">
            <div className="flex items-center text-rose-600 mb-4 font-bold uppercase text-xs tracking-wider">
              <AlertTriangle className="mr-2" size={16} />
              Abaixo da Meta
            </div>
            <div className="space-y-4">
              {compareData.filter(v => v.diff < 0).map((v, i) => (
                <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-rose-100 dark:border-rose-900/20">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{v.vehicle}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-500">{v.diff.toFixed(1)} km/l</p>
                    <p className="text-[10px] text-slate-400 uppercase">Diferença</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center text-emerald-600 mb-4 font-bold uppercase text-xs tracking-wider">
              <TrendingDown className="mr-2 rotate-180" size={16} />
              Acima da Meta
            </div>
            <div className="space-y-4">
              {compareData.filter(v => v.diff > 0).map((v, i) => (
                <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{v.vehicle}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-500">+{v.diff.toFixed(1)} km/l</p>
                    <p className="text-[10px] text-slate-400 uppercase">Eficiência</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
