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
import { db, dbNexus } from "@/lib/firebase";
import { MachineSupplyAssignment } from "@/types";

export function useMachineSupplyAssignments() {
  return useQuery({
    queryKey: ["machine-supply-assignments"],
    queryFn: async () => {
      let dataDefault: MachineSupplyAssignment[] = [];
      try {
        const q1 = query(collection(db, "machine_supply_assignments"));
        const snapshot1 = await getDocs(q1);
        dataDefault = snapshot1.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MachineSupplyAssignment[];
      } catch (err) {
        console.error("Error loading machine supply assignments from default database:", err);
      }

      let dataNexus: MachineSupplyAssignment[] = [];
      try {
        const q2 = query(collection(dbNexus, "machine_supply_assignments"));
        const snapshot2 = await getDocs(q2);
        dataNexus = snapshot2.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MachineSupplyAssignment[];
      } catch (err) {
        console.error("Error loading machine supply assignments from Nexus database:", err);
      }

      // Map to store merged assignments by transactionId
      const mergedMap = new Map<string, MachineSupplyAssignment>();

      const addToMap = (item: MachineSupplyAssignment, sourceDb: string) => {
        const txId = item.transactionId || item.id;
        if (!txId) return;

        const existing = mergedMap.get(txId);
        if (!existing) {
          mergedMap.set(txId, { ...item, sourceDb });
          return;
        }

        // Compare timestamps to choose the most up-to-date one
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

        const existingTime = getTime(existing.updatedAt);
        const incomingTime = getTime(item.updatedAt);

        // If the incoming item is more recent or has more fields filled, merge and update
        if (incomingTime > existingTime) {
          mergedMap.set(txId, { ...existing, ...item, sourceDb });
        } else {
          // If the existing one is more recent but maybe lacks some keys, we can merge fields
          mergedMap.set(txId, { ...item, ...existing });
        }
      };

      dataDefault.forEach(item => addToMap(item, "default"));
      dataNexus.forEach(item => addToMap(item, "nexus"));

      const data = Array.from(mergedMap.values());
      
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
      // We will perform the save operation on BOTH db and dbNexus
      const saveInDb = async (targetDb: any, dbName: string) => {
        try {
          const q = query(
            collection(targetDb, "machine_supply_assignments"), 
            where("transactionId", "==", assignment.transactionId)
          );
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const existingDoc = snapshot.docs[0];
            await updateDoc(doc(targetDb, "machine_supply_assignments", existingDoc.id), {
              ...assignment,
              updatedAt: serverTimestamp(),
            });
            return { id: existingDoc.id, success: true, dbName };
          } else {
            const docRef = await addDoc(collection(targetDb, "machine_supply_assignments"), {
              ...assignment,
              updatedAt: serverTimestamp(),
            });
            return { id: docRef.id, success: true, dbName };
          }
        } catch (err) {
          console.error(`Failed to save assignment in ${dbName}:`, err);
          return { success: false, error: err, dbName };
        }
      };

      const [resDefault, resNexus] = await Promise.all([
        saveInDb(db, "default"),
        saveInDb(dbNexus, "nexus")
      ]);

      if (!resDefault.success && !resNexus.success) {
        throw new Error("Failed to save assignment to both databases.");
      }

      // Return the ID from whichever succeeded (preferring default)
      const primaryId = resDefault.success ? resDefault.id : resNexus.id;
      return { id: primaryId, ...assignment };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-supply-assignments"] });
    },
  });
}
