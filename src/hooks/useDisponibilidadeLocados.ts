import { useQuery } from "@tanstack/react-query";
import { useLocadosData } from "./useLocadosData";

const ASSETS_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSFg3m2gRlhFtmKMTDcVQW3YmIZXOhlWCN6693HLNHH9kR7GJ7mMayr2U35OOSze6VfJTGOB0GCJsYP/pub?gid=1689333411&single=true&output=csv";

const EXCLUDED_PROPRIEDADES = [
  "COMPESA",
  "COMPESAIPA",
  "SERVITIUM",
  "OTL",
  "CONSORCIO"
];

const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/gi, "")
    .trim();
};

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
        
        const propriedade = values[10] || "";
        const titularidade = (values[27] || "").toUpperCase().trim();
        const statusOperacional = (values[23] || "").toUpperCase().trim();
        
        // Filtrar: Status Operacional = OPERACIONAL, Propriedade não está na lista de exclusão, Titularidade = TITULAR
        const isOperacional = statusOperacional === "OPERACIONAL";
        const normProp = normalizeString(propriedade);
        const isPropriedadeValida = normProp && !EXCLUDED_PROPRIEDADES.includes(normProp);
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
  
  // Total de dias parados (numerador de indisponibilidade):
  // TotalDiasParados = Σ (Dias Parados de cada linha com placa válida)
  const totalDiasParados = locados.reduce((sum, item) => {
    const rawPlaca = String(item.placa || "").trim();
    const cleanPlaca = rawPlaca.toUpperCase().replace(/[^A-Z0-9]/g, "");
    
    // A plate in Brazil is valid if it has exactly 7 alphanumeric characters
    const isPlacaValida = cleanPlaca.length === 7;
    
    if (isPlacaValida) {
      return sum + (item.diasParados || 0);
    }
    return sum;
  }, 0);
  
  // Disponibilidade = ((Veículos − TotalDiasParados) / Veículos) × 100
  const disponibilidade = veiculosDisponiveis > 0 
    ? ((veiculosDisponiveis - totalDiasParados) / veiculosDisponiveis) * 100 
    : 0;
  
  // DisponibilidadeFinal = MAX(0, Disponibilidade)
  const disponibilidadeFinal = Math.max(0, disponibilidade);
  
  return {
    disponibilidade: disponibilidadeFinal,
    veiculosDisponiveis,
    totalDiasParados,
    isLoading: isLoadingVeiculos || isLoadingLocados,
    metaAtingida: disponibilidadeFinal >= 100
  };
};
