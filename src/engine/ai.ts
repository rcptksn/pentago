import type { Board, Color, Coord, Difficulty } from './types';

const QUADS: number[][] = [
  [0, 1, 2, 6, 7, 8, 12, 13, 14],
  [3, 4, 5, 9, 10, 11, 15, 16, 17],
  [18, 19, 20, 24, 25, 26, 30, 31, 32],
  [21, 22, 23, 27, 28, 29, 33, 34, 35],
];

const DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

const CELL_ORDER = Array.from({ length: 36 }, (_, i) => i).sort((a, b) => {
  const ar = Math.floor(a / 6) - 2.5;
  const ac = (a % 6) - 2.5;
  const br = Math.floor(b / 6) - 2.5;
  const bc = (b % 6) - 2.5;
  return ar * ar + ac * ac - (br * br + bc * bc);
});

export interface AiChoice {
  place: Coord;
  quadrant: number;
}

interface FlatMove {
  idx: number;
  q: number;
}

class SearchTimeout extends Error {}

function toFlat(board: Board): Uint8Array {
  const flat = new Uint8Array(36);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const cell = board[r][c];
      flat[r * 6 + c] = cell === 'black' ? 1 : cell === 'white' ? 2 : 0;
    }
  }
  return flat;
}

function rotate(b: Uint8Array, q: number): Uint8Array {
  const next = new Uint8Array(b);
  const cells = QUADS[q];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      next[cells[c * 3 + (2 - r)]] = b[cells[r * 3 + c]];
    }
  }
  return next;
}

function occupiedQuadrants(b: Uint8Array): number[] {
  const open: number[] = [];
  for (let q = 0; q < 4; q++) {
    const cells = QUADS[q];
    for (let i = 0; i < 9; i++) {
      if (b[cells[i]] !== 0) {
        open.push(q);
        break;
      }
    }
  }
  return open;
}

function hasRun(b: Uint8Array, color: number): boolean {
  for (let i = 0; i < 36; i++) {
    if (b[i] !== color) continue;
    const r = (i / 6) | 0;
    const c = i % 6;
    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      const pr = r - dr;
      const pc = c - dc;
      if (pr >= 0 && pr < 6 && pc >= 0 && pc < 6 && b[pr * 6 + pc] === color) continue;
      let len = 1;
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nr < 6 && nc >= 0 && nc < 6 && b[nr * 6 + nc] === color) {
        len++;
        if (len >= 5) return true;
        nr += dr;
        nc += dc;
      }
    }
  }
  return false;
}

function isFull(b: Uint8Array): boolean {
  for (let i = 0; i < 36; i++) if (b[i] === 0) return false;
  return true;
}

/** 0 devam, 3 berabere, 1 veya 2 kazanan renk. */
function outcome(b: Uint8Array, mover: number): number {
  if (hasRun(b, mover)) return mover;
  const opp = mover === 1 ? 2 : 1;
  if (hasRun(b, opp)) return opp;
  if (isFull(b)) return 3;
  return 0;
}

function applyMove(b: Uint8Array, idx: number, q: number, side: number): Uint8Array {
  const placed = new Uint8Array(b);
  placed[idx] = side;
  return rotate(placed, q);
}

function generate(b: Uint8Array): FlatMove[] {
  const quadsAfter = (idx: number) => {
    const placed = new Uint8Array(b);
    placed[idx] = 1;
    return occupiedQuadrants(placed);
  };
  const moves: FlatMove[] = [];
  for (const idx of CELL_ORDER) {
    if (b[idx] !== 0) continue;
    for (const q of quadsAfter(idx)) moves.push({ idx, q });
  }
  return moves;
}

function patternScore(len: number, open: number): number {
  if (len >= 5) return 50000;
  if (len === 4) return open > 0 ? 1800 + open * 500 : 240;
  if (len === 3) return open === 2 ? 260 : open === 1 ? 70 : 6;
  if (len === 2) return open === 2 ? 26 : open === 1 ? 7 : 0;
  if (len === 1) return open === 2 ? 3 : 0;
  return 0;
}

function sideScore(b: Uint8Array, color: number): number {
  let score = 0;
  for (let i = 0; i < 36; i++) {
    if (b[i] !== color) continue;
    const r = (i / 6) | 0;
    const c = i % 6;
    const cr = r - 2.5;
    const cc = c - 2.5;
    score += Math.max(0, 6 - (cr * cr + cc * cc));
    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      const pr = r - dr;
      const pc = c - dc;
      if (pr >= 0 && pr < 6 && pc >= 0 && pc < 6 && b[pr * 6 + pc] === color) continue;
      let len = 0;
      let nr = r;
      let nc = c;
      while (nr >= 0 && nr < 6 && nc >= 0 && nc < 6 && b[nr * 6 + nc] === color) {
        len++;
        nr += dr;
        nc += dc;
      }
      const beforeOpen = pr >= 0 && pr < 6 && pc >= 0 && pc < 6 && b[pr * 6 + pc] === 0;
      const afterOpen = nr >= 0 && nr < 6 && nc >= 0 && nc < 6 && b[nr * 6 + nc] === 0;
      score += patternScore(len, (beforeOpen ? 1 : 0) + (afterOpen ? 1 : 0));
    }
  }
  return score;
}

function evalFor(b: Uint8Array, side: number): number {
  const opp = side === 1 ? 2 : 1;
  return sideScore(b, side) - sideScore(b, opp);
}

function toChoice(move: FlatMove): AiChoice {
  return {
    place: { r: (move.idx / 6) | 0, c: move.idx % 6 },
    quadrant: move.q,
  };
}

function findInstantWin(b: Uint8Array, side: number): FlatMove | null {
  for (const move of generate(b)) {
    const next = applyMove(b, move.idx, move.q, side);
    if (outcome(next, side) === side) return move;
  }
  return null;
}

function pickIndex(length: number, rng: () => number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

function easyPick(b: Uint8Array, side: number, rng: () => number): FlatMove {
  const win = findInstantWin(b, side);
  if (win && rng() < 0.85) return win;
  const moves = generate(b);
  if (rng() < 0.3) return moves[pickIndex(moves.length, rng)];
  const ranked = moves
    .map((move) => {
      const next = applyMove(b, move.idx, move.q, side);
      const oc = outcome(next, side);
      const score = oc === side ? 1_000_000 : oc === 3 ? 0 : oc !== 0 ? -1_000_000 : evalFor(next, side);
      return { move, score };
    })
    .sort((a, b2) => b2.score - a.score);
  const pool = ranked.slice(0, Math.max(4, Math.ceil(ranked.length * 0.35)));
  return pool[pickIndex(pool.length, rng)].move;
}

function search(
  b: Uint8Array,
  side: number,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  nodes: { n: number },
): number {
  if (depth === 0) return evalFor(b, side);
  if ((++nodes.n & 255) === 0 && Date.now() > deadline) throw new SearchTimeout();
  const moves = generate(b);
  if (moves.length === 0) return evalFor(b, side);
  let best = -Infinity;
  let a = alpha;
  for (const move of moves) {
    const next = applyMove(b, move.idx, move.q, side);
    const oc = outcome(next, side);
    let score: number;
    if (oc === side) score = 100_000 + depth;
    else if (oc === 3) score = 0;
    else if (oc !== 0) score = -100_000 - depth;
    else score = -search(next, side === 1 ? 2 : 1, depth - 1, -beta, -a, deadline, nodes);
    if (score > best) best = score;
    if (best > a) a = best;
    if (a >= beta) break;
  }
  return best;
}

function deepen(
  b: Uint8Array,
  side: number,
  maxDepth: number,
  budgetMs: number,
  rng: () => number,
): FlatMove {
  const moves = generate(b);
  const instant = findInstantWin(b, side);
  if (instant) return instant;
  let best = moves[0];
  const deadline = Date.now() + budgetMs;
  const nodes = { n: 0 };
  for (let depth = 1; depth <= maxDepth; depth++) {
    let depthBest = best;
    let depthScore = -Infinity;
    const tied: FlatMove[] = [];
    try {
      let alpha = -Infinity;
      const ordered = [best, ...moves.filter((m) => m !== best)];
      for (const move of ordered) {
        const next = applyMove(b, move.idx, move.q, side);
        const oc = outcome(next, side);
        let score: number;
        if (oc === side) score = 100_000 + depth;
        else if (oc === 3) score = 0;
        else if (oc !== 0) score = -100_000 - depth;
        else score = -search(next, side === 1 ? 2 : 1, depth - 1, -Infinity, -alpha, deadline, nodes);
        if (score > depthScore) {
          depthScore = score;
          depthBest = move;
          tied.length = 0;
          tied.push(move);
          alpha = score;
        } else if (score === depthScore) tied.push(move);
      }
      best = tied.length > 1 ? tied[pickIndex(tied.length, rng)] : depthBest;
    } catch (err) {
      if (err instanceof SearchTimeout) break;
      throw err;
    }
  }
  return best;
}

export function chooseMove(
  board: Board,
  turn: Color,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): AiChoice {
  const flat = toFlat(board);
  const side = turn === 'black' ? 1 : 2;
  const moves = generate(flat);
  if (moves.length === 0) throw new Error('Yasal hamle yok');
  if (difficulty === 'easy') return toChoice(easyPick(flat, side, rng));
  if (difficulty === 'medium') return toChoice(deepen(flat, side, 2, 700, rng));
  return toChoice(deepen(flat, side, 3, 1500, rng));
}
