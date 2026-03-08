/**
 * SpectatorQuickGuide — Overlay that appears above the bottom bar
 * explaining the key actions using the same icons as the UI.
 *
 * Shows once on first visit (remembered via AsyncStorage).
 * Can also be triggered on-demand via the Help (?) button.
 * Auto-dismisses after 10 seconds or on tap.
 *
 * Visual: semi-transparent backdrop fades in first, then the card
 * slides up from the bottom — giving it a clear layered feel.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertTriangle, Heart, HelpCircle, Star, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

const STORAGE_KEY = 'volleytrack-spectator-seen-guide';
const AUTO_DISMISS_MS = 15000;

interface GuideItem {
    icon: React.ReactNode;
    label: string;
}

interface SpectatorQuickGuideProps {
    /** Should be set to true once the onboarding modal finishes */
    onboardingComplete: boolean;
    /** When true, show the guide regardless of AsyncStorage "seen" flag */
    forceShow?: boolean;
    /** Called when the guide is dismissed (used with forceShow) */
    onDismiss?: () => void;
}

export function SpectatorQuickGuide({ onboardingComplete, forceShow, onDismiss }: SpectatorQuickGuideProps) {
    const { colors } = useAppTheme();
    const [visible, setVisible] = useState(false);
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(200)).current;
    const cardOpacityAnim = useRef(new Animated.Value(0)).current;
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const GUIDE_ITEMS: GuideItem[] = [
        { icon: <Users size={18} color={colors.textSecondary} />, label: "See who's watching" },
        { icon: <Heart size={18} color={colors.error} />, label: 'Cheer \u00B7 long-press for more reactions' },
        { icon: <AlertTriangle size={18} color={colors.warning} />, label: 'Alert the coach' },
        { icon: <Star size={18} color={colors.primary} />, label: 'Fan Recap (after match ends)' },
        { icon: <HelpCircle size={18} color={colors.textTertiary} />, label: 'Show this guide again' },
    ];

    const showGuide = useCallback(() => {
        setVisible(true);
        // Backdrop fades in first
        Animated.timing(backdropAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            // Then card slides up
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 12,
                }),
                Animated.timing(cardOpacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        });

        // Auto-dismiss after timeout
        dismissTimerRef.current = setTimeout(() => {
            handleDismiss();
        }, AUTO_DISMISS_MS);
    }, []);

    // First-time auto-show after onboarding
    useEffect(() => {
        if (!onboardingComplete) return;

        const checkIfSeen = async () => {
            const seen = await AsyncStorage.getItem(STORAGE_KEY);
            if (seen) return;
            setTimeout(() => showGuide(), 600);
        };

        checkIfSeen();

        return () => {
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        };
    }, [onboardingComplete]);

    // Force-show via Help button (bypasses AsyncStorage)
    useEffect(() => {
        if (forceShow && !visible) {
            showGuide();
        }
    }, [forceShow]);

    const handleDismiss = useCallback(() => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        AsyncStorage.setItem(STORAGE_KEY, 'true');

        // Card slides down + fades, then backdrop fades out
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 200,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(cardOpacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            Animated.timing(backdropAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start(() => {
                setVisible(false);
                onDismiss?.();
            });
        });
    }, [onDismiss]);

    if (!visible) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Backdrop */}
            <Animated.View
                style={[
                    styles.backdrop,
                    { opacity: backdropAnim },
                ]}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={handleDismiss}
                />
            </Animated.View>

            {/* Card */}
            <Animated.View
                style={[
                    styles.cardContainer,
                    {
                        transform: [{ translateY: slideAnim }],
                        opacity: cardOpacityAnim,
                    },
                ]}
                pointerEvents="box-none"
            >
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Your Fan Toolkit</Text>

                    {GUIDE_ITEMS.map((item) => (
                        <View key={item.label} style={styles.row}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.bg }]}>
                                {item.icon}
                            </View>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.gotItBtn, { backgroundColor: colors.primary }]}
                        onPress={handleDismiss}
                    >
                        <Text style={styles.gotItText}>Got it!</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 799,
    },
    cardContainer: {
        position: 'absolute',
        bottom: 70, // Just above the reaction bar
        left: 16,
        right: 16,
        zIndex: 800,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    gotItBtn: {
        marginTop: 14,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    gotItText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
