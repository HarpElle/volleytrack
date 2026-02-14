import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, Radio } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { getLiveMatch, isValidMatchCode } from '../../services/firebase/liveMatchService';

export default function JoinMatchScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCodeChange = (text: string) => {
        // Auto-uppercase and strip non-alphanumeric chars
        const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        setCode(cleaned);
        if (error) setError(null);
    };

    const handleWatch = async () => {
        if (code.length !== 6) return;

        if (!isValidMatchCode(code)) {
            setError('Invalid code format');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await getLiveMatch(code);

            if (!result.success || !result.match) {
                setError('No match found with this code');
                setLoading(false);
                return;
            }

            if (!result.match.isActive && result.match.currentState?.status === 'completed') {
                // Allow viewing completed matches too — spectator screen handles it
            }

            setLoading(false);
            router.push(`/spectate/${code}`);
        } catch (e) {
            setError('Connection failed. Check your internet.');
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                        <ArrowLeft size={22} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Watch a Live Match</Text>
                    <View style={{ width: 22 }} />
                </View>

                <View style={styles.content}>
                    {/* Icon */}
                    <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                        <Eye size={36} color={colors.primary} />
                    </View>

                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        Enter the 6-character match code shared by the coach to watch a live match.
                    </Text>

                    {/* Code Input */}
                    <View style={styles.inputSection}>
                        <TextInput
                            style={[
                                styles.codeInput,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.bgCard,
                                    borderColor: error ? colors.opponent : (code.length === 6 ? colors.primary : colors.border),
                                },
                            ]}
                            value={code}
                            onChangeText={handleCodeChange}
                            placeholder="ABC123"
                            placeholderTextColor={colors.textTertiary}
                            maxLength={6}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            autoFocus
                            textAlign="center"
                            returnKeyType="go"
                            onSubmitEditing={handleWatch}
                        />

                        {error && (
                            <Text style={[styles.errorText, { color: colors.opponent }]}>{error}</Text>
                        )}
                    </View>

                    {/* Watch Button */}
                    <TouchableOpacity
                        style={[
                            styles.watchBtn,
                            { backgroundColor: code.length === 6 ? colors.primary : colors.buttonDisabled },
                        ]}
                        onPress={handleWatch}
                        disabled={code.length !== 6 || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                            <>
                                <Radio size={20} color={code.length === 6 ? '#ffffff' : colors.buttonDisabledText} style={{ marginRight: 8 }} />
                                <Text style={[styles.watchBtnText, { color: code.length === 6 ? '#ffffff' : colors.buttonDisabledText }]}>
                                    Watch Match
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 48,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 32,
    },
    inputSection: {
        width: '100%',
        marginBottom: 24,
        alignItems: 'center',
    },
    codeInput: {
        width: '100%',
        maxWidth: 260,
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 8,
        borderWidth: 2,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    errorText: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 8,
    },
    watchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        maxWidth: 260,
    },
    watchBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
