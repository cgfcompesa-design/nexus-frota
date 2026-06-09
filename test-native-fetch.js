import * as XLSX from 'xlsx';

async function run() {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqVrg62SecM_o3GAnntzZoymFoNyi7JkNZ6xxNDiNGgItbx11wO01SCP_F1G9Wr3oWAcYONNt6W7zu/pub?output=xlsx";
  console.log("Fetching using native fetch from:", url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log("Response status:", res.status, res.statusText);
    if (!res.ok) {
      const text = await res.text();
      console.log("Response error body snippet:", text.substring(0, 500));
      return;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Downloaded buffer size:", buffer.length);
    
    const wb = XLSX.read(buffer, { type: "buffer" });
    console.log("Workbook sheets found:", wb.SheetNames);
    
    wb.SheetNames.forEach(sheetName => {
      console.log(`\n--- SheetName: "${sheetName}" ---`);
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log(`Total rows in sheet: ${rows.length}`);
      if (rows.length > 0) {
        console.log("First row keys:", Object.keys(rows[0]));
        console.log("First row sample:", rows[0]);
      }
    });
  } catch (err) {
    console.error("Error occurred during fetch:", err);
  }
}

run();
