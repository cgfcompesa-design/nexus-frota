import https from "https";

function inspectHeaders() {
  const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSFg3m2gRlhFtmKMTDcVQW3YmIZXOhlWCN6693HLNHH9kR7GJ7mMayr2U35OOSze6VfJTGOB0GCJsYP/pub?gid=1689333411&single=true&output=csv';
  https.get(url, (res) => {
    const statusCode = res.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
      https.get(res.headers.location, handleResponse);
      return;
    }
    handleResponse(res);
  }).on("error", (err) => console.error(err));

  function handleResponse(res: any) {
    let accumulated = "";
    res.on("data", (chunk: Buffer) => {
      accumulated += chunk.toString("utf-8");
      const lines = accumulated.split("\n");
      if (lines.length >= 2) {
        console.log("Header row length in characters:", lines[0].length);
        const cols = lines[0].split(",");
        console.log("Total columns found:", cols.length);
        cols.forEach((col, i) => {
          console.log(`Col ${i}: "${col.trim()}"`);
        });
        res.destroy();
        process.exit(0);
      }
    });
  }
}

inspectHeaders();
