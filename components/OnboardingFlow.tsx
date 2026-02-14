/**
 * First-launch onboarding flow.
 *
 * 3 swipeable screens introducing VolleyTrack features.
 * Shows once, then persists the "seen" flag to AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Activity,
    BarChart3,
    Cloud,
    Trophy,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = 'volleytrack-onboarding-seen';

interface OnboardingProps {
    onComplete: () => void;
}

interface Slide {
    icon: React.ElementType;
    iconColor: string;
    title: string;
    description: string;
}

export function OnboardingFlow({ onComplete }: OnboardingProps) {
    const { colors, spacing, radius, brand } = useAppTheme();
    const scrollRef = useRef<ScrollView>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const slides: Slide[] = [
        {
            icon: Trophy,
            iconColor: brand.blue,
            title: 'Welcome to VolleyTrack',
            description: 'Your coaching companion for volleyball. Track scores, stats, and momentum in real time — all from the sideline.',
        },
        {
            icon: Activity,
            iconColor: '#22c55e',
            title: 'Live Match Tracking',
            description: 'Log serves, kills, blocks, and errors in just a few taps. Momentum analysis alerts you when it\'s time to call a timeout.',
        },
        {
            icon: BarChart3,
            iconColor: brand.coral,
            title: 'Seasons & Stats',
            description: 'Organize matches by season and event. View detailed player stats, match history, and AI-powered summaries.',
        },
        {
            icon: Cloud,
            iconColor: brand.blue,
            title: 'Sync Everywhere',
            description: 'Create an account to sync your data across devices. Your match data is always backed up and accessible.',
        },
    ];

    const isLastSlide = activeIndex === slides.length - 1;

    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveIndex(index);
    }, []);

    const handleNext = () => {
        if (isLastSlide) {
            markComplete();
        } else {
            scrollRef.current?.scrollTo({ x: (activeIndex + 1) * SCREEN_WIDTH, animated: true });
        }
    };

    const handleSkip = () => {
        markComplete();
    };

    const markComplete = async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        onComplete();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                bounces={false}
            >
                {slides.map((slide, index) => {
                    const Icon = slide.icon;
                    return (
                        <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
                            <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '18' }]}>
                                <Icon size={56} color={slide.iconColor} />
                            </View>
                            <Text style={[styles.title, { color: colors.text }]}>
                                {slide.title}
                            </Text>
                            <Text style={[styles.description, { color: colors.textSecondary }]}>
                                {slide.description}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Bottom Controls */}
            <View style={styles.footer}>
                {/* Page Dots */}
                <View style={styles.dots}>
                    {slides.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: i === activeIndex ? colors.primary : colors.border,
                                    width: i === activeIndex ? 24 : 8,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Buttons */}
                <View style={styles.buttonRow}>
                    {!isLastSlide && (
                        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                            <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.nextBtn,
                            {
                                backgroundColor: colors.buttonPrimary,
                                borderRadius: radius.md,
                                flex: isLastSlide ? 1 : undefined,
                            },
                        ]}
                        onPress={handleNext}
                    >
                        <Text style={[styles.nextText, { color: colors.buttonPrimaryText }]}>
                            {isLastSlide ? "Get Started" : "Next"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

/** Check if onboarding has been completed */
export async function hasSeenOnboarding(): Promise<boolean> {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'true';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 8,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 48,
        gap: 24,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    skipBtn: {
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
    },
    nextBtn: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    nextText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
