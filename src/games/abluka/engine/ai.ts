import { canMove, emptyCells, findPiece, legalDestinations, opposite, SIZE, withBlock, withMove } from './board';
import type { Board, Color, Coord, Difficulty } from './types';

export interface AiChoice {
  to: Coord;
  block: Coord;
}

interface FlatMove {
  toR: number;
  toC: number;
  blockR: number;
  blockC: number;
}

class SearchTimeout extends Error {}

function toChoice(move: FlatMove): AiChoice {
  return { to: { r: move.toR, c: move.toC }, block: { r: move.blockR, c: move.blockC } };
}

function generate(board: Board, turn: Color): FlatMove[] {
  const from = findPiece(board, turn);
  const moves: FlatMove[] = [];
  for (const to of legalDestinations(board, from)) {
    const afterMove = withMove(board, from, to, turn);
    for (const block of emptyCells(afterMove)) {
      moves.push({ toR: to.r, toC: to.c, blockR: block.r, blockC: block.c });
    }
  }
  return moves;
}

function apply(board: Board, turn: Color, move: FlatMove): Board {
  const from = findPiece(board, turn);
  return withBlock(withMove(board, from, { r: move.toR, c: move.toC }, turn), {
    r: move.blockR,
    c: move.blockC,
  });
}

/** 0 devam; 1 siyah / 2 beyaz kazandı. Rakip (veya ikisi) kilitliyse hamle yapan kazanır. */
function outcome(board: Board, mover: Color): number {
  const opp = opposite(mover);
  if (!canMove(board, opp)) return mover === 'black' ? 1 : 2;
  return 0;
}

function mobility(board: Board, color: Color): number {
  return legalDestinations(board, findPiece(board, color)).length;
}

function centerBias(coord: Coord): number {
  const cr = coord.r - 3;
  const cc = coord.c - 3;
  return Math.max(0, 6 - (cr * cr + cc * cc) * 0.5);
}

function evalFor(board: Board, side: Color): number {
  const opp = opposite(side);
  const myMob = mobility(board, side);
  const oppMob = mobility(board, opp);
  let score = (myMob - oppMob) * 40;
  score += centerBias(findPiece(board, side)) * 2;
  score -= centerBias(findPiece(board, opp));
  let empty = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === null) empty++;
    }
  }
  score += empty * 0.1;
  return score;
}

function pickIndex(length: number, rng: () => number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

function findInstantWin(board: Board, side: Color): FlatMove | null {
  for (const move of generate(board, side)) {
    const next = apply(board, side, move);
    const oc = outcome(next, side);
    if ((side === 'black' && oc === 1) || (side === 'white' && oc === 2)) return move;
  }
  return null;
}

function easyPick(board: Board, side: Color, rng: () => number): FlatMove {
  const win = findInstantWin(board, side);
  if (win && rng() < 0.85) return win;
  const moves = generate(board, side);
  if (moves.length === 0) throw new Error('Yasal hamle yok');
  if (rng() < 0.35) return moves[pickIndex(moves.length, rng)];
  const ranked = moves
    .map((move) => {
      const next = apply(board, side, move);
      const oc = outcome(next, side);
      const winCode = side === 'black' ? 1 : 2;
      const loseCode = side === 'black' ? 2 : 1;
      const score =
        oc === winCode ? 1_000_000 : oc === loseCode ? -1_000_000 : evalFor(next, side);
      return { move, score };
    })
    .sort((a, b) => b.score - a.score);
  const pool = ranked.slice(0, Math.max(4, Math.ceil(ranked.length * 0.25)));
  return pool[pickIndex(pool.length, rng)].move;
}

function search(
  board: Board,
  side: Color,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  nodes: { n: number },
): number {
  if (depth === 0) return evalFor(board, side);
  if ((++nodes.n & 63) === 0 && Date.now() > deadline) throw new SearchTimeout();
  const moves = generate(board, side);
  if (moves.length === 0) return -100_000 - depth;
  let best = -Infinity;
  let a = alpha;
  const winCode = side === 'black' ? 1 : 2;
  const loseCode = side === 'black' ? 2 : 1;
  for (const move of moves) {
    const next = apply(board, side, move);
    const oc = outcome(next, side);
    let score: number;
    if (oc === winCode) score = 100_000 + depth;
    else if (oc === loseCode) score = -100_000 - depth;
    else score = -search(next, opposite(side), depth - 1, -beta, -a, deadline, nodes);
    if (score > best) best = score;
    if (best > a) a = best;
    if (a >= beta) break;
  }
  return best;
}

function deepen(board: Board, side: Color, maxDepth: number, budgetMs: number, rng: () => number): FlatMove {
  const moves = generate(board, side);
  if (moves.length === 0) throw new Error('Yasal hamle yok');
  const instant = findInstantWin(board, side);
  if (instant) return instant;
  let best = moves[0];
  const deadline = Date.now() + budgetMs;
  const nodes = { n: 0 };
  const winCode = side === 'black' ? 1 : 2;
  const loseCode = side === 'black' ? 2 : 1;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let depthBest = best;
    let depthScore = -Infinity;
    const tied: FlatMove[] = [];
    try {
      let alpha = -Infinity;
      const ordered = [best, ...moves.filter((m) => m !== best)];
      for (const move of ordered) {
        const next = apply(board, side, move);
        const oc = outcome(next, side);
        let score: number;
        if (oc === winCode) score = 100_000 + depth;
        else if (oc === loseCode) score = -100_000 - depth;
        else score = -search(next, opposite(side), depth - 1, -Infinity, -alpha, deadline, nodes);
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
  if (difficulty === 'easy') return toChoice(easyPick(board, turn, rng));
  if (difficulty === 'medium') return toChoice(deepen(board, turn, 1, 400, rng));
  return toChoice(deepen(board, turn, 2, 900, rng));
}
