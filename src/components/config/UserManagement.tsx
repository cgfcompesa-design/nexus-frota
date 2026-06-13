import { useState, useEffect } from "react";
import { db, handleFirestoreError, auth } from "../../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { UserProfile } from "../../types";
import { Users, Shield, User as UserIcon, Eye, Trash2, Mail, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      console.log("Usuários carregados:", usersData.length);
      setUsers(usersData);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error("Erro no Snapshot de usuários:", error);
      setError(error.message);
      handleFirestoreError(error, 'list', 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateRole = async (uid: string, newRole: UserProfile['role']) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { role: newRole });
      toast.success(`Role atualizada para ${newRole}`);
    } catch (error) {
      console.error("Erro ao atualizar role:", error);
      toast.error("Erro ao atualizar role");
    }
  };

  const handleToggleLocadora = async (uid: string, currentLocadoras: string[] | undefined, locadoraName: string) => {
    try {
      const locList = currentLocadoras || [];
      const updatedList = locList.includes(locadoraName)
        ? locList.filter(l => l !== locadoraName)
        : [...locList, locadoraName];
      
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { locadoras: updatedList });
      toast.success(`Locadora ${locadoraName} atualizada para o usuário.`);
    } catch (error) {
      console.error("Erro ao atualizar locadoras do usuário:", error);
      toast.error("Erro ao atualizar locadoras.");
    }
  };

  const handleCreateMaster = async () => {
    try {
      const authUser = auth.currentUser;
      if (!authUser || authUser.email !== 'cgf.compesa@gmail.com') return;
      
      const docRef = doc(db, "users", authUser.uid);
      await setDoc(docRef, {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || 'Master User',
        role: 'Master',
        createdAt: new Date().toISOString()
      });
      toast.success("Perfil Master criado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar perfil master:", error);
      toast.error("Erro ao criar perfil master");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Gestão de Usuários</h1>
          <p className="text-slate-500 font-medium tracking-tight">Administração de níveis de acesso do Nexus Frota</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="rounded-xl font-bold text-[10px] uppercase tracking-widest border-2"
          >
            Sincronizar
          </Button>
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg">
            <Users size={24} />
          </div>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-6 text-center">
              <p className="text-rose-500 font-bold uppercase text-xs">Erro ao carregar usuários: {error}</p>
              <p className="text-slate-400 text-[10px] mt-1">Verifique as permissões no Firebase.</p>
            </div>
          )}
          
          {!error && users.length === 0 ? (
            <div className="p-12 text-center">
               <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
               <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Nenhum usuário encontrado</p>
               <p className="text-slate-300 text-[10px] uppercase font-bold mt-1">Aguardando novos cadastros...</p>
               {auth.currentUser?.email === 'cgf.compesa@gmail.com' && (
                 <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={handleCreateMaster}
                   className="mt-4 rounded-xl font-bold text-[10px] uppercase tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                 >
                   Criar meu Perfil Master
                 </Button>
               )}
            </div>
          ) : !error && (
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nível de Acesso</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Ações</th>
                </tr>
              </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <UserIcon size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 dark:text-white uppercase truncate max-w-[200px]">
                            {user.displayName || 'Usuário'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">Cadastrado em {new Date(user.createdAt).toLocaleDateString()}</span>
                          {user.role === 'LOCADORA' && (
                            <div className="mt-2 p-2 bg-slate-100/60 dark:bg-slate-800/40 rounded border border-slate-200 dark:border-slate-700/60 max-w-sm">
                              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">Locadoras Vinculadas:</span>
                              <div className="flex flex-wrap gap-1">
                                {["CS BRASIL", "LOCSERV", "LOCADORA CAXANGA", "LOCAVEL", "PBF GRAFICA"].map(loc => {
                                  const isAssigned = user.locadoras?.includes(loc);
                                  return (
                                    <button
                                      key={loc}
                                      onClick={() => handleToggleLocadora(user.uid, user.locadoras, loc)}
                                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded transition-all ${
                                        isAssigned 
                                          ? 'bg-amber-500 text-white shadow-sm font-extrabold hover:bg-amber-600' 
                                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                      }`}
                                    >
                                      {loc}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-slate-500 font-medium text-xs">
                        <Mail size={14} className="opacity-50" />
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          user.role === 'Master' ? 'bg-indigo-600 text-white shadow-sm' :
                          user.role === 'Gestão' ? 'bg-emerald-100 text-emerald-600' :
                          user.role === 'LOCADORA' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button 
                          size="sm" 
                          variant={user.role === 'Gestão' ? 'secondary' : 'outline'}
                          className={`h-8 text-[9px] font-black uppercase px-3 ${user.role === 'Gestão' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : ''}`}
                          onClick={() => handleUpdateRole(user.uid, 'Gestão')}
                        >
                          <Shield size={12} className="mr-1" /> Gestor
                        </Button>
                        <Button 
                          size="sm" 
                          variant={user.role === 'LOCADORA' ? 'secondary' : 'outline'}
                          className={`h-8 text-[9px] font-black uppercase px-3 ${user.role === 'LOCADORA' ? 'bg-amber-500 text-white hover:bg-amber-600 border-amber-300' : ''}`}
                          onClick={() => handleUpdateRole(user.uid, 'LOCADORA')}
                        >
                          <Shield size={12} className="mr-1" /> Locadora
                        </Button>
                        <Button 
                          size="sm" 
                          variant={user.role === 'Visualizador' ? 'secondary' : 'outline'}
                          className={`h-8 text-[9px] font-black uppercase px-3 ${user.role === 'Visualizador' ? 'bg-slate-200 text-slate-700' : ''}`}
                          onClick={() => handleUpdateRole(user.uid, 'Visualizador')}
                        >
                          <Eye size={12} className="mr-1" /> Visitante
                        </Button>
                        {/* Only allow Master users to promote others to Master if needed, but usually it's just for the primary email */}
                         <Button 
                          size="sm" 
                          variant={user.role === 'Master' ? 'secondary' : 'outline'}
                          className={`h-8 text-[9px] font-black uppercase px-3 ${user.role === 'Master' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}`}
                          onClick={() => handleUpdateRole(user.uid, 'Master')}
                        >
                          <Lock size={12} className="mr-1" /> Master
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
