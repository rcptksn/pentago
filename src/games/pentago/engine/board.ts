import type { Board, Cell, Color, Coord } from './types';

export const SIZE = 6;

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function quadrantOf(r: number, c: number): number {
  return (r >= 3 ? 2 : 0) + (c >= 3 ? 1 : 0);
}

export function quadrantOrigin(q: number): Coord {
  return { r: q >= 2 ? 3 : 0, c: q % 2 === 1 ? 3 : 0 };
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function isFull(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

export function quadrantIsEmpty(board: Board, q: number): boolean {
  const origin = quadrantOrigin(q);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[origin.r + r][origin.c + c] !== null) return false;
    }
  }
  return true;
}

export function legalQuadrants(board: Board): number[] {
  const open: number[] = [];
  for (let q = 0; q < 4; q++) {
    if (!quadrantIsEmpty(board, q)) open.push(q);
  }
  return open;
}

export function emptyCells(board: Board): Coord[] {
  const cells: Coord[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === null) cells.push({ r, c });
    }
  }
  return cells;
}

/** Saat yönünde 90°. Yerel (r, c) → (c, 2 − r). */
export function rotateQuadrant(board: Board, q: number): Board {
  const next = cloneBoard(board);
  const origin = quadrantOrigin(q);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      next[origin.r + c][origin.c + (2 - r)] = board[origin.r + r][origin.c + c];
    }
  }
  return next;
}

export function withMarble(board: Board, r: number, c: number, color: Color): Board {
  const next = cloneBoard(board);
  next[r][c] = color;
  return next;
}

export function cellAfterRotation(place: Coord, q: number): Coord {
  const origin = quadrantOrigin(q);
  if (
    place.r < origin.r ||
    place.r >= origin.r + 3 ||
    place.c < origin.c ||
    place.c >= origin.c + 3
  ) {
    return place;
  }
  const lr = place.r - origin.r;
  const lc = place.c - origin.c;
  return { r: origin.r + lc, c: origin.c + (2 - lr) };
}

export function opposite(color: Color): Color {
  return color === 'black' ? 'white' : 'black';
}
