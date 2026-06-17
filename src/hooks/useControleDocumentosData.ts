import { useQuery } from "@tanstack/react-query";

export interface ControleDocumento {
  placa: string;
  gerencia: string;
  diretoria: string;
  coordenacao: string;
  propriedade: string;
  anexoCrlv?: string;
  anexoCsv?: string;
  anexoTacografo?: string;
  anexoCivCipp?: string;
  anexoCarroceriaInmetro?: string;
  anexoAet?: string;
}

const DOCUMENTOS_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=327588252&single=true&output=csv";

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
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
    } else if (char === "," && !inQuotes) {
      const trimmed = current.trim();
      result.push(trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed);
      current = "";
    } else {
      current += char;
    }
  }
  const trimmed = current.trim();
  result.push(trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed);
  return result;
};

export function useControleDocumentosData() {
  return useQuery<ControleDocumento[]>({
    queryKey: ["controle-documentos"],
    queryFn: async () => {
      const response = await fetch(DOCUMENTOS_API);
      if (!response.ok) throw new Error("Erro ao carregar documentos");
      const text = await response.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      
      // Encontrar cabeçalho (procurar "PLACA")
      let headerIndex = -1;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.some(c => c.toUpperCase().includes("PLACA"))) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) return [];

      const dataLines = lines.slice(headerIndex + 1);
      return dataLines.map(line => {
        const cols = parseCsvLine(line);
        const placa = (cols[0] || "").trim();
        return {
          placa: placa.toUpperCase(),
          diretoria: cols[1] || "",
          gerencia: cols[2] || "",
          coordenacao: cols[3] || "",
          propriedade: cols[4] || "",
          anexoCrlv: cols[5] || "",
          anexoCsv: cols[6] || "",
          anexoTacografo: cols[7] || "",
          anexoCivCipp: cols[10] || "",
          anexoCarroceriaInmetro: cols[9] || "",
          anexoAet: cols[11] || "",
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}
