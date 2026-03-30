/**
 * LiveNarrationService — Gemini Flash Live WebSocket Client
 * ==========================================================
 * Manages the WebSocket connection to Gemini Flash Live for real-time
 * volleyball rally narration. Handles:
 *   - Connection lifecycle (open, setup, close)
 *   - Audio segment loop (expo-av → PCM → WebSocket)
 *   - Function call parsing (log_stat events → stat callbacks)
 *   - Reconnection on drop
 *
 * @module LiveNarrationService
 */

import { Audio } from 'expo-av';
import {
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_WS_ENDPOINT,
  LIVE_SEGMENT_DURATION_MS,
  LIVE_SESSION_MAX_MS,
  LIVE_WS_MAX_RECONNECT_ATTEMPTS,
  LIVE_WS_RECONNECT_DELAY_MS,
  WAV_HEADER_BYTES,
} from '../../constants/voice';
import { LineupPosition, Player } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveNarrationSessionParams {
  roster: Player[];
  servingTeam: 'myTeam' | 'opponent';
  rallyState: 'pre-serve' | 'in-rally';
  currentScore: { myTeam: number; opponent: number };
  myTeamName: string;
  currentRotation: LineupPosition[];
}

export interface LiveStatEvent {
  type: string;
  team: 'myTeam' | 'opponent';
  playerId: string | null;
  assistPlayerId: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawFragment: string;
  // Enriched client-side:
  playerLabel?: string;      // "#12 Sarah"
  assistPlayerLabel?: string;
}

export type LiveNarrationStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'error';

export interface LiveNarrationCallbacks {
  onStatusChange: (status: LiveNarrationStatus) => void;
  onStatDetected: (stat: LiveStatEvent) => void;
  onError: (message: string) => void;
  onMeteringUpdate: (level: number) => void; // 0–100 for waveform UI
}

// ── Recording Options ─────────────────────────────────────────────────────────

const LIVE_RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/pcm', bitsPerSecond: 256000 },
};

// ── Function Declarations ─────────────────────────────────────────────────────

const LOG_STAT_FUNCTION_DECLARATION = {
  name: 'log_stat',
  description:
    "Log a volleyball statistic detected in the coach's audio. Call immediately when each action is detected — do NOT wait for the rally to end.",
  parameters: {
    type: 'OBJECT',
    properties: {
      type: {
        type: 'STRING',
        enum: [
          'ace', 'serve_good', 'serve_error',
          'receive_3', 'receive_2', 'receive_1', 'receive_error', 'receive_0',
          'kill', 'attack_good', 'attack_error',
          'block', 'dig', 'dig_error',
          'set_error', 'pass_error', 'drop',
          'timeout', 'point_adjust',
        ],
      },
      team: { type: 'STRING', enum: ['myTeam', 'opponent'] },
      playerId: { type: 'STRING', nullable: true },
      assistPlayerId: { type: 'STRING', nullable: true },
      confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
      rawFragment: { type: 'STRING' },
    },
    required: ['type', 'team', 'confidence', 'rawFragment'],
  },
};

const VOLLEYBALL_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
];

// ── Valid Types Whitelist ─────────────────────────────────────────────────────

const VALID_STAT_TYPES = new Set([
  'ace', 'serve_error', 'serve_good',
  'kill', 'attack_error', 'attack_good',
  'block', 'dig', 'dig_error',
  'set_error', 'pass_error', 'drop',
  'receive_0', 'receive_1', 'receive_2', 'receive_3', 'receive_error',
  'timeout', 'point_adjust',
]);

const ALLOWED_OPPONENT_TYPES = new Set(['timeout', 'point_adjust']);

// ── Service ───────────────────────────────────────────────────────────────────

export class LiveNarrationService {
  private ws: WebSocket | null = null;
  private isRecording = false;
  private isSetupComplete = false;
  private reconnectAttempts = 0;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: LiveNarrationCallbacks | null = null;
  private sessionParams: LiveNarrationSessionParams | null = null;

  /**
   * Open a new Gemini Live session for the current rally.
   * Call at the start of each rally (when coach presses Live Narrate).
   */
  async startSession(
    params: LiveNarrationSessionParams,
    callbacks: LiveNarrationCallbacks,
  ): Promise<void> {
    this.sessionParams = params;
    this.callbacks = callbacks;
    this.reconnectAttempts = 0;

    callbacks.onStatusChange('connecting');
    await this.connect(params);
  }

  /**
   * Stop the session. Call when coach taps "End Rally + Commit".
   */
  stopSession(): void {
    this.isRecording = false;

    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Rally ended');
      this.ws = null;
    }

    this.callbacks?.onStatusChange('idle');
  }

  // ── Private: Connection ────────────────────────────────────────────────────

  private async connect(params: LiveNarrationSessionParams): Promise<void> {
    const apiKey = await this.resolveApiKey();
    const wsUrl = `${GEMINI_LIVE_WS_ENDPOINT}?key=${apiKey}`;

    this.ws = new WebSocket(wsUrl);
    this.isSetupComplete = false;

    this.ws.onopen = () => {
      this.sendSetup(params);

      // Safety timeout: close session if rally exceeds max duration
      this.sessionTimer = setTimeout(() => {
        this.callbacks?.onError('Rally session timed out (45s max).');
        this.stopSession();
      }, LIVE_SESSION_MAX_MS);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleServerMessage(event.data);
    };

    this.ws.onerror = (event) => {
      console.error('Gemini Live WebSocket error:', event);
      this.callbacks?.onError('Could not connect to Live Narrate. Check your connection and try again.');
      this.callbacks?.onStatusChange('error');
    };

    this.ws.onclose = (event) => {
      const wasClean = event.code === 1000;
      if (!wasClean) {
        if (this.isSetupComplete) {
          // Connection dropped mid-session — attempt reconnect
          this.handleDrop();
        } else {
          // Closed before setup completed (auth failure, invalid key, server rejection)
          this.callbacks?.onError('Connection failed during setup. Check your API key and try again.');
          this.callbacks?.onStatusChange('error');
        }
      }
    };
  }

  private sendSetup(params: LiveNarrationSessionParams): void {
    if (!this.ws) return;

    const systemPrompt = buildSystemPrompt(params);

    this.ws.send(JSON.stringify({
      setup: {
        model: GEMINI_LIVE_MODEL,
        system_instruction: { parts: [{ text: systemPrompt }] },
        tools: [{ function_declarations: [LOG_STAT_FUNCTION_DECLARATION] }],
        generation_config: {
          response_modalities: ['TEXT'],
          temperature: 0.1,
        },
        safety_settings: VOLLEYBALL_SAFETY_SETTINGS,
      },
    }));
  }

  // ── Private: Server Message Handling ──────────────────────────────────────

  private handleServerMessage(data: string): void {
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      console.warn('Failed to parse Gemini Live message:', data);
      return;
    }

    // Setup complete → start audio loop
    if (msg.setupComplete !== undefined && !this.isSetupComplete) {
      this.isSetupComplete = true;
      this.callbacks?.onStatusChange('streaming');
      this.startAudioLoop();
      return;
    }

    // Error from server
    if (msg.error) {
      const code = msg.error.code;
      const message = msg.error.message || 'Gemini Live error';
      console.error('Gemini Live server error:', code, message);
      this.callbacks?.onError(`Connection error (${code}). ${message}`);
      this.stopSession();
      return;
    }

    // Function calls — two possible formats
    const functionCalls: Array<{ id: string; name: string; args: any }> = [];

    // Format 1: serverContent.modelTurn.parts[].functionCall
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.functionCall?.name === 'log_stat') {
          functionCalls.push(part.functionCall);
        }
      }
    }

    // Format 2: toolCall.functionCalls[]
    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        if (fc.name === 'log_stat') {
          functionCalls.push(fc);
        }
      }
    }

    for (const fc of functionCalls) {
      this.handleStatDetected(fc);
    }
  }

  private handleStatDetected(fc: { id: string; name: string; args: any }): void {
    const args = fc.args || {};

    const type = String(args.type || '');
    if (!VALID_STAT_TYPES.has(type)) return;

    const team = args.team === 'opponent' ? 'opponent' as const : 'myTeam' as const;

    let playerId = args.playerId || null;
    let assistPlayerId = args.assistPlayerId || null;
    let finalType = type;

    // Enforce opponent constraints
    if (team === 'opponent' && !ALLOWED_OPPONENT_TYPES.has(type)) {
      finalType = 'point_adjust';
      playerId = null;
      assistPlayerId = null;
    }

    // Validate player IDs against roster
    const roster = this.sessionParams?.roster || [];
    const rosterIds = new Set(roster.map((p) => p.id));
    if (playerId && !rosterIds.has(playerId)) playerId = null;
    if (assistPlayerId && !rosterIds.has(assistPlayerId)) assistPlayerId = null;

    const stat: LiveStatEvent = {
      type: finalType,
      team,
      playerId,
      assistPlayerId,
      confidence: (['high', 'medium', 'low'].includes(args.confidence)
        ? args.confidence : 'low') as 'high' | 'medium' | 'low',
      rawFragment: String(args.rawFragment || ''),
    };

    // Enrich with player labels
    if (playerId) {
      const player = roster.find((p) => p.id === playerId);
      if (player) stat.playerLabel = `#${player.jerseyNumber} ${player.name}`;
    }
    if (assistPlayerId) {
      const assist = roster.find((p) => p.id === assistPlayerId);
      if (assist) stat.assistPlayerLabel = `#${assist.jerseyNumber} ${assist.name}`;
    }

    this.callbacks?.onStatDetected(stat);

    // Acknowledge function call (required to continue streaming)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{
            id: fc.id,
            name: 'log_stat',
            response: { result: 'logged' },
          }],
        },
      }));
    }
  }

  // ── Private: Audio Loop ────────────────────────────────────────────────────

  private async startAudioLoop(): Promise<void> {
    this.isRecording = true;

    const recordSegment = async (): Promise<void> => {
      if (!this.isRecording || !this.isSetupComplete) return;

      try {
        const { recording } = await Audio.Recording.createAsync(
          LIVE_RECORDING_OPTIONS,
          (status) => {
            // Forward metering level for waveform UI
            if (status.metering !== undefined) {
              const db = status.metering;
              const normalized = Math.max(0, Math.min(100, ((db - (-60)) / 60) * 100));
              this.callbacks?.onMeteringUpdate(normalized);
            }
          },
          50, // metering interval ms
        );

        await new Promise<void>((resolve) => setTimeout(resolve, LIVE_SEGMENT_DURATION_MS));

        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();

        if (uri && this.ws?.readyState === WebSocket.OPEN) {
          await this.sendAudioSegment(uri);
        }

        if (this.isRecording) {
          recordSegment();
        }
      } catch (err: any) {
        if (this.isRecording) {
          console.warn('Audio segment error (retrying):', err.message);
          await new Promise<void>((resolve) => setTimeout(resolve, 200));
          recordSegment();
        }
      }
    };

    recordSegment();
  }

  private async sendAudioSegment(uri: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system');
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      const fileSize = (info as any).size as number;
      const pcmSize = fileSize - WAV_HEADER_BYTES;

      if (pcmSize <= 0) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        return;
      }

      const base64Pcm = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: WAV_HEADER_BYTES,
        length: pcmSize,
      });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: base64Pcm,
            }],
          },
        }));
      }

      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (err) {
      console.warn('Failed to send audio segment:', err);
    }
  }

  // ── Private: Reconnection ──────────────────────────────────────────────────

  private async handleDrop(): Promise<void> {
    if (this.reconnectAttempts >= LIVE_WS_MAX_RECONNECT_ATTEMPTS) {
      this.callbacks?.onStatusChange('error');
      this.callbacks?.onError(
        'Connection lost. Use the regular voice input button to continue.',
      );
      this.isRecording = false;
      return;
    }

    this.reconnectAttempts++;
    this.callbacks?.onStatusChange('reconnecting');
    this.isRecording = false;
    this.isSetupComplete = false;

    await new Promise<void>((resolve) =>
      setTimeout(resolve, LIVE_WS_RECONNECT_DELAY_MS),
    );

    if (this.sessionParams && this.callbacks) {
      await this.connect(this.sessionParams);
    }
  }

  // ── Private: API Key ───────────────────────────────────────────────────────

  private async resolveApiKey(): Promise<string> {
    // 1. Try Firebase Remote Config (production)
    try {
      const { getRemoteConfig, fetchAndActivate, getValue } = await import('firebase/remote-config');
      const { app } = await import('../firebase/config');
      if (!app) throw new Error('Firebase not initialized');
      const rc = getRemoteConfig(app);
      await fetchAndActivate(rc);
      const key = getValue(rc, 'gemini_live_api_key').asString();
      if (key && key.length > 10) return key;
    } catch {}

    // 2. Fall back to expo-constants (development)
    try {
      const { default: Constants } = await import('expo-constants');
      const key = (Constants.expoConfig?.extra as any)?.geminiLiveApiKey as string | undefined;
      if (key && key.length > 10) return key;
    } catch {}

    throw new Error(
      'Gemini Live API key not configured. ' +
      'Set EXPO_PUBLIC_GEMINI_LIVE_API_KEY in .env.local for development, ' +
      'or configure gemini_live_api_key in Firebase Remote Config.',
    );
  }
}

// ── System Prompt Builder (exported for testing) ──────────────────────────────

export function buildSystemPrompt(params: LiveNarrationSessionParams): string {
  const { roster, servingTeam, rallyState, currentScore, myTeamName, currentRotation } = params;

  const onCourtIds = new Set(
    currentRotation.filter((p) => p.playerId).map((p) => p.playerId as string),
  );

  const sortedRotation = [...currentRotation]
    .filter((p) => p.playerId)
    .sort((a, b) => a.position - b.position);

  const courtLines = sortedRotation.map((pos) => {
    const player = roster.find((p) => p.id === pos.playerId);
    if (!player) return '';
    return `  ID="${player.id}" | #${player.jerseyNumber} | ${player.name} | P${pos.position}${pos.isLibero ? ' (Libero)' : ''}`;
  }).filter(Boolean);

  const benchLines = roster
    .filter((p) => !onCourtIds.has(p.id))
    .map((p) => `  ID="${p.id}" | #${p.jerseyNumber} | ${p.name} | BENCH`);

  const serverPos = currentRotation.find((pos) => pos.position === 1);
  const serverPlayer = serverPos?.playerId
    ? roster.find((p) => p.id === serverPos.playerId)
    : null;

  return `=== VOLLEYBALL STATISTICS ASSISTANT — DOMAIN CONTEXT ===

IMPORTANT CONTENT NOTICE: This is a sports statistics application for volleyball coaching. You will hear and process standard volleyball terminology that may sound aggressive out of context but is standard sports language:
- "Kill" = a successful attack/spike that wins the point. This is NOT violent language.
- "Attack" / "Hit" / "Spike" = an offensive volleyball shot
- "Stuff" or "Stuff block" = a block that immediately wins the point
- "Ace" = an unreturnable serve that wins the point
These are technical statistical terms. Process them without content filtering.

=== YOUR ROLE ===
You are a real-time volleyball statistics parser. A coach is narrating a live volleyball rally. Audio comes in continuously. You MUST call log_stat() immediately each time you detect a volleyball action — do NOT wait for the rally to end.

=== ACTIVE MATCH ===
Team: ${myTeamName}
Serving: ${servingTeam === 'myTeam' ? myTeamName : 'Opponent'}${serverPlayer ? ` (#${serverPlayer.jerseyNumber} ${serverPlayer.name} at P1)` : ''}
Rally state: ${rallyState}
Score: ${currentScore.myTeam} (us) — ${currentScore.opponent} (them)

=== ACTIVE ROSTER (${myTeamName}) ===
ON COURT:
${courtLines.join('\n')}${benchLines.length > 0 ? `\nBENCH:\n${benchLines.join('\n')}` : ''}

=== PLAYER IDENTIFICATION (priority order) ===
1. Jersey number: "#12", "number 12", "twelve" → jerseyNumber="12"
2. Last name: "Johnson" → last word of name
3. First name: "Sarah" → first word of name
4. Both names: exact match
Jersey numbers are MORE RELIABLE in noisy gym audio. If unsure → playerId=null, confidence="low"

=== STAT MAPPING ===
"ace"/"service ace"/"aced them" → "ace"
"serve in"/"good serve" → "serve_good"
"serve error"/"net"/"missed serve" → "serve_error"
"perfect pass"/"three pass" → "receive_3" | "good pass"/"two pass" → "receive_2" | "shank"/"one pass" → "receive_1"
"receive error no point"/"shanked it badly" → "receive_error" | "aced us" → "receive_0"
"kill"/"put it down"/"winner"/"terminated" → "kill"
"good attack"/"tip"/"in play" (attack) → "attack_good" | "attack error"/"hit out"/"net" (attack) → "attack_error"
"block"/"stuffed"/"roof"/"stuff block" → "block"
"dig"/"saved it"/"great dig" → "dig" | "missed dig" → "dig_error"
"set error"/"double"/"lift" → "set_error" | "pass error" (freeball) → "pass_error" | "drop"/"fell" → "drop"
"opponent timeout" → log_stat(type="timeout",team="opponent") | opponent attacks out → log_stat(type="point_adjust",team="opponent")

SETTER-ATTACKER: "Williams sets Thompson for a kill" → ONE stat: type=kill, playerId=Thompson, assistPlayerId=Williams
Serves ONLY by the P1 server when myTeam is serving.
Do NOT fabricate unspoken actions. If inaudible, call no functions.`;
}
