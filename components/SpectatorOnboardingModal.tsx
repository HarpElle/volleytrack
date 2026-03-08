import { Check, Sparkles, User } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
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

const MAX_CHEERING_FOR = 3;

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
    const { colors, radius } = useAppTheme();
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
        setStep(2);
    };

    const handleFinish = () => {
        onComplete(name.trim() || 'Fan', selectedPlayerIds);
    };

    const togglePlayer = (playerId: string) => {
        if (selectedPlayerIds.includes(playerId)) {
            setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
        } else if (selectedPlayerIds.length < MAX_CHEERING_FOR) {
            setSelectedPlayerIds(prev => [...prev, playerId]);
        }
    };

    // Build contextual name suggestions based on selected players
    const nameSuggestions = useMemo(() => {
        if (selectedPlayerIds.length === 1) {
            const player = roster.find(p => p.id === selectedPlayerIds[0]);
            const firstName = player?.name?.split(' ')[0] || 'Player';
            return [
                `${firstName}'s Mom`,
                `${firstName}'s Dad`,
                `${firstName}'s Grandma`,
                `${firstName}'s Grandpa`,
                'Fan',
            ];
        }
        // Multiple players or no players — use generic labels
        return ['Mom', 'Dad', 'Grandma', 'Grandpa', 'Fan'];
    }, [selectedPlayerIds, roster]);

    // Step 1: Player selection (NEW — was step 2)
    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Sparkles size={32} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Who are you cheering for?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {"Select up to 3 players — we'll highlight their plays and alert you when they're on the court"}
            </Text>

            <ScrollView style={styles.rosterList} contentContainerStyle={styles.rosterContent}>
                {roster.map(player => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    const isDisabled = !isSelected && selectedPlayerIds.length >= MAX_CHEERING_FOR;
                    return (
                        <TouchableOpacity
                            key={player.id}
                            style={[
                                styles.playerCard,
                                {
                                    backgroundColor: isSelected ? colors.primaryLight : colors.bgCard,
                                    borderColor: isSelected ? colors.primary : colors.border,
                                    opacity: isDisabled ? 0.5 : 1,
                                }
                            ]}
                            onPress={() => togglePlayer(player.id)}
                            disabled={isDisabled}
                        >
                            <View style={[
                                styles.jerseyCircle,
                                { backgroundColor: isSelected ? colors.primary : colors.bg }
                            ]}>
                                <Text style={[
                                    styles.jerseyNumber,
                                    { color: isSelected ? colors.buttonPrimaryText : colors.text }
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

            {selectedPlayerIds.length >= MAX_CHEERING_FOR && (
                <Text style={[styles.maxNote, { color: colors.textTertiary }]}>
                    Maximum {MAX_CHEERING_FOR} players selected
                </Text>
            )}

            <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleNext}
            >
                <Text style={[styles.primaryBtnText, { color: colors.buttonPrimaryText }]}>
                    {selectedPlayerIds.length > 0 ? 'Next' : "I'm Just Watching"}
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Step 2: Name entry with contextual suggestions (NEW — was step 1)
    const renderStep2 = () => {
        const selectedNames = selectedPlayerIds
            .map(id => roster.find(p => p.id === id)?.name?.split(' ')[0])
            .filter(Boolean);
        const cheeringText = selectedNames.length > 0
            ? `Cheering for ${selectedNames.join(' & ')}`
            : '';

        return (
            <View style={styles.stepContainer}>
                <View style={[styles.headerRow]}>
                    <View style={[styles.iconCircleSmall, { backgroundColor: colors.primaryLight }]}>
                        <User size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.stepTitle, { color: colors.text }]}>What should we call you?</Text>
                        {cheeringText ? (
                            <Text style={[styles.stepSubtitle, { color: colors.primary }]}>
                                {cheeringText}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Quick name suggestion chips */}
                <View style={styles.nameChips}>
                    {nameSuggestions.map((suggestion) => (
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
                    returnKeyType="done"
                    onSubmitEditing={handleFinish}
                    maxLength={20}
                />

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
                        <Text style={[styles.primaryBtnText, { color: colors.buttonPrimaryText }]}>Let's Go!</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow, borderRadius: radius.xl }]}>
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
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 21,
    },
    input: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 18,
        fontWeight: '600',
        borderWidth: 1,
        marginBottom: 20,
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
        fontWeight: '600',
        marginTop: 2,
    },
    rosterList: {
        maxHeight: 350,
    },
    rosterContent: {
        paddingBottom: 12,
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
    maxNote: {
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
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
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    nameChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
