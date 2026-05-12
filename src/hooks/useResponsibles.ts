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

export interface Responsible {
  id: string;
  name: string;
  email?: string;
  whatsapp?: string;
  createdAt: any;
}

export const useResponsibles = () => {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'kanban_responsibles'), orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const responsiblesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Responsible[];
      setResponsibles(responsiblesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching responsibles:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createResponsible = async (responsible: Omit<Responsible, 'id' | 'createdAt'>) => {
    try {
      await addDoc(collection(db, 'kanban_responsibles'), {
        ...responsible,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating responsible:", error);
    }
  };

  const updateResponsible = async (responsible: Partial<Responsible> & { id: string }) => {
    try {
      const { id, ...data } = responsible;
      const respRef = doc(db, 'kanban_responsibles', id);
      await updateDoc(respRef, {
        ...data
      });
    } catch (error) {
      console.error("Error updating responsible:", error);
    }
  };

  const deleteResponsible = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'kanban_responsibles', id));
    } catch (error) {
      console.error("Error deleting responsible:", error);
    }
  };

  return { responsibles, isLoading, createResponsible, updateResponsible, deleteResponsible };
};
