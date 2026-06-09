export interface FuelStation {
  id: string;
  estabelecimentoRaw: string;
  enderecoRaw: string;
  cidade: string;
  mapsQuery: string;
  mapsLink: string;
  fields: Record<string, string | number | undefined>;
}
