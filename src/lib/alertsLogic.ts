
import { parseBrazilianDate, daysDiffFromToday } from './utils';

export interface AlertItem {
  id: string;
  placa: string;
  descricao: string;
  vencimento: string;
  dias: number;
  tipo: 'Vencido' | 'A Vencer';
  categoria: 'Manutenção' | 'Taxas' | 'Disponibilidade';
  gerencia: string;
  criticidade: string;
  propriedade: 'Próprio' | 'Locado';
  infoAdicional?: string;
}

export function processMaintenanceAlerts(maintenanceData: any[], controleData: any[], assets: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];

  const getAssetInfo = (placa: string) => {
    const asset = assets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa.toUpperCase().trim());
    if (asset) {
      const prop = String(asset.PROPRIEDADE || asset.PROPRIEDADE_TIPO || "").toUpperCase();
      const isProprio = prop.includes("COMPESA") || prop.includes("IPA") || prop.includes("PRÓPRIO") || prop.includes("PROPRIO");
      
      return {
        gerencia: asset.GERENCIA || asset.UNIDADE || "N/A",
        criticidade: asset.CRITICIDADE || "N/A",
        propriedade: (isProprio ? 'Próprio' : 'Locado') as 'Próprio' | 'Locado'
      };
    }
    // Default for unknown assets -> Locado
    return {
      gerencia: "N/A",
      criticidade: "N/A",
      propriedade: 'Locado' as 'Próprio' | 'Locado'
    };
  };

  maintenanceData.forEach((item, idx) => {
    const placa = String(item.PLACA || item.placa || item.COL_1 || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;

    const info = getAssetInfo(placa);
    // Keys often observed in the google sheets for preventive
    const nextDateRaw = item["DATA PROGRAMADA"] || item["PREVISÃO"] || item["PREVISAO"] || 
                        item["DATA VALIDADE"] || item["VALIDADE"] || item["DATA"] || 
                        item["VENCIMENTO"] || item.COL_10 || item.COL_11 || item.COL_5 || item.COL_6;
    
    const date = parseBrazilianDate(nextDateRaw);
    const diff = daysDiffFromToday(date);

    if (diff !== null) {
      if (diff < 0 || diff <= 30) {
        alerts.push({
          id: `mnt-prev-${idx}-${placa}`,
          placa,
          descricao: `Manutenção Preventiva ${diff < 0 ? 'Vencida' : 'a Vencer'}: ${item["SERVIÇO"] || item["SERVICO"] || item["ATIVIDADE"] || item.COL_2 || "Geral"}`,
          vencimento: String(nextDateRaw),
          dias: Math.abs(diff),
          tipo: diff < 0 ? 'Vencido' : 'A Vencer',
          categoria: 'Manutenção',
          ...info,
          infoAdicional: item["GERÊNCIA"] || item["GERENCIA"] || item["OBS"] || item["OBSERVAÇÃO"] || item.COL_4
        });
      }
    }
  });

  controleData.forEach((item, idx) => {
    const placa = String(item.placa || item.PLACA || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;

    const info = getAssetInfo(placa);
    const entregaRaw = item.expectativaEntrega || item.__raw?.[20];
    const dateEntrega = parseBrazilianDate(entregaRaw);
    const diffEntrega = daysDiffFromToday(dateEntrega);

    if (diffEntrega !== null && diffEntrega < 0) {
      alerts.push({
        id: `mnt-ctrl-venc-${idx}-${placa}`,
        placa,
        descricao: `Conclusão de Manutenção Vencida: ${item.descricaoAtividade || "Geral"}`,
        vencimento: String(entregaRaw),
        dias: Math.abs(diffEntrega),
        tipo: 'Vencido',
        categoria: 'Disponibilidade',
        ...info,
        infoAdicional: `Ordem: ${item.numOrdem}`
      });
    }
  });

  return alerts;
}

export function processTaxAlerts(taxasData: any[], assets: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  
  const getAssetInfo = (placa: string) => {
    const asset = assets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa.toUpperCase().trim());
    if (asset) {
      const prop = String(asset.PROPRIEDADE || asset.PROPRIEDADE_TIPO || "").toUpperCase();
      const isProprio = prop.includes("COMPESA") || prop.includes("IPA") || prop.includes("PRÓPRIO") || prop.includes("PROPRIO");
      
      return {
        gerencia: asset.GERENCIA || asset.UNIDADE || "N/A",
        criticidade: asset.CRITICIDADE || "N/A",
        propriedade: (isProprio ? 'Próprio' : 'Locado') as 'Próprio' | 'Locado'
      };
    }
    return {
      gerencia: "N/A",
      criticidade: "N/A",
      propriedade: 'Locado' as 'Próprio' | 'Locado'
    };
  };

  taxasData.forEach((item, idx) => {
    const placa = String(item.Placa || item.placa || item.PLACA || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;
    
    const info = getAssetInfo(placa);

    const type = item.__tipo || "Taxa/Inspeção";
    const validadeRaw = item[item.__validadeKey] || item["DATA VALIDADE"] || item["VALIDADE"];
    const date = parseBrazilianDate(validadeRaw);
    const diff = daysDiffFromToday(date);

    if (diff !== null) {
      if (diff < 0 || diff <= 30) {
        alerts.push({
          id: `tax-${idx}-${placa}`,
          placa,
          descricao: `${type} ${diff < 0 ? 'Vencida' : 'a Vencer'}`,
          vencimento: String(validadeRaw),
          dias: Math.abs(diff),
          tipo: diff < 0 ? 'Vencido' : 'A Vencer',
          categoria: 'Taxas',
          ...info
        });
      }
    }
  });

  return alerts;
}

export function formatWhatsAppMessage(alerts: AlertItem[]): string {
  if (alerts.length === 0) return "Nenhum alerta de manutenção ou taxas pendente no momento ✅";

  let message = "*📊 RESUMO DE ALERTAS - NEXUS FROTA*\n\n";

  const groupByType = (items: AlertItem[]) => {
    const proprios = items.filter(a => a.propriedade === 'Próprio');
    const locados = items.filter(a => a.propriedade === 'Locado');
    return { proprios, locados };
  };

  const renderSection = (title: string, items: AlertItem[]) => {
    if (items.length === 0) return "";
    let section = `*${title.toUpperCase()}*\n`;
    
    const cats = ['Manutenção', 'Taxas', 'Disponibilidade'];
    cats.forEach(cat => {
      const catItems = items.filter(i => i.categoria === cat);
      if (catItems.length === 0) return;
      
      section += `\n*${cat.toUpperCase()}*\n`;
      catItems.forEach(v => {
        const icon = v.tipo === 'Vencido' ? '🚩' : '⏳';
        section += `${icon} ${v.placa}: ${v.descricao}\n`;
        section += `   └ Gerência: ${v.gerencia} | Criticidade: ${v.criticidade}\n`;
        section += `   └ Vcto: ${v.vencimento} (${v.tipo === 'Vencido' ? 'Atraso' : 'Faltam'} ${v.dias}d)\n`;
      });
    });
    return section + "\n";
  };

  const { proprios, locados } = groupByType(alerts);
  
  if (proprios.length > 0) message += renderSection("🚗 VEÍCULOS PRÓPRIOS", proprios);
  if (locados.length > 0) message += renderSection("🤝 VEÍCULOS LOCADOS", locados);

  message += `_Gerado por Nexus via CGF às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_`;
  return message;
}
