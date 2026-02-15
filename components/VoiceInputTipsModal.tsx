import { CheckCircle, ChevronLeft, ChevronRight, Clock, Mic, Users } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────────────

interface TipSlide {
    icon: React.ElementType;
    iconColor: string;
    title: string;
    description: string;
    example: string;
}

interface VoiceInputTipsModalProps {
    visible: boolean;
    onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function VoiceInputTipsModal({ visible, onClose }: VoiceInputTipsModalProps) {
    const { colors, radius } = useAppTheme();
    const scrollRef = useRef<ScrollView>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const slides: TipSlide[] = [
        {
            icon: Mic,
            iconColor: '#3B82F6', // Blue
            title: 'Speak Naturally',
            description: 'Describe what happened like you\'d tell an assistant coach. Use jersey numbers or player names.',
            example: '"Number 3 killed it" or "Sarah with the ace"',
        },
        {
            icon: Clock,
            iconColor: '#22C55E', // Green
            title: 'Keep It Short',
            description: 'Record 1-3 actions at a time for the best accuracy. Short, clear descriptions work best.',
            example: '"Number 5 passed it, 7 set, 12 got the kill"',
        },
        {
            icon: Users,
            iconColor: '#F59E0B', // Amber
            title: 'Numbers Are Best',
            description: 'Jersey numbers are most reliable, especially in noisy gyms. Names work too — you can mix both.',
            example: '"Number 2 passed to Sarah, Casey killed it"',
        },
        {
            icon: CheckCircle,
            iconColor: '#8B5CF6', // Purple
            title: 'Review Before Logging',
            description: 'Every voice entry shows a confirmation screen first. Check the parsed actions, edit or remove any mistakes.',
            example: 'Low-confidence items will be flagged for your review',
        },
    ];

    const isLastSlide = activeIndex === slides.length - 1;

    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentWidth = SCREEN_WIDTH - 48; // Account for modal padding
        const index = Math.round(e.nativeEvent.contentOffset.x / contentWidth);
        setActiveIndex(index);
    }, []);

    const handleNext = () => {
        if (isLastSlide) {
            onClose();
        } else {
            const contentWidth = SCREEN_WIDTH - 48;
            scrollRef.current?.scrollTo({ x: (activeIndex + 1) * contentWidth, animated: true });
        }
    };

    const handleBack = () => {
        if (activeIndex > 0) {
            const contentWidth = SCREEN_WIDTH - 48;
            scrollRef.current?.scrollTo({ x: (activeIndex - 1) * contentWidth, animated: true });
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <View style={[styles.card, { backgroundColor: colors.bg, borderRadius: radius.lg || 24 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: colors.primary }]}>Voice Input Tips</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Slides */}
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={handleScroll}
                        bounces={false}
                        style={styles.scrollView}
                    >
                        {slides.map((slide, index) => {
                            const Icon = slide.icon;
                            const contentWidth = SCREEN_WIDTH - 48;
                            return (
                                <View key={index} style={[styles.slide, { width: contentWidth }]}>
                                    {/* Icon */}
                                    <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '18' }]}>
                                        <Icon size={40} color={slide.iconColor} />
                                    </View>

                                    {/* Title & Description */}
                                    <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
                                    <Text style={[styles.description, { color: colors.textSecondary }]}>{slide.description}</Text>

                                    {/* Example */}
                                    <View style={[styles.exampleBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                        <Text style={[styles.exampleLabel, { color: colors.primary }]}>EXAMPLE</Text>
                                        <Text style={[styles.exampleText, { color: colors.text }]}>{slide.example}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        {/* Dots */}
                        <View style={styles.dots}>
                            {slides.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        {
                                            backgroundColor: i === activeIndex ? colors.primary : colors.border,
                                            width: i === activeIndex ? 20 : 8,
                                        },
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Navigation */}
                        <View style={styles.navRow}>
                            <TouchableOpacity
                                onPress={handleBack}
                                disabled={activeIndex === 0}
                                style={{ opacity: activeIndex === 0 ? 0 : 1 }}
                            >
                                <ChevronLeft size={22} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.nextBtn, { backgroundColor: colors.buttonPrimary || colors.primary }]}
                                onPress={handleNext}
                            >
                                <Text style={[styles.nextBtnText, { color: colors.buttonPrimaryText || '#fff' }]}>
                                    {isLastSlide ? 'Got It!' : 'Next'}
                                </Text>
                                {!isLastSlide && <ChevronRight size={16} color={colors.buttonPrimaryText || '#fff'} />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        maxHeight: '80%',
        paddingTop: 20,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    skipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollView: {
        flexGrow: 0,
    },
    slide: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        gap: 12,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    exampleBox: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    exampleLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    exampleText: {
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    footer: {
        paddingHorizontal: 24,
        gap: 16,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    nextBtnText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
