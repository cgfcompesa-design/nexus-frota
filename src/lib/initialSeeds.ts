import { 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';

// 1. DEFAULT RESPONSIPLES
export const DEFAULT_RESPONSIBLES = [
  { name: "Gleyston Silva", email: "gleyston.silva@compesa.com.br", whatsapp: "81999991111" },
  { name: "Carlos Souza", email: "carlos.souza@compesa.com.br", whatsapp: "81999992222" },
  { name: "Renata Alencar", email: "renata.alencar@compesa.com.br", whatsapp: "81999993333" },
  { name: "Marcos Oliveira", email: "marcos.oliveira@compesa.com.br", whatsapp: "81999994444" },
  { name: "Patricia Melo", email: "patricia.melo@compesa.com.br", whatsapp: "81999995555" },
  { name: "Fernando Santos", email: "fernando.santos@compesa.com.br", whatsapp: "81999996666" }
];

// 2. DEFAULT INDICATORS
export const DEFAULT_INDICATORS = [
  // Manutenção - Próprios
  { name: "Disponibilidade da Frota", section: "manutencao", subsection: "Próprios", unit: "%", target: 90, chart_type: "gauge", order: 1, goal_type: "higher" },
  { name: "Cumprimento de Preventivas", section: "manutencao", subsection: "Próprios", unit: "%", target: 85, chart_type: "bar", order: 2, goal_type: "higher" },
  
  // Manutenção - Locados
  { name: "Inoperância Mensal", section: "manutencao", subsection: "Locados", unit: " dias", target: 5, chart_type: "bar", order: 3, goal_type: "lower" },
  { name: "Devoluções de Ativos no Prazo", section: "manutencao", subsection: "Locados", unit: "%", target: 95, chart_type: "gauge", order: 4, goal_type: "higher" },

  // Abastecimento
  { name: "Média de Consumo de Diesel", section: "abastecimento", unit: " km/L", target: 8.5, chart_type: "line", order: 5, goal_type: "higher" },
  { name: "Orçamento de Combustível Executado", section: "abastecimento", unit: "%", target: 100, chart_type: "bar", order: 6, goal_type: "lower" },

  // Regularização
  { name: "Multas por Veículo", section: "regularizacao", unit: " un", target: 2, chart_type: "number", order: 7, goal_type: "lower" },
  { name: "Documentação CRLV em Dia", section: "regularizacao", unit: "%", target: 100, chart_type: "gauge", order: 8, goal_type: "higher" },

  // Telemetria
  { name: "Eventos de Excesso de Velocidade", section: "telemetria", unit: " un", target: 15, chart_type: "number", order: 9, goal_type: "lower" },
  { name: "Eventos de Frenagem Brusca", section: "telemetria", unit: " un", target: 10, chart_type: "bar", order: 10, goal_type: "lower" },

  // Pool
  { name: "Taxa de Ocupação dos Veículos", section: "pool", unit: "%", target: 80, chart_type: "gauge", order: 11, goal_type: "higher" }
];

// Helper to simulate values over months
const historicalScores: Record<string, { [month: string]: number }> = {
  "Disponibilidade da Frota": { "2026-05-01": 88, "2026-06-01": 92 },
  "Cumprimento de Preventivas": { "2026-05-01": 82, "2026-06-01": 87 },
  "Inoperância Mensal": { "2026-05-01": 6, "2026-06-01": 4 },
  "Devoluções de Ativos no Prazo": { "2026-05-01": 92, "2026-06-01": 96 },
  "Média de Consumo de Diesel": { "2026-05-01": 8.1, "2026-06-01": 8.7 },
  "Orçamento de Combustível Executado": { "2026-05-01": 98, "2026-06-01": 94 },
  "Multas por Veículo": { "2026-05-01": 3, "2026-06-01": 1 },
  "Documentação CRLV em Dia": { "2026-05-01": 100, "2026-06-01": 100 },
  "Eventos de Excesso de Velocidade": { "2026-05-01": 18, "2026-06-01": 11 },
  "Eventos de Frenagem Brusca": { "2026-05-01": 12, "2026-06-01": 7 },
  "Taxa de Ocupação dos Veículos": { "2026-05-01": 75, "2026-06-01": 82 }
};

// 3. DEFAULT KANBAN TASKS
export const get_DEFAULT_KANBAN_TASKS = (responsiblesMap: Record<string, { id: string; name: string }>) => {
  const gleyston = responsiblesMap["Gleyston Silva"] || { id: "seed_1", name: "Gleyston Silva" };
  const carlos = responsiblesMap["Carlos Souza"] || { id: "seed_2", name: "Carlos Souza" };
  const renata = responsiblesMap["Renata Alencar"] || { id: "seed_3", name: "Renata Alencar" };
  const marcos = responsiblesMap["Marcos Oliveira"] || { id: "seed_4", name: "Marcos Oliveira" };
  const patricia = responsiblesMap["Patricia Melo"] || { id: "seed_5", name: "Patricia Melo" };
  const fernando = responsiblesMap["Fernando Santos"] || { id: "seed_6", name: "Fernando Santos" };

  return [
    {
      title: "Revisão dos Planos de Manutenção Preventiva dos Caminhões Pipa",
      description: "Revisar cronograma de lubrificação e filtros da frota própria de caminhões pipa para garantir operação contínua.",
      status: "todo",
      sector: "PLANEJAMENTO DE MANUTENÇÃO - PRÓPRIOS",
      priority_color: "#ef4444", // High (Red)
      activity_type: "Técnico",
      responsibles: [gleyston],
      deadline: "2026-07-15",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Recalcular e Ajustar Limites de Cartões Ticket Log",
      description: "Reajustar orçamentos de abastecimento e limites dos cartões das gerências conforme saldo de execução do mês anterior.",
      status: "progress",
      sector: "ABASTECIMENTO",
      priority_color: "#f59e0b", // Medium (Amber)
      activity_type: "Método",
      responsibles: [marcos],
      deadline: "2026-07-05",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Certificação de Cronotacógrafos da Frota Própria",
      description: "Agendar e acompanhar a vistoria periódica de tacógrafos junto ao INMETRO para os ativos regulamentados.",
      status: "review",
      sector: "REGULARIZAÇÃO",
      priority_color: "#3b82f6", // Info (Blue)
      activity_type: "Técnico",
      responsibles: [renata],
      deadline: "2026-07-10",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Auditoria de Alertas de Telemetria (Excesso de Velocidade)",
      description: "Análise semanal de velocidade excedida e relatórios de frenagem brusca com envio de notificações educativas aos motoristas.",
      status: "done",
      sector: "TELEMETRIA",
      priority_color: "#10b981", // Success (Green)
      activity_type: "Técnico",
      responsibles: [patricia],
      deadline: "2026-06-28",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Escala Logística Semanal do Pool de Veículos Leves",
      description: "Planejar a distribuição e escala diária dos motoristas do pool para atender os agendamentos internos de vistorias.",
      status: "done",
      sector: "POOL",
      priority_color: "#10b981", // Success (Green)
      activity_type: "Método",
      responsibles: [fernando],
      deadline: "2026-06-25",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
};

/**
 * Robust seeding function that seeds all default collections if they are blank.
 */
export async function checkAndSeedAllData(): Promise<void> {
  try {
    console.log("[SEEDER] Iniciando verificação de banco de dados para sementes...");

    // 1. SEED RESPONSIPLES
    const respColl = collection(db, 'kanban_responsibles');
    const respSnapshot = await getDocs(respColl);
    const responsiblesMap: Record<string, { id: string; name: string }> = {};

    if (respSnapshot.empty) {
      console.log("[SEEDER] Coleção 'kanban_responsibles' vazia. Semeando responsáveis...");
      for (const item of DEFAULT_RESPONSIBLES) {
        const docRef = await addDoc(respColl, item);
        responsiblesMap[item.name] = { id: docRef.id, name: item.name };
      }
    } else {
      respSnapshot.docs.forEach(doc => {
        const data = doc.data();
        responsiblesMap[data.name] = { id: doc.id, name: data.name };
      });
    }

    // 2. SEED KANBAN TASKS
    const taskColl = collection(db, 'kanban_tasks');
    const taskSnapshot = await getDocs(taskColl);
    if (taskSnapshot.empty) {
      console.log("[SEEDER] Coleção 'kanban_tasks' vazia. Semeando demandas padrão...");
      const defaultTasks = get_DEFAULT_KANBAN_TASKS(responsiblesMap);
      for (const task of defaultTasks) {
        await addDoc(taskColl, {
          ...task,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // 3. SEED INDICATORS & VALUES
    const indColl = collection(db, 'indicators');
    const indSnapshot = await getDocs(indColl);
    
    if (indSnapshot.empty) {
      console.log("[SEEDER] Coleção 'indicators' vazia. Semeando indicadores e dados históricos de Gestão à Vista...");
      const valColl = collection(db, 'indicator_values');
      
      for (const ind of DEFAULT_INDICATORS) {
        // Associate with a logical responsible
        let chosenResponsibleId = "";
        if (ind.section === "manutencao" && ind.subsection === "Próprios") {
          chosenResponsibleId = responsiblesMap["Gleyston Silva"]?.id || "";
        } else if (ind.section === "manutencao" && ind.subsection === "Locados") {
          chosenResponsibleId = responsiblesMap["Carlos Souza"]?.id || "";
        } else if (ind.section === "abastecimento") {
          chosenResponsibleId = responsiblesMap["Marcos Oliveira"]?.id || "";
        } else if (ind.section === "regularizacao") {
          chosenResponsibleId = responsiblesMap["Renata Alencar"]?.id || "";
        } else if (ind.section === "telemetria") {
          chosenResponsibleId = responsiblesMap["Patricia Melo"]?.id || "";
        } else if (ind.section === "pool") {
          chosenResponsibleId = responsiblesMap["Fernando Santos"]?.id || "";
        }

        const indicatorDoc = {
          ...ind,
          responsible_id: chosenResponsibleId,
          createdAt: serverTimestamp()
        };

        const indRef = await addDoc(indColl, indicatorDoc);
        const indicatorId = indRef.id;

        // Add monthly values for May and June 2026
        const history = historicalScores[ind.name];
        if (history) {
          for (const [month, value] of Object.entries(history)) {
            await addDoc(valColl, {
              indicator_id: indicatorId,
              month: month, // YYYY-MM-01 format
              current_value: value,
              target: ind.target,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }

    console.log("[SEEDER] Processamento de sementes finalizado com sucesso.");
  } catch (error) {
    console.error("[SEEDER] Falha crítica ao semear dados:", error);
  }
}
