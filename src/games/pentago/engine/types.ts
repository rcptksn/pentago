import type { Color, Coord, PlayerId } from '../../../engine/shared';

export type { Color, Coord, PlayerId, Difficulty, TimerConfig } from '../../../engine/shared';

export type Cell = Color | null;
export type Phase = 'place' | 'rotate';
export type EndReason = 'own-line' | 'opponent-line' | 'timeout' | 'full';

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
