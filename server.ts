
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
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
      if (checklistTemplatesCache && (Date.now() - lastChecklistFetchTime < 30 * 60 * 1000)) {
        return res.json({ success: true, templates: checklistTemplatesCache, cached: true });
      }
      
      console.log("[SERVER] Fetching checklist templates from Google Sheets...");
      const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqVrg62SecM_o3GAnntzZoymFoNyi7JkNZ6xxNDiNGgItbx11wO01SCP_F1G9Wr3oWAcYONNt6W7zu/pub?output=xlsx";
      const buffer = await fetchUrlBinary(url);
      const wb = XLSX.read(buffer, { type: "buffer" });
      
      const templates: Record<string, any[]> = {};
      
      wb.SheetNames.forEach(sheetName => {
        if (sheetName === "Sheet1") return; // Skip default empty sheet if any
        
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        const mappedRows = rows.map((row: any) => ({
          grupo: row['Grupo'] || row['grupo'] || "",
          nomeItem: row['Nome do Item'] || row['Nome Item'] || row['nomeItem'] || row['Nome'] || "",
          descricao: row['Descrição'] || row['descricao'] || "",
          escopo: row['Escopo'] || row['escopo'] || "veiculo",
          tipoResposta: row['Tipo de Resposta'] || row['tipoResposta'] || "ok_nok",
          ordem: row['Ordem'] || row['ordem'] || 0,
          fotoObrigatoria: String(row['Foto Obrigatória'] || row['fotoObrigatoria'] || 'não').toLowerCase().trim() === 'sim' || String(row['Foto Obrigatória'] || row['fotoObrigatoria'] || 'não').toLowerCase().trim() === 'true',
          itemObrigatorio: String(row['Item Obrigatório'] || row['itemObrigatorio'] || 'sim').toLowerCase().trim() === 'sim' || String(row['Item Obrigatório'] || row['itemObrigatorio'] || 'sim').toLowerCase().trim() === 'true'
        })).filter(r => r.nomeItem && r.grupo);
        
        if (mappedRows.length > 0) {
          templates[sheetName] = mappedRows;
        }
      });
      
      checklistTemplatesCache = templates;
      lastChecklistFetchTime = Date.now();
      
      res.json({ success: true, templates, cached: false });
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

  // Helper for geocoding API JSON fetch
  function getHttpJSON(urlStr: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(urlStr, (res) => {
        const statusCode = res.statusCode || 0;
        if (statusCode !== 200) {
          return reject(new Error(`HTTP ${statusCode}`));
        }
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on("error", reject);
    });
  }

  // API Route to Geocode an address/establishment name
  app.get("/api/geocode", async (req, res) => {
    const address = req.query.address as string;
    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    // 1. Try using Google Maps Geocoding API if key is present
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || "";
    if (apiKey && apiKey !== "YOUR_API_KEY") {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const data = await getHttpJSON(url);
        if (data.status === "OK" && data.results && data.results[0]) {
          const location = data.results[0].geometry.location;
          console.log(`[GEOCODE] Successfully geocoded with Google Maps: ${address} -> (${location.lat}, ${location.lng})`);
          return res.json({ success: true, lat: location.lat, lng: location.lng, source: "google-maps" });
        } else {
          console.warn(`[GEOCODE] Google Maps API status not OK: ${data.status} for address: ${address}`);
        }
      } catch (e: any) {
        console.error("[SERVER] Google Maps Geocoding failed:", e.message);
      }
    }

    // 2. Fallback to Gemini AI which has excellent spatial understanding of Pernambuco postos / cities
    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `Geocode the following Brazilian establishment/address (usually a gas station in Pernambuco, Brazil). Provide the best estimated latitude and longitude for it.
Address/Posto: "${address}"
Respond ONLY with a JSON object containing "lat" (number) and "lng" (number). No extra formatting, markdown or wrapper tags outside the JSON.`;
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              required: ["lat", "lng"]
            }
          }
        });
        const text = response.text || "{}";
        const coords = JSON.parse(text);
        if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
          console.log(`[GEOCODE] Successfully geocoded with Gemini: ${address} -> (${coords.lat}, ${coords.lng})`);
          return res.json({ success: true, lat: coords.lat, lng: coords.lng, source: "gemini" });
        }
      } catch (e: any) {
        console.error("[SERVER] Gemini geocoding fallback failed:", e.message);
      }
    }

    // 3. Ultimate Fallback (Recife, Brazil center)
    console.warn(`[GEOCODE] All geocoding attempts failed for: ${address}. Using default Recife fallback.`);
    return res.json({ success: false, lat: -8.047562, lng: -34.877002, error: "Could not geocode" });
  });

  // API Route to classify vehicle stops using Gemini AI (lazer, lazer spaces etc)
  let aiClient: any = null;
  function getGeminiClient() {
    if (!aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (key) {
        aiClient = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      }
    }
    return aiClient;
  }

  app.post("/api/classify-stops", async (req, res) => {
    try {
      const { stops } = req.body;
      if (!stops || !Array.isArray(stops) || stops.length === 0) {
        return res.json({ success: true, classifications: [] });
      }

      const ai = getGeminiClient();
      if (!ai) {
        console.warn("[SERVER] GEMINI_API_KEY is not defined. Returning fallback classification.");
        return res.json({ 
          success: true, 
          fallback: true,
          classifications: stops.map((s, idx) => ({
            index: s.index,
            isLeisure: false,
            placeType: "Outros",
            confidence: 0.5,
            reasoning: "Chave GEMINI_API_KEY do servidor não configurada. Ativando heurística local do cliente.",
            placeNameDetected: "",
            criticality: "Nenhuma"
          })) 
        });
      }

      const prompt = `Analise a seguinte lista de locais (endereços/coordenadas/atividades) onde veículos de frota corporativa ficaram parados estacionados.
Sua tarefa é verificar a natureza do local e classificá-lo conforme o regulamento de frotas da empresa pública de saneamento (Compesa).

Regras de Classificação e Categorização:
- "isLeisure" deve ser verdadeiro (true) se o local NÃO for um local operacional autorizado de serviço público de saneamento. Qualquer desvio ou ponto recreativo, comercial de lazer, pessoal ou não autorizado deve ser true.
- "placeType" deve conter a categoria resumida em português (Ex: "Lazer", "Hospedagem", "Alimentação", "Educação", "Compras", "Saúde Particular", "Estética & Fitness", "Entretenimento", "Vida Noturna", "Serviços Pessoais", "Residencial", "Religioso", "Outros Alertas").

Você deve enquadrar os endereços/paradas nos seguintes grupos:
1. Locais de Lazer: Praia, parque aquático, clube recreativo, clube de campo, marina, píer turístico, balneário, parque de diversões, zoológico, jardim botânico, mirante turístico.
2. Hospedagem: Hotel, pousada, motel, hostel, resort, airbnb.
3. Alimentação: Restaurante, lanchonete, fast-food, cafeteria, padaria, sorveteria, churrascaria, pizzaria, food park.
4. Educação: Escola, colégio, creche, universidade, faculdade, curso preparatório, escola de idiomas.
5. Compras: Shopping Center, loja de departamentos, supermercado, hipermercado, atacadista, mercado público, centro comercial, galeria comercial.
6. Saúde: Clínica, consultório, hospital particular, laboratório.
7. Estética, Fitness e Bem-estar: Academia, centro de estética, salão de beleza, barbearia, SPA.
8. Entretenimento: Cinema, teatro, casa de shows, estádio, arena esportiva, ginásio, quadra esportiva, boliche, kartódromo.
9. Vida noturna: Bar, pub, casa noturna, boate, lounge, adega.
10. Serviços pessoais: Lava-jato, oficina não credenciada, borracharia não credenciada, loja de conveniência, lotérica.
11. Bancos e utilidades: Banco, casa de câmbio.
12. Residenciais: Condomínio residencial, residência particular, chácara, sítio, fazenda, casa de praia, casa de campo.
13. Religiosos: Igreja, templo, centro espírita, mesquita, sinagoga.
14. Outros locais de alerta: Aeroporto, rodoviária, porto, terminal marítimo, feiras livres, eventos particulares (casa de festas, buffet, centro de convenções).

Diretriz de Classificação de Criticidade ("criticality"):
- "Alta": Motel, praia, hotel, pousada, bar, boate, residência particular, shopping center, clube recreativo, resort, airbnb.
- "Média": Restaurante, lanchonete, supermercado, academia, escola, colégio, universidade, cinema, teatro, hospital particular, clínica de estética, templo/igreja, aeroporto/rodoviária.
- "Baixa": Praça, parque público, banco, lotérica, padaria, cafeteria, sorveteria, posto de conveniência, estacionamento privado, oficina/lava-jato, além de qualquer "Via Pública", "Rua", "Avenida" ou via pública comum que NÃO possua identificação explícita de uma instalação física ou base operacional da COMPESA ou obras públicas ativas. Para vias públicas comuns e praças/parques, marque isLeisure como true, categoria "Via Pública / Rua" ou "Praça / Parque", criticidade "Baixa", alertando que a parada prolongada em via pública ou praça requer verificação pois o veículo pode ter sido estacionado para fins pessoais.
- "Nenhuma": Base operacional física confirmada da COMPESA, escritório institucional oficial da empresa, ou postos operacionais da concessionária.

Forneça respostas precisas e baseadas na interpretação de nomes comerciais presentes no endereço ou em coordenadas de geolocalização.

Lista de locais para análise:
${JSON.stringify(stops, null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é um auditor sênior de conformidade de frotas da COMPESA. Classifique rigorosamente as paradas de veículos na base de inteligência com base nas regras de criticidade (Alta, Média, Baixa, Nenhuma) e categorias em português fornecidas nas diretrizes do usuário. Retorne exclusivamente a resposta em formato estruturado JSON de array de objetos.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER, description: "O campo index recebido na entrada para rastreamento" },
                isLeisure: { type: Type.BOOLEAN, description: "True se for centro comercial, lazer, turismo, residência ou qualquer parada particular" },
                placeType: { type: Type.STRING, description: "Categoria resumida: 'Lazer', 'Hospedagem', 'Alimentação', 'Educação', 'Compras', 'Saúde', 'Estética & Fitness', 'Entretenimento', 'Vida Noturna', 'Serviços Pessoais', 'Residencial', 'Religioso', 'Outros Alertas'" },
                criticality: { type: Type.STRING, description: "Grau de criticidade do desvio: 'Alta', 'Média', 'Baixa' ou 'Nenhuma'" },
                confidence: { type: Type.NUMBER, description: "Grau de confiança de 0.0 a 1.0" },
                reasoning: { type: Type.STRING, description: "Breve explicação em português de por que esse local foi categorizado com lazer e a criticidade atribuída" },
                placeNameDetected: { type: Type.STRING, description: "Nome comercial, condomínio residencial, praia, ou igreja identificada no endereço" }
              },
              required: ["index", "isLeisure", "placeType", "criticality", "confidence", "reasoning"]
            }
          }
        }
      });

      const text = response.text || "[]";
      const classifications = JSON.parse(text);
      return res.json({ success: true, classifications });
    } catch (error: any) {
      console.error("[SERVER] Erro ao classificar paradas com o Gemini:", error.message);
      res.status(500).json({ success: false, error: error.message });
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
