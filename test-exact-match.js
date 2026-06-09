import { fetchFleetData } from "./src/services/fleetService.js";
import * as XLSX from "xlsx";

async function fetchUrlBinary(url) {
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

const ultraNormalize = (str) => {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

async function run() {
  console.log("Fetching fleet assets...");
  const assets = await fetchFleetData();
  const pcc = assets.find(a => String(a.PLACA || "").toUpperCase() === "PCC9134");
  if (!pcc) {
    console.log("PCC9134 not found");
    return;
  }
  
  const vehicleTypeRaw = pcc["TIPO"] || pcc["TIPO VEICULO"] || "";
  console.log(`PCC9134 TIPO raw value: "${vehicleTypeRaw}"`);
  console.log(`PCC9134 TIPO normalized: "${ultraNormalize(vehicleTypeRaw)}"`);
  for (let i = 0; i < vehicleTypeRaw.length; i++) {
    console.log(`  char[${i}]: ${vehicleTypeRaw.charCodeAt(i)} ('${vehicleTypeRaw[i]}')`);
  }

  console.log("\nFetching templates from spreadsheet xlsx output...");
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqVrg62SecM_o3GAnntzZoymFoNyi7JkNZ6xxNDiNGgItbx11wO01SCP_F1G9Wr3oWAcYONNt6W7zu/pub?output=xlsx";
  const buffer = await fetchUrlBinary(url);
  const wb = XLSX.read(buffer, { type: "buffer" });
  
  console.log("Workbook SheetNames:", wb.SheetNames);
  
  wb.SheetNames.forEach(sheetName => {
    const normTk = ultraNormalize(sheetName);
    const normAssetType = ultraNormalize(vehicleTypeRaw);
    const exactMatch = normAssetType === normTk;
    const partialMatch = normAssetType.includes(normTk) || normTk.includes(normAssetType);
    if (exactMatch || partialMatch) {
      console.log(`\nMatch found with sheetName: "${sheetName}"`);
      console.log(`  sheetName normalized: "${normTk}"`);
      console.log(`  Exact Match: ${exactMatch}`);
      console.log(`  Partial Match: ${partialMatch}`);
      for (let i = 0; i < sheetName.length; i++) {
        console.log(`    char[${i}]: ${sheetName.charCodeAt(i)} ('${sheetName[i]}')`);
      }
    }
  });
}

run();
