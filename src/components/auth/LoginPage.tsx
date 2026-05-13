import React, { useState } from 'react';
import { auth, googleProvider, db, handleFirestoreError } from '../../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Fuel, Lock, Mail, Chrome, UserCheck } from 'lucide-react';

interface LoginPageProps {
  setView: (view: string) => void;
}

export default function LoginPage({ setView }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Create user profile
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.email?.split('@')[0],
            role: 'Visualizador',
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, 'write', `users/${cred.user.uid}`);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      } catch (error) {
        handleFirestoreError(error, 'get', `users/${cred.user.uid}`);
      }

      if (userDoc && !userDoc.exists()) {
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName,
            role: 'Visualizador',
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, 'write', `users/${cred.user.uid}`);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex flex-col items-center justify-center mb-8">
            <img 
              src="/src/assets/images/regenerated_image_1778593500523.png" 
              alt="Nexus BI Logo" 
              className="h-28 w-auto mb-6" 
              onError={(e) => {
                e.currentTarget.src = "https://placehold.co/150x150/6366f1/ffffff?text=NEXUS+BI";
              }}
            />
            <div className="flex flex-col items-center">
              <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter text-center italic uppercase">Ativos</h1>
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mt-1 italic">Gestão Estratégica</p>
            </div>
          </div>

          <div className="flex flex-col space-y-3 mb-8">
            <button 
              onClick={() => setView('resumo')}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-3 rounded-xl hover:bg-indigo-100 transition-all font-black text-[10px] uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50"
            >
              <UserCheck size={16} />
              <span>Acesso Visitante (Modo BI)</span>
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
              <div className="relative flex justify-center text-[8px] uppercase font-black text-slate-400 tracking-widest"><span className="px-2 bg-white dark:bg-slate-900">Ou use sua conta administrativa</span></div>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-6 text-center">
            {isLogin ? 'Bem-vindo de volta' : 'Criar conta corporativa'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition-colors shadow-md"
            >
              {isLogin ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-slate-900 text-slate-500">ou</span></div>
          </div>

          <button 
            onClick={handleGoogle}
            className="w-full flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-300"
          >
            <Chrome size={18} />
            <span>Entrar com Google</span>
          </button>

          <p className="mt-8 text-center text-sm text-slate-500">
            {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 text-indigo-600 font-semibold hover:underline"
            >
              {isLogin ? 'Registe-se' : 'Faça login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
