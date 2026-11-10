import { useEffect, useRef, useState } from 'react';
import type { ClockView } from '../engine/clock';
import type { GameId, PlayerId, TimerConfig } from '../engine/shared';
import type { CharacterId } from '../games/abluka/characters';
import * as abluka from '../games/abluka/engine/match';
import type { MatchState as AblukaMatch } from '../games/abluka/engine/types';
import { rotateQuadrant } from '../games/pentago/engine/board';
import * as pentago from '../games/pentago/engine/match';
import type { MatchState as PentagoMatch } from '../games/pentago/engine/types';
import type { OpenRoom, ServerMessage, StateMessage } from '../net/protocol';
import { GameView } from './GameView';
import {
  gameLabel,
  interpolatedRemaining,
  SET_CHOICES,
  setChoiceLabel,
  socketUrl,
  timerLabel,
  TIMER_PRESETS,
} from './format';

const SESSION = 'salon-seat';

function opponentQuadrant(prev: PentagoMatch | null, next: PentagoMatch, viewer: PlayerId): number | null {
  if (!prev || prev.setsPlayed !== next.setsPlayed) return null;
  const moves = next.set.moves;
  if (moves.length !== prev.set.moves.length + 1) return null;
  const move = moves[moves.length - 1];
  if (pentago.playerOfColor(next, move.color) === viewer) return null;
  return move.quadrant;
}

function boardBeforeSpin(prev: PentagoMatch, next: PentagoMatch, q: number): PentagoMatch {
  const move = next.set.moves[next.set.moves.length - 1];
  const pending = prev.set.pendingPlace;
  const aligned =
    prev.set.phase === 'rotate' && pending != null && pending.r === move.place.r && pending.c === move.place.c;
  if (aligned) return prev;
  let board = next.set.board;
  for (let i = 0; i < 3; i += 1) board = rotateQuadrant(board, q);
  return {
    ...prev,
    set: {
      board,
      turn: move.color,
      phase: 'rotate',
      pendingPlace: move.place,
      winner: null,
      reason: null,
      moves: next.set.moves.slice(0, -1),
    },
  };
}

interface Seat {
  code: string;
  token: string;
  player: PlayerId;
  gameId: GameId;
}

export function Online({
  gameId,
  characterId,
  onExit,
}: {
  gameId: GameId;
  characterId?: CharacterId;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<'lobby' | 'wait' | 'play'>('lobby');
  const [name, setName] = useState('Oyuncu');
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [timerId, setTimerId] = useState('off');
  const [setsToWin, setSetsToWin] = useState(1);
  const [roomCode, setRoomCode] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [match, setMatch] = useState<PentagoMatch | AblukaMatch | null>(null);
  const [names, setNames] = useState<[string, string]>(['Oyuncu 1', 'Oyuncu 2']);
  const [characters, setCharacters] = useState<[CharacterId, CharacterId] | null>(null);
  const [seat, setSeat] = useState<PlayerId>(0);
  const [clock, setClock] = useState<ClockView | null>(null);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState<[boolean, boolean]>([true, true]);
  const [notice, setNotice] = useState<string | null>(null);
  const [spinQ, setSpinQ] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const epoch = useRef(0);
  const tries = useRef(0);
  const left = useRef(false);
  const rev = useRef(0);
  const spinRef = useRef<number | null>(null);
  const stash = useRef<StateMessage | null>(null);
  const seatRef = useRef<Seat | null>(null);
  const matchRef = useRef<PentagoMatch | AblukaMatch | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  function updateMatch(next: PentagoMatch | AblukaMatch) {
    matchRef.current = next;
    setMatch(next);
  }

  function commitState(message: StateMessage) {
    if (message.revision <= rev.current) return;
    rev.current = message.revision;
    updateMatch(message.match);
    setNames(message.names);
    setCharacters(message.characters ?? null);
    setSeat(message.player);
    setClock(message.clock);
    setReceivedAt(Date.now());
    setConnected(message.connected);
    setRoomCode(message.code);
    setPhase('play');
    const opponent: PlayerId = message.player === 0 ? 1 : 0;
    setNotice(message.connected[opponent] ? null : 'Rakip yeniden bağlanıyor…');
  }

  function applyState(message: StateMessage) {
    if (message.revision <= rev.current) return;
    if (spinRef.current != null) {
      if (!stash.current || message.revision >= stash.current.revision) stash.current = message;
      return;
    }
    if (message.gameId === 'pentago') {
      const q = opponentQuadrant(
        matchRef.current as PentagoMatch | null,
        message.match as PentagoMatch,
        message.player,
      );
      if (q != null && matchRef.current) {
        const shown = boardBeforeSpin(matchRef.current as PentagoMatch, message.match as PentagoMatch, q);
        if (shown !== matchRef.current) updateMatch(shown);
        spinRef.current = q;
        setSpinQ(q);
        stash.current = message;
        return;
      }
    }
    commitState(message);
  }

  function connect(hello: (socket: WebSocket) => void) {
    epoch.current += 1;
    const mine = epoch.current;
    wsRef.current?.close();
    const socket = new WebSocket(socketUrl());
    wsRef.current = socket;
    socket.onopen = () => {
      if (epoch.current !== mine) return;
      tries.current = 0;
      hello(socket);
    };
    socket.onmessage = (event) => {
      if (epoch.current !== mine) return;
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type === 'rooms') {
        if (message.gameId === gameId) setRooms(message.rooms);
      } else if (message.type === 'created' || message.type === 'joined') {
        const stored: Seat = {
          code: message.code,
          token: message.token,
          player: message.player,
          gameId: message.gameId,
        };
        seatRef.current = stored;
        localStorage.setItem(SESSION, JSON.stringify(stored));
        setSeat(message.player);
        setRoomCode(message.code);
        if (message.type === 'created') {
          setRoomTitle(message.name);
          setPhase('wait');
        }
      } else if (message.type === 'waiting') {
        setRoomCode(message.code);
        setRoomTitle(message.name);
        setPhase('wait');
      } else if (message.type === 'state') {
        applyState(message);
      } else if (message.type === 'error') {
        setNotice(message.message);
        if (message.message.includes('bulunamadı') || message.message.includes('tanınmadı')) {
          localStorage.removeItem(SESSION);
          seatRef.current = null;
          if (phaseRef.current !== 'play') setPhase('lobby');
        }
      } else if (message.type === 'closed') {
        left.current = true;
        localStorage.removeItem(SESSION);
        seatRef.current = null;
        setNotice(message.message);
        setPhase('lobby');
        setMatch(null);
        matchRef.current = null;
      }
    };
    socket.onclose = () => {
      if (left.current || epoch.current !== mine) return;
      tries.current += 1;
      if (tries.current > 6) {
        setNotice('Sunucuya bağlanılamadı.');
        return;
      }
      const stored = seatRef.current;
      window.setTimeout(() => {
        if (left.current || epoch.current !== mine) return;
        if (!stored) {
          connect((next) => next.send(JSON.stringify({ type: 'lobby', gameId })));
          return;
        }
        connect((next) => next.send(JSON.stringify({ type: 'resume', code: stored.code, token: stored.token })));
      }, 700);
    };
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    const raw = localStorage.getItem(SESSION);
    if (raw) {
      try {
        const stored = JSON.parse(raw) as Seat;
        if (stored.gameId && stored.gameId !== gameId) {
          connect((socket) => socket.send(JSON.stringify({ type: 'lobby', gameId })));
        } else {
          seatRef.current = { ...stored, gameId: stored.gameId ?? gameId };
          setRoomCode(stored.code);
          setPhase('wait');
          setNotice('Odaya dönülüyor…');
          connect((socket) =>
            socket.send(JSON.stringify({ type: 'resume', code: stored.code, token: stored.token })),
          );
        }
      } catch {
        localStorage.removeItem(SESSION);
        connect((socket) => socket.send(JSON.stringify({ type: 'lobby', gameId })));
      }
    } else {
      connect((socket) => socket.send(JSON.stringify({ type: 'lobby', gameId })));
    }
    return () => {
      left.current = true;
      window.clearInterval(timer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  function timer(): TimerConfig {
    return TIMER_PRESETS.find((item) => item.id === timerId)?.timer ?? { mode: 'off' };
  }

  function playerName(): string {
    return name.trim().slice(0, 18) || 'Oyuncu';
  }

  function ensure(hello: (socket: WebSocket) => void) {
    left.current = false;
    tries.current = 0;
    const current = wsRef.current;
    if (current && current.readyState === WebSocket.OPEN) {
      hello(current);
      return;
    }
    connect(hello);
  }

  function joinRoom(code: string) {
    setNotice(null);
    ensure((socket) =>
      socket.send(JSON.stringify({ type: 'join', code, name: playerName(), characterId })),
    );
  }

  function roomDetail(room: OpenRoom): string {
    const detail = [setChoiceLabel(room.setsToWin), timerLabel(room.timer)];
    if (room.host !== room.name) detail.unshift(room.host);
    return detail.join(' · ');
  }

  function exit() {
    left.current = true;
    localStorage.removeItem(SESSION);
    seatRef.current = null;
    wsRef.current?.send(JSON.stringify({ type: 'leave' }));
    wsRef.current?.close();
    onExit();
  }

  function onPlace(r: number, c: number) {
    const current = matchRef.current as PentagoMatch | null;
    if (!current || spinRef.current != null) return;
    if (pentago.turnPlayer(current) !== seat) return;
    const next = pentago.placeMarble(current, r, c);
    if (!next) return;
    updateMatch(next);
    wsRef.current?.send(JSON.stringify({ type: 'place', r, c }));
  }

  function onRotate(q: number) {
    const current = matchRef.current as PentagoMatch | null;
    if (!current || spinRef.current != null) return;
    if (pentago.turnPlayer(current) !== seat) return;
    spinRef.current = q;
    setSpinQ(q);
    wsRef.current?.send(JSON.stringify({ type: 'rotate', q }));
  }

  function onSpinDone() {
    const q = spinRef.current;
    if (q == null) return;
    spinRef.current = null;
    setSpinQ(null);
    const pending = stash.current;
    if (pending) {
      stash.current = null;
      commitState(pending);
      return;
    }
    const current = matchRef.current as PentagoMatch | null;
    if (!current) return;
    const next = pentago.rotatePiece(current, q);
    if (next) updateMatch(next);
  }

  function onAblukaCell(r: number, c: number) {
    const current = matchRef.current as AblukaMatch | null;
    if (!current) return;
    if (abluka.turnPlayer(current) !== seat) return;
    if (current.set.phase === 'move') {
      const next = abluka.movePiece(current, r, c);
      if (!next) return;
      updateMatch(next);
      wsRef.current?.send(JSON.stringify({ type: 'abluka-move', r, c }));
      return;
    }
    const next = abluka.placeBlock(current, r, c);
    if (!next) return;
    updateMatch(next);
    wsRef.current?.send(JSON.stringify({ type: 'abluka-block', r, c }));
  }

  const display =
    clock && clock.config.mode !== 'off'
      ? { config: clock.config, remaining: interpolatedRemaining(clock, receivedAt, now), active: clock.active }
      : null;

  if (phase === 'play' && match) {
    if (gameId === 'abluka') {
      return (
        <GameView
          gameId="abluka"
          match={match as AblukaMatch}
          names={names}
          seat={seat}
          thinking={false}
          clock={display}
          connected={connected}
          notice={notice}
          characters={characters ?? undefined}
          onCell={onAblukaCell}
          onContinue={() => wsRef.current?.send(JSON.stringify({ type: 'continue' }))}
          onRematch={() => wsRef.current?.send(JSON.stringify({ type: 'rematch' }))}
          onExit={exit}
        />
      );
    }
    return (
      <GameView
        gameId="pentago"
        match={match as PentagoMatch}
        names={names}
        seat={seat}
        thinking={false}
        spinQ={spinQ}
        clock={display}
        connected={connected}
        notice={notice}
        onPlace={onPlace}
        onRotate={onRotate}
        onSpinDone={onSpinDone}
        onContinue={() => wsRef.current?.send(JSON.stringify({ type: 'continue' }))}
        onRematch={() => wsRef.current?.send(JSON.stringify({ type: 'rematch' }))}
        onExit={exit}
      />
    );
  }

  if (phase === 'wait') {
    return (
      <main className="setup-screen">
        <section className="panel">
          <p className="eyebrow">{gameLabel(gameId)} · oda açık</p>
          <h2>{roomTitle || roomCode}</h2>
          <p>Rakip listeden bu adı seçince oyun başlar.</p>
          {notice && <p className="notice">{notice}</p>}
          <div className="row">
            <button type="button" className="btn ghost" onClick={exit}>
              Vazgeç
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="setup-screen">
      <form
        className="panel setup lobby"
        onSubmit={(event) => {
          event.preventDefault();
          const clean = playerName();
          const title = roomName.trim().slice(0, 24) || clean;
          setNotice(null);
          ensure((socket) =>
            socket.send(
              JSON.stringify({
                type: 'create',
                gameId,
                name: clean,
                roomName: title,
                timer: timer(),
                setsToWin,
                characterId,
              }),
            ),
          );
        }}
      >
        <p className="eyebrow">{gameLabel(gameId)} · iki cihaz</p>
        <h2>Açık odalar</h2>
        <label className="field">
          <span>Adın</span>
          <input value={name} maxLength={18} onChange={(event) => setName(event.target.value)} />
        </label>
        {rooms.length === 0 ? (
          <p className="room-empty">Şu an açık oda yok. Bir oda kur, rakibin listeden seçsin.</p>
        ) : (
          <div className="room-list">
            {rooms.map((room) => (
              <button key={room.code} type="button" className="room-btn" onClick={() => joinRoom(room.code)}>
                <span>
                  <strong>{room.name}</strong>
                  <small>{roomDetail(room)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>Oda adı</span>
          <input
            value={roomName}
            maxLength={24}
            onChange={(event) => setRoomName(event.target.value)}
            placeholder="Akşam masası"
          />
        </label>
        <label className="field">
          <span>Kaç set</span>
          <select value={setsToWin} onChange={(event) => setSetsToWin(Number(event.target.value))}>
            {SET_CHOICES.map((count) => (
              <option key={count} value={count}>
                {setChoiceLabel(count)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Saat</span>
          <select value={timerId} onChange={(event) => setTimerId(event.target.value)}>
            {TIMER_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {notice && <p className="notice">{notice}</p>}
        <div className="row">
          <button type="button" className="btn ghost" onClick={onExit}>
            Geri
          </button>
          <button type="submit" className="btn primary">
            Oda kur
          </button>
        </div>
      </form>
    </main>
  );
}
