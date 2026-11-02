import { describe, expect, it } from 'vitest';
import { socketUrlFrom } from '../src/ui/format';

describe('socketUrlFrom', () => {
  it('alan boşken sayfanın kendi adresini kullanır', () => {
    expect(socketUrlFrom(undefined, 'http:', 'localhost:5173')).toBe('ws://localhost:5173/ws');
    expect(socketUrlFrom('  ', 'https:', 'pentago.vercel.app')).toBe('wss://pentago.vercel.app/ws');
  });

  it('yalnız alan adından wss adresi kurar', () => {
    expect(socketUrlFrom('pentago-production.up.railway.app', 'https:', 'pentago.vercel.app')).toBe(
      'wss://pentago-production.up.railway.app/ws',
    );
  });

  it('http ve sondaki eğik çizgiyi soket adresine çevirir', () => {
    expect(socketUrlFrom('https://pentago-production.up.railway.app/', 'https:', 'localhost')).toBe(
      'wss://pentago-production.up.railway.app/ws',
    );
    expect(socketUrlFrom('wss://pentago-production.up.railway.app/ws', 'http:', 'localhost')).toBe(
      'wss://pentago-production.up.railway.app/ws',
    );
  });
});
