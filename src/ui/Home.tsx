import { useState } from 'react';
import { Rules } from './Rules';

const MODES = [
  { id: 'ai' as const, index: '01', title: 'Bilgisayara karşı', text: 'Kolay, orta veya zor bir rakip.' },
  { id: 'hotseat' as const, index: '02', title: 'Aynı ekranda', text: 'İki kişi, sırayla aynı tahta.' },
  { id: 'online' as const, index: '03', title: 'Açık odalar', text: 'Listeden bir oda seç, hemen otur.' },
];

export function Home({ onChoose }: { onChoose: (mode: 'ai' | 'hotseat' | 'online') => void }) {
  const [rules, setRules] = useState(false);

  return (
    <main className="home">
      <section className="home-copy">
        <figure className="salon-portrait">
          <img src="/furkan.jpg" alt="Furkan Özden" />
        </figure>
        <h1>
          Penta<em>go</em>
        </h1>
        <p className="lede">Bilyeni koy, bir parçayı saat yönünde çevir, beşliyi tamamla.</p>
        <button type="button" className="btn ghost" onClick={() => setRules(true)}>
          Kurallar
        </button>
      </section>
      <section className="home-menu" aria-label="Oyun türü">
        {MODES.map((mode) => (
          <button key={mode.id} type="button" className="menu-btn" onClick={() => onChoose(mode.id)}>
            <span className="menu-index">{mode.index}</span>
            <span>
              <strong>{mode.title}</strong>
              <small>{mode.text}</small>
            </span>
          </button>
        ))}
      </section>
      <p className="salon-name">Furkan Özden</p>
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
