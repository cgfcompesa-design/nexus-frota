import { useQuery } from "@tanstack/react-query";
import { useLocadosData } from "./useLocadosData";

const ASSETS_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSFg3m2gRlhFtmKMTDcVQW3YmIZXOhlWCN6693HLNHH9kR7GJ7mMayr2U35OOSze6VfJTGOB0GCJsYP/pub?gid=1689333411&single=true&output=csv";

const EXCLUDED_PROPRIEDADES = [
  "COMPESA",
  "COMPESA - IPA",
  "SERVITIUM",
  "OTL",
  "CONSORCIO"
];

const fetchCSVWithRetry = async (url: string, retries = 3): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return "";
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const useVeiculosLocadosDisponiveis = () => {
  return useQuery<number>({
    queryKey: ["veiculos-locados-disponiveis"],
    queryFn: async () => {
      const csvText = await fetchCSVWithRetry(ASSETS_API);
      const lines = csvText.split("\n");
      
      // Coluna K (índice 10) = Propriedade
      // Coluna AB (índice 27) = Titularidade
      // Coluna X (índice 23) = Status Operacional
      
      let count = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const values = parseCsvLine(line);
        
        const propriedade = (values[10] || "").toUpperCase().trim();
        const titularidade = (values[27] || "").toUpperCase().trim();
        const statusOperacional = (values[23] || "").toUpperCase().trim();
        
        // Filtrar: Status Operacional = OPERACIONAL, Propriedade não está na lista de exclusão, Titularidade = TITULAR
        const isOperacional = statusOperacional === "OPERACIONAL";
        const isPropriedadeValida = !EXCLUDED_PROPRIEDADES.some(p => propriedade === p.toUpperCase());
        const isTitular = titularidade === "TITULAR";
        
        if (isOperacional && isPropriedadeValida && isTitular) {
          count++;
        }
      }
      
      return count;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
};

export const useDisponibilidadeLocados = () => {
  const { data: veiculosDisponiveis = 0, isLoading: isLoadingVeiculos } = useVeiculosLocadosDisponiveis();
  const { data: locados = [], isLoading: isLoadingLocados } = useLocadosData();
  
  const totalDiasParados = locados.reduce((sum, item) => sum + item.diasParados, 0);
  
  // Cálculo: (Total de Veículos Disponíveis - Dias Total Parados) / Total de Veículos Disponíveis * 100
  // Nota: O cálculo considera que cada dia parado representa 1 "unidade" de indisponibilidade
  const disponibilidade = veiculosDisponiveis > 0 
    ? ((veiculosDisponiveis - totalDiasParados) / veiculosDisponiveis) * 100 
    : 0;
  
  // Garantir que não seja negativo
  const disponibilidadeFinal = Math.max(0, disponibilidade);
  
  return {
    disponibilidade: disponibilidadeFinal,
    veiculosDisponiveis,
    totalDiasParados,
    isLoading: isLoadingVeiculos || isLoadingLocados,
    metaAtingida: disponibilidadeFinal >= 100
  };
};
