import type { ClockView } from '../engine/clock';
import type { GameId, PlayerId, TimerConfig } from '../engine/shared';
import type { CharacterId } from '../games/abluka/characters';
import type { MatchState as AblukaMatch } from '../games/abluka/engine/types';
import type { MatchState as PentagoMatch } from '../games/pentago/engine/types';

export type { ClockView };

export interface OpenRoom {
  code: string;
  name: string;
  host: string;
  gameId: GameId;
  setsToWin: number;
  timer: TimerConfig;
}

export type ClientMessage =
  | { type: 'lobby'; gameId?: GameId }
  | {
      type: 'create';
      gameId: GameId;
      name: string;
      roomName?: string;
      timer: TimerConfig;
      setsToWin?: number;
      characterId?: CharacterId;
    }
  | { type: 'join'; code: string; name: string; characterId?: CharacterId }
  | { type: 'resume'; code: string; token: string }
  | { type: 'place'; r: number; c: number }
  | { type: 'rotate'; q: number }
  | { type: 'abluka-move'; r: number; c: number }
  | { type: 'abluka-block'; r: number; c: number }
  | { type: 'continue' }
  | { type: 'rematch' }
  | { type: 'leave' };

export interface StateMessage {
  type: 'state';
  code: string;
  gameId: GameId;
  player: PlayerId;
  revision: number;
  names: [string, string];
  characters?: [CharacterId, CharacterId];
  match: PentagoMatch | AblukaMatch;
  clock: ClockView | null;
  connected: [boolean, boolean];
}

export type ServerMessage =
  | { type: 'rooms'; gameId: GameId; rooms: OpenRoom[] }
  | { type: 'created'; code: string; token: string; player: 0; name: string; gameId: GameId }
  | { type: 'joined'; code: string; token: string; player: PlayerId; gameId: GameId }
  | { type: 'waiting'; code: string; name: string; gameId: GameId }
  | StateMessage
  | { type: 'error'; message: string }
  | { type: 'closed'; message: string };
