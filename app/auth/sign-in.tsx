import { useRouter } from 'expo-router';
import { Eye, EyeOff, LogIn } from 'lucide-react-native';
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
import { useSkipAuth } from '../_layout';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function SignInScreen() {
    const router = useRouter();
    const { signIn, loading, error, clearError } = useAuth();
    const { setSkipAuth } = useSkipAuth();
    const { colors, spacing, fontSize } = useAppTheme();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSignIn = async () => {
        if (!email.trim() || !password) return;
        await signIn(email.trim(), password);
    };

    const isDisabled = loading || !email.trim() || !password;

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
        skipText: {
            ...styles.skipText,
            color: colors.textTertiary,
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
                    <Text style={themedStyles.subtitle}>Sign in to sync your data across devices</Text>
                </View>

                {/* Error Banner */}
                {error && (
                    <TouchableOpacity style={themedStyles.errorBanner} onPress={clearError}>
                        <Text style={themedStyles.errorText}>{error}</Text>
                    </TouchableOpacity>
                )}

                {/* Form */}
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
                                onChangeText={(text) => { clearError(); setPassword(text); }}
                                placeholder="Enter your password"
                                placeholderTextColor={colors.placeholder}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoComplete="password"
                                returnKeyType="done"
                                onSubmitEditing={handleSignIn}
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

                    <TouchableOpacity
                        onPress={() => router.push('/auth/forgot-password')}
                        style={styles.forgotLink}
                    >
                        <Text style={themedStyles.linkText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[themedStyles.primaryBtn, isDisabled && styles.primaryBtnDisabled]}
                        onPress={handleSignIn}
                        disabled={isDisabled}
                    >
                        {loading ? (
                            <ActivityIndicator color={'#ffffff'} />
                        ) : (
                            <View style={styles.btnContent}>
                                <LogIn size={20} color={'#ffffff'} />
                                <Text style={themedStyles.primaryBtnText}>Sign In</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={themedStyles.footerText}>Don't have an account?</Text>
                    <TouchableOpacity onPress={() => router.replace('/auth/sign-up')}>
                        <Text style={themedStyles.linkText}>Sign Up</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => { setSkipAuth(true); router.replace('/'); }}
                >
                    <Text style={themedStyles.skipText}>Continue without an account</Text>
                </TouchableOpacity>
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
        marginBottom: 32,
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
    forgotLink: {
        alignSelf: 'flex-end',
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
        marginTop: 32,
    },
    footerText: {
        fontSize: 14,
    },
    skipBtn: {
        alignItems: 'center',
        marginTop: 16,
    },
    skipText: {
        fontSize: 13,
    },
});
