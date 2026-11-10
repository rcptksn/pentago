import type { Board, Cell, Color, Coord } from './types';

export const SIZE = 7;

const NEIGHBOR_DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function opposite(color: Color): Color {
  return color === 'black' ? 'white' : 'black';
}

export function findPiece(board: Board, color: Color): Coord {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === color) return { r, c };
    }
  }
  throw new Error(`${color} taşı bulunamadı`);
}

export function initialBoard(): Board {
  const board = emptyBoard();
  board[0][3] = 'black';
  board[6][3] = 'white';
  return board;
}

export function legalDestinations(board: Board, from: Coord): Coord[] {
  const cells: Coord[] = [];
  for (const [dr, dc] of NEIGHBOR_DIRS) {
    const r = from.r + dr;
    const c = from.c + dc;
    if (inBounds(r, c) && board[r][c] === null) cells.push({ r, c });
  }
  return cells;
}

export function canMove(board: Board, color: Color): boolean {
  return legalDestinations(board, findPiece(board, color)).length > 0;
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

export function withMove(board: Board, from: Coord, to: Coord, color: Color): Board {
  const next = cloneBoard(board);
  next[from.r][from.c] = null;
  next[to.r][to.c] = color;
  return next;
}

export function withBlock(board: Board, at: Coord): Board {
  const next = cloneBoard(board);
  next[at.r][at.c] = 'block';
  return next;
}
