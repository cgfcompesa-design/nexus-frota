import { useQuery } from "@tanstack/react-query";

export function useVeiculosLocadosDisponiveis() {
  return useQuery({
    queryKey: ["veiculos-locados-disponiveis"],
    queryFn: async () => {
      // Valor base para cálculo de disponibilidade (ex: total de veículos * dias no mês)
      // Ajuste conforme necessário ou busque de uma fonte dinâmica
      return 350; 
    },
  });
}
