import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firestore with specific database ID if provided, otherwise use default
export const db = (dbId && dbId !== "(default)") ? getFirestore(app, dbId) : getFirestore(app);
export const dbNexusId = "ai-studio-nexusfrotabi-e9d568ef-497f-45b7-bab8-c15e863d0aad";
export const dbNexus = getFirestore(app, dbNexusId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

async function testConnection() {
  try {
    // Attempting to read a dummy document to verify connectivity
    const testDoc = doc(db, 'system', 'connection_test');
    await getDocFromServer(testDoc);
    console.log("Firebase Connection: Online and Ready");
  } catch (error: any) {
    if (error?.message && (error.message.includes('the client is offline') || error.message.includes('unavailable'))) {
      console.warn("Firebase Report: Connection is in offline mode or network is restricted.");
    } else if (error?.code === 'permission-denied') {
      console.log("Firebase Connection: Success (authenticated, but permission denied for test doc)");
    } else {
      console.log("Firebase Connection status:", error?.message || error);
    }
  }
}
testConnection();

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) {
  if (error?.code === 'permission-denied') {
    const authInfo = auth.currentUser ? {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email || '',
      emailVerified: auth.currentUser.emailVerified,
      isAnonymous: auth.currentUser.isAnonymous,
      providerInfo: auth.currentUser.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      }))
    } : {
      userId: '',
      email: '',
      emailVerified: false,
      isAnonymous: true,
      providerInfo: []
    };

    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
}

export default app;
