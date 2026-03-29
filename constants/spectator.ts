export const LAST_ACTIVE_SPECTATOR_KEY = '@volleytrack:last_active_spectator';

export interface LastActiveSpectator {
  matchCode: string;
  matchName: string;
  lastSeen: number;
}
