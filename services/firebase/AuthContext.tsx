import {
    User,
    createUserWithEmailAndPassword,
    deleteUser,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, db } from './config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

interface AuthContextValue {
    user: User | null;
    uid: string | null;
    loading: boolean;
    hasPassword: boolean; // Derived helper
    signUp: (email: string, password: string, displayName?: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<boolean>;
    deleteAccount: () => Promise<void>;
    clearError: () => void;
    error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<{
        user: User | null;
        loading: boolean;
        error: string | null;
    }>({
        user: null,
        loading: true, // true until first auth check completes
        error: null,
    });

    // Listen for auth state changes (login, logout, token refresh)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setState({ user, loading: false, error: null });
        });
        return unsubscribe;
    }, []);

    const clearError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null }));
    }, []);

    // ── Sign Up ──────────────────────────────────────────────────────────────

    const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            // Set display name if provided
            if (displayName) {
                await updateProfile(user, { displayName });
            }

            // Create user profile document in Firestore
            await setDoc(doc(db, 'users', user.uid, 'profile', 'info'), {
                email: user.email,
                displayName: displayName || null,
                createdAt: serverTimestamp(),
            });

            setState({ user, loading: false, error: null });
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: getAuthErrorMessage(err.code),
            }));
        }
    }, []);

    // ── Sign In ──────────────────────────────────────────────────────────────

    const signIn = useCallback(async (email: string, password: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const { user } = await signInWithEmailAndPassword(auth, email, password);
            setState({ user, loading: false, error: null });
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: getAuthErrorMessage(err.code),
            }));
        }
    }, []);

    // ── Sign Out ─────────────────────────────────────────────────────────────

    const signOut = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            await firebaseSignOut(auth);
            // onAuthStateChanged will update state
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: 'Failed to sign out. Please try again.',
            }));
        }
    }, []);

    // ── Reset Password ───────────────────────────────────────────────────────

    const resetPassword = useCallback(async (email: string): Promise<boolean> => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            await sendPasswordResetEmail(auth, email);
            setState((prev) => ({ ...prev, loading: false }));
            return true;
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: getAuthErrorMessage(err.code),
            }));
            return false;
        }
    }, []);

    // ── Delete Account ───────────────────────────────────────────────────────

    const deleteAccount = useCallback(async () => {
        if (!auth.currentUser) return;
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            await deleteUser(auth.currentUser);
            // onAuthStateChanged will update state
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: getAuthErrorMessage(err.code),
            }));
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                ...state,
                uid: state.user?.uid || null,
                hasPassword: state.user?.isAnonymous === false,
                signUp,
                signIn,
                signOut,
                resetPassword,
                deleteAccount,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

// ─── Error Messages ──────────────────────────────────────────────────────────

function getAuthErrorMessage(code: string): string {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/requires-recent-login':
            return 'Please sign in again before deleting your account.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection and try again.';
        default:
            return 'Something went wrong. Please try again.';
    }
}
