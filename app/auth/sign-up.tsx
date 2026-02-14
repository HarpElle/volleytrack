import { useRouter } from 'expo-router';
import { Eye, EyeOff, UserPlus } from 'lucide-react-native';
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

export default function SignUpScreen() {
    const router = useRouter();
    const { signUp, loading, error, clearError } = useAuth();
    const { colors, spacing, fontSize } = useAppTheme();

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSignUp = async () => {
        setLocalError(null);

        if (!email.trim() || !password) return;

        if (password.length < 6) {
            setLocalError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setLocalError('Passwords do not match.');
            return;
        }

        await signUp(email.trim(), password, displayName.trim() || undefined);
    };

    const displayError = localError || error;
    const isDisabled = loading || !email.trim() || !password || !confirmPassword;

    const themedStyles = {
        container: {
            ...styles.container,
            backgroundColor: colors.bg,
        },
        appName: {
            ...styles.appName,
            color: colors.primary,
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
        linkText: {
            ...styles.linkText,
            color: colors.primary,
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
        footerText: {
            ...styles.footerText,
            color: colors.textSecondary,
        },
    };

    return (
        <SafeAreaView style={themedStyles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inner}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={themedStyles.appName}>VolleyTrack</Text>
                    <Text style={themedStyles.subtitle}>Create an account to back up and sync your data</Text>
                </View>

                {/* Error Banner */}
                {displayError && (
                    <TouchableOpacity style={themedStyles.errorBanner} onPress={() => { clearError(); setLocalError(null); }}>
                        <Text style={themedStyles.errorText}>{displayError}</Text>
                    </TouchableOpacity>
                )}

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={themedStyles.label}>Name (optional)</Text>
                        <TextInput
                            style={themedStyles.input}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Coach Smith"
                            placeholderTextColor={colors.placeholder}
                            autoCapitalize="words"
                            autoComplete="name"
                            returnKeyType="next"
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={themedStyles.label}>Email</Text>
                        <TextInput
                            style={themedStyles.input}
                            value={email}
                            onChangeText={(text) => { clearError(); setLocalError(null); setEmail(text); }}
                            placeholder="you@example.com"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            returnKeyType="next"
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={themedStyles.label}>Password</Text>
                        <View style={styles.passwordRow}>
                            <TextInput
                                style={[themedStyles.input, styles.passwordInput]}
                                value={password}
                                onChangeText={(text) => { clearError(); setLocalError(null); setPassword(text); }}
                                placeholder="At least 6 characters"
                                placeholderTextColor={colors.placeholder}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoComplete="new-password"
                                returnKeyType="next"
                                editable={!loading}
                            />
                            <TouchableOpacity
                                style={styles.eyeBtn}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                {showPassword
                                    ? <EyeOff size={20} color={colors.textTertiary} />
                                    : <Eye size={20} color={colors.textTertiary} />
                                }
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={themedStyles.label}>Confirm Password</Text>
                        <TextInput
                            style={themedStyles.input}
                            value={confirmPassword}
                            onChangeText={(text) => { setLocalError(null); setConfirmPassword(text); }}
                            placeholder="Re-enter your password"
                            placeholderTextColor={colors.placeholder}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="new-password"
                            returnKeyType="done"
                            onSubmitEditing={handleSignUp}
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[themedStyles.primaryBtn, isDisabled && styles.primaryBtnDisabled]}
                        onPress={handleSignUp}
                        disabled={isDisabled}
                    >
                        {loading ? (
                            <ActivityIndicator color={'#ffffff'} />
                        ) : (
                            <View style={styles.btnContent}>
                                <UserPlus size={20} color={'#ffffff'} />
                                <Text style={themedStyles.primaryBtnText}>Create Account</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={themedStyles.footerText}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => router.replace('/auth/sign-in')}>
                        <Text style={themedStyles.linkText}>Sign In</Text>
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
    inner: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
    },
    appName: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
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
    form: {
        gap: 14,
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
    passwordRow: {
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 50,
    },
    eyeBtn: {
        position: 'absolute',
        right: 16,
        top: 14,
    },
    linkText: {
        fontWeight: '600',
        fontSize: 14,
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
    btnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    primaryBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 28,
    },
    footerText: {
        fontSize: 14,
    },
});
