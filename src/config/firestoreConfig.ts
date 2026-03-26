import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { FirebaseStorage, getStorage } from "firebase/storage";

const uploadFirebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAByVPkOEMdUKg3p96TmP98Q_VtrcAtzFk",
  authDomain: "banco-de-dados-fotos.firebaseapp.com",
  projectId: "banco-de-dados-fotos",
  storageBucket: "banco-de-dados-fotos.firebasestorage.app",
  messagingSenderId: "957707869289",
  appId: "1:957707869289:web:1a987b3c01ba2318c396f8",
};

const legacyFirebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDemda3V4atRbz_CoiYXy3iNBXl78F-vFE",
  authDomain: "backend-91edf.firebaseapp.com",
  databaseURL: "https://backend-91edf-default-rtdb.firebaseio.com",
  projectId: "backend-91edf",
  storageBucket: "backend-91edf.appspot.com",
  messagingSenderId: "704857852469",
  appId: "1:704857852469:web:ed525a312cb665f13ebf7c",
};

function getOrCreateNamedApp(name: string, config: FirebaseOptions): FirebaseApp {
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;
  return initializeApp(config, name);
}

// App principal para NOVOS uploads
const uploadApp = getOrCreateNamedApp("rizzosports-upload-storage", uploadFirebaseConfig);

// App legado apenas para manutenção/migração futura, se necessário
const legacyApp = getOrCreateNamedApp("rizzosports-legacy-storage", legacyFirebaseConfig);

// Mantém compatibilidade com imports existentes:
// import { storage } from "../config/firestoreConfig";
export const storage: FirebaseStorage = getStorage(uploadApp);

// Exports explícitos
export const uploadStorage: FirebaseStorage = storage;
export const oldStorage: FirebaseStorage = getStorage(legacyApp);
export { uploadApp, legacyApp };