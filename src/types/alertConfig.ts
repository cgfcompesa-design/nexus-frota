
export interface FuelAlertConfig {
  autonomyDeviationPercent: number;
  valorLitroDeviationPercent: number;
  minCapacityPercent: number;
  maxCapacityPercent: number;
  averageCapacityPercent: number;
  daysWithoutRefueling: number;
}

export const DEFAULT_FUEL_ALERT_CONFIG: FuelAlertConfig = {
  autonomyDeviationPercent: 30,
  valorLitroDeviationPercent: 30,
  minCapacityPercent: 20,
  maxCapacityPercent: 110,
  averageCapacityPercent: 2,
  daysWithoutRefueling: 5
};

export function getFuelAlertConfig(): FuelAlertConfig {
  const saved = localStorage.getItem('fuel_alert_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_FUEL_ALERT_CONFIG;
    }
  }
  return DEFAULT_FUEL_ALERT_CONFIG;
}

export function saveFuelAlertConfig(config: FuelAlertConfig): void {
  localStorage.setItem('fuel_alert_config', JSON.stringify(config));
}
