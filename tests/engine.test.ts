import { describe, expect, it } from 'vitest';
import { cellAfterRotation, quadrantIsEmpty, rotateQuadrant } from '../src/engine/board';
import { beginSet, completeTurn, createClock, remaining } from '../src/engine/clock';
import { advanceMatch, awardTimeout, colorOfPlayer, createMatch, playerOfColor, turnPlayer } from '../src/engine/match';
import { hasRun, initialSet, outcomeAfterMove, playMove, tryPlace, tryRotate } from '../src/engine/rules';
import type { Board, Cell, MatchState, PlayerId } from '../src/engine/types';

function boardOf(rows: string[]): Board {
  return rows.map((row) =>
    row.split('').map((ch) => (ch === 'B' ? 'black' : ch === 'W' ? 'white' : null) as Cell),
  );
}

function scripted(match: MatchState, winner: PlayerId | 'draw'): MatchState {
  const color = winner === 'draw' ? 'draw' : colorOfPlayer(match, winner);
  return advanceMatch({
    ...match,
    set: { ...match.set, winner: color, reason: winner === 'draw' ? 'full' : 'own-line' },
  });
}

describe('çevirme', () => {
  it('sol üst parçayı saat yönünde 90 derece çevirir', () => {
    const board = boardOf([
      'abc...',
      'def...',
      'ghi...',
      '......',
      '......',
      '......',
    ].map((row) => row.replace(/[a-i]/g, (ch) => (ch === '.' ? '.' : 'B'))));
    const named = [
      ['a', 'b', 'c', '.', '.', '.'],
      ['d', 'e', 'f', '.', '.', '.'],
      ['g', 'h', 'i', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.'],
    ];
    const source = named.map((row) => row.map((ch) => (ch === '.' ? null : ch)));
    const turned = rotateQuadrant(source as Board, 0);
    expect(turned.map((row) => row.map((cell) => cell ?? '.').join(''))).toEqual([
      'gda...',
      'heb...',
      'ifc...',
      '......',
      '......',
      '......',
    ]);
    void board;
  });

  it('dört çevirme taşı eski yerine getirir', () => {
    let board = boardOf(['BW....', '.W....', '..B...', '......', '......', '......']);
    for (let i = 0; i < 4; i++) board = rotateQuadrant(board, 0);
    expect(board[0][0]).toBe('black');
    expect(board[0][1]).toBe('white');
    expect(board[1][1]).toBe('white');
    expect(board[2][2]).toBe('black');
  });

  it('boş parça yasal değildir ve konan bilye geri alınmaz', () => {
    const placed = tryPlace(initialSet(), 0, 0);
    expect(placed?.phase).toBe('rotate');
    expect(placed?.board[0][0]).toBe('black');
    expect(placed && quadrantIsEmpty(placed.board, 1)).toBe(true);
    expect(placed && tryRotate(placed, 1)).toBeNull();
    const turned = placed && tryRotate(placed, 0);
    expect(turned?.phase).toBe('place');
    expect(turned?.turn).toBe('white');
    expect(turned?.board[0][2]).toBe('black');
    expect(cellAfterRotation({ r: 0, c: 0 }, 0)).toEqual({ r: 0, c: 2 });
  });
});

describe('beşli', () => {
  it('yatay, dikey ve çapraz beşliyi görür, dörtlüyü görmez', () => {
    expect(hasRun(boardOf(['BBBBB.', '......', '......', '......', '......', '......']), 'black')).toBe(true);
    expect(hasRun(boardOf(['B.....', 'B.....', 'B.....', 'B.....', 'B.....', '......']), 'black')).toBe(true);
    expect(hasRun(boardOf(['B.....', '.B....', '..B...', '...B..', '....B.', '......']), 'black')).toBe(true);
    expect(hasRun(boardOf(['BBBB..', '......', '......', '......', '......', '......']), 'black')).toBe(false);
    expect(hasRun(boardOf(['BBBBBB', '......', '......', '......', '......', '......']), 'black')).toBe(true);
  });

  it('aynı hamlede iki renk de dizilirse hamleyi yapan kazanır', () => {
    const board = boardOf(['BBBBB.', 'WWWWW.', '......', '......', '......', '......']);
    expect(outcomeAfterMove(board, 'black')).toEqual({ winner: 'black', reason: 'own-line' });
    expect(outcomeAfterMove(board, 'white')).toEqual({ winner: 'white', reason: 'own-line' });
  });

  it('yalnız rakip dizilirse rakip kazanır', () => {
    let set = initialSet();
    set = {
      ...set,
      board: boardOf(['......', '......', '......', '.....W', '.....W', 'WWW..W']),
    };
    const done = playMove(set, 0, 0, 3);
    expect(done?.winner).toBe('white');
    expect(done?.reason).toBe('opponent-line');
    expect(done?.board[5].join(',')).toBe('white,white,white,white,white,white');
  });

  it('kendi beşlisini bozmadan tamamlayan çevirmeyi kabul eder', () => {
    let set = initialSet();
    set = {
      ...set,
      board: boardOf(['BBBB..', '......', '......', '......', '......', 'W.....']),
    };
    const done = playMove(set, 0, 4, 2);
    expect(done?.winner).toBe('black');
    expect(done?.reason).toBe('own-line');
    expect(done?.board[0][4]).toBe('black');
  });

  it('tahta dolunca ve beşli yoksa berabere biter', () => {
    const rows = ['BBWWBB', 'WWBBWW', 'BBWWBB', 'WWBBWW', 'BBWWBB', 'WWBBWW'];
    const board = boardOf(rows);
    expect(hasRun(board, 'black')).toBe(false);
    expect(hasRun(board, 'white')).toBe(false);
    expect(outcomeAfterMove(board, 'black')).toEqual({ winner: 'draw', reason: 'full' });
  });
});

describe('maç', () => {
  it('ilk sette kurayı kullanır, siyah başlar, sonraki sette renk değişir', () => {
    const match = createMatch(() => 0, 2);
    expect(match.blackPlayer).toBe(0);
    expect(match.set.turn).toBe('black');
    expect(turnPlayer(match)).toBe(0);
    const next = scripted(match, 0);
    expect(next.blackPlayer).toBe(1);
    expect(next.set.turn).toBe('black');
    expect(playerOfColor(next, 'black')).toBe(1);
  });

  it('puanı renge değil oyuncuya yazar', () => {
    const match = createMatch(() => 0.9);
    expect(match.blackPlayer).toBe(1);
    expect(colorOfPlayer(match, 0)).toBe('white');
    const next = scripted(match, 0);
    expect(next.scores).toEqual([1, 0]);
    expect(next.setWins).toEqual([1, 0]);
  });

  it('varsayılan olarak bir set alan maçı kazanır', () => {
    const match = scripted(createMatch(() => 0), 0);
    expect(match.setsToWin).toBe(1);
    expect(match.status).toBe('match_over');
    expect(match.winner).toBe(0);
    expect(match.scores).toEqual([1, 0]);
  });

  it('seçilen set sayısına ulaşınca maçı bitirir', () => {
    let match = createMatch(() => 0, 2);
    match = scripted(match, 0);
    expect(match.status).toBe('playing');
    match = scripted(match, 0);
    expect(match.status).toBe('match_over');
    expect(match.winner).toBe(0);
    expect(match.scores).toEqual([2, 0]);
    expect(match.setsPlayed).toBe(2);
  });

  it('beraberlik hedef seti doldurmaz', () => {
    let match = createMatch(() => 0, 2);
    match = scripted(match, 0);
    match = scripted(match, 'draw');
    expect(match.status).toBe('playing');
    expect(match.setWins).toEqual([1, 0]);
    match = scripted(match, 1);
    expect(match.status).toBe('playing');
    match = scripted(match, 1);
    expect(match.status).toBe('match_over');
    expect(match.winner).toBe(1);
  });

  it('beraberlikte her iki oyuncuya 0,5 yazar', () => {
    const match = scripted(createMatch(() => 0), 'draw');
    expect(match.scores).toEqual([0.5, 0.5]);
    expect(match.setWins).toEqual([0, 0]);
    expect(match.status).toBe('playing');
  });

  it('süre dolunca rakibe set verir', () => {
    const match = awardTimeout(createMatch(() => 0), 1);
    expect(match.set.winner).toBe('white');
    expect(match.set.reason).toBe('timeout');
    const settled = advanceMatch(match);
    expect(settled.scores).toEqual([0, 1]);
    expect(settled.status).toBe('match_over');
    expect(settled.winner).toBe(1);
  });
});

describe('saat', () => {
  it('hamle süresini her turda yeniler', () => {
    const clock = createClock({ mode: 'move', seconds: 30 }, 0, 1_000);
    expect(remaining(clock, 0, 11_000)).toBe(20_000);
    const next = completeTurn(clock, 11_000);
    expect(next.active).toBe(1);
    expect(remaining(next, 1, 11_000)).toBe(30_000);
  });

  it('toplam süreye artırım ekler ve set değişince süreyi taşır', () => {
    const clock = createClock({ mode: 'total', minutes: 5, increment: 3 }, 0, 0);
    const next = completeTurn(clock, 10_000);
    expect(next.banks[0]).toBe(5 * 60 * 1000 - 10_000 + 3_000);
    const set = beginSet(next, 1, 10_000);
    expect(set.active).toBe(1);
    expect(set.banks[0]).toBe(next.banks[0]);
  });
});
