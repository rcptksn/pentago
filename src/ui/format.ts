import type { ClockView } from '../engine/clock';
import type { Color, TimerConfig } from '../engine/shared';
import type { EndReason as AblukaEndReason, MoveRecord as AblukaMove } from '../games/abluka/engine/types';
import type { EndReason as PentagoEndReason, MoveRecord as PentagoMove } from '../games/pentago/engine/types';

export const QUADRANT_NAMES = ['sol üst', 'sağ üst', 'sol alt', 'sağ alt'] as const;

export const TIMER_PRESETS: { id: string; label: string; timer: TimerConfig }[] = [
  { id: 'off', label: 'Saat kapalı', timer: { mode: 'off' } },
  { id: 'm30', label: 'Hamle başına 30 sn', timer: { mode: 'move', seconds: 30 } },
  { id: 'm60', label: 'Hamle başına 60 sn', timer: { mode: 'move', seconds: 60 } },
  { id: 'm90', label: 'Hamle başına 90 sn', timer: { mode: 'move', seconds: 90 } },
  { id: 't5', label: '5 dakika', timer: { mode: 'total', minutes: 5, increment: 0 } },
  { id: 't5i', label: '5 dakika + 3 sn', timer: { mode: 'total', minutes: 5, increment: 3 } },
  { id: 't10', label: '10 dakika + 5 sn', timer: { mode: 'total', minutes: 10, increment: 5 } },
];

export function formatPoint(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace('.', ',');
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100) / 10;
    return tenths.toFixed(1).replace('.', ',');
  }
  const total = Math.ceil(clamped / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function colorName(color: Color): string {
  return color === 'black' ? 'Siyah' : 'Beyaz';
}

export function squareName(r: number, c: number): string {
  return `${'ABCDEFG'[c]}${r + 1}`;
}

export const SET_CHOICES = [1, 2, 3, 4, 5] as const;

export function setChoiceLabel(count: number): string {
  return count === 1 ? '1 set' : `${count} set`;
}

export function setLabel(setsPlayed: number, over: boolean): string {
  if (over) return 'Maç bitti';
  return `Set ${setsPlayed + 1}`;
}

export function describePentagoSet(reason: PentagoEndReason, winnerName: string | null): string {
  if (reason === 'full' || !winnerName) return 'Tahta doldu. Set berabere.';
  if (reason === 'timeout') return `Süre doldu. Seti ${winnerName} aldı.`;
  if (reason === 'opponent-line') return `${winnerName} kazandı. Hamle rakibin beşlisini tamamladı.`;
  return `${winnerName} beşliyi tamamladı.`;
}

export function describeAblukaSet(reason: AblukaEndReason, winnerName: string): string {
  if (reason === 'timeout') return `Süre doldu. Seti ${winnerName} aldı.`;
  if (reason === 'mutual-lock') return `${winnerName} kazandı. Son hamle her iki taşı da ablukaya aldı.`;
  return `${winnerName} kazandı. Rakip taşını hareket ettiremedi.`;
}

export function describePentagoMove(index: number, move: PentagoMove): string {
  return `${index + 1}. ${colorName(move.color)} ${squareName(move.place.r, move.place.c)} · ${QUADRANT_NAMES[move.quadrant]}`;
}

export function describeAblukaMove(index: number, move: AblukaMove): string {
  return `${index + 1}. ${colorName(move.color)} ${squareName(move.from.r, move.from.c)}→${squareName(move.to.r, move.to.c)} · engel ${squareName(move.block.r, move.block.c)}`;
}

export function timerLabel(config: TimerConfig): string {
  return TIMER_PRESETS.find((item) => JSON.stringify(item.timer) === JSON.stringify(config))?.label ?? 'Saat';
}

export function interpolatedRemaining(clock: ClockView, receivedAt: number, now: number): [number, number] {
  return [0, 1].map((player) => {
    let left = clock.remaining[player as 0 | 1];
    if (!Number.isFinite(left)) return left;
    if (clock.running && clock.active === player) left -= now - receivedAt;
    return Math.max(0, left);
  }) as [number, number];
}

/** `VITE_SOCKET_DOMAIN` boşsa sayfanın kendi adresi kullanılır. */
export function socketUrlFrom(domain: string | undefined, pageProtocol: string, pageHost: string): string {
  const raw = domain?.trim();
  const secure = pageProtocol === 'https:';
  if (!raw) return `${secure ? 'wss' : 'ws'}://${pageHost}/ws`;
  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `${secure ? 'wss' : 'ws'}://${raw}`;
  const url = new URL(withProto);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path || '/ws';
  url.hash = '';
  return url.toString();
}

export function socketUrl(): string {
  return socketUrlFrom(import.meta.env.VITE_SOCKET_DOMAIN, location.protocol, location.host);
}

export function gameLabel(gameId: 'pentago' | 'abluka'): string {
  return gameId === 'abluka' ? 'Abluka' : 'Pentago';
}
