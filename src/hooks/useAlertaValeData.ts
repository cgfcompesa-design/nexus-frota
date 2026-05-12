
import { useQuery } from "@tanstack/react-query";

export function useAlertaValeData() {
  return useQuery({
    queryKey: ["alerta-vale"],
    queryFn: async () => {
      // Mock or fetch from service if exists
      return [];
    },
  });
}
