import { useQuery } from "@tanstack/react-query";
import { isBefore, addDays, parse, isValid, differenceInDays } from "date-fns";
import { fetchDriversData } from "../services/fleetService";

export interface CNHRecord {
  codMotorista: string;
  nome: string;
  gerencia: string;
  validadeStr: string;
  categoria: string;
  matricula: string;
  status: "vencida" | "30dias" | "60dias" | "90dias" | "regular";
  diasParaVencer: number | null;
  cnh: string; // Map to codMotorista or similar
  rawData: any;
}

export interface GestorStats {
  gestor: string;
  total: number;
  vencidas: number;
  em30dias: number;
  em60dias: number;
  em90dias: number;
  regulares: number;
}

export function useCNHData() {
  return useQuery({
    queryKey: ["cnh-data"],
    queryFn: async () => {
      const drivers = await fetchDriversData();
      if (!drivers.length) return { records: [], headers: [] };
      
      const now = new Date();
      const thirtyDaysFromNow = addDays(now, 30);
      const sixtyDaysFromNow = addDays(now, 60);
      const ninetyDaysFromNow = addDays(now, 90);

      const records: CNHRecord[] = drivers
        .filter((driver) => {
          const nome = (driver.nome || "").toUpperCase();
          return !nome.includes("OFC ") && !nome.includes("DESLIGADO");
        })
        .map((driver) => {
        const vDate = parseDate(driver.validadeStr);
        let status: CNHRecord["status"] = "regular";
        let diasParaVencer: number | null = null;

        if (vDate && isValid(vDate)) {
          diasParaVencer = differenceInDays(vDate, now);
          if (isBefore(vDate, now)) {
            status = "vencida";
          } else if (isBefore(vDate, thirtyDaysFromNow)) {
            status = "30dias";
          } else if (isBefore(vDate, sixtyDaysFromNow)) {
            status = "60dias";
          } else if (isBefore(vDate, ninetyDaysFromNow)) {
            status = "90dias";
          }
        }

        return {
          ...driver,
          cnh: driver.codMotorista, // Assuming Cód. Motorista is used as CNH ref here or similar
          status,
          diasParaVencer,
          rawData: driver,
        };
      });

      // Extract headers from first record rawData
      const headers = Object.keys(drivers[0]).filter(k => k !== "__raw");

      return { records, headers };
    },
  });
}

export function calculateCNHStats(data: CNHRecord[]) {
  const stats = {
    total: data.length,
    vencidas: 0,
    em30dias: 0,
    em60dias: 0,
    em90dias: 0,
    regulares: 0
  };

  data.forEach((r) => {
    if (r.status === "vencida") stats.vencidas++;
    else if (r.status === "30dias") stats.em30dias++;
    else if (r.status === "60dias") stats.em60dias++;
    else if (r.status === "90dias") stats.em90dias++;
    else stats.regulares++;
  });

  return stats;
}

export function calculateStatsByGestor(data: CNHRecord[]): GestorStats[] {
  const gestores: Record<string, CNHRecord[]> = {};
  data.forEach((record) => {
    const gestor = record.gerencia || "N/A";
    if (!gestores[gestor]) gestores[gestor] = [];
    gestores[gestor].push(record);
  });

  return Object.entries(gestores).map(([gestor, records]) => {
    const stats = calculateCNHStats(records);
    return {
      gestor,
      total: stats.total,
      vencidas: stats.vencidas,
      em30dias: stats.em30dias,
      em60dias: stats.em60dias,
      em90dias: stats.em90dias,
      regulares: stats.regulares
    };
  }).sort((a, b) => b.total - a.total);
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try common formats
  const formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"];
  for (const f of formats) {
    const d = parse(dateStr, f, new Date());
    if (isValid(d)) return d;
  }
  return null;
}
