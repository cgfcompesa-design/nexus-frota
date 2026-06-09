import https from "https";

function fetchUrlText(urlStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      const statusCode = res.statusCode || 0;
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        return fetchUrlText(res.headers.location).then(resolve, reject);
      }
      if (statusCode !== 200) {
        return reject(new Error(`HTTP ${statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    }).on("error", reject);
  });
}

async function inspectAssets() {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSFg3m2gRlhFtmKMTDcVQW3YmIZXOhlWCN6693HLNHH9kR7GJ7mMayr2U35OOSze6VfJTGOB0GCJsYP/pub?gid=1689333411&single=true&output=csv';
    console.log("Fetching assets CSV...");
    const csvText = await fetchUrlText(url);
    const lines = csvText.split("\n");
    console.log("Total assets lines:", lines.length);
    console.log("First line (headers):", lines[0].substring(0, 500));
    const headerCols = lines[0].split(",");
    headerCols.forEach((col, idx) => {
      console.log(`Column ${idx}: ${col}`);
    });
    
    // Let's count different qualities for column "TIPO CONTROLE AUTONOMIA" or similar
    const counts = new Map<string, number>();
    for (let i = 1; i < Math.min(200, lines.length); i++) {
      const cols = lines[i].split(",");
      // let's grab column 43 (index 43) or find where TIPO CONTROLE AUTONOMIA is
      const tcVal = cols[43] || "undefined";
      counts.set(tcVal, (counts.get(tcVal) || 0) + 1);
    }
    console.log("Distribution of Column 43 across first 200 rows:", Array.from(counts.entries()));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

inspectAssets();
