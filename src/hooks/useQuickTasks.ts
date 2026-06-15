import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { toast } from 'sonner';

export type QuickTaskStatus = "A Fazer" | "Em Andamento" | "Em Revisão" | "Concluído";

export interface QuickTask {
  id: string;
  date: string;
  description: string;
  responsible: string;
  sector: string;
  status: QuickTaskStatus;
  deadline: string;
  createdAt: any;
  updatedAt: any;
}

export interface QuickTaskLog {
  id: string;
  taskId: string;
  taskDescription: string;
  actionType: "create" | "update" | "delete";
  details: string;
  userEmail: string;
  userName: string;
  timestamp: any;
}

export const useQuickTasks = () => {
  const [quickTasks, setQuickTasks] = useState<QuickTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Order by date descending first, then by createdAt descending
    const q = query(collection(db, 'kanban_quick_tasks'), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QuickTask[];
      
      setQuickTasks(list);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching quick tasks:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createQuickTask = async (task: Omit<QuickTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'kanban_quick_tasks'), {
        ...task,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Registrar no histórico de logs
      try {
        await addDoc(collection(db, 'kanban_quick_tasks_logs'), {
          taskId: docRef.id,
          taskDescription: task.description,
          actionType: 'create',
          details: `Criou a pendência para o setor [${task.sector || 'Geral'}] atribuída a [${task.responsible || 'Sem responsável'}].`,
          userEmail: auth.currentUser?.email || 'anonimo@compesa.com.br',
          userName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Usuário',
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        console.error("Erro ao registrar log de criação:", logErr);
      }

      toast.success("Pendência rápida criada com sucesso!");
    } catch (error: any) {
      console.error("Error creating quick task:", error);
      toast.error(`Erro ao criar pendência: ${error.message || "Erro desconhecido"}`);
    }
  };

  const updateQuickTask = async (task: Partial<QuickTask> & { id: string }) => {
    try {
      const { id, ...data } = task;
      const oldTask = quickTasks.find(t => t.id === id);
      const docRef = doc(db, 'kanban_quick_tasks', id);
      
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });

      // Construir mensagem de log representativa
      const changes: string[] = [];
      if (data.status && oldTask && oldTask.status !== data.status) {
        changes.push(`status alterado de "${oldTask.status}" para "${data.status}"`);
      } else if (data.status) {
        changes.push(`status alterado para "${data.status}"`);
      }
      
      if (data.responsible && oldTask && oldTask.responsible !== data.responsible) {
        changes.push(`responsáveis alterados para "[${data.responsible}]"`);
      } else if (data.responsible) {
        changes.push(`responsáveis alterados para "[${data.responsible}]"`);
      }

      if (data.sector && oldTask && oldTask.sector !== data.sector) {
        changes.push(`setor alterado de "${oldTask.sector}" para "${data.sector}"`);
      } else if (data.sector) {
        changes.push(`setor alterado para "${data.sector}"`);
      }

      if (data.description && oldTask && oldTask.description !== data.description) {
        changes.push(`descrição alterada para "${data.description}"`);
      }

      if (data.deadline && oldTask && oldTask.deadline !== data.deadline) {
        changes.push(`prazo alterado de "${oldTask.deadline}" para "${data.deadline}"`);
      }

      const details = changes.length > 0 ? `Atualizou: ${changes.join(', ')}` : "Atualizou dados da pendência";

      // Registrar no histórico de logs
      try {
        await addDoc(collection(db, 'kanban_quick_tasks_logs'), {
          taskId: id,
          taskDescription: data.description || oldTask?.description || "",
          actionType: 'update',
          details,
          userEmail: auth.currentUser?.email || 'anonimo@compesa.com.br',
          userName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Usuário',
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        console.error("Erro ao registrar log de atualização:", logErr);
      }

      toast.success("Pendência atualizada!");
    } catch (error: any) {
      console.error("Error updating quick task:", error);
      toast.error(`Erro ao atualizar pendência: ${error.message || "Erro desconhecido"}`);
    }
  };

  const deleteQuickTask = async (id: string) => {
    try {
      const oldTask = quickTasks.find(t => t.id === id);
      await deleteDoc(doc(db, 'kanban_quick_tasks', id));

      // Registrar no histórico de logs
      try {
        await addDoc(collection(db, 'kanban_quick_tasks_logs'), {
          taskId: id,
          taskDescription: oldTask?.description || "",
          actionType: 'delete',
          details: `Excluiu a pendência: "${oldTask?.description || ''}"`,
          userEmail: auth.currentUser?.email || 'anonimo@compesa.com.br',
          userName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Usuário',
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        console.error("Erro ao registrar log de exclusão:", logErr);
      }

      toast.success("Pendência excluída!");
    } catch (error: any) {
      console.error("Error deleting quick task:", error);
      toast.error(`Erro ao excluir pendência: ${error.message || "Erro desconhecido"}`);
    }
  };

  return { quickTasks, isLoading, createQuickTask, updateQuickTask, deleteQuickTask };
};

export const useQuickTaskLogs = () => {
  const [logs, setLogs] = useState<QuickTaskLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    // Coleta os últimos 150 registros de log ordenados por tempo decrescente
    const q = query(
      collection(db, 'kanban_quick_tasks_logs'),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QuickTaskLog[];
      setLogs(list);
      setIsLoadingLogs(false);
    }, (error) => {
      console.error("Error fetching quick task logs:", error);
      setIsLoadingLogs(false);
    });

    return () => unsubscribe();
  }, []);

  return { logs, isLoadingLogs };
};
