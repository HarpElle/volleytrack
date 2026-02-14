import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CapabilitiesTour } from '../components/CapabilitiesTour';
import { useAppTheme } from '../contexts/ThemeContext';

export default function CapabilitiesTourScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CapabilitiesTour onClose={() => router.back()} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
