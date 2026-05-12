import { useQuery } from "@tanstack/react-query";
import type { FuelStation } from "@/types/fuelStations";

// CSV publicado (gid=1141895828) — cabeçalho na linha 6 (1-indexed)
const FUEL_STATIONS_API =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT04VE_fV-KbLDdSQsiYZx2cYH-ByRRbcvKn-B-Q1nM0pBWlDvo4uTn1a-7JUxHIpxNQNYFsULDOeG9/pub?gid=1141895828&single=true&output=csv";

const fetchCSVWithRetry = async (url: string, retries = 3): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
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

const clean = (v: string) => v.replace(/^[\s\"]+|[\s\"]+$/g, "").trim();

const extractCityFromColumnA = (raw: string): string => {
  const t = clean(raw)
    .replace(/\bPOSTO\s+DE\s+COMBUSTIVEL\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t || "(Não informado)";
};

const buildMaps = (endereco: string, fallbackName?: string) => {
  const query = clean(endereco) || clean(fallbackName ?? "");
  const encoded = encodeURIComponent(query);
  return {
    mapsQuery: query,
    mapsLink: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
};

export const useFuelStationsData = () => {
  return useQuery<FuelStation[]>({
    queryKey: ["fuel-stations"],
    queryFn: async () => {
      try {
        const csvText = await fetchCSVWithRetry(FUEL_STATIONS_API);
        const lines = csvText.split("\n").map((l) => l.replace(/\r/g, ""));

        const headerLineIndex = lines.findIndex((l) => {
          const t = l.toLowerCase();
          return t.includes("tipo estabelecimento") && t.includes("estabelecimento") && t.includes("endereço");
        });
        if (headerLineIndex === -1) return [];

        const headers = parseCsvLine(lines[headerLineIndex]).map(clean);
        const dataLines = lines
          .slice(headerLineIndex + 1)
          .filter((l) => l.trim().length > 0);

        let currentCity = "(Não informado)";
        let idCounter = 0;

        const rows = dataLines
          .map((line) => {
            const values = parseCsvLine(line);
            
            const colA = clean(String(values[0] ?? ""));
            const colC = clean(String(values[2] ?? ""));
            const colD = clean(String(values[3] ?? ""));

            if (colA && !colC && !colD && colA.toUpperCase() !== "POSTO DE COMBUSTIVEL") {
              currentCity = extractCityFromColumnA(colA);
              return null;
            }

            const tipo = colA.toUpperCase();
            if (!colC && !colD) return null;

            if (tipo && tipo !== "POSTO DE COMBUSTIVEL") return null;

            const estabelecimentoRaw = colC;
            const enderecoRaw = colD;
            const cidade = currentCity;
            const { mapsQuery, mapsLink } = buildMaps(enderecoRaw, estabelecimentoRaw);

            const fields: Record<string, string | number | undefined> = {};
            headers.forEach((h, i) => {
              fields[h] = clean(values[i] ?? "");
            });

            idCounter += 1;
            return {
              id: `${idCounter}`,
              estabelecimentoRaw,
              enderecoRaw,
              cidade,
              mapsQuery,
              mapsLink,
              fields,
            } satisfies FuelStation;
          })
          .filter((r): r is FuelStation => Boolean(r));

        return rows;
      } catch (error) {
        console.error("Erro ao carregar Relação de Postos:", error);
        return [];
      }
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
};
