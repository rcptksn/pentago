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
      if (needTwo) {
        setFirst(id);
        setStep(1);
        return;
      }
      onConfirm([id, pickOtherCharacter(id)]);
      return;
    }
    if (!first || id === first) return;
    onConfirm([first, id]);
  }

  return (
    <main className="setup-screen">
      <section className="panel setup character-select">
        <p className="eyebrow">Abluka · karakter</p>
        <h2>{title}</h2>
        <p className="lede tight">{lede}</p>
        <div className="character-grid" role="listbox" aria-label="Karakterler">
          {ABLUKA_CHARACTERS.map((character) => {
            const taken = step === 1 && character.id === first;
            return (
              <button
                key={character.id}
                type="button"
                role="option"
                disabled={taken}
                className={`character-card${taken ? ' taken' : ''}`}
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
                setFirst(null);
                return;
              }
              onBack();
            }}
          >
            Geri
          </button>
        </div>
      </section>
    </main>
  );
}
