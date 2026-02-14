import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: 'AIzaSyBxhHMWbjBAey-KqJvZ0DjKUfEhitgcrSQ',
    authDomain: 'volleytrack-7b621.firebaseapp.com',
    projectId: 'volleytrack-7b621',
    storageBucket: 'volleytrack-7b621.firebasestorage.app',
    messagingSenderId: '1015750053269',
    appId: '1:1015750053269:web:75c49090801df62daa3a9c',
    measurementId: 'G-WPZFECQWGL',
};

// Initialize Firebase (guard against double-init in dev/hot-reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth — use initializeAuth with AsyncStorage persistence so auth state
// persists between sessions (fixes the "memory persistence" warning).
// On hot-reload, fall back to getAuth since initializeAuth can only be called once.
let auth;
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
