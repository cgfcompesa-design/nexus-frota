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

export interface Indicator {
  id: string;
  name: string;
  section: string;
  subsection?: string;
  unit: string;
  target: number;
  current_value: number;
  responsible_id?: string;
  order?: number;
}

export const useIndicators = () => {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'indicators'), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Indicator[];
      setIndicators(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching indicators:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createIndicator = async (indicator: Omit<Indicator, 'id'>) => {
    await addDoc(collection(db, 'indicators'), {
      ...indicator,
      createdAt: serverTimestamp()
    });
  };

  const updateIndicator = async (indicator: Partial<Indicator> & { id: string }) => {
    const { id, ...data } = indicator;
    await updateDoc(doc(db, 'indicators', id), data);
  };

  const deleteIndicator = async (id: string) => {
    await deleteDoc(doc(db, 'indicators', id));
  };

  return { indicators, isLoading, createIndicator, updateIndicator, deleteIndicator };
};
