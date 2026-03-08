/**
 * SpectatorAvatar — Deterministic initial + color circle for spectators.
 *
 * Generates a consistent background color from the viewer's name using
 * a simple hash → palette index mapping. Displays the first character
 * of the name (uppercased) in a contrasting white circle.
 *
 * Sizes: 'sm' (28px, chat bubbles), 'md' (40px, lobby rows).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// 12-color palette — friendly, saturated, good white-text contrast
const AVATAR_COLORS = [
    '#e06c75', // rose
    '#e5a03e', // amber
    '#56b6c2', // teal
    '#61afef', // sky
    '#c678dd', // purple
    '#98c379', // green
    '#d19a66', // peach
    '#e36a98', // pink
    '#4db8a4', // mint
    '#7c8ff5', // periwinkle
    '#e6854a', // tangerine
    '#5fbbcf', // cyan
];

/** Deterministic hash → palette index. Stable across sessions for the same name. */
function hashName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % AVATAR_COLORS.length;
}

interface SpectatorAvatarProps {
    name: string;
    /** 'sm' = 28px (chat), 'md' = 40px (lobby). Default 'md'. */
    size?: 'sm' | 'md';
    /** If true, uses the app's primary color instead of the hashed color. */
    highlight?: boolean;
    /** Override color — mainly used when highlight is true */
    highlightColor?: string;
}

export function SpectatorAvatar({ name, size = 'md', highlight, highlightColor }: SpectatorAvatarProps) {
    const initial = useMemo(() => {
        const trimmed = name.trim();
        if (!trimmed) return '?';
        return trimmed.charAt(0).toUpperCase();
    }, [name]);

    const bgColor = useMemo(() => {
        if (highlight && highlightColor) return highlightColor;
        return AVATAR_COLORS[hashName(name)];
    }, [name, highlight, highlightColor]);

    const dim = size === 'sm' ? 28 : 40;
    const fontSize = size === 'sm' ? 13 : 17;

    return (
        <View style={[styles.circle, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bgColor }]}>
            <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    initial: {
        color: '#ffffff',
        fontWeight: '800',
    },
});
