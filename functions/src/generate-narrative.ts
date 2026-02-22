/**
 * VolleyTrack — Narrative Generation Cloud Function
 * ===================================================
 * Secure server-side proxy for generating AI narratives (match recaps,
 * event recaps, season recaps, super fan recaps) using Gemini.
 *
 * This migrates the client-side GeminiService.ts to the backend,
 * removing the last exposed API key (EXPO_PUBLIC_GEMINI_API_KEY)
 * from the client bundle.
 *
 * Architecture:
 *   Client (Expo) → Firebase Callable v2 → Gemini 2.5 Flash (with fallback chain)
 *
 * @module generate-narrative
 */

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

// ─── Secret (shared with parse-rally-voice) ─────────────────────────────────
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ─── Model Configuration ────────────────────────────────────────────────────
const NARRATIVE_MODEL_CONFIG = {
  candidateModels: [
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-latest",
    "gemini-2.0-flash",
  ],
  retryDelayMs: 1000,
  timeoutMs: 30000,
} as const;

// ─── Safety Settings (all disabled — sports content only) ───────────────────
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface Score {
  myTeam: number;
  opponent: number;
}

interface StatLog {
  id: string;
  timestamp: number;
  type: string;
  team: "myTeam" | "opponent";
  scoreSnapshot: Score;
  setNumber: number;
  playerId?: string;
  assistPlayerId?: string;
  metadata?: Record<string, any>;
  rallyStateSnapshot?: "pre-serve" | "in-rally";
  servingTeamSnapshot?: "myTeam" | "opponent";
}

interface Player {
  id: string;
  name: string;
  jerseyNumber: string;
  positions: string[];
}

// Request types for each narrative mode
interface MatchNarrativeRequest {
  mode: "match";
  state: {
    myTeamName: string;
    opponentName: string;
    setsWon: Score;
  };
  logs: StatLog[];
  scores: Score[];
  roster: Player[];
  matchContext?: { eventName?: string; date?: string; location?: string };
}

interface EventRecapRequest {
  mode: "event";
  matches: Array<{
    opponentName: string;
    result: string;
    setsWon: Score;
    history: StatLog[];
  }>;
  season: {
    teamName: string;
    level: string;
    roster: Player[];
  };
  event: {
    name: string;
  };
}

interface SeasonRecapRequest {
  mode: "season";
  season: {
    teamName: string;
    level: string;
    roster: Player[];
  };
  matches: Array<{
    opponentName: string;
    result: string;
    setsWon: Score;
    history: StatLog[];
  }>;
}

interface SuperFanRecapRequest {
  mode: "superFan";
  teamName: string;
  opponentName: string;
  scores: Score[];
  setsWon: Score;
  logs: StatLog[];
  roster: Player[];
  selectedPlayerIds: string[];
  matchStatus: "live" | "between-sets" | "completed";
}

type NarrativeRequest =
  | MatchNarrativeRequest
  | EventRecapRequest
  | SeasonRecapRequest
  | SuperFanRecapRequest;

interface NarrativeResponse {
  result: any;  // Shape depends on mode
  meta: {
    model: string;
    latencyMs: number;
    mode: string;
  };
  error?: string;
}

// ─── Prompt Helpers (migrated from client-side GeminiService.ts) ────────────

function getPlayerLabel(id: string | undefined, roster: Player[]): string {
  if (!id) return "";
  const player = roster.find(p => p.id === id);
  return player ? `${player.name} (#${player.jerseyNumber})` : `Player ${id.substring(0, 4)}`;
}

function formatMatchDataForPrompt(
  state: { myTeamName: string; opponentName: string; setsWon: Score },
  logs: StatLog[],
  scores: Score[],
  roster: Player[],
  context: { eventName?: string; date?: string; location?: string } = {},
): string {
  const winner = state.setsWon.myTeam > state.setsWon.opponent ? state.myTeamName : state.opponentName;
  const scoreString = scores.map((s, i) => `Set ${i + 1}: ${s.myTeam}-${s.opponent}`).join(", ");

  const aces = logs.filter(l => l.type === "ace" && l.team === "myTeam").length;
  const kills = logs.filter(l => l.type === "kill" && l.team === "myTeam").length;
  const blocks = logs.filter(l => l.type === "block" && l.team === "myTeam").length;
  const errors = logs.filter(l => l.team === "myTeam" && l.type.includes("error")).length;

  const formatEvent = (l: StatLog) => {
    let playerDetail = l.team === "myTeam" && l.playerId ? `(${getPlayerLabel(l.playerId, roster)})` : "";
    if (l.team === "myTeam" && l.assistPlayerId) {
      const assistLabel = getPlayerLabel(l.assistPlayerId, roster);
      if (assistLabel) playerDetail += ` [ast: ${assistLabel.split(" ")[0]}]`;
    }
    return `${l.team === "myTeam" ? "MyTeam" : "Opponent"} ${l.type} ${playerDetail}`;
  };

  // Group logs into rallies
  let rallyCount = 0;
  let currentRallyEvents: StatLog[] = [];
  const logLines: string[] = [];
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const terminalTypes = ["kill", "ace", "serve_error", "attack_error", "dig_error", "receive_0", "block", "drop", "set_error", "pass_error"];

  const flushRally = () => {
    if (currentRallyEvents.length === 0) return;
    rallyCount++;
    const lastEvent = currentRallyEvents[currentRallyEvents.length - 1];
    const startScore = currentRallyEvents[0].scoreSnapshot;
    const servingTeam = currentRallyEvents[0].servingTeamSnapshot === "myTeam" ? "We Served" : "Opp Served";

    logLines.push(`\nRALLY ${rallyCount} [Set ${lastEvent.setNumber} | ${startScore.myTeam}-${startScore.opponent} | ${servingTeam}]:`);
    currentRallyEvents.forEach(e => logLines.push(`- ${formatEvent(e)}`));

    if (terminalTypes.includes(lastEvent.type)) {
      const isMyError = lastEvent.team === "myTeam" && ["serve_error", "attack_error", "dig_error", "receive_0", "set_error", "pass_error", "drop"].includes(lastEvent.type);
      const isOppError = lastEvent.team === "opponent" && ["serve_error", "attack_error", "dig_error", "receive_0", "set_error", "pass_error", "drop"].includes(lastEvent.type);
      let resultWinner = "UNKNOWN";
      if (isMyError) resultWinner = "OPPONENT POINT";
      else if (isOppError) resultWinner = "MY TEAM POINT";
      else if (lastEvent.team === "myTeam") resultWinner = "MY TEAM POINT";
      else resultWinner = "OPPONENT POINT";
      logLines.push(`  -> RESULT: ${resultWinner}`);
    }
    currentRallyEvents = [];
  };

  sortedLogs.forEach(l => {
    if (["timeout", "substitution", "rotation", "point_adjust"].includes(l.type)) {
      flushRally();
      const time = new Date(l.timestamp).toLocaleTimeString();
      if (l.type === "timeout") {
        logLines.push(`\n[${time}] TIMEOUT (${l.team === "myTeam" ? "My Team" : "Opponent"})`);
      } else if (l.type === "substitution") {
        const subDetails = l.metadata ? `(In: ${l.metadata.subInName || "Unknown"} #${l.metadata.subInNumber || "?"}, Out: ${l.metadata.subOutName || "Unknown"} #${l.metadata.subOutNumber || "?"})` : "";
        logLines.push(`\n[${time}] SUBSTITUTION ${l.team === "myTeam" ? "MyTeam" : "Opponent"} ${subDetails}`);
      }
    } else {
      currentRallyEvents.push(l);
      if (terminalTypes.includes(l.type)) flushRally();
    }
  });
  flushRally();

  // Top scorer
  const playerScores = new Map<string, number>();
  logs.filter(l => l.team === "myTeam" && (l.type === "kill" || l.type === "ace" || l.type === "block")).forEach(l => {
    if (l.playerId) playerScores.set(l.playerId, (playerScores.get(l.playerId) || 0) + 1);
  });
  const topScorerId = [...playerScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topScorerLabel = topScorerId ? getPlayerLabel(topScorerId, roster) : "None";

  const contextLines: string[] = [];
  if (context.date) contextLines.push(`Date: ${context.date}`);
  if (context.eventName) contextLines.push(`Event: ${context.eventName}`);
  if (context.location) contextLines.push(`Location: ${context.location}`);
  const contextBlock = contextLines.length > 0 ? `MATCH CONTEXT:\n${contextLines.join("\n")}\n` : "";

  return `
${contextBlock}
MATCH SUMMARY:
My Team: ${state.myTeamName}
Opponent: ${state.opponentName}
Result: ${winner} won
Scores: ${scoreString}
Key Stats (My Team): ${aces} Aces, ${kills} Kills, ${blocks} Blocks, ${errors} Errors.
Top Scorer: ${topScorerLabel}

PLAY-BY-PLAY LOG (filtered to emphasize My Team's perspective):
${logLines.join("\n")}
  `;
}

function formatMultiMatchData(
  season: { teamName: string; level: string; roster: Player[] },
  matches: Array<{ opponentName: string; result: string; setsWon: Score; history: StatLog[] }>,
  context: { type: "EVENT" | "SEASON"; name: string },
): string {
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.result === "Win").length;
  const losses = matches.filter(m => m.result === "Loss").length;

  let totalAces = 0, totalKills = 0, totalBlocks = 0, totalErrors = 0;

  const matchSummaries = matches.map(m => {
    const mLogs = m.history || [];
    const aces = mLogs.filter(l => l.type === "ace" && l.team === "myTeam").length;
    const kills = mLogs.filter(l => l.type === "kill" && l.team === "myTeam").length;
    const blocks = mLogs.filter(l => l.type === "block" && l.team === "myTeam").length;
    const errs = mLogs.filter(l => l.team === "myTeam" && l.type.includes("error")).length;
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

/**
 * Strip placeholder text the LLM may have included despite instructions.
 */
function stripPlaceholders(text: string): string {
  return text
    .replace(/\b(at|the|in|from)\s+Unknown\s+(Event|Location|Date|Venue)\b/gi, "")
    .replace(/\bUnknown\s+(Event|Location|Date|Venue)\b/gi, "")
    .replace(/\[Event\s*Name\]/gi, "")
    .replace(/\[Location\]/gi, "")
    .replace(/\[Date\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Prompt Builders for Each Mode ──────────────────────────────────────────

function buildMatchNarrativePrompts(req: MatchNarrativeRequest): { analyst: string; reporter: string } {
  const promptData = formatMatchDataForPrompt(req.state, req.logs, req.scores, req.roster, req.matchContext);

  const analyst = `
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
IMPORTANT: Do NOT use placeholder text like "Unknown Event", "Unknown Location", "Unknown Date", or "[Event Name]". If event, location, or date information is not provided in the data, simply omit any references to it.
DATA:
${promptData}
  `;

  const reporter = `
You are the "Hometown Sports Reporter" for ${req.state.myTeamName}.
Write a social media ready match recap.

Guidelines:
1. **Focus**: ${req.state.myTeamName}'s performance.
2. **Player Shoutouts**: USE THE ROSTER NAMES.
3. **Context**: Mention event/location.
4. **Tone**: Enthusiastic, community-focused, proud.
5. **Format**: Catchy headline, emoji-friendly.
6. **Constraint**: PLAIN TEXT ONLY. Do NOT use markdown (no *bold*, no _italics_). Do NOT use code blocks or fixed-width ASCII tables. The output must look perfect in a standard text message or Instagram caption.
7. **No Placeholders**: Do NOT use placeholder text like "Unknown Event", "Unknown Location", or "[Event Name]". If event or location info is not provided, simply omit references to it.

DATA:
${promptData}
  `;

  return { analyst, reporter };
}

function buildEventRecapPrompts(req: EventRecapRequest): { analyst: string; reporter: string } {
  const promptData = formatMultiMatchData(req.season, req.matches, { type: "EVENT", name: req.event.name });

  const analyst = `
You are a Volleyball Tournament Analyst.
Write a "Tournament Performance Review" for ${req.season.teamName} at ${req.event.name}.

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

  const reporter = `
You are the "Hometown Reporter" covering ${req.season.teamName} at the ${req.event.name}.
Write a social media caption summarizing the weekend!

Guidelines:
1. **Headline**: Catchy summary of the result (e.g. "Going 3-1 in Dallas!").
2. **Story**: Briefly recap the journey through the bracket/pool.
3. **Vibe**: Enthusiastic and proud.
4. **Constraint**: PLAIN TEXT ONLY. Emoji-friendly. No markdown.

DATA:
${promptData}
  `;

  return { analyst, reporter };
}

function buildSeasonRecapPrompts(req: SeasonRecapRequest): { analyst: string; reporter: string } {
  const promptData = formatMultiMatchData(req.season, req.matches, { type: "SEASON", name: req.season.teamName });

  const analyst = `
You are a High-Performance Director reviewing the ENTIRE SEASON for ${req.season.teamName}.
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

  const reporter = `
You are the Social Media Manager for ${req.season.teamName}.
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

  return { analyst, reporter };
}

function buildSuperFanRecapPrompt(req: SuperFanRecapRequest): string {
  const selectedPlayers = req.selectedPlayerIds
    .map(id => req.roster.find(p => p.id === id))
    .filter(Boolean) as Player[];

  const playerNames = selectedPlayers.map(p => `${p.name} (#${p.jerseyNumber})`);

  const playerStatsMap = req.selectedPlayerIds.map(pid => {
    const playerLogs = req.logs.filter(l => l.team === "myTeam" && l.playerId === pid);
    const assists = req.logs.filter(l => l.team === "myTeam" && l.assistPlayerId === pid);
    const player = req.roster.find(p => p.id === pid);
    return {
      name: player ? `${player.name} (#${player.jerseyNumber})` : "Unknown",
      aces: playerLogs.filter(l => l.type === "ace").length,
      kills: playerLogs.filter(l => l.type === "kill").length,
      blocks: playerLogs.filter(l => l.type === "block").length,
      digs: playerLogs.filter(l => l.type === "dig").length,
      goodServes: playerLogs.filter(l => l.type === "serve_good").length,
      goodAttacks: playerLogs.filter(l => l.type === "attack_good").length,
      assists: assists.length,
      errors: playerLogs.filter(l => l.type.includes("error")).length,
      receptions: playerLogs.filter(l => ["receive_1", "receive_2", "receive_3"].includes(l.type)).length,
      perfectReceptions: playerLogs.filter(l => l.type === "receive_3").length,
    };
  });

  const isCompleted = req.matchStatus === "completed";
  const scoreString = req.scores.map((s, i) => `Set ${i + 1}: ${s.myTeam}-${s.opponent}`).join(", ");
  const winner = req.setsWon.myTeam > req.setsWon.opponent ? req.teamName : req.opponentName;

  const playerStatsText = playerStatsMap.map(ps =>
    `${ps.name}: ${ps.aces} Aces, ${ps.kills} Kills, ${ps.blocks} Blocks, ${ps.digs} Digs, ${ps.assists} Assists, ${ps.goodServes} Good Serves, ${ps.receptions} Receptions (${ps.perfectReceptions} perfect)`
  ).join("\n");

  return `
You are a proud, enthusiastic volleyball fan writing a celebratory match update${isCompleted ? "" : " (match still in progress!)"} to share with family and friends.
Your focus is on celebrating ${playerNames.join(" and ")} — these are the players the fan is specifically cheering for (likely their kid or loved one).

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
Team: ${req.teamName} vs ${req.opponentName}
${isCompleted ? `Result: ${winner} won` : "Status: Match in progress"}
Scores: ${scoreString}
Sets Won: ${req.teamName} ${req.setsWon.myTeam} - ${req.setsWon.opponent} ${req.opponentName}

FEATURED PLAYER STATS:
${playerStatsText}

Write the fan recap now:
  `;
}

// ─── Gemini Call with Model Fallback Chain ───────────────────────────────────

async function callGeminiWithFallback(
  apiKey: string,
  prompts: string[],
  timeoutMs: number = NARRATIVE_MODEL_CONFIG.timeoutMs,
): Promise<{ texts: string[]; model: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  for (const modelId of NARRATIVE_MODEL_CONFIG.candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings: SAFETY_SETTINGS });

      if (lastError) {
        await new Promise(resolve => setTimeout(resolve, NARRATIVE_MODEL_CONFIG.retryDelayMs));
      }

      // Race all prompts in parallel against timeout
      const results = await Promise.race([
        Promise.all(prompts.map(p => model.generateContent(p))),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Narrative generation timeout")), timeoutMs)
        ),
      ]);

      const texts = results.map(r => r.response.text());
      return { texts, model: modelId };
    } catch (error: any) {
      logger.warn(`Narrative model ${modelId} failed: ${error.message}`);
      lastError = error;
    }
  }

  const errorMsg = lastError?.message || "AI Generation failed";
  if (errorMsg.includes("429") || errorMsg.includes("quota")) {
    throw new HttpsError("resource-exhausted", "AI Quota Exceeded. Please wait a minute and try again.");
  }
  throw new HttpsError("internal", "AI Generation failed after all model attempts. Please try again.");
}

// ─── Input Validation ───────────────────────────────────────────────────────

function validateNarrativeRequest(data: any): NarrativeRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request body must be an object.");
  }

  const { mode } = data;
  if (!["match", "event", "season", "superFan"].includes(mode)) {
    throw new HttpsError("invalid-argument", "mode must be 'match', 'event', 'season', or 'superFan'.");
  }

  // Mode-specific validation
  switch (mode) {
    case "match":
      if (!data.state?.myTeamName || !data.state?.opponentName) {
        throw new HttpsError("invalid-argument", "Match narrative requires state with myTeamName and opponentName.");
      }
      if (!Array.isArray(data.scores)) {
        throw new HttpsError("invalid-argument", "Match narrative requires scores array.");
      }
      break;
    case "event":
      if (!data.season?.teamName || !data.event?.name) {
        throw new HttpsError("invalid-argument", "Event recap requires season.teamName and event.name.");
      }
      break;
    case "season":
      if (!data.season?.teamName) {
        throw new HttpsError("invalid-argument", "Season recap requires season.teamName.");
      }
      break;
    case "superFan":
      if (!data.teamName || !Array.isArray(data.selectedPlayerIds) || data.selectedPlayerIds.length === 0) {
        throw new HttpsError("invalid-argument", "Super fan recap requires teamName and selectedPlayerIds.");
      }
      break;
  }

  return data as NarrativeRequest;
}

// ─── Cloud Function ─────────────────────────────────────────────────────────

export const generateNarrative = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,        // Narratives can take longer (2 parallel Gemini calls)
    maxInstances: 50,
    secrets: [GEMINI_API_KEY],
  },
  async (request: CallableRequest): Promise<NarrativeResponse> => {
    const startTime = Date.now();
    let modelUsed = "none";

    try {
      const req = validateNarrativeRequest(request.data);
      const apiKey = GEMINI_API_KEY.value();

      if (!apiKey) {
        throw new HttpsError("failed-precondition", "GEMINI_API_KEY not configured.");
      }

      let result: any;

      switch (req.mode) {
        case "match": {
          const prompts = buildMatchNarrativePrompts(req);
          const { texts, model } = await callGeminiWithFallback(apiKey, [prompts.analyst, prompts.reporter]);
          modelUsed = model;
          result = {
            coachSummary: stripPlaceholders(texts[0]),
            socialSummary: stripPlaceholders(texts[1]),
            generatedAt: Date.now(),
          };
          break;
        }
        case "event": {
          const prompts = buildEventRecapPrompts(req);
          const { texts, model } = await callGeminiWithFallback(apiKey, [prompts.analyst, prompts.reporter]);
          modelUsed = model;
          result = {
            coachSummary: stripPlaceholders(texts[0]),
            socialSummary: stripPlaceholders(texts[1]),
            generatedAt: Date.now(),
          };
          break;
        }
        case "season": {
          const prompts = buildSeasonRecapPrompts(req);
          const { texts, model } = await callGeminiWithFallback(apiKey, [prompts.analyst, prompts.reporter]);
          modelUsed = model;
          result = {
            coachSummary: stripPlaceholders(texts[0]),
            socialSummary: stripPlaceholders(texts[1]),
            generatedAt: Date.now(),
          };
          break;
        }
        case "superFan": {
          const prompt = buildSuperFanRecapPrompt(req);
          const { texts, model } = await callGeminiWithFallback(apiKey, [prompt]);
          modelUsed = model;

          const selectedPlayers = req.selectedPlayerIds
            .map(id => req.roster.find(p => p.id === id))
            .filter(Boolean) as Player[];

          result = {
            playerIds: req.selectedPlayerIds,
            playerNames: selectedPlayers.map(p => p.name),
            recap: texts[0],
            generatedAt: Date.now(),
          };
          break;
        }
      }

      const latencyMs = Date.now() - startTime;

      logger.info("Narrative generated successfully", {
        mode: req.mode,
        model: modelUsed,
        latencyMs,
        uid: request.auth?.uid || "anonymous",
      });

      return {
        result,
        meta: { model: modelUsed, latencyMs, mode: req.mode },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;

      if (err instanceof HttpsError) {
        logger.warn("Narrative generation failed", { error: err.message, latencyMs });
        throw err;
      }

      logger.error("Unexpected error in generateNarrative", {
        error: err.message,
        stack: err.stack,
        latencyMs,
      });

      return {
        result: null,
        meta: { model: modelUsed, latencyMs, mode: request.data?.mode || "unknown" },
        error: "AI Generation failed. Please try again.",
      };
    }
  },
);
