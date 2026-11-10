import { useState } from 'react';
import {
  ABLUKA_CHARACTERS,
  type CharacterId,
  pickOtherCharacter,
} from '../games/abluka/characters';

export function CharacterSelect({
  mode,
  onBack,
  onConfirm,
}: {
  mode: 'ai' | 'hotseat' | 'online';
  onBack: () => void;
  onConfirm: (characters: [CharacterId, CharacterId]) => void;
}) {
  const needTwo = mode === 'hotseat';
  const [step, setStep] = useState<0 | 1>(0);
  const [first, setFirst] = useState<CharacterId | null>(null);
  const [second, setSecond] = useState<CharacterId | null>(null);

  const active = step === 0 ? first : second;
  const title = needTwo
    ? step === 0
      ? 'Birinci oyuncu karakteri'
      : 'İkinci oyuncu karakteri'
    : 'Karakterini seç';
  const lede = needTwo
    ? step === 0
      ? 'Ablukadan kaçacak ilk taşını seç.'
      : 'Rakibin taşını seç.'
    : 'Ablukadan kaçacak taşın bu karakter olsun.';

  function choose(id: CharacterId) {
    if (step === 0) {
      setFirst(id);
      return;
    }
    if (id === first) return;
    setSecond(id);
  }

  function continueFlow() {
    if (step === 0) {
      if (!first) return;
      if (needTwo) {
        setStep(1);
        return;
      }
      onConfirm([first, pickOtherCharacter(first)]);
      return;
    }
    if (!first || !second) return;
    onConfirm([first, second]);
  }

  const canContinue = step === 0 ? first != null : second != null;

  return (
    <main className="setup-screen">
      <section className="panel setup character-select">
        <p className="eyebrow">Abluka · karakter</p>
        <h2>{title}</h2>
        <p className="lede tight">{lede}</p>
        <div className="character-grid" role="listbox" aria-label="Karakterler">
          {ABLUKA_CHARACTERS.map((character) => {
            const taken = step === 1 && character.id === first;
            const selected = active === character.id;
            return (
              <button
                key={character.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={taken}
                className={`character-card${selected ? ' on' : ''}${taken ? ' taken' : ''}`}
                onClick={() => choose(character.id)}
              >
                <img src={character.src} alt="" className="character-avatar" />
                <strong>{character.name}</strong>
                <small>{character.blurb}</small>
                <ul className="character-traits">
                  {character.traits.map((trait) => (
                    <li key={trait}>{trait}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (step === 1) {
                setStep(0);
                setSecond(null);
                return;
              }
              onBack();
            }}
          >
            Geri
          </button>
          <button type="button" className="btn primary" disabled={!canContinue} onClick={continueFlow}>
            {needTwo && step === 0 ? 'Sonraki' : 'Devam'}
          </button>
        </div>
      </section>
    </main>
  );
}
