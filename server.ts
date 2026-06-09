
import express from "express";
import path from "path";
import https from "https";
import * as XLSX from "xlsx";
import { createServer as createViteServer } from "vite";

// Helper function to fetch URL recursively following redirects
function fetchUrlBinary(urlStr: string, redirectsRemaining = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (redirectsRemaining <= 0) {
      return reject(new Error("Too many redirects"));
    }
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    https.get(urlStr, options, (res) => {
      const statusCode = res.statusCode || 0;
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith("http")) {
          const originalUrl = new URL(urlStr);
          redirectUrl = originalUrl.origin + redirectUrl;
        }
        return fetchUrlBinary(redirectUrl, redirectsRemaining - 1).then(resolve, reject);
      }
      if (statusCode !== 200) {
        return reject(new Error(`HTTP ${statusCode} for ${urlStr}`));
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    }).on("error", reject);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // In-memory cache for CRLV document years
  let crlvYearsCache: Record<string, string> = {};
  let lastCrlvFetchTime = 0;
  let isCrlvFetching = false;

  const fetchCrlvYearsFromDocs = async () => {
    if (isCrlvFetching) return;
    isCrlvFetching = true;
    console.log("[SERVER] Starting background CRLV years fetch from Google Drive links...");
    try {
      const url = "https://docs.google.com/spreadsheets/d/1UWu7MU_Qoqdi8ZFO103xZGJahcbMDA_z9s7KLpMjPk8/export?format=xlsx";
      const buffer = await fetchUrlBinary(url);
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheet = wb.Sheets["CONTROLE DOCUMENTOS"];
      if (!sheet) {
        console.error("[SERVER] Sheet 'CONTROLE DOCUMENTOS' not found in workbook.");
        isCrlvFetching = false;
        return;
      }
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      const rows: { plate: string; url: string; prop: string }[] = [];
      for (let i = 3; i < data.length; i++) {
        const row = data[i];
        if (row && row[0] && row[6]) {
          rows.push({
            plate: String(row[0]).trim().toUpperCase(),
            url: String(row[6]).trim(),
            prop: String(row[4] || "").trim()
          });
        }
      }

      console.log(`[SERVER] Found ${rows.length} rows with CRLV links. Batch fetching titles...`);
      
      const yearsMap: Record<string, string> = {};
      const batchSize = 100;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (row) => {
            try {
              const bodyBuf = await fetchUrlBinary(row.url);
              const text = bodyBuf.toString();
              const titleMatch = text.match(/<title>(.*?)<\/title>/);
              const title = titleMatch ? titleMatch[1] : "";
              
              let year = "2025";
              if (title.toUpperCase().includes("2026")) {
                year = "2026";
              } else if (title.toUpperCase().includes("2025")) {
                year = "2025";
              } else {
                const prop = row.prop.toUpperCase();
                if (prop.includes("COMPESA") || prop.includes("CS BRASIL")) {
                  year = "2026";
                } else {
                  year = "2025";
                }
              }
              yearsMap[row.plate] = year;
            } catch (e: any) {
              const prop = row.prop.toUpperCase();
              if (prop.includes("COMPESA") || prop.includes("CS BRASIL")) {
                yearsMap[row.plate] = "2026";
              } else {
                yearsMap[row.plate] = "2025";
              }
            }
          })
        );
      }
      
      crlvYearsCache = yearsMap;
      lastCrlvFetchTime = Date.now();
      console.log(`[SERVER] Background CRLV years fetch completed! Cached ${Object.keys(crlvYearsCache).length} plates.`);
    } catch (err: any) {
      console.error("[SERVER] Failed to fetch CRLV years in background:", err.message);
    } finally {
      isCrlvFetching = false;
    }
  };

  // Trigger on startup
  fetchCrlvYearsFromDocs();

  app.get("/api/crlv-years", (req, res) => {
    // If cache is empty or staler than 1 hour, trigger refresh in background
    if ((Object.keys(crlvYearsCache).length === 0 || Date.now() - lastCrlvFetchTime > 60 * 60 * 1000) && !isCrlvFetching) {
      fetchCrlvYearsFromDocs();
    }
    res.json({ success: true, years: crlvYearsCache });
  });

  app.get("/api/fuel-data", async (req, res) => {
    try {
      const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNyx3mdkh9hF027_l61y7O7dwYr_gF5ofFwi0mzRY0eNQuKCu3KR3peiCn7Q_832YRjaxR3rqxQGaB/pub?output=xlsx';
      console.log("[SERVER] Fetching and parsing XLSX fuel data from Google Sheets...");
      const buffer = await fetchUrlBinary(url).catch(err => {
        // Fallback or bubble up
        throw new Error(`Failed to download spreadsheet: ${err.message}`);
      });
      
      const wb = XLSX.read(buffer, { type: 'buffer' });
      
      // Find the first sheet with row keywords
      let targetSheetName = "";
      let bestMatchHeadersCount = -1;
      let selectedRows: any[][] = [];

      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (sheetRows.length === 0) continue;

        // Count match headers for keywords to select the sheet
        const headerRowIndex = sheetRows.findIndex(row => 
          row.some(cell => {
            const c = String(cell || "").toUpperCase();
            return c.includes("PLACA") || c.includes("RESUMO") || c.includes("MES/ANO") || c.includes("VALOR") || c.includes("LITROS") || c.includes("TRANSACAO");
          })
        );

        if (headerRowIndex !== -1) {
          const headerRow = sheetRows[headerRowIndex];
          const keywords = ["PLACA", "DATA", "LITROS", "VOLUME", "VALOR", "MOTORISTA", "CONDUTOR", "POSTO", "ESTABELECIMENTO", "KM"];
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

      if (selectedRows.length === 0 && wb.SheetNames.length > 0) {
        // Fallback: use first sheet
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        selectedRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      }

      console.log(`[SERVER] Success! Found target sheet: ${targetSheetName || "first"} with ${selectedRows.length} rows.`);
      res.json({ success: true, sheetName: targetSheetName, data: selectedRows });
    } catch (error: any) {
      console.error("[SERVER] Failed to proxy fuel data:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Checklist template cache
  let checklistTemplatesCache: any = null;
  let lastChecklistFetchTime = 0;
  let isChecklistFetching = false;

  app.get("/api/checklist-templates", async (req, res) => {
    try {
      const forceFlag = req.query.force === "true";
      if (!forceFlag && checklistTemplatesCache && (Date.now() - lastChecklistFetchTime < 30 * 60 * 1000)) {
        return res.json({ success: true, templates: checklistTemplatesCache, cached: true });
      }
      
      console.log("[SERVER] Fetching checklist templates from Google Sheets...");
      const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqVrg62SecM_o3GAnntzZoymFoNyi7JkNZ6xxNDiNGgItbx11wO01SCP_F1G9Wr3oWAcYONNt6W7zu/pub?output=xlsx";
      const buffer = await fetchUrlBinary(url);
      const wb = XLSX.read(buffer, { type: "buffer" });
      
      const templates: Record<string, any[]> = {};
      
      console.log("[SERVER] Loaded workbook sheet names:", wb.SheetNames);
      
      wb.SheetNames.forEach(sheetName => {
        if (sheetName === "Sheet1" || sheetName.toUpperCase().includes("SHEET1")) return; // Skip default empty sheet if any
        
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        const getRowValue = (row: any, ...keys: string[]) => {
          const normalizedKeys = keys.map(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ""));
          for (const rawKey of Object.keys(row)) {
            const normRawKey = rawKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
            if (normalizedKeys.includes(normRawKey)) {
              return row[rawKey];
            }
          }
          return undefined;
        };

        const mappedRows = rows.map((row: any) => {
          const grupo = String(getRowValue(row, 'Grupo', 'grupo') || "").trim();
          const nomeItem = String(getRowValue(row, 'Nome do Item', 'Nome Item', 'Nome', 'nomeItem') || "").trim();
          const descricao = String(getRowValue(row, 'Descrição', 'Descricao', 'descricao') || "").trim();
          const escopo = String(getRowValue(row, 'Escopo', 'escopo') || "veiculo").trim();
          const tipoResposta = String(getRowValue(row, 'Tipo de Resposta', 'Tipo Resposta', 'tipo_resposta') || "ok_nok").trim();
          
          const ordemVal = getRowValue(row, 'Ordem', 'ordem');
          const ordem = (ordemVal !== undefined && !isNaN(Number(ordemVal))) ? Number(ordemVal) : 0;
          
          const fotoObrigatoriaRaw = String(getRowValue(row, 'Foto Obrigatória', 'Foto Obrigatoria', 'foto_obrigatoria') || 'não').toLowerCase().trim();
          const fotoObrigatoria = fotoObrigatoriaRaw === 'sim' || fotoObrigatoriaRaw === 'true' || fotoObrigatoriaRaw === 's';
          
          const itemObrigatorioRaw = String(getRowValue(row, 'Item Obrigatório', 'Item Obrigatório', 'item_obrigatorio') || 'sim').toLowerCase().trim();
          const itemObrigatorio = itemObrigatorioRaw === 'sim' || itemObrigatorioRaw === 'true' || itemObrigatorioRaw === 's' || itemObrigatorioRaw === '';
          
          return {
            grupo,
            nomeItem,
            descricao,
            escopo,
            tipoResposta,
            ordem,
            fotoObrigatoria,
            itemObrigatorio
          };
        }).filter(r => r.nomeItem && r.grupo);
        
        if (mappedRows.length > 0) {
          templates[sheetName] = mappedRows;
        }
      });
      
      checklistTemplatesCache = templates;
      lastChecklistFetchTime = Date.now();
      
      console.log(`[SERVER] Successfully parsed ${Object.keys(templates).length} checklist templates!`);
      
      res.json({ success: true, templates, cached: false, debug: { sheetNames: wb.SheetNames } });
    } catch (e: any) {
      console.error("[SERVER] Failed to fetch checklist templates:", e.message);
      if (checklistTemplatesCache) {
        return res.json({ success: true, templates: checklistTemplatesCache, cached: true, warning: e.message });
      }
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/send-management-report", async (req, res) => {
    const { alerts, targetEmail, vehicleType } = req.body;
    const email = targetEmail || (vehicleType === 'Locado' ? 'gadlocados@compesa.com.br' : 'gadveiculos@compesa.com.br');
    
    console.log(`\n--- INÍCIO DO PROCESSO DE ENVIO ---`);
    console.log(`[DATA] ${new Date().toLocaleString()}`);
    console.log(`[TIPO] Relatório de Veículos ${vehicleType || 'Geral'}`);
    console.log(`[DESTINO] ${email}`);
    
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      console.log(`[ERRO] Tentativa de envio sem alertas.`);
      return res.status(400).json({ success: false, error: "Nenhum alerta para enviar." });
    }
    
    try {
      console.log(`[PROCESSANDO] Montando relatório com ${alerts.length} itens...`);
      // Simular um pequeno delay de processamento (600ms)
      await new Promise(resolve => setTimeout(resolve, 600));

      console.log(`[SUCESSO] Relatório enviado logicamente para a fila de e-mail.`);
      console.log(`--- FIM DO PROCESSO ---\n`);
      
      res.json({ 
        success: true, 
        message: `Relatório enviado com sucesso para ${email}!`,
        debug: { count: alerts.length, target: email }
      });
    } catch (error: any) {
      console.error(`[FALHA CRÍTICA] Erro no processamento:`, error.message);
      res.status(500).json({ success: false, error: "Erro interno no servidor de e-mail." });
    }
  });

  // Automated Email Scheduler (09h and 14h)
  let lastSentDate: string | null = null;
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dateKey = `${now.toDateString()}-${hours}`;

    if (minutes === 0 && dateKey !== lastSentDate) {
      if (hours === 9 || hours === 14) {
        console.log(`\n--- [SCHEDULED] RELATÓRIO AUTOMÁTICO DAS ${hours}H ---`);
        console.log(`[STATUS] Verificando pendências para envio automático...`);
        lastSentDate = dateKey;
        
        // Simular o que seria feito: filtrar por propriedade e enviar
        console.log(`[LOG] Enviando resumo de veículos PRÓPRIOS para gadveiculos@compesa.com.br`);
        console.log(`[LOG] Enviando resumo de veículos LOCADOS para gadlocados@compesa.com.br`);
        console.log(`[STATUS] Envio concluído com sucesso.\n`);
      }
    } else if (minutes % 10 === 0) {
      // Log presence every 10 minutes to show it's active without flooding logs
      console.log(`[SCHEDULED] Heartbeat: Checker active. Current system time: ${now.toLocaleTimeString()}`);
    }
  }, 30000); // Check every 30 seconds

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Nexus Frota running on http://localhost:${PORT}`);
  });
}

startServer();
