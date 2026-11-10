import type { PlayerId, TimerConfig } from './shared';

export interface ClockState {
  config: TimerConfig;
  banks: [number, number];
  active: PlayerId | null;
  running: boolean;
  startedAt: number;
}

export interface ClockView {
  config: TimerConfig;
  remaining: [number, number];
  active: PlayerId | null;
  running: boolean;
  serverNow: number;
}

export function createClock(config: TimerConfig, active: PlayerId, now: number): ClockState {
  let banks: [number, number] = [0, 0];
  if (config.mode === 'move') {
    const ms = config.seconds * 1000;
    banks = [ms, ms];
  } else if (config.mode === 'total') {
    const ms = config.minutes * 60 * 1000;
    banks = [ms, ms];
  }
  return {
    config,
    banks,
    active,
    running: config.mode !== 'off',
    startedAt: now,
  };
}

export function remaining(clock: ClockState, player: PlayerId, now: number): number {
  if (clock.config.mode === 'off') return Number.POSITIVE_INFINITY;
  let left = clock.banks[player];
  if (clock.running && clock.active === player) {
    left -= now - clock.startedAt;
  }
  return left;
}

export function pauseClock(clock: ClockState, now: number): ClockState {
  if (!clock.running || clock.active == null || clock.config.mode === 'off') {
    return { ...clock, running: false };
  }
  const banks: [number, number] = [clock.banks[0], clock.banks[1]];
  banks[clock.active] = Math.max(0, banks[clock.active] - (now - clock.startedAt));
  return { ...clock, banks, running: false };
}

export function resumeClock(clock: ClockState, now: number): ClockState {
  if (clock.config.mode === 'off' || clock.active == null) return { ...clock, running: false };
  return { ...clock, running: true, startedAt: now };
}

export function completeTurn(clock: ClockState, now: number): ClockState {
  const paused = pauseClock(clock, now);
  if (paused.active == null || paused.config.mode === 'off') return paused;
  const next: PlayerId = paused.active === 0 ? 1 : 0;
  const banks: [number, number] = [paused.banks[0], paused.banks[1]];
  if (paused.config.mode === 'total') {
    banks[paused.active] += paused.config.increment * 1000;
  } else {
    banks[next] = paused.config.seconds * 1000;
  }
  return { ...paused, banks, active: next, running: true, startedAt: now };
}

export function beginSet(clock: ClockState, active: PlayerId, now: number): ClockState {
  const paused = pauseClock(clock, now);
  const banks: [number, number] = [paused.banks[0], paused.banks[1]];
  if (paused.config.mode === 'move') {
    banks[active] = paused.config.seconds * 1000;
  }
  if (paused.config.mode === 'off') {
    return { ...paused, banks, active, running: false, startedAt: now };
  }
  return { ...paused, banks, active, running: true, startedAt: now };
}

export function clockView(clock: ClockState, now: number): ClockView {
  return {
    config: clock.config,
    remaining: [remaining(clock, 0, now), remaining(clock, 1, now)],
    active: clock.active,
    running: clock.running,
    serverNow: now,
  };
}

export function sanitizeTimer(input: TimerConfig | null | undefined): TimerConfig {
  if (!input || input.mode === 'off') return { mode: 'off' };
  if (input.mode === 'move') {
    const seconds = input.seconds === 60 || input.seconds === 90 ? input.seconds : 30;
    return { mode: 'move', seconds };
  }
  const minutes = input.minutes === 3 || input.minutes === 10 ? input.minutes : 5;
  const increment = input.increment === 3 || input.increment === 5 ? input.increment : 0;
  return { mode: 'total', minutes, increment };
}
