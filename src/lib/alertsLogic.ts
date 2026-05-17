
import { parseBrazilianDate, daysDiffFromToday } from './utils';

export interface AlertItem {
  id: string;
  placa: string;
  descricao: string;
  vencimento: string;
  dias: number;
  tipo: 'Vencido' | 'A Vencer';
  categoria: 'Manutenção' | 'Taxas' | 'Disponibilidade';
  infoAdicional?: string;
}

export function processMaintenanceAlerts(maintenanceData: any[], controleData: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];

  // Prevetive Maintenance logic
  maintenanceData.forEach((item, idx) => {
    const placa = String(item.PLACA || item.placa || "").toUpperCase().trim();
    if (!placa) return;

    // Assuming there's a field for next maintenance date
    // Based on fetchPreventiveMaintenanceData logic, headers are derived from the sheet
    const nextDateRaw = item["DATA PROGRAMADA"] || item["PREVISÃO"] || item["DATA VALIDADE"] || item.COL_10;
    const date = parseBrazilianDate(nextDateRaw);
    const diff = daysDiffFromToday(date);

    if (diff !== null) {
      if (diff < 0) {
        alerts.push({
          id: `mnt-prev-venc-${idx}`,
          placa,
          descricao: `Manutenção Preventiva Vencida: ${item["SERVIÇO"] || "Geral"}`,
          vencimento: String(nextDateRaw),
          dias: Math.abs(diff),
          tipo: 'Vencido',
          categoria: 'Manutenção',
          infoAdicional: item["GERÊNCIA"] || item.COL_4
        });
      } else if (diff <= 15) {
        alerts.push({
          id: `mnt-prev-avenc-${idx}`,
          placa,
          descricao: `Manutenção Preventiva a Vencer: ${item["SERVIÇO"] || "Geral"}`,
          vencimento: String(nextDateRaw),
          dias: diff,
          tipo: 'A Vencer',
          categoria: 'Manutenção',
          infoAdicional: item["GERÊNCIA"] || item.COL_4
        });
      }
    }
  });

  // Controle Operacional logic
  controleData.forEach((item, idx) => {
    const placa = String(item.placa || "").toUpperCase().trim();
    if (!placa) return;

    const diasAberto = parseInt(item.diasEmAberto) || 0;
    // Overdue if days in open > 5 or something similar? 
    // User says "Assets Vencidos de conclusão"
    // If there is an "EXPECTATIVA DE ENTREGA" field
    const entregaRaw = item.__raw?.[20]; // Checking raw for more fields if needed
    const dateEntrega = parseBrazilianDate(entregaRaw);
    const diffEntrega = daysDiffFromToday(dateEntrega);

    if (diffEntrega !== null && diffEntrega < 0) {
      alerts.push({
        id: `mnt-ctrl-venc-${idx}`,
        placa,
        descricao: `Conclusão de Manutenção Vencida: ${item.descricaoAtividade || "Geral"}`,
        vencimento: String(entregaRaw),
        dias: Math.abs(diffEntrega),
        tipo: 'Vencido',
        categoria: 'Disponibilidade',
        infoAdicional: `Ordem: ${item.numOrdem} | ${item.gerencia}`
      });
    }
  });

  return alerts;
}

export function processTaxAlerts(taxasData: any[], assets: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  
  const propretyFilter = (p: string) => {
    const up = String(p || "").toUpperCase();
    return up === 'COMPESA' || up === 'COMPESA - IPA' || up.includes('PROPRIO') || up.includes('PRÓPRIO');
  };

  taxasData.forEach((item, idx) => {
    const placa = String(item.Placa || item.placa || "").toUpperCase().trim();
    const asset = assets.find(a => String(a.PLACA || "").toUpperCase().trim() === placa);
    
    // Only COMPESA or COMPESA - IPA
    if (!asset || !propretyFilter(asset.PROPRIEDADE || asset.PROPRIEDADE_TIPO)) return;

    const type = item.__tipo || "Taxa/Inspeção";
    const validadeRaw = item[item.__validadeKey] || item["DATA VALIDADE"];
    const date = parseBrazilianDate(validadeRaw);
    const diff = daysDiffFromToday(date);

    if (diff !== null) {
      if (diff < 0) {
        alerts.push({
          id: `tax-venc-${idx}`,
          placa,
          descricao: `${type} Vencida`,
          vencimento: String(validadeRaw),
          dias: Math.abs(diff),
          tipo: 'Vencido',
          categoria: 'Taxas',
          infoAdicional: asset.GERENCIA || asset.UNIDADE
        });
      } else if (diff <= 30) {
        alerts.push({
          id: `tax-avenc-${idx}`,
          placa,
          descricao: `${type} a Vencer`,
          vencimento: String(validadeRaw),
          dias: diff,
          tipo: 'A Vencer',
          categoria: 'Taxas',
          infoAdicional: asset.GERENCIA || asset.UNIDADE
        });
      }
    }
  });

  return alerts;
}


export function formatWhatsAppMessage(alerts: AlertItem[]): string {
  if (alerts.length === 0) return "Nenhum alerta de manutenção ou taxas pendente no momento ✅";

  let message = "*📊 RESUMO DE ALERTAS - NEXUS FROTA*\n\n";

  const categories = {
    'Manutenção': alerts.filter(a => a.categoria === 'Manutenção'),
    'Disponibilidade': alerts.filter(a => a.categoria === 'Disponibilidade'),
    'Taxas': alerts.filter(a => a.categoria === 'Taxas')
  };

  Object.entries(categories).forEach(([name, items]) => {
    if (items.length === 0) return;
    message += `*📍 ${name.toUpperCase()}*\n`;
    
    const vencidos = items.filter(i => i.tipo === 'Vencido');
    if (vencidos.length > 0) {
      message += `🚩 *Vencidos:*\n`;
      vencidos.forEach(v => {
        message += `• ${v.placa}: ${v.descricao} (${v.dias} dias)\n`;
      });
    }

    const aVencer = items.filter(i => i.tipo === 'A Vencer');
    if (aVencer.length > 0) {
      message += `⏳ *A Vencer:*\n`;
      aVencer.forEach(v => {
        message += `• ${v.placa}: ${v.descricao} (${v.dias} dias)\n`;
      });
    }
    message += "\n";
  });

  message += `_Gerado por Nexus via CGF às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_`;
  return message;
}
