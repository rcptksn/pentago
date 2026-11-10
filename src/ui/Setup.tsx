import { useState } from 'react';
import type { LocalConfig } from '../App';
import type { Difficulty, GameId } from '../engine/shared';
import type { CharacterId } from '../games/abluka/characters';
import { gameLabel, SET_CHOICES, setChoiceLabel, TIMER_PRESETS } from './format';

export function Setup({
  gameId,
  mode,
  characters,
  onBack,
  onStart,
}: {
  gameId: GameId;
  mode: 'ai' | 'hotseat';
  characters?: [CharacterId, CharacterId];
  onBack: () => void;
  onStart: (config: LocalConfig) => void;
}) {
  const [you, setYou] = useState(mode === 'ai' ? 'Sen' : 'Oyuncu 1');
  const [other, setOther] = useState(mode === 'ai' ? 'Bilgisayar' : 'Oyuncu 2');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [setsToWin, setSetsToWin] = useState(1);
  const [timerId, setTimerId] = useState('off');

  return (
    <main className="setup-screen">
      <form
        className="panel setup"
        onSubmit={(event) => {
          event.preventDefault();
          const timer = TIMER_PRESETS.find((item) => item.id === timerId)?.timer ?? { mode: 'off' };
          const left = you.trim().slice(0, 18) || (mode === 'ai' ? 'Sen' : 'Oyuncu 1');
          const right = other.trim().slice(0, 18) || (mode === 'ai' ? 'Bilgisayar' : 'Oyuncu 2');
          onStart({ gameId, mode, names: [left, right], difficulty, timer, setsToWin, characters });
        }}
      >
        <p className="eyebrow">
          {gameLabel(gameId)} · {mode === 'ai' ? 'Bilgisayara karşı' : 'Aynı ekran'}
        </p>
        <h2>{mode === 'ai' ? 'Rakibini seç' : 'İkiniz de oturun'}</h2>
        <label className="field">
          <span>{mode === 'ai' ? 'Senin adın' : 'Birinci oyuncu'}</span>
          <input value={you} maxLength={18} onChange={(event) => setYou(event.target.value)} />
        </label>
        {mode === 'hotseat' && (
          <label className="field">
            <span>İkinci oyuncu</span>
            <input value={other} maxLength={18} onChange={(event) => setOther(event.target.value)} />
          </label>
        )}
        {mode === 'ai' && (
          <label className="field">
            <span>Zorluk</span>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
              <option value="easy">Kolay</option>
              <option value="medium">Orta</option>
              <option value="hard">Zor</option>
            </select>
          </label>
        )}
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
        <div className="row">
          <button type="button" className="btn ghost" onClick={onBack}>
            Geri
          </button>
          <button type="submit" className="btn primary">
            Masaya otur
          </button>
        </div>
      </form>
    </main>
  );
}
