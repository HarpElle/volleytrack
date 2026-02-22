/**
 * VoiceParsingService — Client-Side Voice-to-Stat Parser
 * =======================================================
 * Sends voice transcripts to the `parseRallyVoice` Firebase Cloud Function
 * which handles LLM inference securely on the backend (Groq primary, Gemini fallback).
 *
 * This service preserves the exact same public API as the original direct-Gemini
 * implementation so that no changes are needed in hooks or UI components.
 *
 * Security: No API keys are stored or used client-side for this feature.
 * Observability: Logs timing and metadata for every parse attempt.
 *
 * @module VoiceParsingService
 */

import { getFunctions, httpsCallable, HttpsCallableResult } from "firebase/functions";
import { app } from "../firebase/config";
import { LineupPosition, Player, StatLog } from "../../types";

// ── Types (unchanged public API) ────────────────────────────────────────────

export interface ParsedVoiceAction {
    type: StatLog['type'];
    team: 'myTeam' | 'opponent';
    playerId?: string;
    playerLabel?: string;      // Display label: "#12 Sarah"
    assistPlayerId?: string;
    assistPlayerLabel?: string; // Display label: "#7 Emma"
    confidence: 'high' | 'medium' | 'low';
    rawFragment: string;       // Portion of transcript this came from
}

export interface VoiceParseResult {
    actions: ParsedVoiceAction[];
    error?: string;
}

// ── Backend response shape (from Cloud Function) ────────────────────────────

interface CloudFunctionAction {
    type: string;
    team: 'myTeam' | 'opponent';
    playerId: string | null;
    assistPlayerId: string | null;
    confidence: 'high' | 'medium' | 'low';
    rawFragment: string;
}

interface CloudFunctionResponse {
    actions: CloudFunctionAction[];
    meta: {
        model: string;
        provider: string;
        latencyMs: number;
        actionCount: number;
        fallbackUsed: boolean;
        tokensUsed?: number;
    };
    error?: string;
}

// ── Client-side timeout for the callable ────────────────────────────────────
const CALLABLE_TIMEOUT_MS = 12000; // 12s client-side ceiling (function has 15s server-side)

// ── Valid stat types whitelist (client-side safety net) ──────────────────────

const VALID_TYPES = new Set([
    'ace', 'serve_error', 'serve_good',
    'kill', 'attack_error', 'attack_good',
    'block', 'dig', 'dig_error',
    'set_error', 'pass_error', 'drop',
    'receive_0', 'receive_1', 'receive_2', 'receive_3', 'receive_error',
    'timeout', 'point_adjust', 'substitution',
]);

const ALLOWED_OPPONENT_TYPES = new Set(['timeout', 'point_adjust']);

// ── Service ─────────────────────────────────────────────────────────────────

export class VoiceParsingService {
    private callable: ReturnType<typeof httpsCallable<any, CloudFunctionResponse>> | null = null;

    constructor() {
        // Initialize the callable reference if Firebase is available
        if (app) {
            try {
                const functions = getFunctions(app, "us-central1");
                this.callable = httpsCallable<any, CloudFunctionResponse>(
                    functions,
                    "parseRallyVoice",
                    { timeout: CALLABLE_TIMEOUT_MS }
                );
            } catch (err) {
                console.error("❌ VoiceParsingService: Failed to initialize Firebase Functions callable:", err);
            }
        } else {
            console.warn("⚠️ VoiceParsingService: Firebase not initialized. Voice parsing unavailable.");
        }
    }

    /**
     * Parse a voice transcript into structured StatLog-compatible actions.
     *
     * Calls the parseRallyVoice Firebase Cloud Function, then applies
     * client-side validation and label enrichment as a safety net.
     *
     * @param transcript - Raw text from speech recognition
     * @param roster - Array of players with IDs, names, and jersey numbers
     * @param servingTeam - Who is currently serving
     * @param rallyState - Current rally phase (pre-serve or in-rally)
     * @param currentScore - Current score for context
     * @param myTeamName - Display name for the user's team
     * @param currentRotation - Current court positions (P1-P6)
     * @returns ParsedVoiceAction[] ready for confirmation modal
     */
    async parseVoiceInput(
        transcript: string,
        roster: Player[],
        servingTeam: 'myTeam' | 'opponent',
        rallyState: 'pre-serve' | 'in-rally',
        currentScore: { myTeam: number; opponent: number },
        myTeamName: string = 'My Team',
        currentRotation: LineupPosition[] = [],
    ): Promise<VoiceParseResult> {
        if (!transcript || transcript.trim().length === 0) {
            return { actions: [], error: 'No speech detected. Please try again.' };
        }

        if (!this.callable) {
            return { actions: [], error: 'Voice parsing is not available. Please check your connection.' };
        }

        const startTime = Date.now();

        try {
            // ── Call the Cloud Function ──
            const result: HttpsCallableResult<CloudFunctionResponse> = await Promise.race([
                this.callable({
                    transcript: transcript.trim(),
                    roster,
                    servingTeam,
                    rallyState,
                    currentScore,
                    myTeamName,
                    currentRotation,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Client timeout')), CALLABLE_TIMEOUT_MS)
                ),
            ]);

            const response = result.data;
            const clientLatencyMs = Date.now() - startTime;

            // ── Telemetry Logging ──
            console.log(
                `🎙️ Voice parse complete: ${clientLatencyMs}ms client | ` +
                `${response.meta.latencyMs}ms server | ` +
                `model=${response.meta.model} (${response.meta.provider}) | ` +
                `actions=${response.meta.actionCount} | ` +
                `fallback=${response.meta.fallbackUsed}` +
                (response.meta.tokensUsed ? ` | tokens=${response.meta.tokensUsed}` : '')
            );

            // ── Handle server-reported errors ──
            if (response.error && response.actions.length === 0) {
                return { actions: [], error: response.error };
            }

            // ── Client-side validation & label enrichment (safety net) ──
            const enrichedActions = this.validateAndEnrich(response.actions, roster);

            if (enrichedActions.length === 0 && response.actions.length > 0) {
                // Server returned actions but all failed client validation
                return { actions: [], error: "Couldn't identify valid actions. Try speaking more clearly." };
            }

            if (enrichedActions.length === 0) {
                return { actions: [], error: "Couldn't identify any actions. Try speaking more clearly." };
            }

            return { actions: enrichedActions };
        } catch (error: any) {
            const clientLatencyMs = Date.now() - startTime;
            console.warn(`⚠️ VoiceParsingService error (${clientLatencyMs}ms):`, error.message);

            // Map common errors to user-friendly messages
            if (error.message?.includes('timeout') || error.message?.includes('Client timeout')) {
                return { actions: [], error: 'Parsing took too long — you may have a weak signal. Try a shorter description or use manual entry.' };
            }
            if (error.code === 'functions/unavailable' || error.message?.includes('unavailable') ||
                error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
                return { actions: [], error: 'No connection to the server. Check your signal and try again, or use manual stat entry.' };
            }
            if (error.code === 'functions/resource-exhausted' || error.message?.includes('429') || error.message?.includes('quota')) {
                return { actions: [], error: 'AI is temporarily busy. Please wait a moment and try again.' };
            }
            if (error.code === 'functions/invalid-argument') {
                return { actions: [], error: error.message || 'Invalid input. Please try again.' };
            }
            if (error.code === 'functions/internal') {
                return { actions: [], error: 'Server error. Please try again, or use manual stat entry.' };
            }

            return { actions: [], error: 'Could not parse your input. Please try again or use manual entry.' };
        }
    }

    /**
     * Client-side validation and label enrichment.
     * Acts as a safety net — the server already validates, but we double-check
     * to protect against any edge cases.
     */
    private validateAndEnrich(
        rawActions: CloudFunctionAction[],
        roster: Player[],
    ): ParsedVoiceAction[] {
        if (!Array.isArray(rawActions)) return [];

        return rawActions
            .map((raw): ParsedVoiceAction | null => {
                const action: ParsedVoiceAction = {
                    type: raw.type as StatLog['type'] || 'no_play' as any,
                    team: raw.team === 'opponent' ? 'opponent' : 'myTeam',
                    playerId: raw.playerId || undefined,
                    assistPlayerId: raw.assistPlayerId || undefined,
                    confidence: raw.confidence || 'low',
                    rawFragment: raw.rawFragment || '',
                };

                // ── Constraint enforcement (safety net for LLM mistakes) ──

                // Drop actions with unrecognized stat types
                if (!VALID_TYPES.has(action.type)) {
                    return null;
                }

                // Opponent can ONLY have timeout or point_adjust
                if (action.team === 'opponent' && !ALLOWED_OPPONENT_TYPES.has(action.type)) {
                    action.type = 'point_adjust';
                    action.playerId = undefined;
                    action.assistPlayerId = undefined;
                }

                // Resolve player labels for display
                if (action.playerId) {
                    const player = roster.find(p => p.id === action.playerId);
                    if (player) {
                        action.playerLabel = `#${player.jerseyNumber} ${player.name}`;
                    } else {
                        // Player ID from LLM doesn't match roster — clear it
                        action.playerId = undefined;
                        action.confidence = 'low';
                    }
                }

                if (action.assistPlayerId) {
                    const assistPlayer = roster.find(p => p.id === action.assistPlayerId);
                    if (assistPlayer) {
                        action.assistPlayerLabel = `#${assistPlayer.jerseyNumber} ${assistPlayer.name}`;
                    } else {
                        action.assistPlayerId = undefined;
                    }
                }

                return action;
            })
            .filter((a): a is ParsedVoiceAction => a !== null);
    }
}
