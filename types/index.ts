export type Team = 'myTeam' | 'opponent';

export interface Score {
  myTeam: number;
  opponent: number;
}

export interface AINarrative {
  coachSummary: string;
  socialSummary: string;
  generatedAt: number;
  debugPrompt?: string;
}

export interface Player {
  id: string;
  name: string;
  jerseyNumber: string;
  positions: string[]; // e.g., 'OH', 'MB', 'S', 'L', 'DS'
}

export interface Season {
  id: string;
  name: string; // "2024-2025 Club"
  teamName: string; // "My Team 15U" (Default name for matches)
  level: string; // "Varsity", "15 Open"
  startDate: number;
  lastAccessed?: number;
  roster: Player[];
  aiNarrative?: AINarrative;
}

export interface Event {
  id: string;
  seasonId: string;
  name: string; // "Windy City Qualifier"
  location: string;
  startDate: number;
  endDate?: number;
  aiNarrative?: AINarrative;
}

export interface MatchRecord {
  id: string;
  // Optional IDs allow for "Ad-Hoc" matches without hierarchy
  eventId?: string;
  seasonId?: string;
  opponentName: string;
  date: number;
  time?: string; // e.g. "14:00" or simple text like "2:00 PM"
  courtNumber?: string;
  result: 'Win' | 'Loss' | 'In Progress' | 'Scheduled';
  setsWon: Score;
  scores: Score[];
  history: StatLog[];
  config?: MatchConfig;
  lineups?: Record<number, LineupPosition[]>; // Set Number -> Lineup
  aiNarrative?: AINarrative;
}

export interface LineupPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  playerId: string | null;
  isLibero: boolean;
  designatedSubId?: string | null;
}

export interface TeamModel {
  id: string;
  name: string;
  roster: Player[];
}

export interface SetConfig {
  targetScore: number;
  winBy: number;
  cap: number;
}

export interface MatchConfig {
  presetName: '3-Set' | '5-Set' | '2-Set-Seeding' | 'Custom';
  totalSets: number; // e.g., 3 for best of 3
  sets: SetConfig[]; // Configuration for each set index
  timeoutsPerSet?: number; // Default 2
  subsPerSet?: number; // Default 15
}

export interface StatLog {
  id: string; // Unique ID for undo tracking
  timestamp: number;
  type: 'ace' | 'serve_error' | 'serve_good' | 'kill' | 'attack_error' | 'attack_good' | 'block' | 'dig' | 'dig_error' | 'set_error' | 'pass_error' | 'receive_error' | 'receive_0' | 'receive_1' | 'receive_2' | 'receive_3' | 'no_play' | 'point_adjust' | 'drop' | 'timeout' | 'substitution' | 'rotation';
  team: Team; // Who got the stat/point
  scoreSnapshot: Score; // Score *before* this event (used for undo restoration)
  setNumber: number;
  playerId?: string; // ID of the player who performed the action
  assistPlayerId?: string; // ID of the player who set/assisted (for kills)
  metadata?: {
    subIn?: string; // Player ID entering
    subInNumber?: string | number;
    subInName?: string;
    subOut?: string; // Player ID exiting
    subOutNumber?: string | number;
    subOutName?: string;
    [key: string]: any;
  }; // For flexible data like sub details (in/out) or rotation details

  // Snapshots for Undo & Analytics
  rallyStateSnapshot?: 'pre-serve' | 'in-rally';
  servingTeamSnapshot?: Team;
  rotationSnapshot?: LineupPosition[]; // My Team's rotation at time of event
}

export interface TeamStats {
  aces: number;
  serveErrors: number;
  kills: number;
  attackErrors: number;
  goodPasses: number;
  digs: number;
  digErrors: number;
}

export interface SetResult {
  setNumber: number;
  winner: Team;
  score: Score;
}

// Phase 5: Spectator Interactions — Alerts, Cheers, Viewer Presence
export interface SpectatorAlert {
  id: string;
  type: 'score_correction';
  senderDeviceId: string;
  senderName: string;
  timestamp: number;
  suggestedScore?: Score; // What the spectator thinks the score should be
  currentSet?: number;
  message?: string;
  acknowledged?: boolean;
}

export interface SpectatorViewer {
  deviceId: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
}

// Phase 5: Super Fan Recap
export interface SuperFanRecap {
  playerIds: string[];
  playerNames: string[];
  recap: string;
  generatedAt: number;
}

// Phase 4: Spectator View — Live Match Broadcast
export interface LiveMatchSnapshot {
  matchCode: string;
  coachUid: string;
  matchId: string;
  isActive: boolean;
  createdAt: number;
  lastUpdated: number;
  currentState: {
    myTeamName: string;
    opponentName: string;
    currentSet: number;
    scores: Score[];
    setsWon: Score;
    servingTeam: Team;
    rallyState: 'pre-serve' | 'in-rally';
    currentRotation: LineupPosition[];
    myTeamRoster: Player[];
    history: StatLog[];
    setHistory: SetResult[];
    timeoutsRemaining: Score;
    subsRemaining: Score;
    config: MatchConfig;
    status: 'live' | 'between-sets' | 'completed';
  };

  // Phase 5: Spectator Interactions
  spectators?: Record<string, SpectatorViewer>;
  spectatorCount?: number;
  spectatorAlerts?: SpectatorAlert[];
  cheerCount?: number;
  lastCheerAt?: number;
}

export interface MatchState {
  // Setup
  myTeamName: string;
  opponentName: string;
  config: MatchConfig;

  // Linkage
  matchId: string; // Current match ID
  activeSeasonId?: string;
  activeEventId?: string;

  // Live State
  currentSet: number; // 1-indexed
  scores: Score[]; // Index 0 is Set 1
  setsWon: Score; // Sets won by each team
  history: StatLog[]; // For undo
  setHistory: SetResult[]; // Completed sets

  // Rally Flow & Roster
  servingTeam: Team; // 'myTeam' or 'opponent'
  rallyState: 'pre-serve' | 'in-rally';
  myTeamRoster: Player[];
  opponentTeamRoster: Player[];

  // Resources
  timeoutsRemaining: { myTeam: number; opponent: number };
  subsRemaining: { myTeam: number; opponent: number };

  lineups?: Record<number, LineupPosition[]>;
  aiNarrative?: AINarrative;
  currentRotation?: LineupPosition[]; // Array of 6, representing P1-P6 current players

  // Smart Subs & Libero
  liberoIds?: string[]; // IDs of players marked as Libero for this set
  nonLiberoDesignations?: string[]; // IDs of players explicitly marked as "Not a Libero" (e.g. starters)
  subPairs?: Record<string, string>; // PlayerID -> Paired PlayerID (for smart suggestions)

  // Serve Tracking
  firstServerPerSet?: Record<number, Team>; // Who served first in each set (for alternating suggestions)

  // Actions
  setSetup: (myTeam: string, opponent: string, config: MatchConfig, seasonId?: string, eventId?: string, matchId?: string, lineups?: Record<number, LineupPosition[]>, roster?: Player[]) => void;
  updateMatchSettings: (matchId: string, myTeam: string, opponent: string, config: MatchConfig, lineups?: Record<number, LineupPosition[]>) => void;
  setServingTeam: (team: Team) => void;
  setFirstServer: (setNumber: number, team: Team) => void;
  adjustStartingRotation: (direction: 'forward' | 'backward') => void;
  startRally: () => void;
  endRally: (winner: Team) => void; // Handles point increment & rotation
  incrementScore: (team: Team) => void;
  decrementScore: (team: Team) => void;
  setScore: (team: Team, score: number) => void;
  recordStat: (type: StatLog['type'], team: Team, playerId?: string, metadata?: any) => void;
  undo: () => void;
  useTimeout: (team: Team) => void;
  useSub: (team: Team) => void;
  startNextSet: () => void;
  finalizeMatch: () => void;
  resetMatch: () => void;
  designateNonLibero: (playerId: string) => void;

  // Rotation Actions
  rotate: (direction?: 'forward' | 'backward', roster?: Player[]) => void;
  substitute: (position: number, player: Player, isLibero?: boolean) => void;

  // Analysis Helpers
  getRotationStats: () => void; // Placeholder or helper getter
  updateLogEntry: (logId: string, updates: Partial<StatLog>) => void;
  setAINarrative: (narrative: AINarrative) => void;
}
