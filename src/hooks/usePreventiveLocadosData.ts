import { useQuery } from "@tanstack/react-query";
import { fetchPreventiveMaintenanceData } from "../services/fleetService";

export interface PreventiveLocado {
  placa: string;
  odometroRevisao: string;
  revisaoPrevista: string;
  dataRevisao: string;
  odometroAtual: string;
  statusRevisao: string;
}

export function usePreventiveLocadosData() {
  return useQuery({
    queryKey: ["preventive-locados"],
    queryFn: async () => {
      const data = await fetchPreventiveMaintenanceData();
      return data.map(item => ({
        placa: item.PLACA || "",
        odometroRevisao: item["ODÔMETRO REVISÃO"] || item["ODOMETRO REVISAO"] || "",
        revisaoPrevista: item["REVISÃO PREVISTA"] || item["REVISAO PREVISTA"] || "",
        dataRevisao: item["DATA REVISÃO"] || item["DATA REVISAO"] || "",
        odometroAtual: item["ODÔMETRO ATUAL"] || item["ODOMETRO ATUAL"] || "",
        statusRevisao: item["STATUS REVISÃO"] || item["STATUS REVISAO"] || "",
      }));
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}
