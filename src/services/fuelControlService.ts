import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  setDoc,
  getDoc
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export interface Gerencia {
  id?: string;
  nome: string;
  centroCusto: string;
  codigoTicketLog: string;
  orcamento?: number;
}

export interface Ativo {
  id?: string;
  placa: string;
  gerencia: string;
  centroCusto: string;
  status: "Ativo" | "Inativo";
  limite?: number;
}

export interface HistoricoExecucao {
  id?: string;
  usuario: string;
  data: string;
  gerencia: string;
  placa: string;
  valorCredito: number;
  status: "Sucesso" | "Falha";
  mensagem: string;
  tempoExecucao: number; // in seconds
  screenshotErro?: string; // base64 or URL
  logs: string[];
}

export interface FuelControlConfig {
  timeout: number;
  retries: number;
  platformUrl: string;
  executionMode: "simulation" | "production";
  notificationEmail: string;
}

// Default initial seed data for Offline/Fallback
export const DEFAULT_GERENCIAS: Gerencia[] = [
  { nome: "GAD", centroCusto: "10.01.20", codigoTicketLog: "TL-GAD-4482", orcamento: 22608.41 },
  { nome: "GEF", centroCusto: "10.02.14", codigoTicketLog: "TL-GEF-1290", orcamento: 15400.00 },
  { nome: "GAT", centroCusto: "20.14.05", codigoTicketLog: "TL-GAT-9921", orcamento: 31250.00 },
  { nome: "GEC", centroCusto: "30.08.11", codigoTicketLog: "TL-GEC-5024", orcamento: 18900.00 }
];

export const DEFAULT_ATIVOS: Ativo[] = [
  { placa: "PCA7094", gerencia: "GAD", centroCusto: "10.01.20", status: "Ativo", limite: 1500 },
  { placa: "PCA1111", gerencia: "GAD", centroCusto: "10.01.20", status: "Ativo", limite: 1200 },
  { placa: "PCA2222", gerencia: "GEF", centroCusto: "10.02.14", status: "Ativo", limite: 2000 },
  { placa: "PCB3333", gerencia: "GAT", centroCusto: "20.14.05", status: "Ativo", limite: 1800 },
  { placa: "PCC4444", gerencia: "GEC", centroCusto: "30.08.11", status: "Ativo", limite: 2500 }
];

export const DEFAULT_CONFIG: FuelControlConfig = {
  timeout: 30,
  retries: 2,
  platformUrl: "https://plataforma.ticketlog.com.br/home",
  executionMode: "simulation",
  notificationEmail: "cgf.compesa@gmail.com"
};

// --- FIRESTORE CRUD ---

export async function getGerencias(): Promise<Gerencia[]> {
  try {
    const q = query(collection(db, "fuel_control_gerencias"), orderBy("nome", "asc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      // Seed initial default data
      const list: Gerencia[] = [];
      for (const item of DEFAULT_GERENCIAS) {
        const docRef = await addDoc(collection(db, "fuel_control_gerencias"), item);
        list.push({ ...item, id: docRef.id });
      }
      return list;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Gerencia));
  } catch (err) {
    console.warn("Firestore error fetching gerencias, using offline defaults:", err);
    return DEFAULT_GERENCIAS.map((g, idx) => ({ id: `offline_${idx}`, ...g }));
  }
}

export async function addGerencia(gerencia: Omit<Gerencia, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "fuel_control_gerencias"), gerencia);
    return docRef.id;
  } catch (err) {
    console.error("Error adding gerencia:", err);
    throw err;
  }
}

export async function updateGerencia(id: string, gerencia: Partial<Gerencia>): Promise<void> {
  try {
    const docRef = doc(db, "fuel_control_gerencias", id);
    await updateDoc(docRef, gerencia);
  } catch (err) {
    console.error("Error updating gerencia:", err);
    throw err;
  }
}

export async function deleteGerencia(id: string): Promise<void> {
  try {
    const docRef = doc(db, "fuel_control_gerencias", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting gerencia:", err);
    throw err;
  }
}

// --- ATIVOS CRUD ---

export async function getAtivos(): Promise<Ativo[]> {
  try {
    const snapshot = await getDocs(collection(db, "fuel_control_ativos"));
    if (snapshot.empty) {
      const list: Ativo[] = [];
      for (const item of DEFAULT_ATIVOS) {
        const docRef = await addDoc(collection(db, "fuel_control_ativos"), item);
        list.push({ ...item, id: docRef.id });
      }
      return list;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ativo));
  } catch (err) {
    console.warn("Firestore error fetching ativos, using offline defaults:", err);
    return DEFAULT_ATIVOS.map((a, idx) => ({ id: `offline_${idx}`, ...a }));
  }
}

export async function addAtivo(ativo: Omit<Ativo, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "fuel_control_ativos"), ativo);
    return docRef.id;
  } catch (err) {
    console.error("Error adding ativo:", err);
    throw err;
  }
}

export async function updateAtivo(id: string, ativo: Partial<Ativo>): Promise<void> {
  try {
    const docRef = doc(db, "fuel_control_ativos", id);
    await updateDoc(docRef, ativo);
  } catch (err) {
    console.error("Error updating ativo:", err);
    throw err;
  }
}

export async function deleteAtivo(id: string): Promise<void> {
  try {
    const docRef = doc(db, "fuel_control_ativos", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting ativo:", err);
    throw err;
  }
}

// --- HISTÓRICO CRUD ---

export async function getHistorico(): Promise<HistoricoExecucao[]> {
  try {
    const q = query(collection(db, "fuel_control_historico"), orderBy("data", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HistoricoExecucao));
  } catch (err) {
    console.warn("Firestore error fetching historico:", err);
    return [];
  }
}

export async function addHistorico(run: HistoricoExecucao): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "fuel_control_historico"), run);
    return docRef.id;
  } catch (err) {
    console.error("Error saving execution history:", err);
    throw err;
  }
}

// --- CONFIG CRUD ---

export async function getFuelControlConfig(): Promise<FuelControlConfig> {
  try {
    const docRef = doc(db, "fuel_control_config", "global_settings");
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      await setDoc(docRef, DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    return snapshot.data() as FuelControlConfig;
  } catch (err) {
    console.warn("Firestore error fetching config, using offline default:", err);
    return DEFAULT_CONFIG;
  }
}

export async function saveFuelControlConfig(config: FuelControlConfig): Promise<void> {
  try {
    const docRef = doc(db, "fuel_control_config", "global_settings");
    await setDoc(docRef, config);
  } catch (err) {
    console.error("Error saving config:", err);
    throw err;
  }
}
