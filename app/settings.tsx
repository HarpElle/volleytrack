import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    ChevronRight,
    Cloud,
    CloudOff,
    Crown,
    LogIn,
    LogOut,
    Monitor,
    Moon,
    RotateCcw,
    Sun,
    Trash2,
    User,
    Zap
} from 'lucide-react-native';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaywallModal } from '../components/PaywallModal';
import { FREE_AI_NARRATIVE_LIMIT, FREE_EXPORT_LIMIT } from '../constants/monetization';
import { useAppTheme, type ThemePreference } from '../contexts/ThemeContext';
import { useAuth } from '../services/firebase';
import { presentCustomerCenter, restorePurchases } from '../services/revenuecat/RevenueCatService';
import { useDataStore } from '../store/useDataStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { useSkipAuth } from './_layout';

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsScreen() {
    const router = useRouter();
    const { user, signOut, deleteAccount } = useAuth();
    const { setSkipAuth } = useSkipAuth();
    const { syncStatus, lastSyncedAt, syncError, syncWithCloud } = useDataStore();
    const { colors, spacing, fontSize, radius, preference, setPreference } = useAppTheme();

    // Subscription state
    const isPro = useSubscriptionStore((s) => s.isPro);
    const subscriptionType = useSubscriptionStore((s) => s.subscriptionType);
    const expiresAt = useSubscriptionStore((s) => s.expiresAt);
    const aiNarrativesUsed = useSubscriptionStore((s) => s.aiNarrativesUsed);
    const exportsUsed = useSubscriptionStore((s) => s.exportsUsed);
    const [showPaywall, setShowPaywall] = useState(false);
    const [restoringPurchases, setRestoringPurchases] = useState(false);

    const handleRestorePurchases = async () => {
        setRestoringPurchases(true);
        try {
            const restored = await restorePurchases();
            if (restored) {
                Alert.alert('Restored!', 'Your Pro subscription has been restored.');
            } else {
                Alert.alert('No Purchase Found', 'We could not find an active subscription for this device.');
            }
        } catch (error: any) {
            Alert.alert('Restore Failed', error.message || 'Something went wrong.');
        } finally {
            setRestoringPurchases(false);
        }
    };

    const handleManageSubscription = async () => {
        try {
            // Use RevenueCat Customer Center for a richer management experience
            await presentCustomerCenter();
        } catch {
            // Fallback to native subscription settings if Customer Center fails
            if (Platform.OS === 'ios') {
                Linking.openURL('https://apps.apple.com/account/subscriptions');
            } else {
                Linking.openURL('https://play.google.com/store/account/subscriptions');
            }
        }
    };

    const handleManualSync = () => {
        if (!user) return;
        syncWithCloud(user.uid);
    };

    const formatLastSynced = () => {
        if (!lastSyncedAt) return 'Never';
        const diff = Date.now() - lastSyncedAt;
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return new Date(lastSyncedAt).toLocaleDateString();
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Your local data will remain on this device. Sign back in to sync again.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    onPress: async () => {
                        await signOut();
                        setSkipAuth(false);
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all cloud data. Local data on this device will not be affected. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteAccount();
                        setSkipAuth(false);
                    },
                },
            ]
        );
    };

    const handleSignIn = () => {
        setSkipAuth(false);
        router.replace('/auth/sign-in');
    };

    // Dynamic styles based on theme
    const themed = {
        container: { flex: 1, backgroundColor: colors.bg } as const,
        header: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            backgroundColor: colors.headerBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.headerBorder,
        },
        headerTitle: {
            fontSize: fontSize.lg,
            fontWeight: '700' as const,
            color: colors.text,
        },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: '600' as const,
            color: colors.textTertiary,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.base,
            marginLeft: 4,
        },
        card: {
            backgroundColor: colors.bgCard,
            borderRadius: radius.md,
            overflow: 'hidden' as const,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.03,
            shadowRadius: 4,
            elevation: 1,
        },
        separator: {
            height: 1,
            backgroundColor: colors.divider,
            marginLeft: spacing.base,
        },
        rowText: {
            fontSize: fontSize.md,
            color: colors.text,
        },
        rowDetail: {
            fontSize: fontSize.sm + 1,
            color: colors.textTertiary,
        },
    };

    return (
        <SafeAreaView style={themed.container}>
            {/* Header */}
            <View style={themed.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={themed.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={{ flex: 1, padding: spacing.lg }}>
                {/* Appearance Section */}
                <Text style={themed.sectionLabel}>Appearance</Text>
                <View style={themed.card}>
                    <View style={styles.themeRow}>
                        {themeOptions.map((opt) => {
                            const isActive = preference === opt.value;
                            const Icon = opt.icon;
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                        styles.themeOption,
                                        {
                                            backgroundColor: isActive ? colors.primaryLight : 'transparent',
                                            borderColor: isActive ? colors.primary : colors.border,
                                            borderRadius: radius.sm,
                                        },
                                    ]}
                                    onPress={() => setPreference(opt.value)}
                                >
                                    <Icon
                                        size={20}
                                        color={isActive ? colors.primary : colors.textSecondary}
                                    />
                                    <Text
                                        style={{
                                            fontSize: fontSize.sm,
                                            fontWeight: isActive ? '600' : '400',
                                            color: isActive ? colors.primary : colors.textSecondary,
                                            marginTop: 4,
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Subscription Section */}
                <Text style={themed.sectionLabel}>Subscription</Text>
                <View style={themed.card}>
                    {isPro ? (
                        <>
                            {/* Pro Badge & Info */}
                            <View style={styles.row}>
                                <View style={styles.rowLeft}>
                                    <Crown size={20} color={colors.primary} />
                                    <View>
                                        <Text style={[themed.rowText, { fontWeight: '700' }]}>VolleyTrack Pro</Text>
                                        <Text style={themed.rowDetail}>
                                            {subscriptionType === 'lifetime' ? 'Lifetime' :
                                                subscriptionType === 'annual' ? 'Annual' :
                                                    subscriptionType === 'monthly' ? 'Monthly' : 'Active'}
                                            {expiresAt && subscriptionType !== 'lifetime' ?
                                                ` · Renews ${new Date(expiresAt).toLocaleDateString()}` : ''}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={themed.separator} />
                            <TouchableOpacity style={styles.row} onPress={handleManageSubscription}>
                                <View style={styles.rowLeft}>
                                    <Text style={themed.rowText}>Manage Subscription</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* Free Plan Info */}
                            <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
                                <Text style={[themed.rowText, { fontWeight: '700' }]}>Free Plan</Text>
                                <Text style={themed.rowDetail}>
                                    AI Narratives: {aiNarrativesUsed}/{FREE_AI_NARRATIVE_LIMIT} used · Exports: {exportsUsed}/{FREE_EXPORT_LIMIT} used
                                </Text>
                            </View>
                            <View style={themed.separator} />
                            <TouchableOpacity style={styles.row} onPress={() => setShowPaywall(true)}>
                                <View style={styles.rowLeft}>
                                    <Zap size={20} color={colors.primary} />
                                    <Text style={[themed.rowText, { color: colors.primary, fontWeight: '600' }]}>Upgrade to Pro</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={themed.separator} />
                            <TouchableOpacity style={styles.row} onPress={handleRestorePurchases} disabled={restoringPurchases}>
                                <View style={styles.rowLeft}>
                                    {restoringPurchases
                                        ? <ActivityIndicator size="small" color={colors.textSecondary} />
                                        : <RotateCcw size={20} color={colors.textSecondary} />
                                    }
                                    <Text style={themed.rowText}>Restore Purchases</Text>
                                </View>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Account Section */}
                <Text style={themed.sectionLabel}>Account</Text>
                <View style={themed.card}>
                    {user ? (
                        <>
                            {/* Profile Info */}
                            <View style={styles.profileRow}>
                                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                                    <User size={24} color={colors.buttonPrimaryText} />
                                </View>
                                <View style={styles.profileInfo}>
                                    {user.displayName && (
                                        <Text style={[styles.profileName, { color: colors.text }]}>
                                            {user.displayName}
                                        </Text>
                                    )}
                                    <Text style={{ fontSize: fontSize.sm + 1, color: colors.textSecondary }}>
                                        {user.email}
                                    </Text>
                                </View>
                            </View>

                            <View style={themed.separator} />

                            {/* Sign Out */}
                            <TouchableOpacity style={styles.row} onPress={handleSignOut}>
                                <View style={styles.rowLeft}>
                                    <LogOut size={20} color={colors.textSecondary} />
                                    <Text style={themed.rowText}>Sign Out</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textTertiary} />
                            </TouchableOpacity>

                            <View style={themed.separator} />

                            {/* Delete Account */}
                            <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
                                <View style={styles.rowLeft}>
                                    <Trash2 size={20} color={colors.error} />
                                    <Text style={[themed.rowText, { color: colors.error }]}>Delete Account</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity style={styles.row} onPress={handleSignIn}>
                            <View style={styles.rowLeft}>
                                <LogIn size={20} color={colors.primary} />
                                <Text style={[themed.rowText, { color: colors.primary }]}>
                                    Sign in to sync your data
                                </Text>
                            </View>
                            <ChevronRight size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Sync Section */}
                {user && (
                    <>
                        <Text style={themed.sectionLabel}>Data Sync</Text>
                        <View style={themed.card}>
                            <TouchableOpacity
                                style={styles.row}
                                onPress={handleManualSync}
                                disabled={syncStatus === 'syncing'}
                            >
                                <View style={styles.rowLeft}>
                                    {syncStatus === 'syncing'
                                        ? <ActivityIndicator size="small" color={colors.primary} />
                                        : syncStatus === 'error'
                                            ? <CloudOff size={20} color={colors.error} />
                                            : <Cloud size={20} color={colors.success} />
                                    }
                                    <Text style={themed.rowText}>
                                        {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                                    </Text>
                                </View>
                                <Text style={themed.rowDetail}>{formatLastSynced()}</Text>
                            </TouchableOpacity>

                            {syncError && (
                                <>
                                    <View style={themed.separator} />
                                    <View style={[styles.row, { paddingVertical: 10 }]}>
                                        <Text style={{ color: colors.error, fontSize: fontSize.sm }}>
                                            {syncError}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </>
                )}

                {/* Help Section */}
                <Text style={themed.sectionLabel}>Help & Support</Text>
                <View style={themed.card}>
                    {/* @ts-ignore - Route exists but types not yet generated */}
                    <TouchableOpacity style={styles.row} onPress={() => router.push('/tour')}>
                        <View style={styles.rowLeft}>
                            <Crown size={20} color={colors.primary} />
                            <Text style={themed.rowText}>Feature Tour</Text>
                        </View>
                        <ChevronRight size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <Text style={themed.sectionLabel}>About</Text>
                <View style={themed.card}>
                    <View style={styles.row}>
                        <Text style={themed.rowText}>Version</Text>
                        <Text style={themed.rowDetail}>1.0.0</Text>
                    </View>
                </View>

                {/* Bottom spacing */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Paywall Modal */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger="settings"
            />
        </SafeAreaView>
    );
}

// Static styles (layout-only, no colors)
const styles = StyleSheet.create({
    backBtn: {
        padding: 8,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    themeRow: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
    },
    themeOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1.5,
    },
});
