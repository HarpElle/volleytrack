import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { MatchState, Player, StatLog } from "../../types";
import { GEMINI_PARSE_TIMEOUT_MS, VOICE_STAT_VOCABULARY } from "../../constants/voice";

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
     * @returns ParsedVoiceAction[] ready for confirmation modal
     */
    async parseVoiceInput(
        transcript: string,
        roster: Player[],
        servingTeam: 'myTeam' | 'opponent',
        rallyState: 'pre-serve' | 'in-rally',
        currentScore: { myTeam: number; opponent: number },
        myTeamName: string = 'My Team',
    ): Promise<VoiceParseResult> {
        if (!transcript || transcript.trim().length === 0) {
            return { actions: [], error: 'No speech detected. Please try again.' };
        }

        const prompt = this.buildPrompt(transcript, roster, servingTeam, rallyState, currentScore, myTeamName);

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // Model fallback chain (same pattern as GeminiService)
        const candidateModels = [
            "gemini-2.5-flash",
            "gemini-2.0-flash-lite-001",
            "gemini-flash-latest",
            "gemini-2.0-flash",
        ];

        let lastError: any = null;

        for (const modelId of candidateModels) {
            try {
                const model = this.genAI.getGenerativeModel({ model: modelId, safetySettings });
                if (lastError) await new Promise(resolve => setTimeout(resolve, 500));

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
     */
    private buildPrompt(
        transcript: string,
        roster: Player[],
        servingTeam: 'myTeam' | 'opponent',
        rallyState: 'pre-serve' | 'in-rally',
        currentScore: { myTeam: number; opponent: number },
        myTeamName: string,
    ): string {
        // Build roster reference
        const rosterLines = roster.map(p =>
            `  - ID: "${p.id}", Name: "${p.name}", Jersey: #${p.jerseyNumber}, Positions: ${p.positions?.join('/') || 'unknown'}`
        ).join('\n');

        // Build vocabulary reference
        const vocabLines = Object.entries({
            ...VOICE_STAT_VOCABULARY.preServe,
            ...VOICE_STAT_VOCABULARY.inRally,
        }).map(([type, phrases]) =>
            `  "${type}": [${(phrases as string[]).map(p => `"${p}"`).join(', ')}]`
        ).join('\n');

        return `You are a volleyball stat parser. Your ONLY job is to convert a spoken rally description into a JSON array of stat actions.

MATCH CONTEXT:
- Serving Team: ${servingTeam === 'myTeam' ? myTeamName + ' (myTeam)' : 'Opponent'}
- Rally State: ${rallyState}
- Current Score: ${myTeamName} ${currentScore.myTeam} - ${currentScore.opponent} Opponent

ROSTER (My Team):
${rosterLines}

VALID STAT TYPES AND SYNONYMS:
${vocabLines}

RULES:
1. Parse the transcript into an ORDERED array of stat actions (first action first).
2. For each action, determine:
   - "type": One of the valid stat types above. Match the CLOSEST synonym.
   - "team": "myTeam" for our team's actions, "opponent" for the other team.
   - "playerId": The roster player ID if mentioned by name or jersey number. null if unclear.
   - "assistPlayerId": For kills/attacks, the setter's ID if mentioned. null otherwise.
   - "confidence": "high" if player and action are clear, "medium" if action is clear but player is ambiguous, "low" if guessing.
   - "rawFragment": The portion of the transcript this action came from.
3. Jersey numbers are MORE RELIABLE than names in noisy environments. Prefer number matches.
4. If the transcript mentions "opponent" or "they/them" actions, set team to "opponent" with playerId null.
5. If rally state is "pre-serve" and the serving team is myTeam, the first action should typically be a serve-related stat.
6. If rally state is "pre-serve" and the serving team is opponent, the first action from myTeam should typically be a receive.
7. Do NOT invent actions that weren't mentioned. Only parse what was actually said.
8. If you cannot parse ANY valid action, return an empty array [].
9. The response must be ONLY a valid JSON array — no markdown, no explanation, no code fences.

TRANSCRIPT: "${transcript}"

JSON RESPONSE:`;
    }

    /**
     * Parse the raw Gemini response text into structured actions.
     */
    private parseResponse(responseText: string, roster: Player[]): VoiceParseResult {
        try {
            // Strip any accidental markdown code fences
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
