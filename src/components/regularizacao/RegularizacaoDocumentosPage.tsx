import { useEffect, useMemo, useState } from "react";
import { useControleDocumentosData, ControleDocumento } from "@/hooks/useControleDocumentosData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExternalLink, FileDown, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const convertGoogleDriveLink = (url: string): string => {
  if (!url) return "";
  
  // Extrai o ID do arquivo do Google Drive
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
};

const getViewLink = (url: string): string => {
  if (!url) return "";
  return url.replace(/\\/g, '');
};

interface AttachmentCellProps {
  url: string;
  label: string;
}

const AttachmentCell = ({ url, label }: AttachmentCellProps) => {
  if (!url) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const cleanUrl = getViewLink(url);
  const downloadUrl = convertGoogleDriveLink(url);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-7 gap-1 text-xs"
        )}
      >
        <FileText className="h-3 w-3" />
        Anexo
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Visualizar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={downloadUrl}
            download
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Baixar PDF/Imagem
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function RegularizacaoDocumentosPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Regularização - Documentos Obrigatórios - Nexus BI";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const { data = [], isLoading } = useControleDocumentosData();
  const [search, setSearch] = useState("");
  const [gerencia, setGerencia] = useState<string>("all");
  const [diretoria, setDiretoria] = useState<string>("all");
  const [propriedade, setPropriedade] = useState<string>("all");

  const gerencias = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      if (r.gerencia) set.add(r.gerencia.trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const diretorias = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      if (r.diretoria) set.add(r.diretoria.trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const propriedades = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      if (r.propriedade) set.add(r.propriedade.trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((r) => (gerencia === "all" ? true : r.gerencia === gerencia))
      .filter((r) => (diretoria === "all" ? true : r.diretoria === diretoria))
      .filter((r) => (propriedade === "all" ? true : r.propriedade === propriedade))
      .filter((r) => {
        if (!q) return true;
        return (
          r.placa.toLowerCase().includes(q) ||
          r.gerencia.toLowerCase().includes(q) ||
          r.diretoria.toLowerCase().includes(q) ||
          r.coordenacao.toLowerCase().includes(q)
        );
      });
  }, [data, search, gerencia, diretoria, propriedade]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const comCrlv = filtered.filter(r => r.anexoCrlv && r.anexoCrlv.trim() !== "").length;
    const comCsv = filtered.filter(r => r.anexoCsv && r.anexoCsv.trim() !== "").length;
    const comTacografo = filtered.filter(r => r.anexoTacografo && r.anexoTacografo.trim() !== "").length;
    const comCivCipp = filtered.filter(r => r.anexoCivCipp && r.anexoCivCipp.trim() !== "").length;
    const comCarroceria = filtered.filter(r => r.anexoCarroceriaInmetro && r.anexoCarroceriaInmetro.trim() !== "").length;
    
    return { total, comCrlv, comCsv, comTacografo, comCivCipp, comCarroceria };
  }, [filtered]);

  // No page-blocking loading screen to keep tabs accessible immediately

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white font-black p-1.5 rounded-lg text-sm uppercase tracking-tighter">Nexus BI</div>
              <h1 className="text-xl font-bold">Regularização - Documentos Obrigatórios</h1>
            </div>
            <p className="text-sm text-muted-foreground md:text-right">
              Controle de documentos obrigatórios por veículo
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Total Veículos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-indigo-600">{stats.comCrlv}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Com CRLV</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.comCsv}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Com CSV</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-cyan-600">{stats.comTacografo}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Com Tacógrafo</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-teal-600">{stats.comCivCipp}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Com CIV/CIPP</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{stats.comCarroceria}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Com Carroceria</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por placa, gerência, diretoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={diretoria} onValueChange={setDiretoria}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Diretoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Diretorias</SelectItem>
                  {diretorias.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={gerencia} onValueChange={setGerencia}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Gerência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Gerências</SelectItem>
                  {gerencias.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={propriedade} onValueChange={setPropriedade}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Propriedade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {propriedades.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Documentos por Veículo
              <Badge variant="secondary" className="ml-2">
                {filtered.length} registros
              </Badge>
            </CardTitle>
          </CardHeader>
        <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Placa</TableHead>
                      <TableHead>Diretoria</TableHead>
                      <TableHead>Gerência</TableHead>
                      <TableHead>Coordenação</TableHead>
                      <TableHead>Propriedade</TableHead>
                      <TableHead className="text-center">CRLV</TableHead>
                      <TableHead className="text-center">CSV</TableHead>
                      <TableHead className="text-center">Tacógrafo</TableHead>
                      <TableHead className="text-center">CIV/CIPP</TableHead>
                      <TableHead className="text-center">Carroceria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((doc, idx) => (
                      <TableRow key={`${doc.placa}-${idx}`}>
                        <TableCell className="font-mono font-semibold">{doc.placa}</TableCell>
                        <TableCell className="text-xs">{doc.diretoria || "—"}</TableCell>
                        <TableCell className="text-xs">{doc.gerencia || "—"}</TableCell>
                        <TableCell className="text-xs">{doc.coordenacao || "—"}</TableCell>
                        <TableCell>
                          {doc.propriedade && (
                            <Badge variant={doc.propriedade === "COMPESA" ? "default" : "outline"}>
                              {doc.propriedade}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <AttachmentCell url={doc.anexoCrlv} label="CRLV" />
                        </TableCell>
                        <TableCell className="text-center">
                          <AttachmentCell url={doc.anexoCsv} label="CSV" />
                        </TableCell>
                        <TableCell className="text-center">
                          <AttachmentCell url={doc.anexoTacografo} label="Tacógrafo" />
                        </TableCell>
                        <TableCell className="text-center">
                          <AttachmentCell url={doc.anexoCivCipp} label="CIV/CIPP" />
                        </TableCell>
                        <TableCell className="text-center">
                          <AttachmentCell url={doc.anexoCarroceriaInmetro} label="Carroceria" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
            {filtered.length > 500 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                Total: {filtered.length} registros. Use os filtros para refinar a busca.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground">
          Copyright © {new Date().getFullYear()} Nexus BI Frota.
          Todos os direitos reservados.
        </div>
      </footer>
    </main>
  );
}
