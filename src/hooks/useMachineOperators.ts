import { useQuery } from "@tanstack/react-query";
import { fetchMachineOperatorsData } from "../services/fleetService";

export interface MachineOperator {
  nome: string;
  gerencia: string;
  curso: string;
  matricula: string;
  maquina: string;
  __raw: string[];
  [key: string]: any;
}

export function useMachineOperators() {
  return useQuery<MachineOperator[]>({
    queryKey: ["machine-operators"],
    queryFn: fetchMachineOperatorsData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
