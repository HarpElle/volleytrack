/**
 * GeminiService — Client-Side Narrative Generation Proxy
 * =======================================================
 * Sends narrative generation requests to the `generateNarrative` Firebase
 * Cloud Function, which handles Gemini API calls securely on the backend.
 *
 * This replaces the previous client-side implementation that used
 * @google/generative-ai directly with EXPO_PUBLIC_GEMINI_API_KEY.
 *
 * Public API is preserved exactly — no changes needed in calling code.
 *
 * Security: No API keys are stored or used client-side for this feature.
 * Observability: Logs timing and model metadata for every generation.
 *
 * @module GeminiService
 */

import { getFunctions, httpsCallable, HttpsCallableResult } from "firebase/functions";
import { app } from "../firebase/config";
import { AINarrative, MatchRecord, MatchState, Player, Score, StatLog, SuperFanRecap } from "../../types";
import { logger } from "../../utils/logger";

// ─── Cloud Function response shape ─────────────────────────────────────────

interface NarrativeCloudResponse {
    result: any;
    meta: {
        model: string;
        latencyMs: number;
        mode: string;
    };
    error?: string;
}

// ─── Client-side timeout ────────────────────────────────────────────────────
const CALLABLE_TIMEOUT_MS = 45000; // 45s client ceiling (function has 60s server-side)

// ─── Service ────────────────────────────────────────────────────────────────

export class GeminiService {
    private callable: ReturnType<typeof httpsCallable<any, NarrativeCloudResponse>> | null = null;

    constructor() {
        if (app) {
            try {
                const functions = getFunctions(app, "us-central1");
                this.callable = httpsCallable<any, NarrativeCloudResponse>(
                    functions,
                    "generateNarrative",
                    { timeout: CALLABLE_TIMEOUT_MS }
                );
            } catch (err) {
                logger.error("❌ GeminiService: Failed to initialize Firebase Functions callable:", err);
            }
        } else {
            logger.warn("⚠️ GeminiService: Firebase not initialized. Narrative generation unavailable.");
        }
    }

    /**
     * Generate match narratives (Coach Analyst Report + Social Media Recap).
     * Preserves the exact same signature as the original implementation.
     */
    async generateMatchNarratives(
        state: MatchState,
        logs: StatLog[],
        scores: Score[],
        roster: any[] = [],
        matchContext: { eventName?: string; date?: string; location?: string } = {}
    ): Promise<AINarrative> {
        const result = await this.callFunction({
            mode: "match",
            state: {
                myTeamName: state.myTeamName,
                opponentName: state.opponentName,
                setsWon: state.setsWon,
            },
            logs,
            scores,
            roster,
            matchContext,
        });

        return result as AINarrative;
    }

    /**
     * Generate event/tournament recap.
     */
    async generateEventRecap(
        matches: MatchRecord[],
        season: any,
        event: any
    ): Promise<AINarrative> {
        const result = await this.callFunction({
            mode: "event",
            matches: matches.map(m => ({
                opponentName: m.opponentName,
                result: m.result,
                setsWon: m.setsWon,
                history: m.history || [],
            })),
            season: {
                teamName: season.teamName,
                level: season.level,
                roster: season.roster || [],
            },
            event: { name: event.name },
        });

        return result as AINarrative;
    }

    /**
     * Generate season recap.
     */
    async generateSeasonRecap(
        season: any,
        matches: MatchRecord[],
        events: any[]
    ): Promise<AINarrative> {
        const result = await this.callFunction({
            mode: "season",
            season: {
                teamName: season.teamName,
                level: season.level,
                roster: season.roster || [],
            },
            matches: matches.map(m => ({
                opponentName: m.opponentName,
                result: m.result,
                setsWon: m.setsWon,
                history: m.history || [],
            })),
        });

        return result as AINarrative;
    }

    /**
     * Generate a celebratory, family-friendly recap focused on specific player(s).
     */
    async generateSuperFanRecap(
        teamName: string,
        opponentName: string,
        scores: Score[],
        setsWon: Score,
        logs: StatLog[],
        roster: Player[],
        selectedPlayerIds: string[],
        matchStatus: 'live' | 'between-sets' | 'completed'
    ): Promise<SuperFanRecap> {
        const result = await this.callFunction({
            mode: "superFan",
            teamName,
            opponentName,
            scores,
            setsWon,
            logs,
            roster,
            selectedPlayerIds,
            matchStatus,
        });

        return result as SuperFanRecap;
    }

    // ─── Multi-Match Data Formatter (kept for compatibility) ────────────
    // Some callers may use this directly; it's a pure utility so no migration needed.

    formatMultiMatchData(
        season: any,
        matches: MatchRecord[],
        context: { type: 'EVENT' | 'SEASON', name: string }
    ) {
        const totalMatches = matches.length;
        const wins = matches.filter(m => m.result === 'Win').length;
        const losses = matches.filter(m => m.result === 'Loss').length;

        let totalAces = 0, totalKills = 0, totalBlocks = 0, totalErrors = 0;

        const matchSummaries = matches.map(m => {
            const mLogs = m.history || [];
            const aces = mLogs.filter(l => l.type === 'ace' && l.team === 'myTeam').length;
            const kills = mLogs.filter(l => l.type === 'kill' && l.team === 'myTeam').length;
            const blocks = mLogs.filter(l => l.type === 'block' && l.team === 'myTeam').length;
            const errs = mLogs.filter(l => l.team === 'myTeam' && l.type.includes('error')).length;
            totalAces += aces; totalKills += kills; totalBlocks += blocks; totalErrors += errs;
            return `- vs ${m.opponentName} (${m.result}): ${m.setsWon.myTeam}-${m.setsWon.opponent} (Aces: ${aces}, Kills: ${kills})`;
        }).join("\n");

        return `
CONTEXT:
Type: ${context.type} Recap
Name: ${context.name}
Team: ${season.teamName} (${season.level})

OVERALL RECORD:
${wins} Wins - ${losses} Losses

CUMULATIVE STATS:
Total Aces: ${totalAces}
Total Kills: ${totalKills}
Total Blocks: ${totalBlocks}
Total Errors: ${totalErrors}

MATCH BREAKDOWN:
${matchSummaries}

ROSTER:
${season.roster.map((p: any) => `${p.name} (#${p.jerseyNumber})`).join(", ")}
        `;
    }

    // ─── Private: Call the Cloud Function ────────────────────────────────

    private async callFunction(data: any): Promise<any> {
        if (!this.callable) {
            throw new AIError(
                "Narrative generation is not available. Please check your connection.",
                JSON.stringify(data).substring(0, 200),
            );
        }

        const startTime = Date.now();

        try {
            const response: HttpsCallableResult<NarrativeCloudResponse> = await Promise.race([
                this.callable(data),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Client timeout")), CALLABLE_TIMEOUT_MS)
                ),
            ]);

            const res = response.data;
            const clientLatencyMs = Date.now() - startTime;

            // Telemetry
            logger.log(
                `📝 Narrative generated: ${clientLatencyMs}ms client | ` +
                `${res.meta.latencyMs}ms server | ` +
                `model=${res.meta.model} | mode=${res.meta.mode}`
            );

            if (res.error && !res.result) {
                throw new AIError(res.error, JSON.stringify(data).substring(0, 200));
            }

            return res.result;
        } catch (error: any) {
            const clientLatencyMs = Date.now() - startTime;
            logger.warn(`⚠️ GeminiService error (${clientLatencyMs}ms):`, error.message);

            // Map Firebase errors to user-friendly AIError
            if (error instanceof AIError) throw error;

            if (error.code === "functions/unavailable" || error.message?.includes("unavailable") ||
                error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
                throw new AIError("No connection to the server. Check your signal and try again.", "");
            }
            if (error.code === "functions/resource-exhausted" || error.message?.includes("429") || error.message?.includes("quota")) {
                throw new AIError("AI Quota Exceeded. Please wait a minute and try again.", "");
            }
            if (error.message?.includes("timeout") || error.message?.includes("Client timeout")) {
                throw new AIError("Request timed out — you may have a weak signal. Please try again.", "");
            }
            if (error.code === "functions/internal") {
                throw new AIError("Server error. Please try again later.", "");
            }

            throw new AIError("AI Generation failed. Please check your connection and try again.", "");
        }
    }
}

export class AIError extends Error {
    prompt: string;

    constructor(message: string, prompt: string) {
        super(message);
        this.prompt = prompt;
        this.name = "AIError";
    }
}
