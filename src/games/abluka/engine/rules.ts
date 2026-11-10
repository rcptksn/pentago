import {
  canMove,
  emptyCells,
  findPiece,
  inBounds,
  initialBoard,
  legalDestinations,
  opposite,
  withBlock,
  withMove,
} from './board';
import type { Color, Coord, EndReason, SetState } from './types';

export function initialSet(): SetState {
  return {
    board: initialBoard(),
    turn: 'black',
    phase: 'move',
    pendingFrom: null,
    pendingTo: null,
    winner: null,
    reason: null,
    moves: [],
  };
}

export function legalMoves(set: SetState): Coord[] {
  if (set.winner || set.phase !== 'move') return [];
  return legalDestinations(set.board, findPiece(set.board, set.turn));
}

export function legalBlocks(set: SetState): Coord[] {
  if (set.winner || set.phase !== 'block') return [];
  return emptyCells(set.board);
}

/**
 * Engel konulduktan sonra:
 * - Rakip hareket edemiyorsa hamle yapan kazanır (rakip ablukada).
 * - Her iki taraf da hareket edemiyorsa son hamleyi yapan kazanır.
 * - Yalnız hamle yapan kilitliyse (rakip değil) oyun devam — sıra rakibe geçer;
 *   rakip sırası gelince hareket edemezse o zaman kaybeder.
 *   Not: PDF madde 9–10: sırası gelince hareket edemeyen kaybeder;
 *   karşılıklı kilitte son hamle yapan kazanır.
 */
export function outcomeAfterBlock(
  board: ReturnType<typeof withBlock>,
  mover: Color,
): { winner: Color; reason: EndReason } | null {
  const moverCan = canMove(board, mover);
  const opp = opposite(mover);
  const oppCan = canMove(board, opp);
  if (!oppCan && !moverCan) return { winner: mover, reason: 'mutual-lock' };
  if (!oppCan) return { winner: mover, reason: 'immobilized' };
  return null;
}

/** Set başında veya tur başında: sıradaki oyuncu hareket edemiyorsa kaybeder. */
export function checkImmobilizedAtTurnStart(set: SetState): SetState {
  if (set.winner || set.phase !== 'move') return set;
  if (canMove(set.board, set.turn)) return set;
  return {
    ...set,
    winner: opposite(set.turn),
    reason: 'immobilized',
  };
}

export function tryMove(set: SetState, r: number, c: number): SetState | null {
  if (set.winner || set.phase !== 'move') return null;
  if (!inBounds(r, c) || set.board[r][c] !== null) return null;
  const from = findPiece(set.board, set.turn);
  const legal = legalDestinations(set.board, from);
  if (!legal.some((cell) => cell.r === r && cell.c === c)) return null;
  return {
    ...set,
    board: withMove(set.board, from, { r, c }, set.turn),
    phase: 'block',
    pendingFrom: from,
    pendingTo: { r, c },
  };
}

export function tryPlaceBlock(set: SetState, r: number, c: number): SetState | null {
  if (set.winner || set.phase !== 'block' || !set.pendingFrom || !set.pendingTo) return null;
  if (!inBounds(r, c) || set.board[r][c] !== null) return null;
  const board = withBlock(set.board, { r, c });
  const outcome = outcomeAfterBlock(board, set.turn);
  const moves = [
    ...set.moves,
    {
      color: set.turn,
      from: set.pendingFrom,
      to: set.pendingTo,
      block: { r, c },
    },
  ];
  if (outcome) {
    return {
      board,
      turn: set.turn,
      phase: 'move',
      pendingFrom: null,
      pendingTo: null,
      winner: outcome.winner,
      reason: outcome.reason,
      moves,
    };
  }
  const nextTurn = opposite(set.turn);
  const next: SetState = {
    board,
    turn: nextTurn,
    phase: 'move',
    pendingFrom: null,
    pendingTo: null,
    winner: null,
    reason: null,
    moves,
  };
  return checkImmobilizedAtTurnStart(next);
}

export function playTurn(set: SetState, to: Coord, block: Coord): SetState | null {
  const moved = tryMove(set, to.r, to.c);
  if (!moved) return null;
  return tryPlaceBlock(moved, block.r, block.c);
}
