import XLSX from 'xlsx-js-style';

export const exportToExcel = (data: any[], fileName: string, sheetName: string) => {
  if (!data || data.length === 0) return;
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Custom styling and formatting for single sheet export
  const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:A1");
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[address]) continue;
      
      if (!worksheet[address].s) worksheet[address].s = {};
      
      if (R === 0) {
        // Style Header
        worksheet[address].s = {
          fill: { fgColor: { rgb: "004a99" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
          alignment: { horizontal: "center", vertical: "center" }
        };
      } else {
        // Data rows: Detect and format currency
        const headerAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        const headerCell = worksheet[headerAddress];
        const headerText = headerCell ? String(headerCell.v).toUpperCase() : "";
        
        // General cell alignment
        worksheet[address].s = {
          alignment: { horizontal: "center", vertical: "center" }
        };

        const isCurrencyHeader = (
          (headerText.includes("CUSTO") ||
           headerText.includes("VALOR") ||
           headerText.includes("GASTO") ||
           headerText.includes("REALIZADO") ||
           headerText.includes("TOTAL") ||
           headerText.includes("DESVIO") ||
           headerText.includes("ORÇADO") ||
           headerText.includes("R$")) &&
          !headerText.includes("QTD") &&
          !headerText.includes("QUANTIDADE")
        );
        
        // Check if value is numeric or can be parsed
        let cellVal = worksheet[address].v;
        if (typeof cellVal === "string" && isCurrencyHeader) {
          const clean = cellVal.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
          const parsed = parseFloat(clean);
          if (!isNaN(parsed)) {
            cellVal = parsed;
          }
        }

        if (typeof cellVal === "number" && isCurrencyHeader) {
          worksheet[address].t = "n";
          worksheet[address].v = cellVal;
          worksheet[address].z = '"R$"#,##0.00';
          worksheet[address].s.alignment = { horizontal: "right", vertical: "center" };
        }
      }
    }
  }

  // Write and download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

interface SheetData {
  data: any[];
  sheetName: string;
}

export const exportToExcelMultiSheet = (sheets: SheetData[], fileName: string) => {
  if (!sheets || sheets.length === 0) return;
  
  const workbook = XLSX.utils.book_new();
  
  sheets.forEach(sheet => {
    if (sheet.data && sheet.data.length > 0) {
      // Ensure sheet name is unique, <= 31 chars and has no illegal characters
      let safeName = (sheet.sheetName || 'Sheet')
        .replace(/[:\\/?*[\]]/g, '_')
        .substring(0, 31);
      
      // Create an empty worksheet or one with titles first
      const worksheet = XLSX.utils.aoa_to_sheet([[]]);
      
      // Add Title at A1 with a more prominent layout
      if (sheet.sheetName) {
        const title = sheet.sheetName.toUpperCase();
        const dateStr = new Date().toLocaleString('pt-BR');
        
        XLSX.utils.sheet_add_aoa(worksheet, [
          [title],
          [`Gerado em: ${dateStr}`],
          [""]
        ], { origin: "A1" });
        
        // Style for titles
        worksheet["A1"].s = {
          font: { bold: true, sz: 14, color: { rgb: "003366" } },
          alignment: { horizontal: "center" }
        };
        worksheet["A2"].s = {
          font: { italic: true, sz: 10, color: { rgb: "666666" } },
          alignment: { horizontal: "center" }
        };

        // Merge title rows
        if (!worksheet['!merges']) worksheet['!merges'] = [];
        worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } });
        worksheet['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 15 } });
      }

      // Add data starting at A4
      XLSX.utils.sheet_add_json(worksheet, sheet.data, { origin: "A4" });

      // Identify data range and apply styles
      const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:A1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[address]) continue;
          
          if (!worksheet[address].s) worksheet[address].s = {};
          
          // Header Row (Row 4, which is R = 3)
          if (R === 3) {
            worksheet[address].s = {
              fill: { fgColor: { rgb: "004a99" } },
              font: { color: { rgb: "FFFFFF" }, bold: true },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "002b5c" } },
                bottom: { style: "thin", color: { rgb: "002b5c" } },
                left: { style: "thin", color: { rgb: "002b5c" } },
                right: { style: "thin", color: { rgb: "002b5c" } }
              }
            };
          } else if (R > 3) {
            // Data Rows
            worksheet[address].s = {
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "e2e8f0" } },
                bottom: { style: "thin", color: { rgb: "e2e8f0" } },
                left: { style: "thin", color: { rgb: "e2e8f0" } },
                right: { style: "thin", color: { rgb: "e2e8f0" } }
              }
            };
            
            // Alternating rows (subtle blue)
            if (R % 2 !== 0) {
              worksheet[address].s.fill = { fgColor: { rgb: "f0f7ff" } };
            }

            // Identify header key
            const headerAddress = XLSX.utils.encode_cell({ r: 3, c: C });
            const headerCell = worksheet[headerAddress];
            const headerText = headerCell ? String(headerCell.v).toUpperCase() : "";

            const isCurrencyHeader = (
              (headerText.includes("CUSTO") ||
               headerText.includes("VALOR") ||
               headerText.includes("GASTO") ||
               headerText.includes("REALIZADO") ||
               headerText.includes("TOTAL") ||
               headerText.includes("DESVIO") ||
               headerText.includes("ORÇADO") ||
               headerText.includes("R$")) &&
              !headerText.includes("QTD") &&
              !headerText.includes("QUANTIDADE")
            );

            // Row text indicator of quantity to protect counts from being formatted
            const labelCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
            const labelText = labelCell ? String(labelCell.v).toUpperCase() : "";
            const isRowQuantityInfo = labelText.includes("QTD") || labelText.includes("QUANTIDADE");

            let cellVal = worksheet[address].v;
            // Parse numerical string if it was converted from formatted string
            if (typeof cellVal === "string" && isCurrencyHeader && !isRowQuantityInfo) {
              const clean = cellVal.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
              const parsed = parseFloat(clean);
              if (!isNaN(parsed)) {
                cellVal = parsed;
              }
            }

            if (typeof cellVal === "number" && isCurrencyHeader && !isRowQuantityInfo) {
              worksheet[address].t = "n";
              worksheet[address].v = cellVal;
              worksheet[address].z = '"R$"#,##0.00';
              worksheet[address].s.alignment = { horizontal: "right", vertical: "center" };
            }
          }
        }
      }

      // Column widths
      worksheet['!cols'] = [
        { wch: 15 }, // CODIGO TRANSACAO
        { wch: 20 }, // DATA TRANSACAO
        { wch: 12 }, // PLACA
        { wch: 15 }, // TIPO FROTA
        { wch: 30 }, // MODELO VEICULO
        { wch: 30 }, // NOME MOTORISTA
        { wch: 15 }, // SERVICO
        { wch: 18 }, // TIPO COMBUSTIVEL
        { wch: 10 }, // LITROS
        { wch: 10 }, // VL/LITRO
        { wch: 15 }, // HODOMETRO
        { wch: 15 }, // KM RODADOS
        { wch: 12 }, // VALOR
        { wch: 35 }, // POSTO
        { wch: 40 }, // ENDERECO
        { wch: 20 }, // BAIRRO
        { wch: 20 }, // CIDADE
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
    }
  });
  
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
