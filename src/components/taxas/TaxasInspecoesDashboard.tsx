import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, AlertTriangle, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssets } from "@/hooks/useFleetData";
import { exportToExcel } from "@/lib/exportToExcel";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const TAXA_CARROCERIA_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=807131603&single=true&output=csv";
const INSPECAO_TACOGRAFO_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=1553195011&single=true&output=csv";
const VISTORIA_CIV_CIPP_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=1527811172&single=true&output=csv";
const INSPECAO_CSV_API = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4KEh8BbV2ta5a_GLcfuYDenLmG7q-g_zGjGER1NVL0mPZwgu3dnCMB0pMQ82YLqEN9oaWYyu6INdo/pub?gid=1469835888&single=true&output=csv";

const fetchCSVWithRetry = async (url: string, retries = 3): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return "";
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      const trimmed = current.trim();
      result.push(trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed);
      current = "";
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  result.push(trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed);

  return result;
};

interface CsvRow {
  [key: string]: string | number;
}

const useCsvTable = (url: string, columnMap: Record<string, number>, dataStartRowIndex = 3) => {
  return useQuery<CsvRow[]>({
    queryKey: ["csv-table", url],
    queryFn: async () => {
      const csvText = await fetchCSVWithRetry(url);
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      
      // Se tiver poucas linhas, talvez o startRowIndex esteja errado ou a planilha esteja vazia
      // Vamos tentar detectar se a linha 0 já parece ser dados (placa na col 0)
      let actualStart = dataStartRowIndex;
      if (lines.length > 0) {
        const firstLine = parseCsvLine(lines[0]);
        // Regex simples para placa (3 letras e 4 números ou Mercosul)
        const placaRegex = /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/i;
        if (placaRegex.test(firstLine[0])) {
           actualStart = 0;
        } else if (lines.length > 1) {
           const secondLine = parseCsvLine(lines[1]);
           if (placaRegex.test(secondLine[0])) actualStart = 1;
        }
      }

      if (lines.length <= actualStart) return [];
      const dataLines = lines.slice(actualStart);

      return dataLines.map((line) => {
        const values = parseCsvLine(line);
        const obj: CsvRow = {};
        Object.entries(columnMap).forEach(([key, index]) => {
          obj[key] = values[index] ?? "";
        });
        return obj;
      });
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
};

interface SimpleTableProps {
  title: string;
  description: string;
  data: CsvRow[] | undefined;
  isLoading: boolean;
  error: unknown;
  columns: { key: string; label: string }[];
}

const SimpleTable = ({ title, description, data, isLoading, error, columns }: SimpleTableProps) => {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2 space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando dados...</p>}
        {error && !isLoading && (
          <p className="text-xs text-destructive">Erro ao carregar dados desta tabela.</p>
        )}
        {!isLoading && !error && data && (
          <ScrollArea className="h-[320px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className="text-center text-xs font-medium uppercase tracking-wide"
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/40">
                    {columns.map((col) => (
                      <TableCell key={col.key} className="text-center text-xs">
                        {String(row[col.key] ?? "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

const parseBrazilianDate = (value: string | number | undefined): Date | null => {
  if (!value) return null;
  const str = String(value).trim();
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => parseInt(p, 10));
  if (!day || !month || !year) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day);
};

const daysDiffFromToday = (date: Date | null): number | null => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getTime());
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

const BLUE_COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

export const TaxasInspecoesDashboard = () => {
  const {
    data: taxaCarroceria,
    isLoading: loadingCarroceria,
    error: errorCarroceria,
  } = useCsvTable(TAXA_CARROCERIA_API, {
    "Placa": 0, // Coluna A
    "Status Certificado": 8, // Coluna I
    "Data Medição": 9, // Coluna J
    "Data Validade": 10, // Coluna K
  });

  const {
    data: inspecaoTacografo,
    isLoading: loadingTacografo,
    error: errorTacografo,
  } = useCsvTable(INSPECAO_TACOGRAFO_API, {
    "Placa": 0, // Coluna A
    "Propriedade": 4, // Coluna E
    "Data Última Aferição": 8, // Coluna I
    "Data Validade": 10, // Coluna K
    "Status Tacógrafo": 12, // Coluna M
  });

  const {
    data: vistoriaCivCipp,
    isLoading: loadingCivCipp,
    error: errorCivCipp,
  } = useCsvTable(VISTORIA_CIV_CIPP_API, {
    "Placa": 0, // Coluna A
    "Data Última Aferição": 8, // Coluna I
    "Data Validade": 9, // Coluna J
    "Status Inspeção": 10, // Coluna K
  });

  const {
    data: inspecaoCsv,
    isLoading: loadingCsv,
    error: errorCsv,
  } = useCsvTable(INSPECAO_CSV_API, {
    "Placa": 0, // Coluna A
    "Propriedade": 4, // Coluna E
    "Data Inspeção": 7, // Coluna H
    "Data Validade": 8, // Coluna I
    "Status Serviço": 9, // Coluna J
  });

  const { data: assets = [] } = useAssets();

  const assetsByPlaca = useMemo(() => {
    const map = new Map<string, any>();
    assets.forEach((asset: any) => {
      const placa = String(asset.PLACA || asset.placa || "").toUpperCase();
      if (placa) {
        map.set(placa, asset);
      }
    });
    return map;
  }, [assets]);

  const [placaFilter, setPlacaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [prazoFilter, setPrazoFilter] = useState<"all" | "vencidos" | "ate30">("all");
  const [diretoriaFilter, setDiretoriaFilter] = useState<string>("all");
  const [gerenciaFilter, setGerenciaFilter] = useState<string>("all");
  const [propriedadeFilter, setPropriedadeFilter] = useState<string>("all");

  // Remove internal BLUE_COLORS definition as it is now global

  const allData = useMemo(() => {
    const withTipo = (
      data: CsvRow[] | undefined,
      tipo: string,
      validadeKey: string,
      statusKey?: string
    ): (CsvRow & { __tipo: string; __validadeKey: string; __statusKey?: string; __diretoria?: string; __gerencia?: string; __propriedade?: string })[] => {
      if (!data) return [];
      return data.map((row) => {
        const placa = String(row["Placa"] || "").toUpperCase();
        const asset = assetsByPlaca.get(placa);
        return {
          ...row,
          __tipo: tipo,
          __validadeKey: validadeKey,
          __statusKey: statusKey,
          __diretoria: asset?.DIRETORIA || asset?.Diretoria || "",
          __gerencia: asset?.COLUNA_E || asset?.GERÊNCIA || asset?.GERENCIA || asset?.Gerência || asset?.Gerencia || asset?.["UNIDADE"] || "",
          __propriedade: asset?.PROPRIEDADE || asset?.PROPRIEDADE_TIPO || "",
        };
      });
    };

    return [
      ...withTipo(taxaCarroceria, "Taxa Carroceria Inmetro", "Data Validade", "Status Certificado"),
      ...withTipo(inspecaoTacografo, "Inspeção Tacógrafo", "Data Validade", "Status Tacógrafo"),
      ...withTipo(vistoriaCivCipp, "Vistoria CIV/CIPP", "Data Validade", "Status Inspeção"),
      ...withTipo(inspecaoCsv, "Inspeção CSV", "Data Validade", "Status Serviço"),
    ];
  }, [taxaCarroceria, inspecaoTacografo, vistoriaCivCipp, inspecaoCsv, assetsByPlaca]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    allData.forEach((row) => {
      if (row.__statusKey && row[row.__statusKey]) {
        set.add(String(row[row.__statusKey]));
      }
    });
    return Array.from(set).sort();
  }, [allData]);

  const diretoriaOptions = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset: any) => {
      if (asset.DIRETORIA) {
        set.add(String(asset.DIRETORIA));
      }
    });
    return Array.from(set).sort();
  }, [assets]);

  const gerenciaOptions = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset: any) => {
      if (asset.GERENCIA) {
        set.add(String(asset.GERENCIA));
      }
    });
    return Array.from(set).sort();
  }, [assets]);

  const propriedadeOptions = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset: any) => {
      if (asset.PROPRIEDADE) {
        set.add(String(asset.PROPRIEDADE));
      }
    });
    return Array.from(set).sort();
  }, [assets]);

  const kpis = useMemo(() => {
    let total = 0;
    let vencidos = 0;
    let ate30 = 0;

    allData.forEach((row) => {
      const validadeRaw = row[row.__validadeKey];
      const date = parseBrazilianDate(validadeRaw as string | number | undefined);
      const diff = daysDiffFromToday(date);
      if (diff === null) return;
      total++;
      if (diff < 0) vencidos++;
      if (diff >= 0 && diff <= 30) ate30++;
    });

    return { total, vencidos, ate30 };
  }, [allData]);

  const filteredData = useMemo(() => {
    return allData.filter((row) => {
      const placa = String(row["Placa"] || "").toLowerCase();
      const status = row.__statusKey ? String(row[row.__statusKey] || "") : "";
      const diretoria = String((row as any).__diretoria || "");
      const gerencia = String((row as any).__gerencia || "");
      const propriedade = String((row as any).__propriedade || "");
      const validadeRaw = row[row.__validadeKey];
      const diff = daysDiffFromToday(parseBrazilianDate(validadeRaw as string | number | undefined));

      const placaOk = !placaFilter || placa.includes(placaFilter.toLowerCase());
      const statusOk = statusFilter.length === 0 || statusFilter.includes(status);
      const diretoriaOk = diretoriaFilter === "all" || diretoria === diretoriaFilter;
      const gerenciaOk = gerenciaFilter === "all" || gerencia === gerenciaFilter;
      const propriedadeOk =
        propriedadeFilter === "all" || propriedade === propriedadeFilter;

      let prazoOk = true;
      if (prazoFilter === "vencidos") {
        prazoOk = diff !== null && diff < 0;
      } else if (prazoFilter === "ate30") {
        prazoOk = diff !== null && diff >= 0 && diff <= 30;
      }

      return (
        placaOk &&
        statusOk &&
        diretoriaOk &&
        gerenciaOk &&
        propriedadeOk &&
        prazoOk
      );
    });
  }, [
    allData,
    placaFilter,
    statusFilter,
    prazoFilter,
    diretoriaFilter,
    gerenciaFilter,
    propriedadeFilter,
  ]);

  const statusChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((row) => {
      const status = row.__statusKey ? String(row[row.__statusKey] || "Sem status") : "Sem status";
      map.set(status, (map.get(status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const tipoChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((row) => {
      const tipo = row.__tipo || "Sem tipo";
      map.set(tipo, (map.get(tipo) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const statusChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    const BLUE_PALETTE = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
    statusChartData.forEach((entry, index) => {
      config[entry.name] = {
        label: entry.name,
        color: BLUE_PALETTE[index % BLUE_PALETTE.length],
      };
    });
    return config;
  }, [statusChartData]);

  const tipoChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    const BLUE_PALETTE = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
    tipoChartData.forEach((entry, index) => {
      config[entry.name] = {
        label: entry.name,
        color: BLUE_PALETTE[index % BLUE_PALETTE.length],
      };
    });
    return config;
  }, [tipoChartData]);

  const handleToggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleClearFilters = () => {
    setPlacaFilter("");
    setStatusFilter([]);
    setPrazoFilter("all");
    setDiretoriaFilter("all");
    setGerenciaFilter("all");
    setPropriedadeFilter("all");
  };

  const handleExport = () => {
    const plainData = filteredData.map((row) => ({
      Tipo: row.__tipo,
      Placa: row["Placa"] || "",
      Status: row.__statusKey ? row[row.__statusKey] || "" : "",
      "Data Validade": row[row.__validadeKey] || "",
    }));
    exportToExcel(
      plainData,
      "Taxas_Inspecoes",
      "Taxas_Inspecoes"
    );
  };

  const handleExportCritical = () => {
    const plainData = criticalItems.map((row) => ({
      Tipo: row.__tipo,
      Placa: row["Placa"] || "",
      Status: row.__statusKey ? row[row.__statusKey] || "" : "",
      "Data Validade": row[row.__validadeKey] || "",
    }));
    exportToExcel(
      plainData,
      "Pendencias_Criticas",
      "Pendencias_Criticas"
    );
  };

  const criticalItems = useMemo(() => {
    return allData.filter((row) => {
      const placa = String(row["Placa"] || "").toLowerCase();
      const status = row.__statusKey ? String(row[row.__statusKey] || "") : "";
      const diretoria = String((row as any).__diretoria || "");
      const gerencia = String((row as any).__gerencia || "");
      const propriedade = String((row as any).__propriedade || "");
      const validadeRaw = row[row.__validadeKey];
      const diff = daysDiffFromToday(
        parseBrazilianDate(validadeRaw as string | number | undefined)
      );

      const placaOk = !placaFilter || placa.includes(placaFilter.toLowerCase());
      const statusOk = statusFilter.length === 0 || statusFilter.includes(status);
      const diretoriaOk = diretoriaFilter === "all" || diretoria === diretoriaFilter;
      const gerenciaOk = gerenciaFilter === "all" || gerencia === gerenciaFilter;
      const propriedadeOk =
        propriedadeFilter === "all" || propriedade === propriedadeFilter;
      const prazoCritico = diff !== null && (diff < 0 || diff <= 30);

      return (
        placaOk &&
        statusOk &&
        diretoriaOk &&
        gerenciaOk &&
        propriedadeOk &&
        prazoCritico
      );
    });
  }, [
    allData,
    placaFilter,
    statusFilter,
    diretoriaFilter,
    gerenciaFilter,
    propriedadeFilter,
  ]);

  const isLoadingGlobal =
    loadingCarroceria || loadingTacografo || loadingCivCipp || loadingCsv;

  if (isLoadingGlobal && allData.length === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sincronizando Certificados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-[0.9] whitespace-pre-line">
          Controle de Taxas{"\n"}& Inspeções
        </h1>
        <p className="text-slate-500 font-medium tracking-tight mt-2">Gestão centralizada de certificados, aferições e vistorias regulatórias</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 space-y-1">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Total de certificados
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Somatório de todas as taxas e inspeções
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold text-center leading-tight">
              {kpis.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-1">
            <CardTitle className="text-sm font-semibold tracking-tight">Vencidos</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Certificados com validade expirada
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold text-destructive text-center leading-tight">
              {kpis.vencidos}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-1">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Vencem em até 30 dias
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Inclui certificados vencendo no próximo mês
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold text-amber-500 text-center leading-tight">
              {kpis.ate30}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refine a visualização das taxas e inspeções</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Limpar filtros
            </Button>
            <Button size="sm" onClick={handleExport} disabled={filteredData.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 lg:gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Placa</label>
              <Input
                placeholder="Digite a placa..."
                value={placaFilter}
                onChange={(e) => setPlacaFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full justify-between"
                  )}
                >
                  <span>
                    {statusFilter.length > 0
                      ? `${statusFilter.length} selecionado(s)`
                      : "Todos os status"}
                  </span>
                  <Filter className="h-4 w-4" />
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-4" align="start">
                  <div className="space-y-2">
                    {statusOptions.map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={statusFilter.includes(status)}
                          onCheckedChange={() => handleToggleStatus(status)}
                        />
                        <label
                          htmlFor={`status-${status}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Prazo</label>
              <div className="flex gap-2">
                <Button variant={prazoFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setPrazoFilter("all")} className="flex-1">
                  Todos
                </Button>
                <Button variant={prazoFilter === "vencidos" ? "default" : "outline"} size="sm" onClick={() => setPrazoFilter("vencidos")} className="flex-1">
                  Vencidos
                </Button>
                <Button variant={prazoFilter === "ate30" ? "default" : "outline"} size="sm" onClick={() => setPrazoFilter("ate30")} className="flex-1">
                  Até 30 dias
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Propriedade</label>
              <Select value={propriedadeFilter} onValueChange={setPropriedadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {propriedadeOptions.map((prop) => (
                    <SelectItem key={prop} value={prop}>{prop}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 border-t pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Diretoria</label>
                <Select value={diretoriaFilter} onValueChange={setDiretoriaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {diretoriaOptions.map((dir) => (
                      <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Gerência</label>
                <Select value={gerenciaFilter} onValueChange={setGerenciaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {gerenciaOptions.map((ger) => (
                      <SelectItem key={ger} value={ger}>{ger}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={statusChartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {statusChartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={statusChartConfig[entry.name]?.color || '#3b82f6'} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Inspeção</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={tipoChartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tipoChartData}>
                  <XAxis dataKey="name" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {tipoChartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={tipoChartConfig[entry.name]?.color || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
           <CardTitle>Alertas de Vencimento</CardTitle>
           <Button variant="outline" size="sm" onClick={handleExportCritical} disabled={criticalItems.length === 0}>
             Exportar Críticos
           </Button>
        </CardHeader>
        <CardContent>
           <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Diretoria</TableHead>
                    <TableHead>Gerência</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Dias Restantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalItems.map((item, i) => {
                    const date = parseBrazilianDate(item[item.__validadeKey] as any);
                    const diff = daysDiffFromToday(date);
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{item.__tipo}</TableCell>
                        <TableCell className="text-xs font-bold">{String(item["Placa"])}</TableCell>
                        <TableCell className="text-[10px] uppercase">{(item as any).__diretoria}</TableCell>
                        <TableCell className="text-[10px] uppercase">{(item as any).__gerencia}</TableCell>
                        <TableCell className="text-xs">{String(item[item.__validadeKey])}</TableCell>
                        <TableCell>
                          <Badge variant={diff !== null && diff < 0 ? "destructive" : "warning" as any}>
                            {diff !== null && diff < 0 ? `Vencido (${Math.abs(diff)})` : `${diff} dias`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
           </ScrollArea>
        </CardContent>
      </Card>

      {/* Tabelas Detalhadas em Abas */}
      <Tabs defaultValue="carroceria" className="w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="carroceria" className="text-xs px-4">Taxa Carroceria Inmetro</TabsTrigger>
            <TabsTrigger value="tacografo" className="text-xs px-4">Inspeção Tacógrafo</TabsTrigger>
            <TabsTrigger value="civcipp" className="text-xs px-4">Vistoria CIV/CIPP</TabsTrigger>
            <TabsTrigger value="csv" className="text-xs px-4">Inspeção CSV</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="carroceria" className="mt-0">
          <SimpleTable 
            title="Taxa Carroceria Inmetro" 
            description="Certificação Inmetro" 
            data={taxaCarroceria} 
            isLoading={loadingCarroceria} 
            error={errorCarroceria} 
            columns={[{key: "Placa", label: "Placa"}, {key: "Status Certificado", label: "Status"}, {key: "Data Validade", label: "Validade"}]} 
          />
        </TabsContent>

        <TabsContent value="tacografo" className="mt-0">
          <SimpleTable 
            title="Inspeção Tacógrafo" 
            description="Aferição Tacógrafo" 
            data={inspecaoTacografo} 
            isLoading={loadingTacografo} 
            error={errorTacografo} 
            columns={[{key: "Placa", label: "Placa"}, {key: "Data Validade", label: "Validade"}, {key: "Status Tacógrafo", label: "Status"}]} 
          />
        </TabsContent>

        <TabsContent value="civcipp" className="mt-0">
          <SimpleTable 
            title="Vistoria CIV/CIPP" 
            description="Vistoria Técnica" 
            data={vistoriaCivCipp} 
            isLoading={loadingCivCipp} 
            error={errorCivCipp} 
            columns={[{key: "Placa", label: "Placa"}, {key: "Data Validade", label: "Validade"}, {key: "Status Inspeção", label: "Status"}]} 
          />
        </TabsContent>

        <TabsContent value="csv" className="mt-0">
          <SimpleTable 
            title="Inspeção CSV" 
            description="Inspeção Segurança" 
            data={inspecaoCsv} 
            isLoading={loadingCsv} 
            error={errorCsv} 
            columns={[{key: "Placa", label: "Placa"}, {key: "Data Validade", label: "Validade"}, {key: "Status Serviço", label: "Status"}]} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default TaxasInspecoesDashboard;
