import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth & Firestore
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Workspace Scopes for Gmail, Google Calendar, Google Drive, Google Tasks, Google Classroom, Google Docs, and Google Meet
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.compose');
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/tasks.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.courses');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.coursework.me');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.coursework.students');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.courseworkmaterials');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.announcements');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.topics');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/documents');
googleProvider.addScope('https://www.googleapis.com/auth/meetings.space.created');
googleProvider.addScope('https://www.googleapis.com/auth/meetings.space.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/chat.spaces.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/chat.messages.create');

// Suppress internal Firestore connection retry logs and offline mode notices
try {
  setLogLevel('silent');
} catch {
  // Ignore if setLogLevel is restricted
}

// Initialize Firestore with forced long-polling and local multi-tab cache for seamless offline + online persistence
const customDatabaseId = (firebaseConfigJson as Record<string, any>).firestoreDatabaseId;

let localCacheConfig;
try {
  localCacheConfig = persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  });
} catch {
  localCacheConfig = memoryLocalCache();
}

const firestoreSettings = {
  experimentalForceLongPolling: true,
  localCache: localCacheConfig
};

let firestoreInstance;
try {
  firestoreInstance = customDatabaseId && customDatabaseId !== '(default)'
    ? initializeFirestore(app, firestoreSettings, customDatabaseId)
    : initializeFirestore(app, firestoreSettings);
} catch (err) {
  try {
    firestoreInstance = customDatabaseId && customDatabaseId !== '(default)'
      ? getFirestore(app, customDatabaseId)
      : getFirestore(app);
  } catch {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;

