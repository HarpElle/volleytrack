/**
 * SpectatorNamePrompt — Inline prompt at top of spectator screen
 * asking for the viewer's name on first visit. Not a modal — just
 * a gentle card that can be dismissed or submitted.
 */

import { UserCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface SpectatorNamePromptProps {
    onSubmit: (name: string) => void;
    onSkip: () => void;
}

export function SpectatorNamePrompt({ onSubmit, onSkip }: SpectatorNamePromptProps) {
    const { colors } = useAppTheme();
    const [name, setName] = useState('');

    const handleSubmit = () => {
        const trimmed = name.trim();
        if (trimmed) {
            onSubmit(trimmed);
        } else {
            onSkip();
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <View style={styles.headerRow}>
                <UserCircle size={20} color={colors.primary} />
                <Text style={[styles.title, { color: colors.primary }]}>{"Who's watching?"}</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Add your name so the coach and other fans can see you
            </Text>
            <View style={styles.inputRow}>
                <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    placeholder="Your name (e.g. Sarah's Mom)"
                    placeholderTextColor={colors.placeholder}
                    value={name}
                    onChangeText={setName}
                    maxLength={30}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    autoCapitalize="words"
                />
                <TouchableOpacity
                    style={[styles.joinBtn, { backgroundColor: name.trim() ? colors.primary : colors.buttonDisabled }]}
                    onPress={handleSubmit}
                >
                    <Text style={[styles.joinBtnText, { color: name.trim() ? '#ffffff' : colors.buttonDisabledText }]}>
                        Join
                    </Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: colors.textTertiary }]}>Watch anonymously</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 12,
        marginBottom: 10,
        lineHeight: 18,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        fontWeight: '500',
    },
    joinBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        justifyContent: 'center',
    },
    joinBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    skipBtn: {
        alignItems: 'center',
        marginTop: 8,
    },
    skipText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
