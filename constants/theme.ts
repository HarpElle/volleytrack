/**
 * VolleyTrack Design System
 *
 * All colors, typography, spacing, and radius tokens live here.
 * Screens import these via the useAppTheme() hook — never hardcode colors.
 *
 * Logo colors: #ff6060 (coral) and #53caff (sky blue)
 */

import { Platform } from 'react-native';

// ─── Brand Palette ───────────────────────────────────────────────────────────

export const brand = {
    blue: '#53caff',      // Logo sky blue — primary actions, "My Team"
    coral: '#ff6060',     // Logo coral — opponent, accents, urgency
};

// ─── Semantic Colors (shared across modes) ───────────────────────────────────

export const semantic = {
    success: '#22c55e',
    successLight: '#dcfce7',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fef2f2',
};

// ─── Neutral Gray Scale ──────────────────────────────────────────────────────

export const gray = {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
};

// ─── Light & Dark Palettes ───────────────────────────────────────────────────

export type AppThemeColors = typeof lightColors;

export const lightColors = {
    // Backgrounds
    bg: '#f5f7fa',
    bgCard: '#ffffff',
    bgElevated: '#ffffff',
    bgOverlay: 'rgba(0,0,0,0.5)',

    // Text
    text: '#111827',           // gray.900
    textSecondary: '#4b5563',  // gray.600
    textTertiary: '#9ca3af',   // gray.400
    textInverse: '#ffffff',

    // Borders & Dividers
    border: '#e5e7eb',         // gray.200
    borderLight: '#f3f4f6',    // gray.100
    divider: '#f3f4f6',

    // Brand
    primary: brand.blue,
    primaryLight: '#e8f7ff',   // Sky blue tint for backgrounds
    primaryDark: '#3ba8d9',    // Pressed/hover state
    opponent: brand.coral,
    opponentLight: '#fff0f0',  // Coral tint for backgrounds
    opponentDark: '#e04545',   // Pressed/hover state

    // Interactive
    buttonPrimary: brand.blue,
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#f3f4f6',
    buttonSecondaryText: '#374151',
    buttonDisabled: '#e5e7eb',
    buttonDisabledText: '#9ca3af',

    // Status
    ...semantic,

    // Momentum
    momentumPositive: '#22c55e',
    momentumNegative: brand.coral,
    momentumBase: '#e5e7eb',
    momentumCaution: '#f59e0b',
    momentumUrgent: '#ef4444',

    // Specific UI
    headerBg: '#ffffff',
    headerBorder: '#f3f4f6',
    inputBg: '#ffffff',
    inputBorder: '#e5e7eb',
    shadow: '#000000',
    placeholder: '#9ca3af',
    link: brand.blue,
    tabBar: '#ffffff',
};

export const darkColors: AppThemeColors = {
    // Backgrounds
    bg: '#0d1117',
    bgCard: '#161b22',
    bgElevated: '#21262d',
    bgOverlay: 'rgba(0,0,0,0.7)',

    // Text
    text: '#e6edf3',
    textSecondary: '#8b949e',
    textTertiary: '#484f58',
    textInverse: '#0d1117',

    // Borders & Dividers
    border: '#30363d',
    borderLight: '#21262d',
    divider: '#21262d',

    // Brand
    primary: '#6dd5ff',        // Slightly lighter blue for dark backgrounds
    primaryLight: '#152238',   // Dark blue tint
    primaryDark: '#53caff',
    opponent: '#ff7b7b',       // Slightly lighter coral for dark backgrounds
    opponentLight: '#2d1515',  // Dark coral tint
    opponentDark: '#ff6060',

    // Interactive
    buttonPrimary: '#53caff',
    buttonPrimaryText: '#0d1117',
    buttonSecondary: '#21262d',
    buttonSecondaryText: '#e6edf3',
    buttonDisabled: '#21262d',
    buttonDisabledText: '#484f58',

    // Status
    ...semantic,

    // Momentum
    momentumPositive: '#22c55e',
    momentumNegative: '#ff7b7b',
    momentumBase: '#30363d',
    momentumCaution: '#f59e0b',
    momentumUrgent: '#ef4444',

    // Specific UI
    headerBg: '#161b22',
    headerBorder: '#21262d',
    inputBg: '#0d1117',
    inputBorder: '#30363d',
    shadow: '#000000',
    placeholder: '#484f58',
    link: '#6dd5ff',
    tabBar: '#161b22',
};

// ─── Typography Scale ────────────────────────────────────────────────────────

export const fontSize = {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 34,
} as const;

export const fontWeight = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
} as const;

// ─── Fonts (Platform-Specific) ───────────────────────────────────────────────

export const Fonts = Platform.select({
    ios: {
        sans: 'system-ui',
        serif: 'ui-serif',
        rounded: 'ui-rounded',
        mono: 'ui-monospace',
    },
    default: {
        sans: 'normal',
        serif: 'serif',
        rounded: 'normal',
        mono: 'monospace',
    },
    web: {
        sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        serif: "Georgia, 'Times New Roman', serif",
        rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
        mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
});

// ─── Legacy export (for backward compatibility during migration) ─────────────

export const Colors = {
    light: {
        text: lightColors.text,
        background: lightColors.bg,
        tint: lightColors.primary,
        icon: gray[500],
        tabIconDefault: gray[500],
        tabIconSelected: lightColors.primary,
    },
    dark: {
        text: darkColors.text,
        background: darkColors.bg,
        tint: darkColors.primary,
        icon: gray[400],
        tabIconDefault: gray[400],
        tabIconSelected: darkColors.primary,
    },
};
