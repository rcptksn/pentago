import { useState } from 'react';
import type { GameId } from '../engine/shared';
import { AblukaRules } from '../games/abluka/ui/Rules';
import { PentagoRules } from '../games/pentago/ui/Rules';

const GAMES: { id: GameId; title: string; lede: string }[] = [
  { id: 'pentago', title: 'Pentago', lede: 'Bilyeni koy, bir parçayı saat yönünde çevir, beşliyi tamamla.' },
  { id: 'abluka', title: 'Abluka', lede: 'Karakterini seç, engellerden sıyrıl, ablukadan kaç.' },
];

const MODES = [
  { id: 'ai' as const, index: '01', title: 'Bilgisayara karşı', text: 'Kolay, orta veya zor bir rakip.' },
  { id: 'hotseat' as const, index: '02', title: 'Aynı ekranda', text: 'İki kişi, sırayla aynı tahta.' },
  { id: 'online' as const, index: '03', title: 'Açık odalar', text: 'Listeden bir oda seç, hemen otur.' },
];

export function Home({
  onChoose,
}: {
  onChoose: (gameId: GameId, mode: 'ai' | 'hotseat' | 'online') => void;
}) {
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [rules, setRules] = useState(false);
  const selected = GAMES.find((game) => game.id === gameId) ?? null;

  return (
    <main className="home">
      <section className="home-copy">
        <figure className="salon-portrait">
          <img src="/furkan.jpg" alt="Furkan Özden" />
        </figure>
        <h1>
          {selected ? (
            selected.id === 'pentago' ? (
              <>
                Penta<em>go</em>
              </>
            ) : (
              selected.title
            )
          ) : (
            <>
              Salon<em>.</em>
            </>
          )}
        </h1>
        <p className="lede">
          {selected ? selected.lede : 'Abluka veya Pentago seç, masaya otur.'}
        </p>
        {selected && (
          <button type="button" className="btn ghost" onClick={() => setRules(true)}>
            Kurallar
          </button>
        )}
      </section>
      {!selected ? (
        <section className="home-menu" aria-label="Oyun seç">
          {GAMES.map((game, index) => (
            <button key={game.id} type="button" className="menu-btn" onClick={() => setGameId(game.id)}>
              <span className="menu-index">{String(index + 1).padStart(2, '0')}</span>
              <span>
                <strong>{game.title}</strong>
                <small>{game.lede}</small>
              </span>
            </button>
          ))}
        </section>
      ) : (
        <section className="home-menu" aria-label="Oyun türü">
          {MODES.map((mode) => (
            <button key={mode.id} type="button" className="menu-btn" onClick={() => onChoose(selected.id, mode.id)}>
              <span className="menu-index">{mode.index}</span>
              <span>
                <strong>{mode.title}</strong>
                <small>{mode.text}</small>
              </span>
            </button>
          ))}
          <button type="button" className="menu-btn" onClick={() => setGameId(null)}>
            <span className="menu-index">↩</span>
            <span>
              <strong>Oyun seçimine dön</strong>
              <small>Abluka veya Pentago</small>
            </span>
          </button>
        </section>
      )}
      <p className="salon-name">Furkan Özden</p>
      {rules && selected?.id === 'pentago' && <PentagoRules onClose={() => setRules(false)} />}
      {rules && selected?.id === 'abluka' && <AblukaRules onClose={() => setRules(false)} />}
    </main>
  );
}
