import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence is exported in RN environment but wrapper types may miss it
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (guard against double-init in dev/hot-reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth — use initializeAuth with AsyncStorage persistence so auth state
// persists between sessions (fixes the "memory persistence" warning).
// On hot-reload, fall back to getAuth since initializeAuth can only be called once.
let auth: Auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} catch (e) {
    // initializeAuth throws if already initialized (hot-reload), fall back to getAuth
    auth = getAuth(app);
}

// Firestore — offline persistence is enabled by default in the Firebase JS SDK.
const db = getFirestore(app);

export { app, auth, db };
