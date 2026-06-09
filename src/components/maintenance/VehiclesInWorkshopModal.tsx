import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaintenanceData } from "@/hooks/useFleetData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface VehiclesInWorkshopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VehiclesInWorkshopModal = ({ open, onOpenChange }: VehiclesInWorkshopModalProps) => {
  const { data: maintenance = [], isLoading } = useMaintenanceData();

  const vehiclesInWorkshop = maintenance.filter(item => {
    const values = Object.values(item);
    const statusMan = values[2]?.toString().trim() || ""; // Coluna C
    return statusMan !== "" && statusMan !== "N/A" && statusMan !== "EM OPERAÇÃO";
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Veículos em Oficina</DialogTitle>
          <DialogDescription>
            Lista de veículos que estão atualmente em processo de manutenção.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Status Manutenção</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : vehiclesInWorkshop.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum veículo em oficina no momento.</TableCell>
                </TableRow>
              ) : (
                vehiclesInWorkshop.map((item, index) => {
                  const values = Object.values(item);
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-bold">{values[0] || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{values[2] || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{values[3] || "-"}</TableCell>
                      <TableCell className="text-xs">{values[5] || "-"}</TableCell>
                      <TableCell className="text-xs">{values[4] || "-"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
