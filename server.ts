
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
    
    console.log(`[API] Processing request for ${vehicleType || 'management'} report to ${email}`);
    
    if (!alerts || alerts.length === 0) {
      return res.status(400).json({ success: false, error: "Nenhum alerta para enviar." });
    }
    
    try {
      console.log(`[INFO] Report data summary: ${alerts?.length || 0} alerts found.`);
      // Mock sending
      res.json({ success: true, message: `Relatório enviado com sucesso para ${email}` });
    } catch (error) {
      console.error("[ERROR] Failed to send report:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
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
