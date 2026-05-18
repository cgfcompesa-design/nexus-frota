
import { parseBrazilianDate, daysDiffFromToday } from './utils';

export interface AlertItem {
  id: string;
  placa: string;
  descricao: string;
  vencimento: string;
  dias: number;
  tipo: 'Vencido' | 'A Vencer';
  categoria: 'Manutenção' | 'Taxas' | 'Disponibilidade' | 'Infrações';
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

    if (diffEntrega !== null) {
      if (diffEntrega < 0 || diffEntrega <= 7) {
        alerts.push({
          id: `mnt-ctrl-${diffEntrega < 0 ? 'venc' : 'prox'}-${idx}-${placa}`,
          placa,
          descricao: `Conclusão de Manutenção ${diffEntrega < 0 ? 'Vencida' : 'a Vencer'}: ${item.descricaoAtividade || "Geral"}`,
          vencimento: String(entregaRaw),
          dias: Math.abs(diffEntrega),
          tipo: diffEntrega < 0 ? 'Vencido' : 'A Vencer',
          categoria: 'Disponibilidade',
          ...info,
          infoAdicional: `Ordem: ${item.numOrdem}${item.numOrcamento ? ` | Orç: ${item.numOrcamento}` : ''}`
        });
      }
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

export function processInfractionAlerts(regularizacaoData: any[], assets: any[]): AlertItem[] {
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
    return { gerencia: "N/A", criticidade: "N/A", propriedade: 'Locado' as 'Próprio' | 'Locado' };
  };

  regularizacaoData.forEach((item, idx) => {
    const placa = String(item.placa || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;
    
    const info = getAssetInfo(placa);
    const status = String(item.status || "").trim();
    const statusPrazo = String(item.statusPrazoDefesa || "").trim();
    const statusSEI = String(item.statusProcessoSEI || "").trim();
    const dataLimiteRaw = item.dataLimite;
    
    // Alerta 1: Status pendente (não pago/não pago)
    const isPaid = status.toUpperCase() === "PAGO" || status.toUpperCase() === "NÃO PAGO" || status.toUpperCase() === "NAO PAGO";
    if (!status || !isPaid) {
      alerts.push({
        id: `infr-status-${idx}-${placa}`,
        placa,
        descricao: `Infração com Status Pendente (${status || 'Em branco'}): ${item.autoInfracao}`,
        vencimento: "Pendente",
        dias: 0,
        tipo: 'Vencido',
        categoria: 'Infrações',
        ...info,
        infoAdicional: `Auto: ${item.autoInfracao} | Status: ${status || 'N/A'}`
      });
    }

    // Alerta 2: Prazo de Defesa + SEI não realizado
    if (statusPrazo === "Prazo de Defesa" && statusSEI === "Processo Não Realizado") {
      const dateLimit = parseBrazilianDate(dataLimiteRaw);
      const diff = daysDiffFromToday(dateLimit);
      
      if (diff !== null) {
        alerts.push({
          id: `infr-defesa-${idx}-${placa}`,
          placa,
          descricao: `Prazo de Defesa Pendente (SEI Não Realizado): ${item.autoInfracao}`,
          vencimento: String(dataLimiteRaw),
          dias: Math.abs(diff),
          tipo: diff < 0 ? 'Vencido' : 'A Vencer',
          categoria: 'Infrações',
          ...info,
          infoAdicional: `Faltam ${diff} dias para o prazo limite (${dataLimiteRaw})`
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

  const getCriticalityScore = (c?: string) => {
    const critical = String(c || "").toUpperCase().trim();
    if (critical === 'ALTA' || critical === 'A') return 0;
    if (critical === 'MÉDIA' || critical === 'MEDIA' || critical === 'B') return 1;
    if (critical === 'BAIXA' || critical === 'C') return 2;
    return 3;
  };

  const renderSection = (title: string, items: AlertItem[]) => {
    if (items.length === 0) return "";
    let section = `*${title.toUpperCase()}*\n`;
    
    // Sort all items in this section primarily by criticality
    const sortedItems = [...items].sort((a, b) => {
      const scoreA = getCriticalityScore(a.criticidade);
      const scoreB = getCriticalityScore(b.criticidade);
      if (scoreA !== scoreB) return scoreA - scoreB;
      if (a.tipo !== b.tipo) return a.tipo === 'Vencido' ? -1 : 1;
      return a.dias - b.dias;
    });

    const cats = ['Manutenção', 'Taxas', 'Disponibilidade', 'Infrações'];
    cats.forEach(cat => {
      const catItems = sortedItems.filter(i => i.categoria === cat);
      if (catItems.length === 0) return;
      
      section += `\n*${cat.toUpperCase()}*\n`;
      catItems.forEach(v => {
        const icon = v.tipo === 'Vencido' ? '🚩' : '⏳';
        const critIcon = v.criticidade === 'ALTA' || v.criticidade === 'A' ? '🔴' : 
                         v.criticidade === 'MÉDIA' || v.criticidade === 'MEDIA' || v.criticidade === 'B' ? '🟡' : '⚪';
        
        section += `${icon} ${critIcon} ${v.placa}: ${v.descricao}\n`;
        section += `   └ Gerência: ${v.gerencia} | Crit: ${v.criticidade}\n`;
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

export function formatEmailBody(alerts: AlertItem[]): string {
  if (alerts.length === 0) return "Nenhum alerta pendente no momento.";

  let body = "RESUMO DE ALERTAS - NEXUS FROTA\r\n\r\n";

  const getCriticalityScore = (c?: string) => {
    const critical = String(c || "").toUpperCase().trim();
    if (critical === 'ALTA' || critical === 'A') return 0;
    if (critical === 'MÉDIA' || critical === 'MEDIA' || critical === 'B') return 1;
    if (critical === 'BAIXA' || critical === 'C') return 2;
    return 3;
  };

  const cats = ['Manutenção', 'Taxas', 'Disponibilidade', 'Infrações'];
  
  cats.forEach(cat => {
    const catItems = alerts.filter(i => i.categoria === cat).sort((a, b) => {
      const scoreA = getCriticalityScore(a.criticidade);
      const scoreB = getCriticalityScore(b.criticidade);
      if (scoreA !== scoreB) return scoreA - scoreB;
      if (a.tipo !== b.tipo) return a.tipo === 'Vencido' ? -1 : 1;
      return a.dias - b.dias;
    });

    if (catItems.length === 0) return;
    
    body += `${cat.toUpperCase()}\r\n`;
    body += "----------------------------------------\r\n";
    
    catItems.forEach(v => {
      const typeStr = v.tipo === 'Vencido' ? 'VENCIDO' : 'A VENCER';
      body += `Placa: ${v.placa}\r\n`;
      body += `Descrição: ${v.descricao}\r\n`;
      body += `Gerência: ${v.gerencia} | Criticidade: ${v.criticidade}\r\n`;
      body += `Vencimento: ${v.vencimento} (${typeStr} - ${v.dias} dias)\r\n`;
      if (v.infoAdicional) body += `Obs: ${v.infoAdicional}\r\n`;
      body += "\r\n";
    });
    body += "\r\n";
  });

  body += `Redirecionado via Nexus em ${new Date().toLocaleString('pt-BR')}`;
  return body;
}
