import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MachineSupplyAssignment } from "@/types";

export function useMachineSupplyAssignments() {
  return useQuery({
    queryKey: ["machine-supply-assignments"],
    queryFn: async () => {
      const q = query(collection(db, "machine_supply_assignments"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MachineSupplyAssignment[];
      
      // Sort in-memory instead of requiring a Firestore index
      return data.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          }
          return 0;
        };
        return getTime(b.updatedAt) - getTime(a.updatedAt);
      });
    },
  });
}

export function useSaveMachineAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignment: Partial<MachineSupplyAssignment> & { transactionId: string }) => {
      // Check if assignment already exists for this transaction
      const q = query(
        collection(db, "machine_supply_assignments"), 
        where("transactionId", "==", assignment.transactionId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        await updateDoc(doc(db, "machine_supply_assignments", existingDoc.id), {
          ...assignment,
          updatedAt: serverTimestamp(),
        });
        return { id: existingDoc.id, ...assignment };
      } else {
        const docRef = await addDoc(collection(db, "machine_supply_assignments"), {
          ...assignment,
          updatedAt: serverTimestamp(),
        });
        return { id: docRef.id, ...assignment };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-supply-assignments"] });
    },
  });
}
