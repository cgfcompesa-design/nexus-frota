import { useState, useEffect } from "react";
import { db, handleFirestoreError } from "../../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { UserProfile } from "../../types";
import { Users, Shield, User as UserIcon, Eye, Trash2, Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
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
        <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg">
          <Users size={24} />
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                        <span className="text-sm font-bold text-slate-800 dark:text-white uppercase truncate max-w-[200px]">
                          {user.displayName || 'N/A'}
                        </span>
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
                          user.role === 'Master' ? 'bg-indigo-100 text-indigo-600' :
                          user.role === 'Gestão' ? 'bg-emerald-100 text-emerald-600' :
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
                          className="h-8 text-[9px] font-black uppercase px-3"
                          onClick={() => handleUpdateRole(user.uid, 'Gestão')}
                        >
                          <Shield size={12} className="mr-1" /> Tornar Gestão
                        </Button>
                        <Button 
                          size="sm" 
                          variant={user.role === 'Visualizador' ? 'secondary' : 'outline'}
                          className="h-8 text-[9px] font-black uppercase px-3"
                          onClick={() => handleUpdateRole(user.uid, 'Visualizador')}
                        >
                          <Eye size={12} className="mr-1" /> Tornar Visualizador
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
