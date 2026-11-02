import type { ClockView } from '../engine/clock';
import type { MatchState, PlayerId, TimerConfig } from '../engine/types';

export type { ClockView };

export interface OpenRoom {
  code: string;
  name: string;
  host: string;
  setsToWin: number;
  timer: TimerConfig;
}

export type ClientMessage =
  | { type: 'lobby' }
  | { type: 'create'; name: string; roomName?: string; timer: TimerConfig; setsToWin?: number }
  | { type: 'join'; code: string; name: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'place'; r: number; c: number }
  | { type: 'rotate'; q: number }
  | { type: 'continue' }
  | { type: 'rematch' }
  | { type: 'leave' };

export interface StateMessage {
  type: 'state';
  code: string;
  player: PlayerId;
  revision: number;
  names: [string, string];
  match: MatchState;
  clock: ClockView | null;
  connected: [boolean, boolean];
}

export type ServerMessage =
  | { type: 'rooms'; rooms: OpenRoom[] }
  | { type: 'created'; code: string; token: string; player: 0; name: string }
  | { type: 'joined'; code: string; token: string; player: PlayerId }
  | { type: 'waiting'; code: string; name: string }
  | StateMessage
  | { type: 'error'; message: string }
  | { type: 'closed'; message: string };
