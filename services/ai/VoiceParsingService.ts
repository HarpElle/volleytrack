import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { LineupPosition, Player, StatLog } from "../../types";
import { GEMINI_PARSE_TIMEOUT_MS, GEMINI_PARSE_RETRY_DELAY_MS, VOICE_STAT_VOCABULARY } from "../../constants/voice";

const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Service ──────────────────────────────────────────────────────────────────

export class VoiceParsingService {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string = DEFAULT_API_KEY) {
        if (!apiKey) {
            console.error("❌ VoiceParsingService: No API Key found!");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * Parse a voice transcript into structured StatLog-compatible actions.
     *
     * @param transcript - Raw text from speech recognition
     * @param roster - Array of players with IDs, names, and jersey numbers
     * @param servingTeam - Who is currently serving
     * @param rallyState - Current rally phase (pre-serve or in-rally)
     * @param currentScore - Current score for context
     * @param myTeamName - Display name for the user's team
     * @param currentRotation - Current court positions (P1-P6) to distinguish on-court vs bench players
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

        const prompt = this.buildPrompt(transcript, roster, servingTeam, rallyState, currentScore, myTeamName, currentRotation);

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // Model fallback chain — prioritize speed over reasoning depth for voice parsing
        // gemini-2.0-flash is fastest for structured JSON output tasks
        const candidateModels = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite-001",
            "gemini-flash-latest",
        ];

        let lastError: any = null;

        for (const modelId of candidateModels) {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: modelId,
                    safetySettings,
                    generationConfig: {
                        responseMimeType: 'application/json',
                    },
                });
                if (lastError) await new Promise(resolve => setTimeout(resolve, GEMINI_PARSE_RETRY_DELAY_MS));

                // Race against timeout
                const result = await Promise.race([
                    model.generateContent(prompt),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Parse timeout')), GEMINI_PARSE_TIMEOUT_MS)
                    ),
                ]);

                const responseText = result.response.text().trim();
                return this.parseResponse(responseText, roster);
            } catch (error: any) {
                console.warn(`⚠️ VoiceParsingService: ${modelId} failed:`, error.message);
                lastError = error;
            }
        }

        // All models failed
        const errorMsg = lastError?.message || 'Unknown error';
        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
            return { actions: [], error: 'AI is temporarily busy. Please wait a moment and try again.' };
        }
        if (errorMsg.includes('timeout') || errorMsg.includes('Parse timeout')) {
            return { actions: [], error: 'Parsing took too long. Try a shorter description.' };
        }

        return { actions: [], error: 'Could not parse your input. Please try again.' };
    }

    /**
     * Build the Gemini prompt with all necessary context.
     * Optimized for speed: only includes rally-state-relevant vocabulary and court lineup.
     */
    private buildPrompt(
        transcript: string,
        roster: Player[],
        servingTeam: 'myTeam' | 'opponent',
        rallyState: 'pre-serve' | 'in-rally',
        currentScore: { myTeam: number; opponent: number },
        myTeamName: string,
        currentRotation: LineupPosition[],
    ): string {
        // Determine which players are on court vs bench
        const onCourtIds = new Set(
            currentRotation
                .filter(pos => pos.playerId)
                .map(pos => pos.playerId as string)
        );

        // Build roster reference with court/bench status
        const rosterLines = roster.map(p => {
            const courtStatus = onCourtIds.size > 0
                ? (onCourtIds.has(p.id) ? '[ON COURT]' : '[BENCH]')
                : '';
            const courtPos = currentRotation.find(pos => pos.playerId === p.id);
            const posLabel = courtPos ? ` P${courtPos.position}` : '';
            return `  - ID: "${p.id}", Name: "${p.name}", Jersey: #${p.jerseyNumber}${posLabel} ${courtStatus}`;
        }).join('\n');

        // Only include vocabulary relevant to current rally state (reduces prompt size)
        const relevantVocab = rallyState === 'pre-serve'
            ? VOICE_STAT_VOCABULARY.preServe
            : VOICE_STAT_VOCABULARY.inRally;

        // Always include a few cross-phase types that can appear in either state
        const crossPhaseTypes: Record<string, string[]> = {};
        if (rallyState === 'pre-serve') {
            // During pre-serve, also include kill/attack in case coach describes a full rally
            if (VOICE_STAT_VOCABULARY.inRally.kill) crossPhaseTypes.kill = VOICE_STAT_VOCABULARY.inRally.kill;
            if (VOICE_STAT_VOCABULARY.inRally.attack_error) crossPhaseTypes.attack_error = VOICE_STAT_VOCABULARY.inRally.attack_error;
            if (VOICE_STAT_VOCABULARY.inRally.block) crossPhaseTypes.block = VOICE_STAT_VOCABULARY.inRally.block;
        } else {
            // During in-rally, also include serve types in case coach starts from serve
            if (VOICE_STAT_VOCABULARY.preServe.ace) crossPhaseTypes.ace = VOICE_STAT_VOCABULARY.preServe.ace;
            if (VOICE_STAT_VOCABULARY.preServe.serve_error) crossPhaseTypes.serve_error = VOICE_STAT_VOCABULARY.preServe.serve_error;
        }

        const vocabLines = Object.entries({ ...relevantVocab, ...crossPhaseTypes })
            .map(([type, phrases]) =>
                `  "${type}": [${(phrases as string[]).map(p => `"${p}"`).join(', ')}]`
            ).join('\n');

        return `You are a volleyball stat parser. Convert a spoken rally description into a JSON array of stat actions.

CONTEXT:
- Serving: ${servingTeam === 'myTeam' ? myTeamName + ' (myTeam)' : 'Opponent'}
- Rally: ${rallyState}
- Score: ${myTeamName} ${currentScore.myTeam}-${currentScore.opponent}

ROSTER (${myTeamName}):
${rosterLines}

STAT TYPES:
${vocabLines}

RULES:
1. Return an ORDERED JSON array of stat actions.
2. Each action: { "type", "team" ("myTeam"/"opponent"), "playerId" (or null), "assistPlayerId" (or null), "confidence" ("high"/"medium"/"low"), "rawFragment" }
3. Jersey numbers are MORE RELIABLE than names. Prefer number matches.
4. Players marked [ON COURT] are more likely to be referenced than [BENCH] players.
5. "opponent"/"they"/"them" actions → team: "opponent", playerId: null.
6. Do NOT invent actions not mentioned. Return [] if nothing valid.

TRANSCRIPT: "${transcript}"`;
    }

    /**
     * Parse the raw Gemini response text into structured actions.
     */
    private parseResponse(responseText: string, roster: Player[]): VoiceParseResult {
        try {
            // Strip any accidental markdown code fences (shouldn't happen with JSON mode, but safe)
            let cleaned = responseText;
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed)) {
                return { actions: [], error: 'Unexpected response format. Please try again.' };
            }

            if (parsed.length === 0) {
                return { actions: [], error: "Couldn't identify any actions. Try speaking more clearly." };
            }

            // Validate and enrich each action
            const actions: ParsedVoiceAction[] = parsed.map((raw: any) => {
                const action: ParsedVoiceAction = {
                    type: raw.type || 'no_play',
                    team: raw.team === 'opponent' ? 'opponent' : 'myTeam',
                    playerId: raw.playerId || undefined,
                    assistPlayerId: raw.assistPlayerId || undefined,
                    confidence: raw.confidence || 'low',
                    rawFragment: raw.rawFragment || '',
                };

                // Resolve player labels for display
                if (action.playerId) {
                    const player = roster.find(p => p.id === action.playerId);
                    if (player) {
                        action.playerLabel = `#${player.jerseyNumber} ${player.name}`;
                    } else {
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
            }).filter((a: ParsedVoiceAction) => a.type !== 'no_play');

            return { actions };
        } catch (e) {
            console.error('VoiceParsingService: JSON parse failed:', e, 'Response:', responseText);
            return { actions: [], error: 'Failed to understand the response. Please try again.' };
        }
    }
}
