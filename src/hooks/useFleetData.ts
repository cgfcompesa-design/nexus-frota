import { useQuery } from "@tanstack/react-query";
import { 
  fetchFleetData, 
  fetchMaintenanceData, 
  fetchPreventiveMaintenanceData, 
  fetchFuelData, 
  fetchTitulosDespesasData,
  fetchHistoricoManutencao,
  fetchOrcamentos,
  fetchCustosDetalhes,
  fetchRegularizacaoData,
  fetchControleOperacional,
  fetchSpecialHoursData
} from "../services/fleetService";

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: fetchFleetData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

export function useRegularizacaoData() {
  return useQuery({
    queryKey: ["regularizacao"],
    queryFn: fetchRegularizacaoData,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useMaintenanceData() {
  return useQuery({
    queryKey: ["maintenance"],
    queryFn: fetchMaintenanceData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

export function usePreventiveMaintenanceData() {
  return useQuery({
    queryKey: ["preventive-maintenance"],
    queryFn: fetchPreventiveMaintenanceData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useFuelData() {
  return useQuery({
    queryKey: ["fuel"],
    queryFn: fetchFuelData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

export function useAutonomiaData() {
  return useQuery({
    queryKey: ["autonomia"],
    queryFn: async () => {
      // Logic to fetch autonomy data if it's in a separate sheet
      return [];
    },
  });
}

export function useAutonomiaPadraoData() {
  return useQuery({
    queryKey: ["autonomia-padrao"],
    queryFn: async () => {
      return [];
    },
  });
}

export function useMaintenanceCostData() {
  return useQuery({
    queryKey: ["maintenance-cost"],
    queryFn: fetchTitulosDespesasData,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

export function useHistoricoManutencao() {
  return useQuery({
    queryKey: ["historico-manutencao"],
    queryFn: fetchHistoricoManutencao,
    staleTime: 10 * 60 * 1000,
  });
}

export function useOrcamentos() {
  return useQuery({
    queryKey: ["orcamentos"],
    queryFn: fetchOrcamentos,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCustosDetalhes() {
  return useQuery({
    queryKey: ["custos-detalhes"],
    queryFn: fetchCustosDetalhes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useControleOperacional() {
  return useQuery({
    queryKey: ["controle-operacional"],
    queryFn: fetchControleOperacional,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchInterval: 5 * 60 * 1000, 
  });
}

export function useSpecialHoursData() {
  return useQuery({
    queryKey: ["special-hours"],
    queryFn: fetchSpecialHoursData,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
