import { useEffect, useRef, useState } from 'react';
import type { LocalConfig } from '../App';
import { beginSet, completeTurn, createClock, pauseClock, remaining, type ClockState } from '../engine/clock';
import type { PlayerId } from '../engine/shared';
import { chooseMove as chooseAbluka, type AiChoice as AblukaChoice } from '../games/abluka/engine/ai';
import * as abluka from '../games/abluka/engine/match';
import type { MatchState as AblukaMatch } from '../games/abluka/engine/types';
import { chooseMove as choosePentago, type AiChoice as PentagoChoice } from '../games/pentago/engine/ai';
import * as pentago from '../games/pentago/engine/match';
import type { MatchState as PentagoMatch } from '../games/pentago/engine/types';
import { GameView } from './GameView';

const AI: PlayerId = 1;

type AnyMatch = PentagoMatch | AblukaMatch;

export function LocalGame({ config, onExit }: { config: LocalConfig; onExit: () => void }) {
  const seed = useRef<{ match: AnyMatch; clock: ClockState } | null>(null);
  if (!seed.current) {
    const match =
      config.gameId === 'abluka'
        ? abluka.createMatch(Math.random, config.setsToWin)
        : pentago.createMatch(Math.random, config.setsToWin);
    const turn =
      config.gameId === 'abluka' ? abluka.turnPlayer(match as AblukaMatch) : pentago.turnPlayer(match as PentagoMatch);
    seed.current = { match, clock: createClock(config.timer, turn, Date.now()) };
  }
  const [match, setMatch] = useState(seed.current.match);
  const [clock, setClock] = useState(seed.current.clock);
  const [spinQ, setSpinQ] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const matchRef = useRef(match);
  const clockRef = useRef(clock);
  const spinRef = useRef<number | null>(null);
  const thinkingRef = useRef(false);
  const req = useRef(0);
  const difficultyRef = useRef(config.difficulty);
  difficultyRef.current = config.difficulty;
  const applyPentagoAi = useRef<(move: PentagoChoice) => void>(() => {});
  const applyAblukaAi = useRef<(move: AblukaChoice) => void>(() => {});

  function turnPlayer(current: AnyMatch): PlayerId {
    return config.gameId === 'abluka'
      ? abluka.turnPlayer(current as AblukaMatch)
      : pentago.turnPlayer(current as PentagoMatch);
  }

  function updateMatch(next: AnyMatch) {
    matchRef.current = next;
    setMatch(next);
  }
  function updateClock(next: ClockState) {
    clockRef.current = next;
    setClock(next);
  }
  function setThink(value: boolean) {
    thinkingRef.current = value;
    setThinking(value);
  }

  applyPentagoAi.current = (move) => {
    const current = matchRef.current as PentagoMatch;
    if (current.set.winner || current.set.phase !== 'place' || turnPlayer(current) !== AI) {
      setThink(false);
      return;
    }
    const placed = pentago.placeMarble(current, move.place.r, move.place.c);
    if (!placed) {
      setThink(false);
      return;
    }
    updateMatch(placed);
    setThink(false);
    window.setTimeout(() => {
      const live = matchRef.current as PentagoMatch;
      if (live.set.winner || live.set.phase !== 'rotate') return;
      spinRef.current = move.quadrant;
      setSpinQ(move.quadrant);
    }, 320);
  };

  applyAblukaAi.current = (move) => {
    const current = matchRef.current as AblukaMatch;
    if (current.set.winner || current.set.phase !== 'move' || turnPlayer(current) !== AI) {
      setThink(false);
      return;
    }
    const moved = abluka.movePiece(current, move.to.r, move.to.c);
    if (!moved) {
      setThink(false);
      return;
    }
    updateMatch(moved);
    window.setTimeout(() => {
      const live = matchRef.current as AblukaMatch;
      if (live.set.winner || live.set.phase !== 'block') {
        setThink(false);
        return;
      }
      const blocked = abluka.placeBlock(live, move.block.r, move.block.c);
      setThink(false);
      if (!blocked) return;
      const time = Date.now();
      updateMatch(blocked);
      updateClock(blocked.set.winner ? pauseClock(clockRef.current, time) : completeTurn(clockRef.current, time));
    }, 280);
  };

  useEffect(() => {
    if (config.mode !== 'ai') return;
    const current = matchRef.current;
    if (spinRef.current != null || thinkingRef.current) return;
    if (current.status !== 'playing' || current.set.winner) return;
    if (config.gameId === 'pentago' && (current as PentagoMatch).set.phase !== 'place') return;
    if (config.gameId === 'abluka' && (current as AblukaMatch).set.phase !== 'move') return;
    if (turnPlayer(current) !== AI) return;
    const id = ++req.current;
    setThink(true);
    const payload = {
      id,
      gameId: config.gameId,
      board: current.set.board,
      turn: current.set.turn,
      difficulty: difficultyRef.current,
    };
    const worker = new Worker(new URL('../ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number } & (PentagoChoice | AblukaChoice)>) => {
      worker.terminate();
      if (event.data.id !== req.current) return;
      if (config.gameId === 'abluka' && 'to' in event.data) applyAblukaAi.current(event.data);
      else if (config.gameId === 'pentago' && 'place' in event.data) applyPentagoAi.current(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      if (config.gameId === 'abluka') {
        applyAblukaAi.current(
          chooseAbluka(
            (current as AblukaMatch).set.board,
            (current as AblukaMatch).set.turn,
            difficultyRef.current,
          ),
        );
      } else {
        applyPentagoAi.current(
          choosePentago(
            (current as PentagoMatch).set.board,
            (current as PentagoMatch).set.turn,
            difficultyRef.current,
          ),
        );
      }
    };
    worker.postMessage(payload);
    return () => worker.terminate();
  }, [match, spinQ, config.mode, config.gameId]);

  useEffect(() => {
    if (clock.config.mode === 'off') return;
    const id = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      const live = clockRef.current;
      const current = matchRef.current;
      if (!live.running || live.active == null || current.set.winner || current.status !== 'playing') return;
      if (remaining(live, live.active, time) > 0) return;
      const winner: PlayerId = live.active === 0 ? 1 : 0;
      if (config.gameId === 'abluka') updateMatch(abluka.awardTimeout(current as AblukaMatch, winner));
      else updateMatch(pentago.awardTimeout(current as PentagoMatch, winner));
      updateClock(pauseClock(live, time));
      spinRef.current = null;
      setSpinQ(null);
      setThink(false);
      req.current += 1;
    }, 100);
    return () => window.clearInterval(id);
  }, [clock.config, config.gameId]);

  function onPlace(r: number, c: number) {
    const current = matchRef.current as PentagoMatch;
    if (spinRef.current != null || thinkingRef.current) return;
    if (config.mode === 'ai' && turnPlayer(current) !== 0) return;
    const next = pentago.placeMarble(current, r, c);
    if (next) updateMatch(next);
  }

  function onRotate(q: number) {
    const current = matchRef.current as PentagoMatch;
    if (spinRef.current != null || thinkingRef.current) return;
    if (config.mode === 'ai' && turnPlayer(current) !== 0) return;
    spinRef.current = q;
    setSpinQ(q);
  }

  function onSpinDone() {
    const q = spinRef.current;
    if (q == null) return;
    spinRef.current = null;
    setSpinQ(null);
    const current = matchRef.current as PentagoMatch;
    if (current.set.winner) return;
    const live = clockRef.current;
    const time = Date.now();
    if (live.config.mode !== 'off' && live.active != null && remaining(live, live.active, time) <= 0) {
      const winner: PlayerId = live.active === 0 ? 1 : 0;
      updateMatch(pentago.awardTimeout(current, winner));
      updateClock(pauseClock(live, time));
      return;
    }
    const next = pentago.rotatePiece(current, q);
    if (!next) return;
    updateMatch(next);
    updateClock(next.set.winner ? pauseClock(live, time) : completeTurn(live, time));
  }

  function onAblukaCell(r: number, c: number) {
    const current = matchRef.current as AblukaMatch;
    if (thinkingRef.current) return;
    if (config.mode === 'ai' && turnPlayer(current) !== 0) return;
    if (current.set.phase === 'move') {
      const next = abluka.movePiece(current, r, c);
      if (next) updateMatch(next);
      return;
    }
    const live = clockRef.current;
    const time = Date.now();
    if (live.config.mode !== 'off' && live.active != null && remaining(live, live.active, time) <= 0) {
      const winner: PlayerId = live.active === 0 ? 1 : 0;
      updateMatch(abluka.awardTimeout(current, winner));
      updateClock(pauseClock(live, time));
      return;
    }
    const next = abluka.placeBlock(current, r, c);
    if (!next) return;
    updateMatch(next);
    updateClock(next.set.winner ? pauseClock(live, time) : completeTurn(live, time));
  }

  function onContinue() {
    const next =
      config.gameId === 'abluka'
        ? abluka.advanceMatch(matchRef.current as AblukaMatch)
        : pentago.advanceMatch(matchRef.current as PentagoMatch);
    updateMatch(next);
    if (next.status === 'playing') updateClock(beginSet(clockRef.current, turnPlayer(next), Date.now()));
  }

  function onRematch() {
    const next =
      config.gameId === 'abluka'
        ? abluka.createMatch(Math.random, config.setsToWin)
        : pentago.createMatch(Math.random, config.setsToWin);
    req.current += 1;
    spinRef.current = null;
    setSpinQ(null);
    setThink(false);
    updateMatch(next);
    updateClock(createClock(config.timer, turnPlayer(next), Date.now()));
  }

  const showClock = clock.config.mode !== 'off';
  const clockView = showClock
    ? { config: clock.config, remaining: [remaining(clock, 0, now), remaining(clock, 1, now)] as [number, number], active: clock.active }
    : null;

  if (config.gameId === 'abluka') {
    return (
      <GameView
        gameId="abluka"
        match={match as AblukaMatch}
        names={config.names}
        seat={config.mode === 'ai' ? 0 : null}
        thinking={thinking}
        clock={clockView}
        characters={config.characters}
        onCell={onAblukaCell}
        onContinue={onContinue}
        onRematch={onRematch}
        onExit={onExit}
      />
    );
  }

  return (
    <GameView
      gameId="pentago"
      match={match as PentagoMatch}
      names={config.names}
      seat={config.mode === 'ai' ? 0 : null}
      thinking={thinking}
      spinQ={spinQ}
      clock={clockView}
      onPlace={onPlace}
      onRotate={onRotate}
      onSpinDone={onSpinDone}
      onContinue={onContinue}
      onRematch={onRematch}
      onExit={onExit}
    />
  );
}
