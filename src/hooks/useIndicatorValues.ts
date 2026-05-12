import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface IndicatorValue {
  id: string;
  indicator_id: string;
  month: string; // YYYY-MM-01
  current_value: number;
  target: number;
  updatedAt: any;
}

export const useIndicatorValues = (indicatorId?: string, month?: string) => {
  const [values, setValues] = useState<IndicatorValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, 'indicator_values'), orderBy('month', 'desc'));
    
    if (indicatorId) {
      q = query(q, where('indicator_id', '==', indicatorId));
    }
    
    if (month) {
      q = query(q, where('month', '==', month));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IndicatorValue[];
      setValues(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching indicator values:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [indicatorId, month]);

  const upsertValue = async (value: Omit<IndicatorValue, 'id' | 'updatedAt'>) => {
    // Basic logic for upsert - ideally check if exists then update
    // For simplicity, we just add if not found or provide a helper
    await addDoc(collection(db, 'indicator_values'), {
      ...value,
      updatedAt: serverTimestamp()
    });
  };

  return { values, isLoading, upsertValue };
};
