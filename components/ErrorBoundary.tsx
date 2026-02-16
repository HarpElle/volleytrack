import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Root-level error boundary that catches unhandled JS errors and shows a
 * user-friendly fallback screen instead of a white-screen crash.
 *
 * In __DEV__ mode it also displays the error message and stack for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <View style={styles.container}>
                <Text style={styles.emoji}>:(</Text>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.subtitle}>
                    VolleyTrack ran into an unexpected error. Please try again.
                </Text>

                <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>

                {__DEV__ && this.state.error && (
                    <ScrollView style={styles.devInfo}>
                        <Text style={styles.devText}>
                            {this.state.error.toString()}
                            {'\n\n'}
                            {this.state.error.stack}
                        </Text>
                    </ScrollView>
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 32,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 16,
        color: '#64748B',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    devInfo: {
        marginTop: 24,
        maxHeight: 200,
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: 8,
        padding: 12,
    },
    devText: {
        color: '#F87171',
        fontSize: 12,
        fontFamily: 'monospace',
    },
});
