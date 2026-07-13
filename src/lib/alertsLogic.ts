
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
  isKM?: boolean;
}

const parseOdoRestante = (val: any): number | null => {
  if (val === null || val === undefined || String(val).trim() === "") return null;
  const cleanStr = String(val).replace(/[^\d.,-]/g, '').trim();
  if (!cleanStr) return null;
  const lastComma = cleanStr.lastIndexOf(',');
  const lastDot = cleanStr.lastIndexOf('.');
  let res;
  if (lastComma > lastDot) {
    res = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
  } else if (lastDot > lastComma) {
    res = parseFloat(cleanStr.replace(/,/g, ''));
  } else {
    res = parseFloat(cleanStr.replace(',', '.'));
  }
  return isNaN(res) ? null : res;
};

const getSharedAssetInfo = (placa: string, assets: any[]) => {
  const normalizedTarget = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const asset = assets.find(a => {
    const p = String(a.PLACA || a.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return p === normalizedTarget;
  });
  
  if (asset) {
    const prop = String(asset.PROPRIEDADE || asset.PROPRIEDADE_TIPO || "").toUpperCase();
    const isProprio = prop.includes("COMPESA") || prop.includes("IPA") || prop.includes("PRÓPRIO") || prop.includes("PROPRIO");
    
    return {
      gerencia: asset.GERENCIA || asset.UNIDADE || asset.GERÊNCIA || "N/A",
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

export function processMaintenanceAlerts(maintenanceData: any[], controleData: any[], assets: any[]): AlertItem[] {
  const alerts: AlertItem[] = [];

  maintenanceData.forEach((item, idx) => {
    const placa = String(item.PLACA || item.placa || item.COL_0 || item.COL_1 || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;

    const info = getSharedAssetInfo(placa, assets);
    
    // Time-based alerts
    const nextDateRaw = item["PRÓXIMA REVISÃO"] || item["PROXIMA REVISAO"] || item.COL_14 ||
                        item["DATA PROGRAMADA"] || item["PREVISÃO"] || item["PREVISAO"] || 
                        item["DATA VALIDADE"] || item["VALIDADE"] || item["DATA"] || 
                        item["VENCIMENTO"] || item.COL_10 || item.COL_11 || item.COL_5 || item.COL_6;
    
    const date = parseBrazilianDate(nextDateRaw);
    const diff = daysDiffFromToday(date);

    if (diff !== null) {
      if (diff < 0 || diff <= 30) {
        alerts.push({
          id: `mnt-prev-${idx}-${placa}`,
          placa,
          descricao: `Manutenção Preventiva ${diff < 0 ? 'Vencida' : 'a Vencer'}: ${item["TIPO PREVENTIVA"] || item["TIPO_PREVENTIVA"] || item["SERVIÇO"] || item["SERVICO"] || item["ATIVIDADE"] || item.COL_2 || "Geral"}`,
          vencimento: String(nextDateRaw),
          dias: Math.abs(diff),
          tipo: diff < 0 ? 'Vencido' : 'A Vencer',
          categoria: 'Manutenção',
          ...info,
          infoAdicional: item["GERÊNCIA"] || item["GERENCIA"] || item["OBS"] || item["OBSERVAÇÃO"] || item.COL_4
        });
      }
    }

    // KM-based alerts for "Próprios"
    if (info.propriedade === 'Próprio') {
      const odoRestante = parseOdoRestante(item["ODÔMETRO RESTANTE"] || item["ODOMETRO RESTANTE"] || item.COL_16);
      if (odoRestante !== null) {
        const criticidadeItem = item["CRITICIDADE"] || item.COL_22 || info.criticidade;
        const atividade = item["TIPO PREVENTIVA"] || item["TIPO_PREVENTIVA"] || item["SERVIÇO"] || item["SERVICO"] || item["ATIVIDADE"] || item.COL_2 || "Geral";
        
        if (odoRestante < 0) {
          alerts.push({
            id: `mnt-prev-km-${idx}-${placa}`,
            placa,
            descricao: `Manutenção Preventiva Vencida por KM: ${atividade}`,
            vencimento: `Excedido em ${Math.abs(Math.round(odoRestante)).toLocaleString('pt-BR')} km`,
            dias: Math.abs(Math.round(odoRestante)),
            tipo: 'Vencido',
            categoria: 'Manutenção',
            ...info,
            criticidade: criticidadeItem,
            isKM: true,
            infoAdicional: item["GERÊNCIA"] || item["GERENCIA"] || item["OBS"] || item["OBSERVAÇÃO"] || item.COL_4
          });
        } else if (odoRestante < 1000) {
          alerts.push({
            id: `mnt-prev-km-${idx}-${placa}`,
            placa,
            descricao: `Manutenção Preventiva a Vencer por KM: ${atividade}`,
            vencimento: `Restam ${Math.round(odoRestante).toLocaleString('pt-BR')} km`,
            dias: Math.round(odoRestante),
            tipo: 'A Vencer',
            categoria: 'Manutenção',
            ...info,
            criticidade: criticidadeItem,
            isKM: true,
            infoAdicional: item["GERÊNCIA"] || item["GERENCIA"] || item["OBS"] || item["OBSERVAÇÃO"] || item.COL_4
          });
        }
      }
    }
  });

  controleData.forEach((item, idx) => {
    const placa = String(item.placa || item.PLACA || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;

    const info = getSharedAssetInfo(placa, assets);
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
  
  taxasData.forEach((item, idx) => {
    const placa = String(item.Placa || item.placa || item.PLACA || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;
    
    const info = getSharedAssetInfo(placa, assets);

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

  regularizacaoData.forEach((item, idx) => {
    const placa = String(item.placa || "").toUpperCase().trim();
    if (!placa || placa.length < 5) return;
    
    const info = getSharedAssetInfo(placa, assets);
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
        
        const unit = v.isKM ? 'km' : 'd';
        section += `${icon} ${critIcon} ${v.placa}: ${v.descricao}\n`;
        section += `   └ Gerência: ${v.gerencia} | Crit: ${v.criticidade}\n`;
        section += `   └ Vcto: ${v.vencimento} (${v.tipo === 'Vencido' ? 'Atraso' : 'Faltam'} ${v.dias}${unit})\n`;
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
      const unit = v.isKM ? 'km' : 'dias';
      body += `Placa: ${v.placa}\r\n`;
      body += `Descrição: ${v.descricao}\r\n`;
      body += `Gerência: ${v.gerencia} | Criticidade: ${v.criticidade}\r\n`;
      body += `Vencimento: ${v.vencimento} (${typeStr} - ${v.dias} ${unit})\r\n`;
      if (v.infoAdicional) body += `Obs: ${v.infoAdicional}\r\n`;
      body += "\r\n";
    });
    body += "\r\n";
  });

  body += `Redirecionado via Nexus em ${new Date().toLocaleString('pt-BR')}`;
  return body;
}
