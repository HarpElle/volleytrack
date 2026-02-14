import { Check, Crown, X, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useAppTheme } from '../contexts/ThemeContext';
import { PRICING } from '../constants/monetization';
import { getOfferings, purchasePackage, restorePurchases } from '../services/revenuecat/RevenueCatService';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

export type PaywallTrigger = 'season' | 'ai_narrative' | 'export' | 'settings';

interface PaywallModalProps {
    visible: boolean;
    onClose: () => void;
    trigger: PaywallTrigger;
}

const TRIGGER_MESSAGES: Record<PaywallTrigger, string> = {
    season: "You've reached the free season limit",
    ai_narrative: "You've used all 3 free AI narratives",
    export: "You've used all 3 free exports",
    settings: 'Unlock the full VolleyTrack experience',
};

const PRO_FEATURES = [
    'Ad-free experience (coach & spectator)',
    'Unlimited seasons & teams',
    'Unlimited AI match narratives',
    'Unlimited match exports',
    'Advanced analytics (coming soon)',
];

type PlanKey = 'monthly' | 'annual' | 'lifetime';

export function PaywallModal({ visible, onClose, trigger }: PaywallModalProps) {
    const { colors, radius } = useAppTheme();
    const isPro = useSubscriptionStore((s) => s.isPro);

    const [offering, setOffering] = useState<PurchasesOffering | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [loadingOfferings, setLoadingOfferings] = useState(true);

    // Fetch offerings when modal opens
    useEffect(() => {
        if (visible) {
            setLoadingOfferings(true);
            getOfferings()
                .then((off) => setOffering(off))
                .finally(() => setLoadingOfferings(false));
        }
    }, [visible]);

    // Auto-close if user becomes Pro (purchase completed elsewhere)
    useEffect(() => {
        if (isPro && visible) onClose();
    }, [isPro]);

    const getPackageForPlan = (plan: PlanKey): PurchasesPackage | undefined => {
        if (!offering) return undefined;
        // RevenueCat packages are typically named: $rc_monthly, $rc_annual, $rc_lifetime
        const packages = offering.availablePackages;
        return packages.find((p) => {
            const id = p.identifier.toLowerCase();
            if (plan === 'monthly') return id.includes('monthly') || id === '$rc_monthly';
            if (plan === 'annual') return id.includes('annual') || id.includes('yearly') || id === '$rc_annual';
            if (plan === 'lifetime') return id.includes('lifetime') || id === '$rc_lifetime';
            return false;
        });
    };

    const handlePurchase = async () => {
        const pkg = getPackageForPlan(selectedPlan);
        if (!pkg) {
            Alert.alert('Unavailable', 'This plan is not currently available. Please try another option.');
            return;
        }

        setPurchasing(true);
        try {
            const success = await purchasePackage(pkg);
            if (success) {
                Alert.alert('Welcome to Pro!', 'Your VolleyTrack Pro subscription is now active.', [
                    { text: 'OK', onPress: onClose },
                ]);
            }
        } catch (error: any) {
            Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setRestoring(true);
        try {
            const restored = await restorePurchases();
            if (restored) {
                Alert.alert('Restored!', 'Your Pro subscription has been restored.', [
                    { text: 'OK', onPress: onClose },
                ]);
            } else {
                Alert.alert('No Purchase Found', 'We could not find an active subscription for this device.');
            }
        } catch (error: any) {
            Alert.alert('Restore Failed', error.message || 'Something went wrong. Please try again.');
        } finally {
            setRestoring(false);
        }
    };

    // Use real prices from RevenueCat when available, fallback to display constants
    const getPrice = (plan: PlanKey): string => {
        const pkg = getPackageForPlan(plan);
        if (pkg) return pkg.product.priceString;
        return PRICING[plan].price;
    };

    const plans: { key: PlanKey; label: string; price: string; detail: string; badge?: string }[] = [
        { key: 'monthly', label: 'Monthly', price: getPrice('monthly'), detail: PRICING.monthly.period },
        {
            key: 'annual',
            label: 'Annual',
            price: getPrice('annual'),
            detail: PRICING.annual.period,
            badge: `Save ${PRICING.annual.savings}`,
        },
        { key: 'lifetime', label: 'Lifetime', price: getPrice('lifetime'), detail: PRICING.lifetime.period },
    ];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                    <View style={{ width: 32 }} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>VolleyTrack Pro</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <X size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Crown icon */}
                    <View style={[styles.crownContainer, { backgroundColor: colors.primaryLight }]}>
                        <Crown size={40} color={colors.primary} />
                    </View>

                    {/* Trigger message */}
                    <Text style={[styles.triggerText, { color: colors.text }]}>{TRIGGER_MESSAGES[trigger]}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Upgrade to Pro to unlock everything VolleyTrack has to offer.
                    </Text>

                    {/* Feature list */}
                    <View style={[styles.featureCard, { backgroundColor: colors.bgCard, borderRadius: radius.md }]}>
                        {PRO_FEATURES.map((feature, i) => (
                            <View key={i} style={[styles.featureRow, i < PRO_FEATURES.length - 1 && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                                <View style={[styles.checkIcon, { backgroundColor: colors.primaryLight }]}>
                                    <Check size={14} color={colors.primary} strokeWidth={3} />
                                </View>
                                <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Plan selection */}
                    {loadingOfferings ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 24 }} />
                    ) : (
                        <View style={styles.planGrid}>
                            {plans.map((plan) => {
                                const isSelected = selectedPlan === plan.key;
                                return (
                                    <TouchableOpacity
                                        key={plan.key}
                                        style={[
                                            styles.planCard,
                                            {
                                                backgroundColor: isSelected ? colors.primaryLight : colors.bgCard,
                                                borderColor: isSelected ? colors.primary : colors.border,
                                                borderRadius: radius.md,
                                            },
                                        ]}
                                        onPress={() => setSelectedPlan(plan.key)}
                                    >
                                        {plan.badge && (
                                            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                                                <Text style={styles.badgeText}>{plan.badge}</Text>
                                            </View>
                                        )}
                                        <Text style={[styles.planLabel, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                                            {plan.label}
                                        </Text>
                                        <Text style={[styles.planPrice, { color: isSelected ? colors.primary : colors.text }]}>
                                            {plan.price}
                                        </Text>
                                        <Text style={[styles.planDetail, { color: isSelected ? colors.primary : colors.textTertiary }]}>
                                            {plan.detail}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Purchase button */}
                    <TouchableOpacity
                        style={[styles.purchaseBtn, { backgroundColor: colors.primary, opacity: purchasing ? 0.6 : 1 }]}
                        onPress={handlePurchase}
                        disabled={purchasing || loadingOfferings}
                    >
                        {purchasing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Zap size={20} color="#fff" fill="#fff" />
                                <Text style={styles.purchaseBtnText}>Subscribe Now</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Restore */}
                    <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
                        {restoring ? (
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                        ) : (
                            <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore Purchases</Text>
                        )}
                    </TouchableOpacity>

                    {/* Legal */}
                    <Text style={[styles.legal, { color: colors.textTertiary }]}>
                        Payment will be charged to your Apple ID or Google Play account. Subscriptions auto-renew unless
                        cancelled at least 24 hours before the end of the current period.
                    </Text>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    crownContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 20,
    },
    triggerText: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    featureCard: {
        marginBottom: 24,
        overflow: 'hidden',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
    },
    checkIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    planGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    planCard: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderWidth: 2,
        alignItems: 'center',
        position: 'relative',
        overflow: 'visible',
    },
    badge: {
        position: 'absolute',
        top: -10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    planLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 2,
    },
    planDetail: {
        fontSize: 11,
        fontWeight: '500',
    },
    purchaseBtn: {
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 16,
    },
    purchaseBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    restoreBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 16,
    },
    restoreText: {
        fontSize: 14,
        fontWeight: '600',
    },
    legal: {
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
    },
});
