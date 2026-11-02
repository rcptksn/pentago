export type Color = 'black' | 'white';
export type Cell = Color | null;
export type PlayerId = 0 | 1;
export type Phase = 'place' | 'rotate';
export type EndReason = 'own-line' | 'opponent-line' | 'timeout' | 'full';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Coord {
  r: number;
  c: number;
}

export type Board = Cell[][];

export interface MoveRecord {
  color: Color;
  place: Coord;
  quadrant: number;
  landed: Coord;
}

export interface SetState {
  board: Board;
  turn: Color;
  phase: Phase;
  pendingPlace: Coord | null;
  winner: Color | 'draw' | null;
  reason: EndReason | null;
  moves: MoveRecord[];
}

export interface SetRecord {
  winner: Color | 'draw';
  winnerPlayer: PlayerId | null;
  blackPlayer: PlayerId;
  points: [number, number];
  reason: EndReason;
}

export interface MatchState {
  blackPlayer: PlayerId;
  /** Bu kadar set kazanan maçı alır. */
  setsToWin: number;
  scores: [number, number];
  setWins: [number, number];
  setsPlayed: number;
  history: SetRecord[];
  status: 'playing' | 'match_over';
  winner: PlayerId | null;
  set: SetState;
}

export type TimerConfig =
  | { mode: 'off' }
  | { mode: 'move'; seconds: number }
  | { mode: 'total'; minutes: number; increment: number };
