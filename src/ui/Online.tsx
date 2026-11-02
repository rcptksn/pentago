import { useEffect, useRef, useState } from 'react';
import { rotateQuadrant } from '../engine/board';
import type { ClockView } from '../engine/clock';
import { placeMarble, playerOfColor, rotatePiece, turnPlayer } from '../engine/match';
import type { MatchState, PlayerId, TimerConfig } from '../engine/types';
import type { OpenRoom, ServerMessage, StateMessage } from '../net/protocol';
import { GameView } from './GameView';
import { interpolatedRemaining, SET_CHOICES, setChoiceLabel, socketUrl, timerLabel, TIMER_PRESETS } from './format';

const SESSION = 'pentago-seat';

/** Rakibin yeni biten çevirmesi. Kendi hamlemizin yankısı burada yok sayılır. */
function opponentQuadrant(prev: MatchState | null, next: MatchState, viewer: PlayerId): number | null {
  if (!prev || prev.setsPlayed !== next.setsPlayed) return null;
  const moves = next.set.moves;
  if (moves.length !== prev.set.moves.length + 1) return null;
  const move = moves[moves.length - 1];
  if (playerOfColor(next, move.color) === viewer) return null;
  return move.quadrant;
}

/** Çevirme animasyonu, bilye henüz dönmemiş tahta üzerinde oynar. */
function boardBeforeSpin(prev: MatchState, next: MatchState, q: number): MatchState {
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
}

export function Online({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'lobby' | 'wait' | 'play'>('lobby');
  const [name, setName] = useState('Oyuncu');
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [timerId, setTimerId] = useState('off');
  const [setsToWin, setSetsToWin] = useState(1);
  const [roomCode, setRoomCode] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [match, setMatch] = useState<MatchState | null>(null);
  const [names, setNames] = useState<[string, string]>(['Oyuncu 1', 'Oyuncu 2']);
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
  const matchRef = useRef<MatchState | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  function updateMatch(next: MatchState) {
    matchRef.current = next;
    setMatch(next);
  }

  function commitState(message: StateMessage) {
    if (message.revision <= rev.current) return;
    rev.current = message.revision;
    updateMatch(message.match);
    setNames(message.names);
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
    const q = opponentQuadrant(matchRef.current, message.match, message.player);
    if (q != null && matchRef.current) {
      const shown = boardBeforeSpin(matchRef.current, message.match, q);
      if (shown !== matchRef.current) updateMatch(shown);
      spinRef.current = q;
      setSpinQ(q);
      stash.current = message;
      return;
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
        setRooms(message.rooms);
      } else if (message.type === 'created' || message.type === 'joined') {
        const stored: Seat = { code: message.code, token: message.token, player: message.player };
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
          connect((next) => next.send(JSON.stringify({ type: 'lobby' })));
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
        seatRef.current = stored;
        setRoomCode(stored.code);
        setPhase('wait');
        setNotice('Odaya dönülüyor…');
        connect((socket) => socket.send(JSON.stringify({ type: 'resume', code: stored.code, token: stored.token })));
      } catch {
        localStorage.removeItem(SESSION);
        connect((socket) => socket.send(JSON.stringify({ type: 'lobby' })));
      }
    } else {
      connect((socket) => socket.send(JSON.stringify({ type: 'lobby' })));
    }
    return () => {
      left.current = true;
      window.clearInterval(timer);
      wsRef.current?.close();
    };
    // Oda oturumu yalnız ilk açılışta aranır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    ensure((socket) => socket.send(JSON.stringify({ type: 'join', code, name: playerName() })));
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
    const current = matchRef.current;
    if (!current || spinRef.current != null) return;
    if (turnPlayer(current) !== seat) return;
    const next = placeMarble(current, r, c);
    if (!next) return;
    updateMatch(next);
    wsRef.current?.send(JSON.stringify({ type: 'place', r, c }));
  }

  function onRotate(q: number) {
    const current = matchRef.current;
    if (!current || spinRef.current != null) return;
    if (turnPlayer(current) !== seat) return;
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
    const current = matchRef.current;
    if (!current) return;
    const next = rotatePiece(current, q);
    if (next) updateMatch(next);
  }

  const display =
    clock && clock.config.mode !== 'off'
      ? { config: clock.config, remaining: interpolatedRemaining(clock, receivedAt, now), active: clock.active }
      : null;

  if (phase === 'play' && match) {
    return (
      <GameView
        match={match}
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
          <p className="eyebrow">Oda açık</p>
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
            socket.send(JSON.stringify({ type: 'create', name: clean, roomName: title, timer: timer(), setsToWin })),
          );
        }}
      >
        <p className="eyebrow">İki cihaz</p>
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
