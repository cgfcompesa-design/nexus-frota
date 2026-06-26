import { toast } from "sonner";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

const SPREADSHEET_ID = "1WgFgBql4kyookwaf4C4BKRA_-vOjV5l842e7rBkQ3Xo";
const SHEET_NAME = "CONTROLE PREVENTIVA";

// Ensure the spreadsheets scope is registered
googleProvider.addScope("https://www.googleapis.com/auth/spreadsheets");

/**
 * Gets the current cached access token from sessionStorage
 */
export function getSheetsAccessToken(): string | null {
  return sessionStorage.getItem("google_sheets_access_token");
}

/**
 * Saves the access token to sessionStorage
 */
export function setSheetsAccessToken(token: string) {
  sessionStorage.setItem("google_sheets_access_token", token);
}

/**
 * Clears the access token
 */
export function clearSheetsAccessToken() {
  sessionStorage.removeItem("google_sheets_access_token");
}

/**
 * Prompts the user with a popup to authorize Google Sheets access
 */
export async function authorizeGoogleSheets(): Promise<string> {
  try {
    toast.info("Abrindo janela de autorização do Google...");
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error("Não foi possível obter o token de acesso do Google.");
    }

    setSheetsAccessToken(token);
    toast.success("Conexão com Google Sheets autorizada!");
    return token;
  } catch (err: any) {
    console.error("Erro na autenticação do Google Sheets:", err);
    throw new Error(err.message || "Erro desconhecido ao autenticar.");
  }
}

/**
 * Fetches sheet values to locate headers and row indexes
 */
export async function fetchSheetValues(token: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearSheetsAccessToken();
      throw new Error("Sua sessão do Google Sheets expirou. Por favor, autorize novamente.");
    }
    throw new Error(`Erro ao carregar planilha: Código ${res.status}`);
  }

  const data = await res.json();
  return data.values || [];
}

interface UpdateItem {
  placa: string;
  odometroRevisao: number;
  revisaoPrevista: number;
  dataRevisao: string;
  status: "Pendente" | "Em Dia";
}

/**
 * Updates multiple rows in Google Sheets based on Placa match
 */
export async function updateGoogleSheetsData(updates: UpdateItem[]): Promise<number> {
  let token = getSheetsAccessToken();
  if (!token) {
    token = await authorizeGoogleSheets();
  }

  try {
    const rows = await fetchSheetValues(token);
    if (rows.length === 0) {
      throw new Error("A planilha 'CONTROLE PREVENTIVA' está vazia ou não pôde ser lida.");
    }

    // Locate header row containing "PLACA"
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (row && row.some(cell => String(cell).toUpperCase().trim() === "PLACA")) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new Error("Não foi possível localizar a coluna 'PLACA' nos cabeçalhos da planilha.");
    }

    const headers = rows[headerRowIdx].map(h => String(h || "").trim().toUpperCase());

    const placaIdx = headers.findIndex(h => h === "PLACA");
    const odoRevIdx = headers.findIndex(h => h.includes("ODÔMETRO REVISÃO") || h.includes("ODOMETRO REVISAO"));
    const revPrevIdx = headers.findIndex(h => h.includes("REVISÃO PREVISTA") || h.includes("REVISAO PREVISTA"));
    const dataRevIdx = headers.findIndex(h => h.includes("DATA REVISÃO") || h.includes("DATA REVISAO"));
    const statusIdx = headers.findIndex(h => h.includes("STATUS REVISÃO") || h.includes("STATUS REVISAO"));

    if (placaIdx === -1) {
      throw new Error("A coluna 'PLACA' não foi encontrada.");
    }

    const updateDataList: any[] = [];
    let updatedCount = 0;

    // Build update list
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[placaIdx]) continue;

      const currentPlaca = String(row[placaIdx]).toUpperCase().replace(/[^A-Z0-9]/gi, "").trim();
      const update = updates.find(u => u.placa.toUpperCase().replace(/[^A-Z0-9]/gi, "").trim() === currentPlaca);

      if (update) {
        // Convert sheet row index (0-based) to Excel cell coordinate (1-based, e.g., A6)
        // Note: Google Sheets API expects A1 notation. 
        const sheetRowNumber = i + 1;

        if (odoRevIdx !== -1) {
          updateDataList.push({
            range: `${SHEET_NAME}!${getColLetter(odoRevIdx)}${sheetRowNumber}`,
            values: [[update.odometroRevisao]],
          });
        }
        if (revPrevIdx !== -1) {
          updateDataList.push({
            range: `${SHEET_NAME}!${getColLetter(revPrevIdx)}${sheetRowNumber}`,
            values: [[update.revisaoPrevista]],
          });
        }
        if (dataRevIdx !== -1) {
          // Format date as DD/MM/YYYY
          let formattedDate = update.dataRevisao;
          if (formattedDate && formattedDate.includes("-")) {
            const parts = formattedDate.split("-");
            if (parts.length === 3) {
              formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          }
          updateDataList.push({
            range: `${SHEET_NAME}!${getColLetter(dataRevIdx)}${sheetRowNumber}`,
            values: [[formattedDate]],
          });
        }
        if (statusIdx !== -1) {
          updateDataList.push({
            range: `${SHEET_NAME}!${getColLetter(statusIdx)}${sheetRowNumber}`,
            values: [[update.status]],
          });
        }

        updatedCount++;
      }
    }

    if (updateDataList.length === 0) {
      console.warn("Nenhum veículo editado foi encontrado na planilha 'CONTROLE PREVENTIVA'.");
      return 0;
    }

    // Perform batch update
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
    const batchRes = await fetch(batchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: updateDataList,
      }),
    });

    if (!batchRes.ok) {
      throw new Error(`Erro na gravação em lote: Código ${batchRes.status}`);
    }

    return updatedCount;
  } catch (err: any) {
    if (err.message?.includes("401") || err.message?.includes("expired")) {
      clearSheetsAccessToken();
    }
    console.error("Erro durante atualização do Google Sheets:", err);
    throw err;
  }
}

/**
 * Converts column index to Excel column letter (e.g. 0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
 */
function getColLetter(index: number): string {
  let temp = "";
  let idx = index;
  while (idx >= 0) {
    temp = String.fromCharCode((idx % 26) + 65) + temp;
    idx = Math.floor(idx / 26) - 1;
  }
  return temp;
}
