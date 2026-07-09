import { useQuery } from "@tanstack/react-query";

export interface PoolTrip {
  abertura: string;       // Date and time of opening
  inicioViagem: string;   // Date and time of start
  status: string;         // Trip status
  usuario: string;        // Name of user(s)
  email: string;          // User email
  re: string;             // User register number
  centroCusto: string;    // Cost center (unidade/gerência)
  origem: string;         // Origin address
  destino: string;        // Destination address
  hrInicial: string;      // Start hour
  hrFinal: string;        // End hour
  tempoMedioEspera: number; // Average waiting time
  os: string;             // OS number
  prefixo: string;        // Prefix
  placa: string;          // Plate
  modelo: string;         // Vehicle model
  motorista: string;      // Driver name
  celMotorista: string;   // Driver cell phone
  valor: number;          // Base cost
  pedagio: number;        // Toll cost
  estacionamento: number; // Parking cost
  valorTotal: number;     // Total cost
  tempoParado: number;    // Idle/Stopped time
  monthYear: string;      // Computed MM/YYYY
}

const POOL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIFB0JoyZx7eubakd2rccqZc9PvnqCm_tzccvpoKSgA0JeqUSxJ8T_-Kt2JfqtxLnJoD6XRT9D4IBw/pub?output=csv";

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

const parseBrazilianNumber = (val: string): number => {
  if (!val) return 0;
  // Replace thousand dot separators and convert comma to dot
  const clean = val.replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const extractMonthYear = (dateStr: string): string => {
  if (!dateStr) return "";
  // format is DD/MM/YY HH:MM:SS or similar. e.g., 27/02/26 16:26:02
  const parts = dateStr.split(" ")[0].split("/");
  if (parts.length >= 2) {
    const month = parts[1].padStart(2, "0");
    const year = parts[2] ? (parts[2].length === 2 ? `20${parts[2]}` : parts[2]) : "";
    if (month && year) {
      return `${month}/${year}`;
    }
  }
  return "";
};

export function usePoolData() {
  return useQuery<PoolTrip[]>({
    queryKey: ["pool-trips"],
    queryFn: async () => {
      const response = await fetch(POOL_CSV_URL);
      if (!response.ok) {
        throw new Error("Erro ao carregar dados do POOL de veículos");
      }
      const text = await response.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length <= 1) return [];

      // Find header row
      let headerIndex = 0;
      const headers = parseCsvLine(lines[0]);
      
      const trips: PoolTrip[] = [];

      for (let i = headerIndex + 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 5) continue; // Skip incomplete lines

        const abertura = cols[0] || "";
        const inicioViagem = cols[1] || "";
        const status = cols[2] || "";
        const usuario = cols[3] || "";
        const email = cols[4] || "";
        const re = cols[5] || "";
        const centroCusto = cols[6] || "";
        const origem = cols[7] || "";
        const destino = cols[8] || "";
        const hrInicial = cols[9] || "";
        const hrFinal = cols[10] || "";
        const tempoMedioEspera = parseBrazilianNumber(cols[11]);
        const os = cols[12] || "";
        const prefixo = cols[13] || "";
        const placa = (cols[14] || "").trim().toUpperCase();
        const modelo = cols[15] || "";
        const motorista = cols[16] || "";
        const celMotorista = cols[17] || "";
        const valor = parseBrazilianNumber(cols[18]);
        const pedagio = parseBrazilianNumber(cols[19]);
        const estacionamento = parseBrazilianNumber(cols[20]);
        const valorTotal = parseBrazilianNumber(cols[21]);
        const tempoParado = parseBrazilianNumber(cols[22]);

        const monthYear = extractMonthYear(abertura);

        trips.push({
          abertura,
          inicioViagem,
          status,
          usuario,
          email,
          re,
          centroCusto: centroCusto.toUpperCase(),
          origem,
          destino,
          hrInicial,
          hrFinal,
          tempoMedioEspera,
          os,
          prefixo,
          placa,
          modelo,
          motorista,
          celMotorista,
          valor,
          pedagio,
          estacionamento,
          valorTotal,
          tempoParado,
          monthYear,
        });
      }

      return trips;
    },
    staleTime: 5 * 60 * 1000,
  });
}
