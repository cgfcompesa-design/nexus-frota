
export function buildDetalhesDesvios(desvios: any[]) {
  if (!Array.isArray(desvios)) return [];
  return desvios.map(d => ({
    Placa: d.placa,
    Tipo: d.tipo,
    "Descrição do Desvio": d.descricao,
    Data: d.data
  }));
}

export function buildDetalhesDesviosByType(desvios: any[], type?: string) {
  if (!Array.isArray(desvios)) return [];
  const filtered = type ? desvios.filter(d => d.tipo === type) : desvios;
  return filtered.map(d => ({
    Placa: d.placa,
    Tipo: d.tipo,
    "Descrição": d.descricao,
    Data: d.data
  }));
}
