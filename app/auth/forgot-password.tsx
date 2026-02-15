import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useState } from 'react';
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
import { useAuth } from '../../services/firebase';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { resetPassword, loading, error, clearError } = useAuth();
    const { colors, spacing, fontSize } = useAppTheme();

    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) return;
        const success = await resetPassword(email.trim());
        if (success) setSent(true);
    };

    const isDisabled = loading || !email.trim();

    const themedStyles = {
        container: {
            ...styles.container,
            backgroundColor: colors.bg,
        },
        title: {
            ...styles.title,
            color: colors.text,
        },
        subtitle: {
            ...styles.subtitle,
            color: colors.textSecondary,
        },
        errorBanner: {
            ...styles.errorBanner,
            backgroundColor: colors.errorLight,
            borderColor: colors.error,
        },
        errorText: {
            ...styles.errorText,
            color: colors.error,
        },
        successBanner: {
            ...styles.successBanner,
            backgroundColor: colors.successLight,
            borderColor: colors.success,
        },
        successText: {
            ...styles.successText,
            color: colors.success,
        },
        label: {
            ...styles.label,
            color: colors.textSecondary,
        },
        input: {
            ...styles.input,
            backgroundColor: colors.bgCard,
            borderColor: colors.inputBorder,
            color: colors.text,
        },
        primaryBtn: {
            ...styles.primaryBtn,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
        },
        primaryBtnText: {
            ...styles.primaryBtnText,
            color: '#ffffff',
        },
    };

    return (
        <SafeAreaView style={themedStyles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inner}
            >
                {/* Back Button */}
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={24} color={colors.primary} />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={themedStyles.title}>Reset Password</Text>
                    <Text style={themedStyles.subtitle}>
                        {"Enter your email and we'll send you a link to reset your password."}
                    </Text>
                </View>

                {/* Error Banner */}
                {error && (
                    <TouchableOpacity style={themedStyles.errorBanner} onPress={clearError}>
                        <Text style={themedStyles.errorText}>{error}</Text>
                    </TouchableOpacity>
                )}

                {/* Success Message */}
                {sent && !error && (
                    <View style={themedStyles.successBanner}>
                        <Mail size={20} color={colors.success} />
                        <Text style={themedStyles.successText}>
                            {"Check your inbox! We've sent a password reset link to "}{email}{"."}
                        </Text>
                    </View>
                )}

                {/* Form */}
                {!sent && (
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={themedStyles.label}>Email</Text>
                            <TextInput
                                style={themedStyles.input}
                                value={email}
                                onChangeText={(text) => { clearError(); setEmail(text); }}
                                placeholder="you@example.com"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                returnKeyType="done"
                                onSubmitEditing={handleReset}
                                editable={!loading}
                            />
                        </View>

                        <TouchableOpacity
                            style={[themedStyles.primaryBtn, isDisabled && styles.primaryBtnDisabled]}
                            onPress={handleReset}
                            disabled={isDisabled}
                        >
                            {loading ? (
                                <ActivityIndicator color={'#ffffff'} />
                            ) : (
                                <Text style={themedStyles.primaryBtnText}>Send Reset Link</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Back to sign-in */}
                {sent && (
                    <TouchableOpacity
                        style={themedStyles.primaryBtn}
                        onPress={() => router.replace('/auth/sign-in')}
                    >
                        <Text style={themedStyles.primaryBtnText}>Back to Sign In</Text>
                    </TouchableOpacity>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    backBtn: {
        position: 'absolute',
        top: 16,
        left: 0,
        padding: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    errorBanner: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    successBanner: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    successText: {
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
    },
    primaryBtn: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnDisabled: {
        opacity: 0.5,
    },
    primaryBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
