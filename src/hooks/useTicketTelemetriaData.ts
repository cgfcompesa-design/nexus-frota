import { useState, useEffect } from "react";
import Papa from "papaparse";

export interface TicketTelemetriaRecord {
  dataOcorrencia: string; // "DATA DA OCORRÊNCIA"
  unidade: string;        // "UNIDADE"
  placa: string;          // "PLACA"
  marcaModelo: string;    // "MARCA / MODELO"
  ano: string;            // "ANO"
  tipoAnomalia: string;   // "TIPO DE ANOMALIA"
  descricaoOcorrencia: string; // "DESCRIÇÃO DA OCORRÊNCIA"
  responsavelAnalise: string;  // "RESPONSÁVEL PELA ANÁLISE"
  anexo: string;          // "Anexo "
  status: string;         // "Status "
  [key: string]: any;
}

export function useTicketTelemetriaData() {
  const [data, setData] = useState<TicketTelemetriaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5CMH9s8_Ygmmo8CVTNyEJvxQJdjocJhN4NGNchA0OBQtDdzugxbwp9SA0hwlzrJN4kbI7H-Fwwam1/pub?output=csv";
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch CSV data: ${response.statusText}`);
        }
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: false, // We will handle header indexing manually since row 0 is a title row
          skipEmptyLines: true,
          complete: (results) => {
            const rawRows = results.data as string[][];
            if (rawRows.length < 2) {
              setData([]);
              setIsLoading(false);
              return;
            }
            
            // Row 0 is title row (e.g., ["ANÁLISE DESVIOS ABASTECIMENTO", ...])
            // Row 1 is header row (["DATA DA OCORRÊNCIA", "UNIDADE", "PLACA", ...])
            const headers = rawRows[1].map(h => String(h || "").trim());
            const dataRows = rawRows.slice(2);
            
            const mappedData: TicketTelemetriaRecord[] = dataRows.map((row) => {
              const obj: any = {};
              
              // Map index-based elements
              row.forEach((cell, idx) => {
                obj[idx] = String(cell || "").trim();
              });

              // Map by header name normalized
              headers.forEach((header, idx) => {
                if (header) {
                  obj[header] = String(row[idx] || "").trim();
                }
              });

              // Construct a typed, normalized record
              return {
                dataOcorrencia: obj["DATA DA OCORRÊNCIA"] || "",
                unidade: obj["UNIDADE"] || "",
                placa: String(obj["PLACA"] || "").toUpperCase().trim(),
                marcaModelo: obj["MARCA / MODELO"] || "",
                ano: obj["ANO"] || "",
                tipoAnomalia: obj["TIPO DE ANOMALIA"] || "",
                descricaoOcorrencia: obj["DESCRIÇÃO DA OCORRÊNCIA"] || "",
                responsavelAnalise: obj["RESPONSÁVEL PELA ANÁLISE"] || "",
                anexo: obj["Anexo"] || obj["Anexo "] || "",
                status: obj["Status"] || obj["Status "] || "Pendente",
                ...obj
              };
            });
            
            setData(mappedData);
            setIsLoading(false);
          },
          error: (err: any) => {
            setError(err.message);
            setIsLoading(false);
          }
        });
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
}
