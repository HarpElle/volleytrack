import { BlurView } from 'expo-blur';
import { Check, Sparkles, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Player } from '../types';

interface SpectatorOnboardingModalProps {
    visible: boolean;
    onComplete: (name: string, cheeringFor: string[]) => void;
    roster: Player[];
    initialName?: string;
    initialCheeringFor?: string[];
}

export function SpectatorOnboardingModal({
    visible,
    onComplete,
    roster,
    initialName = '',
    initialCheeringFor = []
}: SpectatorOnboardingModalProps) {
    const { colors, isDark } = useAppTheme();
    const [step, setStep] = useState<1 | 2>(1);
    const [name, setName] = useState(initialName);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(initialCheeringFor);

    useEffect(() => {
        if (visible) {
            setName(initialName);
            setSelectedPlayerIds(initialCheeringFor);
            setStep(1);
        }
    }, [visible, initialName, initialCheeringFor]);

    const handleNext = () => {
        if (name.trim()) {
            setStep(2);
        }
    };

    const handleFinish = () => {
        onComplete(name.trim(), selectedPlayerIds);
    };

    const togglePlayer = (playerId: string) => {
        if (selectedPlayerIds.includes(playerId)) {
            setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
        } else {
            setSelectedPlayerIds(prev => [...prev, playerId]);
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <User size={32} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Welcome, Super Fan!</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                What should we call you?
            </Text>

            {/* Quick name suggestion chips */}
            <View style={styles.nameChips}>
                {['Mom', 'Dad', 'Grandma', 'Grandpa', 'Coach Mom', 'Fan'].map((suggestion) => (
                    <TouchableOpacity
                        key={suggestion}
                        style={[
                            styles.nameChip,
                            {
                                backgroundColor: name === suggestion ? colors.primaryLight : colors.bgCard,
                                borderColor: name === suggestion ? colors.primary : colors.border,
                            },
                        ]}
                        onPress={() => setName(suggestion)}
                    >
                        <Text
                            style={[
                                styles.nameChipText,
                                { color: name === suggestion ? colors.primary : colors.textSecondary },
                            ]}
                        >
                            {suggestion}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TextInput
                style={[styles.input, {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    color: colors.text
                }]}
                placeholder="Or type your name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={handleNext}
                maxLength={20}
            />

            <TouchableOpacity
                style={[
                    styles.primaryBtn,
                    { backgroundColor: name.trim() ? colors.primary : colors.border }
                ]}
                onPress={handleNext}
                disabled={!name.trim()}
            >
                <Text style={styles.primaryBtnText}>Next</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.headerRow]}>
                <View style={[styles.iconCircleSmall, { backgroundColor: colors.primaryLight }]}>
                    <Sparkles size={20} color={colors.primary} />
                </View>
                <View>
                    <Text style={[styles.stepTitle, { color: colors.text }]}>Who are you cheering for?</Text>
                    <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                        {"We'll highlight their plays and alert you when they're on the court"}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.rosterList} contentContainerStyle={styles.rosterContent}>
                {roster.map(player => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    return (
                        <TouchableOpacity
                            key={player.id}
                            style={[
                                styles.playerCard,
                                {
                                    backgroundColor: isSelected ? colors.primaryLight : colors.bgCard,
                                    borderColor: isSelected ? colors.primary : colors.border
                                }
                            ]}
                            onPress={() => togglePlayer(player.id)}
                        >
                            <View style={[
                                styles.jerseyCircle,
                                { backgroundColor: isSelected ? colors.primary : colors.bg }
                            ]}>
                                <Text style={[
                                    styles.jerseyNumber,
                                    { color: isSelected ? '#fff' : colors.text }
                                ]}>
                                    {player.jerseyNumber}
                                </Text>
                            </View>
                            <Text style={[
                                styles.playerName,
                                { color: isSelected ? colors.primary : colors.text }
                            ]}>
                                {player.name}
                            </Text>
                            {isSelected && (
                                <View style={styles.checkIcon}>
                                    <Check size={16} color={colors.primary} />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: colors.border }]}
                    onPress={() => setStep(1)}
                >
                    <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={handleFinish}
                >
                    <Text style={styles.primaryBtnText}>
                        {selectedPlayerIds.length > 0 ? "Let's Go!" : "I'm Just Watching"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                        {step === 1 ? renderStep1() : renderStep2()}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        padding: 16,
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
    },
    card: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 10,
    },
    stepContainer: {
        width: '100%',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    iconCircleSmall: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 18,
        fontWeight: '600',
        borderWidth: 1,
        marginBottom: 24,
    },
    primaryBtn: {
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    stepSubtitle: {
        fontSize: 14,
    },
    rosterList: {
        maxHeight: 400,
    },
    rosterContent: {
        paddingBottom: 16,
        gap: 8,
    },
    playerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    jerseyCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    jerseyNumber: {
        fontSize: 14,
        fontWeight: '700',
    },
    playerName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    checkIcon: {
        marginLeft: 8,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    secondaryBtn: {
        height: 56,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    secondaryBtnText: {
        fontSize: 16,
        fontWeight: '600',
    },
    nameChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
        justifyContent: 'center',
    },
    nameChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
    },
    nameChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
