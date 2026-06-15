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
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export type QuickTaskStatus = "A Fazer" | "Em Andamento" | "Em Revisão" | "Concluído";

export interface QuickTask {
  id: string;
  date: string;
  description: string;
  responsible: string;
  status: QuickTaskStatus;
  deadline: string;
  createdAt: any;
  updatedAt: any;
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
      
      // Sort: place late deadline/uncompleted tasks with order, or just date-desc
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
      await addDoc(collection(db, 'kanban_quick_tasks'), {
        ...task,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Pendência rápida criada com sucesso!");
    } catch (error: any) {
      console.error("Error creating quick task:", error);
      toast.error(`Erro ao criar pendência: ${error.message || "Erro desconhecido"}`);
    }
  };

  const updateQuickTask = async (task: Partial<QuickTask> & { id: string }) => {
    try {
      const { id, ...data } = task;
      const docRef = doc(db, 'kanban_quick_tasks', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success("Pendência atualizada!");
    } catch (error: any) {
      console.error("Error updating quick task:", error);
      toast.error(`Erro ao atualizar pendência: ${error.message || "Erro desconhecido"}`);
    }
  };

  const deleteQuickTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'kanban_quick_tasks', id));
      toast.success("Pendência excluída!");
    } catch (error: any) {
      console.error("Error deleting quick task:", error);
      toast.error(`Erro ao excluir pendência: ${error.message || "Erro desconhecido"}`);
    }
  };

  return { quickTasks, isLoading, createQuickTask, updateQuickTask, deleteQuickTask };
};
