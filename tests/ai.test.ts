import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/games/pentago/engine/ai';
import { playMove } from '../src/games/pentago/engine/rules';
import type { Board, Cell, SetState } from '../src/games/pentago/engine/types';

function boardOf(rows: string[]): Board {
  return rows.map((row) =>
    row.split('').map((ch) => (ch === 'B' ? 'black' : ch === 'W' ? 'white' : null) as Cell),
  );
}

function fresh(board: Board): SetState {
  return {
    board,
    turn: 'black',
    phase: 'place',
    pendingPlace: null,
    winner: null,
    reason: null,
    moves: [],
  };
}

describe('yapay zeka', () => {
  it('orta seviyede açık beşliyi tamamlar', () => {
    const board = boardOf(['BBBB..', '......', '......', '......', '......', 'W.....']);
    const move = chooseMove(board, 'black', 'medium', () => 0);
    const done = playMove(fresh(board), move.place.r, move.place.c, move.quadrant);
    expect(done?.winner).toBe('black');
  });

  it('kolay seviye yasal bir hamle döner', () => {
    const board = boardOf(['......', '......', '......', '......', '......', '......']);
    const move = chooseMove(board, 'black', 'easy', () => 0.4);
    const done = playMove(fresh(board), move.place.r, move.place.c, move.quadrant);
    expect(done?.moves).toHaveLength(1);
    expect(done?.winner).toBeNull();
  });
});
