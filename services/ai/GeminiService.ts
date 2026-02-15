import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { AINarrative, MatchRecord, MatchState, Player, Score, StatLog, SuperFanRecap } from "../../types";
import { logger } from "../../utils/logger";

// In a real app, this should come from process.env or a secure storage
// We access the env variable exposed by Expo (prefixed with EXPO_PUBLIC_)
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string = DEFAULT_API_KEY) {
        if (!apiKey) {
            logger.error("❌ GeminiService: No API Key found!");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        // User reported this model worked previously. Quota errors may have been transient/rate-limit based.
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-001" });
    }

    private withTimeout<T>(promise: Promise<T>, ms: number = 30000): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('AI request timed out. Please try again.')), ms)
            ),
        ]);
    }

    async checkAvailableModels() {
        try {
            // Note: The Node SDK might not expose listModels directly on the main class in all versions,
            // but for debugging 404s, we can try a basic model or just log that we are attempting.
        } catch (e) {
            logger.error("Error listing models", e);
        }
    }

    private formatMatchDataForPrompt(
        state: MatchState,
        logs: StatLog[],
        scores: Score[],
        roster: any[] = [],
        context: { eventName?: string; date?: string; location?: string } = {}
    ) {
        const winner = state.setsWon.myTeam > state.setsWon.opponent ? state.myTeamName : state.opponentName;
        const scoreString = scores.map((s, i) => `Set ${i + 1}: ${s.myTeam}-${s.opponent}`).join(", ");

        // Calculate basic stats to help the AI
        const aces = logs.filter(l => l.type === 'ace' && l.team === 'myTeam').length;
        const kills = logs.filter(l => l.type === 'kill' && l.team === 'myTeam').length;
        const blocks = logs.filter(l => l.type === 'block' && l.team === 'myTeam').length;
        const errors = logs.filter(l => l.team === 'myTeam' && (l.type.includes('error'))).length;

        // Player ID Mapping Helper
        const getPlayerLabel = (id?: string) => {
            if (!id) return '';
            const player = roster.find(p => p.id === id);
            return player ? `${player.name} (#${player.jerseyNumber})` : `Player ${id.substring(0, 4)}`;
        };

        // Helper to format a single event
        const formatEvent = (l: StatLog) => {
            let playerDetail = l.team === 'myTeam' && l.playerId ? `(${getPlayerLabel(l.playerId)})` : '';
            if (l.team === 'myTeam' && l.assistPlayerId) {
                const assistLabel = getPlayerLabel(l.assistPlayerId);
                if (assistLabel) playerDetail += ` [ast: ${assistLabel.split(' ')[0]}]`;
            }
            return `${l.team === 'myTeam' ? 'MyTeam' : 'Opponent'} ${l.type} ${playerDetail}`;
        };

        // Group logs into Rallies
        let rallyCount = 0;
        let currentRallyEvents: StatLog[] = [];
        const logLines: string[] = [];

        // Sort chronologically for reconstruction
        const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
        const terminalTypes = ['kill', 'ace', 'serve_error', 'attack_error', 'dig_error', 'receive_0', 'block', 'drop', 'set_error', 'pass_error'];

        const flushRally = () => {
            if (currentRallyEvents.length === 0) return;
            rallyCount++;

            // Determine result
            const lastEvent = currentRallyEvents[currentRallyEvents.length - 1];
            const startScore = currentRallyEvents[0].scoreSnapshot;

            // Format rally header
            const servingTeam = currentRallyEvents[0].servingTeamSnapshot === 'myTeam' ? 'We Served' : 'Opp Served';
            logLines.push(`\nRALLY ${rallyCount} [Set ${lastEvent.setNumber} | ${startScore.myTeam}-${startScore.opponent} | ${servingTeam}]:`);

            // List events
            currentRallyEvents.forEach(e => {
                logLines.push(`- ${formatEvent(e)}`);
            });

            // Note the point outcome if terminal
            if (terminalTypes.includes(lastEvent.type)) {
                const isMyError = lastEvent.team === 'myTeam' && ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'].includes(lastEvent.type);
                const isOppError = lastEvent.team === 'opponent' && ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'].includes(lastEvent.type);

                let winner = 'UNKNOWN';
                if (isMyError) winner = 'OPPONENT POINT';
                else if (isOppError) winner = 'MY TEAM POINT';
                else if (lastEvent.team === 'myTeam') winner = 'MY TEAM POINT';
                else winner = 'OPPONENT POINT';

                logLines.push(`  -> RESULT: ${winner}`);
            }

            currentRallyEvents = [];
        };

        sortedLogs.forEach(l => {
            if (['timeout', 'substitution', 'rotation', 'point_adjust'].includes(l.type)) {
                flushRally();
                const time = new Date(l.timestamp).toLocaleTimeString();
                if (l.type === 'timeout') {
                    logLines.push(`\n[${time}] TIMEOUT (${l.team === 'myTeam' ? 'My Team' : 'Opponent'})`);
                } else if (l.type === 'substitution') {
                    const subDetails = l.metadata ? `(In: ${l.metadata.subInName || 'Unknown'} #${l.metadata.subInNumber || '?'}, Out: ${l.metadata.subOutName || 'Unknown'} #${l.metadata.subOutNumber || '?'})` : '';
                    logLines.push(`\n[${time}] SUBSTITUTION ${l.team === 'myTeam' ? 'MyTeam' : 'Opponent'} ${subDetails}`);
                }
            } else {
                currentRallyEvents.push(l);
                if (terminalTypes.includes(l.type)) {
                    flushRally();
                }
            }
        });
        flushRally(); // Flush any remaining

        const logSummary = logLines.join("\n");

        // Calculate Top Scorer
        const playerScores = new Map<string, number>();
        logs.filter(l => l.team === 'myTeam' && (l.type === 'kill' || l.type === 'ace' || l.type === 'block')).forEach(l => {
            if (l.playerId) playerScores.set(l.playerId, (playerScores.get(l.playerId) || 0) + 1);
        });
        const topScorerId = [...playerScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const topScorerLabel = topScorerId ? getPlayerLabel(topScorerId) : 'None';

        return `
MATCH CONTEXT:
Date: ${context.date || 'Unknown Date'}
Event: ${context.eventName || 'Unknown Event'}
Location: ${context.location || 'Unknown Location'}

MATCH SUMMARY:
My Team: ${state.myTeamName}
Opponent: ${state.opponentName}
Result: ${winner} won
Scores: ${scoreString}
Key Stats (My Team): ${aces} Aces, ${kills} Kills, ${blocks} Blocks, ${errors} Errors.
Top Scorer: ${topScorerLabel}

PLAY-BY-PLAY LOG (filtered to emphasize My Team's perspective):
${logSummary}
        `;
    }

    async generateMatchNarratives(
        state: MatchState,
        logs: StatLog[],
        scores: Score[],
        roster: any[] = [],
        matchContext: { eventName?: string; date?: string; location?: string } = {}
    ): Promise<AINarrative> {
        const promptData = this.formatMatchDataForPrompt(state, logs, scores, roster, matchContext);

        // Updated Prompts with new Persona (Analyst/Reporter)
        const analystPrompt = `
You are an expert high-performance Volleyball Consultant hired to analyze this match for the coaching staff.
The staff does NOT need a recap of what happened; they need *insights* on WHY it happened.

Your goal is to provide a "Consultant's Analyst Report" (NOT a speech).
Focus STRICTLY on "My Team". Do not hallucinate internal details about the Opponent unless clearly visible in scores.

Structure:
1. **Strategic Breakdown**: (e.g. "We struggled to sideout in Rotation 4").
2. **Key Personnel Insights**: Mention specific players by Name/Number.
3. **Critical Moments**: Identify 1-2 turning points.
4. **Actionable Recommendations**: 2 specific things to work on.
5. **Film Room**: Identify 3 specific rallies (by Set and Score) that the team should watch to learn from (e.g. "Set 2, 24-24: Failed transition").

TONE: Professional, analytical, objective, concise.
FORMAT: PLAIN TEXT ONLY. Do NOT use markdown (no **bold**, no ## headers). Do NOT use bullet points that rely on formatting. Use simple dashes or numbers.
DATA:
${promptData}
        `;

        const reporterPrompt = `
You are the "Hometown Sports Reporter" for ${state.myTeamName}. 
Write a social media ready match recap.

Guidelines:
1. **Focus**: ${state.myTeamName}'s performance.
2. **Player Shoutouts**: USE THE ROSTER NAMES.
3. **Context**: Mention event/location.
4. **Tone**: Enthusiastic, community-focused, proud. 
5. **Format**: Catchy headline, emoji-friendly.
6. **Constraint**: PLAIN TEXT ONLY. Do NOT use markdown (no *bold*, no _italics_). Do NOT use code blocks or fixed-width ASCII tables. The output must look perfect in a standard text message or Instagram caption.

DATA:
${promptData}
        `;

        return this.executeGeneration(analystPrompt, reporterPrompt);
    }

    // --- Multi-Match Analysis Helpers ---

    formatMultiMatchData(
        season: any,
        matches: MatchRecord[],
        context: { type: 'EVENT' | 'SEASON', name: string }
    ) {
        // Aggregate Stats
        const totalMatches = matches.length;
        const wins = matches.filter(m => m.result === 'Win').length;
        const losses = matches.filter(m => m.result === 'Loss').length;

        let totalAces = 0;
        let totalKills = 0;
        let totalBlocks = 0;
        let totalErrors = 0;

        // Match-by-Match Summary
        const matchSummaries = matches.map(m => {
            const mLogs = m.history || [];
            const aces = mLogs.filter(l => l.type === 'ace' && l.team === 'myTeam').length;
            const kills = mLogs.filter(l => l.type === 'kill' && l.team === 'myTeam').length;
            const blocks = mLogs.filter(l => l.type === 'block' && l.team === 'myTeam').length;
            const errors = mLogs.filter(l => l.team === 'myTeam' && l.type.includes('error')).length;

            totalAces += aces;
            totalKills += kills;
            totalBlocks += blocks;
            totalErrors += errors;

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

    async generateEventRecap(
        matches: MatchRecord[],
        season: any,
        event: any
    ): Promise<AINarrative> {
        const promptData = this.formatMultiMatchData(season, matches, { type: 'EVENT', name: event.name });

        const analystPrompt = `
You are a Volleyball Tournament Analyst.
Write a "Tournament Performance Review" for ${season.teamName} at ${event.name}.

Structure:
1. **Tournament Result**: Final record and overall impression.
2. **Highs & Lows**: Best match vs. toughest challenge.
3. **Standout Performers**: Mention players consistent across multiple matches.
4. **Key Takeaway**: One strategic lesson for the next week of practice.

TONE: Professional, constructive, forward-looking.
FORMAT: PLAIN TEXT ONLY. No markdown.
DATA:
${promptData}
        `;

        const reporterPrompt = `
You are the "Hometown Reporter" covering ${season.teamName} at the ${event.name}.
Write a social media caption summarizing the weekend!

Guidelines:
1. **Headline**: Catchy summary of the result (e.g. "Going 3-1 in Dallas!").
2. **Story**: Briefly recap the journey through the bracket/pool.
3. **Vibe**: Enthusiastic and proud.
4. **Constraint**: PLAIN TEXT ONLY. Emoji-friendly. No markdown.

DATA:
${promptData}
        `;

        return this.executeGeneration(analystPrompt, reporterPrompt);
    }

    async generateSeasonRecap(
        season: any,
        matches: MatchRecord[],
        events: any[]
    ): Promise<AINarrative> {
        const promptData = this.formatMultiMatchData(season, matches, { type: 'SEASON', name: season.teamName });

        const analystPrompt = `
You are a High-Performance Director reviewing the ENTIRE SEASON for ${season.teamName}.
Write a "End of Season Technical Review".

Structure:
1. **Season Narrative**: How did the team evolve from the first match to the last?
2. **Statistical Identity**: What was this team's biggest strength? (Serving? Attack?)
3. **Defining Moment**: The most significant win or learning experience.
4. **Player Growth**: General praise for collective improvement.
5. **Closing Thought**: Final grade on performance vs. potential.

TONE: Reflective, authoritative, inspiring.
FORMAT: PLAIN TEXT ONLY. No markdown.
DATA:
${promptData}
        `;

        const reporterPrompt = `
You are the Social Media Manager for ${season.teamName}.
Write the big "End of Season" thank you post!

Guidelines:
1. **Celebration**: Celebrate the overall record and effort.
2. **Highlights**: Mention the total wins/stats.
3. **Gratitude**: Thank the parents, fans, and coaches.
4. **Sign-off**: "Until next season!" style closing.
5. **Constraint**: PLAIN TEXT ONLY. Emoji-rich. No markdown.

DATA:
${promptData}
        `;

        return this.executeGeneration(analystPrompt, reporterPrompt);
    }

    // --- Super Fan Recap for Spectators ---

    /**
     * Generate a celebratory, family-friendly recap focused on specific player(s).
     * Designed for spectators (parents/fans) to share via text or social media.
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
        // Build player-focused data
        const selectedPlayers = selectedPlayerIds
            .map(id => roster.find(p => p.id === id))
            .filter(Boolean) as Player[];

        const playerNames = selectedPlayers.map(p => `${p.name} (#${p.jerseyNumber})`);

        // Calculate per-player stats from logs
        const playerStatsMap = selectedPlayerIds.map(pid => {
            const playerLogs = logs.filter(l => l.team === 'myTeam' && l.playerId === pid);
            const assists = logs.filter(l => l.team === 'myTeam' && l.assistPlayerId === pid);
            const player = roster.find(p => p.id === pid);

            return {
                name: player ? `${player.name} (#${player.jerseyNumber})` : 'Unknown',
                aces: playerLogs.filter(l => l.type === 'ace').length,
                kills: playerLogs.filter(l => l.type === 'kill').length,
                blocks: playerLogs.filter(l => l.type === 'block').length,
                digs: playerLogs.filter(l => l.type === 'dig').length,
                goodServes: playerLogs.filter(l => l.type === 'serve_good').length,
                goodAttacks: playerLogs.filter(l => l.type === 'attack_good').length,
                assists: assists.length,
                errors: playerLogs.filter(l => l.type.includes('error')).length,
                receptions: playerLogs.filter(l => ['receive_1', 'receive_2', 'receive_3'].includes(l.type)).length,
                perfectReceptions: playerLogs.filter(l => l.type === 'receive_3').length,
            };
        });

        const isCompleted = matchStatus === 'completed';
        const scoreString = scores.map((s, i) => `Set ${i + 1}: ${s.myTeam}-${s.opponent}`).join(", ");
        const winner = setsWon.myTeam > setsWon.opponent ? teamName : opponentName;

        const playerStatsText = playerStatsMap.map(ps =>
            `${ps.name}: ${ps.aces} Aces, ${ps.kills} Kills, ${ps.blocks} Blocks, ${ps.digs} Digs, ${ps.assists} Assists, ${ps.goodServes} Good Serves, ${ps.receptions} Receptions (${ps.perfectReceptions} perfect)`
        ).join("\n");

        const prompt = `
You are a proud, enthusiastic volleyball fan writing a celebratory match update${isCompleted ? '' : ' (match still in progress!)'} to share with family and friends.
Your focus is on celebrating ${playerNames.join(' and ')} — these are the players the fan is specifically cheering for (likely their kid or loved one).

IMPORTANT GUIDELINES:
1. TONE: Warm, celebratory, proud, family-friendly. Think "proud parent texting the grandparents".
2. Keep it SHORT — perfect for a text message or Instagram story (150-250 words max).
3. LEAD with the featured player(s) — their name should appear in the first sentence.
4. Highlight their BEST stats and moments. If stats are modest, celebrate effort, teamwork, and hustle.
5. Include the team result and score for context.
6. End with a fun, shareable sign-off.
7. Use emojis naturally but don't overdo it (3-5 total).
8. PLAIN TEXT ONLY. No markdown, no bold, no italics.
9. Do NOT invent or hallucinate specific plays not supported by the data. Stick to what the stats show.
10. If the match is still in progress, frame it as a live update rather than a final recap.

MATCH DATA:
Team: ${teamName} vs ${opponentName}
${isCompleted ? `Result: ${winner} won` : 'Status: Match in progress'}
Scores: ${scoreString}
Sets Won: ${teamName} ${setsWon.myTeam} - ${setsWon.opponent} ${opponentName}

FEATURED PLAYER STATS:
${playerStatsText}

Write the fan recap now:
        `;

        // Use the same model fallback chain
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const candidateModels = [
            "gemini-2.5-flash",
            "gemini-2.0-flash-lite-001",
            "gemini-flash-latest",
            "gemini-2.0-flash",
            "gemini-pro"
        ];

        let lastError: any = null;

        for (const modelId of candidateModels) {
            try {
                const model = this.genAI.getGenerativeModel({ model: modelId, safetySettings });
                if (lastError) await new Promise(resolve => setTimeout(resolve, 1000));

                const result = await this.withTimeout(model.generateContent(prompt));
                const recap = result.response.text();

                return {
                    playerIds: selectedPlayerIds,
                    playerNames: selectedPlayers.map(p => p.name),
                    recap,
                    generatedAt: Date.now(),
                };
            } catch (error: any) {
                logger.warn(`⚠️ Fan Recap Failed: ${modelId}`);
                lastError = error;
            }
        }

        const errorMsg = lastError?.message || "AI Generation failed";
        if (errorMsg.includes("429") || errorMsg.includes("quota")) {
            throw new AIError("AI Quota Exceeded. Please wait a minute and try again.", prompt);
        }
        throw new AIError("AI Generation failed. Please try again.", prompt);
    }

    async executeGeneration(analystPrompt: string, reporterPrompt: string): Promise<AINarrative> {
        // Shared execution logic to reuse safety settings and model fallback
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // "gemini-2.5-flash" is the user-preferred model.
        // Failures should decrease now that billing is connected.
        const candidateModels = [
            "gemini-2.5-flash",
            "gemini-2.0-flash-lite-001",
            "gemini-flash-latest",
            "gemini-2.0-flash",
            "gemini-pro"
        ];

        let lastError: any = null;

        for (const modelId of candidateModels) {
            try {
                const model = this.genAI.getGenerativeModel({ model: modelId, safetySettings });

                // Small delay to avoid hammering the API if multiple models fail fast
                if (lastError) await new Promise(resolve => setTimeout(resolve, 1000));

                const [coachResult, socialResult] = await this.withTimeout(
                    Promise.all([
                        model.generateContent(analystPrompt),
                        model.generateContent(reporterPrompt)
                    ])
                );

                return {
                    coachSummary: coachResult.response.text(),
                    socialSummary: socialResult.response.text(),
                    generatedAt: Date.now(),
                    debugPrompt: analystPrompt
                };
            } catch (error: any) {
                logger.warn(`⚠️ Failed: ${modelId}`);
                const msg = error.message || "";

                // Check specifically for Rate Limit / Quota Exceeded (429)
                if (msg.includes("429") || msg.includes("quota")) {
                    logger.error("🚫 QUOTA EXCEEDED for model:", modelId);
                }

                lastError = error;
            }
        }

        // Enhance the final error message for the user, attaching prompts for debug
        const errorMsg = lastError?.message || "AI Generation failed";

        if (errorMsg.includes("429") || errorMsg.includes("quota")) {
            throw new AIError("AI Quota Exceeded. Please wait a minute and try again.", analystPrompt);
        }

        throw new AIError("AI Generation failed. Please try again.", analystPrompt);
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
