import { PoolTrip } from "@/services/poolService";

export interface AnalyticsSummary {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  totalCost: number;
  baseCost: number;
  tollCost: number;
  parkingCost: number;
  avgTripCost: number;
  avgWaitTime: number;
}

export interface RankingItem {
  name: string;
  count: number;
  totalCost: number;
  avgCost: number;
}

export interface VehicleRankingItem {
  placa: string;
  modelo: string;
  count: number;
  totalCost: number;
}

export function getDashboardCards(trips: PoolTrip[]): AnalyticsSummary {
  const completed = trips.filter(t => t.status.toUpperCase() === "CONCLUÍDA");
  const cancelled = trips.filter(t => t.status.toUpperCase() === "CANCELADA" || t.status.toUpperCase() === "REJEITADA");
  
  const totalCost = trips.reduce((sum, t) => sum + t.valorTotal, 0);
  const baseCost = trips.reduce((sum, t) => sum + t.valor, 0);
  const tollCost = trips.reduce((sum, t) => sum + t.pedagio, 0);
  const parkingCost = trips.reduce((sum, t) => sum + t.estacionamento, 0);
  
  const completedCount = completed.length;
  const avgTripCost = completedCount > 0 ? totalCost / completedCount : 0;
  
  const tripsWithWait = trips.filter(t => t.tempoMedioEspera > 0);
  const avgWaitTime = tripsWithWait.length > 0 
    ? tripsWithWait.reduce((sum, t) => sum + t.tempoMedioEspera, 0) / tripsWithWait.length 
    : 0;

  return {
    totalTrips: trips.length,
    completedTrips: completedCount,
    cancelledTrips: cancelled.length,
    totalCost,
    baseCost,
    tollCost,
    parkingCost,
    avgTripCost,
    avgWaitTime,
  };
}

export function getUnidadeRanking(trips: PoolTrip[]): RankingItem[] {
  const groups: Record<string, { count: number; totalCost: number }> = {};
  
  trips.forEach(t => {
    const key = t.centroCusto || "NÃO INFORMADO";
    if (!groups[key]) {
      groups[key] = { count: 0, totalCost: 0 };
    }
    groups[key].count++;
    groups[key].totalCost += t.valorTotal;
  });

  return Object.entries(groups)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalCost: data.totalCost,
      avgCost: data.count > 0 ? data.totalCost / data.count : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function getUsuarioRanking(trips: PoolTrip[]): RankingItem[] {
  const groups: Record<string, { count: number; totalCost: number }> = {};
  
  trips.forEach(t => {
    // Some user entries might have multiple users split by \\
    const rawUsers = t.usuario || "NÃO INFORMADO";
    const users = rawUsers.split(/\\\\|\\|,/).map(u => u.trim()).filter(Boolean);
    
    users.forEach(user => {
      if (!groups[user]) {
        groups[user] = { count: 0, totalCost: 0 };
      }
      groups[user].count++;
      // Distribute the cost equally if there are multiple users on the same trip
      groups[user].totalCost += t.valorTotal / (users.length || 1);
    });
  });

  return Object.entries(groups)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalCost: data.totalCost,
      avgCost: data.count > 0 ? data.totalCost / data.count : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function getMotoristaRanking(trips: PoolTrip[]): RankingItem[] {
  const groups: Record<string, { count: number; totalCost: number }> = {};
  
  trips.forEach(t => {
    const key = t.motorista || "NÃO INFORMADO";
    if (!groups[key]) {
      groups[key] = { count: 0, totalCost: 0 };
    }
    groups[key].count++;
    groups[key].totalCost += t.valorTotal;
  });

  return Object.entries(groups)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalCost: data.totalCost,
      avgCost: data.count > 0 ? data.totalCost / data.count : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function getVehicleRanking(trips: PoolTrip[]): VehicleRankingItem[] {
  const groups: Record<string, { count: number; totalCost: number; modelo: string }> = {};
  
  trips.forEach(t => {
    const key = t.placa || "SEM PLACA";
    if (!groups[key]) {
      groups[key] = { count: 0, totalCost: 0, modelo: t.modelo || "NÃO INFORMADO" };
    }
    groups[key].count++;
    groups[key].totalCost += t.valorTotal;
  });

  return Object.entries(groups)
    .map(([placa, data]) => ({
      placa,
      modelo: data.modelo,
      count: data.count,
      totalCost: data.totalCost,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

// Function to calculate trip durations in minutes
export function parseDurationMinutes(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  
  const parseDate = (str: string): Date | null => {
    try {
      const parts = str.split(" ");
      if (parts.length < 2) return null;
      const dParts = parts[0].split("/");
      const tParts = parts[1].split(":");
      if (dParts.length < 3 || tParts.length < 2) return null;
      
      const day = parseInt(dParts[0]);
      const month = parseInt(dParts[1]) - 1;
      const year = parseInt(dParts[2]) + 2000; // Assuming 20xx
      const hours = parseInt(tParts[0]);
      const minutes = parseInt(tParts[1]);
      const seconds = tParts[2] ? parseInt(tParts[2]) : 0;
      
      return new Date(year, month, day, hours, minutes, seconds);
    } catch {
      return null;
    }
  };

  const start = parseDate(startStr);
  const end = parseDate(endStr);
  
  if (!start || !end) return 0;
  
  const diffMs = end.getTime() - start.getTime();
  return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
}
