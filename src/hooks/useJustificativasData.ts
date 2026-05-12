import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export interface JustificativaData {
  "Carimbo de data/hora": string;
  "Endereço de e-mail": string;
  "Diretoria / Gerência": string;
  "Data da Transação": string;
  "Cód. Transação": string;
  "Placa": string;
  "Modelo Veículo": string;
  "Tipo Combustível": string;
  "Litros": string;
  "VL/Litro": string;
  "Hodometro ou Horimetro (TICKET)": string;
  "Hodômetro Enviado (FOTO)": string;
  "Nível Tanque (L) / (FOTO)": string;
  "Anexo Enviado": string;
  "Retorno Unidade": string;
  "INFORMAÇÃO ADICIONAL 1": string;
  "INFORMAÇÃO ADICIONAL 2": string;
  "INFORMAÇÃO ADICIONAL 3": string;
  [key: string]: any;
}

export function useJustificativasData() {
  const [data, setData] = useState<JustificativaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Link fornecido pelo usuário
        const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRHz_VkcX0viVdLyzv-za-XYTTMBAZEGI65vlJMNUyTLBXkdbmdTg4FOVWWkXHm3pJbpgsqbSE20-JW/pub?gid=1595425753&single=true&output=csv";
        
        const response = await fetch(url);
        const csvText = await response.text();
        
        // O usuário informou que o cabeçalho está na linha 02 e dados a partir da linha 03
        // Vamos pular a primeira linha (vazia ou irrelevante) se necessário, mas PapaParse geralmente lida bem se houver cabeçalhos vazios.
        // Se a linha 1 for lixo, podemos dar um slice no texto.
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // PapaParse considera a primeira linha do texto como header por padrão com header: true
            // Se o header real está na linha 2, precisamos tratar o texto antes do parse ou depois.
            // Vamos tentar omitir a primeira linha se ela não parecer um cabeçalho.
            const lines = csvText.split('\n');
            // Se a primeira linha for vazia ou não tiver os cabeçalhos esperados:
            const refinedCsv = lines.slice(1).join('\n'); // Pula a primeira linha conforme instrução (cabeçalho na linha 2)
            
            Papa.parse(refinedCsv, {
              header: false, // Use false to get indices
              skipEmptyLines: true,
              complete: (refinedResults) => {
                const rawRows = refinedResults.data as string[][];
                if (rawRows.length < 1) {
                  setData([]);
                  setIsLoading(false);
                  return;
                }
                
                const headers = rawRows[0];
                const dataRows = rawRows.slice(1);
                
                const mappedData = dataRows.map(row => {
                  const obj: any = {};
                  // Map by index (0, 1, 2...)
                  row.forEach((cell, idx) => {
                    obj[idx] = cell;
                  });
                  // Map by header name (if available)
                  headers.forEach((header, idx) => {
                    if (header) {
                      obj[header.trim()] = row[idx];
                    }
                  });
                  return obj as JustificativaData;
                });
                
                setData(mappedData);
                setIsLoading(false);
              },
              error: (err: any) => {
                setError(err.message);
                setIsLoading(false);
              }
            });
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
