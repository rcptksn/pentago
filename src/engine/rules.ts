import { cellAfterRotation, emptyCells, inBounds, isFull, legalQuadrants, opposite, rotateQuadrant, withMarble } from './board';
import type { Board, Color, Coord, EndReason, SetState } from './types';

const DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function hasRun(board: Board, color: Color): boolean {
  return runCells(board, color).length > 0;
}

export function runCells(board: Board, color: Color): Coord[] {
  const marked = new Set<string>();
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (board[r][c] !== color) continue;
      for (const [dr, dc] of DIRS) {
        const pr = r - dr;
        const pc = c - dc;
        if (inBounds(pr, pc) && board[pr][pc] === color) continue;
        const run: Coord[] = [];
        let nr = r;
        let nc = c;
        while (inBounds(nr, nc) && board[nr][nc] === color) {
          run.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }
        if (run.length >= 5) {
          for (const cell of run) marked.add(`${cell.r},${cell.c}`);
        }
      }
    }
  }
  return [...marked].map((key) => {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  });
}

/**
 * Çevirme bittikten sonra bakılır.
 * Hamleyi yapanın kendi beşlisi varsa o kazanır; yalnız rakip dizildiyse rakip kazanır.
 */
export function outcomeAfterMove(board: Board, mover: Color): { winner: Color | 'draw'; reason: EndReason } | null {
  const moverWin = hasRun(board, mover);
  const oppWin = hasRun(board, opposite(mover));
  if (moverWin) return { winner: mover, reason: 'own-line' };
  if (oppWin) return { winner: opposite(mover), reason: 'opponent-line' };
  if (isFull(board)) return { winner: 'draw', reason: 'full' };
  return null;
}

export function initialSet(): SetState {
  return {
    board: Array.from({ length: 6 }, () => Array(6).fill(null)),
    turn: 'black',
    phase: 'place',
    pendingPlace: null,
    winner: null,
    reason: null,
    moves: [],
  };
}

export function tryPlace(set: SetState, r: number, c: number): SetState | null {
  if (set.winner || set.phase !== 'place') return null;
  if (!inBounds(r, c) || set.board[r][c] !== null) return null;
  return {
    ...set,
    board: withMarble(set.board, r, c, set.turn),
    phase: 'rotate',
    pendingPlace: { r, c },
  };
}

export function tryRotate(set: SetState, q: number): SetState | null {
  if (set.winner || set.phase !== 'rotate' || !set.pendingPlace) return null;
  if (q < 0 || q > 3 || !legalQuadrants(set.board).includes(q)) return null;
  const board = rotateQuadrant(set.board, q);
  const outcome = outcomeAfterMove(board, set.turn);
  const landed = cellAfterRotation(set.pendingPlace, q);
  return {
    board,
    turn: outcome ? set.turn : opposite(set.turn),
    phase: 'place',
    pendingPlace: null,
    winner: outcome ? outcome.winner : null,
    reason: outcome ? outcome.reason : null,
    moves: [
      ...set.moves,
      { color: set.turn, place: set.pendingPlace, quadrant: q, landed },
    ],
  };
}

export function playMove(set: SetState, r: number, c: number, q: number): SetState | null {
  const placed = tryPlace(set, r, c);
  if (!placed) return null;
  return tryRotate(placed, q);
}

export function legalPlaces(set: SetState): Coord[] {
  if (set.winner || set.phase !== 'place') return [];
  return emptyCells(set.board);
}

export function legalRotations(set: SetState): number[] {
  if (set.winner || set.phase !== 'rotate') return [];
  return legalQuadrants(set.board);
}
