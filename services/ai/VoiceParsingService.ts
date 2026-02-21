import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { LineupPosition, Player, StatLog } from "../../types";
import { GEMINI_PARSE_TIMEOUT_MS, GEMINI_PARSE_RETRY_DELAY_MS } from "../../constants/voice";

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
     *
     * Design philosophy: describe stat type MEANINGS (not trigger phrases) so Gemini
     * can leverage its own volleyball knowledge to map natural speech variations
     * (e.g. "good hit", "nice swing", "put it in play") to the correct stat type.
     * This is both more flexible AND more token-efficient than enumerating synonyms.
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

        // Build roster reference — only on-court players for compact prompt,
        // with bench players listed separately in case coach mentions a sub
        const onCourtLines: string[] = [];
        const benchLines: string[] = [];
        roster.forEach(p => {
            const courtPos = currentRotation.find(pos => pos.playerId === p.id);
            const posLabel = courtPos ? ` P${courtPos.position}` : '';
            const line = `  "${p.id}" #${p.jerseyNumber} ${p.name}${posLabel}`;
            if (onCourtIds.size === 0 || onCourtIds.has(p.id)) {
                onCourtLines.push(line);
            } else {
                benchLines.push(line);
            }
        });

        let rosterSection = `ON COURT:\n${onCourtLines.join('\n')}`;
        if (benchLines.length > 0) {
            rosterSection += `\nBENCH:\n${benchLines.join('\n')}`;
        }

        // Identify server by P1 position
        const serverPos = currentRotation.find(pos => pos.position === 1);
        const serverContext = servingTeam === 'myTeam' && serverPos?.playerId
            ? ` (server: #${roster.find(p => p.id === serverPos.playerId)?.jerseyNumber || '?'})`
            : '';

        return `You parse volleyball rally descriptions into JSON stat actions for ${myTeamName}.

MATCH STATE:
- Serving: ${servingTeam === 'myTeam' ? myTeamName + serverContext : 'Opponent'} | Rally: ${rallyState} | Score: ${currentScore.myTeam}-${currentScore.opponent}

PLAYERS (${myTeamName}):
${rosterSection}

VALID STAT TYPES — use the type string exactly:
Serve: "ace" (untouched), "serve_good" (in play), "serve_error" (net/out)
Receive: "receive_3" (perfect), "receive_2" (good), "receive_1" (poor), "receive_error" (bad, no point lost), "receive_0" (point lost to serve)
Attack: "kill" (wins point), "attack_good" (in play, no point, no error), "attack_error" (net/out)
Defense: "block" (wins point), "dig" (kept in play), "dig_error" (failed)
Errors: "set_error" (setting fault), "pass_error" (passing fault), "drop" (ball fell untouched)
Other: "timeout", "point_adjust" (score correction)

CRITICAL RULES:
1. ALL actions are for myTeam with a playerId from the roster — NEVER create opponent player stats.
2. The ONLY allowed opponent actions are "timeout" and "point_adjust" (no playerId). If the coach says something like "opponent serve error" or "opponent hits out", record it as { type: "point_adjust", team: "opponent" } since we only track our own team's individual stats.
3. SETTER-ATTACKER PATTERN: "X sets Y for a [result]" = ONE action with type based on the result (kill/attack_good/attack_error), playerId = Y (the attacker), assistPlayerId = X (the setter). A set alone without a stated attack outcome is not a recorded stat.
4. Serves can ONLY be by the P1 player when myTeam is serving.
5. Only [ON COURT] players can perform actions (except substitution).
6. Jersey numbers are more reliable than names. Prefer number matches.
7. Do NOT invent actions that weren't spoken. Return [] if nothing valid.

OUTPUT: JSON array of { "type", "team", "playerId" (or null), "assistPlayerId" (or null), "confidence" ("high"/"medium"/"low"), "rawFragment" }

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

            // Valid stat types the app supports
            const VALID_TYPES = new Set([
                'ace', 'serve_error', 'serve_good',
                'kill', 'attack_error', 'attack_good',
                'block', 'dig', 'dig_error',
                'set_error', 'pass_error', 'drop',
                'receive_0', 'receive_1', 'receive_2', 'receive_3', 'receive_error',
                'timeout', 'point_adjust', 'substitution',
            ]);

            // Only these types are allowed for opponent team
            const ALLOWED_OPPONENT_TYPES = new Set(['timeout', 'point_adjust']);

            // Validate, enforce constraints, and enrich each action
            const actions: ParsedVoiceAction[] = parsed.map((raw: any) => {
                const action: ParsedVoiceAction = {
                    type: raw.type || 'no_play',
                    team: raw.team === 'opponent' ? 'opponent' : 'myTeam',
                    playerId: raw.playerId || undefined,
                    assistPlayerId: raw.assistPlayerId || undefined,
                    confidence: raw.confidence || 'low',
                    rawFragment: raw.rawFragment || '',
                };

                // ── Constraint enforcement (safety net for LLM mistakes) ──

                // Drop actions with unrecognized stat types
                if (!VALID_TYPES.has(action.type)) {
                    action.type = 'no_play' as any;
                    return action;
                }

                // Opponent can ONLY have timeout or point_adjust — convert anything
                // else the LLM might generate (e.g., attack_error for opponent) into
                // a point_adjust since those opponent actions only affect score
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
