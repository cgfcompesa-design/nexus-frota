import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFuelAlertConfig, saveFuelAlertConfig, DEFAULT_FUEL_ALERT_CONFIG } from "@/types/alertConfig";
import { Settings } from "lucide-react";

export default function AlertConfig() {
  const [config, setConfig] = useState(getFuelAlertConfig());

  const handleSave = () => {
    saveFuelAlertConfig(config);
    toast.success("Configurações salvas. Os parâmetros de alerta foram atualizados com sucesso.");
  };

  const handleReset = () => {
    setConfig(DEFAULT_FUEL_ALERT_CONFIG);
    saveFuelAlertConfig(DEFAULT_FUEL_ALERT_CONFIG);
    toast.info("Configurações restauradas aos valores padrão.");
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Configuração de Alertas</h1>
            <p className="text-muted-foreground">
              Configure os parâmetros dos alertas de combustível
            </p>
          </div>
        </div>

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
                <p className="text-xs text-muted-foreground">
                  Alertar quando abastecimento for menor que este percentual da capacidade
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Alertar quando abastecimento for maior que este percentual da capacidade
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="averageCapacity">Limite Médio (%)</Label>
              <Input
                id="averageCapacity"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={config.averageCapacityPercent}
                onChange={(e) =>
                  setConfig({ ...config, averageCapacityPercent: Number(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Percentual em relação à capacidade do tanque para detectar se o tanque foi completado ou ainda tem volume. Usado para avaliar se o abastecimento era necessário baseado na autonomia padrão e KM rodado ou horas trabalhadas.
              </p>
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
              <p className="text-xs text-muted-foreground">
                Alertar quando a autonomia real diferir mais que este percentual da autonomia esperada
              </p>
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
              <p className="text-xs text-muted-foreground">
                Alertar quando um veículo não abastecer por mais de este número de dias
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerta de Valor/Litro</CardTitle>
            <CardDescription>
              Defina o percentual de desvio do valor por litro em relação à média para gerar alertas
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
              <p className="text-xs text-muted-foreground">
                Alertar quando o valor por litro do abastecimento diferir mais que este percentual da média
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button variant="outline" onClick={handleReset}>
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave}>Salvar Configurações</Button>
        </div>
      </div>
    </div>
  );
}
