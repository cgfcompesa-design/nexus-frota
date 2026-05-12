import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFuelAlertConfig, saveFuelAlertConfig, DEFAULT_FUEL_ALERT_CONFIG } from "@/types/alertConfig";
import { Settings } from "lucide-react";

export function FuelAlertConfigTab() {
  const [config, setConfig] = useState(getFuelAlertConfig());

  const handleSave = () => {
    saveFuelAlertConfig(config);
    toast.success("Configurações salvas. Os parâmetros de alerta foram atualizados com sucesso.");
    // Force a reload indicator if needed, or rely on parent state update if passed down
  };

  const handleReset = () => {
    setConfig(DEFAULT_FUEL_ALERT_CONFIG);
    saveFuelAlertConfig(DEFAULT_FUEL_ALERT_CONFIG);
    toast.info("Configurações restauradas aos valores padrão.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configuração de Alertas</h1>
          <p className="text-muted-foreground">
            Configure os parâmetros dos alertas de combustível
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Alerta de Litros ou m³</CardTitle>
            <CardDescription>
              Defina os limites de capacidade do tanque para gerar alertas de desvio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minCapacity">Limite Mínimo (%)</Label>
                <Input
                  id="minCapacity"
                  type="number"
                  min="0"
                  max="100"
                  value={config.minCapacityPercent}
                  onChange={(e) =>
                    setConfig({ ...config, minCapacityPercent: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCapacity">Limite Máximo (%)</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min="100"
                  max="200"
                  value={config.maxCapacityPercent}
                  onChange={(e) =>
                    setConfig({ ...config, maxCapacityPercent: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerta de Autonomia</CardTitle>
            <CardDescription>
              Defina o percentual de desvio da autonomia para gerar alertas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="autonomyDeviation">Desvio de Autonomia (%)</Label>
              <Input
                id="autonomyDeviation"
                type="number"
                min="0"
                max="100"
                value={config.autonomyDeviationPercent}
                onChange={(e) =>
                  setConfig({ ...config, autonomyDeviationPercent: Number(e.target.value) })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerta de Dias Sem Abastecer</CardTitle>
            <CardDescription>
              Defina o número de dias sem abastecimento para gerar alertas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="daysWithoutRefueling">Dias Sem Abastecer</Label>
              <Input
                id="daysWithoutRefueling"
                type="number"
                min="1"
                max="365"
                value={config.daysWithoutRefueling}
                onChange={(e) =>
                  setConfig({ ...config, daysWithoutRefueling: Number(e.target.value) })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerta de Valor/Litro</CardTitle>
            <CardDescription>
              Defina o percentual de desvio do valor por litro em relação à média
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valorLitroDeviation">Desvio de Valor/Litro (%)</Label>
              <Input
                id="valorLitroDeviation"
                type="number"
                min="0"
                max="100"
                value={config.valorLitroDeviationPercent}
                onChange={(e) =>
                  setConfig({ ...config, valorLitroDeviationPercent: Number(e.target.value) })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 justify-end mt-6">
        <Button variant="outline" onClick={handleReset}>
          Restaurar Padrão
        </Button>
        <Button onClick={handleSave}>Salvar Configurações</Button>
      </div>
    </div>
  );
}
