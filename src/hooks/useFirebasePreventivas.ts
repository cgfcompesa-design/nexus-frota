import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";

export interface FirebasePreventiveData {
  placa: string;
  odometroRevisao: number;
  revisaoPrevista: number;
  dataRevisao: string;
  locadora: string;
  updatedAt?: any;
}

export function useFirebasePreventivas() {
  const queryClient = useQueryClient();

  const query = useQuery<Record<string, FirebasePreventiveData>>({
    queryKey: ["firebase-preventivas"],
    queryFn: async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "preventiva_locadoras"));
        const dataMap: Record<string, FirebasePreventiveData> = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const cleanPlaca = doc.id.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
          dataMap[cleanPlaca] = {
            placa: cleanPlaca,
            odometroRevisao: Number(data.odometroRevisao || 0),
            revisaoPrevista: Number(data.revisaoPrevista || 10000),
            dataRevisao: data.dataRevisao || "",
            locadora: data.locadora || "",
            updatedAt: data.updatedAt,
          };
        });
        return dataMap;
      } catch (error) {
        console.error("Erro ao carregar preventivas do Firebase:", error);
        handleFirestoreError(error, "list", "preventiva_locadoras");
        return {};
      }
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FirebasePreventiveData) => {
      try {
        const cleanPlaca = data.placa.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
        const docRef = doc(db, "preventiva_locadoras", cleanPlaca);
        await setDoc(docRef, {
          placa: cleanPlaca,
          odometroRevisao: data.odometroRevisao,
          revisaoPrevista: data.revisaoPrevista,
          dataRevisao: data.dataRevisao,
          locadora: data.locadora.toUpperCase().trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Erro ao salvar preventiva no Firebase:", error);
        handleFirestoreError(error, "write", `preventiva_locadoras/${data.placa}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firebase-preventivas"] });
    },
  });

  return {
    data: query.data || {},
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
