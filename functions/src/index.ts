/**
 * VolleyTrack Cloud Functions
 * ===========================
 * Entry point for all Firebase Cloud Functions.
 *
 * Export each function so Firebase can discover and deploy it.
 * Each function lives in its own module for clean separation.
 */

// Rally Voice Parser — secure LLM proxy for voice-to-stat parsing
export { parseRallyVoice } from "./parse-rally-voice";

// Narrative Generator — secure proxy for match/event/season/fan recaps
export { generateNarrative } from "./generate-narrative";
