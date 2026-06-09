
export interface FuelTransaction {
  litros: number;
  kmRodados: number;
  autonomiaReferencia: number;
  capacidadeTanquePrincipal: number;
  capacidadeTanqueSecundario: number;
  dataTransacao: Date;
  combustivelAbastecido: string;
  combustivelPadrao: string;
  combustivelSecundario: string;
}

export interface AnaliseResultado {
  alertaLitros: 'OK' | 'Verificar';
  percentualCapacidade: number;
  tipoDesvio: string;
  volumeEstimadoAntes: number;
  alertaCombustivel?: string;
  capacidadeUtilizada: string;
}

export function analisarAbastecimento(tx: FuelTransaction): AnaliseResultado {
  const isPadrao = tx.combustivelAbastecido === tx.combustivelPadrao;
  const cap = isPadrao ? tx.capacidadeTanquePrincipal : tx.capacidadeTanqueSecundario;
  const utilized = isPadrao ? 'Padrão' : 'Secundário';
  
  const percent = cap > 0 ? (tx.litros / cap) * 100 : 0;
  let alerta: 'OK' | 'Verificar' = 'OK';
  let desvio = 'N/A';
  
  if (percent > 105) {
    alerta = 'Verificar';
    desvio = 'Volume acima da capacidade';
  } else if (percent < 20 && cap > 0) {
    // maybe too low?
  }
  
  // Check fuel type
  let alertaCombustivel;
  if (tx.combustivelPadrao && tx.combustivelAbastecido !== tx.combustivelPadrao && tx.combustivelAbastecido !== tx.combustivelSecundario) {
    alertaCombustivel = 'Combustível divergente';
  }

  return {
    alertaLitros: alerta,
    percentualCapacidade: percent,
    tipoDesvio: desvio,
    volumeEstimadoAntes: 0,
    alertaCombustivel,
    capacidadeUtilizada: utilized
  };
}
