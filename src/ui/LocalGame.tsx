import { useEffect, useRef, useState } from 'react';
import type { LocalConfig } from '../App';
import { chooseMove, type AiChoice } from '../engine/ai';
import { beginSet, completeTurn, createClock, pauseClock, remaining, type ClockState } from '../engine/clock';
import { advanceMatch, awardTimeout, createMatch, placeMarble, rotatePiece, turnPlayer } from '../engine/match';
import type { MatchState, PlayerId } from '../engine/types';
import { GameView } from './GameView';

const AI: PlayerId = 1;

export function LocalGame({ config, onExit }: { config: LocalConfig; onExit: () => void }) {
  const seed = useRef<{ match: MatchState; clock: ClockState } | null>(null);
  if (!seed.current) {
    const match = createMatch(Math.random, config.setsToWin);
    seed.current = { match, clock: createClock(config.timer, turnPlayer(match), Date.now()) };
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
  const applyAiRef = useRef<(move: AiChoice) => void>(() => {});

  function updateMatch(next: MatchState) {
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

  applyAiRef.current = (move) => {
    const current = matchRef.current;
    if (current.set.winner || current.set.phase !== 'place' || turnPlayer(current) !== AI) {
      setThink(false);
      return;
    }
    const placed = placeMarble(current, move.place.r, move.place.c);
    if (!placed) {
      setThink(false);
      return;
    }
    updateMatch(placed);
    setThink(false);
    window.setTimeout(() => {
      const live = matchRef.current;
      if (live.set.winner || live.set.phase !== 'rotate') return;
      spinRef.current = move.quadrant;
      setSpinQ(move.quadrant);
    }, 320);
  };

  useEffect(() => {
    if (config.mode !== 'ai') return;
    const current = matchRef.current;
    if (spinRef.current != null || thinkingRef.current) return;
    if (current.status !== 'playing' || current.set.winner || current.set.phase !== 'place') return;
    if (turnPlayer(current) !== AI) return;
    const id = ++req.current;
    setThink(true);
    const payload = {
      id,
      board: current.set.board,
      turn: current.set.turn,
      difficulty: difficultyRef.current,
    };
    const worker = new Worker(new URL('../ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<AiChoice & { id: number }>) => {
      worker.terminate();
      if (event.data.id !== req.current) return;
      applyAiRef.current(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      applyAiRef.current(chooseMove(current.set.board, current.set.turn, difficultyRef.current));
    };
    worker.postMessage(payload);
    return () => worker.terminate();
  }, [match, spinQ, config.mode]);

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
      updateMatch(awardTimeout(current, winner));
      updateClock(pauseClock(live, time));
      spinRef.current = null;
      setSpinQ(null);
      setThink(false);
      req.current += 1;
    }, 100);
    return () => window.clearInterval(id);
  }, [clock.config]);

  function onPlace(r: number, c: number) {
    const current = matchRef.current;
    if (spinRef.current != null || thinkingRef.current) return;
    if (config.mode === 'ai' && turnPlayer(current) !== 0) return;
    const next = placeMarble(current, r, c);
    if (next) updateMatch(next);
  }

  function onRotate(q: number) {
    const current = matchRef.current;
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
    const current = matchRef.current;
    if (current.set.winner) return;
    const live = clockRef.current;
    const time = Date.now();
    if (live.config.mode !== 'off' && live.active != null && remaining(live, live.active, time) <= 0) {
      const winner: PlayerId = live.active === 0 ? 1 : 0;
      updateMatch(awardTimeout(current, winner));
      updateClock(pauseClock(live, time));
      return;
    }
    const next = rotatePiece(current, q);
    if (!next) return;
    updateMatch(next);
    updateClock(next.set.winner ? pauseClock(live, time) : completeTurn(live, time));
  }

  function onContinue() {
    const next = advanceMatch(matchRef.current);
    updateMatch(next);
    if (next.status === 'playing') updateClock(beginSet(clockRef.current, turnPlayer(next), Date.now()));
  }

  function onRematch() {
    const next = createMatch(Math.random, config.setsToWin);
    req.current += 1;
    spinRef.current = null;
    setSpinQ(null);
    setThink(false);
    updateMatch(next);
    updateClock(createClock(config.timer, turnPlayer(next), Date.now()));
  }

  const showClock = clock.config.mode !== 'off';

  return (
    <GameView
      match={match}
      names={config.names}
      seat={config.mode === 'ai' ? 0 : null}
      thinking={thinking}
      spinQ={spinQ}
      clock={
        showClock
          ? { config: clock.config, remaining: [remaining(clock, 0, now), remaining(clock, 1, now)], active: clock.active }
          : null
      }
      onPlace={onPlace}
      onRotate={onRotate}
      onSpinDone={onSpinDone}
      onContinue={onContinue}
      onRematch={onRematch}
      onExit={onExit}
    />
  );
}
