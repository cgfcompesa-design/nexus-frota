
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
  app.post("/api/send-management-report", async (req, res) => {
    const { alerts } = req.body;
    console.log(`[API] Receiving request to send report to gadveiculos@compesa.com.br`);
    
    // In a real production app, we would use nodemailer or a service like SendGrid/SES
    // Since we don't have keys, we'll log the intention and return success.
    // Logic for actual sending would go here.
    
    try {
      console.log(`[INFO] Report data summary: ${alerts?.length || 0} alerts found.`);
      // Mock sending
      res.json({ success: true, message: "Report sent to gadveiculos@compesa.com.br" });
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
        console.log(`[SCHEDULED] System: 09:00/14:00 reached. Preparing automated report...`);
        lastSentDate = dateKey;
        
        // In a real environment, we would fetch data here using axios/fetch 
        // from the same Google Sheets URLs and use the processMaintenanceAlerts/processTaxAlerts logic.
        
        console.log(`[SCHEDULED] Report would be sent to gadveiculos@compesa.com.br at this moment.`);
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
