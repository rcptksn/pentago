import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer, type WebSocket as WebSocketConnection } from 'ws';
import {
  beginSet,
  clockView,
  completeTurn,
  createClock,
  pauseClock,
  remaining,
  resumeClock,
  sanitizeTimer,
  type ClockState,
} from '../src/engine/clock';
import type { GameId, PlayerId, TimerConfig } from '../src/engine/shared';
import { pickOtherCharacter, sanitizeCharacterId, type CharacterId } from '../src/games/abluka/characters';
import * as abluka from '../src/games/abluka/engine/match';
import type { MatchState as AblukaMatch } from '../src/games/abluka/engine/types';
import * as pentago from '../src/games/pentago/engine/match';
import type { MatchState as PentagoMatch } from '../src/games/pentago/engine/types';
import type { ClientMessage, OpenRoom, ServerMessage } from '../src/net/protocol';

const PORT = Number(process.env.PORT) || 3001;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type AnyMatch = PentagoMatch | AblukaMatch;

interface Room {
  code: string;
  title: string;
  gameId: GameId;
  names: [string, string | null];
  characters: [CharacterId | null, CharacterId | null];
  tokens: [string, string | null];
  sockets: [WebSocketConnection | null, WebSocketConnection | null];
  timer: TimerConfig;
  setsToWin: number;
  match: AnyMatch | null;
  clock: ClockState | null;
  revision: number;
  disconnectedAt: [number | null, number | null];
  createdAt: number;
}

const rooms = new Map<string, Room>();
const seats = new WeakMap<WebSocketConnection, { code: string; player: PlayerId }>();
const watchers = new Map<WebSocketConnection, GameId>();

function send(socket: WebSocketConnection, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sanitizeName(name: unknown, fallback: string, max = 18): string {
  if (typeof name !== 'string') return fallback;
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, max);
  return clean || fallback;
}

function sanitizeGameId(value: unknown): GameId {
  return value === 'abluka' ? 'abluka' : 'pentago';
}

function openRooms(gameId: GameId): OpenRoom[] {
  const list: OpenRoom[] = [];
  for (const room of rooms.values()) {
    if (room.gameId !== gameId || room.names[1] || !room.sockets[0]) continue;
    list.push({
      code: room.code,
      name: room.title,
      host: room.names[0],
      gameId: room.gameId,
      setsToWin: room.setsToWin,
      timer: room.timer,
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function publishLobby(gameId?: GameId) {
  const targets = gameId ? ([gameId] as GameId[]) : (['pentago', 'abluka'] as GameId[]);
  for (const id of targets) {
    const message: ServerMessage = { type: 'rooms', gameId: id, rooms: openRooms(id) };
    for (const [socket, watched] of watchers) {
      if (watched !== id) continue;
      if (socket.readyState !== WebSocket.OPEN) {
        watchers.delete(socket);
        continue;
      }
      send(socket, message);
    }
  }
}

function makeCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return rooms.has(code) ? makeCode() : code;
}

function bothConnected(room: Room): boolean {
  return Boolean(room.sockets[0] && room.sockets[1]);
}

function turnPlayer(room: Room, match: AnyMatch): PlayerId {
  return room.gameId === 'abluka'
    ? abluka.turnPlayer(match as AblukaMatch)
    : pentago.turnPlayer(match as PentagoMatch);
}

function broadcast(room: Room) {
  if (!room.match) return;
  room.revision += 1;
  const now = Date.now();
  const connected: [boolean, boolean] = [Boolean(room.sockets[0]), Boolean(room.sockets[1])];
  for (const player of [0, 1] as const) {
    const socket = room.sockets[player];
    if (!socket) continue;
    const characters =
      room.gameId === 'abluka' && room.characters[0] && room.characters[1]
        ? ([room.characters[0], room.characters[1]] as [CharacterId, CharacterId])
        : undefined;
    send(socket, {
      type: 'state',
      code: room.code,
      gameId: room.gameId,
      player,
      revision: room.revision,
      names: [room.names[0], room.names[1] ?? 'Rakip'],
      characters,
      match: room.match,
      clock: room.clock ? clockView(room.clock, now) : null,
      connected,
    });
  }
}

function settleClock(room: Room, previous: AnyMatch, next: AnyMatch) {
  if (!room.clock) return;
  const now = Date.now();
  if (next.set.winner || next.status !== 'playing') {
    room.clock = pauseClock(room.clock, now);
    return;
  }
  if (room.gameId === 'pentago') {
    const prev = previous as PentagoMatch;
    const cur = next as PentagoMatch;
    if (prev.set.phase === 'rotate' && cur.set.phase === 'place' && !cur.set.winner) {
      room.clock = completeTurn(room.clock, now);
    }
    return;
  }
  const prev = previous as AblukaMatch;
  const cur = next as AblukaMatch;
  if (prev.set.phase === 'block' && cur.set.phase === 'move' && !cur.set.winner) {
    room.clock = completeTurn(room.clock, now);
  }
}

function ensureRunning(room: Room) {
  if (!room.clock || !room.match || room.match.set.winner || room.match.status !== 'playing') return;
  const now = Date.now();
  if (bothConnected(room)) {
    if (!room.clock.running && room.clock.config.mode !== 'off') room.clock = resumeClock(room.clock, now);
  } else if (room.clock.running) {
    room.clock = pauseClock(room.clock, now);
  }
}

function startMatch(room: Room) {
  const now = Date.now();
  room.match =
    room.gameId === 'abluka'
      ? abluka.createMatch(Math.random, room.setsToWin)
      : pentago.createMatch(Math.random, room.setsToWin);
  room.clock = createClock(room.timer, turnPlayer(room, room.match), now);
  if (!bothConnected(room)) room.clock = pauseClock(room.clock, now);
}

function attach(socket: WebSocketConnection, room: Room, player: PlayerId) {
  watchers.delete(socket);
  const previous = room.sockets[player];
  if (previous && previous !== socket) {
    seats.delete(previous);
    previous.close();
  }
  room.sockets[player] = socket;
  room.disconnectedAt[player] = null;
  seats.set(socket, { code: room.code, player });
  ensureRunning(room);
}

function handle(socket: WebSocketConnection, message: ClientMessage) {
  if (message.type === 'lobby') {
    if (seats.has(socket)) return;
    const gameId = sanitizeGameId(message.gameId);
    watchers.set(socket, gameId);
    send(socket, { type: 'rooms', gameId, rooms: openRooms(gameId) });
    return;
  }

  if (message.type === 'create') {
    const host = sanitizeName(message.name, 'Oyuncu 1');
    const gameId = sanitizeGameId(message.gameId);
    const room: Room = {
      code: makeCode(),
      title: sanitizeName(message.roomName, host, 24),
      gameId,
      names: [host, null],
      characters: [gameId === 'abluka' ? sanitizeCharacterId(message.characterId) : null, null],
      tokens: [randomUUID(), null],
      sockets: [null, null],
      timer: sanitizeTimer(message.timer),
      setsToWin:
        gameId === 'abluka'
          ? abluka.sanitizeSetsToWin(message.setsToWin)
          : pentago.sanitizeSetsToWin(message.setsToWin),
      match: null,
      clock: null,
      revision: 0,
      disconnectedAt: [null, null],
      createdAt: Date.now(),
    };
    rooms.set(room.code, room);
    attach(socket, room, 0);
    send(socket, {
      type: 'created',
      code: room.code,
      token: room.tokens[0]!,
      player: 0,
      name: room.title,
      gameId,
    });
    send(socket, { type: 'waiting', code: room.code, name: room.title, gameId });
    publishLobby(gameId);
    return;
  }

  if (message.type === 'join') {
    const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
    const room = rooms.get(code);
    if (!room || !room.sockets[0]) {
      send(socket, { type: 'error', message: 'Oda bulunamadı.' });
      const watched = watchers.get(socket);
      if (watched) send(socket, { type: 'rooms', gameId: watched, rooms: openRooms(watched) });
      return;
    }
    if (room.names[1]) {
      send(socket, { type: 'error', message: 'Oda dolu.' });
      const watched = watchers.get(socket);
      if (watched) send(socket, { type: 'rooms', gameId: watched, rooms: openRooms(watched) });
      return;
    }
    room.names[1] = sanitizeName(message.name, 'Oyuncu 2');
    if (room.gameId === 'abluka') {
      const hostChar = room.characters[0] ?? 'recep';
      let guest = sanitizeCharacterId(message.characterId, pickOtherCharacter(hostChar));
      if (guest === hostChar) guest = pickOtherCharacter(hostChar);
      room.characters[1] = guest;
    }
    room.tokens[1] = randomUUID();
    attach(socket, room, 1);
    startMatch(room);
    send(socket, { type: 'joined', code: room.code, token: room.tokens[1]!, player: 1, gameId: room.gameId });
    broadcast(room);
    publishLobby(room.gameId);
    return;
  }

  if (message.type === 'resume') {
    const room = rooms.get(message.code);
    if (!room) {
      send(socket, { type: 'error', message: 'Oda bulunamadı.' });
      return;
    }
    const player = room.tokens[0] === message.token ? 0 : room.tokens[1] === message.token ? 1 : null;
    if (player == null) {
      send(socket, { type: 'error', message: 'Oturum tanınmadı.' });
      return;
    }
    attach(socket, room, player);
    send(socket, { type: 'joined', code: room.code, token: message.token, player, gameId: room.gameId });
    if (!room.match) {
      send(socket, { type: 'waiting', code: room.code, name: room.title, gameId: room.gameId });
      publishLobby(room.gameId);
    } else broadcast(room);
    return;
  }

  const seat = seats.get(socket);
  const room = seat ? rooms.get(seat.code) : undefined;
  if (!seat || !room) {
    send(socket, { type: 'error', message: 'Önce bir odaya gir.' });
    return;
  }

  if (message.type === 'leave') {
    const other = room.sockets[seat.player === 0 ? 1 : 0];
    if (other) send(other, { type: 'closed', message: 'Rakip odadan ayrıldı.' });
    room.sockets[0]?.close();
    room.sockets[1]?.close();
    rooms.delete(room.code);
    publishLobby(room.gameId);
    return;
  }

  if (!room.match) {
    send(socket, { type: 'error', message: 'Rakip henüz katılmadı.' });
    return;
  }

  const isPentagoMove = message.type === 'place' || message.type === 'rotate';
  const isAblukaMove = message.type === 'abluka-move' || message.type === 'abluka-block';
  if (isPentagoMove || isAblukaMove) {
    if ((isPentagoMove && room.gameId !== 'pentago') || (isAblukaMove && room.gameId !== 'abluka')) {
      send(socket, { type: 'error', message: 'Bu hamle bu oyun için geçersiz.' });
      return;
    }
    if (!bothConnected(room)) {
      send(socket, { type: 'error', message: 'Rakip bağlı değil.' });
      broadcast(room);
      return;
    }
    if (room.match.set.winner || room.match.status !== 'playing') {
      send(socket, { type: 'error', message: 'Bu set kapandı.' });
      return;
    }
    if (turnPlayer(room, room.match) !== seat.player) {
      send(socket, { type: 'error', message: 'Sıra sende değil.' });
      return;
    }
    let next: AnyMatch | null = null;
    if (message.type === 'place') next = pentago.placeMarble(room.match as PentagoMatch, message.r, message.c);
    else if (message.type === 'rotate') next = pentago.rotatePiece(room.match as PentagoMatch, message.q);
    else if (message.type === 'abluka-move') next = abluka.movePiece(room.match as AblukaMatch, message.r, message.c);
    else if (message.type === 'abluka-block') next = abluka.placeBlock(room.match as AblukaMatch, message.r, message.c);
    if (!next) {
      send(socket, { type: 'error', message: 'Bu hamle geçersiz.' });
      broadcast(room);
      return;
    }
    settleClock(room, room.match, next);
    room.match = next;
    broadcast(room);
    return;
  }

  if (message.type === 'continue') {
    const next =
      room.gameId === 'abluka'
        ? abluka.advanceMatch(room.match as AblukaMatch)
        : pentago.advanceMatch(room.match as PentagoMatch);
    if (next === room.match) return;
    room.match = next;
    if (room.clock && next.status === 'playing') {
      room.clock = beginSet(room.clock, turnPlayer(room, next), Date.now());
      ensureRunning(room);
    }
    broadcast(room);
    return;
  }

  if (message.type === 'rematch') {
    if (room.match.status !== 'match_over') return;
    startMatch(room);
    broadcast(room);
  }
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

const FILE_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function insideApp(file: string): boolean {
  return file === appRoot || file.startsWith(appRoot + sep);
}

function sendFile(res: ServerResponse, file: string) {
  res.writeHead(200, { 'content-type': FILE_TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const raw = req.url?.split('?')[0] ?? '/';
  if (raw === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  let pathname = '/';
  try {
    pathname = decodeURIComponent(raw);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = resolve(appRoot, `.${requested}`);
  if (!insideApp(file)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file);
    return;
  }
  if (extname(pathname)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const index = join(appRoot, 'index.html');
  if (!existsSync(index)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Arayüz derlenmedi.');
    return;
  }
  sendFile(res, index);
});

const wss = new WebSocketServer({ server });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Salon sunucusu ${PORT} portunda`);
});

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(String(data)) as ClientMessage;
      handle(socket, message);
    } catch {
      send(socket, { type: 'error', message: 'Mesaj okunamadı.' });
    }
  });

  socket.on('close', () => {
    watchers.delete(socket);
    const seat = seats.get(socket);
    if (!seat) return;
    const room = rooms.get(seat.code);
    if (!room || room.sockets[seat.player] !== socket) return;
    room.sockets[seat.player] = null;
    room.disconnectedAt[seat.player] = Date.now();
    if (room.clock?.running) room.clock = pauseClock(room.clock, Date.now());
    if (room.match) broadcast(room);
    else publishLobby(room.gameId);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.match && room.clock && room.clock.running && room.clock.active != null && !room.match.set.winner) {
      if (remaining(room.clock, room.clock.active, now) <= 0) {
        const winner = room.clock.active === 0 ? 1 : 0;
        room.match =
          room.gameId === 'abluka'
            ? abluka.awardTimeout(room.match as AblukaMatch, winner)
            : pentago.awardTimeout(room.match as PentagoMatch, winner);
        room.clock = pauseClock(room.clock, now);
        broadcast(room);
      }
    }
    if (room.sockets[0] || room.sockets[1]) continue;
    const lastSeen = Math.max(room.disconnectedAt[0] ?? room.createdAt, room.disconnectedAt[1] ?? room.createdAt);
    if (now - lastSeen > 120_000) {
      rooms.delete(room.code);
      publishLobby(room.gameId);
    }
  }
}, 200);
