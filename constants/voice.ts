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
// Timeout for the Gemini API call to parse voice transcript
export const GEMINI_PARSE_TIMEOUT_MS = 15000;

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
// These are the action types the Gemini parser should recognize from voice input.
// Organized by rally phase for prompt engineering.
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
