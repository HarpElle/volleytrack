// ── Voice Input Feature Configuration ────────────────────────────────────────
// Master feature flag — set to false to completely hide all voice input UI
export const VOICE_INPUT_ENABLED = true;

// ── Free Tier Limits ─────────────────────────────────────────────────────────
// Free users get 3 voice-enabled matches. Once voice is used in a match,
// unlimited voice entries within that match. Pro users get unlimited.
export const FREE_VOICE_MATCH_LIMIT = 3;

// ── Recording Configuration ──────────────────────────────────────────────────
// Maximum recording duration in milliseconds (30 seconds)
export const VOICE_RECORDING_MAX_MS = 30000;

// Auto-stop after N ms of silence (handled by native speech recognizer)
export const VOICE_SILENCE_TIMEOUT_MS = 2000;

// ── Gemini Parsing Configuration ─────────────────────────────────────────────
// Timeout for the Gemini API call to parse voice transcript (reduced for real-time responsiveness)
export const GEMINI_PARSE_TIMEOUT_MS = 8000;
// Delay between model fallback retries (ms)
export const GEMINI_PARSE_RETRY_DELAY_MS = 200;

// ── UI Constants ─────────────────────────────────────────────────────────────
export const VOICE_COLORS = {
    idle: '#3B82F6',       // Blue — mic button default
    recording: '#EF4444',  // Red — actively recording
    parsing: '#F59E0B',    // Amber — waiting for Gemini
    success: '#22C55E',    // Green — successfully parsed
    error: '#EF4444',      // Red — error state
};

// AsyncStorage key for first-time tips flag
export const VOICE_TIPS_SEEN_KEY = 'volleytrack-voice-tips-seen';

// ── Valid Stat Types for Voice Parsing ────────────────────────────────────────
// Reference vocabulary for each stat type. No longer sent to Gemini — the prompt
// now describes type MEANINGS so Gemini can leverage its own volleyball knowledge.
// Retained for documentation and potential future use (e.g., local fallback parser).
export const VOICE_STAT_VOCABULARY = {
    preServe: {
        ace: ['ace', 'service ace', 'aced', 'untouched serve'],
        serve_good: ['good serve', 'serve in', 'serve good', 'in play'],
        serve_error: ['serve error', 'missed serve', 'service error', 'serve out', 'into the net'],
        receive_3: ['perfect pass', '3 pass', 'three pass', 'perfect receive'],
        receive_2: ['good pass', '2 pass', 'two pass', 'decent pass'],
        receive_1: ['poor pass', '1 pass', 'one pass', 'bad pass', 'shank'],
        receive_error: ['receive error no point', 'shanked it', 'bad receive'],
        receive_0: ['receive error point', 'aced', 'pass error point'],
    },
    inRally: {
        kill: ['kill', 'killed it', 'put away', 'smash', 'spike', 'terminated', 'winner'],
        attack_good: ['good attack', 'hit in play', 'attack good', 'tip', 'roll shot'],
        attack_error: ['attack error', 'hit out', 'hit into the net', 'attack out', 'swing error'],
        block: ['block', 'stuff block', 'stuffed', 'roof', 'rejection'],
        dig: ['dig', 'good dig', 'dug it', 'saved it', 'defense'],
        dig_error: ['dig error', 'missed dig'],
        set_error: ['set error', 'bad set', 'double contact', 'setting error', 'lift'],
        pass_error: ['pass error', 'passing error'],
        drop: ['drop', 'ball dropped', 'ball fell', 'let it drop', 'miscommunication'],
    },
};

// ── Live Narration (Gemini Flash Live streaming) ─────────────────────────────

// Master feature flag for Live Narrate mode
// Set to false to hide the Live Narrate button entirely
export const VOICE_LIVE_NARRATION_ENABLED = true;

// Gemini Flash Live model identifier — check for newer version at implementation time
export const GEMINI_LIVE_MODEL = 'models/gemini-2.0-flash-live-001';

// WebSocket endpoint base (API key appended at connection time)
export const GEMINI_LIVE_WS_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// Audio segment duration for the recording loop
export const LIVE_SEGMENT_DURATION_MS = 500;

// WAV header size to strip before sending PCM to Gemini
export const WAV_HEADER_BYTES = 44;

// Maximum live narration session length (one rally should never exceed this)
export const LIVE_SESSION_MAX_MS = 45000; // 45 seconds

// Reconnection attempts if WebSocket drops mid-rally
export const LIVE_WS_MAX_RECONNECT_ATTEMPTS = 2;

// Delay between reconnection attempts
export const LIVE_WS_RECONNECT_DELAY_MS = 1000;

export const LIVE_NARRATION_COLORS = {
  streaming: '#8B5CF6',    // Purple — active streaming state
  statAppear: '#22C55E',   // Green — new stat added animation
  warning: '#F59E0B',      // Amber — reconnecting
};
