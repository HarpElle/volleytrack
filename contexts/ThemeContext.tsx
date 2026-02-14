/**
 * App Theme Provider
 *
 * Manages the user's theme preference (light / dark / system) and
 * exposes the resolved color palette via `useAppTheme()`.
 *
 * Preference is persisted in AsyncStorage so it survives app restarts.
 *
 * Usage in any screen:
 *   const { colors, spacing, fontSize, ... } = useAppTheme();
 *   <View style={{ backgroundColor: colors.bg }}>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
    type AppThemeColors,
    lightColors,
    darkColors,
    fontSize,
    fontWeight,
    spacing,
    radius,
    brand,
    gray,
    semantic,
    Fonts,
} from '../constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface AppTheme {
    /** The user's stored preference */
    preference: ThemePreference;
    /** The actual resolved mode after considering system setting */
    mode: ResolvedTheme;
    /** Whether we're in dark mode (convenience boolean) */
    isDark: boolean;
    /** Full semantic color palette for the current mode */
    colors: AppThemeColors;
    /** Brand colors (always the same regardless of mode) */
    brand: typeof brand;
    /** Neutral gray scale */
    gray: typeof gray;
    /** Semantic status colors */
    semantic: typeof semantic;
    /** Typography sizes */
    fontSize: typeof fontSize;
    /** Font weights */
    fontWeight: typeof fontWeight;
    /** Spacing scale */
    spacing: typeof spacing;
    /** Border radius scale */
    radius: typeof radius;
    /** Platform-specific font families */
    fonts: typeof Fonts;
    /** Update the theme preference */
    setPreference: (pref: ThemePreference) => void;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const THEME_KEY = 'volleytrack-theme-preference';

// ─── Context ─────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<AppTheme | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme(); // 'light' | 'dark' | null
    const [preference, setPreferenceState] = useState<ThemePreference>('system');
    const [loaded, setLoaded] = useState(false);

    // Load saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY).then((val) => {
            if (val === 'light' || val === 'dark' || val === 'system') {
                setPreferenceState(val);
            }
            setLoaded(true);
        });
    }, []);

    const setPreference = useCallback((pref: ThemePreference) => {
        setPreferenceState(pref);
        AsyncStorage.setItem(THEME_KEY, pref);
    }, []);

    // Resolve the actual mode
    const mode: ResolvedTheme =
        preference === 'system'
            ? (systemScheme ?? 'light')
            : preference;

    const isDark = mode === 'dark';

    const theme: AppTheme = {
        preference,
        mode,
        isDark,
        colors: isDark ? darkColors : lightColors,
        brand,
        gray,
        semantic,
        fontSize,
        fontWeight,
        spacing,
        radius,
        fonts: Fonts,
        setPreference,
    };

    // Don't render until we've loaded the preference to avoid a flash
    if (!loaded) return null;

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access the full theme from any component.
 *
 * @example
 * const { colors, spacing, isDark } = useAppTheme();
 */
export function useAppTheme(): AppTheme {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useAppTheme must be used within <AppThemeProvider>');
    }
    return ctx;
}
