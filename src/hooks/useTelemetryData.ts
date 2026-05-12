import { useQuery } from '@tanstack/react-query';
import { fetchTelemetryRealtime, fetchNotificacoes, fetchTelemetryHistory } from '../services/fleetService';

export function useTelemetryRealtime() {
  return useQuery({
    queryKey: ['telemetry-realtime'],
    queryFn: fetchTelemetryRealtime,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useNotificacoes() {
  return useQuery({
    queryKey: ['notificacoes-telemetria'],
    queryFn: fetchNotificacoes,
    staleTime: 5 * 60000, // 5 minutes
    refetchInterval: 5 * 60000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useTelemetryHistory() {
  return useQuery({
    queryKey: ['telemetry-history'],
    queryFn: fetchTelemetryHistory,
    staleTime: 30 * 60000, // 30 minutes
    refetchInterval: 5 * 60000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
