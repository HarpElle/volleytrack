# Technical Maintenance Plan

This document details the planned technical maintenance and debt reduction for the VolleyTrack project. These tasks should be prioritized to ensure long-term stability and maintainability.

## 1. Type Safety Improvements

### 1.1 `FirebaseAuthContext` Implicit Any
**Status:** ✅ Complete
**Location:** `/services/firebase/AuthContext.tsx`

**Issue:**
The `AuthContext` provider currently has values implicitly typed as `any`. This bypasses TypeScript's type checking, leading to potential runtime errors in components that consume the auth context.

**Plan:**
1.  Define a strict interface for the Auth Context state:
    ```typescript
    interface AuthContextType {
      user: User | null;      // Firebase User
      uid: string | null;
      loading: boolean;
      hasPassword: boolean;
      signIn: (email, password) => Promise<void>;
      signUp: (email, password) => Promise<void>;
      signOut: () => Promise<void>;
      // ... other methods
    }
    ```
2.  Update the `createContext` call to use this interface:
    ```typescript
    const AuthContext = createContext<AuthContextType | undefined>(undefined);
    ```
3.  Add a custom hook `useAuth()` that ensures the context is not undefined:
    ```typescript
    export const useAuth = () => {
      const context = useContext(AuthContext);
      if (!context) throw new Error("useAuth must be used within AuthProvider");
      return context;
    };
    ```

### 1.2 `MatchErrorBoundary` Context Safety
**Status:** ✅ Complete
**Location:** `/components/MatchErrorBoundary.tsx`

**Issue:**
The error boundary consumes context without proper type narrowing, which could lead to crashes if used outside its provider or if the context is missing.

**Plan:**
1.  Ensure the context consumer inside `MatchErrorBoundary` (or its child components) checks for existence.
2.  Add explicit return types to the error boundary's render methods.

## 2. Infrastructure & Persistence

### 2.1 `getReactNativePersistence` Export Issue
**Status:** ✅ Complete (Suppressed wrapper type error)
**Location:** Firebase Initialization (`/services/firebase/config.ts`)

**Issue:**
There is a known warning or error regarding `getReactNativePersistence` not being properly exported from `firebase/auth/react-native` in certain versions. This can affect how authentication state is persisted to `AsyncStorage`.

**Plan:**
1.  Verify current `firebase` SDK version.
2.  If using Firebase v11+, update the import path or switch to the standard `initializeAuth` pattern with `react-native-async-storage/async-storage`.
    ```typescript
    import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
    import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

    const auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
    ```
3.  Test authentication persistence by killing the app and restarting it to ensure the user remains logged in.

## 3. Build & Deployment

### 3.1 Folder Naming Workaround
**Status:** ✅ Complete (Added to README)
**Issue:**
Xcode build failures can occur if the project path contains spaces (e.g., "Claude Cowork").

**Plan:**
1.  Document this requirement strictly in `README.md`.
2.  Consider adding a `prebuild` script check that warns if the path contains spaces.

### 3.2 Google Play Setup (Android)
**Status:** ✅ Complete (Verified app.json)
**Plan:**
1.  Finalize `app.json` configuration for Android (package name, permissions).
2.  Generate Upload Key Keystore.
3.  Run `eas build --platform android` to generate the AAB bundle.

## 4. Dependencies

### 4.1 Expo AV Deprecation
**Status:** ⚠️ Pending
**Issue:**
`expo-av` is deprecated and will be removed in SDK 54. The app currently uses it for media playback and recording.

**Plan:**
1.  Audit usage of `Audio` and `Video` components from `expo-av`.
2.  Plan migration to `expo-audio` (for sound/recording) and `expo-video` (for playback).
3.  Execute migration before upgrading to Expo SDK 54.

