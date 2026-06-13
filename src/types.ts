export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'Master' | 'Gestão' | 'Visualizador' | 'LOCADORA';
  createdAt: string;
  locadoras?: string[];
}

export type MaintenanceStatus = 'Triagem' | 'Em Manutenção' | 'Aguardando Peças' | 'Finalizado';

export interface MaintenanceTask {
  id: string;
  vehicleId: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  createdBy: string;
  createdAt: any;
  [key: string]: any;
}

export interface TelemetrySummary {
  avgConsumption: number;
  totalCost: number;
  speedAlerts: number;
}

export interface AutonomiaData {
  PLACA?: string;
  Placa?: string;
  AUTONOMIA?: number | string;
  "MÊS/ANO"?: string;
  [key: string]: any;
}

export interface AutonomiaPadraoData {
  PLACA?: string;
  Placa?: string;
  "AUTONOMIA PADRÃO (KM/LITRO OU HORA/LITRO)"?: number | string;
  [key: string]: any;
}

export interface TelemetryRealtimeData {
  Placa?: string;
  placa?: string;
  Unidade?: string;
  unidade?: string;
  "Data/Hora"?: string;
  data_hora?: string;
  Velocidade?: number;
  velocidade?: number;
  Odometro?: string;
  odometro?: string;
  Ignicao?: string | number;
  ignicao?: string | number;
  Antifurto?: string;
  antifurto?: string;
  Condutor?: string;
  condutor?: string;
  Tensao?: number;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

export interface NotificacaoTelemetriaData {
  DIRETORIA?: string;
  GERÊNCIA?: string;
  GERENCIA?: string;
  PLACA?: string;
  CONDUTOR?: string;
  GRAVIDADE?: string;
  SITUAÇÃO?: string;
  SITUACAO?: string;
  "TIPO NOTIFICAÇÃO"?: string;
  "TIPO NOTIFICACAO"?: string;
  [key: string]: any;
}

export interface Asset {
  PLACA?: string;
  placa?: string;
  TIPO?: string;
  PROPRIEDADE?: string;
  "STATUS OPERACIONAL"?: string;
  CRITICIDADE?: string;
  criticidade?: string;
  MODELO?: string;
  ANO?: string;
  MARCA?: string;
  DIRETORIA?: string;
  GERENCIA?: string;
  "GERÊNCIA"?: string;
  COLUNA_E?: string;
  [key: string]: any;
}

export interface TelemetryData {
  Placa: string;
  timestamp: string;
  [key: string]: any;
}

export interface FuelData {
  PLACA?: string;
  Placa?: string;
  "DATA TRANSACAO"?: string;
  LITROS?: number | string;
  "KM RODADOS OU HORAS TRABALHADAS"?: number | string;
  "VALOR EMISSAO"?: number | string;
  "TIPO COMBUSTIVEL"?: string;
  [key: string]: any;
}

export interface MaintenanceData {
  [key: string]: any;
}

export interface MaintenanceCostData {
  "VALOR EMISSAO"?: string | number;
  "MÊS/ANO"?: string | number;
  [key: string]: any;
}

export interface MachineSupplyAssignment {
  id?: string;
  transactionId: string;
  machineryDestination: string;
  model: string;
  property: string;
  tombamentoNumber: string;
  userName?: string;
  userUnit: string;
  updatedBy: string;
  updatedAt: any;
}

export interface PreventiveMaintenanceData {
  [key: string]: any;
}

export interface ControleOperacionalData {
  diretoria: string;
  gerencia: string;
  numOrdem: string;
  numOrcamento: string;
  tam: string;
  descricaoAtividade: string;
  placa: string;
  criticidade: string;
  tipo: string;
  estabelecimento: string;
  custo: string;
  diasEmAberto: string;
  __raw: string[];
}
