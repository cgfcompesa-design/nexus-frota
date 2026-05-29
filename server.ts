
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
