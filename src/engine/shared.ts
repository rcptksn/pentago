export type GameId = 'pentago' | 'abluka';

export type Color = 'black' | 'white';
export type PlayerId = 0 | 1;
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Coord {
  r: number;
  c: number;
}

export type TimerConfig =
  | { mode: 'off' }
  | { mode: 'move'; seconds: number }
  | { mode: 'total'; minutes: number; increment: number };

export function sanitizeSetsToWin(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value);
  if (count === 2 || count === 3 || count === 4 || count === 5) return count;
  return 1;
}
