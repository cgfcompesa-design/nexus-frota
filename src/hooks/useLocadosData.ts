
import { useQuery } from "@tanstack/react-query";
import { fetchLocadosData } from "../services/fleetService";

export interface LocadoData {
  diretoria: string;
  gerencia: string;
  placa: string;
  marca: string;
  modelo: string;
  propriedade: string;
  diasParados: number;
  mesAno: string;
}

export function useLocadosData() {
  return useQuery({
    queryKey: ["locados"],
    queryFn: fetchLocadosData,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}
