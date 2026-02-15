import {
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Hand,
    LayoutDashboard,
    Mic,
    Trophy,
    Zap
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

interface Slide {
    icon: React.ElementType;
    iconColor: string;
    title: string;
    description: string;
    proTip?: string;
}

interface CapabilitiesTourProps {
    onClose: () => void;
}

export function CapabilitiesTour({ onClose }: CapabilitiesTourProps) {
    const { colors, radius } = useAppTheme();
    const scrollRef = useRef<ScrollView>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const slides: Slide[] = [
        {
            icon: Hand,
            iconColor: colors.primary,
            title: 'The Basics: Score Tracking',
            description: 'Tap the score to add a point. Swipe down to add, swipe up to subtract.',
            proTip: 'Long-press any score to manually edit it if you make a mistake.',
        },
        {
            icon: LayoutDashboard,
            iconColor: '#22c55e', // Success Green
            title: 'Level Up: Game Management',
            description: 'Track rotations, substitutions, and timeouts to keep your team organized.',
            proTip: 'Tap "Subs" to quickly swap players or assign a Libero tracker.',
        },
        {
            icon: Zap,
            iconColor: '#eab308', // Yellow/Gold
            title: 'Key Stats: Serves & Aces',
            description: 'Start simple by tracking just serves. Log Aces and Errors with a single tap.',
            proTip: 'Long-press "Serve" or "Receive" buttons to quickly log an error.',
        },
        {
            icon: BarChart3,
            iconColor: '#ef4444', // Red/Coral
            title: 'Power User: Full Analysis',
            description: 'Track every touch: Kills, Digs, Blocks, and Assists. Get deep insights like Sideout % and Earned Points.',
            proTip: 'Select multiple players in the rotation view for precise assist & kill tracking.',
        },
        {
            icon: Mic,
            iconColor: '#f59e0b', // Amber
            title: 'Voice Input: Hands-Free Tracking',
            description: 'Tap the mic and speak your rally actions. Say "number 3 with the kill" and VolleyTrack logs it for you.',
            proTip: 'Speak clearly, use jersey numbers, and keep recordings to 1-3 actions for best results. Pro feature with 3 free matches to try!',
        },
    ];

    const isLastSlide = activeIndex === slides.length - 1;

    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveIndex(index);
    }, []);

    const handleNext = () => {
        if (isLastSlide) {
            onClose();
        } else {
            scrollRef.current?.scrollTo({ x: (activeIndex + 1) * SCREEN_WIDTH, animated: true });
        }
    };

    const handleBack = () => {
        if (activeIndex > 0) {
            scrollRef.current?.scrollTo({ x: (activeIndex - 1) * SCREEN_WIDTH, animated: true });
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={[styles.closeText, { color: colors.textSecondary }]}>Close</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                bounces={false}
                style={{ flex: 1 }}
            >
                {slides.map((slide, index) => {
                    const Icon = slide.icon;
                    return (
                        <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
                            <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '20' }]}>
                                <Icon size={64} color={slide.iconColor} />
                            </View>

                            <Text style={[styles.title, { color: colors.text }]}>
                                {slide.title}
                            </Text>

                            <Text style={[styles.description, { color: colors.textSecondary }]}>
                                {slide.description}
                            </Text>

                            {slide.proTip && (
                                <View style={[styles.proTipContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                        <Trophy size={16} color={colors.primary} />
                                        <Text style={[styles.proTipLabel, { color: colors.primary }]}>PRO TIP</Text>
                                    </View>
                                    <Text style={[styles.proTipText, { color: colors.text }]}>
                                        {slide.proTip}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
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

                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        onPress={handleBack}
                        disabled={activeIndex === 0}
                        style={[styles.navBtn, { opacity: activeIndex === 0 ? 0 : 1 }]}
                    >
                        <ChevronLeft size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.nextBtn,
                            {
                                backgroundColor: colors.buttonPrimary,
                                borderRadius: radius.md,
                            },
                        ]}
                        onPress={handleNext}
                    >
                        <Text style={[styles.nextText, { color: colors.buttonPrimaryText }]}>
                            {isLastSlide ? "Done" : "Next"}
                        </Text>
                        {!isLastSlide && <ChevronRight size={18} color={colors.buttonPrimaryText} />}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        alignItems: 'flex-end',
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 16,
        fontWeight: '600',
    },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 40,
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
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 17,
        textAlign: 'center',
        lineHeight: 26,
        paddingHorizontal: 8,
        marginBottom: 32,
    },
    proTipContainer: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    proTipLabel: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    proTipText: {
        fontSize: 15,
        lineHeight: 22,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
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
        marginTop: 8,
    },
    navBtn: {
        padding: 12,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 28,
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
