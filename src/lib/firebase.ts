import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app); // CRITICAL: The app will break without this line
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

async function testConnection() {
  // Give it a small delay to ensure network stacks are ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("Firebase Connection: Success");
  } catch (error: any) {
    console.warn("Firebase Connection test initial attempt failed, checking status...", error);
    if(error?.message && error.message.includes('the client is offline')) {
      console.error("Firebase Report: The client is offline. This usually means the Firestore backend is unreachable or not provisioned.");
    } else if (error?.code === 'permission-denied') {
      console.log("Firebase Connection: Auth reached, but permission denied (expected if document doesn't exist but rules are working)");
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
