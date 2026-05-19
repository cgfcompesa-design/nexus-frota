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

export type TaskStatus = "todo" | "progress" | "review" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  sector?: string;
  priority_color?: string;
  activity_type?: string;
  responsibles?: { id: string; name: string }[];
  deadline?: string;
  updates?: {
    id: string;
    text: string;
    responsible: { id: string; name: string };
    date: any;
  }[];
  createdAt: any;
  updatedAt: any;
}

export const useKanbanData = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'kanban_tasks'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(tasksData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createTask = async (task: any) => {
    try {
      const { id, createdAt, updatedAt, ...data } = task;
      await addDoc(collection(db, 'kanban_tasks'), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Atividade criada!");
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error(`Erro ao criar: ${error.message || "Erro desconhecido"}`);
    }
  };

  const updateTask = async (task: Partial<Task> & { id: string }) => {
    try {
      const { id, ...data } = task;
      const taskRef = doc(db, 'kanban_tasks', id);
      await updateDoc(taskRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success("Atividade atualizada!");
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error(`Erro ao atualizar: ${error.message || "Erro desconhecido"}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'kanban_tasks', id));
      toast.success("Atividade removida!");
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error(`Erro ao remover: ${error.message || "Erro desconhecido"}`);
    }
  };

  return { tasks, isLoading, createTask, updateTask, deleteTask };
};
