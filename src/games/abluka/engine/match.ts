import { sanitizeSetsToWin } from '../../../engine/shared';
import { checkImmobilizedAtTurnStart, initialSet, tryMove, tryPlaceBlock } from './rules';
import type { Color, EndReason, MatchState, PlayerId, SetState } from './types';

export { sanitizeSetsToWin };

export function createMatch(rng: () => number = Math.random, setsToWin = 1): MatchState {
  const blackPlayer: PlayerId = rng() < 0.5 ? 0 : 1;
  return {
    blackPlayer,
    setsToWin: sanitizeSetsToWin(setsToWin),
    scores: [0, 0],
    setWins: [0, 0],
    setsPlayed: 0,
    history: [],
    status: 'playing',
    winner: null,
    set: checkImmobilizedAtTurnStart(initialSet()),
  };
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

export function colorOfPlayer(match: MatchState, player: PlayerId): Color {
  return match.blackPlayer === player ? 'black' : 'white';
}

export function playerOfColor(match: MatchState, color: Color): PlayerId {
  return color === 'black' ? match.blackPlayer : otherPlayer(match.blackPlayer);
}

export function turnPlayer(match: MatchState): PlayerId {
  return playerOfColor(match, match.set.turn);
}

export function pointsForWinner(match: MatchState, winner: Color): [number, number] {
  const player = playerOfColor(match, winner);
  return player === 0 ? [1, 0] : [0, 1];
}

export function withSet(match: MatchState, set: SetState): MatchState {
  return { ...match, set };
}

export function movePiece(match: MatchState, r: number, c: number): MatchState | null {
  if (match.status !== 'playing' || match.set.winner) return null;
  const set = tryMove(match.set, r, c);
  if (!set) return null;
  return { ...match, set };
}

export function placeBlock(match: MatchState, r: number, c: number): MatchState | null {
  if (match.status !== 'playing' || match.set.winner) return null;
  const set = tryPlaceBlock(match.set, r, c);
  if (!set) return null;
  return { ...match, set };
}

export function awardTimeout(match: MatchState, winner: PlayerId): MatchState {
  if (match.status !== 'playing' || match.set.winner) return match;
  return {
    ...match,
    set: {
      ...match.set,
      winner: colorOfPlayer(match, winner),
      reason: 'timeout',
      pendingFrom: match.set.pendingFrom,
      pendingTo: match.set.pendingTo,
    },
  };
}

export function advanceMatch(match: MatchState): MatchState {
  if (match.status !== 'playing' || !match.set.winner || !match.set.reason) return match;
  const gained = pointsForWinner(match, match.set.winner);
  const scores: [number, number] = [match.scores[0] + gained[0], match.scores[1] + gained[1]];
  const setWins: [number, number] = [match.setWins[0], match.setWins[1]];
  const winnerPlayer = playerOfColor(match, match.set.winner);
  setWins[winnerPlayer] += 1;
  const setsPlayed = match.setsPlayed + 1;
  const reason: EndReason = match.set.reason;
  const history = [
    ...match.history,
    {
      winner: match.set.winner,
      winnerPlayer,
      blackPlayer: match.blackPlayer,
      points: gained,
      reason,
    },
  ];
  const winner: PlayerId | null = setWins[0] >= match.setsToWin ? 0 : setWins[1] >= match.setsToWin ? 1 : null;
  if (winner !== null) {
    return {
      ...match,
      scores,
      setWins,
      setsPlayed,
      history,
      status: 'match_over',
      winner,
    };
  }
  return {
    ...match,
    blackPlayer: otherPlayer(match.blackPlayer),
    scores,
    setWins,
    setsPlayed,
    history,
    status: 'playing',
    winner: null,
    set: checkImmobilizedAtTurnStart(initialSet()),
  };
}
