import { useQuery } from "@tanstack/react-query";

export interface ControleDocumento {
  placa: string;
  diretoria: string;
  gerencia: string;
  coordenacao: string;
  propriedade: string;
  statusCrlv: string;
  anexoCrlv: string;
  anexoCsv: string;
  anexoTacografo: string;
  anexoCivCipp: string;
  anexoCarroceriaInmetro: string;
  anexoAet?: string;
}

const CONTROLE_DOCUMENTOS_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=327588252&single=true&output=csv";

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
  return '';
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      const trimmed = current.trim();
      result.push(trimmed.startsWith('"') && trimmed.endsWith('"') 
        ? trimmed.slice(1, -1) 
        : trimmed);
      current = '';
    } else {
      current += char;
    }
  }
  
  const trimmed = current.trim();
  result.push(trimmed.startsWith('"') && trimmed.endsWith('"') 
    ? trimmed.slice(1, -1) 
    : trimmed);
  
  return result;
};

export const useControleDocumentosData = () => {
  return useQuery<ControleDocumento[]>({
    queryKey: ["controle-documentos"],
    queryFn: async () => {
      const csvText = await fetchCSVWithRetry(CONTROLE_DOCUMENTOS_API);
      const lines = csvText.split('\n');
      
      // Headers estão na linha 6 (índice 5), dados começam na linha 7 (índice 6)
      const headerLine = lines.findIndex(line => 
        line.toUpperCase().includes('PLACA') && 
        line.toUpperCase().includes('DIRETORIA')
      );
      
      if (headerLine === -1) {
        console.error("Headers não encontrados na planilha");
        return [];
      }
      
      const headers = parseCsvLine(lines[headerLine]);
      
      const result: ControleDocumento[] = [];
      
      for (let i = headerLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const values = parseCsvLine(line);
        
        const placa = (values[0] || '').trim();
        if (!placa || placa.length < 5) continue;
        
        result.push({
          placa: placa.toUpperCase(),
          diretoria: (values[1] || '').trim(),
          gerencia: (values[2] || '').trim(),
          coordenacao: (values[3] || '').trim(),
          propriedade: (values[4] || '').trim(),
          statusCrlv: (values[5] || '').trim(),
          anexoCrlv: (values[6] || '').trim(),
          anexoCsv: (values[7] || '').trim(),
          anexoTacografo: (values[8] || '').trim(),
          anexoCivCipp: (values[10] || '').trim(),
          anexoCarroceriaInmetro: (values[9] || '').trim(),
          anexoAet: (values[11] || '').trim(),
        });
      }
      
      console.log("Total documentos carregados:", result.length);
      return result;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
};
