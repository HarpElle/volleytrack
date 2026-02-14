import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppTheme, ThemeContext } from '../contexts/ThemeContext';

interface Props {
    children: ReactNode;
    onReturnHome: () => void;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

/**
 * Error boundary wrapping the live match screen.
 * If a rendering crash occurs mid-match, this catches it and shows
 * a recovery UI. Match data is safe in Zustand/AsyncStorage —
 * the coach can resume from the dashboard.
 */
export class MatchErrorBoundary extends Component<Props, State> {
    static contextType = ThemeContext;
    context!: AppTheme | null;

    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message || 'Unknown error' };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // In production, this is where you'd send to a crash reporting service
        console.error('MatchErrorBoundary caught:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, errorMessage: '' });
    };

    render() {
        if (this.state.hasError) {
            const colors = this.context?.colors;

            return (
                <SafeAreaView style={[styles.container, colors && { backgroundColor: colors.bg }]}>
                    <View style={styles.content}>
                        <Text style={styles.icon}>⚠️</Text>
                        <Text style={[styles.title, colors && { color: colors.text }]}>Something went wrong</Text>
                        <Text style={[styles.message, colors && { color: colors.textSecondary }]}>
                            Don't worry — your match data is saved.
                            You can resume from the dashboard.
                        </Text>
                        <TouchableOpacity style={[styles.retryBtn, colors && { backgroundColor: colors.primary }]} onPress={this.handleRetry}>
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.homeBtn, colors && { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={this.props.onReturnHome}>
                            <Text style={[styles.homeText, colors && { color: colors.text }]}>Return to Dashboard</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    icon: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    retryBtn: {
        backgroundColor: '#0066cc',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 12,
        width: '100%',
        alignItems: 'center',
    },
    retryText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    homeBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        width: '100%',
        alignItems: 'center',
    },
    homeText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
});
