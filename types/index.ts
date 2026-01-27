export type Team = 'myTeam' | 'opponent';

export interface Score {
  myTeam: number;
  opponent: number;
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
}

export interface StatLog {
  id: string; // Unique ID for undo tracking
  timestamp: number;
  type: 'ace' | 'serve_error' | 'receive_good' | 'receive_error' | 'kill' | 'attack_error' | 'dig' | 'dig_error' | 'point_adjust';
  team: Team; // Who got the stat/point
  scoreSnapshot: Score; // Score *after* this event
  setNumber: number;
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

export interface MatchState {
  // Setup
  myTeamName: string;
  opponentName: string;
  config: MatchConfig;
  
  // Live State
  currentSet: number; // 1-indexed
  scores: Score[]; // Index 0 is Set 1
  setsWon: Score; // Sets won by each team
  history: StatLog[]; // For undo
  
  // Resources
  timeoutsRemaining: { myTeam: number; opponent: number };
  subsRemaining: { myTeam: number; opponent: number };

  // Actions
  setSetup: (myTeam: string, opponent: string, config: MatchConfig) => void;
  incrementScore: (team: Team) => void;
  recordStat: (type: StatLog['type'], team: Team) => void;
  undo: () => void;
  useTimeout: (team: Team) => void;
  useSub: (team: Team) => void;
  startNextSet: () => void;
  resetMatch: () => void;
}
