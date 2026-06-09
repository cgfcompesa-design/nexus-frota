import { useMemo } from "react";
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

export interface VeiculosLocadosDisponiveisResponse {
  count: number;
  plates: string[];
}

export const useVeiculosLocadosDisponiveis = () => {
  return useQuery<VeiculosLocadosDisponiveisResponse>({
    queryKey: ["veiculos-locados-disponiveis"],
    queryFn: async () => {
      const csvText = await fetchCSVWithRetry(ASSETS_API);
      const lines = csvText.split("\n");
      
      // Coluna G (índice 6) = Placa
      // Coluna K (índice 10) = Propriedade
      // Coluna AB (índice 27) = Titularidade
      // Coluna X (índice 23) = Status Operacional
      
      const plates: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const values = parseCsvLine(line);
        
        const placaRaw = values[6] || "";
        const propriedade = values[10] || "";
        const titularidade = (values[27] || "").toUpperCase().trim();
        const statusOperacional = (values[23] || "").toUpperCase().trim();
        
        // Filtrar: Status Operacional = OPERACIONAL, Propriedade não está na lista de exclusão, Titularidade = TITULAR
        const isOperacional = statusOperacional === "OPERACIONAL";
        const normProp = normalizeString(propriedade);
        const isPropriedadeValida = normProp && !EXCLUDED_PROPRIEDADES.includes(normProp);
        const isTitular = titularidade === "TITULAR";
        
        if (isOperacional && isPropriedadeValida && isTitular) {
          const cleanPlaca = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (cleanPlaca) {
            plates.push(cleanPlaca);
          }
        }
      }
      
      return {
        count: plates.length,
        plates
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
};

export const useDisponibilidadeLocados = () => {
  const { data: veiculosDisponiveisData, isLoading: isLoadingVeiculos } = useVeiculosLocadosDisponiveis();
  const { data: locados = [], isLoading: isLoadingLocados } = useLocadosData();
  
  const veiculosDisponiveis = veiculosDisponiveisData?.count ?? 0;
  const titularPlatesSet = useMemo(() => {
    return new Set(veiculosDisponiveisData?.plates || []);
  }, [veiculosDisponiveisData]);
  
  // Total de dias parados e meses únicos representados
  const { totalDiasParados, uniqueMonthsCount } = useMemo(() => {
    let sum = 0;
    const uniqueMonths = new Set<string>();
    
    locados.forEach((item) => {
      const rawPlaca = String(item.placa || "").trim();
      const cleanPlaca = rawPlaca.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const isPlacaValida = cleanPlaca.length === 7;
      
      const isTitular = titularPlatesSet.has(cleanPlaca);
      
      if (isPlacaValida && isTitular) {
        sum += (item.diasParados || 0);
      }
      
      if (item.mesAno && isTitular) {
        uniqueMonths.add(String(item.mesAno).trim().toLowerCase());
      }
    });
    
    return {
      totalDiasParados: sum,
      uniqueMonthsCount: Math.max(1, uniqueMonths.size)
    };
  }, [locados, titularPlatesSet]);
  
  // Total potencial de dias de disponibilidade = Veículos * 30 dias * quantidade de meses observados
  // A indisponibilidade por placa reduz esse total acumulado
  const totalPotentialDays = veiculosDisponiveis * 30 * uniqueMonthsCount;
  
  // Disponibilidade = ((Total Potencial de Dias - Total de Dias Parados) / Total Potencial de Dias) * 100
  const disponibilidade = totalPotentialDays > 0 
    ? ((totalPotentialDays - totalDiasParados) / totalPotentialDays) * 100 
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
