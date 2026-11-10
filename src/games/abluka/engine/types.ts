import type { Color, Coord, PlayerId } from '../../../engine/shared';

export type { Color, Coord, PlayerId, Difficulty, TimerConfig } from '../../../engine/shared';

export type Cell = Color | 'block' | null;
export type Phase = 'move' | 'block';
export type EndReason = 'immobilized' | 'mutual-lock' | 'timeout';

export type Board = Cell[][];

export interface MoveRecord {
  color: Color;
  from: Coord;
  to: Coord;
  block: Coord;
}

export interface SetState {
  board: Board;
  turn: Color;
  phase: Phase;
  /** Taşın hareketten önceki konumu; block fazında set edilir. */
  pendingFrom: Coord | null;
  pendingTo: Coord | null;
  winner: Color | null;
  reason: EndReason | null;
  moves: MoveRecord[];
}

export interface SetRecord {
  winner: Color;
  winnerPlayer: PlayerId;
  blackPlayer: PlayerId;
  points: [number, number];
  reason: EndReason;
}

export interface MatchState {
  blackPlayer: PlayerId;
  setsToWin: number;
  scores: [number, number];
  setWins: [number, number];
  setsPlayed: number;
  history: SetRecord[];
  status: 'playing' | 'match_over';
  winner: PlayerId | null;
  set: SetState;
}
