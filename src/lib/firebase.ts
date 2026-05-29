// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth"; // Import getAuth
import { getStorage } from "firebase/storage"; // Import getStorage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""
};


let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage; // Declare storage

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

auth = getAuth(app);
storage = getStorage(app); // Initialize storage

if (process.env.NODE_ENV === 'development') {
  console.log("Firebase initialized with Project ID:", firebaseConfig.projectId);
  // To connect to emulators (if you decide to use them later):
  // import { connectFirestoreEmulator } from "firebase/firestore";
  // import { connectAuthEmulator } from "firebase/auth";
  // import { connectStorageEmulator } from "firebase/storage";
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectAuthEmulator(auth, 'http://localhost:9099');
  // connectStorageEmulator(storage, 'localhost', 9199);
}

export { app, db, auth, storage }; // Export auth and storage
