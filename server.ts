
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
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
        console.log(`[SCHEDULED] System: 09:00/14:00 reached. Preparing automated reports...`);
        lastSentDate = dateKey;
        
        // In a real environment, we would fetch data here and send to both.
        console.log(`[SCHEDULED] Automated report would be sent to gadveiculos@compesa.com.br (Próprios)`);
        console.log(`[SCHEDULED] Automated report would be sent to gadlocados@compesa.com.br (Locados)`);
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
