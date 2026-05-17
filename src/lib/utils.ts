import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}



export function parseCurrency(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  
  const cleanValue = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseBrazilianDate(value: string | number | undefined): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  
  // Handle Excel serial numbers (e.g., 45429)
  if (/^\d{5,}(\.\d+)?$/.test(str)) {
    const excelDate = parseFloat(str);
    return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    if (day && month && year) {
      if (year < 100) year += 2000;
      // Basic validation
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  // Fallback to native Date for other formats (YYYY-MM-DD etc)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function daysDiffFromToday(date: Date | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getTime());
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
