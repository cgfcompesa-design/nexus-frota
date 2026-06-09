import { AlertCircle, RefreshCw, Upload, ShieldAlert, FileCode } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 antialiased font-sans">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-2xl">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-amber-100 p-2.5 rounded-xl border border-amber-200">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                COMPESA - Alerta de Workspace Vazio
              </h2>
              <p className="text-xs text-slate-500 font-mono tracking-wide mt-0.5">
                STATUS: DESCONECTADO OU LIMPO
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Identificamos que todos os arquivos de código-fonte do aplicativo de gestão de frotas (incluindo{' '}
            <code className="text-rose-600 font-mono text-xs bg-rose-50 px-1 py-0.5 rounded">package.json</code>,{' '}
            <code className="text-rose-600 font-mono text-xs bg-rose-50 px-1 py-0.5 rounded">src/App.tsx</code> e os componentes de frotas, telemetria e combustível) foram deletados do disco do workspace.
          </p>

          {/* Diagnostic Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 space-y-3.5">
            <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center space-x-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
              <span>Diagnóstico Técnico</span>
            </h4>
            <div className="text-xs font-mono text-slate-700 bg-slate-100 border border-slate-200 p-3 rounded-lg overflow-x-auto max-h-40 whitespace-pre-wrap leading-relaxed">
              {"npm error enoent Could not read package.json\nENOENT: no such file or directory, open '/package.json'"}
            </div>
          </div>

          {/* Recommendations list */}
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-semibold text-slate-900">Como resolver esse problema?</h3>
            <ul className="text-sm text-slate-600 space-y-3">
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5 bg-blue-100 p-1 rounded">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span>
                  <strong>Restaurar Modificações / Reimportar:</strong> Use o recurso de sincronização de repositório ou de restauração do editor para recuperar a estrutura original dos arquivos.
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5 bg-indigo-100 p-1 rounded">
                  <Upload className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span>
                  <strong>Importação Manual:</strong> Se possuir um backup local ou repositório GitHub do projeto, você pode reimportá-lo para reatribuir todos os painéis e regras de combustível.
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5 bg-slate-100 p-1 rounded">
                  <FileCode className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <span>
                  <strong>Novo Projeto (Começar do Zero):</strong> Criamos este scaffold temporário que compila corretamente para que o servidor de visualização volte a ficar online e você possa programar.
                </span>
              </li>
            </ul>
          </div>

          {/* Footer Area */}
          <div className="text-center pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-mono">
              Companhia Pernambucana de Saneamento • COMPESA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
