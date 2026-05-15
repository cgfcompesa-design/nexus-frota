import { useQuery } from "@tanstack/react-query";
import { fetchFleetData } from "../services/fleetService";

export function useVeiculosLocadosDisponiveis() {
  return useQuery({
    queryKey: ["veiculos-locados-disponiveis"],
    queryFn: async () => {
      const assets = await fetchFleetData();
      // Total capacity should consider all Locados in the fleet
      const totalLocados = assets.filter(a => 
        a.PROPRIEDADE_TIPO === 'Locado'
      );
      return totalLocados.length;
    },
    staleTime: 5 * 60 * 1000,
  });
}
