import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/games/abluka/engine/ai';
import { canMove, findPiece, initialBoard, SIZE, withBlock, withMove } from '../src/games/abluka/engine/board';
import { advanceMatch, createMatch, movePiece, placeBlock, turnPlayer } from '../src/games/abluka/engine/match';
import {
  checkImmobilizedAtTurnStart,
  initialSet,
  legalMoves,
  outcomeAfterBlock,
  tryMove,
  tryPlaceBlock,
} from '../src/games/abluka/engine/rules';
import type { Board, Cell } from '../src/games/abluka/engine/types';

function boardOf(rows: string[]): Board {
  return rows.map((row) =>
    row.split('').map((ch) => {
      if (ch === 'B') return 'black';
      if (ch === 'W') return 'white';
      if (ch === 'X') return 'block';
      return null;
    }) as Cell[],
  );
}

describe('abluka başlangıç', () => {
  it('7x7 tahtada taşlar orta sütunda karşı sıralarda', () => {
    const board = initialBoard();
    expect(SIZE).toBe(7);
    expect(findPiece(board, 'black')).toEqual({ r: 0, c: 3 });
    expect(findPiece(board, 'white')).toEqual({ r: 6, c: 3 });
  });

  it('siyah başlar ve ilk hamlede hareket edebilir', () => {
    const set = initialSet();
    expect(set.turn).toBe('black');
    expect(set.phase).toBe('move');
    expect(legalMoves(set).length).toBeGreaterThan(0);
  });
});

describe('abluka hamle', () => {
  it('komşu boş kareye hareket eder sonra engel koyar', () => {
    let set = initialSet();
    set = tryMove(set, 1, 3)!;
    expect(set).not.toBeNull();
    expect(set.phase).toBe('block');
    expect(findPiece(set.board, 'black')).toEqual({ r: 1, c: 3 });
    set = tryPlaceBlock(set, 0, 3)!;
    expect(set.board[0][3]).toBe('block');
    expect(set.turn).toBe('white');
    expect(set.phase).toBe('move');
    expect(set.moves).toHaveLength(1);
  });

  it('uzak veya dolu kareye hareketi reddeder', () => {
    const set = initialSet();
    expect(tryMove(set, 2, 3)).toBeNull();
    expect(tryMove(set, 6, 3)).toBeNull();
  });
});

describe('abluka bitiş', () => {
  it('rakibi kilitleyen engel seti bitirir', () => {
    const locked = boardOf([
      '.......',
      '...B...',
      '.......',
      '.......',
      'XXXXX..',
      'XWXXX..',
      'XXXXX..',
    ]);
    expect(canMove(locked, 'white')).toBe(false);
    expect(canMove(locked, 'black')).toBe(true);
    expect(outcomeAfterBlock(locked, 'black')).toEqual({ winner: 'black', reason: 'immobilized' });
  });

  it('karşılıklı kilitte son hamleyi yapan kazanır', () => {
    const board = boardOf([
      'XXXXXXX',
      'XBXXXXX',
      'XXXXXXX',
      'XXXXXXX',
      'XXXXXXX',
      'XWXXXXX',
      'XXXXXXX',
    ]);
    expect(canMove(board, 'black')).toBe(false);
    expect(canMove(board, 'white')).toBe(false);
    expect(outcomeAfterBlock(board, 'white')).toEqual({ winner: 'white', reason: 'mutual-lock' });
  });

  it('tur başında hareket edemeyen kaybeder', () => {
    const board = boardOf([
      'XXXXXXX',
      'XBXXXXX',
      'XXXXXXX',
      '.......',
      '.......',
      '...W...',
      '.......',
    ]);
    const set = checkImmobilizedAtTurnStart({
      ...initialSet(),
      board,
      turn: 'black',
    });
    expect(set.winner).toBe('white');
    expect(set.reason).toBe('immobilized');
  });
});

describe('abluka maç', () => {
  it('movePiece ve placeBlock üzerinden tur tamamlar', () => {
    let match = createMatch(() => 0.1, 1);
    expect(turnPlayer(match)).toBe(match.blackPlayer);
    const from = findPiece(match.set.board, 'black');
    const next = movePiece(match, from.r + 1, from.c)!;
    expect(next.set.phase).toBe('block');
    match = placeBlock(next, 0, 0)!;
    expect(match.set.turn).toBe('white');
  });

  it('set kazanınca maçı bitirir', () => {
    let match = createMatch(() => 0.1, 1);
    match = {
      ...match,
      set: { ...match.set, winner: 'black', reason: 'immobilized' },
    };
    match = advanceMatch(match);
    expect(match.status).toBe('match_over');
    expect(match.winner).toBe(match.history[0].winnerPlayer);
  });
});

describe('abluka yardımcı', () => {
  it('withMove ve withBlock tahtayı günceller', () => {
    const board = initialBoard();
    const moved = withMove(board, { r: 0, c: 3 }, { r: 1, c: 3 }, 'black');
    expect(moved[0][3]).toBeNull();
    expect(moved[1][3]).toBe('black');
    const blocked = withBlock(moved, { r: 2, c: 2 });
    expect(blocked[2][2]).toBe('block');
  });
});

describe('abluka ai', () => {
  it('yasal hamle üretir', () => {
    const set = initialSet();
    const move = chooseMove(set.board, 'black', 'easy', () => 0.2);
    const moved = tryMove(set, move.to.r, move.to.c);
    expect(moved).not.toBeNull();
    expect(tryPlaceBlock(moved!, move.block.r, move.block.c)).not.toBeNull();
  });
});
