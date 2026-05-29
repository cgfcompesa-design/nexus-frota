import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Asset } from '../types';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSFg3m2gRlhFtmKMTDcVQW3YmIZXOhlWCN6693HLNHH9kR7GJ7mMayr2U35OOSze6VfJTGOB0GCJsYP/pub?gid=1689333411&single=true&output=csv';
const NOTIFICACOES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDzFdsWUVa4RPEskdPlbYFm-kP_u4Gcuidi6VUFNyDXB-8xIIzKVeOFV0VDaHp6xaYCg1RzD0BLl3z/pub?gid=1649509262&single=true&output=csv';
const DESLOCAMENTO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTXYWFE3dxCti4rNL09OmvkBNGbVKb-X2TFPzoGm7NdT9-ffg-IUA_EZuls2zNWW_ERcID9NOOF8Plv/pub?gid=188743118&single=true&output=csv';
const TELEMETRIA_REALTIME_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZaLkEIx7-y4VvB5xyzeoD_mLQNgJ1RpRkvYrHn-5yLKe2PDk1irfqRQdupokc1e98V74N6P5j2sPM/pub?gid=804388138&single=true&output=csv';
const REGULARIZACAO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=746261061&single=true&output=csv';
const TITULOS_DESPESAS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=573776615&single=true&output=csv';
const MAINTENANCE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZaLkEIx7-y4VvB5xyzeoD_mLQNgJ1RpRkvYrHn-5yLKe2PDk1irfqRQdupokc1e98V74N6P5j2sPM/pub?gid=1765787451&single=true&output=csv';
const PREVENTIVE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZaLkEIx7-y4VvB5xyzeoD_mLQNgJ1RpRkvYrHn-5yLKe2PDk1irfqRQdupokc1e98V74N6P5j2sPM/pub?gid=57968629&single=true&output=csv';
const PREVENTIVE_LOCADOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_A1EB7zQfuUlE4LCa_PbXGmtPHoXTyibIStoSW0T8Pe4jense43xIP4uRbgS77KFUKyM5FEX5w99N/pub?gid=698675285&single=true&output=csv';
const FUEL_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNyx3mdkh9hF027_l61y7O7dwYr_gF5ofFwi0mzRY0eNQuKCu3KR3peiCn7Q_832YRjaxR3rqxQGaB/pub?gid=1282350705&single=true&output=csv';
const HISTORICO_MANUTENCAO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3pRYxrmBebjhyQCfcApeQwfwnL2XZdNPxFCvyXUEQ3LW7epLEz0emED0BKFpiivo371IJ6pz3l4m_/pub?gid=449761634&single=true&output=csv';
const ORCAMENTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZaLkEIx7-y4VvB5xyzeoD_mLQNgJ1RpRkvYrHn-5yLKe2PDk1irfqRQdupokc1e98V74N6P5j2sPM/pub?gid=1278375363&single=true&output=csv';
const CUSTOS_DETALHADOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZaLkEIx7-y4VvB5xyzeoD_mLQNgJ1RpRkvYrHn-5yLKe2PDk1irfqRQdupokc1e98V74N6P5j2sPM/pub?gid=1041597392&single=true&output=csv';
const LOCADOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQduOE9Q5_47tOwu2DCV0T7eLcp0Wt2d1fy9HOCUbHIDY6g-cEA1fa6-eVjKNVTJJxw4iBwAtECemjE/pub?gid=528358532&single=true&output=csv';
const CONTACTS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-IX8SNiQVbdaxqRZVaseGcFzoj8-Y4x-i39e8-Q46PHU1tGq0oPMCXGpdzcTT98uNheWTmPp7SjR0/pub?gid=503746336&single=true&output=csv';
const CONTROLE_OPERACIONAL_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZaLkEIx7-y4VvB5xyzeoD_mLQNgJ1RpRkvYrHn-5yLKe2PDk1irfqRQdupokc1e98V74N6P5j2sPM/pub?gid=1763804481&single=true&output=csv';
const DRIVERS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRFDYDH_uSxf8ubJLThZOZGtBXd7akRvzv87oH46L9GmntevniA_rtu9qPhSX5gaA/pub?gid=281389062&single=true&output=csv';
const SPECIAL_HOURS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSswA5LQw7xGA4imB90xBobAFn2k6T4DoXjuPhrbhLSCSnaWvSXijtR2-oANe6B7LUwf9yhM9Ib7L0d/pub?gid=0&single=true&output=csv';

async function fetchCsv(url: string, retries = 3): Promise<string[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      cache: 'no-store' // Avoid stale data
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        // Rate limited, wait and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchCsv(url, retries - 1);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error("Empty response from server");
    }

    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            reject(new Error(`Parsing error: ${results.errors[0].message}`));
          } else {
            resolve(results.data as string[][]);
          }
        },
        error: (error) => reject(error)
      });
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      if (retries > 0) {
        console.warn(`Fetch timeout for ${url}, retrying... (${retries} left)`);
        return fetchCsv(url, retries - 1);
      }
      throw new Error('Request timeout after multiple attempts');
    }
    
    if (retries > 0 && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      console.warn(`Network error for ${url}, retrying... (${retries} left)`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
      return fetchCsv(url, retries - 1);
    }
    
    throw error;
  }
}

export function parseNum(val: any): number {
  if (val === null || val === undefined || String(val).trim() === "") return 0;
  if (typeof val === 'number') return val;
  const cleanStr = String(val).replace(/[^\d.,-]/g, '').trim();
  const lastComma = cleanStr.lastIndexOf(',');
  const lastDot = cleanStr.lastIndexOf('.');
  
  let res;
  if (lastComma > lastDot) {
    res = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
  } else if (lastDot > lastComma) {
    res = parseFloat(cleanStr.replace(/,/g, ''));
  } else {
    res = parseFloat(cleanStr.replace(',', '.'));
  }
  return isNaN(res) ? 0 : res;
}

export async function fetchMaintenanceData(): Promise<any[]> {
  const rawRows = await fetchCsv(MAINTENANCE_URL);
  // Header on line 4 (index 3), data from line 5 (index 4)
  if (rawRows.length <= 3) return [];
  const headers = rawRows[3];
  const dataRows = rawRows.slice(4);
  return dataRows.map(row => {
    const obj: any = { __raw: row };
    row.forEach((val, i) => {
      obj[`COL_${i}`] = val;
    });
    headers.forEach((h, i) => { 
      if (h) {
        const key = h.trim().toUpperCase();
        obj[key] = row[i];
        const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedKey !== key) {
          obj[normalizedKey] = row[i];
        }
      }
    });
    return obj;
  });
}

export async function fetchPreventiveMaintenanceData(): Promise<any[]> {
  const rawRows = await fetchCsv(PREVENTIVE_URL);
  // Header on line 4 (index 3), data from line 5 (index 4)
  if (rawRows.length <= 3) return [];
  const headers = rawRows[3];
  const dataRows = rawRows.slice(4);
  return dataRows.map(row => {
    const obj: any = { __raw: row };
    row.forEach((val, i) => {
      obj[`COL_${i}`] = val;
    });
    headers.forEach((h, i) => { 
      if (h) {
        const key = h.trim().toUpperCase();
        obj[key] = row[i];
        const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedKey !== key) {
          obj[normalizedKey] = row[i];
        }
      }
    });
    return obj;
  });
}

export async function fetchPreventiveLocadosData(): Promise<any[]> {
  const rawRows = await fetchCsv(PREVENTIVE_LOCADOS_URL);
  // Header on line 4 (index 3), data from line 5 (index 4)
  if (rawRows.length <= 3) return [];
  const headers = rawRows[3];
  const dataRows = rawRows.slice(4);
  return dataRows.map(row => {
    const obj: any = { __raw: row };
    row.forEach((val, i) => {
      obj[`COL_${i}`] = val;
    });
    headers.forEach((h, i) => { 
      if (h) {
        const key = h.trim().toUpperCase();
        obj[key] = row[i];
        const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedKey !== key) {
          obj[normalizedKey] = row[i];
        }
      }
    });
    return obj;
  });
}

export async function fetchFuelData(): Promise<any[]> {
  let rows: any[][] = [];
  let isApiLoaded = false;
  
  // 1. Try to fetch from the server-side API proxy first (CORS-safe and fast)
  try {
    console.log("Fetching fuel data from server-side proxy API...");
    const res = await fetch("/api/fuel-data");
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        rows = json.data;
        isApiLoaded = true;
        console.log(`Successfully fetched ${rows.length} rows of fuel data via server-side proxy (${json.sheetName || "default"}).`);
      }
    }
  } catch (apiError) {
    console.warn("Server-side proxy fetch failed, falling back to direct client-side download...", apiError);
  }

  // 2. Fallback to client-side direct XLSX fetch
  if (!isApiLoaded) {
    try {
      const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNyx3mdkh9hF027_l61y7O7dwYr_gF5ofFwi0mzRY0eNQuKCu3KR3peiCn7Q_832YRjaxR3rqxQGaB/pub?output=xlsx';
      console.log("Fetching fuel data from Google Sheets directly in XLSX format...");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      
      // Find the first sheet that has rows and contains headers like PLACA, DATA, LITROS, etc.
      let targetSheetName = "";
      let bestMatchHeadersCount = -1;
      let selectedRows: any[][] = [];

      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (sheetRows.length === 0) continue;

        // Look for a header row containing keywords
        const headerRowIndex = sheetRows.findIndex(row => 
          row.some(cell => {
            const c = String(cell || "").toUpperCase();
            return c.includes("PLACA") || c.includes("RESUMO") || c.includes("MES/ANO") || c.includes("VALOR") || c.includes("LITROS") || c.includes("TRANSACAO");
          })
        );

        if (headerRowIndex !== -1) {
          const headerRow = sheetRows[headerRowIndex];
          const keywords = ["PLACA", "DATA", "LITROS", "VALOR", "MOTORISTA", "CONDUTOR", "POSTO", "ESTABELECIMENTO", "KM"];
          const matchCount = headerRow.filter(cell => {
            const c = String(cell || "").toUpperCase();
            return keywords.some(k => c.includes(k));
          }).length;

          if (matchCount > bestMatchHeadersCount) {
            bestMatchHeadersCount = matchCount;
            targetSheetName = name;
            selectedRows = sheetRows;
          }
        }
      }

      if (!targetSheetName && wb.SheetNames.length > 0) {
        targetSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[targetSheetName];
        selectedRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      }

      rows = selectedRows;
      isApiLoaded = true;
      console.log(`Loaded ${rows.length} rows directly from Excel sheet: "${targetSheetName}"`);
    } catch (error) {
      console.warn("Failed to load xlsx fuel data, falling back to CSV...", error);
      try {
        rows = await fetchCsv(FUEL_URL);
      } catch (csvError) {
        console.error("Failed to load CSV fuel data as well:", csvError);
        return [];
      }
    }
  }

  if (rows.length <= 1) return [];
  
  // Advanced keyword-scoring-based header row finder - scan ALL rows of the spreadsheet!
  let headerRowIndex = -1;
  let maxScore = -1;
  const keywords = ["PLACA", "DATA", "LITROS", "VOLUME", "VALOR", "UNITARIO", "TOTAL", "MOTORISTA", "CONDUTOR", "POSTO", "ESTABELECIMENTO", "KM", "TRANSACAO", "ODOMETRO", "HODOMETRO"];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    let score = 0;
    // Check how many unique keywords this row matches
    const uppercaseCells = row.map(cell => String(cell || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    keywords.forEach(keyword => {
      if (uppercaseCells.some(cell => cell.includes(keyword))) {
        score++;
      }
    });
    
    // Reward rows having more non-empty columns if baseline relevance holds
    if (score >= 2) {
      score += row.filter(cell => String(cell || "").trim() !== "").length * 0.1;
    }
    
    if (score > maxScore) {
      maxScore = score;
      headerRowIndex = i;
    }
  }

  // Fallback to simple matching if no row scored well
  if (headerRowIndex === -1 || maxScore < 2) {
    headerRowIndex = rows.findIndex(row => 
      row.some(cell => {
        const c = String(cell || "").toUpperCase();
        return c.includes("PLACA") || c.includes("RESUMO") || c.includes("MES/ANO") || c.includes("VALOR");
      })
    );
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  const headers = rows[headerRowIndex];
  
  // Filter out header row and empty lines robustly, allowing data to be both above and below headers due to sorting
  const dataRows = rows.filter((row, idx) => {
    if (idx === headerRowIndex) return false;
    if (!row || !Array.isArray(row)) return false;
    
    const isEmpty = row.every(cell => cell === null || cell === undefined || String(cell).trim() === "");
    if (isEmpty) return false;

    // Check if it's a clone of the header row itself sorted
    const isHeaderClone = row.some(cell => {
      const c = String(cell || "").toUpperCase().trim();
      return c === "PLACA VEÍCULO" || c === "PLACA VEICULO" || c === "DATA TRANSAÇÃO" || c === "DATA TRANSACAO";
    });
    if (isHeaderClone) return false;

    // Skip HTML/error tags
    if (String(row[0] || "").startsWith("<HTML") || String(row[0] || "").startsWith("<!DOCTYPE")) {
      return false;
    }

    return true;
  });
  
  return dataRows.map(row => {
    const obj: any = { __raw: row };
    // Always add index-based keys (Column A=0, B=1, ... T=19, AP=41)
    row.forEach((val, i) => {
      obj[`COL_${i}`] = val;
    });
    headers.forEach((h, i) => { 
      if (h) {
        const key = h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        obj[key] = row[i];
        
        const val = row[i];
        if (!val) return;

        // Priority Mapping for Core Fields
        if (key === "PLACA" || key === "PLACA VEICULO" || key === "PLACA_VEICULO" || key === "PREFIXO") {
          obj._placa = String(val).toUpperCase().replace(/[^A-Z0-9]/gi, "");
        } else if (key.includes("PLACA") && !obj._placa) {
          obj._placa = String(val).toUpperCase().replace(/[^A-Z0-9]/gi, "");
        }

        if (key === "DATA TRANSACAO" || key === "DATA_TRANSACAO" || key === "DATA TRANSACA\u00D5" || key === "DATA TRANSACA\u00F5") {
          obj._date = val;
        } else if (key === "DATA" && !obj._date) {
          obj._date = val;
        } else if (key.includes("DATA") && !obj._date) {
          obj._date = val;
        }

        if (key === "LITROS" || key === "VOLUME" || key === "QUANTIDADE") {
          obj._litros = parseNum(val);
        } else if ((key.includes("LITROS") || key.includes("VOLUME")) && !obj._litros) {
          obj._litros = parseNum(val);
        }

        if (key === "VALOR UNITARIO" || key === "VL/UNITARIO" || key === "PR UNITARIO" || key === "VALOR UNIT" || key === "VLR UNITARIO") {
          obj._vlLitro = parseNum(val);
        } else if ((key.includes("VALOR UNIT") || key.includes("PRECO UNIT")) && !obj._vlLitro) {
          obj._vlLitro = parseNum(val);
        }

        if (key === "VALOR TOTAL" || key === "VALOR EMISSAO" || key === "VL TOTAL" || key === "VALOR TOTAL LIQUIDO" || key === "VALOR") {
          obj._total = parseNum(val);
        } else if ((key.includes("TOTAL") || key.includes("VALOR") || key === "VALOR EMISSAO") && !obj._total) {
          obj._total = parseNum(val);
        }

        if (key === "ODOMETRO" || key === "HORIMETRO" || key === "HODOMETRO" || key === "ODOMETRO/HORIMETRO") {
          obj._odometer = parseNum(val);
        } else if ((key.includes("ODOMETRO") || key.includes("HODOMETRO") || key.includes("HORIMETRO")) && !obj._odometer) {
          obj._odometer = parseNum(val);
        }
        
        if (key === "KM RODADOS OU HORAS TRABALHADAS" || key === "KM RODADOS" || key === "DISTANCIA PERCORRIDA" || key === "KM_RODADOS") {
          obj._kmRodados = parseNum(val);
        } else if (key.includes("KM RODADOS") && !obj._kmRodados) {
          obj._kmRodados = parseNum(val);
        }

        if (key === "TIPO COMBUSTIVEL" || key === "COMBUSTIVEL" || key === "PRODUTO") {
          obj._fuelType = val;
        } else if (key.includes("COMBUSTIVEL") && !obj._fuelType) {
          obj._fuelType = val;
        }

        if (key === "NOME MOTORISTA" || key === "MOTORISTA" || key === "CONDUTOR") {
          obj._driver = val;
        } else if ((key.includes("MOTORISTA") || key.includes("CONDUTOR")) && !obj._driver) {
          obj._driver = val;
        }

        if (key === "NOME ESTABELECIMENTO" || key === "NOME POSTO" || key === "ESTABELECIMENTO" || key === "RAZAO SOCIAL" || key === "POSTO" || key === "NOME_ESTABELECIMENTO") {
          obj._establishment = val;
          obj._posto = val;
        } else if ((key.includes("POSTO") || key.includes("ESTABELECIMENTO")) && !key.includes("CODIGO") && !key.includes("CNPJ") && !key.includes("ID") && !obj._establishment) {
          obj._establishment = val;
          obj._posto = val;
        }

        if (key === "MODELO VEICULO" || key === "MODELO" || key === "VEICULO" || key === "MODELO VEIC") {
          obj._vehicleModel = val;
        } else if (key.includes("MODELO") && !obj._vehicleModel) {
          obj._vehicleModel = val;
        }

        if (key === "CIDADE" || key === "MUNICIPIO" || key === "NOME CIDADE") {
          obj._cidade = val;
        } else if (key.includes("CIDADE") && !obj._cidade) {
          obj._cidade = val;
        }

        if (key === "UNIDADE" || key === "GERENCIA" || key === "DEPTO" || key === "CENTRO DE CUSTO") {
          obj._unit = val;
        } else if (key.includes("UNIDADE") && !obj._unit) {
          obj._unit = val;
        }
        
        if (key === "MES/ANO" || key === "M\u00CAS/ANO" || key === "MES ANO") {
          obj._monthYear = val;
        }

        if (key === "AUTONOMIA REAL" || key === "AUTONOMIA" || key === "DESEMPENHO" || key === "KML") {
          obj._autReal = parseNum(val);
        } else if (key.includes("AUTONOMIA") && !obj._autReal) {
          obj._autReal = parseNum(val);
        }
      }
    });

    // Absolute Fallbacks (specific column indices for Ticket Log / ValeCard)
    // The user says Column E (index 4) is Data/Hora. 
    // And Column F (index 5) seems to be the Plate based on "N/A RZV1A58" feedback.
    // And "Time" was appearing in "Cód. Transação" which was mapped to row[0].
    
    if (!obj._txId) obj._txId = row[0] || row[8] || "N/A";
    if (!obj._date) obj._date = row[4]; // Column E
    if (!obj._placa) obj._placa = String(row[10] || row[11] || row[5] || obj._placa || "").toUpperCase().replace(/[^A-Z0-9]/gi, "");
    if (!obj._fuelType) obj._fuelType = row[19] || row[2];
    if (!obj._litros) obj._litros = parseNum(row[21]);
    
    // Column P (index 15) is identified as the price by the user
    const colP = parseNum(row[15]);
    if (colP > 0) obj._vlLitro = colP;
    else if (!obj._vlLitro) obj._vlLitro = parseNum(row[22]);
    
    if (!obj._total) obj._total = parseNum(row[24]);
    if (!obj._odometer) obj._odometer = parseNum(row[27]);
    if (!obj._kmRodados) obj._kmRodados = row[39] ? parseNum(row[39]) : 0;
    if (!obj._monthYear) obj._monthYear = row[41];
    if (!obj._autReal) obj._autReal = parseNum(row[42]); // Column AQ index 42
    
    // Transaction ID should probably be in E (row[4]) or fallback to something else?
    // If E is Data/Hora, maybe the Transaction ID is in F? Or I should keep searching.
    // Let's try to map txId to a different column if it's currently showing Time.
    // Usually Ticket Log has it in index 3 or 4.
    if (!obj._txId) obj._txId = row[8] || row[4] || "N/A";
    if (!obj._posto) obj._posto = row[21] || row[16] || row[23] || "N/A";
    if (!obj._cidade) obj._cidade = row[25] || row[21] || row[20] || "N/A";
    if (!obj._endereco) obj._endereco = row[23] || row[18] || "N/A";
    if (!obj._bairro) obj._bairro = row[24] || row[19] || "N/A";

    // Add transaction time if available (fallback Column G = index 6 or the user said Column A (0) had time)
    if (!obj._time) obj._time = row[0] || row[6] || "";

    // Final normalization for MES/ANO if missing or non-standard
    if (obj._monthYear) {
      const my = String(obj._monthYear).toLowerCase();
      const monthNames = { 
        'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06', 
        'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
        'janeiro': '01', 'fevereiro': '02', 'mar\u00E7o': '03', 'abril': '04', 'maio': '05', 
        'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 
        'novembro': '11', 'dezembro': '12'
      };
      
      const parts = my.split(/[\/\s-]/);
      if (parts.length >= 2) {
        let month = "";
        let year = "";
        
        // Check if first part is month name
        for (const [name, code] of Object.entries(monthNames)) {
          if (parts[0].startsWith(name)) {
            month = code;
            break;
          }
        }
        
        // If not, check if it's numeric
        if (!month && /^\d+$/.test(parts[0])) {
          month = parts[0].padStart(2, '0');
        }
        
        // Get year from last part
        if (/^\d+$/.test(parts[parts.length - 1])) {
          year = parts[parts.length - 1];
          if (year.length === 2) year = "20" + year;
        }
        
        if (month && year) {
          obj._monthYear = `${month}/${year}`;
        }
      }
    }

    if ((!obj._monthYear || obj._monthYear === "") && obj._date) {
      const dStr = String(obj._date);
      let dateObj: Date | null = null;
      
      if (/^\d+(\.\d+)?$/.test(dStr)) {
        dateObj = new Date((parseFloat(dStr) - 25569) * 86400 * 1000);
      } else {
        const parts = dStr.split(/[\/\s-]/);
        if (parts.length >= 3) {
          // Assume DD/MM/YYYY
          dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          dateObj = new Date(dStr);
        }
      }
      
      if (dateObj && !isNaN(dateObj.getTime())) {
        const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const y = dateObj.getFullYear().toString();
        obj._monthYear = `${m}/${y}`;
      }
    }

    return obj;
  }).filter(obj => {
    return true;
  });
}

export async function fetchFleetData(): Promise<Asset[]> {
  const rows = await fetchCsv(SHEET_URL);
  // Find real header row
  const headerRowIndex = rows.findIndex(row => 
    row.some(cell => String(cell).toUpperCase().includes("ID OBJETO")) ||
    row.some(cell => String(cell).toUpperCase().includes("PLACA"))
  );

  if (headerRowIndex === -1) return [];

  const headers = rows[headerRowIndex];
  
  // Make data rows robust to sorting (can be before or after header row)
  const dataRows = rows.filter((row, idx) => {
    if (idx === headerRowIndex) return false;
    if (!row || !Array.isArray(row)) return false;
    
    const isEmpty = row.every(cell => cell === null || cell === undefined || String(cell).trim() === "");
    if (isEmpty) return false;

    // Check if it's a clone of the header row itself sorted
    const isHeaderClone = row.some(cell => {
      const c = String(cell || "").toUpperCase().trim();
      return c === "ID OBJETO" || c === "PLACA VEÍCULO" || c === "PLACA VEICULO";
    });
    if (isHeaderClone) return false;

    // Skip HTML/error tags
    if (String(row[0] || "").startsWith("<HTML") || String(row[0] || "").startsWith("<!DOCTYPE")) {
      return false;
    }

    return true;
  });

  return dataRows.map(row => {
    const item: any = { "COLUNA_E": row[4] || "" };
    headers.forEach((h, i) => { 
      if (h) {
        const key = h.trim().toUpperCase();
        item[key] = row[i];
        const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedKey !== key) {
          item[normalizedKey] = row[i];
        }
      }
    });

    const status = (String(row[23] || item["STATUS OPERACIONAL"] || item["STATUS"] || item["SITUAÇÃO"] || item["SITUACAO"] || "").toUpperCase().trim());
    const placa = String(item["PLACA"] || item["PLACA DO VEICULO"] || "").toUpperCase().trim();
    const titularidade = String(row[27] || item["TITULARIDADE"] || "").toUpperCase().trim();
    item.TITULARIDADE = titularidade;
    
    // Status normalization: Strict OPERACIONAL as requested
    const isOperational = status === 'OPERACIONAL' || status === 'ATIVO';

    // Fallback para status se vazio - se tem placa e é item de frota, provavelmente deve ser considerado
    if (!placa) return null;

    const propriedade = String(row[10] || item["PROPRIEDADE"] || item["TIPO PROPRIEDADE"] || "").toUpperCase();
    const isProprio = propriedade === 'COMPESA' || propriedade === 'COMPESA - IPA' || propriedade.includes('PROPRIO') || propriedade.includes('PRÓPRIO');
    
    const parseNum = (val: any) => {
      if (val === null || val === undefined || String(val).trim() === "") return 0;
      // Tratar formatos brasileiros e americanos
      const cleanStr = String(val).replace(/[^\d.,-]/g, '').trim();
      const lastComma = cleanStr.lastIndexOf(',');
      const lastDot = cleanStr.lastIndexOf('.');
      
      let res;
      if (lastComma > lastDot) {
        res = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
      } else if (lastDot > lastComma) {
        res = parseFloat(cleanStr.replace(/,/g, ''));
      } else {
        res = parseFloat(cleanStr.replace(',', '.'));
      }
      return isNaN(res) ? 0 : res;
    };

    const combustivel = item["COMBUSTÍVEL"] || item["COMBUSTIVEL"] || item["TIPO COMBUSTÍVEL"] || item["TIPO COMBUSTIVEL"] || row[11] || "N/A";
    const autonomiaVal = item["AUTONOMIA PADRÃO (KM/LITRO OU HORA/LITRO)"] || item["AUTONOMIA PADRÃO"] || item["AUTONOMIA PADRAO"] || item["AUTONOMIA"] || item["AUTONOMIA (KM/L)"] || row[28] || row[29];
    const autonomiaSecundariaVal = item["AUTONOMIA SECUNDÁRIA"] || item["AUTONOMIA SECUNDARIA"] || item["AUTONOMIA SEC"] || row[33] || row[34];
    const capacidadeVal = item["CAPACIDADE DO TANQUE"] || item["CAPACIDADE TANQUE"] || item["CAPACIDADE"] || item["TANQUE"] || row[30] || row[31];
    
    // Column AJ is index 35 (A=0, ..., J=9, ..., T=19, ..., AJ=35)
    const operacao24h = (row[35] || item["OPERAÇÃO 24H"] || item["OPERACAO 24H"] || "").toUpperCase().trim();

    return {
      ...item,
      __raw: row,
      PLACA: placa,
      STATUS_OPERACIONAL: isOperational ? 'OPERACIONAL' : status || 'NÃO OPERACIONAL',
      PROPRIEDADE_TIPO: isProprio ? 'Próprio' : 'Locado',
      "COMBUSTÍVEL": combustivel,
      "AUTONOMIA PADRÃO (KM/LITRO OU HORA/LITRO)": parseNum(autonomiaVal),
      "AUTONOMIA SECUNDÁRIA": parseNum(autonomiaSecundariaVal),
      "CAPACIDADE DO TANQUE": parseNum(capacidadeVal),
      OPERACAO_24H: operacao24h === 'SIM',
      // Explicit additional requested columns:
      ID_OBJETO: String(row[20] || item["ID OBJETO"] || item["ID_OBJETO"] || "").trim(),
      ANO: String(row[8] || item["ANO"] || item["ANO MODELO"] || "").trim(),
      CHASSI: String(row[19] || item["CHASSI"] || "").trim(),
      ARLA: String(row[26] || item["ABASTECIMENTO ARLA"] || item["ARLA"] || "").trim(),
      AUTONOMIA_PADRAO_VAL: parseNum(autonomiaVal),
      CAPACIDADE_TANQUE_VAL: parseNum(capacidadeVal),
      COMBUSTIVEL_SECUNDARIO: String(row[32] || item["COMBUSTÍVEL SECUNDÁRIO"] || item["COMBUSTIVEL SECUNDARIO"] || "").trim(),
      AUTONOMIA_SECUNDARIO_VAL: parseNum(autonomiaSecundariaVal),
      CAPACIDADE_TANQUE_SECUNDARIO_VAL: parseNum(row[34] || item["CAPACIDADE TANQUE SECUNDÁRIO"] || item["CAPACIDADE TANQUE SECUNDARIO"] || 0),
      CNH_MINIMA: String(row[36] || item["CNH MÍNIMA"] || item["CNH MINIMA"] || "").trim()
    };
  }).filter(Boolean) as Asset[];
}

export async function fetchNotificacoes(): Promise<any[]> {
  const rawRows = await fetchCsv(NOTIFICACOES_URL);
  if (rawRows.length <= 1) return [];
  
  // Encontrar a linha de cabeçalho dinamicamente
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = rawRows[i].map(c => String(c).toUpperCase());
    if (row.includes("DIRETORIA") || row.includes("GRAVIDADE") || row.includes("TIPO NOTIFICAÇÃO") || row.includes("PLACA")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 2; // Fallback para o anterior
  
  const headers = rawRows[headerIndex];
  
  // Make data rows robust to sorting (can be before or after header row)
  const dataRows = rawRows.filter((row, idx) => {
    if (idx === headerIndex) return false;
    if (!row || !Array.isArray(row)) return false;
    
    const isEmpty = row.every(cell => cell === null || cell === undefined || String(cell).trim() === "");
    if (isEmpty) return false;

    // Check if it's a clone of the header row itself sorted
    const isHeaderClone = row.some(cell => {
      const c = String(cell || "").toUpperCase().trim();
      return c === "DIRETORIA" || c === "GRAVIDADE" || c === "TIPO NOTIFICAÇÃO" || c === "TIPO NOTIFICACAO" || c === "PLACA";
    });
    if (isHeaderClone) return false;

    // Skip HTML/error tags
    if (String(row[0] || "").startsWith("<HTML") || String(row[0] || "").startsWith("<!DOCTYPE")) {
      return false;
    }

    return true;
  });
  
  return dataRows.map(row => {
    const obj: any = { __raw: row };
    // Adicionar chaves baseadas em índice para segurança
    row.forEach((val, i) => {
      obj[`COL_${i}`] = val;
    });
    headers.forEach((header, index) => {
      if (header) {
        const key = header.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const value = row[index] ? String(row[index]).trim() : "";
        obj[key] = value;
        
        // Accurate Mappings for Nexus Telemetry
        if (key.includes("TIPO NOTIFICA") || key === "TIPO") obj._tipo = value;
        if (key === "GRAVIDADE") obj._gravidade = value;
        if (key.includes("SITUACAO")) obj._situacao = value;
        if (key === "DATA" || key.includes("HORARIO")) obj._data = value;
        if (key === "PLACA") obj._placa = value;
        if (key === "CONDUTOR" || key === "NOME") obj._condutor = value;
        if (key.includes("GERENCIA")) obj._gerencia = value;
        if (key.includes("DIRETORIA")) obj._diretoria = value;
      }
    });

    // Final Absolute Fallbacks (Nexus Data typically follows this order)
    if (!obj._diretoria) obj._diretoria = row[0] || "N/A";
    if (!obj._gerencia) obj._gerencia = row[1] || "N/A";
    if (!obj._tipo) obj._tipo = row[2] || "N/A";
    if (!obj._data) obj._data = row[3] || "";
    if (!obj._placa) obj._placa = row[4] || "";
    if (!obj._condutor) obj._condutor = row[7] || "N/A";
    if (!obj._gravidade) obj._gravidade = row[9] || "Média";
    if (!obj._situacao) obj._situacao = row[10] || "Pendente";

    return obj;
  });
}

export async function fetchTelemetryHistory(): Promise<any[]> {
  const rawRows = await fetchCsv(DESLOCAMENTO_URL);
  if (rawRows.length <= 1) return [];
  
  const headers = rawRows[0];
  const dataRows = rawRows.slice(1);
  
  return dataRows.map(row => {
    const obj: any = {};
    headers.forEach((h, i) => { if (h) obj[h.trim()] = row[i]; });
    return obj;
  });
}

export async function fetchTelemetryRealtime(): Promise<any[]> {
  const rows = await fetchCsv(TELEMETRIA_REALTIME_URL);
  if (rows.length <= 1) return [];

  const dataRows = rows.slice(1);
  
  return dataRows.map(row => {
    if (!row[0]) return null;

    const formatDateTime = (val: string) => {
      if (!val) return "-";
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const seconds = String(d.getSeconds()).padStart(2, '0');
          return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        }
        return val;
      } catch { return val; }
    };

    const parseNum = (val: string) => {
      if (!val) return 0;
      const cleaned = String(val).replace(/[^\d.,-]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const latitude = parseNum(row[13]); // Column N
    const longitude = parseNum(row[14]); // Column O

    return {
      Placa: row[3],
      Unidade: row[1],
      "Data/Hora": formatDateTime(row[8]),
      Velocidade: parseNum(row[11]),
      Odometro: row[12] || "-",
      Ignicao: String(row[9] || "").toUpperCase().trim() === "LIGADA" ? "1" : "0", // Column J
      Antifurto: row[15] || "-",
      Condutor: row[16] || "N/A",
      Tensao: parseNum(row[10]),
      latitude,
      longitude,
      __raw: row
    };
  }).filter(Boolean);
}

export async function fetchRegularizacaoData(): Promise<any[]> {
  const rows = await fetchCsv(REGULARIZACAO_URL);
  if (rows.length <= 2) return [];

  // Data starts from line 3 (index 2)
  const dataRows = rows.slice(2);
  
  return dataRows.map(row => {
    const obj: any = { __raw: row };
    // Mapeamento específico conforme solicitação:
    // Placa: Geralmente está na coluna D (3) ou próximo. Vamos procurar.
    // Auto Infração (Coluna E) = Index 4
    // Data Limite Identificação (Coluna J) = Index 9
    // Status (Coluna V) = Index 21
    // Status Prazo Defesa (Coluna Y) = Index 24
    // Status Processo SEI (Coluna Z) = Index 25
    
    obj.autoInfracao = String(row[4] || "").trim();
    obj.placa = String(row[3] || row[2] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    obj.dataLimite = String(row[9] || "").trim();
    obj.status = String(row[21] || "").trim();
    obj.statusPrazoDefesa = String(row[24] || "").trim();
    obj.statusProcessoSEI = String(row[25] || "").trim();
    
    // Fallback search for Plate if index 3 is not it
    if (!obj.placa || obj.placa.length < 7) {
      const foundPlaca = row.find(c => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(String(c).toUpperCase().trim()));
      if (foundPlaca) obj.placa = String(foundPlaca).toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    return obj;
  }).filter(item => item.autoInfracao || item.placa);
}

export async function fetchTitulosDespesasData(): Promise<any[]> {
  const rawRows = await fetchCsv(TITULOS_DESPESAS_URL);
  if (rawRows.length <= 2) return [];

  const headers = rawRows[2];
  const dataRows = rawRows.slice(3);
  return dataRows.map((row) => {
    const obj: any = { __raw: row };
    headers.forEach((h, i) => {
      const key = h ? h.trim() : `COL_${i}`;
      obj[key] = row[i];
    });
    return obj;
  }).filter(item => item.__raw && item.__raw.length > 5);
}

export async function fetchHistoricoManutencao(): Promise<string[][]> {
  return fetchCsv(HISTORICO_MANUTENCAO_URL);
}

export async function fetchOrcamentos(): Promise<string[][]> {
  return fetchCsv(ORCAMENTOS_URL);
}

export async function fetchCustosDetalhes(): Promise<string[][]> {
  return fetchCsv(CUSTOS_DETALHADOS_URL);
}

export async function fetchLocadosData(): Promise<any[]> {
  const rawRows = await fetchCsv(LOCADOS_URL);
  // Header on line 3 (index 2), data from line 4 (index 3)
  if (rawRows.length <= 2) return [];
  
  const headers = rawRows[2].map(h => h.trim());
  const dataRows = rawRows.slice(3);
  
  return dataRows.map(row => {
    const obj: any = {};
    headers.forEach((header, index) => {
      if (header) {
        const value = row[index];
        const key = header.toLowerCase();
        
        if (key.includes('diretoria')) obj.diretoria = value;
        else if (key.includes('gerência') || key.includes('gerencia')) obj.gerencia = value;
        else if (key.includes('placa')) obj.placa = value;
        else if (key.includes('marca')) obj.marca = value;
        else if (key.includes('modelo')) obj.modelo = value;
        else if (key.includes('propriedade')) obj.propriedade = value;
        else if (key.includes('dias parados')) obj.diasParados = parseInt(value) || 0;
        else if (key.includes('mês/ano') || key.includes('mes/ano')) obj.mesAno = value ? String(value).trim() : "";
        else obj[header] = value ? String(value).trim() : value;
      }
    });
    return obj;
  });
}

export async function fetchContactsData(): Promise<any[]> {
  const rows = await fetchCsv(CONTACTS_URL);
  if (rows.length <= 1) return [];
  // Column A: Gerência, Column B: Emails
  return rows.slice(1).map(row => ({
    gerencia: String(row[0] || "").trim().toUpperCase(),
    emails: String(row[1] || "").trim()
  }));
}

export async function fetchControleOperacional(): Promise<any[]> {
  const rows = await fetchCsv(CONTROLE_OPERACIONAL_URL);
  if (rows.length < 50) return [];
  
  // Try to find the header row dynamically
  let headerIndex = rows.findIndex(row => 
    row.some(cell => String(cell).toUpperCase().includes("N\u00BA ORDEM")) ||
    row.some(cell => String(cell).toUpperCase().includes("PLACA"))
  );

  if (headerIndex === -1) {
    // Fallback to row 110 if not found, as previously specified
    headerIndex = Math.min(109, rows.length - 1);
  }
  
  const rawData = rows.slice(headerIndex);
  if (rawData.length <= 1) return [];
  
  const headers = rawData[0];
  
  return rawData.slice(1).map(row => {
    const obj: any = {};
    // Mapping following user description:
    // C=2, D=3, H=7, I=8, L=11, M=12, N=13, O=14, P=15, Q=16, R=17, U=20, V=21
    
    obj.diretoria = String(row[2] || "").trim();
    obj.gerencia = String(row[3] || "").trim();
    obj.numOrdem = String(row[7] || "").trim();
    obj.numOrcamento = String(row[8] || "").trim();
    obj.tam = String(row[11] || "").trim();
    obj.descricaoAtividade = String(row[12] || "").trim();
    obj.placa = String(row[13] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    obj.criticidade = String(row[14] || "").trim();
    obj.tipo = String(row[15] || "").trim();
    obj.estabelecimento = String(row[16] || "").trim();
    obj.custo = String(row[17] || "").trim();
    obj.expectativaEntrega = String(row[20] || "").trim();
    obj.diasEmAberto = String(row[21] || "").trim();
    
    // Add dynamic keys from headers just in case
    headers.forEach((h, i) => {
      if (h) obj[h.trim()] = row[i];
    });

    obj.__raw = row;
    return obj;
  }).filter(item => item.placa && item.placa.length >= 7);
}

export async function fetchDriversData(): Promise<any[]> {
  const rows = await fetchCsv(DRIVERS_URL);
  // Column A=0, B=1, C=2, D=3, E=4, L=11
  if (rows.length <= 1) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return dataRows
    .map(row => {
      const obj: any = { __raw: row };
      obj.codMotorista = String(row[0] || "").trim();
      obj.gerencia = String(row[1] || "").trim();
      obj.nome = String(row[2] || "").trim();
      obj.validadeStr = String(row[3] || "").trim();
      obj.categoria = String(row[4] || "").trim();
      obj.matricula = String(row[11] || "").trim();
      
      headers.forEach((h, i) => {
        if (h) obj[h.trim()] = row[i];
      });
      
      return obj;
    })
    .filter(driver => {
      const name = String(driver.nome || "").toUpperCase();
      return !name.includes("OFC ") && !name.includes("DESLIGADO");
    });
}

export async function fetchSpecialHoursData(): Promise<any[]> {
  const rows = await fetchCsv(SPECIAL_HOURS_URL);
  if (rows.length === 0) return [];
  
  // Skip potential headers and garbage, look for rows with plate length >= 7 and "SIM" in col C
  return rows.map(row => ({
    placa: String(row[1] || "").toUpperCase().replace(/[^A-Z0-9]/gi, ""), // Col B = index 1
    operacaoEspecial: String(row[2] || "").toUpperCase().trim() === "SIM" // Col C = index 2
  })).filter(item => item.placa.length >= 7 && item.operacaoEspecial);
}

export async function fetchMachineOperatorsData(): Promise<any[]> {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR3sp6A_16gY59ODjKsyhZuOOl1nYAzk94OT_cqcJY1o9098ZeDpn6yPYPmObwiI3D9XOzbI8_rgLFL/pub?output=xlsx';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch spreadsheet: ${res.statusText}`);
    
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    
    // Check if the sheet 'Relação condutores equipamento ' exists, otherwise fallback to first sheet
    const sheetName = wb.SheetNames.includes('Relação condutores equipamento ')
      ? 'Relação condutores equipamento '
      : wb.SheetNames[0];
      
    const sheet = wb.Sheets[sheetName];
    // Convert to JSON array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length <= 1) return [];

    const headers = (rows[0] || []).map(h => String(h || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const dataRows = rows.slice(1);

    return dataRows.map(row => {
      const obj: any = { __raw: row };
      
      // Defaults based on columns order:
      // Index 0: CONDUTOR (nome)
      // Index 1: PLACA / TIPO VEÍCULO (maquina)
      // Index 2: EMPRESA CONDUTOR
      // Index 3: CATEGORIA
      // Index 4: NUMERAÇÃO CNH (matricula or CNH number)
      // Index 5: UNIDADE (gerencia, like GAL, GPM)
      // Index 6: POSSUI CURSO
      // Index 7: NOME CURSO (curso)
      
      obj.nome = String(row[0] || "").trim();
      obj.maquina = String(row[1] || "").trim();
      obj.matricula = String(row[4] || "").trim(); // NUMERAÇÃO CNH
      obj.gerencia = String(row[5] || "").trim(); // UNIDADE
      obj.curso = String(row[7] || "").trim(); // NOME CURSO
      
      headers.forEach((h, i) => {
        if (h) {
          const val = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
          obj[h] = val;
          
          if (h === "CONDUTOR") {
            obj.nome = val;
          }
          if (h.includes("PLACA") || h.includes("VEICULO") || h.includes("MAQUINA") || h.includes("EQUIPAMENTO")) {
            obj.maquina = val;
          }
          if (h.includes("CNH") || h === "NUMERACAO CNH") {
            obj.matricula = val;
          }
          if (h === "UNIDADE" || h === "GERENCIA") {
            obj.gerencia = val;
          }
          if (h.includes("NOME CURSO") || h === "NOME CURSO " || h.startsWith("NOME CURSO")) {
            obj.curso = val;
          }
        }
      });

      return obj;
    }).filter(o => o.nome && o.nome !== "CONDUTOR" && o.nome !== "N/A" && o.nome.trim() !== "");
  } catch (error) {
    console.error("Error fetching machine operators data:", error);
    return [];
  }
}
