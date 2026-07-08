

import Papa from "papaparse";

export const POOL_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIFB0JoyZx7eubakd2rccqZc9PvnqCm_tzccvpoKSgA0JeqUSxJ8T_-Kt2JfqtxLnJoD6XRT9D4IBw/pub?output=csv";

export interface PoolRecord {
  [key: string]: any;

  unidade?: string;
  usuario?: string;
  placa?: string;
  km?: number;
  valor?: number;
  litros?: number;
  status?: string;
  data?: string;
}

export async function loadPoolData(): Promise<PoolRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(POOL_CSV, {
      download: true,
      header: true,
      skipEmptyLines: true,

      complete(results) {
        const dados = (results.data as any[]).map((item) => ({
          ...item,

          km: Number(
            String(item.km ?? item.KM ?? 0)
              .replace(".", "")
              .replace(",", ".")
          ),

          valor: Number(
            String(item.valor ?? item.VALOR ?? 0)
              .replace("R$", "")
              .replace(".", "")
              .replace(",", ".")
          ),

          litros: Number(
            String(item.litros ?? item.LITROS ?? 0)
              .replace(".", "")
              .replace(",", ".")
          ),
        }));

        resolve(dados);
      },

      error(error) {
        reject(error);
      },
    });
  });
}
