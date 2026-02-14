import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { OnboardingFlow, hasSeenOnboarding } from '../components/OnboardingFlow';
import { AuthProvider, useAuth } from '../services/firebase';
import { AppThemeProvider, useAppTheme } from '../contexts/ThemeContext';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { initializeRevenueCat } from '../services/revenuecat/RevenueCatService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const SKIP_AUTH_KEY = 'volleytrack-skip-auth';

// Context so auth screens can set the skip flag
interface SkipAuthContextValue {
  skipAuth: boolean;
  setSkipAuth: (skip: boolean) => void;
}
const SkipAuthContext = createContext<SkipAuthContextValue>({ skipAuth: false, setSkipAuth: () => {} });
export const useSkipAuth = () => useContext(SkipAuthContext);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { skipAuth, setSkipAuth } = useSkipAuth();
  const [checkingSkip, setCheckingSkip] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useAppTheme();

  // Check onboarding + skip auth status on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SKIP_AUTH_KEY),
      hasSeenOnboarding(),
    ]).then(([skipVal, seen]) => {
      if (skipVal === 'true') setSkipAuth(true);
      setShowOnboarding(!seen);
      setCheckingSkip(false);
    });
  }, []);

  useEffect(() => {
    if (loading || checkingSkip || showOnboarding) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !skipAuth && !inAuthGroup) {
      // Not signed in, hasn't skipped, not on auth screen → go to sign-in
      router.replace('/auth/sign-in');
    } else if (user && inAuthGroup) {
      // Signed in but on auth screen → go to dashboard
      router.replace('/');
    }
  }, [user, loading, skipAuth, checkingSkip, showOnboarding, segments]);

  if (loading || checkingSkip || showOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show onboarding on first launch
  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

  return <>{children}</>;
}

/**
 * Bridges our AppTheme to React Navigation's theme format
 * so that default navigation chrome (headers, backgrounds) picks up our colors.
 */
function NavigationThemeBridge({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useAppTheme();

  const navTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.bg,
      card: colors.bgCard,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
    fonts: isDark ? DarkTheme.fonts : DefaultTheme.fonts,
  }), [colors, isDark]);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <ThemeProvider value={navTheme}>
        {children}
      </ThemeProvider>
    </>
  );
}

export default function RootLayout() {
  const [skipAuth, setSkipAuthState] = useState(false);

  const setSkipAuth = (skip: boolean) => {
    setSkipAuthState(skip);
    AsyncStorage.setItem(SKIP_AUTH_KEY, skip ? 'true' : 'false');
  };

  // Basic splash screen handling
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Initialize device UUID and RevenueCat subscription management
  useEffect(() => {
    async function initMonetization() {
      try {
        const deviceUUID = await useSubscriptionStore.getState().initializeDevice();
        await initializeRevenueCat(deviceUUID);
      } catch (error) {
        console.warn('[Monetization] Init failed (app continues on free tier):', error);
      }
    }
    initMonetization();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider>
          <SkipAuthContext.Provider value={{ skipAuth, setSkipAuth }}>
            <NavigationThemeBridge>
              <AuthGate>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="live" />
                  <Stack.Screen name="summary" />
                  <Stack.Screen name="match/setup" />
                  <Stack.Screen name="season/[id]" />
                  <Stack.Screen name="season/create" />
                  <Stack.Screen name="event/manage" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="event/[id]" />
                  <Stack.Screen name="auth/sign-in" />
                  <Stack.Screen name="auth/sign-up" />
                  <Stack.Screen name="auth/forgot-password" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="spectate/join" />
                  <Stack.Screen name="spectate/[code]" />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </AuthGate>
            </NavigationThemeBridge>
          </SkipAuthContext.Provider>
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
