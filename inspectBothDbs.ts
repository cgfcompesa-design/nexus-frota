import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

const dbs = {
  "ai-studio-nexusfrotabi-e9d568ef-497f-45b7-bab8-c15e863d0aad": getFirestore(app, "ai-studio-nexusfrotabi-e9d568ef-497f-45b7-bab8-c15e863d0aad"),
  "ai-studio-e9d568ef-497f-45b7-bab8-c15e863d0aad": getFirestore(app, "ai-studio-e9d568ef-497f-45b7-bab8-c15e863d0aad"),
  "default": getFirestore(app)
};

const docIds = [
  "eFOoHjlobYhz9aY8KTFE",
  "aAHMxyC4JvdXP2T1jiGi"
];

const collections = [
  "machine_supply_assignments",
  "preventiva_locadoras",
  "checklist_submissions",
  "indicators",
  "indicator_values",
  "kanban_tasks",
  "kanban_quick_tasks",
  "users"
];

async function run() {
  console.log("=== DIAGNOSTIC START ===");
  
  for (const [name, dbInstance] of Object.entries(dbs)) {
    console.log(`\nChecking database: [${name}]`);
    
    // Check specific IDs
    for (const docId of docIds) {
      for (const coll of collections) {
        try {
          const docRef = doc(dbInstance, coll, docId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            console.log(`  -> FOUND ID "${docId}" in collection "${coll}"!`);
            console.log(`     Data:`, JSON.stringify(snap.data(), null, 2));
          }
        } catch (e: any) {
          // If permission denied or other error, print it
          if (e.code !== "permission-denied") {
            console.log(`  -> Error checking ID "${docId}" in "${coll}":`, e.message);
          }
        }
      }
    }
    
    // Check total counts in machine_supply_assignments and preventiva_locadoras to see what's inside
    try {
      const snap = await getDocs(collection(dbInstance, "machine_supply_assignments"));
      console.log(`  -> Collection "machine_supply_assignments": ${snap.size} documents`);
      if (snap.size > 0) {
        console.log("     First 3 docs:");
        snap.docs.slice(0, 3).forEach(d => {
          console.log(`       - ID: "${d.id}" | transactionId: "${d.data().transactionId}" | updatedAt:`, JSON.stringify(d.data().updatedAt));
        });
      }
    } catch (e: any) {
      console.log(`  -> Error reading "machine_supply_assignments":`, e.message);
    }

    try {
      const snap = await getDocs(collection(dbInstance, "preventiva_locadoras"));
      console.log(`  -> Collection "preventiva_locadoras": ${snap.size} documents`);
    } catch (e: any) {
      console.log(`  -> Error reading "preventiva_locadoras":`, e.message);
    }
  }
}

run().catch(console.error);
