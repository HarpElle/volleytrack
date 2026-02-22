/**
 * VolleyTrack — Rally Voice Parser Cloud Function
 * =================================================
 * Secure server-side proxy for parsing voice transcripts into structured
 * volleyball stat actions using LLM inference.
 *
 * Architecture:
 *   Client (Expo) → Firebase Callable v2 → Groq (primary) → Gemini (fallback)
 *
 * Priorities (ranked):
 *   1. Latency  (<1.5s p95, ideally <800ms)
 *   2. Security (no API keys in client bundle)
 *   3. Structured output reliability (strict JSON schema)
 *   4. Cost     (keep near-zero per rally)
 *   5. Observability (structured logging on every call)
 *
 * @module parse-rally-voice
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import OpenAI from "openai";

// ─── Secrets (set via `firebase functions:secrets:set KEY_NAME`) ─────────────
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ─── Model Configuration (easy to swap) ─────────────────────────────────────
const MODEL_CONFIG = {
  primary: {
    provider: "groq" as const,
    model: "llama-4-scout-17b-16e-instruct",      // Fast, excellent structured JSON
    baseURL: "https://api.groq.com/openai/v1",
    temperature: 0.1,
    maxTokens: 800,
    timeoutMs: 6000,
  },
  fallback: {
    provider: "gemini" as const,
    model: "gemini-2.5-flash",
    temperature: 0.1,
    maxTokens: 800,
    timeoutMs: 6000,
  },
} as const;

// ─── Input Types (mirror client-side interfaces exactly) ────────────────────

interface Player {
  id: string;
  name: string;
  jerseyNumber: string;
  positions: string[];
}

interface LineupPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  playerId: string | null;
  isLibero: boolean;
  designatedSubId?: string | null;
}

interface ParseRallyRequest {
  transcript: string;
  roster: Player[];
  servingTeam: "myTeam" | "opponent";
  rallyState: "pre-serve" | "in-rally";
  currentScore: { myTeam: number; opponent: number };
  myTeamName: string;
  currentRotation: LineupPosition[];
}

// ─── Output Types ───────────────────────────────────────────────────────────

interface ParsedAction {
  type: string;
  team: "myTeam" | "opponent";
  playerId: string | null;
  assistPlayerId: string | null;
  confidence: "high" | "medium" | "low";
  rawFragment: string;
}

interface ParseRallyResponse {
  actions: ParsedAction[];
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

// ─── Valid Stat Types (authoritative whitelist) ─────────────────────────────

const VALID_STAT_TYPES = new Set([
  "ace", "serve_error", "serve_good",
  "kill", "attack_error", "attack_good",
  "block", "dig", "dig_error",
  "set_error", "pass_error", "drop",
  "receive_0", "receive_1", "receive_2", "receive_3", "receive_error",
  "timeout", "point_adjust", "substitution",
]);

const ALLOWED_OPPONENT_TYPES = new Set(["timeout", "point_adjust"]);

// ─── JSON Schema for Structured Output ──────────────────────────────────────
// Used by both Groq (via OpenAI response_format) and Gemini (via responseSchema)

const ACTION_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    actions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: {
            type: "string" as const,
            enum: [
              "ace", "serve_good", "serve_error",
              "receive_3", "receive_2", "receive_1", "receive_error", "receive_0",
              "kill", "attack_good", "attack_error",
              "block", "dig", "dig_error",
              "set_error", "pass_error", "drop",
              "timeout", "point_adjust", "substitution",
            ],
          },
          team: { type: "string" as const, enum: ["myTeam", "opponent"] },
          playerId: { type: ["string", "null"] as any },
          assistPlayerId: { type: ["string", "null"] as any },
          confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
          rawFragment: { type: "string" as const },
        },
        required: ["type", "team", "playerId", "assistPlayerId", "confidence", "rawFragment"],
      },
    },
  },
  required: ["actions"],
};

// Gemini-flavored schema (uses SchemaType enums)
const GEMINI_RESPONSE_SCHEMA: any = {
  type: SchemaType.OBJECT,
  properties: {
    actions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            enum: [
              "ace", "serve_good", "serve_error",
              "receive_3", "receive_2", "receive_1", "receive_error", "receive_0",
              "kill", "attack_good", "attack_error",
              "block", "dig", "dig_error",
              "set_error", "pass_error", "drop",
              "timeout", "point_adjust", "substitution",
            ],
          },
          team: { type: SchemaType.STRING, enum: ["myTeam", "opponent"] },
          playerId: { type: SchemaType.STRING, nullable: true },
          assistPlayerId: { type: SchemaType.STRING, nullable: true },
          confidence: { type: SchemaType.STRING, enum: ["high", "medium", "low"] },
          rawFragment: { type: SchemaType.STRING },
        },
        required: ["type", "team", "confidence", "rawFragment"],
      },
    },
  },
  required: ["actions"],
};

// ─── Prompt Builder ─────────────────────────────────────────────────────────
// Adapted from the original client-side buildPrompt() with minor token
// efficiency improvements while preserving ALL volleyball rules exactly.

function buildPrompt(req: ParseRallyRequest): string {
  const {
    transcript, roster, servingTeam, rallyState,
    currentScore, myTeamName, currentRotation,
  } = req;

  // Separate on-court vs bench players
  const onCourtIds = new Set(
    currentRotation.filter(p => p.playerId).map(p => p.playerId as string)
  );

  const onCourtLines: string[] = [];
  const benchLines: string[] = [];

  roster.forEach(p => {
    const courtPos = currentRotation.find(pos => pos.playerId === p.id);
    const posLabel = courtPos ? ` P${courtPos.position}` : "";
    const line = `  "${p.id}" #${p.jerseyNumber} ${p.name}${posLabel}`;
    if (onCourtIds.size === 0 || onCourtIds.has(p.id)) {
      onCourtLines.push(line);
    } else {
      benchLines.push(line);
    }
  });

  let rosterSection = `ON COURT:\n${onCourtLines.join("\n")}`;
  if (benchLines.length > 0) {
    rosterSection += `\nBENCH:\n${benchLines.join("\n")}`;
  }

  // Identify server by P1 position
  const serverPos = currentRotation.find(pos => pos.position === 1);
  const serverPlayer = serverPos?.playerId
    ? roster.find(p => p.id === serverPos.playerId)
    : null;
  const serverContext =
    servingTeam === "myTeam" && serverPlayer
      ? ` (server: #${serverPlayer.jerseyNumber})`
      : "";

  // ── The Prompt ──
  // Token-efficient but preserves every volleyball rule from the original.
  return `You parse volleyball rally descriptions into JSON stat actions for ${myTeamName}.

MATCH STATE:
- Serving: ${servingTeam === "myTeam" ? myTeamName + serverContext : "Opponent"} | Rally: ${rallyState} | Score: ${currentScore.myTeam}-${currentScore.opponent}

PLAYERS (${myTeamName}):
${rosterSection}

VALID STAT TYPES — use the type string exactly:
Serve: "ace" (untouched), "serve_good" (in play), "serve_error" (net/out)
Receive: "receive_3" (perfect), "receive_2" (good), "receive_1" (poor), "receive_error" (bad, no point lost), "receive_0" (point lost to serve)
Attack: "kill" (wins point), "attack_good" (in play), "attack_error" (net/out)
Defense: "block" (wins point), "dig" (kept in play), "dig_error" (failed)
Errors: "set_error" (setting fault), "pass_error" (passing fault), "drop" (ball fell untouched)
Other: "timeout", "point_adjust" (score correction)

CRITICAL RULES:
1. ALL actions are for myTeam with a playerId from the roster — NEVER create opponent player stats.
2. The ONLY allowed opponent actions are "timeout" and "point_adjust" (no playerId). If the coach says something like "opponent serve error" or "opponent hits out", record it as { "type": "point_adjust", "team": "opponent" } since we only track our own team's individual stats.
3. SETTER-ATTACKER PATTERN: "X sets Y for a [result]" = ONE action with type based on the result (kill/attack_good/attack_error), playerId = Y (the attacker), assistPlayerId = X (the setter). A set alone without a stated attack outcome is not a recorded stat.
4. Serves can ONLY be by the P1 player when myTeam is serving.
5. Only [ON COURT] players can perform actions (except substitution).
6. Jersey numbers are more reliable than names. Prefer number matches.
7. Do NOT invent actions that weren't spoken. Return empty array if nothing valid.

Return a JSON object: { "actions": [ { "type", "team", "playerId" (or null), "assistPlayerId" (or null), "confidence" ("high"/"medium"/"low"), "rawFragment" } ] }

TRANSCRIPT: "${transcript}"`;
}

// ─── Server-Side Validation (belt-and-suspenders with client) ───────────────

function validateActions(actions: any[], roster: Player[]): ParsedAction[] {
  if (!Array.isArray(actions)) return [];

  const rosterIds = new Set(roster.map(p => p.id));

  return actions
    .map((raw: any): ParsedAction | null => {
      const type = String(raw.type || "");
      const team = raw.team === "opponent" ? "opponent" as const : "myTeam" as const;

      // Drop unrecognized stat types
      if (!VALID_STAT_TYPES.has(type)) return null;

      let playerId = raw.playerId || null;
      let assistPlayerId = raw.assistPlayerId || null;
      let finalType = type;

      // Enforce opponent constraints
      if (team === "opponent" && !ALLOWED_OPPONENT_TYPES.has(type)) {
        finalType = "point_adjust";
        playerId = null;
        assistPlayerId = null;
      }

      // Validate player IDs exist in roster
      if (playerId && !rosterIds.has(playerId)) {
        playerId = null;
      }
      if (assistPlayerId && !rosterIds.has(assistPlayerId)) {
        assistPlayerId = null;
      }

      return {
        type: finalType,
        team,
        playerId,
        assistPlayerId,
        confidence: (["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low") as "high" | "medium" | "low",
        rawFragment: String(raw.rawFragment || ""),
      };
    })
    .filter((a): a is ParsedAction => a !== null);
}

// ─── LLM Call: Groq (OpenAI-compatible) ─────────────────────────────────────

async function callGroq(
  prompt: string,
  apiKey: string,
): Promise<{ actions: any[]; tokensUsed?: number }> {
  const client = new OpenAI({
    apiKey,
    baseURL: MODEL_CONFIG.primary.baseURL,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_CONFIG.primary.timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model: MODEL_CONFIG.primary.model,
        messages: [
          { role: "system", content: "You are a volleyball stat parser. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: MODEL_CONFIG.primary.temperature,
        max_tokens: MODEL_CONFIG.primary.maxTokens,
        response_format: {
          type: "json_object" as const,
        },
      },
      { signal: controller.signal },
    );

    clearTimeout(timer);

    const text = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(text);
    const actions = Array.isArray(parsed) ? parsed : (parsed.actions || []);

    return {
      actions,
      tokensUsed: completion.usage?.total_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── LLM Call: Gemini (Fallback) ────────────────────────────────────────────

async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<{ actions: any[]; tokensUsed?: number }> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: MODEL_CONFIG.fallback.model,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: MODEL_CONFIG.fallback.temperature,
      maxOutputTokens: MODEL_CONFIG.fallback.maxTokens,
    },
  });

  // Timeout via Promise.race
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), MODEL_CONFIG.fallback.timeoutMs)
    ),
  ]);

  const text = result.response.text().trim();

  // Handle potential markdown fences
  let cleaned = text;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);
  const actions = Array.isArray(parsed) ? parsed : (parsed.actions || []);

  // Gemini doesn't expose token counts easily in this SDK version
  return { actions };
}

// ─── Input Validation ───────────────────────────────────────────────────────

function validateRequest(data: any): ParseRallyRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request body must be an object.");
  }

  const { transcript, roster, servingTeam, rallyState, currentScore, myTeamName, currentRotation } = data;

  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    throw new HttpsError("invalid-argument", "transcript must be a non-empty string.");
  }
  if (!Array.isArray(roster) || roster.length === 0) {
    throw new HttpsError("invalid-argument", "roster must be a non-empty array.");
  }
  if (!["myTeam", "opponent"].includes(servingTeam)) {
    throw new HttpsError("invalid-argument", "servingTeam must be 'myTeam' or 'opponent'.");
  }
  if (!["pre-serve", "in-rally"].includes(rallyState)) {
    throw new HttpsError("invalid-argument", "rallyState must be 'pre-serve' or 'in-rally'.");
  }
  if (!currentScore || typeof currentScore.myTeam !== "number" || typeof currentScore.opponent !== "number") {
    throw new HttpsError("invalid-argument", "currentScore must have numeric myTeam and opponent.");
  }

  return {
    transcript: transcript.trim(),
    roster,
    servingTeam,
    rallyState,
    currentScore,
    myTeamName: myTeamName || "My Team",
    currentRotation: Array.isArray(currentRotation) ? currentRotation : [],
  };
}

// ─── Cloud Function ─────────────────────────────────────────────────────────

export const parseRallyVoice = onCall(
  {
    // Region closest to US users; add more if needed
    region: "us-central1",
    // Memory: 256MB is plenty for this workload
    memory: "256MiB",
    // Timeout: 15s gives room for primary + fallback
    timeoutSeconds: 15,
    // Max concurrent: generous for match-time bursts
    maxInstances: 100,
    // Secrets this function needs access to
    secrets: [GROQ_API_KEY, GEMINI_API_KEY],
    // Enforce authentication (optional — remove if allowing anonymous)
    // enforceAppCheck: true,
  },
  async (request: CallableRequest): Promise<ParseRallyResponse> => {
    const startTime = Date.now();
    let modelUsed = "none";
    let providerUsed = "none";
    let fallbackUsed = false;
    let tokensUsed: number | undefined;

    try {
      // ── Validate Input ──
      const req = validateRequest(request.data);

      // ── Build Prompt ──
      const prompt = buildPrompt(req);

      // ── Try Primary: Groq ──
      let rawActions: any[] = [];

      try {
        const groqKey = GROQ_API_KEY.value();
        if (!groqKey) throw new Error("GROQ_API_KEY not configured");

        const groqResult = await callGroq(prompt, groqKey);
        rawActions = groqResult.actions;
        tokensUsed = groqResult.tokensUsed;
        modelUsed = MODEL_CONFIG.primary.model;
        providerUsed = MODEL_CONFIG.primary.provider;
      } catch (primaryErr: any) {
        logger.warn("Primary model (Groq) failed, falling back to Gemini", {
          error: primaryErr.message,
          latencyMs: Date.now() - startTime,
        });

        // ── Fallback: Gemini ──
        fallbackUsed = true;
        try {
          const geminiKey = GEMINI_API_KEY.value();
          if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

          const geminiResult = await callGemini(prompt, geminiKey);
          rawActions = geminiResult.actions;
          tokensUsed = geminiResult.tokensUsed;
          modelUsed = MODEL_CONFIG.fallback.model;
          providerUsed = MODEL_CONFIG.fallback.provider;
        } catch (fallbackErr: any) {
          logger.error("All models failed", {
            primaryError: (primaryErr as Error).message,
            fallbackError: fallbackErr.message,
            latencyMs: Date.now() - startTime,
          });

          const latencyMs = Date.now() - startTime;
          return {
            actions: [],
            meta: { model: "none", provider: "none", latencyMs, actionCount: 0, fallbackUsed: true },
            error: "All AI models failed. Please try again.",
          };
        }
      }

      // ── Validate Actions (server-side safety net) ──
      const validatedActions = validateActions(rawActions, req.roster);
      const latencyMs = Date.now() - startTime;

      // ── Structured Logging ──
      logger.info("Rally parsed successfully", {
        latencyMs,
        model: modelUsed,
        provider: providerUsed,
        actionCount: validatedActions.length,
        rawActionCount: rawActions.length,
        fallbackUsed,
        tokensUsed,
        transcriptLength: req.transcript.length,
        rosterSize: req.roster.length,
        uid: request.auth?.uid || "anonymous",
      });

      return {
        actions: validatedActions,
        meta: {
          model: modelUsed,
          provider: providerUsed,
          latencyMs,
          actionCount: validatedActions.length,
          fallbackUsed,
          tokensUsed,
        },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;

      // Re-throw HttpsErrors (input validation) as-is
      if (err instanceof HttpsError) {
        logger.warn("Input validation failed", { error: err.message, latencyMs });
        throw err;
      }

      // Unexpected errors
      logger.error("Unexpected error in parseRallyVoice", {
        error: err.message,
        stack: err.stack,
        latencyMs,
      });

      return {
        actions: [],
        meta: { model: modelUsed, provider: providerUsed, latencyMs, actionCount: 0, fallbackUsed },
        error: "Could not parse your input. Please try again.",
      };
    }
  },
);
